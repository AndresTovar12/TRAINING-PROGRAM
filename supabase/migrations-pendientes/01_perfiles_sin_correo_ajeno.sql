-- PENDIENTE DE APROBACIÓN DE ANDRÉS. NO SE HA APLICADO. Contiene REVOKE (la herramienta de migraciones lo rechaza a propósito).
-- Lote 1 de seguridad, punto 8 (25 oct 2026).
--
-- QUÉ SE ENCONTRÓ (confirmado con consultas de solo lectura el 25 oct 2026)
--   La política `profiles_select_scoped` deja a un atleta leer la fila de su coach (`id = my_coach_id()`) y la de su equipo
--   (`en_mi_equipo(id)`). Una política decide FILAS, no columnas, y `authenticated` tiene SELECT sobre toda la tabla: por eso el atleta
--   también lee el CORREO de su coach y de su equipo (probado haciéndose pasar por zz_qa_pac: ve `email` de zz_qa_fisio).
--   A la inversa, un coach lee el correo de sus atletas. Ninguna pantalla de la app usa `profiles.email` (la app usa `user.email`, el de la
--   sesión), así que quitarlo no quita nada que se vea.
--
-- QUÉ HACE ESTE ARCHIVO
--   1. Quita el SELECT de tabla completa a anon/authenticated y lo devuelve columna por columna, TODAS menos `email`.
--   2. Crea `mi_correo()`: cada quien puede pedir su propio correo (sale de auth.users, no de profiles).
--   Las funciones que sí leen profiles.email (`email_for_login`, `usuario_por_correo`, `handle_new_user`) son SECURITY DEFINER: no se afectan.
--   Las Edge Functions usan service_role: no se afectan.
--
-- ANTES DE APLICARLO (si no, la app se rompe: `select *` falla cuando una columna no tiene permiso)
--   Hay que cambiar en la app todo `from('profiles')…select('*')` (y `.update(…).select('*')`, y `profiles(*)` dentro de otros select) por la lista
--   explícita de columnas SIN email. Hoy son: src/contexts/AuthContext.jsx:66, src/lib/api.js (listAthletesOverview ~572, listCoaches ~886,
--   promoteToCoach ~919), src/lib/lugaresApi.js:85, src/lib/cuentasDePruebaApi.js:13. Revisar también `grep -rn "profiles(" src` y el servidor MCP
--   (supabase/functions/mcp) por si pide `*` con la sesión del usuario. Y probar con las cuentas zz_qa_* (atleta, coach, fisio, dueño) antes de aplicar.
--   Cada columna NUEVA que se agregue después a `profiles` necesitará su propio `grant select (columna) on public.profiles to authenticated;`.
--
-- RECOMENDACIÓN: aplicarlo en la etapa de revisión final, después de cambiar esas consultas y probarlas. Es reversible:
--   `grant select on public.profiles to authenticated;` devuelve el estado de hoy.

begin;

revoke select on public.profiles from anon, authenticated;

do $$
declare
  columnas text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into columnas
    from information_schema.columns
   where table_schema = 'public' and table_name = 'profiles' and column_name <> 'email';
  execute format('grant select (%s) on public.profiles to authenticated', columnas);
end $$;

-- Su propio correo (el de la cuenta), para quien lo necesite en pantalla.
create or replace function public.mi_correo()
returns text
language sql stable security definer set search_path = public, auth as $$
  select u.email::text from auth.users u where u.id = auth.uid()
$$;
revoke all on function public.mi_correo() from public, anon;
grant execute on function public.mi_correo() to authenticated;

commit;
