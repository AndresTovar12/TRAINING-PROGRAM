/**
 * Las palabras del modo entreno según a quién se le dicen.
 *
 * Andrés, 29 sep 2026, sobre el fisio que quiere la app: «que se dé cuenta de que se pensó en él». Un paciente no «entrena»: hace sus
 * ejercicios, y se los cuenta a su fisio, no a su «coach». Solo cambian los textos FIJOS de la pantalla (los de `lib/palabras.js` no
 * cubren «entreno»); lo que escribió una persona —el nombre de un ejercicio, una nota— nunca se toca.
 */
const NORMAL = {
  iniciar: 'Iniciar entreno',
  continuar: 'Continuar entreno',
  salirAria: 'Salir del entreno',
  listaTitulo: 'Tu entreno',
  listaTerminar: 'Terminar entreno',
  salirTitulo: '¿Salir del entreno?',
  finTitulo: 'Entrenamiento terminado',
  finTexto: 'Tu avance ya está guardado. Cuéntale a tu coach cómo te fue, si quieres.',
  finNotasAria: 'Notas para tu coach',
  finVolver: 'Volver al entreno',
};

const SALUD = {
  iniciar: 'Iniciar ejercicios',
  continuar: 'Continuar ejercicios',
  salirAria: 'Salir de los ejercicios',
  listaTitulo: 'Tus ejercicios',
  listaTerminar: 'Terminar ejercicios',
  salirTitulo: '¿Salir de los ejercicios?',
  finTitulo: 'Sesión terminada',
  finTexto: 'Tu avance ya está guardado. Cuéntale a tu fisio cómo te fue, si quieres.',
  finNotasAria: 'Notas para tu fisio',
  finVolver: 'Volver a los ejercicios',
};

/** Los textos fijos del entreno: los de siempre, o los de un paciente (`salud`). */
export const palabrasDelEntreno = (salud) => (salud ? { ...NORMAL, ...SALUD } : NORMAL);
