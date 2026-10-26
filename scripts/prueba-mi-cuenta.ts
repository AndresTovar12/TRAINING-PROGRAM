/* Prueba de `mi-cuenta` (eliminar la cuenta) con una base y un Stripe falsos: `deno run --allow-all --import-map=scripts/prueba-mi-cuenta.importmap.json scripts/prueba-mi-cuenta.ts`.
   Lo que importa (Andrés, 26 oct 2026): a nadie se le niega borrar su cuenta, y un coach que se va NO afecta a sus compradores: sus planes y compras se quedan y el cobro de cada
   uno se cierra al final de SU plan. Si Stripe falla, no se borra nada. */
// deno-lint-ignore-file no-explicit-any
import { strict as assert } from 'node:assert'

Deno.env.set('SUPABASE_URL', 'http://fake.supabase')
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'service')
Deno.env.set('SUPABASE_ANON_KEY', 'anon')
Deno.env.set('STRIPE_SECRET_KEY', 'sk_test_falsa')

let manejador: (req: Request) => Promise<Response> = async () => new Response('x')
;(Deno as any).serve = (fn: any) => { manejador = fn; return {} }

const llamadas: Array<{ url: string; metodo: string; cuerpo: string }> = []
let stripeFalla = false
globalThis.fetch = (async (url: any, init: any = {}) => {
  const u = String(url)
  llamadas.push({ url: u, metodo: init.method ?? 'GET', cuerpo: String(init.body ?? '') })
  if (u.includes('/auth/v1/token')) return new Response(JSON.stringify({ access_token: 't' }), { status: 200 })
  if (u.includes('/auth/v1/logout')) return new Response('', { status: 204 })
  if (u.startsWith('https://api.stripe.com')) {
    if (stripeFalla) return new Response(JSON.stringify({ error: { message: 'boom' } }), { status: 500 })
    return new Response(JSON.stringify({ id: 'sub_x', status: 'canceled' }), { status: 200 })
  }
  return new Response('{}', { status: 200 })
}) as any

await import('../supabase/functions/mi-cuenta/index.ts')

const hoy = new Date().toISOString().slice(0, 10)
const semana = (n: number) => ({ num: n, days: [{ day: 'Lun', exercises: [{ name: `E${n}` }] }] })
const plan10 = { kind: 'periodized', phases: [{ id: 'f1', weekData: [1, 2, 3, 4].map(semana) }, { id: 'f2', weekData: [1, 2, 3, 4, 5, 6].map(semana) }] }
const planSemanal = { kind: 'weekly', phases: [{ id: 'w', weekData: [semana(1)] }] }

function nuevoMundo(extra: Record<string, any[]> = {}) {
  ;(globalThis as any).__bd = {
    registro: [] as any[],
    falloAlBorrar: false,
    usuarios: {
      'tok-coach': { id: 'coach1', email: 'coach@x.com', app_metadata: { providers: ['email'] } },
      'tok-atleta': { id: 'atleta1', email: 'atleta@x.com', app_metadata: { providers: ['email'] } },
      'tok-dueno': { id: 'dueno1', email: 'dueno@x.com', app_metadata: { providers: ['email'] } },
    },
    tablas: {
      profiles: [
        { id: 'coach1', role: 'admin', full_name: 'Coach Uno', username: 'coach1', avatar_url: 'http://foto/c.jpg', is_owner: false },
        { id: 'atleta1', role: 'user', full_name: 'Atleta Uno', username: 'atleta1', is_owner: false },
        { id: 'dueno1', role: 'admin', full_name: 'Dueño', username: 'dueno', is_owner: true },
      ],
      vitrina_planes: [
        { id: 'vp1', coach_id: 'coach1', contenido: 'programa' },
        { id: 'vp2', coach_id: 'coach1', contenido: 'programa' }, // sin compras
        { id: 'vp3', coach_id: 'coach1', contenido: 'biblioteca' },
      ],
      vitrina_versiones: [
        { vitrina_plan_id: 'vp1', n: 1, data: plan10 },
        { vitrina_plan_id: 'vp3', n: 1, data: planSemanal },
      ],
      compras: [
        { id: 'c1', vitrina_plan_id: 'vp1', coach_id: 'coach1', atleta_id: 'atleta1', tipo: 'membresia', estado: 'activa', inicio: '2026-10-15', fase_de_entrada: null, semana_de_entrada: null, version_n: 1, stripe_subscription_id: 'sub_c1' },
        { id: 'c2', vitrina_plan_id: 'vp3', coach_id: 'coach1', atleta_id: 'otro', tipo: 'membresia', estado: 'activa', inicio: '2026-10-15', version_n: 1, stripe_subscription_id: 'sub_c2' },
        { id: 'c3', vitrina_plan_id: 'vp1', coach_id: 'coach1', atleta_id: 'otro2', tipo: 'pago_unico', estado: 'activa', inicio: '2026-10-15', version_n: 1, stripe_subscription_id: null },
        { id: 'c4', vitrina_plan_id: 'vp1', coach_id: 'coach1', atleta_id: null, tipo: 'membresia', estado: 'pendiente', stripe_subscription_id: null },
      ],
      plans: [{ id: 'pl1', user_id: 'coach1' }],
      exercises: [{ id: 'e1', created_by: 'coach1' }],
      exercise_media: [],
      routine_templates: [],
      ...extra,
    },
  }
  llamadas.length = 0
}
const bd = () => (globalThis as any).__bd
const pide = async (token: string, cuerpo: any = { accion: 'eliminar', confirmacion: 'ELIMINAR', contrasena: 'x' }) => {
  const r = await manejador(new Request('http://x/mi-cuenta', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) }))
  return { estado: r.status, cuerpo: await r.json() }
}
const stripe = () => llamadas.filter((l) => l.url.startsWith('https://api.stripe.com'))
const borro = () => bd().registro.some((x: any) => x[0] === 'deleteUser')
const fila = (tabla: string, id: string) => bd().tablas[tabla].find((f: any) => f.id === id)
const diaDeCancelAt = (cuerpo: string) => new Date(Number(new URLSearchParams(cuerpo).get('cancel_at')) * 1000).toISOString().slice(0, 10)

