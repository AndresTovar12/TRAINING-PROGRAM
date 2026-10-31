import { useEffect, useRef, useState } from 'react';
import {
  Activity, AtSign, Bike, Calendar, Check, ChevronLeft, ChevronRight, Dumbbell, Flame, HeartPulse, Loader2, Lock, Mail, Medal, MoreHorizontal,
  PersonStanding, Plus, Trophy, User, Users, Video, Waves, Eye, EyeOff,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useIsWide } from '@/lib/useViewport';
import { useAviso } from '@/components/AvisoPasajero';
import { supabase } from '@/lib/supabase';
import { activarInvitacion, agregarAMiEquipo, completarMiPerfil, profesionalPorReferencia } from '@/lib/api';
import { DISCIPLINAS, OFICIOS_DEL_INICIO } from '@/lib/oficios';
import { FONT, KP, UI, oficioCorto } from '@/lib/theme';
import { correoValido, esCorreoInventado, guardaCorreoPorConfirmar, olvidaCorreoPorConfirmar } from '@/lib/correos';
import { confirmaCorreoConCodigo, pideCodigoDeCorreo } from '@/lib/correoDeLaCuentaApi';
import { eliminaMiCuenta } from '@/lib/miCuentaApi';
import {
  GRIS, botonPrimario, cajaDeCampo, cuadroDeIcono, elige as estiloElige, enlace, entrada, error as estiloError, letraChica, opcion, rotulo, subtitulo, titulo,
} from '@/features/inicio/estilos';
import { guardaTipoPendiente, leeTipoPendiente, olvidaTipoPendiente } from '@/features/inicio/tipoPendiente';
import { codigoPendiente, esInvitado, guardaCodigoPendiente, marcaInvitado, olvidaCodigoPendiente } from '@/features/inicio/marcas';
import { anotaEnvio, contrasenaNueva, correoPorConfirmarDe, envioDelCodigo, marcaCorreoConfirmado, olvidaCuentaNueva, oyeEnvio, recuerdaContrasena } from '@/features/inicio/cuentaNueva';
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
 *   · LA CUENTA NACE EN «¿TU CORREO?», con «Mandar código». Lo demás se guarda paso a paso en su perfil, con `inicio_paso`
 *     apuntando a lo que sigue: si cierra a la mitad, al volver retoma ahí (App.jsx vuelve a abrir esto mientras `inicio_paso` no sea null).
 *   · NADIE ENTRA SIN CONFIRMAR SU CORREO (31 oct 2026, maqueta RcFd9dYXoYxzYAinD5eQDB): se quitaron «Crear cuenta sin correo» y «Lo confirmo después».
 *     El nombre va ANTES del usuario y la contraseña, y la contraseña se escribe dos veces. «Escribe el código» trae «Mandar otro», «Cambiar correo» y, abajo,
 *     Apple o Google: si se va por ahí, la cuenta a medias se borra.
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
 *   atleta con usuario          tipo → nombre → cuenta → correo → entrenador → sobre → reloj → bienvenida
 *   coach                       tipo → (nombre → cuenta → correo, solo con usuario) → oficio → entrena → equipo → repertorio → bienvenida
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

const ORDEN_COACH = ['tipo', 'nombre', 'cuenta', 'correo', 'oficio', 'entrena', 'equipo', 'repertorio', 'listo'];
const ORDEN_ATLETA = ['tipo', 'nombre', 'cuenta', 'correo', 'entrenador', 'sobre', 'reloj', 'listo'];
const ANTES_DE_LA_CUENTA = new Set(['tipo', 'cuenta', 'correo']);
// Quien estaba a la mitad del inicio de antes (29 oct 2026) sigue en la pantalla que la reemplazó.
const PASO_DE_ANTES = { codigo: 'entrenador', sexo: 'sobre', nacimiento: 'sobre', unidad: 'sobre', tour: 'listo' };
const USERNAME_RE = /^[a-zA-Z0-9_.]{3,30}$/;

