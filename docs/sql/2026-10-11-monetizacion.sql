-- MONETIZACIÓN, ETAPA 1: la base (11 oct 2026).
-- Diseño: docs/superpowers/specs/2026-10-10-monetizacion-design.md · plan: docs/superpowers/plans/2026-10-11-monetizacion-etapa-1.md
--
-- TODO ES ADITIVO: tablas y columnas nuevas. No se cambia ni se borra nada de lo que ya existe (ni `plans`, ni `hay_vinculo`, ni los permisos de otras tablas).
-- Lo que escribe el dinero (compras, pagos, cuentas de Stripe) lo escribe SOLO el servidor (Edge Functions con la llave de servicio); los usuarios solo leen lo suyo.
--
-- Una compra NO es una fila de `plans` (el atleta la leería completa y se acabaría el blindaje). La compra apunta a una VERSIÓN publicada (`vitrina_versiones`) que
-- solo puede leer el coach; el atleta recibe su programa ya recortado de la Edge Function `programa-comprado`.
-- En la etapa 1 solo el dueño puede tener vitrina (`vitrina_planes_crear` pide `is_master()`); en la etapa 2 se afloja esa línea.

-- ------------------------------------------------------------------------------------------------------------------------------------------------
-- Columnas nuevas en tablas que ya existen
-- ------------------------------------------------------------------------------------------------------------------------------------------------

alter table public.equipo add column if not exists origen text not null default 'equipo';
do $$ begin
  alter table public.equipo add constraint equipo_origen_check check (origen in ('equipo', 'compra'));
exception when duplicate_object then null; end $$;

alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists redes jsonb not null default '{}'::jsonb;
do $$ begin
  alter table public.profiles add constraint profiles_bio_largo check (bio is null or char_length(bio) <= 1000);
exception when duplicate_object then null; end $$;

-- ------------------------------------------------------------------------------------------------------------------------------------------------
-- La vitrina: lo que un coach pone a la venta
-- ------------------------------------------------------------------------------------------------------------------------------------------------

create table if not exists public.vitrina_planes (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  programa_guardado_id uuid references public.programas_guardados(id) on delete set null,
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 2 and 60),
  titulo text not null check (char_length(titulo) between 1 and 120),
  descripcion text check (descripcion is null or char_length(descripcion) <= 4000),
  para_quien text check (para_quien is null or char_length(para_quien) <= 500),
  objetivo text check (objetivo is null or char_length(objetivo) <= 500),
  nivel text check (nivel is null or nivel in ('principiante', 'intermedio', 'avanzado', 'todos')),
  deportes text[] not null default '{}',
  foto_url text,
  tipo text not null default 'membresia' check (tipo in ('membresia', 'pago_unico', 'personalizado')),
  precio_mxn integer not null check (precio_mxn >= 500),            -- mínimo MXN 500 (Andrés, 11 oct 2026)
  fases_de_entrada jsonb not null default '[]'::jsonb,              -- ids de las fases donde el comprador puede empezar
  ventana_semanas integer default 4 check (ventana_semanas is null or ventana_semanas between 1 and 52), -- null = todo el plan
  chat boolean not null default false,
  tecnica boolean not null default false,
  cupo integer check (cupo is null or cupo >= 1),                   -- personalizados
  dias_entrega integer check (dias_entrega is null or dias_entrega between 1 and 60),
  cuestionario jsonb not null default '[]'::jsonb,
  estado text not null default 'borrador' check (estado in ('borrador', 'publicado', 'retirado')),
  version_n integer not null default 0,                             -- la última versión publicada (0 = nunca)
  publicada_en timestamptz,
  stripe_product_id text,
  stripe_price_id text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (coach_id, slug)
);
comment on table public.vitrina_planes is 'Un plan en venta. Su contenido publicado vive en vitrina_versiones; lo que ve el público sale de las funciones perfil_publico y plan_publico.';
create index if not exists vitrina_planes_publicados on public.vitrina_planes (coach_id) where estado = 'publicado';

