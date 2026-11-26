-- COMPRA Y DINERO COMPLETO (encargo de Andrés, 26 nov 2026). Solo AGREGA: tablas, columnas, índices, políticas y dos ajustes. No borra ni cambia nada.
-- Se aplica con apply_migration en dos partes (`compra_y_dinero_tablas` y `compra_y_dinero_rls`), porque el SQL que parece destructivo se rechaza solo.
--
-- QUÉ TRAE
--   1. compras: canal (web | apple), ids de Apple, la compra pagada SIN dueño (pagada_en con atleta vacío y estado «pendiente»: la base ya no deja «activa» sin atleta,
--      y así no hay que tocar esa regla), quién la reclamó y cuándo, la llave del correo «Crear mi cuenta» (48 h) y la entrada elegida («¿Cuándo empiezas?»).
--   2. pagos: canal y transacción de Apple (el libro de Andrés también anota lo de Apple).
--   3. vitrina_planes: «Para ti si…», dónde puede empezar el atleta (modo y semanas) y el plan recomendado (uno por coach).
--   4. profiles: lo de «Tu página» (portada, qué logran tus atletas, años de coach, certificación). Instagram vive en `redes`.
--   5. resultados_de_atletas: «Resultados de tus atletas».
--   6. libro_coach: una fila por venta, renovación o reembolso, con lo del coach, si es aproximado, dónde está (en_camino | listo | retirado | anulado), cuándo queda listo y de qué retiro salió.
--   7. retiros y retiro_envios (stripe | spei).
--   8. cuentas_spei: la CLABE del coach para lo de iPhone.
--   9. apple_calendario (meses fiscales de Apple y su pago estimado) y apple_pagos (lo que Apple pagó cada mes; en pruebas lo marca Andrés a mano).
--  10. apple_avisos: cada aviso de Apple se atiende una vez.
--  11. ajustes_publicos: compra_apple y envios_spei, los dos APAGADOS.
-- RLS: cada coach ve solo lo suyo; el dueño (is_master) todo. Nadie escribe desde la app: escriben las funciones del servidor con la llave de servicio.

-- ---------- 1. compras ----------
alter table public.compras add column if not exists canal text not null default 'web' check (canal in ('web', 'apple'));
alter table public.compras add column if not exists apple_transaccion_original text;
alter table public.compras add column if not exists apple_transaccion text;
alter table public.compras add column if not exists apple_referencia uuid;               -- requestReferenceId de la petición firmada
alter table public.compras add column if not exists pagada_en timestamptz;                -- se pagó; con atleta vacío = apartada esperando dueño
alter table public.compras add column if not exists reclamada_por uuid references public.profiles(id) on delete set null;
alter table public.compras add column if not exists reclamada_en timestamptz;
alter table public.compras add column if not exists llave_correo_hash text;               -- sha-256 de la llave de la liga del correo (nunca la llave)
alter table public.compras add column if not exists llave_correo_vence timestamptz;
alter table public.compras add column if not exists correo_crear_cuenta_en timestamptz;   -- cuándo salió el correo «Crear mi cuenta»
alter table public.compras add column if not exists entrada_elegida_en timestamptz;       -- null en una compra nueva: «¿Cuándo empiezas?» sale al abrir el plan
alter table public.compras add column if not exists fecha_meta date;                      -- «Necesito terminar antes»
create unique index if not exists compras_apple_original_unica on public.compras (apple_transaccion_original) where apple_transaccion_original is not null;
create unique index if not exists compras_llave_correo_unica on public.compras (llave_correo_hash) where llave_correo_hash is not null;
create index if not exists compras_sin_dueno on public.compras (pagada_en) where atleta_id is null and pagada_en is not null;

-- ---------- 2. pagos ----------
alter table public.pagos add column if not exists canal text not null default 'web' check (canal in ('web', 'apple'));
alter table public.pagos add column if not exists apple_transaccion text;
create unique index if not exists pagos_apple_transaccion_unica on public.pagos (apple_transaccion) where apple_transaccion is not null;

-- ---------- 3. vitrina_planes ----------
alter table public.vitrina_planes add column if not exists para_ti_si text check (para_ti_si is null or char_length(para_ti_si) <= 200);
alter table public.vitrina_planes add column if not exists entrada_modo text not null default 'semana_1' check (entrada_modo in ('semana_1', 'fases', 'cualquiera', 'elegidas'));
alter table public.vitrina_planes add column if not exists entrada_semanas int[] not null default '{1}';
alter table public.vitrina_planes add column if not exists recomendado boolean not null default false;
create unique index if not exists vitrina_un_recomendado_por_coach on public.vitrina_planes (coach_id) where recomendado;

