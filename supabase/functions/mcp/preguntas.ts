// deno-lint-ignore-file no-explicit-any
import { Pregunta, llaveDeNombre, palabrasClave, sinAcentos } from './util.ts'

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
 * El conector no ve el mensaje de la persona, pero SÍ ve lo que la IA le manda: si a un ejercicio le falta
 * la cantidad, si uno que va a una pierna o brazo no dice si cuenta «por lado», si armó biseries o
 * triseries por su cuenta (se las enseña a la persona para que confirme) y si usó un nombre que no
 * está en el catálogo. Todo eso se pregunta JUNTO, en un solo mensaje, antes de guardar.
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
/* Tope: lo que falta antes de guardar un plan                         */
/* ------------------------------------------------------------------ */

/** Cómo quedó cada ejercicio de un día, para enseñarle a la persona cómo se entendió su rutina. */
export interface Renglon { nombre: string; grupo: number | null; series: string; cantidad: string }

/** Lo que el conector vio al armar los días y la persona no ha contestado. Ver `exigirRespuestas`. */
export interface Revision {
  sinFicha: Set<string>
  sinCantidad: Set<string>
  porLado: Set<string>
  dias: { titulo: string; lista: Renglon[] }[]
}

export const nuevaRevision = (): Revision => ({ sinFicha: new Set(), sinCantidad: new Set(), porLado: new Set(), dias: [] })

/** Anota en la revisión lo que dejó armar UN día (`diaDesdeEntrada`). */
export function anotarDia(
  rev: Revision,
  titulo: string,
  d: { sinFicha: string[]; sinCantidad: string[]; porLado: string[]; lista: Renglon[] },
) {
  d.sinFicha.forEach((n) => rev.sinFicha.add(n))
  d.sinCantidad.forEach((n) => rev.sinCantidad.add(n))
  d.porLado.forEach((n) => rev.porLado.add(n))
  rev.dias.push({ titulo, lista: d.lista })
}

/**
 * Ejercicios que por su nombre van a una pierna o a un brazo: ahí la cantidad puede ser POR LADO («3×8»
 * son 8 por pierna) y quien arma la rutina tiene que decirlo. Es una lista corta y conservadora; un
 * unilateral que no esté aquí simplemente no se pregunta.
 */
const UNILATERALES = [
  /\b(pistol|unilateral|bulgarian|curtsy|cossack|kickbacks?)\b/,
  /\b(lunges?|zancadas?|desplantes?)\b/,
  /\bstep ?ups?\b/,
  /\bsplit squats?\b/,
  /\b(single|one|1) ?(leg|arm)\b/,
  /\ba (una|un) (pierna|brazo|mano)\b/,
]

export function esUnilateral(nombre: string) {
  const n = sinAcentos(nombre).replace(/[^a-z0-9]+/g, ' ')
  return UNILATERALES.some((r) => r.test(n))
}

/** Los bloques de 2 o más ejercicios SEGUIDOS con el mismo grupo: biserie, triserie o circuito. */
function bloquesDe(lista: Renglon[]) {
  const bloques: Renglon[][] = []
  let actual: Renglon[] = []
  const cerrar = () => { if (actual.length > 1) bloques.push(actual); actual = [] }
  for (const r of lista) {
    if (r.grupo == null) { cerrar(); continue }
    if (actual.length && actual[0].grupo !== r.grupo) cerrar()
    actual.push(r)
  }
  cerrar()
  return bloques
}

/** Un bloque se reconoce por los nombres de sus ejercicios, sin importar el orden: así se sabe si «ya estaba». */
export const firmaDeBloque = (nombres: string[]) => nombres.map(llaveDeNombre).sort().join('|')

/** Los bloques de un día tal como están guardados (cada ejercicio con su `set`). */
export function firmasDeDia(ejercicios: any[]): string[] {
  const lista: Renglon[] = (ejercicios ?? []).map((e) => (e.isNote || !e.name
    ? { nombre: '', grupo: null, series: '', cantidad: '' }
    : { nombre: String(e.name), grupo: e.set ?? null, series: '', cantidad: '' }))
  return bloquesDe(lista).map((b) => firmaDeBloque(b.map((r) => r.nombre)))
}

