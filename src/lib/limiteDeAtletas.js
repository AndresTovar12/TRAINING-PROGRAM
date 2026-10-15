/* TOPE DE ATLETAS A MANO (14 oct 2026; ver `docs/sql/2026-10-14-limite-de-atletas.sql`).

   Cada coach o fisio NUEVO puede agregar 5 atletas gratis A MANO (liga, QR, su código, el código o QR del equipo). Quien COMPRA un plan suyo no cuenta.
   Para más lugares: que compren un programa suyo, o pagar derechos (paquetes de lugares).

   El tope lo cuida la base con disparadores (no depende de esta pantalla). Cuando se pasa, suelta el texto fijo `LIMITE_DE_ATLETAS|<límite>|<usados>`.
   Aquí se reconoce ese texto y se convierte en un error con nombre para que cada pantalla lo cuente a su manera. */

const MARCA = /LIMITE_DE_ATLETAS\|(\d+)\|(\d+)/;

/** Se agotaron los lugares. `limite` y `usados` vienen del servidor (pueden ser `null` si solo se sabe que se agotaron). */
export class ErrorDeLimite extends Error {
  constructor(mensaje, { limite = null, usados = null } = {}) {
    super(mensaje);
    this.name = 'ErrorDeLimite';
    this.limite = limite;
    this.usados = usados;
  }
}

/** Lo que dice un atleta cuando el entrenador al que quiere unirse ya no tiene lugares. */
export const AVISO_PARA_EL_ATLETA = 'Este entrenador ya no puede recibir más atletas por ahora. Avísale.';

/** `{ limite, usados }` si el error trae el texto fijo del servidor; si no, `null`. */
export function datosDelLimite(e) {
  const m = MARCA.exec(String(e?.message ?? e ?? ''));
  return m ? { limite: Number(m[1]), usados: Number(m[2]) } : null;
}

/** Si el error es del tope, lo devuelve como `ErrorDeLimite` (con el mensaje que se le pasa); si no, lo devuelve igual. Para `throw comoErrorDeLimite(error)`. */
export function comoErrorDeLimite(e, mensaje = AVISO_PARA_EL_ATLETA) {
  const datos = datosDelLimite(e);
  return datos ? new ErrorDeLimite(mensaje, datos) : e;
}

/** `lugares` es lo que devuelve la función `lugares_de` de la base: `{ limite, usados, libres, ilimitado }`. */
export const sinLugares = (lugares) => !!lugares && !lugares.ilimitado && lugares.libres <= 0;

/** «3 de 5», o `null` si no tiene tope (el dueño y los coaches de antes) o aún no se sabe. */
export function etiquetaDeLugares(lugares) {
  if (!lugares || lugares.ilimitado) return null;
  return `${lugares.usados} de ${lugares.limite}`;
}

/** El título del aviso cuando ya no hay lugares. Con el tope de fábrica dice «gratis»; con un paquete pagado, no. */
export function tituloSinLugares(lugares, gratisDeFabrica = 5) {
  const limite = lugares?.limite ?? gratisDeFabrica;
  return limite === gratisDeFabrica
    ? `Solo puedes agregar ${limite} atletas gratis`
    : `Llegaste a tus ${limite} atletas`;
}

/** Los paquetes que dan más lugares de los que ya se tienen, del más chico al más grande. */
export const paquetesQueAmplian = (paquetes, lugares) =>
  (paquetes ?? [])
    .filter((p) => p.activo !== false && p.atletas_total > (lugares?.limite ?? 0))
    .sort((a, b) => a.atletas_total - b.atletas_total);

/** Precio en pesos, sin centavos: 349 → «$349». */
export const pesos = (n) => `$${Number(n ?? 0).toLocaleString('es-MX', { maximumFractionDigits: 0 })}`;

/* ---------- Lo que fija el dueño por profesional ---------- */

/** La comisión normal de la app, en %. Debe coincidir con `tasaDeComision` de los `stripe.js` de las funciones de Stripe. */
export const COMISION_BASE_PORCIENTO = 20;

/** Cómo se ve el tope de un profesional en la base: `null` = el de fábrica, `-1` = sin tope, un número = ese tope. */
export const modoDeLimite = (limite) => (limite === null || limite === undefined ? 'fabrica' : Number(limite) === -1 ? 'sin_tope' : 'numero');

/** Del formulario a la base. Devuelve `{ valor }` o `{ error }`. `modo`: fabrica | sin_tope | numero. */
export function limiteParaGuardar(modo, texto) {
  if (modo === 'fabrica') return { valor: null };
  if (modo === 'sin_tope') return { valor: -1 };
  const t = String(texto ?? '').trim();
  const n = Number(t);
  if (t === '' || !Number.isInteger(n) || n < 0) return { error: 'Escribe un número entero, de 0 para arriba.' };
  return { valor: n };
}

/** La comisión de la base (fracción 0–1, o `null`) al texto del formulario (porcentaje). 0.15 → «15». */
export const comisionATexto = (fraccion) => (fraccion === null || fraccion === undefined ? '' : String(Math.round(Number(fraccion) * 10000) / 100));

/** Del formulario a la base. `texto` vacío = la normal (`null`). Devuelve `{ valor }` o `{ error }`. */
export function comisionParaGuardar(texto) {
  const t = String(texto ?? '').trim().replace(',', '.');
  if (t === '') return { valor: null };
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0 || n > 100) return { error: 'La comisión va de 0 a 100 %.' };
  return { valor: Math.round(n * 100) / 10000 };
}
