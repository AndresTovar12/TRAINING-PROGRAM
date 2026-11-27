import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Capacitor } from '@capacitor/core';
import { Check, Copy, Download, Plus, Share, Trash2, X } from 'lucide-react';
import { COLORES, esNuevo, lienzoDe } from '@/lib/stickers/catalogo';
import { entregaArchivo } from '@/lib/entregaArchivo';
import { aHistoriaDeInstagram, guardaEnFotos, hayCarrete } from '@/lib/carreteNativo';
import { vibra } from '@/lib/avisosNativos';
import Sticker from './Sticker';
import Mosaico from './Mosaico';
import HojaDeFrases from './HojaDeFrases';
import { HISTORIA, MARCA_HISTORIA, historiaDeCarrete } from './exporta';

/* EL EDITOR DE CARRETE (Andrés, 24 nov 2026; maqueta docs/maquetas/editor-de-stickers, dirección «A · Marca»). Como el de Aura, con cara de Training Lab:
   tu foto de fondo, encima los stickers que quieras. Cada uno se arrastra, se pellizca (agranda y gira) y se borra llevándolo al bote. Un toque a un sticker
   abre su color DENTRO de la hoja (él: «la bolita de color… debería ir adentro donde escoges los stickers»). «TRAINING LAB» va UNA vez abajo de la imagen:
   por eso aquí los stickers salen sin su marca. La imagen sale de 1080 × 1920 (`historiaDeCarrete`): lo que se ve es lo que sale, porque el lienzo es 9:16 y
   todo se guarda en fracciones de su ancho y alto.

   `foto`: la foto elegida (un enlace `blob:` local; nunca sale del teléfono). `items` / `itemsTot`: el catálogo de Actividad y de Totales. `f` / `totales`: sus
   fichas. `frase`: la de «✎ Personalizar» con la que arranca la lista (cada pegado guarda la suya). */

// El editor recorta con `overflow: clip` y no `hidden`: con `hidden` el navegador desplazaba la pantalla para enseñar un botón de la hoja cerrada (la foto
// se recorría hacia arriba). La hoja cerrada además es `inert`.
const VIDRIO = { background: 'rgba(38,38,42,.52)', WebkitBackdropFilter: 'blur(22px) saturate(170%)', backdropFilter: 'blur(22px) saturate(170%)', boxShadow: 'inset 0 0 0 .5px rgba(255,255,255,.1)' }; // estilo-ok: diseño A · Marca aprobado por Andrés (24 nov 2026, maqueta editor-de-stickers)
const CURVA = 'cubic-bezier(.32,.72,0,1)';
const SALE = 'cubic-bezier(.23,1,.32,1)';
const SF = '-apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, system-ui, sans-serif';
const BARRA = 84; // la barra de abajo, sin contar la zona segura
const S_INICIAL = 0.62; // un sticker nuevo ocupa el 62 % del ancho
const S_MIN = 0.12;
const S_MAX = 2.4;
const BOTE_RADIO = 56;
const FONDO_OSCURO = { background: '#18181B' };
const FONDO_CLARO = { background: '#E8E8EC' };
const puedeCopiar = () => !!(navigator.clipboard?.write && typeof window.ClipboardItem === 'function');
const altoDe = (item) => lienzoDe(item).h;

/** Lo que mide un elemento (ancho y alto), al cambiar. Con un ref de función: mide también lo que aparece después (la vista de «Su color»). */
function useMedida() {
  const [el, setEl] = useState(null);
  const [m, setM] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    if (!el) return undefined;
    const mide = () => setM({ w: el.clientWidth, h: el.clientHeight });
    mide();
    if (typeof ResizeObserver !== 'function') return undefined;
    const ro = new ResizeObserver(mide);
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return [setEl, m];
}

/** La fila de colores (dentro de la hoja). `fijo`: ese sticker no cambia de color. */
function Colores({ elegido, alElegir, fijo = false, texto }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 4px 2px', flex: 'none' }}>
      {COLORES.map((c, i) => (
        <button
          key={c.id} type="button" onClick={() => alElegir(i)} disabled={fijo} aria-pressed={elegido === i} aria-label={`Tinta ${c.nombre.toLowerCase()}`}
          style={{
            width: 30, height: 30, borderRadius: '50%', border: 'none', padding: 0, background: c.tinta, cursor: fijo ? 'default' : 'pointer', opacity: fijo ? 0.3 : 1,
            boxShadow: elegido === i && !fijo ? '0 0 0 2.5px #1E1E22, 0 0 0 4.5px #fff' : 'inset 0 0 0 1px rgba(255,255,255,.18)', transition: `box-shadow .16s ${SALE}`, // estilo-ok: diseño A · Marca aprobado por Andrés (24 nov 2026, maqueta editor-de-stickers)
          }}
        />
      ))}
      <span style={{ marginLeft: 'auto', fontSize: 13, color: 'rgba(255,255,255,.5)', fontWeight: 500 }}>{fijo ? 'No cambia de color' : texto}</span>
    </div>
  );
}

