import { useEffect, useState } from 'react';
import { CalendarDays, Check, ChevronLeft, Clock, Eye, EyeOff, Loader2, Lock, User } from 'lucide-react';
import { FONT, KP, UI } from '@/lib/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useIsDesktop } from '@/lib/useViewport';
import BotonApple from '@/components/BotonApple';
import BotonGoogle from '@/components/BotonGoogle';
import AuthScreen from '@/features/auth/AuthScreen';
import { Boton } from '@/components/ui';
import {
  compraPendiente, creaCuentaDeCompra, datosDeEntrada, guardaCompraPendiente, leeCompra, olvidaCompraPendiente, reclamaCompra, reenviaLiga,
} from '@/lib/compraApi';
import { MENSAJES } from '@/lib/reclamo';
import { diaLargo } from '@/lib/entradaAlPlan';
import { Marco } from './PiezasDeTienda';
import CuandoEmpiezas from './CuandoEmpiezas';

/* COMPRA CONFIRMADA (encargo «Compra y dinero», 26 nov 2026; dibujos web-4-listo-*, web-cuenta-4 a 8, web-5-cuando-* y web-6-descarga-*).
   En orden, después de pagar en la web: la cuenta → ¿cuándo empiezas? → descarga la app.
   LA CUENTA. Ya no se crea sola con el correo del pago: la compra queda apartada hasta que una cuenta la reclama, UNA vez, con la llave del pago (`?c=cs_…`) o la de la liga del
   correo (`?l=…`, 48 h). «Continuar con Apple» (en Android, Google primero), «Continuar con Google», «Crear usuario y contraseña» y «Ya tengo cuenta». La llave se guarda antes de
   salir a Apple o Google y al volver con sesión la app regresa aquí (`App.jsx`).
   Casos: liga vencida («Mandarme otra liga», solo al correo del pago); liga ya usada («Esta compra ya tiene cuenta. Entra con ella.»); con sesión se reclama sola. */

const URL_APP_STORE = import.meta.env.VITE_APP_STORE_URL || 'https://apps.apple.com/mx/search?term=Training%20Lab';
const esAndroid = () => /android/i.test(navigator.userAgent ?? '');

function llavesDeLaLiga() {
  const q = new URLSearchParams(window.location.search);
  if (q.get('c')) return { sesion: q.get('c') };
  if (q.get('l')) return { llave: q.get('l') };
  return compraPendiente();
}

const Palomita = () => (
  <div style={{ width: 84, height: 84, borderRadius: 26, background: KP.mintSoft, color: KP.mint, display: 'grid', placeItems: 'center', margin: '0 auto' }}><Check size={42} strokeWidth={3} /></div>
);
const Encabezado = ({ titulo, detalle, nota }) => (
  <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 8, margin: '8px 0 6px' }}>
    <Palomita />
    <h1 style={{ margin: '10px 0 0', fontSize: 32, fontWeight: 800, letterSpacing: -0.7 }}>{titulo}</h1>
    {detalle && <div style={{ fontSize: 17, fontWeight: 600, color: KP.ink2 }}>{detalle}</div>}
    {nota && <div style={{ fontSize: 15.5, fontWeight: 500, color: KP.ink2 }}>{nota}</div>}
  </div>
);
const Tarjeta = ({ children, estilo }) => <div style={{ background: UI.tarjeta, borderRadius: 22, boxShadow: UI.sombraGrupo, padding: 20, display: 'flex', flexDirection: 'column', gap: 12, ...estilo }}>{children}</div>;
const Aviso = ({ icono, tono = 'amber', titulo, texto, children }) => (
  <Tarjeta estilo={{ alignItems: 'center', textAlign: 'center', padding: '28px 22px' }}>
    <div style={{ width: 76, height: 76, borderRadius: 24, background: KP[`${tono}Soft`], color: KP[tono], display: 'grid', placeItems: 'center' }}>{icono}</div>
    <div style={{ fontSize: 23, fontWeight: 800 }}>{titulo}</div>
    {texto && <div style={{ fontSize: 16, fontWeight: 500, color: KP.ink2, lineHeight: 1.5 }}>{texto}</div>}
    {children}
  </Tarjeta>
);

