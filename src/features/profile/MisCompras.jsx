import { useCallback, useEffect, useState } from 'react';
import { Loader2, ShoppingBag } from 'lucide-react';
import { comprasDeMiCuenta, cancelaMembresia } from '@/lib/miDineroApi';
import { estadoDeCompra, proximoCobro, puedeCancelar, separaCompras } from '@/lib/compras';
import { useConfirmacion } from '@/components/Confirmacion';
import { useAviso } from '@/components/AvisoPasajero';
import HojaFlotante from '@/components/HojaFlotante';
import { Boton, Fila, Grupo, Pastilla, TarjetaHeroe } from '@/components/ui';
import { Aviso, pesos } from '@/features/profile/piezas';
import { FONT, KP } from '@/lib/theme';

/* «COMPRAS» (atleta) en Mi perfil (15 oct 2026). Andrés: «dónde administra un usuario las suscripciones que tiene». Aquí ve lo que compró, hasta cuándo lo tiene pagado,
   y cancela la renovación (el plan sigue hasta el fin del periodo). Sin reembolsos (Andrés, 26 oct 2026, como OnlyFans): un error de cobro lo devuelve el dueño a mano.
   Reestructura visual (15 oct 2026), como «Compras» de las capturas: tarjeta azul con lo activo y el próximo cobro, cada plan en un renglón (tocarlo abre su hoja con
   «Cancelar membresía») y «Pagos» abajo. */

const fechaCorta = (iso) => new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }).replace('.', '');
const quien = (c) => c.vendedor_nombre || c.vendedor_usuario || '';
const queEs = (c) => (c.tipo === 'membresia' ? 'membresía' : 'pago único');

/** La hoja de UNA compra: su estado, y cancelar la renovación si se puede. */
function HojaDeCompra({ c, onCerrar, onCambio }) {
  const pregunta = useConfirmacion();
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const e = estadoDeCompra(c);

  async function corre(que, accion) {
    setBusy(que); setError('');
    try {
      await accion();
      await onCambio();
      onCerrar();
    } catch (err) {
      setError(err.codigo === 'NO_DISPONIBLE' ? 'Esto se activa muy pronto. Si lo necesitas ya, escríbenos a contacto@traininglabapp.com.' : err.message);
    } finally {
      setBusy('');
    }
  }
  async function cancela() {
    const va = await pregunta({
      titulo: '¿Cancelar tu membresía?',
      detalle: `No se vuelve a cobrar. Sigues con tu plan${c.periodo_hasta ? ` hasta el ${new Date(c.periodo_hasta).toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })}` : ' hasta el fin de lo que ya pagaste'}.`,
      confirmar: 'Sí, cancelar', peligro: true,
    });
    if (va) await corre('cancelar', () => cancelaMembresia(c.compra_id));
  }

  return (
    <HojaFlotante titulo={c.titulo} subtitulo={quien(c) ? `de ${quien(c)}` : undefined} onCerrar={onCerrar} ancho={480}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontFamily: FONT }}>
        <Grupo>
          <Fila texto="Estado" derecha={<Pastilla tono={e.tono}>{e.texto}</Pastilla>} />
          <Fila texto="Precio" valor={c.precio_mxn ? `${pesos(c.precio_mxn)}${c.tipo === 'membresia' ? ' / mes' : ''}` : '—'} valorTono="neutro" />
          <Fila texto="Tipo" valor={queEs(c)} valorTono="neutro" />
        </Grupo>
        {e.detalle && <p style={{ margin: '0 6px', fontSize: 14.5, color: KP.ink2, lineHeight: 1.45 }}>{e.detalle}</p>}
        {error && <Aviso tono="malo" role="alert">{error}</Aviso>}
        {puedeCancelar(c) && <Boton tipo="secundario" ancho cargando={busy === 'cancelar'} deshabilitado={!!busy} onClick={cancela}>Cancelar membresía</Boton>}
      </div>
    </HojaFlotante>
  );
}

