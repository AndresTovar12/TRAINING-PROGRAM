// Prueba de CUÁNDO PREGUNTA la IA al usar el conector (7 oct 2026, ejemplos de Andrés): los topes que el
// conector revisa solo (`preguntas.ts`) y que leer un día y reescribirlo no vuelve a discutir lo ya guardado.
//
//   deno run -A scripts/prueba-mcp-preguntas.ts
import { diaDesdeEntrada, nombresDeEjercicios } from '../supabase/functions/mcp/plan.ts'
import { equiposMasUsados, exigirFichas, parecidosA, preguntaDeDatos, type ItemDeCatalogo } from '../supabase/functions/mcp/preguntas.ts'
import { Pregunta, llaveDeNombre, mismoNombre, palabrasClave, seguro } from '../supabase/functions/mcp/util.ts'
import { herramientasComunes } from '../supabase/functions/mcp/comunes.ts'
import { herramientasDelCoach } from '../supabase/functions/mcp/coach.ts'

const igual = (a: unknown, b: unknown, msg: string) => {
  const x = JSON.stringify(a), y = JSON.stringify(b)
  if (x !== y) throw new Error(`${msg}\n  obtuve:   ${x}\n  esperaba: ${y}`)
}
const cierto = (v: unknown, msg: string) => { if (!v) throw new Error(msg) }
let n = 0
const ok = (nombre: string) => { n += 1; console.log(`OK    ${nombre}`) }

/** Un pedazo del catálogo REAL de Andrés (buscar_ejercicios, 7 oct 2026). */
const item = (name: string, equipment: string | null, categoria: string, musculos: string[]): ItemDeCatalogo =>
  ({ id: `id-${llaveDeNombre(name)}`, name, equipment, category: { name: categoria }, muscle_primary: musculos })
const CATALOGO: ItemDeCatalogo[] = [
  item('Barbell Shoulder Press', 'Barra', 'Fuerza', ['Hombro', 'Tríceps']),
  item('Dumbbell Shoulder Press', 'Mancuerna', 'Hipertrofia', ['Hombro', 'Tríceps']),
  item('Bench Press', 'Barra', 'Fuerza', ['Pecho', 'Tríceps', 'Hombro']),
  item('Back Squat', 'Barra', 'Fuerza', ['Cuádriceps', 'Glúteo', 'Core']),
  item('Front Squat', 'Barra', 'Fuerza', ['Cuádriceps', 'Core', 'Glúteo']),
  item('Goblet Squat', 'Mancuerna', 'Hipertrofia', ['Cuádriceps', 'Glúteo']),
  item('Dumbbell Squat', 'Mancuernas', 'Fuerza', ['Cuádriceps', 'Glúteo', 'Core']),
  item('Bulgarian Split Squat', 'Mancuerna', 'Hipertrofia', ['Cuádriceps', 'Glúteo', 'Isquios']),
  item('Bulgarian Squat Jumps', 'Peso corporal', 'Pliometría', ['Cuádriceps', 'Glúteo', 'Pantorrilla']),
  item('Squat Jump', 'Peso corporal', 'Pliometría', ['Cuádriceps', 'Glúteo', 'Pantorrilla']),
  item('Assisted Pistol Squat', 'Peso corporal', 'Atlético', ['Piernas', 'Core']),
  item('Hamstring Curl', 'Máquina', 'Hipertrofia', ['Isquios']),
  item('Nordic Curl', 'Peso corporal', 'Hipertrofia', ['Isquios']),
  item('Bicep Curl', 'Mancuerna', 'Hipertrofia', ['Bíceps']),
  item('Rope Curl', 'Polea', 'Hipertrofia', ['Bíceps', 'Antebrazo']),
  item('Lat Pull Down', 'Polea', 'Hipertrofia', ['Espalda', 'Bíceps']),
  item('Close Grip Pull Downs', 'Polea', 'Hipertrofia', ['Espalda', 'Bíceps']),
  item('Remo Poleas', 'Polea', 'Hipertrofia', ['Espalda', 'Bíceps']),
  item('Face Pulls', 'Polea', 'Hipertrofia', ['Deltoide posterior', 'Trapecio', 'Espalda alta']),
  item('Pull Ups', 'Barra de dominadas', 'Fuerza', ['Espalda', 'Bíceps']),
  item('Romanian Deadlift', 'Barra', 'Fuerza', ['Isquios', 'Glúteo']),
]
const nombres = (l: ItemDeCatalogo[]) => l.map((e) => e.name)

