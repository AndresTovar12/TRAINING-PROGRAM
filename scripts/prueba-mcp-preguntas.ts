// Prueba de CUÁNDO PREGUNTA la IA al usar el conector (7 oct 2026, ejemplos de Andrés): los topes que el
// conector revisa solo (`preguntas.ts`) y que leer un día y reescribirlo no vuelve a discutir lo ya guardado.
//
//   deno run -A scripts/prueba-mcp-preguntas.ts
import { diaDesdeEntrada, firmasDeGrupos, nombresDeEjercicios } from '../supabase/functions/mcp/plan.ts'
import { NOMBRE_DIA } from '../supabase/functions/mcp/util.ts'
import { equiposMasUsados, esUnilateral, exigirRespuestas, nuevaRevision, parecidosA, preguntaDeDatos, vistaPrevia, type ItemDeCatalogo, type Renglon, type Revision } from '../supabase/functions/mcp/preguntas.ts'
import { Pregunta, fechaDelAtleta, llaveDeNombre, mismoNombre, palabrasClave, seguro } from '../supabase/functions/mcp/util.ts'
import { herramientasComunes } from '../supabase/functions/mcp/comunes.ts'
import { herramientasDelCoach } from '../supabase/functions/mcp/coach.ts'
import { herramientasDelAtleta } from '../supabase/functions/mcp/atleta.ts'
import { z } from 'npm:zod@^4.1.13'

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
  item('Step Ups', 'Mancuerna', 'Hipertrofia', ['Cuádriceps', 'Glúteo']),
]
const nombres = (l: ItemDeCatalogo[]) => l.map((e) => e.name)

/** Una revisión armada a mano, para probar `exigirRespuestas` sin pasar por un día entero. */
const revision = (o: Partial<{ sinFicha: string[]; sinCantidad: string[]; porLado: string[]; dias: { titulo: string; lista: Renglon[] }[] }> = {}): Revision => {
  const r = nuevaRevision()
  ;(o.sinFicha ?? []).forEach((n) => r.sinFicha.add(n))
  ;(o.sinCantidad ?? []).forEach((n) => r.sinCantidad.add(n))
  ;(o.porLado ?? []).forEach((n) => r.porLado.add(n))
  r.dias.push(...(o.dias ?? []))
  return r
}
const renglon = (nombre: string, grupo: number | null = null, series = '3', cantidad = '8'): Renglon => ({ nombre, grupo, series, cantidad })

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
  const p = pregunta(() => exigirRespuestas({ revision: revision({ sinFicha: ['jalón en poleas'] }), catalogo: CATALOGO }))
  igual(p.datos.guardado, false, 'no se guardó')
  igual(p.datos.motivo, 'faltan_respuestas', 'dice por qué')
  igual((p.datos.pendientes as any).catalogo.map((x: any) => [x.escrito, x.caso]), [['jalón en poleas', 'ninguno']], 'dice cuál nombre falta, y que ningún parecido sirve (la IA lo busca ella)')
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
  const p = pregunta(() => exigirRespuestas({ revision: revision({ sinFicha: ['Rumanian Deadlift', 'sentadilla', 'press de hombro'] }), catalogo: CATALOGO }))
  const casos = Object.fromEntries((p.datos.pendientes as any).catalogo.map((x: any) => [x.escrito, x.caso]))
  igual(casos, { 'Rumanian Deadlift': 'uno', sentadilla: 'ninguno', 'press de hombro': 'varios' }, 'cada pendiente dice si hay uno, varios o ninguno')
  const hombro = (p.datos.pendientes as any).catalogo.find((x: any) => x.escrito === 'press de hombro')
  cierto(hombro.parecidos.some((x: any) => x.nombre === 'Barbell Shoulder Press' && x.equipo === 'Barra'), 'con su equipo, para poder preguntar «¿barra o mancuerna?»')
  cierto(hombro.parecidos.some((x: any) => x.nombre === 'Dumbbell Shoulder Press' && x.equipo === 'Mancuerna'), 'los dos, con su equipo')
  ok('los parecidos salen con su equipo, y cada pendiente dice uno / varios / ninguno')
}
{
  // La persona ya contestó: la IA repite con `sin_ficha_ok` y se guarda sin preguntar.
  const aceptado = exigirRespuestas({ revision: revision({ sinFicha: ['Movilidad 90/90', 'Nordic Curl 2'] }), catalogo: CATALOGO, respuestas: { sin_ficha_ok: ['movilidad 90/90', 'Nordic curl 2'] } })
  igual(aceptado.sinFicha, ['Movilidad 90/90', 'Nordic Curl 2'], 'lo confirmado va tal cual (sin importar mayúsculas)')
  // Confirmó uno pero falta otro: se pregunta solo por el que falta.
  const p = pregunta(() => exigirRespuestas({ revision: revision({ sinFicha: ['Movilidad 90/90', 'Zancada rara'] }), catalogo: CATALOGO, respuestas: { sin_ficha_ok: ['Movilidad 90/90'] } }))
  igual((p.datos.pendientes as any).catalogo.map((x: any) => x.escrito), ['Zancada rara'], 'solo se pregunta por el que falta')
  // El mismo nombre dos veces cuenta una.
  const q = pregunta(() => exigirRespuestas({ revision: revision({ sinFicha: ['Algo raro', 'algo raro'] }), catalogo: CATALOGO }))
  igual((q.datos.pendientes as any).catalogo.length, 1, 'un nombre repetido se pregunta una vez')
  ok('lo que la persona ya confirmó no se vuelve a preguntar')
}
{
  // Leer un día y reescribirlo: lo que el plan YA tenía (aunque no esté en el catálogo) no se vuelve a discutir.
  const plan = { data: { phases: [{ weekData: [{ days: [{ exercises: [{ name: 'Movilidad 90/90' }, { isNote: true, text: 'Calentar' }, { name: 'Back Squat' }] }] }] }] } } as any
  igual(nombresDeEjercicios(plan), ['Movilidad 90/90', 'Back Squat'], 'los nombres del plan, sin las notas')
  igual(nombresDeEjercicios(null), [], 'sin plan, ninguno')
  const yaTenia = { nombres: nombresDeEjercicios(plan), firmas: firmasDeGrupos(plan) }
  const aceptado = exigirRespuestas({ revision: revision({ sinFicha: ['Movilidad 90/90'] }), catalogo: CATALOGO, plan: yaTenia })
  igual(aceptado, { sinFicha: [], sinCantidad: [] }, 'lo que ya estaba en el plan pasa sin preguntar ni avisar')
  pregunta(() => exigirRespuestas({ revision: revision({ sinFicha: ['Movilidad 90/90', 'Hip thrust'] }), catalogo: CATALOGO, plan: yaTenia }))
  ok('reescribir un día no vuelve a discutir lo que el plan ya tenía; lo nuevo, sí')
}
{
  // Nada que preguntar: todo está en el catálogo con su nombre.
  const { sinFicha } = diaDesdeEntrada('Mar', { ejercicios: [{ nombre: 'Back Squat' }, { nota: 'Calentamiento' }, { nombre: 'pull ups' }] }, CATALOGO)
  igual(sinFicha, [], 'con todo en el catálogo no hay nada sin ficha')
  igual(exigirRespuestas({ revision: revision(), catalogo: CATALOGO }), { sinFicha: [], sinCantidad: [] }, 'y no hay nada que preguntar')
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
  const nuevo = await tools.editar_dia({ atleta: 'zz_atleta', dia: 'lunes', sesiones: [{ ejercicios: [{ nombre: 'Back Squat', cantidad: 5 }, { nombre: 'Jalón en poleas', cantidad: 10 }] }] })
  igual([nuevo.isError, nuevo.structuredContent.guardado, nuevo.structuredContent.motivo], [undefined, false, 'faltan_respuestas'], 'un ejercicio nuevo que no está en el catálogo: pregunta')
  igual(actualizados.length, 1, 'y no escribió nada más en la base')
  igual(nuevo.structuredContent.pendientes.catalogo.map((x: any) => x.escrito), ['Jalón en poleas'], 'solo por el que falta')

  // Ya contestó: se guarda y avisa que quedó sin ficha.
  const confirmado = await tools.editar_dia({ atleta: 'zz_atleta', dia: 'lunes', sesiones: [{ ejercicios: [{ nombre: 'Back Squat', cantidad: 5 }, { nombre: 'Jalón en poleas', cantidad: 10 }] }], sin_ficha_ok: ['Jalón en poleas'] })
  igual([confirmado.structuredContent.listo, actualizados.length], [true, 2], 'con la confirmación se guarda')
  igual(confirmado.structuredContent.sin_ficha, ['Jalón en poleas'], 'y avisa cuál quedó sin ficha')

  // Con el nombre exacto del catálogo (aunque cambien espacios o mayúsculas) se liga sola, sin preguntar.
  const exacto = await tools.editar_dia({ atleta: 'zz_atleta', dia: 'lunes', sesiones: [{ ejercicios: [{ nombre: 'lat pulldown', cantidad: 10 }, { nombre: 'PULL UPS', cantidad: 8 }] }] })
  igual([exacto.structuredContent.listo, actualizados.length], [true, 3], 'con el nombre del catálogo se guarda directo')
  const guardado = actualizados[2].cambios.data.phases[0].weekData[0].days[0].exercises
  igual(guardado.map((e: any) => [e.name, e.exercise_id]), [['Lat Pull Down', 'id-latpulldown'], ['Pull Ups', 'id-pullup']], 'ligados a su ficha, con el nombre del catálogo')
  ok('editar_dia: pregunta por lo nuevo, no frena lo que el plan ya tenía, y con la confirmación guarda')
}

