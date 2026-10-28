import { useId } from 'react';
import IconoDeTipo from '@/components/IconoDeTipo';
import { fraseCorta, fraseLarga, ordinal } from '@/lib/stickers/catalogo';
import { ritmoTexto } from '@/lib/metricas/formato';
import { ajustaRuta, perfilReducido, tramoDe } from '@/lib/stickers/ruta';

/* LO QUE VA DENTRO DE CADA STICKER (los 35 de la tabla; ver docs/stickers.md y el prototipo de Andrés, de donde sale cada medida).
   Todo en la tinta (`currentColor`) y el acento (`--stk-acento`) del color elegido. Los números marcados `k-fit` bajan de tamaño hasta caber (`Sticker.jsx`).
   El wordmark TrainingLab cierra cada uno. Los textos van en inglés; el nombre del tipo, como lo escribió el coach. */

const FUENTE = "'Bricolage Grotesque', sans-serif";
const ACENTO = 'var(--stk-acento)';
const DIAS = 'MTWTFSS'; // estilo-ok: las iniciales de los días en inglés (texto del sticker)
const px = (n) => Number(n).toFixed(1);
// Entre dato y dato de «Ruta escrita»: cuatro espacios que no se juntan.
const HUECO = '\u00a0\u00a0\u00a0\u00a0';
const linea = (pts) => pts.map(([x, y]) => `${px(x)},${px(y)}`).join(' ');

const Valor = ({ d, px: tam, className = '', style }) => (
  <div className={`k-v k-fit ${className}`} style={{ fontSize: tam, ...style }}>
    {d.v}{d.u ? <span className="u">{d.u}</span> : null}
  </div>
);
const Etiqueta = ({ children, style }) => <div className="k-l" style={style}>{children}</div>;
const Marca = ({ px: tam = 14, style }) => <div className="k-wm" style={{ fontSize: tam, ...style }}>Training<span>Lab</span></div>;
const Rejilla = ({ datos, cols, px: tam, style }) => (
  <div className="k-rej" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, ...style }}>
    {datos.map((d) => <div key={d.k ?? d.l}><Valor d={d} px={tam} /><Etiqueta>{d.l}</Etiqueta></div>)}
  </div>
);
// Un dato y su nombre en la misma línea: «5.00km ........ Distance».
const Renglon = ({ d, px: tam, etiqueta, style }) => <div className="k-fr" style={style}><Valor d={d} px={tam} /><Etiqueta>{etiqueta ?? d.l}</Etiqueta></div>;
const Icono = ({ tipo, size, sw = 2, style }) => (
  <span className="k-ic" role="img" aria-label={tipo.nombre} style={style}><IconoDeTipo id={tipo.icono} nombre={tipo.nombre} size={size} strokeWidth={sw} /></span>
);

/** Los puntos de la ruta dentro de un cuadro, con su margen (la línea no toca el borde). */
const puntos = (ruta, ancho, alto, margen) => ajustaRuta(ruta.lat, ruta.lon, ancho, alto, margen);

/** La ruta: una línea de la tinta con puntas redondas y un punto del acento al final. */
function Ruta({ ruta, ancho, alto, grosor = 5, color }) {
  const pts = puntos(ruta, ancho, alto, grosor * 2);
  if (!pts) return null;
  const fin = pts[pts.length - 1];
  return (
    <svg width={ancho} height={alto} viewBox={`0 0 ${ancho} ${alto}`} aria-hidden="true">
      <polyline points={linea(pts)} fill="none" stroke={color.tinta} strokeWidth={grosor} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={px(fin[0])} cy={px(fin[1])} r={px(grosor * 1.25)} fill={color.acento} />
    </svg>
  );
}

/** «Tu mejor kilómetro»: la ruta con el kilómetro más rápido en el acento. */
function MejorKm({ f, color }) {
  const sp = f.splits;
  const k = sp.indexOf(Math.min(...sp));
  const pts = puntos(f.ruta, 248, 170, 10);
  if (!pts) return null;
  const tramo = tramoDe(pts, k / sp.length, (k + 1) / sp.length);
  const fin = pts[pts.length - 1];
  return (
    <>
      <svg width="248" height="170" viewBox="0 0 248 170" aria-label="Route with the fastest kilometer">
        <polyline points={linea(pts)} fill="none" stroke={color.tinta} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points={linea(tramo)} fill="none" stroke={color.acento} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={px(fin[0])} cy={px(fin[1])} r="6" fill={color.acento} />
      </svg>
      <div style={{ marginTop: 14, width: '100%' }}><Valor d={{ v: ritmoTexto(sp[k]), u: '/km' }} px={50} /></div>
      <Etiqueta style={{ marginTop: 6 }}>Fastest km, the {ordinal(k + 1)}</Etiqueta>
      <Marca style={{ marginTop: 18 }} />
    </>
  );
}