const etiquetaDeBloque = (n: number) => (n === 2 ? 'BI SERIE' : n === 3 ? 'TRI SERIE' : 'CIRCUITO')
const textoDe = (r: Renglon) => `${r.nombre}${r.cantidad ? ` ${r.series}×${r.cantidad}` : r.series ? ` ${r.series} series` : ''}`

/** La rutina como se entendió, para confirmarla: los bloques con su nombre y los ejercicios solos. */
export function vistaPrevia(lista: Renglon[]): string[] {
  const lineas: string[] = []
  let i = 0
  while (i < lista.length) {
    const r = lista[i]
    let j = i + 1
    if (r.grupo != null) while (j < lista.length && lista[j].grupo === r.grupo) j += 1
    const bloque = lista.slice(i, j)
    if (bloque.length > 1) {
      lineas.push(etiquetaDeBloque(bloque.length))
      bloque.forEach((b) => lineas.push(`  ${textoDe(b)}`))
    } else {
      lineas.push(textoDe(r))
    }
    i = j
  }
  return lineas
}

const enLista = (nombres: string[]) => (nombres.length > 1
  ? `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`
  : nombres[0])

const QUE_HACER_FICHAS =
  'Para cada ejercicio del catálogo: (1) búscalo con buscar_ejercicios, por su nombre en inglés y por equipo o músculo (el catálogo está casi todo en inglés). '
  + '(2) Si encaja UNO solo, o es el mismo ejercicio con otro nombre (idioma, abreviatura), vuelve a llamar con el nombre EXACTO del catálogo, sin preguntar; al final dile a la persona cómo lo guardaste. '
  + '(3) Si hay varios posibles, pregunta cuál con una lista numerada; si dudas entre uno de su lista y uno nuevo, pregunta «¿es X de tu lista o creo uno nuevo?». '
  + '(4) Si ninguno encaja, pregunta «¿lo creo?» y ofrece en ese mismo mensaje los datos (categoría, grupo muscular, equipo, nota); se crea con crear_ejercicio. '
  + '(5) Si la persona dice que va tal cual, sin ficha, o los nombres vienen de un plan que ya existe, repite la llamada con sin_ficha_ok: [esos nombres].'

const QUE_HACER_GENERAL =
  'Haz TODAS las preguntas juntas, en UN solo mensaje y tal cual (las de "preguntas" y las del catálogo). No preguntes lo que la persona ya dijo. '
  + 'Con lo que conteste, vuelve a llamar con TODO: nombres exactos del catálogo, por_lado: true o false en cada ejercicio unilateral, la cantidad que dio, '
  + 'sin_cantidad_ok con los nombres que dijo que van sin cantidad, y estructura_ok: true cuando confirme la estructura (o si ya la había dicho explícitamente).'

/**
 * Antes de guardar un plan: lo que falta se le pregunta a la persona (vía la IA), TODO junto, y no se
 * guarda nada hasta tenerlo. Lo que se revisa:
 *  - un ejercicio que no está en el catálogo con su nombre,
 *  - un ejercicio sin cantidad (ni reloj ni vueltas),
 *  - un ejercicio unilateral sin decir si cuenta por lado (`por_lado` true o false),
 *  - biseries o triseries nuevas (se le enseña la rutina armada para que la confirme).
 * No cuentan los nombres que el plan ya tenía (leer un día y reescribirlo no debe volver a discutirlos)
 * ni las agrupaciones que ya estaban, ni lo que la persona ya contestó (`respuestas`).
 * Devuelve lo que quedó aceptado sin ficha o sin cantidad (para avisarlo); si algo falta, lanza `Pregunta`.
 */
