-- PENDIENTE DE APROBACIÓN DE ANDRÉS. NO SE HA APLICADO. Lleva DROP CONSTRAINT (la herramienta de migraciones lo rechaza a propósito): se pega en el editor SQL de Supabase.
-- 26 oct 2026 · «que el coach pueda borrar su cuenta sin afectar a ningún comprador». Diseño: docs/superpowers/specs/2026-10-26-borrar-cuenta-con-compradores.md
--
-- QUÉ HACE (5 líneas)
--   1. `vitrina_planes.coach_id`, `compras.coach_id` y `pagos.coach_id` pueden quedar vacíos y, al borrarse el coach, pasan a vacío (antes: se borraban en cascada o lo impedían).
--   2. `vitrina_planes` guarda una copia del nombre y la foto del coach (`coach_nombre`, `coach_foto`) y, en una biblioteca de clases, las clases que tenía (`biblioteca_congelada`).
--   3. El disparador `compras_sincroniza_vinculo` no intenta dar de alta al «equipo» cuando la compra ya no tiene coach (si no, el próximo cobro de ese comprador fallaría).
--   4. `mis_compras_resumen` usa el nombre guardado cuando el coach ya no existe.
--   QUÉ PODRÍA ROMPER: nada que funcione hoy (las tres tablas están casi vacías: 2 compras pendientes, 0 pagos). REVERTIR: volver a poner NOT NULL y las llaves en CASCADE/RESTRICT
--   (solo posible mientras no haya filas con coach vacío).
--   ORDEN: pegar este archivo ANTES de publicar la versión nueva de `mi-cuenta` (si no, `mi-cuenta` intentaría guardar columnas que aún no existen).

begin;

-- 1) vitrina_planes
alter table public.vitrina_planes alter column coach_id drop not null;
alter table public.vitrina_planes drop constraint vitrina_planes_coach_id_fkey;
alter table public.vitrina_planes
  add constraint vitrina_planes_coach_id_fkey foreign key (coach_id) references public.profiles(id) on delete set null;
alter table public.vitrina_planes
  add column if not exists coach_nombre text,
  add column if not exists coach_foto text,
  add column if not exists biblioteca_congelada jsonb;

-- 2) compras
alter table public.compras alter column coach_id drop not null;
alter table public.compras drop constraint compras_coach_id_fkey;
alter table public.compras
  add constraint compras_coach_id_fkey foreign key (coach_id) references public.profiles(id) on delete set null;

-- 3) pagos (hoy vacía; un coach que ya cobró algo no se podía borrar nunca)
alter table public.pagos alter column coach_id drop not null;
alter table public.pagos drop constraint pagos_coach_id_fkey;
alter table public.pagos
  add constraint pagos_coach_id_fkey foreign key (coach_id) references public.profiles(id) on delete set null;

-- 4) El disparador que da de alta al comprador en el equipo del coach: sin coach no hay equipo.
create or replace function public.compras_sincroniza_vinculo()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.coach_id is null then
    return null; -- el coach borró su cuenta: la compra sigue, pero no hay a quién dar de alta ni de baja
  end if;
  if new.estado in ('activa', 'gracia', 'por_armar') and (tg_op = 'INSERT' or old.estado is distinct from new.estado) then
    insert into public.equipo (atleta_id, profesional_id, estado, origen, aceptado_en)
    values (new.atleta_id, new.coach_id, 'activo', 'compra', now())
    on conflict (atleta_id, profesional_id) do update set estado = 'activo', origen = 'compra', aceptado_en = now(), quitado_en = null
      where public.equipo.estado <> 'activo';
  elsif tg_op = 'UPDATE' and old.estado in ('activa', 'gracia', 'por_armar') and new.estado in ('vencida', 'reembolsada', 'cancelada') then
    if not exists (select 1 from public.compras c where c.atleta_id = new.atleta_id and c.coach_id = new.coach_id and c.id <> new.id and c.estado in ('activa', 'gracia', 'por_armar')) then
      update public.equipo set estado = 'quitado', quitado_en = now()
       where atleta_id = new.atleta_id and profesional_id = new.coach_id and origen = 'compra' and estado = 'activo';
    end if;
  end if;
  return null;
end $function$;

-- 5) «Mis compras»: con el coach ya borrado se muestra el nombre que se guardó.
create or replace function public.mis_compras_resumen()
returns table(compra_id uuid, titulo text, contenido text, vendedor_nombre text, vendedor_usuario text, estado text, tipo text, precio_mxn integer, inicio date, periodo_hasta timestamp with time zone, gracia_hasta timestamp with time zone, cancelada_en timestamp with time zone, creada_en timestamp with time zone, pagado numeric, primer_pago_en timestamp with time zone)
language sql
stable security definer
set search_path to 'public'
as $function$
  select c.id, coalesce(v.titulo, 'Plan'), v.contenido, coalesce(p.full_name, v.coach_nombre), p.username, c.estado, c.tipo, c.precio_mxn,
         c.inicio, c.periodo_hasta, c.gracia_hasta, c.cancelada_en, c.creada_en,
         (select coalesce(sum(g.bruto), 0) from public.pagos g where g.compra_id = c.id and g.estado = 'cobrado'),
         (select min(g.fecha) from public.pagos g where g.compra_id = c.id and g.estado = 'cobrado')
    from public.compras c
    left join public.vitrina_planes v on v.id = c.vitrina_plan_id
    left join public.profiles p on p.id = c.coach_id
   where c.atleta_id = auth.uid() and c.estado <> 'pendiente'
   order by c.creada_en desc
$function$;

commit;
