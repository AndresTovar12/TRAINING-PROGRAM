// deno-lint-ignore-file no-explicit-any
import { Pregunta, llaveDeNombre, sinAcentos } from './util.ts'

/**
 * CUÁNDO LA IA PREGUNTA.
 *
 * Andrés, 7 oct 2026: quiere que ChatGPT y Claude, al usar Training Lab, pregunten cuando hay duda
 * (¿es ese ejercicio de tu lista o uno nuevo?, ¿qué categoría?, ¿van en biserie?), pero SOLO lo que
 * tendrían que adivinar: lo que la persona ya dijo no se vuelve a preguntar, y lo que se puede
 * deducir se deduce y se enseña. Sus ejemplos buenos y malos están en la memoria del proyecto
 * (`project_conector_preguntar_y_skill`).
 *
 * Son dos piezas que se refuerzan:
 *  - La NOTA (`instrucciones` en `servidor.ts`): el consejo. Cada IA puede o no seguirlo.
 *  - Los TOPES (este archivo): lo que el conector SÍ puede revisar solo. Si falta algo, se detiene
 *    ANTES de guardar y le devuelve a la IA la pregunta y las opciones reales (`Pregunta`). Cada tope
 *    lleva su salida (`sin_datos`, `sin_ficha_ok`): si la persona ya contestó, la IA la usa y no se
 *    pregunta nada.
 *
 * Lo que el conector NO ve es el mensaje de la persona: «biserie o separados», «por lado» y las reps
 * que faltan los decide la IA con la nota.
 */

export interface ItemDeCatalogo {
  id: string
  name: string
  equipment?: string | null
  muscle_primary?: string[] | null
  category?: { name?: string | null } | null
}

/* ------------------------------------------------------------------ */
/* Parecidos                                                           */
/* ------------------------------------------------------------------ */

const RELLENO = new Set([
  'de', 'del', 'la', 'el', 'los', 'las', 'en', 'con', 'a', 'al', 'y', 'e', 'o', 'para', 'por', 'un', 'una', 'unos', 'unas',
  'sin', 'the', 'of', 'on', 'with', 'and',
])

/** Una palabra sin su plural: «poleas» → «polea», «pulls» → «pull»; «press» se queda igual. */
const singular = (w: string) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w)

/** Las palabras que cuentan de un texto: sin acentos, sin relleno («de», «en», «con») y en singular. */
export const palabrasClave = (texto: string) =>
  sinAcentos(texto).split(/[^a-z0-9]+/).filter((w) => w && !RELLENO.has(w)).map(singular)

/** Distancia de edición (cuántas letras hay que cambiar). Solo se usa entre palabras de largo parecido. */
function distancia(a: string, b: string) {
  const fila = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    let anterior = fila[0]
    fila[0] = i
    for (let j = 1; j <= b.length; j++) {
      const guardado = fila[j]
      fila[j] = Math.min(fila[j] + 1, fila[j - 1] + 1, anterior + (a[i - 1] === b[j - 1] ? 0 : 1))
      anterior = guardado
    }
  }
  return fila[b.length]
}

/** Cuántas letras del principio comparten dos palabras. */
function inicioComun(a: string, b: string) {
  let i = 0
  while (i < a.length && i < b.length && a[i] === b[i]) i++
  return i
}

/**
 * Cuánto se parecen dos palabras: 3 igual; 2 casi igual (una empieza con la otra, comparten casi todo el
 * principio —«búlgara» y «bulgarian»— o hay una letra de diferencia —«rumanian» y «romanian»—); 0 nada.
 */
function pesoDePalabra(q: string, c: string) {
  if (q === c) return 3
  const corta = Math.min(q.length, c.length)
  if (corta >= 4 && (q.startsWith(c) || c.startsWith(q))) return 2
  if (corta >= 5 && inicioComun(q, c) >= 5 && inicioComun(q, c) / corta >= 0.75) return 2
  if (corta >= 5 && Math.abs(q.length - c.length) <= 1 && distancia(q, c) <= 1) return 2
  return 0
}

