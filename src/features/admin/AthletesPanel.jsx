import { useEffect, useMemo, useState } from 'react';
import {
  Loader2, Search, Plus, Trash2, X, ChevronRight, ChevronLeft, Pencil,
  CalendarClock, User as UserIcon, Shield, Layers, ClipboardList, Users,
} from 'lucide-react';
import { getActivePlan, deletePlan, getAthleteState, listAthletesOverview, listCoaches, setAthleteCoach } from '@/lib/api';
import PlanBuilder from '@/features/admin/PlanBuilder';
import { useAuth } from '@/contexts/AuthContext';
import { useIsDesktop } from '@/lib/useViewport';
import { T, FONT, KP } from '@/lib/theme';

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

const TH = {
  textAlign: 'left', padding: '10px 14px', fontSize: 11, fontWeight: 800,
  color: T.text3, textTransform: 'uppercase', letterSpacing: 0.7,
  borderBottom: `1px solid ${T.border}`, whiteSpace: 'nowrap',
};
const TD = {
  padding: '11px 14px', borderBottom: `1px solid ${T.border}`,
  fontSize: 14, color: T.text, verticalAlign: 'middle',
};

function StatCard({ icon, label, value, tono }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 11, background: T.bg2,
      border: `1px solid ${T.border}`, borderRadius: 14, padding: '13px 15px',
      boxShadow: KP.shCard, minWidth: 0,
    }}>
      <span style={{
        width: 34, height: 34, borderRadius: 11, flexShrink: 0, display: 'grid', placeItems: 'center',
        background: tono === 'alerta' ? 'rgba(220,38,38,0.09)' : T.accentBg,
        color: tono === 'alerta' ? T.danger : T.accent,
      }}>{icon}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 19, fontWeight: 800, color: T.text, lineHeight: 1.1 }}>{value}</div>
        <div style={{ fontSize: 12, color: T.text2, fontWeight: 600, marginTop: 1 }}>{label}</div>
      </div>
    </div>
  );
}

/** Celda del plan: titulo + de que tipo es + cuanto mide. */
function PlanCell({ plan }) {
  if (!plan) return <span style={{ fontSize: 13.5, color: T.text3, fontWeight: 600 }}>Sin plan</span>;
  const etiqueta = plan.kind === 'weekly' ? 'Semanal' : 'Por fases';
  const detalle = plan.kind === 'weekly'
    ? `${plan.weeks} semana${plan.weeks === 1 ? '' : 's'}`
    : `${plan.phases} fase${plan.phases === 1 ? '' : 's'} · ${plan.weeks} sem`;
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontWeight: 700, fontSize: 13.5, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {plan.title || 'Plan sin título'}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
        <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, color: T.accent, background: T.accentBg, borderRadius: 6, padding: '2px 6px' }}>{etiqueta}</span>
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

