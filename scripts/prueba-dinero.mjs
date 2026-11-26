/* El dinero del coach (`src/lib/dinero.js`, encargo «Compra y dinero», 26 nov 2026): reparto web/iPhone, saldos, retiros por ventas completas, CLABE y textos. */
import assert from 'node:assert/strict';
import {
  parteDelCoach, repartePagoDeApple, saldos, ganadoEnMes, asignaRetiro, estadoDeRetiro, clabeValida, bancoDeClabe, pesos, listoWeb, listoApple, aproxDeMes, listoDeUnaVenta, lugarDe, MINIMO_RETIRO,
} from '../src/lib/dinero.js';

// Reparto.
assert.deepEqual(parteDelCoach({ canal: 'web', bruto: 500 }), { monto: 400, aproximado: false }, 'web: 80 %');
assert.deepEqual(parteDelCoach({ canal: 'web', bruto: 500, tasa: 0 }), { monto: 500, aproximado: false }, 'el dueño vende al 0 %');
const iphone = parteDelCoach({ canal: 'apple', bruto: 500 });
assert.equal(iphone.aproximado, true);
assert.equal(Math.round(iphone.monto), 293, 'De $500 ≈ $293');
assert.equal(pesos(iphone.monto, { aproximado: true }), '≈ $293');

// Apple pagó el mes: se reparte por precio y la suma cuadra al centavo.
{
  const r = repartePagoDeApple([{ id: 'a', bruto: 500 }, { id: 'b', bruto: 500 }, { id: 'c', bruto: 650 }], 1203.33);
  const suma = r.reduce((s, x) => s + Math.round(x.monto * 100), 0);
  assert.equal(suma, Math.round(1203.33 * 0.8 * 100), 'al coach le toca el 80 % de lo que pagó Apple, sin perder un centavo');
  assert.ok(r.find((x) => x.id === 'c').monto > r.find((x) => x.id === 'a').monto);
  assert.deepEqual(repartePagoDeApple([], 100), []);
}

// Dónde está el dinero.
const hoy = '2026-11-26';
const libro = [
  { id: 1, canal: 'web', monto: 400, estado: 'en_camino', listo_estimado: '2026-11-25', creado_en: '2026-11-20T15:00:00Z' },  // ya liberado → listo
  { id: 2, canal: 'web', monto: 480, estado: 'en_camino', listo_estimado: '2026-11-27', creado_en: '2026-11-24T15:00:00Z' },
  { id: 3, canal: 'apple', monto: 293.1, aproximado: true, estado: 'en_camino', listo_estimado: '2026-12-31', creado_en: '2026-11-25T15:00:00Z' },
  { id: 4, canal: 'web', monto: 1000, estado: 'retirado', creado_en: '2026-10-02T15:00:00Z' },
  { id: 5, canal: 'web', monto: 400, estado: 'anulado', creado_en: '2026-11-10T15:00:00Z' },
  { id: 6, canal: 'apple', monto: 300, estado: 'listo', creado_en: '2026-10-05T15:00:00Z' },
];
{
  const s = saldos(libro, hoy);
  assert.equal(s.retirado, 1000);
  assert.equal(s.listo, 700, 'lo de la web ya liberado y lo de Apple ya pagado');
  assert.equal(s.enCamino, 773.1);
  assert.equal(s.aproximado, true);
  assert.deepEqual(s.web, { monto: 480, fechas: ['2026-11-27'] });
  assert.deepEqual(s.apple, { monto: 293.1, fechas: ['2026-12-31'] });
  assert.equal(s.desdeSiempre, 2473.1, 'lo anulado no cuenta');
  assert.equal(lugarDe(libro[0], hoy), 'listo');
  assert.equal(lugarDe(libro[0], '2026-11-24'), 'en_camino');
  assert.equal(ganadoEnMes(libro, '2026-11'), 1173.1, 'Ganaste en noviembre: sin lo anulado ni lo de octubre');
}