/** Lo que pasa cuando un tope dice «no guardo»: la herramienta contesta una Pregunta (no un error). */
function pregunta(fn: () => unknown): Pregunta {
  try { fn() } catch (e) { if (e instanceof Pregunta) return e; throw e }
  throw new Error('debía detenerse y preguntar, pero siguió')
}

/* ---- Nombres: «Lat Pulldown» y «Lat Pull-Down» son la misma ficha ---- */
{
  cierto(mismoNombre('Lat Pull-Down', 'lat pulldown'), 'sin espacios ni guiones es el mismo nombre')
  cierto(mismoNombre('Pull Ups', 'Pullups'), 'Pull Ups = Pullups')
  cierto(mismoNombre('Bulgarian split squats', 'Bulgarian Split Squat'), 'solo cambia el plural: es el mismo')
  cierto(mismoNombre('Lat Pull Downs', 'lat pulldown'), 'plural, espacio y mayúsculas a la vez')
  cierto(mismoNombre('Curl con barra', 'Curl barra'), 'el relleno («con») no cuenta')
  cierto(!mismoNombre('Squat Jump', 'Jump Squat'), 'el orden sí cuenta: son ejercicios distintos')
  cierto(!mismoNombre('Bicep Curl', 'Hammer Bicep Curl'), 'una palabra de más es otro ejercicio')
  cierto(!mismoNombre('Bench Press', 'Incline Bench Press'), 'otro ejercicio no se confunde')
  cierto(!mismoNombre('???', '!!!'), 'dos nombres sin letras no son «el mismo»')
  const { dia, sinFicha } = diaDesdeEntrada('Lun', { ejercicios: [{ nombre: 'Lat Pulldown' }, { nombre: 'Nordic Curl 2' }] }, CATALOGO)
  const [lat, nordic] = dia.exercises as any[]
  igual(lat.exercise_id, 'id-latpulldown', 'se liga a la ficha aunque cambien los espacios')
  igual(lat.name, 'Lat Pull Down', 'y toma el nombre del catálogo')
  igual(sinFicha, ['Nordic Curl 2'], 'lo que no está, queda como sin ficha')
  cierto(nordic.exercise_id === undefined, 'sin ficha no lleva exercise_id')
  ok('los nombres se comparan sin espacios, guiones ni mayúsculas')
}

