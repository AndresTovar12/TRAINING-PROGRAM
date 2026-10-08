import { useEffect, useRef, useState } from 'react';
import {
  X, Camera, Loader2, Check, Shield, User as UserIcon, Users, Sparkles, AtSign, Mail, IdCard, Trash2,
  Library, Calendar, Map, ChevronRight,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePalabras } from '@/contexts/PalabrasContext';
import { uploadAvatar, isUsernameAvailable } from '@/lib/api';
import { esImagen, optimizaImagen } from '@/lib/imagen';
import { T, FONT, KP } from '@/lib/theme';
import ConectarIA from '@/features/ia/ConectarIA';
import MiEquipo from '@/features/profile/MiEquipo';
import MisEjercicios from '@/features/profile/MisEjercicios';
import SelectorOficio from '@/components/SelectorOficio';
import SelectorDisciplinas from '@/components/SelectorDisciplinas';
import RecorridoOtraVez from '@/features/inicio/RecorridoOtraVez';

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
// Dos o tres opciones en fila, de las que solo una está puesta (kilos/libras, hombre/mujer, equipo/solo yo).
const opcion = (activo) => ({
  flex: 1, padding: '13px 8px', borderRadius: 12, cursor: 'pointer',
  border: `1.5px solid ${activo ? T.accent : T.border}`,
  background: activo ? T.accentBg : T.bg2,
  color: activo ? T.accent : T.text2,
  fontFamily: FONT, fontSize: 14, fontWeight: 700,
});

/* Lo mismo que se contesta en el inicio se cambia aquí (Andrés, 8 oct 2026: ninguna respuesta del inicio es definitiva).
   El coach: a qué se dedica, qué entrena y si trabaja en equipo. El atleta: su fecha de nacimiento. Y los dos pueden ver
   el recorrido otra vez. */
