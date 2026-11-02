import { useSyncExternalStore } from 'react';

/* EL RECORRIDO DE LA PRIMERA VEZ (2 nov 2026; spec `docs/superpowers/specs/2026-11-02-home-sin-plan-recorrido.md`, maqueta https://claude.ai/artifact/6uAsYxiGLPzfVdWNw5SSxC).
   Seis pasos sobre el Home de quien no tiene plan. Aquí van los textos, las medidas y lo que se calcula sin pantalla (para poder probarlo: `scripts/prueba-recorrido-del-home.mjs`);
   la pantalla es `features/training/home/RecorridoDelHome.jsx`. Un paso es una pieza marcada con `data-recorrido="…"`. Mi perfil no sabe nada de Home: se hablan por el
   pequeño almacén de abajo.

   Textos EXACTOS del spec: no se retocan sin preguntarle a Andrés. */

/** Lo que se guarda en la cuenta (`user_app_state`) cuando ya lo vio o lo saltó: viaja con la cuenta, no se queda en el teléfono. */
export const CLAVE_RECORRIDO_VISTO = 'ui:recorrido-visto';

/**
 * Los seis pasos, en orden. `fijo`: la pieza es fija en la pantalla (la barra de abajo, el botón de la cuenta) y no hace falta mover la página.
 * `margen`: lo que el hueco abraza alrededor de la pieza; `radio`: la esquina de la pieza (el hueco lleva `radio + margen`).
 */
export const PASOS = [
  {
    id: 'registrar', fijo: true, radio: 999, margen: 8,
    titulo: 'Entrena y comparte',
    texto: () => 'Corre, ve al gym, nada: empieza aquí. Al terminar, tu entreno se vuelve un sticker para tu historia de Instagram.',
  },
  {
    id: 'explorar', fijo: true, radio: 16, margen: 4,
    titulo: 'Explora planes',
    texto: () => 'Programas hechos por coaches: tu primer Hyrox, un maratón, pilates y pesas. Elige uno y empieza.',
  },
  {
    id: 'plan', radio: 26, margen: 6,
    titulo: 'Tu plan',
    texto: ({ conCoach, nombreCoach }) => (conCoach
      ? `Aquí vas a ver lo que te toca cada día. ${nombreCoach || 'Tu coach'} te está armando tu plan; te avisamos cuando esté listo.`
      : 'Cuando tengas un plan, aquí vas a ver lo que te toca cada día. Búscalo, o pon el código de tu coach.'),
  },
  {
    id: 'semana', radio: 20, margen: 6,
    titulo: 'Tu semana',
    texto: () => 'Cada entreno que hagas se marca aquí, con su palomita.',
  },
  {
    id: 'atajos', radio: 20, margen: 6,
    titulo: 'Tus atajos',
    texto: () => 'Cómo te sientes, tu 1RM, workouts de prueba y los stickers de cada entreno.',
  },
  {
    id: 'perfil', fijo: true, radio: 16, margen: 5,
    titulo: 'Tu perfil',
    texto: () => 'Tus datos, tu coach, tu Apple Watch y Apple Salud, y tus ajustes. Aquí también puedes volver a ver este recorrido.',
  },
];

const entre = (n, min, max) => Math.min(Math.max(n, min), max);

/**
 * Dónde va el globo. `hueco` {x, y, w, h}: el hueco sobre la pieza, ya con su margen. `alto`: lo que mide el globo. `pantalla` {w, h, arriba, abajo}: el tamaño de la pantalla y lo
 * que tapan la hora y la barra de inicio del iPhone. Va DEBAJO del hueco si cabe; si no, arriba; si ni así cabe, del lado con más espacio y sin salirse de la pantalla.
 * La flechita (`flecha`, su centro medido desde la izquierda del globo) apunta al centro de la pieza, sin pegarse a las esquinas redondas del globo.
 */