/* ---- Tope 2: un ejercicio que no está en el catálogo NO se guarda; se pregunta ---- */
{
  // Su ejemplo: «cámbiale pull ups por jalón en poleas». Sin el nombre exacto, no se guarda nada.
  const p = pregunta(() => exigirFichas({ sinFicha: ['jalón en poleas'], catalogo: CATALOGO }))
  igual(p.datos.guardado, false, 'no se guardó')
  igual(p.datos.motivo, 'ejercicios_fuera_del_catalogo', 'dice por qué')
  igual((p.datos.pendientes as any[]).map((x) => [x.escrito, x.caso]), [['jalón en poleas', 'ninguno']], 'dice cuál nombre falta, y que ningún parecido sirve (la IA lo busca ella)')
  cierto(String(p.datos.que_hacer).includes('UN solo mensaje'), 'trae cómo preguntar: todo en un solo mensaje')
  cierto(String(p.datos.que_hacer).includes('sin_ficha_ok'), 'y la salida para lo que va tal cual')
  ok('un nombre que no está en el catálogo no se guarda: se pregunta')
}
{
  // Los parecidos son por letras. Un nombre casi igual en inglés sí se encuentra; uno en español puro, no.
  igual(nombres(parecidosA('bulgarian split squats', CATALOGO)).slice(0, 2), ['Bulgarian Split Squat', 'Bulgarian Squat Jumps'], '«bulgarian split squats» (plural) encuentra el suyo primero')
  igual(nombres(parecidosA('sentadilla búlgara con mancuernas', CATALOGO)), ['Bulgarian Split Squat'], '«búlgara» ~ «bulgarian» y «mancuernas» ~ su equipo: solo el que cumple las dos')
  igual(nombres(parecidosA('jalón en poleas', CATALOGO)), [], '«jalón en poleas»: solo «polea» coincide (la mitad), así que no se inventan parecidos como «Remo Poleas»')
  igual(nombres(parecidosA('Trap Bar Deadlift', CATALOGO)), [], 'una sola palabra de tres («deadlift») no basta')
  igual(nombres(parecidosA('Rumanian Deadlift', CATALOGO)), ['Romanian Deadlift'], '«Rumanian» ~ «Romanian» (una letra)')
  igual(nombres(parecidosA('jumping squats', CATALOGO)).slice(0, 1), ['Squat Jump'], '«jumping squats» → Squat Jump')
  igual(nombres(parecidosA('sentadilla', CATALOGO)), [], 'una palabra en español sin parecido en el nombre no trae nada (no se inventan parecidos por el equipo)')
  const p = pregunta(() => exigirFichas({ sinFicha: ['Rumanian Deadlift', 'sentadilla', 'press de hombro'], catalogo: CATALOGO }))
  const casos = Object.fromEntries((p.datos.pendientes as any[]).map((x) => [x.escrito, x.caso]))
  igual(casos, { 'Rumanian Deadlift': 'uno', sentadilla: 'ninguno', 'press de hombro': 'varios' }, 'cada pendiente dice si hay uno, varios o ninguno')
  const hombro = (p.datos.pendientes as any[]).find((x) => x.escrito === 'press de hombro')
  cierto(hombro.parecidos.some((x: any) => x.nombre === 'Barbell Shoulder Press' && x.equipo === 'Barra'), 'con su equipo, para poder preguntar «¿barra o mancuerna?»')
  cierto(hombro.parecidos.some((x: any) => x.nombre === 'Dumbbell Shoulder Press' && x.equipo === 'Mancuerna'), 'los dos, con su equipo')
  ok('los parecidos salen con su equipo, y cada pendiente dice uno / varios / ninguno')
}
{
  // La persona ya contestó: la IA repite con `sin_ficha_ok` y se guarda sin preguntar.
  const comoTexto = exigirFichas({ sinFicha: ['Movilidad 90/90', 'Nordic Curl 2'], catalogo: CATALOGO, confirmados: ['movilidad 90/90', 'Nordic curl 2'] })
  igual(comoTexto, ['Movilidad 90/90', 'Nordic Curl 2'], 'lo confirmado va tal cual (sin importar mayúsculas)')
  // Confirmó uno pero falta otro: se pregunta solo por el que falta.
  const p = pregunta(() => exigirFichas({ sinFicha: ['Movilidad 90/90', 'Zancada rara'], catalogo: CATALOGO, confirmados: ['Movilidad 90/90'] }))
  igual((p.datos.pendientes as any[]).map((x) => x.escrito), ['Zancada rara'], 'solo se pregunta por el que falta')
  // El mismo nombre dos veces cuenta una.
  const q = pregunta(() => exigirFichas({ sinFicha: ['Algo raro', 'algo raro'], catalogo: CATALOGO }))
  igual((q.datos.pendientes as any[]).length, 1, 'un nombre repetido se pregunta una vez')
  ok('lo que la persona ya confirmó no se vuelve a preguntar')
}
{
  // Leer un día y reescribirlo: lo que el plan YA tenía (aunque no esté en el catálogo) no se vuelve a discutir.
  const plan = { data: { phases: [{ weekData: [{ days: [{ exercises: [{ name: 'Movilidad 90/90' }, { isNote: true, text: 'Calentar' }, { name: 'Back Squat' }] }] }] }] } } as any
  igual(nombresDeEjercicios(plan), ['Movilidad 90/90', 'Back Squat'], 'los nombres del plan, sin las notas')
  igual(nombresDeEjercicios(null), [], 'sin plan, ninguno')
  const comoTexto = exigirFichas({ sinFicha: ['Movilidad 90/90'], catalogo: CATALOGO, yaEnElPlan: nombresDeEjercicios(plan) })
  igual(comoTexto, [], 'lo que ya estaba en el plan pasa sin preguntar ni avisar')
  pregunta(() => exigirFichas({ sinFicha: ['Movilidad 90/90', 'Hip thrust'], catalogo: CATALOGO, yaEnElPlan: nombresDeEjercicios(plan) }))
  ok('reescribir un día no vuelve a discutir lo que el plan ya tenía; lo nuevo, sí')
}
{
  // Nada que preguntar: todo está en el catálogo con su nombre.
  const { sinFicha } = diaDesdeEntrada('Mar', { ejercicios: [{ nombre: 'Back Squat' }, { nota: 'Calentamiento' }, { nombre: 'pull ups' }] }, CATALOGO)
  igual(exigirFichas({ sinFicha, catalogo: CATALOGO }), [], 'con todo en el catálogo no hay nada que preguntar')
  ok('si todo está en el catálogo, se guarda directo')
}

