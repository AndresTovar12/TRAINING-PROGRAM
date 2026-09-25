import type { Quien } from './sesion.ts'
import { ZONA } from './config.ts'

/* ------------------------------------------------------------------ */
/* Respuestas                                                          */
/* ------------------------------------------------------------------ */

/**
 * Lo que devuelve una herramienta. `structuredContent` para la IA que lo sabe
 * leer, y el mismo JSON como texto para la que no: es lo que piden OpenAI y
 * Anthropic para que funcione en los dos.
 */
export function respuesta(datos: Record<string, unknown>) {
  return {
    structuredContent: datos,
    content: [{ type: 'text' as const, text: JSON.stringify(datos) }],
  }
}

/** Un error que la IA le puede explicar a la persona, en su idioma. */
export function fallo(mensaje: string) {
  return {
    isError: true,
    content: [{ type: 'text' as const, text: mensaje }],
  }
}

/** Un error que se le puede enseñar a la persona tal cual. */
export class Aviso extends Error {}

/**
 * Envuelve el manejo de una herramienta: un error nunca tumba al servidor ni
 * se traga en silencio. Los `Aviso` se dicen tal cual; lo demás, con su texto
 * pero dejando claro que fue un problema, no una respuesta.
 */
export function seguro<A>(fn: (args: A) => Promise<ReturnType<typeof respuesta> | ReturnType<typeof fallo>>) {
  return async (args: A) => {
    try {
      return await fn(args)
    } catch (e) {
      if (e instanceof Aviso) return fallo(e.message)
      const texto = e instanceof Error ? e.message : String(e)
      console.error('herramienta falló:', texto)
      return fallo(`No se pudo completar: ${texto}`)
    }
  }
}

/* ------------------------------------------------------------------ */
/* Texto                                                               */
/* ------------------------------------------------------------------ */

export const sinAcentos = (s: string) =>
  String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

export const mismoTexto = (a: string, b: string) => sinAcentos(a) === sinAcentos(b)

/* ------------------------------------------------------------------ */
/* Días y fechas                                                       */
/* ------------------------------------------------------------------ */

/** Las claves que guarda el plan, con acento. Si no coinciden, un día sale vacío. */
export const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'] as const
export type Dia = typeof DIAS[number]
export const NOMBRE_DIA: Record<Dia, string> = {
  Lun: 'Lunes', Mar: 'Martes', 'Mié': 'Miércoles', Jue: 'Jueves', Vie: 'Viernes', 'Sáb': 'Sábado', Dom: 'Domingo',
}

const FORMAS_DIA: Record<string, Dia> = {
  lun: 'Lun', lunes: 'Lun', monday: 'Lun', mon: 'Lun',
  mar: 'Mar', martes: 'Mar', tuesday: 'Mar', tue: 'Mar',
  mie: 'Mié', miercoles: 'Mié', wednesday: 'Mié', wed: 'Mié',
  jue: 'Jue', jueves: 'Jue', thursday: 'Jue', thu: 'Jue',
  vie: 'Vie', viernes: 'Vie', friday: 'Vie', fri: 'Vie',
  sab: 'Sáb', sabado: 'Sáb', saturday: 'Sáb', sat: 'Sáb',
  dom: 'Dom', domingo: 'Dom', sunday: 'Dom', sun: 'Dom',
}

/** "miércoles", "Mie", "wednesday" → 'Mié'. */
export function diaDesdeTexto(texto: string): Dia {
  const d = FORMAS_DIA[sinAcentos(texto).replace(/\.$/, '')]
  if (!d) throw new Aviso(`No entiendo el día "${texto}". Usa lunes, martes, miércoles, jueves, viernes, sábado o domingo.`)
  return d
}

/**
 * Una fecha del calendario en la zona del atleta, lista para las funciones de
 * la app.
 *
 * Las funciones de la app leen el día con `getDay()`, en la hora LOCAL de
 * quien las corre. Aquí eso es Greenwich. Así que se arma un `Date` cuya hora
 * local tenga el mismo año, mes y día que el calendario del atleta. A las
 * 12:00, para que ningún cambio de horario lo mueva de día.
 */
export function fechaDelAtleta(fecha?: string) {
  let y: number, m: number, d: number
  if (fecha) {
    const ok = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha.trim())
    if (!ok) throw new Aviso(`La fecha "${fecha}" no se entiende. Usa el formato AAAA-MM-DD, por ejemplo 2026-09-25.`)
    y = Number(ok[1]); m = Number(ok[2]); d = Number(ok[3])
  } else {
    const partes = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(new Date())
    const v = (t: string) => Number(partes.find((p) => p.type === t)?.value)
    y = v('year'); m = v('month'); d = v('day')
  }
  const date = new Date(y, m - 1, d, 12, 0, 0)
  const texto = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  const dia = DIAS[(date.getDay() + 6) % 7]
  return { date, texto, dia }
}

/* ------------------------------------------------------------------ */
/* Personas                                                            */
/* ------------------------------------------------------------------ */

export interface Persona {
  id: string
  username: string
  full_name: string | null
  role: string
  is_owner: boolean
  coach_id: string | null
  is_active: boolean
  unidad_peso: string | null
  genero: string | null
  email: string | null
  created_at: string
  perfil_completo: boolean
}

const CAMPOS_PERSONA = 'id, username, full_name, role, is_owner, coach_id, is_active, unidad_peso, genero, email, created_at, perfil_completo'

/**
 * Encuentra a un atleta por id, usuario o nombre, ENTRE LOS QUE ESTA PERSONA
 * PUEDE VER. La búsqueda va con su token: si el atleta es de otro coach, la
 * base ni lo devuelve, y para la IA simplemente no existe.
 */
export async function buscarPersona(quien: Quien, ref: string, soloAtletas = true): Promise<Persona> {
  const texto = String(ref ?? '').trim()
  if (!texto) throw new Aviso('Falta decir a quién: su nombre o su usuario.')
  let q = quien.db.from('profiles').select(CAMPOS_PERSONA).neq('id', quien.id)
  if (soloAtletas) q = q.eq('role', 'user')
  const { data, error } = await q
  if (error) throw new Error(error.message)
  const todos = (data ?? []) as Persona[]

  const porId = todos.find((p) => p.id === texto)
  if (porId) return porId
  const buscado = sinAcentos(texto).replace(/^@/, '')
  const porUsuario = todos.find((p) => sinAcentos(p.username) === buscado)
  if (porUsuario) return porUsuario
  const porNombre = todos.filter((p) => sinAcentos(p.full_name ?? '') === buscado)
  if (porNombre.length === 1) return porNombre[0]
  const parecidos = todos.filter((p) =>
    sinAcentos(p.full_name ?? '').includes(buscado) || sinAcentos(p.username).includes(buscado))
  if (parecidos.length === 1) return parecidos[0]

  const lista = (porNombre.length > 1 ? porNombre : parecidos)
    .slice(0, 8).map((p) => `${p.full_name || p.username} (@${p.username})`).join(', ')
  if (lista) throw new Aviso(`Hay varias personas que coinciden con "${texto}": ${lista}. Di cuál, con su usuario.`)
  throw new Aviso(`No encontré a "${texto}" entre ${soloAtletas ? 'tus atletas' : 'las personas que puedes ver'}.`)
}

export const nombreDe = (p: Pick<Persona, 'full_name' | 'username'>) => p.full_name || p.username
