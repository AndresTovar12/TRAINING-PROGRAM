-- PENDIENTE DE APROBACIÓN DE ANDRÉS. NO SE HA APLICADO. Contiene REVOKE (la herramienta de migraciones lo rechaza a propósito).
-- p140 · Lote 1 de seguridad, punto 8 (25 oct 2026). Actualizado en la ETAPA 2, grupo 1 (25 oct 2026, noche).
--
-- QUÉ SE ENCONTRÓ (confirmado con consultas de solo lectura)
--   La política `profiles_select_scoped` deja a un atleta leer la fila de su coach y la de su equipo. Una política decide FILAS, no columnas, y
--   `authenticated` tiene SELECT sobre toda la tabla: por eso el atleta también lee el CORREO de su coach y de su equipo (y el coach el de sus atletas).
--   Ninguna pantalla usa `profiles.email` (la app usa `user.email`, el de la sesión).
--
-- QUÉ HACE ESTE ARCHIVO (5 líneas)
--   1. Quita el SELECT de tabla completa a anon/authenticated y lo devuelve columna por columna, TODAS menos `email`.
--   2. Crea `mi_correo()`: cada quien puede pedir su propio correo (sale de auth.users).
--   3. Las funciones SECURITY DEFINER (email_for_login, usuario_por_correo, handle_new_user, cambiar_alta…) y las de edge (llave de servicio) no se afectan.
--   QUÉ PODRÍA ROMPER: cualquier consulta con la sesión de la persona que pida `*` o `email` de `profiles` (falla con «permission denied»). REVERTIR: `grant select on public.profiles to authenticated;`
--
-- YA ESTÁ HECHO EN EL CÓDIGO (etapa 2, commits del grupo 1; no depende de este archivo):
--   - la app: todas las lecturas y `.update().select()` de `profiles` piden `COLUMNAS_PERFIL` (src/lib/perfilColumnas.js), sin `*` ni `email`;
--     la prueba `scripts/prueba-perfil-columnas.mjs` (dentro de `npm run pruebas`) falla si alguien vuelve a pedir `*` o `email`.
--   - la base: `cambiar_alta` ya no devuelve el correo (migración grupo1_cambiar_alta_sin_correo, aplicada).
--   - el conector de IA: `supabase/functions/mcp/util.ts` (`CAMPOS_PERSONA`) ya no pide `email`. OJO: la versión DESPLEGADA del conector (v34, fijada al
--     commit 618d3a2) TODAVÍA lo pide: sin redesplegarlo, `buscarPersona` (casi todas las herramientas de coach) fallaría en cuanto se aplique este archivo.
--
-- ORDEN OBLIGATORIO PARA APLICARLO (si se cambia, la app o el conector se rompen):
--   1. Subir la rama `etapa-2` a GitHub (push) y publicar la app web con estos cambios (Cloudflare) y la del iPhone si la app nativa lee `profiles`.
--   2. Redesplegar el conector `mcp` con el SHA nuevo (stub fijado a commit, ver la memoria `reference_mcp_training_lab`; probar un `ver_atleta` de un coach).
--   3. Probar con zz_qa_* (atleta, coach, fisio, dueño): entrar, Mi perfil, lista de atletas, ficha del atleta, Equipo, «Dar de alta».
--   4. Recién entonces aplicar este archivo (con permiso de Andrés).
--   5. Comprobar: como atleta, `select email from profiles where id = <su coach>` debe dar «permission denied for column email».
--   Cada columna NUEVA que se agregue después a `profiles` necesita su `grant select (columna) on public.profiles to authenticated;` y entrar en COLUMNAS_PERFIL.
--
-- PENDIENTE APARTE (misma causa, no resuelto aquí): el atleta también lee `limite_atletas`, `comision_especial` y `vitrina_suspendida` de su coach. Quitarlos
--   exige darle al panel del dueño una función para leerlos (hoy salen de `select`); propuesta en la respuesta del grupo 1.

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