/* ---- Tope 1: crear un ejercicio con solo el nombre → UNA pregunta con todo lo opcional ---- */
{
  const p = pregunta(() => preguntaDeDatos('Nordic curl', {
    categorias: ['Fuerza', 'Hipertrofia', 'Potencia', 'Core', 'Movilidad', 'Cardio'],
    grupos: ['Piernas', 'Glúteo', 'Pecho', 'Espalda', 'Brazos', 'Core'],
    equipos: equiposMasUsados(CATALOGO),
  }))
  igual(p.datos.guardado, false, 'no se guardó')
  igual(p.datos.motivo, 'faltan_datos_del_ejercicio', 'dice por qué')
  const texto = String(p.datos.pregunta)
  cierto(texto.startsWith('¿Quieres agregarle datos a «Nordic curl»?'), 'abre con la pregunta')
  for (const campo of ['categoría', 'grupo muscular', 'equipo', 'alguna nota']) cierto(texto.includes(campo), `la pregunta ofrece «${campo}»`)
  cierto(texto.includes('Fuerza, Hipertrofia, Potencia, Core, Movilidad…'), 'enseña las primeras opciones reales y puntos suspensivos')
  cierto(texto.includes('dime «así»'), 'y la salida «así»')
  igual((p.datos.opciones as any).categorias.length, 6, 'pero las opciones completas van aparte, para validar')
  cierto(String(p.datos.que_hacer).includes('sin_datos: true'), 'dice cómo seguir si contesta «así»')
  cierto(String(p.datos.que_hacer).includes('UNA sola vez'), 'y que es UNA sola pregunta')
  ok('crear un ejercicio sin datos: una sola pregunta con categoría, grupo muscular, equipo y nota')
}
{
  igual(equiposMasUsados([
    item('A', 'Mancuerna', 'x', []), item('B', 'Mancuerna', 'x', []), item('C', 'Mancuernas', 'x', []),
    item('D', 'Barra', 'x', []), item('E', 'Barra', 'x', []), item('F', 'Polea', 'x', []), item('G', null, 'x', []),
  ], 2), ['Mancuerna', 'Barra'], '«Mancuerna» y «Mancuernas» cuentan juntas y gana la forma más usada')
  ok('el equipo que se ofrece junta singular y plural')
}

/* ---- La pregunta NO es un error: `seguro` la contesta como respuesta normal ---- */
{
  const r: any = await seguro(async () => { preguntaDeDatos('X', { categorias: [], grupos: [], equipos: [] }) })({})
  cierto(!r.isError, 'una pregunta no es un error: la IA no debe disculparse ni reintentar a ciegas')
  igual(r.structuredContent.guardado, false, 'trae guardado: false')
  cierto(JSON.parse(r.content[0].text).motivo === 'faltan_datos_del_ejercicio', 'y lo mismo como texto, para la IA que no lee lo estructurado')
  ok('la pregunta llega como respuesta normal, no como error')
}

/* ---- Palabras clave ---- */
{
  igual(palabrasClave('Jalón en poleas con las mancuernas'), ['jalon', 'polea', 'mancuerna'], 'sin relleno, sin acentos y en singular')
  igual(palabrasClave('Face Pulls'), ['face', 'pull'], 'el plural en inglés también')
  igual(palabrasClave('Shoulder Press'), ['shoulder', 'press'], '«press» no pierde su ese')
  ok('las palabras clave quitan relleno, acentos y plurales')
}


/* ================================================================== */
/* Las herramientas de verdad, con una base de mentira                  */
/* ================================================================== */

