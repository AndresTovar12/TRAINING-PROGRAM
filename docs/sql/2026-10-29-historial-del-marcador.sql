-- EL HISTORIAL DEL MARCADOR (29 oct 2026). El 28 oct la app regresó al atleta Andrés a «Recuperación · Semana 1» estando en Fuerza, y no había
-- forma de saber quién ni por qué: nadie apuntaba los cambios de `wr:cursor`. Desde ahora, cada cambio de un marcador (`wr:cursor` o
-- `wr:cursor@…`) en `user_app_state` queda aquí: antes, después, quién escribió (su sesión) y el motivo que trae el marcador nuevo
-- ('calendario', 'atleta', 'coach', 'ia', 'reparado', 'plan-nuevo'…). Solo lo escribe el disparador; nadie lo edita desde la app.
-- Todo es aditivo.

create table public.historial_del_marcador (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  clave text not null,
  antes jsonb,
  despues jsonb,
  quien uuid,
  motivo text,
  creado_en timestamptz not null default now()
);
create index historial_del_marcador_por_atleta on public.historial_del_marcador (user_id, creado_en desc);
alter table public.historial_del_marcador enable row level security;
create policy historial_del_marcador_ver on public.historial_del_marcador for select
  using (user_id = (select auth.uid()) or is_master() or (is_admin() and cuenta_activa() and atiendo_a(user_id)));

create or replace function public.anota_cambio_de_marcador()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  k text;
  viejo jsonb := case when tg_op = 'INSERT' then '{}'::jsonb else coalesce(old.data, '{}'::jsonb) end;
  nuevo jsonb := coalesce(new.data, '{}'::jsonb);
begin
  for k in
    select key from jsonb_object_keys(nuevo) as key where key ~ '^wr:cursor(@|$)'
    union
    select key from jsonb_object_keys(viejo) as key where key ~ '^wr:cursor(@|$)'
  loop
    if viejo -> k is distinct from nuevo -> k then
      insert into public.historial_del_marcador (user_id, clave, antes, despues, quien, motivo)
      values (new.user_id, k, viejo -> k, nuevo -> k, auth.uid(), nuevo -> k ->> 'motivo');
    end if;
  end loop;
  return new;
end $$;

revoke all on function public.anota_cambio_de_marcador() from public, anon, authenticated;

create trigger anota_cambio_de_marcador
  after insert or update of data on public.user_app_state
  for each row execute function public.anota_cambio_de_marcador();