/* 1) Un coach con compradores PUEDE borrar su cuenta y nadie pierde su plan. */
nuevoMundo()
let r = await pide('tok-coach')
assert.equal(r.estado, 200, `el coach borra su cuenta (${JSON.stringify(r.cuerpo)})`)
assert.ok(borro(), 'la cuenta se borró')
const s1 = stripe().find((l) => l.url.endsWith('/sub_c1'))!
assert.equal(s1.metodo, 'POST', 'se programa el fin del cobro, no se cancela ya')
assert.equal(new URLSearchParams(s1.cuerpo).get('proration_behavior'), 'none', 'sin prorrateos')
assert.equal(diaDeCancelAt(s1.cuerpo), '2026-12-21', 'el cobro se cierra al final de la semana 10 de SU plan (compró el 15 oct)')
const s2 = stripe().find((l) => l.url.endsWith('/sub_c2'))!
assert.equal(new URLSearchParams(s2.cuerpo).get('cancel_at_period_end'), 'true', 'plan semanal (se repite): se cierra al terminar el periodo pagado')
assert.equal(stripe().filter((l) => l.metodo === 'DELETE').length, 0, 'a los compradores NO se les cancela ya')
assert.ok(fila('vitrina_planes', 'vp1'), 'el plan vendido se queda')
assert.equal(fila('vitrina_planes', 'vp1').estado, 'retirado', 'ya no se vende')
assert.equal(fila('vitrina_planes', 'vp1').coach_nombre, 'Coach Uno', 'se guarda el nombre del coach')
assert.equal(fila('vitrina_planes', 'vp1').coach_foto, 'http://foto/c.jpg')
assert.equal(fila('vitrina_planes', 'vp2'), undefined, 'el plan sin compras se borra')
assert.ok(fila('vitrina_planes', 'vp3'), 'la biblioteca vendida se queda')
assert.deepEqual(fila('vitrina_planes', 'vp3').biblioteca_congelada, [], 'sin clases que guardar queda vacía (lista)')
assert.equal(bd().tablas.compras.length, 4, 'ninguna compra se borra desde la función')
assert.equal(fila('compras', 'c4').estado, 'cancelada', 'el pago a medias ya no tiene a quién pagarle')
assert.equal(fila('compras', 'c1').estado, 'activa', 'el comprador sigue activo')
assert.equal(bd().tablas.plans.length, 0, 'sus planes propios se borran antes que la cuenta')

/* 2) Si Stripe falla, no se borra NADA. */
nuevoMundo(); stripeFalla = true
r = await pide('tok-coach')
stripeFalla = false
assert.equal(r.estado, 502); assert.equal(r.cuerpo.codigo, 'COBROS_NO_CERRADOS')
assert.ok(!borro(), 'la cuenta sigue')
assert.equal(bd().tablas.vitrina_planes.length, 3, 'los planes siguen')
assert.equal(bd().tablas.plans.length, 1, 'sus planes propios siguen')
assert.equal(bd().registro.filter((x: any) => x[0] !== 'update' || x[1] !== 'compras').length, 0, 'no se tocó nada de la base')

/* 3) Un comprador con membresía borra su cuenta: se cancela ya y sin reembolso (nada de «cancélala antes»). */
nuevoMundo()
r = await pide('tok-atleta')
assert.equal(r.estado, 200, `el comprador borra su cuenta (${JSON.stringify(r.cuerpo)})`)
assert.ok(borro())
const d = stripe().filter((l) => l.metodo === 'DELETE')
assert.equal(d.length, 1); assert.ok(d[0].url.endsWith('/sub_c1'))
assert.ok(!stripe().some((l) => l.url.includes('/refunds')), 'sin reembolsos')

/* 4) El dueño no borra su cuenta desde aquí; sin contraseña no se borra. */
nuevoMundo()
assert.equal((await pide('tok-dueno')).estado, 403); assert.ok(!borro())
r = await pide('tok-atleta', { accion: 'eliminar', confirmacion: 'ELIMINAR' })
assert.equal(r.estado, 400); assert.ok(!borro())

/* 5) El resumen sigue diciendo cuántos compradores/membresías hay (para el aviso de la pantalla). */
nuevoMundo()
r = await pide('tok-coach', { accion: 'resumen' })
assert.equal(r.cuerpo.compradores_activos, 3); assert.equal(r.estado, 200)

console.log('✓ mi-cuenta: todo bien')
