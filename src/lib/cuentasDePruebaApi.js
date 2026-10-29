import { supabase } from '@/lib/supabase';
import { COLUMNAS_PERFIL } from '@/lib/perfilColumnas';
import { eliminarAtletaDefinitivo, tokenDeAhora } from '@/lib/api';
import { esDePrueba, generaContrasena, nombreDePrueba, siguienteUsuario, tipoDeCuenta } from '@/lib/cuentasDePrueba';

/* CUENTAS DE PRUEBA, contra la base (14 oct 2026; ver `lib/cuentasDePrueba.js` y `docs/sql/2026-10-14-cuentas-de-prueba.sql`).
   Solo el dueño: la tabla `cuentas_de_prueba` y la función `restablecer-contrasena` se lo exigen. */

const URL_FUNCIONES = () => `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

/** Las cuentas de prueba (usuario `zz_…`) con su contraseña, la más nueva primero. `contrasena` es `null` si nadie la guardó (se le puede poner una nueva). */
export async function listaCuentasDePrueba() {
  const [perfiles, claves] = await Promise.all([
    supabase.from('profiles').select(COLUMNAS_PERFIL).ilike('username', 'zz\\_%').order('created_at', { ascending: false }),
    supabase.from('cuentas_de_prueba').select('user_id, contrasena'),
  ]);
  if (perfiles.error) throw perfiles.error;
  if (claves.error) throw claves.error;
  const porId = new Map((claves.data ?? []).map((c) => [c.user_id, c.contrasena]));
  return (perfiles.data ?? []).filter((p) => esDePrueba(p.username) && !p.is_owner).map((p) => ({ ...p, tipo: tipoDeCuenta(p), contrasena: porId.get(p.id) ?? null }));
}

/**
 * Crea una cuenta de prueba con la función de registro de siempre (`signup`) y guarda la contraseña a la vista del dueño.
 * `usuario` y `contrasena`: los que escribió el dueño (fase 7, 29 oct 2026; el usuario ya va con su `zz_`: `usuarioEscrito`). Sin ellos, se escogen solos como antes.
 * `tipo`: atleta, coach o fisio. `coach`: solo para un atleta, el usuario o código de su coach (vacío = sin coach). Devuelve la cuenta ya con su contraseña.
 */
export async function creaCuentaDePrueba({ tipo, coach = '', usuario: escrito = '', contrasena: escrita = '', usuariosQueYaHay = [] }) {
  const usuario = escrito || siguienteUsuario(tipo, usuariosQueYaHay);
  const contrasena = escrita || generaContrasena();
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const res = await fetch(`${URL_FUNCIONES()}/signup`, {
    method: 'POST',
    // Con la sesión del dueño: `signup` solo deja registrar un «zz_…» a quien llama con ella (p124).
    headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${(await tokenDeAhora().catch(() => null)) || key}` },
    body: JSON.stringify({
      username: usuario,
      full_name: nombreDePrueba(usuario),
      password: contrasena,
      account_type: tipo === 'atleta' ? 'athlete' : 'coach',
      ...(tipo === 'fisio' ? { profesion: 'Fisioterapeuta' } : tipo === 'coach' ? { profesion: 'Entrenador personal' } : {}),
      ...(tipo === 'atleta' && coach.trim() ? { coach_username: coach.trim() } : {}),
    }),
  }).catch(() => null);
  if (!res) throw new Error('No se pudo contactar al servidor. Revisa tu conexión.');
  const cuerpo = await res.json().catch(() => ({}));
  if (!res.ok || !cuerpo?.user_id) throw new Error(cuerpo?.error || 'No se pudo crear la cuenta.');
  const { error } = await supabase.from('cuentas_de_prueba').insert({ user_id: cuerpo.user_id, contrasena, tipo });
  if (error) throw new Error(`La cuenta se creó (${usuario}) pero no se pudo guardar su contraseña: ${error.message}. Contraseña: ${contrasena}`);
  return { id: cuerpo.user_id, username: usuario, full_name: nombreDePrueba(usuario), tipo, contrasena };
}

/** Le pone una contraseña NUEVA a una cuenta (la vieja deja de servir). Si es de prueba, queda guardada a la vista del dueño; si es de una persona real, solo se enseña esta vez.
 *  `contrasena`: la que escribió el dueño; solo vale para una cuenta de prueba (`zz_…`), el servidor la rechaza en una real. Sin ella, el servidor genera una. */
export async function restableceContrasena(userId, contrasena = '') {
  const res = await fetch(`${URL_FUNCIONES()}/restablecer-contrasena`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: import.meta.env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${await tokenDeAhora()}` },
    body: JSON.stringify({ user_id: userId, ...(contrasena ? { contrasena } : null) }),
  }).catch(() => null);
  if (!res) throw new Error('No se pudo contactar al servidor. Revisa tu conexión.');
  const cuerpo = await res.json().catch(() => ({}));
  if (!res.ok || !cuerpo?.contrasena) throw new Error(cuerpo?.error || 'No se pudo restablecer la contraseña.');
  return cuerpo; // { usuario, nombre, contrasena, guardada }
}

/** Borra la cuenta de prueba para siempre (y su contraseña guardada, que cae con ella). Un coach de prueba se lleva sus ejercicios y suelta a sus atletas. */
export async function borraCuentaDePrueba(cuenta) {
  const esProfesional = cuenta.tipo !== 'atleta';
  await eliminarAtletaDefinitivo(cuenta.id, esProfesional ? { atletasA: null, ejerciciosA: 'borrar' } : {});
}