/** «Parciales»: una barra por kilómetro; la del más rápido, en el acento y con su ritmo encima. */
function Parciales({ f, r, color }) {
  const s = f.splits;
  const mn = Math.min(...s);
  const mx = Math.max(...s);
  // Cabe en el sticker ancho (200 de alto) aun con 12 kilómetros: barras de 22 a 60 px.
  const W = 22;
  const G = s.length > 8 ? 4 : 7;
  const H = 60;
  const ancho = s.length * (W + G) - G;
  return (
    <>
      <Renglon d={r.r} px={40} etiqueta="Avg pace" />
      <svg width={ancho} height={H + 18} viewBox={`0 0 ${ancho} ${H + 18}`} style={{ marginTop: 14 }} aria-label="Pace per kilometer">
        {s.map((v, i) => {
          const h = 22 + ((mx - v) / ((mx - mn) || 1)) * (H - 22 - 14);
          const x = i * (W + G);
          const y = H - h;
          const rapido = v === mn;
          return (
            <g key={i}>
              <rect x={x} y={px(y)} width={W} height={px(h)} rx="6" fill={rapido ? color.acento : color.tinta} opacity={rapido ? 1 : 0.9} />
              <text x={x + W / 2} y={H + 14} textAnchor="middle" fontFamily={FUENTE} fontWeight="700" fontSize="11" fill={color.tinta} opacity=".8">{i + 1}</text>
              {rapido && <text x={x + W / 2} y={px(y - 6)} textAnchor="middle" fontFamily={FUENTE} fontWeight="800" fontSize="11" fill={color.acento}>{ritmoTexto(v)}</text>}
            </g>
          );
        })}
      </svg>
      <Marca style={{ marginTop: 12 }} />
    </>
  );
}

/** «Ruta escrita»: los datos escritos a lo largo de la línea de la ruta. */
function RutaEscrita({ f, r, color }) {
  const id = `rt${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const pts = puntos(f.ruta, 248, 260, 22);
  if (!pts) return null;
  const fin = pts[pts.length - 1];
  const d = `M${pts.map(([x, y]) => `${px(x)} ${px(y)}`).join(' L')}`;
  return (
    <>
      <svg width="248" height="260" viewBox="0 0 248 260" aria-label="Route with the data written along it">
        <path id={id} d={d} fill="none" stroke={color.tinta} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <text fontFamily={FUENTE} fontWeight="800" fontSize="11" fill={color.tinta} letterSpacing=".4" dy="-8">
          <textPath href={`#${id}`} startOffset="27%">
            {r.map((x, i) => (
              <tspan key={x.l}>{i > 0 ? HUECO : ''}{x.v}{x.u ? <tspan fill={color.acento}>{` ${x.u}`}</tspan> : null}</tspan>
            ))}
            {`${HUECO}${f.titulo.join(' ')}`}
          </textPath>
        </text>
        <circle cx={px(fin[0])} cy={px(fin[1])} r="5" fill={color.acento} />
      </svg>
      <Marca style={{ marginTop: 14 }} />
    </>
  );
}