/* ---- crear_plan: lo mismo, y al reemplazar tampoco se discute lo que ya tenía ---- */
{
  const { tools, insertados } = herramientas(herramientasDelCoach, { profiles: [ATLETA_FALSO], plans: [] })
  const sesiones = (nombre: string) => [{ dia: 'lunes', nombre: 'Día 1', ejercicios: [{ nombre: 'Back Squat', series: 4, cantidad: 8 }, { nombre, series: 3, cantidad: 8 }] }]
  const pregunta1 = await tools.crear_plan({ atleta: 'zz_atleta', titulo: 'Nuevo', tipo: 'rutina', sesiones: sesiones('Rumanian Deadlift') })
  igual([pregunta1.structuredContent.guardado, insertados.length], [false, 0], 'crear un plan con un nombre que no está: pregunta y no escribe')
  igual(pregunta1.structuredContent.pendientes.catalogo[0].escrito, 'Rumanian Deadlift', 'dice cuál')
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
    sesiones: [{ dia: 'lunes', ejercicios: [{ nombre: 'Back Squat', cantidad: 5 }, { nombre: 'Movilidad 90/90', cantidad: 10 }] }],
  })
  igual([r.structuredContent.listo, actualizados.length], [true, 1], 'reemplazar con lo que ya tenía no se frena')
  const sin = await tools.crear_plan({ atleta: 'zz_atleta', titulo: 'Rutina', tipo: 'rutina', sesiones: [{ dia: 'lunes', ejercicios: [{ nombre: 'Back Squat', cantidad: 5 }] }] })
  cierto(sin.isError && String(sin.content[0].text).includes('reemplazar: true'), 'sin «reemplazar» sigue el aviso de siempre (antes de preguntar nada)')
  ok('crear_plan con reemplazo: no vuelve a discutir lo que el plan anterior ya tenía')
}

/* ================================================================== */
/* Cantidad que falta, «por lado» y biseries: tu ejemplo de la rutina   */
/* ================================================================== */

