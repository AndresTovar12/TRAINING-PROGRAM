/* Las actividades que se pueden registrar (src/lib/actividades.js): el catálogo, crear la propia, el buscador y «Tus actividades». `node scripts/prueba-actividades.mjs`. */
import assert from 'node:assert/strict';
import { DEPORTES } from '../src/lib/metricas/deportes.js';
import {
  CATALOGO, GRUPOS_DE_ACTIVIDADES, creaActividad, propiasDe, actividadPorId, actividadDeDeporte, actividadDeEntreno, buscaActividades, hayConNombre, tusActividades, MAX_NOMBRE,
} from '../src/lib/actividades.js';

// El catálogo: ids únicos y cada deporte existe en las métricas.
assert.equal(new Set(CATALOGO.map((x) => x.id)).size, CATALOGO.length, 'ids únicos');
CATALOGO.forEach((x) => assert.ok(DEPORTES[x.deporte], `${x.id}: su deporte existe`));
assert.ok(GRUPOS_DE_ACTIVIDADES.length >= 6);
assert.equal(actividadPorId('correr').gps, true, 'correr lleva mapa');
assert.equal(actividadPorId('padel').gps, false, 'pádel no');
assert.equal(actividadPorId('padel').deporte, 'raqueta');

// Crear la propia
const w = creaActividad({ nombre: '  waterpolo ', emoji: '🤽', gps: false }, [], 1000);
assert.equal(w.yaExistia, false);
assert.equal(w.actividad.nombre, 'Waterpolo', 'con mayúscula y sin espacios de más');
assert.equal(w.actividad.deporte, 'otro');
assert.ok(w.actividad.id.startsWith('p-'));
assert.equal(creaActividad({ nombre: '   ' }, []), null, 'sin nombre no se crea');
assert.equal(creaActividad({ nombre: 'padel' }, []).actividad.id, 'padel', 'si ya existe (sin acentos), se usa esa');
assert.equal(creaActividad({ nombre: 'WATERPOLO' }, [w.actividad]).actividad.id, w.actividad.id, 'tampoco se repite una propia');
assert.equal(creaActividad({ nombre: 'x'.repeat(40) }, []).actividad.nombre.length, MAX_NOMBRE, 'nombre con tope');
assert.equal(creaActividad({ nombre: 'Patines en línea', gps: true }, []).actividad.gps, true);

// Lo guardado se limpia: basura no rompe nada
assert.deepEqual(propiasDe(null), []);
assert.equal(propiasDe([null, { id: 'malo', nombre: 'x' }, { id: 'p-1', nombre: '' }, w.actividad, w.actividad]).length, 1, 'solo la buena, sin repetir');

// Buscador
assert.deepEqual(buscaActividades('', []), []);
assert.ok(buscaActividades('pad', []).some((x) => x.id === 'padel'));
assert.ok(buscaActividades('PÁDEL', []).some((x) => x.id === 'padel'), 'sin importar acentos ni mayúsculas');
assert.equal(buscaActividades('water', [w.actividad])[0].id, w.actividad.id, 'las propias primero');
assert.equal(hayConNombre('waterpolo', []), false);
assert.equal(hayConNombre('Correr', []), true);

// De un entreno guardado a su actividad
assert.equal(actividadDeEntreno({ deporte: 'raqueta', titulo: 'Pádel' }).id, 'padel');
assert.equal(actividadDeEntreno({ deporte: 'otro', titulo: 'Waterpolo' }, [w.actividad]).id, w.actividad.id);
assert.equal(actividadDeEntreno({ deporte: 'correr', titulo: 'Carrera de la mañana' }).id, 'correr', 'un título libre cae en su deporte');
assert.equal(actividadDeDeporte('raqueta').deporte, 'raqueta');
assert.equal(actividadDeDeporte('ajedrez').deporte, 'otro');

// Tus actividades
assert.deepEqual(tusActividades([], []).map((x) => x.id), ['correr', 'bici', 'natacion'], 'quien no ha hecho nada');
const filas = [{ deporte: 'raqueta', titulo: 'Pádel' }, { deporte: 'correr', titulo: 'Correr' }, { deporte: 'raqueta', titulo: 'Pádel' }];
assert.deepEqual(tusActividades(filas, [w.actividad]).map((x) => x.id), ['padel', 'correr', w.actividad.id], 'lo reciente primero, sin repetir, y las propias');
assert.equal(tusActividades(Array.from({ length: 20 }, (_, i) => ({ deporte: 'otro', titulo: CATALOGO[i].nombre })), []).length, 6, 'tope de 6');

console.log('prueba-actividades: todo bien');
