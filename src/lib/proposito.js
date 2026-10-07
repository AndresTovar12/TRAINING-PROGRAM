/**
 * Qué es un video de un ejercicio: un EJEMPLO (cómo se hace) o una EXPLICACIÓN (el coach explica, o explica y lo hace).
 *
 * Andrés, 7 oct 2026 («esto es súper importante»): hay dos clases de video y el atleta debe poder verlas distintas. El coach
 * dice cuál es con el botón que toca al grabar («Grabar ejemplo» / «Grabar explicación»); si el video viene del carrete o de
 * una liga, se le pregunta; y se corrige después con la pastilla del video en la lista.
 *
 * Vive en `exercise_media.proposito` ('ejemplo' por defecto: lo que ya existía y todas las fotos). El video «de siempre» de un
 * ejercicio (`exercises.video_url`) es SIEMPRE un ejemplo: media app lo lee directo (portada, insignia de «tiene video»), así que
 * una explicación nunca vive ahí, sino en su propia fila de `exercise_media`.
 */
export const EJEMPLO = 'ejemplo';
export const EXPLICACION = 'explicacion';

export const esExplicacion = (m) => m?.proposito === EXPLICACION;

export const nombreDeProposito = (p) => (p === EXPLICACION ? 'Explicación' : 'Ejemplo');

/** La misma lista con las explicaciones primero (cada clase conserva su orden). Andrés: «primero se ve la explicación y luego el ejemplo». */
export const explicacionesPrimero = (lista) => [
  ...lista.filter(esExplicacion),
  ...lista.filter((m) => !esExplicacion(m)),
];
