// deno-lint-ignore-file no-explicit-any
// Pruebas de las MÉTRICAS DEL RELOJ en el conector de IA (supabase/functions/mcp/metricas.ts), con una base en memoria.
// Corre desde supabase/functions/mcp:  deno run -A --config deno.json ../../../scripts/prueba-mcp-metricas.ts
import { herramientasDeMetricas } from '../supabase/functions/mcp/metricas.ts'
import { fechaDelAtleta } from '../supabase/functions/mcp/util.ts'
import { sumaDias } from '../supabase/functions/mcp/app/metricas/forma.js'
import { baseEnMemoria, cierto, igual } from './mcp-prueba-comun.ts'

let n = 0
const ok = (nombre: string) => { n += 1; console.log(`OK    ${nombre}`) }

const ATLETA = (k: number, usuario: string, nombre: string) => ({ id: `atleta-${k}`, username: usuario, full_name: nombre, role: 'user', is_owner: false, coach_id: 'master-1', is_active: true, unidad_peso: 'kg', genero: null, email: null, created_at: '2026-01-01', perfil_completo: true, alta_en: null })
const PERFILES = [ATLETA(1, 'zz_atleta', 'Atleta Prueba'), ATLETA(2, 'zz_dos', 'Dos Prueba')]

const HOY = fechaDelAtleta().texto
const dia = (atras: number) => sumaDias(HOY, -atras)
const entreno = (id: string, atras: number, extra: any = {}) => ({
  id, atleta_id: 'atleta-1', origen: 'archivo', formato: 'fit', dispositivo: 'Garmin Forerunner', deporte: 'correr', deporte_original: 'running', titulo: null,
  inicio: `${dia(atras)}T13:00:00Z`, fin: `${dia(atras)}T14:00:00Z`, desfase_min: -360, duracion_s: 3000, movimiento_s: 3000, distancia_m: 10000, desnivel_pos_m: 80, desnivel_neg_m: 80,
  fc_media: 150, fc_max: 172, fc_min: 95, kcal_activas: 600, kcal_totales: 700, cadencia_media: 170, potencia_media: null, potencia_max: null, velocidad_max_ms: 5,
  zonas_s: [300, 1200, 900, 500, 100], umbrales: null, carga: 80, carga_metodo: 'pulso', vueltas: null, metricas: null, sesion: null, ...extra,
})
// Un mes de entrenos: cada 2 días, de hace 45 a hoy; uno es de bici y otro de fuerza sin distancia.
const ENTRENOS = () => {
  const lista: any[] = []
  for (let i = 0; i <= 45; i += 2) lista.push(entreno(`e${i}`, i))
  lista.push(entreno('bici', 3, { deporte: 'bici', deporte_original: 'cycling', distancia_m: 30000, duracion_s: 3600, movimiento_s: 3600, titulo: 'Rodada larga', dispositivo: 'Apple Watch' }))
  lista.push(entreno('fuerza', 5, { deporte: 'fuerza', distancia_m: null, duracion_s: 2700, movimiento_s: 2700, fc_media: 120, fc_max: 150, zonas_s: [600, 1500, 600, 0, 0], carga: 45, origen: 'manual', dispositivo: null }))
  lista.push(entreno('vueltas', 1, { vueltas: [{ n: 1, tipo: 'km', dur: 300, dist: 1000, fc: 148 }, { n: 2, tipo: 'km', dur: 310, dist: 1000, fc: 152 }, { n: 3, tipo: 'manual', dur: 600, dist: 2000, ritmo: 300, fc: 155 }] }))
  return lista
}
const RECUPERACION = () => Array.from({ length: 30 }, (_, i) => ({ atleta_id: 'atleta-1', dia: dia(29 - i), fc_reposo: i >= 23 ? 58 : 52, hrv_ms: 62, sueno_s: 7.5 * 3600, sueno_profundo_s: 5400, sueno_rem_s: 6000, pasos: 9000, vo2max: 48.2, peso_kg: 72.4 }))

function armar(tablas: Record<string, any[]> = {}) {
  const { db } = baseEnMemoria({ profiles: PERFILES, actividades: ENTRENOS(), recuperacion_diaria: RECUPERACION(), ...tablas }, { memoria: ['actividades', 'recuperacion_diaria'] })
  const quien: any = { id: 'master-1', usuario: 'andres', nombre: 'Andrés', rol: 'master', salud: false, unidad: 'kg', db }
  const tools: Record<string, (a: any) => Promise<any>> = {}
  const server: any = { registerTool: (nombre: string, _def: unknown, fn: (a: any) => Promise<any>) => { tools[nombre] = fn } }
  herramientasDeMetricas(server, quien)
  return { tools }
}
const sc = (r: any) => r.structuredContent
const falla = async (p: Promise<any>) => { const r = await p; cierto(r.isError || sc(r)?.error || /va como|no es un deporte|No encontré/i.test(JSON.stringify(r.content ?? r)), 'se esperaba un aviso'); return JSON.stringify(r.content ?? r) }

