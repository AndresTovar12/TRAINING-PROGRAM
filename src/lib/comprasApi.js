import { supabase } from '@/lib/supabase';

/* LOS PLANES QUE EL ATLETA COMPRÓ, contra la Edge Function `programa-comprado`.

   El plan publicado de un coach solo lo puede leer su coach (la base lo impide). El atleta lo pide a esta función, que corre en el servidor y le devuelve su programa YA
   RECORTADO a la ventana que le toca (lo ya entrenado, hoy y un mes adelante; del resto, solo nombres). Ver `lib/ventana.js` y el diseño de monetización.

   Una compra devuelta es: { compra_id, estado, tipo, inicio, titulo, chat, tecnica, ventana_semanas, vendedor, programa }, y `programa` = { title, data, cursorInicial, resumen }
   (null mientras un personalizado no se entrega). Solo trae las compras de QUIEN ENTRÓ: quien ve la app de otra persona («Ver como») no recibe nada. */
export async function leeMisCompras() {
  /* Antes de despertar a la función (que tarda lo suyo la primera vez), se pregunta a la base —rápido— si esta persona tiene alguna compra viva. Casi nadie la tiene todavía:
     que todos abran la app esperando a una función que va a contestar «nada» no vale la pena. */
  const { data: sesion } = await supabase.auth.getSession();
  const uid = sesion?.session?.user?.id;
  if (!uid) return [];
  const { count, error: errCuenta } = await supabase.from('compras').select('id', { count: 'exact', head: true })
    .eq('atleta_id', uid).in('estado', ['activa', 'gracia', 'vencida', 'por_armar']);
  if (errCuenta) throw errCuenta;
  if (!count) return [];
  const { data, error } = await supabase.functions.invoke('programa-comprado', { body: {} });
  if (error) throw error;
  return Array.isArray(data?.compras) ? data.compras : [];
}
