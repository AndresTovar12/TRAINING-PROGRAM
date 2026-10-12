-- ESPACIO DE VIDEOS POR COACH (11 oct 2026).
--
-- POR QUÉ. Los videos cuestan por lo que PESAN guardados en Cloudflare R2 (≈ MXN 1 al mes por hora de video en 1080p). Una maestra de pilates que sube clases de una hora pesa
-- 3.5 GB por clase; con 2,000 videos de ejercicios la cuenta sube. Andrés (11 oct 2026): «necesito estandarizarlo para saber hasta cuántos puede subir un coach» y «no quiero
-- comprimir videos». Entonces el límite NO toca el video: se mide cuánto espacio usa cada coach y se le deja de dejar subir cuando lo llena.
--
-- LA REGLA (una sola, aquí abajo en `espacio_del_coach`; cambiarla es cambiar dos números):
--   · Todo coach empieza con 10 GB  (≈ 3 horas de clase en 1080p).
--   · Cada cliente que le paga (compra `activa` o en `gracia`) le suma 7 GB (≈ 2 horas más).
--   · El dueño (`profiles.is_owner`) no tiene límite.
--   · Una hora de video en 1080p pesa ≈ 3.5 GB; en 4K, ≈ 11 GB (por eso a las clases largas se les recomienda 1080p).
--   Los clientes propios del coach (los que él trae a la app) NO suman: no le dejan nada a la app, así que no agrandan su espacio.
--
-- QUÉ SE GUARDA. `medios_peso`: una fila por archivo subido (ruta, quién, cuánto pesa). La anota la Edge Function `r2-upload` al darle permiso de subir. Nadie la lee desde la app:
-- el coach pregunta con `mi_espacio()`.
--
-- QUÉ CUENTA COMO «USADO». Solo lo que sigue en uso: un archivo cuenta si aparece en un ejercicio, en un video extra o en una CLASE del coach (dentro de Mis planes o del plan de un alumno), o si se subió hace menos de un día (puede ser un
-- borrador abierto en el editor que todavía no se guarda). Así, al borrar un ejercicio el espacio vuelve al instante, aunque el archivo siga unos días en Cloudflare esperando
-- a la limpieza (`limpia-r2`).
--
-- Aplicado el 11 oct 2026.

create table if not exists public.medios_peso (
  ruta text primary key,                                   -- 'videos/<uuid>.mp4', igual que en R2
  coach_id uuid not null references auth.users(id) on delete cascade,
  bytes bigint not null check (bytes >= 0),
  tipo text,                                               -- 'video/mp4', 'image/jpeg'…
  creado_en timestamptz not null default now()
);
create index if not exists medios_peso_coach_idx on public.medios_peso (coach_id);
alter table public.medios_peso enable row level security;
-- Sin políticas: ni la app ni el público leen ni escriben aquí. Solo las funciones del servidor (service_role) y las funciones de abajo.
revoke all on table public.medios_peso from anon, authenticated;

