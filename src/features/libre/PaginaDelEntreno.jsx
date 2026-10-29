import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronLeft, MoreHorizontal, Trophy, Upload, Watch } from 'lucide-react';
import { LT, FONT, NUM_STYLE, KP, UI } from '@/lib/theme';
import IconoDeTipo from '@/components/IconoDeTipo';
import '@/features/stickers/stickers.css';
import MapaDeCarrera from './MapaDeCarrera';
import { botonGrande } from './estilosLibre';

/* LA PÁGINA DE UN ENTRENO (fase 7 de los stickers, 29 oct 2026; prototipo de caminos https://claude.ai/artifact/EFSp16EiF1rVYb5U7emtNE). La MISMA para un entreno libre
   (`ResumenLibre`) y para un workout del plan (`ResumenDeSesion`): cada una solo le dice qué números y qué secciones lleva.

   · Arriba: el mapa a 250 px si hubo ruta; si no, una franja de 200 px del color suave del tipo con su ícono grande. Encima, «‹» y «···» redondos y blancos.
   · La tarjeta, montada sobre el mapa: una línea gris («Hoy, 9:39 a. m.», en el plan «· de @coach»), el nombre, el número protagonista con su unidad chica,
     la frase que dice qué significa y la fila de secundarios (`lib/paginaDelEntreno.js`). Si el pulso vino del reloj, «Lo midió tu Apple Watch».
   · El récord en su propia fila, debajo (cuadro ámbar con trofeo). Luego `debajo` (la tarjeta de stickers y lo del reloj) y las secciones (`children`).
   · Al bajar, una barra arriba con el nombre; los botones redondos pierden la sombra. «Compartir» fijo abajo, con la flecha hacia arriba.
   Color solo con significado: azul lo que se toca, rojo el pulso, ámbar el récord. Sombra solo en lo que flota (los botones del mapa, «Compartir», la hoja).

   `ruta`: las muestras (si hubo recorrido). `actividad`: `{ nombre, icono, color }` (la franja y su ícono). `meta`: la línea gris. `heroe`: `{ valor, unidad, etiqueta }`.
   `secundarios`: `[{ valor, unidad, etiqueta, pulso? }]`. `delReloj`: el pulso lo midió el Apple Watch. `record`: `{ titulo, sub }`. `opciones`: lo de «···»
   (`[{ texto, onClick, peligro? }]`; vacío = sin «···»). `encima`: lo que se abre sobre la página (la hoja de stickers, el menú). */

const ALTO_MAPA = 250;
const ALTO_FRANJA = 200;
const COLUMNA = { maxWidth: 560, margin: '0 auto', width: '100%' };
const NUMERO = { fontFamily: "'Bricolage Grotesque', 'Inter', -apple-system, system-ui, sans-serif", fontVariationSettings: "'opsz' 96", fontWeight: 800, ...NUM_STYLE };

/** El número protagonista, grande, con su unidad chica pegada. */
function Heroe({ heroe }) {
  return (
    <div aria-label={`${heroe.etiqueta}: ${heroe.valor} ${heroe.unidad}`} style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 16, letterSpacing: '-0.04em', lineHeight: 0.92, color: LT.text, flexWrap: 'wrap' }}>
      <b style={{ ...NUMERO, fontSize: heroe.valor.length > 6 ? 54 : 68 }}>{heroe.valor}</b>
      {heroe.unidad && <small style={{ fontFamily: FONT, fontSize: 22, fontWeight: 700, letterSpacing: -0.2, color: LT.text2 }}>{heroe.unidad}</small>}
    </div>
  );
}

/** Un secundario: el número con su unidad chica y su etiqueta debajo. El pulso, en rojo. */
function Secundario({ valor, unidad, etiqueta, pulso }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.1, letterSpacing: -0.4, whiteSpace: 'nowrap', color: pulso ? '#E5364F' : LT.text, ...NUM_STYLE }}>
        {valor}{unidad && <small style={{ fontSize: 13, fontWeight: 700, color: LT.text2, marginLeft: 2, letterSpacing: 0 }}>{unidad}</small>}
      </div>
      <div style={{ marginTop: 3, fontSize: 12.5, fontWeight: 600, color: LT.text2 }}>{etiqueta}</div>
    </div>
  );
}

/** Una sección de la página: un título que es una pregunta contestada («Por kilómetro», «Tu pulso») y su detalle. */
export function Seccion({ titulo, sub, children, estilo }) {
  return (
    <section style={{ margin: '12px 12px 0', background: LT.surface, borderRadius: 22, padding: '16px 18px', ...estilo }}>
      {titulo && <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: LT.text }}>{titulo}</h2>}
      {sub && <p style={{ margin: '2px 0 12px', fontSize: 13.5, fontWeight: 500, color: LT.text2, lineHeight: 1.4, ...NUM_STYLE }}>{sub}</p>}
      {children}
    </section>
  );
}

