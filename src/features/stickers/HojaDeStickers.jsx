import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Capacitor } from '@capacitor/core';
import { Camera, Check, Images, Pencil, Plus, Sticker as IconoSticker, X } from 'lucide-react';
import { FONT } from '@/lib/theme';
import { ficha as fichaDe } from '@/lib/stickers/ficha';
import { catalogo, catalogoDeTotales, COLORES, esNuevo, FRASE_INICIAL, FRASE_MAX, lienzoDe } from '@/lib/stickers/catalogo';
import { totalesDe } from '@/lib/stickers/totales';
import { entregaArchivo } from '@/lib/entregaArchivo';
import { vibra } from '@/lib/avisosNativos';
import CambiarNombre from './CambiarNombre';
import HojaDeFrases from './HojaDeFrases';
import Sticker from './Sticker';
import EditorDeCarrete from './EditorDeCarrete';
import Mosaico from './Mosaico';
import useAncho from './useAncho';
import { abreAjustes, eligeMasFotos, fotosRecientes, hayCarrete, originalDeFoto, permisoDeFotos, pidePermisoDeFotos } from '@/lib/carreteNativo';
import { nombreDeArchivo, pngDeSticker, preparaFoto } from './exporta';

/* LA HOJA DE STICKERS (Andrés, 28 oct 2026; ver docs/stickers.md y el prototipo). Sustituye a la hoja y al editor del sello.

   Se abre desde el aviso de la página del entreno, el ⇪ de cada fila de «Tus entrenos», «Compartir» de la página del entreno, Mis métricas y, en el plan, el final
   del entreno y el día. NUNCA se abre sola al terminar.

   Arriba: «Comparte tu carrera / tu workout / tu entreno», el nombre con lápiz (si se puede renombrar) y «Cerrar»; los cuatro colores y «Toca para copiar · Mantén
   para guardar». Abajo, la galería: dos columnas de mosaicos cuadrados, una sola lista en el orden del catálogo (los 19 nuevos primero, con su pastilla «Nuevo»), sin nombres. Cada sticker se ve achicado en su mosaico,
   pero se copia y se guarda a su tamaño real (`exporta.js`).

   Tocar = copiar (aviso «Copiado. Pégalo en tu historia.» con «Abrir Instagram» y «Guardar», 3.5 s). Mantener 0.6 s = guardar, con un anillo que se llena; si se
   suelta antes, regresa. Mover el dedo más de 10 px = desplazar la lista. Se cierra con «Cerrar» o arrastrando la cabecera hacia abajo (120 px, o rápido).
   (Las pestañas «Con foto» y «Video» de la fase 2 se quitaron el 24 nov 2026: ver abajo.)

   5 NOV 2026 (parte 2): en «Stickers», dos pestañas de texto: «Actividad» (la lista de siempre) y «Totales» (la semana y el mes de hoy, `totales.js`). Los mosaicos
   con variantes son carruseles (ver `Mosaico`); el primero se asoma una vez al día. «✎ Personalizar» abre las frases (`HojaDeFrases`): la elegida va a todos los
   personalizables, se recuerda en el teléfono y, al cerrar, la galería regresa al sticker y lo marca 1.6 s. El Polaroid lleva tu foto: la misma del carrete que
   se elige con «＋ Poner foto», en memoria (`blob:`), que se suelta al cerrar la hoja.

   `entreno`: lo que pide `ficha()` (o `cargar`, una función que lo trae; mientras, se ven mosaicos vacíos). `titulo`: el de la cabecera. `nombre`: el del
   entreno. `alRenombrar(nombre)`: guarda el nombre nuevo (sin ella no hay lápiz). */

/* 24 NOV 2026 · LA HOJA NUEVA (maqueta docs/maquetas/editor-de-stickers, dirección «A · Marca»). Andrés: la de antes «se ve barata» (azul marino, control
   pegado, damero, «Nuevo» enormes) y la segunda versión «se ve como la copia idéntica de Aura». Queda: el acabado de Aura con la cara de Training Lab: el azul
   y su degradado, Bricolage en el título y Space Mono en el nombre. Arriba, dos botones SEPARADOS: «Carrete» (lo primero que se ve: tu foto con stickers,
   `EditorDeCarrete`) y «Stickers» (solo los stickers, para copiarlos sueltos). «Con foto» y «Video» se quitaron: no se usaban. */
