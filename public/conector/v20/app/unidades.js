/**
 * Kilos y libras.
 *
 * REGLA UNICA, de la que depende todo lo demas: en la base los pesos SIEMPRE
 * están en kilos. La unidad del atleta es solo una forma de verlos.
 *
 * Por qué importa tanto: si cada quien guardara el número tal como lo escribió,
 * el historial quedaría mezclado —unos valores en kilos, otros en libras, sin
 * forma de distinguirlos— y el cálculo de 1RM (`calc1RM`) devolvería resultados
 * equivocados sin dar ninguna señal de que algo anda mal.
 *
 * Así que se convierte en dos únicos momentos: al mostrar y al guardar.
 * Nunca se reconvierte un valor ya convertido, así que no hay pérdida
 * acumulada por redondeo.
 *
 * OJO con un falso amigo: en la pantalla de Ciencia hay tablas de nutrición con
 * "1.8-2.0 g/kg" y "5-6 g/kg CHO". Ese kg es PESO CORPORAL, no peso levantado.
 * No tiene nada que ver con esto y no debe convertirse.
 */

const LB_POR_KG = 2.2046226218;

export const UNIDADES = ['kg', 'lb'];

/** 'kg' | 'lb' — cualquier otra cosa cae en kilos. */
export function normalizaUnidad(u) {
  return u === 'lb' ? 'lb' : 'kg';
}

/** Lo que se guarda: de lo que el atleta escribió, a kilos. */
export function aKilos(valor, unidad) {
  if (valor === '' || valor === null || valor === undefined) return '';
  const n = parseFloat(valor);
  if (Number.isNaN(n)) return '';
  if (normalizaUnidad(unidad) === 'kg') return redondea(n, 2);
  return redondea(n / LB_POR_KG, 2);
}

/** Lo que se muestra: de kilos, a la unidad del atleta. */
export function desdeKilos(kilos, unidad) {
  if (kilos === '' || kilos === null || kilos === undefined) return '';
  const n = parseFloat(kilos);
  if (Number.isNaN(n)) return '';
  if (normalizaUnidad(unidad) === 'kg') return redondea(n, 1);
  return redondea(n * LB_POR_KG, 1);
}

/** Texto listo para pintar: "80" o "176.4". Sin unidad pegada. */
export function pesoTexto(kilos, unidad) {
  const v = desdeKilos(kilos, unidad);
  return v === '' ? '' : String(v);
}

/** 'kg' | 'lb', para poner debajo del campo o después del número. */
export function etiquetaUnidad(unidad) {
  return normalizaUnidad(unidad);
}

/**
 * Se guarda con DOS decimales y se muestra con UNO. No es capricho.
 *
 * El campo de peso se reescribe en pantalla mientras el atleta teclea. Si se
 * guardara con un decimal, escribir "185" en libras daría 83.9 kg, que al
 * volver a libras da 184.9 — y el número le cambiaría solo debajo del dedo.
 * Con dos decimales (83.91) el viaje de ida y vuelta devuelve exactamente 185.
 *
 * Y no se muestran los dos decimales porque nadie ajusta la barra a 0.05 lb.
 */
function redondea(n, decimales) {
  const f = 10 ** decimales;
  return Math.round(n * f) / f;
}
