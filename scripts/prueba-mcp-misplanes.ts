// deno-lint-ignore-file no-explicit-any
// Pruebas de «Mis planes» en el conector de IA (supabase/functions/mcp/misplanes.ts), con una base de mentira que SÍ guarda y borra en memoria.
// Corre desde supabase/functions/mcp:  deno run -A --config deno.json ../../../scripts/prueba-mcp-misplanes.ts
import { herramientasDeMisPlanes } from '../supabase/functions/mcp/misplanes.ts'
import { herramientasDelCoach } from '../supabase/functions/mcp/coach.ts'
import { llaveDeNombre } from '../supabase/functions/mcp/util.ts'

const igual = (a: unknown, b: unknown, msg: string) => {
  const x = JSON.stringify(a)
  const y = JSON.stringify(b)
  if (x !== y) throw new Error(`${msg}\n   esperaba ${y}\n   salió    ${x}`)
}
const cierto = (v: unknown, msg: string) => { if (!v) throw new Error(msg) }
let n = 0
const ok = (nombre: string) => { n += 1; console.log(`OK    ${nombre}`) }

/* ---------------- Una base en memoria ---------------- */
const MEMORIA = ['routine_templates', 'programas_guardados', 'carpetas_planes', 'plans', 'user_app_state']
function baseEnMemoria(tablas: Record<string, any[]>) {
  const datos: Record<string, any[]> = {}
  for (const k of Object.keys(tablas)) datos[k] = structuredClone(tablas[k])
  const planesActualizados: any[] = []
  let contador = 0
  const db = {
    rpc: async (nombre: string) => ({ data: nombre === 'master_id' ? 'master-1' : null, error: null }),
    from: (tabla: string) => {
      const filas = () => (datos[tabla] ??= [])
      const real = MEMORIA.includes(tabla)
      let op: 'select' | 'insert' | 'update' | 'delete' = 'select'
      let carga: any = null
      const filtros: ((r: any) => boolean)[] = []
      const afectadas = () => filas().filter((r) => filtros.every((f) => f(r)))
      const ejecutar = async () => {
        if (op === 'update' && tabla === 'plans') planesActualizados.push({ tabla, cambios: carga })
        if (!real) return { data: filas(), error: null }
        if (op === 'insert') {
          const fila = { id: `id-nuevo-${++contador}`, created_at: '2026-10-13', updated_at: '2026-10-13', ...structuredClone(carga) }
          filas().push(fila)
          return { data: [fila], error: null }
        }
        if (op === 'update') { const a = afectadas(); a.forEach((r) => Object.assign(r, structuredClone(carga))); return { data: a, error: null } }
        if (op === 'delete') { const a = afectadas(); datos[tabla] = filas().filter((r) => !a.includes(r)); return { data: a, error: null } }
        return { data: afectadas().map((r) => structuredClone(r)), error: null }
      }
      const q: any = {
        select: () => q, order: () => q, neq: () => q,
        eq: (c: string, v: unknown) => { if (real) filtros.push((r) => (r[c] ?? null) === (v ?? null)); return q },
        in: (c: string, vs: unknown[]) => { if (real) filtros.push((r) => vs.includes(r[c])); return q },
        is: (c: string, v: unknown) => { if (real) filtros.push((r) => (r[c] ?? null) === v); return q },
        insert: (c: any) => { op = 'insert'; carga = c; return q },
        update: (c: any) => { op = 'update'; carga = c; return q },
        delete: () => { op = 'delete'; return q },
        single: async () => { const r = await ejecutar(); return r.data[0] ? { data: r.data[0], error: null } : { data: null, error: { message: 'no hay filas' } } },
        maybeSingle: async () => { const r = await ejecutar(); return { data: r.data[0] ?? null, error: null } },
        then: (ok: any, no: any) => ejecutar().then(ok, no),
      }
      return q
    },
  }
  return { db, datos, planesActualizados }
}

/* ---------------- Catálogo mínimo y atleta ---------------- */
const fila = (name: string, equipment: string | null, cat: string, musculos: string[]) => ({
  id: `id-${llaveDeNombre(name)}`, name, equipment, description: null, muscle_primary: musculos, muscle_secondary: [],
  category_id: `c-${cat.toLowerCase()}`, categorias_secundarias: [], category: { name: cat, slug: cat.toLowerCase() }, created_by: 'master-1',
})
const EJERCICIOS = [fila('Back Squat', 'Barra', 'Fuerza', ['Cuádriceps']), fila('Bicep Curl', 'Mancuerna', 'Hipertrofia', ['Bíceps']), fila('Pull Ups', 'Barra', 'Fuerza', ['Espalda'])]
const CATEGORIAS = [{ id: 'c-fuerza', name: 'Fuerza', slug: 'fuerza', created_by: null }, { id: 'c-hipertrofia', name: 'Hipertrofia', slug: 'hipertrofia', created_by: null }]
const ATLETA = { id: 'atleta-1', username: 'zz_atleta', full_name: 'Atleta Prueba', role: 'user', is_owner: false, coach_id: 'master-1', is_active: true, unidad_peso: 'kg', genero: null, email: null, created_at: '2026-01-01', perfil_completo: true, alta_en: null }
const OTRO = (n: number, usuario: string, nombre: string) => ({ ...ATLETA, id: `atleta-${n}`, username: usuario, full_name: nombre })
const ex = (name: string, id?: string) => ({ name, ...(id ? { exercise_id: id } : {}), sets: '3', reps: '5' })
const dia = (day: string, name: string, cat: string, ejercicios = [ex('Back Squat', 'id-backsquat')], extra: any = {}) => ({ day, name, cat, exercises: ejercicios, ...extra })
const semana = (num: number, days: any[]) => ({ num, label: '', load: '', days })
const PLAN_POR_FASES = () => ({
  id: 'plan-1', user_id: 'atleta-1', title: 'Plan de Emiliano', status: 'active', updated_at: '2026-01-01', profesional_id: null,
  data: {
    kind: 'periodized', estructura: 'fases', foto: '/fotos/plan.jpg', ciencia: [{ id: 'c1', titulo: 'Por qué', texto: 'Progresión' }],
    phases: [
      { id: 'p-1', num: 1, name: 'Fuerza', weekData: [
        semana(1, [dia('Lun', 'Piernas', 'gym'), dia('Mar', 'Velocidad', 'correr', [ex('Sprints')]), dia('Jue', 'Torso', 'gym', [ex('Pull Ups', 'id-pullups')]), dia('Vie', 'Neural', 'neural', [ex('Saltos')])]),
        semana(2, [dia('Lun', 'Piernas', 'gym'), dia('Mar', 'Velocidad', 'correr', [ex('Sprints')])]),
      ] },
      { id: 'p-2', num: 2, name: 'Potencia', weekData: [semana(1, [dia('Lun', 'Potencia', 'gym')])] },
    ],
  },
})
const PLAN_SEMANAL = () => ({
  id: 'plan-2', user_id: 'atleta-1', title: 'Rutina', status: 'active', updated_at: '2026-01-01', profesional_id: null,
  data: { kind: 'weekly', phases: [{ id: 'p-1', num: 1, name: 'Rutina semanal', weekData: [semana(1, [dia('Lun', 'Fuerza', 'gym'), dia('Mié', 'Correr', 'correr', [ex('Trote')])])] }] },
})
const CLASE = { url: 'https://videos.ejemplo/vinyasa.mp4', duracion: 2700 }

