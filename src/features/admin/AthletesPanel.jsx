import { useEffect, useMemo, useState } from 'react';
import {
  Loader2, Plus, Trash2, X, ChevronRight, ChevronLeft, Pencil,
  CalendarClock, User as UserIcon, Shield, ClipboardList,
  UserMinus, Power, AlertTriangle, Eye, ChevronDown, ChevronUp, UserPlus,
  Check, Copy, Share2, CircleCheck, RotateCcw, CalendarPlus, FolderOpen, ListChecks, HeartPulse, MessageCircle,
} from 'lucide-react';
import {
  getProgramas, getSesionesPegadas, deletePlan, getAthleteState, listAthletesOverview, listCoaches, setAthleteCoach,
  quitarAtletaDeMiLista, setAtletaActivo, resumenDatosAtleta, eliminarAtletaDefinitivo,
  invitacionesPendientes, ligaDeInvitacion, cambiarAlta, cambiarAltaDeEquipo, nombresDelEquipo,
  listEquipo, equiposDeMisAtletas, marcarAvisoVisto, primerosPasos,
} from '@/lib/api';
import {
  resumenDeDolor, textoDeDolor, hechasEstaSemana, esperadasEstaSemana, lineaDeLista,
} from '@/lib/comoVa';
import PlanBuilder from '@/features/admin/PlanBuilder';
import SesionesSobreElPrograma from '@/features/admin/SesionesSobreElPrograma';
import CambiosDelPlan from '@/features/admin/CambiosDelPlan';
import NotasDeConsulta from '@/features/admin/NotasDeConsulta';
import AgregarAtleta from '@/features/admin/AgregarAtleta';
import SinLugares from '@/features/admin/SinLugares';
import { useLugares } from '@/features/admin/useLugares';
import { etiquetaDeLugares, sinLugares } from '@/lib/limiteDeAtletas';
import { AgregarAlEquipo, AvisosDelCoach, FilaDeEquipo, GrupoPlegable } from '@/features/admin/EquipoDeAtleta';
import { useAuth } from '@/contexts/AuthContext';
import { usePalabras } from '@/contexts/PalabrasContext';
import { useConfirmacion } from '@/components/Confirmacion';
import AbreMetricas from '@/features/metricas/AbreMetricas';
import { useIsDesktop } from '@/lib/useViewport';
import { T, FONT, KP, UI } from '@/lib/theme';
import { Avatar as Iniciales, Buscador, Fila, Grupo, IconoDeFila, Pastilla } from '@/components/ui';
import { plural, pluralS } from '@/lib/plural';
import { esDescanso, dondeVa, sessionIdFor, estructuraDelPlan, semanaDelAtleta } from '@/lib/training-utils';
import { colorDePrograma, esProgramaFantasma, nombreCorto, rolDeProfesion } from '@/lib/programas';
import { fasesConPegadas, reglasDe } from '@/lib/pegadas';
import AsignarAlAtleta from '@/features/misplanes/AsignarAlAtleta';
import HojaFlotante from '@/components/HojaFlotante';
import NavegadorDelPlan from '@/components/NavegadorDelPlan';
import DentroDelDia from '@/features/admin/DentroDelDia';
import ListaDesplegable from '@/components/ListaDesplegable';
import CodigoDeCoach from '@/components/CodigoDeCoach';
import BotonEntendido from '@/components/BotonEntendido';
import { useMoverPlan, ReglasDelPlan, ControlesDelPlan, MoverAquiBoton, EditarEsteDiaBoton } from '@/features/admin/MoverElPlan';
import { useAvisosVistos } from '@/lib/useAvisosVistos';
import { esArranque, guardaLugar, leeLugar } from '@/lib/lugar';
import { useLugar, useScrollLugar } from '@/lib/useLugar';

function useIsNarrow(breakpoint = 880) {
  const [narrow, setNarrow] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < breakpoint,
  );
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const handler = (e) => setNarrow(e.matches);
    setNarrow(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [breakpoint]);
  return narrow;
}

function timeAgo(iso) {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86400000);
  if (d > 0) return `hace ${d} día${d > 1 ? 's' : ''}`;
  const h = Math.floor(diff / 3600000);
  if (h > 0) return `hace ${h} h`;
  const m = Math.floor(diff / 60000);
  if (m > 0) return `hace ${m} min`;
  return 'recién';
}

/** «Hoy», «2 h», «Ayer», «4 días»: cuándo entró, en corto (la tarjeta del teléfono). */
function haceCorto(iso, ahora) {
  if (!iso) return null;
  const diff = ahora - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return 'Hoy';
  if (h < 24) return `${h} h`;
  const d = Math.floor(diff / 86400000);
  return d <= 1 ? 'Ayer' : `${d} días`;
}

/** Una cifra de arriba de la lista del teléfono («5 Activos»); en rosa si es algo por atender («1 Sin plan»). */
function CifraDeLista({ valor, texto, alerta = false, grande = false, pausa = false }) {
  return (
    <div style={{ background: alerta ? KP.dangerSoft : pausa ? KP.amberSoft : UI.tarjeta, borderRadius: grande ? UI.rTarjeta : 18, padding: grande ? '18px 20px' : '12px 14px', boxShadow: alerta || pausa ? 'none' : UI.sombraGrupo, minWidth: 0, fontFamily: FONT }}>
      <div style={{ fontSize: grande ? 32 : 26, fontWeight: 800, color: KP.ink, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>{valor}</div>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: alerta ? KP.danger : pausa ? KP.amber : KP.ink2, marginTop: 2, lineHeight: 1.25, overflowWrap: 'break-word' }}>{texto}</div>
    </div>
  );
}

function Avatar({ name, size = 40, url }) {
  const initial = (name?.[0] || 'U').toUpperCase();
  return (
    <div
      style={{
        width: size, height: size, borderRadius: size * 0.3, flexShrink: 0, overflow: 'hidden',
        background: T.accentBg, color: T.accent, display: 'grid', placeItems: 'center',
        fontWeight: 800, fontSize: size * 0.38,
      }}
    >
      {url ? <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initial}
    </div>
  );
}

/* ------------------------- Vista de tabla (solo compu) -------------------------
 * En el telefono cada atleta es una tarjeta: cabe uno a la vez y se toca con el
 * dedo. En la compu hay ancho de sobra, y lo que un coach necesita ahi es
 * COMPARAR: quien no tiene plan, quien lleva semanas sin entrar. Eso es una
 * tabla, no una lista de tarjetas. Misma informacion, distinta forma de leerla.
 * ---------------------------------------------------------------------------- */

// Cuantos atletas por pagina en la tabla. 15 llena una pantalla de laptop
// sin obligar a desplazarse para llegar a los controles de abajo.
const POR_PAGINA = 15;

// Reestructura visual (15 oct 2026): encabezados en letra normal gris (no mayúsculas) y líneas finas, como la tabla de las capturas.
const TH = {
  textAlign: 'left', padding: '14px 16px', fontSize: 13, fontWeight: 600,
  color: T.text2, borderBottom: '1px solid #ECEEF2', whiteSpace: 'nowrap',
};
const TD = {
  padding: '13px 16px', borderBottom: '1px solid #ECEEF2',
  fontSize: 14, color: T.text, verticalAlign: 'middle',
};

/** Celda del plan: titulo + de que tipo es + cuanto mide. */
function PlanCell({ plan }) {
  const { t } = usePalabras();
  if (!plan) return <span style={{ fontSize: 13.5, color: T.text3, fontWeight: 600 }}>{t('Sin plan')}</span>;
  const etiqueta = plan.kind === 'weekly' ? 'Semanal' : 'Por fases';
  const detalle = plan.kind === 'weekly'
    ? `${plan.weeks} semana${plan.weeks === 1 ? '' : 's'}`
    : `${plan.phases} fase${plan.phases === 1 ? '' : 's'} · ${plan.weeks} sem`;
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontWeight: 700, fontSize: 13.5, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {plan.title || t('Plan sin título')}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: T.accent, background: T.accentBg, borderRadius: 6, padding: '2px 6px' }}>{etiqueta}</span>
        <span style={{ fontSize: 12, color: T.text2, fontWeight: 500 }}>{detalle}</span>
      </div>
    </div>
  );
}

function BotonPagina({ icon: Icon, etiqueta, onClick, disabled, derecha }) {
  return (
    <button
      type="button" onClick={onClick} disabled={disabled}
      className={disabled ? undefined : 'kp-pag'}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5, padding: '8px 14px', borderRadius: 999,
        border: 'none', background: 'transparent', color: T.text2, cursor: disabled ? 'default' : 'pointer',
        fontFamily: FONT, fontSize: 13, fontWeight: 700, opacity: disabled ? 0.35 : 1,
      }}
    >
      {!derecha && <Icon size={15} />}{etiqueta}{derecha && <Icon size={15} />}
    </button>
  );
}

/** Marca visible de cuenta pausada. Va donde se lee el nombre, no escondida
 *  en la ficha: si no se ve en la lista, el master no sabe a quien reactivar. */
function Pausada() {
  return (
    <span style={{
      flexShrink: 0, fontSize: 12, fontWeight: 700,
      color: T.warning, background: 'rgba(224,123,0,0.12)',
      borderRadius: 6, padding: '2px 6px',
    }}>
      Pausada
    </span>
  );
}

/**
 * El usuario que NADIE eligió.
 *
 * Quien entra con Google llega sin nombre de usuario: Google solo da correo y
 * nombre. Para que la cuenta exista, la base le arma uno con la parte del
 * correo antes de la arroba, limpia — de `ad.tr1213@gmail.com` sale
 * `ad_tr1213`. Es provisional: la pantalla de bienvenida le pide el suyo.
 *
 * El problema que vio Andrés (18 sep 2026): mientras tanto, la lista lo
 * enseñaba como "@ad_tr1213" igual que a cualquiera. "Se parece al correo pero
 * no es, y el atleta no lo eligió". Así que no se enseña: se dice lo que pasa.
 */
function SinTerminar() {
  return (
    <span style={{
      flexShrink: 0, fontSize: 12, fontWeight: 700,
      color: T.text2, background: T.bg3,
      borderRadius: 6, padding: '2px 6px',
    }}>
      Sin terminar
    </span>
  );
}

/** Lo que va bajo el nombre: su usuario, o el aviso de que aún no eligió uno. */
function Arroba({ fila }) {
  if (fila?.perfil_completo === false) {
    return (
      <span style={{ fontSize: 12.5, color: T.text3, fontWeight: 600, fontStyle: 'italic' }}>
        Todavía no elige usuario
      </span>
    );
  }
  return <span style={{ fontSize: 12.5, color: T.text2, fontWeight: 500 }}>@{fila?.username}</span>;
}

/**
 * El link de quien todavía no ha entrado, para volver a mandárselo.
 *
 * Sin esto, un coach que pierde el mensaje de WhatsApp se queda sin forma de
 * recuperarlo, y generar otro dejaría al atleta duplicado. El link es siempre
 * el mismo mientras no se use.
 */
function LinkPendiente({ token }) {
  const { t } = usePalabras();
  const [copiado, setCopiado] = useState(false);
  const liga = ligaDeInvitacion(token);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(liga);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Safari niega el portapapeles fuera de un toque directo. El link queda
      // a la vista y seleccionable, que es la salida.
      setCopiado(false);
    }
  };

  const compartir = async () => {
    try {
      await navigator.share({ title: 'Tu invitación a Training Lab', url: liga });
    } catch { /* cancelar la hoja de compartir llega como error */ }
  };

  return (
    <div style={{
      background: UI.tarjeta, boxShadow: '0 1px 2px rgba(17,19,24,0.04)', borderRadius: UI.rGrupo,
      padding: '14px 15px', marginBottom: 14,
    }}>
      <div style={{ fontSize: 13.5, fontWeight: 700, color: T.text, marginBottom: 4 }}>
        Todavía no ha entrado
      </div>
      <p style={{ fontSize: 12.5, color: T.text2, lineHeight: 1.5, margin: '0 0 10px', fontWeight: 500 }}>
        {t('Ya puedes armarle su plan. Cuando abra este link, elige su usuario y su contraseña.')}
      </p>
      <div style={{
        background: T.bg3, borderRadius: 9, padding: '8px 10px', marginBottom: 9,
        fontSize: 11.5, fontWeight: 600, color: T.text2, wordBreak: 'break-all',
        lineHeight: 1.45, userSelect: 'all',
      }}>
        {liga}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          onClick={copiar}
          style={{
            flex: 1, minHeight: 38, borderRadius: 9, cursor: 'pointer',
            border: 'none',
            background: copiado ? T.accentBg : UI.relleno, color: copiado ? T.accent : T.text,
            fontFamily: FONT, fontSize: 13, fontWeight: 700, touchAction: 'manipulation',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
          }}
        >
          {copiado ? <Check size={15} /> : <Copy size={14} />}
          {copiado ? 'Copiado' : 'Copiar link'}
        </button>
        {typeof navigator !== 'undefined' && navigator.share && (
          <button
            type="button"
            onClick={compartir}
            style={{
              flex: 1, minHeight: 42, borderRadius: 12, cursor: 'pointer',
              border: 'none', background: UI.relleno, color: T.text,
              fontFamily: FONT, fontSize: 13, fontWeight: 700, touchAction: 'manipulation',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            }}
          >
            <Share2 size={14} /> Compartir
          </button>
        )}
      </div>
    </div>
  );
}

