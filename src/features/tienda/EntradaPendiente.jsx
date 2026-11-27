import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import HojaFlotante from '@/components/HojaFlotante';
import CuandoEmpiezas from './CuandoEmpiezas';

/* «¿CUÁNDO EMPIEZAS?» PENDIENTE (encargo «Compra y dinero», 26 nov 2026). Si quien compró cerró sin elegir cuándo empieza, la pantalla sale al abrir su plan en la app.
   Una sola por vez (la compra más vieja sin elegir); si la cierra, vuelve a salir la próxima vez que abra la app. */
export default function EntradaPendiente({ userId, alElegir }) {
  const [compra, setCompra] = useState(null);
  useEffect(() => {
    if (!userId) return undefined;
    let vivo = true;
    supabase.from('compras').select('id, vitrina_planes(titulo)').eq('atleta_id', userId).in('estado', ['activa', 'gracia']).is('entrada_elegida_en', null)
      .order('creada_en', { ascending: true }).limit(1)
      .then(({ data }) => { if (vivo && data?.[0]) setCompra(data[0]); });
    return () => { vivo = false; };
  }, [userId]);
  if (!compra) return null;
  return (
    <HojaFlotante titulo={compra.vitrina_planes?.titulo ?? 'Tu plan'} onCerrar={() => setCompra(null)} ancho={480}>
      <CuandoEmpiezas compraId={compra.id} alListo={() => { setCompra(null); alElegir?.(); }} />
    </HojaFlotante>
  );
}
