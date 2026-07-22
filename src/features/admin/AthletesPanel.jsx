import { useEffect, useMemo, useState } from 'react';
import {
  Loader2, Search, Plus, Trash2, X, ChevronRight, Pencil,
  CalendarClock, User as UserIcon, Shield, Layers, ClipboardList,
} from 'lucide-react';
import { getActivePlan, deletePlan, getAthleteState, listAthletes, listCoaches, setAthleteCoach } from '@/lib/api';
import PlanBuilder from '@/features/admin/PlanBuilder';
import { useAuth } from '@/contexts/AuthContext';
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

/* ----------------------------- Detalle de atleta ----------------------------- */
function AthleteDetail({ athlete, onClose, isMaster, coaches = [], masterProfile, onReassigned }) {
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
          <div style={{ fontSize: 18, fontWeight: 800, color: T.text }}>{athlete.full_name || athlete.username}</div>
          <div style={{ fontSize: 13.5, color: T.text2, fontWeight: 500 }}>@{athlete.username}{athlete.email ? ` · ${athlete.email}` : ''}</div>
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

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, color: T.text, fontSize: 15 }}>
          <ClipboardList size={18} color={T.accent} /> Plan de entrenamiento
        </div>
        {plan && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={() => setBuilding(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 14px', borderRadius: 11, border: 'none', cursor: 'pointer', background: T.accentBg, color: T.accent, fontFamily: FONT, fontSize: 13.5, fontWeight: 700 }}
            >
              <Pencil size={14} /> Editar plan
            </button>
            <button
              type="button"
              onClick={onDeletePlan}
              title="Eliminar plan"
              style={{ display: 'grid', placeItems: 'center', width: 36, borderRadius: 11, border: `1px solid ${T.border}`, cursor: 'pointer', background: T.bg2, color: T.danger }}
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
  const [athletes, setAthletes] = useState([]);
  const [coaches, setCoaches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const a = await listAthletes();
        if (!cancelled) setAthletes(a);
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

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: T.text2, fontWeight: 600, padding: 40 }}>
        <Loader2 size={18} className="spin" /> Cargando atletas…
      </div>
    );
  }

  const twoCol = selected && !narrow;
  const showList = !(narrow && selected);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: twoCol ? 'minmax(280px, 1fr) 1.4fr' : '1fr', gap: 20, alignItems: 'start' }}>
      {showList && (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 12, padding: '0 14px', marginBottom: 16 }}>
          <Search size={17} color={T.text3} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar atleta…"
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontFamily: FONT, fontSize: 14.5, fontWeight: 500, color: T.text, padding: '12px 0' }}
          />
        </div>

        {err && (
          <div style={{ background: 'rgba(220,38,38,0.08)', color: T.danger, borderRadius: 12, padding: '12px 16px', fontWeight: 600, marginBottom: 16 }}>{err}</div>
        )}

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

      <style>{`.spin{animation:spin .8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
