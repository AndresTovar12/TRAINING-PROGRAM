-- PENDIENTE DE APROBACIÓN DE ANDRÉS. NO SE HA APLICADO.
-- p75 raíz · ETAPA 2, grupo 1 (25 oct 2026). La herramienta de migraciones la rechaza («declined») porque el cuerpo de la función lleva un DELETE (la poda de versiones viejas).
--
-- QUÉ HACE (5 líneas)
--   Borrar una cuenta que tiene planes falla («Database error deleting user»): auth.users → profiles → plans caen en cascada y el disparador
--   `plans_guardar_version` intenta guardar la última versión del plan con `user_id` de una persona que YA no existe; la llave foránea de `plan_versiones`
--   rechaza la fila y se cae todo el borrado. Este archivo agrega al principio de la función UNA salida: si es un DELETE y la persona dueña ya no existe,
--   no guarda versión y deja seguir el borrado. Todo lo demás de la función queda idéntico.
--   Con eso funcionan igual la app, el conector de IA (`eliminar_cuenta`) y borrar a mano, sin el truco de «borrar planes primero».
--   QUÉ PODRÍA ROMPER: nada que ya funcione. Solo cambia el caso que hoy falla. Una cuenta que se borra de verdad no guarda historial de sus planes (igual que hoy: los borra antes).
--   REVERTIR: volver a crear la función sin ese `if` (el cuerpo de abajo menos las 3 líneas marcadas).
--   Cómo aplicarlo: pegarlo en el editor SQL de Supabase (o `execute_sql` con permiso), y probar con una cuenta zz_ con un plan.

create or replace function public.guardar_version_del_plan()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_cliente_id text := auth.jwt() ->> 'client_id';
  v_cliente text;
  v_motivo text;
begin
  if tg_op = 'UPDATE'
     and new.data is not distinct from old.data
     and new.title is not distinct from old.title
     and new.status is not distinct from old.status then
    return new;
  end if;

  -- NUEVO (p75): la cuenta ya no existe (borrado en cascada): no hay a quién guardarle la versión.
  if tg_op = 'DELETE' and not exists (select 1 from public.profiles where id = old.user_id) then
    return old;
  end if;

  if v_cliente_id is not null then
    select c.client_name into v_cliente from auth.oauth_clients c where c.id::text = v_cliente_id;
    v_cliente := coalesce(nullif(v_cliente, ''), 'IA');
  end if;

  v_motivo := coalesce(
    nullif(current_setting('app.motivo_version', true), ''),
    case tg_op when 'DELETE' then 'borrado' else 'edicion' end
  );

  insert into public.plan_versiones
    (plan_id, user_id, title, status, data, version_de, cambiada_por, cliente_ia, motivo, profesional_id)
  values
    (old.id, old.user_id, old.title, old.status, old.data, old.updated_at, auth.uid(), v_cliente, v_motivo, old.profesional_id);

  delete from public.plan_versiones
   where id in (
     select id from public.plan_versiones where plan_id = old.id order by creada_en desc offset 30
   );

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$function$;
