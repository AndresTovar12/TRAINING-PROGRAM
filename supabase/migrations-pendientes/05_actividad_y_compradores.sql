-- PENDIENTE DE APROBACIÓN DE ANDRÉS. NO SE HA APLICADO. Lleva DROP TRIGGER (la herramienta de migraciones lo rechaza): se pega en el editor SQL de Supabase.
-- 26 oct 2026 · auditoría p49 y p14.
--
-- QUÉ HACE (5 líneas)
--   p49. Mover, pausar o reanudar el plan de un atleta (`mover_plan_de_atleta`) ya NO cambia su «Última actividad» ni lo cuenta como «activo en 7 días»: esa fecha es `user_app_state.updated_at`
--        y un disparador la ponía en «ahora» con cualquier cambio. El disparador ahora respeta una marca que solo pone `mover_plan_de_atleta` (en esa transacción). Lo que guarda el propio atleta sigue marcándola.
--   p14. «Compradores activos» (Mi perfil → Cobros) cuenta PERSONAS, no compras: 2 personas con 4 compras eran «4 compradores».
--   QUÉ PODRÍA ROMPER: nada que funcione hoy. El cliente solo lee `user_app_state.data`, nunca `updated_at`. REVERTIR: volver a crear el disparador con `set_updated_at()` y las dos funciones sin los cambios marcados.

begin;

-- p49) El disparador del estado respeta la marca «no cuentes esto como actividad del atleta».
create or replace function public.set_updated_at_estado()
returns trigger
language plpgsql
as $function$
begin
  if current_setting('app.sin_tocar_actividad', true) = '1' then
    new.updated_at := old.updated_at;
  else
    new.updated_at := now();
  end if;
  return new;
end $function$;

drop trigger if exists trg_user_app_state_updated on public.user_app_state;
create trigger trg_user_app_state_updated
  before update on public.user_app_state
  for each row execute function public.set_updated_at_estado();

create or replace function public.mover_plan_de_atleta(p_atleta uuid, p_clave text, p_cursor jsonb)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if auth.uid() is null then
    raise exception 'Sin sesión';
  end if;
  if not (public.is_master() or (public.is_admin() and public.cuenta_activa() and public.atiendo_a(p_atleta))) then
    raise exception 'No atiendes a esta persona';
  end if;
  if p_clave = 'wr:cursor' then
    if not (public.is_master() or public.es_mi_atleta(p_atleta)) then
      raise exception 'El puntero del programa principal es de su coach';
    end if;
  elsif p_clave is distinct from ('wr:cursor@' || auth.uid()::text) and not public.is_master() then
    raise exception 'Clave inválida';
  end if;
  if p_clave !~ '^wr:cursor(@[0-9a-f-]{36})?$' then
    raise exception 'Clave inválida';
  end if;
  if jsonb_typeof(p_cursor) is distinct from 'object' or length(p_cursor::text) > 2000 then
    raise exception 'Puntero inválido';
  end if;
  -- NUEVO (p49): lo que mueve el coach no es actividad del atleta; el disparador conserva su `updated_at`.
  perform set_config('app.sin_tocar_actividad', '1', true);
  insert into public.user_app_state as u (user_id, data, updated_at)
  values (p_atleta, jsonb_build_object(p_clave, p_cursor), now())
  on conflict (user_id) do update
    set data = u.data || jsonb_build_object(p_clave, p_cursor);
end;
$function$;

-- p14) Personas, no compras.
create or replace function public.mis_cobros_resumen()
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare yo uuid := auth.uid(); inicio_de_mes timestamptz := date_trunc('month', now());
begin
  if yo is null then raise exception 'Necesitas entrar a tu cuenta'; end if;
  return jsonb_build_object(
    'cuenta', (select to_jsonb(c) - 'acct_id' from public.cuentas_stripe c where c.coach_id = yo),
    'ventas_mes_bruto',   coalesce((select sum(bruto) from public.pagos where coach_id = yo and estado = 'cobrado' and fecha >= inicio_de_mes), 0),
    'ventas_mes_neto',    coalesce((select sum(parte_coach) from public.pagos where coach_id = yo and estado = 'cobrado' and fecha >= inicio_de_mes), 0),
    'ventas_total_neto',  coalesce((select sum(parte_coach) from public.pagos where coach_id = yo and estado = 'cobrado'), 0),
    'comision_total',     coalesce((select sum(comision_app) from public.pagos where coach_id = yo and estado = 'cobrado'), 0),
    'compradores_activos',(select count(distinct atleta_id) from public.compras where coach_id = yo and estado in ('activa', 'gracia')),
    'comision_actual',    coalesce((select comision_especial from public.profiles where id = yo), 0.2),
    'ultimos', coalesce((
      select jsonb_agg(jsonb_build_object('fecha', x.fecha, 'bruto', x.bruto, 'parte_coach', x.parte_coach, 'comision_app', x.comision_app, 'estado', x.estado, 'titulo', x.titulo) order by x.fecha desc)
        from (select g.fecha, g.bruto, g.parte_coach, g.comision_app, g.estado, coalesce(v.titulo, 'Plan') as titulo
                from public.pagos g left join public.compras c on c.id = g.compra_id left join public.vitrina_planes v on v.id = c.vitrina_plan_id
               where g.coach_id = yo order by g.fecha desc limit 10) x
    ), '[]'::jsonb)
  );
end $function$;

commit;
