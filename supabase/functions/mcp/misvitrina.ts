// deno-lint-ignore-file no-explicit-any
import type { McpServer } from 'npm:@modelcontextprotocol/sdk@1.30.1/server/mcp.js'
import { z } from 'npm:zod@^4.1.13'
import type { Quien } from './sesion.ts'
import { APP_URL } from './config.ts'
import { Aviso, mismoTexto, respuesta, seguro, sinAcentos } from './util.ts'
import { BORRA, ESCRIBE, SOLO_LEER } from './coach.ts'
import { buscarItem, leerMisPlanes, type Item } from './misplanes.ts'
import {
  ETIQUETA_DE_CONTENIDO, VENTANA_MAXIMA, esBiblioteca, esSuelto, ligaPublica, precioMinimoDe, slugUnico, tipoDeCobroDe,
} from './app/vitrinaDatos.js'
import { DEPORTES, EQUIPOS, chipsDeParaQuien, edadesValidas, idDeRango, marcadosValidos, rangoDeEdad } from './app/paraQuien.js'

/**
 * MI VITRINA EN EL CONECTOR DE IA (14 oct 2026, tanda 3).
 *
 * Andrés: la IA tiene que poder lo que hace la app. «Mi vitrina» es donde un profesional pone sus planes a la venta (`src/lib/vitrinaApi.js`, `FichaDelPlanEnVenta.jsx`):
 * un programa, una rutina, un workout o una clase de Mis planes, o «todas mis clases» como biblioteca, con su ficha (nombre, para quién es, precio, cuánto ve el comprador).
 *
 * LO QUE TOCA DINERO O ES PÚBLICO PIDE CONFIRMACIÓN, de verdad y no solo en el texto: `publicar_en_vitrina`, `retirar_de_vitrina` y cambiar un plan que YA está a la venta
 * (su precio o su ficha se ven al momento) no hacen nada sin `confirmado: true`; sin él devuelven lo que PASARÍA, para que la IA se lo enseñe a la persona. Un borrador
 * (todavía no publicado) se arma y se cambia libremente: nadie lo ve.
 *
 * Lo que la IA NO puede: subir la foto o el video de presentación (no sube archivos). Al publicar, la foto de lo guardado en Mis planes se usa sola.
 */

const ESTADOS = ['borrador', 'publicado', 'retirado'] as const
const FUENTE = z.enum(['programa', 'rutina', 'workout', 'clase'])
const CONFIRMADO = z.boolean().optional().describe('Solo después de enseñarle a la persona lo que va a pasar y que diga que sí. Sin esto, no hace nada y te devuelve lo que pasaría.')
const CAMPOS = 'id, coach_id, programa_guardado_id, plantilla_id, slug, titulo, descripcion, para_quien, objetivo, nivel, deportes, foto_url, video_url, tipo, precio_mxn, ventana_semanas, chat, tecnica, estado, version_n, publicada_en, contenido, edades, sexo, equipo, creado_en, actualizado_en'

const pesos = (n: number) => `$${Number(n).toLocaleString('es-MX')}`
const cobroTexto = (p: any) => (p.tipo === 'pago_unico' ? 'pago único' : 'al mes')

/** Lo que dice un valor escrito a mano («18 a 30», «60+», «60 en adelante») como id de edad (`18-30`, `60+`). */
function comoEdad(valor: string): string {
  const v = String(valor ?? '').trim().toLowerCase().replace(/\s*años?$/, '')
  if (rangoDeEdad(v)) return v
  const rango = /^(\d{1,3})\s*(?:-|–|a|hasta)\s*(\d{1,3})$/.exec(v)
  if (rango) { const id = idDeRango(rango[1], rango[2]); if (id) return id }
  const abierto = /^(\d{1,3})\s*(?:\+|en adelante|y más|y mas|o más|o mas)$/.exec(v)
  if (abierto) { const id = idDeRango(abierto[1], ''); if (id) return id }
  throw new Aviso(`La edad "${valor}" no se entiende. Usa rangos como "18-30" o "60+" (de 5 a 99 años).`)
}

