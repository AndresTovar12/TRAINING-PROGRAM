-- «MIS PLANES» del atleta (encargo «Compra y dinero», 26 nov 2026). APLICADA con apply_migration (`compra_y_dinero_mis_planes`): dos funciones de lectura nuevas.
-- mis_planes_comprados(): cada compra suya (sin las pendientes) con foto, canal, la fecha de SU versión, cuántas semanas tiene, en qué semana entró y si ya eligió cuándo empieza.
-- mis_pagos(): sus pagos, para «Historial y recibos» (primer pago, renovación o pago único; con Apple o en la web).
-- Solo lo del dueño de la sesión (auth.uid()); el plan publicado nunca sale de aquí (solo cuántas semanas tiene).

create or replace function public.mis_planes_comprados()
returns jsonb language sql stable security definer set search_path to 'public' as $$
  select coalesce(jsonb_agg(x.fila order by x.creada desc), '[]'::jsonb) from (
    select c.creada_en as creada, jsonb_build_object(
      'compra_id', c.id, 'titulo', coalesce(v.titulo, 'Plan'), 'foto', v.foto_url, 'contenido', v.contenido, 'slug', v.slug,
      'coach', jsonb_build_object('nombre', coalesce(p.full_name, v.coach_nombre), 'usuario', p.username, 'foto', p.avatar_url),
      'estado', c.estado, 'tipo', c.tipo, 'canal', c.canal, 'precio', c.precio_mxn,
      'inicio', c.inicio, 'periodo_hasta', c.periodo_hasta, 'gracia_hasta', c.gracia_hasta, 'cancelada_en', c.cancelada_en,
      'creada_en', c.creada_en, 'pagada_en', coalesce(c.pagada_en, c.creada_en), 'entrada_elegida_en', c.entrada_elegida_en, 'fecha_meta', c.fecha_meta,
      'version_fecha', coalesce(ver.creada_en, c.creada_en),
      'kind', coalesce(ver.data ->> 'kind', 'periodized'),
      'total', coalesce((select sum(jsonb_array_length(coalesce(f -> 'weekData', '[]'::jsonb))) from jsonb_array_elements(ver.data -> 'phases') f), 0),
      'semana_entrada', coalesce((
        select antes.n + coalesce((select w.o from jsonb_array_elements(fase.f -> 'weekData') with ordinality w(sem, o) where (w.sem ->> 'num')::int = c.semana_de_entrada limit 1), 1)
          from jsonb_array_elements(ver.data -> 'phases') with ordinality fase(f, o)
          cross join lateral (
            select coalesce(sum(jsonb_array_length(coalesce(f2 -> 'weekData', '[]'::jsonb))), 0)::int as n
              from jsonb_array_elements(ver.data -> 'phases') with ordinality g(f2, o2) where g.o2 < fase.o
          ) antes
         where fase.f ->> 'id' = c.fase_de_entrada limit 1
      ), 1),
      'pagado', (select coalesce(sum(g.bruto), 0) from public.pagos g where g.compra_id = c.id and g.estado = 'cobrado')
    ) as fila
    from public.compras c
    left join public.vitrina_planes v on v.id = c.vitrina_plan_id
    left join public.vitrina_versiones ver on ver.vitrina_plan_id = c.vitrina_plan_id and ver.n = c.version_n
    left join public.profiles p on p.id = c.coach_id
   where c.atleta_id = auth.uid() and c.estado <> 'pendiente'
  ) x;
$$;

create or replace function public.mis_pagos()
returns jsonb language sql stable security definer set search_path to 'public' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'fecha', g.fecha, 'monto', g.bruto, 'canal', g.canal, 'estado', g.estado, 'titulo', coalesce(v.titulo, 'Plan'), 'foto', v.foto_url, 'compra_id', c.id,
    'que', case when c.tipo <> 'membresia' then 'pago_unico'
                when g.fecha = (select min(g2.fecha) from public.pagos g2 where g2.compra_id = c.id) then 'primer_pago' else 'renovacion' end
  ) order by g.fecha desc), '[]'::jsonb)
  from public.pagos g
  join public.compras c on c.id = g.compra_id
  left join public.vitrina_planes v on v.id = c.vitrina_plan_id
  where c.atleta_id = auth.uid();
$$;

grant execute on function public.mis_planes_comprados() to authenticated;
grant execute on function public.mis_pagos() to authenticated;
