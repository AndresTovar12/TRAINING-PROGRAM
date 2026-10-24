import { relojDeCronometro } from './entrenoLibre.js';
import { distanciaTexto, duracionTexto, ritmoTexto } from './metricas/formato.js';

/* Los textos del entreno libre (lo puro, para poder probarlos): los números del resumen de un entreno y la línea chica de cada fila de «Tus entrenos». `fila`: una fila de `actividades`. */

/** Los números del resumen: tiempo siempre; distancia y ritmo (o velocidad) si los hubo; pulso si lo trae. */
export function datosDelResumen(fila) {
  const datos = [{ valor: relojDeCronometro(fila.duracion_s ?? 0), etiqueta: 'tiempo' }];
  if (fila.distancia_m >= 100) datos.push({ valor: distanciaTexto(fila.distancia_m), etiqueta: 'distancia' });
  const ritmo = fila.metricas?.ritmo_medio_s_km;
  if (ritmo) datos.push({ valor: `${ritmoTexto(ritmo)} /km`, etiqueta: 'ritmo' });
  else if (fila.metricas?.velocidad_media_kmh) datos.push({ valor: `${fila.metricas.velocidad_media_kmh} km/h`, etiqueta: 'velocidad' });
  if (fila.fc_media > 0) datos.push({ valor: `${fila.fc_media} lpm`, etiqueta: 'pulso medio' });
  return datos;
}

/** «42 min · 8.2 km»: la línea chica de cada fila de «Tus entrenos». */
export const lineaDeEntreno = (f) => [duracionTexto(f.duracion_s), f.distancia_m >= 100 ? distanciaTexto(f.distancia_m) : null].filter((x) => x && x !== '—').join(' · ');

/**
 * ¿Rompió algo con este entreno? (Activity Tracker, 23 oct 2026: «avisa si rompió un récord» en la celebración, sin que lo busque). Se compara contra sus otros entrenos
 * DE LA MISMA ACTIVIDAD (mismo título, o mismo deporte si no tiene título propio). Lo que más dice va primero: distancia, luego ritmo, luego tiempo.
 * `{ tipo, texto }` o `null`. La primera vez que hace algo también se dice («Tu primer Pádel»).
 */
export function recordDe(fila, otras = []) {
  if (!fila) return null;
  const misma = (f) => f.id !== fila.id && f.deporte === fila.deporte && String(f.titulo ?? '') === String(fila.titulo ?? '');
  const antes = (otras ?? []).filter(misma);
  const nombre = fila.titulo || 'entreno';
  if (antes.length === 0) return { tipo: 'primera', texto: `Tu primer registro de ${nombre}` };
  const max = (k) => Math.max(0, ...antes.map((f) => Number(f[k]) || 0));
  if (fila.distancia_m >= 100 && fila.distancia_m > max('distancia_m')) return { tipo: 'distancia', texto: 'Tu distancia más larga' };
  const ritmo = fila.metricas?.ritmo_medio_s_km;
  const ritmos = antes.filter((f) => f.distancia_m >= 1000).map((f) => f.metricas?.ritmo_medio_s_km).filter((r) => r > 0);
  if (ritmo > 0 && fila.distancia_m >= 1000 && ritmos.length && ritmo < Math.min(...ritmos)) return { tipo: 'ritmo', texto: 'Tu ritmo más rápido' };
  if (fila.duracion_s > max('duracion_s')) return { tipo: 'tiempo', texto: 'Tu entreno más largo' };
  return null;
}