function armar(tablas: Record<string, any[]> = {}) {
  const { db, datos, planesActualizados } = baseEnMemoria({
    exercises: EJERCICIOS, exercise_categories: CATEGORIAS, exercise_overrides: [], grupos_musculares: [], profiles: [ATLETA],
    carpetas_planes: [], routine_templates: [], programas_guardados: [], ...tablas,
  })
  const quien: any = { id: 'master-1', usuario: 'andres', nombre: 'Andrés', rol: 'master', salud: false, unidad: 'kg', db }
  const tools: Record<string, (a: any) => Promise<any>> = {}
  const server: any = { registerTool: (nombre: string, _def: unknown, fn: (a: any) => Promise<any>) => { tools[nombre] = fn } }
  herramientasDelCoach(server, quien)
  herramientasDeMisPlanes(server, quien)
  return { tools, datos, planesActualizados }
}
const sc = (r: any) => r.structuredContent
const falla = async (p: Promise<any>) => { const r = await p; cierto(r.isError || sc(r)?.error || /no encontr|elige|no pued|falta|di |hay \d|manda|con ese|¿qué/i.test(JSON.stringify(r.content ?? r)), 'se esperaba un aviso'); return JSON.stringify(r.content ?? r) }

/* ---------------- Datos de Mis planes ---------------- */
const CARPETAS = [
  { id: 'car-f', nombre: 'Fútbol', parent_id: null, owner_id: 'master-1' },
  { id: 'car-fz', nombre: 'Fuerza', parent_id: 'car-f', owner_id: 'master-1' },
  { id: 'car-y', nombre: 'Yoga', parent_id: null, owner_id: 'master-1' },
]
const PLANTILLAS = [
  { id: 't-w', name: 'Piernas A', kind: 'day', descripcion: null, origen: null, carpeta_id: 'car-fz', resumen: { sesiones: 1, ejercicios: 6 }, demo: false, data: { name: 'Piernas', cat: 'gym', exercises: [ex('Back Squat', 'id-backsquat')] }, created_by: 'master-1' },
  { id: 't-c', name: 'Vinyasa 45', kind: 'day', descripcion: 'Clase de la mañana', origen: null, carpeta_id: 'car-y', resumen: { sesiones: 1, ejercicios: 0, clase: true, duracion: 2700 }, demo: false, data: { name: 'Vinyasa', cat: 'clase', exercises: [], clase: CLASE }, created_by: 'master-1' },
  { id: 't-r', name: 'Semana base', kind: 'week', descripcion: null, origen: null, carpeta_id: null, resumen: { dias: 2, sesiones: 2 }, demo: false, data: { days: [dia('Lun', 'Fuerza', 'gym'), dia('Mié', 'Torso', 'gym', [ex('Pull Ups', 'id-pullups')])] }, created_by: 'master-1' },
  // Sin resumen (guardado antes de que existiera): se calcula al leer.
  { id: 't-v', name: 'Viejo', kind: 'day', descripcion: null, origen: null, carpeta_id: null, resumen: null, demo: false, data: { name: 'Viejo', cat: 'gym', exercises: [ex('Back Squat', 'id-backsquat'), ex('Bicep Curl')] }, created_by: 'master-1' },
]
const PROGRAMAS = [
  { id: 'p-1', name: 'Fuerza 8 semanas', descripcion: null, origen: null, carpeta_id: 'car-fz', resumen: { forma: 'fases', fases: 2, semanas: 3, sesiones: 8 }, data: PLAN_POR_FASES().data, created_by: 'master-1' },
]
const SEMBRADO = () => ({ carpetas_planes: CARPETAS, routine_templates: PLANTILLAS, programas_guardados: PROGRAMAS })