const FONDO = 'radial-gradient(130% 42% at 0% 0%, rgba(36,72,232,.32), transparent 62%), #0A0D16';
const TINTA_2 = 'rgba(255,255,255,.55)';
const DEGRADADO = 'linear-gradient(140deg, #2448E8 0%, #1733B8 55%, #0D1A66 120%)'; // estilo-ok: diseño A · Marca aprobado por Andrés (24 nov 2026, maqueta editor-de-stickers)
const SF = '-apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, system-ui, sans-serif';
const CURVA = 'cubic-bezier(.32,.72,0,1)';
const SALE = 'cubic-bezier(.23,1,.32,1)';
// Los mosaicos: oscuros (le gustaron más que el damero, 24 nov 2026); claros cuando la tinta es negra.
const FONDO_MOSAICO = {
  oscuro: { background: '#111521', boxShadow: 'inset 0 .5px 0 rgba(255,255,255,.06)' },
  claro: { background: '#E8E8EC' },
};

// Lo que se recuerda en el teléfono: la frase elegida y el día en que el primer carrusel ya se asomó.
const LLAVE_FRASE = 'tl.stickers.frase';
const LLAVE_ASOMO = 'tl.stickers.asomo';
const lee = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const guardaLocal = (k, v) => { try { localStorage.setItem(k, v); } catch { /* sin espacio o en privado: no pasa nada */ } };
const hoyLocal = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };

const reduceMovimiento = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };
const puedeCopiar = () => !!(navigator.clipboard?.write && typeof window.ClipboardItem === 'function');


const SinDatos = () => (
  <p style={{ gridColumn: '1 / -1', margin: '18px 4px', fontSize: 15, lineHeight: 1.45, color: TINTA_2 }}>
    Todavía no hay nada que contar. Haz algún ejercicio con el entreno guiado y aquí aparecerán los stickers de tu sesión.
  </p>
);

const POR_TANDA = 120;
const MAX_FOTOS = 1200;
const CUADRO = { position: 'relative', border: 'none', padding: 0, aspectRatio: '3 / 4', cursor: 'pointer', display: 'grid', placeItems: 'center', color: '#fff', background: '#141826' };

/**
 * CARRETE: tus fotos, lo primero que se ve (Andrés, 24 nov 2026: «lo primero que te aparece es como que todas tus fotos», como Aura; el cuadro azul de
 * relleno de la parte 1 lo extrañó con razón). Rejilla de 3 de orilla a orilla: la cámara primero y luego lo más reciente (`CarretePlugin.swift`). Tocar una
 * foto abre el editor. Sin permiso: cómo darlo. En la web (o con un build viejo) no hay carrete: la cámara y «Elegir foto» (el selector de archivos).
 * Los videos se suman en la parte 2b; mientras, no se enseñan.
 */