// Retirar: ventas completas, las más viejas primero; web por Stripe y iPhone por SPEI.
{
  const listos = [
    { id: 'w1', canal: 'web', monto: 400, creado_en: '2026-11-01' },
    { id: 'a1', canal: 'apple', monto: 300, creado_en: '2026-11-02' },
    { id: 'w2', canal: 'web', monto: 480, creado_en: '2026-11-03' },
  ];
  assert.deepEqual(asignaRetiro(listos), { ids: ['w1', 'w2', 'a1'], stripe: 880, spei: 300, total: 1180 }, 'Todo');
  assert.deepEqual(asignaRetiro(listos, 1000), { ids: ['w1', 'a1'], stripe: 400, spei: 300, total: 700 }, 'Otra cantidad: no parte la venta de $480');
  assert.deepEqual(asignaRetiro([...listos, { id: 'r', canal: 'web', monto: -400, creado_en: '2026-11-04' }]).stripe, 480, 'un reembolso ya retirado se descuenta del siguiente dinero');
  assert.deepEqual(asignaRetiro([{ id: 'r', canal: 'web', monto: -400, creado_en: '2026-11-04' }, { id: 'a', canal: 'apple', monto: 300, creado_en: '2026-11-01' }]), { ids: ['a'], stripe: 0, spei: 300, total: 300 }, 'un lado en negativo no se manda');
  assert.equal(MINIMO_RETIRO, 200);
}
assert.equal(estadoDeRetiro([{ estado: 'llego' }, { estado: 'llego' }]), 'llego');
assert.equal(estadoDeRetiro([{ estado: 'llego' }, { estado: 'enviado' }]), 'enviado', '«Llegó» solo cuando llegaron los dos');
assert.equal(estadoDeRetiro([{ estado: 'llego' }, { estado: 'fallo' }]), 'en_parte');
assert.equal(estadoDeRetiro([{ estado: 'fallo' }]), 'no_llego');

// CLABE.
assert.equal(clabeValida('002010077777777771'), true);
assert.equal(clabeValida('002010077777777772'), false, 'dígito de control');
assert.equal(clabeValida('0020100777'), false);
assert.equal(clabeValida('000000001234567897'), true, 'la CLABE de prueba de Stripe');
assert.equal(bancoDeClabe('012180001234567890'), 'BBVA');

// Textos.
assert.equal(pesos(8670), '$8,670');
assert.equal(pesos(293.47), '$293.47');
assert.equal(listoWeb(['2026-11-27', '2026-11-26']), 'Listo el jue 26 y el vie 27');
assert.equal(aproxDeMes('2026-12-15'), 'a mediados de dic');
assert.equal(listoApple(['2026-12-15', '2027-01-14']), 'Listo a mediados de dic y de ene');
assert.equal(listoDeUnaVenta({ canal: 'apple', listo_estimado: '2027-01-28' }), 'Listo en ene');
assert.equal(listoDeUnaVenta({ canal: 'web', listo_estimado: '2026-11-27' }), 'Listo el vie 27');
console.log('✓ dinero: todo bien');

// SPEI en modo de prueba.
{
  const { enviaSpei, revisaEnvioSpei } = await import('../src/lib/spei.js');
  const jueves = new Date('2026-11-26T18:00:00Z');
  const e = await enviaSpei({ clabe: '002010077777777771', monto: 300, referencia: 'r1' }, { ahora: jueves });
  assert.equal(e.estado, 'enviado');
  assert.equal(e.llega_estimado, '2026-11-27', 'el siguiente día hábil');
  assert.equal((await enviaSpei({ clabe: '002010077777777771', monto: 1 }, { ahora: new Date('2026-11-27T18:00:00Z') })).llega_estimado, '2026-11-30', 'del viernes al lunes');
  assert.equal(revisaEnvioSpei({ clabe: '002010077777777771', llega_estimado: '2026-11-27' }, { ahora: jueves }).estado, 'enviado');
  assert.equal(revisaEnvioSpei({ clabe: '002010077777777771', llega_estimado: '2026-11-27' }, { ahora: new Date('2026-11-27T20:00:00Z') }).estado, 'llego');
  assert.equal(revisaEnvioSpei({ clabe: '002010000000000000', llega_estimado: '2026-11-27' }, { ahora: jueves }).estado, 'fallo', 'una CLABE que termina en 0000 simula el rechazo');
  await assert.rejects(enviaSpei({ clabe: '123', monto: 10 }), /CLABE/);
  await assert.rejects(enviaSpei({ clabe: '002010077777777771', monto: 10 }, { modo: 'real' }), /proveedor/);
  console.log('✓ SPEI de prueba: todo bien');
}
