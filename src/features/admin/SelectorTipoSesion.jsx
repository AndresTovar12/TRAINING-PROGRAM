import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Loader2, Plus, Trash2, X } from 'lucide-react';
import { CAT_COLORS, COLORES_TIPO, FONT, T } from '@/lib/theme';
import { createSessionType, deleteSessionType, listSessionTypes } from '@/lib/api';
import { useConfirmacion } from '@/components/Confirmacion';

/**
 * El tipo de sesión, con la lista de la app en vez de la del sistema.
 *
 * POR QUÉ NO ES UN <select>. Andrés, 17 sep 2026: "no me gustan esas listas de
 * formato de Safari, me gustaría nuestro propio formato". En el iPhone el
 * desplegable nativo es una rueda gris a media pantalla que no enseña colores
 * ni deja crear nada. Aquí se ven los colores, que es lo que el coach reconoce
 * de un vistazo en el calendario.
 *
 * LO PROPIO DE CADA COACH. Los de base están en el código y los ve todo el
 * mundo. Además cada coach guarda los suyos ("Vinyasa", "Terapia de hombro")
 * con su color. Lo que se elige viaja DENTRO del día del plan:
 *
 *   base   → { cat: 'yoga' }
 *   propio → { cat: 'otro', catNombre: 'Vinyasa', catColor: '#C084FC' }
 *
 * Por eso el atleta lee el nombre sin consultar nada, y borrar un atajo no
 * deja ninguna sesión sin tipo.
 */
