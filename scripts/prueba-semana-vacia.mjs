/* Una semana sin sesiones NO debe regresar al atleta a Fase 1 · Semana 1 ni impedir que el plan avance (auditoría 23 oct 2026: hallazgos «semana sin días»,
   «el plan nunca arranca solo» y «el coach borra una sesión y el atleta regresa al inicio»). */
import { cursorAlDia, isValidCursor, resolveCursor, defaultCursor, moverPlanA } from '../src/lib/training-utils.js';

let fallas = 0;
const igual = (t, a, b) => {
  const bien = JSON.stringify(a) === JSON.stringify(b);
  if (!bien) fallas += 1;
  console.log(`${bien ? 'PASA ' : 'FALLA'} ${t}${bien ? '' : `\n   dio ${JSON.stringify(a)}\n   esperaba ${JSON.stringify(b)}`}`);
};
const isoDe = (f) => {
  const d = new Date(Date.UTC(f.getFullYear(), f.getMonth(), f.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const ini = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return `${d.getUTCFullYear()}-W${String(Math.ceil(((d - ini) / 86400000 + 1) / 7)).padStart(2, '0')}`;
};

// Fase 1: semanas 1 y 2 SIN días; semana 3 con 3 días. Fase 2: semana 1 con 2 días.
const plan = [
  { id: 'f1', weekData: [{ num: 1, days: [] }, { num: 2, days: [] }, { num: 3, days: [{}, {}, {}] }] },
  { id: 'f2', weekData: [{ num: 1, days: [{}, {}] }] },
];
const hoy = new Date('2026-09-07');
const sem = isoDe(hoy);
const semMas = (n) => isoDe(new Date(hoy.getTime() + n * 7 * 86400000));

igual('una marca en una semana vacía es válida', isValidCursor(plan, { phaseId: 'f1', weekNum: 1, dayIdx: 0 }), true);
igual('una fase o semana que no existe sigue siendo inválida', [isValidCursor(plan, { phaseId: 'zz', weekNum: 1, dayIdx: 0 }), isValidCursor(plan, { phaseId: 'f1', weekNum: 9, dayIdx: 0 })], [false, false]);
igual('la marca por defecto del plan que empieza con semanas vacías es esa semana vacía', defaultCursor(plan), { phaseId: 'f1', weekNum: 1, dayIdx: 0 });

const vacia = { phaseId: 'f1', weekNum: 1, dayIdx: 0, fijadoEn: sem };
igual('en la semana vacía se queda y se resuelve la semana, sin sesión', (({ phase, week, day, id }) => [phase.id, week.num, day, id])(resolveCursor(plan, vacia)), ['f1', 1, null, null]);
igual('el mismo día el plan no se mueve', cursorAlDia(plan, vacia, hoy), vacia);
igual('una semana después pasa a la semana 2 (vacía) en vez de regresar al inicio', cursorAlDia(plan, vacia, new Date(hoy.getTime() + 7 * 86400000)), { phaseId: 'f1', weekNum: 2, dayIdx: 0, fijadoEn: semMas(1) });
igual('dos semanas después llega a la semana 3, que ya tiene sesiones', cursorAlDia(plan, vacia, new Date(hoy.getTime() + 14 * 86400000)), { phaseId: 'f1', weekNum: 3, dayIdx: 0, fijadoEn: semMas(2) });
igual('tres semanas después cruza a la fase 2', cursorAlDia(plan, vacia, new Date(hoy.getTime() + 21 * 86400000)), { phaseId: 'f2', weekNum: 1, dayIdx: 0, fijadoEn: semMas(3) });

// El coach borró sesiones de la semana en curso: la marca guardaba el día 2 y ahora la semana solo tiene 2 días (0 y 1).
const recortada = { phaseId: 'f2', weekNum: 1, dayIdx: 2, fijadoEn: sem };
igual('si el día guardado ya no existe se acota al último, sin salir de la semana', cursorAlDia(plan, recortada, hoy), { phaseId: 'f2', weekNum: 1, dayIdx: 1, fijadoEn: sem });
igual('y la semana sigue siendo válida (no regresa a Fase 1)', isValidCursor(plan, recortada), true);
igual('en pausa también se acota y no avanza', cursorAlDia(plan, { ...recortada, pausa: '2026-09-01' }, new Date(hoy.getTime() + 14 * 86400000)), { phaseId: 'f2', weekNum: 1, dayIdx: 1, fijadoEn: sem, pausa: '2026-09-01' });

// Plan comprado: una semana bloqueada por la ventana no se puede elegir como destino.
const conVentana = [{ id: 'f1', weekData: [{ num: 1, days: [{}] }, { num: 2, days: [{}], bloqueada: true }] }];
const aqui = { phaseId: 'f1', weekNum: 1, dayIdx: 0, fijadoEn: sem };
igual('«Mover mi plan» a una semana bloqueada no mueve nada', moverPlanA(conVentana, aqui, 'f1', 2, hoy), aqui);
igual('a una semana abierta sí', moverPlanA([{ id: 'f1', weekData: [{ num: 1, days: [{}] }, { num: 2, days: [{}] }] }], aqui, 'f1', 2, hoy).weekNum, 2);

if (fallas) { console.error(`\n${fallas} prueba(s) fallaron`); process.exit(1); }
console.log('\nprueba-semana-vacia: todo bien');