/* ======================= ver_mis_planes ======================= */
{
  const { tools } = armar(SEMBRADO())
  const todo = sc(await tools.ver_mis_planes({}))
  igual([todo.total, todo.planes.map((p: any) => p.tipo).sort()], [5, ['clase', 'programa', 'rutina', 'workout', 'workout']], 'trae los cuatro tipos; una clase se reconoce por su resumen')
  igual(todo.carpetas, ['Fútbol', 'Fútbol › Fuerza', 'Yoga'], 'las carpetas, con su ruta')
  const vinyasa = todo.planes.find((p: any) => p.nombre === 'Vinyasa 45')
  igual([vinyasa.tipo, vinyasa.carpeta, vinyasa.resumen, vinyasa.descripcion], ['clase', 'Yoga', '45 min', 'Clase de la mañana'], 'una clase dice su carpeta y cuánto dura')
  igual(todo.planes.find((p: any) => p.nombre === 'Viejo').resumen, '1 sesión · 2 ejercicios', 'lo guardado sin resumen se calcula al leer')
  igual(todo.planes.find((p: any) => p.tipo === 'programa').resumen, '2 fases · 3 semanas · 8 sesiones', 'el resumen de un programa')
  igual(sc(await tools.ver_mis_planes({ tipo: 'workout' })).planes.map((p: any) => p.nombre).sort(), ['Piernas A', 'Viejo'], 'filtra por tipo')
  igual(sc(await tools.ver_mis_planes({ carpeta: 'Fútbol' })).planes.map((p: any) => p.nombre).sort(), ['Fuerza 8 semanas', 'Piernas A'], 'una carpeta trae también sus subcarpetas')
  igual(sc(await tools.ver_mis_planes({ carpeta: 'Fútbol › Fuerza' })).total, 2, 'se encuentra por su ruta')
  igual(sc(await tools.ver_mis_planes({ carpeta: 'sin carpeta' })).planes.map((p: any) => p.nombre).sort(), ['Semana base', 'Viejo'], '«sin carpeta» trae lo que no tiene carpeta')
  igual(sc(await tools.ver_mis_planes({ texto: 'vinyasa' })).total, 1, 'busca por texto, sin acentos ni mayúsculas')
  cierto(/No encontré la carpeta/.test(await falla(tools.ver_mis_planes({ carpeta: 'Natación' }))), 'una carpeta que no existe lo dice y lista las que hay')
  const vacio = sc(await armar().tools.ver_mis_planes({}))
  igual([vacio.total, vacio.nota], [0, 'Todavía no tienes nada guardado en Mis planes.'], 'sin nada guardado, lo dice')
  ok('ver_mis_planes: tipos, carpetas con ruta, filtros y resúmenes')
}

/* ======================= abrir_de_mis_planes ======================= */
{
  const { tools } = armar(SEMBRADO())
  const prog = sc(await tools.abrir_de_mis_planes({ item: 'Fuerza 8 semanas' }))
  igual(prog.fases.map((f: any) => [f.nombre, f.semanas, f.sesiones]), [['Fuerza', 2, 6], ['Potencia', 1, 1]], 'un programa enseña sus fases, sin traer todo')
  cierto(/1 recuadro/.test(prog.ciencia) && !!prog.pista, 'dice que lleva ciencia y cómo bajar al detalle')
  const f1 = sc(await tools.abrir_de_mis_planes({ item: 'Fuerza 8 semanas', fase: '1' }))
  igual([f1.fase, f1.semanas.length, f1.semanas[0].dias.length], ['Fuerza', 2, 4], 'con una fase: sus semanas y días')
  const s1 = sc(await tools.abrir_de_mis_planes({ item: 'Fuerza 8 semanas', fase: 'Fuerza', semana: 1 }))
  igual(s1.dias.map((d: any) => d.sesion), ['Piernas', 'Velocidad', 'Torso', 'Neural'], 'con una semana: sus días')
  const d1 = sc(await tools.abrir_de_mis_planes({ item: 'Fuerza 8 semanas', fase: 1, semana: 1, dia: 'jueves' }))
  igual([d1.sesiones[0].sesion, d1.sesiones[0].ejercicios.map((e: any) => e.nombre)], ['Torso', ['Pull Ups']], 'con un día: sus ejercicios')
  cierto(/no tiene sesión/.test(await falla(tools.abrir_de_mis_planes({ item: 'Fuerza 8 semanas', fase: 1, semana: 1, dia: 'domingo' }))), 'un día sin sesión lo dice')
  const rut = sc(await tools.abrir_de_mis_planes({ item: 'Semana base' }))
  igual(rut.dias.map((d: any) => d.sesion), ['Fuerza', 'Torso'], 'una rutina enseña sus días')
  igual(sc(await tools.abrir_de_mis_planes({ item: 'Semana base', dia: 'miércoles' })).sesiones[0].ejercicios.map((e: any) => e.nombre), ['Pull Ups'], 'y los ejercicios de un día')
  const w = sc(await tools.abrir_de_mis_planes({ item: 'Piernas A' }))
  igual([w.tipo, w.carpeta, w.sesiones[0].ejercicios.map((e: any) => e.nombre)], ['workout', 'Fútbol › Fuerza', ['Back Squat']], 'un workout enseña sus sesiones y ejercicios')
  const c = sc(await tools.abrir_de_mis_planes({ item: 'Vinyasa 45' }))
  igual([c.tipo, c.sesiones[0].clase_en_video], ['clase', '45 min'], 'una clase dice que trae video')
  cierto(/No encontré/.test(await falla(tools.abrir_de_mis_planes({ item: 'Nada de esto' }))), 'si no existe, lo dice')
  const doble = armar({ ...SEMBRADO(), routine_templates: [...PLANTILLAS, { ...PLANTILLAS[2], id: 't-r2', carpeta_id: 'car-y' }] })
  cierto(/Hay 2 con el nombre/.test(await falla(doble.tools.abrir_de_mis_planes({ item: 'Semana base' }))), 'dos con el mismo nombre: pide cuál')
  igual(sc(await doble.tools.abrir_de_mis_planes({ item: 't-r2' })).carpeta, 'Yoga', 'y por id se abre el que se pide')
  ok('abrir_de_mis_planes: de la estructura al ejercicio, por tipo, con nombres repetidos')
}