export default function SelectorTipoSesion({ day, onPatch, coachId, puedeCrear = true }) {
  const [abierto, setAbierto] = useState(false);
  const [mios, setMios] = useState([]);
  const [creando, setCreando] = useState(false);
  const [nombre, setNombre] = useState('');
  const [color, setColor] = useState(COLORES_TIPO[0]);
  const [guardando, setGuardando] = useState(false);
  const [err, setErr] = useState('');
  const caja = useRef(null);
  const pregunta = useConfirmacion();

  useEffect(() => {
    if (!coachId) return;
    listSessionTypes(coachId).then(setMios).catch(() => setMios([]));
  }, [coachId]);

  const cerrar = useCallback(() => {
    setAbierto(false); setCreando(false); setNombre(''); setErr('');
  }, []);

  useEffect(() => {
    if (!abierto) return undefined;
    const fuera = (e) => { if (caja.current && !caja.current.contains(e.target)) cerrar(); };
    document.addEventListener('mousedown', fuera);
    return () => document.removeEventListener('mousedown', fuera);
  }, [abierto, cerrar]);

  const base = useMemo(() => Object.entries(CAT_COLORS).map(([slug, v]) => ({ slug, ...v })), []);

  const actual = day?.cat === 'otro' && (day?.catNombre || '').trim()
    ? { label: day.catNombre.trim(), c: day.catColor || '#6B7280' }
    : (CAT_COLORS[day?.cat] || CAT_COLORS.gym);

  const eligeBase = (slug) => {
    // Se limpian el nombre y el color propios: si se quedan, vuelven a salir
    // en cuanto alguien toque `cat` sin pasar por aquí.
    onPatch({ cat: slug, catNombre: null, catColor: null });
    cerrar();
  };

  const eligeMio = (t) => {
    onPatch({ cat: 'otro', catNombre: t.nombre, catColor: t.color });
    cerrar();
  };

  const guarda = async () => {
    const limpio = nombre.trim();
    if (!limpio) { setErr('Ponle un nombre'); return; }
    if (mios.some((m) => m.nombre.toLowerCase() === limpio.toLowerCase())) {
      setErr('Ya tienes uno con ese nombre'); return;
    }
    setGuardando(true);
    setErr('');
    try {
      const fila = await createSessionType({ nombre: limpio, color, coachId });
      setMios((prev) => [...prev, fila].sort((a, b) => a.nombre.localeCompare(b.nombre)));
      eligeMio(fila);
    } catch (e) {
      setErr(e.message || 'No se pudo guardar');
      setGuardando(false);
    }
  };

  const borra = async (t) => {
    const va = await pregunta({
      titulo: `¿Quitar "${t.nombre}" de tu lista?`,
      detalle: 'Las sesiones que ya lo usan no cambian: conservan su nombre y su color.',
      confirmar: 'Sí, quitarlo',
      peligro: true,
    });
    if (!va) return;
    await deleteSessionType(t.id);
    setMios((prev) => prev.filter((m) => m.id !== t.id));
  };

  const fila = (activo) => ({
    display: 'flex', alignItems: 'center', gap: 9, width: '100%',
    padding: '10px 11px', borderRadius: 10, border: 'none', cursor: 'pointer',
    background: activo ? T.accentBg : 'transparent', textAlign: 'left',
    fontFamily: FONT, fontSize: 14, fontWeight: 600, color: T.text,
  });

  return (
    <div ref={caja} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 9,
          padding: '12px 13px', borderRadius: 12, border: `1.5px solid ${T.border}`,
          background: T.bg2, cursor: 'pointer', fontFamily: FONT, fontSize: 14,
          fontWeight: 700, color: T.text, textAlign: 'left',
        }}
      >
        <span style={{ width: 11, height: 11, borderRadius: 6, background: actual.c, flexShrink: 0 }} />
        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {actual.label}
        </span>
        <ChevronDown size={16} color={T.text3} style={{ flexShrink: 0 }} />
      </button>

      {abierto && (
        <div
          className="animate-fade-in"
          style={{
            position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 60,
            background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 14,
            boxShadow: '0 16px 44px rgba(17,19,24,0.16)', padding: 7,
            maxHeight: 320, overflowY: 'auto', minWidth: 220,
          }}
        >
          {creando ? (
            <div style={{ padding: 6, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 800, color: T.text }}>Tipo nuevo</span>
                <button type="button" onClick={() => { setCreando(false); setErr(''); }}
                  aria-label="Cancelar"
                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: T.text3, padding: 2 }}>
                  <X size={16} />
                </button>
              </div>
              <input
                autoFocus
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') guarda(); }}
                placeholder="Ej. Vinyasa"
                maxLength={40}
                style={{
                  width: '100%', padding: '11px 12px', borderRadius: 10, boxSizing: 'border-box',
                  border: `1.5px solid ${T.border}`, background: T.bg, fontFamily: FONT,
                  fontSize: 16, fontWeight: 600, color: T.text, outline: 'none',
                }}
              />
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {COLORES_TIPO.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    aria-label={`Color ${c}`}
                    style={{
                      width: 26, height: 26, borderRadius: 13, cursor: 'pointer', background: c,
                      border: c === color ? `2.5px solid ${T.text}` : '2.5px solid transparent',
                      display: 'grid', placeItems: 'center',
                    }}
                  >
                    {c === color && <Check size={13} color="#fff" strokeWidth={3.5} />}
                  </button>
                ))}
              </div>
              {err && <div style={{ fontSize: 12.5, fontWeight: 600, color: T.danger }}>{err}</div>}
              <button
                type="button"
                onClick={guarda}
                disabled={guardando}
                style={{
                  padding: '11px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
                  background: T.accent, color: '#fff', fontFamily: FONT, fontSize: 14, fontWeight: 800,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                }}
              >
                {guardando && <Loader2 size={15} className="spin" />} Guardar y usar
              </button>
            </div>
          ) : (
            <>
              {mios.length > 0 && (
                <>
                  <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 0.8, color: T.text3, padding: '6px 11px 4px' }}>
                    LOS TUYOS
                  </div>
                  {mios.map((m) => {
                    const activo = day?.cat === 'otro' && day?.catNombre === m.nombre;
                    return (
                      <div key={m.id} style={{ display: 'flex', alignItems: 'center' }}>
                        <button type="button" onClick={() => eligeMio(m)} style={fila(activo)}>
                          <span style={{ width: 11, height: 11, borderRadius: 6, background: m.color, flexShrink: 0 }} />
                          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {m.nombre}
                          </span>
                          {activo && <Check size={15} color={T.accent} />}
                        </button>
                        <button
                          type="button"
                          onClick={() => borra(m)}
                          aria-label={`Quitar ${m.nombre}`}
                          style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: T.text3, padding: '8px 8px' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    );
                  })}
                  <div style={{ height: 1, background: T.border, margin: '6px 4px' }} />
                </>
              )}

              <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 0.8, color: T.text3, padding: '6px 11px 4px' }}>
                DE LA APP
              </div>
              {base.map((b) => (
                <button key={b.slug} type="button" onClick={() => eligeBase(b.slug)} style={fila(day?.cat === b.slug)}>
                  <span style={{ width: 11, height: 11, borderRadius: 6, background: b.c, flexShrink: 0 }} />
                  <span style={{ flex: 1, minWidth: 0 }}>{b.label}</span>
                  {day?.cat === b.slug && <Check size={15} color={T.accent} />}
                </button>
              ))}

              {puedeCrear ? (
                <button
                  type="button"
                  onClick={() => { setCreando(true); setErr(''); }}
                  style={{
                    ...fila(false), marginTop: 5, color: T.accent, fontWeight: 800,
                    borderTop: `1px solid ${T.border}`, borderRadius: '0 0 10px 10px',
                  }}
                >
                  <Plus size={15} /> Crear tipo nuevo
                </button>
              ) : (
                <div style={{ fontSize: 11.5, color: T.text3, fontWeight: 600, padding: '9px 11px', lineHeight: 1.4 }}>
                  Para crear tipos, sal de «Ver como».
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