-- Cada vez que el coach toca «Publicar» se guarda una copia del plan. Las compras apuntan a una versión.
create table if not exists public.vitrina_versiones (
  vitrina_plan_id uuid not null references public.vitrina_planes(id) on delete cascade,
  n integer not null check (n >= 1),
  titulo text not null,
  data jsonb not null,                                              -- lo mismo que `programas_guardados.data`: { kind, estructura, phases, foto, ciencia }
  creada_en timestamptz not null default now(),
  primary key (vitrina_plan_id, n)
);
comment on table public.vitrina_versiones is 'Copias publicadas de un plan en venta. Solo las lee su coach; el comprador recibe el plan recortado por la Edge Function programa-comprado.';

-- ------------------------------------------------------------------------------------------------------------------------------------------------
-- Las compras, el libro de pagos y las cuentas de Stripe de los coaches (las escribe solo el servidor)
-- ------------------------------------------------------------------------------------------------------------------------------------------------

create table if not exists public.compras (
  id uuid primary key default gen_random_uuid(),
  vitrina_plan_id uuid not null references public.vitrina_planes(id) on delete restrict,
  atleta_id uuid not null references public.profiles(id) on delete cascade,
  coach_id uuid not null references public.profiles(id) on delete cascade,
  tipo text not null check (tipo in ('membresia', 'pago_unico', 'personalizado')),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'activa', 'gracia', 'vencida', 'cancelada', 'reembolsada', 'por_armar')),
  precio_mxn integer not null check (precio_mxn >= 0),
  inicio date,                                                      -- el día en que arranca (el de la compra)
  fase_de_entrada text,                                             -- id de la fase donde entró
  version_n integer not null default 1,                             -- versión publicada que recibió
  version_previa_n integer,                                         -- «Publicar cambios para todos»: lo anterior sigue valiendo antes de `cambio_semana`
  cambio_semana integer,
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_payment_intent_id text,
  stripe_checkout_session_id text unique,
  periodo_hasta timestamptz,
  gracia_hasta timestamptz,
  cancelada_en timestamptz,
  entrega_limite timestamptz,                                       -- personalizados: fecha límite para entregar el plan
  respuestas jsonb,                                                 -- el cuestionario del personalizado
  creada_en timestamptz not null default now(),
  actualizada_en timestamptz not null default now(),
  check (atleta_id <> coach_id)
);
comment on table public.compras is 'La relación entre un atleta y un plan en venta. La escribe solo el servidor (webhook de Stripe).';
create index if not exists compras_del_atleta on public.compras (atleta_id) where estado in ('activa', 'gracia', 'por_armar', 'vencida');
create index if not exists compras_del_coach on public.compras (coach_id, estado);

create table if not exists public.pagos (
  id uuid primary key default gen_random_uuid(),
  compra_id uuid not null references public.compras(id) on delete restrict,
  coach_id uuid not null references public.profiles(id) on delete restrict,
  stripe_charge_id text,
  stripe_invoice_id text,
  bruto numeric(12, 2) not null,                                    -- lo que pagó el cliente
  tasa numeric(5, 4) not null,                                      -- la comisión de la app (0.2000 = 20 %)
  comision_app numeric(12, 2) not null,
  parte_coach numeric(12, 2) not null,
  transfer_coach_id text,
  estado text not null default 'cobrado' check (estado in ('cobrado', 'reembolsado', 'contracargo')),
  fecha timestamptz not null default now()
);
comment on table public.pagos is 'El libro contable: un renglón por cobro. Lo escribe solo el servidor.';
create index if not exists pagos_del_coach on public.pagos (coach_id, fecha desc);

create table if not exists public.cuentas_stripe (
  coach_id uuid primary key references public.profiles(id) on delete cascade,
  acct_id text not null,                                            -- la cuenta conectada de Stripe (acct_…)
  onboarding_completo boolean not null default false,
  cobros_ok boolean not null default false,
  depositos_ok boolean not null default false,
  depositos text not null default 'por_venta' check (depositos in ('por_venta', 'diario', 'semanal')),
  requisitos_pendientes jsonb not null default '[]'::jsonb,
  creada_en timestamptz not null default now(),
  actualizada_en timestamptz not null default now()
);
comment on table public.cuentas_stripe is 'La cuenta conectada de Stripe de cada coach. La escribe solo el servidor.';

