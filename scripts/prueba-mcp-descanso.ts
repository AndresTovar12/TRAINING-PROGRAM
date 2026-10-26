// Prueba de que el conector de IA guarda el descanso como UN tiempo, aunque la IA lo escriba como frase: el modo entreno solo cuenta hacia atrás
// un tiempo («30 seg»), no «30 segundos antes del siguiente ejercicio» (Andrés, 16 oct 2026: «hice una prueba y no los contó»).
//
//   deno run -A --node-modules-dir=none scripts/prueba-mcp-descanso.ts
import { diaDesdeEntrada } from '../supabase/functions/mcp/plan.ts'

const igual = (a: unknown, b: unknown, msg: string) => {
  const x = JSON.stringify(a), y = JSON.stringify(b)
  if (x !== y) throw new Error(`${msg}\n  obtuve:   ${x}\n  esperaba: ${y}`)
}

const { dia } = diaDesdeEntrada('Mié', {
  nombre: 'Piernas',
  ejercicios: [
    { nombre: 'Back Squat', series: 3, cantidad: 10, descanso: '30 segundos antes del siguiente ejercicio' },
    { nombre: 'Forward Lunges', series: 3, cantidad: 10, descanso: 'Descansa 90 s entre series', descanso_set: '2 minutos al terminar' },
    { nombre: 'Plancha', series: 3, cantidad: 30, unidad: 'seg', descanso: 'Recuperación total' },
    { nombre: 'Remo', series: 3, cantidad: 12, descanso: 'Sin pausa, pasa al siguiente ejercicio' },
    { nombre: 'Correr', series: 2, unidad: 'm', lapsos: [{ cantidad: 400, descanso: '1 minuto de pausa' }, { cantidad: 200, descanso: '45 seg' }] },
  ],
}, [])
const ex = dia.exercises as any[]
igual(ex[0].descanso, '30 seg', 'la frase queda como el tiempo')
igual(ex[1].descanso, '90 seg', 'otra frase, otro tiempo')
igual(ex[1].descansoSet, '2 min', 'el descanso del Set también')
igual(ex[2].descanso, 'Recuperación total', 'lo que no trae un tiempo claro no se toca')
igual(ex[3].descanso, undefined, '«Sin pausa» no se guarda como descanso')
igual(ex[4].lapsos.map((l: any) => l.descanso), ['1 min', '45 seg'], 'los lapsos también')
console.log('prueba-mcp-descanso: todo bien')
