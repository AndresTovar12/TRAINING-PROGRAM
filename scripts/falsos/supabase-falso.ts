/* Un «Supabase» de mentiras para probar las Edge Functions con `deno run` (sin red ni base): tablas en memoria en `globalThis.__bd` y las llamadas que usan las funciones
   (`from().select().eq().in().not().order().limit().maybeSingle()`, `update`, `delete`, `auth.getUser`, `auth.admin.deleteUser`). Solo para pruebas. */
// deno-lint-ignore-file no-explicit-any
type Fila = Record<string, any>

class Consulta {
  private filtros: Array<(f: Fila) => boolean> = []
  private accion: 'select' | 'update' | 'delete' | 'insert' = 'select'
  private cambios: Fila = {}
  private soloCuenta = false
  constructor(private tabla: string) {}
  select(_c?: string, op?: { count?: string; head?: boolean }) { if (op?.head) this.soloCuenta = true; return this }
  update(c: Fila) { this.accion = 'update'; this.cambios = c; return this }
  insert(c: Fila) { this.accion = 'insert'; this.cambios = c; return this }
  is(k: string, v: any) { this.filtros.push((f) => (f[k] ?? null) === v); return this }
  gte(k: string, v: any) { this.filtros.push((f) => (f[k] ?? '') >= v); return this }
  delete() { this.accion = 'delete'; return this }
  eq(k: string, v: any) { this.filtros.push((f) => f[k] === v); return this }
  in(k: string, vs: any[]) { this.filtros.push((f) => vs.includes(f[k])); return this }
  not(k: string, op: string, v: any) { if (op === 'is') this.filtros.push((f) => (f[k] ?? null) !== v); return this }
  filter() { return this }
  order() { return this }
  limit() { return this }
  private ejecuta() {
    const filas: Fila[] = (globalThis as any).__bd.tablas[this.tabla] ?? ((globalThis as any).__bd.tablas[this.tabla] = [])
    const bd = (globalThis as any).__bd
    const aplican = filas.filter((f) => this.filtros.every((g) => g(f)))
    if (this.accion === 'insert') { filas.push({ ...this.cambios }); bd.registro.push(['insert', this.tabla, 1, this.cambios]); return { data: null, error: null } }
    if (this.accion === 'update') { aplican.forEach((f) => Object.assign(f, this.cambios)); bd.registro.push(['update', this.tabla, aplican.length, this.cambios]); return { data: null, error: null } }
    if (this.accion === 'delete') { bd.tablas[this.tabla] = filas.filter((f) => !aplican.includes(f)); bd.registro.push(['delete', this.tabla, aplican.length]); return { data: null, error: null } }
    return this.soloCuenta ? { data: null, count: aplican.length, error: null } : { data: aplican.map((f) => ({ ...f })), error: null }
  }
  maybeSingle() { const r: any = this.ejecuta(); return Promise.resolve({ data: r.data?.[0] ?? null, error: r.error }) }
  single() { return this.maybeSingle() }
  then(ok: any, no: any) { return Promise.resolve(this.ejecuta()).then(ok, no) }
}

export function createClient() {
  const bd = () => (globalThis as any).__bd
  return {
    from: (t: string) => new Consulta(t),
    auth: {
      getUser: (token: string) => Promise.resolve({ data: { user: bd().usuarios[token] ?? null }, error: bd().usuarios[token] ? null : new Error('x') }),
      admin: { getUserById: (id: string) => Promise.resolve({ data: { user: bd().correos?.[id] ? { id, email: bd().correos[id] } : null }, error: null }), deleteUser: (id: string) => { bd().registro.push(['deleteUser', id]); return Promise.resolve({ error: bd().falloAlBorrar ? new Error('x') : null }) } },
    },
    storage: { from: () => ({}) },
  }
}
