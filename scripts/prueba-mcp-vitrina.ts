// deno-lint-ignore-file no-explicit-any
// Pruebas de «Mi vitrina» en el conector de IA (supabase/functions/mcp/misvitrina.ts), con una base en memoria.
// Corre desde supabase/functions/mcp:  deno run -A --config deno.json ../../../scripts/prueba-mcp-vitrina.ts
import { herramientasDeMiVitrina } from '../supabase/functions/mcp/misvitrina.ts'
import { baseEnMemoria, cierto, igual } from './mcp-prueba-comun.ts'

let n = 0
const ok = (nombre: string) => { n += 1; console.log(`OK    ${nombre}`) }

const CLASE = { url: 'https://videos.ejemplo/vinyasa.mp4', duracion: 2700 }
const SEMBRADO = () => ({
  programas_guardados: [
    { id: 'p-1', name: 'Fuerza 8 semanas', descripcion: 'Ocho semanas de fuerza', origen: null, carpeta_id: null, resumen: { forma: 'fases', fases: 2, semanas: 3, sesiones: 8 }, created_by: 'master-1', data: { kind: 'periodized', phases: [{ id: 'f1', weekData: [] }], foto: '/fotos/fuerza.jpg' } },
  ],
  routine_templates: [
    { id: 't-w', name: 'Piernas A', kind: 'day', descripcion: null, resumen: { sesiones: 1, ejercicios: 6 }, demo: false, created_by: 'master-1', data: { name: 'Piernas', cat: 'gym', exercises: [] } },
    { id: 't-c', name: 'Vinyasa 45', kind: 'day', descripcion: 'De la mañana', resumen: { sesiones: 1, ejercicios: 0, clase: true, duracion: 2700 }, demo: false, created_by: 'master-1', data: { name: 'Vinyasa', cat: 'clase', exercises: [], clase: CLASE } },
    { id: 't-r', name: 'Semana base', kind: 'week', descripcion: null, resumen: { dias: 2, sesiones: 2 }, demo: false, created_by: 'master-1', data: { days: [] } },
  ],
  carpetas_planes: [],
})

function armar(tablas: Record<string, any[]> = {}, abiertas = false) {
  const { db, datos } = baseEnMemoria({ ...SEMBRADO(), vitrina_planes: [], compras: [], ...tablas }, {
    memoria: ['routine_templates', 'programas_guardados', 'carpetas_planes', 'vitrina_planes'],
    // Lo que la base pone sola: un plan nuevo siempre nace borrador.
    alInsertar: { vitrina_planes: (f: any) => ({ estado: 'borrador', version_n: 0, publicada_en: null, deportes: [], edades: [], equipo: [], sexo: 'todos', chat: false, tecnica: false, ventana_semanas: 4, ...f }) },
    rpcs: {
      ventas_abiertas: () => abiertas,
      publicar_plan: ({ p_plan }, d) => {
        const v = d.vitrina_planes.find((x: any) => x.id === p_plan)
        if (!v) throw new Error('Ese plan no es tuyo.')
        if (v.contenido === 'biblioteca' && !d.routine_templates.some((t: any) => t.resumen?.clase)) throw new Error('Todavía no tienes clases en «Mis planes». Guarda al menos una.')
        v.version_n += 1; v.estado = 'publicado'; v.publicada_en = '2026-10-14'
        return v.version_n
      },
    },
  })
  const quien: any = { id: 'master-1', usuario: 'andres', nombre: 'Andrés', rol: 'master', salud: false, unidad: 'kg', db }
  const tools: Record<string, (a: any) => Promise<any>> = {}
  const server: any = { registerTool: (nombre: string, _def: unknown, fn: (a: any) => Promise<any>) => { tools[nombre] = fn } }
  herramientasDeMiVitrina(server, quien)
  return { tools, datos }
}
const sc = (r: any) => r.structuredContent
const falla = async (p: Promise<any>) => { const r = await p; cierto(r.isError || sc(r)?.error || /no encontr|elige|no pued|falta|di |hay \d|manda|qué se|cuánto|precio|mínimo|nombre|ya se publicó|no hay nada|no está publicado|no entiende|no es un|entero|semanas/i.test(JSON.stringify(r.content ?? r)), 'se esperaba un aviso'); return JSON.stringify(r.content ?? r) }

