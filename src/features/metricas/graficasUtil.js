import { useEffect, useRef, useState } from 'react';
import { relojTexto } from '@/lib/metricas/formato';

/* Lo que comparten las gráficas y las pantallas que las usan, aparte de los componentes: colores de zona, medir el ancho, marcas «bonitas» de los ejes. */

/** Los colores de las cinco zonas de pulso (de suave a fuerte; ninguna pareja depende solo del rojo y el verde). */
export const COLORES_DE_ZONA = ['#8FA3C8', '#3DA9F5', '#2DBE8C', '#F2A33A', '#E0475B'];

/** El ancho (en píxeles) del elemento que se le pasa, y se actualiza si cambia (girar el teléfono, abrir un panel). */
export function useAncho() {
  const ref = useRef(null);
  const [ancho, setAncho] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const mide = () => setAncho(Math.round(el.getBoundingClientRect().width));
    mide();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', mide);
      return () => window.removeEventListener('resize', mide);
    }
    const o = new ResizeObserver(mide);
    o.observe(el);
    return () => o.disconnect();
  }, []);
  return [ref, ancho];
}

/** Marcas «bonitas» para un eje numérico: de 3 a `objetivo` marcas en múltiplos de 1, 2, 2.5, 5 o 10. */
export function marcasNumericas(min, max, objetivo = 5) {
  if (!(max > min)) return [min];
  const bruto = (max - min) / Math.max(1, objetivo - 1);
  const pot = 10 ** Math.floor(Math.log10(bruto));
  const paso = [1, 2, 2.5, 5, 10].map((m) => m * pot).find((p) => p >= bruto) ?? 10 * pot;
  const marcas = [];
  for (let v = Math.ceil(min / paso) * paso; v <= max + paso * 1e-9; v += paso) marcas.push(Math.round(v * 1e6) / 1e6);
  return marcas;
}

/** Marcas para un eje de tiempo en segundos: cada 1, 2, 5, 10, 15, 30 o 60 min según el largo. */
export function marcasDeTiempo(maxSeg, objetivo = 5) {
  const pasos = [60, 120, 300, 600, 900, 1800, 3600, 7200];
  const paso = pasos.find((p) => maxSeg / p <= objetivo) ?? 7200;
  const marcas = [];
  for (let v = 0; v <= maxSeg + 1; v += paso) marcas.push(v);
  return { marcas, paso };
}

/** El eje de tiempo de una gráfica de un entreno (segundos desde el inicio), con sus etiquetas («0:10:00»). */
export function ejeDeTiempo(maxSeg) {
  const { marcas } = marcasDeTiempo(maxSeg, 5);
  return { min: 0, max: Math.max(maxSeg, 1), marcas: marcas.map((v) => ({ v, etiqueta: relojTexto(v) })) };
}
