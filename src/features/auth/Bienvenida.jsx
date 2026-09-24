import { useState } from 'react';
import { ArrowRight, AtSign, Loader2, User, UserCheck } from 'lucide-react';
import { Field, SelectorOficio } from '@/features/auth/AuthScreen';
import { useAuth } from '@/contexts/AuthContext';
import { completarMiPerfil } from '@/lib/api';
import { FONT, KP } from '@/lib/theme';

/**
 * Terminar de crear la cuenta de quien entró con Google.
 *
 * POR QUÉ EXISTE. Google solo entrega correo y nombre. Con eso no alcanza: la
 * app necesita saber el NOMBRE DE USUARIO (es con lo que un atleta encuentra a
 * su entrenador) y si la persona viene a seguir un plan o a crearlos. Sin esta
 * pantalla, la cuenta nacía con un usuario inventado a partir del correo y
 * SIEMPRE como atleta — un coach que entrara con Google quedaba de atleta y no
 * tenía forma de arreglarlo desde la app.
 *
 * Es obligatoria y no se puede saltar: mientras `perfil_completo` sea false,
 * esto es lo único que se ve. Se guarda de una sola vez con
 * `completar_mi_perfil`, que valida el usuario, comprueba que no esté tomado y
 * resuelve el coach. Esa función solo corre UNA vez por cuenta: después, el rol
 * lo cambia el master y nadie más.
 */