-- ---------- 4. profiles (Tu página) ----------
alter table public.profiles add column if not exists portada_url text;
alter table public.profiles add column if not exists logros text check (logros is null or char_length(logros) <= 160);
alter table public.profiles add column if not exists anos_coach int check (anos_coach is null or anos_coach between 0 and 70);
alter table public.profiles add column if not exists certificaciones text check (certificaciones is null or char_length(certificaciones) <= 120);

-- ---------- 5. resultados_de_atletas ----------
create table if not exists public.resultados_de_atletas (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  titulo text not null check (char_length(titulo) between 1 and 120),     -- «+20 kg en sentadilla en 12 semanas»
  atleta text check (atleta is null or char_length(atleta) <= 60),         -- «Ana»
  vitrina_plan_id uuid references public.vitrina_planes(id) on delete set null,
  foto_url text,
  orden int not null default 0,
  creado_en timestamptz not null default now()
);
create index if not exists resultados_por_coach on public.resultados_de_atletas (coach_id, orden);

-- ---------- 6. Calendario fiscal de Apple y lo que pagó cada mes ----------
-- Fechas ESTIMADAS (Apple no publica un calendario oficial de pagos; fuente: aso.dev, «Apple fiscal calendar», consultado el 26 nov 2026). Apple paga unos 33 días después
-- de cerrar cada mes fiscal. Se agregan años con un insert más.
create table if not exists public.apple_calendario (
  inicio date primary key,
  fin date not null,
  nombre text not null,            -- «noviembre 2026»
  pago_estimado date not null,
  check (fin >= inicio)
);
insert into public.apple_calendario (inicio, fin, nombre, pago_estimado) values
  ('2026-08-30', '2026-09-26', 'septiembre 2026', '2026-10-29'),
  ('2026-09-27', '2026-10-31', 'octubre 2026', '2026-12-03'),
  ('2026-11-01', '2026-11-28', 'noviembre 2026', '2026-12-31'),
  ('2026-11-29', '2026-12-26', 'diciembre 2026', '2027-01-28'),
  ('2026-12-27', '2027-01-30', 'enero 2027', '2027-03-04'),
  ('2027-01-31', '2027-02-27', 'febrero 2027', '2027-04-01'),
  ('2027-02-28', '2027-03-27', 'marzo 2027', '2027-04-29'),
  ('2027-03-28', '2027-05-01', 'abril 2027', '2027-06-03'),
  ('2027-05-02', '2027-05-29', 'mayo 2027', '2027-07-01'),
  ('2027-05-30', '2027-06-26', 'junio 2027', '2027-07-29'),
  ('2027-06-27', '2027-07-31', 'julio 2027', '2027-09-02'),
  ('2027-08-01', '2027-08-28', 'agosto 2027', '2027-09-30'),
  ('2027-08-29', '2027-09-25', 'septiembre 2027', '2027-10-28')
on conflict (inicio) do nothing;

create table if not exists public.apple_pagos (
  mes date primary key references public.apple_calendario(inicio),
  recibido numeric(12, 2) not null check (recibido >= 0),  -- lo que Apple le pagó a Training Lab por ese mes (todas las ventas)
  ventas_brutas numeric(12, 2) not null default 0,          -- la suma de precios de esas ventas, para repartir
  marcado_por uuid references public.profiles(id) on delete set null,
  marcado_en timestamptz not null default now()
);

-- ---------- 7. retiros y sus envíos ----------
create table if not exists public.retiros (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  monto numeric(12, 2) not null check (monto > 0),
  estado text not null default 'enviado' check (estado in ('enviado', 'llego', 'no_llego', 'en_parte')),
  destino text,                                            -- «BBVA ··4821»
  llega_estimado date,
  llego_en timestamptz,
  creado_en timestamptz not null default now()
);
create index if not exists retiros_por_coach on public.retiros (coach_id, creado_en desc);

