import { useEffect, useMemo, useState } from 'react';
import {
  Loader2, Plus, X, Shield, Users, AtSign, IdCard, Mail, Lock, Check, UserPlus, Eye, EyeOff,
  ChevronRight, CalendarDays,
} from 'lucide-react';
import { listCoaches, listAthletes, createCoachAccount } from '@/lib/api';
import { useIsWide } from '@/lib/useViewport';
import { T, FONT, KP } from '@/lib/theme';

const USERNAME_RE = /^[a-zA-Z0-9_.]{3,30}$/;


function Avatar({ name, url, size = 44 }) {
  const initial = (name?.[0] || 'C').toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.3, flexShrink: 0, overflow: 'hidden',
      background: T.accentBg, color: T.accent, display: 'grid', placeItems: 'center',
      fontWeight: 800, fontSize: size * 0.38,
    }}>
      {url ? <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initial}
    </div>
  );
}

function CreateCoachModal({ onClose, onCreated }) {
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function onSave() {
    if (!USERNAME_RE.test(username.trim())) { setErr('Usuario: 3-30 caracteres (letras, números, _ o .)'); return; }
    if (password.length < 6) { setErr('La contraseña debe tener al menos 6 caracteres'); return; }
    setErr('');
    setBusy(true);
    try {
      await createCoachAccount({ username: username.trim(), fullName: fullName.trim(), email: email.trim(), password });
      onCreated();
    } catch (e) {
      setErr(e.message || 'Error al crear el coach');
      setBusy(false);
    }
  }

  const field = (icon, label, node) => (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 12.5, fontWeight: 700, color: T.text2 }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, background: T.bg2, border: `1.5px solid ${T.border}`, borderRadius: 11, padding: '0 12px' }}>
        {icon}{node}
      </div>
    </label>
  );
  const bare = { flex: 1, border: 'none', outline: 'none', background: 'transparent', fontFamily: FONT, fontSize: 14, fontWeight: 500, color: T.text, padding: '11px 0', minWidth: 0 };

  return (
    <div onMouseDown={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 2600, background: 'rgba(17,19,24,0.5)', backdropFilter: 'blur(4px)', display: 'grid', placeItems: 'center', padding: 16 }}>
      <div onMouseDown={(e) => e.stopPropagation()} className="animate-fade-in"
        style={{ width: '100%', maxWidth: 440, background: T.bg, borderRadius: 22, fontFamily: FONT, boxShadow: KP.shPop, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', background: T.bg2, borderBottom: `1px solid ${T.border}` }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: T.text, display: 'flex', alignItems: 'center', gap: 8 }}>
            <UserPlus size={18} color={T.accent} /> Nuevo coach
          </div>
          <button type="button" onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: T.text2, padding: 4 }}>
            <X size={20} />
          </button>
        </div>
        <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {field(<IdCard size={17} color={T.text3} />, 'Nombre completo', <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nombre del coach" style={bare} />)}
          {field(<AtSign size={17} color={T.text3} />, 'Usuario', <input value={username} onChange={(e) => setUsername(e.target.value.replace(/\s/g, ''))} placeholder="usuario_del_coach" autoCapitalize="none" style={bare} />)}
          {field(<Mail size={17} color={T.text3} />, 'Correo (opcional)', <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="coach@correo.com" type="email" style={bare} />)}
          {field(<Lock size={17} color={T.text3} />, 'Contraseña', (
            <>
              <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" type={showPw ? 'text' : 'password'} style={bare} />
              <button type="button" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? 'Ocultar' : 'Ver'} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: T.text3, padding: 4, display: 'grid', placeItems: 'center' }}>
                {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </>
          ))}
          <div style={{ fontSize: 12, color: T.text3, lineHeight: 1.5 }}>
            Comparte estos datos con tu coach. Podrá entrar, ver tu repertorio base y crear el suyo.
          </div>
          {err && <div style={{ background: 'rgba(220,38,38,0.08)', color: T.danger, borderRadius: 11, padding: '11px 14px', fontSize: 13.5, fontWeight: 600 }}>{err}</div>}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 22px', background: T.bg2, borderTop: `1px solid ${T.border}` }}>
          <button type="button" onClick={onClose} style={{ padding: '12px 18px', borderRadius: 12, border: `1.5px solid ${T.border}`, background: T.bg2, cursor: 'pointer', fontFamily: FONT, fontSize: 14, fontWeight: 700, color: T.text2 }}>Cancelar</button>
          <button type="button" onClick={onSave} disabled={busy}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 22px', borderRadius: 12, border: 'none', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.7 : 1, background: `linear-gradient(135deg, ${T.accent}, ${T.accentDk})`, color: '#fff', fontFamily: FONT, fontSize: 14.5, fontWeight: 700, boxShadow: KP.shBtn }}>
            {busy ? <Loader2 size={16} className="spin" /> : <Check size={16} />} Crear coach
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * La ficha de un coach: quién es, a quién entrena, y la puerta a "ver como".
 *
 * POR QUÉ EXISTE. Andrés, 20 sep 2026: "no pasa nada si le pico al coach". La
 * fila nunca tuvo acción, y eso choca con la lista de atletas —donde tocar sí
 * abre la ficha— así que se lee como que la app se trabó.
 *
 * QUÉ ENSEÑA Y QUÉ NO. Lo que el master no puede ver sin cambiarse de vista:
 * a qué atletas entrena este coach, de un vistazo. Lo que NO trae es borrar ni
 * desactivar coaches: eso no existe en la app todavía y tiene una consecuencia
 * que hay que decidir antes —los ejercicios de un coach borrado se quedan sin
 * dueño, y sin dueño significa "de la app, para todos"—.
 */