/* ======================= guardar_en_mis_planes · del plan de un atleta ======================= */
{
  const plan = armar({ ...SEMBRADO(), plans: [PLAN_POR_FASES()] })
  const g = sc(await plan.tools.guardar_en_mis_planes({ nombre: 'Fuerza Emiliano', desde_atleta: 'zz_atleta', solo_tipos: ['gym'], carpeta: 'Fútbol › Fuerza', descripcion: 'Solo gimnasio' }))
  igual([g.listo, g.guardado.tipo, g.guardado.carpeta, g.guardado.origen], [true, 'programa', 'Fútbol › Fuerza', 'Del plan de Atleta Prueba'], 'guarda el plan entero como programa')
  igual(g.sesiones_quitadas, '3 sesión(es) no entraron a la copia por el filtro de tipos.', 'dice cuántas sesiones quitó el filtro')
  const guardado = plan.datos.programas_guardados.find((x: any) => x.name === 'Fuerza Emiliano')
  igual([guardado.descripcion, guardado.carpeta_id, guardado.resumen], ['Solo gimnasio', 'car-fz', { forma: 'fases', fases: 2, semanas: 3, sesiones: 4 }], 'queda con su descripción, su carpeta y su resumen')
  const tipos = guardado.data.phases.flatMap((f: any) => f.weekData.flatMap((w: any) => w.days.map((d: any) => d.cat)))
  igual([...new Set(tipos)], ['gym'], 'la copia solo trae sesiones de gimnasio')
  igual([guardado.data.kind, guardado.data.foto, guardado.data.ciencia?.length], ['periodized', '/fotos/plan.jpg', 1], 'conserva la foto y la ciencia del plan')
  const original = plan.datos.plans[0].data.phases[0].weekData[0].days.map((d: any) => d.cat)
  igual(original, ['gym', 'correr', 'gym', 'neural'], 'el plan del atleta no se tocó')
  cierto(plan.planesActualizados.length === 0, 'ni se actualizó nada de planes')

  // Con «sin_tipos» y fases elegidas.
  const p2 = armar({ ...SEMBRADO(), plans: [PLAN_POR_FASES()] })
  const g2 = sc(await p2.tools.guardar_en_mis_planes({ nombre: 'Solo potencia', desde_atleta: 'zz_atleta', fases_elegidas: ['Potencia'], sin_tipos: ['correr'] }))
  igual(g2.guardado.resumen, '1 fase · 1 semana · 1 sesión', 'solo las fases elegidas')
  igual(p2.datos.programas_guardados.at(-1).data.ciencia, undefined, 'la ciencia del plan entero no se pega a un pedazo')

  // Una semana → rutina; un día → workout.
  const p3 = armar({ ...SEMBRADO(), plans: [PLAN_POR_FASES()] })
  const r = sc(await p3.tools.guardar_en_mis_planes({ nombre: 'Semana de fuerza', desde_atleta: 'zz_atleta', fase: 1, semana: 1, sin_tipos: ['correr', 'neural'] }))
  igual([r.guardado.tipo, r.guardado.resumen], ['rutina', '2 días · 2 sesiones'], 'una semana se guarda como rutina semanal')
  const rf = p3.datos.routine_templates.at(-1)
  igual([rf.kind, rf.data.days.map((d: any) => d.day)], ['week', ['Lun', 'Jue']], 'en routine_templates, kind week')
  const w = sc(await p3.tools.guardar_en_mis_planes({ nombre: 'Torso del jueves', desde_atleta: 'zz_atleta', fase: 1, semana: 1, dia: 'jueves' }))
  const wf = p3.datos.routine_templates.at(-1)
  igual([w.guardado.tipo, wf.kind, wf.data.name], ['workout', 'day', 'Torso'], 'un día se guarda como workout')
  cierto(!('day' in wf.data), 'y sin su día de la semana')
  cierto(/no queda ninguna sesión/.test(await falla(p3.tools.guardar_en_mis_planes({ nombre: 'Nada', desde_atleta: 'zz_atleta', fase: 1, semana: 1, dia: 'martes', solo_tipos: ['gym'] }))), 'si el filtro deja el día vacío, no guarda')

  // Un plan que es rutina semanal → rutina.
  const p4 = armar({ ...SEMBRADO(), plans: [PLAN_SEMANAL()] })
  const rs = sc(await p4.tools.guardar_en_mis_planes({ nombre: 'Mi rutina', desde_atleta: 'zz_atleta' }))
  igual([rs.guardado.tipo, rs.guardado.resumen], ['rutina', '2 días · 2 sesiones'], 'un plan que ya es rutina semanal se guarda como rutina')

  // Un día con clase en video → «Clase».
  const conClase = PLAN_POR_FASES()
  conClase.data.phases[0].weekData[0].days.push(dia('Sáb', 'Vinyasa', 'clase', [], { clase: CLASE }))
  const p5 = armar({ ...SEMBRADO(), plans: [conClase] })
  const cl = sc(await p5.tools.guardar_en_mis_planes({ nombre: 'Vinyasa del sábado', desde_atleta: 'zz_atleta', fase: 1, semana: 1, dia: 'sábado' }))
  igual([cl.guardado.tipo, cl.guardado.resumen, p5.datos.routine_templates.at(-1).data.clase], ['clase', '45 min', CLASE], 'un día con video se guarda como clase, con su video')
  ok('guardar_en_mis_planes (del atleta): programa, filtros por tipo, fases elegidas, rutina, workout y clase')
}