function AthletesTable({ rows, coaches, isMaster, selectedId, onPick, ahora, etiquetas, equipoMaster }) {
  const { t, salud } = usePalabras();
  const nombreCoach = (id) => {
    if (!id) return null;
    const c = coaches.find((x) => x.id === id);
    return c ? (c.full_name || c.username) : null;
  };
  // La columna "Coach" solo tiene sentido en la cuenta master: un coach viendo
  // a sus propios atletas leeria su nombre repetido en cada fila.
  const cols = 5 + (isMaster ? 1 : 0) + (salud ? 1 : 0);

  return (
    <div style={{ background: UI.tarjeta, borderRadius: UI.rTarjeta, boxShadow: UI.sombraGrupo, overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: FONT }}>
          <thead>
            <tr>
              <th style={TH}>{t('Atleta')}</th>
              <th style={TH}>{t('Plan')}</th>
              <th style={TH}>Va en</th>
              {salud && <th style={TH}>Cómo va</th>}
              <th style={TH}>Última actividad</th>
              {isMaster && <th style={TH}>Coach</th>}
              <th style={{ ...TH, width: 44 }} aria-label="Abrir" />
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => {
              const activo = selectedId === a.id;
              const visto = timeAgo(a.lastSeen);
              const coach = nombreCoach(a.coach_id);
              return (
                <tr
                  key={a.id}
                  className="fila-atleta"
                  onClick={() => onPick(a)}
                  style={{
                    cursor: 'pointer', background: activo ? T.accentBg : 'transparent',
                    opacity: a.is_active === false ? 0.55 : 1,
                  }}
                >
                  <td style={TD}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
                      <Iniciales nombre={a.full_name || a.username} foto={a.avatar_url} tamano={40} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                          <span style={{ fontWeight: 700, fontSize: 14, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {a.full_name || a.username}
                          </span>
                          {!a.plan && a.role !== 'admin' && <Pastilla tono="malo">{t('Sin plan')}</Pastilla>}
                          {a.is_active === false && <Pausada />}
                          {a.perfil_completo === false && <SinTerminar />}
                        </div>
                        <div><Arroba fila={a} /></div>
                        {etiquetas?.get(a.id) && (
                          <div style={{ fontSize: 12, fontWeight: 700, color: T.accent, marginTop: 2 }}>{etiquetas.get(a.id).join(' · ')}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td style={TD}><PlanCell plan={a.plan} /></td>
                  <td style={{ ...TD, fontSize: 13.5, fontWeight: 600, color: a.vaEn ? T.text : T.text3, whiteSpace: 'nowrap' }}>
                    {a.vaEn ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                        {a.vaEn}{a.enPausa && <Pastilla tono="aviso">En pausa</Pastilla>}
                      </span>
                    ) : '—'}
                  </td>
                  {salud && (
                    <td style={{ ...TD, fontSize: 13.5, fontWeight: 600, color: T.text2 }}>
                      {a.resumen ? lineaDeLista(a.resumen, new Date(ahora)) : '—'}
                    </td>
                  )}
                  <td style={{ ...TD, fontSize: 13.5, color: visto ? T.text2 : T.text3, fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {visto || 'Nunca ha entrado'}
                  </td>
                  {isMaster && (
                    <td style={{ ...TD, fontSize: 13.5, fontWeight: 600, color: coach ? T.text2 : T.text3, whiteSpace: 'nowrap' }}>
                      {coach ? [coach, ...(equipoMaster?.get(a.id) ?? [])].join(' + ') : 'Sin asignar'}
                    </td>
                  )}
                  <td style={{ ...TD, textAlign: 'right' }}><ChevronRight size={17} color={T.text3} /></td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={cols} style={{ ...TD, borderBottom: 'none', textAlign: 'center', padding: '44px 16px', color: T.text3 }}>
                  <UserIcon size={32} style={{ opacity: 0.4 }} />
                  <div style={{ marginTop: 10, fontWeight: 600, color: T.text2 }}>{t('Sin atletas.')}</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ----------------------------- Detalle de atleta ----------------------------- */
/* ---------------------- Quitar / desactivar / eliminar ------------------ *
 * Tres acciones, no una. De menor a mayor daño:
 *
 *   Quitar de mi lista  (coach)  → solo rompe la relación. Nada se pierde.
 *   Desactivar          (master) → no puede entrar, conserva todo. Reversible.
 *   Eliminar definitivo (master) → se va todo. Sin vuelta.
 *
 * Por qué "desactivar" es el botón normal y no "borrar": los admins se
 * equivocan de clic, la gente regresa, y el historial es en parte del atleta.
 * Por qué el coach no puede borrar cuentas: ese atleta puede ser también del
 * master, y un clic suyo destruiría trabajo ajeno.
 * ----------------------------------------------------------------------- */

/** Pide confirmar el borrado enseñando lo que se va a destruir, con números. */
function ConfirmarBorrado({ athlete, onCancelar, onConfirmado }) {
  const nombre = athlete.full_name || athlete.username;
  const [resumen, setResumen] = useState(null);
  const [escrito, setEscrito] = useState('');
  const [borrando, setBorrando] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    let vivo = true;
    resumenDatosAtleta(athlete.id)
      .then((r) => { if (vivo) setResumen(r); })
      .catch(() => { if (vivo) setResumen({}); });
    return () => { vivo = false; };
  }, [athlete.id]);

  // La fricción: hay que escribir el usuario. Un "¿seguro?" se contesta que sí
  // sin leerlo; esto obliga a mirar a quién estás borrando.
  const puede = escrito.trim().toLowerCase() === (athlete.username || '').toLowerCase();

  async function borrar() {
    setBorrando(true); setErr('');
    try {
      await eliminarAtletaDefinitivo(athlete.id);
      onConfirmado();
    } catch (e) {
      setErr(e.message || 'No se pudo eliminar.');
      setBorrando(false);
    }
  }

  const lineas = resumen ? [
    [resumen.planes, 'plan', 'planes'],
    [resumen.sesiones_completadas, 'sesión completada', 'sesiones completadas'],
    [resumen.pesos_registrados, 'peso registrado', 'pesos registrados'],
    [resumen.dias_bienestar, 'chequeo de salud', 'chequeos de salud'],
  ].filter(([n]) => n > 0) : [];

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 5000, background: 'rgba(9,11,16,.55)',
        display: 'grid', placeItems: 'center', padding: 18, fontFamily: FONT,
      }}
      onClick={(e) => { if (e.target === e.currentTarget && !borrando) onCancelar(); }}
    >
      <div
        className="animate-fade-in"
        style={{
          width: '100%', maxWidth: 420, background: UI.fondo, borderRadius: 24,
          padding: 22, boxShadow: KP.shPop,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 14 }}>
          <span style={{ width: 40, height: 40, borderRadius: 13, flexShrink: 0, background: KP.dangerSoft, color: T.danger, display: 'grid', placeItems: 'center' }}>
            <AlertTriangle size={20} />
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 16.5, fontWeight: 800, color: T.text, lineHeight: 1.2 }}>
              Eliminar a {nombre}
            </div>
            <div style={{ fontSize: 12.5, color: T.text3, fontWeight: 600 }}>Esto no se puede deshacer</div>
          </div>
        </div>

        {resumen === null ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.text2, fontSize: 13.5, fontWeight: 600, padding: '8px 0 14px' }}>
            <Loader2 size={15} className="spin" /> Revisando qué se perdería…
          </div>
        ) : (
          <div style={{ background: T.bg, borderRadius: 13, padding: '13px 15px', marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.text2, marginBottom: 8 }}>
              Se borra para siempre
            </div>
            {lineas.length === 0 ? (
              <div style={{ fontSize: 13.5, color: T.text2, fontWeight: 600 }}>
                Su cuenta. No tiene plan ni registros guardados.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <div style={{ fontSize: 13.5, color: T.text, fontWeight: 700 }}>Su cuenta y su acceso</div>
                {lineas.map(([n, uno, varios]) => (
                  <div key={varios} style={{ fontSize: 13.5, color: T.text, fontWeight: 700 }}>
                    {n} {n === 1 ? uno : varios}
                  </div>
                ))}
              </div>
            )}
            <div style={{ fontSize: 12, color: T.text3, marginTop: 9, fontWeight: 600, lineHeight: 1.45 }}>
              Los ejercicios que haya creado se quedan.
            </div>
          </div>
        )}

        <label style={{ display: 'block', fontSize: 13, color: T.text2, fontWeight: 600, marginBottom: 7, lineHeight: 1.45 }}>
          Para confirmar, escribe <b style={{ color: T.text }}>{athlete.username}</b>
        </label>
        <input
          value={escrito}
          onChange={(e) => setEscrito(e.target.value)}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          placeholder={athlete.username}
          style={{
            width: '100%', boxSizing: 'border-box', border: 'none',
            borderRadius: UI.rCampo, padding: '14px 14px', fontFamily: FONT, fontSize: 16,
            fontWeight: 600, color: T.text, background: UI.relleno, outline: 'none',
          }}
        />

        {err && (
          <div style={{ marginTop: 11, background: KP.dangerSoft, color: T.danger, borderRadius: 11, padding: '10px 12px', fontSize: 13, fontWeight: 700, lineHeight: 1.4 }}>
            {err}
          </div>
        )}

        <div style={{ display: 'flex', gap: 9, marginTop: 16 }}>
          <button
            type="button"
            onClick={onCancelar}
            disabled={borrando}
            style={{
              flex: 1, minHeight: 50, padding: '0 16px', borderRadius: UI.rBoton, border: 'none',
              background: UI.relleno, color: T.text, cursor: borrando ? 'default' : 'pointer',
              fontFamily: FONT, fontSize: 14.5, fontWeight: 700,
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={borrar}
            disabled={!puede || borrando}
            style={{
              flex: 1, padding: '13px 16px', borderRadius: 12, border: 'none',
              background: puede && !borrando ? T.danger : T.bg3,
              color: puede && !borrando ? '#fff' : T.text3,
              cursor: puede && !borrando ? 'pointer' : 'default',
              fontFamily: FONT, fontSize: 14.5, fontWeight: 800,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            }}
          >
            {borrando ? <><Loader2 size={15} className="spin" /> Eliminando…</> : 'Eliminar'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ZonaAdministracion({ athlete, isMaster, soyElCoach, onCambiado, onEliminado }) {
  const { t } = usePalabras();
  const activo = athlete.is_active !== false;
  const [ocupado, setOcupado] = useState('');
  const [err, setErr] = useState('');
  const [confirmando, setConfirmando] = useState(false);

  async function correr(clave, fn) {
    setOcupado(clave); setErr('');
    try {
      const row = await fn();
      onCambiado?.(row);
    } catch (e) {
      setErr(e.message || 'No se pudo completar la acción.');
    } finally {
      setOcupado('');
    }
  }

  if (!isMaster && !soyElCoach) return null;

  const btn = (extra = {}) => ({
    display: 'inline-flex', alignItems: 'center', gap: 7, padding: '11px 15px',
    borderRadius: 12, border: 'none', background: UI.relleno,
    color: T.text, cursor: 'pointer', fontFamily: FONT, fontSize: 13.5, fontWeight: 700,
    ...extra,
  });

  // Sin título propio: esto vive DENTRO de la sección "Administrar cuenta" de
  // la ficha, y el título salía dos veces seguidas.
  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {soyElCoach && !isMaster && (
          <button
            type="button"
            disabled={!!ocupado}
            onClick={() => correr('quitar', () => quitarAtletaDeMiLista(athlete.id))}
            style={btn()}
          >
            {ocupado === 'quitar' ? <Loader2 size={14} className="spin" /> : <UserMinus size={14} />}
            Quitar de mi lista
          </button>
        )}

        {isMaster && (
          <button
            type="button"
            disabled={!!ocupado}
            onClick={() => correr('activo', () => setAtletaActivo(athlete.id, !activo))}
            style={btn(activo ? {} : { background: T.accentBg, color: T.accent, border: 'none' })}
          >
            {ocupado === 'activo' ? <Loader2 size={14} className="spin" /> : <Power size={14} />}
            {activo ? 'Desactivar' : 'Reactivar'}
          </button>
        )}

        {isMaster && (
          <button
            type="button"
            disabled={!!ocupado}
            onClick={() => setConfirmando(true)}
            style={btn({ color: T.danger })}
          >
            <Trash2 size={14} /> Eliminar definitivamente
          </button>
        )}
      </div>

      <div style={{ fontSize: 12, color: T.text3, marginTop: 10, fontWeight: 600, lineHeight: 1.5 }}>
        {soyElCoach && !isMaster
          ? t('Quitarla de tu lista no borra nada: su plan y su historial siguen guardados.')
          : activo
            ? t('Desactivar no borra nada: deja de entrar, pero conserva su plan y su historial.')
            : 'Esta cuenta está desactivada. No puede entrar a la app.'}
      </div>

      {err && (
        <div style={{ marginTop: 10, background: KP.dangerSoft, color: T.danger, borderRadius: 11, padding: '10px 12px', fontSize: 13, fontWeight: 700 }}>
          {err}
        </div>
      )}

      {confirmando && (
        <ConfirmarBorrado
          athlete={athlete}
          onCancelar={() => setConfirmando(false)}
          onConfirmado={() => { setConfirmando(false); onEliminado?.(athlete.id); }}
        />
      )}
    </div>
  );
}

/** Una de las acciones grandes de la ficha del atleta. */
function AccionFicha({ icon: Icon, titulo, detalle, onClick, primaria, abierto }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
        padding: '14px 15px', borderRadius: 14, cursor: 'pointer', fontFamily: FONT,
        border: 'none',
        background: primaria ? KP.blue : UI.tarjeta,
        boxShadow: primaria ? '0 8px 20px rgba(30,64,224,0.22)' : '0 1px 2px rgba(17,19,24,0.04)',
      }}
    >
      <span style={{
        width: 36, height: 36, borderRadius: 11, flexShrink: 0, display: 'grid', placeItems: 'center',
        background: primaria ? 'rgba(255,255,255,0.18)' : T.accentBg,
        color: primaria ? '#fff' : T.accent,
      }}>
        <Icon size={18} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 15, fontWeight: 800, color: primaria ? '#fff' : T.text }}>
          {titulo}
        </span>
        {detalle && (
          <span style={{
            display: 'block', fontSize: 12.5, fontWeight: 600, marginTop: 2,
            color: primaria ? 'rgba(255,255,255,0.86)' : T.text2,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {detalle}
          </span>
        )}
      </span>
      {abierto === undefined
        ? <ChevronRight size={18} color={primaria ? 'rgba(255,255,255,0.8)' : T.text3} style={{ flexShrink: 0 }} />
        : (abierto
          ? <ChevronUp size={18} color={T.text3} style={{ flexShrink: 0 }} />
          : <ChevronDown size={18} color={T.text3} style={{ flexShrink: 0 }} />)}
    </button>
  );
}

