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
export interface Renglon { nombre: string; grupo: number | null; series: string; cantidad: string; porLado?: boolean }

/** Lo que el conector vio al armar los días y la persona no ha contestado. Ver `exigirRespuestas`. */
export interface Revision {
  sinFicha: Set<string>
  sinCantidad: Set<string>
  porLado: Set<string>
  dias: { titulo: string; lista: Renglon[] }[]
  /** Lo que el conector decidió solo y se le dice a la persona en una línea («Supuse: … ¿Cambio algo?»). */
  supuestos: string[]
  /** «Así lo verá el atleta», por día: se calcula al final (`ver`), cuando ya se completó lo que se supuso. */
  vistas: { dia: string; ver: () => string[] }[]
  /** Los ejercicios (el objeto que se guarda) sin cantidad y los unilaterales sin «por lado»: se completan en `exigirRespuestas`. */
  cantidadEx: { ex: any; nombre: string }[]
  porLadoEx: { ex: any; nombre: string }[]
}

export const nuevaRevision = (): Revision => ({ sinFicha: new Set(), sinCantidad: new Set(), porLado: new Set(), dias: [], supuestos: [], vistas: [], cantidadEx: [], porLadoEx: [] })

/** Anota en la revisión lo que dejó armar UN día (`diaDesdeEntrada`). */
export function anotarDia(
  rev: Revision,
  titulo: string,
  d: { sinFicha: string[]; sinCantidad: string[]; porLado: string[]; lista: Renglon[]; supuestos?: string[]; verVista?: () => string[]; cantidadEx?: { ex: any; nombre: string }[]; porLadoEx?: { ex: any; nombre: string }[] },
) {
  d.sinFicha.forEach((n) => rev.sinFicha.add(n))
  d.sinCantidad.forEach((n) => rev.sinCantidad.add(n))
  d.porLado.forEach((n) => rev.porLado.add(n))
  rev.dias.push({ titulo, lista: d.lista })
  rev.supuestos.push(...(d.supuestos ?? []))
  if (d.verVista) rev.vistas.push({ dia: titulo, ver: d.verVista })
  rev.cantidadEx.push(...(d.cantidadEx ?? []))
  rev.porLadoEx.push(...(d.porLadoEx ?? []))
}

