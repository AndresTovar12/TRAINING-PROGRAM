import { useEffect, useState } from 'react';
import { useAviso } from '@/components/AvisoPasajero';
import { AVISO_CONECTA_RELOJ } from '@/lib/abreConectaReloj';
import { useReloj } from '@/lib/relojConectado';
import ConectaReloj from './ConectaReloj';

/* La pantalla de conectar el Apple Watch, para toda la app (fase 5): se abre con `abreConectaReloj(origen)` y al terminar dice, en un aviso corto, qué
   cambió (los textos del prototipo). */
const LISTO = {
  entreno: 'Listo. Desde tu próximo entreno, tus stickers llevan tu pulso.',
  chat: 'Listo. Tu coach ya ve tus entrenos.',
};

export default function ConectaRelojGlobal() {
  const [pedido, setPedido] = useState(null);
  const { avisa } = useAviso();
  const { reloj } = useReloj();
  useEffect(() => {
    const abre = (e) => setPedido({ origen: e.detail?.origen ?? 'dispositivos', reconectar: !!e.detail?.reconectar, vez: Date.now() });
    window.addEventListener(AVISO_CONECTA_RELOJ, abre);
    return () => window.removeEventListener(AVISO_CONECTA_RELOJ, abre);
  }, []);
  if (!pedido) return null;
  const alTerminar = (como) => {
    setPedido(null);
    if (como !== 'conectado') return;
    if (pedido.reconectar) { avisa('Listo en este iPhone. Tus entrenos siguen llegando.'); return; }
    avisa(LISTO[pedido.origen] ?? (reloj.emparejado ? 'Listo. Desde hoy, tus entrenos del reloj entran solos.' : 'Listo. Desde hoy, lo que otras apps guarden en Salud entra solo.'));
  };
  return <ConectaReloj key={pedido.vez} reconectar={pedido.reconectar} empezar={pedido.reconectar ? 'pedir' : 'intro'} alTerminar={alTerminar} />;
}