create table if not exists public.retiro_envios (
  id uuid primary key default gen_random_uuid(),
  retiro_id uuid not null references public.retiros(id) on delete cascade,
  via text not null check (via in ('stripe', 'spei')),
  monto numeric(12, 2) not null check (monto > 0),
  estado text not null default 'enviado' check (estado in ('enviado', 'llego', 'fallo')),
  stripe_payout text unique,
  spei_referencia text unique,
  llega_estimado date,
  llego_en timestamptz,
  motivo text,
  creado_en timestamptz not null default now()
);
create index if not exists envios_por_retiro on public.retiro_envios (retiro_id);

-- ---------- 8. libro_coach ----------
create table if not exists public.libro_coach (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  compra_id uuid references public.compras(id) on delete set null,
  pago_id uuid references public.pagos(id) on delete set null,
  canal text not null check (canal in ('web', 'apple')),
  tipo text not null check (tipo in ('venta', 'renovacion', 'reembolso', 'ajuste')),
  bruto numeric(12, 2) not null default 0,                 -- lo que pagó el atleta (con eso se reparte lo de Apple)
  monto numeric(12, 2) not null,                           -- lo del coach; negativo en el reembolso de algo ya retirado
  aproximado boolean not null default false,               -- iPhone mientras Apple no paga: se ve con «≈»
  estado text not null default 'en_camino' check (estado in ('en_camino', 'listo', 'retirado', 'anulado')),
  listo_estimado date,                                     -- web: available_on de Stripe; iPhone: pago estimado de su mes fiscal
  listo_en timestamptz,
  apple_mes date references public.apple_calendario(inicio),
  retiro_id uuid references public.retiros(id) on delete set null,
  stripe_transferencia text,
  creado_en timestamptz not null default now()
);
create unique index if not exists libro_un_renglon_por_pago on public.libro_coach (pago_id, tipo) where pago_id is not null;
create index if not exists libro_por_coach on public.libro_coach (coach_id, creado_en desc);
create index if not exists libro_por_estado on public.libro_coach (coach_id, estado);

-- ---------- 9. CLABE del coach (lo de iPhone llega por SPEI) ----------
create table if not exists public.cuentas_spei (
  coach_id uuid primary key references public.profiles(id) on delete cascade,
  clabe text not null check (clabe ~ '^[0-9]{18}$'),
  banco text,
  titular text check (titular is null or char_length(titular) <= 120),
  actualizada_en timestamptz not null default now()
);

-- ---------- 10. Avisos de Apple (App Store Server Notifications V2): uno por notificationUUID ----------
create table if not exists public.apple_avisos (
  id text primary key,
  tipo text not null,
  subtipo text,
  pendiente boolean not null default true,
  recibido_en timestamptz not null default now()
);

-- ---------- 11. Los dos interruptores, apagados ----------
insert into public.ajustes_publicos (clave, valor) values ('compra_apple', 'false'::jsonb), ('envios_spei', 'false'::jsonb) on conflict (clave) do nothing;

-- ================= Segunda parte: RLS (migración `compra_y_dinero_rls`) =================
alter table public.resultados_de_atletas enable row level security;
alter table public.libro_coach enable row level security;
alter table public.retiros enable row level security;
alter table public.retiro_envios enable row level security;
alter table public.cuentas_spei enable row level security;
alter table public.apple_calendario enable row level security;
alter table public.apple_pagos enable row level security;
alter table public.apple_avisos enable row level security;

-- Resultados: el coach los escribe y los lee; la página pública los lee por `perfil_publico` (security definer).
create policy resultados_del_coach on public.resultados_de_atletas for all to authenticated
  using (coach_id = auth.uid() or public.is_master()) with check (coach_id = auth.uid());
-- Dinero: solo leer lo propio. Escriben las funciones del servidor.
create policy libro_ver on public.libro_coach for select to authenticated using (coach_id = auth.uid() or public.is_master());
create policy retiros_ver on public.retiros for select to authenticated using (coach_id = auth.uid() or public.is_master());
create policy envios_ver on public.retiro_envios for select to authenticated
  using (exists (select 1 from public.retiros r where r.id = retiro_id and (r.coach_id = auth.uid() or public.is_master())));
create policy spei_ver on public.cuentas_spei for select to authenticated using (coach_id = auth.uid() or public.is_master());
create policy calendario_ver on public.apple_calendario for select to authenticated using (true);
create policy apple_pagos_ver on public.apple_pagos for select to authenticated using (public.is_master());
-- apple_avisos: nadie desde la app.