function RejillaDelCarrete({ alElegir, alCamara, alSelector }) {
  const [estado, setEstado] = useState(hayCarrete() ? 'cargando' : 'sin'); // cargando | listo | negado | sin
  const [fotos, setFotos] = useState([]);
  const [limitado, setLimitado] = useState(false);
  const [vuelta, setVuelta] = useState(0);
  const [cuantos, setCuantos] = useState(POR_TANDA);
  const [hayMas, setHayMas] = useState(false);
  const pidiendo = useRef(false);
  useEffect(() => {
    if (!hayCarrete()) return undefined;
    let vivo = true;
    (async () => {
      let p = await permisoDeFotos();
      if (p === 'sin_preguntar') p = await pidePermisoDeFotos();
      if (!vivo) return;
      if (p === null) { setEstado('sin'); return; }
      if (p === 'negado') { setEstado('negado'); return; }
      setLimitado(p === 'limitado');
      try {
        const l = await fotosRecientes({ cuantos, lado: 300 });
        if (vivo) { setFotos(l.filter((x) => x.tipo === 'foto')); setHayMas(l.length >= cuantos); setEstado('listo'); }
      } catch {
        if (vivo && cuantos === POR_TANDA) setEstado('sin');
      } finally {
        pidiendo.current = false;
      }
    })();
    return () => { vivo = false; };
  }, [vuelta, cuantos]);
  // Al acercarse al final, la siguiente tanda (las miniaturas ya hechas se reusan: es rápido).
  const alDesplazar = (ev) => {
    const el = ev.currentTarget;
    if (!hayMas || pidiendo.current || cuantos >= MAX_FOTOS) return;
    if (el.scrollTop + el.clientHeight > el.scrollHeight - 600) { pidiendo.current = true; setCuantos((c) => Math.min(MAX_FOTOS, c + POR_TANDA)); }
  };

  if (estado === 'negado') {
    return (
      <div style={{ flex: 1, display: 'grid', placeItems: 'center', padding: '0 28px', textAlign: 'center' }}>
        <div style={{ display: 'grid', justifyItems: 'center', gap: 12 }}>
          <Images size={34} strokeWidth={1.6} color="rgba(255,255,255,.7)" />
          <p style={{ margin: 0, fontFamily: SF, fontSize: 16, lineHeight: 1.4, color: '#fff', fontWeight: 500 }}>Para ver tus fotos aquí, deja que Training Lab use Fotos.</p>
          <button type="button" onClick={abreAjustes} className="kp-press" style={{ marginTop: 4, height: 48, padding: '0 22px', border: 'none', borderRadius: 16, background: DEGRADADO, color: '#fff', fontFamily: SF, fontSize: 16, fontWeight: 600, cursor: 'pointer' }}>Abrir ajustes</button>
          <button type="button" onClick={alSelector} style={{ border: 'none', background: 'none', color: 'rgba(255,255,255,.7)', fontFamily: SF, fontSize: 15, fontWeight: 500, padding: 10, cursor: 'pointer' }}>Elegir una foto</button>
        </div>
      </div>
    );
  }
  // La caja que se desplaza va POR FUERA de la rejilla (una rejilla que se desplaza sola se trababa en el iPhone: «no puedo scrolear»).
  return (
    <div onScroll={alDesplazar} style={{ flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch', paddingBottom: 'calc(24px + env(safe-area-inset-bottom))' }}>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 2, alignContent: 'start' }}>
      <button type="button" onClick={alCamara} aria-label="Tomar una foto" style={CUADRO}><Camera size={28} strokeWidth={1.6} /></button>
      {(estado === 'sin' || limitado) && (
        <button type="button" onClick={estado === 'sin' ? alSelector : () => eligeMasFotos().then(() => setVuelta((v) => v + 1))} aria-label={estado === 'sin' ? 'Elegir una foto' : 'Elegir más fotos'} style={{ ...CUADRO, gap: 6, alignContent: 'center' }}>
          {estado === 'sin' ? <Images size={26} strokeWidth={1.6} /> : <Plus size={26} strokeWidth={1.8} />}
          <span style={{ fontFamily: SF, fontSize: 12.5, fontWeight: 500, color: 'rgba(255,255,255,.75)' }}>{estado === 'sin' ? 'Elegir foto' : 'Más fotos'}</span>
        </button>
      )}
      {estado === 'cargando' && Array.from({ length: 11 }, (_, i) => <span key={i} aria-hidden="true" style={{ aspectRatio: '3 / 4', background: '#10131D' }} />)}
      {fotos.map((x) => (
        <button key={x.id} type="button" onClick={() => alElegir(x.id)} aria-label="Usar esta foto" style={{ ...CUADRO, overflow: 'hidden', background: '#10131D' }}>
          <img src={x.src} alt="" loading="lazy" decoding="async" draggable={false} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        </button>
      ))}
    </div>
    </div>
  );
}

export default function HojaDeStickers({ entreno = null, cargar = null, titulo = 'Comparte tu entreno', nombre = '', alRenombrar = null, onCerrar, capa = 3300 }) {
  const [cargado, setCargado] = useState(cargar ? undefined : null); // undefined: cargando
  const [abierta, setAbierta] = useState(false);
  const [cerrando, setCerrando] = useState(false);
  const [colorI, setColorI] = useState(0);
  const [aviso, setAviso] = useState(null); // { texto, error?, acciones? }
  const [renombrando, setRenombrando] = useState(false);
  const [nombreVisto, setNombreVisto] = useState(nombre);
  const [vista, setVista] = useState('carrete'); // 'carrete' (lo primero que se ve) | 'stickers'
  const [editor, setEditor] = useState(null); // la foto elegida para el editor (enlace `blob:` local)
  const [propia, setPropia] = useState(null); // la foto del carrete para el Polaroid (enlace `blob:`)
  const [sub, setSub] = useState('actividad'); // en «Stickers»: 'actividad' | 'totales'
  const [frase, setFrase] = useState(() => { const g = lee(LLAVE_FRASE); return g && g.length <= FRASE_MAX ? g : FRASE_INICIAL; });
  const [frasesDe, setFrasesDe] = useState(null); // el sticker desde el que se abrió «Elige una frase»
  const [marcado, setMarcado] = useState(null);
  const [asoma] = useState(() => lee(LLAVE_ASOMO) !== hoyLocal());
  const carrete = useRef(null);
  const paraEditor = useRef(null);
  const camara = useRef(null);
  // El ancho de la galería sale de la cabecera, que siempre se ve (menos sus 16 px de cada lado): así los mosaicos ya tienen su tamaño cuando «Stickers»
  // aparece, y no nacen en cero para luego saltar (Andrés, 24 nov 2026: «cuando cambio a Stickers glitchea»).
  const [cabeceraRef, anchoCabecera] = useAncho();
  const anchoGaleria = Math.max(0, anchoCabecera - 32);
  const listaRef = useRef(null); // lo que se desplaza: la raíz de «dibujar conforme se desplaza»
  const hojaRef = useRef(null);
  const veloRef = useRef(null);
  const arrastre = useRef(null);
  const reloj = useRef(0);
  const rm = useMemo(() => reduceMovimiento(), []);
  const enApp = Capacitor.isNativePlatform();

  useEffect(() => {
    if (!cargar) return undefined;
    let vivo = true;
    Promise.resolve().then(cargar).then((e) => { if (vivo) setCargado(e ?? null); }).catch(() => { if (vivo) setCargado(null); });
    return () => { vivo = false; };
  }, [cargar]);

  const base = cargar ? cargado : entreno;
  const f = useMemo(() => (base ? fichaDe({ ...base, nombre: nombreVisto || base.nombre }) : null), [base, nombreVisto]);
  const items = useMemo(() => (f ? catalogo(f) : []), [f]);
  // Totales: la semana y el mes de hoy, del historial que ya trae el entreno (no cambia con el entreno ni con el nombre).
  const totales = useMemo(() => (base ? totalesDe(base) : null), [base]);
  const itemsTot = useMemo(() => catalogoDeTotales(totales), [totales]);
  const primeroConCaras = items.find((x) => x.caras > 1)?.id ?? null;
  const color = COLORES[colorI];

  useEffect(() => {
    const r = requestAnimationFrame(() => requestAnimationFrame(() => setAbierta(true)));
    return () => cancelAnimationFrame(r);
  }, []);
  const cierra = useCallback(() => {
    if (cerrando) return;
    setCerrando(true);
    setAbierta(false);
    setTimeout(onCerrar, rm ? 0 : 260);
  }, [cerrando, onCerrar, rm]);
  useEffect(() => {
    const tecla = (e) => { if (e.key === 'Escape' && !renombrando && !editor) cierra(); };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, [cierra, renombrando, editor]);
  useEffect(() => () => clearTimeout(reloj.current), []);
  // La foto del carrete vive solo en memoria (un enlace `blob:` local): se suelta al cambiarla o al cerrar.
  useEffect(() => () => { if (propia) URL.revokeObjectURL(propia); }, [propia]);
  useEffect(() => () => { if (editor) URL.revokeObjectURL(editor); }, [editor]);
  // El primer carrusel se asoma una vez al día: se anota al abrir la hoja.
  useEffect(() => { if (asoma) guardaLocal(LLAVE_ASOMO, hoyLocal()); }, [asoma]);
  useEffect(() => { if (!marcado) return undefined; const r = setTimeout(() => setMarcado(null), 1600); return () => clearTimeout(r); }, [marcado]);

  const avisa = (a) => {
    clearTimeout(reloj.current);
    setAviso(a);
    reloj.current = setTimeout(() => setAviso(null), a.dura ?? 3500);
  };

  // El sticker solo, en la cara que se ve, con la frase y la foto del Polaroid.
  const comoSale = (item, cara = 0) => ({ item, f: item.total ? totales : f, color, cara, frase, propia: item.conFoto ? propia : null });
  const guarda = async (item, cara = 0) => {
    vibra('listo');
    try {
      await entregaArchivo(await pngDeSticker(comoSale(item, cara)), nombreDeArchivo(item));
      if (!enApp) avisa({ texto: 'Imagen guardada.' });
    } catch {
      avisa({ texto: 'No se pudo guardar. Inténtalo otra vez.', error: true });
    }
  };
  const copia = (item, cara = 0) => {
    vibra('toque');
    const falla = () => avisa({ texto: 'No se pudo copiar. Mantén presionado el sticker para guardarlo.', error: true, acciones: [{ t: 'Guardar', fn: () => guarda(item, cara) }] });
    if (!puedeCopiar()) { falla(); return; }
    try {
      // La promesa va adentro del ClipboardItem: Safari solo deja copiar si `write` se llama en el mismo toque.
      navigator.clipboard.write([new window.ClipboardItem({ 'image/png': pngDeSticker(comoSale(item, cara)) })])
        .then(() => avisa({
          texto: 'Copiado. Pégalo en tu historia.',
          acciones: [...(enApp ? [{ t: 'Abrir Instagram', fn: () => { window.location.href = 'instagram://story-camera'; } }] : []), { t: 'Guardar', fn: () => guarda(item, cara) }],
        }))
        .catch(falla);
    } catch { falla(); }
  };

  const eligeDelCarrete = async (ev) => {
    const archivo = ev.target.files?.[0];
    ev.target.value = '';
    if (!archivo) return;
    avisa({ texto: 'Preparando tu foto…', dura: 30000 }); // se queda hasta que esté (lo cambia el siguiente aviso)
    try {
      // HEIC del iPhone incluida: la lee el teléfono y la achica (`preparaFoto`). Nada se sube.
      setPropia(URL.createObjectURL(await preparaFoto(archivo)));
      clearTimeout(reloj.current);
      setAviso(null);
    } catch {
      avisa({ texto: 'No se pudo abrir esa foto. Prueba con otra.', error: true });
    }
  };
  const abreCarrete = () => carrete.current?.click();
  // Una foto de la rejilla: su original (del iPhone, ya derecho) y al editor.
  const eligeDelRejilla = async (id) => {
    avisa({ texto: 'Preparando tu foto…', dura: 60000 });
    try {
      setEditor(URL.createObjectURL(await preparaFoto(await originalDeFoto(id))));
      clearTimeout(reloj.current);
      setAviso(null);
    } catch {
      avisa({ texto: 'No se pudo abrir esa foto. Prueba con otra.', error: true });
    }
  };
  // Carrete: la foto elegida (o recién tomada) abre el editor. HEIC incluida; se achica a 4 MP y nunca sale del teléfono (`preparaFoto`).
  const eligeParaEditor = async (ev) => {
    const archivo = ev.target.files?.[0];
    ev.target.value = '';
    if (!archivo) return;
    avisa({ texto: 'Preparando tu foto…', dura: 30000 });
    try {
      setEditor(URL.createObjectURL(await preparaFoto(archivo)));
      clearTimeout(reloj.current);
      setAviso(null);
    } catch {
      avisa({ texto: 'No se pudo abrir esa foto. Prueba con otra.', error: true });
    }
  };

  // Al cerrar «Elige una frase», la galería regresa al sticker desde el que se abrió y lo marca.
  const eligeFrase = (nueva) => { setFrase(nueva); guardaLocal(LLAVE_FRASE, nueva); };
  const cierraFrases = () => {
    const id = frasesDe;
    setFrasesDe(null);
    const lista = listaRef.current;
    const el = id && lista?.querySelector(`[data-mosaico="${id}"]`);
    if (!el) return;
    const top = el.getBoundingClientRect().top - lista.getBoundingClientRect().top + lista.scrollTop - 90;
    lista.scrollTo({ top: Math.max(0, top), behavior: rm ? 'auto' : 'smooth' });
    setMarcado(id);
  };

  /** Un mosaico de «Stickers» (Actividad o Totales): con sus caras, su botón (frase o foto) y lo que hace al tocarlo. */
  const mosaicoDe = (item) => {
    const clara = color.clara && !item.fija;
    const sinFoto = item.conFoto && !propia;
    const boton = item.perso ? { texto: '✎ Personalizar', etiqueta: 'Personalizar la frase', fn: () => setFrasesDe(item.id) }
      : item.conFoto ? { texto: propia ? 'Cambiar foto' : '＋ Poner foto', fn: abreCarrete, oscuro: true } : null;
    return (
      <Mosaico
        key={item.id} id={item.id} ancho={anchoMosaico} proporcion={1} lienzoH={lienzoDe(item).h} holgura={item.familia === 'tarjeta' ? 0.94 : 1}
        etiqueta={sinFoto ? `Sticker ${item.nombre}. Toca para poner una foto` : `Sticker ${item.nombre}. Toca para copiar; mantén presionado para guardar.`}
        nuevo={esNuevo(item)} raiz={listaRef} fondo={clara ? FONDO_MOSAICO.claro : FONDO_MOSAICO.oscuro} clara={clara} caras={item.caras ?? 1} boton={boton}
        asoma={asoma && !rm && sub === 'actividad' && item.id === primeroConCaras} marcado={marcado === item.id}
        alTocar={(cara) => (sinFoto ? abreCarrete() : copia(item, cara))} alMantener={(cara) => (sinFoto ? abreCarrete() : guarda(item, cara))}
        dibuja={(cara) => <Sticker item={item} f={item.total ? totales : f} color={color} cara={cara} frase={frase} propia={item.conFoto ? propia : null} />}
      />
    );
  };

  // Arrastrar la cabecera hacia abajo cierra; hacia arriba resiste.
  const bajaInicia = (ev) => {
    if (ev.target.closest('button')) return;
    arrastre.current = { y0: ev.clientY, t: performance.now(), dy: 0, v: 0, id: ev.pointerId };
    if (hojaRef.current) hojaRef.current.style.transition = 'none';
    ev.currentTarget.setPointerCapture?.(ev.pointerId);
  };
  const bajaMueve = (ev) => {
    const d = arrastre.current;
    if (!d || ev.pointerId !== d.id) return;
    let dy = ev.clientY - d.y0;
    const ahora = performance.now();
    d.v = (dy - d.dy) / Math.max(1, ahora - d.t);
    d.t = ahora;
    if (dy < 0) dy = -(Math.abs(dy) * 60) / (60 + Math.abs(dy));
    d.dy = dy;
    if (hojaRef.current) hojaRef.current.style.transform = `translateY(${dy.toFixed(1)}px)`;
    if (veloRef.current) veloRef.current.style.opacity = String(Math.max(0, 1 - Math.max(0, dy) / ((hojaRef.current?.offsetHeight ?? 600) * 0.9)));
  };
  const bajaTermina = (ev) => {
    const d = arrastre.current;
    if (!d || ev.pointerId !== d.id) return;
    arrastre.current = null;
    const h = hojaRef.current;
    if (veloRef.current) veloRef.current.style.opacity = '';
    if (d.dy > 120 || d.v > 0.11) {
      if (h) { h.style.transition = `transform .25s ${CURVA}`; h.style.transform = 'translateY(105%)'; }
      cierra();
      return;
    }
    if (h) {
      h.style.transition = `transform .4s ${CURVA}`;
      h.style.transform = '';
    }
  };

  const guardaNombre = async (nuevo) => {
    try {
      await alRenombrar(nuevo);
      setNombreVisto(nuevo);
      setRenombrando(false);
      avisa({ texto: 'Nombre guardado.' });
    } catch {
      avisa({ texto: 'No se pudo guardar el nombre.', error: true });
    }
  };

  const gap = 8;
  const anchoMosaico = anchoGaleria > 0 ? Math.floor((anchoGaleria - gap) / 2) : 0;
  const dur = rm ? '0s' : (cerrando ? '.25s' : '.5s');

  return createPortal(
    <div role="presentation" style={{ position: 'fixed', inset: 0, zIndex: capa, fontFamily: FONT, overflow: 'hidden' }}>
      <div ref={veloRef} onClick={cierra} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.42)', opacity: abierta ? 1 : 0, transition: `opacity .3s ease-out` }} />
      <section
        ref={hojaRef} role="dialog" aria-modal="true" aria-labelledby="stk-titulo"
        style={{
          position: 'absolute', left: 0, right: 0, bottom: 0, height: 'calc(100% - env(safe-area-inset-top) - 14px)', maxWidth: 620, margin: '0 auto',
          background: FONDO, color: '#EEF0F6', borderRadius: '34px 34px 0 0', display: 'flex', flexDirection: 'column', boxShadow: 'inset 0 .5px 0 rgba(255,255,255,.08)',
          transform: abierta ? 'translateY(0)' : 'translateY(105%)', transition: `transform ${dur} ${CURVA}`, willChange: 'transform',
        }}
      >
        <div ref={cabeceraRef} onPointerDown={bajaInicia} onPointerMove={bajaMueve} onPointerUp={bajaTermina} onPointerCancel={bajaTermina} style={{ padding: '8px 16px 0', touchAction: 'none', cursor: 'grab', flex: 'none' }}>
          <div aria-hidden="true" style={{ width: 36, height: 5, borderRadius: 3, background: 'rgba(255,255,255,.22)', margin: '0 auto 12px' }} />
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <h2 id="stk-titulo" style={{ margin: 0, fontFamily: '"Bricolage Grotesque", sans-serif', fontVariationSettings: "'wdth' 80, 'opsz' 96", fontSize: 28, fontWeight: 800, letterSpacing: -0.6, lineHeight: 1.05, color: '#fff' }}>{titulo}</h2>
              {(alRenombrar || nombreVisto) && (
                <button
                  type="button" disabled={!alRenombrar} onClick={() => setRenombrando(true)} aria-label={alRenombrar ? `Cambiar el nombre: ${nombreVisto}` : nombreVisto}
                  style={{ /* estilo-ok: diseño A · Marca aprobado por Andrés (24 nov 2026, maqueta editor-de-stickers) */ display: 'flex', alignItems: 'center', gap: 6, maxWidth: '100%', border: 'none', background: 'none', padding: '6px 0 0', color: TINTA_2, fontFamily: '"Space Mono", monospace', fontSize: 12.5, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', minHeight: 30, cursor: alRenombrar ? 'pointer' : 'default', textAlign: 'left' }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{nombreVisto}</span>
                  {alRenombrar && <Pencil size={13} color="rgba(255,255,255,.6)" style={{ flex: 'none' }} />}
                </button>
              )}
            </div>
            <button type="button" onClick={cierra} aria-label="Cerrar" className="kp-press" style={{ flex: 'none', width: 36, height: 36, border: 'none', borderRadius: '50%', background: 'rgba(255,255,255,.09)', color: '#fff', display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
              <X size={18} strokeWidth={2.6} />
            </button>
          </div>
          {/* Dos botones separados (como Aura): Carrete, lo primero; Stickers, solo los stickers. */}
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            {[['carrete', 'Carrete', Images], ['stickers', 'Stickers', IconoSticker]].map(([id, txt, Ico]) => (
              <button
                key={id} type="button" aria-pressed={vista === id} onClick={() => setVista(id)} className="kp-press"
                style={{
                  flex: 1, height: 54, border: 'none', borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, fontFamily: SF, fontSize: 16.5,
                  fontWeight: vista === id ? 600 : 500, letterSpacing: -0.3, cursor: 'pointer', color: vista === id ? '#fff' : 'rgba(255,255,255,.6)',
                  background: vista === id ? DEGRADADO : 'rgba(255,255,255,.06)', transition: `box-shadow .2s ${SALE}, color .2s`,
                  boxShadow: vista === id ? '0 10px 26px rgba(30,64,224,.35), inset 0 .5px 0 rgba(255,255,255,.25)' : 'inset 0 0 0 .5px rgba(255,255,255,.08)', // estilo-ok: diseño A · Marca aprobado por Andrés (24 nov 2026, maqueta editor-de-stickers)
                }}
              >
                <Ico size={20} strokeWidth={1.9} />{txt}
              </button>
            ))}
          </div>
          {vista === 'stickers' && (
            <>
              <div role="tablist" aria-label="Qué stickers" style={{ display: 'flex', gap: 6, marginTop: 16 }}>
                {[['actividad', 'Actividad'], ['totales', 'Totales']].map(([id, txt]) => (
                  <button
                    key={id} type="button" role="tab" aria-selected={sub === id} onClick={() => setSub(id)}
                    style={{ border: 'none', borderRadius: 999, padding: '8px 15px', fontFamily: SF, fontSize: 14.5, fontWeight: 600, letterSpacing: -0.2, cursor: 'pointer', background: sub === id ? '#fff' : 'transparent', color: sub === id ? '#000' : 'rgba(255,255,255,.45)', transition: 'background .2s, color .2s' }}
                  >
                    {txt}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 0 6px' }}>
                {COLORES.map((c, i) => (
                  <button
                    key={c.id} type="button" onClick={() => setColorI(i)} aria-pressed={colorI === i} aria-label={`Tinta ${c.nombre.toLowerCase()}`}
                    style={{ /* estilo-ok: diseño A · Marca aprobado por Andrés (24 nov 2026, maqueta editor-de-stickers) */ width: 30, height: 30, borderRadius: '50%', border: 'none', padding: 0, flex: 'none', background: c.tinta, cursor: 'pointer', boxShadow: colorI === i ? '0 0 0 2.5px #0A0D16, 0 0 0 4.5px #fff' : 'inset 0 0 0 1px rgba(255,255,255,.18)', transition: `box-shadow .16s ${SALE}` }}
                  />
                ))}
                <span style={{ marginLeft: 'auto', fontFamily: SF, fontSize: 12.5, color: 'rgba(255,255,255,.42)', textAlign: 'right', lineHeight: 1.3, whiteSpace: 'nowrap' }}>Toca para copiar<br />Mantén para guardar</span>
              </div>
            </>
          )}
        </div>
        {/* Stickers: la lista se queda montada aunque no se vea (así mide su ancho cuando aparece). */}
        <div ref={listaRef} style={{ display: vista === 'stickers' ? 'block' : 'none', flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain', padding: '12px 16px calc(24px + env(safe-area-inset-bottom))' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap, alignContent: 'start' }}>
            {f && sub === 'actividad' && items.map(mosaicoDe)}
            {f && sub === 'totales' && itemsTot.map(mosaicoDe)}
            {f && sub === 'totales' && itemsTot.length === 0 && (
              <p style={{ gridColumn: '1 / -1', margin: '18px 4px', fontSize: 15, lineHeight: 1.45, color: TINTA_2 }}>Entrena esta semana y aquí aparecen tus totales.</p>
            )}
            {!f && cargado === undefined && Array.from({ length: 4 }, (_, i) => (
              <span key={i} aria-hidden="true" style={{ display: 'block', height: anchoMosaico || 150, borderRadius: 22, background: '#111521' }} />
            ))}
            {!f && cargado === null && <SinDatos />}
          </div>
        </div>
        {/* Carrete: tu foto con stickers. La foto se elige con el selector del iPhone (o se toma); la rejilla de tus fotos dentro de la hoja llega con la parte 2. */}
        {/* Carrete se queda montado aunque no se vea: al regresar no vuelve a cargar tus fotos. */}
        {(
          <div style={{ flex: 1, minHeight: 0, display: vista === 'carrete' ? 'flex' : 'none', flexDirection: 'column', marginTop: 16 }}>
            {f ? (
              <RejillaDelCarrete alElegir={eligeDelRejilla} alCamara={() => camara.current?.click()} alSelector={() => paraEditor.current?.click()} />
            ) : cargado === undefined ? (
              <span aria-hidden="true" style={{ flex: 1, background: '#10131D' }} />
            ) : <div style={{ padding: '0 16px' }}><SinDatos /></div>}
          </div>
        )}
        <div aria-live="polite" style={{ position: 'absolute', zIndex: 9, left: 10, right: 10, bottom: 'calc(10px + env(safe-area-inset-bottom))', display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
          {aviso && (
            <div role={aviso.error ? 'alert' : 'status'} style={{ pointerEvents: 'auto', width: '100%', maxWidth: 520, background: 'rgba(24,28,40,.97)', color: '#fff', borderRadius: 20, padding: '12px 14px', boxShadow: '0 16px 40px rgba(0,0,0,.35)', display: 'grid', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14.5, fontWeight: 600, lineHeight: 1.35 }}>
                <span aria-hidden="true" style={{ width: 26, height: 26, borderRadius: '50%', display: 'grid', placeItems: 'center', flexShrink: 0, background: aviso.error ? '#C2410C' : '#1F8F63' }}>
                  {aviso.error ? <span style={{ fontWeight: 800 }}>!</span> : <Check size={16} strokeWidth={3} />}
                </span>
                {aviso.texto}
              </div>
              {aviso.acciones?.length > 0 && (
                <div style={{ display: 'flex', gap: 8 }}>
                  {aviso.acciones.map((a, i) => (
                    <button
                      key={a.t} type="button" onClick={() => { setAviso(null); a.fn(); }}
                      style={{ flex: 1, border: 'none', borderRadius: 12, minHeight: 40, background: i === 0 ? '#fff' : 'rgba(255,255,255,.12)', color: i === 0 ? '#07090F' : '#fff', fontFamily: FONT, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
                    >
                      {a.t}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <input ref={carrete} type="file" accept="image/*" onChange={eligeDelCarrete} style={{ display: 'none' }} />
        <input ref={paraEditor} type="file" accept="image/*" onChange={eligeParaEditor} style={{ display: 'none' }} />
        <input ref={camara} type="file" accept="image/*" capture="environment" onChange={eligeParaEditor} style={{ display: 'none' }} />
        {frasesDe && <HojaDeFrases frase={frase} alElegir={eligeFrase} alCerrar={cierraFrases} rm={rm} />}
      </section>
      {editor && f && <EditorDeCarrete foto={editor} items={items} itemsTot={itemsTot} f={f} totales={totales} frase={frase} alCambiarFrase={eligeFrase} capa={capa + 20} alCerrar={() => setEditor(null)} />}
      {renombrando && <CambiarNombre nombre={nombreVisto} capa={capa + 10} alGuardar={guardaNombre} alCancelar={() => setRenombrando(false)} />}
    </div>,
    document.body,
  );
}
