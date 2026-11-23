// Prueba de CUÁNDO PREGUNTA la IA al usar el conector (7 oct 2026, ejemplos de Andrés): los topes que el
// conector revisa solo (`preguntas.ts`) y que leer un día y reescribirlo no vuelve a discutir lo ya guardado.
//
//   deno run -A --node-modules-dir=none scripts/prueba-mcp-preguntas.ts
//   (sin `--node-modules-dir=none`, Deno ve el package.json del proyecto y falla con «Could not find a matching package for npm:@supabase/realtime-js»; p89)
import { diaDesdeEntrada, firmasDeGrupos, nombresDeEjercicios } from '../supabase/functions/mcp/plan.ts'
import { NOMBRE_DIA } from '../supabase/functions/mcp/util.ts'
import { anotarDia, equiposMasUsados, esUnilateral, exigirRespuestas, lineasDeRevision, nuevaRevision, parecidosA, preguntaDeDatos, vistaPrevia, type ItemDeCatalogo, type Renglon, type Revision } from '../supabase/functions/mcp/preguntas.ts'
import { Pregunta, fechaDelAtleta, llaveDeNombre, mismoNombre, palabrasClave, seguro } from '../supabase/functions/mcp/util.ts'
import { herramientasComunes } from '../supabase/functions/mcp/comunes.ts'
import { herramientasDelCoach } from '../supabase/functions/mcp/coach.ts'
import { herramientasDelAtleta } from '../supabase/functions/mcp/atleta.ts'
import { z } from 'npm:zod@^4.1.13'
import { sesionDesdePalabras, palabrasDeSesion } from '../supabase/functions/mcp/app/sesionEnPalabras.js'
import { pasosDeLaSesion } from '../supabase/functions/mcp/app/entreno.js'
import { pasosParaElReloj } from '../supabase/functions/mcp/app/relojSinTelefono.js'
const sc0 = (r: any) => r?.structuredContent

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
function herramientas(con: (s: any, q: any) => void, tablas: Record<string, any[]> = {}, deQuien: Record<string, unknown> = {}) {
  const { db, insertados, actualizados } = baseFalsa({
    exercises: EJERCICIOS, exercise_categories: CATEGORIAS, exercise_overrides: [], grupos_musculares: [{ id: 'g1', name: 'Rotadores' }], ...tablas,
  })
  const quien: any = { id: 'master-1', usuario: 'andres', nombre: 'Andrés', rol: 'master', salud: false, unidad: 'kg', db, ...deQuien }
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

/* ---- buscar_ejercicios: un video puesto solo como «Explicación» (en `exercise_media`) también cuenta (5 nov 2026) ---- */
{
  const MEDIOS = [
    { exercise_id: 'id-hamstringcurl', url: 'https://videos/explicacion-curl.mp4', para_atleta: null, orden: 0 },
    { exercise_id: 'id-pullups', url: 'https://videos/solo-para-otro.mp4', para_atleta: 'otro-atleta', orden: 0 },
    { exercise_id: 'id-bicepcurl', url: 'https://videos/explicacion-bicep.mp4', para_atleta: null, orden: 0 },
  ]
  const conColumna = EJERCICIOS.map((e) => (e.name === 'Bicep Curl' ? { ...e, video_link: 'https://videos/ejemplo-bicep.mp4' } : e))
  const { db } = baseFalsa({ exercises: conColumna, exercise_categories: CATEGORIAS, exercise_overrides: [], exercise_media: MEDIOS })
  const pedidas: string[] = []
  const dbQueCuenta = { ...db, from: (t: string) => { pedidas.push(t); return db.from(t) } }
  const comoAtleta: any = { id: 'atleta-1', usuario: 'zz_atleta', nombre: 'Atleta', rol: 'atleta', coachId: 'master-1', salud: false, unidad: 'kg', db: dbQueCuenta }
  const tools: Record<string, (a: any) => Promise<any>> = {}
  herramientasComunes({ registerTool: (nombre: string, _d: unknown, fn: any) => { tools[nombre] = fn } } as any, comoAtleta)
  const video = async (texto: string) => (await tools.buscar_ejercicios({ texto })).structuredContent.ejercicios.find((e: any) => e.nombre.toLowerCase().includes(texto)).video
  igual(await video('hamstring'), 'https://videos/explicacion-curl.mp4', 'solo con «Explicación»: sale con video')
  igual(await video('bicep'), 'https://videos/ejemplo-bicep.mp4', 'con columnas: gana la columna, como antes')
  igual(await video('pull ups'), undefined, 'un video para OTRO atleta no cuenta para este')
  pedidas.length = 0
  await tools.buscar_ejercicios({})
  igual(pedidas.filter((t) => t === 'exercise_media').length, 1, 'los medios se piden en UNA consulta')
  ok('buscar_ejercicios: los videos de explicación cuentan, con la visibilidad de ver_ejercicio')
}

/* ---- crear_ejercicio: «se supone y se dice» (23 nov 2026), de punta a punta ---- */
{
  const { tools, insertados } = herramientas(herramientasDelCoach)
  // Antes (7 oct): solo con el nombre no guardaba y preguntaba. Ahora guarda: categoría y grupo, del parecido más cercano, y lo dice.
  const soloNombre = await tools.crear_ejercicio({ nombre: 'Nordic curl 2' })
  igual([soloNombre.isError, soloNombre.structuredContent.listo, insertados.length], [undefined, true, 1], 'solo con el nombre: se guarda, sin preguntar')
  cierto(Array.isArray(soloNombre.structuredContent.supuestos) && soloNombre.structuredContent.supuestos.length === 1, 'y dice lo que supuso (categoría y grupo, o que no hubo parecido)')
  cierto(String(soloNombre.structuredContent.nota ?? '').includes('Sin video'), 'el video que falta va como nota, no como pregunta')

  const asi = await tools.crear_ejercicio({ nombre: 'Nordic curl 3', sin_datos: true })
  igual([asi.structuredContent.listo, insertados.length, asi.structuredContent.supuestos], [true, 2, undefined], '«así»: se guarda solo con el nombre, sin suponer nada')
  igual([insertados[1].fila.name, insertados[1].fila.category_id, insertados[1].fila.categorias_secundarias], ['Nordic curl 3', null, []], 'sin categoría y sin secundarias vacías raras')

  const completo = await tools.crear_ejercicio({ nombre: 'Trap bar jump', categoria: 'potencia', categorias_secundarias: ['Fuerza', 'Potencia'], musculos_principales: ['Piernas'] })
  igual(completo.structuredContent.listo, true, 'con datos se guarda sin preguntar')
  igual([insertados[2].fila.category_id, insertados[2].fila.categorias_secundarias, insertados[2].fila.muscle_primary], ['c-potencia', ['c-fuerza'], ['Piernas']], 'la categoría principal no se repite entre las secundarias')

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
/** Arma un día como lo hace el conector y anota su revisión (con los objetos que se van a guardar, para ver lo que se completa). */
const armaYRevisa = (ejercicios: any[], titulo = 'Sábado') => {
  const rev = nuevaRevision()
  const armado = diaDesdeEntrada('Sáb', { ejercicios }, CATALOGO)
  anotarDia(rev, titulo, armado)
  return { rev, dia: armado.dia as any }
}
const revisaDia = (ejercicios: any[], titulo = 'Sábado') => armaYRevisa(ejercicios, titulo).rev

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
  // Tu ejemplo 2 tal cual lo habría mandado la IA. Antes (7 oct) eran tres preguntas; desde el 23 nov se SUPONE y se dice.
  const { rev, dia } = armaYRevisa(RUTINA)
  igual(exigirRespuestas({ revision: rev, catalogo: CATALOGO }), { sinFicha: [], sinCantidad: [] }, 'no pregunta nada: todo estaba en el catálogo')
  igual(dia.exercises.map((e: any) => [e.name, e.porLado === true, e.reps]), [
    ['Back Squat', false, '8'], ['Romanian Deadlift', false, '8'], ['Assisted Pistol Squat', true, '8'], ['Step Ups', true, '6'], ['Bulgarian Split Squat', true, '6'], ['Squat Jump', false, '10'],
  ], 'completa la cantidad (3 × 10) y el «por lado» de los unilaterales en lo que se guarda')
  cierto(rev.supuestos.some((s) => s === 'Cantidad: Squat Jump 3 × 10 (no venía)'), 'y lo dice: la cantidad')
  cierto(rev.supuestos.some((s) => s === 'Por lado: Assisted Pistol Squat, Step Ups y Bulgarian Split Squat'), 'el «por lado»')
  cierto(rev.supuestos.some((s) => s.includes('bi serie') && s.includes('tri serie')), 'y los bloques como vinieron (biserie y triserie)')
  igual(lineasDeRevision(rev).supuestos, rev.supuestos, 'los supuestos van en la respuesta')
  ok('la rutina del ejemplo 2: se guarda y se dicen los supuestos (cantidad, «por lado», bloques)')
}
{
  // Lo que la persona ya dijo manda: «por_lado: false», «así lo mando» sin cantidad, y estructura_ok (no se listan los bloques).
  const dicho = RUTINA.map((e) => (e.nombre === 'Bulgarian Split Squat' ? { ...e, por_lado: false } : e))
  const { rev, dia } = armaYRevisa(dicho)
  const r = exigirRespuestas({ revision: rev, catalogo: CATALOGO, respuestas: { estructura_ok: true, sin_cantidad_ok: ['squat jump'] } })
  igual(r.sinCantidad, ['Squat Jump'], '«así lo mando»: se guarda sin cantidad y se avisa')
  igual(dia.exercises.find((e: any) => e.name === 'Squat Jump').reps, '', 'sin cantidad, de verdad')
  igual(dia.exercises.find((e: any) => e.name === 'Bulgarian Split Squat').porLado, undefined, 'lo que dijo («por_lado»: false) no se cambia')
  cierto(!rev.supuestos.some((s) => /serie/.test(s)), 'con estructura_ok no lista los bloques')
  ok('lo que la persona ya dijo no se supone')
}
{
  // Lo que el plan ya tenía (leer un día y reescribirlo) no se cambia ni se comenta.
  const plan = { data: { phases: [{ weekData: [{ days: [{ exercises: [
    { name: 'Step Ups', set: 2, sets: '3', reps: '6' }, { name: 'Bulgarian Split Squat', set: 2, sets: '3', reps: '6' }, { name: 'Squat Jump', set: 2, sets: '3', reps: '' },
  ] }] }] }] } } as any
  const yaTenia = { nombres: nombresDeEjercicios(plan), firmas: firmasDeGrupos(plan) }
  igual([...yaTenia.firmas], ['bulgariansplitsquat|squatjump|stepup'], 'el plan reconoce su triserie por los nombres, sin importar el orden')
  const { rev, dia } = armaYRevisa([{ nombre: 'Squat Jump', grupo: 2 }, { nombre: 'Step Ups', series: 3, cantidad: 6, grupo: 2 }, { nombre: 'Bulgarian Split Squat', series: 3, cantidad: 6, grupo: 2 }])
  igual(exigirRespuestas({ revision: rev, catalogo: CATALOGO, plan: yaTenia }), { sinFicha: [], sinCantidad: [] }, 'reescribir lo que ya estaba no pregunta nada')
  igual([rev.supuestos, dia.exercises.map((e: any) => [e.reps, e.porLado === true])], [[], [['', false], ['6', false], ['6', false]]], 'ni lo cambia ni lo comenta')
  // Una agrupación NUEVA no se pregunta: se dice.
  const nueva = revisaDia([{ nombre: 'Back Squat', series: 3, cantidad: 5, grupo: 1 }, { nombre: 'Lat Pull Down', series: 3, cantidad: 6, grupo: 1 }])
  exigirRespuestas({ revision: nueva, catalogo: CATALOGO, plan: yaTenia })
  cierto(nueva.supuestos.some((s) => s.includes('bi serie')), 'una biserie nueva va en los supuestos')
  ok('reescribir un día no cambia lo que ya estaba; una biserie nueva se dice')
}
{
  igual(vistaPrevia([renglon('A', null, '4', '8'), renglon('B', 1), renglon('C', 1), renglon('D', 2), renglon('E', 2), renglon('F', 2), renglon('G', 3), renglon('H', 3), renglon('I', 3), renglon('J', 3)]), [
    'A 4×8', 'BI SERIE', '  B 3×8', '  C 3×8', 'TRI SERIE', '  D 3×8', '  E 3×8', '  F 3×8', 'CIRCUITO', '  G 3×8', '  H 3×8', '  I 3×8', '  J 3×8',
  ], 'dos son biserie, tres triserie y más, circuito; los solos, sin etiqueta')
  igual(vistaPrevia([renglon('A', 1), renglon('B', 2)]), ['A 3×8', 'B 3×8'], 'un grupo de un solo ejercicio no es una biserie')
  ok('la rutina armada se enseña con BI SERIE, TRI SERIE y CIRCUITO')
}
{
  // Antes (7 oct): seis ejercicios nuevos sin ningún grupo frenaban («¿de verdad van separados?»). Ahora se guarda: agrupar es trabajo de la IA.
  const sinGrupos = RUTINA.map(({ grupo: _g, ...e }) => e)
  igual(exigirRespuestas({ revision: revisaDia(sinGrupos), catalogo: CATALOGO }), { sinFicha: [], sinCantidad: [] }, 'seis sin grupo: se guarda sin preguntar')
  ok('una rutina pegada sin grupos ya no frena')
}

/* ---- De punta a punta con la base de mentira: tu ejemplo 2 en editar_dia (23 nov: se guarda a la primera) ---- */
{
  const extras = [
    fila('RDL', 'Barra', 'Fuerza', ['Isquios', 'Glúteo']), fila('Pistol Squat', 'Peso corporal', 'Atlético', ['Piernas', 'Core']),
    fila('Step Ups', 'Mancuerna', 'Hipertrofia', ['Cuádriceps', 'Glúteo']), fila('Bulgarian Split Squat', 'Mancuerna', 'Hipertrofia', ['Cuádriceps', 'Glúteo']),
    fila('Squat Jump', 'Peso corporal', 'Pliometría', ['Cuádriceps', 'Glúteo']),
  ]
  const { tools, actualizados } = herramientas(herramientasDelCoach, { exercises: [...EJERCICIOS, ...extras], profiles: [ATLETA_FALSO], plans: [PLAN_FALSO()] })
  // Lo que mandó ChatGPT la primera vez: nombres bien, pero sin grupos, sin «por lado» y sin reps en el último.
  const comoChatGPT = [
    { nombre: 'Back Squat', series: 4, cantidad: 8 }, { nombre: 'RDL', series: 3, cantidad: 8 }, { nombre: 'Pistol Squat', series: 3, cantidad: 8 },
    { nombre: 'Step Ups', series: 3, cantidad: 6 }, { nombre: 'Bulgarian Split Squat', series: 3, cantidad: 6 }, { nombre: 'Squat Jump' },
  ]
  const primera = await tools.editar_dia({ atleta: 'zz_atleta', dia: 'sábado', sesiones: [{ nombre: 'Sesión', ejercicios: comoChatGPT }] })
  igual([primera.structuredContent.listo, actualizados.length], [true, 1], 'lo que mandó ChatGPT se guarda a la primera')
  const s = primera.structuredContent.supuestos as string[]
  cierto(s.includes('Por lado: Pistol Squat, Step Ups y Bulgarian Split Squat') && s.includes('Cantidad: Squat Jump 3 × 10 (no venía)'), 'y trae lo que supuso')
  cierto(Array.isArray(primera.structuredContent.asi_lo_vera_el_atleta) && primera.structuredContent.asi_lo_vera_el_atleta[0].atleta.length >= 2, 'y cómo lo verá el atleta')
  const guardado = actualizados[0].cambios.data.phases[0].weekData[0].days.find((d: any) => d.day === 'Sáb').exercises
  igual(guardado.map((e: any) => [e.name, e.porLado === true, e.reps]), [
    ['Back Squat', false, '8'], ['RDL', false, '8'], ['Pistol Squat', true, '8'], ['Step Ups', true, '6'], ['Bulgarian Split Squat', true, '6'], ['Squat Jump', false, '10'],
  ], 'quedó con el «por lado» y las reps supuestas')

  // Reescribirlo igual después: ya estaba todo, no se supone nada nuevo.
  const { tools: t2, actualizados: a2 } = herramientas(herramientasDelCoach, { exercises: [...EJERCICIOS, ...extras], profiles: [ATLETA_FALSO], plans: [{ ...PLAN_FALSO(), data: { kind: 'weekly', phases: [{ id: 'p-1', num: 1, name: 'Rutina semanal', weekData: [{ num: 1, label: '', load: '', days: [
    { day: 'Sáb', name: 'Sesión', cat: 'gym', exercises: guardado },
  ] }] }] } }] })
  const igualQueAntes = await t2.editar_dia({ atleta: 'zz_atleta', dia: 'sábado', sesiones: [{ nombre: 'Sesión', ejercicios: guardado.map((e: any) => ({ nombre: e.name, series: Number(e.sets), cantidad: e.reps, por_lado: e.porLado === true })) }] })
  igual([igualQueAntes.structuredContent.listo, a2.length, igualQueAntes.structuredContent.supuestos], [true, 1, undefined], 'reescribir un día que ya tenía todo no supone nada')
  ok('editar_dia con tu ejemplo 2: se guarda a la primera y dice lo que supuso')
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

/* ---- crear_plan también (23 nov: la cantidad que falta se supone) ---- */
{
  const { tools, insertados } = herramientas(herramientasDelCoach, { profiles: [ATLETA_FALSO], plans: [] })
  const sesiones = [{ dia: 'lunes', nombre: 'Día 1', ejercicios: [{ nombre: 'Back Squat', series: 4, cantidad: 8 }, { nombre: 'Lat Pull Down', series: 3 }] }]
  const p = await tools.crear_plan({ atleta: 'zz_atleta', titulo: 'Nuevo', tipo: 'rutina', sesiones })
  igual([p.structuredContent.listo, insertados.length], [true, 1], 'crear_plan guarda sin preguntar la cantidad')
  cierto((p.structuredContent.supuestos as string[]).includes('Cantidad: Lat Pull Down 3 × 10 (no venía)'), 'y la dice como supuesto')
  const b = await tools.crear_plan({ atleta: 'zz_atleta', titulo: 'Nuevo', tipo: 'rutina', sesiones, sin_cantidad_ok: ['Lat Pull Down'], reemplazar: true })
  igual(b.structuredContent.sin_cantidad, ['Lat Pull Down'], 'con «así lo mando» se crea sin cantidad y se avisa')
  ok('crear_plan: supone la cantidad que falta y acepta «así lo mando»')
}

/* ---- «Ciencia» se quitó (26 oct 2026): el conector ya no la ofrece, y reemplazar un plan conserva la foto ---- */
{
  const { tools } = herramientas(herramientasDelCoach, { profiles: [ATLETA_FALSO], plans: [PLAN_FALSO()] })
  cierto(!('editar_ciencia' in tools) && !('ver_ciencia_del_plan' in tools), 'sin herramientas de ciencia')
  ok('«Ciencia» ya no está en el conector')
}

/* ---- Clases en video (13 oct 2026): editar un día no se lleva la clase; se ve al leer, se guarda y se aplica como plantilla ---- */
{
  const CLASE = { url: 'https://videos.ejemplo/vinyasa.mp4', duracion: 2700 }
  const conClase = () => {
    const p: any = PLAN_FALSO()
    p.data.phases[0].weekData[0].days = [{ day: 'Mar', name: 'Vinyasa', cat: 'clase', exercises: [], clase: { ...CLASE } }, ...p.data.phases[0].weekData[0].days]
    return p
  }
  const diaGuardado = (act: any[], i: number, clave: string) => act[i].cambios.data.phases[0].weekData[0].days.find((d: any) => d.day === clave)

  // Leer el día dice que trae clase.
  const lee = herramientas(herramientasDelCoach, { profiles: [ATLETA_FALSO], plans: [conClase()] })
  const visto: any = await lee.tools.ver_plan_de_atleta({ atleta: 'zz_atleta', semana: 1 })
  cierto(JSON.stringify(visto.structuredContent).includes('clase_en_video'), 'ver_plan_de_atleta enseña la clase en video')

  // Reescribir el día (con otro nombre o agregando ejercicios) conserva la clase.
  const { tools, actualizados } = herramientas(herramientasDelCoach, { profiles: [ATLETA_FALSO], plans: [conClase()] })
  const r1: any = await tools.editar_dia({ atleta: 'zz_atleta', dia: 'martes', sesiones: [{ nombre: 'Vinyasa', tipo: 'clase', ejercicios: [{ nombre: 'Back Squat', series: 3, cantidad: 5 }] }] })
  igual(r1.structuredContent.listo, true, 'se guarda')
  igual(diaGuardado(actualizados, 0, 'Mar').clase, CLASE, 'la clase se queda al reescribir el día')
  cierto(String(r1.structuredContent.ahora).includes('clase en video'), 'y la respuesta lo dice')
  const r2: any = await tools.editar_dia({ atleta: 'zz_atleta', dia: 'martes', sesiones: [{ nombre: 'Otro nombre', ejercicios: [{ nombre: 'Back Squat', series: 3, cantidad: 5 }] }] })
  igual([r2.structuredContent.listo, diaGuardado(actualizados, 1, 'Mar').clase], [true, CLASE], 'con otro nombre, la del mismo lugar')
  // Solo se va si lo piden.
  const r3: any = await tools.editar_dia({ atleta: 'zz_atleta', dia: 'martes', sesiones: [{ nombre: 'Vinyasa', quitar_clase: true, ejercicios: [{ nombre: 'Back Squat', series: 3, cantidad: 5 }] }] })
  igual([r3.structuredContent.listo, diaGuardado(actualizados, 2, 'Mar').clase], [true, undefined], 'quitar_clase la quita')
  // Un día sin clase sigue sin clase.
  await tools.editar_dia({ atleta: 'zz_atleta', dia: 'lunes', sesiones: [{ nombre: 'Fuerza', ejercicios: [{ nombre: 'Back Squat', series: 3, cantidad: 5 }] }] })
  igual(diaGuardado(actualizados, 3, 'Lun').clase, undefined, 'un día sin clase no gana una')

  // Guardar el día como plantilla: va con su clase y Mis planes la lista como «Clase».
  const pl = herramientas(herramientasDelCoach, { profiles: [ATLETA_FALSO], plans: [conClase()] })
  const g: any = await pl.tools.guardar_plantilla({ atleta: 'zz_atleta', nombre: 'Vinyasa 45', tipo: 'dia', dia: 'martes', semana: 1 })
  cierto(!g.isError, `guardar_plantilla funciona (${JSON.stringify(g.structuredContent ?? g.content)})`)
  const fila = pl.insertados.find((x: any) => x.tabla === 'routine_templates')?.fila
  igual([fila?.data?.clase, fila?.resumen?.clase, fila?.resumen?.duracion], [CLASE, true, 2700], 'la plantilla lleva la clase y su resumen la marca como Clase')
  ok('clases en video: se ven, se conservan al editar, se quitan solo si lo piden y viajan en las plantillas')
}

/* ==================================================================
   CONECTOR V2 (23 nov 2026): los casos que pidió Andrés en la spec
   docs/superpowers/specs/2026-11-23-conector-v2.md (parte 2B y 5).
   ================================================================== */
const sinIds = (o: unknown) => JSON.parse(JSON.stringify(o, (k, v) => (k === 'id' ? undefined : v)))
const diaGuardado = (insertados: any[], dia = 'Lun') => insertados.at(-1).fila.data.phases[0].weekData[0].days.find((d: any) => d.day === dia)
{
  // «Rutina rápida con 3 ejercicios, uno nuevo»: UNA pregunta (¿lo creo?); con la respuesta, guarda y trae sus supuestos.
  const { tools, insertados } = herramientas(herramientasDelCoach, { profiles: [ATLETA_FALSO], plans: [] })
  const rapida = [{ dia: 'lunes', nombre: 'Rápida', ejercicios: [{ nombre: 'Back Squat', series: 4, cantidad: 6 }, { nombre: 'Lat Pull Down' }, { nombre: 'Copenhague con banda' }] }]
  const p = sc0(await tools.crear_plan({ atleta: 'zz_atleta', titulo: 'Rápida', tipo: 'rutina', sesiones: rapida }))
  igual([p.guardado, insertados.length, (p.preguntas as string[]).length], [false, 0, 1], 'una sola pregunta')
  cierto(p.preguntas[0].includes('Copenhague con banda') && p.preguntas[0].includes('¿lo creo?'), 'la que bloquea: el ejercicio que no existe')
  // La persona dijo «sí, créalo»: la IA lo crea (basta el nombre) y vuelve a llamar.
  const creado = sc0(await tools.crear_ejercicio({ nombre: 'Copenhague con banda' }))
  igual(creado.listo, true, 'crear_ejercicio con solo el nombre no pregunta')
  const { tools: t2, insertados: i2 } = herramientas(herramientasDelCoach, { profiles: [ATLETA_FALSO], plans: [], exercises: [...EJERCICIOS, fila('Copenhague con banda', null, 'Fuerza', ['Aductores'])] })
  const listo = sc0(await t2.crear_plan({ atleta: 'zz_atleta', titulo: 'Rápida', tipo: 'rutina', sesiones: rapida }))
  igual([listo.listo, i2.length], [true, 1], 'con la respuesta, guarda')
  cierto((listo.supuestos as string[]).some((x) => x.startsWith('Cantidad:')) && listo.asi_lo_vera_el_atleta.length === 1, 'y trae sus supuestos y cómo lo verá el atleta')
  ok('rutina rápida con uno nuevo: 1 pregunta, guarda y dice lo que supuso')
}
{
  // «Arma un running de series» con ritmos y distancias: 0 preguntas. Lo guardado es la forma del editor y el atleta y el reloj lo leen.
  const { tools, insertados } = herramientas(herramientasDelCoach, { profiles: [ATLETA_FALSO], plans: [] })
  const sesion = { dia: 'martes', nombre: 'Series', disciplina: 'correr', piezas: [
    { pieza: 'cal', cuanto: '15 min', intensidad: 'zona 2' },
    { pieza: 'int', tramos: [{ cuanto: '1 km', intensidad: '4:20-4:30' }, { cuanto: '400 m', intensidad: '6:00-6:30' }], veces: 8 },
    { pieza: 'calma', cuanto: '10 min', intensidad: 'zona 1' },
  ] }
  const r = sc0(await tools.crear_plan({ atleta: 'zz_atleta', titulo: 'Running', tipo: 'rutina', sesiones: [sesion] }))
  igual([r.listo, r.preguntas, insertados.length], [true, undefined, 1], 'cero preguntas')
  const dia = diaGuardado(insertados, 'Mar')
  igual(sinIds(dia.tramos), sinIds(sesionDesdePalabras(sesion).dia.tramos), 'guardó EXACTAMENTE la forma del editor (`day.tramos`)')
  igual([dia.disciplina, dia.cat], ['correr', 'correr'], 'con su Disciplina y el tipo que le toca')
  cierto(pasosDeLaSesion(dia).pasos.length >= 10 && pasosParaElReloj(dia).length >= 10, 'el atleta y el reloj lo leen')
  cierto(r.asi_lo_vera_el_atleta[0].atleta.some((l: string) => l.startsWith('Intervalos ×16')) && r.asi_lo_vera_el_atleta[0].atleta.at(-1).startsWith('Apple Watch: sí'), 'y enseña cómo lo verá el atleta')
  ok('running de series: 0 preguntas, forma del editor, atleta y reloj')
}
{
  // Con «decide tú» (la IA lo recuerda en su memoria y lo manda en la llamada; Training Lab no lo guarda): 0 preguntas con UN solo parecido.
  const escrito = 'Hamstring Curl acostado'
  igual(parecidosA(escrito, EJERCICIOS as any).map((e) => e.name), ['Hamstring Curl'], 'un solo parecido (precondición)')
  const sesiones = [{ dia: 'lunes', nombre: 'Isquios', ejercicios: [{ nombre: escrito, series: 3, cantidad: 12 }] }]
  const { tools: sinEstilo } = herramientas(herramientasDelCoach, { profiles: [ATLETA_FALSO], plans: [] })
  igual(sc0(await sinEstilo.crear_plan({ atleta: 'zz_atleta', titulo: 'X', tipo: 'rutina', sesiones })).guardado, false, 'sin decide_tu, la IA resuelve el parecido (vuelve con el nombre exacto)')
  const { tools, insertados } = herramientas(herramientasDelCoach, { profiles: [ATLETA_FALSO], plans: [] })
  const r = sc0(await tools.crear_plan({ atleta: 'zz_atleta', titulo: 'X', tipo: 'rutina', sesiones, decide_tu: true }))
  igual([r.listo, r.preguntas], [true, undefined], 'con «decide tú»: 0 preguntas')
  igual(diaGuardado(insertados).exercises[0].name, 'Hamstring Curl', 'lo tomó como su parecido')
  cierto((r.supuestos as string[]).includes('«Hamstring Curl acostado» es «Hamstring Curl» del repertorio'), 'y lo dice')
  ok('«decide tú» (decide_tu: true): 0 preguntas con un solo parecido')
}
{
  // Borrar y asignar siguen pidiendo confirmación de verdad.
  const { tools } = herramientas(herramientasDelCoach, { profiles: [ATLETA_FALSO], plans: [] })
  const b = sc0(await tools.borrar_ejercicio({ ejercicio: 'Bicep Curl' }))
  igual([b.borrado, b.motivo], [false, 'falta_confirmacion'], 'borrar sin confirmado no borra')
  const { tools: t2 } = herramientas(herramientasDelCoach, { profiles: [ATLETA_FALSO], plans: [PLAN_FALSO()] })
  const otra = sc0(await t2.crear_plan({ atleta: 'zz_atleta', titulo: 'Otro', tipo: 'rutina', sesiones: [{ dia: 'lunes', ejercicios: [{ nombre: 'Back Squat', cantidad: 5 }] }] }))
  cierto(otra === undefined || otra.listo !== true, 'reemplazar un plan sin reemplazar: true no lo hace')
  ok('borrar y reemplazar siguen pidiendo confirmación')
}
{
  // Cada tipo de sesión: la misma forma que guardaría su editor, el atleta y el reloj la leen, se lee en palabras y reescrita queda igual.
  const tipos: [string, any][] = [
    ['Cycling', { disciplina: 'bici', lugar: 'ruta', piezas: [{ pieza: 'continua', cuanto: '40 km', intensidad: '200-220 W' }] }],
    ['Swimming', { disciplina: 'nadar', piezas: [{ pieza: 'series', sprints: [{ cuanto: '100 m', veces: 6, descanso: '20 seg' }], intensidad: '1:45 /100 m' }] }],
    ['Triatlón', { disciplina: 'triatlon', piezas: [{ pieza: 'bici-continua', cuanto: '20 km', intensidad: 'zona 3' }, { pieza: 'trans' }, { pieza: 'correr-continua', cuanto: '5 km', intensidad: '4:45' }] }],
    ['Híbrido', { disciplina: 'hyrox', sets: [{ formato: 'amrap', minutos: 12, ejercicios: [{ nombre: 'Back Squat', cuanto: '10 reps', peso: '60 kg' }, { nombre: 'Pull Ups', cuanto: '8 reps' }] }] }],
    ['Deporte', { disciplina: 'deporte', deporte: [{ nombre: 'Box Squat', veces: 5, por_lado: true, distancia: '10 m' }] }],
    ['Gym con calentamiento', { disciplina: 'pesas', calentamiento: { forma: 'ejercicios', ejercicios: [{ nombre: 'Bicep Curl', cuanto: '10 reps' }] }, ejercicios: [{ nombre: 'Back Squat', series: 3, cantidad: 5 }] }],
  ]
  for (const [nombre, s] of tipos) {
    const { tools, insertados } = herramientas(herramientasDelCoach, { profiles: [ATLETA_FALSO], plans: [] })
    const r = sc0(await tools.crear_plan({ atleta: 'zz_atleta', titulo: nombre, tipo: 'rutina', sesiones: [{ dia: 'lunes', nombre, ...s }] }))
    igual([r.listo, r.preguntas], [true, undefined], `${nombre}: se guarda sin preguntar`)
    const dia = diaGuardado(insertados)
    const esperado = sesionDesdePalabras(s, { busca: (n: string) => EJERCICIOS.find((e) => e.name === n) ?? null }).dia
    for (const k of Object.keys(esperado)) igual(sinIds(dia[k]), sinIds((esperado as any)[k]), `${nombre}: «${k}» con la forma del editor`)
    cierto(pasosDeLaSesion(dia).pasos.length > 0, `${nombre}: el atleta lo lee`)
    cierto(pasosParaElReloj(dia).length > 0, `${nombre}: el reloj lo lee`)
    // Leer el día y mandarlo de vuelta tal cual: queda igual.
    const { tools: t2, actualizados } = herramientas(herramientasDelCoach, { profiles: [ATLETA_FALSO], plans: [{ ...PLAN_FALSO(), data: { kind: 'weekly', phases: [{ id: 'p-1', num: 1, name: 'Rutina semanal', weekData: [{ num: 1, label: '', load: '', days: [dia] }] }] } }] })
    const leido = sc0(await t2.ver_plan_de_atleta({ atleta: 'zz_atleta' }))
    const enPalabras = palabrasDeSesion(dia)
    cierto(JSON.stringify(leido).includes(JSON.stringify(enPalabras.disciplina ?? '')), `${nombre}: se lee con su Disciplina`)
    const { disciplina: _d, ...resto } = enPalabras as any
    const escrito = await t2.editar_dia({ atleta: 'zz_atleta', dia: 'lunes', sesiones: [{ nombre, disciplina: dia.disciplina, ...resto, ...(dia.exercises?.length ? { ejercicios: dia.exercises.map((e: any) => ({ nombre: e.name, series: Number(e.sets), cantidad: e.reps })) } : {}) }] })
    igual(sc0(escrito).listo, true, `${nombre}: reescribir lo leído se guarda`)
    const nuevo = actualizados.at(-1).cambios.data.phases[0].weekData[0].days[0]
    for (const k of Object.keys(esperado)) igual(sinIds(nuevo[k]), sinIds(dia[k]), `${nombre}: leer y reescribir no cambió «${k}»`)
    // Reescribir solo con el nombre (sin piezas): lo del editor se queda.
    const { tools: t3, actualizados: a3 } = herramientas(herramientasDelCoach, { profiles: [ATLETA_FALSO], plans: [{ ...PLAN_FALSO(), data: { kind: 'weekly', phases: [{ id: 'p-1', num: 1, name: 'Rutina semanal', weekData: [{ num: 1, label: '', load: '', days: [dia] }] }] } }] })
    await t3.editar_dia({ atleta: 'zz_atleta', dia: 'lunes', sesiones: [{ nombre: `${nombre} (renombrada)` }] })
    const renombrada = a3.at(-1).cambios.data.phases[0].weekData[0].days[0]
    if (!dia.exercises?.length) for (const k of ['tramos', 'hibrido', 'deporte'].filter((k) => dia[k])) igual(sinIds(renombrada[k]), sinIds(dia[k]), `${nombre}: cambiar solo el nombre conserva «${k}»`)
  }
  ok('cada tipo de sesión: forma del editor, atleta, reloj, ida y vuelta, y se conserva al renombrar')
}

console.log(`\nTodo bien: ${n} grupos de pruebas`)