function CreaUsuario({ llaves, alVolver, alCreada }) {
  const { signIn } = useAuth();
  const [usuario, setUsuario] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [ver, setVer] = useState(false);
  const [error, setError] = useState(null);
  const [creando, setCreando] = useState(false);
  async function crea(e) {
    e.preventDefault();
    setError(null);
    setCreando(true);
    try {
      const u = await creaCuentaDeCompra(llaves, { usuario: usuario.trim(), contrasena });
      await signIn(u, contrasena);
      alCreada();
    } catch (err) { setError(err.message); setCreando(false); }
  }
  const caja = { display: 'flex', alignItems: 'center', gap: 12, background: UI.relleno, borderRadius: 16, padding: '0 16px', minHeight: 56 };
  const entrada = { flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontFamily: FONT, fontSize: 18, fontWeight: 500, color: KP.ink };
  return (
    <form onSubmit={crea} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <button type="button" onClick={alVolver} aria-label="Volver" style={{ width: 44, height: 44, borderRadius: 14, border: 'none', background: UI.relleno, display: 'grid', placeItems: 'center', cursor: 'pointer' }}><ChevronLeft size={21} /></button>
        <h1 style={{ margin: 0, fontSize: 30, fontWeight: 800, letterSpacing: -0.6 }}>Crea tu cuenta</h1>
      </div>
      <Tarjeta>
        <label><span style={{ display: 'block', fontSize: 15, fontWeight: 600, color: KP.ink2, marginBottom: 8 }}>Usuario</span>
          <span style={caja}><User size={20} color={KP.ink2} /><input value={usuario} onChange={(e) => setUsuario(e.target.value.replace(/\s/g, '').toLowerCase())} autoCapitalize="none" autoComplete="username" aria-label="Usuario" style={entrada} /></span>
        </label>
        <label><span style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 600, color: KP.ink2, marginBottom: 8 }}>Contraseña<span style={{ fontWeight: 500 }}>Mínimo 8 caracteres</span></span>
          <span style={caja}><Lock size={20} color={KP.ink2} /><input type={ver ? 'text' : 'password'} value={contrasena} onChange={(e) => setContrasena(e.target.value)} autoComplete="new-password" aria-label="Contraseña" style={entrada} />
            <button type="button" onClick={() => setVer((v) => !v)} aria-label={ver ? 'Ocultar contraseña' : 'Ver contraseña'} style={{ border: 'none', background: 'none', color: KP.ink2, cursor: 'pointer', display: 'grid', placeItems: 'center' }}>{ver ? <EyeOff size={20} /> : <Eye size={20} />}</button>
          </span>
        </label>
      </Tarjeta>
      <p style={{ margin: '0 6px', fontSize: 15, fontWeight: 500, color: KP.ink2 }}>Con este usuario entras a la app.</p>
      {error && <div role="alert" style={{ background: KP.dangerSoft, color: KP.danger, borderRadius: 14, padding: '12px 14px', fontSize: 15, fontWeight: 700 }}>{error}</div>}
      <Boton type="submit" ancho cargando={creando} deshabilitado={usuario.length < 3 || contrasena.length < 8}>Crear cuenta</Boton>
    </form>
  );
}

