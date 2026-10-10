import { useCallback, useMemo, useState } from 'react';
import { LT, KP, FONT, NUM_STYLE } from '@/lib/theme';
import { ZONAS } from '@/lib/metricas/calculos';
import { duracionTexto } from '@/lib/metricas/formato';
import { COLORES_DE_ZONA, marcasNumericas, useAncho } from './graficasUtil';

/* Las GRÁFICAS de las métricas, dibujadas a mano en SVG (sin librería): así cada una se ve como debe y pesa casi nada.

   Reglas que se siguen en todas (de la guía de gráficas de la skill de diseño):
     · el color nunca va solo: cada zona y cada serie tiene su nombre escrito junto a la gráfica
     · las líneas de la cuadrícula son tenues; lo que importa (los datos) es lo que contrasta
     · lo que se puede tocar se puede tocar con el dedo: al arrastrar sobre la gráfica sale el valor exacto
     · cada gráfica lleva un texto (`descripcion`) para quien no la ve
   Se dibujan en píxeles reales (se mide el ancho del contenedor), no escaladas: el texto siempre sale nítido y del mismo tamaño. */

/* ------------------------------------------------------------------ */
/* Utilidades                                                          */
/* ------------------------------------------------------------------ */

const texto = { fontFamily: FONT, ...NUM_STYLE };
const GRIS = LT.text3;
const CUADRICULA = 'rgba(17,19,24,0.07)';

/** Un camino SVG de una lista de puntos [px, py] (los huecos `null` cortan la línea). */
function camino(puntos) {
  let d = '';
  let abierto = false;
  puntos.forEach((p) => {
    if (!p) { abierto = false; return; }
    d += `${abierto ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`;
    abierto = true;
  });
  return d;
}

/* ------------------------------------------------------------------ */
/* Línea (y área) sobre el tiempo                                      */
/* ------------------------------------------------------------------ */

/**
 * Una o varias series sobre un eje horizontal numérico (segundos, o días).
 *   series   `[{ id, nombre, color, puntos: [[x, y], …], ancho, discontinua, area, opacidadArea }]`
 *   x        `{ min, max, marcas: [{ v, etiqueta }] }`
 *   y        `{ min, max, marcas: [{ v, etiqueta }] }`
 *   bandas   `[{ y0, y1, color, etiqueta }]`: franjas horizontales (las zonas de pulso)
 *   lineasV  `[{ x, etiqueta }]`: separadores verticales (las vueltas)
 *   cero     dibuja la línea del cero (la forma)
 *   detalle  `(x) => { titulo, filas: [{ color, texto }] }`: lo que sale al tocar
 */
