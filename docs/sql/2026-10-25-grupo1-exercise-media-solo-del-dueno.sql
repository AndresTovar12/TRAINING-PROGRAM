-- ETAPA 2 · GRUPO 1 · p137 (25 oct 2026). APLICADA con apply_migration (solo crea 2 políticas nuevas; no quita ninguna).
--
-- HUECO (probado el 25 oct en una transacción que se deshace): la política `exercise_media_write` deja escribir a quien cumpla
-- "es el dueño del ejercicio" O "created_by = yo". La segunda cláusula la cumple cualquiera, porque `created_by` lo escribe
-- el cliente: un coach cualquiera podía meter fotos o videos en los ejercicios del dueño o de otros coaches.
--
-- QUÉ HACE: dos políticas RESTRICTIVAS (se suman con Y a las que ya hay, no las reemplazan):
--   INSERT / UPDATE (lo que queda escrito) solo si el ejercicio es MÍO, o soy el dueño de la app, o es un video «para un atleta»
--   mío o de mi equipo (el caso legítimo de PlanBuilder: «video especial para este atleta» en un ejercicio de la base).
--   UPDATE además exige que la fila sea mía (ejercicio mío, dueño, o la creé yo), así que no se puede mover una media ajena.
-- DELETE no cambia (ya exigía dueño del ejercicio, dueño de la app o autor de la fila).
-- SELECT no cambia (sigue `true` para todos: eso es p138, decisión de producto).
--
-- QUÉ PODRÍA ROMPER: un coach que hoy sube una media GENERAL (sin atleta) a un ejercicio de la base: la app no lo hace (el coach que edita
-- un ejercicio ajeno guarda «su versión» en exercise_overrides). El conector de IA solo lee exercise_media.
-- REVERTIR: drop policy exercise_media_insert_solo_dueno on public.exercise_media; drop policy exercise_media_update_solo_dueno on public.exercise_media;

create policy exercise_media_insert_solo_dueno on public.exercise_media
  as restrictive for insert to authenticated
  with check (
    public.is_master()
    or exists (select 1 from public.exercises e where e.id = exercise_media.exercise_id and e.created_by = auth.uid())
    or (
      exercise_media.created_by = auth.uid()
      and exercise_media.para_atleta is not null
      and (
        exists (select 1 from public.profiles a where a.id = exercise_media.para_atleta and a.coach_id = auth.uid())
        or public.en_mi_equipo(exercise_media.para_atleta)
      )
    )
  );

create policy exercise_media_update_solo_dueno on public.exercise_media
  as restrictive for update to authenticated
  using (
    public.is_master()
    or exists (select 1 from public.exercises e where e.id = exercise_media.exercise_id and e.created_by = auth.uid())
    or exercise_media.created_by = auth.uid()
  )
  with check (
    public.is_master()
    or exists (select 1 from public.exercises e where e.id = exercise_media.exercise_id and e.created_by = auth.uid())
    or (
      exercise_media.created_by = auth.uid()
      and exercise_media.para_atleta is not null
      and (
        exists (select 1 from public.profiles a where a.id = exercise_media.para_atleta and a.coach_id = auth.uid())
        or public.en_mi_equipo(exercise_media.para_atleta)
      )
    )
  );
