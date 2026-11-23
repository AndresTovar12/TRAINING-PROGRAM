/* LOS RECORRIDOS DEL EDITOR (9-10 nov 2026). Andrés: el aviso «Un Set también puede ser AMRAP, EMOM…» no le servía; en su lugar, recorridos con el
   mismo look del de Home (`components/RecorridoGuiado.jsx`). Luego: «¿eso es todo? ¿qué pasa si voy a Mis planes, crear plan, un workout…?».
   Por eso hay un recorrido POR PANTALLA, que sale solo la primera vez que el coach la abre:
     · `wizard`: «Varias semanas que avanzan», antes de crear la estructura (cuántas semanas, qué días).
     · `plan`: el editor de un plan (rutina, semanas o fases; cada forma cuenta aparte porque enseña piezas distintas).
     · `workout` / `clase`: el editor de un workout o una clase de Mis planes.
   Y uno de LOS EJERCICIOS (formato del Set, unidad y carga), que sale la primera vez que hay un Set, en cualquier editor; si la pantalla ya tiene Sets
   la primera vez, va dentro de su recorrido. Un paso cuya pieza no está en pantalla se salta. Se vuelven a ver desde «Más» (plan), «Opciones» de la
   sesión (teléfono) o la brújula (workout). Lo visto se guarda en la cuenta (`ui:avisos-vistos`, ver `useAvisosVistos`). */

/* Pedirlo desde un menú que no conoce al editor (el «Opciones» de la sesión en el teléfono): un aviso del navegador que el editor abierto escucha. */
const PEDIDO = 'tl:ver-recorrido-del-editor';
export const pideElRecorridoDelEditor = () => window.dispatchEvent(new Event(PEDIDO));
export const alPedirElRecorrido = (fn) => { window.addEventListener(PEDIDO, fn); return () => window.removeEventListener(PEDIDO, fn); };

export const CLAVE_EJERCICIOS = 'recorrido:ejercicios';

const porEtiqueta = (texto) => document.querySelector(`[aria-label^="${texto}"]`);
const botonQueDice = (texto) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === texto && b.offsetParent);
// La caja más chica que tiene a las dos piezas (la unidad y el peso de una línea; los botones de las semanas…).
const cajaCon = (a, b) => {
  let n = porEtiqueta(a);
  while (n && !n.querySelector(`[aria-label^="${b}"]`)) n = n.parentElement;
  return n;
};
const volverAVer = ({ comoVolver }) => (comoVolver ? ` Para ver este recorrido otra vez: ${comoVolver}.` : '');

