/* QUE EL iPHONE NO HAGA ZOOM AL TOCAR UN CAMPO (auditoría p92, 26 oct 2026).

   Safari de iPhone acerca la pantalla cuando se toca un campo de texto con letra menor de 16 px, y luego no la regresa: la pantalla queda corrida. Muchos campos del editor y de Salud llevan
   letra de 12 a 15 px a propósito (caben más cosas). En vez de cambiarles el tamaño a todos, mientras el campo tiene el cursor se le pone 16 px y al soltarlo se le devuelve el suyo. */

const CAMPOS = new Set(['INPUT', 'TEXTAREA', 'SELECT']); // estilo-ok: son los nombres de las etiquetas HTML, no texto que se ve
const SIN_TEXTO = new Set(['checkbox', 'radio', 'range', 'button', 'submit', 'reset', 'file', 'color', 'image', 'hidden']);

const esIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export function iniciaSinZoomAlEscribir() {
  try {
    if (typeof document === 'undefined' || !esIOS()) return;
    document.addEventListener('focusin', (e) => {
      const el = e.target;
      if (!el || !CAMPOS.has(el.tagName) || SIN_TEXTO.has(el.type)) return;
      const px = parseFloat(getComputedStyle(el).fontSize);
      if (!(px < 16)) return;
      const antes = el.style.getPropertyValue('font-size');
      const prioridad = el.style.getPropertyPriority('font-size');
      el.style.setProperty('font-size', '16px', 'important');
      el.addEventListener('blur', () => {
        if (antes) el.style.setProperty('font-size', antes, prioridad); else el.style.removeProperty('font-size');
      }, { once: true });
    });
  } catch { /* sin documento: nada que hacer */ }
}
