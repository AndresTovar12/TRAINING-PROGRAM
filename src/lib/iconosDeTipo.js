/* Los ÍCONOS de los tipos de sesión: encontrar uno por el nombre que se le puso al tipo, buscar en el catálogo y cargarlo solo cuando hace falta.

   Andrés, 9 oct 2026: «los íconos están ligados a formas geométricas que tú le asignaste a los tipos» y «tiene que haber muchos íconos porque es una app
   para TODOS». Los 14 tipos de la app llevan sus íconos de lucide (`lib/aspectoDelTipo.js`); los que crea cada coach eligen uno del catálogo
   (`lib/iconosDeTipo.datos.js`, ~250 íconos), y viaja DENTRO del día del plan igual que el nombre y el color (`catIcono`).

   POR QUÉ EL CATÁLOGO SE CARGA APARTE. Son ~90 KB de dibujos que casi nadie necesita en el primer segundo: solo quien ve un tipo propio o abre «Tipo
   nuevo». `import()` hace que Vite lo parta del paquete principal; mientras baja (o si no hay red) se dibuja la etiqueta neutra, que es el mismo dibujo
   que el ícono «Etiqueta» del catálogo: no hay salto al cargar.

   Este archivo no importa nada de la app (ni `@/`): lo cargan tal cual las pruebas de Node (`scripts/prueba-iconos-de-tipo.mjs`). */

/** Minúsculas y sin acentos: «Natación» y «natacion» son la misma palabra. */
export const normaliza = (texto) => String(texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** El ícono de quien no tiene otro: una etiqueta. */
export const ICONO_NEUTRO = 'etiqueta';

// Palabras que no dicen nada del deporte: sin esto «Terapia de hombro» encontraba «Destellos» (empieza con «de»).
const SOBRAN = new Set([
  'de', 'la', 'el', 'en', 'al', 'lo', 'un', 'se', 'su', 'mi', 'tu', 'es', 'ya', 'no', 'ni', 'si', 'me', 'te',
  'del', 'las', 'los', 'con', 'sin', 'por', 'para', 'una', 'uno', 'unos', 'unas', 'mis', 'tus', 'sus', 'que', 'como', 'the', 'and',
]);

const palabrasDe = (texto) => normaliza(texto).split(/[^a-z0-9]+/).filter((p) => p.length >= 2 && !SOBRAN.has(p));

/* ------------------------------------------------------------------ */
/* El catálogo                                                         */
/* ------------------------------------------------------------------ */

/** El catálogo listo para buscar: cada ícono con su nombre normalizado y sus palabras ya separadas. */
export function armaCatalogo({ CATEGORIAS, ICONOS }) {
  const iconos = ICONOS.map((ic) => ({ ...ic, nombreNorm: normaliza(ic.nombre), claves: ic.palabras.split(' ').filter(Boolean) }));
  return { categorias: CATEGORIAS.map(([id, nombre]) => ({ id, nombre })), iconos, porId: new Map(iconos.map((ic) => [ic.id, ic])) };
}

let catalogo = null;
let promesa = null;
const oyentes = new Set();

/** El catálogo si ya bajó, o `null`. Es lo que lee `useSyncExternalStore`. */
export const catalogoCargado = () => catalogo;

/** Pide el catálogo (una sola vez; si falla por la red, la próxima vez vuelve a intentar). */
export function cargaCatalogo() {
  if (!promesa) {
    promesa = import('./iconosDeTipo.datos.js').then((datos) => {
      catalogo = armaCatalogo(datos);
      oyentes.forEach((avisa) => avisa());
      return catalogo;
    }).catch((error) => {
      promesa = null;
      throw error;
    });
  }
  return promesa;
}

/** Para `useSyncExternalStore`: avisa cuando llega el catálogo y, al primero que se asoma, lo pide. */
export function suscribeCatalogo(avisa) {
  oyentes.add(avisa);
  if (!catalogo) cargaCatalogo().catch(() => { /* sin red: se queda la etiqueta, y se reintenta en la próxima pantalla */ });
  return () => { oyentes.delete(avisa); };
}

/* ------------------------------------------------------------------ */
/* Buscar                                                              */
/* ------------------------------------------------------------------ */

/* Cuánto pesa cada coincidencia entre una palabra de lo escrito y un ícono. Lo más importante de un ícono va PRIMERO en sus `palabras`, así que
   una coincidencia en la primera pesa más que en la última. */
function puntosDe(ic, palabras) {
  let puntos = 0;
  for (const w of palabras) {
    if (ic.nombreNorm === w) puntos += 10;
    else if (ic.nombreNorm.startsWith(w)) puntos += 6;
    else {
      const i = ic.claves.indexOf(w);
      if (i > -1) puntos += 4 + Math.max(0, 3 - i);
      // La raíz: «estiramientos» encuentra «estirar», «nutricional» encuentra «nutricion».
      else if (w.length >= 5 && ic.claves.some((k) => k.length >= 5 && k.startsWith(w.slice(0, 5)))) puntos += 3;
      else if (w.length > 3 && ic.palabras.includes(w)) puntos += 2;
    }
  }
  return puntos;
}

// Con menos que esto no se sugiere nada: mejor la etiqueta que un dibujo que no tiene que ver.
const MINIMO_PARA_SUGERIR = 3;

/**
 * El id del ícono que mejor le va a un nombre («Boxeo» → boxeo, «Tenis de mesa» → pingpong), o `null` si nada se parece.
 * Es lo que se propone mientras alguien escribe el nombre de un tipo nuevo, y lo que se pinta en un tipo viejo que nunca tuvo ícono.
 */
export function sugiereIcono(cat, nombre) {
  const palabras = palabrasDe(nombre);
  if (!cat || palabras.length === 0) return null;
  let mejor = null;
  let maximo = 0;
  for (const ic of cat.iconos) {
    const puntos = puntosDe(ic, palabras);
    if (puntos > maximo) { maximo = puntos; mejor = ic.id; }
  }
  return maximo >= MINIMO_PARA_SUGERIR ? mejor : null;
}

/**
 * Los íconos que se enseñan en la rejilla: los de una categoría (`'todos'` = todos) que contienen CADA palabra buscada, los más parecidos primero.
 * Sin búsqueda, el orden del catálogo (el que se pensó para cada categoría).
 */
export function buscaIconos(cat, texto = '', categoria = 'todos') {
  if (!cat) return [];
  const delGrupo = categoria === 'todos' ? cat.iconos : cat.iconos.filter((ic) => ic.cat === categoria);
  const buscadas = normaliza(texto).split(/\s+/).filter(Boolean);
  if (buscadas.length === 0) return delGrupo;
  const palabras = palabrasDe(texto);
  return delGrupo
    .filter((ic) => buscadas.every((w) => ic.palabras.includes(w) || ic.nombreNorm.includes(w)))
    .map((ic, orden) => ({ ic, orden, puntos: puntosDe(ic, palabras) }))
    .sort((a, b) => b.puntos - a.puntos || a.orden - b.orden)
    .map(({ ic }) => ic);
}
