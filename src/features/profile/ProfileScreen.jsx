import { useEffect, useRef, useState } from 'react';
import { AVISO_ABRE_PERFIL } from '@/lib/abrePerfil';
import {
  X, Loader2, User as UserIcon, Users, Sparkles, Library, ChevronLeft, ChevronRight, HeartPulse, KeyRound, ShoppingBag, Wallet, Watch, Bell,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePalabras } from '@/contexts/PalabrasContext';
import { uploadAvatar, isUsernameAvailable } from '@/lib/api';
import { esImagen, optimizaImagen } from '@/lib/imagen';
import { T, FONT, KP, UI, eyebrow, oficioCorto } from '@/lib/theme';
import { useIsDesktop } from '@/lib/useViewport';
import { esCorreoInventado } from '@/lib/correos';
import { useAviso } from '@/components/AvisoPasajero';
import HojaFlotante from '@/components/HojaFlotante';
import {
  Boton, BotonEnAzul, Campo, Fila, FilaElegir, Grupo, IconoDeFila, Interruptor, PestanasLaterales, TarjetaHeroe,
} from '@/components/ui';
import ConectarIA from '@/features/ia/ConectarIA';
import MiEquipo from '@/features/profile/MiEquipo';
import MisEjercicios from '@/features/profile/MisEjercicios';
import ConfiguracionDeCuenta from '@/features/profile/ConfiguracionDeCuenta';
import MisCompras from '@/features/profile/MisCompras';
import MisCobros from '@/features/profile/MisCobros';
import MisDispositivos from '@/features/profile/MisDispositivos';
import MisAvisos from '@/features/profile/MisAvisos';
import TarjetaDeMisMetricas from '@/features/metricas/TarjetaDeMisMetricas';
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

/* Lo mismo que se contesta en el inicio se cambia aquí (Andrés, 8 oct 2026: ninguna respuesta del inicio es definitiva).
   El coach: a qué se dedica, qué entrena y si trabaja en equipo. El atleta: su fecha de nacimiento. Y los dos pueden ver
   el recorrido otra vez. */