function AthletesTable({ rows, coaches, isMaster, selectedId, onPick }) {
  const nombreCoach = (id) => {
    if (!id) return null;
    const c = coaches.find((x) => x.id === id);
    return c ? (c.full_name || c.username) : null;
  };
  // La columna "Coach" solo tiene sentido en la cuenta master: un coach viendo
  // a sus propios atletas leeria su nombre repetido en cada fila.
  const cols = isMaster ? 5 : 4;

  return (
    <div style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 16, boxShadow: KP.shCard, overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: FONT }}>
          <thead>
            <tr style={{ background: T.bg }}>
              <th style={TH}>Atleta</th>
              <th style={TH}>Plan</th>
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
                  style={{ cursor: 'pointer', background: activo ? T.accentBg : 'transparent' }}
                >
                  <td style={TD}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
                      <Avatar name={a.full_name || a.username} url={a.avatar_url} size={34} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {a.full_name || a.username}
                        </div>
                        <div style={{ fontSize: 12.5, color: T.text2, fontWeight: 500 }}>@{a.username}</div>
                      </div>
                    </div>
                  </td>
                  <td style={TD}><PlanCell plan={a.plan} /></td>
                  <td style={{ ...TD, fontSize: 13.5, color: visto ? T.text2 : T.text3, fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {visto || 'Nunca ha entrado'}
                  </td>
                  {isMaster && (
                    <td style={{ ...TD, fontSize: 13.5, fontWeight: 600, color: coach ? T.text2 : T.text3, whiteSpace: 'nowrap' }}>
                      {coach || 'Sin asignar'}
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
                  <div style={{ marginTop: 10, fontWeight: 600, color: T.text2 }}>Sin atletas.</div>
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
function AthleteDetail({ athlete, onClose, isMaster, coaches = [], masterProfile, onReassigned }) {
  const esCompu = useIsDesktop();
  const [plan, setPlan] = useState(null);
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [building, setBuilding] = useState(false);
  const [savingCoach, setSavingCoach] = useState(false);

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
    setLoading(true);
    (async () => {
      try {
        const [p, s] = await Promise.all([getActivePlan(athlete.id), getAthleteState(athlete.id)]);
        if (cancelled) return;
        setPlan(p);
        setState(s);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [athlete.id]);

  async function onDeletePlan() {
    if (!plan) return;
    if (!window.confirm(`¿Eliminar el plan "${plan.title}" de ${athlete.full_name || athlete.username}? Esta acción no se puede deshacer.`)) return;
    await deletePlan(plan.id);
    setPlan(null);
  }

  const last = timeAgo(state?.updated_at);
  const phases = plan?.data?.phases ?? [];
  const totalWeeks = phases.reduce((s, p) => s + (p.weekData?.length || 0), 0);
  const totalSessions = phases.reduce(
    (s, p) => s + (p.weekData?.reduce((x, w) => x + (w.days?.length || 0), 0) || 0), 0,
  );
  // Sesiones completadas según el estado de la app del atleta
  const completed = useMemo(() => {
    const sessions = state?.data?.['wr:sessions'];
    if (!sessions) return null;
    return Object.values(sessions).filter((s) => s?.completed).length;
  }, [state]);

  return (
    <div style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: KP.rCard, padding: 22, boxShadow: KP.shCard }}>
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
          <div
            title={`@${athlete.username}${athlete.email ? ` · ${athlete.email}` : ''}`}
            style={{
              fontSize: 13.5, color: T.text2, fontWeight: 500,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}
          >
            @{athlete.username}{athlete.email ? ` · ${athlete.email}` : ''}
          </div>
        </div>
        <button type="button" onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: T.text2, padding: 4 }}>
          <X size={20} />
        </button>
      </div>

      {/* Coach asignado (solo master) */}
      {isMaster && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, background: T.bg, borderRadius: 12, padding: '11px 14px', flexWrap: 'wrap' }}>
          <Shield size={16} color={T.accent} />
          <span style={{ fontSize: 13, fontWeight: 700, color: T.text2 }}>Coach:</span>
          <select
            value={athlete.coach_id || ''}
            onChange={(e) => onChangeCoach(e.target.value)}
            disabled={savingCoach}
            style={{ flex: 1, minWidth: 140, border: `1.5px solid ${T.border}`, borderRadius: 10, padding: '8px 10px', fontFamily: FONT, fontSize: 13.5, fontWeight: 600, color: T.text, background: T.bg2, outline: 'none' }}
          >
            <option value="">Sin coach (libre)</option>
            {masterProfile && (
              <option value={masterProfile.id}>Yo — {masterProfile.full_name || masterProfile.username} (master)</option>
            )}
            {coaches.map((c) => (
              <option key={c.id} value={c.id}>{c.full_name || c.username} (@{c.username})</option>
            ))}
          </select>
          {savingCoach && <Loader2 size={15} className="spin" color={T.text3} />}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 140px', background: T.bg, borderRadius: 12, padding: '12px 14px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.text3, textTransform: 'uppercase', letterSpacing: 0.6 }}>Última actividad</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5, fontWeight: 700, color: T.text, fontSize: 14 }}>
            <CalendarClock size={15} color={T.text2} /> {last || 'Sin registros'}
          </div>
        </div>
        <div style={{ flex: '1 1 140px', background: T.bg, borderRadius: 12, padding: '12px 14px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.text3, textTransform: 'uppercase', letterSpacing: 0.6 }}>Sesiones completadas</div>
          <div style={{ marginTop: 5, fontWeight: 800, color: T.accent, fontSize: 18 }}>
            {completed ?? '—'}{completed != null && totalSessions ? ` / ${totalSessions}` : ''}
          </div>
        </div>
      </div>

      {/* El titulo cede espacio y los botones no. Antes esta fila se dibujaba
          a 470px —mas ancha que el telefono— y por eso "Editar plan" cabia en
          un renglon: cabia porque se salia de la pantalla. Ahora que la fila
          mide lo que mide el telefono, el titulo se recorta si hace falta y
          los botones se quedan enteros, que es el orden correcto: el titulo
          se entiende cortado, un boton partido en dos renglones no. */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, minWidth: 0,
          fontWeight: 800, color: T.text, fontSize: 15,
        }}>
          {/* En telefono no cabe "Plan de entrenamiento" junto a los botones:
              sale cortado con puntos suspensivos, que se lee peor que una
              palabra corta y completa. Aqui ya estas dentro de la ficha del
              atleta y la tarjeta del plan va justo debajo, asi que "Plan"
              no se presta a confusion. En compu sobra ancho y va completo. */}
          {esCompu && <ClipboardList size={18} color={T.accent} style={{ flexShrink: 0 }} />}
          <span style={{ whiteSpace: 'nowrap' }}>
            {esCompu ? 'Plan de entrenamiento' : 'Plan'}
          </span>
        </div>
        {plan && (
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => setBuilding(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 14px', borderRadius: 11, border: 'none', cursor: 'pointer', background: T.accentBg, color: T.accent, fontFamily: FONT, fontSize: 13.5, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}
            >
              <Pencil size={14} /> Editar plan
            </button>
            <button
              type="button"
              onClick={onDeletePlan}
              title="Eliminar plan"
              style={{ display: 'grid', placeItems: 'center', width: 36, flexShrink: 0, borderRadius: 11, border: `1px solid ${T.border}`, cursor: 'pointer', background: T.bg2, color: T.danger }}
            >
              <Trash2 size={15} />
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.text2, padding: '12px 0', fontWeight: 600 }}>
          <Loader2 size={16} className="spin" /> Cargando…
        </div>
      ) : !plan ? (
        <div style={{ textAlign: 'center', padding: '30px 16px' }}>
          <Layers size={32} color={T.text3} style={{ opacity: 0.5 }} />
          <div style={{ margin: '10px 0 16px', fontWeight: 600, color: T.text2, fontSize: 13.5 }}>
            Aún no tiene plan. Créale uno con la misma estructura del programa original.
          </div>
          <button
            type="button"
            onClick={() => setBuilding(true)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 20px', borderRadius: 12,
              border: 'none', cursor: 'pointer', background: `linear-gradient(135deg, ${T.accent}, ${T.accentDk})`,
              color: '#fff', fontFamily: FONT, fontSize: 14.5, fontWeight: 700, boxShadow: KP.shBtn,
            }}
          >
            <Plus size={16} /> Crear plan
          </button>
        </div>
      ) : (
        <div style={{ background: T.bg, borderRadius: 14, padding: 16 }}>
          <div style={{ fontWeight: 800, color: T.text, fontSize: 15 }}>{plan.title}</div>
          <div style={{ fontSize: 12.5, color: T.text2, marginTop: 4, fontWeight: 600 }}>
            {phases.length} fase{phases.length !== 1 ? 's' : ''} · {totalWeeks} semana{totalWeeks !== 1 ? 's' : ''} · {totalSessions} sesiones
          </div>
          {/* Fases resumidas */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 12 }}>
            {phases.map((p) => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 9, height: 9, borderRadius: 3, flexShrink: 0, background: p.color || T.accent }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: T.text, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.name}
                </span>
                <span style={{ fontSize: 12, color: T.text3, fontWeight: 600, flexShrink: 0 }}>
                  {p.weekData?.length || 0} sem
                </span>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11.5, color: T.text3, marginTop: 12, fontWeight: 600 }}>
            Actualizado {timeAgo(plan.updated_at) || '—'}
          </div>
        </div>
      )}

      {building && (
        <PlanBuilder
          athlete={athlete}
          planRow={plan}
          onClose={() => setBuilding(false)}
          onSaved={(row) => { setPlan(row); setBuilding(false); }}
        />
      )}
    </div>
  );
}

