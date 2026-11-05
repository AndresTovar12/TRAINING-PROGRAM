import { useId } from 'react';
import IconoDeTipo from '@/components/IconoDeTipo';
import { ajustaRuta } from '@/lib/stickers/ruta';
import { CLAVE_CORTA, fraseResaltador, pieDeBurbuja, tamDeFrase } from '@/lib/stickers/catalogo';
import { DIAS_LETRA, DIAS_MAQUINA, kmTexto, tiempoTexto } from '@/lib/stickers/totales';

/* LOS STICKERS NUEVOS (5 nov 2026; ver docs/stickers.md y la maqueta aprobada, de donde sale cada medida): 8 discretos, 6 runner, 5 tarjetas, 12 con personalidad
   (con Instrument Serif y Space Mono; algunos con varias caras, la frase o tu foto) y los 6 de «Totales» (la semana y el mes de hoy).
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

/* ---------- Los 12 con personalidad ---------- */

// Los textos que el diseño pone en mayúsculas (maqueta de stickers): la clave de la máquina de escribir, el tipo corto, el día gigante.
const mayus = (t) => String(t ?? '').toUpperCase();
const MAQUINA = { fecha: 'DATE', actividad: 'ACTV', total: 'TOTAL', semana: 'ESTA SEMANA' }; // estilo-ok: textos a máquina y de la tarjeta (maqueta)
const conUnidad = (d) => `${d.v}${d.u ? ` ${mayus(d.u)}` : ''}`;

/** Las barras del código: anchos de 2, 3 o 5 px con una semilla fija (siempre las mismas, como la maqueta). */
function barrasDe(semilla, w) {
  let x = 0;
  let r = semilla;
  const rnd = () => { r = (r * 9301 + 49297) % 233280; return r / 233280; };
  const out = [];
  while (x < w) {
    const bw = rnd() < 0.5 ? 2 : (rnd() < 0.7 ? 3 : 5);
    if (rnd() > 0.35) out.push([x, bw]);
    x += bw + (rnd() < 0.6 ? 2 : 3);
  }
  return out;
}
const BARRAS = barrasDe(7, 230);

/** El piquito del mensaje (SVG de 31 × 34, detrás de la burbuja; espejado para la izquierda). */
const Piquito = ({ fondo, mio }) => (
  <svg width="31" height="34" viewBox="0 0 31 34" aria-hidden="true" style={{ position: 'absolute', bottom: 0, ...(mio ? { right: -12 } : { left: -12, transform: 'scaleX(-1)' }) }}>
    <path d="M0 0 H12 C12 17 19 27 31 32 C18 34.5 7 33 0 29 Z" fill={fondo} />
  </svg>
);

/** El sello redondo: dos círculos, el texto en arco que cierra exacto (`textLength`) y el primer dato al centro. */
function Sello({ f, d }) {
  const id = `sl${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  // Un tipo muy largo apretaría las letras del arco: se corta.
  const tipo = mayus(f.tipo.nombre.length > 16 ? `${f.tipo.nombre.slice(0, 15)}…` : f.tipo.nombre);
  return (
    <svg width="240" height="240" viewBox="0 0 240 240" aria-hidden="true">
      <defs><path id={id} d="M120 120 m-96 0 a96 96 0 1 1 192 0 a96 96 0 1 1 -192 0" /></defs>
      <circle cx="120" cy="120" r="114" fill="none" stroke="currentColor" strokeWidth="2.5" />
      <circle cx="120" cy="120" r="78" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <text fontFamily="Bricolage Grotesque" fontWeight="800" fontSize="15" fill="currentColor">
        <textPath href={`#${id}`} textLength="598" lengthAdjust="spacing">{`TRAINING LAB · ${tipo} · ${f.fechaNum} · ${mayus(f.dia)} ·` /* estilo-ok: el arco del sello va en mayúsculas (maqueta) */}</textPath>
      </text>
      <text x="120" y="128" textAnchor="middle" fontFamily="Bricolage Grotesque" fontWeight="800" fontSize="46" letterSpacing="-1.5" fill="currentColor">{d.v}</text>
      <text x="120" y="152" textAnchor="middle" fontFamily="Bricolage Grotesque" fontWeight="700" fontSize="14" fill="currentColor">{mayus(d.u || d.l)}</text>
    </svg>
  );
}

/** La cámara del Polaroid sin foto. */
const Camara = () => (
  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" /><circle cx="12" cy="13" r="3" />
  </svg>
);

/**
 * `frase`: la elegida en «✎ Personalizar» (Frase grande y Burbuja). `propia`: la foto del carrete para el Polaroid (un enlace local; `null` = el hueco con la cámara).
 * La foto del Polaroid lleva `data-foto` y `data-giro`: al exportar se dibuja aparte, en un lienzo (`exporta.js`), para que nunca falte en el PNG.
 */