/** Lo que NO es una acción: se pliega para que no estorbe. */
function SeccionFicha({ titulo, abierta, onToggle, children }) {
  return (
    <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 4 }}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '12px 2px',
          border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: FONT,
          fontSize: 13.5, fontWeight: 800, color: T.text2, textAlign: 'left',
        }}
      >
        <span style={{ flex: 1 }}>{titulo}</span>
        {abierta ? <ChevronUp size={16} color={T.text3} /> : <ChevronDown size={16} color={T.text3} />}
      </button>
      {abierta && <div style={{ paddingBottom: 14 }}>{children}</div>}
    </div>
  );
}

/** «Beto · coach» / «Juan · fisio»: de quién es un programa, según el equipo del atleta. */
function etiquetaDelPrograma(programa, equipoDe, athlete) {
  const principalId = equipoDe.find((m) => m.es_principal)?.profesional_id ?? athlete.coach_id ?? null;
  const miembro = equipoDe.find((m) => m.profesional_id === (programa.profesional_id ?? principalId));
  const nombre = nombreCorto(miembro?.full_name);
  if (nombre) return `${nombre} · ${rolDeProfesion(miembro?.profesion)}`;
  return programa.profesional_id ? 'Equipo' : 'Coach';
}

/**
 * «Ver el plan» de un atleta: la misma hoja que ve él. Si tiene equipo, pastillas para
 * mirar el programa de cada profesional (lo ajeno es solo para leer).
 *
 * Dos diferencias con la del atleta, las dos a propósito: dice "AQUÍ VA" en vez de
 * "AQUÍ VAS", porque quien mira es su profesional; y tocar un día lo abre en el sitio
 * para ver sus ejercicios, porque no lo va a entrenar.
 */
function HojaDelPlanDeAtleta({ athlete, programas, equipoDe, state, inicialId, onCerrar, pegadas = [], mover = null, planMovibleId = null, onEditarDia = null }) {
  const { t } = usePalabras();
  const [verId, setVerId] = useState(inicialId ?? programas[0]?.id);
  const visto = programas.find((p) => p.id === verId) ?? programas[0];
  /* Lo que otros profesionales le pegaron al programa del coach, repartido en sus
     días (ver `lib/pegadas.js`). Sale dentro de cada día, con la etiqueta de quien
     lo puso, y solo se lee: lo mueve únicamente su autor. */
  const delCoach = programas.find((p) => !p.profesional_id) ?? null;
  const pegadasPorAutor = useMemo(() => (delCoach ? pegadas.map((fila, i) => {
    const m = equipoDe.find((x) => x.profesional_id === fila.profesional_id);
    return {
      fila,
      etiqueta: m ? `${nombreCorto(m.full_name) || m.username} · ${rolDeProfesion(m.profesion)}` : 'Equipo',
      color: colorDePrograma(1 + i),
      fases: fasesConPegadas(reglasDe(fila), delCoach.data?.phases ?? [], {
        autorId: fila.profesional_id, semanal: delCoach.data?.kind === 'weekly',
      }),
    };
  }) : []), [pegadas, delCoach, equipoDe]);
  if (!visto) return null;
  const esDelCoach = !visto.profesional_id;
  const pegadasDe = esDelCoach && pegadasPorAutor.length ? (f, semana) => {
    const fi = (visto.data?.phases ?? []).findIndex((x) => x.id === f.id);
    const wi = (f.weekData ?? []).findIndex((w) => w.num === semana.num);
    return pegadasPorAutor.flatMap((o) => (o.fases[fi]?.weekData?.[wi]?.days ?? []).map((day) => ({
      dia: day.day,
      day,
      etiqueta: o.etiqueta,
      color: o.color,
      hecha: !!state?.data?.[`wr:sessions@${o.fila.profesional_id}:sobre`]?.[`${f.id}-w${semana.num}-${day.sid}`]?.completed,
    })));
  } : undefined;
  const etiquetaDe = (p) => etiquetaDelPrograma(p, equipoDe, athlete);
  // Mover, pausar y editar un día solo valen en el programa que este profesional escribe (los demás, solo para leer).
  const mp = mover && visto.id === planMovibleId ? mover : null;
  const fases = visto.data?.phases ?? [];
  const sufijo = visto.profesional_id ? `@${visto.profesional_id}` : '';
  const estructura = estructuraDelPlan(visto.data);
  const semanas = fases.reduce((n, p) => n + (p.weekData?.length || 0), 0);
  const tamano = estructura === 'rutina' ? 'Se repite cada semana'
    : estructura === 'semanas' ? pluralS(semanas, 'semana')
      : `${pluralS(fases.length, 'fase')} · ${pluralS(semanas, 'semana')}`;
  return (
    <HojaFlotante
      titulo={visto.title || t('Plan')}
      subtitulo={`${athlete.full_name || athlete.username} · ${tamano}`}
      onCerrar={onCerrar}
    >
      {programas.length > 1 && (
        <div role="tablist" aria-label="Programa" style={{ display: 'flex', gap: 8, marginBottom: 12, overflowX: 'auto' }}>
          {programas.map((p) => {
            const activa = p.id === visto.id;
            return (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={activa}
                onClick={() => setVerId(p.id)}
                style={{
                  padding: '8px 14px', borderRadius: 999, cursor: 'pointer', fontFamily: FONT, fontSize: 13.5, fontWeight: 800,
                  border: 'none', background: activa ? T.accent : UI.relleno,
                  color: activa ? '#fff' : T.text, whiteSpace: 'nowrap',
                }}
              >
                {etiquetaDe(p)}
              </button>
            );
          })}
        </div>
      )}
      {mp && <ReglasDelPlan nombre={mp.nombre} />}
      <ControlesDelPlan mp={mp} />
      <NavegadorDelPlan
        key={visto.id}
        fases={fases}
        kind={visto.data?.kind}
        estructura={estructura}
        quien="atleta"
        aqui={dondeVa(fases, visto.data?.kind, state?.data?.[`wr:cursor${sufijo}`])}
        pieDeSemana={mp ? (f, semana) => <MoverAquiBoton mp={mp} faseId={f.id} semana={semana.num} /> : undefined}
        hecha={(faseId, semana, dia) => !!state?.data?.[`wr:sessions${sufijo}`]?.[
          sessionIdFor(visto.data?.kind, faseId, semana, dia)]?.completed}
        detalleDia={(f, semana, idx) => {
          const d = semana.days[idx];
          const n = (d.exercises || []).filter((e) => !e.isNote).length;
          return n ? (
            <span style={{ fontSize: 11.5, fontWeight: 700, color: T.text3, flexShrink: 0 }}>{n}</span>
          ) : null;
        }}
        contenidoDia={(f, semana, idx) => (
          <>
            <DentroDelDia day={semana.days[idx]} />
            {mp && onEditarDia && <div style={{ marginTop: 8 }}><EditarEsteDiaBoton onClick={() => onEditarDia(f.id, semana.num, semana.days[idx].day)} /></div>}
          </>
        )}
        pegadasDe={pegadasDe}
      />
    </HojaFlotante>
  );
}

