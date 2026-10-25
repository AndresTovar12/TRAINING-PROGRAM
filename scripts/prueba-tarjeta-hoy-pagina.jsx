/* eslint-disable react-refresh/only-export-components -- es una página suelta de pruebas, no un módulo de la app */
/* La PÁGINA de `scripts/prueba-tarjeta-hoy.mjs` (24 oct 2026). Vite la sirve desde memoria; no se sube a producción ni vive en la app.
   Dibuja las tarjetas reales de Home (`HoyTeToca`, `Cuadros`) con el nombre y la cantidad de workouts que pida la prueba, y MIDE el resultado en el DOM:
   palabras partidas a media letra, desbordes, el ancho que tiene el nombre, botones fuera de la tarjeta o encimados, renglones de una sola letra. */
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import '@/index.css';
import { FONT } from '@/lib/theme';
import { HoyTeToca, HoyTeTocaEquipo, HoyDescansas, HoyEnPausa } from '@/features/training/home/HoyTeToca';
import { CuadroDePrograma, CuadroDeSalud } from '@/features/training/home/Cuadros';

const TIPOS = ['gym', 'speed', 'correr', 'recovery', 'bici', 'yoga'];
const META = (i) => [['Gym', '8 ejercicios', '60 min'], ['Neural', '4 ejercicios', '45 min'], ['Correr', '1 ejercicio'], ['Recovery', '12 ejercicios', '90 min']][i % 4];
window.__clics = [];

/** Lo que dibuja cada variante. `nombres`: el de cada sesión (o uno solo para todas). */
function Variante({ v, nombres }) {
  const nombre = (i) => nombres[i % nombres.length];
  const n = Number(v.cuantas);
  const sesiones = Array.from({ length: n }, (_, i) => ({
    day: { cat: TIPOS[i % TIPOS.length] }, nombre: nombre(i), meta: META(i), hecha: i === 1, enMarcha: i === 2,
    ...(v.tipo === 'cada' ? { onAbrir: () => window.__clics.push(i) } : {}),
  }));
  if (v.tipo === 'programa' || v.tipo === 'cada') return <HoyTeToca sesiones={sesiones} onAbrir={() => window.__clics.push('dia')} cuando={v.cuando} />;
  if (v.tipo === 'equipo') {
    const programa = { id: 'p1', color: '#7C5CFF', profesional: { full_name: 'María de los Ángeles Hernández', profesion: 'fisioterapeuta' } };
    const entradas = [{ programa, day: { cat: 'gym' }, dayIdx: 0, partes: sesiones.slice(0, Math.max(1, Math.ceil(n / 2))).map((s, i) => ({ nombre: s.nombre, ejercicios: i + 3, minutos: '60 min', hecha: i === 1, bloque: i })) },
      ...(n > 1 ? [{ programa: { ...programa, id: 'p2' }, day: { cat: 'speed' }, dayIdx: 1, partes: sesiones.slice(Math.ceil(n / 2)).map((s, i) => ({ nombre: s.nombre, ejercicios: 1, minutos: null, hecha: false, bloque: i })) }] : [])];
    return <HoyTeTocaEquipo entradas={entradas.filter((e) => e.partes.length)} onAbrir={(e) => window.__clics.push(e.dayIdx)} conAutor={v.conAutor !== false} cuando={v.cuando} />;
  }
  if (v.tipo === 'descanso') return <HoyDescansas titulo={nombre(0)} siguiente={`Sigue: viernes · ${nombre(1)}`} boton="Ver mi plan" onVerPlan={() => {}} />;
  if (v.tipo === 'pausa') return <HoyEnPausa etiqueta={nombre(0)} texto={`${nombre(1)} el lunes`} onReanudar={() => {}} />;
  if (v.tipo === 'cuadros') {
    return (
      <div id="rejilla" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
        <CuadroDePrograma etiqueta="Fase 2" titulo={nombre(0)} sub={`Semana 3 de 12 · ${nombre(1)}`} fases={4} actual={1} onAbrir={() => {}} />
        <CuadroDeSalud dolor={null} reloj={{ lectura: { titulo: nombre(2) }, recientes: {} }} onAbrir={() => {}} />
      </div>
    );
  }
  return null;
}

