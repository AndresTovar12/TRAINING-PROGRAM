/* La tarjetita al compartir una liga (cloudflare/worker-app.js): qué dirección es de la tienda y qué título, descripción y foto se le dan a las redes. `node scripts/prueba-vista-previa.mjs` */
import assert from 'node:assert/strict';
import { tiendaDe, vistaPreviaDe, etiquetasDe, destinoDe } from '../cloudflare/worker-app.js';

assert.deepEqual(tiendaDe('/@Beto'), { usuario: 'beto', slug: null });
assert.deepEqual(tiendaDe('/@beto/plan-10k/'), { usuario: 'beto', slug: 'plan-10k' });
assert.equal(tiendaDe('/@beto/plan/extra'), null, 'un tramo de más no es de la tienda');
assert.equal(tiendaDe('/@%E0%A4%A'), null, 'una dirección rota no revienta');
assert.equal(tiendaDe('/mcp'), null);
assert.ok(destinoDe('/mcp'), 'el conector sigue igual');

const plan = { titulo: 'Plan 10K', precio: 550, tipo: 'membresia', descripcion: 'Baja tus 5 km de 27 min', foto: 'https://x.test/f.jpg', coach: { nombre: 'Beto', foto: 'https://x.test/c.jpg' } };
const v = vistaPreviaDe(plan, { usuario: 'beto', slug: 'plan-10k' });
assert.equal(v.titulo, 'Plan 10K · por Beto');
assert.equal(v.descripcion, '$550 MXN al mes · Baja tus 5 km de 27 min');
assert.equal(v.imagen, 'https://x.test/f.jpg');
assert.equal(v.url, 'https://app.traininglabapp.com/@beto/plan-10k');
assert.equal(vistaPreviaDe({ ...plan, foto: null }, { usuario: 'beto', slug: 'plan-10k' }).imagen, 'https://x.test/c.jpg', 'sin foto del plan, la del coach');
assert.equal(vistaPreviaDe({ ...plan, precio: 0 }, { usuario: 'beto', slug: 'p' }).descripcion.startsWith('Gratis'), true);
assert.equal(vistaPreviaDe(null, { usuario: 'beto', slug: 'p' }), null, 'sin plan, la página de siempre');
assert.equal(vistaPreviaDe({}, { usuario: 'beto', slug: 'p' }), null);
const c = vistaPreviaDe({ nombre: 'Beto', bio: 'Entrenador', foto: 'https://x.test/c.jpg' }, { usuario: 'beto', slug: null });
assert.equal(c.titulo, 'Beto en Training Lab');
const largo = vistaPreviaDe({ ...plan, descripcion: 'x'.repeat(500) }, { usuario: 'beto', slug: 'p' });
assert.ok(largo.descripcion.length <= 200, 'la descripción se recorta');

// Lo que viene de una persona no puede romper la etiqueta
const mala = etiquetasDe({ titulo: 'a" onload="x', descripcion: '<script>', imagen: null, url: 'https://app.traininglabapp.com/@a' });
assert.ok(!mala.includes('<script>') && !mala.includes('" onload'), 'se escapa lo que escribió una persona');
assert.ok(mala.includes('og:image'), 'sin foto, el ícono de la app');
console.log('prueba-vista-previa: todo bien');