function AthleteDetail({ athlete, onClose, isMaster, coaches = [], masterProfile, onReassigned, onAltaCambiada, onEliminado, onVerComoAtleta, tokenInvitacion, onEquipoCambiado, onIrA }) {
  const esCompu = useIsDesktop();
  const pregunta = useConfirmacion();
  const { t, salud } = usePalabras();
  const { profile } = useAuth();
  const [programas, setProgramas] = useState([]); // planes activos: el del coach principal y los del equipo
  const [filasPegadas, setFilasPegadas] = useState([]); // sesiones pegadas al programa del coach: una fila por autor
  const [pegando, setPegando] = useState(false);
  const [equipoDe, setEquipoDe] = useState([]);     // quién más atiende a esta persona
  const [programaElegido, setProgramaElegido] = useState(null); // master: de quién es el que edita (null = el principal)
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(!athlete.soloNotas);
  /* Si el editor del plan estaba abierto, se vuelve a abrir al refrescar (ver
     `lugar.js`). Ojo: NO se monta mientras `loading`. Sin el plan cargado, el
     editor creería que el plan no existe, y guardar crearía uno nuevo. */
  const [building, setBuilding] = useLugar(`editor.${athlete.id}`, false, (v) => v === true);
  const [savingCoach, setSavingCoach] = useState(false);
  const [verPlan, setVerPlan] = useState(false);
  // «Asignar de Mis planes»: darle a este atleta algo que se guardó (programa, rutina o workout).
  const [asignando, setAsignando] = useState(false);
  const [seccion, setSeccion] = useState(null); // null | 'como-va' | 'cambios' | 'notas' | 'equipo' | 'cuenta'
  // Las métricas del reloj (pulso, ritmo, carga, recuperación): una hoja aparte, se baja al abrirla.
  const [verMetricas, setVerMetricas] = useState(false);
  /* Las notas de consulta (y dar de alta) son de fisios y solo de quien atiende
     a esta persona: ni el master ni otro profesional las ven, aunque la lista
     les enseñe al paciente. La base lo impone; esto solo evita ofrecer un botón
     que no va a funcionar. */
  /* EQUIPO. Un profesional puede atender a alguien sin ser su coach principal
     (`athlete.deEquipo`): edita SU programa, ve el del coach solo para leer, y
     no administra la cuenta. `athlete.soloNotas`: ya no lo atiende (el atleta lo
     quitó); solo conserva su nombre y sus notas. El master elige de quién es el
     programa que edita. */
  const deEquipo = !!athlete.deEquipo;
  const soloNotas = !!athlete.soloNotas;
  const atiendoYoAEstePaciente = salud && (athlete.coach_id === profile?.id || deEquipo);
  /* UN FISIO NO EDITA EL PROGRAMA QUE HIZO OTRO. Andrés, 1 oct 2026: con «Andres_prueba» el fisio
     veía «Editar el programa» y podía cambiar el que él había asignado desde su cuenta de
     administrador; con su cuenta real solo veía «Ver el programa» y «Crear mi programa». Pasaba
     porque ese atleta tenía al fisio como principal, y el principal escribe el programa de «el
     coach». Ahora, si ese programa lo hizo otra persona, el fisio lo ve solo para leer y trabaja
     en el SUYO (igual que un fisio del equipo). La base lo impone (`plans_escribir`). A los
     coaches no les cambia nada. */
  const planDelCoach = programas.find((p) => (p.profesional_id ?? null) === null) ?? null;
  const planAjeno = salud && !isMaster && !deEquipo && !!planDelCoach?.created_by && planDelCoach.created_by !== profile?.id;
  const propio = deEquipo || planAjeno;
  /* PEGAR UNA SESIÓN AL PROGRAMA DEL COACH. Quien trabaja en su propio programa
     (un fisio, un profesional del equipo) puede además agregar sesiones al del
     coach, sin tocarlo: quedan pegadas a un día y salen con su nombre (ver
     `lib/pegadas.js`). Hace falta que ese programa exista. */
  const puedePegar = propio && !soloNotas && (planDelCoach?.data?.phases?.length ?? 0) > 0;
  const miFilaPegadas = filasPegadas.find((f) => f.profesional_id === profile?.id) ?? null;
  const miClave = propio ? (profile?.id ?? null) : (isMaster ? programaElegido : null);
  const plan = programas.find((p) => (p.profesional_id ?? null) === miClave) ?? null;
  /* UN PROGRAMA SIN NINGUNA SESIÓN NO CUENTA (Andrés, 1 oct 2026, el fisio): borró la única sesión
     de su rutina y «Editar mi programa» y «Ver el programa» seguían ahí, en blanco. Una rutina
     semanal sin sesiones se trata como si no hubiera programa: «Crear mi programa», y no sale
     al mirar los programas. La fila sigue en la base hasta que se escriba otra cosa encima o se
     elimine desde los tres puntos del editor. */
  const planReal = plan && !esProgramaFantasma(plan.data) ? plan : null;
  const programasVisibles = programas.filter((p) => !esProgramaFantasma(p.data));
  const setPlan = (fila) => setProgramas((prev) => (fila
    ? [...prev.filter((p) => p.id !== fila.id), fila]
    : prev.filter((p) => (p.profesional_id ?? null) !== miClave)));
  // Sus registros de ESTE programa: `wr:sessions@<profesional>` si no es el del coach principal.
  const sufijo = miClave ? `@${miClave}` : '';
  const [cambiandoAlta, setCambiandoAlta] = useState(false);

  // Dar de alta no borra nada: el programa y el historial se quedan y se puede
  // reabrir. Por eso reabrir no pregunta y dar de alta sí (por si fue un toque
  // sin querer).
  async function onCambiarAlta() {
    if (cambiandoAlta) return;
    const darDeAlta = !athlete.alta_en;
    if (darDeAlta) {
      const va = await pregunta({
        titulo: `¿Dar de alta a ${athlete.full_name || athlete.username}?`,
        detalle: 'No se borra nada. Podrás reabrirlo.',
        confirmar: 'Sí, dar de alta',
      });
      if (!va) return;
    }
    setCambiandoAlta(true);
    try {
      onAltaCambiada?.(deEquipo
        ? { id: athlete.id, alta_en: await cambiarAltaDeEquipo(athlete.id, darDeAlta) }
        : await cambiarAlta(athlete.id, darDeAlta));
    } catch { /* noop: si falla, el botón sigue como estaba */ }
    finally { setCambiandoAlta(false); }
  }

  async function onChangeCoach(coachId) {
    setSavingCoach(true);
    try {
      const row = await setAthleteCoach(athlete.id, coachId || null);
      onReassigned?.(row);
    } catch { /* noop */ }
    finally { setSavingCoach(false); }
  }

  useEffect(() => {
    let cancelled = false;
    // Sin nada que cargar (ya no lo atiende): `loading` ya nació en falso.
    if (soloNotas) return undefined;
    setLoading(true);
    (async () => {
      try {
        const [ps, s, eq, pg] = await Promise.all([
          getProgramas(athlete.id), getAthleteState(athlete.id), nombresDelEquipo(athlete.id).catch(() => []),
          getSesionesPegadas(athlete.id).catch(() => []),
        ]);
        if (cancelled) return;
        setProgramas(ps);
        setFilasPegadas(pg);
        setState(s);
        setEquipoDe(eq);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [athlete.id, soloNotas]);

  async function onDeletePlan() {
    if (!plan) return;
    const va = await pregunta({
      // Solo se traduce lo fijo: el título del plan y el nombre son de personas.
      titulo: `${t('¿Eliminar el plan')} "${plan.title}"?`,
      // Ya se puede deshacer: la base guarda la versión (ver CambiosDelPlan).
      detalle: `${t('Es el plan de')} ${athlete.full_name || athlete.username}. ${t('Si te equivocas, lo recuperas en "Cambios del plan".')}`,
      confirmar: 'Sí, eliminarlo',
      peligro: true,
    });
    if (!va) return;
    await deletePlan(plan.id);
    setPlan(null);
  }

  const last = timeAgo(state?.updated_at);
  const phases = plan?.data?.phases ?? [];
  const totalWeeks = phases.reduce((s, p) => s + (p.weekData?.length || 0), 0);
  // Cómo se describe el plan según su forma: una rutina no tiene "1 fase · 1
  // semana", y "varias semanas" no enseña fases.
  const estructura = estructuraDelPlan(plan?.data);
  const tamano = estructura === 'rutina' ? 'Se repite cada semana'
    : estructura === 'semanas' ? pluralS(totalWeeks, 'semana')
      : `${pluralS(phases.length, 'fase')} · ${pluralS(totalWeeks, 'semana')}`;
  // Los días OFF no son sesiones: la app del atleta tampoco los cuenta, y si
  // aquí sí, el coach ve "7 sesiones" donde su atleta ve "6 días".
  const totalSessions = phases.reduce(
    (s, p) => s + (p.weekData?.reduce((x, w) => x + (w.days || []).filter((d) => !esDescanso(d)).length, 0) || 0), 0,
  );
  // Sesiones completadas según el estado de la app del atleta
  const completed = useMemo(() => {
    const sessions = state?.data?.[`wr:sessions${sufijo}`];
    if (!sessions) return null;
    return Object.values(sessions).filter((s) => s?.completed).length;
  }, [state, sufijo]);

  // Su semana, día por día, para la página de la ficha en la compu.
  const semana = useMemo(
    () => semanaDelAtleta(plan?.data?.phases ?? [], plan?.data?.kind === 'weekly' ? 'weekly' : 'periodized', state?.data?.[`wr:cursor${sufijo}`], state?.data?.[`wr:sessions${sufijo}`] ?? {}),
    [plan, state, sufijo],
  );

  /* Mover, pausar y «una semana atrás» (ver `MoverElPlan.jsx`). `null` en una rutina que se repite o sin programa. Tras escribir, la ficha se
     pone al día sola: el puntero nuevo entra al estado que ya tiene cargado. */
  const mover = useMoverPlan({
    athlete, plan: planReal, clave: `wr:cursor${sufijo}`, state,
    alCambiar: (clave, c) => setState((s) => ({ ...(s ?? {}), data: { ...(s?.data ?? {}), [clave]: c } })),
  });
  // «Editar este día»: el editor se abre justo en esa semana y ese día.
  const [editarEn, setEditarEn] = useState(null);
  const editarDia = (faseId, semanaNum, dia) => { setEditarEn({ faseId, semana: semanaNum, dia }); setVerPlan(false); setBuilding(true); };

  // El dolor que anota en «Bienestar» y cuántas sesiones lleva esta semana.
  const dolor = resumenDeDolor(state?.data?.['wr:wellness']);
  const estaSemana = hechasEstaSemana(
    Object.values(state?.data?.[`wr:sessions${sufijo}`] ?? {}).filter((s) => s?.completed && s.completedAt).map((s) => s.completedAt),
  );
  const sesionesDeLaSemana = esperadasEstaSemana(
    phases, plan?.data?.kind === 'weekly' ? 'weekly' : 'periodized', state?.data?.[`wr:cursor${sufijo}`],
  );

  /* ORDEN DE LA FICHA. Andrés, 17 sep 2026: "hay mucha información saturada;
     la prioridad sería primero saber si el coach quiere 1- editar el plan,
     2- solo ver el plan, 3- meterse a verlo como si fuera el atleta, 4- ver el
     resto de la info, como sesiones completadas".

     Así queda: las tres acciones arriba, grandes y sin adornos, y lo demás
     plegado. "Aunque sume clics lo hace más eficiente y más intuitivo" —él. */
  // El master elige de quién es el programa que edita (solo si hay más de uno).
  const pestanasDePrograma = isMaster && programas.length > 1 ? (
        <div role="tablist" aria-label="Programa que editas" style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
          {programas.map((p) => {
            const activa = (p.profesional_id ?? null) === (programaElegido ?? null);
            return (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={activa}
                onClick={() => setProgramaElegido(p.profesional_id ?? null)}
                style={{
                  padding: '8px 14px', borderRadius: 999, cursor: 'pointer', fontFamily: FONT, fontSize: 13.5, fontWeight: 800,
                  border: 'none', background: activa ? T.accent : UI.relleno,
                  color: activa ? '#fff' : T.text, whiteSpace: 'nowrap',
                }}
              >
                {etiquetaDelPrograma(p, equipoDe, athlete)}
              </button>
            );
          })}
        </div>
  ) : null;

  const acciones = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
      {pestanasDePrograma}
      {puedePegar && (
        <AccionFicha
          icon={CalendarPlus}
          titulo="Agregar sesión al programa del coach"
          detalle={reglasDe(miFilaPegadas).length
            ? `Tienes ${plural(reglasDe(miFilaPegadas).length, 'sesión pegada', 'sesiones pegadas')}`
            : 'Queda pegada a un día de su programa'}
          primaria
          onClick={() => setPegando(true)}
        />
      )}
      <AccionFicha
        icon={planReal ? Pencil : Plus}
        titulo={propio ? (planReal ? 'Editar mi programa' : 'Crear mi programa') : t(planReal ? 'Editar el plan' : 'Crear el plan')}
        detalle={planReal ? planReal.title : 'Todavía no tiene ninguno'}
        primaria={!puedePegar}
        onClick={() => setBuilding(true)}
      />
      {!soloNotas && (
        <AccionFicha
          icon={FolderOpen}
          titulo="Asignar de Mis planes"
          detalle="Un programa, una rutina o un workout que ya guardaste"
          onClick={() => setAsignando(true)}
        />
      )}
      {programasVisibles.length > 0 && (
        <AccionFicha
          icon={ClipboardList}
          titulo={t('Ver el plan')}
          detalle={planReal
            ? (mover ? `Va en ${mover.textoActual}${mover.enPausa ? ' · En pausa' : ''}` : `${tamano} · ${plural(totalSessions, 'sesión', 'sesiones')}`)
            : (programasVisibles.length > 1 ? 'Los programas de su equipo, solo para leer' : 'Solo para leer')}
          onClick={() => setVerPlan(true)}
        />
      )}
      {!soloNotas && (
        <AccionFicha
          icon={HeartPulse}
          titulo="Métricas del reloj"
          detalle="Pulso, ritmo, carga y recuperación"
          onClick={() => setVerMetricas(true)}
        />
      )}
      {onVerComoAtleta && (
        <AccionFicha
          icon={Eye}
          titulo={t('Entrar como el atleta')}
          detalle="Su app tal cual la ve él. Nada se guarda."
          onClick={() => onVerComoAtleta(athlete)}
        />
      )}
      {atiendoYoAEstePaciente && (
        <AccionFicha
          icon={athlete.alta_en ? RotateCcw : CircleCheck}
          titulo={athlete.alta_en ? 'Reabrir' : 'Dar de alta'}
          detalle={athlete.alta_en
            ? `Dado de alta el ${new Date(athlete.alta_en).toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })}`
            : 'Su programa y su historial se quedan'}
          onClick={onCambiarAlta}
        />
      )}
    </div>
  );

  // Lo que se abre desde las acciones (igual en el teléfono que en la compu).
  const ventanas = (
    <>
      {asignando && !loading && (
        <AsignarAlAtleta
          atleta={athlete}
          clave={miClave}
          onAsignado={(fila) => { if (fila) setPlan(fila); }}
          onCerrar={() => setAsignando(false)}
        />
      )}
      {verPlan && programasVisibles.length > 0 && (
        <HojaDelPlanDeAtleta
          athlete={athlete}
          programas={programasVisibles}
          equipoDe={equipoDe}
          state={state}
          inicialId={planReal?.id}
          pegadas={filasPegadas}
          mover={mover}
          planMovibleId={planReal?.id}
          onEditarDia={editarDia}
          onCerrar={() => setVerPlan(false)}
        />
      )}
      {pegando && puedePegar && !loading && (
        <SesionesSobreElPrograma
          athlete={athlete}
          planDelCoach={planDelCoach}
          filas={filasPegadas}
          miFila={miFilaPegadas}
          equipoDe={equipoDe}
          aqui={dondeVa(planDelCoach.data.phases, planDelCoach.data.kind, state?.data?.['wr:cursor'])}
          onGuardado={(row) => setFilasPegadas((prev) => {
            const sin = prev.filter((f) => f.profesional_id !== profile?.id);
            return row ? [...sin, row] : sin;
          })}
          onClose={() => setPegando(false)}
        />
      )}
      {verMetricas && <AbreMetricas atleta={athlete} onCerrar={() => setVerMetricas(false)} />}
    </>
  );

  const cuentaYZona = (
      <SeccionFicha titulo="Administrar cuenta" abierta={seccion === 'cuenta'} onToggle={() => setSeccion((s) => (s === 'cuenta' ? null : 'cuenta'))}>
        {isMaster && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, background: T.bg, borderRadius: 12, padding: '11px 14px', flexWrap: 'wrap' }}>
            <Shield size={16} color={T.accent} />
            <span style={{ fontSize: 13, fontWeight: 700, color: T.text2 }}>Coach:</span>
            <div style={{ flex: 1, minWidth: 140 }}>
              <ListaDesplegable
                etiqueta="Coach del atleta"
                valor={athlete.coach_id || ''}
                onCambio={onChangeCoach}
                deshabilitado={savingCoach}
                estilo={{ borderRadius: 10, padding: '8px 10px', fontSize: 13.5 }}
                opciones={[
                  { valor: '', etiqueta: 'Sin coach (libre)' },
                  ...(masterProfile ? [{
                    valor: masterProfile.id,
                    etiqueta: `Yo — ${masterProfile.full_name || masterProfile.username}`,
                    nota: 'master',
                  }] : []),
                  ...coaches.map((c) => ({
                    valor: c.id, etiqueta: c.full_name || c.username, nota: `@${c.username}`,
                  })),
                ]}
              />
            </div>
            {savingCoach && <Loader2 size={15} className="spin" color={T.text3} />}
          </div>
        )}

        {plan && (
          <button
            type="button"
            onClick={onDeletePlan}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, padding: '0 16px', minHeight: 44, borderRadius: 12,
              border: 'none', cursor: 'pointer', background: KP.dangerSoft, color: T.danger,
              fontFamily: FONT, fontSize: 13.5, fontWeight: 700, marginBottom: 12,
            }}
          >
            <Trash2 size={15} /> {t('Eliminar el plan')}
          </button>
        )}

        <ZonaAdministracion
          athlete={athlete}
          isMaster={isMaster}
          soyElCoach={!!masterProfile?.id && athlete.coach_id === masterProfile.id}
          onCambiado={(row) => onReassigned?.(row)}
          onEliminado={onEliminado}
        />
      </SeccionFicha>
  );

  const encabezado = (
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
        <Avatar name={athlete.full_name || athlete.username} url={athlete.avatar_url} size={52} />
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Los tres cortes son necesarios: un correo como
              "juanescutia@traininglab.app" es una sola palabra sin espacios,
              asi que no puede partirse en dos renglones. Sin cortarlo empuja
              la pagina a lo ancho, y el telefono encoge TODO para que quepa
              — que es lo que se siente como "la app abre con zoom". */}
          <div style={{
            fontSize: 18, fontWeight: 800, color: T.text,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {athlete.full_name || athlete.username}
          </div>
          {/* Sin usuario a la vista (ya no lo atiendes) no se dibuja un «@» solo. */}
          {(athlete.perfil_completo === false || athlete.username) && (
            <div
              title={`@${athlete.username}`}
              style={{
                fontSize: 13.5, color: T.text2, fontWeight: 500,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}
            >
              {athlete.perfil_completo === false ? 'Todavía no elige usuario' : `@${athlete.username}`}
            </div>
          )}
        </div>
        <button type="button" onClick={onClose} aria-label="Cerrar" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: T.text2, padding: 4 }}>
          <X size={20} />
        </button>
      </div>
  );

  // Ya no lo atiende: solo el nombre y SUS notas (la base se las conserva).
  const cuerpoSoloNotas = (
    <>
      {encabezado}
      <p style={{ fontSize: 13, color: T.text2, lineHeight: 1.5, margin: '0 0 12px', fontWeight: 500 }}>
        Ya no atiendes a esta persona: quitó a quien la atendía de su equipo. Conservas tus notas de consulta.
        Si te vuelve a agregar, todo regresa.
      </p>
      <NotasDeConsulta atleta={athlete} Seccion={SeccionFicha} abierta onToggle={() => {}} puedeCrear={false} />
    </>
  );

  const cuerpo = (
    <>
      {encabezado}

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.text2, padding: '12px 0', fontWeight: 600 }}>
          <Loader2 size={16} className="spin" /> Cargando…
        </div>
      ) : acciones}
      {ventanas}

      {/* Arriba del todo y sin plegar: cuando un coach acaba de dar de alta a
          alguien, el link es justo lo que viene a buscar. Escondido en una
          sección que hay que abrir, no lo encuentra. */}
      {tokenInvitacion && <LinkPendiente token={tokenInvitacion} />}

      {/* Lo que cambió en el plan, y el botón de deshacer. Si lo último lo hizo
          una IA, sale un aviso a la vista (ver CambiosDelPlan). */}
      {!loading && (
        <CambiosDelPlan
          atleta={athlete}
          plan={plan}
          onCambio={setPlan}
          profesionalId={miClave}
          Seccion={SeccionFicha}
          abierta={seccion === 'cambios'}
          onToggle={() => setSeccion((x) => (x === 'cambios' ? null : 'cambios'))}
        />
      )}

      <SeccionFicha titulo="Cómo va" abierta={seccion === 'como-va'} onToggle={() => setSeccion((s) => (s === 'como-va' ? null : 'como-va'))}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
          <div style={{ flex: '1 1 140px', background: T.bg, borderRadius: 12, padding: '12px 14px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.text2 }}>Última actividad</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5, fontWeight: 700, color: T.text, fontSize: 14 }}>
              <CalendarClock size={15} color={T.text2} /> {last || 'Sin registros'}
            </div>
          </div>
          <div style={{ flex: '1 1 140px', background: T.bg, borderRadius: 12, padding: '12px 14px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.text2 }}>Sesiones completadas</div>
            <div style={{ marginTop: 5, fontWeight: 800, color: T.accent, fontSize: 18 }}>
              {completed ?? '—'}{completed != null && totalSessions ? ` / ${totalSessions}` : ''}
            </div>
          </div>
          {/* El dolor es de fisios (Andrés, 7 oct 2026: «no me parece muy necesario para los coaches, para los fisios sí»). */}
          {salud && (
            <div style={{ flex: '1 1 140px', background: T.bg, borderRadius: 12, padding: '12px 14px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.text2 }}>Dolor</div>
              <div style={{ marginTop: 5, fontWeight: 700, color: T.text, fontSize: 14, lineHeight: 1.3 }}>
                {textoDeDolor(dolor)}
              </div>
              {dolor && (
                <div style={{ marginTop: 2, fontSize: 12, fontWeight: 600, color: T.text3 }}>
                  {new Date(`${dolor.ultimo.fecha}T12:00:00`).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
                </div>
              )}
            </div>
          )}
          {/* Sin la casilla de Dolor quedan tres: la última ocupa todo el ancho en vez de quedarse a media fila. */}
          <div style={{ flex: '1 1 140px', background: T.bg, borderRadius: 12, padding: '12px 14px', ...(salud ? null : { gridColumn: '1 / -1' }) }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.text2 }}>Esta semana</div>
            <div style={{ marginTop: 5, fontWeight: 800, color: T.accent, fontSize: 18 }}>
              {estaSemana}{sesionesDeLaSemana > 0 ? ` / ${sesionesDeLaSemana}` : ''}
            </div>
          </div>
        </div>
        {plan && (
          <div style={{ fontSize: 12, color: T.text3, marginTop: 10, fontWeight: 600 }}>
            {t('Plan actualizado')} {timeAgo(plan.updated_at) || '—'}
          </div>
        )}
      </SeccionFicha>

      {atiendoYoAEstePaciente && (
        <NotasDeConsulta
          atleta={athlete}
          Seccion={SeccionFicha}
          abierta={seccion === 'notas'}
          onToggle={() => setSeccion((s) => (s === 'notas' ? null : 'notas'))}
        />
      )}

      {/* Sumar a alguien al equipo del atleta: lo hace su coach principal (y el master). */}
      {!deEquipo && (athlete.coach_id === profile?.id || isMaster) && (
        <AgregarAlEquipo
          atleta={athlete}
          Seccion={SeccionFicha}
          abierta={seccion === 'equipo'}
          onToggle={() => setSeccion((x) => (x === 'equipo' ? null : 'equipo'))}
          onInvitado={onEquipoCambiado}
        />
      )}

      {!deEquipo && cuentaYZona}
    </>
  );

  /* EN LA COMPU, UNA PÁGINA (reestructura visual, 16 oct 2026, como «Coach · Computadora · Atleta» de las capturas de Andrés): arriba
     «‹ Mis atletas», «Mensaje» y «Editar el plan»; a la izquierda quién es, su plan con la barra de avance, tres cifras de la semana y
     «Esta semana» día por día; a la derecha las Acciones y, debajo, lo que antes iba plegado (cambios, notas, equipo, cuenta). Antes era
     una tarjeta flotante encima de la lista. */
  const semanaGlobal = semana ? phases.slice(0, semana.faseIdx).reduce((n, f) => n + (f.weekData?.length || 0), 0) + semana.semanaIdx + 1 : 0;
  const tipoDePlan = estructura === 'rutina' ? 'Rutina semanal' : estructura === 'semanas' ? pluralS(totalWeeks, 'semana') : `Por fases · ${pluralS(phases.length, 'fase')}`;
  const ESTADO_DEL_DIA = {
    hecha: ['Hecha', KP.mint], saltada: ['Saltada', KP.danger], hoy: ['Hoy', KP.blue], viene: ['', KP.ink3], descanso: ['', KP.ink3], nada: ['', KP.ink3],
  };
  const cifra = (valor, texto, color) => (
    <div style={{ background: UI.tarjeta, borderRadius: UI.rGrupo, boxShadow: UI.sombraGrupo, padding: '14px 16px', minWidth: 0 }}>
      <div style={{ fontSize: 26, fontWeight: 800, color, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{valor}</div>
      <div style={{ fontSize: 13.5, fontWeight: 500, color: KP.ink2, marginTop: 3 }}>{texto}</div>
    </div>
  );
  const botonArriba = (primario) => ({
    display: 'inline-flex', alignItems: 'center', gap: 7, minHeight: 46, padding: '0 18px', borderRadius: UI.rBoton, border: 'none', cursor: 'pointer',
    fontFamily: FONT, fontSize: 15, fontWeight: 700, background: primario ? KP.blue : UI.relleno, color: primario ? '#fff' : KP.ink,
    boxShadow: primario ? '0 8px 18px rgba(30,64,224,0.22)' : 'none',
  });
  const mandarMensaje = onIrA && !soloNotas ? () => onIrA('messages', { atletaId: athlete.id }) : null;
  const paginaCompu = soloNotas ? (
    <div style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <button type="button" onClick={onClose} style={{ ...botonArriba(false), alignSelf: 'flex-start' }}><ChevronLeft size={17} /> {t('Mis atletas')}</button>
      <div style={{ background: UI.tarjeta, borderRadius: 24, padding: 22, boxShadow: UI.sombraGrupo }}>{cuerpoSoloNotas}</div>
    </div>
  ) : (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, fontFamily: FONT }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button type="button" onClick={onClose} style={botonArriba(false)}><ChevronLeft size={17} /> {t('Mis atletas')}</button>
        <span style={{ flex: 1 }} />
        {mandarMensaje && <button type="button" onClick={mandarMensaje} style={botonArriba(false)}>Mensaje</button>}
        <button type="button" onClick={() => setBuilding(true)} style={botonArriba(true)}>
          {propio ? (planReal ? 'Editar mi programa' : 'Crear mi programa') : t(planReal ? 'Editar el plan' : 'Crear el plan')}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(300px, 1fr)', gap: 22, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Iniciales nombre={athlete.full_name || athlete.username} foto={athlete.avatar_url} tamano={68} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: -0.5, color: KP.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{athlete.full_name || athlete.username}</div>
              <div style={{ fontSize: 14.5, fontWeight: 500, color: KP.ink2 }}>
                {[athlete.perfil_completo === false ? 'Todavía no elige usuario' : athlete.username ? `@${athlete.username}` : null, last].filter(Boolean).join(' · ')}
              </div>
            </div>
          </div>

          {tokenInvitacion && <LinkPendiente token={tokenInvitacion} />}

          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: KP.ink2, padding: '12px 0', fontWeight: 600 }}><Loader2 size={16} className="spin" /> Cargando…</div>
          ) : planReal ? (
            <button
              type="button" onClick={() => setVerPlan(true)}
              style={{ textAlign: 'left', border: 'none', cursor: 'pointer', fontFamily: FONT, color: '#fff', background: UI.azul, borderRadius: 24, padding: '18px 20px', boxShadow: UI.azulSombra, display: 'flex', flexDirection: 'column', gap: 12 }}
            >
              <span>
                <span style={{ display: 'block', fontSize: 13.5, fontWeight: 500, opacity: 0.82 }}>{tipoDePlan}{mover?.enPausa ? ' · En pausa' : ''}</span>
                <span style={{ display: 'block', fontSize: 24, fontWeight: 800, letterSpacing: -0.3, marginTop: 2 }}>{planReal.title || t('Plan')}</span>
              </span>
              {estructura !== 'rutina' && totalWeeks > 0 && (
                <span style={{ display: 'block', height: 7, borderRadius: 4, background: 'rgba(255,255,255,0.25)', overflow: 'hidden' }}>
                  <span style={{ display: 'block', height: '100%', width: `${Math.min(100, Math.round((semanaGlobal / totalWeeks) * 100))}%`, background: '#fff', borderRadius: 4 }} />
                </span>
              )}
              <span style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13.5, fontWeight: 500, opacity: 0.86 }}>
                <span>{semana && estructura !== 'rutina' ? `${estructura === 'fases' ? `Fase ${semana.faseIdx + 1} · ` : ''}sem ${semana.semanaIdx + 1}/${semana.semanasDeLaFase}` : 'Se repite cada semana'}</span>
                <span>{semana ? `${plural(semana.tocan, 'sesión', 'sesiones')} esta semana` : ''}</span>
              </span>
            </button>
          ) : (
            <div style={{ background: UI.tarjeta, borderRadius: 24, padding: '22px 20px', boxShadow: UI.sombraGrupo, display: 'flex', alignItems: 'center', gap: 14 }}>
              <span style={{ flex: 1, fontSize: 17, fontWeight: 700, color: KP.ink }}>{t('Todavía no tiene plan')}</span>
              <button type="button" onClick={() => setBuilding(true)} style={botonArriba(true)}>{t('Crear el plan')}</button>
            </div>
          )}

          {semana && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
              {cifra(`${semana.hechas}/${semana.tocan}`, 'Semana', KP.blue)}
              {cifra(semana.saltadas, semana.saltadas === 1 ? 'Saltada' : 'Saltadas', semana.saltadas > 0 ? KP.danger : KP.ink)}
              {salud
                ? cifra(dolor ? dolor.ultimo.valor : '—', 'Dolor', dolor && dolor.ultimo.valor >= 5 ? KP.danger : KP.mint)
                : cifra(last || '—', 'Última vez', KP.ink)}
            </div>
          )}

          {semana && (
            <>
              <div style={{ fontSize: 17, fontWeight: 800, color: KP.ink, margin: '6px 2px -2px' }}>Esta semana</div>
              <Grupo>
                {semana.dias.map((d) => {
                  const [texto, color] = ESTADO_DEL_DIA[d.estado];
                  return (
                    <div key={d.clave} className="ui-fila" style={{ display: 'flex', alignItems: 'center', gap: 14, minHeight: 54, padding: '8px 16px' }}>
                      <span style={{ width: 34, fontSize: 13.5, fontWeight: 600, color: d.esHoy ? KP.blue : KP.ink3, flexShrink: 0 }}>{d.clave}</span>
                      <span style={{ flex: 1, minWidth: 0, fontSize: 15.5, fontWeight: 500, color: d.nombre ? KP.ink : KP.ink3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {d.nombre || (d.estado === 'descanso' ? 'Descanso' : 'Sin sesión')}
                      </span>
                      {texto && d.estado !== 'descanso' && <span style={{ fontSize: 13.5, fontWeight: 700, color, flexShrink: 0 }}>{texto}</span>}
                    </div>
                  );
                })}
              </Grupo>
            </>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: KP.ink, margin: '4px 2px -2px' }}>Acciones</div>
          {pestanasDePrograma}
          <Grupo>
            {puedePegar && (
              <Fila izquierda={<IconoDeFila><CalendarPlus size={18} /></IconoDeFila>} texto="Agregar sesión al programa del coach"
                detalle={reglasDe(miFilaPegadas).length ? `Tienes ${plural(reglasDe(miFilaPegadas).length, 'sesión pegada', 'sesiones pegadas')}` : 'Queda pegada a un día de su programa'}
                onClick={() => setPegando(true)} />
            )}
            <Fila izquierda={<IconoDeFila><FolderOpen size={18} /></IconoDeFila>} texto="Asignar de Mis planes" detalle="Un programa, una rutina o un workout que ya guardaste" onClick={() => setAsignando(true)} />
            {programasVisibles.length > 0 && (
              <Fila izquierda={<IconoDeFila><ClipboardList size={18} /></IconoDeFila>} texto={t('Ver el plan')}
                detalle={planReal ? (mover ? `Va en ${mover.textoActual}${mover.enPausa ? ' · En pausa' : ''} · mover o pausar` : `${tamano} · ${plural(totalSessions, 'sesión', 'sesiones')}`) : 'Solo para leer'} onClick={() => setVerPlan(true)} />
            )}
            <Fila izquierda={<IconoDeFila><HeartPulse size={18} /></IconoDeFila>} texto="Métricas del reloj" detalle="Pulso, ritmo, carga y recuperación" onClick={() => setVerMetricas(true)} />
            {onVerComoAtleta && (
              <Fila izquierda={<IconoDeFila><Eye size={18} /></IconoDeFila>} texto={t('Entrar como el atleta')} detalle="Su app tal cual la ve. Nada se guarda." onClick={() => onVerComoAtleta(athlete)} />
            )}
            {mandarMensaje && (
              <Fila izquierda={<IconoDeFila><MessageCircle size={18} /></IconoDeFila>} texto="Mensaje" detalle="Abre su conversación" onClick={mandarMensaje} />
            )}
            {atiendoYoAEstePaciente && (
              <Fila izquierda={<IconoDeFila>{athlete.alta_en ? <RotateCcw size={18} /> : <CircleCheck size={18} />}</IconoDeFila>}
                texto={athlete.alta_en ? 'Reabrir' : 'Dar de alta'}
                detalle={athlete.alta_en ? `Dado de alta el ${new Date(athlete.alta_en).toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })}` : 'Su programa y su historial se quedan'}
                onClick={onCambiarAlta} />
            )}
          </Grupo>
          {/* Lo que antes iba plegado en la ficha: aquí abajo, igual de plegado. */}
          {!loading && (
            <CambiosDelPlan
              atleta={athlete} plan={plan} onCambio={setPlan} profesionalId={miClave} Seccion={SeccionFicha}
              abierta={seccion === 'cambios'} onToggle={() => setSeccion((x) => (x === 'cambios' ? null : 'cambios'))}
            />
          )}
          {atiendoYoAEstePaciente && (
            <NotasDeConsulta atleta={athlete} Seccion={SeccionFicha} abierta={seccion === 'notas'} onToggle={() => setSeccion((x) => (x === 'notas' ? null : 'notas'))} />
          )}
          {!deEquipo && (athlete.coach_id === profile?.id || isMaster) && (
            <AgregarAlEquipo atleta={athlete} Seccion={SeccionFicha} abierta={seccion === 'equipo'} onToggle={() => setSeccion((x) => (x === 'equipo' ? null : 'equipo'))} onInvitado={onEquipoCambiado} />
          )}
          {!deEquipo && cuentaYZona}
        </div>
      </div>
      {ventanas}
    </div>
  );

  return esCompu ? (
    <div style={{ gridColumn: '1 / -1' }}>
      {paginaCompu}
      {building && !loading && (
        <PlanBuilder
          athlete={athlete}
          planRow={plan}
          profesionalId={miClave}
          abrirEn={editarEn}
          onClose={() => { setBuilding(false); setEditarEn(null); }}
          // Guardar NO cierra el editor (Andrés, 27 sep 2026: "prefiero que me
          // deje ahí para ver cómo quedó"); solo se refresca la ficha de atrás.
          onSaved={(row) => setPlan(row)}
          // Eliminar el programa desde el editor: la ficha de atrás lo deja de tener.
          onDeleted={() => { setPlan(null); setBuilding(false); }}
        />
      )}
    </div>
  ) : (
    <div style={{ background: UI.fondo, borderRadius: 24, padding: 22, boxShadow: KP.shCard }}>
      {soloNotas ? cuerpoSoloNotas : cuerpo}

      {building && !loading && (
        <PlanBuilder
          athlete={athlete}
          planRow={plan}
          profesionalId={miClave}
          abrirEn={editarEn}
          onClose={() => { setBuilding(false); setEditarEn(null); }}
          // Guardar NO cierra el editor (Andrés, 27 sep 2026: "prefiero que me
          // deje ahí para ver cómo quedó"); solo se refresca la ficha de atrás.
          onSaved={(row) => setPlan(row)}
          onDeleted={() => { setPlan(null); setBuilding(false); }}
        />
      )}
    </div>
  );
}

