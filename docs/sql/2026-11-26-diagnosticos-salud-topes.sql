-- DIAGNÓSTICOS DE SALUD: TOPES Y VERSIÓN DE LA APP (26 nov 2026, revisión de 2026-11-26-diagnosticos-salud.sql).
-- · `app`: la versión de la app con su build («1.0 (115)»), para saber con qué build fue cada intento.
-- · Topes: `errores` hasta 2000 letras (la app ya recorta ahí) y `detalle` hasta 8 KB (la app guarda { recortado: true } si crece).
-- · Que no se acumulen: después de cada fila nueva se borran las de esa persona que pasen de las 20 más recientes. El usuario no tiene permiso de borrar
--   (RLS), así que la función corre como dueña (security definer) y solo toca filas del mismo `usuario_id` que acaba de insertar.
-- Aplicada en dos migraciones (`diagnosticos_salud_topes` y `diagnosticos_salud_deja_20`), sin `drop`: con él, Supabase pide confirmar y se rechaza solo.
-- Probada en un bloque que se deshace: 23 filas → quedan las 20 más nuevas; `errores` de 2001 letras → rechazado.

alter table public.diagnosticos_salud add column if not exists app text;

alter table public.diagnosticos_salud add constraint diagnosticos_salud_errores_tope check (errores is null or char_length(errores) <= 2000);
alter table public.diagnosticos_salud add constraint diagnosticos_salud_detalle_tope check (detalle is null or pg_column_size(detalle) <= 8192);
alter table public.diagnosticos_salud add constraint diagnosticos_salud_app_tope check (app is null or char_length(app) <= 40);

create or replace function public.diagnosticos_salud_deja_20()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.diagnosticos_salud d
  where d.usuario_id = new.usuario_id
    and d.id not in (
      select x.id from public.diagnosticos_salud x
      where x.usuario_id = new.usuario_id
      order by x.creado_en desc, x.id desc
      limit 20
    );
  return null;
end;
$$;

revoke all on function public.diagnosticos_salud_deja_20() from public, anon, authenticated;

create trigger diagnosticos_salud_deja_20
  after insert on public.diagnosticos_salud
  for each row execute function public.diagnosticos_salud_deja_20();
