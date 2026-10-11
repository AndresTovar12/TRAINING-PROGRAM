/* Pruebas del espacio de videos de un coach: `node scripts/prueba-espacio.mjs`. Solo números y textos, sin red.
   La regla (10 GB + 7 GB por cliente) vive en la base; aquí se comprueba cómo se muestra y los avisos previos a subir. */
import assert from 'node:assert/strict';
import { pesoDeVideo, horasEquivalentes, estadoDelEspacio, avisoSiNoCabe, avisoSiEsMuyGrande, TOPE_POR_ARCHIVO_MB } from '../src/lib/espacio.js';

const GB = 1e9;
const coach = (usadoGB, limiteGB = 10, extra = {}) => ({ usado: usadoGB * GB, limite: limiteGB === null ? null : limiteGB * GB, clientes: 0, ilimitado: false, base: 10 * GB, por_cliente: 7 * GB, ...extra });

/* ---- Cómo se escribe un peso ---- */
assert.equal(pesoDeVideo(0), '0 MB');
assert.equal(pesoDeVideo(350e6), '350 MB');
assert.equal(pesoDeVideo(3.5 * GB), '3.5 GB');
assert.equal(pesoDeVideo(10 * GB), '10 GB');

/* ---- Horas de clase en 1080p (≈ 3.5 GB la hora) ---- */
assert.equal(horasEquivalentes(10 * GB), '≈ 2.9 h', '10 GB ≈ 3 horas de clase');
assert.equal(horasEquivalentes(17 * GB), '≈ 4.9 h', 'con un cliente: casi 5 horas');
assert.equal(horasEquivalentes(3.5 * GB), '≈ 1 h');
assert.equal(horasEquivalentes(0.58 * GB), '≈ 10 min', '10 min de 1080p ≈ 0.58 GB');

/* ---- Estado de la barra ---- */
assert.equal(estadoDelEspacio(null), null, 'sin datos: no se pinta nada');
assert.equal(estadoDelEspacio(coach(1, null)), null, 'sin tope (el dueño): no hay barra');
assert.equal(estadoDelEspacio({ ...coach(1), ilimitado: true }), null);
let e = estadoDelEspacio(coach(2.1));
assert.equal(e.pct, 21);
assert.equal(e.texto, '2.1 GB de 10 GB');
assert.equal(e.casiLleno, false);
assert.equal(e.lleno, false);
e = estadoDelEspacio(coach(8.5));
assert.equal(e.pct, 85);
assert.equal(e.casiLleno, true, 'desde 80 % avisa');
e = estadoDelEspacio(coach(10));
assert.equal(e.lleno, true);
assert.equal(e.casiLleno, false, 'lleno no es «casi lleno»');
assert.equal(e.pct, 100);
assert.equal(estadoDelEspacio(coach(11)).pct, 100, 'pasarse no rompe la barra');
assert.equal(estadoDelEspacio(coach(1)).queda, 9 * GB);

/* ---- ¿Cabe este video? ---- */
assert.equal(avisoSiNoCabe(coach(5), 3.5 * GB), null, '5 + 3.5 cabe en 10');
assert.equal(avisoSiNoCabe(coach(6.5), 3.5 * GB), null, 'justo en el tope todavía cabe');
const sin = avisoSiNoCabe(coach(7), 3.5 * GB);
assert.match(sin, /usaste 7 GB de 10 GB y este pesa 3\.5 GB/);
assert.match(sin, /Cada cliente que te pague te suma 7 GB/, 'dice cuánto suma cada cliente, con el número de la regla');
assert.equal(avisoSiNoCabe(coach(0, null), 99 * GB), null, 'el dueño sube lo que quiera');
assert.equal(avisoSiNoCabe(null, 99 * GB), null, 'sin saber el espacio, no se frena (la función del servidor decide)');
assert.doesNotMatch(avisoSiNoCabe({ ...coach(9), por_cliente: undefined }, 3 * GB), /Cada cliente/, 'sin el dato de la regla no se inventa');

/* ---- Archivo demasiado grande para UNA subida ---- */
assert.equal(TOPE_POR_ARCHIVO_MB, 4800);
assert.equal(avisoSiEsMuyGrande(3.5 * GB), null, 'una clase de una hora en 1080p cabe');
assert.equal(avisoSiEsMuyGrande(4800 * 1048576), null, 'justo en el tope cabe');
assert.match(avisoSiEsMuyGrande(11 * GB), /pesa 11 GB y el máximo por archivo es 5 GB/, 'una hora en 4K no cabe: se dice qué hacer');
assert.match(avisoSiEsMuyGrande(11 * GB), /1080p/);

console.log('✓ espacio: todo bien');
