/**
 * EL CATÁLOGO DE LA LISTA (Running, Cycling, Swimming y Triatlón), sacado de `EditorDeCorrer.jsx` el 23 nov 2026 SIN CAMBIOS.
 *
 * Por qué vive aquí (decisión de Andrés, 23 nov 2026, spec `docs/superpowers/specs/2026-11-23-conector-v2.md`): lo que el conector de IA puede escribir
 * sale DEL MISMO CÓDIGO que el editor, no de una lista aparte. El editor importa de aquí sus piezas («Agregar»), sus palabras, medidas,
 * intensidades y constructores; el conector (`supabase/functions/mcp/app/`, copiado por `scripts/compartir-con-mcp.mjs`) arma con lo mismo.
 * Si el editor gana una pieza, el conector la ve sin tocarlo.
 *
 * Es puro: sin React, sin íconos, sin colores. El ícono de «Transición» se lo pone el editor (`EditorDeCorrer.jsx`).
 * Las reglas y el porqué de cada pieza siguen en los comentarios de abajo (los mismos que estaban en el editor).
 */

export const ZONAS = [
  { z: 1, nombre: 'Recuperación', desde: 0, hasta: 0.6 },
  { z: 2, nombre: 'Aeróbica', desde: 0.6, hasta: 0.7 },
  { z: 3, nombre: 'Tempo', desde: 0.7, hasta: 0.8 },
  { z: 4, nombre: 'Umbral', desde: 0.8, hasta: 0.9 },
  { z: 5, nombre: 'Máximo', desde: 0.9, hasta: null },
];

// Cómo se siente cada zona, con la prueba de hablar (lo que entiende cualquier atleta), 
export const ZONA_SE_SIENTE = ['muy suave, para recuperar', 'suave, puede platicar', 'moderado, habla con frases cortas', 'fuerte, le cuesta hablar', 'al máximo, no puede hablar'];

// `w` (potencia, Cycling) y `ritmo100` (ritmo por 100 m, Swimming) son formas propias: así una frase se lee bien sin saber de qué deporte es.
export const NOMBRE_MODO = { zona: 'Zona', ritmo: 'Pace', pulso: 'Pulso', rpe: 'Esfuerzo', tiempo: 'Tiempo', tope: 'Máximo', libre: 'Libre', w: 'Potencia', ritmo100: 'Ritmo por 100 m' };

export const MATERIAL = [['nada', 'Nada'], ['trineo', 'Con trineo'], ['paracaidas', 'Con paracaídas'], ['vallas', 'Con vallas'], ['cuesta', 'En cuesta'], ['otro', 'Otro']];
// Calentamiento y enfriamiento: Trote (se escribe), Guiado (un video que se sigue completo) o Ejercicios (sueltos, de su repertorio).
export const FORMAS_CAL = [['trote', 'Trote'], ['video', 'Guiado'], ['ejercicios', 'Ejercicios']];
export const UNIDADES = [['m', 'm'], ['km', 'km'], ['min', 'min'], ['s', 'seg']];
// Minutos por km aproximados por zona: solo para estimar el tiempo y la distancia de arriba cuando no hay ritmo escrito.
export const PACE = [6.6, 6, 5.2, 4.5, 3.8];

export const nuevoId = () => (globalThis.crypto?.randomUUID?.() ?? `t${Date.now()}${Math.random().toString(36).slice(2, 7)}`);
export const descansoSuelto = () => ({ id: nuevoId(), k: 'desc', rol: 'desc', nom: 'Descanso', q: '', u: 'min', tipo: 'parado' });

/** Lo que ofrece «Agregar». Cada coach busca SU palabra: el de fondo «Intervalos» (y también arma intervalos dentro de «Carrera continua»);
    el de sprints «Sprints». Intervalos y Sprints son la misma pantalla: solo cambian el nombre y con qué valores empieza.
    Las descripciones, sin números y para entenderse a la primera lectura. */
