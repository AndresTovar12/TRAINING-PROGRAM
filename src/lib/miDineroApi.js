import { supabase } from '@/lib/supabase';
import { tokenDeAhora } from '@/lib/api';

/* EL DINERO DE UNA PERSONA en Mi perfil (15 oct 2026): sus compras (atleta) y sus cobros (profesional). Ver `supabase/functions/mi-dinero`, `reembolsar` y `lib/compras.js`.
   Está hecho para cuando se enciendan las llaves de Stripe: mientras no, lo que necesita a Stripe contesta `NO_DISPONIBLE` y la pantalla dice «Pronto». */

async function funcion(nombre, cuerpo) {
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${nombre}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: import.meta.env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${await tokenDeAhora()}` },
    body: JSON.stringify(cuerpo),
  }).catch(() => null);
  if (!res) throw new Error('No se pudo conectar. Revisa tu internet e inténtalo de nuevo.');
  const datos = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(datos?.error || 'No se pudo completar. Inténtalo de nuevo.'), { codigo: datos?.codigo });
  return datos;
}

/** Las compras de quien entró, con el nombre del plan y de quien lo vende. */
export async function comprasDeMiCuenta() {
  const { data, error } = await supabase.rpc('mis_compras_resumen');
  if (error) throw error;
  return data ?? [];
}

/** Cancela la renovación de una membresía (el plan sigue hasta el fin del periodo pagado). */
export const cancelaMembresia = (compraId) => funcion('mi-dinero', { accion: 'cancelar', compra_id: compraId });

/** Pide la devolución del primer cobro (garantía de 7 días). */
export const pideReembolso = (compraId) => funcion('reembolsar', { compra_id: compraId });

/** Lo de un profesional: su cuenta de cobro, lo que ha vendido y lo que se le deposita. */
export async function cobrosDeMiCuenta() {
  const { data, error } = await supabase.rpc('mis_cobros_resumen');
  if (error) throw error;
  return data ?? {};
}

/** `accion`: 'estado' (vuelve a leer a Stripe), 'conectar' (devuelve `url` para llenar sus datos) o 'panel' (devuelve `url` a su panel de Stripe). */
export const conectaCobros = (accion) => funcion('mi-dinero', { accion });
