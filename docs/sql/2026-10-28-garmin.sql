-- Fase 4 de los stickers (28 oct 2026): Garmin. Ya aplicada en producción (migración garmin_conexion).
alter table public.actividades drop constraint actividades_origen_check;
alter table public.actividades add constraint actividades_origen_check check (origen = any (array['archivo'::text, 'apple_salud'::text, 'atajo'::text, 'manual'::text, 'sincronizada'::text, 'healthkit'::text, 'garmin'::text]));
create table if not exists public.garmin_conexiones (user_id uuid primary key references auth.users(id) on delete cascade, garmin_user_id text not null unique, access_token text not null, refresh_token text not null, vence_en timestamptz not null, refresh_vence_en timestamptz, actualizado_en timestamptz not null default now());
alter table public.garmin_conexiones enable row level security;
create table if not exists public.garmin_pendientes (state text primary key, user_id uuid not null references auth.users(id) on delete cascade, code_verifier text not null, creado_en timestamptz not null default now());
alter table public.garmin_pendientes enable row level security;