/* ======================= Resumen ======================= */
{
  const { tools } = armar()
  const r = sc(await tools.ver_metricas_de_atleta({ atleta: 'zz_atleta' }))
  igual([r.hay_datos, r.atleta, r.hoy], [true, 'Atleta Prueba', HOY], 'trae datos del atleta, con la fecha de hoy de México')
  cierto(r.forma.condicion_ctl > 0 && r.forma.fatiga_atl > 0 && typeof r.forma.forma_tsb === 'number', 'condición, fatiga y forma')
  cierto(typeof r.forma.lectura === 'string' && r.forma.lectura.includes(':'), 'con su lectura en palabras')
  igual(r.ultimas_semanas.length, 8, 'las últimas 8 semanas')
  cierto(r.ultimas_semanas.every((s: any) => s.semana && typeof s.carga === 'number' && 'tiempo' in s), 'cada una con su carga y su tiempo')
  igual(r.dias_de_esta_semana.length, 7, 'los 7 días de esta semana')
  cierto(r.dias_de_esta_semana.filter((d: any) => d.hoy).length === 1, 'con hoy marcado')
  const z = r.zonas_de_pulso_4_semanas
  igual([z.facil + z.medio + z.duro, typeof z.entrenos_con_pulso], [100, 'string'], 'las zonas de las últimas 4 semanas suman 100 %')
  cierto(/:/.test(r.recuperacion.lectura) && r.recuperacion.pulso_en_reposo.estado === 'atencion', 'la recuperación dice «atención»: el pulso en reposo subió 6 latidos contra su base')
  cierto(r.recuperacion.pulso_en_reposo.lo_normal_en_el_atleta === '52 lpm', 'contra lo normal DE ESE atleta')
  igual(r.ultimos_entrenos.length, 5, 'los 5 últimos entrenos')
  cierto(r.ultimos_entrenos[0].cuando.includes('·') && r.ultimos_entrenos[0].id, 'cada uno con su fecha, hora e id')
  cierto(!!r.contra_la_semana_pasada_a_esta_altura, 'esta semana contra la pasada')

  const sin = sc(await tools.ver_metricas_de_atleta({ atleta: 'zz_dos' }))
  igual([sin.hay_datos, /todavía no tiene entrenos/.test(sin.nota)], [false, true], 'un atleta sin entrenos lo dice')
  cierto(/No encontré a/.test(await falla(tools.ver_metricas_de_atleta({ atleta: 'zz_nadie' }))), 'un atleta que no existe: avisa')
  ok('ver_metricas_de_atleta: forma, semanas, zonas, recuperación contra lo normal de cada atleta, sin entrenos')
}

/* ======================= Lista de entrenos ======================= */
{
  const { tools } = armar()
  const l = sc(await tools.ver_entrenos_de_atleta({ atleta: 'zz_atleta' }))
  igual([l.entrenos.length, l.total_en_el_rango], [15, 26], 'por defecto los últimos 15 de los que hay')
  cierto(/15 de 26/.test(l.nota), 'y dice cuántos hay')
  const fechas = l.entrenos.map((e: any) => e.id)
  igual(fechas.slice(0, 2), ['e0', 'vueltas'], 'el más nuevo primero (hoy, y luego el de ayer)')
  const correr = l.entrenos.find((e: any) => e.id === 'e0')
  igual([correr.deporte, correr.duracion, correr.distancia, correr.ritmo, correr.pulso_medio, correr.carga, correr.origen], ['Correr', '50 min', '10.0 km', '5:00 /km', 150, 80, 'Garmin Forerunner'], 'una carrera: ritmo en min/km, y de dónde vino')
  const bici = sc(await tools.ver_entrenos_de_atleta({ atleta: 'zz_atleta', deporte: 'Bici' })).entrenos[0]
  igual([bici.deporte, bici.velocidad, bici.titulo, bici.ritmo], ['Bici', '30.0 km/h', 'Rodada larga', undefined], 'una bici: velocidad en km/h y no ritmo')
  const fuerza = sc(await tools.ver_entrenos_de_atleta({ atleta: 'zz_atleta', deporte: 'fuerza' })).entrenos[0]
  igual([fuerza.distancia, fuerza.ritmo, fuerza.velocidad, fuerza.origen], [undefined, undefined, undefined, 'manual'], 'fuerza: sin distancia ni ritmo; un entreno libre dice «manual»')
  const rango = sc(await tools.ver_entrenos_de_atleta({ atleta: 'zz_atleta', desde: dia(10), hasta: dia(4), limite: 60 }))
  cierto(rango.entrenos.length >= 3 && rango.entrenos.every((e: any) => e.id !== 'e0' && e.id !== 'vueltas'), 'filtra por fechas')
  igual(sc(await tools.ver_entrenos_de_atleta({ atleta: 'zz_atleta', limite: 2 })).entrenos.length, 2, 'respeta el límite')
  igual(sc(await tools.ver_entrenos_de_atleta({ atleta: 'zz_atleta', limite: 500 })).entrenos.length, 26, 'el máximo es 60 (aquí hay 26)')
  cierto(/no es un deporte/.test(await falla(tools.ver_entrenos_de_atleta({ atleta: 'zz_atleta', deporte: 'cricket' }))), 'un deporte que no existe: avisa y dice las opciones')
  cierto(/AAAA-MM-DD/.test(await falla(tools.ver_entrenos_de_atleta({ atleta: 'zz_atleta', desde: '14/10/2026' }))), 'una fecha mal escrita: avisa')
  igual(sc(await tools.ver_entrenos_de_atleta({ atleta: 'zz_dos' })).nota, 'No hay entrenos con ese filtro.', 'sin entrenos, lo dice')
  ok('ver_entrenos_de_atleta: orden, ritmo o velocidad según el deporte, filtros y límites')
}

