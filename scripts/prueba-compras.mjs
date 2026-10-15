/* Pruebas de las compras dichas como se entienden (lo puro): `node scripts/prueba-compras.mjs`. */
import assert from 'node:assert/strict';
import { estadoDeCompra, puedeCancelar, dentroDeLaGarantia, diasDeGarantia, separaCompras } from '../src/lib/compras.js';

const ahora = Date.parse('2026-10-15T12:00:00Z');
const base = { estado: 'activa', tipo: 'membresia', periodo_hasta: '2026-11-10T12:00:00Z', pagado: 599, primer_pago_en: '2026-10-12T12:00:00Z', cancelada_en: null };

assert.equal(estadoDeCompra(base).texto, 'Activa');
assert.match(estadoDeCompra(base).detalle, /^Se renueva el 10 de noviembre de 2026/);
assert.equal(estadoDeCompra({ ...base, cancelada_en: '2026-10-14T00:00:00Z' }).texto, 'Cancelada');
assert.match(estadoDeCompra({ ...base, cancelada_en: '2026-10-14T00:00:00Z' }).detalle, /Sigue hasta el 10 de noviembre/);
assert.equal(estadoDeCompra({ ...base, tipo: 'personalizado' }).detalle.startsWith('Pagada hasta'), true);
assert.equal(estadoDeCompra({ estado: 'gracia' }).tono, 'aviso');
assert.equal(estadoDeCompra({ estado: 'vencida', periodo_hasta: '2026-09-01T12:00:00Z' }).texto, 'Vencida');
assert.equal(estadoDeCompra({ estado: 'reembolsada' }).texto, 'Reembolsada');
assert.equal(estadoDeCompra({ estado: 'por_armar' }).texto, 'Armando tu plan');

assert.equal(puedeCancelar(base), true);
assert.equal(puedeCancelar({ ...base, cancelada_en: '2026-10-14T00:00:00Z' }), false, 'ya pidió cancelar');
assert.equal(puedeCancelar({ ...base, tipo: 'personalizado' }), false, 'no se renueva');
assert.equal(puedeCancelar({ ...base, estado: 'vencida' }), false);

assert.equal(dentroDeLaGarantia(base, ahora), true, 'compró hace 3 días');
assert.equal(diasDeGarantia(base, ahora), 4);
assert.equal(dentroDeLaGarantia({ ...base, primer_pago_en: '2026-10-01T12:00:00Z' }, ahora), false, 'hace 14 días');
assert.equal(dentroDeLaGarantia({ ...base, pagado: 0 }, ahora), false, 'sin cobro no hay qué devolver');
assert.equal(dentroDeLaGarantia({ ...base, estado: 'vencida' }, ahora), false);
assert.equal(dentroDeLaGarantia({ ...base, primer_pago_en: null }, ahora), false);

const { vigentes, historial } = separaCompras([base, { ...base, estado: 'vencida' }, { ...base, estado: 'reembolsada' }, { ...base, estado: 'por_armar' }]);
assert.deepEqual([vigentes.length, historial.length], [2, 2]);
assert.deepEqual(separaCompras(null), { vigentes: [], historial: [] });
console.log('✓ compras: todo bien');