// Nada nace con valores puestos (Andrés: «no debes tener valores predeterminados porque confunde»): solo la unidad, que es estructura.
export const vacioTr = (rol, nom, u, extra = {}) => ({ id: nuevoId(), k: 'tr', rol, nom, q: '', u, modo: undefined, z: undefined, vals: {}, limS: null, nota: '', ...extra });
export const pasoNuevo = (tipo) => ({ id: nuevoId(), tipo, q: '', u: tipo === 'descanso' ? 'min' : 'm', ...(tipo === 'correr' ? { modo: undefined, z: undefined, vals: {}, limS: null } : {}) });
/** SPRINTS (acordado con Andrés en imágenes, 19 nov 2026): tres partes en orden, 1 Ejercicio · 2 Intensidad · 3 Sprints y descanso.
    Cada renglón dice cuántos, de qué distancia y con cuánto descanso después de cada uno («hasta recuperarse» = parado, sin tiempo fijo).
    El ejercicio, el peso y la intensidad son de toda la pieza. Nada nace con valores, salvo la estructura (un renglón vacío). */
// UNA FILA POR SPRINT (Andrés, 19 nov: «¿no sería más efectivo que aparezca una fila por sprint?»): sin casilla de cantidad.
export const filaSprint = () => ({ id: nuevoId(), q: '', u: 'm', dq: '', du: 'min' });
export const sprint = () => ({ id: nuevoId(), k: 'int', rol: 'sprint', estilo: 'sprint', modo: undefined, z: undefined, vals: {}, filas: [filaSprint()] });
/** TÉCNICA (Técnica de carrera y Técnica de nado), EN SETS (acordado con Andrés en imágenes, 20 nov 2026). Andrés: «tú estabas bien y yo
    estaba mal»: una Técnica combina ejercicios. Para que se sepa el orden se arma como el Híbrido: Sets en cadena. Un Set con varios
    ejercicios es «uno de cada uno y vuelve a empezar»; un Set de un solo ejercicio es «todas las veces de uno y pasa al siguiente». Las
    veces van en el Set («− 2 + veces»; nunca «vueltas»: en pista y alberca una vuelta es una distancia). Si un ejercicio cambia entre veces
    (10, 12, 15 reps), se escribe en la lista: Switches 10 · Switches 12 · Switches 15. El descanso vive donde ocurre: después de cada
    ejercicio, al volver a empezar y entre Sets (Regreso caminando, Regreso trotando, seg, min o Sin descanso).
    Datos: { k: 'tec', sets: [{ id, veces, items: [{ id, exercise_id, name, q, u, dq, du, lado, peso: { q, u }, mat: [], nota }], dq, du }] }
    (el `dq/du` del Set es el descanso que sigue al Set, «entre Sets»). Lo de antes (`ej` + `filas`, o `items` con series) se lee igual. */
export const itemTec = (e, u = 'm', du = 'camina') => ({ id: nuevoId(), exercise_id: e?.id ?? e?.exercise_id, name: e?.name ?? '', q: '', u, dq: '', du });
export const setTec = (items = [], du = 'camina') => ({ id: nuevoId(), veces: 1, items, dq: '', du });
export const tecnica = (nom = 'Técnica de carrera') => ({ id: nuevoId(), k: 'tec', rol: 'tec', nom, sets: [] });
export const DESCANSO_TEC = [['camina', 'Regreso caminando'], ['trota', 'Regreso trotando'], ['s', 'seg'], ['min', 'min'], ['nada', 'Sin descanso']];
export const UNIDADES_TEC = [['m', 'm'], ['reps', 'reps'], ['s', 'seg']];

/** Un renglón de la tabla de intervalos: su distancia (o tiempo) y su intensidad. La forma de decirla (`modo`) es la del encabezado. */
export const filaInt = (modo) => ({ id: nuevoId(), q: '', u: 'm', modo, z: undefined, vals: {} });
/** INTERVALOS (acordado con Andrés en imágenes, 18 nov 2026): una carrera sin parar con cambios de pace. Nace con el total vacío y dos renglones
    vacíos (la estructura, como en Calentamiento); nada más. Con descanso parado ya son Sprints (Andrés: «con descanso, ya se convierte en sprints»). */