/** Tu rutina del ejemplo 2, con los nombres tal cual están en el catálogo y los grupos que separó con líneas en blanco. */
const RUTINA = [
  { nombre: 'Back Squat', series: 4, cantidad: 8 },
  { nombre: 'Romanian Deadlift', series: 3, cantidad: 8, grupo: 1 },
  { nombre: 'Assisted Pistol Squat', series: 3, cantidad: 8, grupo: 1 },
  { nombre: 'Step Ups', series: 3, cantidad: 6, grupo: 2 },
  { nombre: 'Bulgarian Split Squat', series: 3, cantidad: 6, grupo: 2 },
  { nombre: 'Squat Jump', grupo: 2 },
]
const revisaDia = (ejercicios: any[], titulo = 'Sábado') => {
  const r = nuevaRevision()
  const armado = diaDesdeEntrada('Sáb', { ejercicios }, CATALOGO)
  for (const [k, v] of [['sinFicha', armado.sinFicha], ['sinCantidad', armado.sinCantidad], ['porLado', armado.porLado]] as const) v.forEach((n: string) => r[k].add(n))
  r.dias.push({ titulo, lista: armado.lista })
  return r
}

{
  for (const si of ['Pistol Squat', 'Assisted Pistol Squat', 'Step Ups', 'Bulgarian Split Squat', 'Walking Lunge', 'Single-Leg RDL', 'One Arm Row', 'Glute Kickback', 'Zancada caminando', 'Remo a una mano']) {
    cierto(esUnilateral(si), `«${si}» va a una pierna o un brazo`)
  }
  for (const no of ['Back Squat', 'Squat Jump', 'RDL', 'Bench Press', 'Lat Pull Down', 'Hamstring Curl', 'Face Pulls']) {
    cierto(!esUnilateral(no), `«${no}» no es unilateral`)
  }
  ok('los ejercicios a una pierna o un brazo se reconocen por su nombre')
}
{
  const armado = diaDesdeEntrada('Sáb', { ejercicios: RUTINA }, CATALOGO)
  igual(armado.sinCantidad, ['Squat Jump'], 'detecta el ejercicio sin repeticiones ni tiempo')
  igual(armado.porLado, ['Assisted Pistol Squat', 'Step Ups', 'Bulgarian Split Squat'], 'y los unilaterales sin decir si cuentan por lado')
  igual(armado.lista.map((r) => [r.nombre, r.grupo]), [
    ['Back Squat', null], ['Romanian Deadlift', 1], ['Assisted Pistol Squat', 1], ['Step Ups', 2], ['Bulgarian Split Squat', 2], ['Squat Jump', 2],
  ], 'y la lista de cómo quedó, con sus grupos')
  // Decir «por_lado» (true o false) o dar la cantidad lo resuelve.
  const resuelto = diaDesdeEntrada('Sáb', { ejercicios: RUTINA.map((e) => (e.nombre === 'Squat Jump' ? { ...e, cantidad: 10 } : ['Step Ups', 'Assisted Pistol Squat'].includes(e.nombre) ? { ...e, por_lado: true } : e.nombre === 'Bulgarian Split Squat' ? { ...e, por_lado: false } : e)) }, CATALOGO)
  igual([resuelto.sinCantidad, resuelto.porLado], [[], []], 'con la cantidad y el «por lado» dicho (true o false) ya no falta nada')
  // Un grupo con reloj (AMRAP…) ya dice cuánto dura.
  const reloj = diaDesdeEntrada('Sáb', { ejercicios: [
    { nombre: 'Squat Jump', grupo: 1, formato: { id: 'amrap', pasos: [{ tipo: 'trabajo', seg: 720 }], vueltas: 1, anota: 'rondas' } },
    { nombre: 'Back Squat', grupo: 1 },
  ] }, CATALOGO)
  igual(reloj.sinCantidad, [], 'un grupo con reloj no necesita cantidad')
  const pasos = diaDesdeEntrada('Sáb', { ejercicios: [{ nombre: 'Back Squat', series: 4, por_vuelta: [{ cantidad: 10 }, { cantidad: 8 }, { cantidad: 6 }, { cantidad: 4 }] }] }, CATALOGO)
  igual(pasos.sinCantidad, [], 'ni uno con la cantidad de cada vuelta')
  ok('al armar un día se anota lo que falta: cantidad y «por lado»')
}
{
  // Tu ejemplo 2 tal cual lo habría mandado la IA: todo junto en UNA pregunta.
  const p = pregunta(() => exigirRespuestas({ revision: revisaDia(RUTINA), catalogo: CATALOGO }))
  igual(p.datos.motivo, 'faltan_respuestas', 'no guarda')
  const preguntas = p.datos.preguntas as string[]
  igual(preguntas.length, 3, 'tres preguntas, todas juntas')
  cierto(preguntas[0].startsWith('¿Assisted Pistol Squat, Step Ups y Bulgarian Split Squat cuentan por lado'), 'primero el «por lado» de los tres, como en tu ejemplo')
  cierto(preguntas[1].startsWith('Squat Jump no trae repeticiones ni tiempo: ¿cuántas pongo, o lo dejo así?'), 'luego la cantidad que falta')
  igual(preguntas[2], 'Armé la rutina así, ¿está bien?\nBack Squat 4×8\nBI SERIE\n  Romanian Deadlift 3×8\n  Assisted Pistol Squat 3×8\nTRI SERIE\n  Step Ups 3×6\n  Bulgarian Split Squat 3×6\n  Squat Jump 3 series', 'y la rutina armada con su BI SERIE y su TRI SERIE para confirmarla')
  cierto(String(p.datos.que_hacer).includes('UN solo mensaje') && String(p.datos.que_hacer).includes('estructura_ok'), 'dice cómo seguir')
  cierto((p.datos.pendientes as any).catalogo === undefined, 'sin preguntas de catálogo si todo estaba en el catálogo')
  ok('la rutina del ejemplo 2: «por lado», cantidad y biseries, en un solo mensaje')
}
{
  // Ya contestó todo: se guarda.
  const completo = RUTINA.map((e) => (e.nombre === 'Squat Jump' ? { ...e, cantidad: 10 } : { ...e, por_lado: ['Assisted Pistol Squat', 'Step Ups', 'Bulgarian Split Squat'].includes(e.nombre) ? true : undefined }))
  const sinConfirmar = pregunta(() => exigirRespuestas({ revision: revisaDia(completo), catalogo: CATALOGO }))
  igual((sinConfirmar.datos.preguntas as string[]).length, 1, 'con todo contestado solo falta confirmar la estructura')
  cierto((sinConfirmar.datos.preguntas as string[])[0].startsWith('Armé la rutina así'), 'que se le enseña')
  const listo = exigirRespuestas({ revision: revisaDia(completo), catalogo: CATALOGO, respuestas: { estructura_ok: true } })
  igual(listo, { sinFicha: [], sinCantidad: [] }, 'confirmada la estructura, se guarda')
  // «Así lo mando» sin cantidad.
  const sinReps = exigirRespuestas({ revision: revisaDia(RUTINA.map((e) => (e.nombre === 'Squat Jump' ? e : { ...e, por_lado: ['Assisted Pistol Squat', 'Step Ups', 'Bulgarian Split Squat'].includes(e.nombre) ? true : undefined }))), catalogo: CATALOGO, respuestas: { estructura_ok: true, sin_cantidad_ok: ['squat jump'] } })
  igual(sinReps.sinCantidad, ['Squat Jump'], '«así lo mando»: se guarda sin cantidad y se avisa')
  ok('con las respuestas dadas, se guarda sin volver a preguntar')
}
{
  // Sin biseries no hay nada que confirmar: un cambio simple se hace directo.
  const simple = revisaDia([{ nombre: 'Back Squat', series: 4, cantidad: 8 }, { nombre: 'Lat Pull Down', series: 3, cantidad: 10 }])
  igual(exigirRespuestas({ revision: simple, catalogo: CATALOGO }), { sinFicha: [], sinCantidad: [] }, 'sin biseries, con cantidad y sin unilaterales: se guarda directo')
  // Lo que el plan ya tenía (leer un día y reescribirlo) no se vuelve a discutir: ni la estructura ni el «por lado» ni la cantidad.
  const plan = { data: { phases: [{ weekData: [{ days: [{ exercises: [
    { name: 'Step Ups', set: 2, sets: '3', reps: '6' }, { name: 'Bulgarian Split Squat', set: 2, sets: '3', reps: '6' }, { name: 'Squat Jump', set: 2, sets: '3', reps: '' },
  ] }] }] }] } } as any
  const yaTenia = { nombres: nombresDeEjercicios(plan), firmas: firmasDeGrupos(plan) }
  igual([...yaTenia.firmas], ['bulgariansplitsquat|squatjump|stepup'], 'el plan reconoce su triserie por los nombres, sin importar el orden')
  const reescrito = revisaDia([{ nombre: 'Squat Jump', grupo: 2 }, { nombre: 'Step Ups', series: 3, cantidad: 6, grupo: 2 }, { nombre: 'Bulgarian Split Squat', series: 3, cantidad: 6, grupo: 2 }])
  igual(exigirRespuestas({ revision: reescrito, catalogo: CATALOGO, plan: yaTenia }), { sinFicha: [], sinCantidad: [] }, 'reescribir lo que ya estaba no pregunta nada')
  // Pero una agrupación NUEVA sí se confirma.
  const nueva = revisaDia([{ nombre: 'Back Squat', series: 3, cantidad: 5, grupo: 1 }, { nombre: 'Step Ups', series: 3, cantidad: 6, grupo: 1 }])
  const p = pregunta(() => exigirRespuestas({ revision: nueva, catalogo: CATALOGO, plan: yaTenia }))
  cierto((p.datos.preguntas as string[]).some((x) => x.includes('BI SERIE')), 'una agrupación nueva se enseña para confirmarla')
  ok('reescribir un día no pregunta lo que ya estaba; una biserie nueva sí se confirma')
}
{
  igual(vistaPrevia([renglon('A', null, '4', '8'), renglon('B', 1), renglon('C', 1), renglon('D', 2), renglon('E', 2), renglon('F', 2), renglon('G', 3), renglon('H', 3), renglon('I', 3), renglon('J', 3)]), [
    'A 4×8', 'BI SERIE', '  B 3×8', '  C 3×8', 'TRI SERIE', '  D 3×8', '  E 3×8', '  F 3×8', 'CIRCUITO', '  G 3×8', '  H 3×8', '  I 3×8', '  J 3×8',
  ], 'dos son biserie, tres triserie y más, circuito; los solos, sin etiqueta')
  igual(vistaPrevia([renglon('A', 1), renglon('B', 2)]), ['A 3×8', 'B 3×8'], 'un grupo de un solo ejercicio no es una biserie')
  ok('la rutina armada se enseña con BI SERIE, TRI SERIE y CIRCUITO')
}

