import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
/* OJO: un INTERIOR del plugin del mapa (el paquete no tiene mapa de `exports`, así que el import profundo funciona). Está fijado a
   @capgo/capacitor-native-map 8.1.2: si el plugin se actualiza, revisar que `touch-routing.js` siga igual (un contador de instalaciones, el oyente de
   `scroll` en captura y el MutationObserver) antes de dejar esto como está. Ver «EL BARRIDO DEL MAPA» abajo. */
import {
  installIosTouchRoutingCachePublisher, publishIosTouchRoutingCache, uninstallIosTouchRoutingCachePublisher,
} from '@capgo/capacitor-native-map/dist/esm/touch-routing.js';

/* UNA HOJA QUE SE CIERRA DESLIZANDO HACIA ABAJO (6 nov 2026, «Registrar: la hoja se abre sobre el mapa y se cierra deslizando»). Hoy solo la usa la hoja de
   `features/libre/ElegirActividad.jsx` («¿Qué vas a hacer?» y «¿Cómo te mueves?»); está hecha para servirle a cualquier hoja que suba desde abajo.

     · `useHojaDeslizable({ abierta, alCerrar })` da dos refs: `hoja` (la hoja que se mueve) y `velo` (lo oscuro de atrás, HERMANO de la hoja, no su padre:
       así se aclara sin aclarar la hoja).
         - La hoja sigue al dedo. Desde lo que no se desplaza (la asita, la cabecera, el buscador) siempre; desde una lista, solo si ya está hasta arriba y el
           dedo va hacia abajo (si no, la lista se desliza normal). Al soltar se cierra si bajó más de una cuarta parte de su alto o si el gesto fue rápido; si
           no, regresa a su lugar. El velo se aclara conforme baja.
         - Solo cuenta lo vertical: un gesto de lado (el borde izquierdo de iOS) nunca mueve la hoja.
         - Sin `alCerrar` (mientras se crea o se edita algo) no se mueve: no se pierde lo escrito.
         - Al soltar después de arrastrar no sale el toque del renglón donde empezó el dedo.
     · `abierta` en falso: la hoja baja con animación desde donde esté (también a medio jalar) y deja de recibir toques. El que la pinta la deja montada ese
       rato con `useSigueMontado`. Si se vuelve a abrir mientras baja, sube desde ahí.
     · Con `prefers-reduced-motion` no hay animaciones: se va de una vez.

   POR QUÉ SE MUEVE CON ANIMACIONES DE LA PÁGINA (Web Animations) Y NO CON `style.transform`: sobre el mapa de Apple, el plugin del mapa vuelve a revisar TODA la
   página cada vez que cambia un `style` (`touch-routing.js` del plugin: un `getComputedStyle` por elemento, para saber qué toques van al mapa). Con
   `style.transform` en cada movimiento del dedo esa revisión correría en cada cuadro. Una animación no cambia ningún atributo: la hoja se mueve sin que el
   plugin despierte. El velo nunca baja de 10 % de opacidad mientras se arrastra: el plugin ignora lo que tiene menos de 5 % y el toque se iría al mapa.

   EL BARRIDO DEL MAPA SE PAUSA MIENTRAS LA HOJA ESTÁ ABIERTA (6 nov 2026, «Registrar: la lista sobre el mapa ya no se traba al hacer scroll»; Andrés, build 94:
   la lista se trababa y iba a saltos encima del mapa). Mientras hay un mapa `toBack` (clase `native-map-to-back` en <html>), el plugin deja un oyente de
   `scroll` en `window` EN CAPTURA (también oye el de la lista) y un MutationObserver; cada aviso hace, al siguiente cuadro, un `getComputedStyle` de CADA
   elemento de la página y un `postMessage` al iPhone: 60 a 120 barridos por segundo mientras la lista se mueve (medido: 132 en 2 s). Y como el gesto oye
   `touchmove` sin ser pasivo, el iPhone espera al código en cada cuadro, ocupado en el barrido.
     · Al abrirse una hoja, y SOLO en el iPhone con la clase puesta: primero se publica una vez (el iPhone se queda con el rectángulo del velo, que tapa
       toda la pantalla: en ese rato el mapa no necesita toques) y luego se quita el barrido (`uninstall…`, el contador del plugin baja a 0).
     · Al cerrarse (o desmontarse) la última hoja: se vuelve a instalar (barre una vez y el mapa recupera los toques), pero SOLO si la clase sigue puesta y
       NUNCA se fue mientras la hoja estaba abierta. Si se eligió una actividad sin mapa, el mapa se destruyó con la hoja abierta: instalar dejaría el contador
       del plugin en 1 sin mapa y barrería toda la app para siempre. Si el mapa se fue y se creó otro, el plugin ya instaló el suyo: instalar otra vez lo
       dejaría en 2. Por eso un vigía mira solo la clase de <html> (no lo despierta el scroll).
     · Se cuenta por hojas abiertas (`hojasEncima`), no por hoja: «¿Cómo te mueves?» y la lista pueden estar montadas a la vez (una sube mientras la otra
       baja) y una sola pausa sirve a las dos. En la web y en Android no pasa nada (el plugin solo barre en iOS). */

