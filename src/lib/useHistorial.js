import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * EL HISTORIAL (Ctrl/⌘+Z) de un editor.
 *
 * Andrés, 5 oct 2026, con la maqueta aprobada: «todo editor deja Ctrl/⌘+Z» (y los botones ↶ ↷ de la barra).
 *
 *   · Cada cambio guarda una FOTO de cómo estaba todo ANTES (`registra`). Deshacer vuelve a esa foto y guarda la de
 *     ahora para poder rehacer. Un cambio nuevo borra lo que se podía rehacer.
 *   · Escribir seguido en un mismo campo es UN paso: se agrupa hasta que haya una pausa de 1,5 s (o se cambie de
 *     campo). Un clic es un paso. No hace falta que cada campo avise: el hook se entera de en qué campo se escribe
 *     por el evento `input` del navegador (ver `escribiendoEn`).
 *   · La foto trae también DÓNDE estaba quien edita (`lugar`): al deshacer, la vista vuelve al lugar del cambio.
 *   · «¿Hay algo sin guardar?» sale de aquí (`sucio`): cada estado tiene un número y se recuerda el de lo último
 *     guardado. Deshacer hasta lo guardado apaga el botón Guardar; deshacer MÁS allá lo vuelve a encender.
 *   · Se recuerdan 200 pasos. No se guarda en ningún lado: al cerrar el editor se va.
 *
 * Quien lo usa le pasa dos funciones: `leer()` (la foto de ahora: todo lo que se deshace, más `lugar`) y `aplicar(foto)`
 * (la pone de vuelta). Las dos pueden ser cierres nuevos en cada pintada: el hook usa siempre la última.
 *
 * `raiz`: la caja del editor, para saber si Ctrl+Z viene de dentro. Con el foco en una ventana (guardar, elegir un
 * ejercicio, una pregunta) Ctrl+Z es de lo que se escribe ahí y no toca el historial.
 */
const LIMITE = 200;
const PAUSA = 1500;

/* El campo de texto en que se escribe AHORA. El navegador manda `input` antes de que React llame al `onChange` del
   campo, y a ese `onChange` le sigue el `registra()`. Un oyente en captura lo anota antes y otro, en burbuja y arriba de
   todo, lo borra cuando React ya terminó: así `registra()` sabe «esto es escribir en tal campo» sin que ningún campo
   tenga que avisar. */
let escribiendoEn = null;
let escuchando = false;
const idsDeCampo = new WeakMap();
let sigCampo = 0;

const esCampoDeTexto = (el) => !!el && (el.tagName === 'TEXTAREA'
  || (el.tagName === 'INPUT' && !['checkbox', 'radio', 'range', 'color', 'file', 'button', 'submit', 'reset'].includes(el.type)));
const idDeCampo = (el) => {
  if (!el) return null;
  if (!idsDeCampo.has(el)) { sigCampo += 1; idsDeCampo.set(el, sigCampo); }
  return idsDeCampo.get(el);
};
const escucha = () => {
  if (escuchando || typeof document === 'undefined') return;
  escuchando = true;
  document.addEventListener('input', (e) => { escribiendoEn = esCampoDeTexto(e.target) ? e.target : null; }, true);
  document.addEventListener('input', () => { escribiendoEn = null; }, false);
};

// Dos fotos son lo mismo si cada parte es la misma (por referencia: los cambios siempre hacen copias); `lugar` no cuenta.
const mismaFoto = (a, b) => {
  const ka = Object.keys(a).filter((k) => k !== 'lugar');
  const kb = Object.keys(b).filter((k) => k !== 'lugar');
  return ka.length === kb.length && ka.every((k) => Object.is(a[k], b[k]));
};

/** ¿Este elemento está FUERA del editor, o dentro de una ventana flotante del editor (guardar, elegir un ejercicio, una pregunta)?
    Ahí los atajos (Ctrl+Z, Ctrl+S) son de lo que se hace en esa ventana. Con el foco en la página (`body`) o en el propio editor, no. */
export function enVentanaFlotante(donde, caja) {
  if (!(donde instanceof Element) || donde === document.body) return false;
  if (caja && !caja.contains(donde)) return true;
  for (let n = donde; n && n !== caja; n = n.parentElement) if (getComputedStyle(n).position === 'fixed') return true;
  return false;
}

export const HistorialContext = createContext(null);
/** Lo que necesitan los de adentro del editor: `{ deshacer }` (p. ej., el aviso «Se quitó… Deshacer»). `null` si no hay historial. */
export const useHistorialDelEditor = () => useContext(HistorialContext);

