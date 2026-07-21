import { useEffect, useRef, useState } from 'react';
import {
  X, Camera, Loader2, Check, Shield, User as UserIcon, AtSign, Mail, IdCard, Trash2,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { uploadAvatar, isUsernameAvailable } from '@/lib/api';
import { T, FONT, KP } from '@/lib/theme';

const USERNAME_RE = /^[a-zA-Z0-9_.]{3,30}$/;

function initialsFrom(name) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const label = { fontSize: 11, fontWeight: 800, color: T.text3, textTransform: 'uppercase', letterSpacing: 0.6 };
const inputWrap = {
  display: 'flex', alignItems: 'center', gap: 10, background: T.bg2, borderRadius: 12,
  padding: '0 13px', border: `1.5px solid ${T.border}`,
};
const inputStyle = {
  flex: 1, border: 'none', outline: 'none', background: 'transparent', fontFamily: FONT,
  fontSize: 15, fontWeight: 500, color: T.text, padding: '13px 0', minWidth: 0,
};

export default function ProfileScreen({ onClose }) {
  const { profile, user, isAdmin, updateProfile } = useAuth();

  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [username, setUsername] = useState(profile?.username || '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState(false);
  const [nameStatus, setNameStatus] = useState('idle'); // idle|checking|free|taken|invalid|self
  const fileRef = useRef(null);

  const origName = profile?.full_name || '';
  const origUser = profile?.username || '';
  const origAvatar = profile?.avatar_url || '';
  const dirty = fullName !== origName || username !== origUser || avatarUrl !== origAvatar;

  // Chequeo de disponibilidad del username (debounced)
  useEffect(() => {
    const u = username.trim();
    if (u.toLowerCase() === origUser.toLowerCase()) { setNameStatus('self'); return; }
    if (!USERNAME_RE.test(u)) { setNameStatus('invalid'); return; }
    setNameStatus('checking');
    let cancelled = false;
    const t = setTimeout(async () => {
      const free = await isUsernameAvailable(u, user?.id);
      if (!cancelled) setNameStatus(free ? 'free' : 'taken');
    }, 400);
    return () => { cancelled = true; clearTimeout(t); };
  }, [username, origUser, user?.id]);

  async function onPickFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { setErr('Elige una imagen'); return; }
    if (file.size > 5 * 1024 * 1024) { setErr('La imagen no debe pasar de 5 MB'); return; }
    setErr('');
    setUploading(true);
    try {
      const url = await uploadAvatar(file, user.id);
      setAvatarUrl(url);
    } catch (e2) {
      setErr(e2.message || 'No se pudo subir la foto');
    } finally {
      setUploading(false);
    }
  }

  async function onSave() {
    setErr('');
    setOk(false);
    const u = username.trim();
    if (!USERNAME_RE.test(u)) { setErr('El usuario debe tener 3-30 caracteres (letras, números, _ o .)'); return; }
    if (nameStatus === 'taken') { setErr('Ese nombre de usuario ya está en uso'); return; }
    setSaving(true);
    const { error } = await updateProfile({
      full_name: fullName.trim() || null,
      username: u,
      avatar_url: avatarUrl || null,
    });
    setSaving(false);
    if (error) { setErr(error.message); return; }
    setOk(true);
    setTimeout(() => setOk(false), 2200);
  }

  const nameHint = {
    checking: { text: 'Comprobando…', color: T.text3 },
    free: { text: 'Disponible', color: '#00A372' },
    taken: { text: 'Ya está en uso', color: T.danger },
    invalid: { text: '3-30 caracteres: letras, números, _ o .', color: T.text3 },
    self: null,
    idle: null,
  }[nameStatus];

  const displayName = fullName || username || 'Tu perfil';

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 3000, background: T.bg, fontFamily: FONT, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header
        style={{
          background: 'rgba(255,255,255,0.86)', backdropFilter: 'saturate(180%) blur(16px)',
          borderBottom: `1px solid ${T.border}`, padding: '13px 18px',
          display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
        }}
      >
        <div style={{ flex: 1, fontSize: 16, fontWeight: 800, color: T.text }}>Mi perfil</div>
        <button
          type="button" onClick={onSave} disabled={saving || !dirty || nameStatus === 'taken' || nameStatus === 'invalid'}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 18px', borderRadius: 12,
            border: 'none', cursor: (saving || !dirty) ? 'default' : 'pointer',
            background: dirty && nameStatus !== 'taken' && nameStatus !== 'invalid' ? `linear-gradient(135deg, ${T.accent}, ${T.accentDk})` : T.bg3,
            color: dirty && nameStatus !== 'taken' && nameStatus !== 'invalid' ? '#fff' : T.text3,
            fontFamily: FONT, fontSize: 14, fontWeight: 800,
            boxShadow: dirty ? KP.shBtn : 'none', opacity: saving ? 0.75 : 1,
          }}
        >
          {saving ? <Loader2 size={15} className="spin" /> : ok ? <Check size={15} /> : <Check size={15} />}
          {ok ? 'Guardado' : 'Guardar'}
        </button>
        <button
          type="button" onClick={onClose} aria-label="Cerrar"
          style={{ width: 36, height: 36, borderRadius: 11, border: `1px solid ${T.border}`, cursor: 'pointer', background: T.bg2, color: T.text2, display: 'grid', placeItems: 'center', flexShrink: 0 }}
        >
          <X size={17} />
        </button>
      </header>

      <main style={{ flex: 1, overflowY: 'auto', padding: '28px 18px 60px' }}>
        <div style={{ maxWidth: 460, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 22 }}>
          {/* Avatar */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
            <div style={{ position: 'relative' }}>
              <div
                style={{
                  width: 112, height: 112, borderRadius: '50%', overflow: 'hidden',
                  background: `linear-gradient(140deg, ${KP.blue}, ${KP.blueDk})`,
                  display: 'grid', placeItems: 'center', color: '#fff', fontSize: 40, fontWeight: 800,
                  boxShadow: KP.shBtn,
                }}
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  initialsFrom(displayName)
                )}
                {uploading && (
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'grid', placeItems: 'center', borderRadius: '50%' }}>
                    <Loader2 size={26} color="#fff" className="spin" />
                  </div>
                )}
              </div>
              <button
                type="button" onClick={() => fileRef.current?.click()} aria-label="Cambiar foto"
                style={{
                  position: 'absolute', bottom: 2, right: 2, width: 36, height: 36, borderRadius: '50%',
                  border: `3px solid ${T.bg}`, background: T.accent, color: '#fff', cursor: 'pointer',
                  display: 'grid', placeItems: 'center', boxShadow: KP.shCard,
                }}
              >
                <Camera size={16} />
              </button>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button" onClick={() => fileRef.current?.click()}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: T.accent, fontFamily: FONT, fontSize: 13.5, fontWeight: 700 }}
              >
                {avatarUrl ? 'Cambiar foto' : 'Subir foto'}
              </button>
              {avatarUrl && (
                <button
                  type="button" onClick={() => setAvatarUrl('')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: 'none', background: 'transparent', cursor: 'pointer', color: T.text3, fontFamily: FONT, fontSize: 13.5, fontWeight: 700 }}
                >
                  <Trash2 size={13} /> Quitar
                </button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" onChange={onPickFile} style={{ display: 'none' }} />
          </div>

          {/* Nombre completo */}
          <label style={{ display: 'block' }}>
            <div style={{ ...label, marginBottom: 7 }}>Nombre completo</div>
            <div style={inputWrap}>
              <IdCard size={18} color={T.text3} style={{ flexShrink: 0 }} />
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Tu nombre" style={inputStyle} />
            </div>
          </label>

          {/* Username */}
          <label style={{ display: 'block' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 7 }}>
              <span style={label}>Nombre de usuario</span>
              {nameHint && <span style={{ fontSize: 11.5, fontWeight: 700, color: nameHint.color }}>{nameHint.text}</span>}
            </div>
            <div style={{ ...inputWrap, borderColor: nameStatus === 'taken' ? T.danger : T.border }}>
              <AtSign size={18} color={T.text3} style={{ flexShrink: 0 }} />
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/\s/g, ''))}
                placeholder="tu_usuario"
                autoCapitalize="none" spellCheck={false}
                style={inputStyle}
              />
              {nameStatus === 'checking' && <Loader2 size={15} className="spin" color={T.text3} />}
              {nameStatus === 'free' && <Check size={16} color="#00A372" />}
            </div>
            <div style={{ fontSize: 12, color: T.text3, marginTop: 6, lineHeight: 1.4 }}>
              Con este nombre inicias sesión. Cambiarlo no afecta tu plan ni tu progreso.
            </div>
          </label>

          {/* Email (solo lectura) */}
          <label style={{ display: 'block' }}>
            <div style={{ ...label, marginBottom: 7 }}>Correo</div>
            <div style={{ ...inputWrap, background: T.bg3, opacity: 0.85 }}>
              <Mail size={18} color={T.text3} style={{ flexShrink: 0 }} />
              <input value={profile?.email || user?.email || '—'} readOnly disabled style={{ ...inputStyle, color: T.text2 }} />
            </div>
          </label>

          {/* Rol */}
          <div>
            <div style={{ ...label, marginBottom: 7 }}>Tipo de cuenta</div>
            <span
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 800,
                textTransform: 'uppercase', letterSpacing: 0.6,
                color: isAdmin ? T.accent : T.text2, background: isAdmin ? T.accentBg : T.bg3,
                borderRadius: 9, padding: '7px 12px',
              }}
            >
              {isAdmin ? <Shield size={13} /> : <UserIcon size={13} />}
              {isAdmin ? 'Entrenador (Admin)' : 'Atleta'}
            </span>
          </div>

          {err && (
            <div style={{ background: 'rgba(220,38,38,0.08)', color: T.danger, borderRadius: 12, padding: '11px 15px', fontWeight: 700, fontSize: 13.5 }}>
              {err}
            </div>
          )}
        </div>
      </main>

      <style>{`.spin{animation:spin .8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