function FichaCoach({ coach, atletas, onCerrar, onVerComo }) {
  const esAncho = useIsWide();
  const nombre = coach.full_name || coach.username;
  const desde = coach.created_at
    ? new Date(coach.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  const cuerpo = (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 13, marginBottom: 18 }}>
        <Avatar name={nombre} url={coach.avatar_url} size={52} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: T.text, lineHeight: 1.25, overflowWrap: 'anywhere' }}>
            {nombre}
          </div>
          <div style={{ fontSize: 13.5, color: T.text2, fontWeight: 600, marginTop: 2, overflowWrap: 'anywhere' }}>
            @{coach.username}
          </div>
          {coach.profesion && (
            <div style={{ fontSize: 12.5, color: T.text3, fontWeight: 600, marginTop: 3 }}>{coach.profesion}</div>
          )}
        </div>
        <button type="button" onClick={onCerrar} aria-label="Cerrar"
          style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: T.text3, padding: 4, flexShrink: 0 }}>
          <X size={19} />
        </button>
      </div>

      <button
        type="button"
        onClick={onVerComo}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 11, marginBottom: 16,
          border: 'none', borderRadius: 14, padding: '14px 16px', cursor: 'pointer',
          background: `linear-gradient(135deg, ${T.accent}, ${T.accentDk})`, color: '#fff',
          fontFamily: FONT, fontSize: 15, fontWeight: 700, textAlign: 'left', boxShadow: KP.shBtn,
        }}
      >
        <Eye size={18} />
        <span style={{ flex: 1, minWidth: 0 }}>
          Ver la app como {nombre.split(' ')[0]}
          <span style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.82)', marginTop: 2 }}>
            Sus atletas y su repertorio. No estás cambiando de cuenta.
          </span>
        </span>
      </button>

      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.7, textTransform: 'uppercase', color: T.text3, marginBottom: 9 }}>
        Sus atletas ({atletas.length})
      </div>
      {atletas.length === 0 ? (
        <div style={{ fontSize: 13.5, color: T.text2, fontWeight: 600, background: T.bg, borderRadius: 12, padding: '14px 15px', lineHeight: 1.5 }}>
          Todavía no tiene atletas. Se le asignan desde la ficha de cada atleta,
          en «Administrar cuenta».
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {atletas.map((a) => (
            <div key={a.id} style={{
              display: 'flex', alignItems: 'center', gap: 11,
              background: T.bg, borderRadius: 12, padding: '10px 13px',
            }}>
              <Avatar name={a.full_name || a.username} url={a.avatar_url} size={32} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.text, overflowWrap: 'anywhere' }}>
                  {a.full_name || a.username}
                </div>
                <div style={{ fontSize: 12, color: T.text3, fontWeight: 600, overflowWrap: 'anywhere' }}>@{a.username}</div>
              </div>
              {a.is_active === false && (
                <span style={{ fontSize: 11, fontWeight: 800, color: T.warning, flexShrink: 0 }}>Desactivada</span>
              )}
            </div>
          ))}
        </div>
      )}

      {desde && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, marginTop: 16,
          fontSize: 12.5, color: T.text3, fontWeight: 600,
        }}>
          <CalendarDays size={14} /> Su cuenta es del {desde}
        </div>
      )}
    </>
  );

  // En compu flota centrada; en teléfono ocupa la pantalla. Mismo patrón que
  // la ficha del atleta, para que las dos listas se comporten igual.
  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onCerrar(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 900, display: 'grid',
        placeItems: esAncho ? 'center' : 'end stretch',
        padding: esAncho ? 24 : 0, background: 'rgba(17, 19, 24, 0.42)',
      }}
    >
      <div style={{
        width: '100%', maxWidth: esAncho ? 520 : 'none',
        maxHeight: esAncho ? '88vh' : '92svh', overflowY: 'auto',
        background: T.bg2, border: `1px solid ${T.border}`,
        borderRadius: esAncho ? KP.rCard : '22px 22px 0 0',
        padding: esAncho ? 24 : '22px 20px calc(24px + env(safe-area-inset-bottom))',
        boxShadow: KP.shPop,
      }}>
        {cuerpo}
      </div>
    </div>
  );
}