/** «Por kilómetro»: una barra por km; el más rápido en azul, y la frase que lo dice. `kms`: `[{ n, paso, dist }]` (paso en s/km). `enBici`: en km/h. */
export function PorKilometro({ kms, enBici = false, texto }) {
  if (!kms?.length) return null;
  const rapido = Math.min(...kms.map((k) => k.paso));
  const lento = Math.max(...kms.map((k) => k.paso));
  const iRapido = kms.findIndex((k) => k.paso === rapido);
  return (
    <Seccion titulo="Por kilómetro" sub={`El más rápido fue el km ${kms[iRapido].n}, a ${texto(rapido)}${enBici ? ' km/h' : ''}.`}>
      <div style={{ display: 'grid', gap: 8 }}>
        {kms.map((k, i) => {
          const ancho = lento === rapido ? 100 : Math.round(42 + (58 * (lento - k.paso)) / (lento - rapido));
          const azul = i === iRapido;
          return (
            <div key={k.n} style={{ display: 'grid', gridTemplateColumns: '44px 1fr 54px', alignItems: 'center', gap: 10, fontSize: 13.5, fontWeight: 600, ...NUM_STYLE }}>
              <span style={{ color: LT.text2, whiteSpace: 'nowrap' }}>km {k.n}{k.dist < 990 ? <small style={{ fontSize: 11 }}> · {(k.dist / 1000).toFixed(2)}</small> : null}</span>
              <span style={{ height: 10, borderRadius: 99, background: '#F1F2F5', overflow: 'hidden' }}>
                <span style={{ display: 'block', height: '100%', width: `${ancho}%`, borderRadius: 99, background: azul ? KP.blue : '#C9CFDB' }} />
              </span>
              <span style={{ textAlign: 'right', color: azul ? KP.blue : LT.text, fontWeight: azul ? 800 : 600 }}>{texto(k.paso)}</span>
            </div>
          );
        })}
      </div>
    </Seccion>
  );
}

/** «Tu pulso»: fácil, medio y duro en una barra con sus por cientos (`zonas`: lo de `zonasSimples`), con el medio y el máximo. */
export function TuPulso({ media, maximo, zonas, deReloj = true }) {
  if (!(media > 0)) return null;
  const sub = `Medio ${media} lpm${maximo > 0 ? ` · máximo ${maximo} lpm` : ''}.${deReloj ? ' Lo midió tu Apple Watch.' : ''}`;
  return (
    <Seccion titulo="Tu pulso" sub={sub}>
      {zonas && (
        <>
          <div style={{ display: 'flex', height: 12, borderRadius: 99, overflow: 'hidden', gap: 2 }}>
            {[['#9DB4FF', zonas[0]], ['#F5B544', zonas[1]], ['#E5364F', zonas[2]]].map(([c, p]) => (p > 0 ? <i key={c} style={{ display: 'block', height: '100%', width: `${p}%`, background: c }} /> : null))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12.5, fontWeight: 600, color: LT.text2, ...NUM_STYLE }}>
            <span>Fácil {zonas[0]} %</span><span>Medio {zonas[1]} %</span><span>Duro {zonas[2]} %</span>
          </div>
        </>
      )}
    </Seccion>
  );
}

/** «Lo que hiciste»: cada ejercicio, lo programado y «4/4» (trofeo ámbar en el del récord). `ejercicios`: lo de `ejerciciosDeLaSesion`. */
export function LoQueHiciste({ ejercicios, sub, recordEn = null }) {
  if (!ejercicios?.length) return null;
  return (
    <Seccion titulo="Lo que hiciste" sub={sub}>
      <div>
        {ejercicios.map((e, i) => {
          const completo = e.hechas >= e.programadas;
          const record = recordEn && e.nombre === recordEn;
          return (
            <div key={`${e.nombre}-${i}`} style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 10, padding: '11px 0', borderTop: i ? `1px solid ${UI.hilo}` : 'none' }}>
              <span style={{ minWidth: 0 }}>
                <b style={{ display: 'block', fontSize: 15, color: LT.text, overflowWrap: 'anywhere' }}>{e.nombre}</b>
                <span style={{ display: 'block', fontSize: 13, color: LT.text2, marginTop: 1, ...NUM_STYLE }}>{e.programado}</span>
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 800, color: record ? '#8A5A00' : completo ? '#047857' : LT.text2, ...NUM_STYLE }}>
                {record ? <Trophy size={15} /> : completo ? <Check size={15} strokeWidth={2.8} /> : null}{e.hechas}/{e.programadas}
              </span>
            </div>
          );
        })}
      </div>
    </Seccion>
  );
}