/** Lo que se le dice a la persona al guardar: los supuestos y cómo lo verá el atleta (hasta 7 días; un plan largo, solo los primeros). */
export function lineasDeRevision(rev: Revision) {
  return {
    ...(rev.supuestos.length ? { supuestos: rev.supuestos } : {}),
    ...(rev.vistas.length ? { asi_lo_vera_el_atleta: rev.vistas.slice(0, 7).map((v) => ({ dia: v.dia, atleta: v.ver() })).filter((v) => v.atleta.length) } : {}),
    ...(rev.vistas.length > 7 ? { nota_vista: `Y ${rev.vistas.length - 7} sesiones más.` } : {}),
  }
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
const textoDe = (r: Renglon) => `${r.nombre}${r.cantidad ? ` ${r.series}×${r.cantidad}` : r.series ? ` ${r.series} series` : ''}${r.porLado ? ' por lado' : ''}`

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
  'Para cada ejercicio de "catalogo": (1) búscalo con buscar_ejercicios, por su nombre en inglés y por equipo o músculo (el catálogo está casi todo en inglés). '
  + '(2) caso "uno", o es el mismo ejercicio con otro nombre (idioma, abreviatura): vuelve a llamar con el nombre EXACTO del catálogo, SIN preguntarle a la persona; al final dile cómo lo guardaste. '
  + '(3) caso "varios": pregunta cuál, con una lista numerada. (4) caso "ninguno": pregunta «¿lo creo?» (con crear_ejercicio basta el nombre: categoría y grupo se suponen). '
  + '(5) Si la persona dice que va tal cual, sin ficha, o los nombres vienen de un plan que ya existe, repite la llamada con sin_ficha_ok: [esos nombres].'

const QUE_HACER_GENERAL =
  'Lo que sí hay que preguntar va TODO junto, en UN solo mensaje con opciones numeradas. No preguntes nada más: la cantidad, «por lado», '
  + 'las biseries, la categoría, el video y el tipo de sesión se suponen al guardar y se dicen al final en una línea.'

/**
 * Antes de guardar un plan (decisión de Andrés, 23 nov 2026: «un asistente que entiende a la primera»). Hay tres clases de dato:
 *  - BLOQUEA (se pregunta, todo junto): un ejercicio que no está en el catálogo con su nombre. Si hay UN parecido, la IA lo
 *    resuelve sola (vuelve a llamar con el nombre exacto); si hay varios, o ninguno («¿lo creo?»), le pregunta a la persona.
 *  - SE SUPONE Y SE DICE (no se pregunta): la cantidad que falte (3 × 10), «por lado» en un ejercicio a una pierna o un brazo, y las
 *    biseries como vinieron escritas. Se completan aquí, en el objeto que se va a guardar, y quedan en `rev.supuestos`.
 *  - NUNCA SE PREGUNTA al crear: video, foto, descripción, notas.
 * No cuentan los nombres que el plan ya tenía (leer un día y reescribirlo no debe volver a discutirlos ni cambiarlos), ni lo que la
 * persona ya contestó (`respuestas`): `sin_ficha_ok`, y `sin_cantidad_ok` (esos se quedan sin cantidad, como dijo).
 * Devuelve lo que quedó aceptado sin ficha o sin cantidad (para avisarlo); si falta algo del catálogo, lanza `Pregunta`.
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

  // 1. BLOQUEA: ejercicios que no están en el catálogo.
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
  if (catalogo.length) {
    const preguntar = catalogo.filter((c) => c.caso !== 'uno')
    throw new Pregunta({
      guardado: false,
      motivo: 'faltan_respuestas',
      mensaje: preguntar.length
        ? 'No guardé nada todavía: falta saber qué ejercicio es (o si se crea).'
        : 'No guardé nada todavía: hay un ejercicio con otro nombre en el catálogo. Vuelve a llamar con su nombre exacto (sin preguntar).',
      ...(preguntar.length ? { preguntas: [`${preguntar.map((c) => (c.caso === 'ninguno'
        ? `«${c.escrito}» no está en tu repertorio: ¿lo creo?`
        : `¿«${c.escrito}» es ${c.parecidos.map((p, i) => `${i + 1}) ${p.nombre}`).join(', ')}, o creo uno nuevo?`)).join('\n')}`] } : {}),
      pendientes: { catalogo },
      que_hacer: `${QUE_HACER_GENERAL} ${QUE_HACER_FICHAS}`,
    })
  }

  // 2. SE SUPONE: la cantidad que falta (3 × 10), salvo lo que el plan ya tenía o lo que la persona dijo que va sin cantidad.
  const sinCantidad: string[] = []
  const puestas: string[] = []
  for (const { ex, nombre } of rev.cantidadEx) {
    const llave = llaveDeNombre(nombre)
    if (ya.has(llave)) continue
    if (okCantidad.has(llave)) { sinCantidad.push(nombre); continue }
    if (!String(ex.sets ?? '').trim()) ex.sets = '3'
    ex.reps = '10'
    puestas.push(`${nombre} ${ex.sets} × 10`)
  }
  if (puestas.length) rev.supuestos.push(`Cantidad: ${enLista(puestas)} (no venía)`)
  // Lo que no tiene una cantidad que suponer (un lapso vacío): se guarda como viene y se dice.
  const conObjeto = new Set(rev.cantidadEx.map((x) => llaveDeNombre(x.nombre)))
  const sinSuponer = [...rev.sinCantidad].filter((n) => !conObjeto.has(llaveDeNombre(n)) && !ya.has(llaveDeNombre(n)) && !okCantidad.has(llaveDeNombre(n)))
  if (sinSuponer.length) rev.supuestos.push(`A ${enLista(sinSuponer)} le faltó la cantidad en un lapso: quedó así`)

  // 3. SE SUPONE: «por lado» en lo que es a una pierna o un brazo.
  const porLado = rev.porLadoEx.filter(({ nombre }) => !ya.has(llaveDeNombre(nombre)))
  porLado.forEach(({ ex }) => { ex.porLado = true })
  if (porLado.length) rev.supuestos.push(`Por lado: ${enLista([...new Set(porLado.map((x) => x.nombre))])}`)

  // 4. SE SUPONE: las biseries, triseries y circuitos como vinieron escritos (los grupos que mandó la IA). Se enseñan para que se vean.
  if (!o.respuestas?.estructura_ok) {
    for (const d of rev.dias) {
      if (!bloquesDe(d.lista).some((b) => !firmas.has(firmaDeBloque(b.map((r) => r.nombre))))) continue
      const bloques = vistaPrevia(d.lista).filter((l) => /^(BI SERIE|TRI SERIE|CIRCUITO)$/.test(l))
      rev.supuestos.push(`${d.titulo}: ${bloques.length} ${bloques.length === 1 ? 'bloque' : 'bloques'} (${bloques.join(', ').toLowerCase()})`)
    }
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
