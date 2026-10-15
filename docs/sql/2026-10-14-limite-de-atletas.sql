-- TOPE DE ATLETAS GRATIS, PAQUETES DE LUGARES Y CONTROLES DEL DUEÑO (14 oct 2026).
--
-- Andrés: con «20 % de comisión + herramienta gratis», un coach puede agregar atletas gratis por link, cobrarles por fuera y ahorrarse la comisión. Su regla:
--   · cada profesional NUEVO tiene 5 atletas gratis AGREGADOS A MANO (link, QR, código del coach, equipo); los que COMPRAN un plan no cuentan (ya pagan comisión);
--   · quien quiera más: que sus atletas compren un programa suyo, o que pague «derechos» (paquetes de lugares);
--   · el dueño puede subirle o quitarle el límite a cualquiera, ponerle una comisión especial y suspender su vitrina.
--
-- El tope vive AQUÍ, en la base (disparadores), no solo en el botón: así lo cubren todos los caminos (invitar-atleta, signup con código, el código de coach, el QR de equipo, reactivar).
-- `profiles.limite_atletas`: NULL = el de la app (`ajustes_publicos.atletas_gratis`, hoy 5); -1 = sin límite; n = ese número. El dueño siempre es ilimitado.
-- Los coaches que YA existían quedan sin límite (se marca aparte, no en esta migración); los nuevos nacen con NULL = el de la app.

alter table public.profiles
  add column if not exists limite_atletas integer,
  add column if not exists comision_especial numeric,
  add column if not exists vitrina_suspendida boolean not null default false;

alter table public.profiles add constraint profiles_limite_atletas_check check (limite_atletas is null or limite_atletas >= -1);
alter table public.profiles add constraint profiles_comision_especial_check check (comision_especial is null or (comision_especial >= 0 and comision_especial <= 1));

-- El dueño mueve los ajustes de la app (hoy solo se podían cambiar por SQL).
create policy ajustes_publicos_dueno on public.ajustes_publicos for all to authenticated using (public.is_master()) with check (public.is_master());
insert into public.ajustes_publicos (clave, valor) values ('atletas_gratis', '5'::jsonb) on conflict (clave) do nothing;

-- Cuántos atletas «a mano» tiene un profesional: los suyos (coach principal) y los que lo tienen en su equipo; solo los activos y sin alta. Los que COMPRARON no cuentan.
create or replace function public.atletas_a_mano(p uuid)
returns integer language sql stable security definer set search_path = public as $$
  select count(*)::int from (
    select a.id from public.profiles a where a.coach_id = p and a.role = 'user' and coalesce(a.is_active, true) and a.alta_en is null
    union
    select e.atleta_id from public.equipo e join public.profiles a on a.id = e.atleta_id
     where e.profesional_id = p and e.estado = 'activo' and e.origen = 'equipo' and e.alta_en is null and coalesce(a.is_active, true)
  ) x;
$$;

