/**
 * EL CATÁLOGO DEL EDITOR DE DEPORTE, sacado de `EditorDeDeporte.jsx` el 23 nov 2026 SIN CAMBIOS (mismo porqué que `catalogoDeLaLista.js`:
 * el conector de IA arma con lo mismo que el editor). Puro: los íconos de cada campo se los pone el editor.
 *
 * Datos en `day.deporte = { items, cal, calma, necesita, nota }`:
 *   items: [{ id, exercise_id, name, veces, lado, reps, dist: { q, u }, tiempo: { q, u }, desc: { q, u }, peso: { q, u }, nota }]
 *   (lo que no se agregó, no existe: `undefined`). `cal` y `calma` tienen la forma de un calentamiento de Running.
 */
export const rid = () => (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)).slice(0, 8);

// Lo que se agrega a un ejercicio, en el orden de los mosaicos. Reps va primero: es lo más común (Andrés).
export const CAMPOS_DE_DEPORTE = [
  { k: 'reps', label: 'Reps', nace: '' },
  { k: 'dist', label: 'Distancia', nace: { q: '', u: 'm' } },
  { k: 'tiempo', label: 'Tiempo', nace: { q: '', u: 'seg' } },
  { k: 'desc', label: 'Descanso', nace: { q: '', u: 'seg' } },
  { k: 'peso', label: 'Peso', nace: { q: '', u: 'kg' } },
  { k: 'nota', label: 'Nota', nace: '' },
];
export const UNIDADES_DE_DEPORTE = { dist: [['m', 'm'], ['yd', 'yd'], ['km', 'km']], tiempo: [['seg', 'seg'], ['min', 'min']], desc: [['seg', 'seg'], ['min', 'min']], peso: [['kg', 'kg'], ['lb', 'lb']] };
/** Un ejercicio recién agregado a la lista (como el «+» del editor). */
export const itemDeDeporte = (e) => ({ id: rid(), exercise_id: e.id, name: e.name, veces: '5' });
