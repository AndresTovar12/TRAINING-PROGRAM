-- Fase 3 de los stickers (28 oct 2026): los entrenos que la app de iPhone lee directo de HealthKit se guardan con origen = 'healthkit'.
-- Ya aplicada en producción (migración actividades_origen_healthkit). Solo agrega un valor permitido; no toca ninguna fila.
alter table public.actividades drop constraint actividades_origen_check;
alter table public.actividades add constraint actividades_origen_check check (origen = any (array['archivo'::text, 'apple_salud'::text, 'atajo'::text, 'manual'::text, 'sincronizada'::text, 'healthkit'::text]));