export function exigirRespuestas(o: {
  revision: Revision
  catalogo: ItemDeCatalogo[]
  plan?: { nombres: Iterable<string>; firmas: Set<string> } | null
  respuestas?: { sin_ficha_ok?: string[]; sin_cantidad_ok?: string[]; estructura_ok?: boolean }
}): { sinFicha: string[]; sinCantidad: string[] } {
  const { revision: rev } = o
  const ya = new Set([...(o.plan?.nombres ?? [])].map(llaveDeNombre))
  const firmas = o.plan?.firmas ?? new Set<string>()
  const okFicha = new Set((o.respuestas?.sin_ficha_ok ?? []).map(llaveDeNombre))
  const okCantidad = new Set((o.respuestas?.sin_cantidad_ok ?? []).map(llaveDeNombre))

  // 1. Ejercicios que no están en el catálogo.
  const sinFicha: string[] = []
  const catalogo: { escrito: string; caso: 'ninguno' | 'uno' | 'varios'; parecidos: ReturnType<typeof resumen>[] }[] = []
  const vistos = new Set<string>()
  for (const escrito of rev.sinFicha) {
    const llave = llaveDeNombre(escrito)
    if (vistos.has(llave)) continue
    vistos.add(llave)
    if (ya.has(llave)) continue
    if (okFicha.has(llave)) { sinFicha.push(escrito); continue }
    const parecidos = parecidosA(escrito, o.catalogo)
    catalogo.push({ escrito, caso: parecidos.length === 0 ? 'ninguno' : parecidos.length === 1 ? 'uno' : 'varios', parecidos: parecidos.map(resumen) })
  }

  // 2. Ejercicios sin cantidad.
  const sinCantidad: string[] = []
  const faltaCantidad: string[] = []
  for (const n of rev.sinCantidad) {
    const llave = llaveDeNombre(n)
    if (ya.has(llave)) continue
    if (okCantidad.has(llave)) sinCantidad.push(n)
    else faltaCantidad.push(n)
  }

  // 3. Unilaterales sin decir si cuentan por lado.
  const porLado = [...rev.porLado].filter((n) => !ya.has(llaveDeNombre(n)))

  // 4. Biseries o triseries nuevas: se enseña la rutina armada.
  const estructura = o.respuestas?.estructura_ok ? [] : rev.dias
    .filter((d) => bloquesDe(d.lista).some((b) => !firmas.has(firmaDeBloque(b.map((r) => r.nombre)))))
    .map((d) => ({ dia: d.titulo, rutina: vistaPrevia(d.lista) }))

  const preguntas: string[] = []
  if (porLado.length) {
    preguntas.push(`¿${enLista(porLado)} ${porLado.length > 1 ? 'cuentan' : 'cuenta'} por lado (cada pierna o brazo), o la cantidad es en total?`)
  }
  if (faltaCantidad.length) {
    preguntas.push(faltaCantidad.length > 1
      ? `${enLista(faltaCantidad)} no traen repeticiones ni tiempo: ¿cuántas pongo, o los dejo así?`
      : `${faltaCantidad[0]} no trae repeticiones ni tiempo: ¿cuántas pongo, o lo dejo así?`)
  }
  if (estructura.length) {
    preguntas.push(`Armé la rutina así, ¿está bien?\n${estructura.slice(0, 4).map((d) => `${estructura.length > 1 ? `${d.dia}:\n` : ''}${d.rutina.join('\n')}`).join('\n\n')}`)
  }

  if (catalogo.length || preguntas.length) {
    throw new Pregunta({
      guardado: false,
      motivo: 'faltan_respuestas',
      mensaje: 'No guardé nada todavía: faltan respuestas de la persona.',
      ...(preguntas.length ? { preguntas } : {}),
      pendientes: {
        ...(catalogo.length ? { catalogo } : {}),
        ...(faltaCantidad.length ? { sin_cantidad: faltaCantidad } : {}),
        ...(porLado.length ? { por_lado: porLado } : {}),
        ...(estructura.length ? { estructura } : {}),
      },
      que_hacer: `${QUE_HACER_GENERAL}${catalogo.length ? ` ${QUE_HACER_FICHAS}` : ''}`,
    })
  }
  return { sinFicha, sinCantidad }
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
    const llave = llaveDeNombre(crudo)
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
