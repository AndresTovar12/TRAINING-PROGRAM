/* CUENTAS DE PRUEBA, lo puro (14 oct 2026). Sin red ni React: lo usan el panel del dueño y `scripts/prueba-cuentas-de-prueba.mjs`.

   Una cuenta es «de prueba» por su usuario: empieza con `zz_` (la costumbre de siempre: zz_qa_fisio…). Solo de esas el panel del dueño enseña la contraseña; las de personas reales NUNCA
   se pueden leer (la base las guarda cifradas en un solo sentido), solo se les puede poner una nueva. */

export const TIPOS_DE_PRUEBA = [
  { id: 'atleta', nombre: 'Atleta' },
  { id: 'coach', nombre: 'Coach' },
  { id: 'fisio', nombre: 'Fisio' },
];

export const esDePrueba = (usuario) => /^zz_/i.test(String(usuario ?? ''));

/** Qué es una cuenta, para la etiqueta: un perfil de la base → 'atleta' | 'coach' | 'fisio'. */
export const tipoDeCuenta = (perfil) => (perfil?.role === 'admin' ? (/fisio/i.test(perfil?.profesion ?? '') ? 'fisio' : 'coach') : 'atleta');

/** El usuario que sigue: `zz_prueba_atleta_3` si ya existen el 1 y el 2 (o el 5 y no el 3: siempre uno más que el más alto). */
export function siguienteUsuario(tipo, usuariosQueYaHay = []) {
  const re = new RegExp(`^zz_prueba_${tipo}_(\\d+)$`, 'i');
  const mayor = (usuariosQueYaHay ?? []).reduce((m, u) => { const g = re.exec(String(u ?? '')); return g ? Math.max(m, Number(g[1])) : m; }, 0);
  return `zz_prueba_${tipo}_${mayor + 1}`;
}

export const PREFIJO_DE_PRUEBA = 'zz_';
const USUARIO_VALIDO = /^[a-zA-Z0-9_.]{3,30}$/; // la misma regla de `signup`

/**
 * El usuario que escribió el dueño para una cuenta de prueba (fase 7, 29 oct 2026: «que yo pueda escoger el nombre de usuario»). Lo escrito va SIN el `zz_` (se pone solo:
 * es lo que hace que la cuenta salga en el panel con su contraseña); si lo escribe, no se duplica. `{ usuario }` o `{ error }`. `yaHay`: los usuarios que existen.
 */
export function usuarioEscrito(texto, yaHay = []) {
  const limpio = String(texto ?? '').trim().replace(/^zz_/i, '');
  if (!limpio) return { error: 'Escribe un usuario.' };
  const usuario = `${PREFIJO_DE_PRUEBA}${limpio}`;
  if (!USUARIO_VALIDO.test(usuario)) return { error: 'Solo letras, números, _ o . (3 a 30 con el zz_), sin espacios.' };
  if ((yaHay ?? []).some((u) => String(u ?? '').toLowerCase() === usuario.toLowerCase())) return { error: `«${usuario}» ya existe. Escoge otro.` };
  return { usuario };
}

/** La contraseña que escribió el dueño para una cuenta de prueba, o el problema en una frase. Aquí solo manda lo del servidor (8 a 72): son cuentas de juguete, que se pueden escribir fácil. */
export function problemaDeContrasenaDePrueba(texto) {
  const c = String(texto ?? '');
  if (c.length < 8) return 'Usa al menos 8 caracteres.';
  if (c.length > 72) return 'Usa un máximo de 72 caracteres.';
  return null;
}

/** «Prueba Atleta 3», a partir del usuario («Prueba pac» si lo escogió él: `zz_pac`). */
export function nombreDePrueba(usuario) {
  const m = /^zz_prueba_([a-z]+)_(\d+)$/i.exec(String(usuario ?? ''));
  if (!m) return esDePrueba(usuario) && !/^zz_qa_/i.test(usuario) ? `Prueba ${String(usuario).slice(PREFIJO_DE_PRUEBA.length).replace(/[_.]+/g, ' ')}` : String(usuario ?? '');
  const tipo = TIPOS_DE_PRUEBA.find((t) => t.id === m[1].toLowerCase())?.nombre ?? m[1];
  return `Prueba ${tipo} ${m[2]}`;
}

// Sin letras que se confunden (I, l, O, 0): se lee y se copia a mano sin errores. Algo como «kReM-4829ab».
const LETRAS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';
const DIGITOS = '23456789';

/** Una contraseña al azar, fácil de leer y que pasa las reglas de la app (≥ 8, con letras y números). `azar`: de dónde salen los bytes (se cambia en las pruebas). */
export function generaContrasena(azar = (n) => globalThis.crypto.getRandomValues(new Uint32Array(n))) {
  const saca = (alfabeto, n) => Array.from(azar(n), (b) => alfabeto[b % alfabeto.length]).join('');
  return `${saca(LETRAS, 4)}-${saca(DIGITOS, 4)}${saca(LETRAS, 2)}`;
}
