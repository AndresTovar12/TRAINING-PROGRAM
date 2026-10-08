import { useEffect, useState } from 'react';
import {
  Activity, AtSign, Bike, Calendar, Check, ChevronLeft, ChevronRight, Dumbbell, Eye, EyeOff, Flame, HeartPulse,
  Loader2, Lock, Mail, Medal, MoreHorizontal, PersonStanding, Plus, Repeat, Trophy, User, Users, Video, Waves,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useIsWide } from '@/lib/useViewport';
import { supabase } from '@/lib/supabase';
import { agregarAMiEquipo, completarMiPerfil, profesionalPorReferencia } from '@/lib/api';
import { DISCIPLINAS, OFICIOS_DEL_INICIO, convieneRepertorioBase, nombreDeDisciplina } from '@/lib/oficios';
import { FONT, KP, oficioCorto } from '@/lib/theme';
import {
  botonPrimario, cajaDeCampo, cuadroDeIcono, enlace, entrada, error as estiloError, garantia, opcion, rotulo, subtitulo,
  tarjeta, titulo,
} from '@/features/inicio/estilos';
import Recorrido from '@/features/inicio/Recorrido';
import fotoFuerza from '@/assets/landing/fuerza.webp';
import fotoPista from '@/assets/landing/pista.webp';
import fotoYoga from '@/assets/landing/yoga.webp';
import fotoAgilidad from '@/assets/landing/agilidad.webp';

/**
 * El inicio: crear la cuenta y dejar la app armada, una pregunta por pantalla.
 *
 * Andrés, 7-8 oct 2026 (PDF «Experiencia de inicio» y la maqueta aprobada): «la que tenemos es muy vaga». Quería la
 * estructura de Everfit —una pregunta por pantalla, opciones grandes, barra de avance, lo contestado deja la app armada,
 * y un recorrido de lo que la app hace— para el coach y para el atleta. Sus reglas:
 *
 *   · ENTRAR VA PRIMERO. Esto se abre desde «Crear cuenta»; quien ya tiene cuenta no lo ve nunca.
 *   · LA CUENTA NACE TEMPRANO: con usuario, contraseña y (si quiere) correo. Todo lo demás se guarda paso a paso en su
 *     perfil, con `inicio_paso` apuntando a lo que falta: si cierra a la mitad, al volver retoma donde iba (App.jsx vuelve a
 *     abrir esto mientras `inicio_paso` no sea null).
 *   · CON GOOGLE NO SE TECLEA NADA: nombre y correo salen de Google, y el usuario ya lo propuso la base (`handle_new_user`).
 *     Solo falta decir qué tipo de cuenta es (`completar_mi_perfil`) y seguir con las preguntas.
 *   · LO QUE ENTRENA ORDENA, NUNCA QUITA: ninguna respuesta esconde opciones; solo decide qué sale primero.
 *   · NINGUNA RESPUESTA ES UNA PUERTA: «Por ahora, solo yo» y «¿Cómo quieres empezar con tus ejercicios?» dicen con todas
 *     sus letras lo que siempre se podrá hacer, y Mi perfil lo cambia.
 *   · UNA SOLA COLUMNA, también en compu (ahí la pantalla es una tarjeta centrada y más ancha).
 *
 * Tres modos, según de dónde viene la persona:
 *   'nuevo'   sin sesión, desde «Crear cuenta» (o desde un link `?unirse=CÓDIGO`, con el código ya puesto).
 *   'google'  con sesión pero sin tipo de cuenta (`perfil_completo = false`): solo la primera pregunta.
 *   'retomar' con sesión y `inicio_paso` pendiente: lo que falta, desde donde se quedó.
 * App.jsx le pone `key={modo}`: al cambiar de modo se vuelve a armar con la lista de pasos que le toca.
 */

const ICONOS = {
  barra: Dumbbell, trofeo: Trophy, pulso: HeartPulse, actividad: Activity, puntos: MoreHorizontal,
  bici: Bike, olas: Waves, medalla: Medal, flama: Flame, persona: PersonStanding,
};
const FOTOS = { fuerza: fotoFuerza, pista: fotoPista, yoga: fotoYoga, agilidad: fotoAgilidad };

