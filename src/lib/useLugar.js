import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { esArranque, guardaLugar, leeLugar } from '@/lib/lugar';

/**
 * Un `useState` que se acuerda de dónde estaba al refrescar.
 *
 * Se usa igual que `useState`. Al arrancar la app (ver `esArranque`) empieza
 * con lo último que se anotó bajo `clave`, si es de esta persona y reciente;
 * si no, con `porDefecto`. Y cada cambio se anota.
 *
 * `valida` es para desconfiar de lo guardado: una pestaña que ya no existe,
 * un atleta que ya no está. Recibe lo guardado y dice si sirve; si no, se usa
 * `porDefecto`. Lo que dependa de datos que llegan tarde (la lista de atletas,
 * el plan) se vuelve a comprobar cuando llegan.
 *
 * Ver `lugar.js` para el cuándo y el porqué.
 */
export function useLugar(clave, porDefecto, valida) {
  const { user } = useAuth();
  const uid = user?.id;
  const [valor, setValor] = useState(() => {
    if (!esArranque()) return porDefecto;
    const guardado = leeLugar(uid, clave);
    if (guardado === undefined) return porDefecto;
    return !valida || valida(guardado) ? guardado : porDefecto;
  });

  useEffect(() => { guardaLugar(uid, clave, valor); }, [uid, clave, valor]);

  return [valor, setValor];
}

/**
 * Devuelve la pantalla a la altura donde estaba.
 *
 * @param clave  Identifica la pantalla. Cada una guarda su propia altura.
 * @param listo  `true` cuando ya cargó lo que hace falta para poder bajar: con
 *               la lista a medio llegar no hay a dónde bajar todavía.
 * @param ref    El contenedor que se desplaza. Sin él, la ventana.
 *
 * Siempre anota la altura (cada cuarto de segundo, no en cada píxel). Solo
 * baja al arrancar la app, y una vez: moverte dentro de la app nunca te baja
 * solo. Y no lucha con la persona: si toca o gira la rueda antes de llegar,
 * se detiene. Como el contenido suele llegar después que la pantalla, insiste
 * hasta que haya suficiente alto, con un tope de cinco segundos.
 */
export function useScrollLugar(clave, listo, ref) {
  const { user } = useAuth();
  const uid = user?.id;
  const hecho = useRef(false);

  useEffect(() => {
    if (!uid || !clave) return undefined;
    const el = ref?.current ?? null;
    const destino = el ?? window;
    let pendiente = null;
    const guarda = () => {
      pendiente = null;
      /* Con una hoja abierta el cuerpo queda fijado y la ventana marca 0:
         anotar eso pisaría la altura buena. Al cerrarla se restituye sola y
         ahí sí se anota. */
      if (!el && document.body.style.position === 'fixed') return;
      guardaLugar(uid, `scroll.${clave}`, Math.round(el ? el.scrollTop : window.scrollY));
    };
    const alDesplazar = () => { if (pendiente === null) pendiente = setTimeout(guarda, 250); };
    destino.addEventListener('scroll', alDesplazar, { passive: true });
    return () => {
      destino.removeEventListener('scroll', alDesplazar);
      if (pendiente !== null) clearTimeout(pendiente);
    };
  }, [uid, clave, ref]);

  useEffect(() => {
    if (!uid || !clave || !listo || hecho.current) return undefined;
    if (!esArranque()) { hecho.current = true; return undefined; }
    const y = leeLugar(uid, `scroll.${clave}`);
    if (!Number.isFinite(y) || y <= 0) { hecho.current = true; return undefined; }

    const el = ref?.current ?? null;
    const destino = el ?? window;
    let cancelado = false;
    let cuadro = 0;
    const limite = performance.now() + 5000;
    const alUsuario = () => { cancelado = true; };
    destino.addEventListener('wheel', alUsuario, { passive: true, once: true });
    destino.addEventListener('touchstart', alUsuario, { passive: true, once: true });

    const alto = () => (el
      ? el.scrollHeight - el.clientHeight
      : document.documentElement.scrollHeight - window.innerHeight);
    const pone = (v) => { if (el) el.scrollTop = v; else window.scrollTo(0, v); };
    const intenta = () => {
      if (cancelado) return;
      if (alto() >= y - 2 || performance.now() > limite) {
        pone(Math.max(0, Math.min(y, alto())));
        hecho.current = true;
        return;
      }
      cuadro = requestAnimationFrame(intenta);
    };
    cuadro = requestAnimationFrame(intenta);

    return () => {
      cancelado = true;
      cancelAnimationFrame(cuadro);
      destino.removeEventListener('wheel', alUsuario);
      destino.removeEventListener('touchstart', alUsuario);
    };
  }, [uid, clave, listo, ref]);
}
