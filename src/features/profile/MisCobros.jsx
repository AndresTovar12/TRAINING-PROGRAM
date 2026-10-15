import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, Loader2, Wallet } from 'lucide-react';
import { cobrosDeMiCuenta, conectaCobros } from '@/lib/miDineroApi';
import { useLugares } from '@/features/admin/useLugares';
import { etiquetaDeLugares } from '@/lib/limiteDeAtletas';
import { useAuth } from '@/contexts/AuthContext';
import { Aviso, Chip, boton, pesos, tarjeta, titulo } from '@/features/profile/piezas';
import { T } from '@/lib/theme';

/* «COBROS» (profesional) en Mi perfil (15 oct 2026). Andrés: lo mismo que el atleta, y además su cuenta de cobro: si Stripe está conectado, cuánto ha vendido, cuándo le depositan.
   El profesional conecta su cuenta con Stripe (sus datos y su banco los pide Stripe, nunca la app) y aquí ve cómo va. Todo lo de Stripe se enciende con sus llaves: antes dice «Pronto». */

function Dato({ etiqueta, valor, chico }) {
  return (
    <div style={{ ...tarjeta, padding: '12px 13px' }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: T.text3, textTransform: 'uppercase', letterSpacing: 0.5 }}>{etiqueta}</div>
      <div style={{ fontSize: chico ? 15 : 20, fontWeight: 800, color: T.text, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{valor}</div>
    </div>
  );
}

export default function MisCobros() {
  const { profile } = useAuth();
  const lugares = useLugares();
  const [r, setR] = useState(undefined);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  const lee = useCallback(async () => {
    try { setR(await cobrosDeMiCuenta()); setError(''); } catch (e) { setError(e.message || 'No se pudieron leer tus cobros.'); setR({}); }
  }, []);
  useEffect(() => { lee(); }, [lee]);

  async function abre(accion) {
    setBusy(accion); setError('');
    try {
      const { url } = await conectaCobros(accion);
      if (url) window.location.assign(url);
    } catch (e) {
      setError(e.codigo === 'NO_DISPONIBLE' ? 'Los cobros se activan muy pronto. Te avisamos cuando puedas conectar tu cuenta.' : e.message);
    } finally {
      setBusy('');
    }
  }

  if (r === undefined) return <div style={{ display: 'grid', placeItems: 'center', padding: 30 }}><Loader2 size={22} className="spin" color={T.text2} /></div>;
  const cuenta = r.cuenta ?? null;
  const lista = !!(cuenta?.onboarding_completo && cuenta?.cobros_ok && cuenta?.depositos_ok);
  const pendientes = Array.isArray(cuenta?.requisitos_pendientes) ? cuenta.requisitos_pendientes.length : 0;
  const comision = Math.round(Number(r.comision_actual ?? 0.2) * 1000) / 10;

  return (
    <>
      {profile?.vitrina_suspendida && <Aviso tono="aviso">Tu vitrina está suspendida: tus planes no se ven ni se venden por ahora. Escríbenos a contacto@traininglabapp.com.</Aviso>}
      {error && <Aviso tono="malo" role="alert">{error}</Aviso>}

      <div>
        <div style={titulo}>Tu cuenta de cobro</div>
        <div style={tarjeta}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Wallet size={20} color={T.text2} />
              <span style={{ fontSize: 15, fontWeight: 800, color: T.text }}>Cobros con Stripe</span>
            </div>
            <Chip tono={lista ? 'ok' : cuenta ? 'aviso' : 'neutro'}>{lista ? 'Lista' : cuenta ? 'Falta terminar' : 'Sin conectar'}</Chip>
          </div>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: T.text2, marginTop: 9, lineHeight: 1.45 }}>
            {lista
              ? `Cobras y te depositan${cuenta.depositos ? ` en ${cuenta.depositos}` : ''}.`
              : cuenta
                ? `Stripe todavía necesita algunos datos${pendientes ? ` (${pendientes})` : ''} para poder depositarte.`
                : 'Conecta tu cuenta para vender tus planes. Tus datos y tu banco los pide Stripe, no Training Lab.'}
          </div>
          <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', marginTop: 12 }}>
            {!lista && (
              <button type="button" style={boton(true, !!busy)} disabled={!!busy} onClick={() => abre('conectar')}>
                {busy === 'conectar' ? <Loader2 size={15} className="spin" /> : null} {cuenta ? 'Terminar de conectar' : 'Conectar mis cobros'}
              </button>
            )}
            {cuenta && (
              <button type="button" style={boton(false, !!busy)} disabled={!!busy} onClick={() => abre('panel')}>
                {busy === 'panel' ? <Loader2 size={15} className="spin" /> : <ExternalLink size={15} />} Ver mis depósitos
              </button>
            )}
          </div>
        </div>
      </div>

      <div>
        <div style={titulo}>Tus ventas</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
          <Dato etiqueta="Este mes (te quedas)" valor={pesos(r.ventas_mes_neto)} />
          <Dato etiqueta="En total (te quedas)" valor={pesos(r.ventas_total_neto)} />
          <Dato etiqueta="Compradores activos" valor={r.compradores_activos ?? 0} />
          <Dato etiqueta="Comisión de Training Lab" valor={`${comision} %`} />
        </div>
      </div>

      {(r.ultimos ?? []).length > 0 && (
        <div>
          <div style={titulo}>Últimos cobros</div>
          <div style={{ ...tarjeta, padding: 0 }}>
            {r.ultimos.map((u, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderTop: i ? `1px solid ${T.border}` : 'none' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: T.text, overflowWrap: 'anywhere' }}>{u.titulo}</div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: T.text3 }}>{new Date(u.fecha).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}{u.estado !== 'cobrado' ? ` · ${u.estado}` : ''}</div>
                </div>
                <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  <div style={{ fontSize: 14.5, fontWeight: 800, color: u.estado === 'cobrado' ? T.text : T.text3 }}>{pesos(u.parte_coach)}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: T.text3 }}>de {pesos(u.bruto)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {(r.ultimos ?? []).length === 0 && <Aviso tono="neutro">Cuando vendas un plan, aquí ves cada cobro, lo que te quedas y la comisión.</Aviso>}

      {lugares && !lugares.ilimitado && (
        <div>
          <div style={titulo}>Tus atletas a mano</div>
          <div style={tarjeta}>
            <div style={{ fontSize: 15, fontWeight: 800, color: T.text }}>{etiquetaDeLugares(lugares)} <span style={{ fontWeight: 600, color: T.text2 }}>atletas</span></div>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.text2, marginTop: 5, lineHeight: 1.45 }}>Quien compra un plan tuyo no cuenta. Para más lugares, desde «Agregar atleta».</div>
          </div>
        </div>
      )}
    </>
  );
}