export const intervalosCarrera = () => vacioTr('int', 'Intervalos', 'km', { ints: { repite: true, lista: [filaInt(), filaInt()] } });
export const OPCION = {
  cal: { id: 'cal', titulo: 'Calentamiento', ej: 'Trote, guiado o ejercicios', crea: () => vacioTr('cal', 'Calentamiento', 'min', { forma: 'trote' }) },
  tec: { id: 'tec', titulo: 'Técnica de carrera', ej: 'Skips, switches y más, en sets', crea: () => tecnica() },
  continua: { id: 'continua', titulo: 'Carrera continua', ej: 'Sin parar: constante, progresiva o con intervalos', crea: () => vacioTr('continua', 'Carrera continua', 'km') },
  int: { id: 'int', titulo: 'Intervalos', ej: 'Cambios de pace dentro de la carrera', crea: intervalosCarrera },
  sprint: { id: 'sprint', titulo: 'Sprints', ej: 'A máxima velocidad, con descanso completo', crea: sprint },
  desc: { id: 'desc', titulo: 'Descanso', ej: 'Una pausa entre dos partes', crea: () => descansoSuelto() },
  calma: { id: 'calma', titulo: 'Enfriamiento', ej: 'Trote, guiado o ejercicios, al final', crea: () => vacioTr('calma', 'Enfriamiento', 'min', { forma: 'trote' }) },
};
// Speed tenía su propio orden (Sprints antes que Carrera continua); se quitó con Speed el 19 nov 2026.
export const OPCIONES_CORRER = [OPCION.cal, OPCION.tec, OPCION.continua, OPCION.int, OPCION.sprint, OPCION.desc, OPCION.calma];

/* CYCLING Y SWIMMING (acordado con Andrés en imágenes, 20 nov 2026): «se arman igual que Running». La misma lista de partes y las mismas
   pantallas, con las palabras y las medidas de cada deporte. Nada nuevo que aprender: el coach que sabe armar una carrera ya sabe armar una
   rodada o un nado.
     · CYCLING: «En ruta» o «Estática» una vez para toda la sesión (casi siempre es estática). El atleta sigue lo que marca la bici: minutos,
       kilómetros, metros o calorías (Andrés). Intensidad: Zona, Potencia o Esfuerzo. Para toda la rodada: cadencia (rpm); en estática,
       resistencia y sentado o de pie; en ruta, el terreno. Sin técnica.
     · SWIMMING: el estilo NO es un botón de la app: es el ejercicio, de su repertorio, con su video (Andrés: «el estilo viene del repertorio»).
       Los drills van en «Técnica de nado», y ahí va el material (aletas, pull buoy…): una lista sencilla que nace en «Sin material», se marca
       más de uno y el coach agrega los suyos (Andrés: «no vale la pena tanta cosa para escoger el equipo»). «Series» no lleva material.
       Intensidad: Ritmo por 100 m, Zona o Esfuerzo. */
