import { useEffect, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { profesionalPorReferencia, agregarAMiEquipo } from '@/lib/api';
import { FONT, KP, oficioCorto } from '@/lib/theme';

/* Quien abre un link o un QR `…/?unirse=CODIGO` y YA tiene sesión.

   - Atleta: «Juan, fisioterapeuta, quiere… ¿lo agregas a tu equipo?». Él decide.
     Si aún no tiene coach, esa persona pasa a ser su coach principal (como el
     registro con código); si ya tiene, entra a su equipo.
   - Profesional: el código es para sus atletas, no para él.

   Quien NO tiene sesión pasa antes por entrar o registrarse (ver `Entrada`, en
   `App.jsx`) y el código lo espera; quien se registra con él ya queda con esa
   persona de coach y aquí solo se le dice. */

const iniciales = (nombre) => {
  const partes = String(nombre ?? '').trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return '?';
  return (partes.length === 1 ? partes[0].slice(0, 2) : partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
};

const marco = {
  minHeight: '100svh', display: 'flex', flexDirection: 'column', gap: 18, alignItems: 'center',
  justifyContent: 'center', textAlign: 'center', padding: 28, fontFamily: FONT,
  background: 'radial-gradient(1100px 620px at 50% -8%, #e7ecfe 0%, rgba(244,245,248,0) 60%), #f4f5f8',
};

export default function UnirseAlEquipo({ codigo, onTerminar }) {
  const { profile, refreshProfile } = useAuth();
  const [pro, setPro] = useState(undefined); // undefined = buscando · null = no existe
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [listo, setListo] = useState('');

  useEffect(() => {
    let vivo = true;
    profesionalPorReferencia(codigo)
      .then((p) => { if (vivo) setPro(p); })
      .catch(() => { if (vivo) setPro(null); });
    return () => { vivo = false; };
  }, [codigo]);

  const esProfesional = profile?.role === 'admin';
  const yaEsSuCoach = !!pro && profile?.coach_id === pro.id;

  async function agregar() {
    setOcupado(true);
    setError('');
    try {
      const r = await agregarAMiEquipo(codigo);
      if (r?.tipo === 'principal') await refreshProfile?.();
      setListo(r?.tipo === 'principal' ? 'Listo: ahora es tu coach.' : 'Listo: ya está en tu equipo.');
    } catch (e) {
      setError(e.message || 'No se pudo agregar.');
      setOcupado(false);
    }
  }

  const boton = (principal) => ({
    padding: '14px 22px', borderRadius: 999, cursor: 'pointer', fontFamily: FONT, fontSize: 15, fontWeight: 800,
    border: principal ? 'none' : `1.5px solid ${KP.line}`,
    background: principal ? `linear-gradient(140deg, ${KP.blue}, ${KP.blueDk})` : KP.surface,
    color: principal ? '#fff' : KP.ink, boxShadow: principal ? KP.shBtn : 'none', touchAction: 'manipulation',
  });

  if (pro === undefined) {
    return <div style={marco}><Loader2 size={22} className="spin" color={KP.ink2} /></div>;
  }

  return (
    <div style={marco}>
      <div style={{ maxWidth: 380, width: '100%' }}>
        {pro === null ? (
          <>
            <h1 style={{ fontSize: 21, fontWeight: 800, color: KP.ink, margin: '0 0 8px' }}>No encontramos ese código</h1>
            <p style={{ fontSize: 15, color: KP.ink2, lineHeight: 1.55, margin: 0, fontWeight: 500 }}>
              Revisa que el link o el QR estén completos, o pídele a esa persona que te lo mande otra vez.
            </p>
          </>
        ) : (
          <>
            <span style={{
              width: 76, height: 76, borderRadius: '50%', display: 'inline-grid', placeItems: 'center', marginBottom: 14,
              background: `linear-gradient(140deg, ${KP.blue}, ${KP.blueDk})`, color: '#fff', fontWeight: 800, fontSize: 26,
              overflow: 'hidden', boxShadow: KP.shBtn,
            }}>
              {pro.avatar_url
                ? <img src={pro.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : iniciales(pro.full_name)}
            </span>
            <h1 style={{ fontSize: 21, fontWeight: 800, color: KP.ink, margin: '0 0 4px', overflowWrap: 'anywhere' }}>{pro.full_name}</h1>
            {pro.profesion && (
              <div style={{ fontSize: 14.5, fontWeight: 700, color: KP.ink2, marginBottom: 12 }}>{oficioCorto(pro.profesion)}</div>
            )}
            {esProfesional ? (
              <p style={{ fontSize: 15, color: KP.ink2, lineHeight: 1.55, margin: 0, fontWeight: 500 }}>
                Este código es para tus atletas: lo escanean o lo abren ellos para agregarte a su equipo.
              </p>
            ) : listo ? (
              <p role="status" style={{ fontSize: 16, color: '#00805A', lineHeight: 1.55, margin: 0, fontWeight: 800 }}>{listo}</p>
            ) : yaEsSuCoach ? (
              <p style={{ fontSize: 15, color: KP.ink2, lineHeight: 1.55, margin: 0, fontWeight: 500 }}>
                Ya es tu coach: quedaste con {pro.full_name} al crear tu cuenta.
              </p>
            ) : (
              <p style={{ fontSize: 15, color: KP.ink2, lineHeight: 1.55, margin: 0, fontWeight: 500 }}>
                ¿Lo agregas a tu equipo? Podrá ver tu plan de entrenamiento y cómo vas. Tú decides: puedes quitarlo cuando quieras.
              </p>
            )}
          </>
        )}
        {error && <div role="alert" style={{ marginTop: 12, fontSize: 14, fontWeight: 700, color: '#DC2626' }}>{error}</div>}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 320 }}>
        {pro && !esProfesional && !listo && !yaEsSuCoach ? (
          <>
            <button type="button" onClick={agregar} disabled={ocupado} className="kp-press" style={boton(true)}>
              {ocupado ? <Loader2 size={16} className="spin" /> : <Check size={16} strokeWidth={3} />} Agregar a mi equipo
            </button>
            <button type="button" onClick={onTerminar} style={boton(false)}>Ahora no</button>
          </>
        ) : (
          <button type="button" onClick={onTerminar} className="kp-press" style={boton(true)}>Continuar</button>
        )}
      </div>
      <style>{'.spin{animation:spin .8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}'}</style>
    </div>
  );
}
