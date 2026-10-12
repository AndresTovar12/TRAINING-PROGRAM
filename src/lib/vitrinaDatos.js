/* LA VITRINA, lo puro: precios, tipos de venta, la ventana y la liga de cada plan. Sin red ni React: lo usan las pantallas y `scripts/prueba-vitrina.mjs`. */

import { duracionTexto } from './clases.js';

/** El precio mínimo de un plan, en pesos (Andrés, 11 oct 2026). La base lo vuelve a exigir. */
export const PRECIO_MINIMO = 500;

/* QUÉ SE VENDE (12 oct 2026): un programa, una rutina semanal, un workout o una clase de «Mis planes». Al publicar, todo se vuelve la misma forma de plan (ver
   docs/sql/2026-10-12-vender-rutinas-workouts-y-clases.sql). Un workout o una clase SUELTOS se venden solo a pago único y con un mínimo menor: con $500 una clase no se vendería.
   Supuesto de esa parte (Andrés puede cambiarlo): $100. Es este número y la base (`vitrina_precio_minimo`). */
export const CONTENIDOS = ['programa', 'rutina', 'workout', 'clase'];
export const ETIQUETA_DE_CONTENIDO = { programa: 'Programa', rutina: 'Rutina semanal', workout: 'Workout', clase: 'Clase' };
export const PRECIO_MINIMO_SUELTO = 100;
/** Un workout o una clase: una sola cosa que se compra una vez (no una mensualidad). */
export const esSuelto = (contenido) => contenido === 'workout' || contenido === 'clase';
export const precioMinimoDe = (contenido) => (esSuelto(contenido) ? PRECIO_MINIMO_SUELTO : PRECIO_MINIMO);
/** Lo suelto SIEMPRE es pago único; lo demás respeta lo que el coach eligió (membresía si no eligió nada). */
export const tipoDeCobroDe = (contenido, tipo) => (esSuelto(contenido) || tipo === 'pago_unico' ? 'pago_unico' : 'membresia');

/** Lo que se vende, en pocas palabras para tarjetas y listas: «Clase · 45 min», «Workout», «Rutina semanal», «12 semanas». */
export function textoDeContenido({ contenido = 'programa', semanas = 0, duracion_clase: duracion = null } = {}) {
  if (contenido === 'clase') return ['Clase', duracionTexto(duracion)].filter(Boolean).join(' · ');
  if (contenido === 'workout') return 'Workout';
  if (contenido === 'rutina') return 'Rutina semanal';
  const n = Number(semanas);
  return Number.isFinite(n) && n > 0 ? `${n} ${n === 1 ? 'semana' : 'semanas'}` : '';
}

export const TIPOS_DE_VENTA = [
  { id: 'membresia', nombre: 'Membresía mensual' },
  { id: 'pago_unico', nombre: 'Pago único' },
];

/** Cuántas semanas hacia adelante ve el comprador. Por defecto un mes completo; el coach puede bajarlo, nunca subirlo (Andrés, 12 oct 2026; lo exige también la base). */
export const VENTANA_MAXIMA = 4;
export const VENTANAS = [
  { valor: 1, nombre: '1 semana' },
  { valor: 2, nombre: '2 semanas' },
  { valor: 3, nombre: '3 semanas' },
  { valor: 4, nombre: '1 mes' },
];

/** «Fuerza y potencia 12 sem.» → «fuerza-y-potencia-12-sem». Es lo que va en la liga. */
export const slugDe = (texto) => String(texto ?? '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

export const ligaPublica = (usuario, slug, origen = typeof window !== 'undefined' ? window.location.origin : '') => `${origen}/@${usuario}/${slug}`;

/** La liga de un plan: su nombre vuelto liga y, si ya hay otro plan del mismo coach con esa liga, con un número («fuerza», «fuerza-2»…). Se decide UNA vez, al crearlo: después no cambia aunque cambie el nombre (la liga ya anda en Instagram). */
export function slugUnico(texto, existentes = []) {
  const base = slugDe(texto) || 'plan';
  const ocupados = new Set(existentes);
  if (!ocupados.has(base)) return base;
  for (let n = 2; n < 1000; n += 1) {
    const candidato = `${base.slice(0, 56)}-${n}`;
    if (!ocupados.has(candidato)) return candidato;
  }
  return `${base.slice(0, 50)}-${Date.now() % 100000}`;
}

