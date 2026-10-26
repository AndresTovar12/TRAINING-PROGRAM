// deno-lint-ignore-file no-explicit-any
// Prueba de invitar_al_equipo_de_un_atleta, dar_de_alta (auditoría p82) y pausar/reanudar/mover el plan (p79) en el conector, 26 oct 2026: piden confirmación de verdad y llaman a la función
// correcta de la base según quién es quien lo pide (coach principal o profesional del equipo).
// Corre desde supabase/functions/mcp:  deno run -A --config deno.json ../../../scripts/prueba-mcp-equipo.ts
import { herramientasDelCoach } from '../supabase/functions/mcp/coach.ts'
import { baseEnMemoria, cierto, igual } from './mcp-prueba-comun.ts'

let n = 0
const ok = (nombre: string) => { n += 1; console.log(`OK    ${nombre}`) }

const ATLETA = { id: 'atleta-1', username: 'juan', full_name: 'Juan Pérez', role: 'user', is_owner: false, coach_id: 'coach-1', is_active: true, unidad_peso: 'kg' }

const semana = (num: number) => ({ num, days: [{ day: 'Lun', cat: 'gym', name: `Sesión ${num}`, exercises: [{ set: 1, name: 'Sentadilla', sets: '3', reps: '8', exercise_id: 'ex-1' }] }] })
const PLAN = (): any => ({ id: 'pl-1', user_id: 'atleta-1', title: 'Plan de prueba', status: 'active', profesional_id: null, updated_at: '2026-10-20T00:00:00Z', data: { kind: 'periodized', phases: [
  { id: 'f1', name: 'Base', weekData: [semana(1), semana(2)] },
  { id: 'f2', name: 'Fuerza', weekData: [semana(1)] },
] } })

function armar(yo: { id: string; principal: boolean }, cursor: any = { phaseId: 'f1', weekNum: 2, dayIdx: 0 }) {
  const llamadas: { nombre: string; args: any }[] = []
  const rpc = (nombre: string, devuelve: any = null) => (args: any) => { llamadas.push({ nombre, args }); return devuelve }
  const { db } = baseEnMemoria({ profiles: [ATLETA], plans: [PLAN()], user_app_state: [{ user_id: 'atleta-1', data: { 'wr:cursor': cursor } }] }, {
    rpcs: {
      mover_plan_de_atleta: rpc('mover_plan_de_atleta'),
      invitar_al_equipo: rpc('invitar_al_equipo', { tipo: 'equipo', profesional_id: 'fisio-9' }),
      cambiar_alta: rpc('cambiar_alta', { ...ATLETA, alta_en: '2026-10-26T12:00:00Z' }), // devuelve la fila del perfil
      cambiar_alta_de_equipo: rpc('cambiar_alta_de_equipo', '2026-10-26T12:00:00Z'),
      nombres_del_equipo: () => [
        { profesional_id: 'coach-1', full_name: 'Laura', username: 'laura', profesion: 'Entrenador', es_principal: true, estado: 'activo', alta_en: null },
        ...(yo.principal ? [] : [{ profesional_id: yo.id, full_name: 'Beto', username: 'beto', profesion: 'Fisioterapeuta', es_principal: false, estado: 'activo', alta_en: null }]),
      ],
    },
  })
  const quien: any = { id: yo.id, usuario: yo.principal ? 'laura' : 'beto', nombre: yo.principal ? 'Laura' : 'Beto', rol: yo.principal ? 'coach' : 'fisio', salud: !yo.principal, unidad: 'kg', db, token: 't' }
  const tools: Record<string, (a: any) => Promise<any>> = {}
  const server: any = { registerTool: (nombre: string, _def: unknown, fn: (a: any) => Promise<any>) => { tools[nombre] = fn } }
  herramientasDelCoach(server, quien)
  return { tools, llamadas }
}

// 1) Invitar: sin confirmar no hace nada; confirmado llama a la base.
let { tools, llamadas } = armar({ id: 'coach-1', principal: true })
let r = (await tools.invitar_al_equipo_de_un_atleta({ atleta: 'juan', profesional: '@beto' })).structuredContent
igual([r.invitado, r.motivo, llamadas.length], [false, 'falta_confirmacion', 0], 'sin confirmado no invita a nadie')
r = (await tools.invitar_al_equipo_de_un_atleta({ atleta: 'juan', profesional: '@beto', confirmado: true })).structuredContent
igual([r.listo, llamadas.length, llamadas[0].nombre, llamadas[0].args], [true, 1, 'invitar_al_equipo', { p_atleta: 'atleta-1', p_ref: '@beto' }], 'con confirmado invita')
cierto(/pendiente/.test(r.estado), 'dice que queda pendiente')
ok('invitar_al_equipo_de_un_atleta: pide confirmación y llama a invitar_al_equipo')