/* ------------------------------ Panel raíz ------------------------------ */
/* «Primeros pasos»: lo que recibe al coach nuevo en su lista vacía (maqueta del inicio, 8 oct 2026). Cuatro cosas; cada
   una se palomea sola cuando ya la hizo (`primeros_pasos()` en la base) y cada renglón lleva a hacerla. Se quita con
   «Entendido» y no vuelve, y desaparece sola cuando las cuatro están hechas. `clave` cambia cuando la lista se recarga,
   para volver a preguntar qué ya está hecho. */
function PrimerosPasos({ clave, onAgregar, onIrA, onAbrirPerfil, compu }) {
  const { t } = usePalabras();
  const { listo, visto, marcar } = useAvisosVistos();
  const [hecho, setHecho] = useState(null);

  useEffect(() => {
    let vivo = true;
    primerosPasos().then((h) => { if (vivo) setHecho(h || {}); }).catch(() => { if (vivo) setHecho({}); });
    return () => { vivo = false; };
  }, [clave]);

  if (!listo || visto('primeros-pasos') || !hecho) return null;
  const pasos = [
    { id: 'atletas', texto: t('Agrega a tu primer atleta'), accion: onAgregar },
    { id: 'planes', texto: 'Arma tu primer plan', accion: () => onIrA?.('misplanes') },
    { id: 'ejercicios', texto: 'Graba o sube un video de ejercicio', accion: () => onIrA?.('exercises') },
    // En la compu «Conectar con IA» es una pestaña; en el teléfono vive en Mi perfil.
    { id: 'ia', texto: 'Conecta tu IA (ChatGPT o Claude)', accion: () => (compu ? onIrA?.('ia') : onAbrirPerfil?.('ia')) },
  ];
  const hechos = pasos.filter((p) => hecho[p.id]).length;
  if (hechos === pasos.length) return null;

  return (
    <section
      aria-label="Primeros pasos"
      style={{ background: UI.tarjeta, borderRadius: UI.rTarjeta, padding: '14px 14px 6px', marginBottom: 16, boxShadow: UI.sombraGrupo }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <span style={{ width: 34, height: 34, borderRadius: 10, display: 'grid', placeItems: 'center', background: KP.blueSoft, color: KP.blue, flexShrink: 0 }}>
          <ListChecks size={18} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15.5, fontWeight: 800, color: T.text }}>Primeros pasos</div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: T.text2 }}>{hechos} de {pasos.length}</div>
        </div>
        <BotonEntendido color={KP.blue} onClick={() => marcar('primeros-pasos')} />
      </div>
      {pasos.map((p) => {
        const ok = !!hecho[p.id];
        return (
          <button
            key={p.id}
            type="button"
            onClick={p.accion}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 12, minHeight: 50, padding: '0 4px',
              border: 'none', borderTop: `1px solid ${T.border}`, background: 'transparent', cursor: 'pointer',
              fontFamily: FONT, textAlign: 'left', touchAction: 'manipulation',
            }}
          >
            <span style={{
              width: 24, height: 24, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center', color: '#fff',
              border: `2px solid ${ok ? KP.mint : KP.lineHi}`, /* estilo-ok: casilla de paso hecho */ background: ok ? KP.mint : 'transparent',
            }}>
              {ok && <Check size={14} strokeWidth={3} />}
            </span>
            <span style={{ flex: 1, fontSize: 14.5, fontWeight: 700, color: ok ? T.text3 : T.text, textDecoration: ok ? 'line-through' : 'none' }}>
              {p.texto}
            </span>
            {!ok && <ChevronRight size={17} color={T.text3} />}
          </button>
        );
      })}
    </section>
  );
}

