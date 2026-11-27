-- PÁGINAS PÚBLICAS para «Compra y dinero» (26 nov 2026). APLICADA con apply_migration (`compra_y_dinero_paginas`): solo `create or replace` de funciones de lectura.
-- perfil_publico: lo de «Tu página» (portada, qué logran tus atletas, años, certificación, Instagram), la especialidad (disciplinas), cuántos atletas han entrenado con el coach
--   (se cuenta solo: los suyos, los de su equipo y quienes le compraron) y sus resultados. Por plan: promesa (objetivo), «Para ti si…», qué incluye y si es el recomendado.
-- plan_publico: lo mismo del plan, y en la hoja la línea de qué se trabaja en cada fase (`desc`).
-- explorar_publico: la promesa de cada plan (la fila de Explorar).

create or replace function public.atletas_del_coach(p_coach uuid)
returns int language sql stable security definer set search_path to 'public' as $$
  select count(distinct a)::int from (
    select id as a from public.profiles where coach_id = p_coach and role = 'user'
    union select atleta_id from public.equipo where profesional_id = p_coach
    union select atleta_id from public.compras where coach_id = p_coach and atleta_id is not null and estado in ('activa', 'gracia', 'vencida', 'cancelada')
  ) x where a is not null;
$$;

create or replace function public.perfil_publico(p_usuario text)
returns jsonb language sql stable security definer set search_path to 'public' as $function$
  select jsonb_build_object(
    'usuario', p.username, 'nombre', p.full_name, 'foto', p.avatar_url, 'profesion', p.profesion,
    'bio', p.bio, 'redes', p.redes, 'disciplinas', to_jsonb(p.disciplinas),
    'portada', p.portada_url, 'logros', p.logros, 'anos_coach', p.anos_coach, 'certificaciones', p.certificaciones,
    'atletas', public.atletas_del_coach(p.id),
    'ventas', public.ventas_posibles(p.id),
    'resultados', coalesce((
      select jsonb_agg(jsonb_build_object('titulo', r.titulo, 'atleta', r.atleta, 'foto', r.foto_url, 'plan', vp.titulo) order by r.orden, r.creado_en)
        from public.resultados_de_atletas r left join public.vitrina_planes vp on vp.id = r.vitrina_plan_id
       where r.coach_id = p.id
    ), '[]'::jsonb),
    'planes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'slug', v.slug, 'titulo', v.titulo, 'descripcion', v.descripcion, 'foto', v.foto_url, 'tipo', v.tipo, 'precio', v.precio_mxn,
        'nivel', v.nivel, 'objetivo', v.objetivo, 'para_ti_si', v.para_ti_si, 'deportes', to_jsonb(v.deportes),
        'edades', to_jsonb(v.edades), 'sexo', v.sexo, 'equipo', to_jsonb(v.equipo), 'chat', v.chat, 'tecnica', v.tecnica, 'recomendado', v.recomendado,
        'contenido', v.contenido,
        'n_clases', case when v.contenido = 'biblioteca' then (select count(*) from public.routine_templates t where t.created_by = v.coach_id and t.kind = 'day' and (t.resumen ->> 'clase') = 'true') else null end,
        'duracion_clase', nullif(ver.data #>> '{phases,0,weekData,0,days,0,clase,duracion}', '')::int,
        'semanas', coalesce((select sum(jsonb_array_length(coalesce(f -> 'weekData', '[]'::jsonb))) from jsonb_array_elements(ver.data -> 'phases') f), 0)
      ) order by v.recomendado desc, v.publicada_en desc)
      from public.vitrina_planes v
      join public.vitrina_versiones ver on ver.vitrina_plan_id = v.id and ver.n = v.version_n
      where v.coach_id = p.id and v.estado = 'publicado'
    ), '[]'::jsonb)
  )
  from public.profiles p
  where p.username = lower(btrim(p_usuario)) and p.role = 'admin' and coalesce(p.is_active, true) and not p.vitrina_suspendida
    and exists (select 1 from public.vitrina_planes v where v.coach_id = p.id and v.estado = 'publicado');
$function$;