// 2) Dar de alta como COACH PRINCIPAL → cambiar_alta.
r = (await tools.dar_de_alta({ atleta: 'juan' })).structuredContent
igual([r.hecho, r.motivo, llamadas.length], [false, 'falta_confirmacion', 1], 'sin confirmado no da de alta')
r = (await tools.dar_de_alta({ atleta: 'juan', confirmado: true })).structuredContent
igual([r.listo, r.alta, llamadas.at(-1)!.nombre, llamadas.at(-1)!.args], [true, true, 'cambiar_alta', { p_atleta: 'atleta-1', p_alta: true }], 'el principal usa cambiar_alta')
cierto(r.dada_de_alta_el === '2026-10-26', `dice la fecha del alta (salió ${r.dada_de_alta_el})`)
r = (await tools.dar_de_alta({ atleta: 'juan', alta: false, confirmado: true })).structuredContent
igual([r.alta, llamadas.at(-1)!.args.p_alta], [false, false], 'alta=false reabre')
ok('dar_de_alta: coach principal usa cambiar_alta; alta=false reabre')

// 3) Un profesional del EQUIPO usa cambiar_alta_de_equipo.
;({ tools, llamadas } = armar({ id: 'fisio-9', principal: false }))
r = (await tools.dar_de_alta({ atleta: 'juan', confirmado: true })).structuredContent
igual([r.listo, llamadas[0].nombre], [true, 'cambiar_alta_de_equipo'], 'un fisio del equipo usa cambiar_alta_de_equipo')
ok('dar_de_alta: un profesional del equipo usa cambiar_alta_de_equipo')

// 4) Pausar, reanudar y mover el plan (p79): confirmación real y el puntero correcto.
;({ tools, llamadas } = armar({ id: 'coach-1', principal: true }))
r = (await tools.pausar_plan_de_atleta({ atleta: 'juan' })).structuredContent
igual([r.hecho, r.motivo, llamadas.length], [false, 'falta_confirmacion', 0], 'pausar sin confirmado no hace nada')
cierto(/Base, semana 2/.test(r.va_a_pasar), `dice dónde se queda (salió: ${r.va_a_pasar})`)
r = (await tools.pausar_plan_de_atleta({ atleta: 'juan', confirmado: true })).structuredContent
igual([r.listo, r.en_pausa, llamadas[0].nombre, llamadas[0].args.p_clave, llamadas[0].args.p_atleta], [true, true, 'mover_plan_de_atleta', 'wr:cursor', 'atleta-1'], 'pausar escribe su wr:cursor')
cierto(!!llamadas[0].args.p_cursor.pausa && llamadas[0].args.p_cursor.weekNum === 2, 'el puntero queda en la misma semana, con pausa')
igual(llamadas[0].args.p_cursor.aviso.texto, 'Tu coach pausó tu plan', 'el atleta recibe su aviso')
await tools.reanudar_plan_de_atleta({ atleta: 'juan', confirmado: true }).then(() => { throw new Error('reanudar un plan que no está en pausa debe avisar') }).catch((e: any) => cierto(/no está en pausa|plan/i.test(String(e?.message ?? e)), 'reanudar sin pausa avisa'))
;({ tools, llamadas } = armar({ id: 'coach-1', principal: true }, { phaseId: 'f1', weekNum: 2, dayIdx: 0, pausa: '2026-10-20' }))
r = (await tools.reanudar_plan_de_atleta({ atleta: 'juan', confirmado: true })).structuredContent
igual([r.listo, r.en_pausa, llamadas[0].args.p_cursor.pausa], [true, false, undefined], 'reanudar quita la pausa')
igual(llamadas[0].args.p_cursor.aviso.texto, 'Tu coach reanudó tu plan', 'con su aviso')
;({ tools, llamadas } = armar({ id: 'coach-1', principal: true }))
r = (await tools.mover_plan_de_atleta_a({ atleta: 'juan', fase: 2, semana: 1 })).structuredContent
igual([r.hecho, llamadas.length], [false, 0], 'mover sin confirmado no mueve')
r = (await tools.mover_plan_de_atleta_a({ atleta: 'juan', fase: 2, semana: 1, confirmado: true })).structuredContent
igual([r.listo, llamadas[0].args.p_cursor.phaseId, llamadas[0].args.p_cursor.weekNum], [true, 'f2', 1], 'mover cambia fase y semana')
cierto(/Fuerza, semana 1/.test(r.va_en), 'dice a dónde')
ok('pausar, reanudar y mover el plan: confirmación real, puntero y aviso al atleta')

console.log(`\n${n} pruebas bien.`)