export function colocaElGlobo({ hueco, alto, pantalla, ancho = 380, separacion = 14, margen = 16 }) {
  const anchoGlobo = Math.min(ancho, pantalla.w - margen * 2);
  const centro = hueco.x + hueco.w / 2;
  const left = entre(centro - anchoGlobo / 2, margen, pantalla.w - margen - anchoGlobo);
  const tope = pantalla.arriba + margen;
  const fondo = pantalla.h - pantalla.abajo - margen;
  const espacioAbajo = fondo - (hueco.y + hueco.h + separacion);
  const espacioArriba = hueco.y - separacion - tope;
  const abajo = alto <= espacioAbajo || (alto > espacioArriba && espacioAbajo >= espacioArriba);
  const ideal = abajo ? hueco.y + hueco.h + separacion : hueco.y - separacion - alto;
  return { left, top: entre(ideal, tope, Math.max(tope, fondo - alto)), ancho: anchoGlobo, abajo, flecha: entre(centro - left, 28, anchoGlobo - 28) };
}

/**
 * Cuánto hay que bajar (o subir) la página para ver una pieza que no es fija: 0 si ya se ve entera y el globo cabe junto a ella; si no, lo que falta para dejarla justo debajo
 * del botón de la cuenta, que es donde más espacio le queda al globo. `rect` {top, bottom}; `limites` {arriba, abajo}: la franja libre entre el botón de la cuenta y la barra de abajo.
 */
export function desplazamientoParaVer({ rect, alto, pantalla, limites, separacion = 14, margen = 16 }) {
  const seVe = rect.top >= limites.arriba && rect.bottom <= limites.abajo;
  const tope = pantalla.arriba + margen;
  const fondo = pantalla.h - pantalla.abajo - margen;
  const cabe = alto <= fondo - (rect.bottom + separacion) || alto <= rect.top - separacion - tope;
  if (seVe && cabe) return 0;
  return Math.round(rect.top - limites.arriba);
}

/** La imagen con la que el velo se recorta: todo negro (se ve el velo) menos el hueco (se ve la app). Esquinas redondas de `radio`. Va en `mask-image`. */
export function mascaraDelHueco(ancho, alto, { x, y, w, h }, radio) {
  const r = Math.max(0, Math.min(radio, w / 2, h / 2));
  const hueco = `M${x + r},${y} H${x + w - r} A${r},${r} 0 0 1 ${x + w},${y + r} V${y + h - r} A${r},${r} 0 0 1 ${x + w - r},${y + h} H${x + r} A${r},${r} 0 0 1 ${x},${y + h - r} V${y + r} A${r},${r} 0 0 1 ${x + r},${y} Z`;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${ancho}' height='${alto}'><path fill-rule='evenodd' fill='black' d='M0,0 H${ancho} V${alto} H0 Z ${hueco}'/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/* EL ALMACÉN CHICO (Mi perfil ↔ Home, y el botón de la cuenta ↔ el recorrido):
     · `abierto`: el recorrido está a la vista. El botón de la cuenta, que se esconde al bajar la página, se queda a la vista mientras tanto (es el paso 6).
     · `disponible`: hay un Home sin plan donde enseñarlo. Solo entonces Mi perfil ofrece «Ver el recorrido».
     · `pendiente`: Mi perfil lo pidió; el Home sin plan lo toma (`tomaElPedido`) cuando está a la vista, y entonces empieza desde el paso 1. */
const estado = { abierto: false, disponible: false, pendiente: false };
const oyentes = new Set();
const cambia = (parche) => {
  if (Object.keys(parche).every((k) => estado[k] === parche[k])) return;
  Object.assign(estado, parche);
  oyentes.forEach((f) => f());
};
const suscribe = (f) => { oyentes.add(f); return () => oyentes.delete(f); };
const lee = (campo) => () => estado[campo];

export const ponRecorridoAbierto = (v) => cambia({ abierto: v });
export const ponRecorridoDisponible = (v) => cambia(v ? { disponible: true } : { disponible: false, pendiente: false });
export const pideElRecorrido = () => { if (estado.disponible) cambia({ pendiente: true }); };
export const tomaElPedido = () => cambia({ pendiente: false });

export const useRecorridoAbierto = () => useSyncExternalStore(suscribe, lee('abierto'), () => false);
export const useRecorridoDisponible = () => useSyncExternalStore(suscribe, lee('disponible'), () => false);
export const useRecorridoPendiente = () => useSyncExternalStore(suscribe, lee('pendiente'), () => false);
