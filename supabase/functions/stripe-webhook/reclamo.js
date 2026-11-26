/* RECLAMAR UNA COMPRA (encargo «Compra y dinero», 26 nov 2026), lo puro. Copia idéntica en `supabase/functions/compra-lista/` (la vigila `scripts/compartir-con-mcp.mjs`).

   Quien paga en la web ya NO recibe una cuenta hecha con su correo. La compra pagada queda apartada, sin dueño, hasta que una cuenta (Apple, Google o usuario y contraseña)
   la reclama UNA vez. Solo se reclama con una llave: la del pago (`cs_…`, en la liga a la que regresa Stripe) o la de la liga del correo «Crear mi cuenta». Las dos duran 48 horas;
   vencida, «Mandarme otra liga» la manda otra vez, solo al correo del pago. Antes de pagar nunca se revela si un correo tiene cuenta. */

export const VIGENCIA_MS = 48 * 3600 * 1000;

export const MENSAJES = {
  ya_usada: 'Esta compra ya tiene cuenta. Entra con ella.',
  vencida: 'Esta liga ya venció.',
  no_pagada: 'Tu pago todavía se está confirmando. Espera unos segundos.',
  no_atleta: 'Para entrar a tu plan necesitas una cuenta de atleta.',
  desconocida: 'No encontramos esta compra.',
  correo_ocupado: 'Ese correo ya tiene cuenta. Entra con ella y tu compra se guarda ahí.',
};

/**
 * ¿Esta cuenta puede reclamar esta compra con esta llave? `via`: 'pago' (llave cs_) o 'correo'. `rol`: el de la cuenta que reclama.
 * Devuelve `{ ok: true }`, `{ ok: true, yaEsTuya: true }` (la reclamó esta misma cuenta: no pasa nada) o `{ ok: false, motivo }` (llave de `MENSAJES`).
 * @param {any} compra
 * @param {{ usuarioId?: string | null, rol?: string, via?: string, ahora?: number }} [opciones]
 * @returns {{ ok: boolean, yaEsTuya?: boolean, motivo?: string }}
 */
export function puedeReclamar(compra, { usuarioId = null, rol = 'user', via = 'pago', ahora = Date.now() } = {}) {
  if (!compra) return { ok: false, motivo: 'desconocida' };
  if (compra.atleta_id) return compra.atleta_id === usuarioId ? { ok: true, yaEsTuya: true } : { ok: false, motivo: 'ya_usada' };
  if (!compra.pagada_en) return { ok: false, motivo: 'no_pagada' };
  const vence = via === 'correo' ? new Date(compra.llave_correo_vence ?? 0).getTime() : new Date(compra.pagada_en).getTime() + VIGENCIA_MS;
  if (!(vence > ahora)) return { ok: false, motivo: 'vencida' };
  if (rol !== 'user') return { ok: false, motivo: 'no_atleta' };
  return { ok: true };
}

/** La llave de la liga del correo: 32 bytes al azar en hexadecimal. En la base solo se guarda su sha-256 (`hashDeLlave`). */
export function llaveNueva() {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}
export async function hashDeLlave(llave) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(llave)));
  return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

/* «¿Quisiste decir gmail.com?»: los dominios más usados en México y sus errores comunes. */
const DOMINIOS = ['gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com', 'icloud.com', 'live.com.mx', 'hotmail.es', 'yahoo.com.mx', 'outlook.es', 'me.com', 'prodigy.net.mx'];
function distancia(a, b) {
  const m = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j += 1) m[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) m[i][j] = Math.min(m[i][j], m[i - 2][j - 2] + 1);
    }
  }
  return m[a.length][b.length];
}
/** Si el dominio parece mal escrito, el dominio bueno («gmail.com»); si no, null. */
export function sugerenciaDeCorreo(correo) {
  const t = String(correo ?? '').trim().toLowerCase();
  const i = t.lastIndexOf('@');
  if (i < 1) return null;
  const dominio = t.slice(i + 1);
  if (!dominio || DOMINIOS.includes(dominio)) return null;
  let mejor = null;
  let menor = Infinity;
  for (const d of DOMINIOS) {
    const x = distancia(dominio, d);
    if (x < menor) { menor = x; mejor = d; }
  }
  return menor > 0 && menor <= 2 ? mejor : null;
}