/** Una base falsa: cada tabla devuelve lo que se le dio, y los `insert` quedan anotados. */
function baseFalsa(tablas: Record<string, any[]>) {
  const insertados: { tabla: string; fila: any }[] = []
  const actualizados: { tabla: string; cambios: any }[] = []
  const db = {
    rpc: async (nombre: string) => ({ data: nombre === 'master_id' ? 'master-1' : null, error: null }),
    from: (tabla: string) => {
      let ultima: any = null
      const q: any = {
        select: () => q, order: () => q, in: () => q, eq: () => q, is: () => q, neq: () => q,
        insert: (fila: any) => { ultima = fila; insertados.push({ tabla, fila }); return q },
        update: (cambios: any) => { actualizados.push({ tabla, cambios }); return q },
        single: async () => ({ data: { id: 'id-nuevo', name: ultima?.name }, error: null }),
        maybeSingle: async () => ({ data: (tablas[tabla] ?? [])[0] ?? null, error: null }),
        then: (ok: any, no: any) => Promise.resolve({ data: tablas[tabla] ?? [], error: null }).then(ok, no),
      }
      return q
    },
  }
  return { db, insertados, actualizados }
}
const fila = (name: string, equipment: string | null, cat: string, musculos: string[], extra: Record<string, unknown> = {}) => ({
  id: `id-${llaveDeNombre(name)}`, name, equipment, description: null, muscle_primary: musculos, muscle_secondary: [],
  category_id: `c-${cat.toLowerCase()}`, categorias_secundarias: [], category: { name: cat, slug: cat.toLowerCase() }, created_by: 'master-1', ...extra,
})
const EJERCICIOS = [
  fila('Back Squat', 'Barra', 'Fuerza', ['Cuádriceps', 'Glúteo'], { categorias_secundarias: ['c-potencia'] }),
  fila('Box Squat', 'Barra', 'Potencia', ['Cuádriceps', 'Glúteo']),
  fila('Bicep Curl', 'Mancuerna', 'Hipertrofia', ['Bíceps']),
  fila('Dumbbell Squat', 'Mancuernas', 'Fuerza', ['Cuádriceps']),
  fila('Lat Pull Down', 'Polea', 'Hipertrofia', ['Espalda', 'Bíceps']),
  fila('Remo Poleas', 'Polea', 'Hipertrofia', ['Espalda'], { muscle_secondary: ['Bíceps'] }),
  fila('Hamstring Curl', 'Máquina', 'Hipertrofia', ['Isquios']),
  fila('Pull Ups', 'Barra de dominadas', 'Fuerza', ['Espalda']),
]
const CATEGORIAS = [
  { id: 'c-fuerza', name: 'Fuerza', slug: 'fuerza', created_by: null },
  { id: 'c-hipertrofia', name: 'Hipertrofia', slug: 'hipertrofia', created_by: null },
  { id: 'c-potencia', name: 'Potencia', slug: 'potencia', created_by: null },
]
function herramientas(con: (s: any, q: any) => void, tablas: Record<string, any[]> = {}) {
  const { db, insertados, actualizados } = baseFalsa({
    exercises: EJERCICIOS, exercise_categories: CATEGORIAS, exercise_overrides: [], grupos_musculares: [{ id: 'g1', name: 'Rotadores' }], ...tablas,
  })
  const quien: any = { id: 'master-1', usuario: 'andres', nombre: 'Andrés', rol: 'master', salud: false, unidad: 'kg', db }
  const tools: Record<string, (a: any) => Promise<any>> = {}
  const server: any = { registerTool: (nombre: string, _def: unknown, fn: (a: any) => Promise<any>) => { tools[nombre] = fn } }
  con(server, quien)
  return { tools, insertados, actualizados }
}
const ATLETA_FALSO = { id: 'atleta-1', username: 'zz_atleta', full_name: 'Atleta Prueba', role: 'user', is_owner: false, coach_id: 'master-1', is_active: true, unidad_peso: 'kg', genero: null, email: null, created_at: '2026-01-01', perfil_completo: true, alta_en: null }
const PLAN_FALSO = () => ({
  id: 'plan-1', user_id: 'atleta-1', title: 'Rutina', status: 'active', updated_at: '2026-01-01', profesional_id: null,
  data: { kind: 'weekly', phases: [{ id: 'p-1', num: 1, name: 'Rutina semanal', weekData: [{ num: 1, label: '', load: '', days: [
    { day: 'Lun', name: 'Fuerza', cat: 'gym', exercises: [{ name: 'Back Squat', exercise_id: 'id-backsquat', sets: '3', reps: '5' }, { name: 'Movilidad 90/90', sets: '2', reps: '10' }] },
  ] }] }] },
})
const buscados = (r: any) => r.structuredContent.ejercicios.map((e: any) => e.nombre)