/* ======================= Armar un borrador ======================= */
{
  const { tools, datos } = armar()
  const r = sc(await tools.guardar_en_vitrina({ desde: 'Fuerza 8 semanas', precio_mxn: 600, nivel: 'intermedio', deportes: ['fuerza'], edades: ['18 a 30', '60+'], sexo: 'mujeres', equipo: ['gym'], objetivo: 'Ganar fuerza' }))
  igual([r.listo, r.borrador, r.plan.estado, r.plan.liga, r.plan.precio], [true, true, 'borrador', 'fuerza-8-semanas', '$600 al mes'], 'un programa nuevo nace como borrador, con su liga y precio')
  const f = datos.vitrina_planes[0]
  igual([f.contenido, f.programa_guardado_id, f.plantilla_id, f.coach_id, f.tipo, f.ventana_semanas], ['programa', 'p-1', null, 'master-1', 'membresia', 4], 'ligado a lo guardado, de quien llama, membresía y un mes de ventana')
  igual([f.titulo, f.descripcion, f.foto_url], ['Fuerza 8 semanas', 'Ocho semanas de fuerza', '/fotos/fuerza.jpg'], 'el nombre, la descripción y la foto salen de lo guardado')
  igual([f.edades, f.deportes, f.equipo, f.sexo, f.nivel], [['18-30', '60+'], ['fuerza'], ['gym'], 'mujeres', 'intermedio'], 'para quién es: edades escritas como sea, deportes y equipo por nombre')
  igual(r.plan.para_quien, ['Fuerza / gym', '18 a 30 y 60 en adelante', 'Mujeres', 'Gym completo'], 'y se dice en palabras')
  cierto(/publicar_en_vitrina/.test(r.siguiente), 'dice cómo seguir')

  // Una liga repetida no se repite.
  const r2 = sc(await tools.guardar_en_vitrina({ desde: 'Fuerza 8 semanas', precio_mxn: 700, titulo: 'Fuerza 8 semanas' }))
  igual(r2.plan.liga, 'fuerza-8-semanas-2', 'una liga repetida lleva número')
  ok('guardar_en_vitrina: borrador nuevo (fuente, para quién, liga)')
}

/* ======================= Reglas de precio y de qué se vende ======================= */
{
  const { tools, datos } = armar()
  cierto(/Cuánto cuesta/i.test(await falla(tools.guardar_en_vitrina({ desde: 'Fuerza 8 semanas' }))), 'sin precio: lo pregunta, no lo inventa')
  cierto(/mínimo es \$500/.test(await falla(tools.guardar_en_vitrina({ desde: 'Fuerza 8 semanas', precio_mxn: 499 }))), 'un programa: mínimo $500')
  cierto(/mínimo es \$100/.test(await falla(tools.guardar_en_vitrina({ desde: 'Piernas A', precio_mxn: 99 }))), 'un workout: mínimo $100')
  cierto(/qué se vende/i.test(await falla(tools.guardar_en_vitrina({ precio_mxn: 600 }))), 'sin fuente: lo pregunta')
  cierto(/UNO/.test(await falla(tools.guardar_en_vitrina({ desde: 'Piernas A', biblioteca: true, precio_mxn: 600 }))), 'dos fuentes: avisa')
  cierto(/entero/.test(await falla(tools.guardar_en_vitrina({ desde: 'Fuerza 8 semanas', precio_mxn: 600.5 }))), 'solo pesos enteros')
  cierto(/1 a 4/.test(await falla(tools.guardar_en_vitrina({ desde: 'Fuerza 8 semanas', precio_mxn: 600, ventana_semanas: 6 }))), 'la ventana no pasa de un mes')
  cierto(/no es un deporte/.test(await falla(tools.guardar_en_vitrina({ desde: 'Fuerza 8 semanas', precio_mxn: 600, deportes: ['cricket'] }))), 'un deporte que no existe: avisa y dice las opciones')
  cierto(/no se entiende/.test(await falla(tools.guardar_en_vitrina({ desde: 'Fuerza 8 semanas', precio_mxn: 600, edades: ['joven'] }))), 'una edad que no se entiende: avisa')
  igual(datos.vitrina_planes.length, 0, 'y nada de eso guardó algo')

  // Un workout y una clase: siempre pago único, sin chat ni técnica.
  const w = sc(await tools.guardar_en_vitrina({ desde: 'Piernas A', precio_mxn: 150, cobro: 'membresia', chat: true, tecnica: true }))
  const fw = datos.vitrina_planes.find((x: any) => x.contenido === 'workout')
  igual([w.listo, fw.tipo, fw.chat, fw.tecnica, fw.plantilla_id, fw.programa_guardado_id], [true, 'pago_unico', false, false, 't-w', null], 'un workout es pago único y sin chat ni técnica, aunque se pida otra cosa')
  const c = sc(await tools.guardar_en_vitrina({ desde: 'Vinyasa 45', precio_mxn: 120 }))
  igual([datos.vitrina_planes.find((x: any) => x.contenido === 'clase').tipo, c.plan.vende], ['pago_unico', 'Clase'], 'una clase también')
  // Una rutina sí puede ser membresía o pago único, con chat.
  const r = sc(await tools.guardar_en_vitrina({ desde: 'Semana base', precio_mxn: 600, cobro: 'pago_unico', chat: true }))
  const fr = datos.vitrina_planes.find((x: any) => x.contenido === 'rutina')
  igual([fr.tipo, fr.chat, r.plan.incluye], ['pago_unico', true, ['chat']], 'una rutina respeta lo que se pidió')
  // La biblioteca: membresía, desde $100.
  const b = sc(await tools.guardar_en_vitrina({ biblioteca: true, precio_mxn: 250 }))
  const fb = datos.vitrina_planes.find((x: any) => x.contenido === 'biblioteca')
  igual([b.listo, fb.tipo, fb.titulo, fb.plantilla_id, fb.programa_guardado_id], [true, 'membresia', 'Todas mis clases', null, null], 'la biblioteca: membresía, sin fuente, con nombre por defecto')
  const sinClases = armar({ routine_templates: [] })
  cierto(/clases en Mis planes/.test(await falla(sinClases.tools.guardar_en_vitrina({ biblioteca: true, precio_mxn: 250 }))), 'una biblioteca sin clases: avisa')
  ok('guardar_en_vitrina: precio mínimo, sin inventar, ventana, workout y clase siempre pago único, biblioteca')
}

