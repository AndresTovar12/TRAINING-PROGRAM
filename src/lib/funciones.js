/**
 * Funciones que ya tienen su lugar en la app pero todavía NO se prenden.
 *
 * Andrés, 9 oct 2026 (EXPERIENCIA DE WORKOUTS): «grabar técnica para el coach» es un futuro cercano. Se deja el botón a la vista, con su
 * «Pronto» (igual que «Mensajes» en la barra de abajo), y el hueco de datos preparado; se prende cuando él diga «ya haz que sirva».
 * Una función apagada NO hace nada oculto: solo enseña que viene, para que nadie la busque ni crea que falla.
 *
 * Prender una: ponerla en `true` AQUÍ y darle a quien la dibuja lo que le falta (ver el comentario de cada una). Es el único interruptor.
 */
/**
 * ¿Esto corre dentro de la app descargable? Ahí el envoltorio (Capacitor) pone `window.Capacitor` antes de que cargue la página; en la web no existe y
 * da `false`. Es lo único que distingue a la app de la web: lo que sea «solo de la app» cuelga de aquí.
 */
const enLaApp = () => typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.();

export const FUNCIONES = Object.freeze({
  /**
   * «Grabar técnica para el coach»: desde un paso del entreno, el atleta graba SU serie (hasta 60 s) y le llega, como tarjeta con «Técnica correcta» y «Corregir», a quien puso
   * ese ejercicio en el plan, sin salir del entreno. PRENDIDA el 10 oct 2026 («ya haz que sirva»), también en la web: no cuelga de `entrenoCompleto`.
   * Cámara y envío: `features/mensajes/GrabaTecnica`; la tarjeta: `features/mensajes/TarjetaDeTecnica` (ver docs/mensajes.md). El id de la técnica queda ligado a ESA vuelta en
   * `entreno.hechos[clave].tecnica` (el motor ya lo conserva: ver `limpiaReal` en `lib/entreno.js`). Sin a quién mandársela (un atleta sin coach), el botón no sale.
   */
  grabarTecnica: true,

  /**
   * La guía COMPLETA del entreno: «Ver todo» (todo el workout por series), el par A/B de las bi-series y el cronómetro de cada paso con tiempo.
   *
   * Andrés, 9 oct 2026 (noche): el modo entreno de la web se sentía complejo porque intentaba hacer lo mismo que la app descargable y el Apple
   * Watch. Decidió la web más simple y menos capaz, CON su botón «Iniciar entreno»; la app es la que guía de verdad (ver
   * `docs/maquetas/2026-10-09-web-simple-app-completa.html`). La web sigue con el paso a paso básico: un ejercicio a la vez, «Listo», «Cambiar»,
   * el descanso y el reloj de siempre en los Sets con formato. Nada del código se tiró: en la app descargable esto se prende solo.
   */
  entrenoCompleto: enLaApp(),
});
