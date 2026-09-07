/**
 * Qué video le toca ver a cada atleta.
 *
 * Un ejercicio puede tener varios videos: grabado de frente y de lado, una
 * versión de hombre y una de mujer, o uno puesto a mano solo para una persona.
 * Aquí se decide cuál manda.
 *
 * ORDEN DE RESOLUCIÓN, acordado con Andrés:
 *   1. Video puesto SOLO para ese atleta. Gana siempre: si el coach se tomó el
 *      trabajo de grabarle uno a él, es porque los demás no le servían.
 *   2. Versión de su género.
 *   3. Versión única, la que sirve para todos.
 *   4. El `video_url` de siempre, que es lo que ya tienen los 81 ejercicios.
 *
 * Si el atleta no puso género, el paso 2 no aplica y cae en el 3. Nunca se le
 * adivina: mostrarle la versión equivocada es peor que mostrarle la genérica.
 */

/** Los videos de ESTE ejercicio que aplican a ESTE atleta, ya ordenados. */
export function videosParaAtleta(ejercicio, medias, perfil) {
  if (!ejercicio) return [];
  const id = ejercicio.exercise_id || ejercicio.id;
  if (!id) return [];

  const genero = perfil?.genero || null;
  const míos = (medias ?? []).filter((m) => m.exercise_id === id && m.tipo === 'video');

  const paraMí = míos.filter((m) => m.para_atleta && m.para_atleta === perfil?.id);
  const deMiGénero = genero ? míos.filter((m) => !m.para_atleta && m.genero === genero) : [];
  const paraTodos = míos.filter((m) => !m.para_atleta && !m.genero);

  // El primero de la lista es el que se abre. Los demás quedan como ángulos
  // entre los que puede cambiar.
  const elegidos = paraMí.length ? paraMí : (deMiGénero.length ? deMiGénero : paraTodos);

  const lista = elegidos.map((m) => ({
    url: m.url,
    etiqueta: m.etiqueta || 'Video',
    id: m.id,
  }));

  // El video de siempre entra al final, no al principio: si el coach subió
  // ángulos nuevos es porque son mejores que el original.
  const original = ejercicio.video_url || ejercicio.video_link;
  if (original && !lista.some((v) => v.url === original)) {
    lista.push({ url: original, etiqueta: lista.length ? 'Original' : 'Video', id: 'original' });
  }
  return lista;
}

/** Solo la dirección del video que se abre por defecto. null si no hay ninguno. */
export function videoPrincipal(ejercicio, medias, perfil) {
  return videosParaAtleta(ejercicio, medias, perfil)[0]?.url ?? null;
}

/** Etiquetas sugeridas al subir un ángulo. Se puede escribir cualquier otra. */
export const ANGULOS_SUGERIDOS = ['Frontal', 'Lateral', 'Desde atrás', 'Cámara lenta', 'Detalle'];