/** «Regla»: una regla de kilómetros con el ritmo de cada uno; el más rápido, en el acento. */
function Regla({ f, r, color }) {
  const s = f.splits;
  const mn = Math.min(...s);
  const n = s.length;
  const W = 248;
  const y = 30;
  const x = (k) => 10 + (k * (W - 36)) / n;
  return (
    <>
      <div className="k-fr"><Valor d={r.g} px={46} /><Etiqueta>{r.t.v} total</Etiqueta></div>
      <svg width={W} height="60" viewBox={`0 0 ${W} 60`} style={{ marginTop: 16 }} aria-label="Pace for each kilometer">
        <line x1={x(0)} y1={y} x2={x(n)} y2={y} stroke={color.tinta} strokeWidth="3" strokeLinecap="round" />
        {s.map((v, k) => {
          const rp = v === mn;
          return (
            <g key={k}>
              {rp && <line x1={x(k)} y1={y} x2={x(k + 1)} y2={y} stroke={color.acento} strokeWidth="6" strokeLinecap="round" />}
              <text x={px((x(k) + x(k + 1)) / 2)} y={y - 10} textAnchor="middle" fontFamily={FUENTE} fontWeight="800" fontSize={n > 6 ? 9 : 11} fill={rp ? color.acento : color.tinta}>{ritmoTexto(v)}</text>
            </g>
          );
        })}
        {Array.from({ length: n + 1 }, (_, k) => (
          <g key={`m${k}`}>
            <rect x={px(x(k) - 1.5)} y={y - 6} width="3" height="12" rx="1.5" fill={color.tinta} />
            <text x={px(x(k))} y={y + 24} textAnchor="middle" fontFamily={FUENTE} fontWeight="700" fontSize="10" fill={color.tinta} opacity=".8">{k === n ? `${n} km` : k}</text>
          </g>
        ))}
      </svg>
      <Marca style={{ marginTop: 18 }} />
    </>
  );
}

/** «Zonas»: el tiempo en cada zona de pulso; la que más tuvo, en el acento. */
function Zonas({ f, color }) {
  const z = f.zonas;
  const mx = Math.max(...z);
  const vis = z.map((v, i) => [v, i]).filter(([v]) => v > 0);
  const W = 248;
  const G = 4;
  const util = W - G * (vis.length - 1);
  const anchos = vis.map(([v]) => (v / 100) * util);
  const barras = vis.map(([v, i], j) => {
    const w = anchos[j];
    const x = anchos.slice(0, j).reduce((t, a) => t + a + G, 0);
    return (
      <g key={i}>
        <rect x={px(x)} y="0" width={px(w)} height="14" rx="4" fill={v === mx ? color.acento : color.tinta} opacity={v === mx ? 1 : 0.9} />
        <text x={px(x + w / 2)} y="32" textAnchor="middle" fontFamily={FUENTE} fontWeight="700" fontSize="11" fill={color.tinta} opacity=".8">Z{i + 1}</text>
      </g>
    );
  });
  return (
    <>
      <Valor d={{ v: String(mx), u: '%' }} px={56} />
      <Etiqueta style={{ marginTop: 6 }}>In heart rate zone {z.indexOf(mx) + 1}</Etiqueta>
      <svg width={W} height="38" viewBox={`0 0 ${W} 38`} style={{ marginTop: 16 }} aria-label="Time in each heart rate zone">{barras}</svg>
      <Marca style={{ marginTop: 18 }} />
    </>
  );
}

