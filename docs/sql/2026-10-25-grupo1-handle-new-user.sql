-- ETAPA 2 · GRUPO 1 · p131 y p8 (25 oct 2026). APLICADA con apply_migration (solo reemplaza una función; sin DROP/UPDATE/DELETE).
--
-- p131: `handle_new_user` (disparador de auth.users) tomaba el rol de `raw_user_meta_data->>'role'`, que lo manda quien se registra.
--       Hablando directo con la base de acceso (sin pasar por la función `signup`) cualquiera podía nacer con role = 'admin'
--       y saltarse los frenos de `signup`. Ahora SIEMPRE nace como 'user'. Subirlo a coach lo hacen, con la llave de servicio:
--       `signup` (UPDATE de role justo después de crear la cuenta) y `completar_mi_perfil` (una sola vez, pantalla de bienvenida).
-- p8:   el usuario se escribía con «.» permitido (signup y la app lo aceptan) pero aquí «.» se cambiaba por «_»: «Ana.Perez» quedaba
--       «ana_perez» en el perfil y esa persona ya no podía entrar escribiendo su usuario. Ahora el punto se conserva.
--
-- Revertir: volver a crear la función con `coalesce(new.raw_user_meta_data->>'role', 'user')` y la clase '[^a-zA-Z0-9_]'.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  base text;
  intento text;
  n int := 1;
begin
  base := coalesce(nullif(new.raw_user_meta_data->>'username', ''), split_part(new.email, '@', 1));
  base := lower(regexp_replace(base, '[^a-zA-Z0-9_.]', '_', 'g'));
  base := left(nullif(base, ''), 24);
  if base is null then base := 'usuario'; end if;

  intento := base;
  while exists (select 1 from public.profiles where username = intento) loop
    n := n + 1;
    intento := left(base, 20) || n::text;
  end loop;

  insert into public.profiles (id, username, email, full_name, role)
  values (
    new.id,
    intento,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    'user'  -- nunca del metadato que manda el cliente
  );
  return new;
end;
$function$;
