-- ETAPA 2 · GRUPO 1 · p141 (25 oct 2026). APLICADA con apply_migration (solo crea una función y un disparador nuevos).
--
-- HUECO (probado el 25 oct con una transacción que se deshace): la política `profiles_update_scoped` deja actualizar la fila propia
-- (id = auth.uid()) y las de los atletas del coach (coach_id = auth.uid()), pero NO dice qué columnas. Hablando directo con la base:
--   - un atleta podía cambiarse de coach (coach_id) y cambiar su `email` guardado;
--   - un coach podía cambiar el `username` y el `email` de sus atletas (con el correo cambiado, `email_for_login` lleva el usuario a
--     otro correo: base para tomar la cuenta).
-- `guardar_campos_de_poder` ya cuidaba role, is_owner, is_active, límites y alta_en; no cuidaba esto.
--
-- QUÉ HACE: `proteger_columnas_de_perfil` (disparador BEFORE UPDATE). Solo vigila lo que llega DIRECTO de la app (rol `authenticated`/`anon`
-- = PostgREST). Lo que corre dentro de funciones SECURITY DEFINER (completar_mi_perfil, quitar_atleta_de_mi_lista, agregar_a_mi_equipo)
-- o con la llave de servicio (funciones de edge) o desde SQL corre con otro rol y pasa sin tocarse: esos son los caminos legítimos.
--   1. `email`: nadie lo cambia directo (ni el dueño); cambia solo `correo-de-la-cuenta` (servicio) tras probar el código.
--   2. El dueño (is_master) puede lo demás.
--   3. `coach_id`: solo el dueño directo (mover a un atleta de coach).
--   4. Si quien edita NO es la persona misma (es su coach): solo `full_name`, `alta_en` (dar de alta) y `updated_at`. Nada más.
--   5. La persona misma sí cambia sus datos (nombre, usuario, foto, unidad…), salvo `email` y `coach_id`.
--
-- QUÉ PODRÍA ROMPER: una pantalla que, desde el navegador, haga UPDATE directo de coach_id/email o edite otros campos de un atleta ajeno.
-- Se buscó en src/ y supabase/functions/: no hay ninguna (setAthleteCoach y promoteToCoach son del dueño).
-- REVERTIR: `drop trigger profiles_proteger_columnas on public.profiles; drop function public.proteger_columnas_de_perfil();`

create or replace function public.proteger_columnas_de_perfil()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  quien uuid := auth.uid();
  libres text[] := array['full_name', 'alta_en', 'updated_at'];
begin
  -- Solo lo que llega directo desde la app. Funciones definer, llave de servicio y SQL corren con otro rol.
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if new.email is distinct from old.email then
    raise exception 'El correo de la cuenta solo se cambia con el código que te llega al correo';
  end if;

  if public.is_master() then
    return new;
  end if;

  if new.coach_id is distinct from old.coach_id then
    raise exception 'Solo el administrador puede cambiar a quién atiende o entrena una cuenta';
  end if;

  if quien is distinct from old.id
     and (to_jsonb(new) - libres) is distinct from (to_jsonb(old) - libres) then
    raise exception 'Solo puedes cambiar el nombre y el alta de tus atletas';
  end if;

  return new;
end;
$function$;

create trigger profiles_proteger_columnas
  before update on public.profiles
  for each row execute function public.proteger_columnas_de_perfil();