/** «Elevación»: el desnivel y, si el reloj trajo la altura, su perfil con la cima en el acento. */
function Elevacion({ f, r, color }) {
  const base = perfilReducido(f.perfil);
  const W = 248;
  const H = 68;
  let perfil = null;
  if (base) {
    const mn = Math.min(...base);
    const mx = Math.max(...base);
    const pts = base.map((v, i) => [(i * W) / (base.length - 1), 6 + (H - 12) * (1 - (v - mn) / ((mx - mn) || 1))]);
    const top = pts[base.indexOf(mx)];
    const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${px(x)} ${px(y)}`).join(' ');
    perfil = (
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ marginTop: 14 }} aria-label="Elevation profile">
        <path d={`${d} L${W} ${H} L0 ${H} Z`} fill={color.tinta} opacity=".16" />
        <path d={d} fill="none" stroke={color.tinta} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={px(top[0])} cy={px(top[1])} r="5" fill={color.acento} />
      </svg>
    );
  }
  return (
    <>
      {perfil ? <Renglon d={r.g} px={50} etiqueta="Elevation gain" /> : <Valor d={r.g} px={84} />}
      {perfil ?? <Etiqueta style={{ marginTop: 8 }}>Elevation gain</Etiqueta>}
      <Marca style={{ marginTop: 18 }} />
    </>
  );
}

/** «Largos»: una rayita por largo de alberca; el último, en el acento. */
function Largos({ r, color }) {
  const n = Number(r.l.v);
  const por = 20;
  const W = 248;
  const G = (W - por * 3) / (por - 1);
  const h = Math.ceil(n / por) * 22 - 8;
  return (
    <>
      <Valor d={r.g} px={60} />
      <Etiqueta style={{ marginTop: 6 }}>{n} lengths of 25 m</Etiqueta>
      <svg width={W} height={h} viewBox={`0 0 ${W} ${h}`} style={{ marginTop: 14 }} aria-label={`${n} pool lengths`}>
        {Array.from({ length: n }, (_, i) => (
          <rect key={i} x={px((i % por) * (3 + G))} y={Math.floor(i / por) * 22} width="3" height="14" rx="1.5" fill={i === n - 1 ? color.acento : color.tinta} opacity={i === n - 1 ? 1 : 0.9} />
        ))}
      </svg>
      <Renglon d={r.p} px={22} style={{ marginTop: 14 }} />
      <Marca style={{ marginTop: 18 }} />
    </>
  );
}

/** Los renglones de una frase: «5.00km / in 27:14 / at 5:27/km». */
const Frase = ({ renglones, style }) => (
  <div className="k-v k-frase" style={style}>
    {renglones.map((r, i) => (
      <div key={i}>{r.map((x, j) => (
        <span key={j}>{j > 0 ? ' ' : ''}{x.co ? <span className="co">{x.t}</span> : x.t}{x.u ? <span className="u">{x.u}</span> : null}</span>
      ))}</div>
    ))}
  </div>
);

/** «Lista»: el número grande (volumen, o series) y hasta 6 ejercicios con series × reps @ kilos. */
function Lista({ f, r }) {
  const unidad = f.datos.volumen?.u ?? 'kg';
  return (
    <>
      <div className="k-fr"><Valor d={r.g} px={42} /><Etiqueta>{`${r.s.v} ${r.s.u || r.s.l.toLowerCase()}`}</Etiqueta></div>
      <div className="k-lista">
        {f.lista.slice(0, 6).map((x, i) => (
          <div key={i} className="k-fr">
            <span className="n">{x.n}</span>
            <span className="k-v" style={{ fontSize: 15 }}>
              {x.s}×{x.r ?? <>{x.seg}<span className="u">s</span></>}
              {x.kg ? <><span className="at">@</span>{Number.isInteger(x.kg) ? x.kg : x.kg.toFixed(1)}<span className="u">{unidad}</span></> : null}
            </span>
          </div>
        ))}
      </div>
      <Marca style={{ marginTop: 20 }} />
    </>
  );
}

/** «Semana»: un punto por día; los días con entreno llenos, el de hoy en el acento. */
function Semana({ f, color }) {
  const s = f.semana;
  const W = 248;
  const R = 12;
  return (
    <>
      <div className="k-fr"><Valor d={{ v: String(s.total), u: s.total === 1 ? 'workout' : 'workouts' }} px={50} /><Etiqueta>This week</Etiqueta></div>
      <svg width={W} height={2 * R + 26} viewBox={`0 0 ${W} ${2 * R + 26}`} style={{ marginTop: 18 }} aria-label="This week">
        {s.dias.map((d, i) => {
          const cx = R + (i * (W - 2 * R)) / 6;
          return (
            <g key={i}>
              {d.length
                ? <circle cx={px(cx)} cy={R + 1} r={R} fill={i === s.hoy ? color.acento : color.tinta} />
                : <circle cx={px(cx)} cy={R + 1} r={R - 1.5} fill="none" stroke={color.tinta} strokeWidth="2.5" opacity=".4" />}
              <text x={px(cx)} y={2 * R + 20} textAnchor="middle" fontFamily={FUENTE} fontWeight="700" fontSize="11" fill={color.tinta} opacity=".8">{DIAS[i]}</text>
            </g>
          );
        })}
      </svg>
      <Etiqueta style={{ marginTop: 14 }}>{s.min >= 60 ? `${Math.floor(s.min / 60)}h ${String(s.min % 60).padStart(2, '0')}` : `${s.min} min`} in total</Etiqueta>
      <Marca style={{ marginTop: 18 }} />
    </>
  );
}

/** «Mes»: el mes en grande y sus totales. */
function Mes({ f }) {
  const m = f.mes;
  const tiempo = m.min >= 60 ? `${Math.floor(m.min / 60)}h ${String(m.min % 60).padStart(2, '0')}` : `${m.min}m`;
  const ds = [{ v: String(m.total), u: '', l: 'Workouts' }, { v: tiempo, u: '', l: 'Time' }];
  if (m.distM >= 1000) ds.push({ v: (m.distM / 1000).toFixed(1), u: 'km', l: 'Distance' });
  return (
    <>
      <div className="k-v k-fit" style={{ fontSize: 50 }}>{m.nombre}</div>
      <Rejilla datos={ds} cols={ds.length} px={26} style={{ marginTop: 16 }} />
      <Marca style={{ marginTop: 22 }} />
    </>
  );
}

/** «Cada serie, un ícono» y «Cada kilómetro, un ícono»: el ícono del tipo repetido; el último en el acento (y la fracción de km al 30 %). */
function Repetidos({ f, n, ultimo, fraccion = -1, por, s, sw }) {
  const W = 248;
  const G = (W - por * s) / (por - 1);
  return (
    <div style={{ position: 'relative', width: W, height: Math.ceil(n / por) * (s + 8) - 8, marginTop: 14 }} aria-hidden="true">
      {Array.from({ length: n }, (_, i) => (
        <span key={i} style={{ position: 'absolute', left: (i % por) * (s + G), top: Math.floor(i / por) * (s + 8), color: i === ultimo ? ACENTO : 'inherit', opacity: i === fraccion ? 0.3 : 1, lineHeight: 0 }}>
          <IconoDeTipo id={f.tipo.icono} nombre={f.tipo.nombre} size={s} strokeWidth={sw} />
        </span>
      ))}
    </div>
  );
}

/** «Sello»: un círculo con el tipo, el dato y la fecha escritos alrededor, y el ícono del tipo al centro. */
function Sello({ f, r, color }) {
  const id = `ci${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const D = 230;
  const c = D / 2;
  const rr = 95;
  const partes = [f.tipo.nombre.toUpperCase(), `${r.g.v} ${r.g.u || r.g.l}`.toUpperCase().trim(), f.fecha.toUpperCase().replace(',', '')];
  // Dos vueltas del texto, para que llene el círculo (`textLength` lo reparte parejo).
  const vuelta = (n) => partes.flatMap((p, i) => [p, <tspan key={`${n}${i}`} fill={color.acento}>{' ● '}</tspan>]);
  return (
    <>
      <svg width={D} height={D} viewBox={`0 0 ${D} ${D}`} style={{ alignSelf: 'center' }} aria-label={`${f.tipo.nombre}, ${r.g.v} ${r.g.u}, ${f.fecha}`}>
        <defs><path id={id} d={`M ${c} ${c} m -${rr} 0 a ${rr} ${rr} 0 1 1 ${2 * rr} 0 a ${rr} ${rr} 0 1 1 -${2 * rr} 0`} /></defs>
        <circle cx={c} cy={c} r="76" fill="none" stroke={color.tinta} strokeWidth="3.5" />
        <text fontFamily={FUENTE} fontWeight="800" fontSize="12" letterSpacing="1" fill={color.tinta}>
          <textPath href={`#${id}`} textLength={(2 * Math.PI * rr - 4).toFixed(0)} lengthAdjust="spacing">{vuelta('a')}{vuelta('b')}</textPath>
        </text>
        <g style={{ color: color.tinta }}>
          <IconoDeTipo id={f.tipo.icono} nombre={f.tipo.nombre} size={80} strokeWidth={1.6} x={c - 40} y={c - 40} />
        </g>
      </svg>
      <Marca style={{ marginTop: 14, alignSelf: 'center' }} />
    </>
  );
}

/** «Semana con íconos»: el ícono del tipo de cada día con entreno; el de hoy en el acento. */
function SemanaIconos({ f }) {
  const s = f.semana;
  const W = 248;
  const t = 24;
  return (
    <>
      <div className="k-fr"><Valor d={{ v: String(s.total), u: s.total === 1 ? 'workout' : 'workouts' }} px={50} /><Etiqueta>This week</Etiqueta></div>
      <div style={{ position: 'relative', width: W, height: t + 24, marginTop: 18 }} aria-label="This week by type">
        {s.dias.map((d, i) => {
          const cx = t / 2 + (i * (W - t)) / 6;
          const tipo = d[0];
          return (
            <span key={i} style={{ position: 'absolute', left: cx - t / 2, top: 0, width: t, textAlign: 'center' }}>
              {tipo
                ? <span style={{ color: i === s.hoy ? ACENTO : 'inherit', lineHeight: 0, display: 'inline-flex' }}><IconoDeTipo id={tipo.icono} nombre={tipo.nombre} size={t} strokeWidth={2} /></span>
                : <span style={{ display: 'inline-block', width: 5, height: 5, borderRadius: '50%', background: 'currentColor', opacity: 0.35, marginTop: 10 }} />}
              <span className="k-l" style={{ display: 'block', marginTop: tipo ? 6 : 15, fontSize: 11 }}>{DIAS[i]}</span>
            </span>
          );
        })}
      </div>
      <Marca style={{ marginTop: 18 }} />
    </>
  );
}

/** «Mes por tipo»: el mes y cuántos entrenos de cada tipo (los 5 que más). */
function MesPorTipo({ f }) {
  const m = f.mes;
  return (
    <>
      <div className="k-fr"><Valor d={{ v: m.nombre, u: '' }} px={44} /><Etiqueta>{m.total} {m.total === 1 ? 'workout' : 'workouts'}</Etiqueta></div>
      <div className="k-rej" style={{ gridTemplateColumns: `repeat(${m.porTipo.length}, minmax(0, 1fr))`, columnGap: 6, marginTop: 18 }}>
        {m.porTipo.map(({ tipo, n }) => (
          <div key={tipo.nombre}>
            <span className="k-ic"><IconoDeTipo id={tipo.icono} nombre={tipo.nombre} size={24} strokeWidth={2.2} /></span>
            <div className="k-v" style={{ fontSize: 26, marginTop: 8 }}>{n}</div>
            <div className="k-l" style={{ fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis' }}>{tipo.nombre}</div>
          </div>
        ))}
      </div>
      <Marca style={{ marginTop: 20 }} />
    </>
  );
}

const TITULAR_MARCA = { marginTop: 18, textTransform: 'uppercase', /* estilo-ok: el wordmark del Titular va en mayúsculas (diseño del sticker) */ letterSpacing: '.01em' };

/** El interior de un sticker por su `id`. `item.r`: lo que resolvieron sus ranuras. */
export default function Contenido({ item, f, color }) {
  const { r } = item;
  switch (item.id) {
    case 'titular':
      return (
        <>
          <div className="k-ti k-fit">{f.titulo[0]}</div>
          <div className="k-ti k-fit">{f.titulo[1]}</div>
          <div className="k-tr">{[r.a, r.b, r.c].map((d) => <div key={d.k}><Valor d={d} px={20} /><Etiqueta>{d.l}</Etiqueta></div>)}</div>
          <Marca px={15} style={TITULAR_MARCA} />
        </>
      );
    case 'titular-pr':
      return (
        <>
          <div className="k-ti k-fit">{f.record.titulo[0]}</div>
          <div className="k-ti k-fit" style={{ color: ACENTO }}>{f.record.titulo[1]}</div>
          <div className="k-tr">
            <div><Valor d={f.record.grande} px={20} /><Etiqueta>{f.record.en}</Etiqueta></div>
            {r.a.l !== f.record.grande.l && <div><Valor d={r.a} px={20} /><Etiqueta>{r.a.l}</Etiqueta></div>}
            {r.a.l === f.record.grande.l && <div><Valor d={r.b} px={20} /><Etiqueta>{r.b.l}</Etiqueta></div>}
          </div>
          <Marca px={15} style={TITULAR_MARCA} />
        </>
      );
    case 'firma':
      return (
        <>
          <div className="k-firma">
            <Valor d={r.g} px={44} className="k-fl" />
            <div className="k-v k-fit k-fl k-wm" style={{ fontSize: 44 }}>Training<span>Lab</span></div>
          </div>
          <div className="k-cap">{fraseCorta(f, r.g)}</div>
        </>
      );
    case 'eco':
      return (
        <>
          <div className="k-ecos">
            <div className="k-v k-ec e1 k-fit" aria-hidden="true" style={{ fontSize: 80 }}>{r.g.v}</div>
            <div className="k-v k-ec e2 k-fit" aria-hidden="true" style={{ fontSize: 80 }}>{r.g.v}</div>
            <div className="k-v k-ec e3 k-fit" style={{ fontSize: 80 }}>{r.g.v}{r.g.u ? <span className="u">{r.g.u}</span> : null}</div>
          </div>
          <div className="k-cap">{fraseCorta(f, r.g)}</div>
          <Marca style={{ marginTop: 12 }} />
        </>
      );
    case 'grande':
      return (
        <>
          <Valor d={r.g} px={84} />
          <div className="k-fr" style={{ marginTop: 10 }}><Etiqueta>{r.g.l}</Etiqueta><Marca /></div>
        </>
      );
    case 'fila':
      return <><Rejilla datos={r} cols={3} px={36} /><Marca style={{ marginTop: 22 }} /></>;
    case 'columna':
      return <><div className="k-filas">{r.map((d) => <Renglon key={d.k} d={d} px={46} />)}</div><Marca style={{ marginTop: 22 }} /></>;
    case 'escalera':
      return (
        <>
          <Renglon d={r[0]} px={72} />
          <div style={{ margin: '4px 0 0 24px', width: 'calc(100% - 24px)' }}><Renglon d={r[1]} px={48} /></div>
          <div style={{ margin: '4px 0 0 48px', width: 'calc(100% - 48px)' }}><Renglon d={r[2]} px={32} /></div>
          <Marca style={{ marginTop: 22 }} />
        </>
      );
    case 'frase':
      return <><Frase renglones={fraseLarga(f)} /><Marca style={{ marginTop: 22 }} /></>;
    case 'ruta-dato':
      return (
        <>
          <Ruta ruta={f.ruta} ancho={248} alto={150} color={color} />
          <div style={{ marginTop: 16, width: '100%' }}><Valor d={r.g} px={56} /></div>
          <Rejilla datos={r.lista} cols={2} px={22} style={{ marginTop: 12 }} />
          <Marca style={{ marginTop: 18 }} />
        </>
      );
    case 'mejor-km':
      return <MejorKm f={f} color={color} />;
    case 'esquinas':
      return (
        <>
          <div className="k-esq">
            <Ruta ruta={f.ruta} ancho={150} alto={150} color={color} />
            {['tl', 'tr', 'bl', 'br'].map((p, i) => <div key={p} className={`c ${p}`}><Valor d={r[i]} px={23} /><Etiqueta>{r[i].l}</Etiqueta></div>)}
          </div>
          <Marca style={{ marginTop: 14, alignSelf: 'center' }} />
        </>
      );
    case 'parciales':
      return <Parciales f={f} r={r} color={color} />;
    case 'seis':
      return <><Rejilla datos={r} cols={2} px={34} style={{ rowGap: 18 }} /><Marca style={{ marginTop: 22 }} /></>;
    case 'ruta-escrita':
      return <RutaEscrita f={f} r={r} color={color} />;
    case 'regla':
      return <Regla f={f} r={r} color={color} />;
    case 'hora':
      return (
        <>
          <Valor d={f.hora} px={86} />
          <Etiqueta style={{ marginTop: 8 }}>{f.titulo.join(' ')} · {f.hora.u === 'am' ? 'early start' : 'after hours'}</Etiqueta>
          <Rejilla datos={r} cols={2} px={22} style={{ marginTop: 16 }} />
          <Marca style={{ marginTop: 18 }} />
        </>
      );
    case 'zonas':
      return <Zonas f={f} color={color} />;
    case 'elevacion':
      return <Elevacion f={f} r={r} color={color} />;
    case 'record':
      return (
        <>
          <Valor d={f.record.grande} px={78} />
          <Etiqueta style={{ marginTop: 8, opacity: 1 }}>{f.record.en}</Etiqueta>
          {f.record.det && <Etiqueta style={{ marginTop: 4 }}>{f.record.det}</Etiqueta>}
          <Marca style={{ marginTop: 18 }} />
        </>
      );
    case 'largos':
      return <Largos r={r} color={color} />;
    case 'partido':
      return (
        <>
          <Frase renglones={[[{ t: f.datos.min.v, u: f.datos.min.u }], [{ t: 'of', co: true }, { t: f.en.toLowerCase() }]]} />
          {r.length > 0 && <Rejilla datos={r} cols={2} px={24} style={{ marginTop: 16 }} />}
          <Marca style={{ marginTop: 20 }} />
        </>
      );
    case 'lista':
      return <Lista f={f} r={r} />;
    case 'semana':
      return <Semana f={f} color={color} />;
    case 'mes':
      return <Mes f={f} />;
    case 'icono-numero':
      return (
        <>
          <div className="k-fila-ic"><Icono tipo={f.tipo} size={60} /><div style={{ minWidth: 0, flex: 1 }}><Valor d={r.g} px={54} /><Etiqueta style={{ marginTop: 4 }}>{f.tipo.nombre}</Etiqueta></div></div>
          <Marca style={{ marginTop: 22 }} />
        </>
      );
    case 'titular-icono':
      return (
        <>
          <div className="k-fila-ic" style={{ gap: 10, width: '100%' }}>
            <Icono tipo={f.tipo} size={52} sw={2.2} />
            <div style={{ flex: 1, minWidth: 0 }}><div className="k-ti k-fit" style={{ fontSize: 60 }}>{f.tipo.nombre}</div></div>
          </div>
          <Rejilla datos={r} cols={r.length} px={22} style={{ marginTop: 16 }} />
          <Marca style={{ marginTop: 20 }} />
        </>
      );
    case 'icono-gigante':
      return (
        <>
          <Icono tipo={f.tipo} size={126} sw={1.5} />
          <div style={{ marginTop: 14, width: '100%' }}><Valor d={r.g} px={50} /></div>
          <Etiqueta style={{ marginTop: 6 }}>{f.tipo.nombre}</Etiqueta>
          <Marca style={{ marginTop: 18 }} />
        </>
      );
    case 'cada-serie': {
      const n = Number(r.g.v);
      return (
        <>
          <div className="k-fr"><Valor d={r.g} px={50} /><Etiqueta>{`${r.s.v}${r.s.u ? ` ${r.s.u}` : ''} ${r.s.l.toLowerCase()}`}</Etiqueta></div>
          <Repetidos f={f} n={n} ultimo={n - 1} por={8} s={24} sw={2.2} />
          <Marca style={{ marginTop: 20 }} />
        </>
      );
    }
    case 'cada-km': {
      const n = Number(r.g.v);
      const enteros = Math.floor(n);
      const total = enteros + (n - enteros > 0.05 ? 1 : 0);
      return (
        <>
          <Valor d={r.g} px={60} />
          <Etiqueta style={{ marginTop: 6 }}>One {f.tipo.nombre.toLowerCase()} per kilometer</Etiqueta>
          <Repetidos f={f} n={total} ultimo={enteros - 1} fraccion={total > enteros ? enteros : -1} por={5} s={36} sw={1.8} />
          <Marca style={{ marginTop: 20 }} />
        </>
      );
    }
    case 'sello':
      return <Sello f={f} r={r} color={color} />;
    case 'hoy-toco':
      return (
        <>
          <div className="k-tag"><Icono tipo={f.tipo} size={22} sw={2.2} /><Etiqueta style={{ opacity: 1 }}>{f.tipo.nombre}</Etiqueta></div>
          <div className="k-v k-nombre">{f.nombre}</div>
          {/* Las hechas contra las PROGRAMADAS («12/16 sets»); si no se saben las programadas, solo «12 sets». */}
          <div style={{ marginTop: 14, width: '100%' }}><Valor d={{ v: r.g.v, u: r.g.k === 'series' ? (f.programadas ? `/${f.programadas} sets` : 'sets') : r.g.u }} px={46} /></div>
          {f.coach && <Etiqueta style={{ marginTop: 6 }}>Programmed by {f.coach}</Etiqueta>}
          <Marca style={{ marginTop: 18 }} />
        </>
      );
    case 'racha':
      return (
        <>
          <div className="k-fr" style={{ alignItems: 'center' }}><Valor d={{ v: String(f.racha), u: ordinal(f.racha).slice(-2) }} px={80} /><Icono tipo={f.tipo} size={50} /></div>
          <Etiqueta style={{ marginTop: 8 }}>{f.tipo.nombre} session this year</Etiqueta>
          <Marca style={{ marginTop: 18 }} />
        </>
      );
    case 'semana-iconos':
      return <SemanaIconos f={f} />;
    case 'mes-por-tipo':
      return <MesPorTipo f={f} />;
    default:
      return null;
  }
}
