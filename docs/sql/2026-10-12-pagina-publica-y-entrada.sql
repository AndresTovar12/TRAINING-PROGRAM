-- LA PÁGINA PÚBLICA CON LA HOJA DEL PROGRAMA Y LA ENTRADA POR SEMANA (12 oct 2026), parte 2 del rediseño de la vitrina.
--
-- Andrés, 12 oct 2026:
--   · «Una semana de muestra» REGALABA contenido real. Se va. En su lugar `plan_publico` trae la HOJA del programa: fases, semanas y los días con el NOMBRE de su sesión y su tipo.
--     Ni un ejercicio, ni una nota, ni una descripción: lo que el coach llamó «Fuerza inferior» sí, lo que hay dentro, no.
--   · El comprador entra por CUALQUIER semana (incluso a la mitad de una fase), no por una fase que el coach marcó: la compra guarda `semana_de_entrada` además de `fase_de_entrada`.
--   · El coach puede poner un video presentando el plan (`video_url`).
--
-- ADITIVO: una columna en `compras`, una en `vitrina_planes` y `plan_publico` reemplazada (create or replace). Aplicado el 12 oct 2026.

alter table public.compras add column if not exists semana_de_entrada integer check (semana_de_entrada is null or semana_de_entrada >= 1);
alter table public.vitrina_planes add column if not exists video_url text check (video_url is null or char_length(video_url) <= 600);

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
