-- VITRINA PARA TODOS LOS PROFESIONALES (12 oct 2026), parte 1 del rediseño de «Mi vitrina» y la compra.
--
-- Andrés, 12 oct 2026: «Mi vitrina» debe salir a TODOS los profesionales (entrenadores, coaches, fisios, instructoras), no solo al dueño. Se publica directo (él puede retirar lo que sea).
-- TODO ES ADITIVO: políticas nuevas (las del dueño se quedan: son redundantes), columnas y funciones nuevas. Nada se borra.
--
-- Lo que cambia:
--   · Cualquier profesional (`is_admin()`) crea, edita y borra borradores de SU vitrina. Un trigger impide que se salte «Publicar»: un profesional NO puede dejar un plan en
--     `publicado` a mano, ni tocar la versión, la fecha de publicación ni los ids de Stripe (eso lo hace `publicar_plan` o el servidor).
--   · «Para quién» deja de ser un texto libre: `deportes` (ya existía), `edades`, `sexo` y `equipo`.
--   · La ventana (cuánto ve el comprador hacia adelante) tiene tope de UN MES: 1 a 4 semanas, por defecto 4. El coach puede bajarla, nunca subirla (#58).
--   · `ajustes_publicos`: interruptores que lee la página pública. `ventas_abiertas` está apagado hasta que Stripe esté conectado: mientras tanto se publica y el botón de comprar dice «Pronto».
--     Cuando esté encendido, `publicar_plan` pide al profesional (que no es el dueño) tener su cuenta de cobro lista.
--
-- Aplicado el 12 oct 2026.

-- 1) Quién puede tocar la vitrina ---------------------------------------------------------------------------------------------------------------------
create policy vitrina_planes_crear_pro on public.vitrina_planes for insert to authenticated
  with check (coach_id = auth.uid() and public.is_admin());
create policy vitrina_planes_editar_pro on public.vitrina_planes for update to authenticated
  using (coach_id = auth.uid() and public.is_admin()) with check (coach_id = auth.uid() and public.is_admin());
create policy vitrina_planes_borrar_pro on public.vitrina_planes for delete to authenticated
  using (coach_id = auth.uid() and public.is_admin() and estado = 'borrador' and version_n = 0);

-- 2) «Para quién», con opciones, y el tope de la ventana ----------------------------------------------------------------------------------------------
alter table public.vitrina_planes add column if not exists edades text[] not null default '{}';
alter table public.vitrina_planes add column if not exists sexo text not null default 'todos';
alter table public.vitrina_planes add column if not exists equipo text[] not null default '{}';
do $$ begin
  alter table public.vitrina_planes add constraint vitrina_sexo_check check (sexo in ('todos', 'mujeres', 'hombres'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.vitrina_planes add constraint vitrina_ventana_un_mes check (ventana_semanas is not null and ventana_semanas between 1 and 4);
exception when duplicate_object then null; end $$;

-- 3) El profesional no se salta «Publicar» -------------------------------------------------------------------------------------------------------------
create or replace function public.vitrina_planes_cuida()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    if new.coach_id is distinct from old.coach_id then raise exception 'No se puede cambiar de dueño un plan en venta.'; end if;
    -- Desde la app (`authenticated`) no se tocan las columnas que maneja la plataforma, ni se pasa a «publicado» sin `publicar_plan` (que corre como su dueño).
    if current_user in ('authenticated', 'anon') then
      if new.version_n is distinct from old.version_n or new.publicada_en is distinct from old.publicada_en
         or new.stripe_product_id is distinct from old.stripe_product_id or new.stripe_price_id is distinct from old.stripe_price_id then
        raise exception 'Eso lo cambia la plataforma.';
      end if;
      if new.estado = 'publicado' and old.estado is distinct from 'publicado' then raise exception 'Para publicar usa «Publicar».'; end if;
    end if;
    new.actualizado_en := now();
  end if;
  return new;
end $$;

create or replace function public.vitrina_planes_nace_borrador()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.estado := 'borrador'; new.version_n := 0; new.publicada_en := null; new.stripe_product_id := null; new.stripe_price_id := null;
  end if;
  return new;
end $$;
create trigger vitrina_planes_nace_borrador before insert on public.vitrina_planes for each row execute function public.vitrina_planes_nace_borrador();

-- 4) Los interruptores públicos y «¿puede este coach cobrar?» ------------------------------------------------------------------------------------------
create table if not exists public.ajustes_publicos (
  clave text primary key,
  valor jsonb not null,
  actualizado_en timestamptz not null default now()
);
alter table public.ajustes_publicos enable row level security;
create policy ajustes_publicos_ver on public.ajustes_publicos for select to anon, authenticated using (true);
-- Sin políticas de escritura: solo el servidor (service_role) los cambia.
insert into public.ajustes_publicos (clave, valor) values ('ventas_abiertas', 'false'::jsonb) on conflict (clave) do nothing;
comment on table public.ajustes_publicos is 'Interruptores que lee la página pública. ventas_abiertas = true cuando Stripe ya está conectado (hasta entonces el botón de comprar dice «Pronto»).';

