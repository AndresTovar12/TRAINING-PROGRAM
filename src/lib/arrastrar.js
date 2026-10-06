/**
 * ARRASTRAR PARA CAMBIAR DE ORDEN (fases, Sets, ejercicios, workouts), sin librerías.
 *
 * Andrés, 5 oct 2026, con la maqueta aprobada: «mover = arrastrar», sin flechitas ↑↓ ni manijas ⠿. Se agarra la fila
 * misma, desde cualquier parte suya que no tenga una función propia.
 *
 *   · Lo que tiene función propia (campos, botones, listas, etiquetas) NO arrastra: se sigue escribiendo y tocando igual. El
 *     elemento más interno gana: agarrar un ejercicio mueve el ejercicio; agarrar el hueco del Set mueve el Set.
 *   · Con el mouse empieza al mover 5 px (un clic sin mover sigue siendo clic; después de arrastrar se ignora el clic).
 *   · Con el dedo hay que MANTENER presionado 320 ms y luego arrastrar; si el dedo se mueve más de 9 px antes, es desplazar
 *     la pantalla y no se arrastra. Vibra un instante donde se puede.
 *   · Mientras se arrastra: un «fantasma» con el nombre sigue al puntero, el original se queda atenuado, una línea azul
 *     enseña dónde caerá, el área se desplaza sola cerca de su borde y Esc cancela.
 *   · Solo dentro de su lugar: un ejercicio se mueve dentro de su Set, un Set dentro de su sesión, una fase entre las fases.
 *
 * Cómo se usa: el que PINTA una lista le da a cada elemento
 *     <div {...propsDeArrastre({ lista: 'sets:ab', etiqueta: 'Set 2', alMover: (de, a) => … })}>
 * `lista` identifica la lista (todos los de la misma, en el orden en que salen en pantalla, son sus hermanos); `alMover(de, a)`
 * recibe de qué lugar a qué lugar quedó (`a` ya descuenta que el elemento sale de su lugar: es el índice final).
 * `agarraDeBotones`: también se agarra desde los botones del propio elemento (un clic sin mover sigue haciendo lo suyo),
 * para las tarjetas cuyo encabezado es casi todo botones.
 *
 * Es un solo motor para toda la app (solo hay un puntero arrastrando a la vez): los oyentes se instalan la primera vez.
 */
const INTERACTIVO = 'input, textarea, select, button, a, label, summary, [contenteditable="true"], [role="button"], [role="menuitem"], [role="slider"], [data-sin-arrastre]';
const UMBRAL_MOUSE = 5; // px
const ESPERA_DEDO = 320; // ms
const MOVIDA_DEDO = 9; // px
const BORDE = 56; // px del borde de la zona que se desplaza donde empieza a desplazarse sola
const PASO = 14; // px por vuelta (cada 16 ms)

const ESTILOS = `
[data-arrastre]{cursor:grab}
[data-arrastre] input,[data-arrastre] textarea{cursor:text}
[data-arrastre] button,[data-arrastre] select,[data-arrastre] label,[data-arrastre] a,[data-arrastre] [role="button"]{cursor:pointer}
body.tl-arrastrando,body.tl-arrastrando *{cursor:grabbing !important;user-select:none !important;-webkit-user-select:none !important}
.tl-suelto{opacity:.35 !important;background:#E8ECFD !important}
.tl-fantasma{position:fixed;left:0;top:0;z-index:6200;pointer-events:none;display:flex;align-items:center;max-width:360px;padding:9px 14px;background:#fff;border:1.5px solid #1E40E0;border-radius:12px;box-shadow:0 16px 44px rgba(17,19,24,0.13);font:800 14px Inter,-apple-system,system-ui,sans-serif;color:#111318;transform:rotate(-.6deg)}
.tl-fantasma span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tl-linea-ins{position:fixed;z-index:6190;pointer-events:none;background:#1E40E0;border-radius:2px;box-shadow:0 0 0 3px rgba(30,64,224,0.16)}
`;

let instalado = false;
let arr = null; // el arrastre en curso
let finDelUltimo = 0; // cuándo terminó el último (para ignorar el clic que le sigue)

