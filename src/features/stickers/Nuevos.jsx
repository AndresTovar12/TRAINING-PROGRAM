import { useId } from 'react';
import IconoDeTipo from '@/components/IconoDeTipo';
import { ajustaRuta } from '@/lib/stickers/ruta';

/* LOS 19 STICKERS NUEVOS (5 nov 2026; ver docs/stickers.md y la maqueta aprobada, de donde sale cada medida): 8 discretos, 6 runner y 5 tarjetas.
   Van centrados (a diferencia de los 35 de `Contenido.jsx`, que van a la izquierda), con la etiqueta arriba y el número abajo. Las unidades del mismo color que
   el número. La marca es «Training Lab» (con espacio; `Lab` en el acento). Los números marcados `data-n-max` bajan de tamaño hasta caber (`Sticker.jsx`).
   Las tarjetas traen fondo y se pintan con los temas de `TEMAS_TARJETA` (variables `--tj-*` que pone `Sticker.jsx`). */

const px = (n) => Number(n).toFixed(1);
const camino = (pts) => `M${pts.map(([x, y]) => `${px(x)} ${px(y)}`).join(' L')}`;
const ANCHO_MAX = 256; // lo que cabe en un sticker de 300 con sus 22 de margen

const Num = ({ d, px: tam, max, style }) => (
  <div className="n-v" data-n-max={max} style={{ fontSize: tam, ...style }}>{d.v}{d.u ? <span className="n-u">{d.u}</span> : null}</div>
);
/** Un par: la etiqueta arriba y el número abajo. `lt`: el tamaño de la etiqueta, si no es el de siempre (12.5). */
const Par = ({ d, px: tam, lt, max = ANCHO_MAX }) => (
  <div className="n-par"><div className="n-l" style={lt ? { fontSize: lt } : undefined}>{d.l}</div><Num d={d} px={tam} max={max} /></div>
);
/** La firma «Training Lab». */
const Marca = ({ px: tam, style }) => <div className="n-wm" style={{ fontSize: tam, ...style }}>{'Training '}<span>Lab</span></div>;
/** Un grupo de valores que bajan juntos hasta que el grupo quepa en `max`. */
const Grupo = ({ className, max = ANCHO_MAX, style, children }) => <div className={className} data-n-max={max} style={style}>{children}</div>;

/** La ruta en una línea (puntas redondas, sin punto al final). */
function Linea({ ruta, w, h, grosor, trazo }) {
  const pts = ajustaRuta(ruta.lat, ruta.lon, w, h, grosor + 2);
  if (!pts) return null;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <path d={camino(pts)} fill="none" stroke={trazo} strokeWidth={grosor} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** La ruta NEÓN de las tarjetas: un halo de 12 px al 55 % con desenfoque de 5, la línea de 6 px y un núcleo de 1.6 px más claro. Sin punto al final. */
function Neon({ ruta, w, h }) {
  const id = `nn${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const pts = ajustaRuta(ruta.lat, ruta.lon, w, h, 12);
  if (!pts) return null;
  const d = camino(pts);
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <defs><filter id={id} filterUnits="userSpaceOnUse" x={-20} y={-20} width={w + 40} height={h + 40}><feGaussianBlur stdDeviation="5" /></filter></defs>
      <path d={d} fill="none" style={{ stroke: 'var(--tj-halo)' }} strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" opacity=".55" filter={`url(#${id})`} />
      <path d={d} fill="none" style={{ stroke: 'var(--tj-ruta)' }} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} fill="none" style={{ stroke: 'var(--tj-nucleo)' }} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" opacity=".7" />
    </svg>
  );
}

