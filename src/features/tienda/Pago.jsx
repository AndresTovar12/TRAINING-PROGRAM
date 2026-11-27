import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, Loader2, Lock, Mail } from 'lucide-react';
import { FONT, KP, NUM_STYLE, UI } from '@/lib/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useIsDesktop } from '@/lib/useViewport';
import { iniciaPagoIncrustado } from '@/lib/compraApi';
import { sugerenciaDeCorreo } from '@/lib/reclamo';
import { correoValido } from '@/lib/compraLista';
import { Avatar } from '@/components/ui';
import { loQueIncluye, pesosMXN, textoDeCobro } from './piezasDelPlan';

/* EL PAGO, DENTRO DE NUESTRA PÁGINA (encargo «Compra y dinero», 26 nov 2026; dibujos web-3-pago-telefono, web-3-pago-compu y web-cuenta-8-pago-con-sesion).
   Sigue siendo una Checkout Session de Stripe (el aviso `checkout.session.completed` no cambia), pero con `ui_mode: 'elements'`: los campos de Stripe van incrustados aquí
   (Stripe.js «endive», `initCheckoutElementsSdk`). En el pago SOLO se paga: la cuenta y «¿Cuándo empiezas?» van después.
   Teléfono, en orden: «Tu compra»; el plan en una fila; Apple Pay o Google Pay (el que tenga el navegador); «o paga con tarjeta»; el correo («Aquí te llega tu recibo», con
   «¿Quisiste decir gmail.com?»); la tarjeta; meses sin intereses solo si la tarjeta los acepta (los pinta Stripe); abajo «Pagar $500 MXN» y «Pago procesado por Stripe».
   Con sesión: «Compras como @usuario» y no se pide correo. Computadora: a la izquierda el plan, a la derecha el pago. */

const LLAVE_PUBLICA = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ?? '';
const STRIPE_JS = 'https://js.stripe.com/endive/stripe.js';

let cargaDeStripe = null;
function cargaStripe() {
  if (window.Stripe) return Promise.resolve(window.Stripe);
  cargaDeStripe ??= new Promise((resolver, fallar) => {
    const s = document.createElement('script');
    s.src = STRIPE_JS;
    s.async = true;
    s.onload = () => (window.Stripe ? resolver(window.Stripe) : fallar(new Error('Stripe no cargó')));
    s.onerror = () => { cargaDeStripe = null; fallar(new Error('Stripe no cargó')); };
    document.head.appendChild(s);
  });
  return cargaDeStripe;
}

const APARIENCIA = {
  theme: 'flat',
  variables: { colorPrimary: KP.blue, colorText: KP.ink, colorTextSecondary: KP.ink2, colorBackground: UI.tarjeta, colorDanger: KP.danger, fontFamily: 'Inter, system-ui, sans-serif', borderRadius: '14px', spacingUnit: '4px', fontSizeBase: '16px' },
  rules: { '.Input': { backgroundColor: UI.relleno, border: 'none', padding: '14px 16px' }, '.Label': { fontWeight: '600', color: KP.ink2 } },
};

/** Lo que dice Stripe cuando algo sale mal, en palabras de la app. No se borra nada de lo que escribió. */
function mensajeDeError(e) {
  const codigo = e?.code ?? e?.decline_code ?? '';
  if (/card_declined|insufficient_funds|do_not_honor|generic_decline|lost_card|stolen_card|expired_card|incorrect_cvc|processing_error/.test(codigo) || e?.type === 'card_error') return 'Tu banco no aceptó el pago. Prueba con otra tarjeta.';
  return e?.message || 'No se pudo hacer el pago. Inténtalo otra vez.';
}