/* ======================= guardar_en_mis_planes · armado desde cero ======================= */
{
  const { tools, datos } = armar(SEMBRADO())
  const sesion = { dia: 'lunes', nombre: 'Piernas', tipo: 'gym', ejercicios: [{ nombre: 'Back Squat', series: 4, cantidad: 5, intensidad: '80%' }] }
  const w = sc(await tools.guardar_en_mis_planes({ nombre: 'Piernas pesadas', tipo: 'workout', sesiones: [sesion], carpeta: 'Yoga' }))
  igual([w.listo, w.guardado.tipo, w.guardado.carpeta, w.guardado.origen], [true, 'workout', 'Yoga', 'Creado con la IA'], 'arma un workout sin atleta')
  const wf = datos.routine_templates.at(-1)
  igual([wf.kind, wf.data.name, wf.data.exercises[0].exercise_id, wf.created_by], ['day', 'Piernas', 'id-backsquat', 'master-1'], 'ligado a su ficha, kind day, de quien llama')

  const rut = sc(await tools.guardar_en_mis_planes({ nombre: 'Semana nueva', tipo: 'rutina', sesiones: [sesion, { ...sesion, dia: 'jueves', nombre: 'Torso' }] }))
  igual(rut.guardado.resumen, '2 días · 2 sesiones', 'arma una rutina')

  const fases = [{ nombre: 'Base', semanas: [{ sesiones: [sesion] }, { sesiones: [sesion] }] }, { nombre: 'Pico', semanas: [{ sesiones: [sesion] }] }]
  const prog = sc(await tools.guardar_en_mis_planes({ nombre: 'Programa nuevo', tipo: 'programa', fases, ciencia: [{ titulo: 'Porqué', texto: 'Progresión lineal' }] }))
  igual([prog.guardado.tipo, prog.guardado.resumen], ['programa', '2 fases · 3 semanas · 3 sesiones'], 'arma un programa por fases')
  const pf = datos.programas_guardados.at(-1)
  igual([pf.data.kind, pf.data.estructura, pf.data.ciencia?.length, pf.kind], ['periodized', 'fases', 1, undefined], 'en programas_guardados, con su ciencia')

  // Lo que falta se pregunta y NO se guarda.
  const antes = datos.programas_guardados.length + datos.routine_templates.length
  const sinCantidad = sc(await tools.guardar_en_mis_planes({ nombre: 'Falta algo', tipo: 'workout', sesiones: [{ dia: 'lunes', ejercicios: [{ nombre: 'Back Squat' }] }] }))
  igual([sinCantidad.guardado, sinCantidad.motivo], [false, 'faltan_respuestas'], 'sin cantidad: pregunta')
  igual(datos.programas_guardados.length + datos.routine_templates.length, antes, 'y no escribe nada')
  const confirmado = sc(await tools.guardar_en_mis_planes({ nombre: 'Falta algo', tipo: 'workout', sesiones: [{ dia: 'lunes', ejercicios: [{ nombre: 'Back Squat' }] }], sin_cantidad_ok: ['Back Squat'] }))
  igual(confirmado.listo, true, 'con la respuesta, guarda')
  const fuera = sc(await tools.guardar_en_mis_planes({ nombre: 'Inventado', tipo: 'workout', sesiones: [{ dia: 'lunes', ejercicios: [{ nombre: 'Ejercicio que no existe', cantidad: 10 }] }] }))
  igual([fuera.guardado, fuera.motivo], [false, 'faltan_respuestas'], 'un ejercicio que no está en el catálogo: pregunta')

  cierto(/UNO/.test(await falla(tools.guardar_en_mis_planes({ nombre: 'X', desde_atleta: 'zz_atleta', tipo: 'workout', sesiones: [sesion] }))), 'las dos fuentes a la vez: avisa')
  cierto(/Qué se guarda/i.test(await falla(tools.guardar_en_mis_planes({ nombre: 'X' }))), 'ninguna fuente: avisa')
  cierto(/Falta el nombre/.test(await falla(tools.guardar_en_mis_planes({ nombre: ' ', tipo: 'workout', sesiones: [sesion] }))), 'sin nombre: avisa')
  cierto(/No encontré la carpeta/.test(await falla(tools.guardar_en_mis_planes({ nombre: 'X', tipo: 'workout', sesiones: [sesion], carpeta: 'Natación' }))), 'una carpeta que no existe: avisa y no guarda')
  const repe = sc(await tools.guardar_en_mis_planes({ nombre: 'Piernas pesadas', tipo: 'workout', sesiones: [sesion] }))
  cierto(/quedaron los dos/.test(repe.aviso), 'un nombre repetido del mismo tipo se avisa')
  ok('guardar_en_mis_planes (armado): workout, rutina y programa; pregunta lo que falta sin guardar; avisos')
}

/* ======================= cambiar, duplicar, borrar ======================= */
{
  const { tools, datos } = armar(SEMBRADO())
  const ant = datos.routine_templates.find((x: any) => x.id === 't-r').updated_at
  const mov = sc(await tools.cambiar_en_mis_planes({ item: 'Semana base', carpeta: 'Fútbol › Fuerza' }))
  igual([mov.listo, mov.ahora.carpeta], [true, 'Fútbol › Fuerza'], 'mueve a una carpeta por su ruta')
  const fr = datos.routine_templates.find((x: any) => x.id === 't-r')
  igual([fr.carpeta_id, fr.updated_at], ['car-fz', ant], 'mover no cambia la fecha de «cambiado»')
  await tools.cambiar_en_mis_planes({ item: 'Semana base', nombre: 'Semana inicial', descripcion: 'Para empezar' })
  const fr2 = datos.routine_templates.find((x: any) => x.id === 't-r')
  igual([fr2.name, fr2.descripcion, fr2.updated_at !== ant], ['Semana inicial', 'Para empezar', true], 'cambia nombre y descripción, y sí marca la fecha')
  await tools.cambiar_en_mis_planes({ item: 'Semana inicial', carpeta: 'sin carpeta' })
  igual(datos.routine_templates.find((x: any) => x.id === 't-r').carpeta_id, null, '«sin carpeta» la saca de su carpeta')
  cierto(/Qué cambio/i.test(await falla(tools.cambiar_en_mis_planes({ item: 'Semana inicial' }))), 'sin ningún cambio, avisa')
  cierto(/no puede quedar vacío/.test(await falla(tools.cambiar_en_mis_planes({ item: 'Semana inicial', nombre: '  ' }))), 'un nombre vacío, avisa')

  const dup = sc(await tools.duplicar_en_mis_planes({ item: 'Fuerza 8 semanas' }))
  igual([dup.listo, dup.copia.nombre, dup.copia.tipo, dup.copia.carpeta], [true, 'Fuerza 8 semanas (copia)', 'programa', 'Fútbol › Fuerza'], 'duplica en la misma carpeta, con «(copia)»')
  const copia = datos.programas_guardados.find((x: any) => x.name === 'Fuerza 8 semanas (copia)')
  igual([copia.data.phases.length, copia.resumen.semanas], [2, 3], 'con su contenido y su resumen')
  cierto(copia.data !== datos.programas_guardados[0].data, 'y es otra copia, no la misma')
  const dup2 = sc(await tools.duplicar_en_mis_planes({ item: 'Piernas A', nombre: 'Piernas B', carpeta: 'Yoga' }))
  igual([dup2.copia.carpeta, datos.routine_templates.find((x: any) => x.name === 'Piernas B').kind], ['Yoga', 'day'], 'duplicar un workout lo deja kind day, en la carpeta que digas')

  const bor = sc(await tools.borrar_de_mis_planes({ item: 'Piernas B' }))
  igual([bor.listo, bor.borrado.nombre, datos.routine_templates.some((x: any) => x.name === 'Piernas B')], [true, 'Piernas B', false], 'borra')
  cierto(/No encontré/.test(await falla(tools.borrar_de_mis_planes({ item: 'Piernas B' }))), 'borrar lo que ya no está, avisa')
  ok('cambiar, duplicar y borrar: carpeta, nombre, fechas, copias y borrado')
}