/** «Tu nota»: lo que escribe para su coach («La ve Andrés»). Se guarda al salir del campo (`alGuardar(texto)`). */
export function TuNota({ nota, coach, alGuardar }) {
  const [texto, setTexto] = useState(nota ?? '');
  const guardado = useRef(nota ?? '');
  const guarda = () => { if (texto.trim() !== guardado.current.trim()) { guardado.current = texto; alGuardar?.(texto.trim()); } };
  return (
    <Seccion titulo="Tu nota" sub={coach ? `La ve ${coach}.` : 'Solo la ves tú y quien te entrena.'}>
      <textarea
        aria-label="Tu nota" value={texto} onChange={(e) => setTexto(e.target.value)} onBlur={guarda} rows={3}
        placeholder="Cómo te sentiste, qué ajustarías…"
        style={{ display: 'block', width: '100%', boxSizing: 'border-box', border: 'none', borderRadius: 14, background: '#F4F5F8', padding: '12px 14px', fontFamily: FONT, fontSize: 16, lineHeight: 1.45, color: LT.text, resize: 'none', outline: 'none' }}
      />
    </Seccion>
  );
}

/** El récord, en su propia fila: cuadro ámbar con trofeo, lo que rompió y contra qué se compara. */
function FilaDeRecord({ titulo, sub }) {
  return (
    <section style={{ margin: '12px 12px 0', background: LT.surface, borderRadius: 22, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <span aria-hidden="true" style={{ width: 38, height: 38, borderRadius: 12, background: '#FFF4D6', color: '#8A5A00', display: 'grid', placeItems: 'center', flex: 'none' }}><Trophy size={18} /></span>
      <span style={{ minWidth: 0 }}>
        <b style={{ display: 'block', fontSize: 15, lineHeight: 1.3, color: LT.text, ...NUM_STYLE }}>{titulo}</b>
        {sub && <span style={{ display: 'block', fontSize: 13, color: LT.text2, marginTop: 2, lineHeight: 1.4, ...NUM_STYLE }}>{sub}</span>}
      </span>
    </section>
  );
}

/** Un botón redondo blanco sobre el mapa. Al bajar la página, pierde la sombra y queda gris. */
const redondo = (lado, subio) => ({
  position: 'absolute', top: 'calc(8px + env(safe-area-inset-top))', [lado]: 14, zIndex: 3, width: 44, height: 44, borderRadius: '50%', border: 'none',
  background: subio ? UI.relleno : '#fff', color: LT.text, display: 'grid', placeItems: 'center', cursor: 'pointer', touchAction: 'manipulation',
  boxShadow: subio ? 'none' : '0 2px 10px rgba(17,19,24,0.16)', transition: 'background .2s ease, box-shadow .2s ease',
});

export default function PaginaDelEntreno({
  nombre, meta, ruta = null, actividad = null, heroe = null, frase = null, secundarios = [], delReloj = false, record = null,
  debajo = null, children, opciones = [], alCerrar, alCompartir, error = null, encima = null,
}) {
  const caja = useRef(null);
  const [subio, setSubio] = useState(false);
  useEffect(() => {
    const el = caja.current;
    if (!el) return undefined;
    const alBajar = () => setSubio(el.scrollTop > 110);
    el.addEventListener('scroll', alBajar, { passive: true });
    return () => el.removeEventListener('scroll', alBajar);
  }, []);
  const [menu, setMenu] = useState(false);
  const color = actividad?.color ?? KP.blue;
  const opcion = { display: 'block', width: '100%', minHeight: 56, border: 'none', background: 'transparent', fontFamily: FONT, fontSize: 17, fontWeight: 600, color: LT.text, cursor: 'pointer' };

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={nombre} style={{ position: 'fixed', inset: 0, zIndex: 3200, background: LT.bg, fontFamily: FONT }}>
      {/* La barra que aparece al bajar, con el nombre del entreno. */}
      <div aria-hidden="true" style={{
        position: 'absolute', left: 0, right: 0, top: 0, zIndex: 2, height: 'calc(62px + env(safe-area-inset-top))', display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        padding: '0 72px 19px', boxSizing: 'border-box', background: 'rgba(242,243,247,0.94)', WebkitBackdropFilter: 'blur(14px)', backdropFilter: 'blur(14px)', borderBottom: `1px solid ${UI.hilo}`,
        fontSize: 16, fontWeight: 800, color: LT.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', opacity: subio ? 1 : 0, transition: 'opacity .2s ease', pointerEvents: 'none',
      }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{nombre}</span>
      </div>
      <button type="button" onClick={alCerrar} aria-label="Volver" className="kp-press" style={redondo('left', subio)}><ChevronLeft size={22} /></button>
      {opciones.length > 0 && (
        <button type="button" onClick={() => setMenu(true)} aria-label="Más opciones" className="kp-press" style={redondo('right', subio)}><MoreHorizontal size={22} /></button>
      )}

      <div ref={caja} style={{ position: 'absolute', inset: 0, overflowY: 'auto', overscrollBehavior: 'contain' }}>
        <div style={{ ...COLUMNA, paddingBottom: 'calc(110px + env(safe-area-inset-bottom))' }}>
          {ruta ? (
            <div style={{ height: ALTO_MAPA, overflow: 'hidden', background: '#E7ECE6' }}>
              <MapaDeCarrera muestras={ruta} sigue={false} alto="100%" redondo={false} />
            </div>
          ) : (
            <div style={{ height: ALTO_FRANJA, background: '#fff' }}>
              <div style={{ height: '100%', display: 'grid', placeItems: 'center', background: `${color}1F`, paddingTop: 'env(safe-area-inset-top)', boxSizing: 'border-box' }}>
                <span aria-hidden="true" style={{ width: 96, height: 96, borderRadius: 30, background: 'rgba(255,255,255,0.65)', color, display: 'grid', placeItems: 'center' }}>
                  <IconoDeTipo id={actividad?.icono ?? null} nombre={actividad?.nombre ?? ''} size={46} />
                </span>
              </div>
            </div>
          )}

          {/* La tarjeta, montada sobre el mapa. */}
          <div style={{ position: 'relative', margin: '-30px 12px 0', background: LT.surface, borderRadius: 26, padding: '20px 20px 18px' }}>
            {meta && <div style={{ fontSize: 13.5, fontWeight: 600, color: LT.text2, ...NUM_STYLE }}>{meta}</div>}
            <h1 style={{ margin: '3px 0 0', fontSize: 25, fontWeight: 800, lineHeight: 1.15, letterSpacing: -0.5, color: LT.text, overflowWrap: 'break-word', textWrap: 'balance' }}>{nombre}</h1>
            {heroe && <Heroe heroe={heroe} />}
            {frase && <p style={{ margin: '10px 0 0', fontSize: 15.5, fontWeight: 500, lineHeight: 1.45, color: LT.text2, textWrap: 'pretty' }}>{frase}</p>}
            {secundarios.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${secundarios.length}, minmax(0, 1fr))`, gap: 12, marginTop: 18, paddingTop: 16, borderTop: `1px solid ${UI.hilo}` }}>
                {secundarios.map((s) => <Secundario key={s.etiqueta} {...s} />)}
              </div>
            )}
            {delReloj && <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, fontSize: 12.5, fontWeight: 600, color: LT.text2 }}><Watch size={14} />Lo midió tu Apple Watch</div>}
          </div>

          {record && <FilaDeRecord {...record} />}
          {error && <div role="alert" style={{ margin: '12px 16px 0', fontSize: 14, fontWeight: 600, color: '#B42318' }}>{error}</div>}
          {debajo && <div style={{ display: 'grid', gap: 12, margin: '12px 12px 0' }}>{debajo}</div>}
          {children}
        </div>
      </div>

      {/* «Compartir» fijo abajo: siempre a la mano, por largo que sea el entreno. */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 2, padding: '14px 16px calc(10px + env(safe-area-inset-bottom))', background: `linear-gradient(180deg, rgba(244,245,248,0), ${LT.bg} 30%)` }}> {/* estilo-ok: el fondo se desvanece detrás del botón que flota, para que se vea que la página sigue */}
        <div style={COLUMNA}>
          <button type="button" onClick={alCompartir} className="kp-press" style={botonGrande()}><Upload size={19} /> Compartir</button>
        </div>
      </div>

      {menu && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 3260, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div onClick={() => setMenu(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.42)' }} />
          <div role="dialog" aria-label="Opciones del entreno" style={{ position: 'relative', display: 'grid', gap: 8, padding: '0 10px calc(10px + env(safe-area-inset-bottom))', ...COLUMNA, boxSizing: 'border-box' }}>
            <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden' }}>
              {opciones.map((o, i) => (
                <button key={o.texto} type="button" autoFocus={i === 0} onClick={() => { setMenu(false); o.onClick(); }} style={{ ...opcion, borderTop: i ? `1px solid ${UI.hilo}` : 'none', color: o.peligro ? '#D92D20' : LT.text }}>{o.texto}</button>
              ))}
            </div>
            <button type="button" onClick={() => setMenu(false)} style={{ ...opcion, background: '#fff', borderRadius: 16, fontWeight: 700 }}>Cancelar</button>
          </div>
        </div>
      )}
      {encima}
    </div>,
    document.body,
  );
}
