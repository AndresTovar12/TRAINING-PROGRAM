/* El DEPORTE de un entreno, con una sola lista de nombres venga de donde venga.

   Cada plataforma lo llama distinto: Apple Salud «HKWorkoutActivityTypeTraditionalStrengthTraining», Garmin (FIT) «training / strength_training», los
   archivos TCX «Biking», los de Strava «Weight Training». Aquí todo se reduce a unos pocos nombres en español que el resto de la app entiende, y el nombre
   original se guarda aparte (`deporte_original`) por si hace falta.

   Los nombres de base coinciden con los del motor del entreno (`lib/entreno.js`, `DEPORTE_DEL_TIPO`): correr, bici, natacion, fuerza, yoga… Un deporte que no
   conocemos es «otro» y se dibuja igual de bien: lo que importa es el pulso, el tiempo y la carga.

   Este archivo no importa nada de la app (ni `@/`): lo cargan tal cual las pruebas de Node. */

/**
 * Lo que sabemos de cada deporte:
 *   nombre       cómo se dice en pantalla
 *   ritmo        se mide en min/km (correr, caminar…); si no, en km/h (bici) o no tiene velocidad (fuerza)
 *   distancia    tiene sentido hablar de kilómetros
 *   cargaPorHora puntos de carga que se estiman por hora cuando NO hay pulso (ver `cargaDeActividad`)
 */
export const DEPORTES = Object.freeze({
  correr: { nombre: 'Correr', ritmo: true, distancia: true, cargaPorHora: 60 },
  caminar: { nombre: 'Caminar', ritmo: true, distancia: true, cargaPorHora: 25 },
  senderismo: { nombre: 'Senderismo', ritmo: true, distancia: true, cargaPorHora: 35 },
  bici: { nombre: 'Bici', ritmo: false, distancia: true, cargaPorHora: 50 },
  natacion: { nombre: 'Natación', ritmo: false, distancia: true, cargaPorHora: 55 },
  remo: { nombre: 'Remo', ritmo: false, distancia: true, cargaPorHora: 55 },
  eliptica: { nombre: 'Elíptica', ritmo: false, distancia: true, cargaPorHora: 45 },
  fuerza: { nombre: 'Fuerza', ritmo: false, distancia: false, cargaPorHora: 40 },
  hiit: { nombre: 'HIIT', ritmo: false, distancia: false, cargaPorHora: 70 },
  funcional: { nombre: 'Funcional', ritmo: false, distancia: false, cargaPorHora: 50 },
  yoga: { nombre: 'Yoga', ritmo: false, distancia: false, cargaPorHora: 20 },
  movilidad: { nombre: 'Movilidad', ritmo: false, distancia: false, cargaPorHora: 15 },
  futbol: { nombre: 'Fútbol', ritmo: false, distancia: true, cargaPorHora: 60 },
  raqueta: { nombre: 'Raqueta', ritmo: false, distancia: false, cargaPorHora: 55 },
  otro: { nombre: 'Otro', ritmo: false, distancia: false, cargaPorHora: 40 },
});

export const esDeporte = (d) => Object.prototype.hasOwnProperty.call(DEPORTES, d);

/** Cómo se dice el deporte en pantalla («Correr»); lo desconocido, «Otro». */
export const nombreDelDeporte = (d) => (DEPORTES[d] ?? DEPORTES.otro).nombre;

// Minúsculas, sin acentos y sin separadores raros («Weight Training» → «weight training», «strength_training» → «strength training»).
const limpio = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * El deporte a partir de un texto cualquiera (el «tipo» de un GPX, la columna de un CSV de Strava, el título del archivo). Lo que no reconoce es «otro».
 * Se prueban primero las palabras más específicas: «trail running» es correr, no senderismo.
 */
