import { useEffect, useRef, useState } from 'react';
import {
  Activity, AtSign, Bike, Calendar, Check, ChevronLeft, ChevronRight, Dumbbell, Flame, HeartPulse, Loader2, Lock, Mail, Medal, MoreHorizontal,
  PersonStanding, Plus, Trophy, User, Users, Video, Waves, Eye, EyeOff,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useIsWide } from '@/lib/useViewport';
import { useAviso } from '@/components/AvisoPasajero';
import HojaFlotante from '@/components/HojaFlotante';
import { Boton } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { activarInvitacion, agregarAMiEquipo, completarMiPerfil, profesionalPorReferencia } from '@/lib/api';
import { DISCIPLINAS, OFICIOS_DEL_INICIO } from '@/lib/oficios';
import { FONT, KP, UI, oficioCorto } from '@/lib/theme';
import { correoValido, esCorreoInventado, guardaCorreoPorConfirmar } from '@/lib/correos';
import { confirmaCorreoConCodigo, pideCodigoDeCorreo } from '@/lib/correoDeLaCuentaApi';
import {
  GRIS, botonPrimario, cajaDeCampo, cuadroDeIcono, elige as estiloElige, enlace, entrada, error as estiloError, letraChica, opcion, rotulo, subtitulo, titulo,
} from '@/features/inicio/estilos';
import { leeTipoPendiente, olvidaTipoPendiente } from '@/features/inicio/tipoPendiente';
import { codigoPendiente, esInvitado, guardaCodigoPendiente, marcaInvitado, olvidaCodigoPendiente } from '@/features/inicio/marcas';
import CajasDelCodigo from '@/features/inicio/CajasDelCodigo';
import Bienvenida from '@/features/inicio/Bienvenida';
import { DibujoCodigo, DibujoEjercicios, DibujoEquipo, DibujoPunto } from '@/features/inicio/Dibujos';
import HojaDeUsuario from '@/features/profile/HojaDeUsuario';
import fotoFuerza from '@/assets/landing/fuerza.webp';
import fotoPista from '@/assets/landing/pista.webp';
import fotoYoga from '@/assets/landing/yoga.webp';
import fotoAgilidad from '@/assets/landing/agilidad.webp';
import fotoBosu from '@/assets/landing/bosu.webp';
import { MIN_CONTRASENA, problemaDeContrasena } from '@/lib/contrasena';
import { useReloj } from '@/lib/relojConectado';
import { saludDisponible } from '@/lib/saludDelTelefono';
import ConectaReloj, { CuerpoDeConectar } from '@/features/reloj/ConectaReloj';
import AvisoDelReloj from '@/features/reloj/AvisoDelReloj';

/**
 * El inicio: crear la cuenta y dejar la app armada, una pregunta por pantalla.
 *
 * Andrés, 7-8 oct 2026 (PDF «Experiencia de inicio»): una pregunta por pantalla, opciones grandes, barra de avance, y lo contestado deja la app armada.
 * INICIO NUEVO (30 oct 2026, prototipo HUZVXJGnGrGaZeBq4e3wrv): se entra por LA PUERTA (`features/auth/Puerta`), con Apple, Google o usuario y contraseña.
 * El prototipo manda en los textos, el orden y lo que sale en cada pantalla; el código, en colores, letras y piezas (`components/ui`, `lib/theme`). Sus reglas:
 *
 *   · CON APPLE O GOOGLE NO SE TECLEA NADA: nombre y correo salen de la cuenta, el usuario lo propone la base (`handle_new_user`).
 *   · LA CUENTA NACE EN «¿TU CORREO?» (con «Mandar código» o «Crear cuenta sin correo»). Lo demás se guarda paso a paso en su perfil, con `inicio_paso`
 *     apuntando a lo que sigue: si cierra a la mitad, al volver retoma ahí (App.jsx vuelve a abrir esto mientras `inicio_paso` no sea null).
 *   · EL CÓDIGO DEL CORREO SE PIDE AHÍ MISMO: la misma pantalla pasa a «Escribe el código», con «Lo confirmo después».
 *   · SEXO Y FECHA DE NACIMIENTO JUNTOS, en «Sobre ti», y con «Saltar».
 *   · SALUD PARA TODOS: con Apple Watch se conecta el reloj; sin él, Apple Salud (lo que guardan otros aparatos y apps). En la web solo se cuenta.
 *   · LAS PREGUNTAS DE DOS RESPUESTAS (entrenador, equipo, ejercicios) VAN COMO LA CONFIGURACIÓN DEL IPHONE: un dibujo arriba, la pregunta al centro y las
 *     respuestas abajo, al alcance del pulgar. Un toque guarda y sigue.
 *   · AL FINAL, LA BIENVENIDA (`Bienvenida`): lo que sigue, no la lista de lo contestado. Sin recorrido: el coach empieza en «Primeros pasos» y el atleta
 *     en «Empieza aquí».
 *   · LO QUE ENTRENA ORDENA, NUNCA QUITA, y NINGUNA RESPUESTA ES UNA PUERTA: todo se cambia en Mi perfil.
 *
 * El camino de cada quien (ver `docs/inicio.md`):
 *   atleta con Apple o Google   tipo → entrenador → sobre → reloj → bienvenida
 *   atleta con usuario          tipo → cuenta → correo → nombre → entrenador → sobre → reloj → bienvenida
 *   coach                       tipo → (cuenta → correo → nombre, solo con usuario) → oficio → entrena → equipo → repertorio → bienvenida
 *   invitación                  (cuenta → correo, solo con usuario) → sobre → reloj → bienvenida
 *
 * Cuatro modos, según de dónde viene la persona:
 *   'nuevo'       sin sesión, desde «Crea tu cuenta» (o con un link `?unirse=CÓDIGO`, con el código ya puesto): tipo, cuenta y correo.
 *   'invitacion'  sin sesión, desde el link de su entrenador con «Crear cuenta con usuario y contraseña»: cuenta y correo (`invitacion` = `{ token, datos }`).
 *   'google'      con sesión de Apple o Google pero sin tipo de cuenta (`perfil_completo = false`): solo el tipo.
 *   'retomar'     con sesión e `inicio_paso` pendiente: lo que falta, desde donde se quedó.
 * App.jsx le pone `key={modo}`: al cambiar de modo se vuelve a armar con la lista de pasos que le toca. Lo que tiene que cruzar ese cambio (el código del
 * correo, que entró por invitación) va en `marcas.js`.
 */