/* ---- Una rutina pegada de golpe sin ningún grupo: ¿de verdad van todos separados? ---- */
{
  const sinGrupos = RUTINA.map(({ grupo: _g, ...e }) => ({ ...e, ...(e.nombre === 'Squat Jump' ? { cantidad: 10 } : {}), por_lado: ['Assisted Pistol Squat', 'Step Ups', 'Bulgarian Split Squat'].includes(e.nombre) ? true : undefined }))
  const p = pregunta(() => exigirRespuestas({ revision: revisaDia(sinGrupos), catalogo: CATALOGO }))
  igual((p.datos.pendientes as any).agrupar, ['Sábado'], 'seis ejercicios nuevos y ningún grupo: le pide a la IA que revise el mensaje de la persona')
  igual(p.datos.preguntas, undefined, 'no es una pregunta para la persona (todavía)')
  cierto(String(p.datos.que_hacer).includes('AGRUPAR') && String(p.datos.que_hacer).includes('estructura_ok: true'), 'dice cómo seguir: agrupar con `grupo` o confirmar que todos van separados')
  cierto(String(p.datos.mensaje).includes('agrupados'), 'y el mensaje lo dice')
  // Si todos van separados, lo dice y sigue.
  igual(exigirRespuestas({ revision: revisaDia(sinGrupos), catalogo: CATALOGO, respuestas: { estructura_ok: true } }), { sinFicha: [], sinCantidad: [] }, 'con estructura_ok: true se guarda')
  // Con menos de 4 ejercicios nuevos no se pregunta nada: un cambio simple se hace directo.
  const tres = revisaDia(sinGrupos.slice(0, 3))
  igual(exigirRespuestas({ revision: tres, catalogo: CATALOGO }).sinFicha, [], 'tres ejercicios sin grupo se guardan directo')
  // Reescribir lo que el plan ya tenía (aunque sean seis sin grupo) no se frena.
  const plan = { data: { phases: [{ weekData: [{ days: [{ exercises: sinGrupos.map((e) => ({ name: e.nombre })) }] }] }] } } as any
  igual(exigirRespuestas({ revision: revisaDia(sinGrupos), catalogo: CATALOGO, plan: { nombres: nombresDeEjercicios(plan), firmas: firmasDeGrupos(plan) } }), { sinFicha: [], sinCantidad: [] }, 'reescribir un día con los mismos ejercicios no se frena')
  // Con grupos, ya no es «agrupar»: toca confirmar la estructura.
  const conGrupos = pregunta(() => exigirRespuestas({ revision: revisaDia(RUTINA.map((e) => (e.nombre === 'Squat Jump' ? { ...e, cantidad: 10 } : { ...e, por_lado: ['Assisted Pistol Squat', 'Step Ups', 'Bulgarian Split Squat'].includes(e.nombre) ? true : undefined }))), catalogo: CATALOGO }))
  igual((conGrupos.datos.pendientes as any).agrupar, undefined, 'con grupos ya no pide agrupar')
  cierto((conGrupos.datos.preguntas as string[])[0].includes('3×6 por lado'), 'y la rutina armada enseña el «por lado»')
  ok('una rutina pegada sin grupos: la IA tiene que revisar el mensaje antes de guardar')
}

