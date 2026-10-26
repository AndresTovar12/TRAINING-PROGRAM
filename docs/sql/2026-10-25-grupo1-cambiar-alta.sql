-- ETAPA 2 · GRUPO 1 · preparación de p140 (25 oct 2026). APLICADA con apply_migration (reemplaza una función).
-- `cambiar_alta` (el coach da de alta a un atleta) corría con los permisos de quien llama y devolvía la fila ENTERA de profiles, correo incluido.
-- Cuando la base quite el permiso de leer `profiles.email` (supabase/migrations-pendientes/01_perfiles_sin_correo_ajeno.sql) esa devolución habría fallado.
-- Ahora es SECURITY DEFINER (el `where coach_id = auth.uid()` sigue siendo el candado: solo el coach de ese atleta) y devuelve la fila con el correo en null.
-- Revertir: volver a crearla sin `security definer` y sin `fila.email := null`.
create or replace function public.cambiar_alta(p_atleta uuid, p_alta boolean)
returns profiles
language plpgsql
security definer
set search_path to 'public'
as $function$
declare fila public.profiles;
begin
  update public.profiles
     set alta_en = case when p_alta then now() else null end
   where id = p_atleta and coach_id = auth.uid()
  returning * into fila;
  if fila.id is null then
    raise exception 'No puedes dar de alta a esta persona: no la atiendes';
  end if;
  fila.email := null;
  return fila;
end $function$;
