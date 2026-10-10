-- MENSAJES entre un atleta y cada profesional que lo atiende (su coach y su equipo), y las TARJETAS DE TÉCNICA (el video de una serie que el atleta
-- le manda a quien puso ese ejercicio). Pedido de Andrés, 10 oct 2026. Ver docs/mensajes.md.
--
-- Una conversación es el PAR (atleta, profesional): el coach principal es `profiles.coach_id`; el resto del equipo, las filas `equipo` en estado 'activo'.
-- Quién puede LEER: solo las dos personas del par (también el historial de un vínculo que ya se quitó). Quién puede ESCRIBIR: las dos, mientras haya vínculo
-- y las dos cuentas estén activas (`puede_escribir`); un atleta desactivado deja la conversación solo para leer y se reabre al reactivarlo.
-- Todo lo que no es un mensaje normal (marcar «visto», borrar, mandar o revisar una técnica) pasa por funciones: la tabla no se actualiza ni se borra a mano.

-- ------------------------------------------------------------------------------------------------------------------------------------------------
-- Tablas
-- ------------------------------------------------------------------------------------------------------------------------------------------------

create table if not exists public.tecnicas (
  id uuid primary key default gen_random_uuid(),
  atleta_id uuid not null references public.profiles(id) on delete cascade,
  profesional_id uuid not null references public.profiles(id) on delete cascade,
  ejercicio text not null check (char_length(ejercicio) between 1 and 200),
  detalle text check (detalle is null or char_length(detalle) <= 200),
  sesion_id text,
  clave text,
  ruta text not null,
  mime text,
  segundos integer check (segundos is null or segundos between 0 and 65),
  bytes bigint,
  estado text not null default 'por_revisar' check (estado in ('por_revisar', 'correcta', 'corregida')),
  revisada_en timestamptz,
  intento_de uuid references public.tecnicas(id) on delete set null,
  creada_en timestamptz not null default now(),
  video_borrado boolean not null default false,
  check (atleta_id <> profesional_id)
);
comment on table public.tecnicas is 'El video de técnica de una serie, mandado por el atleta a quien puso el ejercicio en el plan. Vive 30 días (el archivo se borra; la fila queda).';

create table if not exists public.mensajes (
  id uuid primary key default gen_random_uuid(),
  atleta_id uuid not null references public.profiles(id) on delete cascade,
  profesional_id uuid not null references public.profiles(id) on delete cascade,
  autor_id uuid not null references public.profiles(id) on delete cascade,
  tipo text not null check (tipo in ('texto', 'foto', 'video', 'voz', 'tecnica', 'correccion')),
  texto text check (texto is null or char_length(texto) <= 4000),
  adjunto jsonb,
  tecnica_id uuid references public.tecnicas(id) on delete set null,
  marca_s integer check (marca_s is null or marca_s >= 0),
  creado_en timestamptz not null default now(),
  visto_en timestamptz,
  eliminado_en timestamptz,
  adjunto_borrado boolean not null default false,
  check (autor_id in (atleta_id, profesional_id)),
  check (atleta_id <> profesional_id),
  check (tipo <> 'texto' or eliminado_en is not null or char_length(btrim(coalesce(texto, ''))) > 0)
);
comment on table public.mensajes is 'Un mensaje del chat entre un atleta y un profesional. `adjunto`: { ruta, mime, bytes, segundos } en el bucket privado «mensajes». Fotos, videos y notas de voz viven 90 días; los textos, siempre.';

create index if not exists mensajes_conversacion on public.mensajes (atleta_id, profesional_id, creado_en desc);
create index if not exists mensajes_por_leer on public.mensajes (atleta_id, profesional_id) where visto_en is null and eliminado_en is null;
create index if not exists mensajes_adjuntos_vencen on public.mensajes (creado_en) where adjunto is not null and not adjunto_borrado;
create index if not exists tecnicas_del_profesional on public.tecnicas (profesional_id, estado, creada_en desc);
create index if not exists tecnicas_del_atleta on public.tecnicas (atleta_id, creada_en desc);
create index if not exists tecnicas_vencen on public.tecnicas (creada_en) where not video_borrado;

alter table public.mensajes enable row level security;
alter table public.tecnicas enable row level security;

-- ------------------------------------------------------------------------------------------------------------------------------------------------
-- Quién puede qué
-- ------------------------------------------------------------------------------------------------------------------------------------------------

-- ¿Hay vínculo vigente entre este atleta y este profesional? (su coach principal, o alguien de su equipo en estado 'activo')
create or replace function public.hay_vinculo(a uuid, p uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = a and coach_id = p)
      or exists (select 1 from public.equipo where atleta_id = a and profesional_id = p and estado = 'activo');
