/* La RUTA del sello: de las coordenadas del reloj (`series.ruta`: `lat` y `lon`) a puntos que caben en un cuadro, sin deformarla.

   Un grado de longitud mide menos que uno de latitud conforme se aleja del ecuador (cos de la latitud): sin esa corrección una ruta de Monterrey se ve aplastada.
   La ruta se centra y se ajusta al lado que más pida. Un entreno que no se movió (todos los puntos iguales) no tiene forma que dibujar: `null`.

   Este archivo no importa nada de la app (ni `@/`): lo cargan tal cual las pruebas de Node. */

/**
 * `lat`, `lon`: coordenadas en grados. `ancho`, `alto`: el cuadro. `margen`: lo que se deja libre por cada lado (el grosor de la línea).
 * Devuelve `[[x, y], …]` dentro del cuadro (con el norte arriba), o `null`. Con más de `maximo` puntos se reparten parejo (la ruta guardada ya trae ≤ 500).
 */
export function ajustaRuta(lat, lon, ancho, alto, margen = 0, maximo = 400) {
  const n = Math.min(lat?.length ?? 0, lon?.length ?? 0);
  if (n < 2) return null;
  const validos = [];
  for (let i = 0; i < n; i += 1) if (Number.isFinite(lat[i]) && Number.isFinite(lon[i])) validos.push([lat[i], lon[i]]);
  if (validos.length < 2) return null;
  const paso = Math.max(1, Math.ceil(validos.length / maximo));
  const pts = validos.filter((_, i) => i % paso === 0 || i === validos.length - 1);
  const lat0 = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const k = Math.cos((lat0 * Math.PI) / 180);
  const xs = pts.map((p) => p[1] * k);
  const ys = pts.map((p) => -p[0]);
  const x0 = Math.min(...xs); const x1 = Math.max(...xs);
  const y0 = Math.min(...ys); const y1 = Math.max(...ys);
  const w = x1 - x0; const h = y1 - y0;
  // Menos de ~1 m en las dos direcciones: no se movió (o el GPS tembló en el mismo sitio).
  if (Math.max(w, h) < 1e-5) return null;
  const libreX = Math.max(1, ancho - 2 * margen);
  const libreY = Math.max(1, alto - 2 * margen);
  const escala = Math.min(w > 0 ? libreX / w : Infinity, h > 0 ? libreY / h : Infinity);
  const ox = margen + (libreX - w * escala) / 2;
  const oy = margen + (libreY - h * escala) / 2;
  return xs.map((x, i) => [ox + (x - x0) * escala, oy + (ys[i] - y0) * escala]);
}
