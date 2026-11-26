/* ENVÍOS POR SPEI (encargo «Compra y dinero», 26 nov 2026). Lo de iPhone le llega al coach por SPEI: Stripe en México no deja meter dinero a la cuenta de la plataforma,
   así que no se puede mandar por Stripe. El proveedor real (STP, un banco con API…) lo elige Andrés después; mientras, todo corre en MODO DE PRUEBA:
   se simula el envío y su resultado, sin mover dinero. Copia idéntica en `supabase/functions/mi-dinero/` (la vigila `scripts/compartir-con-mcp.mjs`).

   Modo de prueba:
     · una CLABE que termina en 0000 simula un envío RECHAZADO por el banco (para probar «No llegó»);
     · cualquier otra llega el siguiente día hábil (se ve «Llegó» al revisarlo después de esa fecha). */

const sumaDiasHabiles = (desde, n) => {
  const d = new Date(Date.UTC(desde.getUTCFullYear(), desde.getUTCMonth(), desde.getUTCDate()));
  let faltan = n;
  while (faltan > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) faltan -= 1;
  }
  return d.toISOString().slice(0, 10);
};

/**
 * Manda `monto` pesos a `clabe`. `referencia`: la del retiro (máx. 40). Devuelve `{ id, estado: 'enviado', llega_estimado }`; si el envío no sale, lanza error.
 * `modo`: 'prueba' (simula) | 'real' (aún no hay proveedor: lanza error).
 */
export async function enviaSpei({ clabe, monto, referencia }, { modo = 'prueba', ahora = new Date() } = {}) {
  if (!/^\d{18}$/.test(String(clabe ?? ''))) throw new Error('CLABE inválida.');
  if (!(Number(monto) > 0)) throw new Error('Monto inválido.');
  if (modo !== 'prueba') throw new Error('Los envíos por SPEI todavía no tienen proveedor.');
  const ref = String(referencia ?? '').slice(0, 40);
  return { id: `spei_prueba_${ref || Date.now().toString(36)}`, estado: 'enviado', llega_estimado: sumaDiasHabiles(ahora, 1) };
}

/** Cómo va un envío. En prueba: 'fallo' si la CLABE termina en 0000; 'llego' si ya pasó su fecha; si no, 'enviado'. */
export function revisaEnvioSpei({ clabe, llega_estimado: llega }, { modo = 'prueba', ahora = new Date() } = {}) {
  if (modo !== 'prueba') return { estado: 'enviado' };
  if (String(clabe ?? '').endsWith('0000')) return { estado: 'fallo', motivo: 'El banco rechazó el envío (prueba).' };
  return { estado: llega && ahora.toISOString().slice(0, 10) >= llega ? 'llego' : 'enviado' };
}