function Personalidad({ item, f, cara, frase, propia }) {
  const { r } = item;
  const lista = Array.isArray(r) ? r : [];
  switch (item.id) {
    case 'p-italica':
      if (cara === 1) {
        const d = lista[0];
        return (
          <div className="n-in">
            <div className="n-serif" style={{ fontSize: 15, opacity: 0.9 }}>{f.dia} {f.fechaCorta} · {f.hora24}</div>
            <div className="n-serif n-it n-aj" data-n-max={256} style={{ fontSize: 64, lineHeight: 1, marginTop: 6, whiteSpace: 'nowrap' }}>{d.v}{d.u ? <span style={{ fontSize: '.4em' }}> {d.u}</span> : null}</div>
            <div className="n-serif n-it n-envuelve" data-n-alto={52} style={{ fontSize: 20, marginTop: 4 }}>{f.nombre}</div>
          </div>
        );
      }
      return (
        <div className="n-in">
          <div className="n-serif n-it n-envuelve" data-n-alto={80} style={{ fontSize: 38, lineHeight: 1 }}>{f.nombre}</div>
          <Grupo className="n-fila" style={{ gap: 18, marginTop: 14, alignItems: 'flex-start' }}>
            {lista.map((d) => <div key={d.k}><div className="n-serif" style={{ fontSize: 13, opacity: 0.85 }}>{d.l}</div><div className="n-serif n-it n-aj" style={{ fontSize: 24, whiteSpace: 'nowrap' }}>{unidad(d)}</div></div>)}
          </Grupo>
        </div>
      );
    case 'p-maquina': {
      const filas = [[MAQUINA.fecha, f.fechaNum], [MAQUINA.actividad, mayus(f.en)], ...lista.map((d) => [CLAVE_CORTA[d.k] ?? mayus(d.k), conUnidad(d)])];
      return (
        <div className="n-in" style={{ alignItems: 'flex-start', textAlign: 'left', padding: '26px 40px' }}>
          <div className="n-mono" style={{ fontSize: 14, lineHeight: 1.75 }}>
            {filas.map(([a, b]) => <div key={a} style={{ whiteSpace: 'nowrap' }}>{a}: <span className="n-der">{b}</span></div>)}
          </div>
        </div>
      );
    }
    case 'p-reloj': {
      const ds = cara === 1 ? lista.slice(2, 3) : lista.slice(0, 2);
      return (
        <div className="n-in">
          <Grupo className="n-fila" style={{ gap: 22, alignItems: 'flex-start' }}>
            {ds.map((d) => <div key={d.k}><div className="n-mono n-reloj n-aj" style={{ fontSize: cara === 1 ? 56 : 42 }}>{d.v}</div><div className="n-mono n-clave">{CLAVE_CORTA[d.k] ?? mayus(d.k)}</div></div>)}
          </Grupo>
        </div>
      );
    }
    case 'p-frase': {
      const t = tamDeFrase(frase);
      return (
        <div className="n-in">
          <div className="n-serif n-it n-frase" data-n-alto={Math.ceil(40 * 1.02 * 3) + 2} style={{ fontSize: t }}>{frase}</div>
          {lista.length > 0 && <div className="n-l" style={{ marginTop: 12 }}>{lista.map(unidad).join(' · ')}</div>}
        </div>
      );
    }
    case 'p-burbuja': {
      // Cara 1: el mensaje que mandas (azul, piquito a la derecha). Cara 2: el que te mandan (gris, a la izquierda).
      const mio = cara !== 1;
      const fondo = mio ? '#2F7BFF' : '#E9E9EB';
      const pie = pieDeBurbuja(f);
      return (
        <div className="n-in" style={{ alignItems: mio ? 'flex-end' : 'flex-start', padding: '22px 34px' }}>
          <div className="n-burbuja">
            <Piquito fondo={fondo} mio={mio} />
            <div className="n-globo" data-n-alto={Math.ceil(19 * 1.22 * 3) + 20} style={{ background: fondo, color: mio ? '#fff' : '#111', ...(mio ? { borderBottomRightRadius: 16 } : { borderBottomLeftRadius: 16 }) }}>{frase}</div>
          </div>
          {pie && <div className="n-pie" style={mio ? { marginRight: 6 } : { marginLeft: 6 }}>{pie}</div>}
        </div>
      );
    }
    case 'p-barras':
      return (
        <div className="n-in">
          <div className="n-mono n-entre" style={{ fontSize: 11 }}><span>{f.fechaNum}</span><span>{lista[0] ? conUnidad(lista[0]) : ''}</span></div>
          <svg width="230" height="70" viewBox="0 0 230 70" aria-hidden="true" style={{ margin: '6px 0' }}><g fill="currentColor">{BARRAS.map(([x, w]) => <rect key={x} x={x} y="0" width={w} height="70" />)}</g></svg>
          <div className="n-mono n-entre" style={{ fontSize: 10, opacity: 0.85 }}><span>{mayus(f.en)}{lista[1] ? ` · ${lista[1].v}${lista[1].u || ''}` : ''}</span><span>{lista[2]?.v ?? ''}</span></div>
        </div>
      );
    case 'p-polaroid':
      return (
        <div className="n-in">
          <div className="n-pola">
            {propia ? <img className="n-pola-foto" data-foto="arriba" data-giro="-3" src={propia} alt="" /> : <div className="n-pola-hueco"><Camara />Toca para poner<br />una foto</div>}
            <div className="n-serif n-it" style={{ color: '#222', fontSize: 22, padding: '10px 0 4px' }}>{f.dia} {f.fechaCorta}</div>
            <div className="n-mono" style={{ color: '#444', fontSize: 10, paddingBottom: 12, minHeight: 15 }}>{lista.map(unidad).join(' · ')}</div>
          </div>
        </div>
      );
    case 'p-momento':
      return cara === 1 ? (
        <div className="n-in"><div className="n-serif" style={{ fontSize: 14, opacity: 0.9 }}>Fecha</div><div className="n-serif n-it n-envuelve" style={{ fontSize: 52, lineHeight: 1.05 }}>{f.fechaLarga}</div></div>
      ) : (
        <div className="n-in"><div className="n-serif" style={{ fontSize: 14, opacity: 0.9 }}>Empezó a las</div><div className="n-serif" style={{ fontSize: 78, lineHeight: 1 }}>{f.hora24}</div></div>
      );
    case 'p-dia': {
      const d = r.g;
      const num = (tam) => <div className="n-v" data-n-max={256} style={{ fontSize: tam }}>{d.v}{d.u ? <span className="n-u">{mayus(d.u)}</span> : null}</div>;
      if (cara === 1) {
        return (
          <div className="n-in">
            <div className="n-v" style={{ fontSize: 30, color: 'var(--stk-acento)' }}>{mayus(f.dia)}</div>
            {f.ruta && <div style={{ margin: '8px 0' }}><Linea ruta={f.ruta} w={200} h={40} grosor={2.5} trazo="currentColor" /></div>}
            {num(44)}
          </div>
        );
      }
      return (
        <div className="n-in">
          <div className="n-v n-angosta" data-n-max={256} style={{ fontSize: 78, letterSpacing: '-.02em' }}>{mayus(f.dia)}</div>
          <div style={{ marginTop: 6 }}>{num(24)}</div>
        </div>
      );
    }
    case 'p-resaltador':
      return <div className="n-in"><div className="n-serif n-resalta"><span>{fraseResaltador(f)}</span></div></div>;
    case 'p-corazon': {
      const d = r.g;
      return <div className="n-in"><div className={`n-corazon${cara === 1 ? ' n-corazon-b' : ''}`}>♥ {unidad(d)}</div></div>;
    }
    case 'p-sello':
      return <div className="n-in"><Sello f={f} d={r.g} /></div>;
    default:
      return null;
  }
}

