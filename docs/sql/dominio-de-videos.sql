-- PASAR LAS DIRECCIONES DE LOS VIDEOS AL DOMINIO PROPIO (se corre UNA vez, el día que el subdominio de videos ya sirve archivos).
--
-- POR QUÉ. Cada ejercicio, cada video extra, cada portada automática y cada plan (dentro de su JSON) guarda la dirección COMPLETA del archivo:
--   https://pub-…r2.dev/videos/<id>.mp4
-- Con dominio propio los archivos se sirven desde `https://videos.<dominio>/videos/<id>.mp4` (la RUTA no cambia, solo el principio). Este script cambia ese principio en todos
-- lados donde se guarda. `r2.dev` está limitado por Cloudflare y no sirve para producción.
--
-- ANTES DE CORRERLO (ver docs/dominio.md):
--   1. El subdominio ya abre un video de prueba (por ejemplo `https://videos.<dominio>/videos/<un-id>.mp4` responde 200).
--   2. Secreto `R2_PUBLIC_URL` puesto y `r2-upload` ya sirviendo archivos nuevos con él (si no, lo que se suba durante el cambio sigue saliendo con la dirección vieja).
--   3. `VITE_MEDIOS_URL` puesta en Vercel y la app publicada (reconoce las dos direcciones, así que el orden no rompe nada).
--
-- CÓMO SE CORRE. Se reemplazan `__VIEJO__` y `__NUEVO__` (sin diagonal al final) y se corre COMPLETO. Es una sola transacción: si algo falla, no queda nada a medias.
--   __VIEJO__ = https://pub-4a3ae85521d744b5abf16550ea171189.r2.dev
--   __NUEVO__ = https://videos.<dominio>
--
-- QUÉ SE APAGA UN RATO DENTRO DE LA TRANSACCIÓN, y por qué:
--   · `exercises_avisa_r2` / `exercise_media_avisa_r2`: avisan a la limpieza de R2 cada vez que cambia la dirección de un video. Aquí cambia el principio de TODAS; no hay
--     nada que limpiar (la ruta es la misma) y serían decenas de avisos al mismo tiempo.
--   · `plans_guardar_version`: guarda una versión de historial en cada cambio de un plan; aquí no es un cambio del coach, solo de dirección.
--
-- VERIFICAR DESPUÉS (todo debe dar 0):
--   select count(*) from exercises where video_url like '__VIEJO__%' or cover_image_url like '__VIEJO__%';
--   select count(*) from exercise_media where url like '__VIEJO__%';
--   select count(*) from video_posters where video_url like '__VIEJO__%' or poster_url like '__VIEJO__%' or mini_url like '__VIEJO__%';
--   select count(*) from plans where data::text like '%__VIEJO__%';
--
-- Probado el 11 oct 2026 con una dirección inventada dentro de una transacción que se deshizo: cuentas por tabla y sin disparadores colados.

do $$
declare
  v_viejo constant text := '__VIEJO__';
  v_nuevo constant text := '__NUEVO__';
begin
  if v_viejo = v_nuevo or v_viejo !~ '^https://[A-Za-z0-9.-]+$' or v_nuevo !~ '^https://[A-Za-z0-9.-]+$' then
    raise exception 'Las direcciones deben ser https://host, sin diagonal al final, y distintas (viejo=%, nuevo=%)', v_viejo, v_nuevo;
  end if;

  alter table public.exercises disable trigger exercises_avisa_r2;
  alter table public.exercise_media disable trigger exercise_media_avisa_r2;
  alter table public.plans disable trigger plans_guardar_version;

  -- Lo que se guarda como dirección suelta.
  update public.exercises
     set video_url = replace(video_url, v_viejo, v_nuevo), cover_image_url = replace(cover_image_url, v_viejo, v_nuevo)
   where video_url like v_viejo || '%' or cover_image_url like v_viejo || '%';
  update public.exercise_media set url = replace(url, v_viejo, v_nuevo) where url like v_viejo || '%';
  update public.video_posters
     set video_url = replace(video_url, v_viejo, v_nuevo), poster_url = replace(poster_url, v_viejo, v_nuevo), mini_url = replace(mini_url, v_viejo, v_nuevo)
   where video_url like v_viejo || '%' or poster_url like v_viejo || '%' or mini_url like v_viejo || '%';
  update public.vitrina_planes set foto_url = replace(foto_url, v_viejo, v_nuevo) where foto_url like v_viejo || '%';

  -- Lo que se guarda dentro de un JSON (planes, historial, respaldos, plantillas, estado de la app…).
  update public.plans set data = replace(data::text, v_viejo, v_nuevo)::jsonb where data::text like '%' || v_viejo || '%';
  update public.plan_versiones set data = replace(data::text, v_viejo, v_nuevo)::jsonb where data::text like '%' || v_viejo || '%';
  update public.plan_respaldos set data = replace(data::text, v_viejo, v_nuevo)::jsonb where data::text like '%' || v_viejo || '%';
  update public.vitrina_versiones set data = replace(data::text, v_viejo, v_nuevo)::jsonb where data::text like '%' || v_viejo || '%';
  update public.user_app_state set data = replace(data::text, v_viejo, v_nuevo)::jsonb where data::text like '%' || v_viejo || '%';
  update public.routine_templates
     set data = replace(data::text, v_viejo, v_nuevo)::jsonb, resumen = replace(resumen::text, v_viejo, v_nuevo)::jsonb
   where data::text like '%' || v_viejo || '%' or resumen::text like '%' || v_viejo || '%';
  update public.programas_guardados
     set data = replace(data::text, v_viejo, v_nuevo)::jsonb, resumen = replace(resumen::text, v_viejo, v_nuevo)::jsonb
   where data::text like '%' || v_viejo || '%' or resumen::text like '%' || v_viejo || '%';
  update public.user_routines set routine_data = replace(routine_data::text, v_viejo, v_nuevo)::jsonb where routine_data::text like '%' || v_viejo || '%';
  update public.exercise_overrides set data = replace(data::text, v_viejo, v_nuevo)::jsonb where data::text like '%' || v_viejo || '%';

  alter table public.exercises enable trigger exercises_avisa_r2;
  alter table public.exercise_media enable trigger exercise_media_avisa_r2;
  alter table public.plans enable trigger plans_guardar_version;
  -- (fin)
end $$;
