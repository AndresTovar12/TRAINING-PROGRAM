// deno-lint-ignore-file no-explicit-any
// Lo que comparten las pruebas del conector de IA (supabase/functions/mcp): comparar, y una base en memoria que SÍ guarda, filtra y borra.

export const igual = (a: unknown, b: unknown, msg: string) => {
  const x = JSON.stringify(a)
  const y = JSON.stringify(b)
  if (x !== y) throw new Error(`${msg}\n   esperaba ${y}\n   salió    ${x}`)
}
export const cierto = (v: unknown, msg: string) => { if (!v) throw new Error(msg) }

/**
 * Una base en memoria. Las tablas de `MEMORIA` filtran de verdad (`eq`, `in`, `is`) y guardan, actualizan y borran; las demás devuelven lo que se les dio, sin filtrar.
 * `rpcs`: lo que contesta cada función de la base (`(args) => data`). `alInsertar`: lo que la base pondría sola (disparadores y valores por defecto) por tabla.
 */
export function baseEnMemoria(
  tablas: Record<string, any[]>,
  o: { memoria?: string[]; rpcs?: Record<string, (args: any, datos: Record<string, any[]>) => any>; alInsertar?: Record<string, (fila: any) => any> } = {},
) {
  const MEMORIA = o.memoria ?? ['routine_templates', 'programas_guardados', 'carpetas_planes', 'plans', 'user_app_state']
  const datos: Record<string, any[]> = {}
  for (const k of Object.keys(tablas)) datos[k] = structuredClone(tablas[k])
  const planesActualizados: any[] = []
  let contador = 0
  const db = {
    rpc: async (nombre: string, args: any = {}) => {
      if (o.rpcs?.[nombre]) {
        try { return { data: await o.rpcs[nombre](args, datos), error: null } } catch (e) { return { data: null, error: { message: e instanceof Error ? e.message : String(e) } } }
      }
      return { data: nombre === 'master_id' ? 'master-1' : null, error: null }
    },
    from: (tabla: string) => {
      const filas = () => (datos[tabla] ??= [])
      const real = MEMORIA.includes(tabla)
      let op: 'select' | 'insert' | 'update' | 'delete' = 'select'
      let carga: any = null
      const filtros: ((r: any) => boolean)[] = []
      let orden: { c: string; asc: boolean } | null = null
      let tope: number | null = null
      const afectadas = () => filas().filter((r) => filtros.every((f) => f(r)))
      const ejecutar = async () => {
        if (op === 'update' && tabla === 'plans') planesActualizados.push({ tabla, cambios: carga })
        if (!real) return { data: filas(), error: null }
        if (op === 'insert') {
          const base = { id: `id-nuevo-${++contador}`, created_at: '2026-10-13', updated_at: '2026-10-13', ...structuredClone(carga) }
          const fila = o.alInsertar?.[tabla] ? o.alInsertar[tabla](base) : base
          filas().push(fila)
          return { data: [fila], error: null }
        }
        if (op === 'update') { const a = afectadas(); a.forEach((r) => Object.assign(r, structuredClone(carga))); return { data: a.map((r) => structuredClone(r)), error: null } }
        if (op === 'delete') { const a = afectadas(); datos[tabla] = filas().filter((r) => !a.includes(r)); return { data: a, error: null } }
        let lista = afectadas()
        if (orden) lista = [...lista].sort((a, b) => ((a[orden!.c] ?? '') < (b[orden!.c] ?? '') ? -1 : (a[orden!.c] ?? '') > (b[orden!.c] ?? '') ? 1 : 0) * (orden!.asc ? 1 : -1))
        if (tope !== null) lista = lista.slice(0, tope)
        return { data: lista.map((r) => structuredClone(r)), error: null }
      }
      const q: any = {
        select: () => q, neq: () => q, filter: () => q, range: () => q,
        order: (c: string, o: any = {}) => { orden = { c, asc: o?.ascending !== false }; return q },
        limit: (k: number) => { tope = k; return q },
        gte: (c: string, v: any) => { if (real) filtros.push((r) => (r[c] ?? '') >= v); return q },
        lte: (c: string, v: any) => { if (real) filtros.push((r) => (r[c] ?? '') <= v); return q },
        lt: (c: string, v: any) => { if (real) filtros.push((r) => (r[c] ?? '') < v); return q },
        eq: (c: string, v: unknown) => { if (real) filtros.push((r) => (r[c] ?? null) === (v ?? null)); return q },
        in: (c: string, vs: unknown[]) => { if (real) filtros.push((r) => vs.includes(r[c])); return q },
        is: (c: string, v: unknown) => { if (real) filtros.push((r) => (r[c] ?? null) === v); return q },
        insert: (c: any) => { op = 'insert'; carga = c; return q },
        update: (c: any) => { op = 'update'; carga = c; return q },
        delete: () => { op = 'delete'; return q },
        single: async () => { const r = await ejecutar(); return r.data[0] ? { data: r.data[0], error: null } : { data: null, error: { message: 'no hay filas' } } },
        maybeSingle: async () => { const r = await ejecutar(); return { data: r.data[0] ?? null, error: null } },
        then: (ok: any, no: any) => ejecutar().then(ok, no),
      }
      return q
    },
  }
  return { db, datos, planesActualizados }
}