/** `plan`: lo de `plan_publico`. `usuario`, `slug`: de la liga. */
export default function Pago({ plan, usuario, slug, alVolver }) {
  const { user, profile } = useAuth();
  const esCompu = useIsDesktop();
  const conSesion = !!user && profile?.role === 'user';
  const [estado, setEstado] = useState(LLAVE_PUBLICA ? 'cargando' : 'no_disponible'); // cargando | listo | no_disponible | error
  const [aviso, setAviso] = useState(null);
  const [correo, setCorreo] = useState('');
  const [errorCorreo, setErrorCorreo] = useState(null);
  const [pagando, setPagando] = useState(false);
  const [puedePagar, setPuedePagar] = useState(false);
  const [total, setTotal] = useState(null);
  const acciones = useRef(null);
  const sesionId = useRef(null);
  const cajaExpress = useRef(null);
  const cajaTarjeta = useRef(null);
  const membresia = plan.tipo === 'membresia';
  const sugerencia = !conSesion ? sugerenciaDeCorreo(correo) : null;

  useEffect(() => {
    if (!LLAVE_PUBLICA) return undefined;
    let vivo = true;
    let checkout = null;
    (async () => {
      try {
        const [Stripe, { client_secret: secreto }] = await Promise.all([cargaStripe(), iniciaPagoIncrustado({ usuario, slug })]);
        if (!vivo) return;
        sesionId.current = String(secreto).split('_secret_')[0];
        checkout = Stripe(LLAVE_PUBLICA).initCheckoutElementsSdk({ clientSecret: secreto, elementsOptions: { appearance: APARIENCIA, fonts: [{ cssSrc: 'https://fonts.googleapis.com/css2?family=Inter:wght@500;600;700&display=swap' }] } });
        let a = checkout;
        if (typeof checkout.loadActions === 'function') {
          const r = await checkout.loadActions();
          if (r?.type !== 'success') throw new Error(r?.error?.message ?? 'Stripe no cargó');
          a = r.actions;
        }
        acciones.current = a;
        const alCambiar = (s) => {
          setPuedePagar(!!s?.canConfirm);
          const t = s?.total?.total;
          if (t?.minorUnitsAmount != null) setTotal(t.minorUnitsAmount / (s.minorUnitsAmountDivisor ?? 100));
        };
        checkout.on?.('change', alCambiar);
        if (typeof a.getSession === 'function') alCambiar(a.getSession());
        const express = checkout.createExpressCheckoutElement?.({ buttonHeight: 52, paymentMethods: { applePay: 'auto', googlePay: 'auto', link: 'never' } });
        if (express && cajaExpress.current) {
          express.mount(cajaExpress.current);
          express.on?.('confirm', () => paga(true));
        }
        checkout.createPaymentElement({ layout: 'tabs', fields: { billingDetails: { email: 'never' } } }).mount(cajaTarjeta.current);
        setEstado('listo');
      } catch (e) {
        if (!vivo) return;
        setAviso(e?.codigo === 'ventas_cerradas' ? 'La compra no está disponible.' : e?.message ?? 'No se pudo cargar el pago.');
        setEstado('error');
      }
    })();
    return () => { vivo = false; try { checkout?.destroy?.(); } catch { /* ya no estaba */ } };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `paga` lee lo último por ref; se monta una vez por plan
  }, [usuario, slug]);

  async function paga(desdeExpress = false) {
    const a = acciones.current;
    if (!a || pagando) return;
    setAviso(null);
    if (!conSesion && !desdeExpress) {
      if (!correoValido(correo)) { setErrorCorreo('Escribe tu correo.'); return; }
      const r = await a.updateEmail?.(correo.trim());
      if (r?.type === 'error') { setErrorCorreo(r.error?.message ?? 'Revisa tu correo.'); return; }
    }
    setPagando(true);
    const r = await a.confirm({ returnUrl: `${window.location.origin}/compra/lista?c=${sesionId.current}` });
    // Si el pago sale bien, Stripe lleva a la página de «Compra confirmada»; aquí solo se llega con un error inmediato.
    if (r?.type === 'error') { setAviso(mensajeDeError(r.error)); setPagando(false); return; }
    if (r?.type === 'success') window.location.assign(`/compra/lista?c=${sesionId.current}`);
  }

  const monto = total ?? plan.precio;
  const incluye = loQueIncluye(plan, plan.coach?.nombre).filter((x) => x.id !== 'solo').map((x) => x.texto.replace(/ con .*/, '')).join(' y ').replace(/^Chat y Revisión/, 'Chat y revisión');
  const resumen = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: UI.tarjeta, borderRadius: UI.rTarjeta, boxShadow: UI.sombraGrupo, padding: 14 }}>
      <span style={{ width: 64, height: 64, borderRadius: 16, overflow: 'hidden', background: KP.blueSoft, flexShrink: 0 }}>{plan.foto && <img src={plan.foto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 17, fontWeight: 800, lineHeight: 1.25 }}>{plan.titulo}</span>
        <span style={{ display: 'block', fontSize: 14.5, fontWeight: 500, color: KP.ink2 }}>{plan.coach?.nombre}</span>
        {incluye && <span style={{ display: 'block', fontSize: 14.5, fontWeight: 500, color: KP.ink2 }}>{incluye}</span>}
      </span>
      <span style={{ textAlign: 'right' }}>
        <span style={{ display: 'block', fontSize: 18, fontWeight: 800, whiteSpace: 'nowrap', ...NUM_STYLE }}>{pesosMXN(monto)}</span>
        <span style={{ display: 'block', fontSize: 14, fontWeight: 500, color: KP.ink2 }}>{textoDeCobro(plan.tipo)}</span>
      </span>
    </div>
  );
  const boton = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <button
        type="button" onClick={() => paga(false)} disabled={estado !== 'listo' || pagando || (!puedePagar && conSesion)} className="kp-press"
        style={{ width: '100%', minHeight: 56, borderRadius: 16, border: 'none', background: KP.blue, color: '#fff', fontFamily: FONT, fontSize: 18, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10, boxShadow: '0 8px 20px rgba(30,64,224,0.22)', cursor: 'pointer', opacity: estado !== 'listo' || pagando ? 0.6 : 1 }}
      >
        {pagando ? <Loader2 size={20} className="spin" /> : <Lock size={19} />}
        {pagando ? 'Pagando…' : `Pagar ${pesosMXN(monto)}${membresia ? ' al mes' : ''}`}
      </button>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 14, fontWeight: 500, color: KP.ink2 }}><Lock size={13} /> Pago procesado por Stripe</div>
    </div>
  );
  const formulario = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {estado === 'no_disponible' && <div style={{ background: UI.tarjeta, borderRadius: UI.rTarjeta, padding: 22, fontSize: 16, fontWeight: 600, textAlign: 'center' }}>El pago todavía no está disponible.</div>}
      {estado === 'error' && <div role="alert" style={{ background: KP.dangerSoft, color: KP.danger, borderRadius: 14, padding: '12px 14px', fontSize: 15, fontWeight: 700 }}>{aviso}</div>}
      {(estado === 'cargando' || estado === 'listo') && (
        <>
          <div ref={cajaExpress} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: KP.ink2, fontSize: 15, fontWeight: 500 }}><span style={{ flex: 1, height: 1, background: KP.lineHi }} />o paga con tarjeta<span style={{ flex: 1, height: 1, background: KP.lineHi }} /></div>
          <div style={{ background: UI.tarjeta, borderRadius: UI.rTarjeta, boxShadow: UI.sombraGrupo, padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {conSesion ? (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Avatar nombre={profile?.full_name || profile?.username} foto={profile?.avatar_url} tamano={46} />
                  <div><div style={{ fontSize: 14.5, fontWeight: 500, color: KP.ink2 }}>Compras como</div><div style={{ fontSize: 18, fontWeight: 800 }}>@{profile?.username}</div></div>
                </div>
                <div style={{ fontSize: 14.5, fontWeight: 500, color: KP.ink2, marginTop: 10 }}>Tu recibo llega al correo de tu cuenta.</div>
              </div>
            ) : (
              <label style={{ display: 'block' }}>
                <span style={{ display: 'block', fontSize: 15, fontWeight: 600, color: KP.ink2, marginBottom: 8 }}>Correo</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 10, background: UI.relleno, borderRadius: 14, padding: '0 14px', minHeight: 52 }}>
                  <Mail size={19} color={KP.ink2} />
                  <input type="email" inputMode="email" autoComplete="email" value={correo} onChange={(e) => { setCorreo(e.target.value); setErrorCorreo(null); }} placeholder="tu@correo.com" aria-label="Correo"
                    style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontFamily: FONT, fontSize: 17, fontWeight: 500, color: KP.ink, minWidth: 0 }} />
                </span>
                {sugerencia && (
                  <button type="button" onClick={() => setCorreo(`${correo.trim().split('@')[0]}@${sugerencia}`)} style={{ border: 'none', background: 'none', padding: '8px 0 0', fontFamily: FONT, fontSize: 15, fontWeight: 600, color: KP.blue, cursor: 'pointer' }}>
                    ¿Quisiste decir {sugerencia}?
                  </button>
                )}
                {errorCorreo && <span role="alert" style={{ display: 'block', fontSize: 14, fontWeight: 600, color: KP.danger, marginTop: 6 }}>{errorCorreo}</span>}
                <span style={{ display: 'block', fontSize: 14.5, fontWeight: 500, color: KP.ink2, marginTop: 8 }}>Aquí te llega tu recibo.</span>
              </label>
            )}
            <div ref={cajaTarjeta} style={{ minHeight: estado === 'cargando' ? 160 : undefined }}>
              {estado === 'cargando' && <div className="kp-skeleton" style={{ height: 160, borderRadius: 14 }} />}
            </div>
          </div>
          {aviso && estado === 'listo' && <div role="alert" style={{ background: KP.dangerSoft, color: KP.danger, borderRadius: 14, padding: '12px 14px', fontSize: 15, fontWeight: 700 }}>{aviso}</div>}
        </>
      )}
    </div>
  );

  const cabecera = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
      <button type="button" onClick={alVolver} aria-label="Volver" style={{ width: 44, height: 44, borderRadius: 14, border: 'none', background: UI.relleno, display: 'grid', placeItems: 'center', cursor: 'pointer' }}><ChevronLeft size={21} /></button>
      <h1 style={{ margin: 0, fontSize: 30, fontWeight: 800, letterSpacing: -0.6 }}>Tu compra</h1>
    </div>
  );
  return (
    <div style={{ minHeight: '100svh', background: UI.fondo, fontFamily: FONT, color: KP.ink }}>
      <div style={{ maxWidth: esCompu ? 1000 : 560, margin: '0 auto', padding: `calc(14px + env(safe-area-inset-top)) 16px ${esCompu ? 32 : 150}px` }}>
        {cabecera}
        {esCompu ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 440px', gap: 32, alignItems: 'start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {plan.foto && <img src={plan.foto} alt="" style={{ width: '100%', aspectRatio: '16 / 10', objectFit: 'cover', borderRadius: 24 }} />}
              {resumen}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>{formulario}{boton}</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>{resumen}{formulario}</div>
        )}
      </div>
      {!esCompu && (
        <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 20, background: 'rgba(242,243,247,0.94)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', borderTop: `1px solid ${UI.hilo}`, padding: '12px 16px calc(12px + env(safe-area-inset-bottom))' }}>
          <div style={{ maxWidth: 560, margin: '0 auto' }}>{boton}</div>
        </div>
      )}
    </div>
  );
}
