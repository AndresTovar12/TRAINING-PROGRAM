/**
 * Las palabras del modo entreno según a quién se le dicen.
 *
 * Andrés, 29 sep 2026, sobre el fisio que quiere la app: «que se dé cuenta de que se pensó en él». Un paciente no «entrena»: hace sus
 * ejercicios, y se los cuenta a su fisio, no a su «coach». Solo cambian los textos FIJOS de la pantalla (los de `lib/palabras.js` no
 * cubren «entreno»); lo que escribió una persona —el nombre de un ejercicio, una nota— nunca se toca.
 */
const NORMAL = {
  quitarTitulo: '¿Quitar el entreno guiado?',
  quitarAria: 'Quitar el entreno guiado',
  iniciar: 'Iniciar entreno',
  continuar: 'Continuar entreno',
  salirAria: 'Salir del entreno',
  listaTitulo: 'Tu entreno',
  listaTerminar: 'Terminar entreno',
  finTitulo: 'Entrenamiento terminado',
  finNotas: 'Notas para tu coach',
  finVolver: 'Volver al entreno',
  tecnicaTitulo: 'Grabar técnica para tu coach',
  tecnicaTexto: 'Muy pronto. Vas a grabar esta serie desde aquí y le llegará a tu coach por mensajes, sin salir del entreno.',
};

const SALUD = {
  quitarTitulo: '¿Quitar los ejercicios guiados?',
  quitarAria: 'Quitar los ejercicios guiados',
  iniciar: 'Iniciar ejercicios',
  continuar: 'Continuar ejercicios',
  salirAria: 'Salir de los ejercicios',
  listaTitulo: 'Tus ejercicios',
  listaTerminar: 'Terminar ejercicios',
  finTitulo: 'Sesión terminada',
  finNotas: 'Notas para tu fisio',
  finVolver: 'Volver a los ejercicios',
  tecnicaTitulo: 'Grabar técnica para tu fisio',
  tecnicaTexto: 'Muy pronto. Vas a grabar este ejercicio desde aquí y le llegará a tu fisio por mensajes, sin salir de los ejercicios.',
};

/** Los textos fijos del entreno: los de siempre, o los de un paciente (`salud`). */
export const palabrasDelEntreno = (salud) => (salud ? { ...NORMAL, ...SALUD } : NORMAL);
