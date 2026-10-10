/* Lector de los archivos .FIT (Garmin, Polar, Suunto, COROS, Wahoo…): el formato en que casi todos los relojes guardan un entreno.

   Un FIT guarda tres cosas que aquí se usan: las muestras segundo a segundo (`record`: pulso, ruta, altura, velocidad, cadencia, potencia), las vueltas (`lap`) y el
   resumen de la sesión (`session`: deporte, duración, distancia, calorías, pulso medio y máximo). Un archivo puede traer varias sesiones (un triatlón): cada una
   es un entreno. Devuelve la misma forma «cruda» que los lectores de GPX y TCX (ver `leeXml.js`).

   La librería que lo decodifica (`fit-file-parser`) es grande: se carga con `import()` solo cuando llega un .fit, y no entra al paquete principal de la app.

   Este archivo no importa nada de la app (ni `@/`): solo `./deportes.js`. */
import { deporteDeFit } from './deportes.js';

const ms = (d) => (d instanceof Date ? d.getTime() : (typeof d === 'string' ? Date.parse(d) : null));
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/**
 * Los entrenos de un archivo FIT. `datos` es lo que devuelve `fit-file-parser` con `mode: 'list'` y unidades en m, m/s.
 * Separado de la lectura del archivo para poder probarlo con datos inventados.
 */