const PASOS = {
  guia: {
    id: 'guia', fijo: true, radio: 20, margen: 2,
    titulo: ({ estructura }) => (estructura === 'rutina' ? 'Tu semana' : 'Tu plan'),
    texto: ({ estructura }) => (estructura === 'rutina'
      ? 'Cada día de la semana. Toca uno para armar su sesión.'
      : 'Las semanas y los días del plan. Toca un día para armar su sesión.'),
  },
  programa: {
    id: 'programa', radio: 12, margen: 4, buscar: () => porEtiqueta('Opciones del programa'),
    titulo: 'El plan completo',
    texto: () => 'Su forma (rutina, semanas o fases), usar uno de Mis planes o guardar este. En «Más»: la foto del plan y este recorrido.',
  },
  fase: {
    id: 'fase', radio: 12, margen: 4, buscar: () => cajaCon('Color y foto de la fase', 'Nombre de la fase'),
    titulo: 'Fase',
    texto: () => 'Un bloque del plan con su propio objetivo. Toca el nombre para cambiarlo, y el color para su color y su foto.',
  },
  semanas: {
    id: 'semanas', radio: 12, margen: 4, buscar: () => cajaCon('Agregar semana', 'Semana '),
    titulo: 'Semanas',
    texto: ({ estructura }) => `Las semanas ${estructura === 'fases' ? 'de esta fase' : 'del plan'}. Toca una para editarla, o + para agregar otra.`,
  },
  'opciones-semana': {
    id: 'opciones-semana', radio: 999, margen: 4, buscar: () => porEtiqueta('Opciones de la semana'),
    titulo: 'Opciones de la semana',
    texto: () => 'Duplicarla, copiarla a todas las semanas, usar una de Mis planes o guardarla.',
  },
  'agregar-fase': {
    id: 'agregar-fase', radio: 14, margen: 4, buscar: () => botonQueDice('Agregar fase'),
    titulo: 'Agregar fase',
    texto: () => 'Suma otro bloque al plan.',
  },
  'nombre-workout': {
    id: 'nombre-workout', radio: 12, margen: 5,
    titulo: ({ esClase }) => (esClase ? 'Nombre de la clase' : 'Nombre del workout'),
    texto: () => 'Así lo vas a encontrar en Mis planes.',
  },
  disciplina: {
    id: 'disciplina', radio: 9, margen: 5, buscar: () => porEtiqueta('Disciplina de la sesión'),
    titulo: 'Disciplina',
    texto: () => 'Qué entreno es: Gym, Híbrido, Running… Los Sets nuevos nacen a su modo y te enseña primero lo que más se usa. Lo que ya armaste no cambia.',
  },
  etiqueta: {
    id: 'etiqueta', radio: 11, margen: 5,
    titulo: 'Etiqueta',
    texto: () => 'Tu etiqueta, con tu color, para ordenar tus sesiones. Tú las creas y las borras. No cambia nada del editor.',
  },
  formato: {
    id: 'formato', radio: 999, margen: 5, buscar: () => porEtiqueta('Formato del set'),
    titulo: 'Formato del Set',
    texto: () => 'Toca aquí para cambiarlo: AMRAP, EMOM, Tabata, Fartlek, Por tiempo, Intervalos de cardio, Lapsos personalizados y más.',
  },
  linea: {
    id: 'linea', radio: 12, margen: 6, buscar: () => cajaCon('Unidad', 'Peso o intensidad'),
    titulo: 'Cada ejercicio',
    texto: () => 'Toca los rótulos azules para cambiar la unidad (reps, km, min…) y el peso o intensidad. Lo que dice la ficha del ejercicio ya viene puesto.',
  },
  'agregar-clase': {
    id: 'agregar-clase', radio: 999, margen: 4, buscar: () => botonQueDice('Agregar clase') ?? botonQueDice('Clase'),
    titulo: 'Clase',
    texto: () => 'Agrega a esta sesión el video de una clase para que el atleta la siga.',
  },
  'agregar-set': {
    id: 'agregar-set', radio: 16, margen: 5,
    titulo: 'Agregar set',
    texto: ({ conEjercicios }) => (conEjercicios
      ? 'Elige ejercicios del repertorio. Si eliges varios, van juntos en el mismo Set.'
      : 'Elige ejercicios del repertorio. Si eliges varios, van juntos en el mismo Set. Cuando tengas uno, te enseño cómo se llena.'),
  },
  'agregar-sesion': {
    id: 'agregar-sesion', radio: 12, margen: 5,
    titulo: 'Agregar sesión',
    texto: () => 'Arma aquí la sesión de este día.',
  },
  'otra-sesion': {
    id: 'otra-sesion', radio: 14, margen: 4,
    titulo: 'Agregar otra sesión',
    texto: () => 'Para un día con mañana y tarde: cada sesión con sus propios Sets.',
  },
  'mis-planes': {
    id: 'mis-planes', radio: 999, margen: 5,
    titulo: 'Mis planes',
    texto: () => 'Usa un workout que ya guardaste, o guarda este para otra vez.',
  },
  guardar: {
    id: 'guardar', fijo: true, radio: 12, margen: 4,
    titulo: 'Guardar',
    texto: (c) => `${c.enCatalogo ? 'Tus cambios quedan' : 'Tu atleta ve los cambios'} cuando tocas Guardar.${volverAVer(c)}`,
  },
  'wiz-semanas': {
    id: 'wiz-semanas', radio: 12, margen: 6,
    titulo: '¿Cuántas semanas?',
    texto: () => 'Lo que dura el programa. Después puedes agregar o quitar semanas.',
  },
  'wiz-dias': {
    id: 'wiz-dias', radio: 12, margen: 6,
    titulo: '¿Qué días?',
    texto: () => 'Los días que entrena. Cada uno tendrá su sesión.',
  },
  'wiz-crear': {
    id: 'wiz-crear', radio: 14, margen: 5,
    titulo: 'Crear estructura',
    texto: () => 'Arma las semanas vacías. Llenas la semana 1 y la copias al resto con un botón.',
  },
};

const lista = (ids) => ids.map((id) => PASOS[id]);
const DE_EJERCICIOS = ['formato', 'linea'];

/** Las pantallas: su llave de «ya lo vio» y sus pasos, en orden. Los de los ejercicios entran después de «Etiqueta». */
export const PANTALLAS = {
  wizard: { ids: ['wiz-semanas', 'wiz-dias', 'wiz-crear'] },
  plan: { ids: ['guia', 'programa', 'fase', 'semanas', 'opciones-semana', 'agregar-fase', 'disciplina', 'etiqueta', 'agregar-sesion', 'agregar-set', 'mis-planes', 'guardar'] },
  workout: { ids: ['nombre-workout', 'disciplina', 'etiqueta', 'agregar-clase', 'agregar-set', 'otra-sesion', 'guardar'] },
};
export const claveDe = (pantalla, variante) => `recorrido:${pantalla}${variante ? `:${variante}` : ''}`;

/** Los pasos de un recorrido: los de la pantalla (si toca), con los de los ejercicios metidos después de «Etiqueta» (si tocan). */
export function pasosDe(pantalla, { conPantalla = true, conEjercicios = false } = {}) {
  const base = conPantalla ? PANTALLAS[pantalla].ids : [];
  if (!conEjercicios) return lista(base);
  if (!base.length) return lista(DE_EJERCICIOS);
  const i = base.indexOf('etiqueta');
  const ids = i >= 0 ? [...base.slice(0, i + 1), ...DE_EJERCICIOS, ...base.slice(i + 1)] : [...DE_EJERCICIOS, ...base];
  return lista(ids);
}