/* ---- buscar_ejercicios: plural o singular, categorías y músculos secundarios, grupos ---- */
{
  const { tools } = herramientas(herramientasComunes)
  igual(buscados(await tools.buscar_ejercicios({ texto: 'poleas' })), ['Lat Pull Down', 'Remo Poleas'], '«poleas» (plural) encuentra lo de polea')
  igual(buscados(await tools.buscar_ejercicios({ equipo: 'mancuernas' })), ['Bicep Curl', 'Dumbbell Squat'], 'el equipo «mancuernas» encuentra «Mancuerna» y «Mancuernas»')
  const piernas = buscados(await tools.buscar_ejercicios({ musculo: 'piernas' }))
  igual(piernas.slice().sort(), ['Back Squat', 'Box Squat', 'Dumbbell Squat', 'Hamstring Curl'], '«piernas» es un grupo: trae cuádriceps e isquios')
  igual(buscados(await tools.buscar_ejercicios({ musculo: 'isquios' })), ['Hamstring Curl'], 'un músculo fino busca solo ese')
  const potencia = await tools.buscar_ejercicios({ categoria: 'potencia' })
  igual(buscados(potencia), ['Box Squat', 'Back Squat'], 'la categoría trae también las secundarias, y primero las principales')
  igual(potencia.structuredContent.ejercicios[1].categorias_secundarias, ['Potencia'], 'y enseña sus categorías secundarias')
  const biceps = buscados(await tools.buscar_ejercicios({ musculo: 'bíceps' }))
  igual(biceps, ['Bicep Curl', 'Lat Pull Down', 'Remo Poleas'], 'los músculos secundarios cuentan, después de los principales')
  const algunas: any = await tools.buscar_ejercicios({ texto: 'jalon polea' })
  igual(buscados(algunas), ['Lat Pull Down', 'Remo Poleas'], 'sin todas las palabras, trae los que tienen alguna')
  cierto(String(algunas.structuredContent.aviso).includes('alguna'), 'y lo dice')
  const exacta: any = await tools.buscar_ejercicios({ texto: 'remo polea' })
  igual(buscados(exacta), ['Remo Poleas'], 'con todas las palabras, solo esos')
  cierto(exacta.structuredContent.aviso === undefined, 'sin aviso cuando sí hubo')
  ok('buscar_ejercicios: plural, grupos, categorías y músculos secundarios')
}

