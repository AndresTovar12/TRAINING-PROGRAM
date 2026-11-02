/* LA COPIA DEL ESTADO EN EL TELÉFONO (1 nov 2026, encargo «sin conexión», parte 2.1). Lo puro: qué se guarda, cómo se abre y cómo se junta con la
   base cuando vuelve la señal. Lo usa `AppStateContext`; las pruebas están en `scripts/prueba-copia-del-estado.mjs`.

   QUÉ SE GUARDA. Dos cosas, SIEMPRE JUNTAS en un solo guardado (`tl:estado:<id>`):
     · `enLaBase`: lo último que se sabe que tiene la base.
     · `pendiente`: lo que la persona cambió encima y todavía no se sube (un parche, ver `lib/estadoPorPartes.js`).
   Juntas porque los parches se calculan contra `enLaBase`. Si se guardaran por separado y la app se cerrara entre un guardado y otro, una base nueva
   con un estado viejo daría un parche que BORRA lo que llegó de otro aparato. Con las dos en el mismo guardado eso no puede pasar.

   AL VOLVER LA SEÑAL (`rebasa`). Se relee la base y lo de la base MANDA: encima va solo lo que la persona cambió sin señal. Lo que otro aparato (la compu,
   su IA, su coach al mover el plan) escribió mientras tanto en otras llaves se queda. Si los dos cambiaron lo MISMO (el mismo peso de la misma serie),
   gana el último que llega a la base: el parche es por llave, no hay forma de saber cuál fue después.

   NUNCA CONTRA UN ESTADO VACÍO. Si nunca se pudo leer la base y no hay copia, no hay `enLaBase`: no se calcula ni se guarda nada (la regla de
   `AppStateContext` desde el 25 oct 2026). Una copia sin `enLaBase` (lo que queda al salir de la cuenta: solo lo pendiente) no se puede enseñar;
   solo se pone encima de la base cuando se logra leer. */
import { aplicarParche, diferencia } from './estadoPorPartes.js';

/** La llave del almacén del teléfono donde vive la copia del estado de una cuenta. */
export const claveDelEstado = (usuario) => `tl:estado:${usuario}`;

const VERSION = 1;
const esObjeto = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const esBorrar = (x) => esObjeto(x) && x.__borrar === true && Object.keys(x).length === 1;

/* EL MARCADOR VA ENTERO TAMBIÉN AL JUNTAR (1 nov 2026; la regla es del 29 oct, ver `lib/estadoPorPartes.js`). El parche de `wr:cursor` dice «el marcador es ESTE»,
   no «cambia estos pedazos». Al ponerlo encima de una base nueva no se mezcla: se reemplaza. Si se mezclara, el marcador que la persona movió sin señal se juntaría
   con la pausa que su coach puso mientras tanto y quedaría uno mitad y mitad (lo encontró `scripts/prueba-copia-del-estado.mjs`; también pasaba al releer la
   base al volver a la app). Al subirlo, `diferencia` lo manda entero con `BORRAR` en lo que sobra. */
const esMarcador = (k) => /^wr:cursor(@|$)/.test(k);

/** Pone lo pendiente encima de una base: como `aplicarParche`, salvo los marcadores, que se reemplazan enteros. */
export function ponEncima(base, pendiente) {
  if (!esObjeto(pendiente)) return esObjeto(base) ? base : {};
  const resultado = aplicarParche(esObjeto(base) ? base : {}, pendiente);
  for (const [llave, valor] of Object.entries(pendiente)) {
    if (esMarcador(llave) && esObjeto(valor) && !esBorrar(valor)) resultado[llave] = aplicarParche({}, valor);
  }
  return resultado;
}

/** Lo que se guarda en el teléfono: la base conocida y lo pendiente encima, en un solo objeto. */
export function armaCopia(enLaBase, store, en = Date.now()) {
  const base = esObjeto(enLaBase) ? enLaBase : {};
  const pendiente = diferencia(base, esObjeto(store) ? store : {});
  return { v: VERSION, enLaBase: base, pendiente: pendiente ?? null, en };
}

/**
 * Abre una copia guardada: `{ enLaBase, store, pendiente, en }`, o `null` si no sirve.
 * Sin `enLaBase` (se salió de la cuenta y solo quedó lo pendiente) devuelve `{ enLaBase: null, store: null, pendiente }`: eso no se enseña, solo se sube.
 */
export function abreCopia(copia) {
  if (!esObjeto(copia) || copia.v !== VERSION) return null;
  const pendiente = esObjeto(copia.pendiente) ? copia.pendiente : undefined;
  const en = typeof copia.en === 'number' ? copia.en : null;
  if (!esObjeto(copia.enLaBase)) return pendiente ? { enLaBase: null, store: null, pendiente, en } : null;
  return { enLaBase: copia.enLaBase, store: pendiente ? ponEncima(copia.enLaBase, pendiente) : copia.enLaBase, pendiente, en };
}

/* EL MARCADOR QUE LA APP MOVIÓ SOLA NO SE IMPONE (2 nov 2026). Al atleta Andrés la app le guardó «Fase 1 · Semana 1» ('nuevo') encima de «Fase 4 · Semana 6»:
   un marcador sacado de una pantalla que todavía no tenía el estado (ver `scripts/prueba-marcador-al-abrir.mjs`). Dos reglas, las dos también en la base
   (el disparador `marcador_nuevo_no_pisa`, la primera):
     · 'nuevo' NUNCA PISA UN MARCADOR CON FASE. 'nuevo' quiere decir «no había marcador»: si la base tiene uno con fase (y no es otro 'nuevo'), el que dice
       'nuevo' salió de un estado a medias. Se queda el de la base. Un plan de verdad nuevo no usa 'nuevo' sino 'plan-nuevo'.
     · LO QUE LA APP MOVIÓ SOLA NO SE PONE ENCIMA DE UNA BASE QUE CAMBIÓ. El marcador que la app adelanta (calendario, plan editado, primer marcador) se
       puede volver a sacar de la base en cualquier momento. Si al releer la base su marcador ya no es el que se conocía (lo movió su coach, otro aparato o
       a mano en la base), gana el de la base: el pendiente salió de uno viejo. Lo que la persona movió a mano ('atleta') y lo demás sí se pone encima. */
