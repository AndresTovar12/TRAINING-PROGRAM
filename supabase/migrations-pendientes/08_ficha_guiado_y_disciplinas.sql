-- PENDIENTE (23 nov 2026, solo aditiva: tres columnas nuevas que pueden ir vacías; nada que borrar ni cambiar).
-- LA FICHA DEL EJERCICIO, LO QUE FALTABA EN LA BASE.
--
-- QUÉ HACE
--   · exercises.guiado       el ejercicio es un calentamiento en video que se sigue completo (lo elige el coach en la ficha).
--   · exercises.duracion_s   cuánto dura ese video guiado, en segundos (vacío si no se sabe).
--   · exercises.disciplinas  las Disciplinas del ejercicio (pesas, correr, bici, nadar…), como las marca el coach. Vacía (null) = no las ha
--                            marcado: la app las deduce por las sesiones donde se usa. Una lista vacía ([]) = las quitó todas a propósito.
-- POR QUÉ: el formulario del ejercicio y el editor Híbrido (lo que «aprende» la ficha) ya las mandan al guardar; sin estas columnas el guardado falla.
-- QUIÉN LA VE: las mismas reglas de siempre de la tabla (no cambian).
-- QUÉ PODRÍA ROMPER: nada. Los ejercicios de antes quedan vacíos y la app los trata como hoy.

alter table public.exercises add column if not exists guiado boolean not null default false;
alter table public.exercises add column if not exists duracion_s integer check (duracion_s is null or duracion_s > 0);
alter table public.exercises add column if not exists disciplinas text[];
