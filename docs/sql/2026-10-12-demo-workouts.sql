-- DEMO WORKOUTS (12 oct 2026, entrega 3 de la experiencia sin plan).
--
-- Quien entra a la app sin plan puede querer ver cómo se inicia un workout. Los «demo workouts» son workouts que el DUEÑO arma en Mis planes y marca como demostración (menú de cada
-- workout → «Marcar como demo workout»). Cualquier persona con cuenta los ve en Entrenar → «Demo workout» y los hace igual que cualquier workout (la app los arma como un programa de un
-- solo día, en el día de hoy; ver `armarDemo` en `PlanContext`).
--
--   routine_templates.demo   la marca (false por defecto; solo los workouts, no las clases ni las rutinas)
--   workouts_demo()          los lee: la usa toda persona con sesión (la tabla sigue siendo del coach por RLS; esta función solo devuelve los marcados)
--   marcar_demo(id, demo)    la cambia: SOLO el dueño (`is_master()`), SOLO sobre un workout suyo que no sea una clase
-- Aplicado el 12 oct 2026. Probado dentro de un bloque que termina en `raise exception` (nada se guardó): un no-dueño no puede marcar, una clase no se puede marcar, un atleta sí los lee, `anon` no.

alter table public.routine_templates add column if not exists demo boolean not null default false;
comment on column public.routine_templates.demo is 'Workout de demostración: lo arma y lo marca el dueño en Mis planes y TODA persona con cuenta lo puede hacer desde «Entrenar» para ver cómo se inicia un workout, tenga o no un plan.';

create or replace function public.workouts_demo()
returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', t.id, 'name', t.name, 'descripcion', t.descripcion, 'data', t.data, 'resumen', t.resumen, 'autor_id', t.created_by
         ) order by t.name), '[]'::jsonb)
    from public.routine_templates t
   where t.demo and t.kind = 'day' and coalesce((t.resumen ->> 'clase')::boolean, false) = false;
$$;
revoke execute on function public.workouts_demo() from public, anon;
grant execute on function public.workouts_demo() to authenticated;

create or replace function public.marcar_demo(p_id uuid, p_demo boolean)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_master() then raise exception 'Solo el dueño puede marcar workouts de demostración.'; end if;
  update public.routine_templates
     set demo = coalesce(p_demo, false)
   where id = p_id and created_by = auth.uid() and kind = 'day' and coalesce((resumen ->> 'clase')::boolean, false) = false;
  if not found then raise exception 'Solo un workout tuyo (no una clase) puede ser de demostración.'; end if;
end $$;
revoke execute on function public.marcar_demo(uuid, boolean) from public, anon;
grant execute on function public.marcar_demo(uuid, boolean) to authenticated;