/** Lo que tarda en bajar la hoja al cerrarse (desde arriba; a medio jalar, lo proporcional). */
export const SALIDA_MS = 200;
const CURVA_SALIDA = 'cubic-bezier(0.32, 0.72, 0, 1)';
const CURVA_REGRESO = 'cubic-bezier(0.22, 1, 0.36, 1)'; // la misma con que sube (`.animate-sheet` en index.css)
const VELO_MINIMO = 0.1;
const HOLGURA = 4; // px que se mueve el dedo antes de decidir si es arrastrar la hoja (fuera de la lista)
const RAPIDO = 0.5; // px/ms (500 px/s) hacia abajo al soltar: se cierra aunque haya bajado poco
const VENTANA_MS = 100; // la velocidad se mide con lo último que se movió el dedo
const SIN_CLIC_MS = 350; // después de arrastrar, el clic que le sigue se ignora

const menosMovimiento = () => {
  try { return !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};

/** Cuánto está bajada la hoja ahora mismo (px), sea por una animación o por el arrastre. */
const bajadaDe = (el) => {
  const t = getComputedStyle(el).transform;
  if (!t || t === 'none') return 0;
  const n = t.match(/-?[\d.]+(?:e-?\d+)?/g)?.map(Number) ?? [];
  if (t.startsWith('matrix3d')) return n[14] ?? 0; // el primer número es el «3» de matrix3d
  return n[5] ?? 0;
};
const opacidadDe = (el) => { const o = parseFloat(getComputedStyle(el).opacity); return Number.isFinite(o) ? o : 1; };
const quitaAnimaciones = (el) => { el?.getAnimations?.().forEach((a) => a.cancel()); };

/** El ancestro que se desplaza (la lista), entre `desde` y la hoja; si no hay, `null` (la cabecera, la asita). */
function zonaQueSeDesplaza(desde, hoja) {
  for (let n = desde instanceof Element ? desde : desde?.parentElement; n && n !== hoja; n = n.parentElement) {
    const oy = getComputedStyle(n).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && n.scrollHeight > n.clientHeight + 1) return n;
  }
  return null;
}

const hayMapaDetras = () => document.documentElement.classList.contains('native-map-to-back');
const enIos = () => { try { return Capacitor.getPlatform() === 'ios'; } catch { return false; } };
let hojasEncima = 0; // hojas abiertas que cuentan para la pausa
let pausa = null; // { seFue, vigia }: mientras el barrido está quitado por nosotros

/** Pausa el barrido del plugin del mapa (ver arriba). Devuelve con qué soltar la pausa, o `null` si no había nada que pausar. */
function pausaElBarrido() {
  if (!enIos() || !hayMapaDetras()) return null;
  hojasEncima += 1;
  if (hojasEncima === 1) {
    publishIosTouchRoutingCache();
    uninstallIosTouchRoutingCachePublisher();
    const p = { seFue: false, vigia: null };
    p.vigia = new MutationObserver(() => { if (!hayMapaDetras()) { p.seFue = true; p.vigia.disconnect(); } });
    p.vigia.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    pausa = p;
  }
  let soltada = false;
  return () => {
    if (soltada) return;
    soltada = true;
    hojasEncima -= 1;
    if (hojasEncima > 0 || !pausa) return;
    const p = pausa;
    pausa = null;
    p.vigia.disconnect();
    if (!p.seFue && hayMapaDetras()) installIosTouchRoutingCachePublisher();
  };
}

/** Deja montada una hoja el rato que tarda en bajar después de cerrarse. Devuelve si hay que pintarla. */
export function useSigueMontado(abierta) {
  const [montada, setMontada] = useState(abierta);
  if (abierta && !montada) setMontada(true);
  useEffect(() => {
    if (abierta || !montada) return undefined;
    const id = setTimeout(() => setMontada(false), SALIDA_MS + 40);
    return () => clearTimeout(id);
  }, [abierta, montada]);
  return abierta || (montada && !menosMovimiento()); // sin animaciones, se va en el mismo cuadro
}

