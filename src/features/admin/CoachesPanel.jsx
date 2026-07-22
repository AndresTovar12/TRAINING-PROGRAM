import { useEffect, useMemo, useState } from 'react';
import {
  Loader2, Plus, X, Shield, Users, AtSign, IdCard, Mail, Lock, Check, UserPlus,
} from 'lucide-react';
import { listCoaches, listAthletes, createCoachAccount } from '@/lib/api';
import { T, FONT, KP } from '@/lib/theme';

const USERNAME_RE = /^[a-zA-Z0-9_.]{3,30}$/;

const inputStyle = {
  border: `1.5px solid ${T.border}`, borderRadius: 11, padding: '11px 13px', width: '100%',
  fontFamily: FONT, fontSize: 14, fontWeight: 500, color: T.text, outline: 'none', background: T.bg2,
  boxSizing: 'border-box',
};

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
          {field(<Lock size={17} color={T.text3} />, 'Contraseña', <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" type="password" style={bare} />)}
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

export default function CoachesPanel() {
  const [coaches, setCoaches] = useState([]);
  const [athletes, setAthletes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [creating, setCreating] = useState(false);

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
            Crea uno tú, o deja que se registren eligiendo "Soy coach".
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {coaches.map((c) => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 13, background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 16, padding: '14px 16px', boxShadow: KP.shCard }}>
              <Avatar name={c.full_name || c.username} url={c.avatar_url} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: T.text, display: 'flex', alignItems: 'center', gap: 7 }}>
                  {c.full_name || c.username}
                  <Shield size={13} color={T.accent} />
                </div>
                <div style={{ fontSize: 13, color: T.text2, fontWeight: 500 }}>@{c.username}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13.5, fontWeight: 700, color: T.text2, background: T.bg, borderRadius: 10, padding: '8px 12px' }}>
                <Users size={15} color={T.text3} /> {countByCoach[c.id] || 0}
              </div>
            </div>
          ))}
        </div>
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
