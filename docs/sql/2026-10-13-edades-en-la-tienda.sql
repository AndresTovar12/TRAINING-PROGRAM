-- «PARA QUIÉN» TAMBIÉN EN LA PÁGINA DEL COACH (13 oct 2026).
--
-- Andrés: «no aparece en la vitrina lo de edad». La página de UN plan (`plan_publico`) ya traía edades, sexo y equipo, pero la LISTA de planes de la página de un coach
-- (`perfil_publico`) solo traía los deportes: las tarjetas no podían decir para quién es cada plan. Aquí se suman `edades`, `sexo` y `equipo` a cada plan de esa lista.
-- Es la misma función de antes con tres campos más (create or replace conserva los permisos). Sin datos nuevos: las columnas ya existen en `vitrina_planes`.

create or replace function public.perfil_publico(p_usuario text)
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'usuario', p.username, 'nombre', p.full_name, 'foto', p.avatar_url, 'profesion', p.profesion,
    'bio', p.bio, 'redes', p.redes, 'disciplinas', to_jsonb(p.disciplinas),
    'planes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'slug', v.slug, 'titulo', v.titulo, 'descripcion', v.descripcion, 'foto', v.foto_url, 'tipo', v.tipo, 'precio', v.precio_mxn,
        'nivel', v.nivel, 'objetivo', v.objetivo, 'deportes', to_jsonb(v.deportes),
        'edades', to_jsonb(v.edades), 'sexo', v.sexo, 'equipo', to_jsonb(v.equipo),
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
