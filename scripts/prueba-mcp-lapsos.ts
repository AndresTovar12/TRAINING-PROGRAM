// Prueba de que el conector de IA conoce los lapsos de un ejercicio: los LEE (ver_plan_de_atleta) y los ESCRIBE
// (crear_plan, editar_dia) sin perderlos al reemplazar una sesión, y que las cargas nuevas pasan tal cual.
//
//   deno run -A scripts/prueba-mcp-lapsos.ts
import { diaDesdeEntrada, describirEjercicio } from '../supabase/functions/mcp/plan.ts'
import { Aviso } from '../supabase/functions/mcp/util.ts'

const igual = (a: unknown, b: unknown, msg: string) => {
  const x = JSON.stringify(a), y = JSON.stringify(b)
  if (x !== y) throw new Error(`${msg}\n  obtuve:   ${x}\n  esperaba: ${y}`)
}
const cierto = (v: unknown, msg: string) => { if (!v) throw new Error(msg) }
const lanza = (f: () => unknown, msg: string) => {
  try { f() } catch (e) { cierto(e instanceof Aviso, `${msg}: se esperaba un Aviso y llegó ${e}`); return }
  throw new Error(`${msg}: debía avisar y no lo hizo`)
}

const entrada = {
  nombre: 'Running',
  ejercicios: [{
    nombre: 'Correr', series: 4, unidad: 'm',
    lapsos: [
      { cantidad: 800, intensidad: '4:34-5:00 min/km', descanso: '30 seg' },
      { cantidad: 2, unidad: 'min', intensidad: '6:39-7:00 min/km', descanso: '1 min' },
    ],
  }],
}

/* ---- Escribir: cada lapso con su unidad, y el espejo en los campos de siempre ---- */
const { dia, sinCantidad } = diaDesdeEntrada('Lun', entrada, [])
const ex = (dia.exercises as any[])[0]
igual(ex.lapsos, [
  { reps: '800', unidad: 'm', intensity: '4:34-5:00 min/km', descanso: '30 seg' },
  { reps: '2', unidad: 'min', intensity: '6:39-7:00 min/km', descanso: '1 min' },
], 'los lapsos se guardan con su unidad (el primero toma la del ejercicio)')
igual([ex.reps, ex.unidad, ex.intensity, ex.descanso, ex.sets], ['800', 'm', '4:34-5:00 min/km', '1 min', '4'], 'el espejo: primer lapso y descanso del último')
igual(sinCantidad, [], 'con cantidad en cada lapso no hay nada que preguntar')

/* ---- Leer: lo que se escribió se ve completo, y vuelve a escribirse igual (editar_dia) ---- */
const visto: any = describirEjercicio(ex)
igual(visto.lapsos, [
  { lapso: 1, cantidad: '800 m', intensidad: '4:34-5:00 min/km', descanso: '30 seg' },
  { lapso: 2, cantidad: '2 min', intensidad: '6:39-7:00 min/km', descanso: '1 min' },
], 'la IA ve cada lapso')
const devuelta = diaDesdeEntrada('Lun', { nombre: 'Running', ejercicios: [{ ...visto, nombre: visto.nombre, series: visto.series, unidad: undefined }] }, [])
igual((devuelta.dia.exercises as any[])[0].lapsos, ex.lapsos, 'leer y volver a escribir deja los lapsos igual')

/* ---- Un grupo: si uno trae lapsos, todo el Set queda en lapsos ---- */
{
  const { dia: d } = diaDesdeEntrada('Lun', {
    ejercicios: [
      { nombre: 'Correr', series: 3, grupo: 1, lapsos: [{ cantidad: 1, unidad: 'km' }, { cantidad: 500, unidad: 'm' }] },
      { nombre: 'Thruster', series: 3, grupo: 1, cantidad: 10, intensidad: '40 kg' },
    ],
  }, [])
  const e = d.exercises as any[]
  igual(e[1].lapsos, [{ reps: '10', unidad: 'reps', intensity: '40 kg', descanso: '' }], 'el compañero del grupo entra con un lapso (el de su línea)')
  igual(e[0].lapsos.length, 2, 'el que los pidió, con los suyos')
}

/* ---- No se mezcla con lo que sería el mismo dato en dos sitios ---- */
lanza(() => diaDesdeEntrada('Lun', { ejercicios: [{ nombre: 'Correr', series: 2, por_vuelta: [{ cantidad: 1 }, { cantidad: 2 }], lapsos: [{ cantidad: 1, unidad: 'km' }] }] }, []), 'lapsos con por_vuelta')
lanza(() => diaDesdeEntrada('Lun', { ejercicios: [{ nombre: 'Correr', formato: { id: 'amrap', pasos: [{ tipo: 'trabajo', seg: 600 }], vueltas: 1 }, lapsos: [{ cantidad: 1, unidad: 'km' }] }] }, []), 'lapsos con formato')
lanza(() => diaDesdeEntrada('Lun', { ejercicios: [{ nombre: 'Correr', lapsos: [{ cantidad: 1, unidad: 'parsecs' }] }] }, []), 'una unidad que no existe')

/* ---- Un lapso sin cantidad se pregunta, como una cantidad que falta ---- */
{
  const { sinCantidad: falta } = diaDesdeEntrada('Lun', { ejercicios: [{ nombre: 'Correr', lapsos: [{ cantidad: 800, unidad: 'm' }, { intensidad: 'Zona 2' }] }] }, [])
  igual(falta, ['Correr'], 'si a un lapso le falta cuánto, se pregunta')
}

/* ---- Las cargas nuevas pasan tal cual, sin reescribirse ---- */
{
  const { dia: d } = diaDesdeEntrada('Lun', {
    ejercicios: [
      { nombre: 'Remo', cantidad: 500, unidad: 'm', intensidad: '250 W' },
      { nombre: 'Nado', cantidad: 400, unidad: 'm', intensidad: '1:45 /100 m' },
      { nombre: 'Tempo', cantidad: 20, unidad: 'min', intensidad: 'Zona 4' },
      { nombre: 'Sprints', cantidad: 6, intensidad: '85% intensidad' },
    ],
  }, [])
  igual((d.exercises as any[]).map((x) => x.intensity), ['250 W', '1:45 /100 m', 'Zona 4', '85% intensidad'], 'las cargas de cardio se guardan como se escribieron')
  igual((describirEjercicio((d.exercises as any[])[3]) as any).intensidad, '85% intensidad', 'y la IA las lee igual')
}

console.log('prueba-mcp-lapsos: todo bien')