// Todo el camino de cada quien, para la barra de arriba. `listo` y `tour` no cuentan: ya no son preguntas.
const ORDEN_COACH = ['tipo', 'cuenta', 'correo', 'nombre', 'oficio', 'entrena', 'equipo', 'repertorio', 'listo', 'tour'];
const ORDEN_ATLETA = ['tipo', 'cuenta', 'correo', 'nombre', 'codigo', 'sexo', 'unidad', 'nacimiento', 'listo', 'tour'];
const SIN_BARRA = new Set(['listo', 'tour']);
const ANTES_DE_LA_CUENTA = new Set(['tipo', 'cuenta', 'correo']);
const USERNAME_RE = /^[a-zA-Z0-9_.]{3,30}$/;

/* Los pasos que le faltan a ESTE perfil. Se calcula una vez al montar (ver `key` en App.jsx): si se recalculara en cada
   pintada, el paso «nombre» desaparecería en cuanto se guardara el nombre y el botón de atrás ya no sabría a dónde ir. */
function pasosDe(modo, perfil, esCoach) {
  if (modo === 'nuevo') return ['tipo', 'cuenta', 'correo'];
  if (modo === 'google') return ['tipo'];
  const orden = esCoach ? ORDEN_COACH : ORDEN_ATLETA;
  return orden.filter((p) => {
    if (ANTES_DE_LA_CUENTA.has(p)) return false;
    if (p === 'nombre' && (perfil?.full_name || '').trim()) return false;   // Google ya dio el nombre
    if (p === 'codigo' && perfil?.coach_id) return false;                   // ya quedó con su entrenador (código o invitación)
    return true;
  });
}

const parteNombre = (completo = '') => {
  const partes = completo.trim().split(/\s+/).filter(Boolean);
  return { nombre: partes.shift() || '', apellido: partes.join(' ') };
};

function Icono({ nombre, size = 22 }) {
  const C = ICONOS[nombre] || Dumbbell;
  return <C size={size} />;
}

/** El cuadrito con foto o ícono que va a la izquierda de cada opción. */
function Cuadro({ foto, icono, color, puesta }) {
  if (foto) {
    return (
      <span style={cuadroDeIcono()}>
        <img src={FOTOS[foto]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      </span>
    );
  }
  const c = color || KP.blue;
  return <span style={cuadroDeIcono(puesta ? c : `${c}22`, puesta ? '#fff' : c)}><Icono nombre={icono} /></span>;
}

function Campo({ id, label, icono: IconoCampo, tipo = 'text', value, onChange, extra = {}, ojo = false }) {
  const [foco, setFoco] = useState(false);
  const [ver, setVer] = useState(false);
  return (
    <label htmlFor={id} style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 14 }}>
      <span style={rotulo}>{label}</span>
      <span style={cajaDeCampo(foco)}>
        <IconoCampo size={18} color={foco ? KP.blue : KP.ink3} style={{ flexShrink: 0 }} />
        <input
          id={id}
          type={ojo && ver ? 'text' : tipo}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFoco(true)}
          onBlur={() => setFoco(false)}
          autoComplete="off"
          style={entrada}
          {...extra}
        />
        {ojo && (
          <button
            type="button" onClick={() => setVer((v) => !v)} aria-label={ver ? 'Ocultar contraseña' : 'Ver contraseña'}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: KP.ink3, padding: 4, display: 'grid', placeItems: 'center' }}
          >
            {ver ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </span>
    </label>
  );
}

function Garantia({ children }) {
  return (
    <div style={garantia}>
      <span style={cuadroDeIcono('#fff', KP.blue, 30)}><Repeat size={16} /></span>
      <span>{children}</span>
    </div>
  );
}

