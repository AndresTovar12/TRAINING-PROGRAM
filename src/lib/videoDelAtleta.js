import { createContext, useContext } from 'react';

/**
 * «SU VIDEO» EN TODOS LOS CUADROS (Andrés, 21 nov 2026: «la instrucción era que lo agregaras siempre que hubiera la posibilidad con el set de
 * iconos»). El editor de la sesión dice de qué atleta es el plan y cómo abrir la ventana del video solo para él (`MediaParaEsteAtleta`, la de
 * Gym). Cualquier editor con cuadros («Agrega, si hace falta», «Más de este ejercicio») pone el cuadro «Su video» si hay atleta y el ejercicio
 * es del repertorio. En una plantilla de Mis planes no hay atleta: `abrir` es null y el cuadro no sale.
 */
export const VideoDelAtleta = createContext({ atleta: null, abrir: null });

/** `abrir(ejercicio)` o null. `ejercicio` necesita su `exercise_id`. */
export function useSuVideo(exerciseId) {
  const { atleta, abrir } = useContext(VideoDelAtleta);
  if (!exerciseId || !atleta?.id || !abrir) return null;
  return abrir;
}

export const VIOLETA_SU_VIDEO = '#7C5CFF';