function Pagina({ v }) {
  const nombres = Array.isArray(v.nombres) ? v.nombres : [v.nombres];
  // El mismo relleno que Home (`padding: 16px 18px 0`).
  return (
    <div id="home" style={{ width: v.ancho, boxSizing: 'border-box', padding: '16px 18px 18px', fontFamily: FONT, background: '#F3F4F8' }}>
      <Variante v={v} nombres={nombres} />
    </div>
  );
}

const raiz = createRoot(document.getElementById('app'));
window.montar = async (v) => {
  document.body.style.margin = '0';
  flushSync(() => raiz.render(<Pagina v={v} />));
  await document.fonts.ready;
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
};

/* ───────────── medición ───────────── */

/** Los renglones de un texto: [{ texto, chars }] solo de lo que se ve (lo cortado por el tope de líneas no cuenta). */
function lineasDe(el) {
  const marco = el.getBoundingClientRect();
  const alto = parseFloat(getComputedStyle(el).lineHeight) || parseFloat(getComputedStyle(el).fontSize) * 1.2;
  const chars = [];
  const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let previoEsEspacio = true;
  for (let nodo = tw.nextNode(); nodo; nodo = tw.nextNode()) {
    const t = nodo.textContent;
    let i = 0;
    for (const c of t) {
      const largo = c.length;
      if (/\s/.test(c)) { previoEsEspacio = true; i += largo; continue; }
      const rg = document.createRange();
      rg.setStart(nodo, i); rg.setEnd(nodo, i + largo);
      const rc = rg.getClientRects()[0];
      if (rc && rc.width > 0) chars.push({ c, y: (rc.top + rc.bottom) / 2, nuevaPalabra: previoEsEspacio || /[-–—/]/.test(chars.at(-1)?.c ?? ''), x2: rc.right });
      previoEsEspacio = false;
      i += largo;
    }
  }
  const lineas = [];
  for (const ch of chars) {
    if (ch.y > marco.bottom - 1) continue; // cortado por el tope de líneas
    const l = lineas.find((x) => Math.abs(x.y - ch.y) < alto * 0.5);
    if (l) { l.chars.push(ch); } else lineas.push({ y: ch.y, chars: [ch] });
    ch.linea = (l ?? lineas.at(-1));
  }
  const palabras = [];
  for (const ch of chars.filter((x) => x.linea)) {
    if (ch.nuevaPalabra || !palabras.length) palabras.push([]);
    palabras.at(-1).push(ch);
  }
  for (const l of lineas) { l.texto = l.chars.map((x) => x.c).join(''); l.n = l.chars.length; }
  return { lineas, palabras, recortado: el.scrollHeight - el.clientHeight > 1 };
}

/** Ancho que tendría `texto` en una sola línea con la letra de `el` pero a `px` de tamaño. */
function anchoNatural(el, texto, px) {
  const cs = getComputedStyle(el);
  const s = document.createElement('span');
  Object.assign(s.style, { position: 'absolute', visibility: 'hidden', whiteSpace: 'nowrap', fontFamily: cs.fontFamily, fontWeight: cs.fontWeight, letterSpacing: cs.letterSpacing, fontSize: `${px}px`, fontFeatureSettings: cs.fontFeatureSettings });
  s.textContent = texto;
  el.parentNode.appendChild(s);
  const w = s.getBoundingClientRect().width;
  s.remove();
  return w;
}

/**
 * Devuelve la lista de problemas ([] si todo bien). `esperados`: los textos de los nombres que deben verse. `minNombre`: la parte del ancho de la tarjeta que debe tener el nombre.
 * Una palabra solo puede estar partida si NI CON LA LETRA MÍNIMA (15 px) cabría en la columna del nombre.
 */