export const OPCIONES_BICI = [
  { ...OPCION.cal, ej: 'Rodada, guiado o ejercicios' },
  { ...OPCION.continua, titulo: 'Rodada continua', crea: () => vacioTr('continua', 'Rodada continua', 'min') },
  { ...OPCION.int, ej: 'Cambios de potencia dentro de la rodada', crea: () => vacioTr('int', 'Intervalos', 'min', { ints: { repite: true, lista: [{ ...filaInt(), u: 'min' }, { ...filaInt(), u: 'min' }] } }) },
  { ...OPCION.sprint, ej: 'A máxima potencia, con descanso completo', crea: () => ({ ...sprint(), filas: [{ ...filaSprint(), u: 's' }] }) },
  OPCION.desc,
  { ...OPCION.calma, ej: 'Rodada, guiado o ejercicios, al final' },
];
export const OPCIONES_NADO = [
  { ...OPCION.cal, ej: 'Nado, guiado o ejercicios', crea: () => vacioTr('cal', 'Calentamiento', 'm', { forma: 'trote' }) },
  { ...OPCION.tec, titulo: 'Técnica de nado', ej: 'Drills de tu repertorio, con su material', crea: () => tecnica('Técnica de nado') },
  { ...OPCION.continua, titulo: 'Nado continuo', ej: 'Sin parar: constante, progresivo o con intervalos', crea: () => vacioTr('continua', 'Nado continuo', 'm') },
  { id: 'series', titulo: 'Series', ej: 'Repeticiones con descanso entre cada una', crea: () => ({ ...sprint(), rol: 'series', filas: [{ ...filaSprint(), u: 'm', du: 's' }] }) },
  { ...OPCION.sprint, ej: 'A máxima velocidad, con descanso completo', crea: () => ({ ...sprint(), filas: [{ ...filaSprint(), u: 'm', du: 's' }] }) },
  OPCION.desc,
  { ...OPCION.calma, ej: 'Nado, guiado o ejercicios, al final', crea: () => vacioTr('calma', 'Enfriamiento', 'm', { forma: 'trote' }) },
];
// Minutos por km aproximados por zona, solo para estimar el resumen cuando no hay ritmo escrito.
export const PACE_BICI = [3, 2.6, 2.3, 2, 1.8];
export const PACE_NADO = [26, 23, 21, 19, 17];
export const U_RUTA = [['min', 'min'], ['km', 'km'], ['m', 'm']];
export const U_ESTATICA = [['min', 'min'], ['km', 'km'], ['m', 'm'], ['cal', 'cal']];
export const U_NADO = [['m', 'm'], ['min', 'min'], ['s', 'seg']];
export const DESCANSO_NADO = [['s', 'seg'], ['min', 'min'], ['nada', 'Sin descanso']];
export const DEPORTES = {
  correr: {
    // LENGUAJE (Andrés, 12 nov 2026: «¿para qué suave si siempre es suave?»): el calentamiento y el enfriamiento ya son suaves; se dice
    // «Trote», «Rodada» o «Nado», nunca «trote suave».
    id: 'correr', suave: 'Trote', deSuave: 'de trote', unidades: UNIDADES, pace: PACE, opciones: OPCIONES_CORRER, sugerido: 'int',
    modos: ['zona', 'ritmo', 'rpe'], modosSprint: ['tope', 'tiempo', 'rpe'], todos: ['zona', 'ritmo', 'pulso', 'rpe', 'tiempo', 'tope', 'libre'],
    modosProg: ['ritmo', 'zona', 'rpe', 'pulso'], modosTabla: ['ritmo', 'zona', 'rpe', 'pulso', 'tiempo', 'tope', 'libre'],
    total: 'Total de la carrera', como: 'Cómo se corre', progresiva: 'Progresiva', todo: 'Para toda la carrera', tecnica: 'Técnica de carrera',
    unidadesTec: UNIDADES_TEC, descansoTec: DESCANSO_TEC, cadencia: ['pasos por minuto', '180'], libre: 'Sprint libre', conEjercicio: true,
    buscaTec: /skip|switch|tecnica|drill|rodilla|talon|carioca|zancada|bound|tobillo|pogo|escalera|marcha/,
    buscaInt: /sprint|salida|arranque|trineo|valla|cuesta|arrastre|paracaid|carrera|correr|zancada|bound|skip|aceler|lanzad|relevo/,
  },
  bici: {
    id: 'bici', suave: 'Rodada', deSuave: 'de rodada', unidades: U_ESTATICA, pace: PACE_BICI, opciones: OPCIONES_BICI, sugerido: 'int',
    modos: ['zona', 'w', 'rpe'], modosSprint: ['tope', 'w', 'rpe'], todos: ['zona', 'w', 'pulso', 'rpe', 'tope', 'libre'],
    modosProg: ['w', 'zona', 'rpe', 'pulso'], modosTabla: ['w', 'zona', 'rpe', 'pulso', 'tope', 'libre'],
    total: 'Total de la rodada', como: 'Cómo se rueda', progresiva: 'Progresiva', todo: 'Para toda la rodada', tecnica: null,
    unidadesTec: UNIDADES_TEC, descansoTec: DESCANSO_TEC, cadencia: ['rpm', '90'], libre: 'Sprint', conEjercicio: false,
    buscaTec: /bici|ciclo|rodillo|spin/, buscaInt: /bici|ciclo|rodillo|spin|sprint/,
  },
  nado: {
    id: 'nado', suave: 'Nado', deSuave: 'de nado', unidades: U_NADO, pace: PACE_NADO, opciones: OPCIONES_NADO, sugerido: 'series',
    modos: ['ritmo100', 'zona', 'rpe'], modosSprint: ['tope', 'tiempo', 'rpe'], todos: ['ritmo100', 'zona', 'pulso', 'rpe', 'tiempo', 'tope', 'libre'],
    modosProg: ['ritmo100', 'zona', 'rpe', 'pulso'], modosTabla: ['ritmo100', 'zona', 'rpe', 'pulso', 'tiempo', 'tope', 'libre'],
    total: 'Total del nado', como: 'Cómo se nada', progresiva: 'Progresivo', todo: 'Para todo el nado', tecnica: 'Técnica de nado',
    unidadesTec: [['m', 'm'], ['s', 'seg'], ['reps', 'reps']], descansoTec: DESCANSO_NADO, cadencia: null, libre: 'Sin ejercicio', conEjercicio: true,
    buscaTec: /patada|pull|drill|brazada|tecnica|aleta|tabla|sculling|crol|libre|espalda|pecho|braza|mariposa/,
    buscaInt: /nado|nadar|libre|crol|espalda|pecho|braza|mariposa|combinado|estilo/,
  },
};
/* TRIATLÓN (acordado con Andrés en imágenes, 20 nov 2026): la misma lista, y cada parte es un deporte. «Agregar» ofrece cuatro: Nado, Bici,
   Carrera y Transición. Cada parte se abre como la parte continua de su deporte (Nado como en Swimming, Bici como en Cycling en ruta, Carrera
   como en Running): constante, progresiva o con intervalos. Es para sesiones que juntan deportes sin parar (un brick, un simulacro); el día
   que solo nada, la sesión es de Swimming. Sprints, series y técnica van en la sesión de su deporte: así «Agregar» se queda en cuatro.
   Cada parte guarda su deporte en `dxp` ('nado' | 'bici' | 'correr'); la transición es `{ k: 'trans', q, u: 's'|'min' }` (sin tiempo: lo
   más rápido que pueda). */
