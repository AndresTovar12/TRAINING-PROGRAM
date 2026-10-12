/* Pruebas de las CLASES (video largo que una instructora sube una vez y usa en sus sesiones): `node scripts/prueba-clases.mjs`.
   Solo datos, sin red. Lo que importa: una clase se guarda y se asigna como cualquier sesión, y Mis planes la reconoce sola. */
import assert from 'node:assert/strict';
import { claseDe, esClase, claseNueva, duracionTexto, duracionDelTramo, sesionDeClase } from '../src/lib/clases.js';
import {
  TIPOS, ETIQUETA_DE_TIPO, esDeUnDia, workoutDeSesiones, diasDeWorkout, resumenDe, textoDeResumen, sinNotas, tieneNotas, sesionTieneContenido,
} from '../src/lib/misPlanesDatos.js';

/* ---- La clase de una sesión ---- */
assert.equal(claseDe(null), null);
assert.equal(claseDe({}), null);
assert.equal(claseDe({ clase: {} }), null, 'sin video no es clase');
assert.equal(claseDe({ clase: { url: '   ' } }), null);
assert.equal(esClase({ clase: { url: 'https://v/videos/a.mp4' } }), true);
assert.deepEqual(claseNueva({ url: ' https://v/videos/a.mp4 ', duracion: 2700.4 }), { url: 'https://v/videos/a.mp4', duracion: 2700 }, 'se limpia la liga y la duración va en segundos enteros');
assert.deepEqual(claseNueva({ url: 'https://youtu.be/x' }), { url: 'https://youtu.be/x' }, 'una liga no trae duración y no se inventa');
assert.deepEqual(claseNueva({ url: 'u', duracion: 'nada' }), { url: 'u' });
assert.deepEqual(claseNueva({ url: 'u', duracion: 0 }), { url: 'u' });

/* ---- El recorte se guarda solo si sirve ---- */
assert.deepEqual(claseNueva({ url: 'u', duracion: 2400, inicio: 12.5, fin: 2412.5 }), { url: 'u', duracion: 2400, inicio: 12.5, fin: 2412.5 });
assert.deepEqual(claseNueva({ url: 'u', inicio: 0, fin: null }), { url: 'u' }, 'sin recorte, nada de más');
assert.deepEqual(claseNueva({ url: 'u', inicio: 30, fin: 10 }), { url: 'u', inicio: 30 }, 'un fin antes del inicio no sirve');
assert.equal(duracionDelTramo({ total: 2700 }), 2700, 'sin recorte dura todo');
assert.equal(duracionDelTramo({ total: 2700, inicio: 60 }), 2640, 'se le quitó el principio');
assert.equal(duracionDelTramo({ total: 2700, inicio: 60, fin: 2640 }), 2580);
assert.equal(duracionDelTramo({ total: 100, inicio: 500 }), 100, 'un recorte absurdo no deja una clase de 0');
assert.equal(duracionDelTramo({ inicio: 5 }), null, 'sin el total no se sabe');

/* ---- Cuánto dura, en palabras ---- */
assert.equal(duracionTexto(2700), '45 min');
assert.equal(duracionTexto(3900), '1 h 5 min');
assert.equal(duracionTexto(3600), '1 h');
assert.equal(duracionTexto(30), '30 s');
assert.equal(duracionTexto(0), '');
assert.equal(duracionTexto(undefined), '');
assert.equal(duracionTexto(2730), '46 min', '45 min 30 s se redondea al minuto');

/* ---- Una clase es un workout con video: Mis planes la reconoce sola ---- */
const clase = { ...sesionDeClase('Vinyasa 45 min'), clase: claseNueva({ url: 'https://v/videos/a.mp4', duracion: 2700 }) };
assert.deepEqual(Object.keys(sesionDeClase()).sort(), ['cat', 'day', 'exercises', 'name']);
const guardada = workoutDeSesiones([clase]);
assert.deepEqual(guardada.clase, { url: 'https://v/videos/a.mp4', duracion: 2700 }, 'la clase viaja con la sesión al guardarla');
assert.equal(guardada.day, undefined);

assert.ok(TIPOS.includes('clase'));
assert.equal(ETIQUETA_DE_TIPO.clase, 'Clase');
assert.equal(esDeUnDia('clase') && esDeUnDia('workout'), true);
assert.equal(esDeUnDia('rutina') || esDeUnDia('programa'), false);

assert.deepEqual(resumenDe('clase', guardada), { sesiones: 1, ejercicios: 0, clase: true, duracion: 2700 });
assert.deepEqual(resumenDe('workout', guardada), resumenDe('clase', guardada), 'un workout con video también es una clase');
assert.equal(textoDeResumen('clase', resumenDe('clase', guardada)), '45 min');
const conSets = workoutDeSesiones([{ ...clase, exercises: [{ name: 'Estiramiento', sets: '1', reps: '5' }] }]);
assert.equal(textoDeResumen('clase', resumenDe('clase', conSets)), '45 min · 1 ejercicio', 'la clase puede llevar ejercicios debajo');
const sinDuracion = workoutDeSesiones([{ ...clase, clase: claseNueva({ url: 'https://youtu.be/x' }) }]);
assert.deepEqual(resumenDe('clase', sinDuracion), { sesiones: 1, ejercicios: 0, clase: true });
assert.equal(textoDeResumen('clase', resumenDe('clase', sinDuracion)), '', 'una liga no dice cuánto dura');
assert.equal(resumenDe('workout', workoutDeSesiones([{ day: 'Lun', name: 'x', cat: 'gym', exercises: [{ name: 'A' }] }])).clase, undefined, 'un workout normal no es clase');

/* ---- Una sesión con clase y sin ejercicios sí tiene qué guardar ---- */
assert.equal(sesionTieneContenido(clase), true);
assert.equal(sesionTieneContenido(sesionDeClase()), false, 'una clase todavía sin video no');

/* ---- Al ponerla en un día de la semana o darla a un alumno, la clase se va con ella (y es una COPIA) ---- */
const puesta = diasDeWorkout(guardada, 'Mié', 'Vinyasa 45 min');
assert.equal(puesta.length, 1);
assert.deepEqual([puesta[0].day, puesta[0].name, puesta[0].clase.url], ['Mié', 'Vinyasa 45 min', 'https://v/videos/a.mp4']);
puesta[0].clase.url = 'otra';
assert.equal(guardada.clase.url, 'https://v/videos/a.mp4', 'cambiarla en el plan no toca la guardada');
assert.equal(diasDeWorkout({ ...guardada, name: '' }, 'Lun', 'Nombre del item')[0].name, 'Nombre del item', 'sin nombre de sesión toma el de lo guardado');

/* ---- Quitar las notas no quita la clase ---- */
const conNota = { ...clase, exercises: [{ isNote: true, text: 'Trae tu tapete' }] };
assert.equal(tieneNotas('clase', workoutDeSesiones([conNota])), true);
const limpia = sinNotas('clase', workoutDeSesiones([conNota]));
assert.equal(limpia.exercises.length, 0);
assert.equal(limpia.clase.url, 'https://v/videos/a.mp4', 'la clase se queda');

console.log('✓ clases: todo bien');