export default function CoachesPanel({ onVerComo }) {
  const esAncho = useIsWide();
  const [coaches, setCoaches] = useState([]);
  const [athletes, setAthletes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [creating, setCreating] = useState(false);
  const [ficha, setFicha] = useState(null); // el coach cuya ficha está abierta

  const load = () => {
    setLoading(true);
    Promise.all([listCoaches(), listAthletes()])
      .then(([c, a]) => { setCoaches(c); setAthletes(a); })
      .catch((e) => setErr(e.message || 'Error al cargar'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const countByCoach = useMemo(() => {
    const m = {};
    athletes.forEach((a) => { if (a.coach_id) m[a.coach_id] = (m[a.coach_id] || 0) + 1; });
    return m;
  }, [athletes]);

  const unassigned = useMemo(() => athletes.filter((a) => a.role !== 'admin' && !a.coach_id).length, [athletes]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: T.text2, fontWeight: 600, padding: 40 }}>
        <Loader2 size={18} className="spin" /> Cargando coaches…
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: T.text }}>Coaches</div>
          <div style={{ fontSize: 13, color: T.text2, fontWeight: 500, marginTop: 2 }}>
            {coaches.length} coach{coaches.length !== 1 ? 'es' : ''} · {unassigned} atleta{unassigned !== 1 ? 's' : ''} sin asignar
          </div>
        </div>
        <button type="button" onClick={() => setCreating(true)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 18px', borderRadius: 12, border: 'none', cursor: 'pointer', background: `linear-gradient(135deg, ${T.accent}, ${T.accentDk})`, color: '#fff', fontFamily: FONT, fontSize: 14.5, fontWeight: 700, boxShadow: KP.shBtn }}>
          <Plus size={18} /> Crear coach
        </button>
      </div>

      {err && <div style={{ background: 'rgba(220,38,38,0.08)', color: T.danger, borderRadius: 12, padding: '12px 16px', fontWeight: 600, marginBottom: 16 }}>{err}</div>}

      {coaches.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '52px 20px', color: T.text3, background: T.bg2, border: `1.5px dashed ${T.borderHi}`, borderRadius: 20 }}>
          <Shield size={38} style={{ opacity: 0.4 }} />
          <div style={{ marginTop: 12, fontWeight: 700, color: T.text, fontSize: 15 }}>Aún no hay coaches</div>
          <div style={{ marginTop: 6, fontWeight: 500, color: T.text2, fontSize: 13.5, lineHeight: 1.5 }}>
            Crea uno tú, o deja que se registren eligiendo «Entreno a otros».
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {coaches.map((c) => (
            /* EN TELÉFONO LA FILA SE PARTE EN DOS.
               Andrés, 18 sep 2026: "mira cómo se apachurran los nombres de los
               coaches en la versión de teléfono, eso hay que arreglarlo". En
               375 px, cuatro cosas en un renglón —foto, nombre, cuántos
               atletas, y "Ver como"— dejan al nombre unos 90 px, y "Andres
               Daniel Tovar Rocabado" se parte en cuatro líneas de una palabra.
               Arriba el nombre con todo el ancho; abajo el conteo y el botón. */
            <div key={c.id} style={{
              display: 'flex', flexDirection: esAncho ? 'row' : 'column',
              alignItems: esAncho ? 'center' : 'stretch',
              gap: esAncho ? 13 : 12,
              background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 16,
              padding: '14px 16px', boxShadow: KP.shCard,
            }}>
              {/* TOCAR AL COACH ABRE SU FICHA.
                  Andrés, 20 sep 2026: "no pasa nada si le pico al coach... el
                  «ver como coach» sí, pero no pasa nada si le pico en general".
                  Nunca tuvo acción —viene así desde que se hizo el sistema
                  multi-coach— y choca con la lista de atletas, donde tocar la
                  fila SÍ abre la ficha. Una fila que no hace nada al tocarla
                  se lee como que la app se trabó. */}
              <button
                type="button"
                onClick={() => setFicha(c)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 13, flex: 1, minWidth: 0,
                  border: 'none', background: 'transparent', cursor: 'pointer',
                  fontFamily: FONT, textAlign: 'left', padding: 0,
                }}
              >
                <Avatar name={c.full_name || c.username} url={c.avatar_url} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: T.text, display: 'flex', alignItems: 'center', gap: 7 }}>
                    {/* `minWidth: 0` en el padre y nada de `nowrap` aquí: el
                        nombre largo se parte por palabras, no por letras. */}
                    <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{c.full_name || c.username}</span>
                    <Shield size={13} color={T.accent} style={{ flexShrink: 0 }} />
                  </div>
                  <div style={{ fontSize: 13, color: T.text2, fontWeight: 500, overflowWrap: 'anywhere' }}>@{c.username}</div>
                </div>
                <ChevronRight size={17} color={T.text3} style={{ flexShrink: 0 }} />
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13.5, fontWeight: 700, color: T.text2, background: T.bg, borderRadius: 10, padding: '8px 12px', flexShrink: 0 }}>
                  <Users size={15} color={T.text3} /> {countByCoach[c.id] || 0}
                </div>
                {/* Entrar a ver lo suyo. Es un filtro, no un cambio de cuenta:
                    el master ya puede leer estos datos, esto solo los enseña
                    juntos y sin revolverlos con los propios. */}
                <button
                  type="button"
                  onClick={() => onVerComo?.(c)}
                  title={`Ver el perfil de ${c.full_name || c.username}`}
                  style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                    flex: esAncho ? '0 0 auto' : 1,
                    minHeight: 38, padding: '0 13px', borderRadius: 10, cursor: 'pointer',
                    border: `1.5px solid ${T.border}`, background: T.bg2, color: T.text2,
                    fontFamily: FONT, fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap',
                  }}
                >
                  <Eye size={15} /> Ver como
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {ficha && (
        <FichaCoach
          coach={ficha}
          atletas={athletes.filter((a) => a.coach_id === ficha.id)}
          onCerrar={() => setFicha(null)}
          onVerComo={() => { const c = ficha; setFicha(null); onVerComo?.(c); }}
        />
      )}

      {creating && (
        <CreateCoachModal
          onClose={() => setCreating(false)}
          onCreated={() => { setCreating(false); load(); }}
        />
      )}
    </div>
  );
}
