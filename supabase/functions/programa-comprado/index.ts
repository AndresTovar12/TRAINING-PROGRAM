/**
 * Le da al atleta los planes que COMPRÓ, ya recortados a lo que puede ver.
 *
 * POR QUÉ EXISTE ESTA FUNCIÓN. Un plan en venta vale lo que vale porque no se puede copiar entero. Si la app le pidiera a la base «dame el plan que compré», recibiría TODAS
 * las semanas y bastaría abrir las herramientas del navegador para llevárselas. Por eso el plan publicado (`vitrina_versiones`) solo lo lee el coach (RLS), y el atleta lo pide
 * AQUÍ: esta función corre en el servidor, recorta con `ventana.js` (la ventana de un mes) y manda solo lo que se ve. Lo que no viaja, no se puede copiar.
 * Ver docs/superpowers/specs/2026-10-10-monetizacion-design.md (sección 7) y `src/lib/ventana.js`.
 *
 * Responde `{ compras: [...] }`, una por compra del atleta que sigue viva (activa, en gracia, vencida o por armar), cada una con:
 *   estado, tipo, fechas, el nombre y la foto de quien lo vende, si lleva chat y técnica, y `programa` = { title, data, cursorInicial, resumen } (null si aún no se entrega).
 * Solo manda lo del dueño de la sesión: nunca se pide el id de nadie.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { hoyDelServidor, recortaPrograma } from './ventana.js'

const ORIGENES = ['http://localhost:5173', 'http://localhost:4173', 'http://127.0.0.1:5173']

function cabeceras(origen: string | null): Record<string, string> {
  let permitido = ORIGENES[0]
  if (origen) {
    try {
      if (ORIGENES.includes(origen) || /\.vercel\.app$/.test(new URL(origen).hostname)) permitido = origen
    } catch { /* origen malformado */ }
  }
  return {
    'Access-Control-Allow-Origin': permitido,
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

const json = (cuerpo: unknown, estado: number, origen: string | null) =>
  new Response(JSON.stringify(cuerpo), { status: estado, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...cabeceras(origen) } })

const VIVAS = ['activa', 'gracia', 'vencida', 'por_armar']

// Un workout o una clase SUELTOS se publican «el lunes» (así los guarda `publicar_plan`). Quien los compra no tiene por qué esperar al lunes: se le acomodan el día en que los compró, para
// que salgan en «Hoy» de inmediato. Con «Cambiar día» los mueve a donde quiera. Los días se llaman como en la app (con acento).
const DIAS_DE_LA_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const diaDeLaFecha = (iso: string) => DIAS_DE_LA_SEMANA[new Date(`${String(iso).slice(0, 10)}T12:00:00Z`).getUTCDay()]
// deno-lint-ignore no-explicit-any
function alDiaDeLaCompra(data: any, iso: string) {
  const dia = diaDeLaFecha(iso)
  for (const fase of data?.phases ?? []) for (const semana of fase?.weekData ?? []) for (const d of semana?.days ?? []) d.day = dia
}

Deno.serve(async (req) => {
  const origen = req.headers.get('Origin')
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cabeceras(origen) })
  if (req.method !== 'POST' && req.method !== 'GET') return json({ error: 'Método no permitido' }, 405, origen)

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return json({ error: 'Falta tu sesión. Vuelve a entrar.' }, 401, origen)

  const bd = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: sesion, error: errSesion } = await bd.auth.getUser(token)
  if (errSesion || !sesion?.user) return json({ error: 'Tu sesión expiró. Vuelve a entrar.' }, 401, origen)
  const atletaId = sesion.user.id

  try {
    const { data: compras, error } = await bd.from('compras')
      .select('id, vitrina_plan_id, coach_id, tipo, estado, inicio, fase_de_entrada, semana_de_entrada, version_n, periodo_hasta, gracia_hasta, entrega_limite')
      .eq('atleta_id', atletaId).in('estado', VIVAS).order('creada_en')
    if (error) throw error
    if (!compras?.length) return json({ compras: [] }, 200, origen)

    const planesIds = [...new Set(compras.map((c) => c.vitrina_plan_id))]
    const coachesIds = [...new Set(compras.map((c) => c.coach_id))]
    const [{ data: planes, error: e1 }, { data: coaches, error: e2 }] = await Promise.all([
      bd.from('vitrina_planes').select('id, titulo, chat, tecnica, ventana_semanas, contenido').in('id', planesIds),
      bd.from('profiles').select('id, username, full_name, avatar_url, profesion').in('id', coachesIds),
    ])
    if (e1 || e2) throw e1 ?? e2
    const planDe = new Map((planes ?? []).map((p) => [p.id, p]))
    const coachDe = new Map((coaches ?? []).map((p) => [p.id, p]))
    const hoy = hoyDelServidor()

    const salida = []
    for (const c of compras) {
      const plan = planDe.get(c.vitrina_plan_id)
      const coach = coachDe.get(c.coach_id)
      let programa = null
      if (c.estado !== 'por_armar') {
        const { data: version, error: e3 } = await bd.from('vitrina_versiones').select('titulo, data').eq('vitrina_plan_id', c.vitrina_plan_id).eq('n', c.version_n).maybeSingle()
        if (e3) throw e3
        if (version) {
          const r = recortaPrograma({
            // El comprador ve a lo más UN MES hacia adelante (el coach puede bajarlo, nunca subirlo): el tope también se pone aquí, por si alguna fila trajera más.
            data: version.data, inicio: c.inicio ?? hoy, faseDeEntrada: c.fase_de_entrada, semanaDeEntrada: c.semana_de_entrada,
            ventanaSemanas: Math.min(4, Math.max(1, Number(plan?.ventana_semanas) || 4)), estado: c.estado, hoy,
          })
          if (plan?.contenido === 'workout' || plan?.contenido === 'clase') alDiaDeLaCompra(r.data, c.inicio ?? hoy)
          programa = { title: version.titulo, data: r.data, cursorInicial: r.cursorInicial, resumen: r.resumen }
        }
      }
      salida.push({
        compra_id: c.id,
        vitrina_plan_id: c.vitrina_plan_id,
        estado: c.estado,
        tipo: c.tipo,
        inicio: c.inicio,
        periodo_hasta: c.periodo_hasta,
        gracia_hasta: c.gracia_hasta,
        entrega_limite: c.entrega_limite,
        titulo: plan?.titulo ?? programa?.title ?? 'Plan',
        chat: !!plan?.chat,
        tecnica: !!plan?.tecnica,
        ventana_semanas: plan?.ventana_semanas ?? null,
        vendedor: coach ? { id: coach.id, usuario: coach.username, nombre: coach.full_name, foto: coach.avatar_url, profesion: coach.profesion } : null,
        programa,
      })
    }
    return json({ compras: salida }, 200, origen)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'No se pudieron leer tus planes.' }, 500, origen)
  }
})
