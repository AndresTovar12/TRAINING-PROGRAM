/* Pruebas de las ayudas de Stripe: `node scripts/prueba-stripe.mjs`. Sin red ni llaves: la firma se calcula aquí con otro código (node:crypto) y se compara con la de la función. */
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import {
  cuerpoDeFormulario, repartoDeUnCobro, tasaDeComision, verificaFirma, compraIdDeSesion, compraIdDeFactura, suscripcionDeFactura, cobroDeFactura,
  finDePeriodoDeFactura, finDePeriodoDeSuscripcion, aFecha,
} from '../supabase/functions/comprar/stripe.js';

/* ---- El reparto de un cobro (en centavos enteros) ---- */
assert.deepEqual(repartoDeUnCobro({ bruto: 500, tasa: 0.2 }), { bruto: 500, tasa: 0.2, comision_app: 100, parte_coach: 400, parte_coach_centavos: 40000 });
assert.deepEqual(repartoDeUnCobro({ bruto: 500, tasa: 0 }), { bruto: 500, tasa: 0, comision_app: 0, parte_coach: 500, parte_coach_centavos: 50000 }, 'el dueño vende al 0 %');
const raro = repartoDeUnCobro({ bruto: 599.99, tasa: 0.15 });
assert.equal(Math.round((raro.comision_app + raro.parte_coach) * 100), 59999, 'comisión + parte del coach = lo que pagó, sin perder ni inventar un centavo');
assert.equal(tasaDeComision({ esDueno: true }), 0);
assert.equal(tasaDeComision({ esDueno: false }), 0.2);
// Comisión especial puesta por el dueño: gana sobre la base; el dueño sigue en 0; lo inválido cae a la base.
assert.equal(tasaDeComision({ esDueno: false, comisionEspecial: 0.1 }), 0.1);
assert.equal(tasaDeComision({ esDueno: false, comisionEspecial: '0.15' }), 0.15);
assert.equal(tasaDeComision({ esDueno: false, comisionEspecial: 0 }), 0);
assert.equal(tasaDeComision({ esDueno: false, comisionEspecial: null }), 0.2);
assert.equal(tasaDeComision({ esDueno: false, comisionEspecial: 1.5 }), 0.2);
assert.equal(tasaDeComision({ esDueno: true, comisionEspecial: 0.5 }), 0);

/* ---- El formulario como lo pide Stripe ---- */
assert.equal(
  decodeURIComponent(cuerpoDeFormulario({ mode: 'subscription', line_items: [{ price_data: { currency: 'mxn', unit_amount: 50000, recurring: { interval: 'month' } }, quantity: 1 }], metadata: { compra_id: 'abc' }, vacio: null, nada: undefined })),
  'mode=subscription&line_items[0][price_data][currency]=mxn&line_items[0][price_data][unit_amount]=50000&line_items[0][price_data][recurring][interval]=month&line_items[0][quantity]=1&metadata[compra_id]=abc',
);
assert.equal(cuerpoDeFormulario({ q: 'a b&c' }), 'q=a%20b%26c', 'lo que trae espacios o & se escapa');

/* ---- La firma del webhook ---- */
const secreto = 'whsec_prueba_123';
const cuerpo = JSON.stringify({ id: 'evt_1', type: 'invoice.paid', data: { object: { id: 'in_1' } } });
const t = Math.floor(Date.now() / 1000);
const firmaBuena = createHmac('sha256', secreto).update(`${t}.${cuerpo}`).digest('hex');
assert.equal(await verificaFirma(cuerpo, `t=${t},v1=${firmaBuena}`, secreto), true, 'firma buena');
assert.equal(await verificaFirma(cuerpo, `t=${t},v1=${'0'.repeat(64)},v1=${firmaBuena}`, secreto), true, 'Stripe puede mandar varias firmas: basta con una buena');
assert.equal(await verificaFirma(cuerpo + ' ', `t=${t},v1=${firmaBuena}`, secreto), false, 'si alguien cambia aunque sea un espacio, no pasa');
assert.equal(await verificaFirma(cuerpo, `t=${t},v1=${firmaBuena}`, 'whsec_otro'), false, 'firmado con otro secreto');
assert.equal(await verificaFirma(cuerpo, `t=${t},v1=${firmaBuena}`, ''), false, 'sin secreto configurado nunca pasa');
assert.equal(await verificaFirma(cuerpo, null, secreto), false, 'sin cabecera');
assert.equal(await verificaFirma(cuerpo, `v1=${firmaBuena}`, secreto), false, 'sin marca de tiempo');
const vieja = t - 3600;
const firmaVieja = createHmac('sha256', secreto).update(`${vieja}.${cuerpo}`).digest('hex');
assert.equal(await verificaFirma(cuerpo, `t=${vieja},v1=${firmaVieja}`, secreto), false, 'un aviso bien firmado pero de hace una hora (repetido por alguien) no pasa');
assert.equal(await verificaFirma(cuerpo, `t=${vieja},v1=${firmaVieja}`, secreto, { ahora: vieja * 1000 + 1000 }), true, 'el mismo aviso, a su hora, sí');

/* ---- Dónde vive cada dato en los objetos de Stripe ---- */
assert.equal(compraIdDeSesion({ client_reference_id: 'c1' }), 'c1');
assert.equal(compraIdDeSesion({ metadata: { compra_id: 'c2' } }), 'c2');
assert.equal(compraIdDeFactura({ subscription_details: { metadata: { compra_id: 'c3' } } }), 'c3');
assert.equal(compraIdDeFactura({ parent: { subscription_details: { metadata: { compra_id: 'c4' } } } }), 'c4', 'lugar nuevo de Stripe');
assert.equal(compraIdDeFactura({ lines: { data: [{ metadata: {} }, { metadata: { compra_id: 'c5' } }] } }), 'c5');
assert.equal(compraIdDeFactura({}), null);
assert.equal(suscripcionDeFactura({ subscription: 'sub_1' }), 'sub_1');
assert.equal(suscripcionDeFactura({ subscription: { id: 'sub_2' } }), 'sub_2');
assert.equal(suscripcionDeFactura({ parent: { subscription_details: { subscription: 'sub_3' } } }), 'sub_3');
assert.equal(cobroDeFactura({ charge: 'ch_1' }), 'ch_1');
assert.equal(cobroDeFactura({ charge: { id: 'ch_2' } }), 'ch_2');
assert.equal(finDePeriodoDeFactura({ lines: { data: [{ period: { end: 1790000000 } }] }, period_end: 1 }), 1790000000);
assert.equal(finDePeriodoDeSuscripcion({ current_period_end: 1790000001 }), 1790000001);
assert.equal(finDePeriodoDeSuscripcion({ items: { data: [{ current_period_end: 1790000002 }] } }), 1790000002, 'lugar nuevo de Stripe');
assert.equal(aFecha(1790000000), new Date(1790000000 * 1000).toISOString());
assert.equal(aFecha(null), null);
assert.equal(aFecha(undefined), null);

console.log('✓ stripe: todo bien');