export function deporteDeTexto(texto) {
  const t = limpio(texto);
  if (!t) return 'otro';
  // Una palabra cuenta desde su principio («run» casa con «running», no con «brunch»; «row» con «rowing», no con «brown»).
  const casa = (...palabras) => palabras.some((p) => new RegExp(`\\b${p}`).test(t));
  if (casa('hiit', 'high intensity', 'interval training', 'intervalos', 'tabata')) return 'hiit';
  if (casa('strength', 'weight', 'fuerza', 'pesas', 'gym', 'gimnasio', 'powerlifting', 'crossfit', 'musculacion')) return 'fuerza';
  if (casa('functional', 'funcional', 'cross training', 'core training', 'circuit', 'circuito', 'mixed cardio', 'cardio training')) return 'funcional';
  if (casa('running', 'run', 'correr', 'carrera', 'trotar', 'jogging', 'treadmill', 'cinta')) return 'correr';
  if (casa('hiking', 'hike', 'senderismo', 'trekking', 'montana')) return 'senderismo';
  if (casa('walking', 'walk', 'caminar', 'caminata')) return 'caminar';
  if (casa('cycling', 'biking', 'bike', 'ride', 'bici', 'ciclismo', 'spinning', 'mountain biking')) return 'bici';
  if (casa('swim', 'natacion', 'nadar')) return 'natacion';
  if (casa('row', 'remo', 'ergometro')) return 'remo';
  if (casa('elliptical', 'eliptica')) return 'eliptica';
  if (casa('yoga', 'pilates')) return 'yoga';
  if (casa('mobility', 'movilidad', 'stretch', 'flexibility', 'estiramiento', 'cooldown', 'recovery', 'recuperacion')) return 'movilidad';
  if (casa('soccer', 'futbol', 'football')) return 'futbol';
  if (casa('tennis', 'padel', 'squash', 'badminton', 'racket', 'pickleball', 'tenis')) return 'raqueta';
  return 'otro';
}

/** Apple Salud: `HKWorkoutActivityTypeRunning` → correr. Los tipos de fuerza y de intervalos tienen su nombre propio. */
export function deporteDeApple(tipo) {
  const t = String(tipo ?? '').replace(/^HKWorkoutActivityType/, '');
  const mapa = {
    Running: 'correr', Walking: 'caminar', Hiking: 'senderismo', Cycling: 'bici', Swimming: 'natacion', Rowing: 'remo', Elliptical: 'eliptica',
    TraditionalStrengthTraining: 'fuerza', FunctionalStrengthTraining: 'fuerza', HighIntensityIntervalTraining: 'hiit',
    CrossTraining: 'funcional', CoreTraining: 'funcional', MixedCardio: 'funcional', Yoga: 'yoga', Pilates: 'yoga',
    FlexibilityTraining: 'movilidad', Cooldown: 'movilidad', Soccer: 'futbol', Tennis: 'raqueta', Squash: 'raqueta', Badminton: 'raqueta',
    TableTennis: 'raqueta', Racquetball: 'raqueta', Pickleball: 'raqueta', Padel: 'raqueta',
  };
  return mapa[t] ?? deporteDeTexto(t.replace(/([a-z])([A-Z])/g, '$1 $2'));
}

/** Garmin y compañía (FIT): `sport` y `sub_sport` del mensaje de sesión. */
export function deporteDeFit(sport, subSport) {
  const sub = limpio(subSport);
  const dep = limpio(sport);
  if (sub === 'strength training') return 'fuerza';
  if (sub === 'hiit') return 'hiit';
  if (sub === 'yoga' || sub === 'pilates') return 'yoga';
  if (sub === 'flexibility training') return 'movilidad';
  if (sub === 'cardio training' || sub === 'indoor cardio') return 'funcional';
  if (sub === 'elliptical') return 'eliptica';
  if (sub === 'indoor rowing') return 'remo';
  if (dep === 'training') return 'funcional';
  if (dep === 'fitness equipment') return deporteDeTexto(sub) === 'otro' ? 'funcional' : deporteDeTexto(sub);
  return deporteDeTexto(dep || sub);
}