/* Los pasos que le faltan a ESTE perfil. Se calcula una vez al montar (ver `key` en App.jsx): si se recalculara en cada pintada, el paso «nombre»
   desaparecería en cuanto se guardara el nombre y el botón de atrás ya no sabría a dónde ir. Con el código del correo recién mandado, «Escribe el código»
   va primero (es la segunda mitad de «¿Tu correo?»). */
function pasosDe(modo, perfil, esCoach, usuario) {
  if (modo === 'nuevo') return ['tipo', 'nombre', 'cuenta', 'correo'];
  if (modo === 'invitacion') return ['cuenta', 'correo'];
  if (modo === 'google') return ['tipo'];
  const orden = esCoach ? ORDEN_COACH : ORDEN_ATLETA;
  const resto = orden.filter((p) => {
    if (ANTES_DE_LA_CUENTA.has(p)) return false;
    if (p === 'nombre' && (perfil?.full_name || '').trim()) return false;   // Apple, Google o la invitación ya dieron el nombre
    if (p === 'entrenador' && perfil?.coach_id) return false;               // ya quedó con su entrenador (código o invitación)
    return true;
  });
  // «Escribe el código» va primero si la cuenta tiene un correo sin confirmar: lo dice la memoria de esta pestaña O el servidor (`correoPorConfirmarDe`).
  return codigoPendiente() || correoPorConfirmarDe(usuario) ? ['correo', ...resto] : resto;
}

