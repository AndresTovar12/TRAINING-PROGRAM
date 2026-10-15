-- SUSPENDER LA VITRINA DE UN PROFESIONAL (14 oct 2026). Lo decide solo el dueño (`profiles.vitrina_suspendida`, protegido por `guardar_campos_de_poder`).
-- Suspendida = su página y sus planes dejan de verse, no aparece en Explorar, y no puede publicar ni vender. No se borra nada: al reactivarla todo vuelve como estaba.
-- Ya aplicada en producción como la migración `vitrina_suspendida`.

-- 1) «¿Puede vender?» ahora también dice que no si la vitrina está suspendida. Lo usan Explorar, la página del plan (`ventas`) y `publicar_plan`.
create or replace function public.ventas_posibles(p_coach uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select public.ventas_abiertas()
     and not exists (select 1 from public.profiles where id = p_coach and vitrina_suspendida)
     and (
       exists (select 1 from public.profiles where id = p_coach and is_owner)
       or exists (select 1 from public.cuentas_stripe where coach_id = p_coach and cobros_ok and depositos_ok)
     );
$$;

-- 2) La página del profesional y la de cada plan se esconden (contestan «no existe»). Se cambia solo la condición, sobre la definición que ya está en la base.
do $$
declare d text; nuevo text;
begin
  d := pg_get_functiondef('public.perfil_publico(text)'::regprocedure);
  nuevo := replace(d, E'where p.username = lower(btrim(p_usuario)) and p.role = ''admin'' and coalesce(p.is_active, true)\n',
                      E'where p.username = lower(btrim(p_usuario)) and p.role = ''admin'' and coalesce(p.is_active, true) and not p.vitrina_suspendida\n');
  if nuevo = d then raise exception 'perfil_publico: no encontré la condición a cambiar'; end if;
  execute nuevo;

  d := pg_get_functiondef('public.plan_publico(text,text)'::regprocedure);
  nuevo := replace(d, E'and p.role = ''admin'' and coalesce(p.is_active, true);', E'and p.role = ''admin'' and coalesce(p.is_active, true) and not p.vitrina_suspendida;');
  if nuevo = d then raise exception 'plan_publico: no encontré la condición a cambiar'; end if;
  execute nuevo;

  -- 3) Publicar: el aviso es claro en vez de «Conecta tu cuenta de cobro».
  d := pg_get_functiondef('public.publicar_plan(uuid)'::regprocedure);
  nuevo := replace(d, E'  if public.ventas_abiertas() and not public.ventas_posibles(auth.uid()) then',
                      E'  if exists (select 1 from public.profiles where id = auth.uid() and vitrina_suspendida) then raise exception ''Tu vitrina está suspendida. Escríbele al administrador.''; end if;\n  if public.ventas_abiertas() and not public.ventas_posibles(auth.uid()) then');
  if nuevo = d then raise exception 'publicar_plan: no encontré la condición a cambiar'; end if;
  execute nuevo;
end $$;