const ICONOS = {
  barra: Dumbbell, trofeo: Trophy, pulso: HeartPulse, actividad: Activity, puntos: MoreHorizontal,
  bici: Bike, olas: Waves, medalla: Medal, flama: Flame, persona: PersonStanding,
};
const FOTOS = { fuerza: fotoFuerza, pista: fotoPista, yoga: fotoYoga, agilidad: fotoAgilidad, bosu: fotoBosu };

const ORDEN_COACH = ['tipo', 'cuenta', 'correo', 'nombre', 'oficio', 'entrena', 'equipo', 'repertorio', 'listo'];
const ORDEN_ATLETA = ['tipo', 'cuenta', 'correo', 'nombre', 'entrenador', 'sobre', 'reloj', 'listo'];
const ANTES_DE_LA_CUENTA = new Set(['tipo', 'cuenta', 'correo']);
// Quien estaba a la mitad del inicio de antes (29 oct 2026) sigue en la pantalla que la reemplazó.
const PASO_DE_ANTES = { codigo: 'entrenador', sexo: 'sobre', nacimiento: 'sobre', unidad: 'sobre', tour: 'listo' };
const USERNAME_RE = /^[a-zA-Z0-9_.]{3,30}$/;

/* Los pasos que le faltan a ESTE perfil. Se calcula una vez al montar (ver `key` en App.jsx): si se recalculara en cada pintada, el paso «nombre»
   desaparecería en cuanto se guardara el nombre y el botón de atrás ya no sabría a dónde ir. Con el código del correo recién mandado, «Escribe el código»
   va primero (es la segunda mitad de «¿Tu correo?»). */
function pasosDe(modo, perfil, esCoach) {
  if (modo === 'nuevo') return ['tipo', 'cuenta', 'correo'];
  if (modo === 'invitacion') return ['cuenta', 'correo'];
  if (modo === 'google') return ['tipo'];
  const orden = esCoach ? ORDEN_COACH : ORDEN_ATLETA;
  const resto = orden.filter((p) => {
    if (ANTES_DE_LA_CUENTA.has(p)) return false;
    if (p === 'nombre' && (perfil?.full_name || '').trim()) return false;   // Apple, Google o la invitación ya dieron el nombre
    if (p === 'entrenador' && perfil?.coach_id) return false;               // ya quedó con su entrenador (código o invitación)
    return true;
  });
  return codigoPendiente() ? ['correo', ...resto] : resto;
}

/* El camino completo de cada quien, para la barra de arriba: solo cuenta SUS pasos, y la bienvenida no cuenta. */
function caminoDe({ esCoach, social, invitado, pideNombre }) {
  if (invitado) return social ? ['sobre', 'reloj'] : ['cuenta', 'correo', 'sobre', 'reloj'];
  const cuenta = social ? (pideNombre ? ['nombre'] : []) : ['cuenta', 'correo', 'nombre'];
  return esCoach ? ['tipo', ...cuenta, 'oficio', 'entrena', 'equipo', 'repertorio'] : ['tipo', ...cuenta, 'entrenador', 'sobre', 'reloj'];
}

const parteNombre = (completo = '') => {
  const partes = completo.trim().split(/\s+/).filter(Boolean);
  return { nombre: partes.shift() || '', apellido: partes.join(' ') };
};
const iniciales = (n = '') => n.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

function Icono({ nombre, size = 21 }) {
  const C = ICONOS[nombre] || Dumbbell;
  return <C size={size} />;
}

