/* Reclamar una compra pagada sin cuenta (`src/lib/reclamo.js`, 26 nov 2026). */
import assert from 'node:assert/strict';
import { puedeReclamar, sugerenciaDeCorreo, llaveNueva, hashDeLlave, MENSAJES } from '../src/lib/reclamo.js';

const ahora = Date.parse('2026-11-26T12:00:00Z');
const pagada = { atleta_id: null, pagada_en: '2026-11-26T10:00:00Z', llave_correo_vence: '2026-11-28T10:00:00Z' };
assert.deepEqual(puedeReclamar(pagada, { usuarioId: 'u1', ahora }), { ok: true }, 'con la llave del pago');
assert.deepEqual(puedeReclamar(pagada, { usuarioId: 'u1', via: 'correo', ahora }), { ok: true }, 'con la liga del correo');
assert.deepEqual(puedeReclamar({ ...pagada, atleta_id: 'u2' }, { usuarioId: 'u1', ahora }), { ok: false, motivo: 'ya_usada' }, 'una sola vez');
assert.deepEqual(puedeReclamar({ ...pagada, atleta_id: 'u1' }, { usuarioId: 'u1', ahora }), { ok: true, yaEsTuya: true }, 'volver a la liga con la misma cuenta no hace nada');
assert.deepEqual(puedeReclamar({ ...pagada, pagada_en: null }, { usuarioId: 'u1', ahora }), { ok: false, motivo: 'no_pagada' });
assert.deepEqual(puedeReclamar(pagada, { usuarioId: 'u1', ahora: ahora + 49 * 3600e3 }), { ok: false, motivo: 'vencida' }, 'la llave del pago dura 48 horas');
assert.deepEqual(puedeReclamar(pagada, { usuarioId: 'u1', via: 'correo', ahora: Date.parse('2026-11-28T10:00:01Z') }), { ok: false, motivo: 'vencida' }, 'la liga del correo dura 48 horas');
assert.deepEqual(puedeReclamar(pagada, { usuarioId: 'u1', rol: 'admin', ahora }), { ok: false, motivo: 'no_atleta' });
assert.deepEqual(puedeReclamar(null, { usuarioId: 'u1', ahora }), { ok: false, motivo: 'desconocida' });
assert.equal(MENSAJES.ya_usada, 'Esta compra ya tiene cuenta. Entra con ella.');

assert.equal(sugerenciaDeCorreo('diego@gmial.com'), 'gmail.com', '¿Quisiste decir gmail.com?');
assert.equal(sugerenciaDeCorreo('diego@gmail.con'), 'gmail.com');
assert.equal(sugerenciaDeCorreo('diego@hotmal.com'), 'hotmail.com');
assert.equal(sugerenciaDeCorreo('diego@gmail.com'), null);
assert.equal(sugerenciaDeCorreo('diego@miempresa.mx'), null, 'un dominio propio no se corrige');
assert.equal(sugerenciaDeCorreo('sin arroba'), null);

const llave = llaveNueva();
assert.match(llave, /^[0-9a-f]{64}$/);
assert.equal(await hashDeLlave(llave), await hashDeLlave(llave));
assert.notEqual(await hashDeLlave(llave), llave, 'en la base va el hash, nunca la llave');
console.log('✓ reclamo: todo bien');
