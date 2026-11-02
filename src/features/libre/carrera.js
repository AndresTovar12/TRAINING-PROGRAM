import { useEffect, useState } from 'react';
import { escuchaReloj } from '@/lib/relojApple';

/* LO QUE COMPARTEN LAS PANTALLAS DE CARRERA (2 nov 2026; maqueta WVcKiJ2JhyChJqLwP3bhHD, colores A) y que no es una pantalla: los colores, la letra, el botón
   redondo, el pulso del reloj y cómo se llama una salida muy corta. Las piezas que se dibujan están en `PiezasDeCarrera.jsx`. */

/** Los colores de la opción A: sobre negro puro, el azul de Training Lab un poco más claro (lo que se toca) y el rojo de los stickers (el tiempo, el pulso, «Finalizar»). */
export const C = {
  negro: '#000000', tarjeta: '#0B0C10', hoja: '#16171C', gris: '#8A8F9C', grisClaro: '#9A9AA2', texto: '#FFFFFF', asa: '#3A3B42',
  azul: '#2F55F0', acento: '#FF4D6A', acentoOscuro: '#8A1F33', verde: '#22C38E', redondo: 'rgba(40,40,48,0.92)',
};
/** La letra de los stickers y de la celebración (Bricolage Grotesque, servida desde la app): la del «EN PAUSA». */
export const LETRA_DE_MARCA = "'Bricolage Grotesque', 'Inter', system-ui, sans-serif";

/** Un botón redondo de la pantalla (minimizar, cambiar de vista) sobre negro o sobre el mapa. */
export const redondo = { width: 44, height: 44, borderRadius: 22, border: 'none', background: 'rgba(255,255,255,0.12)', color: '#fff', display: 'grid', placeItems: 'center', cursor: 'pointer', touchAction: 'manipulation', flexShrink: 0 };

/** El pulso que manda el Apple Watch mientras `activo`. Si deja de llegar 20 s (el reloj se quitó, se perdió la conexión), se esconde. */
export function usePulsoDelReloj(activo) {
  const [lpm, setLpm] = useState(null);
  useEffect(() => {
    if (!activo) return undefined;
    let caduca = null;
    const deja = escuchaReloj({
      alPulso: (bpm) => {
        setLpm(bpm > 0 ? Math.round(bpm) : null);
        clearTimeout(caduca);
        caduca = setTimeout(() => setLpm(null), 20000);
      },
    });
    return () => { deja(); clearTimeout(caduca); };
  }, [activo]);
  return activo ? lpm : null;
}

/** «Carrera demasiado corta», «Caminata demasiado corta»: cómo se llama lo que hizo (una actividad propia: «Actividad»). */
export function nombreDeLaCorta(deporte, actividad = null) {
  const propia = actividad && actividad.id !== deporte;
  return (!propia && { correr: 'Carrera', caminar: 'Caminata', bici: 'Rodada', senderismo: 'Caminata' }[deporte]) || 'Actividad';
}