/* ======================= carpetas ======================= */
{
  const { tools, datos } = armar(SEMBRADO())
  const nueva = sc(await tools.crear_carpeta({ nombre: 'Fase 1', dentro_de: 'Fútbol › Fuerza' }))
  igual([nueva.listo, nueva.carpeta.ruta], [true, 'Fútbol › Fuerza › Fase 1'], 'crea una carpeta dentro de otra')
  igual(datos.carpetas_planes.at(-1).parent_id, 'car-fz', 'con su carpeta de arriba')
  const otra = sc(await tools.crear_carpeta({ nombre: 'fase 1', dentro_de: 'Fútbol › Fuerza' }))
  igual([otra.nota, datos.carpetas_planes.length], ['Ya existía; no se creó otra.', 4], 'una repetida no se crea dos veces')
  const arriba = sc(await tools.crear_carpeta({ nombre: 'Natación' }))
  igual([arriba.carpeta.ruta, datos.carpetas_planes.at(-1).parent_id], ['Natación', null], 'sin «dentro_de», queda arriba de todo')

  // Hasta 5 niveles.
  const hondo = armar({ carpetas_planes: [1, 2, 3, 4, 5].map((i) => ({ id: `n${i}`, nombre: `N${i}`, parent_id: i === 1 ? null : `n${i - 1}`, owner_id: 'master-1' })) })
  cierto(/nivel más profundo/.test(await falla(hondo.tools.crear_carpeta({ nombre: 'N6', dentro_de: 'N5' }))), 'no deja pasar de 5 niveles')

  const ren = sc(await tools.cambiar_carpeta({ carpeta: 'Yoga', nombre: 'Yoga y pilates' }))
  igual([ren.listo, datos.carpetas_planes.find((c: any) => c.id === 'car-y').nombre], [true, 'Yoga y pilates'], 'renombra')
  await tools.cambiar_carpeta({ carpeta: 'Yoga y pilates', dentro_de: 'Fútbol' })
  igual(datos.carpetas_planes.find((c: any) => c.id === 'car-y').parent_id, 'car-f', 'la mueve dentro de otra')
  await tools.cambiar_carpeta({ carpeta: 'Yoga y pilates', dentro_de: 'sin carpeta' })
  igual(datos.carpetas_planes.find((c: any) => c.id === 'car-y').parent_id, null, 'o arriba de todo')
  cierto(/no puede ir ahí/.test(await falla(tools.cambiar_carpeta({ carpeta: 'Fútbol', dentro_de: 'Fútbol › Fuerza' }))), 'no deja meterla dentro de lo que cuelga de ella')
  cierto(/no puede ir ahí/.test(await falla(tools.cambiar_carpeta({ carpeta: 'Fútbol', dentro_de: 'Fútbol' }))), 'ni dentro de sí misma')
  cierto(/Qué cambio/i.test(await falla(tools.cambiar_carpeta({ carpeta: 'Fútbol' }))), 'sin cambio, avisa')

  // Borrar una carpeta: lo de adentro sube un nivel.
  const b = armar(SEMBRADO())
  const del = sc(await b.tools.borrar_carpeta({ carpeta: 'Fútbol › Fuerza' }))
  igual(del.listo, true, 'borra la carpeta')
  igual(b.datos.carpetas_planes.map((c: any) => c.id).sort(), ['car-f', 'car-y'], 'ya no está')
  igual([b.datos.programas_guardados[0].carpeta_id, b.datos.routine_templates.find((t: any) => t.id === 't-w').carpeta_id], ['car-f', 'car-f'], 'lo que tenía adentro subió a la carpeta de arriba, no se borró')
  const c = armar(SEMBRADO())
  await c.tools.borrar_carpeta({ carpeta: 'Fútbol' })
  igual([c.datos.carpetas_planes.find((x: any) => x.id === 'car-fz').parent_id, c.datos.programas_guardados.length], [null, 1], 'una carpeta de arriba: su subcarpeta pasa a «Sin carpeta» y nada se pierde')
  ok('carpetas: crear (sin repetir, hasta 5 niveles), renombrar, mover con reglas y borrar subiendo lo de adentro')
}


/* ======================= asignar_de_mis_planes ======================= */
const ATLETAS = [ATLETA, OTRO(2, 'zz_dos', 'Dos Prueba'), OTRO(3, 'zz_tres', 'Tres Prueba'), OTRO(4, 'zz_cuatro', 'Cuatro Prueba')]
const planDe = (n: number, base: any = PLAN_POR_FASES()) => ({ ...base, id: `plan-a${n}`, user_id: `atleta-${n}`, title: `Plan de ${n}` })
const fantasma = () => ({ id: 'plan-a4', user_id: 'atleta-4', title: 'Vacío', status: 'active', updated_at: '2026-01-01', profesional_id: null, data: { kind: 'weekly', phases: [{ id: 'p-v', num: 1, name: 'Rutina semanal', weekData: [semana(1, [])] }] } })
const mundo = (extra: Record<string, any[]> = {}) => armar({
  ...SEMBRADO(), profiles: ATLETAS,
  plans: [planDe(1), planDe(2), fantasma()],
  // «Dos» va en la fase 2 (Potencia): su puntero lo dice.
  user_app_state: [{ user_id: 'atleta-2', data: { 'wr:cursor': { phaseId: 'p-2', weekNum: 1, dayIdx: 0 } } }],
  ...extra,
})
const planDeAtleta = (m: any, n: number) => m.datos.plans.find((p: any) => p.user_id === `atleta-${n}`)
const idsDeFases = (plan: any) => plan.data.phases.map((f: any) => f.id)