export function entrenosDeFit(datos) {
  const sesiones = datos.sessions?.length ? datos.sessions : [null];
  const registros = (datos.records ?? []).map((r) => ({ ...r, _ms: ms(r.timestamp) })).filter((r) => r._ms !== null).sort((a, b) => a._ms - b._ms);
  const archivo = datos.file_ids?.[0] ?? {};
  const info = datos.device_infos?.find((d) => typeof d?.product_name === 'string' && d.product_name) ?? null;
  const fabricante = typeof archivo.manufacturer === 'string' && archivo.manufacturer ? archivo.manufacturer : null;
  const producto = info?.product_name ?? (typeof archivo.product === 'string' ? archivo.product : null);
  const dispositivo = [fabricante ? fabricante[0].toUpperCase() + fabricante.slice(1) : null, producto?.replace(/_/g, ' ')].filter(Boolean).join(' ') || null;
  // Desfase de hora local: «la hora local guardada como si fuera UTC» menos la UTC, en minutos y redondeado a cuartos de hora.
  const act = Array.isArray(datos.activity) ? datos.activity[0] : datos.activity;
  const loc = ms(act?.local_timestamp);
  const utc = ms(act?.timestamp);
  const desfase = loc !== null && utc !== null ? Math.round((loc - utc) / 60000 / 15) * 15 : null;

  const salida = [];
  sesiones.forEach((s, indice) => {
    const inicio = s ? ms(s.start_time) : (registros[0]?._ms ?? null);
    if (inicio === null) return;
    const duracionS = s ? num(s.total_elapsed_time) : (registros.length ? (registros[registros.length - 1]._ms - inicio) / 1000 : null);
    const fin = duracionS !== null ? inicio + duracionS * 1000 : (registros[registros.length - 1]?._ms ?? inicio);
    // Solo las muestras de ESTA sesión (con un margen de 2 s por los redondeos del reloj).
    const dentro = (sesiones.length > 1 || s) ? registros.filter((r) => r._ms >= inicio - 2000 && r._ms <= fin + 2000) : registros;
    const deporte = s ? deporteDeFit(s.sport, s.sub_sport) : 'otro';
    const camina = deporte === 'correr' || deporte === 'caminar' || deporte === 'senderismo';
    const muestras = dentro.map((r) => {
      const x = { t: Math.max(0, (r._ms - inicio) / 1000) };
      const poner = (k, v) => { if (v !== null && v !== undefined) x[k] = v; };
      poner('fc', num(r.heart_rate));
      poner('vel', num(r.enhanced_speed) ?? num(r.speed));
      poner('alt', num(r.enhanced_altitude) ?? num(r.altitude));
      // La cadencia de correr se guarda por un pie (pasos de una pierna): los pasos por minuto son el doble.
      const cad = num(r.cadence);
      poner('cad', cad !== null ? (camina ? cad * 2 + (num(r.fractional_cadence) ?? 0) * 2 : cad) : null);
      poner('pot', num(r.power));
      poner('dist', num(r.distance));
      poner('lat', num(r.position_lat));
      poner('lon', num(r.position_long));
      return x;
    });
    const vueltas = (datos.laps ?? [])
      .map((l) => ({ l, ini: ms(l.start_time) }))
      .filter(({ ini }) => ini !== null && ini >= inicio - 2000 && ini <= fin + 2000)
      .map(({ l, ini }, i) => {
        const dur = num(l.total_timer_time) ?? num(l.total_elapsed_time);
        const dist = num(l.total_distance);
        return {
          n: i + 1, tipo: 'manual', t0: Math.round((ini - inicio) / 1000), dur: dur !== null ? Math.round(dur) : null, dist: dist !== null ? Math.round(dist) : null,
          fc: num(l.avg_heart_rate), fcmax: num(l.max_heart_rate), ritmo: dist > 50 && dur ? Math.round((dur / dist) * 1000) : null,
        };
      })
      .filter((v) => v.dur);
    // Las series de un entreno de fuerza (Garmin guarda cada serie: ejercicio, repeticiones y peso).
    const sets = (datos.sets ?? [])
      .map((e) => ({ ini: ms(e.start_time), e }))
      .filter(({ ini }) => ini !== null && ini >= inicio - 2000 && ini <= fin + 2000)
      .map(({ ini, e }) => ({
        t0: Math.round((ini - inicio) / 1000), dur: num(e.duration) !== null ? Math.round(e.duration) : null, tipo: e.set_type === 'rest' ? 'descanso' : 'serie',
        reps: num(e.repetitions), kg: num(e.weight),
      }));
    salida.push({
      formato: 'fit', deporte, deporte_original: s ? [s.sport, s.sub_sport].filter((x) => x && x !== 'generic').join('/') || null : null, titulo: null, dispositivo,
      inicio, fin, desfase_min: desfase, duracion_s: duracionS !== null ? Math.round(duracionS) : null,
      movimiento_s: s && num(s.total_timer_time) !== null ? Math.round(s.total_timer_time) : null,
      distancia_m: s && num(s.total_distance) !== null && s.total_distance > 0 ? Math.round(s.total_distance) : null,
      kcal_totales: s && num(s.total_calories) !== null && s.total_calories > 0 ? Math.round(s.total_calories) : null,
      resumen: s ? {
        fc_media: num(s.avg_heart_rate), fc_max: num(s.max_heart_rate), fc_min: num(s.min_heart_rate),
        desnivel_pos_m: num(s.total_ascent), desnivel_neg_m: num(s.total_descent), velocidad_max_ms: num(s.enhanced_max_speed) ?? num(s.max_speed),
        potencia_media: num(s.avg_power), potencia_max: num(s.max_power),
      } : null,
      vueltas, muestras,
      metricas: sets.length ? { sets } : null,
      indice_de_sesion: indice,
    });
  });
  return salida.filter((e) => e.muestras.length > 0 || (e.duracion_s ?? 0) > 0);
}

/**
 * Lee un archivo .fit (un `ArrayBuffer` o un `Uint8Array`) y devuelve sus entrenos. Un archivo dañado o que no es un FIT lanza un error con un mensaje
 * que se le puede enseñar a la persona.
 */
export async function leeFit(bytes) {
  const { default: FitParser } = await import('fit-file-parser');
  const ab = bytes instanceof ArrayBuffer ? bytes : bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  let datos;
  try {
    datos = await new FitParser({ force: true, mode: 'list', speedUnit: 'm/s', lengthUnit: 'm' }).parseAsync(ab);
  } catch (e) {
    throw new Error(`Ese archivo .fit no se pudo leer (${typeof e === 'string' ? e : (e?.message ?? 'está dañado')})`, { cause: e });
  }
  return entrenosDeFit(datos);
}
