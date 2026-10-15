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

/** «Prueba Atleta 3», a partir del usuario. */
export function nombreDePrueba(usuario) {
  const m = /^zz_prueba_([a-z]+)_(\d+)$/i.exec(String(usuario ?? ''));
  if (!m) return String(usuario ?? '');
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
