/* LAS COMPRAS DE UNA PERSONA, dichas como se entienden (puro: sin imports, se prueba en node). Pestaña «Compras» de Mi perfil (15 oct 2026).

   Una compra que llega de `mis_compras_resumen` trae: estado (activa, gracia, vencida, por_armar, cancelada, reembolsada), tipo (membresia, personalizado…), `cancelada_en` (pidió cancelar la renovación),
   `periodo_hasta` (hasta cuándo tiene pagado), `pagado` y `primer_pago_en` (para la garantía de 7 días). Ver `supabase/functions/mi-dinero` y `reembolsar`. */

export const DIAS_DE_GARANTIA = 7;
const DIA_MS = 24 * 3600 * 1000;

const fecha = (iso) => (iso ? new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }) : '');

/** Qué decir de una compra: `{ texto, tono, detalle }`. `tono`: ok | aviso | malo | neutro. */
export function estadoDeCompra(c) {
  const hasta = fecha(c?.periodo_hasta);
  switch (c?.estado) {
    case 'activa':
      if (c.cancelada_en) return { texto: 'Cancelada', tono: 'aviso', detalle: hasta ? `Sigue hasta el ${hasta}; no se vuelve a cobrar.` : 'No se vuelve a cobrar.' };
      return { texto: 'Activa', tono: 'ok', detalle: c.tipo === 'membresia' && hasta ? `Se renueva el ${hasta}.` : (hasta ? `Pagada hasta el ${hasta}.` : '') };
    case 'gracia':
      return { texto: 'Pago pendiente', tono: 'aviso', detalle: 'No pudimos cobrar la renovación. Actualiza tu forma de pago para no perder el acceso.' };
    case 'vencida':
      return { texto: 'Vencida', tono: 'malo', detalle: hasta ? `Terminó el ${hasta}.` : 'Terminó.' };
    case 'por_armar':
      return { texto: 'Armando tu plan', tono: 'neutro', detalle: 'Tu entrenador está preparando tu plan personalizado.' };
    case 'cancelada':
      return { texto: 'Cancelada', tono: 'neutro', detalle: '' };
    case 'reembolsada':
      return { texto: 'Reembolsada', tono: 'neutro', detalle: 'Te devolvimos tu dinero.' };
    default:
      return { texto: c?.estado ?? '—', tono: 'neutro', detalle: '' };
  }
}

/** ¿Se le puede ofrecer «Cancelar membresía»? Solo una membresía activa que aún no pidió cancelar. */
export const puedeCancelar = (c) => c?.estado === 'activa' && c?.tipo === 'membresia' && !c?.cancelada_en;

/** ¿Está dentro de la garantía de 7 días de su PRIMER cobro? (el servidor lo vuelve a revisar). */
export function dentroDeLaGarantia(c, ahora = Date.now()) {
  if (!['activa', 'gracia'].includes(c?.estado) || !(Number(c?.pagado) > 0) || !c?.primer_pago_en) return false;
  return (ahora - new Date(c.primer_pago_en).getTime()) / DIA_MS <= DIAS_DE_GARANTIA;
}

/** Cuántos días le quedan de garantía (redondeado hacia arriba), o 0. */
export function diasDeGarantia(c, ahora = Date.now()) {
  if (!dentroDeLaGarantia(c, ahora)) return 0;
  return Math.max(1, Math.ceil(DIAS_DE_GARANTIA - (ahora - new Date(c.primer_pago_en).getTime()) / DIA_MS));
}

/** Las que siguen vivas arriba y el historial abajo. */
export function separaCompras(lista) {
  const vivas = ['activa', 'gracia', 'por_armar'];
  const arr = Array.isArray(lista) ? lista : [];
  return { vigentes: arr.filter((c) => vivas.includes(c.estado)), historial: arr.filter((c) => !vivas.includes(c.estado)) };
}