const hermanos = (lista) => [...document.querySelectorAll(`[data-arrastre="${String(lista).replace(/"/g, '\\"')}"]`)];

// La zona que se desplaza: el ancestro más cercano con desplazamiento vertical, o la página.
function zonaQueSeDesplaza(el) {
  for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
    const oy = getComputedStyle(n).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && n.scrollHeight > n.clientHeight) return n;
  }
  return document.scrollingElement || document.documentElement;
}

function calculaDestino() {
  const hs = hermanos(arr.cfg.lista);
  if (!hs.length) return;
  const rects = hs.map((h) => h.getBoundingClientRect());
  // En tarjetas de varias columnas el lugar se busca por cercanía y la línea es vertical.
  const enRejilla = hs.length > 1 && rects.some((r) => Math.abs(r.left - rects[0].left) > 8);
  let idx = hs.length;
  if (enRejilla) {
    let mejor = Infinity;
    rects.forEach((r, i) => {
      const d = Math.hypot(arr.x - (r.left + r.width / 2), arr.y - (r.top + r.height / 2));
      if (d < mejor) { mejor = d; idx = arr.x > r.left + r.width / 2 ? i + 1 : i; }
    });
  } else {
    for (let i = 0; i < rects.length; i += 1) {
      if (arr.y < rects[i].top + rects[i].height / 2) { idx = i; break; }
    }
  }
  arr.destino = idx;
  const ref = rects[Math.min(idx, rects.length - 1)];
  arr.linea.style.cssText = enRejilla
    ? `top:${ref.top}px;height:${ref.height}px;width:3px;left:${idx < hs.length ? ref.left - 6 : ref.right + 3}px`
    : `height:3px;width:${ref.width}px;left:${ref.left}px;top:${idx < hs.length ? ref.top - 5 : ref.bottom + 3}px`;
}

const posicionaFantasma = () => {
  arr.fantasma.style.transform = `translate(${arr.x + 14}px, ${arr.y - (arr.tactil ? 64 : 18)}px) rotate(-.6deg)`;
};

function arranca() {
  if (arr.espera) { clearTimeout(arr.espera); arr.espera = null; }
  arr.vivo = true;
  try { window.getSelection().removeAllRanges(); } catch { /* sin selección que quitar */ }
  if (arr.tactil && navigator.vibrate) { try { navigator.vibrate(12); } catch { /* sin vibración */ } }
  try { arr.item.setPointerCapture?.(arr.id); } catch { /* el puntero ya no existe */ }
  document.body.classList.add('tl-arrastrando');
  arr.item.classList.add('tl-suelto');
  const f = document.createElement('div');
  f.className = 'tl-fantasma';
  const t = document.createElement('span');
  t.textContent = typeof arr.cfg.etiqueta === 'function' ? arr.cfg.etiqueta() : (arr.cfg.etiqueta || '');
  f.appendChild(t);
  document.body.appendChild(f);
  arr.fantasma = f;
  const l = document.createElement('i');
  l.className = 'tl-linea-ins';
  document.body.appendChild(l);
  arr.linea = l;
  posicionaFantasma();
  calculaDestino();
  arr.scroll = setInterval(() => {
    const r = arr.zona.getBoundingClientRect();
    const arriba = arr.zona === document.scrollingElement || arr.zona === document.documentElement ? 0 : r.top;
    const abajo = arr.zona === document.scrollingElement || arr.zona === document.documentElement ? window.innerHeight : r.bottom;
    if (arr.y < arriba + BORDE) { arr.zona.scrollTop -= PASO; calculaDestino(); } else if (arr.y > abajo - BORDE) { arr.zona.scrollTop += PASO; calculaDestino(); }
  }, 16);
}

