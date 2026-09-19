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
  /* Si la lista tiene más de lo que cabe. Se mide de verdad en vez de suponer
     por cuántos tipos hay: el alto depende también de cuántos propios creó el
     coach y de la letra del teléfono. */
  const lista = useRef(null);
  const [hayMas, setHayMas] = useState(false);

  const miraSiHayMas = useCallback(() => {
    const el = lista.current;
    if (!el) return;
    // 4 px de margen: al final del scroll la cuenta no siempre da exacta.
    setHayMas(el.scrollHeight - el.scrollTop - el.clientHeight > 4);
  }, []);

  /* Al abrir todavía no hay nada medido, y sin esto el aviso solo aparecería
     después de que el coach escroleara, que es justo cuando ya no hace falta.
     Se vuelve a medir cuando cambian los tipos propios: llegan por red después
     de abrir, y cada uno que entra hace la lista más larga. */
  useEffect(() => {
    if (abierto) miraSiHayMas();
  }, [abierto, mios.length, miraSiHayMas]);
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

  /* EL ORDEN DE LA LISTA, a mano y no el del objeto.
     Andrés, 18 sep 2026: "«neural», «recovery», «equipo», «test» son las menos
     importantes, no las pongas primero". Salían arriba solo porque son las más
     viejas y el objeto conserva el orden en que se escribieron. Primero lo que
     un coach usa casi a diario, y al final lo suelto.
     Esto cambia SOLO lo que se ve: lo que se guarda sigue siendo el mismo
     slug, así que los planes que ya existen no se enteran. */
  const base = useMemo(() => {
    const orden = ['gym', 'correr', 'bici', 'natacion', 'yoga', 'movilidad', 'clase',
      'football', 'terapia', 'off', 'speed', 'recovery', 'tests', 'team'];
    const puesto = (slug) => {
      const i = orden.indexOf(slug);
      // Un tipo nuevo que alguien agregue a CAT_COLORS y olvide poner en la
      // lista de arriba cae al final, no en medio y al azar.
      return i === -1 ? orden.length : i;
    };
    return Object.entries(CAT_COLORS)
      .map(([slug, v]) => ({ slug, ...v }))
      .sort((a, b) => puesto(a.slug) - puesto(b.slug));
  }, []);

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
            boxShadow: '0 16px 44px rgba(17,19,24,0.16)',
            /* Ya no hace scroll este, sino la lista de adentro: así el botón de
               crear se queda pegado abajo, siempre a la vista. */
            maxHeight: 340, minWidth: 220, display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {creando ? (
            <div style={{ padding: 13, display: 'flex', flexDirection: 'column', gap: 10 }}>
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
            {/* LA LISTA, CON SU PROPIO SCROLL Y UN AVISO DE QUE SIGUE.
                Andrés, 18 sep 2026: "cuando se despliega esta lista no te das
                cuenta que hay más para abajo si la escroleas, eso hay que
                arreglarlo". El degradado del borde no es adorno: aparece SOLO
                cuando queda algo por ver, y se apaga al llegar al final. Uno
                fijo mentiría en las listas cortas. */}
            <div style={{ position: 'relative', flex: '1 1 auto', minHeight: 0 }}>
              <div ref={lista} onScroll={miraSiHayMas} style={{ maxHeight: 268, overflowY: 'auto', padding: 7 }}>
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

              </div>

              {hayMas && (
                <span
                  aria-hidden="true"
                  style={{
                    position: 'absolute', left: 1, right: 1, bottom: 0, height: 30,
                    background: `linear-gradient(to top, ${T.bg2}, ${T.bg2}00)`,
                    pointerEvents: 'none',
                  }}
                />
              )}
            </div>

            {/* EL PIE, FUERA DEL SCROLL. Antes era la última fila de la lista:
                "lo de crear tipo nunca lo voy a poder ver porque está hasta
                abajo, y si no sé que la puedo escrolear, pues menos". */}
            <div style={{ flexShrink: 0, borderTop: `1px solid ${T.border}`, padding: 7 }}>
              {puedeCrear ? (
                <button
                  type="button"
                  onClick={() => { setCreando(true); setErr(''); }}
                  style={{ ...fila(false), color: T.accent, fontWeight: 800 }}
                >
                  <Plus size={15} /> Crear tipo nuevo
                </button>
              ) : (
                <div style={{ fontSize: 11.5, color: T.text3, fontWeight: 600, padding: '9px 11px', lineHeight: 1.4 }}>
                  Para crear tipos, sal de «Ver como».
                </div>
              )}
            </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
