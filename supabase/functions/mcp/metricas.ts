// deno-lint-ignore-file no-explicit-any
import type { McpServer } from 'npm:@modelcontextprotocol/sdk@1.30.1/server/mcp.js'
import { z } from 'npm:zod@^4.1.13'
import type { Quien } from './sesion.ts'
import { Aviso, buscarPersona, fechaDelAtleta, nombreDe, respuesta, seguro, sinAcentos } from './util.ts'
import { SOLO_LEER } from './coach.ts'
import { derivaDelAtleta, facilMedioDuro } from './app/metricas/derivados.js'
import { sumaDias } from './app/metricas/forma.js'
import { DEPORTES, nombreDelDeporte } from './app/metricas/deportes.js'
import { distanciaTexto, duracionTexto, fechaCorta, horaTexto, rangoDeSemana, relojTexto, ritmoTexto, variacionTexto, velocidadTexto } from './app/metricas/formato.js'

/**
 * LAS MÉTRICAS DEL RELOJ EN EL CONECTOR DE IA (14 oct 2026, tanda 4).
 *
 * Lo que el coach ve en la pestaña «Métricas» de cada atleta (`src/features/metricas/`): condición, fatiga y forma, la carga de cada semana, las zonas de pulso, la
 * recuperación y cada entreno (Apple Watch, Garmin, Strava o un entreno libre de la app). Los CÁLCULOS son los de la app: `derivaDelAtleta` y compañía se copian a `app/metricas/`
 * (`compartir-con-mcp`), así la IA dice los mismos números que ve el coach. Solo se LEE: la IA no importa ni borra entrenos.
 * Quién ve qué lo pone la base (RLS): el coach ve lo de sus atletas, igual que en la app.
 */

const COLUMNAS = 'id,atleta_id,origen,formato,dispositivo,deporte,titulo,inicio,fin,desfase_min,duracion_s,movimiento_s,distancia_m,desnivel_pos_m,fc_media,fc_max,fc_min,kcal_activas,kcal_totales,zonas_s,umbrales,carga,carga_metodo'
const PAGINA = 1000
const NOMBRES_DE_ZONA = ['Z1 recuperación', 'Z2 base', 'Z3 tempo', 'Z4 umbral', 'Z5 máximo']

/** Los entrenos de un atleta, del más nuevo al más viejo, pidiéndolos por páginas (la base devuelve hasta 1000 por vez). */
async function entrenosDe(quien: Quien, atletaId: string, o: { desdeDia?: string | null; hastaDia?: string | null; tope?: number } = {}) {
  const filas: any[] = []
  const tope = o.tope ?? 3000
  for (let desde = 0; desde < tope; desde += PAGINA) {
    let q = quien.db.from('actividades').select(COLUMNAS).eq('atleta_id', atletaId).order('inicio', { ascending: false }).range(desde, desde + PAGINA - 1)
    if (o.desdeDia) q = q.gte('inicio', `${o.desdeDia}T00:00:00Z`)
    if (o.hastaDia) q = q.lte('inicio', `${o.hastaDia}T23:59:59Z`)
    const { data, error } = await q
    if (error) throw new Error(error.message)
    filas.push(...(data ?? []))
    if ((data ?? []).length < PAGINA) break
  }
  return filas.sort((a, b) => (a.inicio < b.inicio ? 1 : -1))
}

/** Lo que mide cada deporte en palabras: ritmo (min/km) si se corre o camina, velocidad (km/h) si es bici, remo… */
function ritmoOVelocidad(a: any) {
  const d = DEPORTES[a.deporte as keyof typeof DEPORTES]
  const seg = a.movimiento_s > 0 ? a.movimiento_s : a.duracion_s
  if (!d?.distancia || !(a.distancia_m >= 100) || !(seg > 0)) return {}
  if (d.ritmo) return { ritmo: `${ritmoTexto(seg / (a.distancia_m / 1000))} /km` }
  return { velocidad: `${velocidadTexto(a.distancia_m / seg)} km/h` }
}

/** Un entreno en una línea de datos: lo que el coach lee de corrido. */
function entrenoCompacto(a: any) {
  return {
    id: a.id,
    cuando: `${fechaCorta(a.inicio, a.desfase_min)} · ${horaTexto(a.inicio, a.desfase_min)}`,
    deporte: nombreDelDeporte(a.deporte),
    ...(a.titulo ? { titulo: a.titulo } : {}),
    duracion: duracionTexto(a.duracion_s),
    ...(a.distancia_m > 0 ? { distancia: distanciaTexto(a.distancia_m) } : {}),
    ...ritmoOVelocidad(a),
    ...(a.fc_media > 0 ? { pulso_medio: a.fc_media, ...(a.fc_max > 0 ? { pulso_max: a.fc_max } : {}) } : {}),
    ...(a.carga > 0 ? { carga: Math.round(a.carga), ...(a.carga_metodo ? { carga_de: a.carga_metodo } : {}) } : {}),
    ...(a.kcal_activas > 0 ? { kcal: Math.round(a.kcal_activas) } : {}),
    origen: a.dispositivo || a.origen,
  }
}

