/* Pruebas de la COPIA DEL ESTADO en el teléfono (sin conexión, parte 2.1; ver `src/lib/copiaDelEstado.js` y `docs/sin-conexion.md`):
   `node scripts/prueba-copia-del-estado.mjs`. Sin red: la «base» es un objeto que se mezcla igual que `mezclar_mi_estado` (`jsonb_mezcla` = `aplicarParche`).

   Lo que se prueba es la regla de seguridad: lo hecho sin señal se sube ENCIMA de lo que la base tenga al volver la señal (lo de la base manda), los parches se sacan
   contra la última copia conocida de la base y nunca contra un estado vacío, y lo que otro aparato escribió mientras tanto no se borra. */
import assert from 'node:assert/strict';
import { BORRAR, aplicarParche, diferencia } from '../src/lib/estadoPorPartes.js';
import {
  abreCopia, armaCopia, cuantasCosas, noPisaElMarcador, pendienteQueManda, rebasa, seMovioSolo, soloLoPendiente,
} from '../src/lib/copiaDelEstado.js';

let n = 0;
const prueba = (nombre, f) => { f(); n += 1; console.log(`  ✓ ${nombre}`); };
const copiaJson = (x) => JSON.parse(JSON.stringify(x)); // lo que de verdad pasa por el almacén del teléfono

/** La base, falsa: guarda el estado y lo mezcla como `mezclar_mi_estado`. */
const base = (inicial) => ({
  data: copiaJson(inicial),
  mezcla(parche) { if (parche !== undefined) this.data = aplicarParche(this.data, copiaJson(parche)); },
});

/** El teléfono vuelve a tener señal: relee la base, pone encima lo suyo y sube lo que falta (lo que hace `AppStateContext`). */
function vuelveLaSenal(servidor, copiaGuardada) {
  const abierta = abreCopia(copiaJson(copiaGuardada));
  const fresco = copiaJson(servidor.data);
  const nuevo = rebasa(fresco, abierta.enLaBase, abierta.store);
  const parche = diferencia(fresco, nuevo);
  servidor.mezcla(parche);
  return { nuevo, parche };
}

const B0 = {
  'wr:sessions': { 'wk-2026-W44-d1': { exercises: { 0: { kg: 50 } }, completed: true } },
  'wr:wellness': { '2026-10-30': { sueno: 7 } },
  'wr:cursor': { phaseId: 'f1', weekNum: 3, dayIdx: 0, fijadoEn: '2026-W44' },
  'wr:onerm': { sentadilla: 100 },
};

console.log('La copia');
prueba('lo que se guarda y lo que se abre es lo mismo (también después de pasar por JSON)', () => {
  const enPantalla = aplicarParche(B0, { 'wr:sessions': { 'wk-2026-W45-d0': { exercises: { 0: { kg: 55 } } } } });
  const abierta = abreCopia(copiaJson(armaCopia(B0, enPantalla, 1)));
  assert.deepEqual(abierta.enLaBase, B0);
  assert.deepEqual(abierta.store, enPantalla);
  assert.deepEqual(abierta.pendiente, { 'wr:sessions': { 'wk-2026-W45-d0': { exercises: { 0: { kg: 55 } } } } });
});
prueba('sin cambios no hay nada pendiente', () => {
  assert.equal(armaCopia(B0, B0).pendiente, null);
  assert.equal(abreCopia(armaCopia(B0, B0)).pendiente, undefined);
});
prueba('una copia que no se entiende no sirve (no se usa para nada)', () => {
  for (const mala of [null, undefined, 'hola', 3, [], { v: 2, enLaBase: {} }, { noSeEntiende: 'x' }]) assert.equal(abreCopia(mala), null, JSON.stringify(mala));
});

console.log('Nunca contra un estado vacío');
prueba('lo que queda al salir de la cuenta es solo lo pendiente: no se puede enseñar, solo subir encima de la base', () => {
  const enPantalla = aplicarParche(B0, { 'wr:wellness': { '2026-11-01': { sueno: 8 } } });
  const resto = soloLoPendiente(armaCopia(B0, enPantalla));
  assert.equal(resto.enLaBase, null);
  const abierta = abreCopia(copiaJson(resto));
  assert.equal(abierta.store, null, 'sin base no hay qué dibujar');
  assert.deepEqual(abierta.pendiente, { 'wr:wellness': { '2026-11-01': { sueno: 8 } } });
  assert.equal(soloLoPendiente(armaCopia(B0, B0)), null, 'sin pendientes no queda nada');
});
prueba('un parche contra el estado vacío BORRARÍA lo que hay; contra la copia de la base, no', () => {
  const enPantalla = aplicarParche(B0, { 'wr:onerm': { banca: 80 } });
  const contraVacio = diferencia({}, enPantalla);
  assert.ok(Object.keys(contraVacio).length >= 4, 'contra vacío manda TODO lo que hay en pantalla (y con una pantalla vacía, borraría)');
  assert.deepEqual(armaCopia(B0, enPantalla).pendiente, { 'wr:onerm': { banca: 80 } }, 'contra la copia de la base, solo lo nuevo');
});