-- ------------------------------------------------------------------------------------------------------------------------------------------------
-- Permisos (RLS). Las tablas del dinero no se escriben desde la app.
-- ------------------------------------------------------------------------------------------------------------------------------------------------

alter table public.vitrina_planes enable row level security;
alter table public.vitrina_versiones enable row level security;
alter table public.compras enable row level security;
alter table public.pagos enable row level security;
alter table public.cuentas_stripe enable row level security;

create policy vitrina_planes_ver on public.vitrina_planes for select to authenticated using (coach_id = auth.uid() or public.is_master());
-- Etapa 1: solo el dueño crea y cambia su vitrina. En la etapa 2 se cambia `public.is_master()` por `public.is_admin()`.
create policy vitrina_planes_crear on public.vitrina_planes for insert to authenticated with check (coach_id = auth.uid() and public.is_master());
create policy vitrina_planes_editar on public.vitrina_planes for update to authenticated using (coach_id = auth.uid() and public.is_master()) with check (coach_id = auth.uid() and public.is_master());
create policy vitrina_planes_borrar on public.vitrina_planes for delete to authenticated using (coach_id = auth.uid() and public.is_master() and estado = 'borrador' and version_n = 0);

create policy vitrina_versiones_ver on public.vitrina_versiones for select to authenticated
  using (exists (select 1 from public.vitrina_planes p where p.id = vitrina_plan_id and (p.coach_id = auth.uid() or public.is_master())));

create policy compras_ver on public.compras for select to authenticated using (atleta_id = auth.uid() or coach_id = auth.uid() or public.is_master());
create policy pagos_ver on public.pagos for select to authenticated using (coach_id = auth.uid() or public.is_master());
create policy cuentas_stripe_ver on public.cuentas_stripe for select to authenticated using (coach_id = auth.uid() or public.is_master());

-- El `coach_id` de una vitrina no se cambia después de creada, y `actualizado_en` se pone solo.
create or replace function public.vitrina_planes_cuida()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    if new.coach_id is distinct from old.coach_id then raise exception 'No se puede cambiar de dueño un plan en venta.'; end if;
    new.actualizado_en := now();
  end if;
  return new;
end $$;
-- (No lleva `drop trigger if exists`: el MCP de Supabase rechaza los `drop`; se aplicó una sola vez.)
create trigger vitrina_planes_cuida before update on public.vitrina_planes for each row execute function public.vitrina_planes_cuida();

-- ------------------------------------------------------------------------------------------------------------------------------------------------
-- Publicar, y lo que ve el público
-- ------------------------------------------------------------------------------------------------------------------------------------------------

-- El dueño toca «Publicar»: se guarda una copia del plan de «Mis planes» como nueva versión. Devuelve el número de versión.
create or replace function public.publicar_plan(p_plan uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare v public.vitrina_planes%rowtype; g public.programas_guardados%rowtype; nuevo integer;
begin
  select * into v from public.vitrina_planes where id = p_plan and coach_id = auth.uid() for update;
  if not found then raise exception 'Ese plan no es tuyo.'; end if;
  if not public.is_master() then raise exception 'Por ahora solo el dueño puede publicar.'; end if;
  if v.programa_guardado_id is null then raise exception 'Escoge de cuál de «Mis planes» sale.'; end if;
  select * into g from public.programas_guardados where id = v.programa_guardado_id and created_by = auth.uid();
  if not found then raise exception 'No encuentro ese plan en «Mis planes».'; end if;
  if jsonb_typeof(g.data -> 'phases') is distinct from 'array' or jsonb_array_length(g.data -> 'phases') = 0 then
    raise exception 'El plan no tiene fases.';
  end if;
  nuevo := v.version_n + 1;
  insert into public.vitrina_versiones (vitrina_plan_id, n, titulo, data) values (v.id, nuevo, v.titulo, g.data);
  update public.vitrina_planes set version_n = nuevo, estado = 'publicado', publicada_en = now() where id = v.id;
  return nuevo;
end $$;
revoke execute on function public.publicar_plan(uuid) from public, anon;
grant execute on function public.publicar_plan(uuid) to authenticated;

-- Lo público de un coach: solo si tiene al menos un plan publicado, y solo campos públicos.
create or replace function public.perfil_publico(p_usuario text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'usuario', p.username, 'nombre', p.full_name, 'foto', p.avatar_url, 'profesion', p.profesion,
    'bio', p.bio, 'redes', p.redes, 'disciplinas', to_jsonb(p.disciplinas),
    'planes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'slug', v.slug, 'titulo', v.titulo, 'descripcion', v.descripcion, 'foto', v.foto_url, 'tipo', v.tipo, 'precio', v.precio_mxn,
        'nivel', v.nivel, 'objetivo', v.objetivo, 'deportes', to_jsonb(v.deportes),
        'semanas', coalesce((select sum(jsonb_array_length(coalesce(f -> 'weekData', '[]'::jsonb))) from jsonb_array_elements(ver.data -> 'phases') f), 0)
      ) order by v.publicada_en desc)
      from public.vitrina_planes v
      join public.vitrina_versiones ver on ver.vitrina_plan_id = v.id and ver.n = v.version_n
      where v.coach_id = p.id and v.estado = 'publicado'
    ), '[]'::jsonb)
  )
  from public.profiles p
  where p.username = lower(btrim(p_usuario)) and p.role = 'admin' and coalesce(p.is_active, true)
    and exists (select 1 from public.vitrina_planes v where v.coach_id = p.id and v.estado = 'publicado');
