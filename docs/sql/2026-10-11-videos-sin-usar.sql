-- VIDEOS Y FOTOS SIN USAR en Cloudflare R2 (11 oct 2026).
--
-- Andrés: «obviamente sí quiero eliminar los videos de ejercicios que ya no están». Borrar un ejercicio (o cambiar su video) quitaba la fila pero dejaba el archivo
-- en R2, y ese espacio se paga cada mes para siempre.
--
-- La trampa: un mismo archivo puede estar en VARIOS lugares. «Duplicar ejercicio» comparte el video; los planes guardan la dirección del video y de la foto de la
-- fase dentro de su JSON; las versiones del plan, los respaldos, «Mis planes», las fichas propias de cada coach y el estado de la app del atleta también. Por eso no
-- se borra «el video del ejercicio que se borró»: se borra lo que YA NO APARECE EN NINGÚN LADO. Esta función da la lista de lo que sí aparece; la limpieza
-- (Edge Function `limpia-r2`) borra el resto.
--
-- Las rutas se reconocen por su forma (`videos/…`, `covers/…`, `media/…`), sin importar la dirección de delante: así sigue sirviendo cuando los videos se sirvan
-- desde el dominio propio en lugar de `…r2.dev`.
--
-- Las portadas automáticas (`video_posters`) cuentan solo si su video sigue en uso: si el video ya no está en ningún lado, su portada y su miniatura tampoco sirven.
--
-- DOS PIEZAS (Andrés, 11 oct 2026: «que se borre cada vez que el ejercicio se borre»):
--   1. Disparadores en `exercises` y `exercise_media`: al BORRAR una fila, o al CAMBIAR su video o su foto, mandan a la Edge Function `limpia-r2` las rutas que quedaron
--      sueltas (por pg_net, ya fuera de la transacción). La función revisa que de verdad no aparezcan en ningún otro lado y que tengan más de 1 día, y borra el archivo
--      (y la portada y miniatura automáticas del video). Si algo más lo usa —un ejercicio duplicado comparte video; los planes guardan la dirección— se queda.
--      Un fallo al avisar nunca impide borrar o cambiar el ejercicio.
--   2. Un barrido de `limpia-r2` (sin cuerpo) para lo que se escape: reemplazos hechos en el editor, cuentas borradas. NO está programado (se corre a mano o se agenda
--      con pg_cron después): `select net.http_post(url := 'https://ozwqqzrkgunrgxxwxmop.supabase.co/functions/v1/limpia-r2', headers := '{"Content-Type":"application/json"}'::jsonb, body := '{}'::jsonb)`.
--      Probar sin borrar: body `{"probar": true}`.
--
-- Probado el 11 oct 2026 con un archivo huérfano real y dos ejercicios de prueba que lo compartían: al borrar el primero el archivo se quedó (200); al borrar el segundo
-- se borró (404).

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

comment on function public.rutas_r2_en_uso() is 'Las rutas de R2 (videos/, covers/, media/) que aparecen en algún lado de la base. Lo que no esté aquí, la limpieza semanal `limpia-r2` lo puede borrar (si además tiene más de 30 días).';

revoke execute on function public.rutas_r2_en_uso() from public, anon, authenticated;
grant execute on function public.rutas_r2_en_uso() to service_role;

-- Los disparadores (aplicados el 11 oct 2026).
create or replace function public.avisa_r2_archivos_sueltos()
returns trigger language plpgsql security definer set search_path = public as $$
declare k text; v_old text; v_new text; m text; rutas text[] := '{}';
begin
  foreach k in array array['video_url', 'cover_image_url', 'url'] loop
    v_old := to_jsonb(old) ->> k;
    v_new := case when tg_op = 'UPDATE' then to_jsonb(new) ->> k else null end;
    if v_old is not null and v_old is distinct from v_new then
      m := substring(v_old from '((?:videos|covers|media)/[A-Za-z0-9._-]+)');
      if m is not null then rutas := rutas || m; end if;
    end if;
  end loop;
  if cardinality(rutas) > 0 then
    perform net.http_post(
      url := 'https://ozwqqzrkgunrgxxwxmop.supabase.co/functions/v1/limpia-r2',
      headers := '{"Content-Type":"application/json"}'::jsonb,
      body := jsonb_build_object('rutas', to_jsonb(rutas))
    );
  end if;
  return null;
exception when others then
  -- Un fallo al avisar NUNCA debe impedir borrar o cambiar el ejercicio: el barrido recoge lo que se escape.
  return null;
end $$;
revoke execute on function public.avisa_r2_archivos_sueltos() from public, anon, authenticated;

create trigger exercises_avisa_r2 after delete or update of video_url, cover_image_url on public.exercises
  for each row execute function public.avisa_r2_archivos_sueltos();
create trigger exercise_media_avisa_r2 after delete or update of url on public.exercise_media
  for each row execute function public.avisa_r2_archivos_sueltos();
