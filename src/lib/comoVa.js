/* «Cómo va» un paciente, en funciones puras: la ficha, la lista y la portada
   del paciente las usan igual y así se pueden probar sin abrir la app. */

/** El alta se anuncia 7 días al paciente: después la tarjeta ya no sale. */
export const altaReciente = (altaEn, ahora = Date.now()) => (
  !!altaEn && ahora - Date.parse(altaEn) <= 7 * 86400000
);
