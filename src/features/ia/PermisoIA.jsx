import { useEffect, useState } from 'react';
import { Check, Dumbbell, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { FONT, KP } from '@/lib/theme';
import { queHaceLaIA } from '@/features/ia/queHaceLaIA';

/**
 * "¿Dejar que Claude use tu cuenta de Training Lab?"
 *
 * Aquí llega la persona cuando su IA —Claude, ChatGPT, Codex…— pide entrar.
 * Supabase (el servidor OAuth) la manda a `/oauth/consent?authorization_id=…`
 * y esta pantalla pregunta. Al permitir, Supabase le da a la IA un permiso que
 * trabaja COMO esta persona: ve y hace lo mismo que ella en la app, nada más.
 *
 * Dice tres cosas, porque es lo que hace falta para decidir:
 *   quién pide   — el nombre de la IA y a dónde regresa al terminar
 *   como quién   — la cuenta con la que se está entrando, con salida si no es
 *   qué podrá    — la lista de `queHaceLaIA`, por rol
 */
export default function PermisoIA({ authorizationId, onTerminar }) {
  const { profile, signOut } = useAuth();
  const [estado, setEstado] = useState('cargando'); // cargando | pregunta | enviando | listo | error
  const [detalles, setDetalles] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let vivo = true;
    supabase.auth.oauth.getAuthorizationDetails(authorizationId).then(({ data, error: err }) => {
      if (!vivo) return;
      if (err || !data) {
        setError('Este permiso ya caducó o no es válido. Vuelve a intentarlo desde tu IA.');
        setEstado('error');
        return;
      }
      // Ya lo había permitido antes: se regresa directo, sin volver a preguntar.
      if (!('authorization_id' in data)) {
        setEstado('listo');
        window.location.assign(data.redirect_url);
        return;
      }
      setDetalles(data);
      setEstado('pregunta');
    });
    return () => { vivo = false; };
  }, [authorizationId]);

  async function decide(permitir) {
    setEstado('enviando');
    const oauth = supabase.auth.oauth;
    const { data, error: err } = permitir
      ? await oauth.approveAuthorization(authorizationId, { skipBrowserRedirect: true })
      : await oauth.denyAuthorization(authorizationId, { skipBrowserRedirect: true });
    if (err || !data?.redirect_url) {
      setError('No se pudo completar. Vuelve a intentarlo desde tu IA.');
      setEstado('error');
      return;
    }
    setEstado(permitir ? 'listo' : 'negado');
    window.location.assign(data.redirect_url);
  }

  const cliente = detalles?.client?.name || 'Tu IA';
  let regresaA = '';
  try { regresaA = new URL(detalles?.redirect_uri).host; } catch { /* sin dirección */ }
  const { puede, noPuede } = queHaceLaIA(profile);

  return (
    <div style={{
      minHeight: '100svh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20, fontFamily: FONT,
      background: 'radial-gradient(1100px 620px at 50% -8%, #e7ecfe 0%, rgba(244,245,248,0) 60%), #f4f5f8',
    }}>
      <div className="animate-fade-in" style={{
        width: '100%', maxWidth: 420, background: KP.surface, borderRadius: 28,
        padding: '30px 26px 24px', border: `1px solid ${KP.line}`,
        boxShadow: '0 24px 60px rgba(17,19,24,0.10), 0 4px 14px rgba(17,19,24,0.05)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 12, display: 'grid', placeItems: 'center',
            background: `linear-gradient(140deg, ${KP.blue}, ${KP.blueDk})`,
          }}>
            <Dumbbell size={19} color="#fff" strokeWidth={2.4} />
          </div>
          <span style={{ fontSize: 15, fontWeight: 800, color: KP.ink }}>Training Lab</span>
        </div>

        {(estado === 'cargando' || estado === 'enviando' || estado === 'listo' || estado === 'negado') && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: KP.ink2, fontSize: 15, fontWeight: 600, padding: '18px 0' }}>
            <Loader2 size={18} className="spin" />
            {estado === 'cargando' && 'Revisando la solicitud…'}
            {estado === 'enviando' && 'Un momento…'}
            {estado === 'listo' && `Listo. Regresando a ${cliente}…`}
            {estado === 'negado' && `No se conectó. Regresando a ${cliente}…`}
          </div>
        )}

        {estado === 'error' && (
          <>
            <p style={{ fontSize: 15, color: KP.ink, fontWeight: 600, lineHeight: 1.5, margin: '0 0 18px' }}>{error}</p>
            <button type="button" onClick={onTerminar} style={botonSecundario}>Ir a Training Lab</button>
          </>
        )}

        {estado === 'pregunta' && (
          <>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: KP.ink, margin: '0 0 6px', letterSpacing: -0.4, lineHeight: 1.25 }}>
              {cliente} quiere usar tu cuenta
            </h1>
            <p style={{ fontSize: 14.5, color: KP.ink2, fontWeight: 500, lineHeight: 1.5, margin: '0 0 18px' }}>
              Entrará como <b style={{ color: KP.ink }}>{profile?.full_name || profile?.username}</b>{' '}
              (@{profile?.username}).{' '}
              <button type="button" onClick={signOut} style={enlace}>¿No eres tú?</button>
            </p>

            <div style={{ background: KP.surfaceMuted, border: `1px solid ${KP.line}`, borderRadius: 18, padding: '14px 16px', marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: KP.ink3, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 }}>
                Podrá
              </div>
              {puede.map((p) => (
                <div key={p} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 8, fontSize: 14.5, color: KP.ink, fontWeight: 600, lineHeight: 1.4 }}>
                  <Check size={16} color={KP.mint} strokeWidth={3} style={{ flexShrink: 0, marginTop: 2 }} />
                  {p}
                </div>
              ))}
              {noPuede && <div style={{ fontSize: 13.5, color: KP.ink2, fontWeight: 600, marginTop: 4 }}>{noPuede}</div>}
            </div>

            <p style={{ fontSize: 13, color: KP.ink2, lineHeight: 1.5, margin: '0 0 18px', fontWeight: 500 }}>
              Lo puedes desconectar cuando quieras en <b>Mi perfil</b>.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button type="button" onClick={() => decide(true)} className="kp-press" style={botonPrincipal}>
                Permitir
              </button>
              <button type="button" onClick={() => decide(false)} style={botonSecundario}>
                No permitir
              </button>
            </div>

            {regresaA && (
              <div style={{ fontSize: 12, color: KP.ink3, textAlign: 'center', marginTop: 14, fontWeight: 600 }}>
                Al terminar te regresa a {regresaA}
              </div>
            )}
          </>
        )}
      </div>
      <style>{'.spin{animation:spin .8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}'}</style>
    </div>
  );
}

const botonPrincipal = {
  width: '100%', padding: '14px 22px', borderRadius: 999, border: 'none', cursor: 'pointer',
  background: `linear-gradient(140deg, ${KP.blue}, ${KP.blueDk})`, color: '#fff',
  fontFamily: FONT, fontSize: 15.5, fontWeight: 800, boxShadow: KP.shBtn,
};

const botonSecundario = {
  width: '100%', padding: '13px 22px', borderRadius: 999, border: `1.5px solid ${KP.line}`,
  background: KP.surface, color: KP.ink, cursor: 'pointer', fontFamily: FONT, fontSize: 15, fontWeight: 700,
};

const enlace = {
  border: 'none', background: 'transparent', padding: 0, cursor: 'pointer',
  fontFamily: FONT, fontSize: 14.5, fontWeight: 700, color: KP.blue,
};