/* ---- crear_ejercicio: el tope, de punta a punta ---- */
{
  const { tools, insertados } = herramientas(herramientasDelCoach)
  const sinDatos = await tools.crear_ejercicio({ nombre: 'Nordic curl 2' })
  igual([sinDatos.isError, sinDatos.structuredContent.guardado, sinDatos.structuredContent.motivo], [undefined, false, 'faltan_datos_del_ejercicio'], 'solo con el nombre: no guarda y pregunta')
  igual(insertados.length, 0, 'no escribió nada en la base')
  cierto(sinDatos.structuredContent.pregunta.includes('Rotadores') || sinDatos.structuredContent.opciones.grupos_musculares.includes('Rotadores'), 'ofrece también los grupos propios del coach')
  igual(sinDatos.structuredContent.opciones.categorias, ['Fuerza', 'Hipertrofia', 'Potencia'], 'y las categorías reales')
  igual(sinDatos.structuredContent.opciones.equipos.slice(0, 2), ['Barra', 'Mancuerna'], 'y el equipo que más hay')

  const asi = await tools.crear_ejercicio({ nombre: 'Nordic curl 2', sin_datos: true })
  igual([asi.structuredContent.listo, insertados.length], [true, 1], '«así»: se guarda solo con el nombre')
  igual([insertados[0].fila.name, insertados[0].fila.category_id, insertados[0].fila.categorias_secundarias], ['Nordic curl 2', null, []], 'sin categoría y sin secundarias vacías raras')

  const completo = await tools.crear_ejercicio({ nombre: 'Trap bar jump', categoria: 'potencia', categorias_secundarias: ['Fuerza', 'Potencia'], musculos_principales: ['Piernas'] })
  igual(completo.structuredContent.listo, true, 'con datos se guarda sin preguntar')
  igual([insertados[1].fila.category_id, insertados[1].fila.categorias_secundarias, insertados[1].fila.muscle_primary], ['c-potencia', ['c-fuerza'], ['Piernas']], 'la categoría principal no se repite entre las secundarias')

  const soloCategoria = await tools.crear_ejercicio({ nombre: 'Algo con categoría', categoria: 'Fuerza' })
  igual(soloCategoria.structuredContent.listo, true, 'un solo dato basta: ya dijo lo que quería')

  const repetido = await tools.crear_ejercicio({ nombre: 'lat pulldown', sin_datos: true })
  igual(repetido.isError, true, 'un nombre que ya existe sigue siendo un aviso')
  cierto(String(repetido.content[0].text).includes('Ya existe "Lat Pull Down"'), 'y dice cuál')

  const mala = await tools.crear_ejercicio({ nombre: 'Otro', categoria: 'Inventada' })
  cierto(mala.isError && String(mala.content[0].text).includes('Fuerza, Hipertrofia, Potencia'), 'una categoría que no existe lista las que hay')
  ok('crear_ejercicio: pregunta una vez, «así» guarda solo el nombre, y con datos guarda directo')
}
{
  const { tools } = herramientas(herramientasDelCoach)
  const c: any = (await tools.ver_catalogos({})).structuredContent
  cierto(c.grupos_musculares.includes('Piernas') && c.grupos_musculares.includes('Rotadores'), 'ver_catalogos trae los grupos de siempre y los propios')
  igual(c.categorias.map((x: any) => x.nombre), ['Fuerza', 'Hipertrofia', 'Potencia'], 'y las categorías')
  cierto(c.equipos_mas_usados.includes('Polea'), 'y el equipo que más se usa')
  ok('ver_catalogos enseña grupos musculares y equipo')
}

/* ---- editar_dia: lo nuevo que no está en el catálogo se pregunta; lo que el plan ya tenía, no ---- */
{
  const { tools, actualizados } = herramientas(herramientasDelCoach, { profiles: [ATLETA_FALSO], plans: [PLAN_FALSO()] })
  // Leer el día y reescribirlo igual (con su ejercicio «Movilidad 90/90», que nunca estuvo en el catálogo): pasa sin preguntar.
  const igualQueAntes = await tools.editar_dia({ atleta: 'zz_atleta', dia: 'lunes', sesiones: [{ nombre: 'Fuerza', ejercicios: [{ nombre: 'Back Squat', series: 3, cantidad: 5 }, { nombre: 'Movilidad 90/90', series: 2, cantidad: 10 }] }] })
  igual([igualQueAntes.structuredContent?.listo, actualizados.length], [true, 1], 'reescribir lo que ya tenía no se frena')
  cierto(igualQueAntes.structuredContent.sin_ficha === undefined, 'ni avisa «sin ficha» de lo que ya estaba')

  // Un ejercicio nuevo con otro nombre: no se guarda nada.
  const nuevo = await tools.editar_dia({ atleta: 'zz_atleta', dia: 'lunes', sesiones: [{ ejercicios: [{ nombre: 'Back Squat' }, { nombre: 'Jalón en poleas' }] }] })
  igual([nuevo.isError, nuevo.structuredContent.guardado, nuevo.structuredContent.motivo], [undefined, false, 'ejercicios_fuera_del_catalogo'], 'un ejercicio nuevo que no está en el catálogo: pregunta')
  igual(actualizados.length, 1, 'y no escribió nada más en la base')
  igual(nuevo.structuredContent.pendientes.map((x: any) => x.escrito), ['Jalón en poleas'], 'solo por el que falta')

  // Ya contestó: se guarda y avisa que quedó sin ficha.
  const confirmado = await tools.editar_dia({ atleta: 'zz_atleta', dia: 'lunes', sesiones: [{ ejercicios: [{ nombre: 'Back Squat' }, { nombre: 'Jalón en poleas' }] }], sin_ficha_ok: ['Jalón en poleas'] })
  igual([confirmado.structuredContent.listo, actualizados.length], [true, 2], 'con la confirmación se guarda')
  igual(confirmado.structuredContent.sin_ficha, ['Jalón en poleas'], 'y avisa cuál quedó sin ficha')

  // Con el nombre exacto del catálogo (aunque cambien espacios o mayúsculas) se liga sola, sin preguntar.
  const exacto = await tools.editar_dia({ atleta: 'zz_atleta', dia: 'lunes', sesiones: [{ ejercicios: [{ nombre: 'lat pulldown' }, { nombre: 'PULL UPS' }] }] })
  igual([exacto.structuredContent.listo, actualizados.length], [true, 3], 'con el nombre del catálogo se guarda directo')
  const guardado = actualizados[2].cambios.data.phases[0].weekData[0].days[0].exercises
  igual(guardado.map((e: any) => [e.name, e.exercise_id]), [['Lat Pull Down', 'id-latpulldown'], ['Pull Ups', 'id-pullup']], 'ligados a su ficha, con el nombre del catálogo')
  ok('editar_dia: pregunta por lo nuevo, no frena lo que el plan ya tenía, y con la confirmación guarda')
}