window.mide = ({ raizId = 'home', minNombre = 0.6, altoMaximo = 900, minLetra = 15, esperados = [] } = {}) => {
  const problemas = [];
  const casa = document.getElementById(raizId);
  const tarjetas = [...casa.querySelectorAll('article, #rejilla > button')];
  if (!tarjetas.length) return ['no se dibujó ninguna tarjeta'];
  if (document.documentElement.scrollWidth > window.innerWidth + 0.5) problemas.push(`la página se desborda a lo ancho (${document.documentElement.scrollWidth} > ${window.innerWidth})`);
  for (const t of tarjetas) {
    const r = t.getBoundingClientRect();
    if (r.height > altoMaximo) problemas.push(`la tarjeta crece demasiado (${Math.round(r.height)} px)`);
    for (const el of t.querySelectorAll('*')) {
      const e = el.getBoundingClientRect();
      if (e.width === 0 && e.height === 0) continue;
      if (e.right > r.right + 0.5 || e.left < r.left - 0.5) problemas.push(`<${el.tagName.toLowerCase()}${el.className ? `.${String(el.className).split(' ')[0]}` : ''}> se sale de la tarjeta (${Math.round(e.left - r.left)}…${Math.round(e.right - r.right)})`);
    }
    // El nombre se busca por SU TEXTO, no por la clase que hoy lo dibuja: si alguien lo vuelve a dibujar a mano, esta prueba lo sigue midiendo.
    const nombres = [...t.querySelectorAll('*')].filter((el) => !el.children.length && esperados.includes(el.textContent.trim()));
    if (esperados.length && !nombres.length) problemas.push('no se encontró el nombre en la tarjeta');
    const botones = [...t.querySelectorAll('button')].concat(t.tagName === 'BUTTON' ? [t] : []);
    for (const b of t.tagName === 'ARTICLE' ? botones : []) {
      const e = b.getBoundingClientRect();
      if (e.width < 30 || e.height < 30) problemas.push(`un botón es demasiado chico (${Math.round(e.width)}×${Math.round(e.height)})`);
      if (e.left < r.left - 0.5 || e.right > r.right + 0.5 || e.top < r.top - 0.5 || e.bottom > r.bottom + 0.5) problemas.push('un botón no está dentro de la tarjeta');
      for (const n of nombres) {
        const q = n.getBoundingClientRect();
        if (b.contains(n)) continue;
        if (Math.min(e.right, q.right) - Math.max(e.left, q.left) > 1 && Math.min(e.bottom, q.bottom) - Math.max(e.top, q.top) > 1) problemas.push('un botón se encima al nombre');
      }
    }
    for (const n of nombres) {
      const texto = n.textContent;
      const q = n.getBoundingClientRect();
      if (minNombre && t.tagName === 'ARTICLE' && q.width / r.width < minNombre) problemas.push(`el nombre solo tiene el ${Math.round((q.width / r.width) * 100)} % del ancho de la tarjeta («${texto.slice(0, 20)}…»)`);
      const { lineas, palabras } = lineasDe(n);
      // Una palabra que ni con la letra mínima cabe en la columna se parte donde haga falta (último recurso): sus renglones no se juzgan.
      const legitimas = new Set();
      for (const p of palabras) {
        const rs = new Set(p.map((x) => x.linea));
        if (rs.size < 2) continue;
        const w = p.map((x) => x.c).join('');
        if (anchoNatural(n, w, minLetra) <= n.clientWidth - 1) problemas.push(`palabra partida «${w}» aunque cabía (columna ${Math.round(n.clientWidth)} px, letra ${getComputedStyle(n).fontSize})`);
        else for (const l of rs) legitimas.add(l);
      }
      if (lineas.length > 1) {
        for (const l of lineas) if (l.n <= 1 && !legitimas.has(l)) problemas.push(`un renglón con un solo carácter «${l.texto}» en «${texto.slice(0, 30)}…»`);
      }
    }
    // El «● Tipo · 4 ejercicios · 60 min»: ni el punto solo ni un renglón que empiece con «·».
    for (const m of t.querySelectorAll('.texto-largo')) {
      const { lineas } = lineasDe(m);
      for (const l of lineas) if (/^·/.test(l.texto) && lineas.length > 1) problemas.push(`un renglón empieza con «·»: «${l.texto}»`);
      const punto = m.querySelector('i');
      if (punto && lineas.length) {
        const pr = punto.getBoundingClientRect();
        const pc = (pr.top + pr.bottom) / 2;
        const primera = m.getBoundingClientRect();
        if (pc > primera.top + parseFloat(getComputedStyle(m).lineHeight) * 1.2) problemas.push('el punto de color quedó solo en otro renglón');
      }
    }
  }
  return problemas;
};