export default function EditorDeCarrete({ foto, items, itemsTot, f, totales, frase, alCambiarFrase, capa = 3400, alCerrar }) {
  const [abierto, setAbierto] = useState(false);
  const [pegados, setPegados] = useState([]); // [{ k, item, total, colorI, cx, cy, s, r, z }]
  const [elegir, setElegir] = useState(null); // null | { modo: 'nuevo' } | { modo: 'color', k }
  const [sub, setSub] = useState('actividad');
  const [colorNuevo, setColorNuevo] = useState(0);
  const [arrastrando, setArrastrando] = useState(false);
  const [sobreBote, setSobreBote] = useState(false);
  const [guia, setGuia] = useState(false);
  const [armando, setArmando] = useState(null); // el botón que espera la imagen
  const [compartir, setCompartir] = useState(null); // { url } de la vista previa
  const [aviso, setAviso] = useState(null);
  /* LA FRASE DE CADA STICKER (27 nov 2026). Andrés: personalizar uno cambiaba los que ya estaban pegados. Ahora cada pegado guarda la suya (`p.frase`) desde que se
     pone; «✎ Personalizar» de un pegado cambia solo ese. La de la lista (`fraseNueva`) es la que llevará el siguiente que se ponga. */
  const [fraseNueva, setFraseNueva] = useState(frase);
  const [frases, setFrases] = useState(null); // «✎ Personalizar»: null | 'lista' | la `k` del pegado
  const [rejillaMedida, rejilla] = useMedida();
  const [colorMedida, cajaColor] = useMedida();
  const [zonaRef, zona] = useMedida();
  const rejillaRef = useRef(null);
  const boteRef = useRef(null);
  const gesto = useRef(null);
  const sobreRef = useRef(false);
  const sigue = useRef(1);
  const hecha = useRef({ firma: '', blob: null });
  const reloj = useRef(0);
  const enApp = Capacitor.isNativePlatform();

  // El lienzo: 9:16, lo más grande que quepa arriba de la barra.
  const W = zona.w && zona.h ? Math.min(zona.w, (zona.h * HISTORIA.w) / HISTORIA.h) : 0;
  const H = (W * HISTORIA.h) / HISTORIA.w;

  useEffect(() => {
    const r = requestAnimationFrame(() => requestAnimationFrame(() => setAbierto(true)));
    // Recién entrando, la hoja de stickers ya abierta: lo primero es elegir uno.
    const t = setTimeout(() => setElegir({ modo: 'nuevo' }), 320);
    return () => { cancelAnimationFrame(r); clearTimeout(t); clearTimeout(reloj.current); };
  }, []);
  useEffect(() => () => { if (compartir?.url) URL.revokeObjectURL(compartir.url); }, [compartir]);

  const avisa = (texto, error = false) => {
    clearTimeout(reloj.current);
    setAviso({ texto, error });
    reloj.current = setTimeout(() => setAviso(null), 2600);
  };
  const cierra = () => { setAbierto(false); setTimeout(alCerrar, 260); };

  const colorDe = (p) => COLORES[p.colorI] ?? COLORES[0];
  const fichaDe = (p) => (p.total ? totales : f);
  const propiaDe = (p) => (p.item.conFoto ? foto : null);

  const agrega = (item, total, cara = 0) => {
    vibra('toque');
    setPegados((ps) => [...ps, { k: sigue.current, item, total, cara, frase: fraseNueva, colorI: item.fija ? 0 : colorNuevo, cx: 0.5, cy: 0.36 + 0.1 * (ps.length % 4), s: S_INICIAL, r: 0, z: sigue.current }]);
    sigue.current += 1;
    setElegir(null);
  };
  const cambia = (k, cambios) => setPegados((ps) => ps.map((p) => (p.k === k ? { ...p, ...cambios } : p)));

  /* ---- El gesto sobre un sticker: un dedo lo mueve, dos lo agrandan y lo giran. Mientras dura, se mueve el elemento directo (sin dibujar de nuevo la app)
     y al soltar se guarda. Un toque corto abre su color. ---- */
  const aplica = (g) => {
    const { p } = g;
    g.el.style.left = `${p.cx * W}px`;
    g.el.style.top = `${p.cy * H}px`;
    g.el.style.transform = `translate(-50%, -50%) rotate(${p.r}deg) scale(${(p.s * W) / 300})`;
  };
  const rebase = (g) => { g.base = { p: { ...g.p }, dedos: new Map(g.dedos) }; };
  const empieza = (ev, p) => {
    ev.stopPropagation();
    const el = ev.currentTarget;
    el.setPointerCapture?.(ev.pointerId);
    let g = gesto.current;
    if (!g || g.k !== p.k) {
      g = { k: p.k, el, p: { ...p }, dedos: new Map(), t0: ev.timeStamp, movido: false };
      gesto.current = g;
      const z = sigue.current;
      sigue.current += 1;
      el.style.zIndex = String(z);
      g.p.z = z;
    }
    g.dedos.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    rebase(g);
  };
  // Un segundo dedo fuera del sticker también cuenta (para pellizcar uno chico).
  const otroDedo = (ev) => {
    const g = gesto.current;
    if (!g || g.dedos.has(ev.pointerId) || g.dedos.size >= 2) return;
    ev.currentTarget.setPointerCapture?.(ev.pointerId);
    g.dedos.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    rebase(g);
  };
  const solo = (fn) => (ev) => { ev.stopPropagation(); fn(ev); };
  const mueve = (ev) => {
    const g = gesto.current;
    if (!g || !g.dedos.has(ev.pointerId)) return;
    g.dedos.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    const ahora = [...g.dedos.values()];
    const antes = [...g.base.dedos.values()];
    if (ahora.length >= 2 && antes.length >= 2) {
      const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
      const ang = (a, b) => (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
      g.p.s = Math.min(S_MAX, Math.max(S_MIN, (g.base.p.s * d(ahora[0], ahora[1])) / Math.max(1, d(antes[0], antes[1]))));
      g.p.r = g.base.p.r + ang(ahora[0], ahora[1]) - ang(antes[0], antes[1]);
      g.movido = true;
    } else {
      const id = [...g.dedos.keys()][0];
      const o = g.base.dedos.get(id) ?? ahora[0];
      const dx = ahora[0].x - o.x;
      const dy = ahora[0].y - o.y;
      if (!g.movido && Math.hypot(dx, dy) > 6) { g.movido = true; setArrastrando(true); setElegir(null); }
      if (!g.movido) return;
      g.p.cx = g.base.p.cx + dx / W;
      g.p.cy = g.base.p.cy + dy / H;
      // Se pega al centro, con la línea azul.
      const centrado = Math.abs(g.p.cx - 0.5) * W < 7;
      if (centrado) g.p.cx = 0.5;
      setGuia(centrado);
      const b = boteRef.current?.getBoundingClientRect();
      const encima = !!b && Math.hypot(ev.clientX - (b.left + b.width / 2), ev.clientY - (b.top + b.height / 2)) < BOTE_RADIO;
      if (encima !== sobreRef.current) { sobreRef.current = encima; setSobreBote(encima); if (encima) vibra('toque'); }
      g.el.style.opacity = encima ? '0.4' : '';
    }
    aplica(g);
  };
  const suelta = (ev) => {
    const g = gesto.current;
    if (!g || !g.dedos.has(ev.pointerId)) return;
    g.dedos.delete(ev.pointerId);
    if (g.dedos.size) { rebase(g); return; }
    gesto.current = null;
    const toque = !g.movido && ev.timeStamp - g.t0 < 400;
    const borra = sobreBoteAhora(ev);
    setArrastrando(false);
    sobreRef.current = false;
    setSobreBote(false);
    setGuia(false);
    g.el.style.opacity = '';
    if (borra) { vibra('listo'); setPegados((ps) => ps.filter((x) => x.k !== g.k)); return; }
    cambia(g.k, { cx: g.p.cx, cy: g.p.cy, s: g.p.s, r: g.p.r, z: g.p.z });
    if (toque) setElegir({ modo: 'color', k: g.k });
  };
  const sobreBoteAhora = (ev) => {
    const b = boteRef.current?.getBoundingClientRect();
    return !!b && b.width > 0 && Math.hypot(ev.clientX - (b.left + b.width / 2), ev.clientY - (b.top + b.height / 2)) < BOTE_RADIO;
  };
  // En la computadora, la rueda del ratón agranda o achica.
  const rueda = (ev, p) => {
    ev.preventDefault();
    cambia(p.k, { s: Math.min(S_MAX, Math.max(S_MIN, p.s * (ev.deltaY < 0 ? 1.07 : 0.935))) });
  };

  /* ---- La imagen: se arma una vez por cada versión de lo que hay en el lienzo. ---- */
  const firma = JSON.stringify(pegados.map((p) => [p.item.id, p.total, p.cara, p.frase, p.colorI, p.cx, p.cy, p.s, p.r, p.z]));
  const genera = useCallback(async () => {
    if (hecha.current.firma === firma && hecha.current.blob) return hecha.current.blob;
    const capas = [...pegados].sort((a, b) => a.z - b.z).map((p) => ({
      item: p.item, f: p.total ? totales : f, color: COLORES[p.colorI] ?? COLORES[0], cara: p.cara ?? 0, frase: p.frase, propia: p.item.conFoto ? foto : null, cx: p.cx, cy: p.cy, s: p.s, r: p.r,
    }));
    const blob = await historiaDeCarrete({ foto, capas });
    hecha.current = { firma, blob };
    return blob;
  }, [firma, pegados, totales, f, foto]);

  const conImagen = async (quien, hacer) => {
    if (armando) return;
    setArmando(quien);
    try {
      await hacer(await genera());
    } catch (e) {
      if (!/cancel/i.test(String(e?.message ?? e))) avisa('No se pudo armar la imagen. Inténtalo otra vez.', true);
    } finally {
      setArmando(null);
    }
  };
  // Guardar: en la app, directo a Fotos (`CarretePlugin`); si no se puede (sin permiso o un build viejo), la hoja de compartir del iPhone.
  const guarda = () => conImagen('guardar', async (blob) => {
    vibra('listo');
    if (hayCarrete()) {
      try { await guardaEnFotos(blob); avisa('Guardada en Fotos.'); return; } catch { /* sigue con la hoja de compartir */ }
    }
    await entregaArchivo(blob, 'traininglab-historia.png');
    if (!enApp) avisa('Imagen guardada.');
  });
  const abreCompartir = () => conImagen('compartir', async (blob) => setCompartir({ url: URL.createObjectURL(blob), blob }));
  /* A la historia. En la app: «compartir a historias» de Instagram, la imagen ya puesta (`CarretePlugin.historiaDeInstagram`). Si no se puede (sin Instagram,
     un build viejo), la hoja de compartir. En la web: se copia (la promesa va dentro del ClipboardItem, en el mismo toque, como pide Safari). */
  const aHistoria = () => {
    if (hayCarrete()) {
      conImagen('historia', async (blob) => {
        vibra('toque');
        try {
          await aHistoriaDeInstagram(blob);
        } catch (e) {
          if (/sin_instagram/.test(String(e?.message ?? e))) avisa('Instala Instagram para subirla a tu historia.', true);
          else await entregaArchivo(blob, 'traininglab-historia.png');
        }
      });
      return;
    }
    if (!puedeCopiar()) { guarda(); return; }
    vibra('toque');
    setArmando('historia');
    navigator.clipboard.write([new window.ClipboardItem({ 'image/png': genera() })])
      .then(() => {
        if (enApp) { avisa('Copiada. Pégala en tu historia.'); window.location.href = 'instagram://story-camera'; } else avisa('Copiada. Pégala en tu historia.');
      })
      .catch(() => avisa('No se pudo copiar. Usa «Guardar».', true))
      .finally(() => setArmando(null));
  };
  const copia = () => {
    if (!compartir?.blob || !puedeCopiar()) { avisa('Este teléfono no deja copiar. Usa «Guardar».', true); return; }
    navigator.clipboard.write([new window.ClipboardItem({ 'image/png': compartir.blob })]).then(() => avisa('Copiada.')).catch(() => avisa('No se pudo copiar.', true));
  };

  const elegido = elegir?.modo === 'color' ? pegados.find((p) => p.k === elegir.k) : null;
  const anchoTile = rejilla.w > 0 ? Math.floor((rejilla.w - 4 - 8) / 2) : 0; // la rejilla tiene 2 px de cada lado y 8 entre columnas
  const lista = sub === 'actividad' ? items : itemsTot;
  const marcaPx = W * MARCA_HISTORIA.tam;
  const boton = (activo) => ({ border: 'none', borderRadius: 999, height: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: SF, fontSize: 15.5, fontWeight: 600, letterSpacing: -0.2, cursor: 'pointer', color: '#fff', background: '#232326', opacity: armando && !activo ? 0.5 : 1 });

  return createPortal(
    <div
      role="dialog" aria-modal="true" aria-label="Tu foto con stickers"
      style={{ position: 'fixed', inset: 0, zIndex: capa, background: '#000', color: '#fff', fontFamily: SF, opacity: abierto ? 1 : 0, transform: abierto ? 'none' : 'scale(.98)', transition: `opacity .25s ${SALE}, transform .3s ${SALE}`, overflow: 'clip' }}
    >
      {/* La zona del lienzo: arriba de la barra, debajo de la zona segura. */}
      <div ref={zonaRef} style={{ position: 'absolute', top: 'env(safe-area-inset-top)', left: 0, right: 0, bottom: `calc(${BARRA}px + env(safe-area-inset-bottom))`, display: 'grid', placeItems: 'center' }}>
        {W > 0 && (
          <div onPointerDown={otroDedo} onPointerMove={mueve} onPointerUp={suelta} onPointerCancel={suelta} style={{ position: 'relative', width: W, height: H, borderRadius: 26, overflow: 'hidden', background: '#111', touchAction: 'none' }}>
            <img src={foto} alt="" draggable={false} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
            <div aria-hidden="true" style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', width: 1, marginLeft: -0.5, background: '#0A84FF', opacity: guia ? 1 : 0, transition: 'opacity .12s', zIndex: 1, pointerEvents: 'none' }} />
            {pegados.map((p) => (
              <div
                key={p.k} role="button" tabIndex={-1} aria-label={`Sticker ${p.item.nombre}. Arrastra para moverlo; tócalo para su color.`}
                onPointerDown={(ev) => empieza(ev, p)} onPointerMove={solo(mueve)} onPointerUp={solo(suelta)} onPointerCancel={solo(suelta)} onWheel={(ev) => rueda(ev, p)}
                style={{
                  position: 'absolute', left: p.cx * W, top: p.cy * H, width: 300, height: altoDe(p.item), zIndex: p.z, touchAction: 'none', cursor: 'grab',
                  transform: `translate(-50%, -50%) rotate(${p.r}deg) scale(${(p.s * W) / 300})`, WebkitUserSelect: 'none', userSelect: 'none', WebkitTouchCallout: 'none',
                }}
              >
                <Sticker item={p.item} f={fichaDe(p)} color={colorDe(p)} cara={p.cara ?? 0} frase={p.frase} propia={propiaDe(p)} sinMarca />
              </div>
            ))}
            {/* La marca: una vez, abajo (la misma medida que en la imagen que sale). */}
            <div aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, bottom: H * MARCA_HISTORIA.abajo - marcaPx * 0.18, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: W * MARCA_HISTORIA.hueco, fontFamily: '"Bricolage Grotesque", sans-serif', fontWeight: 800, fontSize: marcaPx, lineHeight: 1, color: `rgba(255,255,255,${MARCA_HISTORIA.alfa})`, textShadow: '0 1px 2px rgba(0,0,0,.08)', pointerEvents: 'none', zIndex: 900 }}>
              <i style={{ display: 'block', width: W * MARCA_HISTORIA.linea, height: Math.max(1, W * MARCA_HISTORIA.grosor), background: 'currentColor' }} />
              <span style={{ letterSpacing: W * MARCA_HISTORIA.espacio, marginRight: -W * MARCA_HISTORIA.espacio }}>{MARCA_HISTORIA.texto}</span>
              <i style={{ display: 'block', width: W * MARCA_HISTORIA.linea, height: Math.max(1, W * MARCA_HISTORIA.grosor), background: 'currentColor' }} />
            </div>
            {/* Arriba: salir. Abajo: agregar, o el bote mientras arrastras. */}
            <button type="button" onClick={cierra} aria-label="Salir" style={{ position: 'absolute', top: 12, left: 12, zIndex: 950, width: 42, height: 42, borderRadius: '50%', border: 'none', color: '#fff', display: 'grid', placeItems: 'center', cursor: 'pointer', opacity: arrastrando ? 0 : 1, transition: 'opacity .2s', ...VIDRIO }}>
              <X size={19} strokeWidth={2.6} />
            </button>
            <button type="button" onClick={() => setElegir({ modo: 'nuevo' })} aria-label="Agregar un sticker" style={{ position: 'absolute', left: '50%', bottom: H * 0.075, width: 120, height: 46, marginLeft: -60, borderRadius: 999, border: 'none', color: '#fff', display: 'grid', placeItems: 'center', cursor: 'pointer', zIndex: 950, opacity: arrastrando ? 0 : 1, pointerEvents: arrastrando ? 'none' : 'auto', transition: 'opacity .2s', ...VIDRIO }}>
              <Plus size={22} strokeWidth={2.4} />
            </button>
            <div ref={boteRef} aria-hidden="true" style={{
              position: 'absolute', left: '50%', bottom: H * 0.072, width: 54, height: 54, marginLeft: -27, borderRadius: '50%', display: 'grid', placeItems: 'center', zIndex: 960, pointerEvents: 'none',
              ...VIDRIO, background: sobreBote ? '#FF453A' : VIDRIO.background, boxShadow: sobreBote ? 'none' : 'inset 0 0 0 2px rgba(255,255,255,.9)', // estilo-ok: diseño A · Marca aprobado por Andrés (24 nov 2026, maqueta editor-de-stickers)
              opacity: arrastrando ? 1 : 0, transform: `scale(${arrastrando ? (sobreBote ? 1.2 : 1) : 0.8})`, transition: `opacity .18s ${SALE}, transform .18s ${SALE}, background .15s`,
            }}
            >
              <Trash2 size={21} strokeWidth={2.1} />
            </div>
          </div>
        )}
      </div>

      {/* La barra de abajo. */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: `calc(${BARRA}px + env(safe-area-inset-bottom))`, display: 'flex', gap: 8, padding: '12px 12px 0' }}>
        <button type="button" onClick={guarda} style={{ ...boton(armando === 'guardar'), flex: 1 }}>{armando === 'guardar' ? <Girando /> : <Download size={17} strokeWidth={2.4} />}Guardar</button>
        <button type="button" onClick={aHistoria} style={{ ...boton(armando === 'historia'), flex: 1 }}>{armando === 'historia' ? <Girando /> : <IconoIG tam={22} />}Historia</button>
        <button type="button" onClick={abreCompartir} aria-label="Compartir" style={{ ...boton(armando === 'compartir'), width: 50, flex: 'none' }}>{armando === 'compartir' ? <Girando /> : <Share size={19} strokeWidth={2.3} />}</button>
      </div>

      {/* La hoja para elegir stickers (y el color de uno). */}
      <div onClick={() => setElegir(null)} style={{ position: 'absolute', inset: 0, zIndex: 980, background: 'rgba(0,0,0,.18)', opacity: elegir ? 1 : 0, pointerEvents: elegir ? 'auto' : 'none', transition: 'opacity .3s' }} />
      <div
        role="dialog" aria-label={elegido ? 'Color del sticker' : 'Elige un sticker'} inert={!elegir}
        style={{
          position: 'absolute', left: 8, right: 8, bottom: 'calc(8px + env(safe-area-inset-bottom))', zIndex: 990, borderRadius: 34, display: 'flex', flexDirection: 'column', padding: '8px 12px 0',
          height: elegido ? 'auto' : '68%', background: 'rgba(36,36,40,.88)', WebkitBackdropFilter: 'blur(34px) saturate(160%)', backdropFilter: 'blur(34px) saturate(160%)',
          boxShadow: 'inset 0 0 0 .5px rgba(255,255,255,.1), 0 -10px 40px rgba(0,0,0,.25)', transform: elegir ? 'translateY(0)' : 'translateY(110%)', transition: `transform .45s ${CURVA}`, // estilo-ok: diseño A · Marca aprobado por Andrés (24 nov 2026, maqueta editor-de-stickers)
        }}
      >
        <div aria-hidden="true" style={{ width: 36, height: 5, borderRadius: 3, background: 'rgba(255,255,255,.22)', margin: '0 auto 10px', flex: 'none' }} />
        {elegido ? (
          <>
            {/* El sticker tocado, como en Stickers: se desliza entre sus variantes y, si tiene frase, «✎ Personalizar». */}
            <div ref={colorMedida} style={{ margin: '4px 2px 0' }}>
              {cajaColor.w > 0 && (
                <Mosaico
                  key={elegido.k} id={`pegado-${elegido.k}`} etiqueta={`Sticker ${elegido.item.nombre}`} ancho={cajaColor.w} proporcion={0.5} lienzoH={altoDe(elegido.item)} holgura={0.8}
                  fondo={colorDe(elegido).clara && !elegido.item.fija ? FONDO_CLARO : FONDO_OSCURO} clara={colorDe(elegido).clara && !elegido.item.fija}
                  caras={elegido.item.caras ?? 1} caraInicial={elegido.cara ?? 0} alCambiarCara={(c) => cambia(elegido.k, { cara: c })} alTocar={() => {}} alMantener={() => {}}
                  boton={elegido.item.perso ? { texto: '✎ Personalizar', etiqueta: 'Personalizar la frase', fn: () => setFrases(elegido.k) } : null}
                  dibuja={(c) => <Sticker item={elegido.item} f={fichaDe(elegido)} color={colorDe(elegido)} cara={c} frase={elegido.frase} propia={propiaDe(elegido)} sinMarca />}
                />
              )}
            </div>
            <Colores elegido={elegido.colorI} fijo={!!elegido.item.fija} alElegir={(i) => cambia(elegido.k, { colorI: i })} texto="Su color" />
            <div style={{ padding: '14px 2px 16px' }}>
              <button type="button" onClick={() => setElegir(null)} style={{ width: '100%', height: 50, border: 'none', borderRadius: 16, background: '#fff', color: '#000', fontFamily: SF, fontSize: 16, fontWeight: 600, cursor: 'pointer' }}>Listo</button>
            </div>
          </>
        ) : (
          <>
            <div role="tablist" aria-label="Qué stickers" style={{ display: 'flex', margin: '0 4px', boxShadow: 'inset 0 -.5px 0 rgba(255,255,255,.14)', flex: 'none' }}>
              {[['actividad', 'Actividad'], ['totales', 'Totales']].map(([id, txt]) => (
                <button
                  key={id} type="button" role="tab" aria-selected={sub === id} onClick={() => setSub(id)}
                  style={{ flex: 1, border: 'none', background: 'none', padding: '12px 0 13px', fontFamily: SF, fontSize: 16, fontWeight: 600, letterSpacing: -0.2, cursor: 'pointer', color: sub === id ? '#fff' : 'rgba(255,255,255,.45)', boxShadow: sub === id ? 'inset 0 -2px 0 #fff' : 'none', transition: 'color .2s' }}
                >
                  {txt}
                </button>
              ))}
            </div>
            <Colores elegido={colorNuevo} alElegir={setColorNuevo} texto="Color" />
            <div ref={rejillaMedida} aria-hidden="true" style={{ height: 0, flex: 'none' }} />
            <div ref={rejillaRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, padding: '14px 2px calc(20px + env(safe-area-inset-bottom))', alignContent: 'start', scrollbarWidth: 'none' }}>
              {anchoTile > 0 && lista.map((item) => {
                const color = item.fija ? COLORES[0] : COLORES[colorNuevo];
                const clara = color.clara && !item.fija;
                const total = sub === 'totales';
                return (
                  <Mosaico
                    key={item.id} id={item.id} etiqueta={`Poner el sticker ${item.nombre}`} ancho={anchoTile} proporcion={1 / 1.3} lienzoH={altoDe(item)} holgura={item.familia === 'tarjeta' ? 0.94 : 1}
                    nuevo={esNuevo(item)} raiz={rejillaRef} fondo={clara ? FONDO_CLARO : FONDO_OSCURO} clara={clara} caras={item.caras ?? 1}
                    boton={item.perso ? { texto: '✎ Personalizar', etiqueta: 'Personalizar la frase', fn: () => setFrases('lista') } : null}
                    alTocar={(cara) => agrega(item, total, cara)} alMantener={(cara) => agrega(item, total, cara)}
                    dibuja={(cara) => <Sticker item={item} f={total ? totales : f} color={color} cara={cara} frase={fraseNueva} propia={item.conFoto ? foto : null} sinMarca />}
                  />
                );
              })}
              {lista.length === 0 && <p style={{ gridColumn: '1 / -1', margin: '14px 4px', fontSize: 15, color: 'rgba(255,255,255,.6)' }}>Entrena esta semana y aquí aparecen tus totales.</p>}
            </div>
          </>
        )}
      </div>

      {/* Compartir: la imagen lista, sobre tu foto desenfocada. */}
      {compartir && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 1000, overflow: 'hidden' }}>
          <img src={foto} alt="" aria-hidden="true" style={{ position: 'absolute', inset: -40, width: 'calc(100% + 80px)', height: 'calc(100% + 80px)', objectFit: 'cover', filter: 'blur(40px) brightness(.55) saturate(1.2)' }} />
          <div style={{ /* estilo-ok: diseño A · Marca aprobado por Andrés (24 nov 2026, maqueta editor-de-stickers) */ position: 'absolute', left: 8, right: 8, top: 'calc(10px + env(safe-area-inset-top))', bottom: 'calc(8px + env(safe-area-inset-bottom))', borderRadius: 38, background: 'rgba(60,60,64,.38)', WebkitBackdropFilter: 'blur(30px)', backdropFilter: 'blur(30px)', boxShadow: 'inset 0 0 0 .5px rgba(255,255,255,.12)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 18px 18px' }}>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 600, letterSpacing: -0.3 }}>Compartir</h3>
            <img src={compartir.url} alt="Tu imagen con stickers" style={{ marginTop: 14, flex: 1, minHeight: 0, maxWidth: '100%', aspectRatio: '9 / 16', objectFit: 'contain', borderRadius: 22, boxShadow: '0 18px 50px rgba(0,0,0,.45)' }} />
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 20 }}>
              {[
                { t: 'Copiar', ico: <Copy size={22} strokeWidth={2} />, fn: copia },
                { t: 'Compartir', ico: <Share size={22} strokeWidth={2.1} />, fn: () => entregaArchivo(compartir.blob, 'traininglab-historia.png').catch(() => avisa('No se pudo compartir.', true)) },
                { t: 'Historia de IG', ico: <IconoIG tam={24} sinFondo />, fn: aHistoria, ig: true },
                { t: 'Guardar', ico: <Download size={22} strokeWidth={2.2} />, fn: guarda },
              ].map((d) => (
                <button key={d.t} type="button" onClick={d.fn} style={{ border: 'none', background: 'none', display: 'grid', justifyItems: 'center', gap: 7, width: 66, color: 'rgba(255,255,255,.85)', fontFamily: SF, fontSize: 11.5, fontWeight: 500, cursor: 'pointer' }}>
                  <span style={{ width: 56, height: 56, borderRadius: '50%', display: 'grid', placeItems: 'center', background: d.ig ? 'radial-gradient(circle at 30% 107%, #fdf497 0%, #fd5949 45%, #d6249f 60%, #285AEB 90%)' : 'rgba(255,255,255,.12)', boxShadow: d.ig ? '0 0 0 3px rgba(255,255,255,.18)' : 'none' }}>{d.ico}</span>
                  {d.t}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setCompartir(null)} style={{ marginTop: 16, width: '100%', height: 52, border: 'none', borderRadius: 18, background: 'rgba(255,255,255,.14)', color: '#fff', fontFamily: SF, fontSize: 16, fontWeight: 600, cursor: 'pointer' }}>Seguir editando</button>
          </div>
        </div>
      )}

      {frases != null && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 1050 }}>
          <HojaDeFrases
            frase={frases === 'lista' ? fraseNueva : pegados.find((p) => p.k === frases)?.frase ?? fraseNueva}
            alElegir={(nueva) => { if (frases === 'lista') { setFraseNueva(nueva); alCambiarFrase?.(nueva); } else cambia(frases, { frase: nueva }); }}
            alCerrar={() => setFrases(null)}
          />
        </div>
      )}

      {/* Avisos. */}
      <div aria-live="polite" style={{ position: 'absolute', left: 0, right: 0, top: 'calc(14px + env(safe-area-inset-top))', zIndex: 1100, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
        {aviso && (
          <div role={aviso.error ? 'alert' : 'status'} style={{ /* estilo-ok: diseño A · Marca aprobado por Andrés (24 nov 2026, maqueta editor-de-stickers) */ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 999, fontSize: 14, fontWeight: 600, background: 'rgba(40,40,44,.86)', WebkitBackdropFilter: 'blur(20px)', backdropFilter: 'blur(20px)', boxShadow: 'inset 0 0 0 .5px rgba(255,255,255,.12)' }}>
            {aviso.error ? <span style={{ color: '#FF9F0A', fontWeight: 800 }}>!</span> : <Check size={16} strokeWidth={3} color="#32D74B" />}
            {aviso.texto}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

const Girando = () => (
  <span aria-label="Armando" style={{ /* estilo-ok: diseño A · Marca aprobado por Andrés (24 nov 2026, maqueta editor-de-stickers) */ width: 17, height: 17, borderRadius: '50%', border: '2.2px solid rgba(255,255,255,.3)', borderTopColor: '#fff', animation: 'tl-gira .8s linear infinite' }}>
    <style>{'@keyframes tl-gira{to{transform:rotate(360deg)}}'}</style>
  </span>
);

/** El ícono de Instagram (con su degradado, o solo la línea blanca). */
function IconoIG({ tam = 22, sinFondo = false }) {
  const ico = (
    <svg width={sinFondo ? tam : tam * 0.6} height={sinFondo ? tam : tam * 0.6} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5.5" /><circle cx="12" cy="12" r="4.2" /><circle cx="17.4" cy="6.6" r="1.1" fill="#fff" stroke="none" />
    </svg>
  );
  if (sinFondo) return ico;
  return <span style={{ width: tam, height: tam, borderRadius: 7, display: 'grid', placeItems: 'center', background: 'radial-gradient(circle at 30% 107%, #fdf497 0%, #fd5949 45%, #d6249f 60%, #285AEB 90%)' }}>{ico}</span>;
}

