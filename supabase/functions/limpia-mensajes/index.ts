/**
 * Borra los ARCHIVOS VENCIDOS de los mensajes.
 *
 * Andrés, 10 oct 2026: los videos de técnica viven 30 días; las fotos, videos y notas de voz del chat, 90; los textos, siempre. Lo que vence es el ARCHIVO del bucket
 * privado «mensajes»: la fila se queda (el mensaje dice «ya venció» en vez de desaparecer), con `adjunto_borrado` o `video_borrado` en verdadero.
 *
 * La llama una tarea programada de la base (pg_cron + pg_net) una vez al día. No lleva contraseña: lo único que hace es quitar lo que ya venció según las reglas de
 * arriba, así que llamarla de más no puede dañar nada. Trabaja por lotes de 200 y, si quedan más, seguirá en la próxima llamada.
 *
 * También limpia lo que quedó huérfano: carpetas de cuentas que ya no existen (si se borra una cuenta, sus mensajes caen en cascada pero los archivos no).
 */
import { createClient } from 'jsr:@supabase/supabase-js@2'

const BUCKET = 'mensajes'
const DIAS_DE_ARCHIVOS = 90
const DIAS_DE_TECNICA = 30
const LOTE = 200
const DIA_MS = 24 * 3600 * 1000

type Resumen = { archivos: number; tecnicas: number; huerfanos: number; errores: string[] }

Deno.serve(async (req) => {
  if (req.method !== 'POST' && req.method !== 'GET') return new Response('Método no permitido', { status: 405 })
  const bd = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
  const resumen: Resumen = { archivos: 0, tecnicas: 0, huerfanos: 0, errores: [] }
  const hace = (dias: number) => new Date(Date.now() - dias * DIA_MS).toISOString()

  try {
    // 1) Fotos, videos, notas de voz y correcciones con archivo, de más de 90 días.
    {
      const { data, error } = await bd.from('mensajes').select('id, adjunto').not('adjunto', 'is', null).eq('adjunto_borrado', false).neq('tipo', 'tecnica')
        .lt('creado_en', hace(DIAS_DE_ARCHIVOS)).limit(LOTE)
      if (error) throw error
      const filas = (data ?? []).filter((m) => m.adjunto?.ruta)
      if (filas.length) {
        const { error: e1 } = await bd.storage.from(BUCKET).remove(filas.map((m) => m.adjunto.ruta))
        if (e1) resumen.errores.push(`archivos: ${e1.message}`)
        else {
          const { error: e2 } = await bd.from('mensajes').update({ adjunto_borrado: true }).in('id', filas.map((m) => m.id))
          if (e2) resumen.errores.push(`mensajes: ${e2.message}`)
          else resumen.archivos = filas.length
        }
      }
    }

    // 2) Videos de técnica de más de 30 días (y la tarjeta del mensaje que los enseña).
    {
      const { data, error } = await bd.from('tecnicas').select('id, ruta').eq('video_borrado', false).lt('creada_en', hace(DIAS_DE_TECNICA)).limit(LOTE)
      if (error) throw error
      const filas = data ?? []
      if (filas.length) {
        const { error: e1 } = await bd.storage.from(BUCKET).remove(filas.map((t) => t.ruta))
        if (e1) resumen.errores.push(`técnicas (archivos): ${e1.message}`)
        else {
          const ids = filas.map((t) => t.id)
          const { error: e2 } = await bd.from('tecnicas').update({ video_borrado: true }).in('id', ids)
          const { error: e3 } = await bd.from('mensajes').update({ adjunto_borrado: true }).in('tecnica_id', ids).eq('tipo', 'tecnica')
          if (e2 || e3) resumen.errores.push(`técnicas (filas): ${(e2 ?? e3)!.message}`)
          else resumen.tecnicas = filas.length
        }
      }
    }

    // 3) Carpetas de cuentas que ya no existen: «<atleta>/<profesional>/archivo».
    {
      const { data: carpetas, error } = await bd.storage.from(BUCKET).list('', { limit: 1000 })
      if (error) throw error
      const atletas = (carpetas ?? []).filter((c) => !c.id).map((c) => c.name)
      if (atletas.length) {
        const { data: vivos } = await bd.from('profiles').select('id').in('id', atletas)
        const existen = new Set((vivos ?? []).map((p) => p.id))
        for (const atleta of atletas) {
          const { data: hijas } = await bd.storage.from(BUCKET).list(atleta, { limit: 1000 })
          const profesionales = (hijas ?? []).filter((c) => !c.id).map((c) => c.name)
          let vivosPro = new Set<string>()
          if (existen.has(atleta) && profesionales.length) {
            const { data: pr } = await bd.from('profiles').select('id').in('id', profesionales)
            vivosPro = new Set((pr ?? []).map((p) => p.id))
          }
          for (const pro of profesionales) {
            if (existen.has(atleta) && vivosPro.has(pro)) continue
            const { data: archivos } = await bd.storage.from(BUCKET).list(`${atleta}/${pro}`, { limit: 1000 })
            const rutas = (archivos ?? []).filter((a) => a.id).map((a) => `${atleta}/${pro}/${a.name}`)
            if (rutas.length) {
              const { error: e } = await bd.storage.from(BUCKET).remove(rutas)
              if (e) resumen.errores.push(`huérfanos: ${e.message}`)
              else resumen.huerfanos += rutas.length
            }
          }
        }
      }
    }
  } catch (e) {
    resumen.errores.push(String((e as Error)?.message ?? e))
  }

  return new Response(JSON.stringify(resumen), { status: resumen.errores.length ? 500 : 200, headers: { 'Content-Type': 'application/json' } })
})