/* ---- De punta a punta con la base de mentira: tu ejemplo 2 en editar_dia ---- */
{
  const extras = [
    fila('RDL', 'Barra', 'Fuerza', ['Isquios', 'Glúteo']), fila('Pistol Squat', 'Peso corporal', 'Atlético', ['Piernas', 'Core']),
    fila('Step Ups', 'Mancuerna', 'Hipertrofia', ['Cuádriceps', 'Glúteo']), fila('Bulgarian Split Squat', 'Mancuerna', 'Hipertrofia', ['Cuádriceps', 'Glúteo']),
    fila('Squat Jump', 'Peso corporal', 'Pliometría', ['Cuádriceps', 'Glúteo']),
  ]
  const { tools, actualizados } = herramientas(herramientasDelCoach, { exercises: [...EJERCICIOS, ...extras], profiles: [ATLETA_FALSO], plans: [PLAN_FALSO()] })
  // Lo que mandó ChatGPT la primera vez (se vio en su permiso): nombres bien, pero sin grupos, sin «por lado» y sin reps en el último.
  const comoChatGPT = [
    { nombre: 'Back Squat', series: 4, cantidad: 8 }, { nombre: 'RDL', series: 3, cantidad: 8 }, { nombre: 'Pistol Squat', series: 3, cantidad: 8 },
    { nombre: 'Step Ups', series: 3, cantidad: 6 }, { nombre: 'Bulgarian Split Squat', series: 3, cantidad: 6 }, { nombre: 'Squat Jump' },
  ]
  const primera = await tools.editar_dia({ atleta: 'zz_atleta', dia: 'sábado', sesiones: [{ nombre: 'Sesión', ejercicios: comoChatGPT }] })
  igual([primera.structuredContent.guardado, actualizados.length], [false, 0], 'lo que mandó ChatGPT no se guarda: faltan respuestas')
  igual(primera.structuredContent.pendientes.por_lado, ['Pistol Squat', 'Step Ups', 'Bulgarian Split Squat'], 'pregunta el «por lado» de los tres')
  igual(primera.structuredContent.pendientes.sin_cantidad, ['Squat Jump'], 'y la cantidad que falta')
  igual(primera.structuredContent.pendientes.estructura, undefined, 'sin grupos no hay estructura que confirmar')
  igual(primera.structuredContent.pendientes.agrupar, ['Sábado · Sesión'], 'pero seis nuevos sin ningún grupo: que la IA revise el mensaje')

  // Con las respuestas y los grupos que separó con líneas en blanco: primero pide confirmar la estructura.
  const respondido = [
    { nombre: 'Back Squat', series: 4, cantidad: 8 }, { nombre: 'RDL', series: 3, cantidad: 8, grupo: 1 }, { nombre: 'Pistol Squat', series: 3, cantidad: 8, grupo: 1, por_lado: true },
    { nombre: 'Step Ups', series: 3, cantidad: 6, grupo: 2, por_lado: true }, { nombre: 'Bulgarian Split Squat', series: 3, cantidad: 6, grupo: 2, por_lado: true }, { nombre: 'Squat Jump', cantidad: 10, grupo: 2 },
  ]
  const segunda = await tools.editar_dia({ atleta: 'zz_atleta', dia: 'sábado', sesiones: [{ nombre: 'Sesión', ejercicios: respondido }] })
  igual([segunda.structuredContent.guardado, actualizados.length], [false, 0], 'con todo contestado todavía pide confirmar las biseries')
  cierto(segunda.structuredContent.preguntas[0].startsWith('Armé la rutina así'), 'enseñándolas')

  const tercera = await tools.editar_dia({ atleta: 'zz_atleta', dia: 'sábado', sesiones: [{ nombre: 'Sesión', ejercicios: respondido }], estructura_ok: true })
  igual([tercera.structuredContent.listo, actualizados.length], [true, 1], 'confirmada, se guarda')
  const guardado = actualizados[0].cambios.data.phases[0].weekData[0].days.find((d: any) => d.day === 'Sáb').exercises
  igual(guardado.map((e: any) => [e.name, e.set ?? null, e.porLado === true, e.reps]), [
    ['Back Squat', null, false, '8'], ['RDL', 1, false, '8'], ['Pistol Squat', 1, true, '8'],
    ['Step Ups', 2, true, '6'], ['Bulgarian Split Squat', 2, true, '6'], ['Squat Jump', 2, false, '10'],
  ], 'quedó con su biserie, su triserie, el «por lado» y las reps')

  // Reescribirlo igual después: ya estaba todo, no se pregunta nada. (El plan de la base falsa no cambia: se compara con el de antes.)
  const { tools: t2, actualizados: a2 } = herramientas(herramientasDelCoach, { exercises: [...EJERCICIOS, ...extras], profiles: [ATLETA_FALSO], plans: [{ ...PLAN_FALSO(), data: { kind: 'weekly', phases: [{ id: 'p-1', num: 1, name: 'Rutina semanal', weekData: [{ num: 1, label: '', load: '', days: [
    { day: 'Sáb', name: 'Sesión', cat: 'gym', exercises: guardado },
  ] }] }] } }] })
  const igualQueAntes = await t2.editar_dia({ atleta: 'zz_atleta', dia: 'sábado', sesiones: [{ nombre: 'Sesión', ejercicios: comoChatGPT.map((e) => ({ ...e })) }] })
  igual([igualQueAntes.structuredContent.listo, a2.length], [true, 1], 'reescribir un día que ya tenía todo no vuelve a preguntar')
  ok('editar_dia con tu ejemplo 2: pregunta «por lado» y reps, confirma las biseries y guarda')
}

