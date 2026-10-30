/**
 * EL ACOMODO DE UN PASO DEL ENTRENO (Andrés, 30 oct 2026: «que la aplicación solita detecte cuánto espacio se necesita para mostrar todos los datos y se
 * acomode todo de tal forma que se vea todo correctamente»). Prototipo aprobado: docs/maquetas/2026-10-30-entreno-que-se-acomoda.src.html.
 *
 * Se mide el alto que queda entre la barra de arriba y la de abajo y se reparte, en este orden:
 *   1. Dónde va el video: uno de pie, al lado de la serie y las cifras (los videos de pie dejan aire a los lados); si no cabe, arriba. Acostado, arriba.
 *   2. Con la letra normal, el video crece hasta llenar o hasta su tope.
 *   3. Si aún sobra, TODO crece junto (`--k` hasta 1.4; sin video, hasta 1.8): nombre, serie, cifras y la nota del coach. Sin video, luego el bloque de la
 *      serie y las cifras crece de alto (`--vh`) hasta llenar.
 *   4. Lo poco que quede se reparte entre los huecos (`--extra`, hasta 20 px).
 * Si falta, al revés: la letra baja hasta 0.74 con el video en su mínimo; luego el video se hace chico (72 px) y, al final, la nota se corta a 3 renglones
 * con «Ver la nota completa» (`data-corta`). «Cabe» es no pasarse de alto Y que nada marcado `.pa-nocorta` se corte de lado («Serie 4 de 5»).
 *
 * Todo se hace sobre el DOM, sin volver a dibujar con React: se cambian variables de CSS (`--k`, `--vh`, `--extra`, `--ancho`) y `data-modo`, y se mide.
 * Las reglas de cómo se ve cada modo están en `index.css` (`.pa`). `scroll`: el contenedor que se desplaza (su alto es el espacio); `pa`: el paso.
 * La forma del video la dice su tarjeta en `data-aspecto` (ancho / alto).
 */
export function acomodaPaso(scroll, pa) {
  if (!scroll || !pa) return null;
  const estilo = getComputedStyle(scroll);
  const H = scroll.clientHeight - parseFloat(estilo.paddingTop || 0) - parseFloat(estilo.paddingBottom || 0);
  const W = pa.clientWidth;
  if (H <= 0 || W <= 0) return null;
  pa.style.setProperty('--ancho', `${W}px`);
  const caja = pa.querySelector('[data-aspecto]');
  const aspecto = caja ? Number(caja.dataset.aspecto) || 0.8 : 0;
  const hayVideo = !!pa.querySelector('.pa-vid');
  const dePie = aspecto > 0 && aspecto < 0.9;
  const modos = !hayVideo ? ['sin'] : dePie ? ['lado', 'arriba'] : ['arriba'];
  const conVideo = (modo) => modo === 'lado' || modo === 'arriba';
  const vmin = !hayVideo ? 0 : dePie ? 170 : 110;
  const vmax = (modo) => (modo === 'lado' ? Math.min((W * 0.62) / aspecto, H * 0.7) : dePie ? H * 0.45 : Math.min(W / (aspecto || 1.6), H * 0.45));

  const pon = (k, modo, vh, extra = 0, corta = false) => {
    pa.dataset.modo = modo;
    pa.dataset.corta = corta ? '1' : '0';
    pa.style.setProperty('--k', String(k));
    pa.style.setProperty('--vh', `${vh}px`);
    pa.style.setProperty('--extra', `${extra}px`);
  };
  const cabe = () => scroll.scrollHeight <= scroll.clientHeight + 0.5
    && [...pa.querySelectorAll('.pa-nocorta')].every((e) => e.scrollWidth <= e.clientWidth + 1);
  const prueba = (k, modo, vh, extra = 0, corta = false) => { pon(k, modo, vh, extra, corta); return cabe(); };
  // El más grande que cabe, por mitades (`ok(lo)` ya se sabe verdadero).
  const maximo = (lo, hi, ok, vueltas = 10) => {
    for (let i = 0; i < vueltas && hi - lo > 0.01; i++) { const m = (lo + hi) / 2; if (ok(m)) lo = m; else hi = m; }
    return lo;
  };

  let r = null;
  for (const modo of modos) {
    const v0 = conVideo(modo) ? vmin : 0;
    if (!prueba(1, modo, v0)) continue;
    const vh = conVideo(modo) ? maximo(vmin, Math.max(vmin, vmax(modo)), (v) => prueba(1, modo, v)) : 0;
    const k = maximo(1, modo === 'sin' ? 1.8 : 1.4, (x) => prueba(x, modo, vh));
    // Sin video, lo elástico es el bloque de la serie y las cifras: crece de alto (`--vh` es su alto mínimo) hasta llenar.
    const vhFinal = modo === 'sin' ? maximo(0, H, (v) => prueba(k, modo, v)) : vh;
    const extra = maximo(0, 20, (e) => prueba(k, modo, vhFinal, e), 7);
    r = { modo, vh: vhFinal, k, extra, corta: false };
    break;
  }
  if (!r) {
    for (const modo of modos) {
      const v0 = conVideo(modo) ? vmin : 0;
      if (!prueba(0.74, modo, v0)) continue;
      const k = maximo(0.74, 1, (x) => prueba(x, modo, v0));
      if (!r || k > r.k) r = { modo, vh: v0, k, extra: 0, corta: false };
    }
    if (r && conVideo(r.modo)) r.vh = maximo(vmin, Math.max(vmin, vmax(r.modo)), (v) => prueba(r.k, r.modo, v));
  }
  if (!r) {
    // Ni con la letra mínima: el video chico arriba y, si aún no cabe, la nota cortada. Si ni así, se desplaza (nunca se esconde nada).
    const modo = hayVideo ? 'arriba' : 'sin';
    const vh = hayVideo ? 72 : 0;
    if (prueba(0.74, modo, vh)) r = { modo, vh, k: maximo(0.74, 1, (x) => prueba(x, modo, vh)), extra: 0, corta: false };
    else r = { modo, vh, k: 0.74, extra: 0, corta: true };
  }
  pon(r.k, r.modo, r.vh, r.extra, r.corta);
  return r;
}