$$;

-- ¿Puede quien llama ESCRIBIR en la conversación (a, p)? Es una de las dos personas, hay vínculo y las dos cuentas están activas.
create or replace function public.puede_escribir(a uuid, p uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(auth.uid() in (a, p), false)
     and a <> p
     and public.hay_vinculo(a, p)
     and coalesce((select is_active from public.profiles where id = a), false)
     and coalesce((select is_active from public.profiles where id = p), false);
$$;

-- Los archivos del bucket «mensajes» se llaman «<atleta>/<profesional>/<archivo>». Quien llama puede leerlos si es una de las dos personas, y subirlos
-- si además puede escribir. El `case` evita convertir a uuid un nombre que no lo es (un error en una política tumbaría toda la consulta).
create or replace function public.parte_de_ruta(ruta text, para_escribir boolean)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when ruta ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[^/]+$'
      then case when para_escribir
                then public.puede_escribir(split_part(ruta, '/', 1)::uuid, split_part(ruta, '/', 2)::uuid)
                else coalesce(auth.uid() in (split_part(ruta, '/', 1)::uuid, split_part(ruta, '/', 2)::uuid), false) end
    else false
  end;
$$;

-- ------------------------------------------------------------------------------------------------------------------------------------------------
-- Políticas de las tablas
-- ------------------------------------------------------------------------------------------------------------------------------------------------

drop policy if exists mensajes_ver on public.mensajes;
create policy mensajes_ver on public.mensajes for select to authenticated
  using (auth.uid() in (atleta_id, profesional_id));

-- Texto, foto, video y nota de voz se mandan directo. Las tarjetas de técnica y sus respuestas pasan por las funciones de abajo.
drop policy if exists mensajes_enviar on public.mensajes;
create policy mensajes_enviar on public.mensajes for insert to authenticated
  with check (
    autor_id = auth.uid()
    and tipo in ('texto', 'foto', 'video', 'voz')
    and public.puede_escribir(atleta_id, profesional_id)
    and visto_en is null and eliminado_en is null and not adjunto_borrado and tecnica_id is null and marca_s is null
    and (tipo = 'texto' or adjunto is not null)
    and (adjunto is null or (adjunto ->> 'ruta') like atleta_id::text || '/' || profesional_id::text || '/%')
  );

drop policy if exists tecnicas_ver on public.tecnicas;
create policy tecnicas_ver on public.tecnicas for select to authenticated
  using (auth.uid() in (atleta_id, profesional_id));

revoke all on public.mensajes, public.tecnicas from anon;
revoke all on public.mensajes, public.tecnicas from authenticated;
grant select, insert on public.mensajes to authenticated;
grant select on public.tecnicas to authenticated;

-- ------------------------------------------------------------------------------------------------------------------------------------------------
-- La bandeja: una fila por conversación posible (y las que ya tienen historial), con lo último que se dijo y lo que falta por leer
-- ------------------------------------------------------------------------------------------------------------------------------------------------

create or replace function public.bandeja()
returns table (
  atleta_id uuid, profesional_id uuid, otro_id uuid, otro_nombre text, otro_usuario text, otro_avatar text, otro_profesion text,
  soy_atleta boolean, activa boolean,
  ultimo_tipo text, ultimo_texto text, ultimo_en timestamptz, ultimo_autor uuid, ultimo_borrado boolean,
  sin_leer integer, por_revisar integer
)
language sql stable security definer set search_path = public as $$
  with pares as (
    select pr.id as a, pr.coach_id as p from public.profiles pr where pr.id = auth.uid() and pr.coach_id is not null
    union
    select e.atleta_id, e.profesional_id from public.equipo e where e.atleta_id = auth.uid() and e.estado = 'activo'
    union
    select pr.id, auth.uid() from public.profiles pr where pr.coach_id = auth.uid()
    union
    select e.atleta_id, e.profesional_id from public.equipo e where e.profesional_id = auth.uid() and e.estado = 'activo'
    union
    select m.atleta_id, m.profesional_id from public.mensajes m where auth.uid() in (m.atleta_id, m.profesional_id)
  )
  select
    pa.a, pa.p,
    o.id,
    coalesce(nullif(btrim(o.full_name), ''), o.username),
    o.username, o.avatar_url, o.profesion,
    (pa.a = auth.uid()),
    (public.hay_vinculo(pa.a, pa.p) and coalesce(pa_atleta.is_active, false) and coalesce(pa_pro.is_active, false)),
    u.tipo, u.texto, u.creado_en, u.autor_id, coalesce(u.eliminado_en is not null, false),
    coalesce(sl.n, 0), coalesce(pr.n, 0)
  from pares pa
  join public.profiles pa_atleta on pa_atleta.id = pa.a
  join public.profiles pa_pro on pa_pro.id = pa.p
  join public.profiles o on o.id = case when pa.a = auth.uid() then pa.p else pa.a end
  left join lateral (
    select m.tipo, m.texto, m.creado_en, m.autor_id, m.eliminado_en from public.mensajes m
     where m.atleta_id = pa.a and m.profesional_id = pa.p order by m.creado_en desc limit 1
  ) u on true
  left join lateral (
    select count(*)::int as n from public.mensajes m
     where m.atleta_id = pa.a and m.profesional_id = pa.p and m.autor_id <> auth.uid() and m.visto_en is null and m.eliminado_en is null
  ) sl on true
  left join lateral (
    select count(*)::int as n from public.tecnicas t
     where t.atleta_id = pa.a and t.profesional_id = pa.p and t.estado = 'por_revisar' and not t.video_borrado and pa.p = auth.uid()
  ) pr on true
  where auth.uid() is not null and pa.a <> pa.p
  order by u.creado_en desc nulls last, 4;
$$;

-- ------------------------------------------------------------------------------------------------------------------------------------------------
-- Lo que no es «mandar un mensaje»
-- ------------------------------------------------------------------------------------------------------------------------------------------------

-- «Visto»: quien abre la conversación marca como vistos los mensajes del otro. Devuelve cuántos.
create or replace function public.marcar_vistos(a uuid, p uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if auth.uid() is null or auth.uid() not in (a, p) then return 0; end if;
  update public.mensajes set visto_en = now()
   where atleta_id = a and profesional_id = p and autor_id <> auth.uid() and visto_en is null and eliminado_en is null;
  get diagnostics n = row_count;
  return n;
end $$;

-- Cada quien borra lo SUYO, para los dos: el mensaje queda como «Mensaje eliminado». Devuelve la ruta del archivo que tenía (el navegador la borra del bucket).
create or replace function public.eliminar_mensaje(mensaje uuid)
returns text language plpgsql security definer set search_path = public as $$
declare ruta text; tec uuid;
begin
  select adjunto ->> 'ruta', tecnica_id into ruta, tec from public.mensajes where id = mensaje and autor_id = auth.uid() and eliminado_en is null for update;
  if not found then return null; end if;
  update public.mensajes set eliminado_en = now(), texto = null, adjunto = null, adjunto_borrado = (adjunto is not null) where id = mensaje;
  if tec is not null then
    update public.tecnicas set video_borrado = true where id = tec and atleta_id = auth.uid();
  end if;
  return ruta;
end $$;

-- El atleta le manda a un profesional el video de una serie: crea la técnica y su tarjeta en la conversación. Devuelve el id de la TÉCNICA (el motor del entreno lo guarda en `hechos[clave].tecnica`). `p_intento_de`: la técnica anterior de la
-- misma serie («Mandar otro intento»).
create or replace function public.mandar_tecnica(
  p_profesional uuid, p_ejercicio text, p_detalle text, p_sesion text, p_clave text,
  p_ruta text, p_mime text, p_segundos integer, p_bytes bigint, p_intento_de uuid default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare a uuid := auth.uid(); tid uuid;
begin
  if a is null then raise exception 'Entra con tu cuenta para mandar el video.'; end if;
  if not public.puede_escribir(a, p_profesional) then raise exception 'No le puedes escribir a esta persona.'; end if;
  if p_ruta is null or p_ruta not like a::text || '/' || p_profesional::text || '/%' then raise exception 'El archivo no es tuyo.'; end if;
  if coalesce(p_segundos, 0) > 65 then raise exception 'El video dura más de 60 segundos.'; end if;
  if p_intento_de is not null and not exists (select 1 from public.tecnicas where id = p_intento_de and atleta_id = a and profesional_id = p_profesional) then
    p_intento_de := null;
  end if;
  insert into public.tecnicas (atleta_id, profesional_id, ejercicio, detalle, sesion_id, clave, ruta, mime, segundos, bytes, intento_de)
  values (a, p_profesional, left(p_ejercicio, 200), left(p_detalle, 200), p_sesion, p_clave, p_ruta, p_mime, p_segundos, p_bytes, p_intento_de)
  returning id into tid;
  insert into public.mensajes (atleta_id, profesional_id, autor_id, tipo, tecnica_id, adjunto)
  values (a, p_profesional, a, 'tecnica', tid, jsonb_build_object('ruta', p_ruta, 'mime', p_mime, 'segundos', p_segundos, 'bytes', p_bytes));
  return tid;
end $$;

-- El profesional contesta una técnica: «correcta» (un solo toque) o «corregir» (texto, nota de voz o video propio y, si quiere, el segundo del video donde está el detalle).
create or replace function public.responder_tecnica(
  p_tecnica uuid, p_veredicto text, p_texto text default null, p_adjunto jsonb default null, p_marca integer default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare t public.tecnicas%rowtype; mid uuid;
begin
  select * into t from public.tecnicas where id = p_tecnica and profesional_id = auth.uid() for update;
  if not found then raise exception 'Esa técnica no es tuya.'; end if;
  if not public.puede_escribir(t.atleta_id, t.profesional_id) then raise exception 'La conversación está cerrada.'; end if;
  if p_veredicto = 'correcta' then
    insert into public.mensajes (atleta_id, profesional_id, autor_id, tipo, tecnica_id, texto)
    values (t.atleta_id, t.profesional_id, auth.uid(), 'correccion', t.id, 'Técnica correcta') returning id into mid;
    update public.tecnicas set estado = 'correcta', revisada_en = now() where id = t.id;
  elsif p_veredicto = 'corregir' then
    if coalesce(btrim(p_texto), '') = '' and p_adjunto is null then raise exception 'Escribe o graba la corrección.'; end if;
    if p_adjunto is not null and (p_adjunto ->> 'ruta') not like t.atleta_id::text || '/' || t.profesional_id::text || '/%' then raise exception 'El archivo no es tuyo.'; end if;
    insert into public.mensajes (atleta_id, profesional_id, autor_id, tipo, tecnica_id, texto, adjunto, marca_s)
    values (t.atleta_id, t.profesional_id, auth.uid(), 'correccion', t.id, nullif(btrim(p_texto), ''), p_adjunto, p_marca) returning id into mid;
    update public.tecnicas set estado = 'corregida', revisada_en = now() where id = t.id;
  else
    raise exception 'Veredicto desconocido.';
  end if;
  return mid;
end $$;

revoke execute on function public.hay_vinculo(uuid, uuid), public.puede_escribir(uuid, uuid), public.parte_de_ruta(text, boolean), public.bandeja(),
  public.marcar_vistos(uuid, uuid), public.eliminar_mensaje(uuid),
  public.mandar_tecnica(uuid, text, text, text, text, text, text, integer, bigint, uuid),
  public.responder_tecnica(uuid, text, text, jsonb, integer) from public, anon;
grant execute on function public.hay_vinculo(uuid, uuid), public.puede_escribir(uuid, uuid), public.parte_de_ruta(text, boolean), public.bandeja(),
  public.marcar_vistos(uuid, uuid), public.eliminar_mensaje(uuid),
  public.mandar_tecnica(uuid, text, text, text, text, text, text, integer, bigint, uuid),
  public.responder_tecnica(uuid, text, text, jsonb, integer) to authenticated;

-- ------------------------------------------------------------------------------------------------------------------------------------------------
-- Los archivos: un bucket PRIVADO (se ven con direcciones firmadas de una hora, no con una liga pública)
-- ------------------------------------------------------------------------------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('mensajes', 'mensajes', false, 52428800, array[
  'image/jpeg', 'image/png', 'image/webp',
  'video/mp4', 'video/quicktime', 'video/webm',
  'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/mpeg', 'audio/webm', 'audio/ogg', 'audio/wav'
])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists mensajes_archivos_ver on storage.objects;
create policy mensajes_archivos_ver on storage.objects for select to authenticated
  using (bucket_id = 'mensajes' and public.parte_de_ruta(name, false));

drop policy if exists mensajes_archivos_subir on storage.objects;
create policy mensajes_archivos_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'mensajes' and public.parte_de_ruta(name, true));

drop policy if exists mensajes_archivos_quitar on storage.objects;
create policy mensajes_archivos_quitar on storage.objects for delete to authenticated
  using (bucket_id = 'mensajes' and (owner = auth.uid() or owner_id = auth.uid()::text));

-- ------------------------------------------------------------------------------------------------------------------------------------------------
-- En vivo: el navegador se entera de un mensaje nuevo (o de un «visto») sin preguntar cada rato
-- ------------------------------------------------------------------------------------------------------------------------------------------------
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'mensajes') then
    alter publication supabase_realtime add table public.mensajes;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tecnicas') then
    alter publication supabase_realtime add table public.tecnicas;
  end if;
end $$;