/* ======================= Abrir un entreno ======================= */
{
  const { tools } = armar({ profiles: PERFILES })
  const a = sc(await tools.abrir_entreno_de_atleta({ id: 'vueltas' }))
  igual([a.deporte, a.atleta, a.distancia, a.ritmo], ['Correr', 'Atleta Prueba', '10.0 km', '5:00 /km'], 'el entreno completo, con el nombre del atleta')
  igual(a.zonas_de_pulso.map((z: any) => z.por_ciento), [10, 40, 30, 17, 3], 'el tiempo en cada zona, en por ciento')
  igual(a.zonas_de_pulso[0], { zona: 'Z1 recuperación', tiempo: '5 min', por_ciento: 10 }, 'con su nombre y su tiempo')
  igual(a.vueltas.length, 3, 'las vueltas')
  igual(a.vueltas[0], { n: 1, tipo: 'kilómetro', tiempo: '5:00', distancia: '1.0 km', ritmo: '5:00 /km', pulso: 148 }, 'un kilómetro: tiempo, ritmo y pulso')
  igual([a.vueltas[2].ritmo, a.vueltas[2].tipo], ['5:00 /km', undefined], 'una vuelta manual trae su ritmo')
  const f = sc(await tools.abrir_entreno_de_atleta({ id: 'fuerza' }))
  igual([f.deporte, f.vueltas, f.pulso_min, f.desnivel_positivo_m], ['Fuerza', undefined, 95, 80], 'otro entreno, sin vueltas')
  cierto(/No encontré ese entreno/.test(await falla(tools.abrir_entreno_de_atleta({ id: 'no-existe' }))), 'un id que no existe: avisa')
  ok('abrir_entreno_de_atleta: zonas en por ciento, vueltas con ritmo, sin vueltas')
}

/* ======================= Recuperación ======================= */
{
  const { tools } = armar()
  const r = sc(await tools.ver_recuperacion_de_atleta({ atleta: 'zz_atleta' }))
  igual([r.dias_con_datos, r.dias[0].dia], [14, HOY], 'los últimos 14 días, el más nuevo primero')
  igual(r.dias[0], { dia: HOY, pulso_en_reposo: 58, hrv_ms: 62, sueno: '7 h 30 min', sueno_profundo: '1 h 30 min', sueno_rem: '1 h 40 min', pasos: 9000, vo2max: 48.2, peso_kg: 72.4 }, 'pulso, HRV, sueño, pasos, VO2 y peso de un día')
  igual(sc(await tools.ver_recuperacion_de_atleta({ atleta: 'zz_atleta', dias: 5 })).dias_con_datos, 5, 'con «dias»')
  igual(sc(await tools.ver_recuperacion_de_atleta({ atleta: 'zz_atleta', dias: 400 })).dias_con_datos, 30, 'el máximo es 90 (aquí hay 30)')
  igual(sc(await tools.ver_recuperacion_de_atleta({ atleta: 'zz_dos' })).nota, 'Sin datos de recuperación en esos días.', 'sin datos, lo dice')
  ok('ver_recuperacion_de_atleta: días recientes con todas las medidas')
}

console.log(`\nTodo bien: ${n} grupos de pruebas de métricas`)
