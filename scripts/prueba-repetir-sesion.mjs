/* Hacer otra vez una sesión ya terminada no borra la vez anterior: `node scripts/prueba-repetir-sesion.mjs`. */
import assert from 'node:assert/strict';
import { archivaLoHecho, reiniciaSiTerminado } from '../src/lib/entreno.js';
import { sesionesGuiadas } from '../src/lib/metricas/porSerie.js';

const jueves = Date.UTC(2026, 9, 15, 15, 0, 0);
const viernes = Date.UTC(2026, 9, 16, 14, 34, 0);
const entrenoDelJueves = { v: 1, nombre: 'Cambio de dirección', inicio: jueves, fin: jueves + 40 * 60000, hechos: { '0.1.0': { n: 'Pro Agility', t: jueves + 5 * 60000 } }, saltados: {}, empezados: {} };
const registro = { completed: true, completedAt: new Date(jueves + 40 * 60000).toISOString(), entreno: entrenoDelJueves, exercises: { 0: { repsHechas: '10' } } };

// Deshacer una sesión terminada: lo hecho se guarda
const { anteriores } = archivaLoHecho(registro);
assert.equal(anteriores.length, 1);
assert.equal(anteriores[0].completedAt, registro.completedAt);
assert.deepEqual(anteriores[0].entreno, entrenoDelJueves);
assert.deepEqual(anteriores[0].exercises, { 0: { repsHechas: '10' } });
// Y se acumula, con tope de 20
let r = registro;
for (let i = 0; i < 25; i++) r = { ...r, ...archivaLoHecho(r) };
assert.equal(r.anteriores.length, 20);
// Una sesión marcada «terminada» sin haberse entrenado no deja huella
assert.deepEqual(archivaLoHecho({ completed: false }), {});

// El viernes se hace otra vez: queda el viernes Y el jueves, como dos entrenos
const nuevo = { ...registro, completed: true, completedAt: new Date(viernes + 30 * 60000).toISOString(),
  entreno: { ...entrenoDelJueves, inicio: viernes, fin: viernes + 30 * 60000, hechos: { '0.1.0': { n: 'Pro Agility', t: viernes + 4 * 60000 } } },
  ...archivaLoHecho(registro) };
const guiadas = sesionesGuiadas({ 'wr:sessions': { 'f4-w2-d6': nuevo } });
assert.equal(guiadas.length, 2, 'el entreno de hoy y el de ayer');
assert.deepEqual(guiadas.map((s) => s.id), ['f4-w2-d6#1', 'f4-w2-d6'], 'ordenados del más viejo al más nuevo');
assert.ok(guiadas[0].inicio < guiadas[1].inicio);
// Reiniciar el avance sigue como siempre
assert.equal(reiniciaSiTerminado(undefined), undefined);
console.log('prueba-repetir-sesion: todo bien');
