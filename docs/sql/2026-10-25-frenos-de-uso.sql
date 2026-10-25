-- Lote 1 de seguridad (25 oct 2026), aplicada como migración `frenos_de_uso`.
-- Libro de intentos para frenar abusos por IP y por identificador (lo usan `comprar`, `signup` y `login`).
-- RLS encendida y SIN políticas: solo las funciones del servidor (service_role) lo leen y escriben.
create table if not exists public.frenos_de_uso (
  id bigint generated always as identity primary key,
  ambito text not null,
  clave text not null,
  creado_en timestamptz not null default now()
);
create index if not exists frenos_de_uso_busca_idx on public.frenos_de_uso (ambito, clave, creado_en desc);
alter table public.frenos_de_uso enable row level security;
