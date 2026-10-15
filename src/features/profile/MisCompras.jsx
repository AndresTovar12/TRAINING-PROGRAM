import { useCallback, useEffect, useState } from 'react';
import { Loader2, ShoppingBag } from 'lucide-react';
import { comprasDeMiCuenta, cancelaMembresia, pideReembolso } from '@/lib/miDineroApi';
import { diasDeGarantia, estadoDeCompra, puedeCancelar, separaCompras } from '@/lib/compras';
import { useConfirmacion } from '@/components/Confirmacion';
import { Aviso, Chip, boton, pesos, tarjeta, titulo } from '@/features/profile/piezas';
import { T, KP } from '@/lib/theme';

/* «COMPRAS» (atleta) en Mi perfil (15 oct 2026). Andrés: «dónde administra un usuario las suscripciones que tiene». Aquí ve lo que compró, hasta cuándo lo tiene pagado,
   cancela la renovación (el plan sigue hasta el fin del periodo) y, dentro de los 7 días de la primera compra, pide que le devuelvan su dinero. */

function Compra({ c, onCambio }) {
  const pregunta = useConfirmacion();
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const e = estadoDeCompra(c);
  const garantia = diasDeGarantia(c);

  async function cancela() {
    const va = await pregunta({
      titulo: '¿Cancelar tu membresía?',
      detalle: `No se vuelve a cobrar. Sigues con tu plan${c.periodo_hasta ? ` hasta el ${new Date(c.periodo_hasta).toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })}` : ' hasta el fin de lo que ya pagaste'}.`,
      confirmar: 'Sí, cancelar',
      peligro: true,
    });
    if (!va) return;
    await corre('cancelar', () => cancelaMembresia(c.compra_id));
  }

  async function reembolsa() {
    const va = await pregunta({
      titulo: '¿Pedir tu reembolso?',
      detalle: 'Te devolvemos lo que pagaste y se cierra tu membresía: pierdes el acceso al plan al momento.',
      confirmar: 'Sí, devolver mi dinero',
      peligro: true,
    });
    if (!va) return;
    await corre('reembolso', () => pideReembolso(c.compra_id));
  }

  async function corre(que, accion) {
    setBusy(que); setError('');
    try {
      await accion();
      await onCambio();
    } catch (err) {
      setError(err.codigo === 'NO_DISPONIBLE' ? 'Esto se activa muy pronto. Si lo necesitas ya, escríbenos a contacto@traininglabapp.com.' : err.message);
    } finally {
      setBusy('');
    }
  }

  return (
    <div style={tarjeta}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15.5, fontWeight: 800, color: T.text, overflowWrap: 'anywhere' }}>{c.titulo}</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: T.text2, marginTop: 2, overflowWrap: 'anywhere' }}>
            {c.vendedor_nombre || c.vendedor_usuario ? `de ${c.vendedor_nombre || c.vendedor_usuario}` : ''}{c.precio_mxn ? ` · ${pesos(c.precio_mxn)}${c.tipo === 'membresia' ? ' al mes' : ''}` : ''}
          </div>
        </div>
        <Chip tono={e.tono}>{e.texto}</Chip>
      </div>
      {e.detalle && <div style={{ fontSize: 13.5, fontWeight: 600, color: T.text2, marginTop: 9, lineHeight: 1.45 }}>{e.detalle}</div>}
      {(puedeCancelar(c) || garantia > 0) && (
        <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', marginTop: 12 }}>
          {puedeCancelar(c) && (
            <button type="button" style={boton(false, !!busy)} disabled={!!busy} onClick={cancela}>
              {busy === 'cancelar' ? <Loader2 size={15} className="spin" /> : null} Cancelar membresía
            </button>
          )}
          {garantia > 0 && (
            <button type="button" style={boton(false, !!busy)} disabled={!!busy} onClick={reembolsa}>
              {busy === 'reembolso' ? <Loader2 size={15} className="spin" /> : null} Pedir reembolso
            </button>
          )}
        </div>
      )}
      {garantia > 0 && <div style={{ fontSize: 12.5, fontWeight: 600, color: T.text3, marginTop: 8 }}>Garantía: te quedan {garantia} día{garantia === 1 ? '' : 's'} para pedir que te devolvamos tu dinero.</div>}
      {error && <div style={{ marginTop: 10 }}><Aviso tono="malo" role="alert">{error}</Aviso></div>}
    </div>
  );
}

export default function MisCompras() {
  const [lista, setLista] = useState(undefined); // undefined = cargando
  const [error, setError] = useState('');

  const lee = useCallback(async () => {
    try { setLista(await comprasDeMiCuenta()); setError(''); } catch (e) { setError(e.message || 'No se pudieron leer tus compras.'); setLista([]); }
  }, []);
  useEffect(() => { lee(); }, [lee]);

  if (lista === undefined) return <div style={{ display: 'grid', placeItems: 'center', padding: 30 }}><Loader2 size={22} className="spin" color={T.text2} /></div>;
  const { vigentes, historial } = separaCompras(lista);

  return (
    <>
      {error && <Aviso tono="malo" role="alert">{error}</Aviso>}
      {!lista.length && !error && (
        <div style={{ ...tarjeta, textAlign: 'center', padding: '30px 18px' }}>
          <ShoppingBag size={26} color={T.text3} />
          <div style={{ fontSize: 15, fontWeight: 800, color: T.text, marginTop: 10 }}>Todavía no compras nada</div>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: T.text2, marginTop: 5, lineHeight: 1.45 }}>Cuando compres un plan, aquí lo ves, cancelas su renovación o pides tu reembolso.</div>
        </div>
      )}
      {vigentes.length > 0 && (
        <div>
          <div style={titulo}>Tus planes</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{vigentes.map((c) => <Compra key={c.compra_id} c={c} onCambio={lee} />)}</div>
        </div>
      )}
      {historial.length > 0 && (
        <div>
          <div style={titulo}>Historial</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{historial.map((c) => <Compra key={c.compra_id} c={c} onCambio={lee} />)}</div>
        </div>
      )}
      <div style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.5, color: KP.ink3 }}>
        Los cobros los hace Stripe y los recibos te llegan por correo. ¿Algo no cuadra? Escríbenos a contacto@traininglabapp.com.
      </div>
    </>
  );
}