/** El cuadrito blanco con foto o ícono que va a la izquierda de cada opción. */
function Cuadro({ foto, icono, color, lado = 42 }) {
  if (foto) {
    return (
      <span style={cuadroDeIcono('#fff', KP.blue, lado)}>
        <img src={FOTOS[foto]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      </span>
    );
  }
  return <span style={cuadroDeIcono('#fff', color || KP.blue, lado)}><Icono nombre={icono} size={lado > 38 ? 21 : 18} /></span>;
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

/** Una respuesta del estilo C: gris, ancha, con su ícono azul. */
function Elige({ Icono: I, children, onClick, ocupado }) {
  return (
    <button type="button" className="kp-press" onClick={onClick} disabled={ocupado} style={{ ...estiloElige, marginTop: 8 }}>
      <I size={20} color={KP.blue} />
      <span>{children}</span>
    </button>
  );
}

/* `codigo`: el código de equipo de un link `?unirse=` (en 'nuevo' ya se usa al crear la cuenta; en 'retomar' llega puesto en «El código de tu entrenador»).
   `onCodigoUsado` avisa cuando ya se usó, para que la app no vuelva a pedirlo. `invitacion`: en modo 'invitacion', `{ token, datos }` (`datos` de `verInvitacion`). */
export default function Inicio({ modo = 'nuevo', codigo = '', onVolver, onCodigoUsado, invitacion = null }) {
  const { profile, user, signIn, signUp, signOut, updateProfile, refreshProfile } = useAuth();
  const { avisa } = useAviso();
  const compu = useIsWide();

  // Con Google: si ya había contestado el tipo antes de salir, se aplica solo (ver el efecto de abajo).
  const [tipoDeGoogle] = useState(() => (modo === 'google' ? leeTipoPendiente() : null));

  // Lo de ANTES de la cuenta vive aquí; lo de después, en el perfil.
  const [tipo, setTipo] = useState(modo === 'nuevo' && codigo ? 'atleta' : tipoDeGoogle);
  const [usuario, setUsuario] = useState('');
  const [clave, setClave] = useState('');
  const [correo, setCorreo] = useState('');

  const esCoach = modo === 'nuevo' ? tipo === 'coach' : modo === 'invitacion' ? false : profile?.role === 'admin';
  const [pasos] = useState(() => pasosDe(modo, profile, profile?.role === 'admin'));
  const [i, setI] = useState(() => {
    if (pasos[0] === 'correo' && modo === 'retomar') return 0;
    const guardado = PASO_DE_ANTES[profile?.inicio_paso] ?? profile?.inicio_paso;
    return Math.max(0, pasos.indexOf(guardado));
  });
  const paso = pasos[i] ?? pasos[0];
  const [ocupado, setOcupado] = useState(!!tipoDeGoogle);
  const [error, setError] = useState('');

  // ¿Con qué entró? Apple o Google («social»: no teclea nada) o usuario y contraseña. Antes de tener cuenta, siempre usuario.
  const proveedor = user?.app_metadata?.provider;
  const via = modo === 'nuevo' || modo === 'invitacion' ? 'usuario' : proveedor === 'apple' ? 'apple' : proveedor === 'google' ? 'google' : 'usuario';
  const social = via !== 'usuario';
  const invitado = modo === 'invitacion' || esInvitado();

  // Lo que se está contestando en la pantalla de ahora, con lo que el perfil ya traía.
  const [nombre, setNombre] = useState(() => parteNombre(profile?.full_name).nombre);
  const [apellido, setApellido] = useState(() => parteNombre(profile?.full_name).apellido);
  const [oficio, setOficio] = useState(() => {
    const p = profile?.profesion || '';
    return !p ? null : OFICIOS_DEL_INICIO.some((o) => o.valor === p) ? p : 'otro';
  });
  const [otro, setOtro] = useState(() => (profile?.profesion && !OFICIOS_DEL_INICIO.some((o) => o.valor === profile.profesion) ? profile.profesion : ''));
  const [entrena, setEntrena] = useState(() => new Set(profile?.disciplinas ?? []));
  const [textoCodigo, setTextoCodigo] = useState(modo === 'nuevo' ? '' : codigo);
  const [pro, setPro] = useState(null);   // a quién apunta el código escrito
  const [conCodigo, setConCodigo] = useState(modo !== 'nuevo' && !!codigo); // «Sí, tengo su código»: de las dos respuestas al campo del código
  const [sexo, setSexo] = useState(() => (profile?.genero === 'h' || profile?.genero === 'm' ? profile.genero : null));
  const [nac, setNac] = useState(profile?.fecha_nacimiento || '');
  const [coachDe, setCoachDe] = useState(null); // su entrenador: nombre, oficio y foto (para «Sobre ti» y la bienvenida)
  const [sinCorreo, setSinCorreo] = useState(false); // la hoja «¿Crear tu cuenta sin correo?»
  const [codigoCorreo, setCodigoCorreo] = useState('');
  const [errorCodigo, setErrorCodigo] = useState('');
  const [hojaUsuario, setHojaUsuario] = useState(false);
  // El paso del reloj: con un Apple Watch emparejado se conecta el reloj; sin él, Apple Salud. En la web solo se cuenta.
  const { listo: relojListo, reloj, conexion: relojConexion } = useReloj();
  const [conectandoReloj, setConectandoReloj] = useState(false);

  // Al cambiar de pantalla, arriba. En la compu el marco tiene su propio scroll; en el teléfono es la página.
  const conservaError = useRef(false); // al regresar a corregir el usuario o la contraseña, el mensaje viaja con la persona
  useEffect(() => {
    window.scrollTo(0, 0);
    if (conservaError.current) conservaError.current = false; else setError('');
  }, [i]);

  // ¿A quién apunta el código? Se busca mientras se escribe, con una pausa para no preguntar letra por letra.
  useEffect(() => {
    if (paso !== 'entrenador' || !conCodigo) return undefined;
    const ref = textoCodigo.trim();
    if (ref.length < 4) { setPro(null); return undefined; }
    let vivo = true;
    const t = setTimeout(() => {
      profesionalPorReferencia(ref).then((p) => { if (vivo) setPro(p); }).catch(() => { if (vivo) setPro(null); });
    }, 350);
    return () => { vivo = false; clearTimeout(t); };
  }, [textoCodigo, paso, conCodigo]);

  // Su entrenador, para «Carlos ve tu edad.» y la tarjeta de la bienvenida.
  useEffect(() => {
    if (esCoach || !profile?.coach_id) { setCoachDe(null); return undefined; }
    let vivo = true;
    supabase.from('profiles').select('full_name, username, profesion, avatar_url').eq('id', profile.coach_id).maybeSingle()
      .then(({ data }) => { if (vivo && data) setCoachDe({ nombre: data.full_name || data.username || 'Tu entrenador', oficio: oficioCorto(data.profesion) || '', avatar: data.avatar_url || null }); });
    return () => { vivo = false; };
  }, [esCoach, profile?.coach_id]);

  const siguiente = pasos[i + 1] ?? null;

  /* Guardar lo contestado y pasar a la siguiente pantalla. `inicio_paso` queda apuntando a la siguiente: si cierra ahora, al volver retoma ahí. */
  async function guarda(parche, avanzar = true) {
    setOcupado(true);
    setError('');
    const { error: e } = await updateProfile({ ...parche, inicio_paso: siguiente });
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

  /* LA CUENTA NACE AQUÍ, con «Mandar código» o con «Crear cuenta sin correo». En cuanto hay sesión, App.jsx arma el inicio otra vez (modo 'retomar'), así que
     el correo al que se manda el código se anota ANTES (`guardaCodigoPendiente`): el inicio nuevo lo lee al montarse y abre «Escribe el código». */
  async function crearCuenta(conCorreo) {
    setOcupado(true);
    setError('');
    const email = conCorreo ? correo.trim() : '';
    if (email) guardaCodigoPendiente(email); else olvidaCodigoPendiente();
    if (modo === 'invitacion') {
      try {
        marcaInvitado();
        // Lo demás («Sobre ti», el reloj) se pregunta después: el servidor deja `inicio_paso = 'sobre'`.
        const r = await activarInvitacion({ token: invitacion?.token, username: usuario.trim(), password: clave, email, nombre: invitacion?.datos?.nombre, apellido: invitacion?.datos?.apellido });
        const { error: errEntrar } = await signIn(r.username, clave);
        if (errEntrar) throw new Error(errEntrar.message);
        if (r.correo_pendiente) {
          guardaCorreoPorConfirmar(r.correo_pendiente);
          avisa('Cuenta creada. Te mandamos el código.');
          pideCodigoDeCorreo(r.correo_pendiente, clave).catch(() => { /* Mi perfil → Correo permite pedirlo otra vez */ });
        } else {
          olvidaCodigoPendiente();
        }
      } catch (e) {
        olvidaCodigoPendiente();
        falloAlCrear(e);
      }
      return;
    }
    const { error: e, correoPendiente } = await signUp({
      username: usuario.trim(), email, password: clave,
      accountType: tipo === 'coach' ? 'coach' : 'athlete',
      coachUsername: tipo === 'atleta' ? codigo : '',
      inicioPaso: 'nombre',
    });
    if (e) { olvidaCodigoPendiente(); falloAlCrear(e); return; }
    if (correoPendiente) avisa('Cuenta creada. Te mandamos el código.'); else olvidaCodigoPendiente();
    // La sesión nueva vuelve a dibujar la app; esta pantalla se va sola. El código de equipo ya se usó.
    onCodigoUsado?.();
  }

  function falloAlCrear(e) {
    // Un usuario ocupado o una contraseña que el servidor no acepta se corrigen en el paso del usuario, no aquí (donde la persona ya no ve esos campos).
    const m = String(e?.message || 'No se pudo crear la cuenta.');
    const alPasoDeLaCuenta = pasos.indexOf('cuenta');
    if (/usuario|contraseña|password/i.test(m) && !/correo|email/i.test(m) && alPasoDeLaCuenta >= 0) { conservaError.current = true; setI(alPasoDeLaCuenta); }
    setError(m);
    setOcupado(false);
  }

  // Con Apple o Google: el tipo de cuenta se guarda de una vez (solo se puede una vez) y se sigue con lo que le toca.
  async function guardaTipoDeGoogle(v) {
    try {
      await completarMiPerfil({ usuario: profile.username, tipo: v === 'coach' ? 'coach' : 'athlete', nombre: profile.full_name });
      const sig = !(profile.full_name || '').trim() ? 'nombre' : v === 'coach' ? 'oficio' : (profile.coach_id ? 'sobre' : 'entrenador');
      const { error: e } = await updateProfile({ inicio_paso: sig });
      if (e) throw e;
      await refreshProfile();
    } catch (e) {
      setError(e.message || 'No se pudo guardar');
      setOcupado(false);
      setTipo(null);
    }
  }

  function eligeTipo(v) {
    setTipo(v);
    if (modo === 'nuevo') { setTimeout(() => setI(1), 180); return; }
    setOcupado(true);
    setError('');
    guardaTipoDeGoogle(v);
  }

  // Volvió de Google y ya había contestado el tipo de cuenta: se guarda sin preguntarle otra vez. Si falla, queda la
  // pregunta de siempre (con el error), así que nunca se atora.
  const aplicado = useRef(false);
  useEffect(() => {
    if (!tipoDeGoogle || aplicado.current) return;
    aplicado.current = true;
    olvidaTipoPendiente();
    guardaTipoDeGoogle(tipoDeGoogle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function quedarConElCoach() {
    setOcupado(true);
    setError('');
    try {
      await agregarAMiEquipo(textoCodigo.trim());
      await refreshProfile();
      onCodigoUsado?.();
      avisa(`Listo, quedaste con ${(pro?.full_name || pro?.username || 'tu entrenador').split(' ')[0]}.`);
      await guarda({});
    } catch (e) {
      setError(e.message || 'No se pudo agregar a tu entrenador.');
      setOcupado(false);
    }
  }

  /* «Escribe el código»: con los seis números se confirma solo. Si no sirve, el error en rojo y las cajas vacías para escribirlo otra vez. */
  const confirmando = useRef(false);
  useEffect(() => {
    if (paso !== 'correo' || modo !== 'retomar' || codigoCorreo.length !== 6 || confirmando.current) return;
    confirmando.current = true;
    setErrorCodigo('');
    setOcupado(true);
    confirmaCorreoConCodigo(codigoCorreo, { refreshProfile })
      .then(() => { olvidaCodigoPendiente(); avisa('Correo confirmado.'); setI((n) => n + 1); })
      .catch((e) => { setErrorCodigo(e.message || 'Ese código no sirve. Revísalo e inténtalo otra vez.'); setCodigoCorreo(''); })
      .finally(() => { confirmando.current = false; setOcupado(false); });
  }, [codigoCorreo, paso, modo, refreshProfile, avisa]);

  async function salir() {
    setOcupado(true);
    await signOut();
    avisa('Cerraste sesión. Puedes entrar con otra cuenta.');
  }

  function atras() {
    if (paso === 'entrenador' && conCodigo) { setConCodigo(false); setTextoCodigo(''); setPro(null); setError(''); return; }
    if (i === 0) { onVolver?.(); return; }
    setI(i - 1);
  }

  /* ---------- la barra de arriba ---------- */
  const camino = caminoDe({ esCoach, social, invitado, pideNombre: pasos.includes('nombre') || (modo === 'google' && !(profile?.full_name || '').trim()) });
  const hechos = camino.indexOf(paso);
  const muestraBarra = paso !== 'listo';
  const primeraTrasApple = modo === 'google' && paso === 'tipo';
  const puedeAtras = !primeraTrasApple && (i > 0 || (paso === 'entrenador' && conCodigo) || ((modo === 'nuevo' || modo === 'invitacion') && !!onVolver));

  const cabecera = (saltar = null) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 40 }}>
      {primeraTrasApple ? (
        <button type="button" onClick={salir} disabled={ocupado} className="kp-press"
          style={{ border: 'none', background: UI.relleno, borderRadius: 999, color: KP.ink, fontFamily: FONT, fontSize: 13.5, fontWeight: 700, padding: '8px 13px', cursor: 'pointer', flex: 'none' }}>
          Salir
        </button>
      ) : (
        <button
          type="button" onClick={atras} aria-label="Atrás" disabled={!puedeAtras || ocupado}
          style={{
            width: 36, height: 36, borderRadius: '50%', border: 'none', background: UI.relleno,
            display: 'grid', placeItems: 'center', color: KP.ink, padding: 0, cursor: 'pointer', flexShrink: 0,
            visibility: puedeAtras ? 'visible' : 'hidden',
          }}
        >
          <ChevronLeft size={18} />
        </button>
      )}
      <div
        style={{ flex: 1, display: 'flex', gap: 4 }}
        {...(muestraBarra && hechos >= 0
          ? { role: 'progressbar', 'aria-label': `Paso ${hechos + 1} de ${camino.length}`, 'aria-valuemin': 1, 'aria-valuemax': camino.length, 'aria-valuenow': hechos + 1 }
          : { 'aria-hidden': true })}
      >
        {muestraBarra && camino.map((p, k) => (
          <i key={p} style={{ flex: 1, height: 4, borderRadius: 99, background: k <= hechos ? KP.ink : KP.lineHi, transition: 'background .2s' }} />
        ))}
      </div>
      {saltar && (
        <button type="button" onClick={saltar} disabled={ocupado} style={{ ...enlace, width: 'auto', minHeight: 36, padding: '6px 2px' }}>Saltar</button>
      )}
    </div>
  );

  const continuar = (onClick, texto = 'Continuar', apagado = false, flecha = true) => (
    <button type="button" className="kp-press" onClick={onClick} disabled={apagado || ocupado} style={botonPrimario(ocupado, apagado)}>
      {ocupado ? <Loader2 size={18} className="spin" /> : <>{texto}{flecha && <ChevronRight size={18} />}</>}
    </button>
  );

  const Error = error ? <p role="alert" style={estiloError}>{error}</p> : null;

  /* ---------- las pantallas ---------- */
  let cuerpo = null;
  let pie = null;
  let estiloC = false;   // dibujo arriba, pregunta al centro, respuestas abajo
  let saltar = null;

  const pantallaC = ({ dibujo, tituloC, sub, letra, botones }) => {
    estiloC = true;
    cuerpo = (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', textAlign: 'center' }}>
        <div style={{ flex: 1, minHeight: 120, display: 'grid', placeItems: 'center', padding: '10px 0' }}>{dibujo}</div>
        <h1 style={{ ...titulo(compu), marginTop: 6 }}>{tituloC}</h1>
        {sub && <p style={{ ...subtitulo, margin: '0 auto 8px', maxWidth: '32ch' }}>{sub}</p>}
        {Error}
      </div>
    );
    pie = (
      <>
        {letra && <p style={{ ...letraChica, margin: '0 0 6px' }}>{letra}</p>}
        {botones}
      </>
    );
  };

  if (paso === 'tipo') {
    const op = (v, foto, t, d) => (
      <button
        key={v} type="button" className="kp-press" onClick={() => eligeTipo(v)} disabled={ocupado} aria-pressed={tipo === v}
        style={{
          position: 'relative', display: 'block', width: '100%', height: 196, border: 'none', borderRadius: 24, overflow: 'hidden', padding: 0, textAlign: 'left',
          color: '#fff', cursor: 'pointer', fontFamily: FONT, background: `#2A2D34 url(${FOTOS[foto]}) center 30% / cover no-repeat`,
          // estilo-ok: el anillo azul marca la foto elegida
          boxShadow: tipo === v ? `0 0 0 3px #fff, 0 0 0 5px ${KP.blue}` : 'none', touchAction: 'manipulation',
        }}
      >
        {/* estilo-ok: el texto blanco se lee sobre la foto gracias a esta sombra de abajo */}
        <span aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(10,12,20,0) 30%, rgba(10,12,20,0.78))' }} />
        <span style={{ position: 'absolute', left: 18, right: 18, bottom: 16 }}>
          <b style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 23, fontWeight: 800, lineHeight: 1.1, letterSpacing: -0.4 }}>
            {t}{ocupado && tipo === v && <Loader2 size={18} className="spin" />}
          </b>
          <span style={{ display: 'block', fontSize: 13.5, fontWeight: 500, opacity: 0.9, marginTop: 4, lineHeight: 1.35 }}>{d}</span>
        </span>
      </button>
    );
    const saludo = social && parteNombre(profile?.full_name).nombre;
    // Volvió de Google con el tipo ya contestado: no se le enseña la pregunta, solo que se está guardando.
    cuerpo = modo === 'google' && tipoDeGoogle && ocupado ? (
      <div role="status" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, textAlign: 'center' }}>
        <Loader2 size={30} className="spin" color={KP.blue} />
        <p style={{ ...subtitulo, margin: 0 }}>Preparando tu cuenta…</p>
      </div>
    ) : (
      <>
        {saludo && <p style={{ margin: '16px 0 -8px', fontSize: 14.5, fontWeight: 600, color: KP.ink2 }}>Hola, {saludo}.</p>}
        <h1 style={titulo(compu)}>¿Qué vas a hacer?</h1>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 6 }}>
          {op('atleta', 'pista', 'Entreno', 'Corro, nado, hago pesas o sigo el plan de un entrenador.')}
          {op('coach', 'bosu', 'Creo planes', 'Entrenador, coach, instructor, fisio o preparador: armo lo que hacen otros.')}
        </div>
        {Error}
      </>
    );
  } else if (paso === 'cuenta') {
    const valido = USERNAME_RE.test(usuario.trim()) && !problemaDeContrasena(clave, { usuario: usuario.trim() });
    /* Lo que falta, dicho EN VIVO (12 oct 2026, «está difícil crear contraseñas»): mientras solo falta largo se dice cuánto falta (sin regañar); si es otra
       cosa (muy común, lleva tu usuario…) se dice qué; y cuando ya sirve, «Contraseña lista.». */
    const u = usuario.trim();
    const avisoDeUsuario = !u ? null
      : u.length < 3 ? { texto: `Faltan ${3 - u.length} ${3 - u.length === 1 ? 'carácter' : 'caracteres'} en el usuario.`, tono: 'espera' }
      : !USERNAME_RE.test(u) ? { texto: 'Solo letras, números, _ o . (sin espacios ni acentos).', tono: 'mal' }
      : null;
    const faltan = MIN_CONTRASENA - clave.length;
    const problemaClave = clave ? problemaDeContrasena(clave, { usuario: u }) : null;
    const avisoDeClave = !clave ? null
      : faltan > 0 ? { texto: `Faltan ${faltan} ${faltan === 1 ? 'carácter' : 'caracteres'}.`, tono: 'espera' }
      : problemaClave ? { texto: problemaClave, tono: 'mal' }
      : { texto: 'Contraseña lista.', tono: 'bien' };
    const pintaAviso = (a) => (a ? (
      <p role="status" style={{ margin: '-6px 2px 12px', fontSize: 13.5, fontWeight: 700, lineHeight: 1.4, color: a.tono === 'bien' ? KP.mint : a.tono === 'mal' ? KP.danger : KP.ink2 }}>{a.texto}</p>
    ) : null);
    const sigue = () => {
      if (!USERNAME_RE.test(usuario.trim())) { setError('El usuario lleva de 3 a 30 letras, números, _ o .'); return; }
      const problema = problemaDeContrasena(clave, { usuario: usuario.trim() });
      if (problema) { setError(problema); return; }
      setI(i + 1);
    };
    cuerpo = (
      <>
        <h1 style={titulo(compu)}>Tu usuario y contraseña</h1>
        <p style={subtitulo}>Con esto entras.</p>
        <Campo id="ini-usuario" label="Usuario" icono={AtSign} value={usuario} onChange={(v) => setUsuario(v.replace(/\s/g, ''))} extra={{ placeholder: 'tu_usuario', autoCapitalize: 'none', autoCorrect: 'off', autoComplete: 'username', spellCheck: false }} />
        {pintaAviso(avisoDeUsuario)}
        <Campo id="ini-clave" label="Contraseña" icono={Lock} tipo="password" ojo value={clave} onChange={setClave} extra={{ placeholder: `Mínimo ${MIN_CONTRASENA} caracteres`, autoComplete: 'new-password' }} />
        {pintaAviso(avisoDeClave)}
        {Error}
      </>
    );
    pie = continuar(sigue, 'Continuar', !valido);
  } else if (paso === 'correo' && modo === 'retomar') {
    // La segunda mitad de «¿Tu correo?»: la cuenta ya nació y el código ya va en camino.
    cuerpo = (
      <>
        <h1 style={titulo(compu)}>Escribe el código</h1>
        <p style={subtitulo}>Te lo mandamos a <b style={{ color: KP.ink }}>{codigoPendiente()}</b>. Tu cuenta ya está creada.</p>
        <CajasDelCodigo valor={codigoCorreo} onCambio={(v) => { setCodigoCorreo(v); if (v) setErrorCodigo(''); }} error={errorCodigo} deshabilitado={ocupado} />
        {ocupado && <div role="status" style={{ display: 'flex', justifyContent: 'center' }}><Loader2 size={22} className="spin" color={KP.blue} /></div>}
        <p style={{ ...subtitulo, fontSize: 13.5, textAlign: 'center', marginTop: 4 }}>El iPhone te lo ofrece arriba del teclado al llegar.</p>
        {Error}
      </>
    );
    pie = (
      <button type="button" onClick={() => { olvidaCodigoPendiente(); avisa('Te lo recordamos en Mi perfil.'); setI(i + 1); }} disabled={ocupado} style={enlace}>
        Lo confirmo después
      </button>
    );
  } else if (paso === 'correo') {
    const bien = correoValido(correo) && !esCorreoInventado(correo);
    cuerpo = (
      <>
        <h1 style={titulo(compu)}>¿Tu correo?</h1>
        <p style={subtitulo}>Para recuperar tu contraseña si la olvidas. Te mandamos un código para confirmar que es tuyo.</p>
        <Campo id="ini-correo" label="Correo" icono={Mail} tipo="email" value={correo} onChange={setCorreo} extra={{ autoCapitalize: 'none', autoCorrect: 'off', autoComplete: 'email', inputMode: 'email' }} />
        {Error}
      </>
    );
    pie = (
      <>
        {continuar(() => crearCuenta(true), 'Mandar código', !bien, false)}
        <button type="button" onClick={() => setSinCorreo(true)} disabled={ocupado} style={enlace}>Crear cuenta sin correo</button>
      </>
    );
  } else if (paso === 'nombre') {
    cuerpo = (
      <>
        <h1 style={titulo(compu)}>¿Cómo te llamas?</h1>
        <p style={subtitulo}>{esCoach ? 'Así te ven tus atletas.' : 'Así te ve tu entrenador.'}</p>
        <Campo id="ini-nombre" label="Nombre" icono={User} value={nombre} onChange={setNombre} extra={{ autoCapitalize: 'words', autoComplete: 'given-name' }} />
        <Campo id="ini-apellido" label="Apellido" icono={User} value={apellido} onChange={setApellido} extra={{ autoCapitalize: 'words', autoComplete: 'family-name' }} />
        {Error}
      </>
    );
    pie = continuar(() => guarda({ full_name: [nombre.trim(), apellido.trim()].filter(Boolean).join(' ') }), 'Continuar', !nombre.trim());
  } else if (paso === 'entrenador' && !conCodigo) {
    pantallaC({
      dibujo: <div style={{ display: 'flex', alignItems: 'center', gap: 18, justifyContent: 'center' }}><DibujoCodigo /><DibujoPunto /></div>,
      tituloC: '¿Entrenas con un entrenador?',
      sub: 'Si no, igual registras tus entrenos y sacas tus stickers.',
      letra: 'Su código lo pones después si quieres.',
      botones: (
        <>
          <Elige Icono={Users} onClick={() => setConCodigo(true)} ocupado={ocupado}>Sí, tengo su código</Elige>
          <Elige Icono={User} onClick={() => guarda({})} ocupado={ocupado}>Entreno por mi cuenta</Elige>
        </>
      ),
    });
  } else if (paso === 'entrenador') {
    const resuelto = !!pro;
    const nombrePro = resuelto ? (pro.full_name || pro.username) : '';
    cuerpo = (
      <>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, justifyContent: 'center', padding: '14px 0 0' }}>
          {resuelto && (
            <span style={{ width: 62, height: 62, borderRadius: '50%', background: KP.blue, color: '#fff', display: 'grid', placeItems: 'center', fontSize: 19, fontWeight: 800, overflow: 'hidden', flex: 'none' }}>
              {pro.avatar_url ? <img src={pro.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : iniciales(nombrePro)}
            </span>
          )}
          <DibujoCodigo codigo={textoCodigo.trim()} chico />
        </div>
        <h1 style={titulo(compu)}>El código de tu entrenador</h1>
        <p style={subtitulo}>Te lo da por mensaje, con un link o un QR.</p>
        <Campo id="ini-codigo" label="Código o usuario" icono={Users} value={textoCodigo} onChange={(v) => setTextoCodigo(v.replace(/\s/g, ''))} extra={{ autoCapitalize: 'characters', autoCorrect: 'off', spellCheck: false, autoFocus: !textoCodigo }} />
        {resuelto && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 18, background: KP.mintSoft }}>
            <span style={{ width: 46, height: 46, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, display: 'grid', placeItems: 'center', background: KP.blue, color: '#fff', fontWeight: 800, fontSize: 16 }}>
              {pro.avatar_url ? <img src={pro.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : iniciales(nombrePro)}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <b style={{ display: 'block', fontSize: 16, overflowWrap: 'anywhere', color: KP.ink }}>{nombrePro}</b>
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
        {continuar(quedarConElCoach, resuelto ? `Quedar con ${nombrePro.split(' ')[0]}` : 'Continuar', !resuelto)}
        <button type="button" onClick={() => { setConCodigo(false); setTextoCodigo(''); setPro(null); }} disabled={ocupado} style={enlace}>No tengo código</button>
      </>
    );
  } else if (paso === 'sobre') {
    saltar = () => guarda({});
    const s = (v, t) => (
      <button
        key={v} type="button" onClick={() => setSexo(v)} aria-pressed={sexo === v}
        style={{
          border: 'none', borderRadius: 11, minHeight: 44, padding: '6px 4px', cursor: 'pointer', fontFamily: FONT, fontSize: 14, fontWeight: 700,
          background: sexo === v ? '#fff' : 'transparent', color: sexo === v ? KP.ink : KP.ink2, boxShadow: sexo === v ? '0 1px 3px rgba(17,19,24,0.1)' : 'none',
        }}
      >
        {t}
      </button>
    );
    const primerNombreCoach = coachDe?.nombre?.split(' ')[0];
    cuerpo = (
      <>
        <h1 style={titulo(compu)}>Sobre ti</h1>
        <p style={subtitulo}>
          Con esto calculamos tus zonas de pulso y te enseñamos los videos de tus ejercicios.{primerNombreCoach ? ` ${primerNombreCoach} ve tu edad.` : ''}
        </p>
        <span style={{ ...rotulo, display: 'block', marginBottom: 7 }}>Sexo</span>
        <div role="group" aria-label="Sexo" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.55fr', gap: 4, background: GRIS, borderRadius: 15, padding: 4, marginBottom: 18 }}>
          {s('m', 'Mujer')}{s('h', 'Hombre')}{s('x', 'Prefiero no decir')}
        </div>
        <Campo id="ini-nac" label="Fecha de nacimiento" icono={Calendar} tipo="date" value={nac} onChange={setNac} extra={{ max: new Date().toISOString().slice(0, 10) }} />
        {Error}
      </>
    );
    pie = continuar(() => guarda({ genero: sexo === 'x' ? null : sexo, fecha_nacimiento: nac || null }), 'Continuar', !sexo);
  } else if (paso === 'reloj') {
    const conectado = (como) => {
      setConectandoReloj(false);
      if (como !== 'conectado') return;
      avisa(reloj.emparejado ? 'Apple Watch conectado.' : 'Apple Salud conectada.');
      guarda({});
    };
    if (saludDisponible() && !relojListo) {
      cuerpo = <div style={{ flex: 1, display: 'grid', placeItems: 'center' }}><Loader2 size={26} className="spin" color={KP.blue} /></div>;
    } else if (saludDisponible()) {
      // En la app del iPhone, con o sin reloj: con Apple Watch se conecta el reloj; sin él, Apple Salud.
      cuerpo = <CuerpoDeConectar emparejado={!!reloj.emparejado} compu={compu} />;
      pie = (
        <>
          <button type="button" className="kp-press" onClick={() => setConectandoReloj(true)} disabled={ocupado} style={botonPrimario(ocupado)}>
            {ocupado ? <Loader2 size={18} className="spin" /> : reloj.emparejado ? 'Conectar Apple Watch' : 'Conectar Apple Salud'}
          </button>
          <button type="button" onClick={() => guarda({})} disabled={ocupado} style={enlace}>Ahora no</button>
          {conectandoReloj && <ConectaReloj empezar="pedir" sinListo alTerminar={conectado} />}
        </>
      );
    } else {
      cuerpo = <AvisoDelReloj compu={compu} />;
      pie = continuar(() => guarda({}));
    }
  } else if (paso === 'oficio') {
    const eligeOficio = (v) => { setOficio(v); if (v !== 'otro') setTimeout(() => guarda({ profesion: v }), 180); };
    cuerpo = (
      <>
        <h1 style={titulo(compu)}>¿A qué te dedicas?</h1>
        <p style={subtitulo}>Así te habla la app: un fisio tiene pacientes, no atletas.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {OFICIOS_DEL_INICIO.map((o) => (
            <button key={o.valor} type="button" className="kp-press" onClick={() => eligeOficio(o.valor)} disabled={ocupado} aria-pressed={oficio === o.valor} style={opcion(oficio === o.valor)}>
              <Cuadro foto={o.foto} icono={o.icono} />
              <span style={{ flex: 1, minWidth: 0 }}>
                {o.titulo || o.valor}
                {o.detalle && <small style={{ display: 'block', fontSize: 13, fontWeight: 500, color: KP.ink2, marginTop: 2 }}>{o.detalle}</small>}
              </span>
            </button>
          ))}
          <button type="button" className="kp-press" onClick={() => eligeOficio('otro')} disabled={ocupado} aria-pressed={oficio === 'otro'} style={opcion(oficio === 'otro')}>
            <Cuadro icono="puntos" color={KP.ink2} />
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
    // Dos columnas: las doce caben en una pantalla, sin bajar.
    cuerpo = (
      <>
        <h1 style={titulo(compu)}>¿Qué entrenas?</h1>
        <p style={subtitulo}>Marca todo lo que aplique. Solo cambia lo que ves primero.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
          {DISCIPLINAS.map((d) => {
            const puesta = entrena.has(d.id);
            return (
              <button
                key={d.id} type="button" className="kp-press" onClick={() => marca(d.id)} aria-pressed={puesta}
                style={{
                  display: 'flex', alignItems: 'center', gap: 9, minHeight: 52, minWidth: 0, border: 'none', borderRadius: 15, padding: '6px 10px 6px 7px',
                  textAlign: 'left', cursor: 'pointer', fontFamily: FONT, fontSize: 14, fontWeight: 700, lineHeight: 1.2, color: KP.ink,
                  background: puesta ? KP.blueSoft : GRIS,
                  // estilo-ok: el anillo azul marca lo que entrena
                  boxShadow: puesta ? `inset 0 0 0 2px ${KP.blue}` : 'none', touchAction: 'manipulation',
                }}
              >
                <Cuadro foto={d.foto} icono={d.icono} color={d.color} lado={36} />
                <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{d.nombre}</span>
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
    pantallaC({
      dibujo: <DibujoEquipo iniciales={iniciales(profile?.full_name || profile?.username || '') || 'TÚ'} />,
      tituloC: '¿Trabajas con más profesionales?',
      sub: 'Fisios, coaches o nutriólogos que atienden a la misma persona.',
      letra: 'Puedes invitar a un colega cuando quieras.',
      botones: (
        <>
          <Elige Icono={Users} onClick={() => guarda({ trabaja_en_equipo: true })} ocupado={ocupado}>Sí, somos un equipo</Elige>
          <Elige Icono={User} onClick={() => guarda({ trabaja_en_equipo: false })} ocupado={ocupado}>Por ahora, solo yo</Elige>
        </>
      ),
    });
  } else if (paso === 'repertorio') {
    pantallaC({
      dibujo: <DibujoEjercicios />,
      tituloC: '¿Con qué ejercicios empiezas?',
      sub: '118 ejercicios de gym con video, listos para usar. O tu lista vacía, solo con lo tuyo.',
      letra: 'Después cambias, borras o escondes cualquier ejercicio.',
      botones: (
        <>
          <Elige Icono={Video} onClick={() => guarda({ repertorio_base: true })} ocupado={ocupado}>Con los de Training Lab</Elige>
          <Elige Icono={Plus} onClick={() => guarda({ repertorio_base: false })} ocupado={ocupado}>Desde cero</Elige>
        </>
      ),
    });
  } else if (paso === 'listo') {
    const pastillas = [];
    if (relojConexion) pastillas.push(reloj.emparejado ? 'Apple Watch conectado' : 'Apple Salud conectada');
    if (via === 'usuario' && user?.email && !esCorreoInventado(user.email)) pastillas.push('Correo confirmado');
    if (esCoach) pastillas.push(profile?.repertorio_base === false ? 'Tus ejercicios, desde cero' : '118 ejercicios listos');
    const bienvenida = (
      <Bienvenida
        compu={compu}
        nombre={parteNombre(profile?.full_name).nombre}
        genero={profile?.genero ?? null}
        esCoach={esCoach}
        coach={esCoach ? null : coachDe}
        pastillas={pastillas}
        via={via}
        usuario={profile?.username || ''}
        ocupado={ocupado}
        onIr={terminar}
        onCambiar={() => setHojaUsuario(true)}
        onAtras={i > 0 ? () => setI(i - 1) : null}
      />
    );
    return (
      <div style={compu ? { minHeight: '100svh', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '28px 20px 40px', background: '#F4F5F8' } : undefined}>
        <div style={compu ? { width: '100%', maxWidth: 560, boxShadow: '0 24px 60px rgba(17,19,24,0.16)', borderRadius: 26 } : undefined}>{bienvenida}</div>
        {/* «Cambiar»: la misma hoja de Mi perfil. La bienvenida no se vuelve a animar al cerrarla (no se desmonta). */}
        {hojaUsuario && <HojaDeUsuario onCerrar={() => setHojaUsuario(false)} alGuardar={() => { setHojaUsuario(false); avisa('Usuario guardado.'); }} />}
        {Error && <div style={{ position: 'fixed', left: 20, right: 20, bottom: 20 }}>{Error}</div>}
        <style>{'.spin{animation:spin .8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}'}</style>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100svh', display: 'flex', alignItems: compu ? 'flex-start' : 'stretch', justifyContent: 'center',
        padding: compu ? '28px 20px 40px' : 0, fontFamily: FONT, background: compu ? '#F4F5F8' : '#fff',
      }}
    >
      <div
        key={`${paso}-${conCodigo}`}
        className="animate-fade-in"
        style={compu
          ? {
            width: '100%', maxWidth: 560, background: KP.surface, borderRadius: 26,
            boxShadow: '0 24px 60px rgba(17,19,24,0.10)', padding: '22px 30px 26px', display: 'flex', flexDirection: 'column',
            minHeight: 600, position: 'relative',
          }
          : {
            width: '100%', display: 'flex', flexDirection: 'column', padding: 'calc(14px + env(safe-area-inset-top, 0px)) 22px calc(14px + env(safe-area-inset-bottom, 0px))',
            minHeight: '100svh', background: KP.surface, position: 'relative',
          }}
      >
        {cabecera(saltar)}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>{cuerpo}</div>
        {pie && <div style={{ display: 'flex', flexDirection: 'column', gap: estiloC ? 0 : 4, paddingTop: estiloC ? 10 : 18 }}>{pie}</div>}
      </div>

      {/* «Crear cuenta sin correo»: se pregunta antes, porque sin correo no hay cómo recuperar la contraseña solo. */}
      {sinCorreo && (
        <HojaFlotante titulo="¿Crear tu cuenta sin correo?" onCerrar={() => setSinCorreo(false)} ancho={460}>
          <p style={{ margin: '0 4px 16px', fontSize: 15, fontWeight: 500, color: KP.ink2, lineHeight: 1.5, fontFamily: FONT }}>
            Si olvidas tu contraseña, {esCoach ? 'nos la pides por mensaje' : 'te la da tu entrenador'}. El correo lo pones cuando quieras en Mi perfil.
          </p>
          <div style={{ display: 'grid', gap: 4 }}>
            <Boton ancho onClick={() => setSinCorreo(false)}>Poner mi correo</Boton>
            <button type="button" onClick={() => { setSinCorreo(false); crearCuenta(false); }} style={enlace}>Seguir sin correo</button>
          </div>
        </HojaFlotante>
      )}
      <style>{'.spin{animation:spin .8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}'}</style>
    </div>
  );
}
