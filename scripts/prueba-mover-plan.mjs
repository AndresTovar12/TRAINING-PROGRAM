/* Mover y pausar el plan: `node scripts/prueba-mover-plan.mjs`. */
import assert from 'node:assert/strict';
import {
  cursorAlDia, isoWeekKey, sessionForToday, moverPlanA, pausarPlan, reanudarPlan, estaEnPausa, semanaDeAtras,
  agregarAHoy, quitarDeHoy, agregadasDeHoy, claveDeDia, dondeVa,
} from '../src/lib/training-utils.js';

const dia = (d, name) => ({ day: d, name, cat: 'gym' });
const semana = (num) => ({ num, days: [dia('Lun', 'A'), dia('Mar', 'B'), dia('Jue', 'C'), dia('Vie', 'D')] });
const plan = [
  { id: 'f1', name: 'Base', weekData: [semana(1), semana(2)] },
  { id: 'f2', name: 'Fuerza', weekData: [semana(1), semana(2), semana(3)] },
];
const hoy = new Date(2026, 9, 16, 10); // viernes 16 oct 2026
const lunes9 = new Date(2026, 9, 9, 10); // la semana anterior
const semanaHoy = isoWeekKey(hoy);

// Avanza solo, una semana por semana de calendario…
const viejo = { phaseId: 'f1', weekNum: 1, dayIdx: 0, fijadoEn: isoWeekKey(lunes9) };
const avanzado = cursorAlDia(plan, viejo, hoy);
assert.equal(avanzado.weekNum, 2);
assert.equal(avanzado.fijadoEn, semanaHoy);

// …y en pausa NO avanza, aunque pasen semanas.
const enPausa = pausarPlan(viejo, lunes9);
assert.equal(enPausa.pausa, claveDeDia(lunes9));
assert.equal(estaEnPausa(enPausa), true);
const sigue = cursorAlDia(plan, enPausa, hoy);
assert.equal(sigue.weekNum, 1);
assert.equal(sigue.fijadoEn, viejo.fijadoEn);
assert.equal(sessionForToday(plan, 'periodized', enPausa, hoy), null, 'en pausa hoy no toca nada');

// Reanudar: quita la pausa y vuelve a sellar con la semana de hoy; desde ahí avanza solo y NO salta las semanas pausadas.
const reanudado = reanudarPlan(enPausa, hoy);
assert.equal('pausa' in reanudado, false);
assert.equal(reanudado.weekNum, 1);
assert.equal(cursorAlDia(plan, reanudado, hoy).weekNum, 1);
assert.equal(sessionForToday(plan, 'periodized', reanudado, hoy).day.name, 'D');

// Mover: cambia fase y semana, sella con hoy, el día sale del calendario (viernes → «D»).
const movido = moverPlanA(plan, avanzado, 'f2', 3, hoy);
assert.deepEqual([movido.phaseId, movido.weekNum, movido.fijadoEn], ['f2', 3, semanaHoy]);
assert.equal(sessionForToday(plan, 'periodized', movido, hoy).phase.id, 'f2');
assert.deepEqual(dondeVa(plan, 'periodized', movido, hoy), { faseId: 'f2', semana: 3, dia: 3 });
// Mover conserva la pausa y el aviso; borra lo de «solo hoy».
const conCosas = { ...pausarPlan(avanzado, hoy), aviso: { id: 'x' }, diaElegidoEl: claveDeDia(hoy), agregadas: { el: claveDeDia(hoy), items: [{ phaseId: 'f1', weekNum: 1, dayIdx: 0 }] } };
const m2 = moverPlanA(plan, conCosas, 'f1', 1, hoy);
assert.equal(m2.pausa, claveDeDia(hoy)); assert.deepEqual(m2.aviso, { id: 'x' });
assert.equal('diaElegidoEl' in m2, false); assert.equal('agregadas' in m2, false);
// Una semana que no existe no mueve nada.
assert.equal(moverPlanA(plan, avanzado, 'f9', 1, hoy), avanzado);

// Una semana atrás: cruza de fase y se detiene en la primera.
assert.deepEqual(semanaDeAtras(plan, { phaseId: 'f2', weekNum: 1 }), { faseId: 'f1', semana: 2, bloqueada: false });
assert.equal(semanaDeAtras(plan, { phaseId: 'f1', weekNum: 1 }), null);

// El aviso del coach sobrevive a que el calendario avance el plan.
const conAviso = { ...viejo, aviso: { id: 'a1', texto: 'Tu coach movió tu plan' } };
assert.deepEqual(cursorAlDia(plan, conAviso, hoy).aviso, conAviso.aviso);

// Agregar a hoy: se suma, no se repite, caduca mañana y se puede quitar.
const item = { phaseId: 'f1', weekNum: 2, dayIdx: 1 };
let c = agregarAHoy(avanzado, item, hoy);
c = agregarAHoy(c, item, hoy);
assert.equal(agregadasDeHoy(c, hoy).length, 1);
assert.equal(agregadasDeHoy(c, new Date(2026, 9, 17, 9)).length, 0);
assert.equal('agregadas' in quitarDeHoy(c, item), false);
console.log('prueba-mover-plan: todo bien');