create or replace function public.ventas_abiertas()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select valor = 'true'::jsonb from public.ajustes_publicos where clave = 'ventas_abiertas'), false);
$$;

-- ¿Se le puede comprar a este coach? Las ventas están abiertas Y (es el dueño, cuya cuenta de Stripe es la de la plataforma, O su cuenta de cobro está lista).
create or replace function public.ventas_posibles(p_coach uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.ventas_abiertas() and (
    exists (select 1 from public.profiles where id = p_coach and is_owner)
    or exists (select 1 from public.cuentas_stripe where coach_id = p_coach and cobros_ok and depositos_ok)
  );
$$;
revoke execute on function public.ventas_abiertas() from public;
revoke execute on function public.ventas_posibles(uuid) from public;
grant execute on function public.ventas_abiertas() to anon, authenticated;
grant execute on function public.ventas_posibles(uuid) to anon, authenticated;

-- 5) Publicar: cualquier profesional; y, con las ventas abiertas, solo quien ya puede cobrar -----------------------------------------------------------
create or replace function public.publicar_plan(p_plan uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare v public.vitrina_planes%rowtype; g public.programas_guardados%rowtype; nuevo integer;
begin
  if not public.is_admin() then raise exception 'Solo los profesionales pueden publicar.'; end if;
  select * into v from public.vitrina_planes where id = p_plan and coach_id = auth.uid() for update;
  if not found then raise exception 'Ese plan no es tuyo.'; end if;
  if v.programa_guardado_id is null then raise exception 'Escoge de cuál de «Mis planes» sale.'; end if;
  if public.ventas_abiertas() and not public.ventas_posibles(auth.uid()) then
    raise exception 'Conecta tu cuenta de cobro para publicar.';
  end if;
  select * into g from public.programas_guardados where id = v.programa_guardado_id and created_by = auth.uid();
  if not found then raise exception 'No encuentro ese plan en «Mis planes».'; end if;
  if jsonb_typeof(g.data -> 'phases') is distinct from 'array' or jsonb_array_length(g.data -> 'phases') = 0 then
    raise exception 'El plan no tiene fases.';
  end if;
  nuevo := v.version_n + 1;
  insert into public.vitrina_versiones (vitrina_plan_id, n, titulo, data) values (v.id, nuevo, v.titulo, g.data);
  update public.vitrina_planes
     set version_n = nuevo, estado = 'publicado', publicada_en = now(),
         foto_url = coalesce(foto_url, nullif(g.data ->> 'foto', '')),
         descripcion = coalesce(descripcion, g.descripcion)
   where id = v.id;
  return nuevo;
end $$;
revoke execute on function public.publicar_plan(uuid) from public, anon;
grant execute on function public.publicar_plan(uuid) to authenticated;

-- 6) La ficha pública trae lo nuevo: para quién (con opciones) y si ya se puede comprar --------------------------------------------------------------
create or replace function public.plan_publico(p_usuario text, p_slug text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'coach', jsonb_build_object('usuario', p.username, 'nombre', p.full_name, 'foto', p.avatar_url, 'profesion', p.profesion, 'bio', p.bio, 'redes', p.redes),
    'slug', v.slug, 'titulo', v.titulo, 'descripcion', v.descripcion, 'para_quien', v.para_quien, 'objetivo', v.objetivo, 'nivel', v.nivel,
    'deportes', to_jsonb(v.deportes), 'edades', to_jsonb(v.edades), 'sexo', v.sexo, 'equipo', to_jsonb(v.equipo),
    'foto', v.foto_url, 'tipo', v.tipo, 'precio', v.precio_mxn,
    'chat', v.chat, 'tecnica', v.tecnica, 'cupo', v.cupo, 'dias_entrega', v.dias_entrega, 'cuestionario', v.cuestionario,
    'ventas', public.ventas_posibles(p.id),
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
