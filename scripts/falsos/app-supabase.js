/* El `@/lib/supabase` de la app, de mentiras, para las pruebas de Node que cargan componentes con Vite (`scripts/prueba-marcador-al-abrir.mjs`). Cada llamada
   la contesta lo que la prueba ponga en `globalThis.__baseFalsa`: `{ lee(tabla, filtros) → promesa de { data, error, status }, rpc(fn, args) → igual }`.
   Así la prueba decide CUÁNDO llega cada respuesta (las carreras del arranque son de orden, no de datos). Solo para pruebas. */
const base = () => globalThis.__baseFalsa;

function consulta(tabla) {
  const filtros = {};
  const q = {
    select: () => q,
    eq: (k, v) => { filtros[k] = v; return q; },
    order: () => q,
    limit: () => q,
    maybeSingle: () => base().lee(tabla, filtros),
    then: (ok, mal) => base().lee(tabla, filtros).then(ok, mal),
  };
  return q;
}

export const supabase = {
  from: (tabla) => consulta(tabla),
  rpc: (fn, args) => base().rpc(fn, args),
  auth: {
    getSession: async () => ({ data: { session: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
  },
};