/** Ids de una lista fija (deportes, equipo) a partir de ids o nombres escritos como sea. */
function comoIds(valores: string[] | undefined, lista: { id: string; nombre: string }[], queEs: string): string[] {
  const ids = (valores ?? []).map((v) => {
    const t = sinAcentos(v)
    const hit = lista.find((x) => sinAcentos(x.id) === t || sinAcentos(x.nombre) === t) ?? lista.find((x) => sinAcentos(x.nombre).includes(t) || t.includes(sinAcentos(x.id)))
    if (!hit) throw new Aviso(`"${v}" no es ${queEs} válido. Opciones: ${lista.map((x) => `${x.id} (${x.nombre})`).join(', ')}.`)
    return hit.id
  })
  return marcadosValidos(lista, ids)
}

export function herramientasDeMiVitrina(server: McpServer, quien: Quien) {
  const liga = (slug: string) => ligaPublica(quien.usuario, slug, APP_URL)

  async function misPlanesEnVenta() {
    const { data, error } = await quien.db.from('vitrina_planes').select(CAMPOS).eq('coach_id', quien.id).order('actualizado_en', { ascending: false })
    if (error) throw new Error(error.message)
    return (data ?? []) as any[]
  }
  async function ventasAbiertas() {
    const { data, error } = await quien.db.rpc('ventas_abiertas')
    return !error && data === true
  }
  /** Un plan en venta por su id, su liga (slug) o su nombre. */
  function buscarPlan(planes: any[], ref: string) {
    const r = String(ref ?? '').trim()
    const hit = planes.find((p) => p.id === r) ?? planes.find((p) => p.slug === r.toLowerCase())
    if (hit) return hit
    const iguales = planes.filter((p) => mismoTexto(p.titulo, r))
    if (iguales.length === 1) return iguales[0]
    if (iguales.length > 1) throw new Aviso(`Hay ${iguales.length} planes llamados "${r}": ${iguales.map((p) => `${p.slug} (${p.estado})`).join(', ')}. Dime cuál, por su liga o su id.`)
    const parecidos = planes.filter((p) => sinAcentos(p.titulo).includes(sinAcentos(r)))
    if (parecidos.length === 1) return parecidos[0]
    throw new Aviso(`No encontré "${r}" en tu vitrina. Míralo con ver_mi_vitrina.`)
  }
  /** De dónde sale lo que se vende, ya con nombre: «Fuerza 8 semanas (programa)». */
  async function fuentes(planes: any[]) {
    const nombres = new Map<string, string>()
    const programas = planes.map((p) => p.programa_guardado_id).filter(Boolean)
    const plantillas = planes.map((p) => p.plantilla_id).filter(Boolean)
    if (programas.length) for (const f of (await quien.db.from('programas_guardados').select('id, name').in('id', programas)).data ?? []) nombres.set(f.id, f.name)
    if (plantillas.length) for (const f of (await quien.db.from('routine_templates').select('id, name').in('id', plantillas)).data ?? []) nombres.set(f.id, f.name)
    return nombres
  }
  const fichaDe = (p: any, extra: { suscriptores?: number; desde?: string | null } = {}) => ({
    id: p.id,
    liga: p.slug,
    titulo: p.titulo,
    estado: p.estado,
    vende: p.contenido === 'biblioteca' ? ETIQUETA_DE_CONTENIDO.biblioteca : ETIQUETA_DE_CONTENIDO[p.contenido as keyof typeof ETIQUETA_DE_CONTENIDO] ?? p.contenido,
    ...(extra.desde ? { sale_de: extra.desde } : {}),
    precio: `${pesos(p.precio_mxn)} ${cobroTexto(p)}`,
    ventana: `${p.ventana_semanas ?? VENTANA_MAXIMA} ${(p.ventana_semanas ?? VENTANA_MAXIMA) === 1 ? 'semana' : 'semanas'} hacia adelante`,
    incluye: [p.chat ? 'chat' : null, p.tecnica ? 'técnica por video' : null].filter(Boolean),
    nivel: p.nivel ?? 'todos',
    para_quien: chipsDeParaQuien(p, { siempreEdad: true }),
    ...(p.descripcion ? { descripcion: p.descripcion } : {}),
    ...(p.objetivo ? { objetivo: p.objetivo } : {}),
    ...(extra.suscriptores !== undefined ? { suscriptores: extra.suscriptores } : {}),
    ...(p.estado === 'publicado' ? { liga_publica: liga(p.slug), version: p.version_n } : {}),
  })

  /* ================================================================ */
  /* VER                                                                */
  /* ================================================================ */

  server.registerTool('ver_mi_vitrina', {
    title: 'Ver mi vitrina',
    description: 'Los planes que tienes a la venta (o por vender) en Mi vitrina: su estado (borrador, publicado o retirado), qué se vende, precio, para quién es, cuántos suscriptores tiene cada uno y su liga pública. También dice si los cobros ya están abiertos: mientras no lo estén, un plan se puede publicar pero su botón de comprar dice «Pronto».',
    inputSchema: { estado: z.enum(ESTADOS).optional().describe('Solo los borradores, los publicados o los retirados.') },
    annotations: SOLO_LEER,
  }, seguro(async ({ estado }: any) => {
    const [planes, abiertas] = await Promise.all([misPlanesEnVenta(), ventasAbiertas()])
    const lista = planes.filter((p) => !estado || p.estado === estado)
    const nombres = await fuentes(lista)
    const compras = lista.length ? ((await quien.db.from('compras').select('vitrina_plan_id, estado').eq('coach_id', quien.id).in('estado', ['activa', 'gracia', 'por_armar'])).data ?? []) : []
    const suscriptores = (id: string) => compras.filter((c: any) => c.vitrina_plan_id === id).length
    return respuesta({
      total: lista.length,
      cobros_abiertos: abiertas,
      ...(abiertas ? {} : { nota: 'Los cobros todavía no están abiertos: puedes publicar tus planes, pero el botón de comprar dirá «Pronto».' }),
      planes: lista.map((p) => fichaDe(p, { suscriptores: suscriptores(p.id), desde: nombres.get(p.programa_guardado_id ?? p.plantilla_id) ?? null })),
      ...(planes.length === 0 ? { pista: 'Todavía no tienes nada en tu vitrina. Arma un borrador con guardar_en_vitrina.' } : {}),
    })
  }))

  /* ================================================================ */
  /* ARMAR LA FICHA (un borrador; nadie lo ve)                          */
  /* ================================================================ */

  server.registerTool('guardar_en_vitrina', {
    title: 'Armar o cambiar la ficha de un plan en venta',
    description: [
      'Crea (o cambia) la ficha de un plan en Mi vitrina. Un plan NUEVO nace como BORRADOR y nadie lo ve: aquí no se publica nada (para eso, publicar_en_vitrina).',
      'Para uno nuevo manda "desde" (lo guardado en Mis planes que se vende: un programa, una rutina, un workout o una clase; búscalo con ver_mis_planes) o "biblioteca": true ("todas mis clases", una membresía que da acceso a todas las clases de Mis planes, también las que agregues después), más el "precio_mxn".',
      'Un programa y una rutina pueden ser membresía mensual o pago único (mínimo $500). Un workout o una clase suelta SIEMPRE es pago único (mínimo $100) y la biblioteca SIEMPRE membresía (mínimo $100); esos no llevan chat ni técnica. El comprador ve a lo más un mes hacia adelante ("ventana_semanas" de 1 a 4; 4 si no se dice).',
      'La ficha dice para quién es: "nivel", "deportes", "edades" (rangos como "18-30" o "60+"), "sexo" y "equipo". Lo que la persona no dijo, déjalo vacío: no lo inventes. El PRECIO nunca lo inventes: pregúntalo.',
      'Para cambiar uno que ya existe manda "plan" (su liga, su nombre o su id). Si ya está PUBLICADO, el cambio se ve al momento en su página: no se hace sin "confirmado": true (pregúntale antes a la persona); sin eso te devuelve lo que cambiaría.',
      'No puede subir la foto ni el video de presentación.',
    ].join(' '),
    inputSchema: {
      plan: z.string().optional().describe('Para CAMBIAR uno que ya existe: su liga, su nombre o su id (ver_mi_vitrina). Sin esto, se crea uno nuevo.'),
      desde: z.string().optional().describe('Lo guardado en Mis planes que se vende (nombre o id).'),
      tipo_de_lo_guardado: FUENTE.optional().describe('Para distinguir dos cosas guardadas con el mismo nombre.'),
      biblioteca: z.boolean().optional().describe('true para vender "todas mis clases" como biblioteca (en vez de "desde").'),
      titulo: z.string().optional().describe('El nombre del plan en venta. Sin esto, el de lo guardado.'),
      descripcion: z.string().optional().describe('Qué es, en pocas líneas. Sin esto, la de lo guardado.'),
      objetivo: z.string().optional().describe('El objetivo, en una línea.'),
      nivel: z.enum(['todos', 'principiante', 'intermedio', 'avanzado']).optional(),
      deportes: z.array(z.string()).optional().describe('Deporte o disciplina (ej.: "fuerza", "running", "pilates"). Mira las opciones en el aviso si te equivocas.'),
      edades: z.array(z.string()).optional().describe('Rangos de edad: "15-18", "18-30", "60+"… Sin esto, todas las edades.'),
      sexo: z.enum(['todos', 'mujeres', 'hombres']).optional(),
      equipo: z.array(z.string()).optional().describe('El equipo que necesita (ej.: "gym", "casa", "sin_equipo", "reformer", "bici", "cancha").'),
      cobro: z.enum(['membresia', 'pago_unico']).optional().describe('Solo programa y rutina; lo demás se acomoda solo. "membresia" si no se dice.'),
      precio_mxn: z.coerce.number().optional().describe('El precio en pesos (entero). Mínimo $500 en programas y rutinas, $100 en workouts, clases y biblioteca.'),
      ventana_semanas: z.coerce.number().optional().describe('Cuántas semanas hacia adelante ve el comprador, de 1 a 4 (4 = un mes, el máximo).'),
      chat: z.boolean().optional().describe('Si incluye chat con el profesional (solo programa y rutina).'),
      tecnica: z.boolean().optional().describe('Si incluye corrección de técnica por video (solo programa y rutina).'),
      confirmado: CONFIRMADO,
    },
    annotations: ESCRIBE,
  }, seguro(async (a: any) => {
    const planes = await misPlanesEnVenta()
    const existente = a.plan ? buscarPlan(planes, a.plan) : null
    const hayPrecio = a.precio_mxn !== undefined
    if (hayPrecio && (!Number.isFinite(Number(a.precio_mxn)) || !Number.isInteger(Number(a.precio_mxn)))) throw new Aviso('El precio es un número entero de pesos.')
    if (a.ventana_semanas !== undefined && (!Number.isInteger(Number(a.ventana_semanas)) || Number(a.ventana_semanas) < 1 || Number(a.ventana_semanas) > VENTANA_MAXIMA)) {
      throw new Aviso(`El comprador ve de 1 a ${VENTANA_MAXIMA} semanas hacia adelante (${VENTANA_MAXIMA} = un mes, el máximo).`)
    }
    if (a.titulo !== undefined && !String(a.titulo).trim()) throw new Aviso('El nombre no puede quedar vacío.')
    if (a.desde && a.biblioteca) throw new Aviso('Elige UNO: "desde" (algo de Mis planes) o "biblioteca" (todas tus clases).')

    // De dónde sale lo que se vende.
    let fuente: { contenido: string; item?: Item; descripcion?: string; foto?: string } | null = null
    if (a.biblioteca) {
      fuente = { contenido: 'biblioteca' }
    } else if (a.desde) {
      const { carpetas, items } = await leerMisPlanes(quien)
      const item = buscarItem(items, carpetas, a.desde, a.tipo_de_lo_guardado)
      const { data } = await quien.db.from(item.tabla).select('data').eq('id', item.id).maybeSingle()
      fuente = { contenido: item.tipo, item, descripcion: item.descripcion || undefined, foto: typeof data?.data?.foto === 'string' ? data.data.foto : undefined }
    }
    if (!existente && !fuente) throw new Aviso('¿Qué se vende? Manda "desde" (lo guardado en Mis planes: ver_mis_planes) o "biblioteca": true.')
    const contenido = fuente?.contenido ?? existente.contenido
    if (esBiblioteca(contenido)) {
      const { items } = await leerMisPlanes(quien)
      if (!items.some((i) => i.tipo === 'clase')) throw new Aviso('Todavía no tienes clases en Mis planes. Guarda al menos una.')
    }

    // Lo que se escribe: solo lo que se mandó (más lo que se acomoda solo).
    const fila: Record<string, unknown> = {}
    if (fuente) {
      fila.contenido = fuente.contenido
      fila.programa_guardado_id = fuente.contenido === 'programa' ? fuente.item!.id : null
      fila.plantilla_id = fuente.item && fuente.contenido !== 'programa' ? fuente.item.id : null
    }
    if (a.titulo !== undefined) fila.titulo = String(a.titulo).trim()
    if (a.descripcion !== undefined) fila.descripcion = String(a.descripcion).trim() || null
    if (a.objetivo !== undefined) fila.objetivo = String(a.objetivo).trim() || null
    if (a.nivel !== undefined) fila.nivel = a.nivel
    if (a.deportes !== undefined) fila.deportes = comoIds(a.deportes, DEPORTES, 'un deporte o disciplina')
    if (a.edades !== undefined) fila.edades = edadesValidas(a.edades.map(comoEdad))
    if (a.sexo !== undefined) fila.sexo = a.sexo
    if (a.equipo !== undefined) fila.equipo = comoIds(a.equipo, EQUIPOS, 'equipo')
    if (hayPrecio) fila.precio_mxn = Number(a.precio_mxn)
    if (a.ventana_semanas !== undefined) fila.ventana_semanas = Number(a.ventana_semanas)
    if (a.chat !== undefined) fila.chat = a.chat
    if (a.tecnica !== undefined) fila.tecnica = a.tecnica
    // Lo que una venta suelta o la biblioteca no pueden ser, se acomoda solo.
    const tipoPedido = a.cobro ?? existente?.tipo
    fila.tipo = tipoDeCobroDe(contenido, tipoPedido)
    if (esSuelto(contenido) || esBiblioteca(contenido)) { fila.chat = false; fila.tecnica = false }

    if (existente) {
      // Un plan que ya está a la venta se ve al momento: sin permiso, solo se dice lo que cambiaría.
      if (existente.estado === 'publicado' && !a.confirmado) {
        return respuesta({
          guardado: false,
          motivo: 'falta_confirmacion',
          ya_esta_a_la_venta: `"${existente.titulo}" ya está publicado: lo que cambies en su ficha (precio, nombre, para quién es…) se ve AL MOMENTO en su página.`,
          cambiaria: fila,
          pista: 'Enséñale estos cambios a la persona. Si dice que sí, vuelve a llamar con confirmado: true.',
        })
      }
      const final = { ...existente, ...fila }
      if (final.precio_mxn < precioMinimoDe(final.contenido)) throw new Aviso(`El precio mínimo es ${pesos(precioMinimoDe(final.contenido))}.`)
      const { data, error } = await quien.db.from('vitrina_planes').update(fila).eq('id', existente.id).select(CAMPOS).maybeSingle()
      if (error) throw new Error(error.message)
      if (!data) throw new Aviso('No tienes permiso para cambiar este plan.')
      return respuesta({
        listo: true,
        plan: fichaDe(data),
        ...(existente.estado === 'publicado' ? { aviso: 'Como ya estaba a la venta, el cambio de la ficha ya se ve en su página. Si cambiaste lo que se vende, publícalo de nuevo con publicar_en_vitrina para que lo nuevo llegue.' } : {}),
      })
    }

    // Uno nuevo.
    if (!hayPrecio) throw new Aviso(`¿Cuánto cuesta? Pregúntaselo a la persona (mínimo ${pesos(precioMinimoDe(contenido))}${fila.tipo === 'membresia' ? ' al mes' : ''}).`)
    if ((fila.precio_mxn as number) < precioMinimoDe(contenido)) throw new Aviso(`El precio mínimo es ${pesos(precioMinimoDe(contenido))}.`)
    const titulo = String(fila.titulo ?? fuente!.item?.nombre ?? (esBiblioteca(contenido) ? 'Todas mis clases' : '')).trim()
    if (!titulo) throw new Aviso('Ponle un nombre.')
    const nuevo = {
      ...fila,
      coach_id: quien.id,
      titulo,
      slug: slugUnico(titulo, planes.map((p) => p.slug)),
      descripcion: fila.descripcion ?? fuente?.descripcion ?? null,
      foto_url: fuente?.foto ?? null,
      ventana_semanas: fila.ventana_semanas ?? VENTANA_MAXIMA,
    }
    const { data, error } = await quien.db.from('vitrina_planes').insert(nuevo).select(CAMPOS).single()
    if (error) {
      if (error.code === '23514' || /check/i.test(error.message)) throw new Aviso('Revisa los datos: el precio mínimo es $500 (programa y rutina) o $100 (workout, clase y biblioteca).')
      throw new Error(error.message)
    }
    return respuesta({
      listo: true,
      borrador: true,
      plan: fichaDe(data, { desde: fuente?.item?.nombre ?? null }),
      siguiente: 'Es un borrador: nadie lo ve. Para ponerlo a la venta: publicar_en_vitrina (pide que la persona confirme).',
    })
  }))

  /* ================================================================ */
  /* PUBLICAR, RETIRAR, BORRAR                                          */
  /* ================================================================ */

  server.registerTool('publicar_en_vitrina', {
    title: 'Publicar un plan en la vitrina',
    description: [
      'Pone un plan a la venta: lo vuelve PÚBLICO en su liga (cualquiera con la liga lo ve) con el precio que tiene su ficha. Guarda una COPIA de lo que hoy tiene en Mis planes: si lo cambias allá después, no se mueve lo vendido hasta que vuelvas a publicar (también para "Publicar cambios" de uno ya publicado).',
      'Sin "confirmado": true NO publica y te devuelve lo que va a pasar (nombre, precio, para quién, liga): enséñaselo a la persona y pregúntale si lo publica. Con confirmado: true publica.',
      'Si los cobros todavía no están abiertos, se publica igual pero el botón de comprar dice «Pronto».',
    ].join(' '),
    inputSchema: { plan: z.string().describe('Su liga, su nombre o su id (ver_mi_vitrina).'), confirmado: CONFIRMADO },
    annotations: { ...ESCRIBE, destructiveHint: true },
  }, seguro(async ({ plan, confirmado }: any) => {
    const planes = await misPlanesEnVenta()
    const p = buscarPlan(planes, plan)
    const [abiertas, nombres] = await Promise.all([ventasAbiertas(), fuentes([p])])
    const desde = nombres.get(p.programa_guardado_id ?? p.plantilla_id) ?? null
    if (!confirmado) {
      return respuesta({
        publicado: false,
        motivo: 'falta_confirmacion',
        va_a_pasar: p.estado === 'publicado'
          ? `Se guardará una versión NUEVA de "${p.titulo}" con lo que hoy tiene ${desde ? `«${desde}»` : 'tu catálogo'} en Mis planes. Quienes ya lo compraron siguen con su ventana.`
          : `"${p.titulo}" se vuelve PÚBLICO: cualquiera con su liga lo ve${abiertas ? ' y lo puede comprar' : ' (el botón de comprar dirá «Pronto» hasta que se abran los cobros)'}.`,
        plan: fichaDe(p, { desde }),
        liga_publica: liga(p.slug),
        pista: 'Enséñale esto a la persona. Si dice que sí, vuelve a llamar con confirmado: true.',
      })
    }
    const { data, error } = await quien.db.rpc('publicar_plan', { p_plan: p.id })
    if (error) throw new Aviso(error.message)
    return respuesta({
      listo: true,
      publicado: true,
      version: data,
      plan: p.titulo,
      liga_publica: liga(p.slug),
      cobros_abiertos: abiertas,
      ...(abiertas ? {} : { nota: 'Los cobros todavía no están abiertos: el botón de comprar dice «Pronto».' }),
    })
  }))

  server.registerTool('retirar_de_vitrina', {
    title: 'Retirar un plan de la vitrina',
    description: 'Deja de mostrar un plan publicado en tu página y deja de venderse. Quien ya lo paga lo conserva hasta que deje de pagar. Se puede volver a publicar después. Sin "confirmado": true NO lo retira y te devuelve lo que pasaría: pregúntale antes a la persona.',
    inputSchema: { plan: z.string().describe('Su liga, su nombre o su id (ver_mi_vitrina).'), confirmado: CONFIRMADO },
    annotations: BORRA,
  }, seguro(async ({ plan, confirmado }: any) => {
    const planes = await misPlanesEnVenta()
    const p = buscarPlan(planes, plan)
    if (p.estado !== 'publicado') throw new Aviso(`"${p.titulo}" no está publicado (está en ${p.estado}): no hay nada que retirar.`)
    if (!confirmado) {
      return respuesta({
        retirado: false,
        motivo: 'falta_confirmacion',
        va_a_pasar: `"${p.titulo}" deja de mostrarse en tu página y de venderse. Quien ya lo paga lo conserva hasta que deje de pagar.`,
        pista: 'Pregúntale a la persona. Si dice que sí, vuelve a llamar con confirmado: true.',
      })
    }
    const { data, error } = await quien.db.from('vitrina_planes').update({ estado: 'retirado' }).eq('id', p.id).select('id').maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) throw new Aviso('No tienes permiso para retirar este plan.')
    return respuesta({ listo: true, retirado: p.titulo, nota: 'Se puede volver a publicar con publicar_en_vitrina.' })
  }))

  server.registerTool('borrar_borrador_de_vitrina', {
    title: 'Borrar un borrador de la vitrina',
    description: 'Borra un plan de tu vitrina que NUNCA se publicó. Uno que ya se publicó no se borra: se retira. Antes de borrar, di qué borrador se va.',
    inputSchema: { plan: z.string().describe('Su liga, su nombre o su id (ver_mi_vitrina).') },
    annotations: BORRA,
  }, seguro(async ({ plan }: any) => {
    const planes = await misPlanesEnVenta()
    const p = buscarPlan(planes, plan)
    if (p.estado !== 'borrador' || p.version_n > 0) throw new Aviso(`"${p.titulo}" ya se publicó alguna vez: no se borra, se retira (retirar_de_vitrina).`)
    const { data, error } = await quien.db.from('vitrina_planes').delete().eq('id', p.id).eq('estado', 'borrador').select('id')
    if (error) throw new Error(error.message)
    if (!data?.length) throw new Aviso('No tienes permiso para borrar este plan.')
    return respuesta({ listo: true, borrado: p.titulo })
  }))
}

