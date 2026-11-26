-- DIAGNÓSTICO DE CONECTAR APPLE SALUD (26 nov 2026). Una atleta tenía todo encendido en Salud y le salía «No pudimos leer nada»; no se sabía qué falló.
-- Una fila por cada intento de conectar (`src/lib/diagnosticoSalud.js`): versión de iOS, si hay reloj emparejado, si dio permiso de escribir, qué dato se
-- leyó primero y los errores. El usuario solo inserta las suyas; el administrador (o el dueño) las lee, también desde el conector (`ver_atleta`).
-- Se borra con la cuenta.

create table if not exists public.diagnosticos_salud (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id) on delete cascade,
  creado_en timestamptz not null default now(),
  donde text,                    -- 'inicio' (inicio de cuenta) | 'conectar' | 'otra_vez' (Ya lo encendí, revisar otra vez)
  ios text,                      -- versión de iOS, p. ej. '18.1'
  reloj_emparejado boolean,      -- null: no se supo
  escribe text not null,         -- 'dado' | 'no' | 'no_se_pudo_revisar'
  primero text not null,         -- 'pasos' | 'pulso' | 'sueño' | 'entrenos' | 'ninguno'
  errores text,                  -- los errores de cada llamada, uno por línea
  detalle jsonb                  -- lo que contestó checkAuthorization, tal cual
);

create index if not exists diagnosticos_salud_usuario_creado on public.diagnosticos_salud (usuario_id, creado_en desc);

alter table public.diagnosticos_salud enable row level security;

create policy "diagnosticos_salud: anota los suyos" on public.diagnosticos_salud
  for insert to authenticated with check (usuario_id = (select auth.uid()));

create policy "diagnosticos_salud: el administrador los lee" on public.diagnosticos_salud
  for select to authenticated using ((select public.is_admin()) or (select public.is_master()));