/* El camino completo de cada quien, para la barra de arriba: solo cuenta SUS pasos, y la bienvenida no cuenta. */
function caminoDe({ esCoach, social, invitado, pideNombre }) {
  if (invitado) return social ? ['sobre', 'reloj'] : ['cuenta', 'correo', 'sobre', 'reloj'];
  const cuenta = social ? (pideNombre ? ['nombre'] : []) : ['nombre', 'cuenta', 'correo'];
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

/* El marco de cada pantalla del inicio: en la compu una tarjeta al centro; en el teléfono la pantalla entera. Lo usan el inicio y `CodigoEnCamino`. */
const marcoDeFuera = (compu) => ({
  minHeight: '100svh', display: 'flex', alignItems: compu ? 'flex-start' : 'stretch', justifyContent: 'center',
  padding: compu ? '28px 20px 40px' : 0, fontFamily: FONT, background: compu ? '#F4F5F8' : '#fff',
});
const marcoDeDentro = (compu) => (compu
  ? {
    width: '100%', maxWidth: 560, background: KP.surface, borderRadius: 26,
    boxShadow: '0 24px 60px rgba(17,19,24,0.10)', padding: '22px 30px 26px', display: 'flex', flexDirection: 'column',
    minHeight: 600, position: 'relative',
  }
  : {
    width: '100%', display: 'flex', flexDirection: 'column', padding: 'calc(14px + env(safe-area-inset-top, 0px)) 22px calc(14px + env(safe-area-inset-bottom, 0px))',
    minHeight: '100svh', background: KP.surface, position: 'relative',
  });

const ligaDelCodigo = (apagada) => ({
  minHeight: 44, border: 'none', background: 'none', padding: '0 8px', borderRadius: 10, fontFamily: FONT, fontSize: 15,
  fontWeight: apagada ? 600 : 700, color: apagada ? KP.ink3 : KP.blue, cursor: apagada ? 'default' : 'pointer',
  fontVariantNumeric: 'tabular-nums', touchAction: 'manipulation',
});

/** «Escribe el código» (31 oct 2026, maqueta RcFd9dYXoYxzYAinD5eQDB): el código, el aviso de No deseado (bien visible: ahí caen los códigos de un dominio nuevo,
    sobre todo en Hotmail) y «Mandar otro · Cambiar correo». `envio` es cómo va el envío (`cuentaNueva.js`); sin él (la app se recargó), se da por mandado. */
export function CuerpoDelCodigo({ compu, correo, envio, codigo = '', onCodigo, errorCodigo = '', ocupado = false, espera = 0, onOtro, onCambiar, error = null, clave = '', onClave, onMandarConClave }) {
  const mandando = envio?.estado === 'mandando';
  const fallo = envio?.estado === 'fallo';
  const mm = Math.floor(espera / 60);
  const ss = String(espera % 60).padStart(2, '0');
  const otroApagado = ocupado || mandando || espera > 0;
  // El servidor pide la contraseña para mandar otro código (la cuenta ya tiene más de un día o la pestaña no la recuerda): se escribe aquí, no se queda mudo.
  const pideClave = fallo && (envio?.codigo === 'FALTA_CONTRASENA' || envio?.codigo === 'CONTRASENA_MAL') && !!onClave;
  return (
    <>
      <h1 style={titulo(compu)}>Escribe el código</h1>
      <p role="status" style={subtitulo}>
        {mandando ? <>Mandando el código a <b style={{ color: KP.ink }}>{correo}</b>…</>
          : fallo ? <>No pudimos mandarlo a <b style={{ color: KP.ink }}>{correo}</b>.</>
          : <>Te lo mandamos a <b style={{ color: KP.ink }}>{correo}</b>.</>}
      </p>
      {fallo && <p role="alert" style={{ ...estiloError, marginTop: -4 }}>{envio.error}</p>}
      {pideClave && (
        <>
          <Campo id="ini-clave-codigo" label="Tu contraseña" icono={Lock} tipo="password" ojo value={clave} onChange={onClave} extra={{ autoComplete: 'current-password' }} />
          <button type="button" className="kp-press" onClick={onMandarConClave} disabled={ocupado || !clave} style={{ ...botonPrimario(ocupado, !clave), marginBottom: 14 }}>
            {ocupado ? <Loader2 size={18} className="spin" /> : 'Mandar código'}
          </button>
        </>
      )}
      <CajasDelCodigo valor={codigo} onCambio={onCodigo ?? (() => {})} error={errorCodigo} deshabilitado={ocupado || fallo || !onCodigo} />
      {ocupado && <div role="status" style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}><Loader2 size={22} className="spin" color={KP.blue} /></div>}
      {!fallo && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: KP.blueSoft, color: KP.ink, borderRadius: 14, padding: '12px 14px', margin: '4px 0 14px', fontSize: 14, lineHeight: 1.4, fontWeight: 500 }}>
          <Mail size={18} color={KP.blue} style={{ flex: 'none', marginTop: 1 }} />
          <span>¿No lo ves? Revisa tu carpeta de <b style={{ fontWeight: 800 }}>Correo no deseado</b> o <b style={{ fontWeight: 800 }}>Spam</b>. Los correos nuevos a veces caen ahí.</span>
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, flexWrap: 'wrap' }}>
        <button type="button" onClick={onOtro} disabled={otroApagado || !onOtro} style={ligaDelCodigo(otroApagado || !onOtro)}>
          {espera > 0 && !fallo ? `Mandar otro en ${mm}:${ss}` : 'Mandar otro'}
        </button>
        <span aria-hidden="true" style={{ color: KP.ink3, fontWeight: 700 }}>·</span>
        <button type="button" onClick={onCambiar} disabled={ocupado || !onCambiar} style={ligaDelCodigo(ocupado || !onCambiar)}>Cambiar correo</button>
      </div>
      {error}
    </>
  );
}