function termina(aplica) {
  if (!arr) return;
  const a = arr;
  arr = null;
  clearInterval(a.scroll);
  clearTimeout(a.espera);
  document.body.classList.remove('tl-arrastrando');
  a.fantasma?.remove();
  a.linea?.remove();
  try { a.item.releasePointerCapture?.(a.id); } catch { /* ya soltado */ }
  if (!a.vivo) return;
  finDelUltimo = Date.now();
  // Si el elemento se desmontó mientras se arrastraba, no hay nada que mover.
  if (!a.item.isConnected) return;
  a.item.classList.remove('tl-suelto');
  if (!aplica) return;
  const hs = hermanos(a.cfg.lista);
  const de = hs.indexOf(a.item);
  const destino = a.destino;
  if (de < 0 || destino == null || destino === de || destino === de + 1) return;
  a.cfg.alMover(de, destino > de ? destino - 1 : destino);
}

function alMoverPuntero(ev) {
  if (!arr || ev.pointerId !== arr.id) return;
  arr.x = ev.clientX;
  arr.y = ev.clientY;
  if (!arr.vivo) {
    const mov = Math.hypot(arr.x - arr.x0, arr.y - arr.y0);
    // Con el dedo, moverse antes de que pase la espera es desplazar la pantalla.
    if (arr.tactil) { if (mov > MOVIDA_DEDO) termina(false); return; }
    if (mov <= UMBRAL_MOUSE) return;
    arranca();
  }
  posicionaFantasma();
  calculaDestino();
}

function instala() {
  if (instalado || typeof document === 'undefined') return;
  instalado = true;
  const css = document.createElement('style');
  css.setAttribute('data-arrastre-estilos', '');
  css.textContent = ESTILOS;
  document.head.appendChild(css);
  document.addEventListener('pointermove', alMoverPuntero);
  document.addEventListener('pointerup', (ev) => { if (arr && ev.pointerId === arr.id) termina(true); });
  document.addEventListener('pointercancel', (ev) => { if (arr && ev.pointerId === arr.id) termina(false); });
  // Con el arrastre ya vivo el dedo no debe desplazar la pantalla.
  document.addEventListener('touchmove', (ev) => { if (arr?.vivo && ev.cancelable) ev.preventDefault(); }, { passive: false });
  // El menú que Android abre al mantener presionado, no.
  document.addEventListener('contextmenu', (ev) => { if (arr?.tactil) ev.preventDefault(); });
  document.addEventListener('keydown', (ev) => {
    if (arr?.vivo && ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); termina(false); }
  }, true);
  // El clic que sigue a soltar un arrastre no es un clic.
  document.addEventListener('click', (ev) => {
    if (Date.now() - finDelUltimo < 250) { ev.stopPropagation(); ev.preventDefault(); }
  }, true);
}

function empieza(ev, cfg) {
  if (arr || ev.button > 0 || ev.isPrimary === false) return;
  const item = ev.currentTarget;
  const propio = ev.target?.closest?.(INTERACTIVO);
  // Lo que tiene función propia sigue haciendo lo suyo (y deja pasar el gesto a quien lo contiene, que también lo ignora).
  if (propio && item.contains(propio) && propio !== item && !(cfg.agarraDeBotones && propio.tagName === 'BUTTON')) return;
  // El más interno gana: el que contiene a este no empieza otro arrastre.
  ev.stopPropagation();
  instala();
  arr = {
    item, cfg, id: ev.pointerId, x0: ev.clientX, y0: ev.clientY, x: ev.clientX, y: ev.clientY, vivo: false,
    tactil: ev.pointerType === 'touch', espera: null, zona: zonaQueSeDesplaza(item),
  };
  if (arr.tactil) arr.espera = setTimeout(() => { if (arr && !arr.vivo) arranca(); }, ESPERA_DEDO);
}

/** Lo que se le pone a un elemento para poder agarrarlo y moverlo dentro de su lista. Ver el comentario de arriba. */
export const propsDeArrastre = (cfg) => ({
  'data-arrastre': cfg.lista,
  onPointerDown: (ev) => empieza(ev, cfg),
});

/** Mueve un elemento de un lugar a otro de una lista, sin tocar la original: `a` es el índice final. */
export const mueveEn = (lista, de, a) => {
  if (de === a || de < 0 || de >= lista.length) return lista;
  const copia = [...lista];
  const [x] = copia.splice(de, 1);
  copia.splice(Math.max(0, Math.min(a, copia.length)), 0, x);
  return copia;
};