-- El límite de un profesional: -1 = sin límite.
create or replace function public.limite_de_atletas(p uuid)
returns integer language sql stable security definer set search_path = public as $$
  select case
    when coalesce((select is_owner from public.profiles where id = p), false) then -1
    else coalesce(
      (select limite_atletas from public.profiles where id = p),
      (select (valor #>> '{}')::int from public.ajustes_publicos where clave = 'atletas_gratis'),
      5)
  end;
$$;

-- Lo que enseña la pantalla: { limite, usados, libres, ilimitado }. Cada quien ve lo suyo; el dueño, lo de cualquiera.
create or replace function public.lugares_de(p uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare quien uuid := coalesce(p, auth.uid()); l integer; u integer;
begin
  if auth.uid() is null then raise exception 'Necesitas entrar a tu cuenta'; end if;
  if quien <> auth.uid() and not public.is_master() then raise exception 'Solo puedes ver tus propios lugares'; end if;
  l := public.limite_de_atletas(quien);
  u := public.atletas_a_mano(quien);
  return jsonb_build_object('limite', l, 'usados', u, 'ilimitado', l < 0, 'libres', case when l < 0 then null else greatest(l - u, 0) end);
end $$;
grant execute on function public.lugares_de(uuid) to authenticated;
revoke execute on function public.atletas_a_mano(uuid), public.limite_de_atletas(uuid) from anon, authenticated;

-- El tope. Se avisa con un texto fijo que las pantallas y las funciones reconocen: LIMITE_DE_ATLETAS|<límite>|<usados>.
create or replace function public.cuida_limite_de_atletas()
returns trigger language plpgsql security definer set search_path = public as $$
declare l integer; u integer; pro uuid;
begin
  if tg_table_name = 'profiles' then
    if new.role is distinct from 'user' or new.coach_id is null or not coalesce(new.is_active, true) or new.alta_en is not null then return new; end if;
    -- Ya contaba y sigue contando con el mismo profesional: nada cambia.
    if tg_op = 'UPDATE' and old.coach_id is not distinct from new.coach_id and coalesce(old.is_active, true) and old.alta_en is null then return new; end if;
    pro := new.coach_id;
  else
    if new.estado is distinct from 'activo' or new.origen is distinct from 'equipo' or new.alta_en is not null then return new; end if;
    if tg_op = 'UPDATE' and old.profesional_id is not distinct from new.profesional_id and old.estado = 'activo' and old.origen = 'equipo' and old.alta_en is null then return new; end if;
    pro := new.profesional_id;
  end if;
  if public.is_master() then return new; end if;   -- el dueño puede pasarse del límite
  l := public.limite_de_atletas(pro);
  if l < 0 then return new; end if;
  u := public.atletas_a_mano(pro);
  if u >= l then raise exception 'LIMITE_DE_ATLETAS|%|%', l, u; end if;
  return new;
end $$;

create trigger profiles_limite_de_atletas before insert or update of coach_id, is_active, alta_en on public.profiles for each row execute function public.cuida_limite_de_atletas();
create trigger equipo_limite_de_atletas before insert or update on public.equipo for each row execute function public.cuida_limite_de_atletas();

-- Nadie se cambia sus propios límites: los campos de poder se suman a los que ya cuidaba `guardar_campos_de_poder`.
create or replace function public.guardar_campos_de_poder()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  quien uuid := auth.uid();
  rol   text := auth.role();
begin
  if coalesce(rol, '') = 'service_role' then
    return new;
  end if;

  -- Nadie autenticado = mantenimiento directo, no la app.
  if quien is null and rol is null then
    return new;
  end if;

  if public.is_master() then
    return new;
  end if;

  if new.limite_atletas is distinct from old.limite_atletas
     or new.comision_especial is distinct from old.comision_especial
     or new.vitrina_suspendida is distinct from old.vitrina_suspendida then
    raise exception 'Solo el administrador puede cambiar los límites, la comisión y la vitrina de una cuenta';
  end if;

  -- Terminar de crear la propia cuenta (una sola vez, ver completar_mi_perfil).
  if coalesce(current_setting('app.completando_perfil', true), '') = 'on' then
    return new;
  end if;

  if new.role is distinct from old.role then
    raise exception 'Solo el administrador puede cambiar el rol de una cuenta';
  end if;

  if new.is_owner is distinct from old.is_owner then
    raise exception 'Solo el administrador puede cambiar la propiedad de la cuenta';
  end if;

  if new.is_active is distinct from old.is_active then
    raise exception 'Solo el administrador puede activar o desactivar una cuenta';
  end if;

  if new.coach_id is distinct from old.coach_id then
    new.alta_en := null;
  elsif new.alta_en is distinct from old.alta_en and quien is distinct from old.coach_id then
    raise exception 'Solo quien atiende a esta persona puede darla de alta';
  end if;

  return new;
end;
$$;

-- PAQUETES DE LUGARES: lo que paga un coach para tener más atletas. El dueño los edita; los coaches los ven. (Los precios son una propuesta: ver el mensaje del 14 oct.)
create table if not exists public.paquetes_de_lugares (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  atletas_total integer not null check (atletas_total > 0),
  precio_mxn integer not null check (precio_mxn >= 0),
  activo boolean not null default true,
  orden integer not null default 0,
  creado_en timestamptz not null default now()
);
alter table public.paquetes_de_lugares enable row level security;
create policy paquetes_ver on public.paquetes_de_lugares for select to authenticated using (activo or public.is_master());
create policy paquetes_dueno on public.paquetes_de_lugares for all to authenticated using (public.is_master()) with check (public.is_master());
revoke all on public.paquetes_de_lugares from anon;
insert into public.paquetes_de_lugares (nombre, atletas_total, precio_mxn, orden) values
  ('Hasta 10 atletas', 10, 349, 1), ('Hasta 25 atletas', 25, 699, 2), ('Hasta 50 atletas', 50, 1199, 3), ('Hasta 100 atletas', 100, 1999, 4);

-- Permisos (aplicado como la migración `limite_de_atletas_permisos`): las funciones que cuentan lugares NO las puede llamar cualquiera
-- (revelarían cuántos atletas tiene cada coach). Solo las usan los disparadores, `lugares_de` y las funciones del servidor (service_role).
-- OJO: `revoke … from anon, authenticated` NO basta: Postgres da `execute` a PUBLIC por defecto, hay que quitárselo también.
revoke execute on function public.atletas_a_mano(uuid), public.limite_de_atletas(uuid), public.cuida_limite_de_atletas() from public, anon, authenticated;
grant execute on function public.atletas_a_mano(uuid), public.limite_de_atletas(uuid) to service_role;
revoke execute on function public.lugares_de(uuid) from public, anon;
grant execute on function public.lugares_de(uuid) to authenticated, service_role;
