-- Fase 5 de los stickers: la experiencia del Apple Watch (29 oct 2026).
-- Todo es aditivo salvo dos CHECK que se ensanchan (se quitan y se vuelven a poner con un valor más).

-- 1. LA CONEXIÓN VIVE EN LA CUENTA. Apple Salud se guarda con estado 'ok'.
alter table public.dispositivos_conectados drop constraint dispositivos_conectados_estado_check;
alter table public.dispositivos_conectados add constraint dispositivos_conectados_estado_check check (estado = any (array['conectado', 'ok', 'error']));

-- El coach (o fisio) ve si sus atletas conectaron su reloj y desde cuándo.
create policy dispositivos_ver_coach on public.dispositivos_conectados for select
  using (is_admin() and cuenta_activa() and atiendo_a(user_id));

-- Conectar Apple Salud: la fecha la pone el servidor (UTC). Volver a conectar (otro iPhone, reinstalar) NO la cambia.
create or replace function public.conecta_apple_salud()
returns public.dispositivos_conectados
language plpgsql security definer set search_path = public as $$
declare r public.dispositivos_conectados;
begin
  if auth.uid() is null then raise exception 'Sin sesión'; end if;
  insert into dispositivos_conectados (user_id, proveedor, estado, conectado_en)
    values (auth.uid(), 'apple_salud', 'ok', now())
  on conflict (user_id, proveedor) do update set estado = 'ok'
  returning * into r;
  return r;
end $$;

-- Cada sincronización: la hora y lo que llegó (`p_detalle`, se mezcla con lo que había).
create or replace function public.marca_sincronizacion_apple(p_detalle jsonb default '{}'::jsonb)
returns void
language sql security definer set search_path = public as $$
  update dispositivos_conectados
     set ultima_sincronizacion = now(), detalle = coalesce(detalle, '{}'::jsonb) || coalesce(p_detalle, '{}'::jsonb)
   where user_id = auth.uid() and proveedor = 'apple_salud';
$$;

revoke all on function public.conecta_apple_salud() from public, anon;
revoke all on function public.marca_sincronizacion_apple(jsonb) from public, anon;
grant execute on function public.conecta_apple_salud() to authenticated;
grant execute on function public.marca_sincronizacion_apple(jsonb) to authenticated;

-- 2. LO DE ANTES DE CONECTAR, SOLO PARA LAS CUENTAS. Misma forma que `actividades` y `recuperacion_diaria`; ninguna pantalla las enseña.
create table public.actividades_previas (like public.actividades including defaults including constraints including indexes);
alter table public.actividades_previas add constraint actividades_previas_atleta_id_fkey foreign key (atleta_id) references public.profiles(id) on delete cascade;
alter table public.actividades_previas enable row level security;
create policy actividades_previas_acceso on public.actividades_previas for all
  using (((atleta_id = (select auth.uid())) and cuenta_activa()) or is_master() or (is_admin() and cuenta_activa() and atiendo_a(atleta_id)))
  with check (((atleta_id = (select auth.uid())) and cuenta_activa()) or is_master() or (is_admin() and cuenta_activa() and atiendo_a(atleta_id)));

create table public.recuperacion_previa (like public.recuperacion_diaria including defaults including constraints including indexes);
alter table public.recuperacion_previa add constraint recuperacion_previa_atleta_id_fkey foreign key (atleta_id) references public.profiles(id) on delete cascade;
alter table public.recuperacion_previa enable row level security;
create policy recuperacion_previa_acceso on public.recuperacion_previa for all
  using (((atleta_id = (select auth.uid())) and cuenta_activa()) or is_master() or (is_admin() and cuenta_activa() and atiendo_a(atleta_id)))
  with check (((atleta_id = (select auth.uid())) and cuenta_activa()) or is_master() or (is_admin() and cuenta_activa() and atiendo_a(atleta_id)));

-- 3. EL COACH SE LO PIDE: un mensaje con la tarjeta «Conecta tu Apple Watch». Una vez al día por atleta.
alter table public.mensajes drop constraint mensajes_tipo_check;
alter table public.mensajes add constraint mensajes_tipo_check check (tipo = any (array['texto', 'foto', 'video', 'voz', 'tecnica', 'correccion', 'reloj']));

create or replace function public.pide_conectar_reloj(p_atleta uuid)
returns public.mensajes
language plpgsql security definer set search_path = public as $$
declare r public.mensajes;
begin
  if auth.uid() is null then raise exception 'Sin sesión'; end if;
  if not (is_admin() and cuenta_activa() and atiendo_a(p_atleta) and puede_escribir(p_atleta, auth.uid())) then
    raise exception 'No puedes escribirle a este atleta';
  end if;
  if exists (select 1 from mensajes where atleta_id = p_atleta and profesional_id = auth.uid() and tipo = 'reloj' and creado_en > now() - interval '20 hours') then
    raise exception 'YA_HOY';
  end if;
  insert into mensajes (atleta_id, profesional_id, autor_id, tipo, texto)
    values (p_atleta, auth.uid(), auth.uid(), 'reloj', 'Conecta tu Apple Watch')
  returning * into r;
  return r;
end $$;

revoke all on function public.pide_conectar_reloj(uuid) from public, anon;
grant execute on function public.pide_conectar_reloj(uuid) to authenticated;

-- 4. «Probar como si tuviera Apple Watch» (solo administradores): lo ve el dueño y las cuentas de prueba que él crea (con ellas prueba como atleta).
create or replace function public.soy_cuenta_de_prueba()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from cuentas_de_prueba where user_id = auth.uid());
$$;
revoke all on function public.soy_cuenta_de_prueba() from public, anon;
grant execute on function public.soy_cuenta_de_prueba() to authenticated;