{
  const m = mundo()
  // Quien no tiene plan: se crea.
  const nuevo = sc(await m.tools.asignar_de_mis_planes({ item: 'Fuerza 8 semanas', atletas: ['zz_tres'] }))
  igual([nuevo.listo, nuevo.asignado, nuevo.resultados[0].estado], [true, '1 de 1', 'ok'], 'un programa a quien no tiene plan')
  const p3 = planDeAtleta(m, 3)
  igual([p3.title, p3.status, p3.profesional_id, p3.created_by, p3.data.kind, p3.data.foto, p3.data.ciencia.length], ['Fuerza 8 semanas', 'active', null, 'master-1', 'periodized', '/fotos/plan.jpg', 1], 'queda como plan activo, con el nombre, su foto y su ciencia')
  cierto(idsDeFases(p3).every((id: string) => !['p-1', 'p-2'].includes(id)), 'las fases traen ids nuevos (lo que anota el atleta no se mezcla con otra entrega)')
  igual(p3.data.phases.map((f: any) => f.weeks), [2, 1], 'y la duración al día')

  // Quien ya tiene plan: no se asigna a NADIE sin permiso de reemplazar.
  const antes = JSON.stringify(m.datos.plans)
  const sinPermiso = sc(await m.tools.asignar_de_mis_planes({ item: 'Fuerza 8 semanas', atletas: ['zz_atleta', 'zz_cuatro'] }))
  igual([sinPermiso.asignado, sinPermiso.motivo, sinPermiso.ya_tienen_plan], [false, 'ya_tienen_plan', ['Atleta Prueba: "Plan de 1"']], 'si alguien ya tiene plan: no asigna a nadie y dice quién')
  igual(sinPermiso.sin_plan, ['Cuatro Prueba'], 'una rutina vacía cuenta como «sin plan»')
  igual(JSON.stringify(m.datos.plans), antes, 'y no escribió nada')
  const con = sc(await m.tools.asignar_de_mis_planes({ item: 'Fuerza 8 semanas', atletas: ['zz_atleta', 'zz_cuatro'], reemplazar: true, titulo: 'Fuerza de octubre' }))
  igual([con.listo, con.asignado, con.resultados.map((r: any) => r.estado)], [true, '2 de 2', ['ok', 'ok']], 'con «reemplazar» sí')
  igual([planDeAtleta(m, 1).title, planDeAtleta(m, 1).data.phases.length, planDeAtleta(m, 4).data.kind], ['Fuerza de octubre', 2, 'periodized'], 'reemplaza lo que había, con el título que se dio (también la rutina vacía)')
  cierto(/historial/.test(con.resultados[0].reemplazo) && con.resultados[1].reemplazo === undefined, 'avisa que el anterior quedó en el historial, menos de la rutina vacía')
  igual(m.datos.plans.filter((p: any) => p.user_id === 'atleta-1').length, 1, 'sigue habiendo UN plan activo por atleta')

  // Una rutina.
  const r = sc(await mundo().tools.asignar_de_mis_planes({ item: 'Semana base', atletas: ['zz_tres'] }))
  igual(r.resultados[0].estado, 'ok', 'una rutina semanal también')
  const m2 = mundo()
  await m2.tools.asignar_de_mis_planes({ item: 'Semana base', atletas: ['zz_tres'] })
  igual([planDeAtleta(m2, 3).data.kind, planDeAtleta(m2, 3).data.estructura, planDeAtleta(m2, 3).data.phases[0].weekData[0].days.length], ['weekly', 'rutina', 2], 'queda como rutina que se repite')

  // Hay que encontrar a TODOS antes de tocar a alguien.
  const m3 = mundo()
  const a3 = JSON.stringify(m3.datos.plans)
  cierto(/No encontré a/.test(await falla(m3.tools.asignar_de_mis_planes({ item: 'Fuerza 8 semanas', atletas: ['zz_tres', 'zz_nadie'], reemplazar: true }))), 'si uno de los nombres no existe, avisa')
  igual(JSON.stringify(m3.datos.plans), a3, 'y no se asignó a ninguno de los otros')
  ok('asignar_de_mis_planes: programa y rutina (a uno o varios, sin reemplazar sin permiso, ids nuevos, historial)')
}

{
  const m = mundo()
  // Un workout: en la semana en que va HOY cada quien.
  const r = sc(await m.tools.asignar_de_mis_planes({ item: 'Piernas A', atletas: ['zz_atleta', 'zz_dos', 'zz_tres'], dia: 'miércoles' }))
  igual(r.resultados.map((x: any) => x.estado), ['ok', 'ok', 'sin_plan'], 'quien no tiene plan se salta y los demás siguen')
  igual([r.resultados[0].en, r.resultados[1].en], ['Fuerza · semana 1 · Miércoles', 'Potencia · semana 1 · Miércoles'], 'cada quien en la semana en que va')
  const diasDe = (n: number, f: number, w: number) => planDeAtleta(m, n).data.phases[f].weekData[w].days
  igual(diasDe(1, 0, 0).map((d: any) => d.day), ['Lun', 'Mar', 'Jue', 'Vie', 'Mié'], 'se agrega al final de la semana, sin mover lo que había')
  const nuevo = diasDe(1, 0, 0).at(-1)
  igual([nuevo.name, nuevo.cat, nuevo.exercises.length], ['Piernas', 'gym', 1], 'con la sesión y sus ejercicios')
  igual(diasDe(2, 1, 0).map((d: any) => d.day), ['Lun', 'Mié'], 'el de «Dos», en su fase 2')
  igual(diasDe(2, 0, 0).length, 4, 'y su fase 1 no se tocó')

  // Si el día ya tiene sesión: agregar (por defecto) o reemplazar la primera.
  const lunes = sc(await m.tools.asignar_de_mis_planes({ item: 'Piernas A', atletas: ['zz_atleta'], dia: 'lunes' }))
  cierto(/ya tenía sesión/.test(lunes.resultados[0].nota), 'avisa que ese día ya tenía sesión')
  igual(diasDe(1, 0, 0).filter((d: any) => d.day === 'Lun').length, 2, 'por defecto se AGREGA como otra')
  const m2 = mundo()
  const un = sc(await m2.tools.asignar_de_mis_planes({ item: 'Piernas A', atletas: ['zz_atleta'], dia: 'lunes', si_hay_sesion: 'reemplazar' }))
  const lun = planDeAtleta(m2, 1).data.phases[0].weekData[0].days.filter((d: any) => d.day === 'Lun')
  igual([un.resultados[0].estado, lun.length, lun[0].exercises[0].name], ['ok', 1, 'Back Squat'], 'con «reemplazar» ocupa el lugar de la primera, sin dejar dos')

  // Fase y semana elegidas.
  const m3 = mundo()
  const dos = sc(await m3.tools.asignar_de_mis_planes({ item: 'Piernas A', atletas: ['zz_atleta'], dia: 'sábado', fase: 'Fuerza', semana: 2 }))
  igual([dos.resultados[0].en, planDeAtleta(m3, 1).data.phases[0].weekData[1].days.at(-1).day], ['Fuerza · semana 2 · Sábado', 'Sáb'], 'con fase y semana, en esa')

  // Una clase viaja con su video.
  const m4 = mundo()
  await m4.tools.asignar_de_mis_planes({ item: 'Vinyasa 45', atletas: ['zz_atleta'], dia: 'viernes' })
  igual(planDeAtleta(m4, 1).data.phases[0].weekData[0].days.at(-1).clase, CLASE, 'una clase llega con su video')

  cierto(/En qué día/i.test(await falla(m.tools.asignar_de_mis_planes({ item: 'Piernas A', atletas: ['zz_atleta'] }))), 'un workout sin día: pregunta')
  igual(planDeAtleta(m, 3), undefined, 'quien no tiene plan sigue sin plan (un workout no le crea uno)')
  ok('asignar_de_mis_planes: workout y clase en la semana de cada quien, agregar o reemplazar, fase y semana, sin plan')
}

