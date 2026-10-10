import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Loader2, Search, Tag } from 'lucide-react';
import HojaFlotante from '@/components/HojaFlotante';
import { IconoSvg } from '@/components/IconoDeTipo';
import { buscaIconos, ICONO_NEUTRO, normaliza, sugiereIcono } from '@/lib/iconosDeTipo';
import { useCatalogoDeIconos } from '@/lib/useCatalogoDeIconos';
import { useIsDesktop } from '@/lib/useViewport';
import { COLORES_TIPO, FONT, KP, LT } from '@/lib/theme';

/**
 * «Tipo nuevo»: nombre, color e ÍCONO, con una vista previa de cómo saldrá en «Hoy te toca».
 *
 * Andrés, 9 oct 2026: antes se creaba en el popover chico del selector, con solo nombre y color, y todos los tipos propios caían a la misma pesa
 * («está ligado a formas geométricas que tú le asignaste»). Ahora hay una hoja con espacio (card en la compu, pantalla completa en el teléfono):
 *
 *   · LA VISTA PREVIA es el cartel de «Hoy te toca» con el NOMBRE escrito encima: lo que se escribe, se ve ya como lo verá el atleta.
 *   · EL ÍCONO SE SUGIERE al escribir el nombre («Boxeo» → guante, «Spinning» → bicicleta) y se cambia buscando por palabra o por categoría.
 *     Si no toca nada, se guarda el que se ve en la vista previa: lo que ves es lo que se guarda.
 *   · «GUARDAR Y USAR» cuando se abrió desde el menú del editor (el tipo se pone en la sesión); «GUARDAR» cuando se abrió desde «Administrar».
 *
 * `propios`: los tipos que ya tiene (no se repite un nombre). `onGuardar({ nombre, color, icono })` devuelve una promesa: si falla, aquí se escribe el error.
 */

const A_RGB = (hex) => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const rgba = (hex, a) => { const [r, g, b] = A_RGB(hex); return `rgba(${r},${g},${b},${a})`; };
// El resplandor del cartel: el color del tipo arriba a la derecha y un poco de azul abajo (como en `TarjetaDeHoy`).
const resplandor = (hex) => `radial-gradient(circle at 74% 30%, ${rgba(hex, 0.62)}, transparent 52%), radial-gradient(circle at 8% 110%, rgba(110,140,255,0.38), transparent 50%)`;

// Una sombra suave arriba o abajo cuando hay más por desplazar (el truco de `background-attachment: local`: sin JavaScript ni medir nada).
const SOMBRAS_DE_SCROLL = [
  `linear-gradient(${LT.bg} 30%, rgba(244,245,248,0)) top / 100% 22px no-repeat local`,
  `linear-gradient(rgba(244,245,248,0), ${LT.bg} 70%) bottom / 100% 22px no-repeat local`,
  'radial-gradient(farthest-side at 50% 0, rgba(17,19,24,0.14), rgba(17,19,24,0)) top / 100% 9px no-repeat scroll',
  'radial-gradient(farthest-side at 50% 100%, rgba(17,19,24,0.14), rgba(17,19,24,0)) bottom / 100% 9px no-repeat scroll',
].join(', ');

const rotulo = { fontSize: 12, fontWeight: 800, letterSpacing: 0.8, textTransform: 'uppercase', color: LT.text3 };

