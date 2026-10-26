/* Las columnas de `profiles` que la app puede leer con la sesión de quien entra: TODAS menos `email` (ETAPA 2, grupo 1, p140).

   Por qué: la política de lectura de `profiles` decide FILAS, no columnas. Un atleta lee la fila de su coach (y un coach la de sus
   atletas), y con ella el correo de la otra persona. La base va a quitar el permiso de leer `email` (supabase/migrations-pendientes/
   01_perfiles_sin_correo_ajeno.sql); desde entonces `select('*')` sobre `profiles` falla para todos. Por eso cada lectura y cada
   `.update(...).select(...)` sobre `profiles` pide esta lista y no `*`.

   El correo PROPIO sale de la sesión (`user.email`); nunca de aquí.
   Si se agrega una columna a `profiles`: se agrega aquí Y en la base (`grant select (columna) on public.profiles to authenticated;`).
   La prueba `scripts/prueba-perfil-columnas.mjs` vigila que nadie vuelva a pedir `*` ni `email`. */
export const COLUMNAS_PERFIL = [
  'id', 'username', 'full_name', 'role', 'avatar_url', 'created_at', 'updated_at', 'is_owner', 'coach_id', 'is_active',
  'unidad_peso', 'genero', 'profesion', 'perfil_completo', 'codigo_coach', 'alta_en', 'fecha_nacimiento', 'disciplinas',
  'trabaja_en_equipo', 'repertorio_base', 'inicio_paso', 'bio', 'redes', 'limite_atletas', 'comision_especial', 'vitrina_suspendida',
].join(', ');