/* ---- ver_atleta: la sesión de HOY completa, sin pedirla aparte ---- */
{
  const dias = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
  const hoyEs = fechaDelAtleta().dia
  const planDeSemana = (diasConSesion: string[]) => ({
    ...PLAN_FALSO(),
    data: { kind: 'weekly', phases: [{ id: 'p-1', num: 1, name: 'Rutina semanal', weekData: [{ num: 1, label: '', load: '', days: diasConSesion.map((d) => ({
      day: d, name: `Sesión ${d}`, cat: 'gym', exercises: [
        { name: 'Back Squat', exercise_id: 'id-backsquat', sets: '4', reps: '8' },
        { name: 'Step Ups', sets: '3', reps: '6', porLado: true, set: 1 }, { name: 'Squat Jump', sets: '3', reps: '10', set: 1 },
      ],
    })) }] }] },
  })
  // Con sesión todos los días: hoy trae los ejercicios de verdad.
  const { tools } = herramientas(herramientasDelCoach, { profiles: [ATLETA_FALSO], plans: [planDeSemana(dias)] })
  const con: any = (await tools.ver_atleta({ atleta: 'zz_atleta' })).structuredContent
  igual(con.hoy.length, 1, 'trae la sesión de hoy')
  igual(con.hoy[0].dia, hoyEs, 'del día de hoy')
  igual(con.hoy[0].ejercicios.map((e: any) => e.nombre), ['Back Squat', 'Step Ups', 'Squat Jump'], 'con sus ejercicios, completos')
  igual(con.hoy[0].ejercicios.map((e: any) => e.grupo ?? null), [null, 1, 1], 'con su biserie')
  igual(con.hoy[0].ejercicios[1].por_lado, true, 'y su «por lado»')
  cierto(con.plan !== undefined && con.ultimas_sesiones_hechas !== undefined, 'lo de siempre sigue ahí')
  // Sin sesión hoy: lo dice, no inventa.
  const otro = dias.find((d) => d !== hoyEs)!
  const { tools: t2 } = herramientas(herramientasDelCoach, { profiles: [ATLETA_FALSO], plans: [planDeSemana([otro])] })
  const sin: any = (await t2.ver_atleta({ atleta: 'zz_atleta' })).structuredContent
  igual(sin.hoy, { dia: NOMBRE_DIA[hoyEs], mensaje: 'Hoy no le toca sesión.' }, 'sin sesión hoy, lo dice')
  // Sin plan: sin «hoy».
  const { tools: t3 } = herramientas(herramientasDelCoach, { profiles: [ATLETA_FALSO], plans: [] })
  const sinPlan: any = (await t3.ver_atleta({ atleta: 'zz_atleta' })).structuredContent
  cierto(sinPlan.hoy === null || sinPlan.hoy === undefined, 'sin plan no hay sesión de hoy')
  ok('ver_atleta trae la sesión de hoy completa')
}

/* ---- Los esquemas que ve la IA: sin tipo doble en la fase ni topes gigantes ---- */
{
  const { tools } = herramientas(herramientasDelCoach, { profiles: [ATLETA_FALSO], plans: [PLAN_FALSO()] })
  // «fase» y «semana» llegan como texto a veces: se aceptan.
  const r: any = await tools.ver_plan_de_atleta({ atleta: 'zz_atleta', fase: '1', semana: '1' })
  cierto(r.structuredContent?.dias !== undefined, 'fase y semana como texto («1») se entienden')
  ok('fase y semana en texto o número dan igual')
}

/* ---- Lo que ve la IA: ningún esquema con topes gigantes de enteros ni la fase con tipo doble ---- */
{
  const esquemas: Record<string, any> = {}
  const captura = (rol: string) => ({ registerTool: (nombre: string, def: any) => { esquemas[`${rol}:${nombre}`] = z.toJSONSchema(z.object(def.inputSchema ?? {}), { target: 'draft-7', io: 'input' }) } })
  const quien: any = { id: 'x', usuario: 'x', nombre: 'X', rol: 'master', salud: false, unidad: 'kg', db: {} }
  herramientasComunes(captura('comunes'), quien)
  herramientasDelCoach(captura('coach'), quien)
  herramientasDelAtleta(captura('atleta'), { ...quien, rol: 'atleta' })
  const texto = JSON.stringify(esquemas)
  cierto(Object.keys(esquemas).length >= 40, `se revisaron ${Object.keys(esquemas).length} herramientas`)
  cierto(!texto.includes('9007199254740991'), 'ningún entero trae los topes gigantes (±9007199254740991)')
  cierto(!texto.includes('"type":"integer"'), 'ni «integer»: los números son números')
  for (const [nombre, e] of Object.entries(esquemas)) {
    const fase = e.properties?.fase
    if (fase) cierto(fase.type === 'string', `${nombre}: «fase» es solo texto (${JSON.stringify(fase.type)})`)
  }
  ok('los esquemas que ve la IA son simples: fase en texto y números sin topes gigantes')
}