/** Descarga la app (y en la compu, «Seguir en la web»). */
function Descarga({ entrada, conQueEntra, alSeguirEnLaWeb }) {
  const esCompu = useIsDesktop();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Encabezado titulo="Descarga la app" detalle="Ahí entrenas tu plan día a día." />
      {entrada?.inicio && (
        <Tarjeta estilo={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 }}>
          <span style={{ width: 46, height: 46, borderRadius: 14, background: KP.blueSoft, color: KP.blue, display: 'grid', placeItems: 'center' }}><CalendarDays size={22} /></span>
          <span><span style={{ display: 'block', fontSize: 17, fontWeight: 700 }}>Empiezas el {diaLargo(entrada.inicio)}</span>{entrada.total > 1 && <span style={{ display: 'block', fontSize: 15, fontWeight: 500, color: KP.ink2 }}>Semana {entrada.semana} de {entrada.total}</span>}</span>
        </Tarjeta>
      )}
      <Tarjeta estilo={{ alignItems: 'center', textAlign: 'center', padding: '26px 20px' }}>
        <a href={URL_APP_STORE} target="_blank" rel="noreferrer" aria-label="Descárgalo en el App Store">
          <img src="https://tools.applemarketingtools.com/api/badges/download-on-the-app-store/black/es-mx" alt="Descárgalo en el App Store" style={{ height: 56, display: 'block' }} />
        </a>
        <div style={{ fontSize: 16, fontWeight: 500, color: KP.ink2, lineHeight: 1.5 }}>{conQueEntra}</div>
      </Tarjeta>
      {esCompu && <Boton tipo="secundario" ancho onClick={alSeguirEnLaWeb}>Seguir en la web</Boton>}
    </div>
  );
}

