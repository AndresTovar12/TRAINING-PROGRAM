-- BIBLIOTECA DE CLASES: «todas mis clases» como una membresía (12 oct 2026, parte 4b del rediseño de la vitrina).
--
-- Andrés: una instructora de pilates o yoga puede vender sus clases sueltas (parte 4a) o TODAS como membresía mensual. La biblioteca no copia nada: lee en vivo las clases de «Mis planes» de
-- quien la vende (tipo «Clase»: `routine_templates` kind 'day' con `resumen.clase = true`), así que las que agregue después aparecen solas mientras la membresía esté al día.
-- Quien la compra las recibe por la Edge Function `programa-comprado` (`biblioteca.clases`), solo con la compra activa o en gracia.
--
-- PRECIO: mínimo $100 y solo membresía mensual. Supuesto de esta parte (el mínimo de $500 se pensó para planes; con $500 una biblioteca de clases no se vendería): un solo número aquí y en `lib/vitrinaDatos.js`.

alter table public.vitrina_planes drop constraint if exists vitrina_contenido_check;
alter table public.vitrina_planes add constraint vitrina_contenido_check check (contenido in ('programa', 'rutina', 'workout', 'clase', 'biblioteca'));
alter table public.vitrina_planes drop constraint if exists vitrina_precio_minimo;
alter table public.vitrina_planes add constraint vitrina_precio_minimo check (precio_mxn >= case when contenido in ('workout', 'clase', 'biblioteca') then 100 else 500 end);
alter table public.vitrina_planes drop constraint if exists vitrina_biblioteca_mensual;
alter table public.vitrina_planes add constraint vitrina_biblioteca_mensual check (contenido <> 'biblioteca' or tipo = 'membresia');

