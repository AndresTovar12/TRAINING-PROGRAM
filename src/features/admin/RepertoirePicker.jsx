import { useMemo, useState } from 'react';
import { Search, X, Check, Dumbbell, Trash2 } from 'lucide-react';
import { T, FONT, KP } from '@/lib/theme';
import { MUSCLE_GROUPS, exerciseMatchesGroup } from '@/lib/muscles';

/**
 * Selector del repertorio completo (estilo Avena): filtros por categoría,
 * parte del cuerpo; selección múltiple con lista de elegidos y un
 * solo botón "Agregar N". `onConfirm(exercises[])` recibe los elegidos en orden.
 */
export default function RepertoirePicker({ exercises, onConfirm, onClose, title = 'Agregar ejercicios' }) {
  const [query, setQuery] = useState('');
  const [catId, setCatId] = useState(null);
  const [muscle, setMuscle] = useState(null);
  const [picked, setPicked] = useState([]); // filas del repertorio, en orden de selección

  const categories = useMemo(() => {
    const m = new Map();
    exercises.forEach((e) => { if (e.category && !m.has(e.category.id)) m.set(e.category.id, e.category); });
    return [...m.values()];
  }, [exercises]);

  // Conteo por grupo muscular (solo se ofrecen los grupos con ejercicios)
  const groupCounts = useMemo(() => {
    const m = {};
    MUSCLE_GROUPS.forEach((g) => {
      m[g.id] = exercises.filter((e) => exerciseMatchesGroup(e, g.id)).length;
    });
    return m;
  }, [exercises]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return exercises.filter((e) =>
      (!catId || e.category?.id === catId)
      && (!muscle || exerciseMatchesGroup(e, muscle))
      && (!q || e.name.toLowerCase().includes(q) || (e.equipment || '').toLowerCase().includes(q)));
  }, [exercises, query, catId, muscle]);

  const pickedIds = useMemo(() => new Set(picked.map((p) => p.id)), [picked]);
  const toggle = (ex) => {
    setPicked((prev) => (pickedIds.has(ex.id) ? prev.filter((p) => p.id !== ex.id) : [...prev, ex]));
  };

  const selStyle = (active) => ({
    flexShrink: 0, border: `1.5px solid ${active ? T.accent : T.border}`, cursor: 'pointer',
    background: active ? T.accentBg : T.bg2, color: active ? T.accent : T.text2,
    borderRadius: 10, padding: '7px 12px', fontFamily: FONT, fontSize: 12.5, fontWeight: 700,
  });

  return (
    <div
      onMouseDown={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 2600, background: 'rgba(17,19,24,0.5)',
        backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="animate-fade-in"
        style={{
          width: '100%', maxWidth: 980, height: 'min(88svh, 860px)', background: T.bg,
          borderRadius: '24px 24px 0 0', fontFamily: FONT, boxShadow: KP.shPop,
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{ padding: '16px 18px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontSize: 16.5, fontWeight: 800, color: T.text }}>
              {title} · {results.length} en catálogo
            </div>
            <button type="button" onClick={onClose} aria-label="Cerrar" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: T.text2, padding: 4 }}>
              <X size={20} />
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 9, background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 12, padding: '0 13px', marginBottom: 10 }}>
            <Search size={16} color={T.text3} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre o equipo…"
              style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontFamily: FONT, fontSize: 14.5, fontWeight: 500, color: T.text, padding: '12px 0' }}
            />
            {query && (
              <button type="button" onClick={() => setQuery('')} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: T.text3, padding: 2 }}>
                <X size={15} />
              </button>
            )}
          </div>

          {/* Filtros: tres listas desplegables + limpiar */}
          <div style={{ display: 'flex', gap: 8, paddingBottom: 12, flexWrap: 'wrap' }}>
            <select
              value={catId || ''}
              onChange={(e) => setCatId(e.target.value || null)}
              style={{ ...selStyle(!!catId), padding: '8px 10px', outline: 'none', flex: '1 1 150px', minWidth: 0 }}
            >
              <option value="">Todas las categorías</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select
              value={muscle || ''}
              onChange={(e) => setMuscle(e.target.value || null)}
              style={{ ...selStyle(!!muscle), padding: '8px 10px', outline: 'none', flex: '1 1 150px', minWidth: 0 }}
            >
              <option value="">Parte del cuerpo</option>
              {MUSCLE_GROUPS.filter((g) => groupCounts[g.id] > 0).map((g) => (
                <option key={g.id} value={g.id}>{g.label} ({groupCounts[g.id]})</option>
              ))}
            </select>
            {(catId || muscle) && (
              <button
                type="button"
                onClick={() => { setCatId(null); setMuscle(null); }}
                style={{
                  border: 'none', background: 'transparent', cursor: 'pointer', color: T.accent,
                  fontFamily: FONT, fontSize: 12.5, fontWeight: 700, padding: '8px 4px', flexShrink: 0,
                }}
              >
                Limpiar filtros
              </button>
            )}
          </div>
        </div>

        {/* Cuerpo: grid + panel de elegidos */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 0 }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '4px 18px 90px' }}>
            {results.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 16px', color: T.text3 }}>
                <Dumbbell size={34} style={{ opacity: 0.4 }} />
                <div style={{ marginTop: 10, fontWeight: 600, color: T.text2, fontSize: 14 }}>Sin resultados.</div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(172px, 1fr))', gap: 10 }}>
                {results.map((ex) => {
                  const sel = pickedIds.has(ex.id);
                  return (
                    <button
                      key={ex.id}
                      type="button"
                      onClick={() => toggle(ex)}
                      style={{
                        textAlign: 'left', border: `2px solid ${sel ? T.accent : T.border}`, cursor: 'pointer',
                        background: T.bg2, borderRadius: 14, padding: 0, overflow: 'hidden', fontFamily: FONT,
                        boxShadow: sel ? KP.shRaise : KP.shCard, transition: 'border-color .12s, box-shadow .12s',
                        display: 'flex', flexDirection: 'column', alignItems: 'stretch', width: '100%',
                      }}
                    >
                      <div style={{ position: 'relative', height: 96, width: '100%', alignSelf: 'stretch', background: '#0E1015' }}>
                        {ex.cover_image_url ? (
                          <img src={ex.cover_image_url} alt="" loading="lazy"
                            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', opacity: 0.95 }} />
                        ) : (
                          <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: '#3A3F4C' }}>
                            <Dumbbell size={26} />
                          </div>
                        )}
                        <span
                          style={{
                            position: 'absolute', top: 8, right: 8, width: 26, height: 26, borderRadius: 9,
                            display: 'grid', placeItems: 'center', border: sel ? 'none' : '1.5px solid rgba(255,255,255,0.75)',
                            background: sel ? T.accent : 'rgba(0,0,0,0.35)', color: '#fff',
                            backdropFilter: 'blur(4px)', transition: 'background .12s',
                          }}
                        >
                          {sel && <Check size={14} />}
                        </span>
                      </div>
                      <div style={{ padding: '9px 11px 11px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {ex.category && (
                            <span style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: ex.category.color || T.accent }} />
                          )}
                          <span style={{ fontSize: 12.5, fontWeight: 700, color: T.text, lineHeight: 1.25 }}>{ex.name}</span>
                        </div>
                        {ex.equipment && (
                          <div style={{ fontSize: 11, color: T.text3, marginTop: 3, fontWeight: 600 }}>{ex.equipment}</div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Panel de elegidos (desktop) */}
          {picked.length > 0 && (
            <div
              style={{
                width: 250, flexShrink: 0, borderLeft: `1px solid ${T.border}`, background: T.bg2,
                display: window.innerWidth < 720 ? 'none' : 'flex', flexDirection: 'column',
              }}
            >
              <div style={{ padding: '14px 14px 8px', fontSize: 12, fontWeight: 800, color: T.text3, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                Elegidos ({picked.length})
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '0 10px 90px' }}>
                {picked.map((p) => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 4px' }}>
                    {p.cover_image_url ? (
                      <img src={p.cover_image_url} alt="" style={{ width: 34, height: 34, borderRadius: 9, objectFit: 'cover', flexShrink: 0 }} />
                    ) : (
                      <span style={{ width: 34, height: 34, borderRadius: 9, background: T.bg3, display: 'grid', placeItems: 'center', color: T.text3, flexShrink: 0 }}>
                        <Dumbbell size={14} />
                      </span>
                    )}
                    <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 700, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.name}
                    </span>
                    <button type="button" onClick={() => toggle(p)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: T.danger, padding: 2, flexShrink: 0 }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Barra de confirmación */}
        <div
          style={{
            position: 'absolute', left: 0, right: 0, bottom: 0, padding: '14px 18px',
            background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(12px)', borderTop: `1px solid ${T.border}`,
            display: 'flex', justifyContent: 'flex-end', gap: 10,
          }}
        >
          <button
            type="button" onClick={onClose}
            style={{ padding: '12px 18px', borderRadius: 12, border: `1.5px solid ${T.border}`, background: T.bg2, cursor: 'pointer', fontFamily: FONT, fontSize: 14, fontWeight: 700, color: T.text2 }}
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={picked.length === 0}
            onClick={() => onConfirm(picked)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 22px', borderRadius: 12,
              border: 'none', cursor: picked.length ? 'pointer' : 'default', opacity: picked.length ? 1 : 0.5,
              background: `linear-gradient(135deg, ${T.accent}, ${T.accentDk})`, color: '#fff',
              fontFamily: FONT, fontSize: 14.5, fontWeight: 800, boxShadow: KP.shBtn,
            }}
          >
            <Check size={15} /> Agregar {picked.length > 0 ? picked.length : ''} {picked.length === 1 ? 'ejercicio' : 'ejercicios'}
          </button>
        </div>
      </div>
    </div>
  );
}