/* ---------- Los 6 de «Totales» ---------- */

/** `t`: los totales de hoy (`totalesDe`). Sin kilómetros en la semana, las barras y la máquina cuentan minutos. */
function Totales({ item, t, cara }) {
  const vista = item.r?.vistas?.[cara] ?? 'una';
  const s = t.semana;
  const conKm = s.distM > 0;
  const porDia = conKm ? s.km : s.minDia;
  const M = Math.max(...porDia, 1);
  const totalSemana = conKm ? { v: kmTexto(s.distM), u: 'km' } : { v: tiempoTexto(s.min) };
  const entrenos = (n) => `${n} ${n === 1 ? 'entreno' : 'entrenos'}`;
  switch (item.id) {
    case 's-semana':
      return vista === 'km' ? (
        <div className="n-in n-d"><div className="n-l">Esta semana</div><Num d={{ v: kmTexto(s.distM), u: 'km' }} px={52} max={256} /></div>
      ) : (
        <div className="n-in n-d">
          <div className="n-l">Esta semana</div>
          <Grupo className="n-fila" style={{ gap: 24, marginTop: 6 }}><Par d={{ l: 'Entrenos', v: s.entrenos }} px={34} max={null} /><Par d={{ l: 'Tiempo', v: tiempoTexto(s.min).replace(' min', '') }} px={34} max={null} /></Grupo>
        </div>
      );
    case 's-barras':
      return (
        <div className="n-in">
          <div className="n-l">Esta semana</div>
          <Num d={totalSemana} px={40} max={256} />
          <div className="n-barras" style={{ gap: 12, height: 90, marginTop: 16 }}>
            {porDia.map((k, i) => (
              <div key={i} className="n-barra"><div style={{ height: k ? Math.max(8, (k / M) * 70) : 4, opacity: k ? 1 : 0.3 }} /><div className="n-l" style={{ fontSize: 11 }}>{DIAS_LETRA[i]}</div></div>
            ))}
          </div>
        </div>
      );
    case 's-puntos': {
      const m = t.mes;
      return (
        <div className="n-in">
          <div className="n-entre" style={{ width: 224 }}><span className="n-l">{m.nombre}</span><span className="n-l">{entrenos(m.entrenos)}</span></div>
          <div className="n-puntos">
            {Array.from({ length: m.dias }, (_, i) => <i key={i} className={m.hechos.includes(i + 1) ? 'si' : undefined} />)}
          </div>
        </div>
      );
    }
    case 's-mes': {
      const m = t.mes;
      return (
        <div className="n-in">
          <div className="n-v" style={{ fontSize: 30, letterSpacing: '-.01em' }}>{mayus(m.nombre)}</div>
          {vista === 'km'
            ? <div className="n-v n-angosta" data-n-max={256} style={{ fontSize: 92 }}>{kmTexto(m.distM)}<span className="n-u">KM</span></div>
            : <><div className="n-v n-angosta" data-n-max={256} style={{ fontSize: 92 }}>{m.entrenos}</div><div className="n-l">{m.entrenos === 1 ? 'entreno' : 'entrenos'}</div></>}
        </div>
      );
    }
    case 's-maquina': {
      const fila = (k) => (k ? (conKm ? `${k.toFixed(1)} KM` : `${Math.round(k)} MIN`) : '—');
      return (
        <div className="n-in" style={{ alignItems: 'stretch', textAlign: 'left', padding: '26px 46px' }}>
          <div className="n-mono" style={{ fontSize: 13, lineHeight: 1.8 }}>
            {DIAS_MAQUINA.map((d, i) => <div key={d} className="n-entre" style={{ width: '100%' }}><span>{d}</span><span>{fila(porDia[i])}</span></div>)}
            <div className="n-entre n-total"><span>{MAQUINA.total}</span><span>{conKm ? `${kmTexto(s.distM)} KM` : mayus(tiempoTexto(s.min))}</span></div>
          </div>
        </div>
      );
    }
    case 's-tarjeta':
      return (
        <div className="n-tj"><Topo w={288} h={408} />
          <div className="n-cont" style={{ padding: '30px 18px 24px' }}>
            <div className="n-l" style={{ letterSpacing: '.14em', fontWeight: 800 }}>{MAQUINA.semana}</div>
            <Num d={totalSemana} px={58} max={252} style={{ marginTop: 8 }} />
            <div className="n-barras" style={{ gap: 14, height: 120, marginTop: 20 }}>
              {porDia.map((k, i) => (
                  <div key={i} className="n-barra"><div className={k ? 'n-luz' : 'n-apagada'} style={{ height: k ? Math.max(8, (k / M) * 100) : 4 }} /><div className="n-l" style={{ fontSize: 11 }}>{DIAS_LETRA[i]}</div></div>
              ))}
            </div>
            <Raya style={{ marginTop: 16 }} />
            <Grupo className="n-fila" max={252} style={{ gap: 28 }}><Par d={{ l: 'Entrenos', v: s.entrenos }} px={24} lt={11.5} max={null} /><Par d={{ l: 'Tiempo', v: tiempoTexto(s.min) }} px={24} lt={11.5} max={null} /></Grupo>
            <div style={{ marginTop: 'auto' }}><Marca px={24 * 0.82} /></div>
          </div>
        </div>
      );
    default:
      return null;
  }
}

/**
 * El interior de un sticker nuevo por su familia. `cara`: la variante que se ve (`item.caras`). `frase` y `propia`: lo de los personalizables y el Polaroid.
 * Los de Totales (`item.total`) reciben en `f` los totales de hoy (`totalesDe`), no la ficha de un entreno.
 */
export default function Nuevos({ item, f, color, cara = 0, frase = '', propia = null }) {
  if (item.total) return <Totales item={item} t={f} cara={cara} />;
  if (item.familia === 'personalidad') return <Personalidad item={item} f={f} cara={cara} frase={frase} propia={propia} />;
  if (item.familia === 'discreto') return <Discreto item={item} f={f} cara={cara} />;
  if (item.familia === 'runner') return <Runner item={item} f={f} color={color} />;
  return <Tarjeta item={item} f={f} />;
}