/** Las curvas de nivel de un mapa topográfico, de fondo de la tarjeta (trazos finos al 24 %). Siempre las mismas. */
function Topo({ w, h }) {
  const centros = [[w * 0.22, h * 0.18, 7], [w * 0.86, h * 0.42, 6], [w * 0.18, h * 0.78, 7], [w * 0.78, h * 0.92, 5]];
  const curvas = [];
  centros.forEach(([cx, cy, n], ci) => {
    for (let r = 1; r <= n; r += 1) {
      const R = r * 15 + 8;
      let d = '';
      for (let a = 0; a <= 64; a += 1) {
        const t = (a / 64) * Math.PI * 2;
        const k = 1 + 0.16 * Math.sin(3 * t + ci + r * 0.4) + 0.07 * Math.sin(5 * t + r);
        d += `${a ? 'L' : 'M'}${(cx + Math.cos(t) * R * k * 1.15).toFixed(1)} ${(cy + Math.sin(t) * R * k).toFixed(1)}`;
      }
      curvas.push(<path key={`${ci}-${r}`} d={`${d}Z`} />);
    }
  });
  return (
    <svg className="n-topo" width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <g fill="none" style={{ stroke: 'var(--tj-topo)' }} strokeWidth=".8" opacity=".24">{curvas}</g>
    </svg>
  );
}

/** El ícono de la actividad (el tipo que eligió el coach, o el del deporte). */
const Icono = ({ tipo, size, sw = 2 }) => <span className="n-ic" role="img" aria-label={tipo.nombre}><IconoDeTipo id={tipo.icono} nombre={tipo.nombre} size={size} strokeWidth={sw} /></span>;

const unidad = (d) => `${d.v}${d.u ? ` ${d.u}` : ''}`;

/* ---------- Discretos ---------- */

function Discreto({ item, f, cara }) {
  const { r } = item;
  switch (item.id) {
    case 'd-un-dato':
      return <div className="n-in n-d"><Par d={r[Math.min(cara, r.length - 1)]} px={46} /></div>;
    case 'd-dos':
      return <div className="n-in n-d"><Grupo className="n-fila" style={{ gap: 24 }}>{r.map((d) => <Par key={d.k} d={d} px={34} max={null} />)}</Grupo></div>;
    case 'd-dos-linea':
      return (
        <div className="n-in n-d">
          <Grupo className="n-fila" style={{ gap: 18, alignItems: 'center' }}>
            {r.map((d) => <Par key={d.k} d={d} px={27} max={null} />)}
            <div style={{ marginTop: 12 }}><Linea ruta={f.ruta} w={64} h={40} grosor={2.2} trazo="currentColor" /></div>
          </Grupo>
        </div>
      );
    case 'd-tres':
      return <div className="n-in n-d"><Grupo className="n-fila" style={{ gap: 18 }}>{r.map((d) => <Par key={d.k} d={d} px={24} max={null} />)}</Grupo></div>;
    case 'd-cuatro':
      return <div className="n-in n-d"><Grupo className="n-rej" style={{ gridTemplateColumns: 'repeat(2, auto)' }}>{r.map((d) => <Par key={d.k} d={d} px={26} max={null} />)}</Grupo></div>;
    case 'd-seis':
      // Seis o cinco: con cinco, la segunda fila se centra (cada dato ocupa dos de las seis columnas).
      return (
        <div className="n-in n-d">
          <Grupo className="n-rej" style={{ gridTemplateColumns: 'repeat(6, auto)', columnGap: 9 }}>
            {r.map((d, i) => <div key={d.k} style={{ gridColumn: r.length === 5 && i >= 3 ? `${i === 3 ? 2 : 4} / span 2` : 'span 2', justifySelf: 'center' }}><Par d={d} px={19} lt={11} max={null} /></div>)}
          </Grupo>
        </div>
      );
    case 'd-linea':
      return <div className="n-in n-d"><Linea ruta={f.ruta} w={230} h={270} grosor={2.5} trazo="currentColor" /></div>;
    case 'd-linea-dato':
      return (
        <div className="n-in n-d">
          <Linea ruta={f.ruta} w={150} h={170} grosor={2.5} trazo="currentColor" />
          <div style={{ marginTop: 16 }}><Par d={r.g} px={28} /></div>
        </div>
      );
    default:
      return null;
  }
}

