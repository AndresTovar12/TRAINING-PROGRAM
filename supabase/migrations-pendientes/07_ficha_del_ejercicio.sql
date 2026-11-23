-- PENDIENTE (8 nov 2026, solo aditiva: dos columnas nuevas que pueden ir vacías; nada que borrar ni cambiar).
-- EL EDITOR OBEDECE A LA FICHA DEL EJERCICIO.
--
-- QUÉ HACE
--   · exercises.medida      «Unidad»: reps, seg, min, m, km, yd, cal, cluster o nada. Vacía = se elige en cada plan.
--   · exercises.carga_tipo  «Peso o intensidad»: kg, pct, int, rpe, rir, ritmo, zona, w, nado o nada. Vacía = se elige en cada plan.
--   El ENFOQUE de una sesión (Pesas, Correr…) NO va aquí: vive dentro del plan, en cada sesión (`enfoque`), y no toca los tipos de sesión.
-- QUIÉN LA VE: las mismas reglas de siempre de cada tabla (no cambian).
-- QUÉ PODRÍA ROMPER: nada. Los ejercicios de antes quedan vacíos y el editor los trata como hoy.

alter table public.exercises add column if not exists medida text
  check (medida is null or medida in ('reps','seg','min','m','km','yd','cal','cluster','nada'));
alter table public.exercises add column if not exists carga_tipo text
  check (carga_tipo is null or carga_tipo in ('kg','pct','int','rpe','rir','ritmo','zona','w','nado','nada'));
