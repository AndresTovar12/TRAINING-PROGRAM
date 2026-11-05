/* LO QUE ESTE APARATO ACABA DE GUARDAR EN `plans` (5 nov 2026). Puro, sin red ni plugins: lo usan `lib/api.js` al guardar y `lib/planesEnVivo.js` al recibir un
   cambio en vivo, para no tomar por «cambió en otro lado» lo que guardó este mismo aparato. */

/**
 * Un `updated_at` en milisegundos, venga como venga: PostgREST lo da en ISO («2026-11-05T22:10:11.123456+00:00») y Realtime a veces como lo escribe
 * Postgres («2026-11-05 22:10:11.123456+00»), que Safari no sabe leer con `Date.parse`. `null` si no se entiende.
 */
export function instante(s) {
  if (!s) return null;
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(?:\.(\d+))?(Z|[+-]\d{2}(?::?\d{2})?)?$/.exec(String(s).trim());
  if (!m) {
    const t = Date.parse(s);
    return Number.isNaN(t) ? null : t;
  }
  const fraccion = (m[3] ?? '').padEnd(3, '0').slice(0, 3);
  let zona = m[4] ?? 'Z';
  if (/^[+-]\d{2}$/.test(zona)) zona += ':00';
  else if (/^[+-]\d{4}$/.test(zona)) zona = `${zona.slice(0, 3)}:${zona.slice(3)}`;
  const t = Date.parse(`${m[1]}T${m[2]}.${fraccion}${zona}`);
  return Number.isNaN(t) ? null : t;
}

/** ¿Es la misma hora? (al milisegundo). */
export const mismoInstante = (a, b) => {
  const x = instante(a);
  return x !== null && x === instante(b);
};

const escritos = new Map(); // id del plan → las últimas horas (ms) que escribió este aparato

/** Este aparato acaba de guardar esta fila de `plans` (la que devolvió la base). */
export function anotaLoQueEscribi(fila) {
  const t = instante(fila?.updated_at);
  if (!fila?.id || t === null) return;
  escritos.set(fila.id, [...(escritos.get(fila.id) ?? []), t].slice(-10));
}

/** ¿Esta versión de la fila la escribió este aparato? */
export function loEscribiYo(fila) {
  const t = instante(fila?.updated_at);
  return t !== null && (escritos.get(fila?.id) ?? []).includes(t);
}