const medidaDeRecuperacion = (m: any) => ({
  ...(m.ultimo ? { ultimo: `${m.ultimo.valor} ${m.unidad} (${m.ultimo.dia})` } : {}),
  ...(m.siete !== null ? { promedio_7_dias: `${m.siete} ${m.unidad}` } : {}),
  ...(m.base !== null ? { lo_normal_en_el_atleta: `${m.base} ${m.unidad}` } : {}),
  estado: m.estado,
})

export function herramientasDeMetricas(server: McpServer, quien: Quien) {
  const hoy = () => fechaDelAtleta().texto

  server.registerTool('ver_metricas_de_atleta', {
    title: 'Ver las métricas de un atleta',
    description: 'El resumen de las MÉTRICAS DEL RELOJ de un atleta, como lo ve su coach en la pestaña Métricas: condición (lo que su cuerpo ya aguanta), fatiga (lo que trae encima) y forma (cómo llega hoy) con su lectura, cuánto subió la condición en la semana, la carga de cada semana, esta semana contra la pasada, las zonas de pulso de las últimas 4 semanas (fácil, medio, duro), su recuperación (pulso en reposo, HRV y sueño contra lo normal de ESE atleta) y sus últimos entrenos. Salen de entrenos del Apple Watch, Garmin, Strava, archivos o entrenos libres de la app. No es un diagnóstico: una señal para preguntarle cómo está. Para el detalle de un entreno: ver_entrenos_de_atleta y abrir_entreno_de_atleta.',
    inputSchema: { atleta: z.string().describe('El atleta: su usuario (@juan), su nombre o su id.') },
    annotations: SOLO_LEER,
  }, seguro(async ({ atleta }: any) => {
    const persona = await buscarPersona(quien, atleta)
    const dia = hoy()
    const [entrenos, rec] = await Promise.all([
      entrenosDe(quien, persona.id, { desdeDia: sumaDias(dia, -400) }),
      quien.db.from('recuperacion_diaria').select('*').eq('atleta_id', persona.id).gte('dia', sumaDias(dia, -60)).order('dia', { ascending: true }),
    ])
    if (rec.error) throw new Error(rec.error.message)
    if (!entrenos.length) {
      return respuesta({ atleta: nombreDe(persona), hay_datos: false, nota: `${nombreDe(persona)} todavía no tiene entrenos con métricas (de reloj, de archivos o entrenos libres de la app).` })
    }
    const d = derivaDelAtleta({ actividades: entrenos, recuperacion: rec.data ?? [], hoy: dia })
    const sem = (s: any) => s && ({ semana: rangoDeSemana(s.lunes), entrenos: s.sesiones, tiempo: duracionTexto(s.duracion_s), distancia: distanciaTexto(s.distancia_m), carga: s.carga, ...(s.fc_media ? { pulso_medio: s.fc_media } : {}) })
    const zonas = facilMedioDuro(d.zonas4)
    const r = d.recuperacion
    return respuesta({
      atleta: nombreDe(persona),
      hoy: dia,
      hay_datos: true,
      historial: `${d.diasDeHistorial} días, ${entrenos.length} entrenos`,
      ...(d.forma ? {
        forma: {
          condicion_ctl: d.forma.ctl, fatiga_atl: d.forma.atl, forma_tsb: d.forma.tsb,
          lectura: d.estado ? `${d.estado.titulo}: ${d.estado.detalle}` : null,
          ...(d.rampa !== null ? { cambio_de_condicion_en_la_semana: d.rampa } : {}),
        },
      } : {}),
      esta_semana: { ...sem(d.estaSemana), ...(d.semanaEnCurso ? { nota: 'La semana todavía no termina.' } : {}) },
      semana_pasada: sem(d.semanaPasada),
      contra_la_semana_pasada_a_esta_altura: { carga: variacionTexto(d.cambios.carga), tiempo: variacionTexto(d.cambios.tiempo) },
      dias_de_esta_semana: d.diasDeLaSemana.map((x: any) => ({ dia: x.dia, ...(x.esHoy ? { hoy: true } : {}), entrenos: x.sesiones, carga: x.carga })),
      ultimas_semanas: d.semanas.slice(-8).map(sem),
      ...(zonas ? { zonas_de_pulso_4_semanas: { ...zonas, entrenos_con_pulso: `${d.conPulso} de ${d.deLas4}` } } : { zonas_de_pulso_4_semanas: 'sin pulso en las últimas 4 semanas' }),
      recuperacion: {
        lectura: `${r.veredicto.titulo}: ${r.veredicto.detalle}`,
        pulso_en_reposo: medidaDeRecuperacion(r.reposo),
        hrv: medidaDeRecuperacion(r.hrv),
        sueno: medidaDeRecuperacion(r.sueno),
      },
      ultimos_entrenos: d.ultimos.map(entrenoCompacto),
      ...(d.conPulso < 3 && d.deLas4 > 0 ? { aviso: 'Pocos entrenos recientes traen pulso: la carga y las zonas valen menos.' } : {}),
    })
  }))

  server.registerTool('ver_entrenos_de_atleta', {
    title: 'Ver los entrenos de un atleta',
    description: 'La lista de entrenos de un atleta (del más nuevo al más viejo) con su deporte, duración, distancia, ritmo o velocidad, pulso, carga y de dónde vino (reloj, archivo o entreno libre). Por defecto los últimos 15; filtra por fechas o por deporte. Cada uno trae su "id" para abrirlo con abrir_entreno_de_atleta.',
    inputSchema: {
      atleta: z.string().describe('El atleta: su usuario (@juan), su nombre o su id.'),
      desde: z.string().optional().describe('Desde este día (AAAA-MM-DD).'),
      hasta: z.string().optional().describe('Hasta este día (AAAA-MM-DD).'),
      deporte: z.string().optional().describe(`Solo este deporte: ${Object.keys(DEPORTES).join(', ')}.`),
      limite: z.coerce.number().optional().describe('Cuántos traer (15 si no se dice; máximo 60).'),
    },
    annotations: SOLO_LEER,
  }, seguro(async ({ atleta, desde, hasta, deporte, limite }: any) => {
    const persona = await buscarPersona(quien, atleta)
    for (const [k, v] of [['desde', desde], ['hasta', hasta]]) {
      if (v !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(String(v))) throw new Aviso(`"${k}" va como AAAA-MM-DD, por ejemplo 2026-10-01.`)
    }
    let clave: string | null = null
    if (deporte) {
      const t = sinAcentos(deporte)
      clave = Object.keys(DEPORTES).find((k) => sinAcentos(k) === t || sinAcentos(DEPORTES[k as keyof typeof DEPORTES].nombre) === t) ?? null
      if (!clave) throw new Aviso(`"${deporte}" no es un deporte de las métricas. Opciones: ${Object.keys(DEPORTES).join(', ')}.`)
    }
    const tope = Math.min(60, Math.max(1, Math.round(Number(limite) || 15)))
    const todos = (await entrenosDe(quien, persona.id, { desdeDia: desde ?? null, hastaDia: hasta ?? null, tope: 2000 })).filter((a) => !clave || a.deporte === clave)
    return respuesta({
      atleta: nombreDe(persona),
      total_en_el_rango: todos.length,
      entrenos: todos.slice(0, tope).map(entrenoCompacto),
      ...(todos.length > tope ? { nota: `Se muestran ${tope} de ${todos.length}: usa "desde" y "hasta" para ver otros.` } : {}),
      ...(todos.length === 0 ? { nota: 'No hay entrenos con ese filtro.' } : {}),
    })
  }))

  server.registerTool('abrir_entreno_de_atleta', {
    title: 'Abrir un entreno de un atleta',
    description: 'El detalle de UN entreno (su "id" sale de ver_entrenos_de_atleta): sus datos completos, el tiempo en cada zona de pulso, las vueltas o kilómetros con su ritmo y pulso, y lo que el atleta anotó si fue un entreno libre. No trae las gráficas segundo a segundo.',
    inputSchema: { id: z.string().describe('El id del entreno.') },
    annotations: SOLO_LEER,
  }, seguro(async ({ id }: any) => {
    const { data: a, error } = await quien.db.from('actividades').select('*').eq('id', String(id).trim()).maybeSingle()
    if (error) throw new Error(error.message)
    if (!a) throw new Aviso('No encontré ese entreno (o no es de uno de tus atletas). Míralos con ver_entrenos_de_atleta.')
    const { data: p } = await quien.db.from('profiles').select('full_name, username').eq('id', a.atleta_id).maybeSingle()
    const zonasS: number[] = Array.isArray(a.zonas_s) ? a.zonas_s.map((s: any) => Number(s) || 0) : []
    const totalZ = zonasS.reduce((s, v) => s + v, 0)
    const vueltas: any[] = Array.isArray(a.vueltas) ? a.vueltas : []
    return respuesta({
      ...entrenoCompacto(a),
      ...(p ? { atleta: nombreDe(p as any) } : {}),
      fecha: `${fechaCorta(a.inicio, a.desfase_min)} · ${horaTexto(a.inicio, a.desfase_min)}`,
      ...(a.movimiento_s > 0 && a.movimiento_s !== a.duracion_s ? { en_movimiento: duracionTexto(a.movimiento_s) } : {}),
      ...(a.desnivel_pos_m > 0 ? { desnivel_positivo_m: Math.round(a.desnivel_pos_m) } : {}),
      ...(a.fc_min > 0 ? { pulso_min: a.fc_min } : {}),
      ...(a.cadencia_media > 0 ? { cadencia_media: Math.round(a.cadencia_media) } : {}),
      ...(a.potencia_media > 0 ? { potencia_media_w: Math.round(a.potencia_media), ...(a.potencia_max > 0 ? { potencia_max_w: Math.round(a.potencia_max) } : {}) } : {}),
      ...(a.kcal_totales > 0 ? { kcal_totales: Math.round(a.kcal_totales) } : {}),
      ...(totalZ > 0 ? { zonas_de_pulso: zonasS.map((s, i) => ({ zona: NOMBRES_DE_ZONA[i] ?? `Z${i + 1}`, tiempo: duracionTexto(s), por_ciento: Math.round((s / totalZ) * 100) })) } : {}),
      ...(vueltas.length
        ? {
          vueltas: vueltas.slice(0, 60).map((v: any, i: number) => ({
            n: v.n ?? i + 1,
            ...(v.tipo === 'km' ? { tipo: 'kilómetro' } : {}),
            tiempo: relojTexto(v.dur),
            ...(v.dist > 0 ? { distancia: distanciaTexto(v.dist) } : {}),
            ...(v.ritmo > 0 ? { ritmo: `${ritmoTexto(v.ritmo)} /km` } : (v.dist > 0 && v.dur > 0 && DEPORTES[a.deporte as keyof typeof DEPORTES]?.ritmo ? { ritmo: `${ritmoTexto(v.dur / (v.dist / 1000))} /km` } : {})),
            ...(v.fc > 0 ? { pulso: Math.round(v.fc) } : {}),
          })),
        }
        : {}),
      ...(a.sesion ? { de_la_sesion: a.sesion } : {}),
    })
  }))

  server.registerTool('ver_recuperacion_de_atleta', {
    title: 'Ver la recuperación de un atleta día por día',
    description: 'La recuperación diaria que dejó el reloj de un atleta (pulso en reposo, variabilidad HRV, sueño, pasos, VO2 máx…), de los últimos días (14 si no dices; hasta 90). Es el detalle de lo que resume ver_metricas_de_atleta.',
    inputSchema: {
      atleta: z.string().describe('El atleta: su usuario (@juan), su nombre o su id.'),
      dias: z.coerce.number().optional().describe('Cuántos días hacia atrás (14 si no se dice; máximo 90).'),
    },
    annotations: SOLO_LEER,
  }, seguro(async ({ atleta, dias }: any) => {
    const persona = await buscarPersona(quien, atleta)
    const n = Math.min(90, Math.max(1, Math.round(Number(dias) || 14)))
    const { data, error } = await quien.db.from('recuperacion_diaria').select('*').eq('atleta_id', persona.id).gte('dia', sumaDias(hoy(), -(n - 1))).order('dia', { ascending: false })
    if (error) throw new Error(error.message)
    const filas = [...(data ?? [])].sort((a: any, b: any) => (a.dia < b.dia ? 1 : -1))
    return respuesta({
      atleta: nombreDe(persona),
      dias_con_datos: filas.length,
      dias: filas.map((f: any) => ({
        dia: f.dia,
        ...(f.fc_reposo > 0 ? { pulso_en_reposo: f.fc_reposo } : {}),
        ...(f.hrv_ms > 0 ? { hrv_ms: Math.round(f.hrv_ms) } : {}),
        ...(f.sueno_s > 0 ? { sueno: duracionTexto(f.sueno_s), ...(f.sueno_profundo_s > 0 ? { sueno_profundo: duracionTexto(f.sueno_profundo_s) } : {}), ...(f.sueno_rem_s > 0 ? { sueno_rem: duracionTexto(f.sueno_rem_s) } : {}) } : {}),
        ...(f.pasos > 0 ? { pasos: f.pasos } : {}),
        ...(f.vo2max > 0 ? { vo2max: Math.round(f.vo2max * 10) / 10 } : {}),
        ...(f.peso_kg > 0 ? { peso_kg: Math.round(f.peso_kg * 10) / 10 } : {}),
      })),
      ...(filas.length === 0 ? { nota: 'Sin datos de recuperación en esos días.' } : {}),
    })
  }))
}
