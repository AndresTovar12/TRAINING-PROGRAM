import { useState } from 'react';
import { AlertCircle, RefreshCw, WifiOff } from 'lucide-react';
import HojaFlotante from '@/components/HojaFlotante';
import { Grupo, Fila, IconoDeFila } from '@/components/ui';
import { LT, FONT } from '@/lib/theme';

/* LO QUE PASA CON UN PLAN COMPRADO CUANDO NO ESTÁ AL DÍA (auditoría p9 y p10, 26 oct 2026).

   Antes, si la membresía vencía o el plan no lograba bajar (sin señal, servidor caído, sesión cerrada en otro aparato), el plan desaparecía de Home y de Entrenar sin una palabra. Ahora
   hay un renglón, igual que el de la biblioteca de clases («Membresía vencida · Renovar»):
     · plan VENCIDO  → «Tu membresía venció» y «Renovar» (abre la página de quien lo vende);
     · plan en GRACIA → «No pudimos cobrar tu renovación» y «Ver»;
     · el plan NO CARGÓ → «No pudimos cargar tus planes comprados» y «Reintentar».
   `porAtender`: [{ id, titulo, estado, vendedor, slug }] (lo arma `PlanContext`); `fallo`: si la lista de compras no bajó; `reintenta`: vuelve a pedirla. */

const CAJA = { textAlign: 'center', padding: '28px 12px', fontFamily: FONT };

function HojaDeRenovar({ compra, onCerrar }) {
  const v = compra.vendedor;
  const quien = v?.nombre || v?.usuario || 'tu entrenador';
  const enGracia = compra.estado === 'gracia';
  const liga = v?.usuario ? `/@${v.usuario}${compra.slug ? `/${compra.slug}` : ''}` : null;
  return (
    <HojaFlotante titulo={compra.titulo} subtitulo={`de ${quien}`} onCerrar={onCerrar}>
      <div style={CAJA}>
        <div style={{ fontSize: 17, fontWeight: 800, color: LT.text }}>{enGracia ? 'No pudimos cobrar tu renovación' : 'Tu membresía venció'}</div>
        <div style={{ fontSize: 14.5, fontWeight: 600, color: LT.text2, lineHeight: 1.5, margin: '8px auto 0', maxWidth: 320 }}>
          {enGracia
            ? `Revisa que tu tarjeta tenga fondos. Si el pago sigue sin pasar, tu membresía vence y dejas de ver el plan. Lo que ya anotaste se queda.`
            : `Para volver a ver tu plan, renuévalo desde la página de ${quien}. Lo que ya anotaste se queda.`}
        </div>
        {liga && (
          <a
            href={liga}
            style={{ display: 'inline-flex', alignItems: 'center', minHeight: 50, marginTop: 18, padding: '0 22px', borderRadius: 16, background: LT.blue, color: '#fff', fontWeight: 700, fontSize: 16, textDecoration: 'none' }}
          >
            {enGracia ? 'Ver el plan' : 'Renovar'}
          </a>
        )}
      </div>
    </HojaFlotante>
  );
}

export default function AvisosDeCompra({ porAtender = [], fallo = false, reintenta }) {
  const [abierta, setAbierta] = useState(null);
  const [reintentando, setReintentando] = useState(false);
  if (!fallo && porAtender.length === 0) return null;

  async function vuelve() {
    setReintentando(true);
    try { await reintenta?.(); } finally { setReintentando(false); }
  }

  return (
    <>
      <Grupo>
        {fallo && (
          <Fila
            izquierda={<IconoDeFila><WifiOff size={18} /></IconoDeFila>} texto="No pudimos cargar tus planes comprados" detalle="Revisa tu conexión e inténtalo otra vez."
            valor={reintentando ? 'Cargando…' : 'Reintentar'} onClick={reintentando ? undefined : vuelve}
          />
        )}
        {porAtender.map((c) => (
          <Fila
            key={c.id} izquierda={<IconoDeFila>{c.estado === 'gracia' ? <AlertCircle size={18} /> : <RefreshCw size={18} />}</IconoDeFila>} texto={c.titulo}
            detalle={c.estado === 'gracia' ? 'No pudimos cobrar tu renovación' : 'Tu membresía venció'}
            valor={c.estado === 'gracia' ? 'Ver' : 'Renovar'} onClick={() => setAbierta(c)}
          />
        ))}
      </Grupo>
      {abierta && <HojaDeRenovar compra={abierta} onCerrar={() => setAbierta(null)} />}
    </>
  );
}
