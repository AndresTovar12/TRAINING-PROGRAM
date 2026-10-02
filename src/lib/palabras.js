/* Las palabras de cada oficio.

   Andrés, 29 sep 2026: un fisio real le dijo que le urge la app, y quería
   «detallitos» para que se dé cuenta de que se pensó en él: que diga
   «pacientes» y no «atletas», «programa de ejercicios» y no «plan de
   entrenamiento». Es la misma app con las mismas pantallas: solo cambia lo que
   dicen. Para cualquier otro oficio `traduce` devuelve el texto tal cual, así
   que nada cambia para nadie más.

   REGLA: solo se traducen textos FIJOS de la interfaz. Nunca un texto que
   escribió una persona (el título de un plan, el nombre de un ejercicio):
   «Plan de Laura» debe seguir siendo «Plan de Laura». */

const sinAcentos = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');

/** ¿Este oficio es de salud? «Fisioterapeuta», «Fisioterapeuta deportivo», «fisio»… */
export const esDeSalud = (profesion) => /fisio/i.test(sinAcentos(profesion));

// Frases enteras primero: mandan sobre las palabras sueltas.
const FRASES = [
  ['Plan de entrenamiento', 'Programa de ejercicios'],
  ['plan de entrenamiento', 'programa de ejercicios'],
  ['Entrenador (Admin)', 'Fisioterapeuta'],
  ['días de entrenamiento', 'días con ejercicios'],
  ['día de entrenamiento', 'día con ejercicios'],
  ['siguiente entrenamiento', 'siguiente sesión'],
  ['Sin entrenamientos', 'Sin sesiones'],
  ['hay entrenamientos', 'hay sesiones'],
];

const PALABRAS = [
  ['atletas', 'pacientes'], ['atleta', 'paciente'],
  ['clientes', 'pacientes'], ['cliente', 'paciente'],
  ['planes', 'programas'], ['plan', 'programa'],
  ['entrenadores', 'fisios'], ['entrenador', 'fisio'],
  ['coaches', 'fisios'], ['coach', 'fisio'],
];

// Conserva la mayúscula: «Atletas» → «Pacientes», «atletas» → «pacientes».
const comoEl = (original, nuevo) => (
  original[0] !== original[0].toLowerCase()
    ? nuevo[0].toUpperCase() + nuevo.slice(1)
    : nuevo
);

/* Nombres propios que NO cambian de oficio. «Mis planes» se llama así para todos: para un fisio,
   «programas» ya es una de las clases de cosas que se guardan ahí (workouts, rutinas y programas),
   y «Mis programas» se confundiría con ella. */
const PROTEGIDOS = /(Mis planes)/;

function traduceTrozo(texto) {
  let t = texto;
  for (const [de, a] of FRASES) t = t.split(de).join(a);
  for (const [de, a] of PALABRAS) {
    t = t.replace(new RegExp(`\\b${de}\\b`, 'gi'), (m) => comoEl(m, a));
  }
  return t;
}

/** El texto con las palabras del oficio. `salud` = quien atiende es de salud. */
export function traduce(texto, salud) {
  if (!salud || typeof texto !== 'string') return texto;
  // Con el separador entre paréntesis, `split` deja lo protegido en las posiciones impares.
  return texto.split(PROTEGIDOS).map((trozo, i) => (i % 2 ? trozo : traduceTrozo(trozo))).join('');
}