export default function ProfileScreen({ onClose, enfoque = null }) {
  const { profile, user, isAdmin, updateProfile } = useAuth();
  const isMaster = !!profile?.is_owner;
  /* «Mi perfil» va por secciones, no todo junto (Andrés, 6 oct 2026): tus datos, tu equipo (solo el
     atleta decide quién más lo atiende), tus ejercicios (solo el coach) y la inteligencia artificial.
     Llegando desde «Conectar con IA» del menú de la cuenta se abre directo la de la IA (`enfoque`); con `abrePerfil('dispositivos')`, en Dispositivos. */
  const secciones = [
    { id: 'perfil', texto: 'Perfil', Icono: UserIcon },
    { id: 'cuenta', texto: 'Cuenta', Icono: KeyRound },
    // Lo que compró (atleta) o lo que cobra (profesional; el dueño no: vende al 0 %).
    ...(!isAdmin ? [{ id: 'compras', texto: 'Compras', Icono: ShoppingBag }] : []),
    ...(isAdmin && !isMaster ? [{ id: 'cobros', texto: 'Cobros', Icono: Wallet }] : []),
    { id: 'dispositivos', texto: 'Dispositivos', Icono: Watch },
    { id: 'avisos', texto: 'Avisos', Icono: Bell },
    ...(!isAdmin ? [{ id: 'equipo', texto: 'Mi equipo', Icono: Users }, { id: 'metricas', texto: 'Mis métricas', Icono: HeartPulse }] : []),
    // El master no: los ejercicios de Training Lab SON los suyos.
    ...(isAdmin && !isMaster ? [{ id: 'ejercicios', texto: 'Mis ejercicios', Icono: Library }] : []),
    { id: 'ia', texto: 'Inteligencia artificial', Icono: Sparkles },
  ];
  /* EN EL TELÉFONO, UNA LISTA (Andrés, 15 oct 2026: las pestañas de arriba «se deslizan hacia la derecha… está medio confuso»; eligió la lista
     de secciones, como Ajustes del iPhone). `null` = la lista; tocar una entra y la flecha regresa. En la compu no hay lista: el menú de la
     izquierda siempre se ve y abre en «Perfil». */
  const [seccion, setSeccion] = useState(() => (secciones.some((x) => x.id === enfoque) ? enfoque : null));
  // Ya abierto, otra pantalla pide una sección («Conecta tu Apple Watch en Mi perfil → Dispositivos»): entra a ella.
  useEffect(() => {
    const alAviso = (e) => { const id = e.detail?.seccion; if (id) setSeccion(id); };
    window.addEventListener(AVISO_ABRE_PERFIL, alAviso);
    return () => window.removeEventListener(AVISO_ABRE_PERFIL, alAviso);
  }, []);
  // En la compu Mi perfil deja ver la barra lateral: tocarla lo cierra (ver `BarraLateral`).
  const cierra = useRef(onClose);
  useEffect(() => { cierra.current = onClose; });
  useEffect(() => {
    const alAviso = () => cierra.current?.();
    window.addEventListener('tl:cerrar-perfil', alAviso);
    return () => window.removeEventListener('tl:cerrar-perfil', alAviso);
  }, []);
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
  const [hoja, setHoja] = useState(null); // null | 'usuario' | 'oficio' | 'disciplinas'
  const [copiado, setCopiado] = useState(false);
  const { avisa, trabajando } = useAviso();
  const { signOut } = useAuth();
  const { coach } = usePalabras();
  const esCompu = useIsDesktop();
  const [nameStatus, setNameStatus] = useState('idle'); // idle|checking|free|taken|invalid|self
  const fileRef = useRef(null);

  const origName = profile?.full_name || '';
  const origUser = profile?.username || '';
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
    if (!esImagen(file)) { avisa('Elige una imagen'); return; }
    setUploading(true);
    try {
      // El formato que sea (el HEIC del iPhone incluido), y achicada: el almacén solo recibe JPG, PNG o WebP de hasta
      // 5 MB, y un avatar no necesita más de 1600 px. El límite se mide sobre lo que de verdad se sube, no sobre lo
      // que se eligió: una foto de 8 MB del carrete cabe sobrada una vez achicada.
      const { archivo: listo } = await optimizaImagen(file);
      if (listo.size > 5 * 1024 * 1024) { avisa('La imagen no debe pasar de 5 MB'); return; }
      const url = await uploadAvatar(listo, user.id);
      setAvatarUrl(url);
      await guarda({ avatar_url: url }, 'Foto guardada');
    } catch (e2) {
      avisa(e2.message || 'No se pudo subir la foto');
    } finally {
      setUploading(false);
    }
  }

  /* Cada dato se guarda al cambiarlo, con su aviso abajo («Guardado»). Si falla, el aviso dice por qué. */
  async function guarda(cambios, listo = 'Guardado') {
    try {
      await trabajando('Guardando…', async () => {
        const { error } = await updateProfile(cambios);
        if (error) throw error;
      }, listo);
    } catch (e) {
      avisa(e?.message || 'No se pudo guardar');
    }
  }
  const guardaNombre = () => { if (fullName.trim() !== origName) guarda({ full_name: fullName.trim() || null }); };
  async function guardaUsuario() {
    const u = username.trim();
    if (!USERNAME_RE.test(u) || nameStatus !== 'free') return;
    setSaving(true);
    await guarda({ username: u });
    setSaving(false);
    setHoja(null);
  }
  const copiaCodigo = async () => {
    try { await navigator.clipboard.writeText(profile?.codigo_coach || ''); setCopiado(true); setTimeout(() => setCopiado(false), 1800); } catch { /* sin portapapeles: se lee en pantalla */ }
  };

  const nameHint = {
    checking: { text: 'Comprobando…', color: T.text3 },
    free: { text: 'Disponible', color: '#00A372' },
    taken: { text: 'Ya está en uso', color: T.danger },
    invalid: { text: '3-30 caracteres: letras, números, _ o .', color: T.text3 },
    self: null,
    idle: null,
  }[nameStatus];

  const displayName = fullName || username || 'Tu perfil';
  const nombreCoach = (coach?.full_name || '').trim();
  const correoVisible = esCorreoInventado(user?.email) ? 'Sin correo' : (user?.email || 'Sin correo');
  const fechaTexto = nacimiento ? new Date(`${nacimiento}T12:00:00`).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

  /* REESTRUCTURA VISUAL (15 oct 2026), como «Mi perfil» de las capturas de Andrés. Cada dato es un renglón con su valor y se guarda al
     cambiarlo (sin el botón «Guardar» de arriba, que era fácil de olvidar). En el teléfono, las secciones son una lista que entra y sale;
     en la compu, un menú a la izquierda. */
  const cerrarSesion = (
    <button type="button" onClick={signOut} className="kp-press" style={{ alignSelf: 'center', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: FONT, fontSize: 16, fontWeight: 700, color: KP.danger, padding: '10px 18px' }}>
      Cerrar sesión
    </button>
  );
  const actual = seccion ?? (esCompu ? 'perfil' : null);
  const textoDe = (id) => (id === 'perfil' ? 'Mis datos' : secciones.find((x) => x.id === id)?.texto ?? 'Mi perfil');
  const filaDe = (id) => {
    const x = secciones.find((y) => y.id === id);
    if (!x) return null;
    return <Fila key={id} izquierda={<IconoDeFila><x.Icono size={18} /></IconoDeFila>} texto={x.texto} onClick={() => setSeccion(id)} />;
  };

  /* La lista del teléfono: arriba la foto y el nombre; luego las secciones en dos grupos (lo de la cuenta, y lo del entreno y la IA). */
  const menu = (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '4px 0 6px' }}>
        <button
          type="button" onClick={() => setSeccion('perfil')} aria-label="Mis datos" className="kp-press"
          style={{ width: 96, height: 96, borderRadius: 30, overflow: 'hidden', border: 'none', padding: 0, cursor: 'pointer', background: KP.blueSoft, color: KP.blue, fontFamily: FONT, fontSize: 34, fontWeight: 800, display: 'grid', placeItems: 'center' }}
        >
          {avatarUrl ? <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initialsFrom(displayName)}
        </button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 21, fontWeight: 800, color: T.text }}>{displayName}</div>
          {origUser && <div style={{ fontSize: 14.5, fontWeight: 600, color: KP.ink2, marginTop: 2 }}>@{origUser}</div>}
        </div>
      </div>
      <Grupo>
        <Fila izquierda={<IconoDeFila><UserIcon size={18} /></IconoDeFila>} texto="Mis datos" detalle="Nombre, usuario, foto y más" onClick={() => setSeccion('perfil')} />
      </Grupo>
      <Grupo>{['cuenta', 'compras', 'cobros', 'dispositivos', 'avisos'].map(filaDe)}</Grupo>
      <Grupo>{['equipo', 'metricas', 'ejercicios', 'ia'].map(filaDe)}</Grupo>
      {cerrarSesion}
    </>
  );

  const perfil = (
    <>
      {/* La foto: cuadro azul claro con las iniciales, o la foto. Se sube y se guarda sola. */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        <button
          type="button" onClick={() => fileRef.current?.click()} aria-label={avatarUrl ? 'Cambiar foto' : 'Subir foto'} className="kp-press"
          style={{ position: 'relative', width: 116, height: 116, borderRadius: 34, overflow: 'hidden', border: 'none', padding: 0, cursor: 'pointer', background: KP.blueSoft, color: KP.blue, fontFamily: FONT, fontSize: 40, fontWeight: 800, display: 'grid', placeItems: 'center' }}
        >
          {avatarUrl ? <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initialsFrom(displayName)}
          {uploading && <span style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'grid', placeItems: 'center' }}><Loader2 size={26} color="#fff" className="spin" /></span>}
        </button>
        <div style={{ display: 'flex', gap: 16 }}>
          <Boton tipo="texto" chico onClick={() => fileRef.current?.click()}>{avatarUrl ? 'Cambiar foto' : 'Subir foto'}</Boton>
          {avatarUrl && <Boton tipo="texto" chico estilo={{ color: KP.ink2 }} onClick={() => { setAvatarUrl(''); guarda({ avatar_url: null }, 'Foto quitada'); }}>Quitar</Boton>}
        </div>
      </div>

      <Campo etiqueta="Nombre" valor={fullName} onCambio={setFullName} marcador="Tu nombre" onBlur={guardaNombre} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} />

      <Grupo>
        <Fila texto="Usuario" valor={`@${origUser}`} onClick={() => { setUsername(origUser); setHoja('usuario'); }} />
        <Fila texto="Correo" valor={correoVisible} valorTono={correoVisible === 'Sin correo' ? 'neutro' : 'azul'} onClick={() => setSeccion('cuenta')} />
        {isAdmin && <Fila texto="Oficio" valor={oficioCorto(profesion) || 'Elegir'} valorTono={profesion ? 'azul' : 'neutro'} onClick={() => setHoja('oficio')} />}
        {isAdmin && <Fila texto="Disciplinas" valor={disciplinas.length ? disciplinas.join(', ') : 'Elegir'} valorTono={disciplinas.length ? 'azul' : 'neutro'} onClick={() => setHoja('disciplinas')} />}
        <FilaElegir
          texto="Unidad de peso" titulo="Peso en" valor={unidad}
          opciones={[{ valor: 'kg', texto: 'kg', detalle: 'Kilos' }, { valor: 'lb', texto: 'lb', detalle: 'Libras' }]}
          onCambio={(v) => { setUnidad(v); guarda({ unidad_peso: v }); }}
        />
        {/* Sexo: por dentro sirve para UNA sola cosa (si un ejercicio tiene grabada la versión de hombre y la de mujer, mostrar la que
            corresponde). A la persona NO se le dice para qué sirve (Andrés, 6 oct 2026: «que ni siquiera se enteren»). */}
        <FilaElegir
          texto="Sexo" valor={genero}
          opciones={[{ valor: 'h', texto: 'Hombre' }, { valor: 'm', texto: 'Mujer' }, { valor: '', texto: 'Prefiero no decir' }]}
          onCambio={(v) => { setGenero(v); guarda({ genero: v || null }); }}
        />
        {/* Fecha de nacimiento del atleta: para sus zonas de esfuerzo y para que su entrenador sepa su edad. */}
        {!isAdmin && (
          <Fila
            texto="Fecha de nacimiento"
            derecha={(
              <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 15.5, fontWeight: 600, color: nacimiento ? KP.blue : KP.ink3 }}>{fechaTexto || 'Elegir'}</span>
                <ChevronRight size={18} color={KP.ink3} />
                <input
                  type="date" value={nacimiento} aria-label="Fecha de nacimiento" max={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => { setNacimiento(e.target.value); guarda({ fecha_nacimiento: e.target.value || null }); }}
                  style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
                />
              </span>
            )}
          />
        )}
        {isAdmin && (
          <Fila texto="Trabajo con más profesionales" derecha={<Interruptor activo={equipo} etiqueta="Trabajo con más profesionales" onCambio={(v) => { setEquipo(v); guarda({ trabaja_en_equipo: v }); }} />} />
        )}
      </Grupo>

      {/* El atleta: su coach, y de ahí a su equipo. El coach: su código, el que el atleta pega al registrarse. */}
      {!isAdmin && nombreCoach && (
        <TarjetaHeroe etiqueta={tr('Tu coach')} titulo={nombreCoach} accion={<BotonEnAzul onClick={() => setSeccion('equipo')}>Mi equipo</BotonEnAzul>} />
      )}
      {isAdmin && profile?.codigo_coach && (
        <TarjetaHeroe
          etiqueta={tr('Tu código de coach')} titulo={<span style={{ letterSpacing: 2 }}>{profile.codigo_coach}</span>}
          accion={<BotonEnAzul onClick={copiaCodigo}>{copiado ? 'Copiado' : 'Copiar'}</BotonEnAzul>}
        />
      )}

      {/* El recorrido del inicio, otra vez: qué hace cada parte de la app. */}
      <Grupo>
        <Fila texto="Ver el recorrido otra vez" onClick={() => setRecorrido(true)} />
      </Grupo>

      {/* En el teléfono «Cerrar sesión» va al final de la lista de secciones; aquí, solo en la compu. */}
      {esCompu && cerrarSesion}
    </>
  );

  const contenido = (
    <>
      {actual === null && menu}
      {actual === 'perfil' && perfil}

      {/* La cuenta en sí: correo, contraseña, sesiones, descargar sus datos y eliminarla (ver `ConfiguracionDeCuenta`). */}
      {actual === 'cuenta' && <ConfiguracionDeCuenta />}

      {actual === 'compras' && !isAdmin && <MisCompras />}
      {actual === 'cobros' && isAdmin && !isMaster && <MisCobros />}
      {actual === 'dispositivos' && <MisDispositivos onIrAMetricas={!isAdmin ? () => setSeccion('metricas') : null} />}
      {actual === 'avisos' && <MisAvisos />}

      {/* Un atleta decide quién más lo atiende (fisio…). Los profesionales no lo tienen. */}
      {actual === 'equipo' && !isAdmin && <MiEquipo />}

      {/* Las métricas de su reloj: pulso, ritmo, carga y recuperación. Las ve él y quien lo atiende. */}
      {actual === 'metricas' && !isAdmin && <TarjetaDeMisMetricas atleta={{ id: user.id, full_name: profile?.full_name, username: profile?.username, unidad_peso: profile?.unidad_peso }} />}

      {/* El coach: los ejercicios de Training Lab prendidos o apagados, volver al original, borrar todo lo suyo. */}
      {actual === 'ejercicios' && isAdmin && !isMaster && <MisEjercicios />}

      {/* En el teléfono es el ÚNICO sitio de esto: no va en la navegación (decisión de Andrés). En la compu el coach también lo tiene
          en el menú lateral; el atleta, solo aquí. */}
      {actual === 'ia' && <ConectarIA enPerfil />}
    </>
  );

  const pestanas = secciones.map(({ id, texto }) => ({ id, texto }));

  return (
    /* En la compu se abre DENTRO del marco: deja ver la barra lateral azul (reestructura visual, 16 oct 2026, como «Mi perfil · Computadora»
       de las capturas). Quien dibuja la barra pone su ancho en `--ancho-barra-lateral`; tocar la barra cierra Mi perfil. */
    <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, left: esCompu ? 'var(--ancho-barra-lateral, 0px)' : 0, zIndex: 3000, background: UI.fondo, fontFamily: FONT, display: 'flex', flexDirection: 'column' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, padding: esCompu ? '22px 28px 14px' : 'calc(12px + env(safe-area-inset-top)) 16px 8px', flexShrink: 0 }}>
        {!esCompu && (
          <button
            type="button" onClick={actual ? () => setSeccion(null) : onClose} aria-label={actual ? 'Volver a Mi perfil' : 'Volver'}
            style={{ width: 42, height: 42, borderRadius: 13, border: 'none', background: UI.relleno, color: T.text, cursor: 'pointer', display: 'grid', placeItems: 'center', flexShrink: 0 }}
          >
            <ChevronLeft size={21} />
          </button>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          {esCompu && <div style={eyebrow(KP.blue)}>{displayName}</div>}
          <h1 style={{ margin: esCompu ? '6px 0 0' : 0, fontSize: esCompu ? 30 : 26, fontWeight: 800, color: T.text, letterSpacing: -0.5 }}>
            {esCompu || !actual ? 'Mi perfil' : textoDe(actual)}
          </h1>
        </div>
        {esCompu && (
          <button type="button" onClick={onClose} aria-label="Cerrar" style={{ width: 40, height: 40, borderRadius: 13, border: 'none', background: UI.relleno, color: KP.ink2, cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
            <X size={19} />
          </button>
        )}
      </header>

      {/* Al cambiar de sección se vuelve a montar y empieza arriba (si no, abría donde se quedó el desplazamiento de la anterior). */}
      <main key={actual ?? 'lista'} style={{ flex: 1, overflowY: 'auto', padding: esCompu ? '8px 28px 60px' : '12px 16px 60px' }}>
        <input ref={fileRef} type="file" accept="image/*" onChange={onPickFile} style={{ display: 'none' }} />
        <div style={esCompu
          ? { maxWidth: 1060, margin: '0 auto', display: 'grid', gridTemplateColumns: '240px minmax(0, 1fr)', gap: 32, alignItems: 'start' }
          : { maxWidth: 560, margin: '0 auto' }}
        >
          {esCompu && (
            <div style={{ position: 'sticky', top: 0 }}>
              <PestanasLaterales pestanas={pestanas} activa={actual} onCambio={setSeccion} etiqueta="Secciones de Mi perfil" />
            </div>
          )}
          <div style={{ maxWidth: actual === 'ia' ? 820 : 640, width: '100%', display: 'flex', flexDirection: 'column', gap: 20 }}>
            {contenido}
          </div>
        </div>
      </main>

      {/* El nombre de usuario: con él se inicia sesión; se comprueba que esté libre antes de guardarlo. */}
      {hoja === 'usuario' && (
        <HojaFlotante titulo="Nombre de usuario" onCerrar={() => setHoja(null)} ancho={460}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Campo
              etiqueta="Usuario" valor={username} onCambio={(v) => setUsername(v.replace(/\s/g, ''))} marcador="tu_usuario"
              autoCapitalize="none" spellCheck={false} autoFocus
            />
            <div style={{ minHeight: 20, margin: '0 6px', fontSize: 13.5, fontWeight: 600, color: nameHint?.color ?? KP.ink2 }}>
              {nameHint?.text ?? tr('Con este nombre inicias sesión. Cambiarlo no afecta tu plan ni tu progreso.')}
            </div>
            <Boton ancho deshabilitado={nameStatus !== 'free'} cargando={saving} onClick={guardaUsuario}>Guardar</Boton>
          </div>
        </HojaFlotante>
      )}
      {hoja === 'oficio' && (
        <HojaFlotante titulo="A qué te dedicas" onCerrar={() => setHoja(null)} ancho={520}
          pie={<Boton ancho onClick={() => { guarda({ profesion: profesion.trim() || null }); setHoja(null); }}>Listo</Boton>}
        >
          <SelectorOficio value={profesion} onChange={setProfesion} etiqueta="" />
        </HojaFlotante>
      )}
      {hoja === 'disciplinas' && (
        <HojaFlotante titulo="Qué entrenas" onCerrar={() => setHoja(null)} ancho={520}
          pie={<Boton ancho onClick={() => { guarda({ disciplinas }); setHoja(null); }}>Listo</Boton>}
        >
          <SelectorDisciplinas value={disciplinas} onChange={setDisciplinas} />
          <p style={{ margin: '12px 4px 0', fontSize: 13.5, color: KP.ink2 }}>Ordena lo que ves primero. Nunca esconde nada.</p>
        </HojaFlotante>
      )}

      {recorrido && <RecorridoOtraVez onCerrar={() => setRecorrido(false)} />}

      <style>{`.spin{animation:spin .8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