create or replace function public.espacio_del_coach(p_coach uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  c_base        constant bigint := 10000000000;  -- 10 GB para empezar
  c_por_cliente constant bigint := 7000000000;   -- 7 GB más por cada cliente que paga
  v_dueno    boolean;
  v_clientes int;
  v_usado    bigint;
begin
  select coalesce(p.is_owner, false) into v_dueno from public.profiles p where p.id = p_coach;
  select count(distinct c.atleta_id) into v_clientes
    from public.compras c where c.coach_id = p_coach and c.estado in ('activa', 'gracia');
  select coalesce(sum(mp.bytes), 0) into v_usado
    from public.medios_peso mp
   where mp.coach_id = p_coach
     and (
       mp.creado_en > now() - interval '1 day'
       or exists (select 1 from public.exercises e
                   where e.created_by = p_coach and (e.video_url like '%' || mp.ruta or e.cover_image_url like '%' || mp.ruta))
       or exists (select 1 from public.exercise_media m
                   where m.created_by = p_coach and m.url like '%' || mp.ruta)
       -- Las CLASES: un video largo vive dentro de la sesión (`sesion.clase.url`), en Mis planes o en el plan de un alumno.
       or exists (select 1 from public.routine_templates t
                   where t.created_by = p_coach and t.data::text like '%' || mp.ruta || '%')
       or exists (select 1 from public.programas_guardados g
                   where g.created_by = p_coach and g.data::text like '%' || mp.ruta || '%')
       or exists (select 1 from public.plans pl
                   where (pl.created_by = p_coach or pl.profesional_id = p_coach) and pl.data::text like '%' || mp.ruta || '%')
     );
  return jsonb_build_object(
    'usado', v_usado,
    'limite', case when coalesce(v_dueno, false) then null else c_base + c_por_cliente * v_clientes end,
    'clientes', v_clientes,
    'ilimitado', coalesce(v_dueno, false),
    'base', c_base,                -- para que la app y los avisos digan los mismos números que la regla
    'por_cliente', c_por_cliente
  );
end $$;
revoke execute on function public.espacio_del_coach(uuid) from public, anon, authenticated;
grant execute on function public.espacio_del_coach(uuid) to service_role;

-- Lo que llama la app: SOLO el espacio de quien pregunta (nunca se pide el id de nadie).
create or replace function public.mi_espacio()
returns jsonb
language sql stable security definer set search_path = public as $$
  select public.espacio_del_coach(auth.uid());
$$;
revoke execute on function public.mi_espacio() from public, anon;
grant execute on function public.mi_espacio() to authenticated;

comment on function public.espacio_del_coach(uuid) is 'Espacio de videos de un coach: { usado, limite, clientes, ilimitado } en bytes. 10 GB + 7 GB por cliente que paga; el dueño sin límite.';
comment on function public.mi_espacio() is 'El espacio de videos de quien pregunta (la app lo muestra como «Usaste X de Y»).';

-- La limpieza de R2 («lo que no aparece en ningún lado se borra») ahora también mira lo que antes se le escapaba: los planes PUBLICADOS en la vitrina (cada versión lleva la
-- dirección de sus videos dentro del JSON), la foto de cada plan en venta y «Mis rutinas». Sin esto, un video que solo vive en un plan vendido se podía borrar con el barrido.
create or replace function public.rutas_r2_en_uso()
returns table (ruta text)
language sql stable security definer set search_path = public as $$
  with textos as (
    select video_url as t from public.exercises
    union all select cover_image_url from public.exercises
    union all select url from public.exercise_media
    union all select avatar_url from public.profiles
    union all select data::text from public.exercise_overrides
    union all select data::text from public.plans
    union all select data::text from public.plan_versiones
    union all select data::text from public.plan_respaldos
    union all select data::text from public.programas_guardados
    union all select resumen::text from public.programas_guardados
    union all select data::text from public.routine_templates
    union all select resumen::text from public.routine_templates
    union all select data::text from public.user_app_state
    union all select routine_data::text from public.user_routines
    union all select data::text from public.vitrina_versiones
    union all select foto_url from public.vitrina_planes
  ),
  directas as (
    select distinct (regexp_matches(t, '((?:videos|covers|media)/[A-Za-z0-9._-]+)', 'g'))[1] as ruta
    from textos where t is not null
  ),
  de_portadas as (
    select distinct (regexp_matches(coalesce(vp.poster_url, '') || ' ' || coalesce(vp.mini_url, ''), '((?:videos|covers|media)/[A-Za-z0-9._-]+)', 'g'))[1] as ruta
    from public.video_posters vp
    where substring(vp.video_url from '((?:videos|covers|media)/[A-Za-z0-9._-]+)') in (select d.ruta from directas d)
  )
  select d.ruta from directas d
  union
  select p.ruta from de_portadas p;
$$;