/* ======================= Cambiar una ficha ======================= */
{
  const { tools, datos } = armar()
  await tools.guardar_en_vitrina({ desde: 'Fuerza 8 semanas', precio_mxn: 600 })
  // Un borrador se cambia libremente.
  const c = sc(await tools.guardar_en_vitrina({ plan: 'fuerza-8-semanas', precio_mxn: 750, titulo: 'Fuerza pro', ventana_semanas: 2 }))
  igual([c.listo, datos.vitrina_planes[0].precio_mxn, datos.vitrina_planes[0].titulo, datos.vitrina_planes[0].ventana_semanas, datos.vitrina_planes[0].slug], [true, 750, 'Fuerza pro', 2, 'fuerza-8-semanas'], 'un borrador se cambia libremente, y su liga no cambia con el nombre')
  cierto(/mínimo es \$500/.test(await falla(tools.guardar_en_vitrina({ plan: 'Fuerza pro', precio_mxn: 100 }))), 'el precio mínimo también al cambiar')
  igual(datos.vitrina_planes[0].precio_mxn, 750, 'y no se cambió')

  // Uno publicado: sin permiso solo dice lo que cambiaría.
  await tools.publicar_en_vitrina({ plan: 'fuerza-8-semanas', confirmado: true })
  const antes = JSON.stringify(datos.vitrina_planes)
  const sin = sc(await tools.guardar_en_vitrina({ plan: 'fuerza-8-semanas', precio_mxn: 900 }))
  igual([sin.guardado, sin.motivo, sin.cambiaria.precio_mxn], [false, 'falta_confirmacion', 900], 'un plan ya publicado: no cambia sin confirmado')
  cierto(/AL MOMENTO/.test(sin.ya_esta_a_la_venta), 'y dice que se vería al momento')
  igual(JSON.stringify(datos.vitrina_planes), antes, 'sin escribir nada')
  const con = sc(await tools.guardar_en_vitrina({ plan: 'fuerza-8-semanas', precio_mxn: 900, confirmado: true }))
  igual([con.listo, datos.vitrina_planes[0].precio_mxn], [true, 900], 'con confirmado, sí')
  cierto(/ya se ve en su página/.test(con.aviso), 'y avisa que ya se ve')
  cierto(/No encontré/.test(await falla(tools.guardar_en_vitrina({ plan: 'nada de esto', precio_mxn: 600 }))), 'un plan que no existe: avisa')
  ok('guardar_en_vitrina: cambiar un borrador es libre; uno publicado pide confirmación')
}

