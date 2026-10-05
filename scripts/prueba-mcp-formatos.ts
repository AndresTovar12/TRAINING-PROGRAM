// Prueba de que el conector de IA conoce los formatos de un Set: los LEE (ver_plan_de_atleta) y los
// ESCRIBE (crear_plan, editar_dia) sin perderlos al reemplazar una sesión.
//
//   deno run -A scripts/prueba-mcp-formatos.ts
import { diaDesdeEntrada, describirDia, describirEjercicio } from '../supabase/functions/mcp/plan.ts'
import { Aviso } from '../supabase/functions/mcp/util.ts'

const igual = (a: unknown, b: unknown, msg: string) => {
  const x = JSON.stringify(a), y = JSON.stringify(b)
  if (x !== y) throw new Error(`${msg}\n  obtuve:   ${x}\n  esperaba: ${y}`)
}
const cierto = (v: unknown, msg: string) => { if (!v) throw new Error(msg) }

const tabata = { id: 'tabata', pasos: [{ tipo: 'trabajo', seg: 20 }, { tipo: 'descanso', seg: 10 }], vueltas: 8, tope: null, turnan: false, anota: 'reps' }

/* ---- Un formato en UN ejercicio de un grupo vale para todos los del grupo ---- */
{
  const { dia } = diaDesdeEntrada('Lun', {
    nombre: 'Prueba',
    ejercicios: [
      { nombre: 'Sentadilla', series: 3, grupo: 1 },
      { nombre: 'Flexiones', series: 3, grupo: 1, formato: tabata },
      { nombre: 'Plancha', series: 3 },
    ],
  }, [])
  const ex = dia.exercises as any[]
  igual(ex[0].formato, tabata, 'el primer ejercicio del grupo recibe el formato aunque no lo traía')
  igual(ex[1].formato, tabata, 'el que lo traía lo conserva')
  igual([ex[0].sets, ex[1].sets], ['8', '8'], 'las series del grupo pasan a ser las vueltas')
  cierto(ex[2].formato === undefined, 'un ejercicio fuera del grupo no lo recibe')
  cierto(ex[0].formato !== ex[1].formato, 'cada ejercicio guarda su copia')
}

/* ---- Un ejercicio solo, con formato ---- */
{
  const amrap = { id: 'amrap', pasos: [{ tipo: 'trabajo', seg: 720 }], vueltas: 1, anota: 'rondas' }
  const { dia } = diaDesdeEntrada('Mar', { ejercicios: [{ nombre: 'Burpees', formato: amrap }] }, [])
  const e = (dia.exercises as any[])[0]
  igual(e.formato.pasos, [{ tipo: 'trabajo', seg: 720 }], 'los pasos se guardan')
  igual([e.formato.vueltas, e.formato.anota, e.formato.turnan, e.formato.tope], [1, 'rondas', false, null], 'lo que falta se llena con lo neutro')
  igual(e.sets, '1', 'un AMRAP no se repite')
}

/* ---- Un formato que no se entiende no se guarda a medias ---- */
for (const malo of [{}, { pasos: [] }, { pasos: 'x' }, { pasos: [{ tipo: 'trabajo', seg: 'abc' }] }]) {
  let aviso = false
  try { diaDesdeEntrada('Mié', { ejercicios: [{ nombre: 'X', formato: malo }] }, []) } catch (e) { aviso = e instanceof Aviso }
  cierto(aviso, `un formato inservible (${JSON.stringify(malo)}) debe dar un aviso claro`)
}

/* ---- Sin formato, todo igual que antes ---- */
{
  const { dia } = diaDesdeEntrada('Jue', { ejercicios: [{ nombre: 'Press', series: 4 }] }, [])
  const e = (dia.exercises as any[])[0]
  cierto(!('formato' in e), 'sin formato no aparece la llave')
  igual(e.sets, '4', 'las series se respetan')
}

/* ---- Leer: el formato se ve completo y con su resumen ---- */
{
  const { dia } = diaDesdeEntrada('Vie', { ejercicios: [{ nombre: 'Flexiones', formato: tabata }] }, [])
  const d = describirEjercicio((dia.exercises as any[])[0])
  igual(d.formato, tabata, 'la IA ve el formato entero')
  igual(d.formato_resumen, 'Tabata · 20 s + 10 s × 8', 'y su resumen')
}

/* ---- Ida y vuelta: lo que la IA lee es lo que manda de regreso, sin perder nada ---- */
{
  const origen = diaDesdeEntrada('Sáb', {
    ejercicios: [
      { nombre: 'Sentadilla', grupo: 1, formato: { ...tabata, turnan: true } },
      { nombre: 'Remo', grupo: 1 },
      { nota: 'Aflojar' },
    ],
  }, []).dia as any
  const visto = (origen.exercises as any[]).map((ex) => describirEjercicio(ex))
  const devuelto = diaDesdeEntrada('Sáb', {
    ejercicios: visto.map((v: any) => ({
      nombre: v.nombre, nota: v.nota, series: v.series, grupo: v.grupo, formato: v.formato,
    })),
  }, []).dia as any
  igual(devuelto.exercises.map((e: any) => e.formato), origen.exercises.map((e: any) => e.formato), 'el formato sobrevive a leer y reescribir una sesión')
  igual(devuelto.exercises.map((e: any) => e.sets), origen.exercises.map((e: any) => e.sets), 'y las vueltas también')
}

/* ---- Lo que anotó el atleta de un Set con formato se ve en el día ---- */
{
  const plan = { weekData: [{ num: 1, days: [] as any[] }] } as any
  const { dia } = diaDesdeEntrada('Lun', { ejercicios: [{ nombre: 'Burpees', formato: { id: 'amrap', pasos: [{ tipo: 'trabajo', seg: 720 }], vueltas: 1, anota: 'rondas' } }] }, [])
  plan.weekData[0].days.push(dia)
  const fase = { name: 'F1', weekData: plan.weekData }
  const registro = { formatos: { '0': { anota: 'rondas', valor: 7, extra: 3, seg: 720 } } }
  const out = describirDia(fase, plan.weekData[0], 0, registro) as any
  igual(out.resultados_de_formatos, [{ n: '0', resultado: '7 rondas + 3 reps', duro_seg: 720 }], 'el resultado se lee como en la app')
  cierto(describirDia(fase, plan.weekData[0], 0, { completed: true }).resultados_de_formatos === undefined, 'sin resultados no aparece la llave')
}

console.log('prueba-mcp-formatos: todo bien')