export default function AthletesPanel({ viendoComo, onVerComoAtleta, onIrA, onAbrirPerfil }) {
  const { profile, user } = useAuth();
  const { t, salud } = usePalabras();
  const isMaster = !!profile?.is_owner;
  const narrow = useIsNarrow(880);
  const isDesktop = useIsDesktop();
  const [athletes, setAthletes] = useState([]);
  const [coaches, setCoaches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [search, setSearch] = useState('');
  const [pagina, setPagina] = useState(1);
  const [selected, setSelected] = useState(null);
  const [verAltas, setVerAltas] = useState(false);
  // EQUIPO: mis filas de `equipo` (a quién atiendo desde el equipo, invitaciones, quitados…) y, de
  // cada atleta, quién más lo atiende.
  const [equipoFilas, setEquipoFilas] = useState([]);
  const [otrosDelEquipo, setOtrosDelEquipo] = useState([]);
  // Momento en que llegaron los datos. Sirve de "ahora" para las metricas:
  // leer el reloj dentro del useMemo lo dejaria congelado en la primera vuelta.
  const [cargadoEn, setCargadoEn] = useState(0);

  // Alta de atletas por el coach: el diálogo, y los que aún no han activado.
  const [agregando, setAgregando] = useState(false);
  const [sinLugaresAbierto, setSinLugaresAbierto] = useState(false);
  const [sinActivar, setSinActivar] = useState({}); // id de atleta -> token
  // Sube de uno en uno para volver a leer la lista cuando algo la cambia.
  const [recarga, setRecarga] = useState(0);
  // Cuántos atletas a mano puede agregar todavía (`null` = aún no se sabe: el servidor decide al agregar).
  const lugares = useLugares(recarga);
  const abrirAgregar = () => (sinLugares(lugares) ? setSinLugaresAbierto(true) : setAgregando(true));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const yo = profile?.id;
        const [crudos, filasEquipo, otros] = await Promise.all([
          listAthletesOverview({ conEstado: salud, yo, esMaster: isMaster }),
          listEquipo().catch(() => []),
          equiposDeMisAtletas().catch(() => []),
        ]);
        // A quien atiendo desde el EQUIPO (no soy su coach principal) lo marco `deEquipo`, y su
        // alta es la de MI fila del equipo (la del coach principal es otra).
        const miFilaDe = new Map(filasEquipo
          .filter((fila) => fila.profesional_id === yo && fila.estado === 'activo')
          .map((fila) => [fila.atleta_id, fila]));
        const a = crudos.map((x) => {
          const fila = !isMaster && x.coach_id !== yo ? miFilaDe.get(x.id) : null;
          return fila ? { ...x, deEquipo: true, alta_en: fila.alta_en ?? null } : x;
        });
        if (!cancelled) {
          setAthletes(a);
          setEquipoFilas(filasEquipo);
          setOtrosDelEquipo(otros);
          setCargadoEn(Date.now());
          /* Al refrescar se vuelve a abrir la ficha que estaba abierta (ver
             `lugar.js`). Va aquí, junto a la lista y antes de `setLoading`,
             para que la primera pantalla ya la traiga y no se vea la lista un
             instante y luego la ficha. Solo vale un atleta que sigue en la
             lista y que esta vista puede ver. */
          if (esArranque()) {
            const id = leeLugar(user?.id, 'atletas.abierto');
            const fila = id && a.find((x) => x.id === id && x.role !== 'admin'
              && (!viendoComo || x.coach_id === viendoComo.id));
            if (fila) setSelected(fila);
          }
        }
        if (isMaster) {
          const c = await listCoaches();
          if (!cancelled) setCoaches(c);
        }
        /* Quién sigue sin entrar. Va aparte y sin tumbar la carga: si esta
           consulta falla, la lista de atletas se enseña igual — solo se pierde
           la etiqueta de "sin activar", que es un adorno, no el contenido. */
        const inv = await invitacionesPendientes().catch(() => ({}));
        if (!cancelled) setSinActivar(inv);
      } catch (e2) {
        if (!cancelled) setErr(e2.message || 'Error al cargar');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // `user` y `viendoComo` solo se leen para volver a abrir la ficha al
    // arrancar; cambiarlos no debe volver a pedir la lista.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMaster, recarga, salud]);

  // Se anota qué ficha está abierta. Antes de que llegue la lista NO: en ese
  // momento `selected` todavía es nulo y anotarlo borraría lo que hay que
  // restaurar.
  useEffect(() => {
    if (loading) return;
    guardaLugar(user?.id, 'atletas.abierto', selected?.id ?? null);
  }, [loading, selected?.id, user?.id]);
  // Y la altura de la lista, para volver a donde estaba.
  useScrollLugar('atletas', !loading);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    // Solo atletas (oculta cuentas de coach/master de la lista de clientes)
    // y, si el master entró a ver un coach, solo los de ese coach.
    const base = athletes.filter((a) => a.role !== 'admin'
      && (!viendoComo || a.coach_id === viendoComo.id));
    if (!q) return base;
    return base.filter(
      (a) => (a.full_name || '').toLowerCase().includes(q) || (a.username || '').toLowerCase().includes(q),
    );
  }, [athletes, search, viendoComo]);

  /* Un fisio da de alta a sus pacientes: salen de la lista de siempre y quedan
     en un grupo plegado al final («Dados de alta»). Para los demás oficios
     nadie tiene alta y todo sigue igual que antes. */
  const enCurso = useMemo(() => (salud ? filtered.filter((a) => !a.alta_en) : filtered), [salud, filtered]);
  const dadosDeAlta = useMemo(() => (salud ? filtered.filter((a) => a.alta_en) : []), [salud, filtered]);

  // Las tres preguntas que un coach se hace al abrir la lista. Quien ya recibió
  // el alta no cuenta: son los pacientes de ahora.
  const metricas = useMemo(() => {
    const base = athletes.filter((a) => a.role !== 'admin'
      && (!viendoComo || a.coach_id === viendoComo.id)
      && !(salud && a.alta_en));
    const hace7dias = cargadoEn - 7 * 86400000;
    return {
      total: base.length,
      sinPlan: base.filter((a) => !a.plan).length,
      enPausa: base.filter((a) => a.enPausa).length,
      activos: base.filter((a) => a.lastSeen && new Date(a.lastSeen).getTime() >= hace7dias).length,
    };
  }, [athletes, cargadoEn, viendoComo, salud]);

  /* EQUIPO. De cada atleta, quién más lo atiende: «con fisio · Juan» para su coach principal,
     «con coach · Beto» para quien está en su equipo, y «Beto + Juan (fisio)» en la columna
     «Coach» del master. */
  const yoId = profile?.id;
  const etiquetasDeEquipo = useMemo(() => {
    const m = new Map();
    otrosDelEquipo.filter((o) => o.estado === 'activo').forEach((o) => {
      const texto = `con ${rolDeProfesion(o.otro_oficio)} · ${nombreCorto(o.otro_nombre) || o.otro_usuario}`;
      m.set(o.atleta_id, [...(m.get(o.atleta_id) ?? []), texto]);
    });
    return m;
  }, [otrosDelEquipo]);
  const equipoParaMaster = useMemo(() => {
    const m = new Map();
    otrosDelEquipo.filter((o) => o.estado === 'activo' && !o.otro_es_principal).forEach((o) => {
      const texto = `${nombreCorto(o.otro_nombre) || o.otro_usuario} (${rolDeProfesion(o.otro_oficio)})`;
      m.set(o.atleta_id, [...(m.get(o.atleta_id) ?? []), texto]);
    });
    return m;
  }, [otrosDelEquipo]);
  // «Esperando que acepte»: invitaciones al equipo que el atleta aún no contesta.
  const esperando = useMemo(() => equipoFilas.filter((fila) => fila.estado === 'pendiente').map((fila) => {
    const atleta = athletes.find((x) => x.id === fila.atleta_id) ?? null;
    const nombre = fila.nombre_atleta || atleta?.full_name || atleta?.username || 'Atleta';
    if (fila.profesional_id === yoId) {
      return { clave: `${fila.atleta_id}-${fila.profesional_id}`, nombre, detalle: 'Te invitaron a su equipo. Espera a que acepte.', atleta: null };
    }
    const otro = otrosDelEquipo.find((o) => o.atleta_id === fila.atleta_id && o.otro_id === fila.profesional_id);
    const quien = otro ? `${nombreCorto(otro.otro_nombre) || otro.otro_usuario} (${rolDeProfesion(otro.otro_oficio)})` : 'alguien';
    return { clave: `${fila.atleta_id}-${fila.profesional_id}`, nombre, detalle: `Invitaste a ${quien}. Espera a que ${nombreCorto(nombre) || nombre} acepte.`, atleta };
  }), [equipoFilas, athletes, otrosDelEquipo, yoId]);
  // «Ya no están contigo»: el atleta los quitó de su equipo. Solo queda su nombre y tus notas.
  const yaNoEstan = useMemo(() => equipoFilas
    .filter((fila) => fila.profesional_id === yoId && fila.estado === 'quitado')
    .map((fila) => ({
      clave: `${fila.atleta_id}-${fila.profesional_id}`,
      nombre: fila.nombre_atleta || 'Atleta',
      fila,
    })), [equipoFilas, yoId]);
  // Aviso al coach principal cuando alguien se une al equipo de uno de sus atletas.
  const avisos = useMemo(() => equipoFilas
    .filter((fila) => fila.estado === 'activo' && !fila.aviso_coach_visto_en)
    .map((fila) => {
      const atleta = athletes.find((x) => x.id === fila.atleta_id);
      const otro = otrosDelEquipo.find((o) => o.atleta_id === fila.atleta_id && o.otro_id === fila.profesional_id);
      if (!atleta || atleta.coach_id !== yoId || !otro) return null;
      return {
        atletaId: fila.atleta_id,
        profesionalId: fila.profesional_id,
        atleta: atleta.full_name || atleta.username,
        profesional: otro.otro_nombre || otro.otro_usuario,
        oficio: otro.otro_oficio,
      };
    })
    .filter(Boolean), [equipoFilas, athletes, otrosDelEquipo, yoId]);

  async function avisoEntendido(aviso) {
    try { await marcarAvisoVisto(aviso.atletaId, aviso.profesionalId); } catch { /* si falla, vuelve a salir */ }
    setEquipoFilas((prev) => prev.map((fila) => (
      fila.atleta_id === aviso.atletaId && fila.profesional_id === aviso.profesionalId
        ? { ...fila, aviso_coach_visto_en: new Date().toISOString() }
        : fila)));
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: T.text2, fontWeight: 600, padding: 40 }}>
        <Loader2 size={18} className="spin" /> {t('Cargando atletas…')}
      </div>
    );
  }

  /* En la compu la ficha FLOTA encima de la lista (ver AthleteDetail), así
     que la lista no le deja hueco ni cambia de forma: sigue igual detrás.
     Andrés, 27 sep 2026: "lo que está atrás de la card flotante cambia de
     tamaño… se ve raro". Eran restos del panel lateral de antes: la lista se
     partía en dos columnas (la segunda quedaba vacía) y la tabla se volvía
     tarjetas. En tableta la ficha sí va al lado, y ahí siguen las dos
     columnas. */
  const twoCol = selected && !narrow && !isDesktop;
  // En la compu la ficha es una PÁGINA (reestructura visual, 16 oct 2026): mientras se mira, la lista se esconde; «‹ Mis atletas» regresa.
  const showList = !(selected && (narrow || isDesktop));
  // Tabla cuando hay ancho de verdad. Con la ficha al lado (tableta) la lista
  // se encoge a ~280px y ahí una tabla no se lee: van tarjetas.
  const modoTabla = isDesktop;

  // Paginado solo en la tabla. En el telefono la lista se desliza completa,
  // que es como funciona cualquier lista de contactos: ahi paginar estorba.
  // La pagina se recorta aqui en vez de con un efecto: si filtras y quedan
  // menos paginas que la que estabas viendo, se ajusta sola sin renders extra.
  const totalPaginas = Math.max(1, Math.ceil(enCurso.length / POR_PAGINA));
  const paginaActual = Math.min(pagina, totalPaginas);
  const visibles = modoTabla
    ? enCurso.slice((paginaActual - 1) * POR_PAGINA, paginaActual * POR_PAGINA)
    : enCurso;
  const desde = enCurso.length === 0 ? 0 : (paginaActual - 1) * POR_PAGINA + 1;
  const hasta = Math.min(paginaActual * POR_PAGINA, enCurso.length);

  // Una tarjeta de la lista del teléfono. Es una función y no un componente
  // porque la comparten la lista de siempre y el grupo de dados de alta.
  /* Reestructura visual (15 oct 2026), como «Mis atletas» del coach en el teléfono: tarjeta blanca sin borde, iniciales de color,
     el plan (o «Sin plan» en rosa) y, a la derecha, cuándo entró por última vez. */
  const tarjetaDe = (a) => {
    const active = selected?.id === a.id;
    const isAdmin = a.role === 'admin';
    const visto = haceCorto(a.lastSeen, cargadoEn);
    return (
      <button
        key={a.id}
        type="button"
        onClick={() => setSelected(a)}
        className="kp-press"
        style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '14px 14px', borderRadius: UI.rTarjeta, cursor: 'pointer',
          border: 'none', outline: active ? `2px solid ${KP.blue}` : 'none', /* estilo-ok: el atleta abierto, en la lista de la compu */ background: UI.tarjeta, fontFamily: FONT, textAlign: 'left',
          boxShadow: UI.sombraGrupo, opacity: a.is_active === false ? 0.6 : 1, width: '100%',
        }}
      >
        <Iniciales nombre={a.full_name || a.username} foto={a.avatar_url} tamano={48} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, color: KP.ink, fontSize: 16.5, display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {a.full_name || a.username}
            </span>
            {isAdmin && <Shield size={13} color={T.accent} style={{ flexShrink: 0 }} />}
            {!a.plan && !isAdmin && <Pastilla tono="malo">{t('Sin plan')}</Pastilla>}
            {a.is_active === false && <Pausada />}
            {a.perfil_completo === false && <SinTerminar />}
          </div>
          <div style={{ fontSize: 14, color: KP.ink2, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {a.plan?.title ? a.plan.title : <Arroba fila={a} />}
          </div>
          {a.vaEn && (
            <div style={{ fontSize: 12.5, fontWeight: 600, color: KP.ink2, marginTop: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
              Va en {a.vaEn}{a.enPausa && <Pastilla tono="aviso">En pausa</Pastilla>}
            </div>
          )}
          {etiquetasDeEquipo.get(a.id) && (
            <div style={{ fontSize: 12.5, fontWeight: 700, color: T.accent, marginTop: 2 }}>{etiquetasDeEquipo.get(a.id).join(' · ')}</div>
          )}
          {salud && a.resumen && (
            <div style={{ fontSize: 12.5, fontWeight: 600, color: T.text2, marginTop: 3 }}>
              {lineaDeLista(a.resumen, new Date(cargadoEn))}
            </div>
          )}
        </div>
        {visto && <span style={{ alignSelf: 'flex-start', flexShrink: 0, fontSize: 13, fontWeight: 600, color: KP.ink3, marginTop: 2 }}>{visto}</span>}
      </button>
    );
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: twoCol ? 'minmax(280px, 1fr) minmax(0, 1.4fr)' : 'minmax(0, 1fr)', gap: 20, alignItems: 'start' }}>
      {showList && (
      <div>
        {/* Alguien se unió al equipo de un atleta suyo: se lo dice su coach principal. */}
        <AvisosDelCoach avisos={avisos} onEntendido={avisoEntendido} />
        {!viendoComo && !isMaster && (
          <PrimerosPasos clave={recarga} onAgregar={abrirAgregar} onIrA={onIrA} onAbrirPerfil={onAbrirPerfil} compu={isDesktop} />
        )}
        {!modoTabla && !selected && (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${metricas.enPausa > 0 ? 4 : 3}, minmax(0, 1fr))`, gap: 10, marginBottom: 14 }}>
            <CifraDeLista valor={metricas.total} texto={t('Atletas')} />
            <CifraDeLista valor={metricas.activos} texto="Activos" />
            <CifraDeLista valor={metricas.sinPlan} texto={t('Sin plan')} alerta={metricas.sinPlan > 0} />
            {metricas.enPausa > 0 && <CifraDeLista valor={metricas.enPausa} texto="En pausa" pausa />}
          </div>
        )}
        {modoTabla && (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${metricas.enPausa > 0 ? 4 : 3}, minmax(0, 1fr))`, gap: 14, marginBottom: 16 }}>
            <CifraDeLista valor={metricas.total} texto={t('Atletas')} grande />
            <CifraDeLista valor={metricas.activos} texto="Activos (7 días)" grande />
            <CifraDeLista valor={metricas.sinPlan} texto={t('Sin plan')} alerta={metricas.sinPlan > 0} grande />
            {metricas.enPausa > 0 && <CifraDeLista valor={metricas.enPausa} texto="En pausa" pausa grande />}
          </div>
        )}
        {/* Dar de alta a un cliente sin esperar a que se registre. Va antes
            del buscador porque es lo primero que hace un coach con una lista
            vacía, y buscar en una lista vacía no sirve de nada.
            Viendo la cuenta de otro coach no aparece: el atleta quedaría a
            nombre de quien mira, no del coach. */}
        {!modoTabla && (
          /* En el teléfono: el buscador y, pegado, el «+» azul para agregar (como en las capturas). El contador de lugares y el código
             de coach van debajo, chicos: son el mismo momento («quiero un atleta más»). */
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <Buscador valor={search} onCambio={(v) => { setSearch(v); setPagina(1); }} marcador={t('Buscar atleta')} estilo={{ flex: 1 }} />
              {!viendoComo && (
                <button
                  type="button" onClick={abrirAgregar} className="kp-press" aria-label={t('Agregar atleta')}
                  style={{ width: 48, height: 48, borderRadius: UI.rCampo, border: 'none', background: KP.blue, color: '#fff', display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0, boxShadow: '0 8px 18px rgba(30,64,224,0.25)' }}
                >
                  <Plus size={22} strokeWidth={2.4} />
                </button>
              )}
            </div>
            {!viendoComo && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
                {etiquetaDeLugares(lugares) && (
                  <span style={{ fontSize: 13, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: sinLugares(lugares) ? T.danger : T.text2 }}>{etiquetaDeLugares(lugares)}</span>
                )}
                <CodigoDeCoach codigo={profile?.codigo_coach} nombre={profile?.full_name} />
              </div>
            )}
          </>
        )}
        {modoTabla && !viendoComo && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
          <button
            type="button"
            onClick={abrirAgregar}
            className="kp-press"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              minHeight: 48, padding: '0 20px', borderRadius: UI.rBoton, border: 'none', cursor: 'pointer',
              background: KP.blue, color: '#fff',
              fontFamily: FONT, fontSize: 15, fontWeight: 700, boxShadow: '0 8px 18px rgba(30,64,224,0.22)',
              touchAction: 'manipulation',
            }}
          >
            <UserPlus size={18} /> {t('Agregar atleta')}
          </button>
          {etiquetaDeLugares(lugares) && (
            <span
              title={t('Atletas que has agregado a mano')}
              style={{ fontSize: 13, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: sinLugares(lugares) ? T.danger : T.text2 }}
            >
              {etiquetaDeLugares(lugares)}
            </span>
          )}
          {/* La otra forma de sumar a alguien: que se registre él y pegue este
              código. Va al lado del botón porque es el mismo momento — 'quiero
              un atleta más' — solo que el trabajo lo hace la otra persona. */}
          <CodigoDeCoach codigo={profile?.codigo_coach} nombre={profile?.full_name} />
          </div>
        )}

        {modoTabla && (
          <div style={{ marginBottom: 16 }}>
            <Buscador valor={search} onCambio={(v) => { setSearch(v); setPagina(1); }} marcador={t('Buscar atleta…')} />
          </div>
        )}

        {err && (
          <div style={{ background: 'rgba(220,38,38,0.08)', color: T.danger, borderRadius: 12, padding: '12px 16px', fontWeight: 600, marginBottom: 16 }}>{err}</div>
        )}

        {modoTabla ? (
          <>
            <AthletesTable
              rows={visibles}
              coaches={coaches}
              isMaster={isMaster}
              selectedId={selected?.id}
              onPick={setSelected}
              ahora={cargadoEn}
              etiquetas={etiquetasDeEquipo}
              equipoMaster={equipoParaMaster}
            />
            {totalPaginas > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 14 }}>
                <div style={{ fontSize: 13, color: T.text2, fontWeight: 600 }}>
                  Mostrando {desde}–{hasta} de {enCurso.length}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <BotonPagina
                    icon={ChevronLeft}
                    etiqueta="Anterior"
                    disabled={paginaActual === 1}
                    onClick={() => setPagina(paginaActual - 1)}
                  />
                  <span style={{ fontSize: 13, color: T.text2, fontWeight: 700, minWidth: 72, textAlign: 'center' }}>
                    {paginaActual} de {totalPaginas}
                  </span>
                  <BotonPagina
                    icon={ChevronRight}
                    etiqueta="Siguiente"
                    derecha
                    disabled={paginaActual === totalPaginas}
                    onClick={() => setPagina(paginaActual + 1)}
                  />
                </div>
              </div>
            )}
          </>
        ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {enCurso.map(tarjetaDe)}
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 16px', color: T.text3 }}>
              <UserIcon size={34} style={{ opacity: 0.4 }} />
              <div style={{ marginTop: 10, fontWeight: 600, color: T.text2 }}>{t('Sin atletas.')}</div>
            </div>
          )}
        </div>
        )}

        {dadosDeAlta.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <button
              type="button"
              onClick={() => setVerAltas((v) => !v)}
              aria-expanded={verAltas}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 2px',
                border: 'none', background: 'transparent', cursor: 'pointer',
                fontFamily: FONT, fontSize: 13.5, fontWeight: 800, color: T.text2,
              }}
            >
              Dados de alta ({dadosDeAlta.length})
              {verAltas ? <ChevronUp size={15} /> : <ChevronRight size={15} />}
            </button>
            {verAltas && (
              <div style={{ marginTop: 8 }}>
                {modoTabla ? (
                  <AthletesTable
                    rows={dadosDeAlta}
                    coaches={coaches}
                    isMaster={isMaster}
                    selectedId={selected?.id}
                    onPick={setSelected}
                    ahora={cargadoEn}
                    etiquetas={etiquetasDeEquipo}
                    equipoMaster={equipoParaMaster}
                  />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {dadosDeAlta.map(tarjetaDe)}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <GrupoPlegable titulo="Esperando que acepte" cuenta={esperando.length}>
          {esperando.map((e) => (
            <FilaDeEquipo key={e.clave} nombre={e.nombre} detalle={e.detalle} onClick={e.atleta ? () => setSelected(e.atleta) : undefined} />
          ))}
        </GrupoPlegable>
        <GrupoPlegable titulo="Ya no están contigo" cuenta={yaNoEstan.length}>
          {yaNoEstan.map((x) => (
            <FilaDeEquipo
              key={x.clave}
              nombre={x.nombre}
              detalle="Lo quitó de su equipo. Solo conservas tus notas de consulta."
              onClick={() => setSelected({ id: x.fila.atleta_id, full_name: x.nombre, username: '', role: 'user', soloNotas: true })}
            />
          ))}
        </GrupoPlegable>
      </div>
      )}

      {selected && (
        <AthleteDetail
          key={selected.id}
          athlete={selected}
          onIrA={onIrA}
          onVerComoAtleta={onVerComoAtleta}
          isMaster={isMaster}
          coaches={coaches}
          masterProfile={profile}
          onReassigned={(row) => {
            // Se copian los dos campos que la ficha puede cambiar: a quien
            // pertenece y si esta activa. Copiar solo `coach_id` dejaba el
            // boton de Desactivar diciendo lo contrario de lo que acababa
            // de pasar, porque la fila de la lista no se enteraba.
            const parche = { coach_id: row.coach_id, is_active: row.is_active };
            // Un coach que se quita a un atleta deja de verlo: sale de su lista
            // ya, sin esperar a recargar (al recargar la base ya no se lo da).
            if (!isMaster && row.coach_id !== profile?.id) {
              setAthletes((prev) => prev.filter((a) => a.id !== row.id));
              setSelected(null);
              return;
            }
            setAthletes((prev) => prev.map((a) => (a.id === row.id ? { ...a, ...parche } : a)));
            setSelected((s) => (s && s.id === row.id ? { ...s, ...parche } : s));
          }}
          // Dar de alta (o reabrir) cambia solo `alta_en`: se copia a la lista y a
          // la ficha para que el botón y el grupo se muevan al instante.
          onAltaCambiada={(fila) => {
            const parche = { alta_en: fila.alta_en };
            setAthletes((prev) => prev.map((a) => (a.id === fila.id ? { ...a, ...parche } : a)));
            setSelected((s) => (s && s.id === fila.id ? { ...s, ...parche } : s));
          }}
          tokenInvitacion={sinActivar[selected.id]}
          onEquipoCambiado={() => setRecarga((n) => n + 1)}
          onEliminado={(id) => {
            setAthletes((prev) => prev.filter((a) => a.id !== id));
            setSelected(null);
          }}
          onClose={() => setSelected(null)}
        />
      )}

      {agregando && (
        <AgregarAtleta
          onCerrar={() => setAgregando(false)}
          /* Si otro lugar se llenó mientras escribía, se cierra el formulario y se cuenta qué sigue. */
          onSinLugares={() => { setAgregando(false); setRecarga((n) => n + 1); setSinLugaresAbierto(true); }}
          /* Se vuelve a leer la lista en vez de meter la fila a mano: el
             resumen trae cuentas y fechas que solo sabe el servidor, y una
             fila inventada aquí se vería distinta a las demás. */
          onCreado={() => setRecarga((n) => n + 1)}
        />
      )}

      {sinLugaresAbierto && <SinLugares lugares={lugares} onCerrar={() => setSinLugaresAbierto(false)} onIrA={onIrA} />}

      <style>{`
        .spin{animation:spin .8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}
        .fila-atleta{transition:background .12s}
        .fila-atleta:hover{background:${T.bg3} !important}
        .fila-atleta:last-child td{border-bottom:none}
        .kp-pag{transition:background .12s}
        .kp-pag:hover{background:${T.bg3} !important}
      `}</style>
    </div>
  );
}