export default function CompraLista() {
  const { user, profile, loading } = useAuth();
  const [llaves] = useState(llavesDeLaLiga);
  const [c, setC] = useState(undefined);
  const [paso, setPaso] = useState('cuenta'); // cuenta | usuario | entrar | cuando | descarga
  const [compraId, setCompraId] = useState(null);
  const [entrada, setEntrada] = useState(null);
  const [error, setError] = useState(null);
  const [reenvio, setReenvio] = useState(null);
  const [mandando, setMandando] = useState(false);

  // Lee la compra; mientras Stripe confirma el pago (unos segundos), vuelve a preguntar.
  useEffect(() => {
    if (!llaves) { setC({ estado: 'desconocida' }); return undefined; }
    let vivo = true;
    let intentos = 0;
    const lee = async () => {
      const x = await leeCompra(llaves);
      if (!vivo) return;
      setC(x);
      if ((x.estado === 'confirmando' || x.estado === 'sin_conexion') && intentos++ < 25) setTimeout(lee, 2000);
    };
    lee();
    return () => { vivo = false; };
  }, [llaves, user?.id]);

  // Con sesión de atleta y la compra sin dueño (o ya suya): se guarda en su cuenta.
  useEffect(() => {
    if (!c || loading || !user || !llaves || compraId) return;
    if (c.es_tuya) { setCompraId(c.compra_id); olvidaCompraPendiente(); return; }
    if (c.reclamada || c.vencida || c.estado === 'confirmando') return;
    reclamaCompra(llaves).then((id) => { olvidaCompraPendiente(); setCompraId(id); }).catch((e) => setError(e.codigo === 'no_atleta' ? MENSAJES.no_atleta : e.message));
  }, [c, user, loading, llaves, compraId]);

  // Ya es suya: si ya eligió cuándo empieza, directo a descargar la app.
  useEffect(() => {
    if (!compraId) return;
    datosDeEntrada(compraId).then((d) => { setEntrada(d); setPaso(d.elegida ? 'descarga' : 'cuando'); }).catch(() => setPaso('cuando'));
  }, [compraId]);

  const detalle = c?.titulo ? [c.titulo, c.coach?.nombre].filter(Boolean).join(' · ') : null;
  const proveedor = user?.app_metadata?.provider;
  const conQueEntra = proveedor === 'apple' ? 'Entra con Apple, igual que aquí. Tu plan ya está ahí.' : proveedor === 'google' ? 'Entra con Google, igual que aquí. Tu plan ya está ahí.' : `Entra con tu usuario${profile?.username ? ` @${profile.username}` : ''}. Tu plan ya está ahí.`;

  if (paso === 'entrar' && !user) return <AuthScreen onVolver={() => setPaso('cuenta')} aviso={c?.titulo ? `${c.titulo} se guarda en la cuenta con la que entres.` : null} />;

  let contenido;
  if (c === undefined || (c.estado === 'confirmando' && !error)) {
    contenido = <div style={{ textAlign: 'center', padding: 48, color: KP.ink2 }}><Loader2 size={24} className="spin" /><div style={{ marginTop: 12, fontSize: 16, fontWeight: 600 }}>Confirmando tu pago…</div></div>;
  } else if (c.estado === 'desconocida') {
    contenido = <Aviso icono={<Clock size={34} />} titulo="No encontramos esta compra" texto="Revisa que la liga esté completa o abre la que te llegó al correo." />;
  } else if (error) {
    contenido = <Aviso icono={<Clock size={34} />} tono="danger" titulo="No se pudo guardar tu compra" texto={error} />;
  } else if (paso === 'cuando' && compraId) {
    contenido = <CuandoEmpiezas compraId={compraId} cabeza={<Encabezado titulo="Compra confirmada" detalle={detalle} />} alListo={() => datosDeEntrada(compraId).then((d) => { setEntrada(d); setPaso('descarga'); })} />;
  } else if (paso === 'descarga' && compraId) {
    contenido = <Descarga entrada={entrada} conQueEntra={conQueEntra} alSeguirEnLaWeb={() => window.location.assign('/')} />;
  } else if (c.reclamada && !c.es_tuya) {
    contenido = (
      <Aviso icono={<User size={34} />} tono="blue" titulo={MENSAJES.ya_usada}>
        {!user && <Boton ancho onClick={() => setPaso('entrar')}>Entrar</Boton>}
      </Aviso>
    );
  } else if (c.vencida) {
    contenido = (
      <Aviso icono={<Clock size={34} />} titulo="Esta liga ya venció" texto={reenvio ? `Te mandamos otra a ${reenvio}.` : 'Las ligas duran 48 horas. Te mandamos otra al correo de tu compra.'}>
        {!reenvio && <Boton ancho cargando={mandando} onClick={async () => { setMandando(true); try { setReenvio(await reenviaLiga(llaves)); } catch (e) { setError(e.message); } setMandando(false); }}>Mandarme otra liga</Boton>}
      </Aviso>
    );
  } else if (user) {
    contenido = <div style={{ textAlign: 'center', padding: 48, color: KP.ink2 }}><Loader2 size={24} className="spin" /></div>;
  } else if (paso === 'usuario') {
    contenido = <CreaUsuario llaves={llaves} alVolver={() => setPaso('cuenta')} alCreada={() => setPaso('cuenta')} />;
  } else {
    const antes = () => guardaCompraPendiente(llaves);
    const apple = <BotonApple key="a" antes={antes} style={{ minHeight: 56, borderRadius: 17, fontSize: 17, fontWeight: 700, marginTop: 0 }} />;
    // estilo-ok: el botón blanco de Google lleva su orilla fina (reglas de marca de Google)
    const google = <BotonGoogle key="g" antes={antes} style={{ minHeight: 56, borderRadius: 17, fontSize: 17, background: '#fff', boxShadow: 'inset 0 0 0 1px #DADDE3' }} />;
    contenido = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Encabezado titulo="Compra confirmada" detalle={detalle} />
        <Tarjeta>
          <div style={{ fontSize: 21, fontWeight: 800, textAlign: 'center', marginBottom: 4 }}>Crea tu cuenta para entrar a tu plan</div>
          {esAndroid() ? [google, apple] : [apple, google]}
          <Boton tipo="secundario" ancho onClick={() => setPaso('usuario')}>Crear usuario y contraseña</Boton>
          <Boton tipo="texto" onClick={() => { antes(); setPaso('entrar'); }}>Ya tengo cuenta</Boton>
        </Tarjeta>
        {c.correo && <p style={{ margin: 0, textAlign: 'center', fontSize: 15, fontWeight: 500, color: KP.ink2 }}>Mandamos tu recibo a <b style={{ color: KP.ink }}>{c.correo}</b>.</p>}
      </div>
    );
  }
  return <Marco ancho={560}><div style={{ fontFamily: FONT, color: KP.ink }}>{contenido}</div></Marco>;
}