/** Abajo de «Escribe el código»: si el código no llega, entrar con Apple o Google (la cuenta a medias se borra, ver `entraConOtra`). */
export function OtraEntrada({ apple, google, ocupado, onApple, onGoogle }) {
  if (!apple && !google) return null;
  const boton = {
    minHeight: 50, borderRadius: KP.rBtn, border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    gap: 8, fontFamily: FONT, fontSize: 15, fontWeight: 700, touchAction: 'manipulation',
  };
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '0 0 10px' }}>
        <span style={{ flex: 1, height: 1, background: KP.line }} />
        <span style={{ fontSize: 12.5, fontWeight: 700, color: KP.ink3 }}>¿Problemas con el código?</span>
        <span style={{ flex: 1, height: 1, background: KP.line }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: apple && google ? '1fr 1fr' : '1fr', gap: 8 }}>
        {apple && (
          // Las reglas de Apple para su botón: negro con texto blanco y su logo.
          <button type="button" className="kp-press" onClick={onApple} disabled={ocupado} style={{ ...boton, background: '#000', color: '#fff' }}>
            <svg width="15" height="18" viewBox="0 0 17 20" aria-hidden="true" fill="#fff">
              <path d="M14.1 10.6c0-2.4 2-3.5 2.1-3.6-1.1-1.7-2.9-1.9-3.5-1.9-1.5-.2-2.9.9-3.7.9-.8 0-1.9-.9-3.1-.8-1.6 0-3.1.9-3.9 2.4-1.7 2.9-.4 7.2 1.2 9.5.8 1.2 1.8 2.5 3 2.4 1.2 0 1.7-.8 3.1-.8s1.9.8 3.1.8c1.3 0 2.1-1.2 2.9-2.3.9-1.3 1.3-2.6 1.3-2.7 0 0-2.5-1-2.5-4zM11.8 3.5c.7-.8 1.1-1.9 1-3-.9 0-2.1.6-2.8 1.4-.6.7-1.1 1.8-1 2.9 1.1.1 2.1-.5 2.8-1.3z" />
            </svg>
            Apple
          </button>
        )}
        {google && (
          <button type="button" className="kp-press" onClick={onGoogle} disabled={ocupado} style={{ ...boton, background: UI.relleno, color: KP.ink }}>
            <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h11.8c-.5 2.7-2 5-4.4 6.6v5.5h7.1c4.2-3.8 6.6-9.5 6.6-16.1z" />
              <path fill="#34A853" d="M24 46c6 0 11-2 14.6-5.4l-7.1-5.5c-2 1.3-4.5 2.1-7.5 2.1-5.8 0-10.6-3.9-12.4-9.1H4.3v5.7C7.9 41 15.4 46 24 46z" />
              <path fill="#FBBC05" d="M11.6 28.1c-.5-1.3-.7-2.7-.7-4.1s.3-2.8.7-4.1v-5.7H4.3C2.8 17.1 2 20.4 2 24s.8 6.9 2.3 9.8l7.3-5.7z" />
              <path fill="#EA4335" d="M24 10.8c3.3 0 6.2 1.1 8.5 3.3l6.3-6.3C35 4.3 30 2 24 2 15.4 2 7.9 7 4.3 14.2l7.3 5.7c1.8-5.2 6.6-9.1 12.4-9.1z" />
            </svg>
            Google
          </button>
        )}
      </div>
    </>
  );
}

/** Lo que se ve MIENTRAS la app se rearma al nacer la cuenta (App.jsx, sin perfil todavía): «Escribe el código» mandándose, en vez de la carga con el logo
    (Andrés, 31 oct 2026: «se ve bastante fea»). Al llegar el perfil la reemplaza el inicio de verdad, con el mismo dibujo. */
