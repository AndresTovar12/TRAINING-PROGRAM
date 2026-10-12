-- EXPLORAR (12 oct 2026, entrega 4 de la experiencia sin plan).
--
-- La pestaña «Explorar» enseña a los coaches con planes a la venta. `explorar_publico()` los lista: los que tienen al menos un plan PUBLICADO y YA PUEDEN COBRAR (`ventas_posibles`: las ventas
-- abiertas y, o es el dueño, o tiene su cuenta de cobro lista). Mientras las ventas estén cerradas devuelve una lista vacía y Explorar dice «Pronto»: no se le enseñan a nadie planes que no se
-- pueden comprar (ni los de prueba). Cada coach trae sus planes con lo mismo que enseña su página pública: nunca un ejercicio ni la dirección de un video. Solo con sesión.
-- Aplicado el 12 oct 2026. Probado en un bloque que termina en `raise exception` (las ventas se abrieron solo ahí adentro): cerradas = 0 coaches; abiertas = solo el dueño; `anon` no la ejecuta.

create or replace function public.explorar_publico()
returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(c.fila order by c.fila ->> 'nombre'), '[]'::jsonb)
    from (
      select jsonb_build_object(
        'usuario', p.username, 'nombre', p.full_name, 'foto', p.avatar_url, 'profesion', p.profesion, 'disciplinas', to_jsonb(p.disciplinas),
        'n_planes', count(*), 'desde', min(v.precio_mxn),
        'deportes', (select coalesce(jsonb_agg(distinct d), '[]'::jsonb) from public.vitrina_planes v2, unnest(v2.deportes) d where v2.coach_id = p.id and v2.estado = 'publicado'),
        'planes', jsonb_agg(jsonb_build_object(
          'slug', v.slug, 'titulo', v.titulo, 'foto', v.foto_url, 'tipo', v.tipo, 'precio', v.precio_mxn, 'contenido', v.contenido,
          'deportes', to_jsonb(v.deportes), 'nivel', v.nivel,
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
$$;
revoke execute on function public.explorar_publico() from public, anon;
grant execute on function public.explorar_publico() to authenticated;
