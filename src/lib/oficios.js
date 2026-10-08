/**
 * A qué se dedica quien crea planes, y qué entrena.
 *
 * Son dos preguntas distintas (Andrés, 8 oct 2026): «entrenador personal» es QUÉ ERES y «running» es QUÉ ENTRENAS. Un
 * entrenador personal puede entrenar running y fuerza. Por eso no van en la misma lista.
 *
 * El oficio decide las palabras de la app (un fisio tiene «pacientes», un instructor «alumnos») y, para el fisio, sus 5
 * categorías semilla (disparador `sembrar_categorias_de_fisio`). Las disciplinas ORDENAN lo que sale primero (qué se le
 * propone al agregar un ejercicio, qué tipos de sesión, con qué ejercicios empieza) y NUNCA esconden nada: Andrés, 8 oct
 * 2026, «puede haber gente que de repente le dé por hacer otras disciplinas y no les vas a poder brindar todas las opciones».
 */

export const OFICIOS = [
  'Entrenador personal',
  'Coach deportivo',
  'Instructor (yoga, pilates, spinning…)',
  'Fisioterapeuta',
  'Preparador físico',
];

/** El mismo oficio con una línea de más para la lista del inicio. */
export const OFICIOS_DEL_INICIO = [
  { valor: 'Entrenador personal', icono: 'barra' },
  { valor: 'Coach deportivo', icono: 'trofeo' },
  { valor: 'Instructor (yoga, pilates, spinning…)', titulo: 'Instructor', detalle: 'Yoga, pilates, spinning…', foto: 'yoga' },
  { valor: 'Fisioterapeuta', icono: 'pulso' },
  { valor: 'Preparador físico', icono: 'actividad' },
];

export const DISCIPLINAS = [
  { id: 'fuerza', nombre: 'Fuerza / gym', foto: 'fuerza' },
  { id: 'running', nombre: 'Running', foto: 'pista' },
  { id: 'ciclismo', nombre: 'Ciclismo', icono: 'bici', color: '#00B3C7' },
  { id: 'natacion', nombre: 'Natación', icono: 'olas', color: '#3AA0F5' },
  { id: 'triatlon', nombre: 'Triatlón', icono: 'medalla', color: '#E07B00' },
  { id: 'hyrox', nombre: 'Hyrox', icono: 'flama', color: '#F2555A' },
  { id: 'hibrido', nombre: 'Híbrido', detalle: 'Fuerza + cardio', icono: 'actividad', color: '#1E40E0' },
  { id: 'pilates', nombre: 'Pilates', icono: 'persona', color: '#EC7FB0' },
  { id: 'yoga', nombre: 'Yoga', foto: 'yoga' },
  { id: 'spinning', nombre: 'Spinning', icono: 'bici', color: '#A480FF' },
  { id: 'deportes', nombre: 'Deportes', detalle: 'Fútbol, atletismo, lanzamientos, tenis…', foto: 'agilidad' },
  { id: 'rehab', nombre: 'Rehabilitación', icono: 'pulso', color: '#00A372' },
];

const POR_ID = new Map(DISCIPLINAS.map((d) => [d.id, d]));
export const nombreDeDisciplina = (id) => POR_ID.get(id)?.nombre ?? id;

/* Con qué ejercicios conviene empezar según lo que entrena: los de Training Lab son de gym, así que a quien entrena fuerza,
   deportes, Hyrox, híbrido o rehabilitación le sirven; a quien solo corre, nada, pedalea o da clases, le estorban. Es solo lo
   que sale MARCADO en la pregunta: la persona decide, y lo cambia en Mi perfil cuando quiera. */
const LES_SIRVE_EL_REPERTORIO = new Set(['fuerza', 'deportes', 'rehab', 'hyrox', 'hibrido']);
export const convieneRepertorioBase = (disciplinas = []) => (
  disciplinas.length === 0 || disciplinas.some((d) => LES_SIRVE_EL_REPERTORIO.has(d))
);

export { esInstructor } from '@/lib/palabras';