/**
 * Los ejercicios del catálogo que se parecen a lo que se escribió, los más parecidos primero.
 * Solo por las letras: el catálogo está casi todo en inglés, así que «jalón» no encuentra «pull down».
 * Eso lo traduce la IA con `buscar_ejercicios`; esto es la ayuda para cuando no lo hizo. Para que
 * entre tienen que cumplirse dos cosas: al menos una palabra se parece a una del NOMBRE, y se parecen
 * MÁS de la mitad de las palabras de lo escrito (el equipo, la categoría y los músculos también
 * cuentan). Si no, «jalón en poleas» traería todo lo que lleva «polea» en el nombre.
 */
export function parecidosA(escrito: string, catalogo: ItemDeCatalogo[], max = 6): ItemDeCatalogo[] {
  const pedidas = palabrasClave(escrito)
  if (!pedidas.length) return []
  const puntuados = catalogo.map((e) => {
    const enNombre = palabrasClave(e.name)
    const enOtros = palabrasClave([e.equipment, e.category?.name, ...(e.muscle_primary ?? [])].filter(Boolean).join(' '))
    let puntos = 0
    let porNombre = 0
    let parecidas = 0
    for (const q of pedidas) {
      const n = Math.max(0, ...enNombre.map((c) => pesoDePalabra(q, c)))
      const o = Math.max(0, ...enOtros.map((c) => pesoDePalabra(q, c)))
      if (n) porNombre += 1
      if (n || o) parecidas += 1
      // Lo que ya cuenta en el nombre no suma otra vez por el equipo.
      puntos += n ? n * 2 : o
    }
    return { e, puntos, porNombre, parecidas }
  }).filter((x) => x.porNombre > 0 && x.parecidas * 2 > pedidas.length)
  puntuados.sort((a, b) => b.puntos - a.puntos || a.e.name.length - b.e.name.length || a.e.name.localeCompare(b.e.name))
  return puntuados.slice(0, max).map((x) => x.e)
}

const resumen = (e: ItemDeCatalogo) => ({
  nombre: e.name,
  ...(e.equipment ? { equipo: e.equipment } : {}),
  ...(e.category?.name ? { categoria: e.category.name } : {}),
})

/* ------------------------------------------------------------------ */
/* Tope: ejercicios que no están en el catálogo                        */
/* ------------------------------------------------------------------ */

const QUE_HACER_FICHAS =
  'Para cada uno: (1) búscalo con buscar_ejercicios, por su nombre en inglés y por equipo o músculo (el catálogo está casi todo en inglés). '
  + '(2) Si encaja UNO solo, o es el mismo ejercicio con otro nombre (idioma, abreviatura), vuelve a llamar con el nombre EXACTO del catálogo, sin preguntar; al final dile a la persona cómo lo guardaste. '
  + '(3) Si hay varios posibles, pregunta cuál con una lista numerada; si dudas entre uno de su lista y uno nuevo, pregunta «¿es X de tu lista o creo uno nuevo?». '
  + '(4) Si ninguno encaja, pregunta «¿lo creo?» y ofrece en ese mismo mensaje los datos (categoría, grupo muscular, equipo, nota); se crea con crear_ejercicio. '
  + '(5) Junta TODAS las preguntas en UN solo mensaje y no preguntes lo que la persona ya dijo. '
  + '(6) Si la persona dice que va tal cual, sin ficha, o los nombres vienen de un plan que ya existe, repite la llamada con sin_ficha_ok: [esos nombres].'

/**
 * Antes de guardar un plan: los ejercicios que no se pudieron ligar a una ficha del catálogo no se
 * guardan en silencio, se le pregunta a la persona (vía la IA). No cuentan:
 *  - los que ya estaban en el plan que se edita (el coach ya los puso así; leer un día y reescribirlo
 *    no debe volver a discutirlos),
 *  - los que la persona confirmó que van tal cual (`confirmados`, el argumento `sin_ficha_ok`).
 * Devuelve los confirmados (para avisar que quedaron sin ficha); si queda alguno por decidir, lanza
 * `Pregunta` y no se guarda nada.
 */