/* ======================= copiar_plan_a_atleta ======================= */
{
  const m = mundo()
  const r = sc(await m.tools.copiar_plan_a_atleta({ atleta: 'zz_tres', titulo: 'Fuerza Emiliano', desde_atleta: 'zz_atleta', fases_elegidas: ['Fuerza'], solo_tipos: ['gym'] }))
  igual([r.listo, r.plan, r.copiado_de, r.tamano], [true, 'Fuerza Emiliano', 'Del plan de Atleta Prueba', '1 fase(s), 2 semana(s)'], 'copia UNA fase del plan de otro atleta')
  const p3 = planDeAtleta(m, 3)
  igual([p3.title, p3.user_id, p3.status], ['Fuerza Emiliano', 'atleta-3', 'active'], 'queda como plan del destino')
  igual([...new Set(p3.data.phases.flatMap((f: any) => f.weekData.flatMap((w: any) => w.days.map((d: any) => d.cat))))], ['gym'], 'solo con sesiones de gimnasio')
  igual(r.sesiones_quitadas, '3 sesión(es) no entraron a la copia por el filtro de tipos.', 'dice cuántas quitó')
  igual(p3.data.ciencia, [], 'sin la ciencia del plan entero (era de todo el plan, no de una fase)')
  igual(planDeAtleta(m, 1).data.phases.length, 2, 'el plan de origen no se tocó')
  cierto(!idsDeFases(p3).includes('p-1'), 'fases con ids nuevos')

  // Ya tiene plan.
  const antes = JSON.stringify(m.datos.plans)
  const ya = sc(await m.tools.copiar_plan_a_atleta({ atleta: 'zz_dos', titulo: 'X', desde_atleta: 'zz_atleta' }))
  igual([ya.asignado, ya.motivo], [false, 'ya_tiene_plan'], 'si el destino ya tiene plan: no copia')
  igual(JSON.stringify(m.datos.plans), antes, 'y no escribió nada')
  const rem = sc(await m.tools.copiar_plan_a_atleta({ atleta: 'zz_dos', titulo: 'Para Dos', desde_atleta: 'zz_atleta', fases_elegidas: ['Potencia'], reemplazar: true }))
  igual([rem.listo, planDeAtleta(m, 2).title, planDeAtleta(m, 2).data.phases.length], [true, 'Para Dos', 1], 'con «reemplazar» sí')
  cierto(/historial/.test(rem.reemplazo), 'y avisa del historial')

  // De Mis planes.
  const m2 = mundo()
  const mp = sc(await m2.tools.copiar_plan_a_atleta({ atleta: 'zz_tres', titulo: 'De mi catálogo', desde_mis_planes: 'Fuerza 8 semanas', sin_tipos: ['correr', 'neural'] }))
  igual([mp.listo, mp.copiado_de, mp.tamano], [true, 'De Mis planes: Fuerza 8 semanas', '2 fase(s), 3 semana(s)'], 'copia un programa guardado')
  igual(mp.sesiones_quitadas, '3 sesión(es) no entraron a la copia por el filtro de tipos.', 'con el filtro')
  igual(JSON.stringify(m2.datos.programas_guardados[0].data).includes('correr'), true, 'y lo guardado en Mis planes no se tocó')
  const rt = sc(await mundo().tools.copiar_plan_a_atleta({ atleta: 'zz_tres', titulo: 'Rutina copiada', desde_mis_planes: 'Semana base' }))
  igual(rt.tamano, 'rutina que se repite', 'una rutina guardada')
  cierto(/asignar_de_mis_planes/.test(await falla(mundo().tools.copiar_plan_a_atleta({ atleta: 'zz_tres', titulo: 'X', desde_mis_planes: 'Piernas A' }))), 'un workout no se copia como plan: manda a asignar_de_mis_planes')

  cierto(/UNO/.test(await falla(m.tools.copiar_plan_a_atleta({ atleta: 'zz_tres', titulo: 'X' }))), 'sin fuente: avisa')
  cierto(/UNO/.test(await falla(m.tools.copiar_plan_a_atleta({ atleta: 'zz_tres', titulo: 'X', desde_atleta: 'zz_atleta', desde_mis_planes: 'Semana base' }))), 'con dos fuentes: avisa')
  cierto(/misma persona/.test(await falla(m.tools.copiar_plan_a_atleta({ atleta: 'zz_atleta', titulo: 'X', desde_atleta: 'zz_atleta', reemplazar: true }))), 'de uno a sí mismo: avisa')
  cierto(/Falta el título/.test(await falla(m.tools.copiar_plan_a_atleta({ atleta: 'zz_tres', titulo: ' ', desde_atleta: 'zz_atleta' }))), 'sin título: avisa')
  ok('copiar_plan_a_atleta: de otro atleta o de Mis planes, fases elegidas, filtro de tipos, reemplazo con permiso')
}

console.log(`\nTodo bien: ${n} grupos de pruebas de Mis planes`)
