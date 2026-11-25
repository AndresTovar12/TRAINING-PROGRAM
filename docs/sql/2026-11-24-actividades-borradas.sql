-- LO BORRADO NO REGRESA (24 nov 2026). Andrés: «en Tus entrenos… si los borro vuelven a aparecer».
-- Al abrir la app se traen de Apple Salud los entrenos de los últimos 7 días; uno borrado ya no estaba en `actividades` y se volvía a traer.
-- Aquí se anota solo la hora de inicio y la duración de cada entreno borrado (`borraActividad`, src/lib/metricasApi.js); la importación
-- (`guardaImportacion`) los cuenta como «ya están» y no los repite. Cada atleta ve y anota solo lo suyo. Se borra con la cuenta.

create table if not exists public.actividades_borradas (
  id uuid primary key default gen_random_uuid(),
  atleta_id uuid not null references auth.users(id) on delete cascade,
  inicio timestamptz not null,
  duracion_s integer,
  origen text,
  borrada_en timestamptz not null default now()
);

create index if not exists actividades_borradas_atleta_inicio on public.actividades_borradas (atleta_id, inicio);

alter table public.actividades_borradas enable row level security;

create policy "actividades_borradas: ve las suyas" on public.actividades_borradas
  for select to authenticated using (atleta_id = (select auth.uid()));

create policy "actividades_borradas: anota las suyas" on public.actividades_borradas
  for insert to authenticated with check (atleta_id = (select auth.uid()));