export function CodigoEnCamino() {
  const compu = useIsWide();
  return (
    <div style={marcoDeFuera(compu)}>
      <div style={marcoDeDentro(compu)}>
        <div style={{ minHeight: 40 }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <CuerpoDelCodigo compu={compu} correo={codigoPendiente()} envio={{ estado: 'mandando' }} ocupado={false} />
        </div>
      </div>
      <style>{'.spin{animation:spin .8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}'}</style>
    </div>
  );
}

/* `codigo`: el código de equipo de un link `?unirse=` (en 'nuevo' ya se usa al crear la cuenta; en 'retomar' llega puesto en «El código de tu entrenador»).
   `onCodigoUsado` avisa cuando ya se usó, para que la app no vuelva a pedirlo. `invitacion`: en modo 'invitacion', `{ token, datos }` (`datos` de `verInvitacion`). */
export default function Inicio({ modo = 'nuevo', codigo = '', onVolver, onCodigoUsado, invitacion = null }) {
  const { profile, user, signIn, signUp, signOut, updateProfile, refreshProfile, entrarConApple, entrarConGoogle, appleDisponible, googleDisponible } = useAuth();
  const { avisa } = useAviso();
  const compu = useIsWide();

  // Con Google: si ya había contestado el tipo antes de salir, se aplica solo (ver el efecto de abajo).
  const [tipoDeGoogle] = useState(() => (modo === 'google' ? leeTipoPendiente() : null));

  // Lo de ANTES de la cuenta vive aquí; lo de después, en el perfil.
  const [tipo, setTipo] = useState(modo === 'nuevo' && codigo ? 'atleta' : tipoDeGoogle);
  const [usuario, setUsuario] = useState('');
  const [clave, setClave] = useState('');
  const [clave2, setClave2] = useState('');   // «Confirma tu contraseña» (31 oct 2026)
  const [correo, setCorreo] = useState('');

  const esCoach = modo === 'nuevo' ? tipo === 'coach' : modo === 'invitacion' ? false : profile?.role === 'admin';
  const [pasos] = useState(() => pasosDe(modo, profile, profile?.role === 'admin', user));
  // El correo al que va el código: el último que se tecleó en esta pestaña (por «Cambiar correo») o, si la pestaña no se acuerda, el que el servidor tiene pendiente.
  const enEspera = () => codigoPendiente() || correoPorConfirmarDe(user);
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
  const [codigoCorreo, setCodigoCorreo] = useState('');
  const [errorCodigo, setErrorCodigo] = useState('');
  // «Escribe el código»: cómo va el envío (ver `cuentaNueva.js`), la espera de «Mandar otro» y «Cambiar correo» (el campo del correo otra vez).
  const [envio, setEnvio] = useState(() => envioDelCodigo());
  const [espera, setEspera] = useState(() => {
    const estado = envioDelCodigo()?.estado;
    // Solo si el código acaba de salir en esta pestaña. Si la pestaña no sabe (se abrió de nuevo), 0: el servidor ya pone su propia espera entre un código y otro.
    return modo === 'retomar' && estado === 'mandado' ? 60 : 0;
  });
  const [cambiando, setCambiando] = useState(false);
  const [claveDelCodigo, setClaveDelCodigo] = useState('');   // pasadas las 24 h (o con la pestaña nueva) el servidor pide la contraseña para mandar otro código
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

  /* LA CUENTA NACE AQUÍ, con «Mandar código». En cuanto hay sesión, App.jsx arma el inicio otra vez (modo 'retomar'), así que lo que cruza ese cambio se anota
     ANTES: el correo (`guardaCodigoPendiente`, el inicio nuevo lo lee al montarse y abre «Escribe el código») y el envío del código (`anotaEnvio`, en memoria:
     mientras la app se rearma, `CodigoEnCamino` ocupa la pantalla en vez de la carga con el logo, y «Escribe el código» dice si salió o por qué no). */
  async function crearCuenta() {
    setOcupado(true);
    setError('');
    const email = correo.trim();
    guardaCodigoPendiente(email);
    recuerdaContrasena(clave);
    let suelta = null;
    anotaEnvio(new Promise((res, rej) => { suelta = { res, rej }; }));
    const sigueElEnvio = (promesa) => (promesa ?? Promise.reject(new Error('No se pudo mandar el código. Pide otro.'))).then(suelta.res, suelta.rej);
    const deshaz = (e) => { olvidaCodigoPendiente(); olvidaCuentaNueva(); falloAlCrear(e); };
    if (modo === 'invitacion') {
      try {
        marcaInvitado();
        // Lo demás («Sobre ti», el reloj) se pregunta después: el servidor deja `inicio_paso = 'sobre'`.
        const r = await activarInvitacion({ token: invitacion?.token, username: usuario.trim(), password: clave, email, nombre: invitacion?.datos?.nombre, apellido: invitacion?.datos?.apellido });
        const { error: errEntrar } = await signIn(r.username, clave);
        if (errEntrar) throw new Error(errEntrar.message);
        if (r.correo_pendiente) {
          guardaCorreoPorConfirmar(r.correo_pendiente);
          sigueElEnvio(pideCodigoDeCorreo(r.correo_pendiente, clave));
        } else {
          olvidaCodigoPendiente();
          olvidaCuentaNueva();
        }
      } catch (e) {
        deshaz(e);
      }
      return;
    }
    const { error: e, correoPendiente, envio: envioNuevo } = await signUp({
      username: usuario.trim(), email, password: clave,
      fullName: [nombre.trim(), apellido.trim()].filter(Boolean).join(' '),
      accountType: tipo === 'coach' ? 'coach' : 'athlete',
      coachUsername: tipo === 'atleta' ? codigo : '',
      // El nombre ya viene: lo que sigue después del código.
      inicioPaso: tipo === 'coach' ? 'oficio' : 'entrenador',
    });
    if (e) { deshaz(e); return; }
    if (correoPendiente) sigueElEnvio(envioNuevo); else { olvidaCodigoPendiente(); olvidaCuentaNueva(); }
    // La sesión nueva vuelve a dibujar la app; esta pantalla se va sola. El código de equipo ya se usó.
    onCodigoUsado?.();
  }

  // «Escribe el código» oye cómo va el envío; en cuanto sale (o al abrir la pantalla) arranca la espera de «Mandar otro».
  useEffect(() => oyeEnvio((v) => { setEnvio(v); if (v?.estado === 'mandado') setEspera(60); }), []);
  useEffect(() => {
    if (espera <= 0) return undefined;
    const t = setTimeout(() => setEspera((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(t);
  }, [espera]);

  /* «Mandar otro» y «Cambiar correo» (31 oct 2026). Sin la contraseña en memoria (la app se recargó) el servidor igual deja pedirlo: es una cuenta recién nacida. */
  function mandaCodigo(destino) {
    const limpio = String(destino ?? '').trim().toLowerCase();
    setErrorCodigo('');
    setCodigoCorreo('');
    guardaCodigoPendiente(limpio);
    guardaCorreoPorConfirmar(limpio);
    const promesa = pideCodigoDeCorreo(limpio, contrasenaNueva() || claveDelCodigo || undefined);
    anotaEnvio(promesa);
    promesa.catch(() => { /* lo dice la pantalla */ });
    return promesa;
  }

  /* «¿Problemas con el código?» → Apple o Google. La cuenta a medias (sin correo confirmado) se borra primero, para que no quede una cuenta que nadie comprobó;
     luego se sale y se entra con el proveedor. Si se borra pero Apple o Google no abren, queda en la puerta de entrada, sin cuenta a medias.
     Borrar pide la contraseña (`mi-cuenta`): va la de memoria. Si la app se recargó y ya no está, no se borra y solo se sale: esa cuenta nunca tuvo un correo
     confirmado, así que no queda nada que alguien pueda usar (solo el usuario apartado). */
  async function entraConOtra(cual) {
    setOcupado(true);
    setError('');
    if (contrasenaNueva()) {
      try {
        await eliminaMiCuenta({ confirmacion: 'ELIMINAR', contrasena: contrasenaNueva() });
      } catch (e) {
        setError(e.message || 'No se pudo cerrar esta cuenta. Inténtalo otra vez.');
        setOcupado(false);
        return;
      }
    }
    guardaTipoPendiente(esCoach ? 'coach' : 'atleta'); // al volver de Apple o Google no se le pregunta otra vez qué va a hacer
    olvidaCodigoPendiente();
    olvidaCorreoPorConfirmar();
    olvidaCuentaNueva();
    await signOut();
    const r = cual === 'apple' ? await entrarConApple() : await entrarConGoogle();
    if (r?.error) avisa(r.error.message);
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
      .then(() => { marcaCorreoConfirmado(user?.id); olvidaCodigoPendiente(); olvidaCuentaNueva(); avisa('Correo confirmado.'); setI((n) => n + 1); })
      .catch((e) => { setErrorCodigo(e.message || 'Ese código no sirve. Revísalo e inténtalo otra vez.'); setCodigoCorreo(''); })
      .finally(() => { confirmando.current = false; setOcupado(false); });
  }, [codigoCorreo, paso, modo, refreshProfile, avisa, user?.id]);

  async function salir() {
    setOcupado(true);
    // Lo que la pestaña recuerda es de ESTA cuenta: si se queda, otra persona que entre aquí vería el código de la anterior.
    olvidaCodigoPendiente();
    olvidaCuentaNueva();
    await signOut();
    avisa('Cerraste sesión. Puedes entrar con otra cuenta.');
  }

  function atras() {
    if (paso === 'entrenador' && conCodigo) { setConCodigo(false); setTextoCodigo(''); setPro(null); setError(''); return; }
    // En «Escribe el código», atrás = «Cambiar correo»: vuelve al campo con el correo escrito (no se puede saltar el código, pero sí corregir el correo).
    if (enElCodigo && !cambiando) { setCorreo(enEspera()); setError(''); setCambiando(true); return; }
    if (cambiando) { setCambiando(false); setError(''); return; }
    if (i === 0) { onVolver?.(); return; }
    setI(i - 1);
  }

  /* ---------- la barra de arriba ---------- */
  const camino = caminoDe({ esCoach, social, invitado, pideNombre: pasos.includes('nombre') || (modo === 'google' && !(profile?.full_name || '').trim()) });
  const hechos = camino.indexOf(paso);
  const muestraBarra = paso !== 'listo';
  const primeraTrasApple = modo === 'google' && paso === 'tipo';
  // «Escribe el código» no se puede saltar (31 oct 2026), pero sí regresar: la flecha abre «Cambiar correo» y desde ahí vuelve al código.
  const enElCodigo = paso === 'correo' && modo === 'retomar';
  const atrasEsElCodigo = modo === 'retomar' && pasos[i - 1] === 'correo'; // ya confirmado: no se regresa a escribirlo
  const puedeAtras = !primeraTrasApple && (enElCodigo ? true
    : ((i > 0 && !atrasEsElCodigo) || (paso === 'entrenador' && conCodigo) || ((modo === 'nuevo' || modo === 'invitacion') && !!onVolver)));

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
      {/* Con sesión siempre se puede salir (31 oct 2026): sin esto, quien no recibe el código no podía ni cambiar de cuenta en este aparato. */}
      {modo === 'retomar' && !primeraTrasApple && paso !== 'listo' && (
        <button type="button" onClick={salir} disabled={ocupado} style={{ ...enlace, width: 'auto', minHeight: 36, padding: '6px 2px', color: KP.ink3, fontWeight: 600 }}>Salir</button>
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
    const valido = USERNAME_RE.test(usuario.trim()) && !problemaDeContrasena(clave, { usuario: usuario.trim() }) && clave2 === clave;
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
    // La segunda vez (31 oct 2026): no regaña mientras todavía va escribiendo lo mismo; solo cuando ya escribió de más o algo distinto.
    const avisoDeClave2 = !clave2 ? null
      : clave2 === clave ? { texto: 'Las dos coinciden.', tono: 'bien' }
      : clave.startsWith(clave2) ? null
      : { texto: 'Las contraseñas no coinciden.', tono: 'mal' };
    const pintaAviso = (a) => (a ? (
      <p role="status" style={{ margin: '-6px 2px 12px', fontSize: 13.5, fontWeight: 700, lineHeight: 1.4, color: a.tono === 'bien' ? KP.mint : a.tono === 'mal' ? KP.danger : KP.ink2 }}>{a.texto}</p>
    ) : null);
    const sigue = () => {
      if (!USERNAME_RE.test(usuario.trim())) { setError('El usuario lleva de 3 a 30 letras, números, _ o .'); return; }
      const problema = problemaDeContrasena(clave, { usuario: usuario.trim() });
      if (problema) { setError(problema); return; }
      if (clave2 !== clave) { setError('Las contraseñas no coinciden.'); return; }
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
        <Campo id="ini-clave2" label="Confirma tu contraseña" icono={Lock} tipo="password" ojo value={clave2} onChange={setClave2} extra={{ placeholder: 'Escríbela otra vez', autoComplete: 'new-password' }} />
        {pintaAviso(avisoDeClave2)}
        {Error}
      </>
    );
    pie = continuar(sigue, 'Continuar', !valido);
  } else if (paso === 'correo' && (modo !== 'retomar' || cambiando)) {
    // «¿Tu correo?»: la cuenta nace aquí. Con «Cambiar correo» (ya con la cuenta creada) es la misma pantalla y regresa a «Escribe el código».
    const bien = correoValido(correo) && !esCorreoInventado(correo);
    const manda = cambiando ? () => { mandaCodigo(correo); setCambiando(false); } : crearCuenta;
    cuerpo = (
      <>
        <h1 style={titulo(compu)}>¿Tu correo?</h1>
        <p style={subtitulo}>Te mandamos un código para confirmar que es tuyo. Sirve para recuperar tu contraseña si la olvidas.</p>
        <Campo id="ini-correo" label="Correo" icono={Mail} tipo="email" value={correo} onChange={setCorreo} extra={{ autoCapitalize: 'none', autoCorrect: 'off', autoComplete: 'email', inputMode: 'email', autoFocus: cambiando }} />
        {Error}
      </>
    );
    pie = (
      <button type="button" className="kp-press" onClick={manda} disabled={!bien || ocupado} style={botonPrimario(ocupado, !bien)}>
        {ocupado ? <><Loader2 size={18} className="spin" />Mandando el código…</> : 'Mandar código'}
      </button>
    );
  } else if (paso === 'correo') {
    // La segunda mitad de «¿Tu correo?»: la cuenta ya nació y el código va en camino. No se puede saltar (31 oct 2026).
    cuerpo = (
      <CuerpoDelCodigo
        compu={compu} correo={enEspera()} envio={envio}
        codigo={codigoCorreo} onCodigo={(v) => { setCodigoCorreo(v); if (v) setErrorCodigo(''); }} errorCodigo={errorCodigo}
        ocupado={ocupado} espera={espera}
        onOtro={() => { mandaCodigo(enEspera()).then(() => avisa('Te mandamos otro código.'), () => {}); }}
        onCambiar={() => { setCorreo(enEspera()); setError(''); setCambiando(true); }}
        clave={claveDelCodigo} onClave={setClaveDelCodigo}
        onMandarConClave={() => { mandaCodigo(enEspera()).then(() => { setClaveDelCodigo(''); avisa('Te mandamos otro código.'); }, () => {}); }}
        error={Error}
      />
    );
    pie = (
      <OtraEntrada
        apple={appleDisponible} google={googleDisponible} ocupado={ocupado}
        onApple={() => entraConOtra('apple')} onGoogle={() => entraConOtra('google')}
      />
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
    // Antes de la cuenta (31 oct 2026: el nombre va primero) solo se recuerda: viaja al crear la cuenta. Después, se guarda en su perfil.
    pie = modo === 'nuevo'
      ? continuar(() => setI(i + 1), 'Continuar', !nombre.trim() || !apellido.trim())
      : continuar(() => guarda({ full_name: [nombre.trim(), apellido.trim()].filter(Boolean).join(' ') }), 'Continuar', !nombre.trim());
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
    <div style={marcoDeFuera(compu)}>
      <div
        // Al llegar a «Escribe el código» desde `CodigoEnCamino` no se anima: es la misma pantalla que ya estaba.
        key={`${paso}-${conCodigo}-${cambiando}`}
        className={enElCodigo && !cambiando && i === 0 ? undefined : 'animate-fade-in'}
        style={marcoDeDentro(compu)}
      >
        {cabecera(saltar)}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>{cuerpo}</div>
        {pie && <div style={{ display: 'flex', flexDirection: 'column', gap: estiloC ? 0 : 4, paddingTop: estiloC ? 10 : 18 }}>{pie}</div>}
      </div>

      <style>{'.spin{animation:spin .8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}'}</style>
    </div>
  );
}
