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