/* ---------- Runner ---------- */

function Runner({ item, f, color }) {
  const { r } = item;
  const acento = color.acento;
  switch (item.id) {
    case 'r-columna':
      return <div className="n-in n-r">{r.map((d) => <Par key={d.k} d={d} px={36} />)}<Marca px={20} style={{ marginTop: 20 }} /></div>;
    case 'r-columna-ruta':
      return (
        <div className="n-in n-r">
          {r.map((d) => <Par key={d.k} d={d} px={30} />)}
          <div style={{ margin: '16px 0 14px' }}><Linea ruta={f.ruta} w={130} h={110} grosor={6} trazo={acento} /></div>
          <Marca px={18} />
        </div>
      );
    case 'r-ruta-grande':
      return (
        <div className="n-in n-r" style={{ justifyContent: 'space-between', padding: '26px 18px 20px' }}>
          <Linea ruta={f.ruta} w={220} h={240} grosor={7} trazo={acento} />
          <div>
            <Marca px={22} />
            <Grupo className="n-tres" max={264} style={{ marginTop: 10 }}>{r.map((d) => <div key={d.k}><Par d={d} px={19} lt={10.5} max={null} /></div>)}</Grupo>
            <div style={{ display: 'grid', placeItems: 'center', marginTop: 8 }}><Icono tipo={f.tipo} size={20} /></div>
          </div>
        </div>
      );
    case 'r-columna-larga':
      return (
        <div className="n-in n-r">
          <Marca px={17} />
          <div style={{ marginTop: 16 }}>{r.map((d) => <Par key={d.k} d={d} px={22} />)}</div>
        </div>
      );
    case 'r-marco': {
      // Los datos van escritos de lado por los bordes: dos a la derecha y dos a la izquierda (11 px, girados 90°).
      const lado = (datos) => datos.map((d, i) => <span key={d.k}>{i ? '   ' : ''}{d.l}<b>{unidad(d)}</b></span>);
      return (
        <div className="n-in n-r" style={{ padding: 0 }}>
          <Marca px={15} style={{ position: 'absolute', left: 18, top: 18 }} />
          <Linea ruta={f.ruta} w={170} h={240} grosor={6} trazo={acento} />
          <div className="n-ancla" style={{ right: 17, top: '50%' }}><div className="n-vert">{lado(r.slice(0, 2))}</div></div>
          {r.length > 2 && <div className="n-ancla" style={{ left: 17, top: '50%' }}><div className="n-vert">{lado(r.slice(2, 4))}</div></div>}
        </div>
      );
    }
    case 'r-boleto': {
      // Un recuadro de 192 px con borde de 2 px y el borde de abajo en zigzag.
      const zig = `${Array.from({ length: 12 }, (_, i) => `${i * 16},0 ${i * 16 + 8},8`).join(' ')} 192,0`;
      return (
        <div className="n-in n-r">
          <div className="n-boleto">
            <Marca px={18} />
            <div className="n-boleto-dibujo">{f.ruta ? <Linea ruta={f.ruta} w={130} h={150} grosor={6} trazo={acento} /> : <span style={{ color: acento }}><Icono tipo={f.tipo} size={70} /></span>}</div>
            <div className="n-v" style={{ fontSize: 30 }}>{f.dia}</div>
            <div className="n-l" style={{ marginTop: 3 }}>{f.fechaCorta}</div>
            <svg width="196" height="10" viewBox="-2 -1 196 10" style={{ position: 'absolute', left: -2, bottom: -9 }} aria-hidden="true"><polyline points={zig} fill="none" stroke="currentColor" strokeWidth="2" /></svg>
          </div>
        </div>
      );
    }
    default:
      return null;
  }
}

/* ---------- Tarjetas ---------- */

const Raya = ({ style }) => <div className="n-raya" style={style} />;