console.log('Dos aparatos');
prueba('lo que la compu (o la IA) escribió mientras el teléfono no tenía señal se queda; lo del teléfono se suma', () => {
  const servidor = base(B0);
  // El teléfono, sin señal, anota una sesión nueva y su bienestar de hoy.
  const telefono = aplicarParche(B0, {
    'wr:sessions': { 'wk-2026-W45-d1': { exercises: { 0: { kg: 60 } }, completed: true } },
    'wr:wellness': { '2026-11-01': { sueno: 6 } },
  });
  const copia = armaCopia(B0, telefono);
  // Mientras, en la compu: otra sesión, un 1RM nuevo y el bienestar de AYER corregido.
  servidor.mezcla({ 'wr:sessions': { 'wk-2026-W45-d0': { completed: true } }, 'wr:onerm': { banca: 90 }, 'wr:wellness': { '2026-10-30': { sueno: 9 } } });
  vuelveLaSenal(servidor, copia);
  const s = servidor.data;
  assert.equal(s['wr:sessions']['wk-2026-W45-d0'].completed, true, 'la sesión de la compu');
  assert.equal(s['wr:sessions']['wk-2026-W45-d1'].exercises[0].kg, 60, 'la del teléfono');
  assert.equal(s['wr:sessions']['wk-2026-W44-d1'].completed, true, 'la de antes');
  assert.deepEqual(s['wr:onerm'], { sentadilla: 100, banca: 90 });
  assert.equal(s['wr:wellness']['2026-10-30'].sueno, 9, 'la corrección de la compu no se pisa');
  assert.equal(s['wr:wellness']['2026-11-01'].sueno, 6);
});
prueba('lo que se BORRÓ en la otra compu no revive (el teléfono no lo tocó)', () => {
  const servidor = base(B0);
  const telefono = aplicarParche(B0, { 'wr:sessions': { 'wk-2026-W45-d1': { completed: true } } });
  const copia = armaCopia(B0, telefono);
  servidor.mezcla({ 'wr:onerm': BORRAR, 'wr:sessions': { 'wk-2026-W44-d1': BORRAR } });
  vuelveLaSenal(servidor, copia);
  assert.equal('wr:onerm' in servidor.data, false);
  assert.equal('wk-2026-W44-d1' in servidor.data['wr:sessions'], false);
  assert.equal(servidor.data['wr:sessions']['wk-2026-W45-d1'].completed, true);
});
prueba('una copia vieja SIN cambios no sube nada: lo de la base manda entero', () => {
  const servidor = base(B0);
  const copia = armaCopia(B0, B0); // días sin abrir, sin anotar nada
  servidor.mezcla({ 'wr:cursor': { phaseId: 'f2', weekNum: 1, dayIdx: 0, fijadoEn: '2026-W45' }, 'wr:onerm': { sentadilla: 110 } });
  const { nuevo, parche } = vuelveLaSenal(servidor, copia);
  assert.equal(parche, undefined, 'no se manda nada');
  assert.deepEqual(nuevo, servidor.data, 'en pantalla, lo de la base');
});
prueba('si los dos cambiaron LO MISMO, gana lo último que llega (el teléfono, al volver la señal)', () => {
  const servidor = base(B0);
  const telefono = aplicarParche(B0, { 'wr:sessions': { 'wk-2026-W44-d1': { exercises: { 0: { kg: 52 } } } } });
  const copia = armaCopia(B0, telefono);
  servidor.mezcla({ 'wr:sessions': { 'wk-2026-W44-d1': { exercises: { 0: { kg: 55 } } } } });
  vuelveLaSenal(servidor, copia);
  assert.equal(servidor.data['wr:sessions']['wk-2026-W44-d1'].exercises[0].kg, 52);
});
prueba('el marcador va entero: el que movió la persona sin señal no se mezcla con el de la base', () => {
  const servidor = base(B0);
  const movido = { phaseId: 'f1', weekNum: 4, dayIdx: 2, fijadoEn: '2026-W45', motivo: 'atleta' };
  const copia = armaCopia(B0, { ...B0, 'wr:cursor': movido });
  servidor.mezcla({ 'wr:cursor': { phaseId: 'f2', weekNum: 1, dayIdx: 0, fijadoEn: '2026-W45', pausa: '2026-10-31' } });
  vuelveLaSenal(servidor, copia);
  assert.deepEqual(servidor.data['wr:cursor'], movido, 'ni fase de uno ni pausa del otro: el marcador completo de quien llegó al último');
});

console.log('Siempre juntos');
prueba('una pantalla vieja contra una base nueva «desharía» lo del otro aparato; por eso se guardan juntas y se rebasa', () => {
  const telefono = aplicarParche(B0, { 'wr:onerm': { banca: 80 } });
  const fresco = aplicarParche(B0, { 'wr:sessions': { 'wk-2026-W45-d0': { completed: true } } });
  const malo = diferencia(fresco, telefono);
  assert.deepEqual(malo['wr:sessions'], { 'wk-2026-W45-d0': BORRAR }, 'así se borraría la sesión de la compu');
  const bueno = diferencia(fresco, rebasa(fresco, B0, telefono));
  assert.deepEqual(bueno, { 'wr:onerm': { banca: 80 } }, 'rebasado: solo lo del teléfono');
});