/* ======================= Publicar, retirar y borrar ======================= */
{
  const { tools, datos } = armar({}, false)
  await tools.guardar_en_vitrina({ desde: 'Fuerza 8 semanas', precio_mxn: 600 })
  // Sin confirmación no publica nada.
  const vista = sc(await tools.publicar_en_vitrina({ plan: 'Fuerza 8 semanas' }))
  igual([vista.publicado, vista.motivo, vista.liga_publica], [false, 'falta_confirmacion', 'https://training-program-kappa.vercel.app/@andres/fuerza-8-semanas'], 'sin confirmado: no publica y enseña lo que pasaría, con su liga')
  cierto(/PÚBLICO/.test(vista.va_a_pasar) && /Pronto/.test(vista.va_a_pasar), 'y avisa que será público y que los cobros están cerrados')
  igual(datos.vitrina_planes[0].estado, 'borrador', 'sigue siendo borrador')
  const pub = sc(await tools.publicar_en_vitrina({ plan: 'Fuerza 8 semanas', confirmado: true }))
  igual([pub.listo, pub.publicado, pub.version, pub.cobros_abiertos, datos.vitrina_planes[0].estado], [true, true, 1, false, 'publicado'], 'con confirmado, publica')
  cierto(/Pronto/.test(pub.nota), 'y dice que el botón de comprar dirá «Pronto»')
  // Publicar de nuevo: una versión nueva.
  const otra = sc(await tools.publicar_en_vitrina({ plan: 'fuerza-8-semanas' }))
  cierto(/versión NUEVA/.test(otra.va_a_pasar), 'volver a publicar dice que es una versión nueva')
  igual(sc(await tools.publicar_en_vitrina({ plan: 'fuerza-8-semanas', confirmado: true })).version, 2, 'y la hace')

  // Ver.
  const v = sc(await tools.ver_mi_vitrina({}))
  igual([v.total, v.cobros_abiertos, v.planes[0].estado, v.planes[0].sale_de, v.planes[0].liga_publica], [1, false, 'publicado', 'Fuerza 8 semanas', 'https://training-program-kappa.vercel.app/@andres/fuerza-8-semanas'], 'ver_mi_vitrina: estado, de dónde sale y su liga')
  cierto(/Pronto/.test(v.nota), 'y la nota de los cobros')
  igual(sc(await tools.ver_mi_vitrina({ estado: 'borrador' })).total, 0, 'filtra por estado')

  // Retirar.
  cierto(/No encontré/.test(await falla(armar().tools.retirar_de_vitrina({ plan: 'x' }))), 'un plan que no existe no se retira')
  const sinOk = sc(await tools.retirar_de_vitrina({ plan: 'fuerza-8-semanas' }))
  igual([sinOk.retirado, sinOk.motivo, datos.vitrina_planes[0].estado], [false, 'falta_confirmacion', 'publicado'], 'retirar sin confirmado: no lo retira')
  cierto(/conserva hasta que deje de pagar/.test(sinOk.va_a_pasar), 'y dice qué pasa con quien ya paga')
  const ret = sc(await tools.retirar_de_vitrina({ plan: 'fuerza-8-semanas', confirmado: true }))
  igual([ret.listo, datos.vitrina_planes[0].estado], [true, 'retirado'], 'con confirmado, lo retira')
  cierto(/no está publicado/.test(await falla(tools.retirar_de_vitrina({ plan: 'fuerza-8-semanas', confirmado: true }))), 'retirar uno ya retirado: avisa')
  igual(sc(await tools.publicar_en_vitrina({ plan: 'fuerza-8-semanas', confirmado: true })).listo, true, 'un retirado se puede volver a publicar')

  // Borrar: solo lo que nunca se publicó.
  await tools.guardar_en_vitrina({ desde: 'Piernas A', precio_mxn: 150 })
  cierto(/ya se publicó alguna vez/.test(await falla(tools.borrar_borrador_de_vitrina({ plan: 'fuerza-8-semanas' }))), 'uno publicado alguna vez no se borra')
  const b = sc(await tools.borrar_borrador_de_vitrina({ plan: 'Piernas A' }))
  igual([b.listo, datos.vitrina_planes.length], [true, 1], 'un borrador sí se borra')
  const cobros = armar({}, true)
  await cobros.tools.guardar_en_vitrina({ desde: 'Fuerza 8 semanas', precio_mxn: 600 })
  const abiertos = sc(await cobros.tools.publicar_en_vitrina({ plan: 'Fuerza 8 semanas' }))
  cierto(/lo puede comprar/.test(abiertos.va_a_pasar), 'con los cobros abiertos, dice que lo pueden comprar')
  // La base dice que no: el mensaje llega tal cual.
  const sinClases = armar({ routine_templates: [] })
  cierto(/clases en «Mis planes»|clases en Mis planes/.test(await falla(sinClases.tools.guardar_en_vitrina({ biblioteca: true, precio_mxn: 250 }))), 'lo que la base no deja, se avisa con sus palabras')
  ok('publicar, retirar y borrar: nada sin confirmado, versión nueva, liga, cobros cerrados y abiertos, solo se borra lo que nunca se publicó')
}

console.log(`\nTodo bien: ${n} grupos de pruebas de la vitrina`)