$$;

-- La ficha de UN plan: lo que convence a quien compra. De las fases, solo el nombre y cuántas semanas; de las semanas, una de muestra (la primera).
create or replace function public.plan_publico(p_usuario text, p_slug text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'coach', jsonb_build_object('usuario', p.username, 'nombre', p.full_name, 'foto', p.avatar_url, 'profesion', p.profesion, 'bio', p.bio, 'redes', p.redes),
    'slug', v.slug, 'titulo', v.titulo, 'descripcion', v.descripcion, 'para_quien', v.para_quien, 'objetivo', v.objetivo, 'nivel', v.nivel,
    'deportes', to_jsonb(v.deportes), 'foto', v.foto_url, 'tipo', v.tipo, 'precio', v.precio_mxn,
    'chat', v.chat, 'tecnica', v.tecnica, 'cupo', v.cupo, 'dias_entrega', v.dias_entrega, 'cuestionario', v.cuestionario,
    'kind', coalesce(ver.data ->> 'kind', 'periodized'),
    'fases', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', f.fase ->> 'id', 'nombre', coalesce(f.fase ->> 'name', f.fase ->> 'fullName', 'Fase'),
        'semanas', jsonb_array_length(coalesce(f.fase -> 'weekData', '[]'::jsonb)),
        'entrada', v.fases_de_entrada ? (f.fase ->> 'id')
      ) order by f.orden)
      from jsonb_array_elements(ver.data -> 'phases') with ordinality as f(fase, orden)
    ), '[]'::jsonb),
    'muestra', ver.data -> 'phases' -> 0 -> 'weekData' -> 0
  )
  from public.profiles p
  join public.vitrina_planes v on v.coach_id = p.id
  join public.vitrina_versiones ver on ver.vitrina_plan_id = v.id and ver.n = v.version_n
  where p.username = lower(btrim(p_usuario)) and v.slug = lower(btrim(p_slug)) and v.estado = 'publicado' and p.role = 'admin' and coalesce(p.is_active, true);
$$;

revoke execute on function public.perfil_publico(text) from public;
revoke execute on function public.plan_publico(text, text) from public;
grant execute on function public.perfil_publico(text) to anon, authenticated;
grant execute on function public.plan_publico(text, text) to anon, authenticated;

-- Probado el 11 oct 2026 con cuentas simuladas (`set local role` + `request.jwt.claims`, todo dentro de un bloque que termina en `raise exception` para no guardar nada):
-- el dueño publica y ve su vitrina y sus versiones; el atleta y otro profesional ven 0 filas y no pueden crear vitrina, crear compras ni publicar; sin sesión,
-- `plan_publico` NO trae ejercicios de la segunda semana ni de las otras fases (solo nombres y una semana de muestra) y las tablas se leen en 0 filas.
