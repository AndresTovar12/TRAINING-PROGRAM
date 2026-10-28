import { relojDeCronometro } from './entrenoLibre.js';
import { distanciaTexto, duracionTexto, fechaCorta, ritmoTexto } from './metricas/formato.js';

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
 * Stickers (28 oct 2026, decisión 1.11): el récord dice su VALOR y la DIFERENCIA contra el mejor anterior, con la FECHA de ese mejor; `detalle` lo junta
 * («8.2 km · 1.1 km más que el jue 9 oct»). Solo para quien NO tiene plan: con plan, quien llama no lo pide (manda lo programado).
 * `{ tipo, texto, valor?, diferencia?, fecha?, detalle? }` o `null`. La primera vez que hace algo también se dice («Tu primer registro de Pádel»).
 */
export function recordDe(fila, otras = []) {
  if (!fila) return null;
  const misma = (f) => f.id !== fila.id && f.deporte === fila.deporte && String(f.titulo ?? '') === String(fila.titulo ?? '');
  const antes = (otras ?? []).filter(misma);
  const nombre = fila.titulo || 'entreno';
  if (antes.length === 0) return { tipo: 'primera', texto: `Tu primer registro de ${nombre}` };
  const mejor = (lista, k, menor = false) => lista.reduce((m, f) => (m && (menor ? m[k] <= f[k] : m[k] >= f[k]) ? m : f), null);
  const con = (r) => ({ ...r, detalle: `${r.valor} · ${r.diferencia} que el ${r.fecha}` });
  const largos = antes.filter((f) => Number(f.distancia_m) > 0);
  const lejos = mejor(largos, 'distancia_m');
  if (fila.distancia_m >= 100 && fila.distancia_m > (lejos?.distancia_m ?? 0)) {
    const r = { tipo: 'distancia', texto: 'Tu distancia más larga', valor: distanciaTexto(fila.distancia_m) };
    return lejos ? con({ ...r, diferencia: `${distanciaTexto(fila.distancia_m - lejos.distancia_m)} más`, fecha: fechaCorta(lejos.inicio, lejos.desfase_min) }) : r;
  }
  const ritmo = fila.metricas?.ritmo_medio_s_km;
  const conRitmo = antes.filter((f) => f.distancia_m >= 1000 && f.metricas?.ritmo_medio_s_km > 0).map((f) => ({ ...f, ritmo: f.metricas.ritmo_medio_s_km }));
  const rapido = mejor(conRitmo, 'ritmo', true);
  if (ritmo > 0 && fila.distancia_m >= 1000 && rapido && ritmo < rapido.ritmo) {
    return con({ tipo: 'ritmo', texto: 'Tu ritmo más rápido', valor: `${ritmoTexto(ritmo)} /km`, diferencia: `${Math.round(rapido.ritmo - ritmo)} s/km más rápido`, fecha: fechaCorta(rapido.inicio, rapido.desfase_min) });
  }
  const largo = mejor(antes, 'duracion_s');
  if (fila.duracion_s > (Number(largo?.duracion_s) || 0)) {
    return con({ tipo: 'tiempo', texto: 'Tu entreno más largo', valor: duracionTexto(fila.duracion_s), diferencia: `${duracionTexto(fila.duracion_s - (Number(largo.duracion_s) || 0))} más`, fecha: fechaCorta(largo.inicio, largo.desfase_min) });
  }
  return null;
}
