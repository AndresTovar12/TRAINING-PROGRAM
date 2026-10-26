-- PENDIENTE DE APROBACIÓN DE ANDRÉS. NO SE HA APLICADO. Lleva DROP (parte A) y una decisión de producto (parte B).
-- p137 (resto) y p138 · ETAPA 2, grupo 1 (25 oct 2026).
--
-- ───────── PARTE A · limpiar lo que ya no sirve (recomendado aplicarla) ─────────
-- El hueco de p137 YA QUEDÓ CERRADO con dos políticas restrictivas nuevas (aplicadas). Esta parte quita las piezas viejas que quedaron sobrando:
--   - el bucket de Supabase Storage `exercise-media` NO lo usa la app (los archivos van a Cloudflare R2 con `r2-upload`), pero sus políticas dejan a CUALQUIER
--     coach (is_admin) subir, leer, cambiar y borrar cualquier archivo de ese bucket, sin ligarlo a un ejercicio. Es una puerta sin uso.
--   QUÉ PODRÍA ROMPER: nada que se use hoy (25 oct: el bucket guarda 3 archivos viejos y NINGÚN ejercicio ni media apunta a ellos —0 y 0—; el bucket es público, así que ver una dirección no necesita estas políticas).
--   REVERTIR: volver a crear las 4 políticas (texto en `pg_policies`, copiado aquí abajo en el comentario).
--     exercise_media_admin_insert  INSERT  with check (bucket_id = 'exercise-media' and is_admin())
--     exercise_media_admin_read    SELECT  using      (bucket_id = 'exercise-media' and is_admin())
--     exercise_media_admin_update  UPDATE  using      (bucket_id = 'exercise-media' and is_admin())
--     exercise_media_admin_delete  DELETE  using      (bucket_id = 'exercise-media' and is_admin())

drop policy if exists exercise_media_admin_insert on storage.objects;
drop policy if exists exercise_media_admin_read   on storage.objects;
drop policy if exists exercise_media_admin_update on storage.objects;
drop policy if exists exercise_media_admin_delete on storage.objects;

-- ───────── PARTE B · p138: que cada quien lea solo los ejercicios que le tocan (DECISIÓN DE PRODUCTO, NO aplicar sin hablarlo) ─────────
-- Hoy `exercises`, `exercise_media` y `video_posters` se leen con `using (true)`: cualquier persona con sesión (hasta un atleta que se registró ayer) puede bajar
-- TODO el repertorio de TODOS los coaches, con sus direcciones de video.
-- PREGUNTA PARA ANDRÉS: ¿el repertorio de cada coach es un secreto comercial, o es una biblioteca compartida entre coaches?
-- RECOMENDACIÓN: no aplicar la parte B todavía. Razones: (1) los archivos viven en R2 con direcciones públicas permanentes (p99): esconder las filas no esconde un video
-- cuya dirección ya se conoce, así que la protección real depende de p99; (2) lo que ve un atleta depende de su coach, del equipo, de lo que compró y de la base del dueño: una
-- regla mal hecha deja planes con ejercicios en blanco para gente que pagó. Si se decide proteger, empezar por `exercise_media` y `video_posters`, y dejar `exercises` para el final.
--
-- Borrador de la regla (para `exercises`; `exercise_media` y `video_posters` copian la misma idea con su `exercise_id`/`created_by`):
--   Ver un ejercicio si: es mío, soy el dueño de la app, lo creó el dueño de la app (la base), lo creó mi coach, lo creó alguien de mi equipo, o lo creó un coach
--   al que le compré un plan (compras activa/gracia).
--
-- create policy exercises_select_acotada on public.exercises as restrictive for select to authenticated using (
--   created_by is null
--   or created_by = auth.uid()
--   or public.is_master()
--   or exists (select 1 from public.profiles p where p.id = exercises.created_by and p.is_owner)
--   or created_by = public.my_coach_id()
--   or public.en_mi_equipo(created_by)
--   or exists (select 1 from public.compras c where c.atleta_id = auth.uid() and c.coach_id = exercises.created_by and c.estado in ('activa','gracia'))
-- );
-- (Restrictiva: se suma con Y a `exercises_select_all_auth`; no hace falta borrar nada.)
-- Un coach que ve ejercicios de OTROS coaches para armar planes de sus atletas dejaría de poder usarlos: confirmar si eso existe.