const MOVIDO_SOLO = new Set(['nuevo', 'calendario', 'reparado', 'plan-nuevo']);
const conFase = (m) => esObjeto(m) && !esBorrar(m) && typeof m.phaseId === 'string' && m.phaseId.length > 0;
const igual = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** ¿Este valor de un marcador pisaría el de la base sin que nadie lo haya querido? (la primera regla de arriba; un marcador borrado cuenta igual). */
function pisaElDeLaBase(valor, enLaBase) {
  if (!conFase(enLaBase) || enLaBase.motivo === 'nuevo') return false;
  return esBorrar(valor) || !esObjeto(valor) || valor.motivo === 'nuevo' || !valor.phaseId;
}

const movidoSolo = (valor) => esObjeto(valor) && !esBorrar(valor) && (!valor.motivo || MOVIDO_SOLO.has(valor.motivo));

/** ¿El parche trae un marcador que la app movió sola? (antes de subirlo se relee la base: ver `AppStateContext`). */
export const seMovioSolo = (parche) => esObjeto(parche) && Object.entries(parche).some(([llave, valor]) => esMarcador(llave) && movidoSolo(valor));

/**
 * Antes de subir un parche: quita los marcadores que pisarían el de la base (primera regla de arriba). `{ parche, devueltos }`: `parche` sin ellos (`undefined`
 * si no queda nada) y `devueltos` con el marcador de la base de cada llave quitada, para que la pantalla vuelva a él.
 */
export function noPisaElMarcador(enLaBase, parche) {
  if (!esObjeto(parche)) return { parche, devueltos: {} };
  const base = esObjeto(enLaBase) ? enLaBase : {};
  const devueltos = {};
  const limpio = {};
  for (const [llave, valor] of Object.entries(parche)) {
    if (esMarcador(llave) && pisaElDeLaBase(valor, base[llave])) devueltos[llave] = base[llave];
    else limpio[llave] = valor;
  }
  return { parche: Object.keys(limpio).length ? limpio : undefined, devueltos };
}

/**
 * Lo pendiente que sí manda al ponerlo encima de una base recién leída (las dos reglas de arriba). `baseVieja`: la base contra la que se sacó lo pendiente
 * (`null` si no se sabe: entonces lo que la app movió sola no manda nunca). `undefined` si no queda nada.
 */
export function pendienteQueManda(pendiente, baseVieja, baseNueva) {
  if (!esObjeto(pendiente)) return undefined;
  const vieja = esObjeto(baseVieja) ? baseVieja : null;
  const nueva = esObjeto(baseNueva) ? baseNueva : {};
  const queda = {};
  for (const [llave, valor] of Object.entries(pendiente)) {
    if (esMarcador(llave)) {
      if (pisaElDeLaBase(valor, nueva[llave])) continue;
      if (movidoSolo(valor) && (!vieja || !igual(vieja[llave], nueva[llave]))) continue;
    }
    queda[llave] = valor;
  }
  return Object.keys(queda).length ? queda : undefined;
}

/**
 * Lo que se ve al releer la base: la base nueva (`fresco`) con lo que la persona cambió encima de la vieja y aún no se subía (menos el marcador que no
 * manda, ver `pendienteQueManda`). `enLaBaseVieja` y `storeActual` tienen que ser del mismo momento (ver `AppStateContext`, «SIEMPRE JUNTOS»).
 */
export function rebasa(fresco, enLaBaseVieja, storeActual) {
  const base = esObjeto(fresco) ? fresco : {};
  const vieja = esObjeto(enLaBaseVieja) ? enLaBaseVieja : {};
  const pendiente = pendienteQueManda(diferencia(vieja, esObjeto(storeActual) ? storeActual : {}), vieja, base);
  return pendiente === undefined ? base : ponEncima(base, pendiente);
}

/** Lo que queda en el teléfono al salir de la cuenta: solo lo pendiente, sin la copia de la base. `null` si no falta subir nada. */
export function soloLoPendiente(copia) {
  const abierta = abreCopia(copia);
  if (!abierta?.pendiente) return null;
  return { v: VERSION, enLaBase: null, pendiente: abierta.pendiente, en: abierta.en };
}

/**
 * Cuántas «cosas» hay en un parche, para el «N cosas por subir» de Mi perfil: cada sesión anotada cuenta una, cada día de bienestar uno y cada otra
 * llave (1RM, en qué semana va…) una. Lo de la pantalla (`ui:…`, qué avisos ya vio) se sube igual, pero no se cuenta: nadie lo reconocería como «algo suyo».
 */
export function cuantasCosas(parche) {
  if (!esObjeto(parche)) return 0;
  let n = 0;
  for (const [llave, valor] of Object.entries(parche)) {
    if (/^ui:/.test(llave)) continue;
    if ((/^wr:sessions(@|$)/.test(llave) || llave === 'wr:wellness') && esObjeto(valor) && !esBorrar(valor)) n += Math.max(1, Object.keys(valor).length);
    else n += 1;
  }
  return n;
}