/* ---- crear_plan también ---- */
{
  const { tools, insertados } = herramientas(herramientasDelCoach, { profiles: [ATLETA_FALSO], plans: [] })
  const sesiones = [{ dia: 'lunes', nombre: 'Día 1', ejercicios: [{ nombre: 'Back Squat', series: 4, cantidad: 8 }, { nombre: 'Lat Pull Down', series: 3 }] }]
  const p = await tools.crear_plan({ atleta: 'zz_atleta', titulo: 'Nuevo', tipo: 'rutina', sesiones })
  igual([p.structuredContent.guardado, insertados.length, p.structuredContent.pendientes.sin_cantidad], [false, 0, ['Lat Pull Down']], 'crear_plan también pide la cantidad que falta')
  const b = await tools.crear_plan({ atleta: 'zz_atleta', titulo: 'Nuevo', tipo: 'rutina', sesiones, sin_cantidad_ok: ['Lat Pull Down'] })
  igual([b.structuredContent.listo, insertados.length, b.structuredContent.sin_cantidad], [true, 1, ['Lat Pull Down']], 'con «así lo mando» se crea y se avisa')
  ok('crear_plan: pide la cantidad que falta y acepta «así lo mando»')
}

/* ---- Ciencia del plan: lo que escribe y lee la IA (7 oct 2026) ---- */
{
  const conCiencia = () => {
    const base = PLAN_FALSO()
    return { ...base, data: { ...base.data, foto: '/fotos/plan.jpg', ciencia: [{ id: 'c-1', titulo: 'Por qué esta rutina', texto: 'Frecuencia alta.' }] } }
  }
  const ultimo = (a: { cambios: any }[]) => a[a.length - 1].cambios.data

  // Agregar a un plan que no tiene: queda en data.ciencia, con su id, y no se pierde lo demás.
  {
    const base = { ...PLAN_FALSO(), data: { ...PLAN_FALSO().data, foto: '/fotos/plan.jpg' } }
    const { tools, actualizados } = herramientas(herramientasDelCoach, { profiles: [ATLETA_FALSO], plans: [base] })
    const r: any = await tools.editar_ciencia({ atleta: 'zz_atleta', recuadros: [{ titulo: 'Objetivo', texto: 'Ganar fuerza.\n\n- Dos días\n\nSentadilla | 3×5 | Controlada' }] })
    igual([r.structuredContent.listo, r.structuredContent.agregados, r.structuredContent.recuadros_ahora], [true, 1, ['Objetivo']], 'agrega un recuadro al plan')
    const d = ultimo(actualizados)
    cierto(d.ciencia[0].id.startsWith('c-') && d.ciencia[0].texto.includes('Sentadilla | 3×5'), 'queda en data.ciencia con su id y su texto')
    igual([d.foto, d.kind, d.phases.length], ['/fotos/plan.jpg', 'weekly', 1], 'y la foto del plan y las fases se quedan como estaban')
  }
  // Mismo título (sin importar mayúsculas ni acentos): se cambia el texto, no se duplica.
  {
    const { tools, actualizados } = herramientas(herramientasDelCoach, { profiles: [ATLETA_FALSO], plans: [conCiencia()] })
    const r: any = await tools.editar_ciencia({ atleta: 'zz_atleta', recuadros: [{ titulo: 'POR QUE ESTA RUTINA', texto: 'Ahora dice otra cosa.' }] })
    igual([r.structuredContent.agregados, r.structuredContent.cambiados, r.structuredContent.recuadros_ahora], [0, 1, ['POR QUE ESTA RUTINA']], 'un título que ya existe cambia su texto')
    igual(ultimo(actualizados).ciencia.length, 1, 'y no se duplica')
    cierto(ultimo(actualizados).ciencia[0].id === 'c-1', 'conserva su id')
  }
  // Quitar: por título; uno que no existe no se inventa ni se ignora.
  {
    const { tools, actualizados } = herramientas(herramientasDelCoach, { profiles: [ATLETA_FALSO], plans: [conCiencia()] })
    const mal: any = await tools.editar_ciencia({ atleta: 'zz_atleta', quitar: ['No existe'] })
    cierto(mal.isError && String(mal.content[0].text).includes('"No existe"') && String(mal.content[0].text).includes('Por qué esta rutina'), 'quitar uno que no hay avisa y lista los que hay')
    igual(actualizados.length, 0, 'sin escribir nada')
    const bien: any = await tools.editar_ciencia({ atleta: 'zz_atleta', quitar: ['por que esta rutina'] })
    igual([bien.structuredContent.quitados, bien.structuredContent.recuadros_ahora], [1, []], 'quitar uno que sí hay')
    cierto(ultimo(actualizados).ciencia === undefined, 'sin recuadros, el plan ya no lleva el campo')
    igual(ultimo(actualizados).foto, '/fotos/plan.jpg', 'y la foto sigue')
  }
  // «reemplazar» que se lleva lo que ya había: primero se pregunta.
  {
    const { tools, actualizados } = herramientas(herramientasDelCoach, { profiles: [ATLETA_FALSO], plans: [conCiencia()] })
    const frena: any = await tools.editar_ciencia({ atleta: 'zz_atleta', modo: 'reemplazar', recuadros: [{ titulo: 'Otro', texto: 'x' }] })
    cierto(frena.isError && String(frena.content[0].text).includes('reemplazo_ok') && String(frena.content[0].text).includes('Por qué esta rutina'), 'reemplazar que pierde recuadros no guarda y dice qué preguntar')
    igual(actualizados.length, 0, 'sin escribir nada')
    const va: any = await tools.editar_ciencia({ atleta: 'zz_atleta', modo: 'reemplazar', reemplazo_ok: true, recuadros: [{ titulo: 'Otro', texto: 'x' }] })
    igual(va.structuredContent.recuadros_ahora, ['Otro'], 'con la confirmación, reemplaza')
    // Reemplazar conservando los que ya había no pierde nada: no hace falta preguntar.
    const igualPeroConMas: any = await tools.editar_ciencia({ atleta: 'zz_atleta', modo: 'reemplazar', recuadros: [{ titulo: 'Por qué esta rutina', texto: 'Frecuencia alta.' }, { titulo: 'Nuevo', texto: 'y' }] })
    igual(igualPeroConMas.structuredContent.recuadros_ahora, ['Por qué esta rutina', 'Nuevo'], 'si no se pierde nada, no se pregunta')
  }
  // En una fase: va dentro de la fase y no toca la ciencia del plan.
  {
    const { tools, actualizados } = herramientas(herramientasDelCoach, { profiles: [ATLETA_FALSO], plans: [conCiencia()] })
    const r: any = await tools.editar_ciencia({ atleta: 'zz_atleta', fase: '1', recuadros: [{ titulo: 'Esta fase', texto: 'Base.' }] })
    igual(r.structuredContent.donde, 'la fase Rutina semanal', 'dice dónde quedó')
    const d = ultimo(actualizados)
    igual([d.phases[0].ciencia.map((x: any) => x.titulo), d.ciencia.map((x: any) => x.titulo)], [['Esta fase'], ['Por qué esta rutina']], 'dentro de la fase; la del plan se queda')
  }
  // Límites: no se acorta en silencio.
  {
    const { tools, actualizados } = herramientas(herramientasDelCoach, { profiles: [ATLETA_FALSO], plans: [conCiencia()] })
    const largo: any = await tools.editar_ciencia({ atleta: 'zz_atleta', recuadros: [{ titulo: 'Largo', texto: 'a'.repeat(8001) }] })
    cierto(largo.isError && String(largo.content[0].text).includes('8000'), 'un texto de más de 8000 caracteres es un aviso')
    const vacio: any = await tools.editar_ciencia({ atleta: 'zz_atleta', recuadros: [{ titulo: '  ', texto: '' }] })
    cierto(vacio.isError, 'un recuadro sin título ni texto es un aviso')
    const nada: any = await tools.editar_ciencia({ atleta: 'zz_atleta' })
    cierto(nada.isError, 'sin recuadros ni quitar, no hay nada que cambiar')
    igual(actualizados.length, 0, 'ninguno escribió')
  }
  // Leer: texto completo; y el resumen del plan los nombra sin los textos.
  {
    const { tools } = herramientas(herramientasDelCoach, { profiles: [ATLETA_FALSO], plans: [conCiencia()] })
    const v: any = (await tools.ver_ciencia_del_plan({ atleta: 'zz_atleta' })).structuredContent
    igual(v.del_plan, [{ titulo: 'Por qué esta rutina', texto: 'Frecuencia alta.' }], 'ver_ciencia_del_plan trae el texto completo')
    const sin: any = (await herramientas(herramientasDelCoach, { profiles: [ATLETA_FALSO], plans: [PLAN_FALSO()] }).tools.ver_ciencia_del_plan({ atleta: 'zz_atleta' })).structuredContent
    igual([sin.ciencia, sin.del_plan], ['Este plan no tiene ciencia.', []], 'un plan sin ciencia lo dice')
    const resumen: any = (await tools.ver_plan_de_atleta({ atleta: 'zz_atleta', fase: '1', semana: '1' })).structuredContent
    cierto(resumen.dias !== undefined, 'el detalle de siempre sigue igual')
  }
  // crear_plan: con ciencia se crea con ciencia; al reemplazar se queda la foto y la ciencia vieja se avisa.
  {
    const sesiones = [{ dia: 'lunes', nombre: 'Día 1', ejercicios: [{ nombre: 'Back Squat', series: 4, cantidad: 8 }] }]
    const nueva = herramientas(herramientasDelCoach, { profiles: [ATLETA_FALSO], plans: [] })
    const r: any = await nueva.tools.crear_plan({ atleta: 'zz_atleta', titulo: 'Con ciencia', tipo: 'rutina', sesiones, ciencia: [{ titulo: 'Por qué', texto: 'Porque sí.' }] })
    igual(r.structuredContent.listo, true, 'crea el plan con ciencia')
    igual(nueva.insertados[0].fila.data.ciencia.map((x: any) => x.titulo), ['Por qué'], 'y la ciencia queda en el plan')
    const fases = herramientas(herramientasDelCoach, { profiles: [ATLETA_FALSO], plans: [] })
    const f: any = await fases.tools.crear_plan({ atleta: 'zz_atleta', titulo: 'Por fases', tipo: 'fases', fases: [{ nombre: 'Base', ciencia: [{ titulo: 'Objetivo', texto: 'Base.' }], semanas: [{ sesiones }] }] })
    igual(f.structuredContent.listo, true, 'crea un plan por fases')
    igual(fases.insertados[0].fila.data.phases[0].ciencia.map((x: any) => x.titulo), ['Objetivo'], 'con la ciencia dentro de su fase')
    cierto(fases.insertados[0].fila.data.ciencia === undefined, 'y sin ciencia del plan, que no se mandó')
    const viejo = herramientas(herramientasDelCoach, { profiles: [ATLETA_FALSO], plans: [conCiencia()] })
    const re: any = await viejo.tools.crear_plan({ atleta: 'zz_atleta', titulo: 'Nuevo', tipo: 'rutina', sesiones, reemplazar: true })
    igual(re.structuredContent.listo, true, 'reemplaza el plan')
    igual([viejo.actualizados[0].cambios.data.foto, viejo.actualizados[0].cambios.data.ciencia], ['/fotos/plan.jpg', undefined], 'la foto del plan se queda; la ciencia vieja no pasa al plan nuevo')
    cierto(String(re.structuredContent.aviso_ciencia).includes('editar_ciencia'), 'y se avisa que la anterior quedó en el historial')
  }
  ok('ciencia del plan: editar_ciencia, ver_ciencia_del_plan y crear_plan con ciencia')
}

console.log(`\nTodo bien: ${n} grupos de pruebas`)