export function exigirFichas(o: {
  sinFicha: Iterable<string>
  catalogo: ItemDeCatalogo[]
  yaEnElPlan?: Iterable<string>
  confirmados?: string[]
}): string[] {
  const ya = new Set([...(o.yaEnElPlan ?? [])].map(llaveDeNombre))
  const ok = new Set((o.confirmados ?? []).map(llaveDeNombre))
  const vistos = new Set<string>()
  const comoTexto: string[] = []
  const pendientes: { escrito: string; caso: 'ninguno' | 'uno' | 'varios'; parecidos: ReturnType<typeof resumen>[] }[] = []
  for (const escrito of o.sinFicha) {
    const llave = llaveDeNombre(escrito)
    if (vistos.has(llave)) continue
    vistos.add(llave)
    if (ya.has(llave)) continue
    if (ok.has(llave)) { comoTexto.push(escrito); continue }
    const parecidos = parecidosA(escrito, o.catalogo)
    pendientes.push({ escrito, caso: parecidos.length === 0 ? 'ninguno' : parecidos.length === 1 ? 'uno' : 'varios', parecidos: parecidos.map(resumen) })
  }
  if (pendientes.length) {
    throw new Pregunta({
      guardado: false,
      motivo: 'ejercicios_fuera_del_catalogo',
      mensaje: 'No guardé nada todavía: estos ejercicios no están en el catálogo con ese nombre.',
      pendientes,
      que_hacer: QUE_HACER_FICHAS,
    })
  }
  return comoTexto
}

/* ------------------------------------------------------------------ */
/* Tope: crear un ejercicio sin ningún dato                            */
/* ------------------------------------------------------------------ */

/** El equipo que más se usa en el catálogo, para ofrecerlo: «mancuerna» y «mancuernas» cuentan juntas. */
export function equiposMasUsados(catalogo: ItemDeCatalogo[], max = 8): string[] {
  const cuenta = new Map<string, { n: number; formas: Map<string, number> }>()
  for (const e of catalogo) {
    const crudo = (e.equipment ?? '').trim()
    if (!crudo) continue
    const llave = llaveDeNombre(crudo).replace(/s$/, '')
    const c = cuenta.get(llave) ?? { n: 0, formas: new Map<string, number>() }
    c.n += 1
    c.formas.set(crudo, (c.formas.get(crudo) ?? 0) + 1)
    cuenta.set(llave, c)
  }
  return [...cuenta.values()]
    .sort((a, b) => b.n - a.n)
    .slice(0, max)
    .map((c) => [...c.formas.entries()].sort((a, b) => b[1] - a[1])[0][0])
}

const unas = (lista: string[], cuantas = 5) => `${lista.slice(0, cuantas).join(', ')}${lista.length > cuantas ? '…' : ''}`

/**
 * Crear un ejercicio con solo el nombre: no se guarda; se le pasa a la IA UNA sola pregunta con todo lo
 * opcional (no una por campo: es más fácil de contestar). «Así» = se guarda solo con el nombre.
 * La categoría NO es obligatoria: si la persona no quiere, `sin_datos: true`.
 */
export function preguntaDeDatos(nombre: string, opciones: { categorias: string[]; grupos: string[]; equipos: string[] }): never {
  const pregunta = [
    `¿Quieres agregarle datos a «${nombre}»?`,
    `• categoría (${unas(opciones.categorias)})`,
    `• grupo muscular (${unas(opciones.grupos)})`,
    `• equipo (${unas(opciones.equipos)})`,
    '• alguna nota',
    'O dime «así» y lo dejo solo con el nombre.',
  ].join('\n')
  throw new Pregunta({
    guardado: false,
    motivo: 'faltan_datos_del_ejercicio',
    mensaje: 'No lo guardé todavía: falta preguntarle a la persona si quiere agregarle datos.',
    pregunta,
    opciones: { categorias: opciones.categorias, grupos_musculares: opciones.grupos, equipos: opciones.equipos },
    que_hacer: 'Hazle esa pregunta a la persona UNA sola vez, tal cual (una sola pregunta, no una por campo). '
      + 'Si en su mensaje ya dio algún dato, úsalo y no lo preguntes. '
      + 'Con lo que conteste, vuelve a llamar a crear_ejercicio con esos datos (categoria, musculos_principales, equipo, descripcion para la nota). '
      + 'Si dice «así», «no» o «nada», vuelve a llamar con sin_datos: true.',
  })
}