/* ---- crear_plan: lo mismo, y al reemplazar tampoco se discute lo que ya tenía ---- */
{
  const { tools, insertados } = herramientas(herramientasDelCoach, { profiles: [ATLETA_FALSO], plans: [] })
  const sesiones = (nombre: string) => [{ dia: 'lunes', nombre: 'Día 1', ejercicios: [{ nombre: 'Back Squat', series: 4, cantidad: 8 }, { nombre }] }]
  const pregunta1 = await tools.crear_plan({ atleta: 'zz_atleta', titulo: 'Nuevo', tipo: 'rutina', sesiones: sesiones('Rumanian Deadlift') })
  igual([pregunta1.structuredContent.guardado, insertados.length], [false, 0], 'crear un plan con un nombre que no está: pregunta y no escribe')
  igual(pregunta1.structuredContent.pendientes[0].escrito, 'Rumanian Deadlift', 'dice cuál')
  const bien = await tools.crear_plan({ atleta: 'zz_atleta', titulo: 'Nuevo', tipo: 'rutina', sesiones: sesiones('Rumanian Deadlift'), sin_ficha_ok: ['Rumanian Deadlift'] })
  igual([bien.structuredContent.listo, insertados.length], [true, 1], 'con la confirmación se crea')
  igual(bien.structuredContent.sin_ficha, ['Rumanian Deadlift'], 'y avisa que quedó sin ficha')
  const directo = await tools.crear_plan({ atleta: 'zz_atleta', titulo: 'Otro', tipo: 'rutina', sesiones: sesiones('Hamstring Curl') })
  igual([directo.structuredContent.listo, directo.structuredContent.sin_ficha], [true, undefined], 'con todo en el catálogo se crea directo')
  ok('crear_plan: pregunta por lo que no está en el catálogo y con la confirmación crea')
}
{
  // Reemplazar un plan: lo que el plan anterior ya tenía no se vuelve a discutir.
  const { tools, actualizados } = herramientas(herramientasDelCoach, { profiles: [ATLETA_FALSO], plans: [PLAN_FALSO()] })
  const r = await tools.crear_plan({
    atleta: 'zz_atleta', titulo: 'Rutina', tipo: 'rutina', reemplazar: true,
    sesiones: [{ dia: 'lunes', ejercicios: [{ nombre: 'Back Squat' }, { nombre: 'Movilidad 90/90' }] }],
  })
  igual([r.structuredContent.listo, actualizados.length], [true, 1], 'reemplazar con lo que ya tenía no se frena')
  const sin = await tools.crear_plan({ atleta: 'zz_atleta', titulo: 'Rutina', tipo: 'rutina', sesiones: [{ dia: 'lunes', ejercicios: [{ nombre: 'Back Squat' }] }] })
  cierto(sin.isError && String(sin.content[0].text).includes('reemplazar: true'), 'sin «reemplazar» sigue el aviso de siempre (antes de preguntar nada)')
  ok('crear_plan con reemplazo: no vuelve a discutir lo que el plan anterior ya tenía')
}

console.log(`\nTodo bien: ${n} grupos de pruebas`)
