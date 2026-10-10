import { useMemo, useState } from 'react';
import { Loader2, MessageCircle } from 'lucide-react';
import { T, FONT, oficioCorto } from '@/lib/theme';
import { usePerfilDeLaVista } from '@/contexts/VistaContext';
import { useMensajes } from '@/contexts/MensajesContext';
import Bandeja from '@/features/mensajes/Bandeja';
import { llaveDe } from '@/features/mensajes/formato';
import Conversacion from '@/features/mensajes/Conversacion';
import PantallaDeChat from '@/features/mensajes/PantallaDeChat';

/* «MENSAJES» del atleta (la pestaña de abajo): la lista de las personas con quien habla (su coach y cada profesional de su equipo, una conversación con cada uno)
   y, al tocar una, la conversación. Andrés, 10 oct 2026: «chat completo atleta ↔ coach y una conversación con cada profesional de su equipo».

   Los mensajes son de la CUENTA que entró: un coach que abre la app de su atleta en «Ver como» no los lee. */

function Mensaje({ icono: Icono = MessageCircle, titulo, texto }) {
  return (
    <div style={{ padding: '72px 24px 120px', maxWidth: 560, margin: '0 auto', textAlign: 'center' }}>
      <div style={{ width: 76, height: 76, borderRadius: 24, background: T.accentBg, color: T.accent, display: 'grid', placeItems: 'center', margin: '0 auto 20px' }}>
        <Icono size={34} />
      </div>
      <div style={{ fontSize: 21, fontWeight: 800, color: T.text, letterSpacing: -0.3 }}>{titulo}</div>
      {texto && <div style={{ fontSize: 14.5, color: T.text2, marginTop: 10, lineHeight: 1.6 }}>{texto}</div>}
    </div>
  );
}

export default function MensajesDelAtleta() {
  const { uid, filas, cargando, error } = useMensajes();
  const { perfil, soloLectura } = usePerfilDeLaVista();
  const [abierta, setAbierta] = useState(null);
  const mias = useMemo(() => filas.filter((f) => f.soy_atleta), [filas]);
  const etiquetaDe = (f) => (f.profesional_id === perfil?.coach_id ? 'Tu coach' : (oficioCorto(f.otro_profesion) || 'Tu equipo'));
  const fila = abierta ? mias.find((f) => llaveDe(f) === abierta) : null;

  if (soloLectura) return <Mensaje titulo="Mensajes" texto="Los mensajes son de cada persona: aquí no se ven los de este atleta." />;
  if (cargando && mias.length === 0) {
    return <div role="status" style={{ padding: 80, display: 'flex', justifyContent: 'center', gap: 8, color: T.text2, fontWeight: 600, fontFamily: FONT }}><Loader2 size={18} className="spin" /> Cargando…</div>;
  }
  if (error && mias.length === 0) return <Mensaje titulo="No se pudieron cargar" texto={error} />;
  if (mias.length === 0) {
    return <Mensaje titulo="Mensajes" texto="Cuando tengas un coach o un equipo que te atienda, aquí hablarás con ellos." />;
  }

  return (
    <div style={{ padding: '24px 16px 130px', maxWidth: 560, margin: '0 auto', fontFamily: FONT }}>
      <h1 style={{ margin: '0 4px 16px', fontSize: 28, fontWeight: 800, letterSpacing: -0.6, color: T.text }}>Mensajes</h1>
      <Bandeja filas={mias} uid={uid} abierta={abierta} alAbrir={(f) => setAbierta(llaveDe(f))} etiquetaDe={etiquetaDe} />
      {fila && (
        <PantallaDeChat>
          <Conversacion key={abierta} fila={fila} uid={uid} etiqueta={etiquetaDe(fila)} onVolver={() => setAbierta(null)} conMargenSuperior />
        </PantallaDeChat>
      )}
    </div>
  );
}