create or replace function public.publicar_plan(p_plan uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v public.vitrina_planes%rowtype; g public.programas_guardados%rowtype; t public.routine_templates%rowtype;
  nuevo integer; datos jsonb; dias jsonb; desc_ text;
begin
  if not public.is_admin() then raise exception 'Solo los profesionales pueden publicar.'; end if;
  select * into v from public.vitrina_planes where id = p_plan and coach_id = auth.uid() for update;
  if not found then raise exception 'Ese plan no es tuyo.'; end if;
  if public.ventas_abiertas() and not public.ventas_posibles(auth.uid()) then
    raise exception 'Conecta tu cuenta de cobro para publicar.';
  end if;

  if v.contenido = 'biblioteca' then
    -- «Todas mis clases»: no hay nada que copiar. La biblioteca se lee en vivo (las clases de «Mis planes» de quien vende, también las que agregue después); la versión solo marca qué es.
    if not exists (select 1 from public.routine_templates m where m.created_by = auth.uid() and m.kind = 'day' and (m.resumen ->> 'clase') = 'true') then
      raise exception 'Todavía no tienes clases en «Mis planes». Guarda al menos una.';
    end if;
    datos := jsonb_build_object('kind', 'biblioteca', 'estructura', 'biblioteca', 'phases', '[]'::jsonb);
    desc_ := null;
  elsif v.contenido = 'programa' then
    if v.programa_guardado_id is null then raise exception 'Escoge de cuál de «Mis planes» sale.'; end if;
    select * into g from public.programas_guardados where id = v.programa_guardado_id and created_by = auth.uid();
    if not found then raise exception 'No encuentro ese plan en «Mis planes».'; end if;
    if jsonb_typeof(g.data -> 'phases') is distinct from 'array' or jsonb_array_length(g.data -> 'phases') = 0 then
      raise exception 'El plan no tiene fases.';
    end if;
    datos := g.data;
    desc_ := g.descripcion;
  else
    if v.plantilla_id is null then raise exception 'Escoge de cuál de «Mis planes» sale.'; end if;
    select * into t from public.routine_templates where id = v.plantilla_id and created_by = auth.uid();
    if not found then raise exception 'No encuentro ese plan en «Mis planes».'; end if;
    if v.contenido = 'rutina' then
      if t.kind <> 'week' then raise exception 'Eso no es una rutina semanal.'; end if;
      dias := coalesce(t.data -> 'days', '[]'::jsonb);
    else
      if t.kind <> 'day' then raise exception 'Eso no es un workout.'; end if;
      if coalesce((t.resumen ->> 'clase')::boolean, false) is distinct from (v.contenido = 'clase') then
        raise exception '%', case when v.contenido = 'clase' then 'Eso no es una clase.' else 'Eso es una clase, no un workout.' end;
      end if;
      -- Las sesiones del workout (la primera en la raíz, las demás en `otras`), todas el lunes: lo mismo que `diasDeWorkout` en la app.
      select coalesce(jsonb_agg(
               (q.s - 'otras') || jsonb_build_object(
                 'day', 'Lun',
                 'name', coalesce(nullif(q.s ->> 'name', ''), t.name, 'Sesión'),
                 'cat', coalesce(nullif(q.s ->> 'cat', ''), 'gym'),
                 'exercises', coalesce(q.s -> 'exercises', '[]'::jsonb)
               ) order by q.o), '[]'::jsonb)
        into dias
        from (
          select 0 as o, t.data as s
          union all
          select e.o::int, e.x from jsonb_array_elements(coalesce(t.data -> 'otras', '[]'::jsonb)) with ordinality as e(x, o)
        ) q;
    end if;
    if not exists (
      select 1 from jsonb_array_elements(dias) d
       where jsonb_array_length(coalesce(d -> 'exercises', '[]'::jsonb)) > 0 or d ? 'clase'
    ) then
      raise exception 'Eso está vacío: agrégale ejercicios o un video antes de venderlo.';
    end if;
    -- Una rutina que se repite: un plan semanal de una fase y una semana (la misma forma que `planDeRutina`).
    datos := jsonb_build_object(
      'kind', 'weekly', 'estructura', 'rutina',
      'phases', jsonb_build_array(jsonb_build_object(
        'id', 'p-' || substr(md5(gen_random_uuid()::text), 1, 8), 'num', 1, 'name', 'Rutina semanal', 'fullName', '', 'duration', '1 semana', 'weeks', 1,
        'color', '#1E40E0', 'focus', '', 'objective', '',
        'weekData', jsonb_build_array(jsonb_build_object('num', 1, 'label', '', 'load', '', 'days', dias))
      ))
    ) || case when nullif(t.data ->> 'foto', '') is not null then jsonb_build_object('foto', t.data -> 'foto') else '{}'::jsonb end
      || case when jsonb_typeof(t.data -> 'ciencia') = 'array' and jsonb_array_length(t.data -> 'ciencia') > 0 then jsonb_build_object('ciencia', t.data -> 'ciencia') else '{}'::jsonb end;
    desc_ := t.descripcion;
  end if;

  nuevo := v.version_n + 1;
  insert into public.vitrina_versiones (vitrina_plan_id, n, titulo, data) values (v.id, nuevo, v.titulo, datos);
  update public.vitrina_planes
     set version_n = nuevo, estado = 'publicado', publicada_en = now(),
         foto_url = coalesce(foto_url, nullif(datos ->> 'foto', '')),
         descripcion = coalesce(descripcion, desc_)
   where id = v.id;
  return nuevo;
end $$;
revoke execute on function public.publicar_plan(uuid) from public, anon;
grant execute on function public.publicar_plan(uuid) to authenticated;

create or replace function public.plan_publico(p_usuario text, p_slug text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'coach', jsonb_build_object('usuario', p.username, 'nombre', p.full_name, 'foto', p.avatar_url, 'profesion', p.profesion, 'bio', p.bio, 'redes', p.redes),
    'slug', v.slug, 'titulo', v.titulo, 'descripcion', v.descripcion, 'para_quien', v.para_quien, 'objetivo', v.objetivo, 'nivel', v.nivel,
    'deportes', to_jsonb(v.deportes), 'edades', to_jsonb(v.edades), 'sexo', v.sexo, 'equipo', to_jsonb(v.equipo),
    'foto', v.foto_url, 'video', v.video_url, 'tipo', v.tipo, 'precio', v.precio_mxn,
    'chat', v.chat, 'tecnica', v.tecnica, 'cupo', v.cupo, 'dias_entrega', v.dias_entrega, 'cuestionario', v.cuestionario,
    'ventas', public.ventas_posibles(p.id),
    'kind', coalesce(ver.data ->> 'kind', 'periodized'),
    'estructura', coalesce(ver.data ->> 'estructura', case when coalesce(ver.data ->> 'kind', 'periodized') = 'weekly' then 'rutina' else 'fases' end),
    -- Qué se vende (programa, rutina, workout o clase) y, para un workout o una clase, cuántas sesiones trae y cuánto dura el video (solo el número: la dirección del video nunca sale).
    'contenido', v.contenido,
    'sesiones', jsonb_array_length(coalesce(ver.data #> '{phases,0,weekData,0,days}', '[]'::jsonb)),
    'duracion_clase', nullif(ver.data #>> '{phases,0,weekData,0,days,0,clase,duracion}', '')::int,
    -- La biblioteca: qué clases tiene HOY (solo nombre y duración; la dirección del video nunca sale). Las que su coach agregue después se suman solas.
    'clases', case when v.contenido = 'biblioteca' then coalesce((
      select jsonb_agg(jsonb_build_object('nombre', t.name, 'duracion', nullif(t.data #>> '{clase,duracion}', '')::int) order by t.name)
        from public.routine_templates t
       where t.created_by = v.coach_id and t.kind = 'day' and (t.resumen ->> 'clase') = 'true'
    ), '[]'::jsonb) else null end,
    -- La hoja del programa SIN ejercicios: por fase su nombre y color; por semana su número; por día, el nombre de la sesión, su tipo y su turno.
    'hoja', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', f.fase ->> 'id',
        'name', coalesce(f.fase ->> 'name', f.fase ->> 'fullName', 'Fase'),
        'color', f.fase ->> 'color',
        'weekData', coalesce((
          select jsonb_agg(jsonb_build_object(
            'num', w.sem -> 'num',
            'days', coalesce((
              select jsonb_agg(jsonb_build_object(
                'day', d.dia ->> 'day', 'name', d.dia ->> 'name', 'cat', d.dia ->> 'cat', 'turno', d.dia ->> 'turno',
                'catNombre', d.dia ->> 'catNombre', 'catColor', d.dia ->> 'catColor'
              ) order by d.o)
              from jsonb_array_elements(coalesce(w.sem -> 'days', '[]'::jsonb)) with ordinality as d(dia, o)
            ), '[]'::jsonb)
          ) order by w.o)
          from jsonb_array_elements(coalesce(f.fase -> 'weekData', '[]'::jsonb)) with ordinality as w(sem, o)
        ), '[]'::jsonb)
      ) order by f.orden)
      from jsonb_array_elements(coalesce(ver.data -> 'phases', '[]'::jsonb)) with ordinality as f(fase, orden)
    ), '[]'::jsonb)
  )
  from public.profiles p
  join public.vitrina_planes v on v.coach_id = p.id
  join public.vitrina_versiones ver on ver.vitrina_plan_id = v.id and ver.n = v.version_n
  where p.username = lower(btrim(p_usuario)) and v.slug = lower(btrim(p_slug)) and v.estado = 'publicado' and p.role = 'admin' and coalesce(p.is_active, true);
$$;

create or replace function public.perfil_publico(p_usuario text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'usuario', p.username, 'nombre', p.full_name, 'foto', p.avatar_url, 'profesion', p.profesion,
    'bio', p.bio, 'redes', p.redes, 'disciplinas', to_jsonb(p.disciplinas),
    'planes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'slug', v.slug, 'titulo', v.titulo, 'descripcion', v.descripcion, 'foto', v.foto_url, 'tipo', v.tipo, 'precio', v.precio_mxn,
        'nivel', v.nivel, 'objetivo', v.objetivo, 'deportes', to_jsonb(v.deportes),
        'contenido', v.contenido,
        'n_clases', case when v.contenido = 'biblioteca' then (select count(*) from public.routine_templates t where t.created_by = v.coach_id and t.kind = 'day' and (t.resumen ->> 'clase') = 'true') else null end,
        'duracion_clase', nullif(ver.data #>> '{phases,0,weekData,0,days,0,clase,duracion}', '')::int,
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
