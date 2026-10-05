import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * El ancho de la guía del editor (la columna con las fases, las semanas y los días), que se
 * ajusta arrastrando su borde "como en Excel" y que se puede ocultar.
 *
 * Andrés, 5 oct 2026 (maqueta): «que el usuario en computadora pueda controlar con el mouse el
 * tamaño de la guía lateral, como en Excel»; y la guía «se pueda ocultar».
 *
 *   · Entre 280 px y 560 px, y nunca más del 42 % de lo que mide el contenido.
 *   · Doble clic en el borde = 360 px (el de siempre). Con el teclado: ← → (de 16 en 16; con
 *     Mayúsculas, de 48), Inicio y Fin.
 *   · Se recuerda EN ESTE APARATO (no en la cuenta): cuánto ancho conviene depende de la pantalla que tengas delante.
 *   · Se oculta con el botón, con Ctrl/⌘+B o arrastrando el borde hasta el fondo; al volver a
 *     abrirla vuelve a su ancho de antes (no se queda en el mínimo).
 */
const CLAVE = 'tl:guia-ancho';
const lee = () => {
  try {
    const n = parseInt(localStorage.getItem(CLAVE), 10);
    return Number.isFinite(n) ? n : null;
  } catch {
    // Safari en navegación privada tira al leer: sin recuerdo, el ancho de siempre.
    return null;
  }
};
const escribe = (n) => {
  try { localStorage.setItem(CLAVE, String(n)); } catch { /* sin almacenamiento: vale mientras dure la visita */ }
};

export const GUIA = { min: 280, defecto: 360, tope: 560, fraccion: 0.42, cierraDebajoDe: 200 };

export const topeDeLaGuia = (anchoDelContenido) => Math.max(
  GUIA.min,
  Math.min(GUIA.tope, Math.round(anchoDelContenido * GUIA.fraccion)),
);
const acota = (v, anchoDelContenido) => Math.min(Math.max(Math.round(v), GUIA.min), topeDeLaGuia(anchoDelContenido));

export function useGuiaAncha() {
  const [guardado, setGuardado] = useState(() => lee() ?? GUIA.defecto);
  const [oculta, setOculta] = useState(false);
  // Mientras se arrastra el borde, el ancho vivo; al soltar se guarda.
  const [vivo, setVivo] = useState(null);
  const [porCerrar, setPorCerrar] = useState(false);
  const [contenido, setContenido] = useState(1400);
  const [caja, setCaja] = useState(null);
  // El arrastre en curso (no se dibuja nada con él: va en una referencia).
  const arrastre = useRef(null);

  // Cuánto mide el contenido (la guía no puede pasar del 42 %): se mide y se vuelve a medir al cambiar la ventana.
  const medir = useCallback((el) => setCaja(el), []);
  useEffect(() => {
    if (!caja) return undefined;
    const mide = () => setContenido(caja.clientWidth);
    mide();
    window.addEventListener('resize', mide);
    return () => window.removeEventListener('resize', mide);
  }, [caja]);

  const ancho = acota(vivo ?? (Number.isFinite(guardado) ? guardado : GUIA.defecto), contenido);
  const tope = topeDeLaGuia(contenido);

  const guarda = (v) => { const n = acota(v, contenido); setGuardado(n); escribe(n); };
  const alternar = useCallback(() => setOculta((o) => !o), []);

  /* El borde. Se arrastra con el mouse o con el dedo (`pointer events`); si al soltar el ancho que se le
     daría es menor de 200 px, la guía se oculta y conserva su ancho de antes. */
  const empieza = (ev) => {
    if (ev.button > 0) return;
    ev.preventDefault();
    arrastre.current = { x0: ev.clientX, w0: ancho };
    ev.currentTarget.setPointerCapture?.(ev.pointerId);
  };
  const mueve = (ev) => {
    const a = arrastre.current;
    if (!a) return;
    const deseado = a.w0 + ev.clientX - a.x0;
    a.cierra = deseado < GUIA.cierraDebajoDe;
    setPorCerrar(a.cierra);
    setVivo(acota(deseado, contenido));
  };
  const suelta = () => {
    const a = arrastre.current;
    if (!a) return;
    arrastre.current = null;
    setPorCerrar(false);
    if (a.cierra) { setVivo(null); setOculta(true); return; }
    if (vivo != null) guarda(vivo);
    setVivo(null);
  };
  const reinicia = () => { setVivo(null); setGuardado(GUIA.defecto); escribe(GUIA.defecto); };
  const alTeclear = (ev) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(ev.key)) return;
    ev.preventDefault();
    const paso = ev.shiftKey ? 48 : 16;
    if (ev.key === 'ArrowLeft') guarda(ancho - paso);
    else if (ev.key === 'ArrowRight') guarda(ancho + paso);
    else if (ev.key === 'Home') guarda(GUIA.min);
    else guarda(tope);
  };

  return {
    medir, ancho, tope, oculta, setOculta, alternar, porCerrar,
    borde: { onPointerDown: empieza, onPointerMove: mueve, onPointerUp: suelta, onPointerCancel: suelta, onDoubleClick: reinicia, onKeyDown: alTeclear },
  };
}
