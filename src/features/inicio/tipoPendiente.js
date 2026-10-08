/**
 * El tipo de cuenta que alguien ya contestó ANTES de irse a Google.
 *
 * «Continuar con Google» saca a la persona de la app (a Google, y de vuelta) y todo lo que había en pantalla se pierde. Si
 * ya había contestado «Sigo un plan» o «Creo planes», al volver no se le pregunta otra vez: se anota aquí, en esta pestaña
 * (`sessionStorage`), con la hora, y vale 15 minutos. Pasado ese tiempo, o si nunca volvió, se ignora.
 *
 * Valores: 'coach' | 'atleta' (los mismos de `Inicio`).
 */
const LLAVE = 'tl:inicio-tipo';
const VIGENCIA_MS = 15 * 60 * 1000;

const valido = (tipo) => tipo === 'coach' || tipo === 'atleta';

export function guardaTipoPendiente(tipo) {
  if (!valido(tipo)) return;
  try {
    sessionStorage.setItem(LLAVE, JSON.stringify({ tipo, en: Date.now() }));
  } catch { /* sin almacenamiento: al volver se le pregunta */ }
}

/** Mira sin borrar: se puede llamar al dibujar. */
export function leeTipoPendiente() {
  try {
    const crudo = sessionStorage.getItem(LLAVE);
    if (!crudo) return null;
    const { tipo, en } = JSON.parse(crudo);
    return valido(tipo) && Date.now() - en < VIGENCIA_MS ? tipo : null;
  } catch {
    return null;
  }
}

export function olvidaTipoPendiente() {
  try { sessionStorage.removeItem(LLAVE); } catch { /* nada que borrar */ }
}
