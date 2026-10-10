import { useMemo, useState } from 'react';
import { Loader2, MessageCircle } from 'lucide-react';
import { T, KP, FONT } from '@/lib/theme';
import { useIsDesktop } from '@/lib/useViewport';
import { useMensajes } from '@/contexts/MensajesContext';
import Bandeja from '@/features/mensajes/Bandeja';
import { llaveDe } from '@/features/mensajes/formato';
import Conversacion from '@/features/mensajes/Conversacion';
import PantallaDeChat from '@/features/mensajes/PantallaDeChat';

/* «MENSAJES» del profesional (una pestaña del panel): sus atletas, la más reciente arriba, con «Sin leer» y «Por revisar».

   En la computadora la lista va a la izquierda y la conversación a la derecha, a la vez; en el teléfono, la lista y, al tocar una persona, la conversación a pantalla
   completa. Cada profesional ve solo SUS conversaciones: la del atleta con su coach y la del mismo atleta con su fisio son dos distintas. */

export default function MensajesDelCoach() {
  const { uid, filas, cargando, error } = useMensajes();
  const esCompu = useIsDesktop();
  const [abierta, setAbierta] = useState(null);
  const suyas = useMemo(() => filas.filter((f) => !f.soy_atleta), [filas]);
  const fila = abierta ? suyas.find((f) => llaveDe(f) === abierta) : null;

  if (cargando && suyas.length === 0) {
    return <div role="status" style={{ padding: 80, display: 'flex', justifyContent: 'center', gap: 8, color: T.text2, fontWeight: 600, fontFamily: FONT }}><Loader2 size={18} className="spin" /> Cargando…</div>;
  }

  const lista = (
    <Bandeja
      filas={suyas} uid={uid} abierta={abierta} alAbrir={(f) => setAbierta(llaveDe(f))} conFiltros
      vacio="Cuando tengas atletas, aquí hablarás con ellos."
    />
  );
  const titulo = <h1 style={{ margin: '0 0 16px', fontSize: 26, fontWeight: 800, letterSpacing: -0.5, color: T.text }}>Mensajes</h1>;
  const fallo = error && suyas.length === 0 && (
    <div role="alert" style={{ padding: '10px 12px', borderRadius: 12, background: KP.dangerSoft, color: KP.danger, fontSize: 13.5, fontWeight: 700, marginBottom: 12 }}>{error}</div>
  );

  if (!esCompu) {
    return (
      <div style={{ fontFamily: FONT }}>
        {titulo}{fallo}{lista}
        {fila && (
          <PantallaDeChat>
            <Conversacion key={abierta} fila={fila} uid={uid} onVolver={() => setAbierta(null)} conMargenSuperior />
          </PantallaDeChat>
        )}
      </div>
    );
  }
  return (
    <div style={{ fontFamily: FONT }}>
      {titulo}{fallo}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 380px) minmax(0, 1fr)', gap: 18, alignItems: 'start' }}>
        <div style={{ maxHeight: 'calc(100svh - 130px)', overflowY: 'auto', paddingBottom: 12 }}>{lista}</div>
        <div style={{ height: 'calc(100svh - 130px)', borderRadius: 22, overflow: 'hidden', border: `1px solid ${KP.line}`, boxShadow: KP.shCard, background: T.bg }}>
          {fila ? (
            <Conversacion key={abierta} fila={fila} uid={uid} />
          ) : (
            <div style={{ height: '100%', display: 'grid', placeItems: 'center', textAlign: 'center', color: T.text2, fontWeight: 600, fontSize: 15 }}>
              <div>
                <MessageCircle size={34} style={{ opacity: 0.5, marginBottom: 10 }} />
                <div>Elige a quién quieres escribirle.</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
