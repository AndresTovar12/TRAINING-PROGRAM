import { useEffect, useState } from 'react';
import { Download, Loader2, LogOut, Trash2, AlertTriangle, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import CorreoDeLaCuenta from '@/features/profile/CorreoDeLaCuenta';
import CambiarContrasena from '@/features/profile/CambiarContrasena';
import { descargaComoArchivo, eliminaMiCuenta, misDatos, resumenDeMiCuenta } from '@/lib/miCuentaApi';
import { T, FONT, KP } from '@/lib/theme';

/* LA PESTAÑA «CUENTA» de Mi perfil (15 oct 2026). Andrés: «hay temas de administración que no tenemos resueltos: que alguien elimine su cuenta, dónde administra
   sus contraseñas…». Aquí vive lo de la cuenta en sí (no lo del perfil): correo, contraseña, sesiones abiertas, descargar sus datos y eliminarla.
   Eliminarla es obligatorio para publicar en la App Store: quien puede crear una cuenta debe poder iniciar su eliminación desde la app. */

const titulo = { fontSize: 11, fontWeight: 800, color: T.text3, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 };
const botonBlanco = {
  display: 'flex', alignItems: 'center', gap: 11, width: '100%', minHeight: 52, padding: '0 14px', borderRadius: 14, cursor: 'pointer', textAlign: 'left',
  border: `1.5px solid ${KP.lineHi}`, background: T.bg2, fontFamily: FONT, fontSize: 14.5, fontWeight: 800, color: T.text, touchAction: 'manipulation',
};
const aviso = (tono) => ({
  display: 'flex', gap: 9, alignItems: 'flex-start', borderRadius: 12, padding: '11px 13px', fontSize: 13.5, fontWeight: 600, lineHeight: 1.45,
  background: tono === 'peligro' ? KP.dangerSoft : tono === 'ok' ? 'rgba(16,185,129,0.10)' : KP.blueSoft,
  color: tono === 'peligro' ? KP.danger : tono === 'ok' ? KP.mint : KP.blueDk,
});

function Sesiones() {
  const [busy, setBusy] = useState(false);
  const [listo, setListo] = useState(false);
  const [error, setError] = useState('');
  async function cierraLasDemas() {
    setBusy(true); setError(''); setListo(false);
    const { error: err } = await supabase.auth.signOut({ scope: 'others' });
    setBusy(false);
    if (err) setError('No se pudo. Inténtalo de nuevo.'); else setListo(true);
  }
  return (
    <div>
      <div style={titulo}>Sesiones</div>
      <button type="button" onClick={cierraLasDemas} disabled={busy} style={botonBlanco} className="kp-press">
        {busy ? <Loader2 size={18} className="spin" /> : <LogOut size={18} color={T.text2} />}
        <span style={{ flex: 1 }}>Cerrar sesión en los demás aparatos</span>
      </button>
      <div style={{ fontSize: 12.5, color: T.text2, fontWeight: 600, marginTop: 7, lineHeight: 1.45 }}>
        Si entraste desde un teléfono o una compu que ya no usas, esto la cierra ahí. Aquí sigues dentro.
      </div>
      {listo && <div role="status" style={{ ...aviso('ok'), marginTop: 9 }}><Check size={16} strokeWidth={3} style={{ flexShrink: 0 }} /> Listo: se cerró en los demás aparatos.</div>}
      {error && <div role="alert" style={{ ...aviso('peligro'), marginTop: 9 }}>{error}</div>}
    </div>
  );
}

function MisDatos() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function descarga() {
    setBusy(true); setError('');
    try {
      const datos = await misDatos();
      descargaComoArchivo(datos, `mis-datos-training-lab-${new Date().toISOString().slice(0, 10)}.json`);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <div style={titulo}>Tus datos</div>
      <button type="button" onClick={descarga} disabled={busy} style={botonBlanco} className="kp-press">
        {busy ? <Loader2 size={18} className="spin" /> : <Download size={18} color={KP.blue} />}
        <span style={{ flex: 1 }}>Descargar mis datos</span>
      </button>
      <div style={{ fontSize: 12.5, color: T.text2, fontWeight: 600, marginTop: 7, lineHeight: 1.45 }}>
        Un archivo con todo lo que Training Lab guarda de tu cuenta: perfil, planes, entrenos, mensajes y compras.
      </div>
      {error && <div role="alert" style={{ ...aviso('peligro'), marginTop: 9 }}>{error}</div>}
    </div>
  );
}

function EliminarCuenta() {
  const [abierto, setAbierto] = useState(false);
  const [r, setR] = useState(null); // el resumen de lo que se llevaría
  const [contrasena, setContrasena] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!abierto || r) return;
    let vivo = true;
    resumenDeMiCuenta().then((x) => { if (vivo) setR(x); }).catch((e) => { if (vivo) setError(e.message); });
    return () => { vivo = false; };
  }, [abierto, r]);

  const bloqueada = r && (r.es_dueno || r.membresias_activas > 0 || r.compradores_activos > 0);
  const puede = r && !bloqueada && confirmacion.trim().toUpperCase() === 'ELIMINAR' && (!r.tiene_contrasena || contrasena) && !busy;

  async function elimina(e) {
    e.preventDefault();
    if (!puede) return;
    setBusy(true); setError('');
    try {
      await eliminaMiCuenta({ confirmacion: confirmacion.trim(), contrasena });
      await supabase.auth.signOut().catch(() => {});
      window.location.assign('/');
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div>
      <div style={titulo}>Zona de cuidado</div>
      {!abierto ? (
        <button type="button" onClick={() => setAbierto(true)} style={{ ...botonBlanco, border: `1.5px solid ${KP.danger}`, color: KP.danger, background: 'rgba(220,38,38,0.05)' }} className="kp-press">
          <Trash2 size={18} /> <span style={{ flex: 1 }}>Eliminar mi cuenta</span>
        </button>
      ) : (
        <form onSubmit={elimina} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 14, borderRadius: 14, border: `1.5px solid ${KP.danger}`, background: T.bg }}>
          <div style={{ ...aviso('peligro') }}>
            <AlertTriangle size={17} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>Se borran para siempre tu perfil, tus planes, tus entrenos, tus mensajes y tus compras. No se puede deshacer.</span>
          </div>
          {!r && !error && <div style={{ fontSize: 13.5, color: T.text2, fontWeight: 600 }}><Loader2 size={14} className="spin" /> Revisando tu cuenta…</div>}
          {r?.es_coach && !bloqueada && (
            <div style={aviso('info')}>
              {r.atletas > 0 ? `Tus ${r.atletas} atleta${r.atletas === 1 ? '' : 's'} se quedan sin coach (sus cuentas y sus planes siguen). ` : ''}
              También se borran tus ejercicios y plantillas.
            </div>
          )}
          {r?.es_dueno && <div style={aviso('peligro')}>La cuenta del administrador no se elimina desde aquí.</div>}
          {r?.membresias_activas > 0 && <div style={aviso('peligro')}>Tienes una membresía activa. Cancélala antes de eliminar tu cuenta; si no sabes cómo, escríbenos a contacto@traininglabapp.com.</div>}
          {r?.compradores_activos > 0 && <div style={aviso('peligro')}>Tienes compradores con una membresía activa. No se puede eliminar tu cuenta hasta que terminen o se cancelen; escríbenos a contacto@traininglabapp.com.</div>}

          {r && !bloqueada && (
            <>
              {r.tiene_contrasena && (
                <label style={{ display: 'block' }}>
                  <div style={{ ...titulo, marginBottom: 7 }}>Tu contraseña</div>
                  <input
                    type="password" autoComplete="current-password" value={contrasena} onChange={(e) => setContrasena(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', border: `1.5px solid ${T.border}`, borderRadius: 12, padding: '12px 13px', background: T.bg2, fontFamily: FONT, fontSize: 16, color: T.text, outline: 'none' }}
                  />
                </label>
              )}
              <label style={{ display: 'block' }}>
                <div style={{ ...titulo, marginBottom: 7 }}>Para confirmar, escribe ELIMINAR</div>
                <input
                  value={confirmacion} onChange={(e) => setConfirmacion(e.target.value)} autoCapitalize="characters" autoCorrect="off" spellCheck={false} placeholder="ELIMINAR"
                  style={{ width: '100%', boxSizing: 'border-box', border: `1.5px solid ${T.border}`, borderRadius: 12, padding: '12px 13px', background: T.bg2, fontFamily: FONT, fontSize: 16, color: T.text, outline: 'none', letterSpacing: 1 }}
                />
              </label>
            </>
          )}
          {error && <div role="alert" style={aviso('peligro')}>{error}</div>}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            {r && !bloqueada && (
              <button
                type="submit" disabled={!puede}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 44, padding: '0 18px', borderRadius: 12, border: 'none', fontFamily: FONT, fontSize: 14.5, fontWeight: 800,
                  background: KP.danger, color: '#fff', cursor: puede ? 'pointer' : 'default', opacity: puede ? 1 : 0.45,
                }}
              >
                {busy ? <Loader2 size={16} className="spin" /> : <Trash2 size={16} />} Eliminar para siempre
              </button>
            )}
            <button type="button" onClick={() => { setAbierto(false); setR(null); setError(''); setContrasena(''); setConfirmacion(''); }} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: FONT, fontSize: 14, fontWeight: 700, color: T.text2, padding: '6px 2px' }}>
              Mejor no
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export default function ConfiguracionDeCuenta() {
  return (
    <>
      <CorreoDeLaCuenta />
      <CambiarContrasena />
      <Sesiones />
      <MisDatos />
      <EliminarCuenta />
    </>
  );
}