console.log('«N cosas por subir»');
prueba('cada sesión anotada cuenta una; cada día de bienestar uno; lo de la pantalla no cuenta', () => {
  assert.equal(cuantasCosas(null), 0);
  assert.equal(cuantasCosas({ 'wr:sessions': { a: {}, b: {} }, 'wr:sessions@fisio': { c: {} } }), 3);
  assert.equal(cuantasCosas({ 'wr:wellness': { '2026-11-01': {} }, 'wr:onerm': { banca: 1 }, 'wr:cursor': {} }), 3);
  assert.equal(cuantasCosas({ 'ui:avisos-vistos': { x: 1 }, 'ui:stickers-vistos': 'y' }), 0);
  assert.equal(cuantasCosas({ 'wr:sessions': BORRAR }), 1);
});

console.log('El marcador que la app movió sola (2 nov 2026; la carrera del arranque está en prueba-marcador-al-abrir.mjs)');
const F4 = { phaseId: 'f4', weekNum: 6, dayIdx: 0, fijadoEn: '2026-W45', motivo: 'calendario' };
const NUEVO = { phaseId: 'f1', weekNum: 1, dayIdx: 0, fijadoEn: '2026-W45', motivo: 'nuevo' };
prueba("'nuevo' no se sube encima de un marcador con fase (la regla de `marcador_nuevo_no_pisa`); sí encima de nada o de otro 'nuevo'", () => {
  const r = noPisaElMarcador({ 'wr:cursor': F4, 'wr:onerm': { banca: 1 } }, { 'wr:cursor': NUEVO, 'wr:onerm': { banca: 2 } });
  assert.deepEqual(r.parche, { 'wr:onerm': { banca: 2 } }, 'lo demás se sube');
  assert.deepEqual(r.devueltos, { 'wr:cursor': F4 }, 'y la pantalla vuelve al de la base');
  assert.equal(noPisaElMarcador({ 'wr:cursor@fisio': F4 }, { 'wr:cursor@fisio': NUEVO }).parche, undefined, 'también en los marcadores de equipo');
  assert.equal(noPisaElMarcador({ 'wr:cursor': F4 }, { 'wr:cursor': BORRAR }).parche, undefined, 'ni borrarlo');
  assert.deepEqual(noPisaElMarcador({}, { 'wr:cursor': NUEVO }).parche, { 'wr:cursor': NUEVO }, 'sin marcador en la base, el primero sí');
  assert.deepEqual(noPisaElMarcador({ 'wr:cursor': NUEVO }, { 'wr:cursor': { ...NUEVO, dayIdx: 2 } }).parche, { 'wr:cursor': { ...NUEVO, dayIdx: 2 } }, 'encima de otro nuevo, sí');
  const plan = { ...F4, motivo: 'plan-nuevo' };
  assert.deepEqual(noPisaElMarcador({ 'wr:cursor': F4 }, { 'wr:cursor': plan }).parche, { 'wr:cursor': plan }, 'un plan nuevo de verdad (plan-nuevo) sí');
});
prueba('al releer: lo que la app movió sola no se pone encima de una base que cambió; lo movido a mano sí', () => {
  const vieja = { 'wr:cursor': F4 };
  const delCoach = { ...F4, phaseId: 'f2', weekNum: 3, motivo: 'coach' };
  const adelantado = { ...F4, phaseId: 'f5', weekNum: 1, fijadoEn: '2026-W46', motivo: 'calendario' };
  assert.deepEqual(rebasa({ 'wr:cursor': delCoach }, vieja, { 'wr:cursor': adelantado })['wr:cursor'], delCoach, 'su coach lo movió: gana la base');
  assert.deepEqual(rebasa({ 'wr:cursor': F4 }, vieja, { 'wr:cursor': adelantado })['wr:cursor'], adelantado, 'la base no cambió: el adelanto se queda');
  const aMano = { ...adelantado, motivo: 'atleta' };
  assert.deepEqual(rebasa({ 'wr:cursor': delCoach }, vieja, { 'wr:cursor': aMano })['wr:cursor'], aMano, 'movido a mano: gana el último que llega');
  assert.deepEqual(rebasa({ 'wr:cursor': F4 }, { 'wr:cursor': NUEVO }, { 'wr:cursor': NUEVO })['wr:cursor'], F4, 'la copia mala (creía que la base tenía el nuevo): gana la base');
  assert.deepEqual(pendienteQueManda({ 'wr:cursor': NUEVO, 'wr:onerm': { banca: 3 } }, null, { 'wr:cursor': F4 }), { 'wr:onerm': { banca: 3 } }, 'sin base vieja conocida, lo movido solo no manda; lo demás sí');
  assert.equal(seMovioSolo({ 'wr:cursor': adelantado }), true);
  assert.equal(seMovioSolo({ 'wr:cursor': aMano, 'wr:onerm': {} }), false);
});

console.log(`\n✓ ${n} pruebas de la copia del estado`);
