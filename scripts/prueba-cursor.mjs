import { cursorAlDia, semanasEntre } from '../src/lib/training-utils.js';

// Semanas ISO reales (comprobadas contra el calendario):
//   2026-09-07 lunes -> W37 segun ISO? El codigo dice W36. Se verifica abajo.
const isoDe = (f) => {
  const d = new Date(Date.UTC(f.getFullYear(), f.getMonth(), f.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const ini = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return `${d.getUTCFullYear()}-W${String(Math.ceil(((d - ini) / 86400000 + 1) / 7)).padStart(2,'0')}`;
};
console.log('7 sep 2026 =', isoDe(new Date('2026-09-07')), '| 14 sep =', isoDe(new Date('2026-09-14')));

const plan = [
  { id: 'f3', weekData: [6,7,8].map(n => ({ num: n, days: [{},{},{},{},{}] })) },
  { id: 'f4', weekData: [1,2].map(n => ({ num: n, days: [{},{},{}] })) },
];
const ok = (t,a,b) => console.log(`${JSON.stringify(a)===JSON.stringify(b)?'PASA ':'FALLA'} ${t}`,
  JSON.stringify(a)===JSON.stringify(b)?'':`\n   dio ${JSON.stringify(a)}\n   esperaba ${JSON.stringify(b)}`);

const hoy = new Date('2026-09-07');
const sem = isoDe(hoy);

ok('cruza el año (W52 2025 -> W02 2026 son 2 semanas)', semanasEntre('2025-W52','2026-W02'), 2);
ok('puntero viejo sin sello: se sella hoy y NO salta',
   cursorAlDia(plan, { phaseId:'f3', weekNum:6, dayIdx:1 }, hoy),
   { phaseId:'f3', weekNum:6, dayIdx:1, fijadoEn:sem });

const base = { phaseId:'f3', weekNum:6, dayIdx:1, fijadoEn:sem };
ok('una semana despues -> semana 7',
   cursorAlDia(plan, base, new Date('2026-09-14')),
   { phaseId:'f3', weekNum:7, dayIdx:1, fijadoEn:isoDe(new Date('2026-09-14')) });
ok('tres semanas -> cruza a la fase 4',
   cursorAlDia(plan, base, new Date('2026-09-28')),
   { phaseId:'f4', weekNum:1, dayIdx:1, fijadoEn:isoDe(new Date('2026-09-28')) });
ok('dos años -> se queda al final, no se rompe',
   cursorAlDia(plan, base, new Date('2028-09-07')),
   { phaseId:'f4', weekNum:2, dayIdx:1, fijadoEn:isoDe(new Date('2028-09-07')) });
ok('reloj hacia atras -> no se mueve',
   cursorAlDia(plan, base, new Date('2026-08-01')), base);
ok('dia fuera de rango en la fase nueva -> se acota',
   cursorAlDia(plan, { phaseId:'f3', weekNum:8, dayIdx:4, fijadoEn:sem }, new Date('2026-09-14')),
   { phaseId:'f4', weekNum:1, dayIdx:2, fijadoEn:isoDe(new Date('2026-09-14')) });
