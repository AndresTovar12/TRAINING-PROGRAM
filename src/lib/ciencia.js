/**
 * La CIENCIA de un plan: los recuadros que explican por qué está armado así.
 *
 * Andrés, 7 oct 2026: «lo que dice en Ciencia es únicamente para Andrés Tovar y el plan que creamos en esa
 * cuenta: no se supone que todos los planes estén basados en ese mismo marco científico». Hasta entonces la
 * pestaña era texto fijo en el código. Ahora la ciencia es DATO de cada plan.
 *
 * Un RECUADRO es `{ id, titulo, texto }`. Vive en dos sitios del plan:
 *   - `plans.data.ciencia`     → los de TODO el plan;
 *   - `fase.ciencia`           → los de UNA fase (viajan con ella: se copia, se mueve y se borra con la fase).
 *
 * El TEXTO es de una línea por renglón, con un formato mínimo que también sabe escribir una IA:
 *   Un párrafo, y otro después de una línea en blanco.
 *   - Una viñeta (cada renglón que empieza con «- »)
 *   ## Un subtítulo corto
 *   Velocidad | ~5 días | Exposición frecuente todo el año.     ← una tabla: nombre | valor | nota (la nota es opcional)
 */

const rid = () => (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)).slice(0, 8);

const MAX_TITULO = 120;
const MAX_TEXTO = 8000;

const texto = (v, tope) => (typeof v === 'string' ? v.replace(/\r\n?/g, '\n').trim().slice(0, tope) : '');

/** Un recuadro, con su id. Sin título ni texto no hay recuadro (devuelve null). */
export function nuevoRecuadro({ titulo = '', texto: cuerpo = '', id } = {}) {
  const t = texto(titulo, MAX_TITULO);
  const c = texto(cuerpo, MAX_TEXTO);
  if (!t && !c) return null;
  return { id: id || `c-${rid()}`, titulo: t, texto: c };
}

/** Lo que llegue en `ciencia` (de la base, de la IA, de una copia vieja) → una lista limpia de recuadros. */
export function normalizaCiencia(lista) {
  if (!Array.isArray(lista)) return [];
  const vistos = new Set();
  const salida = [];
  for (const r of lista) {
    if (!r || typeof r !== 'object') continue;
    const n = nuevoRecuadro({ titulo: r.titulo, texto: r.texto, id: typeof r.id === 'string' ? r.id : undefined });
    if (!n) continue;
    // Dos recuadros con el mismo id (una copia mal hecha) se separan: el id es lo que usa el editor para saber cuál es cuál.
    if (vistos.has(n.id)) n.id = `c-${rid()}`;
    vistos.add(n.id);
    salida.push(n);
  }
  return salida;
}

/** ¿Este plan tiene algo de ciencia que enseñar? (la del plan o la de cualquiera de sus fases) */
export function hayCiencia(ciencia, fases) {
  return normalizaCiencia(ciencia).length > 0 || (fases ?? []).some((f) => normalizaCiencia(f?.ciencia).length > 0);
}

/** Cuántos recuadros tiene el plan en total (para «Ciencia · 3» en el editor). */
export function cuantosRecuadros(ciencia, fases) {
  return normalizaCiencia(ciencia).length + (fases ?? []).reduce((n, f) => n + normalizaCiencia(f?.ciencia).length, 0);
}

/**
 * El texto de un recuadro, partido en bloques que se pintan:
 *   { tipo: 'parrafo', texto } · { tipo: 'lista', items: [] } · { tipo: 'subtitulo', texto }
 *   · { tipo: 'tabla', filas: [{ nombre, valor, nota }] }
 */
export function bloquesDeTexto(cuerpo) {
  const bloques = [];
  let actual = null;
  const cierra = () => { if (actual) { bloques.push(actual); actual = null; } };
  const esViñeta = (l) => /^[-•*]\s+/.test(l);
  const esFila = (l) => l.includes(' | ');
  for (const cruda of String(cuerpo ?? '').replace(/\r\n?/g, '\n').split('\n')) {
    const l = cruda.trim();
    if (!l) { cierra(); continue; }
    if (l.startsWith('## ')) { cierra(); bloques.push({ tipo: 'subtitulo', texto: l.slice(3).trim() }); continue; }
    if (esViñeta(l)) {
      if (actual?.tipo !== 'lista') { cierra(); actual = { tipo: 'lista', items: [] }; }
      actual.items.push(l.replace(/^[-•*]\s+/, ''));
      continue;
    }
    if (esFila(l)) {
      if (actual?.tipo !== 'tabla') { cierra(); actual = { tipo: 'tabla', filas: [] }; }
      const [nombre, valor, ...resto] = l.split(' | ').map((x) => x.trim());
      actual.filas.push({ nombre, valor: valor ?? '', nota: resto.join(' | ') });
      continue;
    }
    if (actual?.tipo !== 'parrafo') { cierra(); actual = { tipo: 'parrafo', texto: l }; } else actual.texto += `\n${l}`;
  }
  cierra();
  return bloques;
}