export const transicion = () => ({ id: nuevoId(), k: 'trans', rol: 'trans', nom: 'Transición', q: '', u: 's' });
/* LOS TIPOS DE ENTRENAMIENTO DE CADA DEPORTE (Andrés, 20 nov 2026: «como lo hicimos dentro de correr, los intervalos, progresivo o carrera
   continua… se tiene que poner también dentro de triatlón, dentro de cada disciplina»). Los mismos de su Disciplina, agrupados por deporte:
   Nado (Nado continuo, Técnica de nado, Series, Sprints), Bici (Rodada continua, Intervalos, Sprints) y Carrera (Carrera continua, Técnica
   de carrera, Intervalos, Sprints). Cada uno nace con su deporte en `dxp` y se abre igual que en su Disciplina. */
// En el orden de `ids` (lo continuo primero). La bici del triatlón es en ruta: su rodada continua nace en kilómetros.
export const deDeporte = (opciones, dxp, grupo, ids) => ids.map((id) => opciones.find((op) => op.id === id)).filter(Boolean)
  .map((op) => ({ ...op, id: `${dxp}-${op.id}`, tipo: op.id, grupo, crea: () => ({ ...op.crea(), dxp, ...(dxp === 'bici' && op.id === 'continua' ? { u: 'km' } : {}) }) }));
export const OPCIONES_TRI = [
  // Calentamiento, Descanso y Enfriamiento también van (Andrés, 20 nov 2026: «te estás olvidando de componentes importantes como calentamiento»).
  // En Triatlón el calentamiento puede ser de cualquiera de los tres deportes: se elige ahí mismo.
  // En Triatlón el calentamiento nace «Guiado» (Andrés, 21 nov 2026: «que arranque en guiado mejor»).
  { ...OPCION.cal, ej: 'Nado, rodada o trote, guiado o ejercicios', crea: () => vacioTr('cal', 'Calentamiento', 'min', { forma: 'video' }) },
  ...deDeporte(OPCIONES_NADO, 'nado', 'Nado', ['continua', 'tec', 'series', 'sprint']),
  ...deDeporte(OPCIONES_BICI, 'bici', 'Bici', ['continua', 'int', 'sprint']),
  ...deDeporte(OPCIONES_CORRER, 'correr', 'Carrera', ['continua', 'tec', 'int', 'sprint']),
  { id: 'trans', titulo: 'Transición', ej: 'El cambio de un deporte a otro', gris: true, crea: transicion },
  OPCION.desc,
  { ...OPCION.calma, ej: 'Nado, rodada o trote, guiado o ejercicios, al final' },
];
// Las formas de calentar y enfriar en Triatlón: en cualquiera de los tres deportes, guiado o con ejercicios.
export const FORMAS_CAL_TRI = [['nado', 'Nado'], ['bici', 'Rodada'], ['trote', 'Trote'], ['video', 'Guiado'], ['ejercicios', 'Ejercicios']];
DEPORTES.tri = { ...DEPORTES.correr, id: 'tri', opciones: OPCIONES_TRI, sugerido: 'nado-continua', tecnica: null };
/** El deporte de una parte de Triatlón (la bici del triatlón es en ruta). Fuera de Triatlón, el del editor. */
export const BICI_EN_RUTA = { ...DEPORTES.bici, unidades: U_RUTA, lugar: 'ruta' };
export const depDeParte = (x, dep) => (x?.dxp === 'bici' ? BICI_EN_RUTA : DEPORTES[x?.dxp] ?? dep);