create or replace function public.plan_publico(p_usuario text, p_slug text)
returns jsonb language sql stable security definer set search_path to 'public' as $function$
  select jsonb_build_object(
    'coach', jsonb_build_object('usuario', p.username, 'nombre', p.full_name, 'foto', p.avatar_url, 'profesion', p.profesion, 'bio', p.bio, 'redes', p.redes, 'disciplinas', to_jsonb(p.disciplinas)),
    'slug', v.slug, 'titulo', v.titulo, 'descripcion', v.descripcion, 'para_quien', v.para_quien, 'objetivo', v.objetivo, 'para_ti_si', v.para_ti_si, 'nivel', v.nivel,
    'deportes', to_jsonb(v.deportes), 'edades', to_jsonb(v.edades), 'sexo', v.sexo, 'equipo', to_jsonb(v.equipo),
    'foto', v.foto_url, 'video', v.video_url, 'tipo', v.tipo, 'precio', v.precio_mxn, 'recomendado', v.recomendado,
    'chat', v.chat, 'tecnica', v.tecnica, 'cupo', v.cupo, 'dias_entrega', v.dias_entrega, 'cuestionario', v.cuestionario,
    'ventas', public.ventas_posibles(p.id),
    'kind', coalesce(ver.data ->> 'kind', 'periodized'),
    'estructura', coalesce(ver.data ->> 'estructura', case when coalesce(ver.data ->> 'kind', 'periodized') = 'weekly' then 'rutina' else 'fases' end),
    'contenido', v.contenido,
    'sesiones', jsonb_array_length(coalesce(ver.data #> '{phases,0,weekData,0,days}', '[]'::jsonb)),
    'duracion_clase', nullif(ver.data #>> '{phases,0,weekData,0,days,0,clase,duracion}', '')::int,
    'clases', case when v.contenido = 'biblioteca' then coalesce((
      select jsonb_agg(jsonb_build_object('nombre', t.name, 'duracion', nullif(t.data #>> '{clase,duracion}', '')::int) order by t.name)
        from public.routine_templates t
       where t.created_by = v.coach_id and t.kind = 'day' and (t.resumen ->> 'clase') = 'true'
    ), '[]'::jsonb) else null end,
    'hoja', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', f.fase ->> 'id',
        'name', coalesce(f.fase ->> 'name', f.fase ->> 'fullName', 'Fase'),
        'desc', f.fase ->> 'desc',
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
  where p.username = lower(btrim(p_usuario)) and v.slug = lower(btrim(p_slug)) and v.estado = 'publicado' and p.role = 'admin' and coalesce(p.is_active, true) and not p.vitrina_suspendida;
$function$;

create or replace function public.explorar_publico()
returns jsonb language sql stable security definer set search_path to 'public' as $function$
  select coalesce(jsonb_agg(c.fila order by c.fila ->> 'nombre'), '[]'::jsonb)
    from (
      select jsonb_build_object(
        'usuario', p.username, 'nombre', p.full_name, 'foto', p.avatar_url, 'profesion', p.profesion, 'disciplinas', to_jsonb(p.disciplinas),
        'n_planes', count(*), 'desde', min(v.precio_mxn),
        'deportes', (select coalesce(jsonb_agg(distinct d), '[]'::jsonb) from public.vitrina_planes v2, unnest(v2.deportes) d where v2.coach_id = p.id and v2.estado = 'publicado'),
        'planes', jsonb_agg(jsonb_build_object(
          'slug', v.slug, 'titulo', v.titulo, 'foto', v.foto_url, 'tipo', v.tipo, 'precio', v.precio_mxn, 'contenido', v.contenido,
          'deportes', to_jsonb(v.deportes), 'nivel', v.nivel, 'objetivo', v.objetivo, 'recomendado', v.recomendado,
          'duracion_clase', nullif(ver.data #>> '{phases,0,weekData,0,days,0,clase,duracion}', '')::int,
          'n_clases', case when v.contenido = 'biblioteca' then (select count(*) from public.routine_templates t where t.created_by = v.coach_id and t.kind = 'day' and (t.resumen ->> 'clase') = 'true') else null end,
          'semanas', coalesce((select sum(jsonb_array_length(coalesce(f -> 'weekData', '[]'::jsonb))) from jsonb_array_elements(ver.data -> 'phases') f), 0)
        ) order by v.publicada_en desc)
      ) as fila
        from public.profiles p
        join public.vitrina_planes v on v.coach_id = p.id and v.estado = 'publicado'
        join public.vitrina_versiones ver on ver.vitrina_plan_id = v.id and ver.n = v.version_n
       where p.role = 'admin' and coalesce(p.is_active, true) and public.ventas_posibles(p.id)
       group by p.id
    ) c;
$function$;

grant execute on function public.atletas_del_coach(uuid) to anon, authenticated;