function Tarjeta({ item, f }) {
  const { r } = item;
  const marca = (tam) => <Marca px={tam * 0.82} />;
  switch (item.id) {
    case 't-ruta':
      return (
        <div className="n-tj"><Topo w={288} h={518} />
          <div className="n-cont" style={{ padding: '30px 18px 26px' }}>
            <Neon ruta={f.ruta} w={220} h={150} />
            <div style={{ marginTop: 18 }}><Par d={r[0]} px={46} max={252} /></div>
            <Raya /><Par d={r[1]} px={46} max={252} /><Raya /><Par d={r[2]} px={46} max={252} />
            <div style={{ marginTop: 'auto' }}>{marca(30)}</div>
          </div>
        </div>
      );
    case 't-ruta-fila':
      return (
        <div className="n-tj"><Topo w={288} h={368} />
          <div className="n-cont" style={{ padding: '26px 16px 22px' }}>
            <Neon ruta={f.ruta} w={230} h={170} />
            <Grupo className="n-fila" max={256} style={{ gap: 16, marginTop: 16 }}>{r.map((d) => <Par key={d.k} d={d} px={24} lt={11.5} max={null} />)}</Grupo>
            <div style={{ marginTop: 'auto' }}>{marca(22)}</div>
          </div>
        </div>
      );
    case 't-sin-ruta':
      return (
        <div className="n-tj"><Topo w={288} h={518} />
          <div className="n-cont" style={{ padding: '34px 18px 26px' }}>
            <div className="n-brillo"><Icono tipo={f.tipo} size={86} sw={1.6} /></div>
            <div className="n-l" style={{ letterSpacing: '.12em', fontWeight: 800 }}>{f.tipo.nombre.toUpperCase() /* estilo-ok: el tipo de la sesión va en mayúsculas espaciadas (diseño del sticker) */}</div>
            <div style={{ marginTop: 14 }}><Par d={r[0]} px={44} max={252} /></div>
            <Raya /><Par d={r[1]} px={44} max={252} /><Raya /><Par d={r[2]} px={44} max={252} />
            <div style={{ marginTop: 'auto' }}>{marca(30)}</div>
          </div>
        </div>
      );
    case 't-chica':
      return (
        <div className="n-tj" style={{ borderRadius: 24 }}><Topo w={288} h={188} />
          <div className="n-cont" style={{ padding: '22px 18px', justifyContent: 'center' }}>
            <Grupo className="n-fila" max={252} style={{ gap: 26 }}>{r.map((d) => <Par key={d.k} d={d} px={40} max={null} />)}</Grupo>
            <div style={{ marginTop: 16 }}>{marca(16)}</div>
          </div>
        </div>
      );
    case 't-record':
      return (
        <div className="n-tj"><Topo w={288} h={368} />
          <div className="n-cont" style={{ padding: '30px 18px 24px', justifyContent: 'center' }}>
            <div className="n-pastilla">{'RÉCORD' /* estilo-ok: la pastilla va en mayúsculas (maqueta de stickers) */}</div>
            <div className="n-l" style={{ marginTop: 22, fontSize: 15 }}>{f.record.en}</div>
            <Num d={f.record.grande} px={72} max={252} style={{ marginTop: 6, textShadow: '0 0 18px var(--tj-brillo)' }} />
            <Raya style={{ marginTop: 16 }} />
            <div className="n-l">{f.dia} {f.fechaCorta}</div>
            <div style={{ marginTop: 'auto' }}>{marca(24)}</div>
          </div>
        </div>
      );
    default:
      return null;
  }
}

/** El interior de un sticker nuevo por su familia. `cara`: la variante que se ve (solo «Un dato» tiene más de una). */
export default function Nuevos({ item, f, color, cara = 0 }) {
  if (item.familia === 'discreto') return <Discreto item={item} f={f} cara={cara} />;
  if (item.familia === 'runner') return <Runner item={item} f={f} color={color} />;
  return <Tarjeta item={item} f={f} />;
}