export default function Inicio({ modo = 'nuevo', codigo = '', onVolver, onCuentaCreada }) {
  const { profile, signUp, updateProfile, refreshProfile } = useAuth();
  const compu = useIsWide();

  // Lo de ANTES de la cuenta vive aquí; lo de después, en el perfil.
  const [tipo, setTipo] = useState(modo === 'nuevo' && codigo ? 'atleta' : null);
  const [usuario, setUsuario] = useState('');
  const [clave, setClave] = useState('');
  const [correo, setCorreo] = useState('');

  const esCoach = modo === 'nuevo' ? tipo === 'coach' : profile?.role === 'admin';
  const [pasos] = useState(() => pasosDe(modo, profile, profile?.role === 'admin'));
  const [i, setI] = useState(() => Math.max(0, pasos.indexOf(profile?.inicio_paso)));
  const paso = pasos[i] ?? pasos[0];
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');

  // Lo que se está contestando en la pantalla de ahora, con lo que el perfil ya traía.
  const [nombre, setNombre] = useState(() => parteNombre(profile?.full_name).nombre);
  const [apellido, setApellido] = useState(() => parteNombre(profile?.full_name).apellido);
  const [oficio, setOficio] = useState(() => {
    const p = profile?.profesion || '';
    return !p ? null : OFICIOS_DEL_INICIO.some((o) => o.valor === p) ? p : 'otro';
  });
  const [otro, setOtro] = useState(() => (profile?.profesion && !OFICIOS_DEL_INICIO.some((o) => o.valor === profile.profesion) ? profile.profesion : ''));
  const [entrena, setEntrena] = useState(() => new Set(profile?.disciplinas ?? []));
  const [repertorio, setRepertorio] = useState(null); // null = todavía no se decidió: se propone según lo que entrena
  const [textoCodigo, setTextoCodigo] = useState('');
  const [pro, setPro] = useState(null);   // a quién apunta el código escrito
  const [nac, setNac] = useState(profile?.fecha_nacimiento || '');
  const [coachNombre, setCoachNombre] = useState(null);

  // Al cambiar de pantalla, arriba. En la compu el marco tiene su propio scroll; en el teléfono es la página.
  useEffect(() => { window.scrollTo(0, 0); setError(''); }, [i]);

  // ¿A quién apunta el código? Se busca mientras se escribe, con una pausa para no preguntar letra por letra.
  useEffect(() => {
    if (paso !== 'codigo') return undefined;
    const ref = textoCodigo.trim();
    if (ref.length < 4) { setPro(null); return undefined; }
    let vivo = true;
    const t = setTimeout(() => {
      profesionalPorReferencia(ref).then((p) => { if (vivo) setPro(p); }).catch(() => { if (vivo) setPro(null); });
    }, 350);
    return () => { vivo = false; clearTimeout(t); };
  }, [textoCodigo, paso]);

  // El nombre del entrenador, para el resumen del atleta.
  useEffect(() => {
    if (paso !== 'listo' || esCoach || !profile?.coach_id) return undefined;
    let vivo = true;
    supabase.from('profiles').select('full_name, username').eq('id', profile.coach_id).maybeSingle()
      .then(({ data }) => { if (vivo && data) setCoachNombre(data.full_name || data.username); });
    return () => { vivo = false; };
  }, [paso, esCoach, profile?.coach_id]);

  const siguiente = pasos[i + 1] ?? null;

  /* Guardar lo contestado y pasar a la siguiente pantalla. `inicio_paso` queda apuntando a la siguiente: si cierra ahora,
     al volver retoma ahí. El recorrido no se apunta (vuelve a salir «Listo», que es su puerta). */
  async function guarda(parche, avanzar = true) {
    setOcupado(true);
    setError('');
    const sig = siguiente === 'tour' ? 'listo' : siguiente;
    const { error: e } = await updateProfile({ ...parche, inicio_paso: sig });
    setOcupado(false);
    if (e) { setError(e.message); return false; }
    if (avanzar) setI((n) => Math.min(n + 1, pasos.length - 1));
    return true;
  }

  async function terminar() {
    setOcupado(true);
    const { error: e } = await updateProfile({ inicio_paso: null });
    if (e) { setError(e.message); setOcupado(false); }
    // Con `inicio_paso` en null, App.jsx abre su app: esto se desmonta solo.
  }

  async function crearCuenta() {
    setOcupado(true);
    setError('');
    const { error: e } = await signUp({
      username: usuario.trim(), email: correo.trim(), password: clave,
      accountType: tipo === 'coach' ? 'coach' : 'athlete',
      coachUsername: tipo === 'atleta' ? codigo : '',
      inicioPaso: 'nombre',
    });
    if (e) { setError(e.message); setOcupado(false); return; }
    // La sesión nueva vuelve a dibujar la app; esta pantalla se va sola. El código de equipo ya se usó.
    onCuentaCreada?.();
  }

  async function eligeTipo(v) {
    setTipo(v);
    if (modo === 'nuevo') { setTimeout(() => setI(1), 140); return; }
    // Con Google: el tipo de cuenta se guarda de una vez (solo se puede una vez) y se sigue con lo que le toca.
    setOcupado(true);
    setError('');
    try {
      await completarMiPerfil({ usuario: profile.username, tipo: v === 'coach' ? 'coach' : 'athlete', nombre: profile.full_name });
      const sig = v === 'coach' ? 'oficio' : (profile.coach_id ? 'sexo' : 'codigo');
      const { error: e } = await updateProfile({ inicio_paso: sig });
      if (e) throw e;
      await refreshProfile();
    } catch (e) {
      setError(e.message || 'No se pudo guardar');
      setOcupado(false);
      setTipo(null);
    }
  }

  async function quedarConElCoach() {
    setOcupado(true);
    setError('');
    try {
      await agregarAMiEquipo(textoCodigo.trim());
      await refreshProfile();
      await guarda({});
    } catch (e) {
      setError(e.message || 'No se pudo agregar a tu entrenador.');
      setOcupado(false);
    }
  }

  function atras() {
    if (i === 0) { onVolver?.(); return; }
    setI(i - 1);
  }

  /* ---------- la barra de arriba ---------- */
  const orden = esCoach || modo === 'nuevo' && tipo !== 'atleta' ? ORDEN_COACH : ORDEN_ATLETA;
  const segmentos = orden.filter((p) => !SIN_BARRA.has(p));
  const hechos = segmentos.indexOf(paso);
  const muestraBarra = !SIN_BARRA.has(paso);
  const puedeAtras = modo === 'google' ? false : modo === 'nuevo' ? !!onVolver || i > 0 : i > 0 && paso !== 'tour';

  const cabecera = (saltar = null) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 40 }}>
      <button
        type="button" onClick={atras} aria-label="Atrás" disabled={!puedeAtras || ocupado}
        style={{
          width: 36, height: 36, borderRadius: '50%', border: `1px solid ${KP.lineHi}`, background: KP.surface,
          display: 'grid', placeItems: 'center', color: KP.ink, padding: 0, cursor: 'pointer', flexShrink: 0,
          visibility: puedeAtras ? 'visible' : 'hidden',
        }}
      >
        <ChevronLeft size={18} />
      </button>
      <div style={{ flex: 1, display: 'flex', gap: 4 }} aria-hidden={!muestraBarra}>
        {muestraBarra && segmentos.map((p, k) => (
          <i key={p} style={{ flex: 1, height: 4, borderRadius: 99, background: k <= hechos ? KP.ink : KP.lineHi, transition: 'background .2s' }} />
        ))}
      </div>
      {saltar && (
        <button type="button" onClick={saltar} disabled={ocupado} style={{ ...enlace, width: 'auto', padding: '6px 2px' }}>Saltar</button>
      )}
    </div>
  );

  const continuar = (onClick, texto = 'Continuar', apagado = false) => (
    <button type="button" className="kp-press" onClick={onClick} disabled={apagado || ocupado} style={botonPrimario(ocupado, apagado)}>
      {ocupado ? <Loader2 size={18} className="spin" /> : <>{texto} <ChevronRight size={18} /></>}
    </button>
  );

  const Error = error ? <p role="alert" style={estiloError}>{error}</p> : null;

  /* ---------- las pantallas ---------- */
  let cuerpo = null;
  let pie = null;

  if (paso === 'tipo') {
    const t = (v, ti, qu, I) => (
      <button key={v} type="button" className="kp-press" onClick={() => eligeTipo(v)} disabled={ocupado} style={tarjeta(tipo === v)}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 19, fontWeight: 800, letterSpacing: -0.3 }}>
          <span style={cuadroDeIcono(tipo === v ? KP.blue : KP.blueSoft, tipo === v ? '#fff' : KP.blue, 38)}>
            {ocupado && tipo === v ? <Loader2 size={18} className="spin" /> : <I size={20} />}
          </span>
          {ti}
        </span>
        <span style={{ fontSize: 14, fontWeight: 500, color: KP.ink2, lineHeight: 1.45 }}>{qu}</span>
      </button>
    );
    cuerpo = (
      <>
        {modo === 'google' && (
          <p style={{ ...subtitulo, margin: '14px 0 0' }}>Google nos dio tu nombre y tu correo. Falta lo que solo tú sabes.</p>
        )}
        <h1 style={titulo(compu)}>¿Qué tipo de cuenta quieres?</h1>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
          {t('atleta', 'Sigo un plan', 'Atleta, alumno, paciente o corredor: alguien me arma lo que hago.', User)}
          {t('coach', 'Creo planes', 'Entrenador, coach, instructor, fisioterapeuta o preparador: yo armo lo que hacen otros.', Users)}
        </div>
        {Error}
      </>
    );
  } else if (paso === 'cuenta') {
    const valido = USERNAME_RE.test(usuario.trim()) && clave.length >= 6;
    const sigue = () => {
      if (!USERNAME_RE.test(usuario.trim())) { setError('El usuario lleva de 3 a 30 letras, números, _ o .'); return; }
      if (clave.length < 6) { setError('La contraseña lleva al menos 6 caracteres.'); return; }
      setI(i + 1);
    };
    cuerpo = (
      <>
        <h1 style={titulo(compu)}>Tu usuario y contraseña</h1>
        <p style={subtitulo}>Con esto entras. Lo demás lo guardamos paso a paso.</p>
        <Campo id="ini-usuario" label="Usuario" icono={AtSign} value={usuario} onChange={(v) => setUsuario(v.replace(/\s/g, ''))} extra={{ autoCapitalize: 'none', autoCorrect: 'off', autoComplete: 'username', spellCheck: false }} />
        <Campo id="ini-clave" label="Contraseña" icono={Lock} tipo="password" ojo value={clave} onChange={setClave} extra={{ autoComplete: 'new-password' }} />
        {Error}
      </>
    );
    pie = continuar(sigue, 'Continuar', !valido);
  } else if (paso === 'correo') {
    const bien = !correo.trim() || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo.trim());
    cuerpo = (
      <>
        <h1 style={titulo(compu)}>¿Tu correo?</h1>
        <p style={subtitulo}>Sirve para entrar y para recuperar tu contraseña. Se puede dejar para después.</p>
        <Campo id="ini-correo" label="Correo" icono={Mail} tipo="email" value={correo} onChange={setCorreo} extra={{ autoCapitalize: 'none', autoCorrect: 'off', autoComplete: 'email', inputMode: 'email' }} />
        {Error}
      </>
    );
    pie = (
      <>
        {continuar(crearCuenta, 'Crear cuenta', !correo.trim() || !bien)}
        {!correo.trim() && <button type="button" onClick={crearCuenta} disabled={ocupado} style={enlace}>Crear cuenta sin correo</button>}
      </>
    );
  } else if (paso === 'nombre') {
    cuerpo = (
      <>
        <h1 style={titulo(compu)}>¿Cómo te llamamos?</h1>
        <p style={subtitulo}>{esCoach ? 'Así te ven tus atletas.' : 'Así te ve tu entrenador.'}</p>
        <Campo id="ini-nombre" label="Nombre" icono={User} value={nombre} onChange={setNombre} extra={{ autoCapitalize: 'words', autoComplete: 'given-name' }} />
        <Campo id="ini-apellido" label="Apellido" icono={User} value={apellido} onChange={setApellido} extra={{ autoCapitalize: 'words', autoComplete: 'family-name' }} />
        {Error}
      </>
    );
    pie = continuar(() => guarda({ full_name: [nombre.trim(), apellido.trim()].filter(Boolean).join(' ') }), 'Continuar', !nombre.trim());
  } else if (paso === 'oficio') {
    const elige = (v) => { setOficio(v); if (v !== 'otro') guarda({ profesion: v }); };
    cuerpo = (
      <>
        <h1 style={titulo(compu)}>¿A qué te dedicas?</h1>
        <p style={subtitulo}>Así te habla la app: un fisio tiene pacientes, no atletas.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {OFICIOS_DEL_INICIO.map((o) => (
            <button key={o.valor} type="button" className="kp-press" onClick={() => elige(o.valor)} disabled={ocupado} style={opcion(oficio === o.valor)}>
              <Cuadro foto={o.foto} icono={o.icono} puesta={oficio === o.valor} />
              <span style={{ flex: 1, minWidth: 0 }}>
                {o.titulo || o.valor}
                {o.detalle && <small style={{ display: 'block', fontSize: 13, fontWeight: 500, color: KP.ink2, marginTop: 2 }}>{o.detalle}</small>}
              </span>
            </button>
          ))}
          <button type="button" className="kp-press" onClick={() => elige('otro')} disabled={ocupado} style={opcion(oficio === 'otro')}>
            <Cuadro icono="puntos" color="#6B7280" puesta={oficio === 'otro'} />
            <span style={{ flex: 1 }}>Otro…</span>
          </button>
        </div>
        {oficio === 'otro' && (
          <div style={{ marginTop: 14 }}>
            <Campo id="ini-otro" label="¿A qué te dedicas?" icono={MoreHorizontal} value={otro} onChange={(v) => setOtro(v.slice(0, 40))} extra={{ autoFocus: true, autoCapitalize: 'sentences' }} />
          </div>
        )}
        {Error}
      </>
    );
    if (oficio === 'otro') pie = continuar(() => guarda({ profesion: otro.trim() }), 'Continuar', !otro.trim());
  } else if (paso === 'entrena') {
    const marca = (id) => setEntrena((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
    cuerpo = (
      <>
        <h1 style={titulo(compu)}>¿Qué entrenas?</h1>
        <p style={subtitulo}>Marca todo lo que aplique. Solo cambia lo que ves primero: puedes usar de todo cuando quieras.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {DISCIPLINAS.map((d) => {
            const puesta = entrena.has(d.id);
            return (
              <button key={d.id} type="button" className="kp-press" onClick={() => marca(d.id)} aria-pressed={puesta} style={opcion(puesta)}>
                <Cuadro foto={d.foto} icono={d.icono} color={d.color} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  {d.nombre}
                  {d.detalle && <small style={{ display: 'block', fontSize: 13, fontWeight: 500, color: KP.ink2, marginTop: 2 }}>{d.detalle}</small>}
                </span>
                <span style={{
                  width: 24, height: 24, borderRadius: 8, flexShrink: 0, display: 'grid', placeItems: 'center', color: '#fff',
                  border: `1.5px solid ${puesta ? KP.blue : KP.lineHi}`, background: puesta ? KP.blue : 'transparent',
                }}>
                  {puesta && <Check size={15} strokeWidth={3} />}
                </span>
              </button>
            );
          })}
        </div>
        {Error}
      </>
    );
    // Se guardan en el orden de la lista, no en el que se marcaron: así «Entrenas: Fuerza, Running» se lee igual siempre.
    pie = continuar(() => guarda({ disciplinas: DISCIPLINAS.filter((d) => entrena.has(d.id)).map((d) => d.id) }), 'Continuar', entrena.size === 0);
  } else if (paso === 'equipo') {
    const o = (v, t, s, I) => (
      <button key={String(v)} type="button" className="kp-press" onClick={() => guarda({ trabaja_en_equipo: v })} disabled={ocupado} style={opcion(profile?.trabaja_en_equipo === v && profile?.inicio_paso !== 'equipo')}>
        <span style={cuadroDeIcono()}><I size={22} /></span>
        <span style={{ flex: 1 }}>{t}<small style={{ display: 'block', fontSize: 13, fontWeight: 500, color: KP.ink2, marginTop: 2 }}>{s}</small></span>
      </button>
    );
    cuerpo = (
      <>
        <h1 style={titulo(compu)}>¿Trabajas con más profesionales?</h1>
        <p style={subtitulo}>Fisioterapeutas, coaches o nutriólogos que atienden a la misma persona.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {o(true, 'Sí, somos un equipo', 'Cada quien ve y arma lo suyo sobre el mismo atleta', Users)}
          {o(false, 'Por ahora, solo yo', 'Los planes los armo yo', User)}
        </div>
        <Garantia>Contestes lo que contestes, puedes invitar a un colega o dejar de compartir cuando quieras. Nada se bloquea.</Garantia>
        {Error}
      </>
    );
  } else if (paso === 'repertorio') {
    const puesta = repertorio ?? (convieneRepertorioBase(profile?.disciplinas) ? 'tl' : 'cero');
    const t = (v, ti, qu, I) => (
      <button key={v} type="button" className="kp-press" onClick={() => { setRepertorio(v); guarda({ repertorio_base: v === 'tl' }); }} disabled={ocupado} style={tarjeta(puesta === v)}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 19, fontWeight: 800, letterSpacing: -0.3 }}>
          <span style={cuadroDeIcono(puesta === v ? KP.blue : KP.blueSoft, puesta === v ? '#fff' : KP.blue, 38)}><I size={20} /></span>{ti}
        </span>
        <span style={{ fontSize: 14, fontWeight: 500, color: KP.ink2, lineHeight: 1.45 }}>{qu}</span>
      </button>
    );
    cuerpo = (
      <>
        <h1 style={titulo(compu)}>¿Cómo quieres empezar con tus ejercicios?</h1>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 18 }}>
          {t('tl', 'Con los de Training Lab', '118 ejercicios de gym con video, listos para usar. Le agregas los tuyos.', Video)}
          {t('cero', 'Desde cero', 'Tu lista empieza vacía y agregas solo lo tuyo.', Plus)}
        </div>
        <div style={{ background: KP.surface, border: `1.5px solid ${KP.lineHi}`, borderRadius: 20, padding: '13px 14px 8px', marginTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 800, marginBottom: 4, color: KP.ink }}>
            <Repeat size={16} color={KP.blue} /> Es solo el punto de partida. Después siempre puedes:
          </div>
          {['Borrar o cambiar cualquier ejercicio', 'Crear tu propia versión de todo: ejercicios, categorías y músculos', 'Volver al original de Training Lab, o esconderlo, cuando quieras'].map((x, k) => (
            <div key={x} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 0', borderTop: k ? `1px solid ${KP.line}` : 'none', fontSize: 14, fontWeight: 600, lineHeight: 1.4, color: KP.ink }}>
              <Check size={16} strokeWidth={3} color={KP.mint} style={{ flexShrink: 0, marginTop: 1 }} />{x}
            </div>
          ))}
        </div>
        {Error}
      </>
    );
  } else if (paso === 'codigo') {
    const resuelto = !!pro;
    cuerpo = (
      <>
        <h1 style={titulo(compu)}>¿Tienes el código de tu entrenador?</h1>
        <p style={subtitulo}>Te lo da él: un código, un link o un QR. Si no lo tienes, sigue y lo pones después.</p>
        <Campo id="ini-codigo" label="Código o usuario" icono={Users} value={textoCodigo} onChange={(v) => setTextoCodigo(v.replace(/\s/g, ''))} extra={{ autoCapitalize: 'characters', autoCorrect: 'off', spellCheck: false }} />
        {resuelto && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 18, border: `1.5px solid ${KP.mint}`, background: KP.mintSoft }}>
            <span style={{ width: 46, height: 46, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, display: 'grid', placeItems: 'center', background: `linear-gradient(140deg, ${KP.blue}, ${KP.blueDk})`, color: '#fff', fontWeight: 800, fontSize: 17 }}>
              {pro.avatar_url ? <img src={pro.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (pro.full_name || pro.username || '?').trim()[0]?.toUpperCase()}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <b style={{ display: 'block', fontSize: 16, overflowWrap: 'anywhere' }}>{pro.full_name || pro.username}</b>
              {pro.profesion && <small style={{ color: KP.ink2, fontWeight: 600, fontSize: 13 }}>{oficioCorto(pro.profesion)}</small>}
            </span>
            <Check size={22} strokeWidth={3} color={KP.mint} />
          </div>
        )}
        {textoCodigo.trim().length >= 4 && !resuelto && (
          <p style={{ ...subtitulo, fontSize: 13.5, margin: '2px 0 0' }}>No encontramos a nadie con ese código. Revísalo o pídeselo otra vez.</p>
        )}
        {Error}
      </>
    );
    pie = (
      <>
        {continuar(quedarConElCoach, resuelto ? `Quedar con ${(pro.full_name || pro.username).split(' ')[0]}` : 'Continuar', !resuelto)}
        <button type="button" onClick={() => guarda({})} disabled={ocupado} style={enlace}>Todavía no</button>
      </>
    );
  } else if (paso === 'sexo') {
    const o = (v, t) => (
      <button key={v || 'x'} type="button" className="kp-press" onClick={() => guarda({ genero: v || null })} disabled={ocupado} style={{ ...opcion(false), justifyContent: 'center', fontSize: 17 }}>
        {t}
      </button>
    );
    cuerpo = (
      <>
        <h1 style={titulo(compu)}>¿Hombre o mujer?</h1>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 22 }}>
          {o('h', 'Hombre')}{o('m', 'Mujer')}{o('', 'Prefiero no decir')}
        </div>
        {Error}
      </>
    );
  } else if (paso === 'unidad') {
    const o = (v, t, s) => (
      <button key={v} type="button" className="kp-press" onClick={() => guarda({ unidad_peso: v })} disabled={ocupado} style={{ ...opcion(false), flexDirection: 'column', justifyContent: 'center', gap: 2, minHeight: 92, fontSize: 24 }}>
        {t}<small style={{ fontSize: 13, color: KP.ink2, fontWeight: 600 }}>{s}</small>
      </button>
    );
    cuerpo = (
      <>
        <h1 style={titulo(compu)}>¿Kilos o libras?</h1>
        <p style={subtitulo}>Para tus cargas y tus récords.</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>{o('kg', 'kg', 'Kilos')}{o('lb', 'lb', 'Libras')}</div>
        {Error}
      </>
    );
  } else if (paso === 'nacimiento') {
    cuerpo = (
      <>
        <h1 style={titulo(compu)}>¿Cuándo naciste?</h1>
        <p style={subtitulo}>Para tus zonas de esfuerzo y para que tu entrenador sepa tu edad.</p>
        <Campo id="ini-nac" label="Fecha de nacimiento" icono={Calendar} tipo="date" value={nac} onChange={setNac} extra={{ max: new Date().toISOString().slice(0, 10) }} />
        {Error}
      </>
    );
    pie = (
      <>
        {continuar(() => guarda({ fecha_nacimiento: nac || null }), 'Continuar', !nac)}
        <button type="button" onClick={() => guarda({})} disabled={ocupado} style={enlace}>Saltar por ahora</button>
      </>
    );
  } else if (paso === 'listo') {
    const nom = parteNombre(profile?.full_name).nombre || (esCoach ? 'coach' : '');
    const filas = esCoach
      ? [
        ['Usuario', `@${profile?.username ?? ''}`],
        ['Eres', oficioCorto(profile?.profesion) || 'Coach'],
        ['Entrenas', (profile?.disciplinas ?? []).map(nombreDeDisciplina).join(', ') || 'Lo que quieras'],
        ['Ejercicios', profile?.repertorio_base === false ? 'Los tuyos, desde cero' : 'Training Lab + los tuyos'],
        ['Equipo', profile?.trabaja_en_equipo ? 'Con otros profesionales' : 'Por ahora, solo tú'],
      ]
      : [
        ['Usuario', `@${profile?.username ?? ''}`],
        ['Entrenador', profile?.coach_id ? (coachNombre || '…') : 'Todavía no'],
        ['Unidad', profile?.unidad_peso === 'lb' ? 'Libras' : 'Kilos'],
        ['Sexo', profile?.genero === 'h' ? 'Hombre' : profile?.genero === 'm' ? 'Mujer' : 'Prefiere no decir'],
      ];
    cuerpo = (
      <>
        <div style={{ width: 72, height: 72, borderRadius: 24, background: KP.mintSoft, color: KP.mint, display: 'grid', placeItems: 'center', margin: '14px 0 6px' }}>
          <Check size={34} strokeWidth={3} />
        </div>
        <h1 style={titulo(compu)}>Listo{nom ? `, ${nom}` : ''}</h1>
        <p style={subtitulo}>
          {esCoach
            ? 'Tu app quedó armada así. Todo se cambia en Mi perfil.'
            : profile?.coach_id ? `${coachNombre || 'Tu entrenador'} ya te ve en su lista y te va a armar tu plan.` : 'Cuando tengas el código de tu entrenador, lo pones en Mi perfil.'}
        </p>
        <div style={{ background: KP.surface, border: `1.5px solid ${KP.lineHi}`, borderRadius: 22, padding: '6px 16px', margin: '6px 0 18px' }}>
          {filas.map(([k, v], n) => (
            <div key={k} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '12px 0', borderTop: n ? `1px solid ${KP.line}` : 'none', fontSize: 15, fontWeight: 600 }}>
              <span style={{ color: KP.ink2, minWidth: 92 }}>{k}</span><b style={{ fontWeight: 800, overflowWrap: 'anywhere' }}>{v}</b>
            </div>
          ))}
        </div>
        {Error}
      </>
    );
    pie = (
      <>
        {continuar(() => setI(i + 1), esCoach ? 'Ver qué puedes hacer · 1 min' : 'Ver cómo funciona · 1 min')}
        <button type="button" onClick={terminar} disabled={ocupado} style={enlace}>Ir a mi app</button>
      </>
    );
  } else if (paso === 'tour') {
    cuerpo = <Recorrido rol={esCoach ? 'coach' : 'atleta'} conEquipo={!!profile?.trabaja_en_equipo} onTerminar={terminar} compu={compu} />;
  }

  return (
    <div
      style={{
        minHeight: '100svh', display: 'flex', alignItems: compu ? 'flex-start' : 'stretch', justifyContent: 'center',
        padding: compu ? '28px 20px 40px' : 0, fontFamily: FONT,
        background: 'radial-gradient(1100px 620px at 50% -8%, #e7ecfe 0%, rgba(244,245,248,0) 60%), #f4f5f8',
      }}
    >
      <div
        key={paso}
        className="animate-fade-in"
        style={compu
          ? {
            width: '100%', maxWidth: 560, background: KP.surface, borderRadius: 26, border: `1px solid ${KP.line}`,
            boxShadow: '0 24px 60px rgba(17,19,24,0.10)', padding: '22px 30px 26px', display: 'flex', flexDirection: 'column',
            minHeight: 540, position: 'relative',
          }
          : {
            width: '100%', display: 'flex', flexDirection: 'column', padding: 'calc(14px + env(safe-area-inset-top, 0px)) 20px calc(22px + env(safe-area-inset-bottom, 0px))',
            minHeight: '100svh', background: KP.surface, position: 'relative',
          }}
      >
        {paso !== 'tour' && cabecera(paso === 'correo' && !correo.trim() ? null : paso === 'nacimiento' ? () => guarda({}) : null)}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>{cuerpo}</div>
        {pie && <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 18 }}>{pie}</div>}
      </div>
      <style>{'.spin{animation:spin .8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}'}</style>
    </div>
  );
}