export function GraficaDeLinea({ series, x, y, bandas = [], lineasV = [], cero = false, altura = 220, detalle, descripcion, margen = { t: 10, r: 12, b: 24, l: 40 } }) {
  const [ref, ancho] = useAncho();
  const [cursor, setCursor] = useState(null);
  const w = Math.max(0, ancho - margen.l - margen.r);
  const h = altura - margen.t - margen.b;
  const px = useCallback((v) => margen.l + ((v - x.min) / (x.max - x.min || 1)) * w, [x.min, x.max, w, margen.l]);
  const py = useCallback((v) => margen.t + (1 - (v - y.min) / (y.max - y.min || 1)) * h, [y.min, y.max, h, margen.t]);

  const dibujadas = useMemo(() => series.map((s) => {
    const pts = s.puntos.map((p) => (p[1] === null || p[1] === undefined ? null : [px(p[0]), py(p[1])]));
    const d = camino(pts);
    const validos = pts.filter(Boolean);
    const area = s.area && validos.length > 1
      ? `${d}L${validos[validos.length - 1][0].toFixed(1)},${py(Math.max(y.min, 0)).toFixed(1)}L${validos[0][0].toFixed(1)},${py(Math.max(y.min, 0)).toFixed(1)}Z`
      : null;
    return { ...s, d, area };
  }), [series, px, py, y.min]);

  const alMover = (e) => {
    if (!detalle || !ancho) return;
    const caja = e.currentTarget.getBoundingClientRect();
    const xv = x.min + ((e.clientX - caja.left - margen.l) / (w || 1)) * (x.max - x.min);
    setCursor({ x: Math.min(x.max, Math.max(x.min, xv)), px: e.clientX - caja.left });
  };
  const info = cursor ? detalle(cursor.x) : null;
  // La posición del cursor se ajusta al punto más cercano de la primera serie para que la línea caiga sobre un dato.
  const base = series[0]?.puntos ?? [];
  let cercano = null;
  if (cursor && base.length) {
    let lo = 0; let hi = base.length - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (base[m][0] < cursor.x) lo = m + 1; else hi = m; }
    cercano = lo > 0 && Math.abs(base[lo - 1][0] - cursor.x) < Math.abs(base[lo][0] - cursor.x) ? base[lo - 1] : base[lo];
  }
  const xCursor = cercano ? px(cercano[0]) : null;

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%', height: altura }}>
      {ancho > 0 && (
        <svg
          width={ancho} height={altura} role="img" aria-label={descripcion}
          onPointerMove={alMover} onPointerDown={alMover} onPointerLeave={() => setCursor(null)} onPointerCancel={() => setCursor(null)}
          style={{ display: 'block', touchAction: 'pan-y', userSelect: 'none', overflow: 'visible' }}
        >
          {bandas.map((b, i) => (
            <g key={i}>
              <rect x={margen.l} y={py(Math.min(b.y1, y.max))} width={w} height={Math.max(0, py(Math.max(b.y0, y.min)) - py(Math.min(b.y1, y.max)))} fill={b.color} opacity="0.13" />
            </g>
          ))}
          {y.marcas.map((m) => (
            <g key={m.v}>
              <line x1={margen.l} x2={margen.l + w} y1={py(m.v)} y2={py(m.v)} stroke={CUADRICULA} />
              <text x={margen.l - 8} y={py(m.v) + 4} textAnchor="end" fontSize="11" fill={GRIS} style={texto}>{m.etiqueta}</text>
            </g>
          ))}
          {cero && y.min < 0 && y.max > 0 && <line x1={margen.l} x2={margen.l + w} y1={py(0)} y2={py(0)} stroke="rgba(17,19,24,0.35)" strokeWidth="1.2" />}
          {x.marcas.map((m) => (
            <text key={m.v} x={px(m.v)} y={altura - 6} textAnchor="middle" fontSize="11" fill={GRIS} style={texto}>{m.etiqueta}</text>
          ))}
          {lineasV.map((l, i) => <line key={i} x1={px(l.x)} x2={px(l.x)} y1={margen.t} y2={margen.t + h} stroke="rgba(17,19,24,0.16)" strokeDasharray="3 4" />)}
          {dibujadas.map((s) => s.area && <path key={`a${s.id}`} d={s.area} fill={s.color} opacity={s.opacidadArea ?? 0.14} />)}
          {dibujadas.map((s) => (
            <path key={s.id} d={s.d} fill="none" stroke={s.color} strokeWidth={s.ancho ?? 2} strokeLinejoin="round" strokeLinecap="round" strokeDasharray={s.discontinua ? '6 5' : undefined} />
          ))}
          {/* Los nombres de las franjas van ENCIMA de la línea, con un borde blanco, para que se lean aunque la línea pase por ahí. */}
          {bandas.map((b, i) => b.etiqueta && (
            <text key={`e${i}`} x={margen.l + 6} y={py(Math.min(b.y1, y.max)) + 12} fontSize="10.5" fontWeight="700" fill={b.color} stroke="rgba(255,255,255,0.9)" strokeWidth="3" strokeLinejoin="round" paintOrder="stroke" pointerEvents="none" style={texto}>{b.etiqueta}</text>
          ))}
          {cursor && cercano && (
            <g pointerEvents="none">
              <line x1={xCursor} x2={xCursor} y1={margen.t} y2={margen.t + h} stroke="rgba(17,19,24,0.45)" />
              {dibujadas.map((s) => {
                const p = s.puntos.reduce((mejor, q) => (q[1] !== null && q[1] !== undefined && (!mejor || Math.abs(q[0] - cercano[0]) < Math.abs(mejor[0] - cercano[0])) ? q : mejor), null);
                return p ? <circle key={s.id} cx={px(p[0])} cy={py(p[1])} r="4.5" fill="#fff" stroke={s.color} strokeWidth="2.2" /> : null;
              })}
            </g>
          )}
        </svg>
      )}
      {info && cercano && (
        <div
          role="status"
          style={{
            position: 'absolute', top: 4, left: Math.min(Math.max(8, xCursor - 70), Math.max(8, ancho - 150)), minWidth: 130, pointerEvents: 'none', zIndex: 2,
            background: 'rgba(17,19,24,0.92)', color: '#fff', borderRadius: 12, padding: '8px 11px', fontFamily: FONT, boxShadow: KP.shPop,
          }}
        >
          <div style={{ fontSize: 11.5, fontWeight: 700, opacity: 0.75, ...NUM_STYLE }}>{info.titulo}</div>
          {info.filas.map((f, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 800, marginTop: i === 0 ? 3 : 1, ...NUM_STYLE }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: f.color, flexShrink: 0 }} />{f.texto}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Una gráfica de un solo trazo, chiquita, sin ejes: para ver la tendencia dentro de una tarjeta. */
export function Chispa({ valores, color = LT.blue, ancho = 96, alto = 28 }) {
  const limpios = valores.filter((v) => typeof v === 'number');
  if (limpios.length < 2) return null;
  const min = Math.min(...limpios);
  const max = Math.max(...limpios);
  const pts = valores.map((v, i) => (typeof v === 'number' ? [(i / (valores.length - 1)) * (ancho - 4) + 2, alto - 3 - ((v - min) / (max - min || 1)) * (alto - 6)] : null));
  return (
    <svg width={ancho} height={alto} aria-hidden="true" style={{ display: 'block', overflow: 'visible' }}>
      <path d={camino(pts)} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Barras apiladas                                                     */
/* ------------------------------------------------------------------ */

/**
 * Barras (una por semana, por ejemplo), cada una apilada en partes de colores (las zonas).
 *   barras   `[{ clave, etiqueta, partes: [{ valor, color, nombre }], marca? }]`; `marca`: se resalta (la semana de hoy)
 *   formato  cómo se dice un valor en el eje y en lo que sale al tocar («2 h 10 min»)
 */
export function BarrasApiladas({ barras, formato = (v) => String(Math.round(v)), altura = 200, descripcion, alElegir, elegida = null }) {
  const [ref, ancho] = useAncho();
  const [foco, setFoco] = useState(null);
  const margen = { t: 12, r: 8, b: 26, l: 44 };
  const totales = barras.map((b) => b.partes.reduce((s, p) => s + p.valor, 0));
  const max = Math.max(1, ...totales);
  const marcas = marcasNumericas(0, max, 4);
  const techo = marcas[marcas.length - 1] > max ? marcas[marcas.length - 1] : max;
  const w = Math.max(0, ancho - margen.l - margen.r);
  const h = altura - margen.t - margen.b;
  const paso = barras.length ? w / barras.length : 0;
  const grosor = Math.min(34, Math.max(6, paso * 0.62));
  const py = (v) => margen.t + (1 - v / techo) * h;
  const activa = foco ?? elegida;
  return (
    <div ref={ref} style={{ position: 'relative', width: '100%', height: altura }}>
      {ancho > 0 && (
        <svg width={ancho} height={altura} role="img" aria-label={descripcion} style={{ display: 'block', overflow: 'visible' }}>
          {marcas.map((m) => (
            <g key={m}>
              <line x1={margen.l} x2={margen.l + w} y1={py(m)} y2={py(m)} stroke={CUADRICULA} />
              <text x={margen.l - 8} y={py(m) + 4} textAnchor="end" fontSize="11" fill={GRIS} style={texto}>{formato(m, true)}</text>
            </g>
          ))}
          {barras.map((b, i) => {
            const cx = margen.l + paso * i + paso / 2;
            let acumulado = 0;
            const esActiva = activa === i;
            return (
              <g
                key={b.clave} style={{ cursor: alElegir ? 'pointer' : 'default' }}
                onPointerEnter={() => setFoco(i)} onPointerLeave={() => setFoco(null)} onClick={() => alElegir?.(i)}
              >
                <rect x={cx - paso / 2} y={margen.t} width={paso} height={h + 4} fill="transparent" />
                {esActiva && <rect x={cx - paso / 2 + 1} y={margen.t} width={paso - 2} height={h} rx="8" fill="rgba(30,64,224,0.06)" />}
                {b.partes.map((p, k) => {
                  if (!(p.valor > 0)) return null;
                  const y1 = py(acumulado + p.valor);
                  const y0 = py(acumulado);
                  acumulado += p.valor;
                  const ultima = b.partes.slice(k + 1).every((q) => !(q.valor > 0));
                  return <rect key={k} x={cx - grosor / 2} y={y1} width={grosor} height={Math.max(0, y0 - y1)} fill={p.color} rx={ultima ? 4 : 0} />;
                })}
                {(i % Math.ceil(barras.length / Math.max(1, Math.floor(w / 46))) === 0 || b.marca) && (
                  <text x={cx} y={altura - 7} textAnchor="middle" fontSize="11" fontWeight={b.marca ? 800 : 500} fill={b.marca ? LT.blue : GRIS} style={texto}>{b.etiqueta}</text>
                )}
              </g>
            );
          })}
        </svg>
      )}
      {foco !== null && barras[foco] && (
        <div
          role="status"
          style={{
            position: 'absolute', top: 0, left: Math.min(Math.max(4, margen.l + paso * foco + paso / 2 - 80), Math.max(4, ancho - 170)), width: 160, pointerEvents: 'none', zIndex: 2,
            background: 'rgba(17,19,24,0.92)', color: '#fff', borderRadius: 12, padding: '8px 11px', fontFamily: FONT, boxShadow: KP.shPop,
          }}
        >
          <div style={{ fontSize: 11.5, fontWeight: 700, opacity: 0.75 }}>{barras[foco].etiqueta}</div>
          <div style={{ fontSize: 14, fontWeight: 800, ...NUM_STYLE }}>{formato(totales[foco])}</div>
          {barras[foco].partes.filter((p) => p.valor > 0 && barras[foco].partes.length > 1).map((p, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, marginTop: 1, ...NUM_STYLE }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: p.color }} />{p.nombre}: {formato(p.valor)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Zonas                                                               */
/* ------------------------------------------------------------------ */

/**
 * El tiempo en cada zona como UNA barra horizontal partida, con la lista debajo (zona, nombre, tiempo y por ciento): las zonas se leen por sus nombres, no
 * solo por el color.
 */
export function BarraDeZonas({ segundos, fcMax = null, compacta = false }) {
  const total = segundos.reduce((s, v) => s + (v || 0), 0);
  if (!(total > 0)) return <div style={{ fontSize: 13.5, color: LT.text2, fontWeight: 600 }}>Sin pulso medido en este entreno.</div>;
  const limites = fcMax ? ZONAS.slice(0, 4).map((z) => Math.round(fcMax * z.hasta)) : null;
  const rango = (i) => (!limites ? '' : i === 0 ? `< ${limites[0]}` : i === 4 ? `> ${limites[3]}` : `${limites[i - 1]}–${limites[i]}`);
  return (
    <div>
      <div role="img" aria-label={`Tiempo en zonas: ${segundos.map((s, i) => `zona ${i + 1}, ${Math.round((s / total) * 100)} %`).join('; ')}`} style={{ display: 'flex', height: compacta ? 10 : 16, borderRadius: 8, overflow: 'hidden', gap: 2 }}>
        {segundos.map((s, i) => s > 0 && <div key={i} style={{ flex: s, background: COLORES_DE_ZONA[i], minWidth: 3 }} />)}
      </div>
      {!compacta && (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 7 }}>
          {ZONAS.map((z, i) => (
            <div key={z.z} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13.5, fontWeight: 600, color: LT.text, ...NUM_STYLE }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: COLORES_DE_ZONA[i], flexShrink: 0 }} />
              <span style={{ width: 22, fontWeight: 800 }}>Z{z.z}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                {z.nombre}
                {rango(i) && <span className="block sm:inline" style={{ color: LT.text3, fontWeight: 500, fontSize: 12.5 }}><span className="hidden sm:inline"> · </span>{rango(i)} lpm</span>}
              </span>
              <span style={{ fontWeight: 800 }}>{duracionTexto(segundos[i])}</span>
              <span style={{ width: 40, textAlign: 'right', color: LT.text2 }}>{Math.round((segundos[i] / total) * 100)} %</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Ruta                                                                */
/* ------------------------------------------------------------------ */

/**
 * La ruta de un entreno dibujada sola (sin mapa de fondo: no hay terceros ni permisos), con la salida (azul) y la llegada (negra).
 * `lat` y `lon` son listas del mismo largo.
 */
export function RutaEnMapa({ lat, lon, alto = 200 }) {
  const [ref, ancho] = useAncho();
  const forma = useMemo(() => {
    if (!lat?.length || lat.length !== lon?.length) return null;
    const lat0 = lat.reduce((s, v) => s + v, 0) / lat.length;
    const k = Math.cos((lat0 * Math.PI) / 180);
    const xs = lon.map((v) => v * k);
    const minX = Math.min(...xs); const maxX = Math.max(...xs);
    const minY = Math.min(...lat); const maxY = Math.max(...lat);
    return { xs, minX, maxX, minY, maxY, ancho: maxX - minX || 1e-6, alto: maxY - minY || 1e-6 };
  }, [lat, lon]);
  if (!forma) return null;
  const pad = 18;
  const area = { w: Math.max(40, ancho - pad * 2), h: alto - pad * 2 };
  const escala = Math.min(area.w / forma.ancho, area.h / forma.alto);
  const ox = pad + (area.w - forma.ancho * escala) / 2;
  const oy = pad + (area.h - forma.alto * escala) / 2;
  const pts = forma.xs.map((x, i) => [ox + (x - forma.minX) * escala, oy + (forma.maxY - lat[i]) * escala]);
  const ini = pts[0];
  const fin = pts[pts.length - 1];
  return (
    <div ref={ref} style={{ width: '100%', height: alto, borderRadius: 16, background: 'linear-gradient(160deg, #EEF2FB, #F6F8FC)', border: `1px solid ${LT.border}`, overflow: 'hidden' }}>
      {ancho > 0 && (
        <svg width={ancho} height={alto} role="img" aria-label="Ruta del entreno" style={{ display: 'block' }}>
          <path d={camino(pts)} fill="none" stroke="#fff" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
          <path d={camino(pts)} fill="none" stroke={LT.blue} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx={ini[0]} cy={ini[1]} r="6" fill={LT.mint} stroke="#fff" strokeWidth="2.5" />
          <circle cx={fin[0]} cy={fin[1]} r="6" fill={LT.text} stroke="#fff" strokeWidth="2.5" />
        </svg>
      )}
    </div>
  );
}