export default function Bienvenida() {
  const { profile, refreshProfile, signOut } = useAuth();

  const [tipo, setTipo] = useState('athlete'); // 'athlete' | 'coach'
  const [usuario, setUsuario] = useState(profile?.username || '');
  const [nombre, setNombre] = useState(profile?.full_name || '');
  const [profesion, setProfesion] = useState('');
  const [coachUsuario, setCoachUsuario] = useState('');
  const [genero, setGenero] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await completarMiPerfil({
        usuario: usuario.trim(),
        tipo,
        nombre: nombre.trim(),
        profesion: tipo === 'coach' ? profesion : '',
        coachUsuario: tipo === 'athlete' ? coachUsuario.trim() : '',
        genero,
      });
      await refreshProfile();
    } catch (err) {
      setError(err.message || 'No se pudo terminar de crear tu cuenta');
      setBusy(false);
    }
  }

  const puerta = (v, titulo, sub) => {
    const activo = tipo === v;
    return (
      <button
        key={v}
        type="button"
        onClick={() => setTipo(v)}
        className="kp-press"
        style={{
          flex: 1, textAlign: 'left', padding: '11px 13px', borderRadius: 13, cursor: 'pointer',
          border: `1.5px solid ${activo ? KP.blue : KP.line}`,
          background: activo ? KP.blueSoft : KP.bg,
          boxShadow: activo ? '0 0 0 4px rgba(30,64,224,0.08)' : 'none',
          transition: 'all .15s', fontFamily: FONT,
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 800, color: activo ? KP.blue : KP.ink }}>{titulo}</div>
        <div style={{ fontSize: 11.5, fontWeight: 600, color: KP.ink3, marginTop: 2 }}>{sub}</div>
      </button>
    );
  };

  return (
    <div
      style={{
        minHeight: '100svh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px 18px', fontFamily: FONT,
        background: 'radial-gradient(1100px 620px at 50% -8%, #e7ecfe 0%, rgba(244,245,248,0) 60%), #f4f5f8',
      }}
    >
      <div
        style={{
          width: '100%', maxWidth: 420, background: KP.surface, borderRadius: KP.rCard,
          border: `1px solid ${KP.line}`, boxShadow: KP.shCard, padding: 26,
        }}
      >
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: KP.ink, letterSpacing: -0.4 }}>
            {profile?.full_name ? `Hola, ${profile.full_name.split(' ')[0]}` : 'Ya casi'}
          </div>
          <div style={{ fontSize: 14, color: KP.ink2, marginTop: 6, lineHeight: 1.5, fontWeight: 500 }}>
            Google nos dio tu correo y tu nombre. Falta lo que solo tú sabes.
          </div>
        </div>

        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', color: KP.ink3, marginBottom: 8 }}>
              ¿Qué vas a hacer aquí?
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {puerta('athlete', 'Seguir un plan', 'Alguien me lo hace')}
              {puerta('coach', 'Crear planes', 'Se los hago a otros')}
            </div>
          </div>

          {tipo === 'coach' && <SelectorOficio value={profesion} onChange={setProfesion} />}

          <Field
            icon={User}
            label="Nombre"
            hint="Opcional"
            placeholder="Tu nombre"
            autoComplete="name"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
          <Field
            icon={AtSign}
            label="Usuario"
            hint="Así te encuentran"
            placeholder="tu_usuario"
            autoComplete="username"
            value={usuario}
            onChange={(e) => setUsuario(e.target.value.replace(/\s/g, ''))}
          />

          {tipo === 'athlete' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '2px 0' }}>
                <span style={{ flex: 1, height: 1, background: KP.line }} />
                <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', color: KP.ink3 }}>
                  Opcional
                </span>
                <span style={{ flex: 1, height: 1, background: KP.line }} />
              </div>
              {/* Mismo campo que en el registro: acepta el código del coach o
                  su usuario, y los dos los resuelve `coach_por_referencia`. */}
              <Field
                icon={UserCheck}
                label="Código de tu entrenador"
                hint="o su usuario"
                placeholder="pega aquí su código"
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                value={coachUsuario}
                onChange={(e) => setCoachUsuario(e.target.value.replace(/\s/g, ''))}
              />
            </>
          )}

          <div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', color: KP.ink3, marginBottom: 8 }}>
              Videos de técnica
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { v: 'h', label: 'Hombre' },
                { v: 'm', label: 'Mujer' },
                { v: '', label: 'Prefiero no decir' },
              ].map((o) => {
                const activo = genero === o.v;
                return (
                  <button
                    key={o.v || 'sin'}
                    type="button"
                    onClick={() => setGenero(o.v)}
                    className="kp-press"
                    style={{
                      flex: 1, minHeight: 44, padding: '10px 8px', borderRadius: 13, cursor: 'pointer',
                      border: `1.5px solid ${activo ? KP.blue : KP.line}`,
                      background: activo ? KP.blueSoft : KP.bg,
                      color: activo ? KP.blue : KP.ink2,
                      transition: 'all .15s', fontFamily: FONT,
                      fontSize: 13, fontWeight: 700, lineHeight: 1.2,
                    }}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: KP.ink3, marginTop: 7, lineHeight: 1.45 }}>
              Opcional. Si un ejercicio está grabado en dos versiones, te muestra la tuya.
            </div>
          </div>

          {error && (
            <div
              role="alert"
              style={{
                background: KP.dangerSoft, color: KP.danger, borderRadius: 12,
                padding: '11px 14px', fontSize: 13.5, fontWeight: 600, lineHeight: 1.45,
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="kp-press"
            style={{
              marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '15px 0', borderRadius: KP.rBtn, border: 'none',
              cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.7 : 1,
              background: `linear-gradient(140deg, ${KP.blue}, ${KP.blueDk})`,
              color: '#fff', fontFamily: FONT, fontSize: 15.5, fontWeight: 700,
              boxShadow: KP.shBtn,
            }}
          >
            {busy ? <Loader2 size={17} className="spin" /> : null}
            Entrar a Training Lab {!busy && <ArrowRight size={17} />}
          </button>

          {/* Salida por si entró con la cuenta de Google equivocada. Sin esto se
              queda atrapado: la pantalla no se puede saltar. */}
          <button
            type="button"
            onClick={signOut}
            style={{
              border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: FONT,
              fontSize: 13, fontWeight: 700, color: KP.ink3, padding: '4px 0',
            }}
          >
            Entré con la cuenta equivocada
          </button>
        </form>
      </div>
    </div>
  );
}