function FilaDeCompra({ c, onAbrir }) {
  const e = estadoDeCompra(c);
  const precio = c.tipo === 'membresia' ? `${pesos(c.precio_mxn)} / mes` : null;
  return (
    <Fila
      texto={c.titulo} detalle={[quien(c), queEs(c)].filter(Boolean).join(' · ')} onClick={onAbrir}
      valor={e.tono === 'ok' ? (precio ?? 'Para siempre') : null} valorTono={precio ? 'neutro' : 'ok'}
      derecha={e.tono !== 'ok' ? <Pastilla tono={e.tono}>{e.texto}</Pastilla> : undefined}
    />
  );
}

export default function MisCompras() {
  const { avisa } = useAviso();
  const [lista, setLista] = useState(undefined); // undefined = cargando
  const [error, setError] = useState('');
  const [abierta, setAbierta] = useState(null); // la compra cuya hoja está abierta
  const [verHistorial, setVerHistorial] = useState(false);

  const lee = useCallback(async () => {
    try { setLista(await comprasDeMiCuenta()); setError(''); } catch (e) { setError(e.message || 'No se pudieron leer tus compras.'); setLista([]); }
  }, []);
  useEffect(() => { lee(); }, [lee]);

  if (lista === undefined) return <div style={{ display: 'grid', placeItems: 'center', padding: 30 }}><Loader2 size={22} className="spin" color={KP.ink2} /></div>;
  const { vigentes, historial } = separaCompras(lista);
  const sigue = proximoCobro(vigentes);

  return (
    <>
      {error && <Aviso tono="malo" role="alert">{error}</Aviso>}
      {!lista.length && !error ? (
        <Grupo>
          <div style={{ textAlign: 'center', padding: '30px 18px', fontFamily: FONT }}>
            <ShoppingBag size={28} color={KP.ink3} />
            <div style={{ fontSize: 17, fontWeight: 800, color: KP.ink, marginTop: 10 }}>Todavía no compras nada</div>
            <div style={{ fontSize: 14, color: KP.ink2, marginTop: 5, lineHeight: 1.45 }}>Cuando compres un plan, aquí lo ves y cancelas su renovación.</div>
          </div>
        </Grupo>
      ) : (
        <>
          <TarjetaHeroe
            etiqueta="Lo que tienes activo" titulo={`${vigentes.length} ${vigentes.length === 1 ? 'plan' : 'planes'}`}
            detalle={sigue ? `Próximo cobro: ${fechaCorta(sigue.fecha)} · ${pesos(sigue.monto)}` : 'Nada por cobrar'}
          />
          {vigentes.length > 0 && <Grupo>{vigentes.map((c) => <FilaDeCompra key={c.compra_id} c={c} onAbrir={() => setAbierta(c)} />)}</Grupo>}
          <Grupo titulo="Pagos" pie="Cancela una membresía cuando quieras: la tienes hasta el final de lo que pagaste.">
            {/* La tarjeta la guarda Stripe, no Training Lab: cambiarla se hace en su portal, que se enciende con los cobros. */}
            <Fila texto="Tarjeta y recibos" detalle="Los guarda Stripe" onClick={() => avisa('Pronto: aquí cambias tu tarjeta y ves tus recibos')} />
            <Fila texto="Historial de compras" valor={historial.length ? String(historial.length) : null} valorTono="neutro" onClick={() => setVerHistorial(true)} />
          </Grupo>
        </>
      )}

      {abierta && <HojaDeCompra c={abierta} onCerrar={() => setAbierta(null)} onCambio={lee} />}
      {verHistorial && (
        <HojaFlotante titulo="Historial de compras" onCerrar={() => setVerHistorial(false)} ancho={480}>
          {historial.length
            ? <Grupo>{historial.map((c) => <FilaDeCompra key={c.compra_id} c={c} onAbrir={() => { setVerHistorial(false); setAbierta(c); }} />)}</Grupo>
            : <p style={{ margin: '8px 6px', fontSize: 15, color: KP.ink2 }}>Aquí quedan las compras que ya terminaron.</p>}
        </HojaFlotante>
      )}
    </>
  );
}