/* ------------------------------ Panel raíz ------------------------------ */
export default function AthletesPanel() {
  const { profile } = useAuth();
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
  // Momento en que llegaron los datos. Sirve de "ahora" para las metricas:
  // leer el reloj dentro del useMemo lo dejaria congelado en la primera vuelta.
  const [cargadoEn, setCargadoEn] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const a = await listAthletesOverview();
        if (!cancelled) { setAthletes(a); setCargadoEn(Date.now()); }
        if (isMaster) {
          const c = await listCoaches();
          if (!cancelled) setCoaches(c);
        }
      } catch (e2) {
        if (!cancelled) setErr(e2.message || 'Error al cargar');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isMaster]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    // Solo atletas (oculta cuentas de coach/master de la lista de clientes)
    const base = athletes.filter((a) => a.role !== 'admin');
    if (!q) return base;
    return base.filter(
      (a) => (a.full_name || '').toLowerCase().includes(q) || (a.username || '').toLowerCase().includes(q),
    );
  }, [athletes, search]);

  // Las tres preguntas que un coach se hace al abrir la lista.
  const metricas = useMemo(() => {
    const base = athletes.filter((a) => a.role !== 'admin');
    const hace7dias = cargadoEn - 7 * 86400000;
    return {
      total: base.length,
      sinPlan: base.filter((a) => !a.plan).length,
      activos: base.filter((a) => a.lastSeen && new Date(a.lastSeen).getTime() >= hace7dias).length,
    };
  }, [athletes, cargadoEn]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: T.text2, fontWeight: 600, padding: 40 }}>
        <Loader2 size={18} className="spin" /> Cargando atletas…
      </div>
    );
  }

  const twoCol = selected && !narrow;
  const showList = !(narrow && selected);
  // Tabla solo cuando hay ancho de verdad y nadie esta abierto. Con el detalle
  // abierto la lista se encoge a ~280px, y ahi una tabla no se puede leer:
  // vuelven las tarjetas.
  const modoTabla = isDesktop && !selected;

  // Paginado solo en la tabla. En el telefono la lista se desliza completa,
  // que es como funciona cualquier lista de contactos: ahi paginar estorba.
  // La pagina se recorta aqui en vez de con un efecto: si filtras y quedan
  // menos paginas que la que estabas viendo, se ajusta sola sin renders extra.
  const totalPaginas = Math.max(1, Math.ceil(filtered.length / POR_PAGINA));
  const paginaActual = Math.min(pagina, totalPaginas);
  const visibles = modoTabla
    ? filtered.slice((paginaActual - 1) * POR_PAGINA, paginaActual * POR_PAGINA)
    : filtered;
  const desde = filtered.length === 0 ? 0 : (paginaActual - 1) * POR_PAGINA + 1;
  const hasta = Math.min(paginaActual * POR_PAGINA, filtered.length);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: twoCol ? 'minmax(280px, 1fr) minmax(0, 1.4fr)' : 'minmax(0, 1fr)', gap: 20, alignItems: 'start' }}>
      {showList && (
      <div>
        {modoTabla && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, marginBottom: 16 }}>
            <StatCard icon={<Users size={17} />} label="Atletas" value={metricas.total} />
            <StatCard icon={<ClipboardList size={17} />} label="Sin plan" value={metricas.sinPlan} tono={metricas.sinPlan > 0 ? 'alerta' : undefined} />
            <StatCard icon={<CalendarClock size={17} />} label="Activos (7 días)" value={metricas.activos} />
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 12, padding: '0 14px', marginBottom: 16 }}>
          <Search size={17} color={T.text3} />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPagina(1); }}
            placeholder="Buscar atleta…"
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontFamily: FONT, fontSize: 14.5, fontWeight: 500, color: T.text, padding: '12px 0' }}
          />
        </div>

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
            />
            {totalPaginas > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 14 }}>
                <div style={{ fontSize: 13, color: T.text2, fontWeight: 600 }}>
                  Mostrando {desde}–{hasta} de {filtered.length}
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
          {filtered.map((a) => {
            const active = selected?.id === a.id;
            const isAdmin = a.role === 'admin';
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => setSelected(a)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, cursor: 'pointer',
                  border: `1.5px solid ${active ? T.accent : T.border}`, background: T.bg2, fontFamily: FONT, textAlign: 'left',
                  boxShadow: active ? KP.shRaise : KP.shCard,
                  transition: 'border-color .15s, box-shadow .15s, transform .12s',
                }}
              >
                <Avatar name={a.full_name || a.username} url={a.avatar_url} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: T.text, fontSize: 14.5, display: 'flex', alignItems: 'center', gap: 7 }}>
                    {a.full_name || a.username}
                    {isAdmin && <Shield size={13} color={T.accent} />}
                  </div>
                  <div style={{ fontSize: 12.5, color: T.text2, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>@{a.username}</div>
                </div>
                <ChevronRight size={18} color={T.text3} />
              </button>
            );
          })}
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 16px', color: T.text3 }}>
              <UserIcon size={34} style={{ opacity: 0.4 }} />
              <div style={{ marginTop: 10, fontWeight: 600, color: T.text2 }}>Sin atletas.</div>
            </div>
          )}
        </div>
        )}
      </div>
      )}

      {selected && (
        <AthleteDetail
          key={selected.id}
          athlete={selected}
          isMaster={isMaster}
          coaches={coaches}
          masterProfile={profile}
          onReassigned={(row) => {
            setAthletes((prev) => prev.map((a) => (a.id === row.id ? { ...a, coach_id: row.coach_id } : a)));
            setSelected((s) => (s && s.id === row.id ? { ...s, coach_id: row.coach_id } : s));
          }}
          onClose={() => setSelected(null)}
        />
      )}

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