export function useHojaDeslizable({ abierta = true, alCerrar = null }) {
  const hoja = useRef(null);
  const velo = useRef(null);
  const vivo = useRef({ abierta, alCerrar });
  useEffect(() => { vivo.current = { abierta, alCerrar }; });
  const fueCerrada = useRef(false);
  const deshazArrastre = useRef(null); // lo pone el gesto: suelta el arrastre en curso si la hoja se cierra por otro lado

  // Abierta encima del mapa de Apple: el plugin no barre la página (ver «EL BARRIDO DEL MAPA»). Al cerrarse o desmontarse, se suelta la pausa.
  useLayoutEffect(() => {
    if (!abierta) return undefined;
    return pausaElBarrido() ?? undefined;
  }, [abierta]);

  /* AL CERRARSE (y al volver a abrirse mientras bajaba): de donde esté a abajo del todo (o de vuelta arriba). Va en `useLayoutEffect`: entre el último
     cuadro del arrastre y el primero de la salida no se pinta nada. */
  useLayoutEffect(() => {
    const el = hoja.current;
    const v = velo.current;
    if (!el || !v) return;
    if (abierta) {
      if (!fueCerrada.current) return;
      fueCerrada.current = false;
      if (menosMovimiento()) { quitaAnimaciones(el); quitaAnimaciones(v); return; }
      const desde = bajadaDe(el);
      const opacidad = opacidadDe(v);
      quitaAnimaciones(el); quitaAnimaciones(v);
      el.animate([{ transform: `translateY(${desde}px)` }, { transform: 'translateY(0px)' }], { duration: 220, easing: CURVA_REGRESO });
      v.animate([{ opacity: opacidad }, { opacity: 1 }], { duration: 220, easing: 'ease-out' });
      return;
    }
    fueCerrada.current = true;
    deshazArrastre.current?.();
    // El teclado se va junto con la hoja (si el buscador tenía el foco).
    if (el.contains(document.activeElement)) document.activeElement.blur?.();
    if (menosMovimiento()) return;
    const alto = el.offsetHeight || window.innerHeight;
    const desde = Math.min(bajadaDe(el), alto);
    const opacidad = opacidadDe(v);
    quitaAnimaciones(el); quitaAnimaciones(v);
    const ms = Math.max(90, Math.round(SALIDA_MS * (1 - desde / alto)));
    el.animate([{ transform: `translateY(${desde}px)` }, { transform: `translateY(${alto}px)` }], { duration: ms, easing: CURVA_SALIDA, fill: 'forwards' });
    v.animate([{ opacity: opacidad }, { opacity: 0 }], { duration: ms, easing: 'ease-out', fill: 'forwards' });
  }, [abierta]);

  /* EL GESTO. Oyentes del navegador (no los de React): `touchmove` tiene que poder cancelar el desplazamiento de la lista y el rebote de iOS, y React los
     instala pasivos. */
  useEffect(() => {
    const el = hoja.current;
    if (!el) return undefined;
    let toque = null; // { x0, y0, zona, estado: 'pendiente' | 'arrastra' | 'nada', base, alto, animH, animV, muestras }
    let soltadoEn = -Infinity;

    const empiezaArrastre = (t, y) => {
      const v = velo.current;
      t.base = Math.max(0, bajadaDe(el)); // si se agarra mientras regresaba, desde donde iba
      t.alto = el.offsetHeight || window.innerHeight;
      t.y0 = y;
      quitaAnimaciones(el); quitaAnimaciones(v); // también la de subir, si todavía no terminaba
      // Dos animaciones detenidas; el dedo mueve su `currentTime` (1 ms = 1 px).
      t.animH = el.animate([{ transform: 'translateY(0px)' }, { transform: `translateY(${t.alto}px)` }], { duration: t.alto, fill: 'forwards' });
      t.animH.pause();
      t.animV = v?.animate([{ opacity: 1 }, { opacity: VELO_MINIMO }], { duration: t.alto, fill: 'forwards' }) ?? null;
      t.animV?.pause();
      mueve(t, y);
      t.estado = 'arrastra';
    };
    const mueve = (t, y) => {
      const d = Math.min(t.alto, Math.max(0, t.base + (y - t.y0)));
      t.d = d;
      t.animH.currentTime = d;
      if (t.animV) t.animV.currentTime = d;
    };
    // Regresa a su lugar desde donde quedó.
    const regresa = (t) => {
      const v = velo.current;
      const desde = t.d ?? 0;
      const opacidad = v ? opacidadDe(v) : 1;
      quitaAnimaciones(el); quitaAnimaciones(v);
      if (menosMovimiento() || desde <= 0) return;
      el.animate([{ transform: `translateY(${desde}px)` }, { transform: 'translateY(0px)' }], { duration: Math.round(Math.min(260, 140 + desde * 0.4)), easing: CURVA_REGRESO });
      v?.animate([{ opacity: opacidad }, { opacity: 1 }], { duration: 200, easing: 'ease-out' });
    };
    deshazArrastre.current = () => { toque = null; };

    const alEmpezar = (e) => {
      toque = null;
      if (!vivo.current.abierta || !vivo.current.alCerrar || e.touches.length !== 1) return;
      const p = e.touches[0];
      toque = {
        x0: p.clientX, y0: p.clientY, zona: zonaQueSeDesplaza(e.target, el), estado: 'pendiente', muestras: [{ y: p.clientY, t: e.timeStamp }],
        campo: !!e.target?.closest?.('input, textarea'), // en el buscador no se cancela nada mientras no sea arrastrar (seleccionar texto es de iOS)
      };
    };
    const alMover = (e) => {
      const t = toque;
      if (!t) return;
      if (e.touches.length !== 1 || !vivo.current.abierta) { if (t.estado === 'arrastra') regresa(t); toque = null; return; }
      const p = e.touches[0];
      const dx = p.clientX - t.x0;
      const dy = p.clientY - t.y0;
      if (t.estado === 'pendiente') {
        if (t.zona) {
          /* En la lista se decide con el PRIMER movimiento: si no se cancela ese, iOS ya empezó a desplazarla y no se puede tomar después. */
          if (dx === 0 && dy === 0) return;
          if (dy > 0 && dy >= Math.abs(dx) && t.zona.scrollTop <= 0) empiezaArrastre(t, p.clientY);
          else { toque = null; return; } // la lista se desliza normal
        } else {
          // Fuera de la lista no hay nada que desplazar: se cancela (que no se mueva lo de atrás) y se espera a que el gesto sea claro.
          if (e.cancelable && !t.campo) e.preventDefault();
          if (Math.abs(dx) > HOLGURA && Math.abs(dx) > dy) { t.estado = 'nada'; return; } // de lado: nunca mueve la hoja
          if (dy > HOLGURA && dy >= Math.abs(dx)) empiezaArrastre(t, p.clientY);
          return;
        }
      }
      if (t.estado === 'nada') { if (e.cancelable && !t.campo) e.preventDefault(); return; }
      if (e.cancelable) e.preventDefault();
      mueve(t, p.clientY);
      t.muestras.push({ y: p.clientY, t: e.timeStamp });
      while (t.muestras.length > 2 && e.timeStamp - t.muestras[0].t > VENTANA_MS) t.muestras.shift();
    };
    const alSoltar = (e) => {
      const t = toque;
      toque = null;
      if (!t || t.estado !== 'arrastra') return;
      if (e.cancelable) e.preventDefault(); // que el renglón donde empezó el dedo no reciba el toque
      soltadoEn = performance.now();
      const ultimo = t.muestras.at(-1);
      const primero = t.muestras.find((m) => ultimo.t - m.t <= VENTANA_MS) ?? t.muestras[0];
      const dt = ultimo.t - primero.t;
      const velocidad = dt > 0 ? (ultimo.y - primero.y) / dt : 0; // px/ms, positiva hacia abajo
      const cierra = velocidad > RAPIDO || (t.d > t.alto / 4 && velocidad > -0.1);
      if (cierra && vivo.current.alCerrar) vivo.current.alCerrar(); // `abierta` pasa a falso: la salida sigue desde donde quedó
      else regresa(t);
    };
    const alCancelar = () => { const t = toque; toque = null; if (t?.estado === 'arrastra') regresa(t); };
    const sinClic = (e) => { if (performance.now() - soltadoEn < SIN_CLIC_MS) { e.preventDefault(); e.stopPropagation(); } };

    el.addEventListener('touchstart', alEmpezar, { passive: true });
    el.addEventListener('touchmove', alMover, { passive: false });
    el.addEventListener('touchend', alSoltar, { passive: false });
    el.addEventListener('touchcancel', alCancelar);
    el.addEventListener('click', sinClic, true);
    return () => {
      deshazArrastre.current = null;
      el.removeEventListener('touchstart', alEmpezar);
      el.removeEventListener('touchmove', alMover);
      el.removeEventListener('touchend', alSoltar);
      el.removeEventListener('touchcancel', alCancelar);
      el.removeEventListener('click', sinClic, true);
    };
  }, []);

  return { hoja, velo };
}