export function useHistorial({ leer, aplicar, raiz = null, alCambiar = null }) {
  const pila = useRef({ pasado: [], futuro: [], id: 0, guardado: 0, sig: 1, ultima: null });
  const leerRef = useRef(leer);
  const aplicarRef = useRef(aplicar);
  const alCambiarRef = useRef(alCambiar);
  // Antes de que pueda llegar otro gesto: así `registra()` siempre ve las funciones (y con ellas el estado) de la última pintada.
  useLayoutEffect(() => { leerRef.current = leer; aplicarRef.current = aplicar; alCambiarRef.current = alCambiar; });
  const [estado, setEstado] = useState({ puedeDeshacer: false, puedeRehacer: false, sucio: false });

  const publica = useCallback(() => {
    const p = pila.current;
    const n = { puedeDeshacer: p.pasado.length > 0, puedeRehacer: p.futuro.length > 0, sucio: p.id !== p.guardado };
    setEstado((e) => (e.puedeDeshacer === n.puedeDeshacer && e.puedeRehacer === n.puedeRehacer && e.sucio === n.sucio ? e : n));
  }, []);

  useEffect(() => { escucha(); }, []);

  /* Se llama justo ANTES de aplicar un cambio. `clave` (opcional) agrupa pasos seguidos que son «lo mismo»; sin ella,
     si se está escribiendo en un campo, el campo es la clave. */
  const registra = useCallback((clave) => {
    const p = pila.current;
    const ahora = Date.now();
    const k = clave ?? idDeCampo(escribiendoEn);
    const sigue = k != null && p.ultima != null && p.ultima.k === k && ahora - p.ultima.t < PAUSA;
    p.ultima = k != null ? { k, t: ahora } : null;
    if (sigue) return;
    const foto = leerRef.current();
    const tope = p.pasado[p.pasado.length - 1];
    // Dos avisos en el mismo gesto (antes de que se pinte) ven la misma foto: es un solo paso.
    if (tope && mismaFoto(tope.foto, foto)) return;
    p.pasado.push({ id: p.id, foto });
    if (p.pasado.length > LIMITE) p.pasado.shift();
    p.futuro = [];
    p.id = p.sig;
    p.sig += 1;
    publica();
  }, [publica]);

  const deshacer = useCallback(() => {
    const p = pila.current;
    const previo = p.pasado.pop();
    if (!previo) return false;
    p.futuro.push({ id: p.id, foto: leerRef.current() });
    p.id = previo.id;
    p.ultima = null;
    aplicarRef.current(previo.foto);
    publica();
    alCambiarRef.current?.('deshacer');
    return true;
  }, [publica]);

  const rehacer = useCallback(() => {
    const p = pila.current;
    const sig = p.futuro.pop();
    if (!sig) return false;
    p.pasado.push({ id: p.id, foto: leerRef.current() });
    p.id = sig.id;
    p.ultima = null;
    aplicarRef.current(sig.foto);
    publica();
    alCambiarRef.current?.('rehacer');
    return true;
  }, [publica]);

  // Lo que está en pantalla ES lo guardado. `id`: el de cuando se pidió guardar (si se siguió escribiendo mientras tanto, eso sigue sin guardar).
  const idActual = useCallback(() => pila.current.id, []);
  const marcaGuardado = useCallback((id) => { pila.current.guardado = id ?? pila.current.id; publica(); }, [publica]);

  // Ctrl/⌘+Z deshace; Ctrl/⌘+Mayús+Z o Ctrl/⌘+Y rehace.
  useEffect(() => {
    const alTeclear = (e) => {
      if (e.defaultPrevented || e.isComposing || !(e.metaKey || e.ctrlKey) || e.altKey) return;
      const tecla = e.key.toLowerCase();
      if (tecla !== 'z' && tecla !== 'y') return;
      // El foco fuera del editor, o dentro de una ventana flotante: ahí Ctrl+Z es de otra cosa.
      if (enVentanaFlotante(e.target, raiz?.current)) return;
      e.preventDefault();
      if (tecla === 'y' || e.shiftKey) rehacer(); else deshacer();
    };
    document.addEventListener('keydown', alTeclear);
    return () => document.removeEventListener('keydown', alTeclear);
  }, [raiz, deshacer, rehacer]);

  return { registra, deshacer, rehacer, idActual, marcaGuardado, ...estado };
}