export default function ProfileScreen({ onClose, enfoque = null }) {
  const { profile, user, isAdmin, updateProfile } = useAuth();
  const isMaster = !!profile?.is_owner;
  /* «Mi perfil» va por secciones, no todo junto (Andrés, 6 oct 2026): tus datos, tu equipo (solo el
     atleta decide quién más lo atiende), tus ejercicios (solo el coach) y la inteligencia artificial.
     Llegando desde «Conectar con IA» del menú de la cuenta se abre directo la de la IA. */
  const secciones = [
    { id: 'perfil', texto: 'Perfil', Icono: UserIcon },
    ...(!isAdmin ? [{ id: 'equipo', texto: 'Mi equipo', Icono: Users }] : []),
    // El master no: los ejercicios de Training Lab SON los suyos.
    ...(isAdmin && !isMaster ? [{ id: 'ejercicios', texto: 'Mis ejercicios', Icono: Library }] : []),
    { id: 'ia', texto: 'Inteligencia artificial', Icono: Sparkles },
  ];
  const [seccion, setSeccion] = useState(enfoque === 'ia' ? 'ia' : 'perfil');
  // `tr` y no `t`: arriba hay un `t` de temporizador.
  const { t: tr } = usePalabras();

  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [username, setUsername] = useState(profile?.username || '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '');
  const [unidad, setUnidad] = useState(profile?.unidad_peso || 'kg');
  const [genero, setGenero] = useState(profile?.genero || '');
  const [profesion, setProfesion] = useState(profile?.profesion || '');
  const [disciplinas, setDisciplinas] = useState(profile?.disciplinas || []);
  const [equipo, setEquipo] = useState(!!profile?.trabaja_en_equipo);
  const [nacimiento, setNacimiento] = useState(profile?.fecha_nacimiento || '');
  const [recorrido, setRecorrido] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState(false);
  const [nameStatus, setNameStatus] = useState('idle'); // idle|checking|free|taken|invalid|self
  const fileRef = useRef(null);

  const origName = profile?.full_name || '';
  const origUser = profile?.username || '';
  const origAvatar = profile?.avatar_url || '';
  const origUnidad = profile?.unidad_peso || 'kg';
  const origGenero = profile?.genero || '';
  const origProfesion = profile?.profesion || '';
  const origDisciplinas = (profile?.disciplinas || []).join(',');
  const origEquipo = !!profile?.trabaja_en_equipo;
  const origNacimiento = profile?.fecha_nacimiento || '';
  const dirty = fullName !== origName || username !== origUser || avatarUrl !== origAvatar
    || unidad !== origUnidad || genero !== origGenero
    || (isAdmin && (profesion !== origProfesion || disciplinas.join(',') !== origDisciplinas || equipo !== origEquipo))
    || (!isAdmin && nacimiento !== origNacimiento);

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
    if (!esImagen(file)) { setErr('Elige una imagen'); return; }
    setErr('');
    setUploading(true);
    try {
      // El formato que sea (el HEIC del iPhone incluido), y achicada: el almacén solo recibe JPG, PNG o WebP de hasta
      // 5 MB, y un avatar no necesita más de 1600 px. El límite se mide sobre lo que de verdad se sube, no sobre lo
      // que se eligió: una foto de 8 MB del carrete cabe sobrada una vez achicada.
      const { archivo: listo } = await optimizaImagen(file);
      if (listo.size > 5 * 1024 * 1024) { setErr('La imagen no debe pasar de 5 MB'); return; }
      const url = await uploadAvatar(listo, user.id);
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
      unidad_peso: unidad,
      genero: genero || null,
      // Lo del coach y lo del atleta van por separado: cada quien manda solo lo suyo.
      ...(isAdmin
        ? { profesion: profesion.trim() || null, disciplinas, trabaja_en_equipo: equipo }
        : { fecha_nacimiento: nacimiento || null }),
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
        {seccion === 'perfil' && <button
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
        </button>}
        <button
          type="button" onClick={onClose} aria-label="Cerrar"
          style={{ width: 36, height: 36, borderRadius: 11, border: `1px solid ${T.border}`, cursor: 'pointer', background: T.bg2, color: T.text2, display: 'grid', placeItems: 'center', flexShrink: 0 }}
        >
          <X size={17} />
        </button>
      </header>

      <nav aria-label="Secciones de Mi perfil" style={{ flexShrink: 0, padding: '12px 18px 0' }}>
        <div role="tablist" style={{ maxWidth: 560, margin: '0 auto', display: 'flex', gap: 4, padding: 4, background: T.bg3, borderRadius: 16 }}>
          {secciones.map(({ id, texto, Icono }) => {
            const activa = seccion === id;
            return (
              <button
                key={id} type="button" role="tab" aria-selected={activa} onClick={() => setSeccion(id)}
                style={{
                  flex: 1, minHeight: 46, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                  padding: '6px 8px', borderRadius: 12, border: 'none', cursor: 'pointer', fontFamily: FONT,
                  fontSize: 13.5, fontWeight: 800, lineHeight: 1.15, textAlign: 'center',
                  background: activa ? T.bg2 : 'transparent', color: activa ? T.accent : T.text2,
                  boxShadow: activa ? KP.shCard : 'none',
                }}
              >
                <Icono size={16} strokeWidth={2.4} style={{ flexShrink: 0 }} /> {texto}
              </button>
            );
          })}
        </div>
      </nav>

      <main style={{ flex: 1, overflowY: 'auto', padding: '22px 18px 60px' }}>
        <div style={{ maxWidth: seccion === 'ia' ? 820 : 460, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 22 }}>
          {seccion === 'perfil' && <>
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
              {tr('Con este nombre inicias sesión. Cambiarlo no afecta tu plan ni tu progreso.')}
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

          {/* Lo del coach: a qué se dedica (decide las palabras de la app), qué entrena (ordena lo que ve primero, nunca
              esconde nada) y si trabaja con más profesionales. Es lo mismo que contestó en el inicio. */}
          {isAdmin && (
            <>
              <SelectorOficio value={profesion} onChange={setProfesion} etiqueta="A qué te dedicas" />

              <div>
                <div style={{ ...label, marginBottom: 8 }}>Qué entrenas</div>
                <SelectorDisciplinas value={disciplinas} onChange={setDisciplinas} />
                <div style={{ fontSize: 12, color: T.text3, marginTop: 8, fontWeight: 600, lineHeight: 1.45 }}>
                  Ordena lo que ves primero. Nunca esconde nada.
                </div>
              </div>

              <div>
                <div style={{ ...label, marginBottom: 7 }}>Trabajo con más profesionales</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" onClick={() => setEquipo(true)} style={opcion(equipo)}>Sí, somos un equipo</button>
                  <button type="button" onClick={() => setEquipo(false)} style={opcion(!equipo)}>Por ahora, solo yo</button>
                </div>
              </div>
            </>
          )}

          {/* Unidad de peso.
              Solo cambia como se VEN los pesos: por dentro siempre se guardan
              en kilos. Por eso cambiar de unidad no toca ni un dato del
              historial —los mismos numeros salen expresados de otra forma. */}
          <div>
            <div style={{ ...label, marginBottom: 7 }}>Peso en</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[['kg', 'Kilos'], ['lb', 'Libras']].map(([valor, texto]) => (
                <button key={valor} type="button" onClick={() => setUnidad(valor)} style={{ ...opcion(unidad === valor), padding: '13px 12px', fontSize: 14.5 }}>
                  {texto} <span style={{ opacity: 0.7, fontWeight: 600 }}>({valor})</span>
                </button>
              ))}
            </div>
            <div style={{ fontSize: 12, color: T.text3, marginTop: 7, fontWeight: 600, lineHeight: 1.45 }}>
              Cambia cómo ves los pesos. Tu historial no se toca.
            </div>
          </div>

          {/* Sexo.
              Por dentro sirve para UNA sola cosa: si un ejercicio tiene grabada la version
              de hombre y la de mujer, mostrar la que corresponde. Se puede dejar en blanco
              («Prefiero no decir») y entonces se ve la version general. A la persona NO se
              le dice para que sirve (Andrés, 6 oct 2026: «que ni siquiera se enteren»). */}
          <div>
            <div style={{ ...label, marginBottom: 7 }}>Sexo</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[['h', 'Hombre'], ['m', 'Mujer'], ['', 'Prefiero no decir']].map(([valor, texto]) => (
                <button key={valor || 'sin'} type="button" onClick={() => setGenero(valor)} style={opcion(genero === valor)}>
                  {texto}
                </button>
              ))}
            </div>
          </div>

          {/* Fecha de nacimiento del atleta: para sus zonas de esfuerzo y para que su entrenador sepa su edad. */}
          {!isAdmin && (
            <label style={{ display: 'block' }}>
              <div style={{ ...label, marginBottom: 7 }}>Fecha de nacimiento</div>
              <div style={inputWrap}>
                <Calendar size={18} color={T.text3} style={{ flexShrink: 0 }} />
                <input
                  type="date" value={nacimiento} onChange={(e) => setNacimiento(e.target.value)}
                  max={new Date().toISOString().slice(0, 10)} style={inputStyle}
                />
              </div>
            </label>
          )}

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
              {isAdmin ? tr('Entrenador (Admin)') : tr('Atleta')}
            </span>
          </div>

          {/* El recorrido del inicio, otra vez: qué hace cada parte de la app. */}
          <button
            type="button"
            onClick={() => setRecorrido(true)}
            className="kp-press"
            style={{
              display: 'flex', alignItems: 'center', gap: 12, width: '100%', minHeight: 56, padding: '0 14px', borderRadius: 14,
              border: `1.5px solid ${KP.lineHi}`, background: T.bg2, cursor: 'pointer', fontFamily: FONT, textAlign: 'left',
              touchAction: 'manipulation',
            }}
          >
            <span style={{ width: 34, height: 34, borderRadius: 10, display: 'grid', placeItems: 'center', background: KP.blueSoft, color: KP.blue, flexShrink: 0 }}>
              <Map size={18} />
            </span>
            <span style={{ flex: 1, fontSize: 14.5, fontWeight: 800, color: T.text }}>Ver el recorrido otra vez</span>
            <ChevronRight size={17} color={T.text3} />
          </button>

          {err && (
            <div style={{ background: 'rgba(220,38,38,0.08)', color: T.danger, borderRadius: 12, padding: '11px 15px', fontWeight: 700, fontSize: 13.5 }}>
              {err}
            </div>
          )}

          </>}

          {/* Un atleta decide quién más lo atiende (fisio…). Los profesionales no lo tienen. */}
          {seccion === 'equipo' && !isAdmin && <MiEquipo />}

          {/* El coach: los ejercicios de Training Lab prendidos o apagados, volver al original, borrar todo lo suyo. */}
          {seccion === 'ejercicios' && isAdmin && !isMaster && <MisEjercicios />}

          {/* En el teléfono es el ÚNICO sitio de esto: no va en la navegación
              (decisión de Andrés). En la compu el coach también lo tiene en el
              menú lateral; el atleta, solo aquí. */}
          {seccion === 'ia' && <ConectarIA enPerfil />}
        </div>
      </main>

      {recorrido && <RecorridoOtraVez onCerrar={() => setRecorrido(false)} />}

      <style>{`.spin{animation:spin .8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