export default function HojaTipoNuevo({ propios, conUso, onGuardar, onCerrar }) {
  const esCompu = useIsDesktop();
  const catalogo = useCatalogoDeIconos();
  const [nombre, setNombre] = useState('');
  const [color, setColor] = useState(COLORES_TIPO[0]);
  const [elegido, setElegido] = useState(null); // el ícono que escogió a mano; `null` = el que se sugiere por el nombre
  const [busqueda, setBusqueda] = useState('');
  const [categoria, setCategoria] = useState('todos');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const campoDelNombre = useRef(null);
  const rejilla = useRef(null);

  // En la compu el cursor ya está en el nombre; en el teléfono no: el teclado taparía la mitad de la hoja.
  useEffect(() => { if (esCompu) campoDelNombre.current?.focus(); }, [esCompu]);

  const sugerido = useMemo(() => sugiereIcono(catalogo, nombre), [catalogo, nombre]);
  const idActual = elegido ?? sugerido ?? ICONO_NEUTRO;
  const dibujo = catalogo?.porId.get(idActual) ?? null;
  const iconos = useMemo(() => buscaIconos(catalogo, busqueda, categoria), [catalogo, busqueda, categoria]);
  useEffect(() => { rejilla.current?.scrollTo?.(0, 0); }, [busqueda, categoria]);

  const limpio = nombre.trim();
  const guarda = async () => {
    if (!limpio || guardando) return;
    if (propios.some((t) => normaliza(t.nombre) === normaliza(limpio))) { setError('Ya tienes uno con ese nombre.'); return; }
    setGuardando(true);
    setError('');
    try {
      await onGuardar({ nombre: limpio, color, icono: idActual });
    } catch (e) {
      setError(e?.message || 'No se pudo guardar. Intenta de nuevo.');
    } finally {
      setGuardando(false);
    }
  };

  const botonDeGuardar = (
    <>
      {error && <div role="alert" style={{ marginBottom: 10, fontSize: 14, fontWeight: 700, color: LT.danger }}>{error}</div>}
      <button
        type="button" onClick={guarda} disabled={!limpio || guardando} className="kp-press"
        style={{
          width: '100%', minHeight: 54, border: 'none', borderRadius: 16, cursor: limpio && !guardando ? 'pointer' : 'default', display: 'flex', alignItems: 'center',
          justifyContent: 'center', gap: 9, fontFamily: FONT, fontSize: 16.5, fontWeight: 800, touchAction: 'manipulation',
          ...(limpio ? { background: `linear-gradient(140deg, ${KP.blue}, ${KP.blueDk})`, boxShadow: KP.shBtn, color: '#fff' } : { background: LT.surface2, color: LT.text3 }),
        }}
      >
        {guardando && <Loader2 size={18} className="spin" />} {conUso ? 'Guardar y usar' : 'Guardar'}
      </button>
    </>
  );

  return (
    <HojaFlotante titulo="Tipo nuevo" onCerrar={onCerrar} pie={botonDeGuardar}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, ...(esCompu ? null : { height: '100%' }) }}>
        {/* ---------- La vista previa: el cartel de «Hoy te toca» con el nombre encima ---------- */}
        <div
          style={{
            position: 'relative', overflow: 'hidden', isolation: 'isolate', borderRadius: 22, padding: '10px 14px 13px', color: '#fff', display: 'flex', flexDirection: 'column', gap: 9,
            background: 'linear-gradient(165deg, #1c3ad6 0%, #142a9e 52%, #0c1a66 100%)', boxShadow: '0 12px 26px rgba(14,30,120,0.28), inset 0 1px 0 rgba(255,255,255,0.18)', flexShrink: 0,
          }}
        >
          <span aria-hidden="true" style={{ position: 'absolute', inset: 0, zIndex: -1, pointerEvents: 'none', background: resplandor(color), transition: 'background 0.25s' }} />
          <span style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 8, padding: '4px 10px 4px 8px', borderRadius: 999, background: 'rgba(255,255,255,0.14)', fontSize: 11.5, fontWeight: 700 }}>
            <i aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: color, boxShadow: `0 0 0 3px rgba(255,255,255,0.18), 0 0 10px ${color}`, transition: 'background 0.25s' }} />
            Hoy te toca
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span
              aria-hidden="true"
              style={{ position: 'relative', width: 60, height: 60, flexShrink: 0, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.3)' }}
            >
              <span style={{ position: 'absolute', inset: -8, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.16)' }} />
              {dibujo ? <IconoSvg svg={dibujo.svg} size={27} strokeWidth={1.8} /> : <Tag size={27} strokeWidth={1.8} />}
            </span>
            <input
              ref={campoDelNombre} className="tl-tipo-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') guarda(); }}
              maxLength={40} autoComplete="off" placeholder="Nombre del tipo" aria-label="Nombre del tipo"
              style={{ flex: 1, minWidth: 0, width: '100%', background: 'transparent', border: 'none', borderBottom: '2px solid rgba(255,255,255,0.35)', borderRadius: 0, color: '#fff', font: `800 22px/1.15 ${FONT}`, letterSpacing: -0.5, padding: '4px 0 7px', outline: 'none' }}
            />
          </div>
        </div>

        {/* ---------- El color ---------- */}
        <div style={{ flexShrink: 0 }}>
          <div style={{ ...rotulo, marginBottom: 7 }}>Color</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 4 }}>
            {COLORES_TIPO.map((c) => (
              <button
                key={c} type="button" onClick={() => setColor(c)} aria-label={`Color ${c}`} aria-pressed={c === color}
                style={{
                  width: 30, height: 30, flex: 'none', padding: 0, borderRadius: '50%', cursor: 'pointer', background: c, display: 'grid', placeItems: 'center', touchAction: 'manipulation',
                  border: c === color ? `2.5px solid ${LT.text}` : '2.5px solid transparent', boxSizing: 'border-box',
                }}
              >
                {c === color && <Check size={14} color="#fff" strokeWidth={3.4} />}
              </button>
            ))}
          </div>
        </div>

        {/* ---------- El ícono: buscar, categorías y la rejilla ---------- */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, flex: esCompu ? 'none' : 1, minHeight: 0 }}>
          <div style={rotulo}>
            Ícono{dibujo ? <b style={{ marginLeft: 6, color: LT.text, letterSpacing: 0, textTransform: 'none', fontWeight: 800 }}>· {dibujo.nombre}</b> : null}
          </div>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <Search size={18} color={LT.text3} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            <input
              type="search" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} autoComplete="off" placeholder="Buscar: boxeo, pelota, nadar…" aria-label="Buscar un ícono"
              style={{ width: '100%', height: 46, boxSizing: 'border-box', padding: '0 14px 0 40px', border: `1.5px solid ${LT.border}`, borderRadius: 14, background: LT.surface, fontFamily: FONT, fontSize: 16, fontWeight: 600, color: LT.text, outline: 'none' }}
            />
          </div>
          <div
            role="group" aria-label="Categorías de íconos"
            style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none', padding: '2px 0', flexShrink: 0, WebkitMaskImage: 'linear-gradient(to right, #000 90%, transparent)', maskImage: 'linear-gradient(to right, #000 90%, transparent)' }}
          >
            {[{ id: 'todos', nombre: 'Todos' }, ...(catalogo?.categorias ?? [])].map((c) => (
              <button
                key={c.id} type="button" onClick={() => setCategoria(c.id)} aria-pressed={categoria === c.id}
                style={{
                  flex: 'none', minHeight: 36, padding: '0 14px', borderRadius: 999, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: FONT, fontSize: 13.5, fontWeight: 700, touchAction: 'manipulation',
                  ...(categoria === c.id ? { background: LT.text, border: `1.5px solid ${LT.text}`, color: '#fff' } : { background: LT.surface, border: `1.5px solid ${LT.border}`, color: LT.text2 }),
                }}
              >
                {c.nombre}
              </button>
            ))}
          </div>
          <div
            ref={rejilla}
            style={{
              display: 'grid', gridTemplateColumns: `repeat(${esCompu ? 9 : 6}, minmax(0, 1fr))`, gridAutoRows: 'min-content', gap: 7, overflowY: 'auto', padding: '6px 6px 14px', margin: '0 -6px',
              ...(esCompu ? { height: 238 } : { flex: 1, minHeight: 200 }), background: SOMBRAS_DE_SCROLL, WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain',
            }}
          >
            {!catalogo && <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 9, padding: '18px 6px', fontSize: 14.5, fontWeight: 600, color: LT.text2 }}><Loader2 size={17} className="spin" /> Cargando íconos…</div>}
            {catalogo && iconos.length === 0 && (
              <div style={{ gridColumn: '1 / -1', padding: '18px 6px', fontSize: 14.5, fontWeight: 500, color: LT.text2, lineHeight: 1.45 }}>
                No hay íconos con «{busqueda.trim()}». Prueba otra palabra o elige una categoría.
              </div>
            )}
            {iconos.map((ic) => {
              const puesto = ic.id === idActual;
              return (
                <button
                  key={ic.id} type="button" onClick={() => setElegido(ic.id)} title={ic.nombre} aria-label={ic.nombre} aria-pressed={puesto}
                  style={{
                    position: 'relative', aspectRatio: '1', padding: 0, borderRadius: 14, cursor: 'pointer', display: 'grid', placeItems: 'center', touchAction: 'manipulation',
                    border: `1.5px solid ${puesto ? LT.blue : LT.border}`, background: puesto ? LT.blueSoft : LT.surface, color: puesto ? LT.blue : LT.text,
                  }}
                >
                  <IconoSvg svg={ic.svg} size={24} />
                  {puesto && (
                    <span aria-hidden="true" style={{ position: 'absolute', right: -5, top: -5, width: 18, height: 18, borderRadius: '50%', background: LT.blue, display: 'grid', placeItems: 'center' }}>
                      <Check size={11} color="#fff" strokeWidth={3.6} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </HojaFlotante>
  );
}
