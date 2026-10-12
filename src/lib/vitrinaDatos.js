/* LA VITRINA, lo puro: precios, tipos de venta, la ventana y la liga de cada plan. Sin red ni React: lo usan las pantallas y `scripts/prueba-vitrina.mjs`. */

/** El precio mínimo de un plan, en pesos (Andrés, 11 oct 2026). La base lo vuelve a exigir. */
export const PRECIO_MINIMO = 500;

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

