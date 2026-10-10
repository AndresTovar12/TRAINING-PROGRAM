/* Lectores de los archivos de texto de un entreno: GPX y TCX.

   Son XML, pero NO se leen con `DOMParser`: un archivo de un maratón pesa varios MB y esto corre en un Worker (que no tiene DOM) y en Node (las pruebas).
   Se recorren con expresiones regulares sencillas, porque la forma de estos archivos es muy regular. Cada lector devuelve una lista de entrenos «crudos»:

     { formato, deporte, deporte_original, titulo, dispositivo, inicio (ms), fin (ms), desfase_min, duracion_s, distancia_m, kcal_activas | kcal_totales,
       resumen: { fc_media, fc_max, ... },   lo que el archivo dice por su cuenta, si lo dice
       vueltas: [{ t0, dur, dist, fc, fcmax }],
       muestras: [{ t, fc, vel, alt, cad, pot, dist, lat, lon }] }   con `t` en segundos desde `inicio`

   `desfase_min` solo viene si el archivo lo dice (los GPX y TCX casi siempre guardan la hora en UTC): quien llama pone el de la persona.

   Este archivo no importa nada de la app (ni `@/`). */
import { deporteDeTexto } from './deportes.js';

const entidades = (t) => (t ?? '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const numero = (t) => {
  const n = Number.parseFloat(t);
  return Number.isFinite(n) ? n : null;
};
const hora = (t) => {
  const ms = Date.parse(String(t ?? '').trim());
  return Number.isFinite(ms) ? ms : null;
};

// El texto de la primera etiqueta con ese nombre (con o sin prefijo de espacio de nombres: `<gpxtpx:hr>` y `<hr>` son lo mismo).
const etiqueta = (xml, nombre) => {
  const m = new RegExp(`<(?:[\\w.-]+:)?${nombre}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w.-]+:)?${nombre}>`).exec(xml);
  return m ? entidades(m[1].trim()) : null;
};

/* ------------------------------------------------------------------ */
/* GPX                                                                 */
/* ------------------------------------------------------------------ */

/**
 * Un archivo GPX: uno o más recorridos (`<trk>`). Trae lat/lon, altura, hora y, si el reloj lo guardó, pulso, cadencia y potencia en las extensiones
 * (`gpxtpx:hr`, `gpxtpx:cad`, `power`, `speed`). Un recorrido con menos de 2 puntos con hora no es un entreno.
 */
export function leeGpx(texto) {
  const salida = [];
  const creador = entidades(/<gpx\b[^>]*\bcreator="([^"]*)"/.exec(texto.slice(0, 3000))?.[1] ?? '') || null;
  const trks = texto.match(/<trk\b[\s\S]*?<\/trk>/g) ?? [];
  trks.forEach((trk) => {
    const puntos = [];
    const re = /<trkpt\b([^>]*?)(?:\/>|>([\s\S]*?)<\/trkpt>)/g;
    let m;
    while ((m = re.exec(trk)) !== null) {
      const lat = numero(/\blat="([^"]*)"/.exec(m[1])?.[1]);
      const lon = numero(/\blon="([^"]*)"/.exec(m[1])?.[1]);
      const cuerpo = m[2] ?? '';
      const ms = hora(etiqueta(cuerpo, 'time'));
      if (ms === null) continue;
      puntos.push({
        ms, lat, lon, alt: numero(etiqueta(cuerpo, 'ele')),
        fc: numero(etiqueta(cuerpo, 'hr')), cad: numero(etiqueta(cuerpo, 'cad')),
        pot: numero(etiqueta(cuerpo, 'power') ?? etiqueta(cuerpo, 'watts') ?? etiqueta(cuerpo, 'PowerInWatts')), vel: numero(etiqueta(cuerpo, 'speed')),
      });
    }
    if (puntos.length < 2) return;
    puntos.sort((a, b) => a.ms - b.ms);
    const inicio = puntos[0].ms;
    const titulo = etiqueta(trk.replace(/<trkseg\b[\s\S]*?<\/trkseg>/g, ''), 'name');
    const tipo = etiqueta(trk.replace(/<trkseg\b[\s\S]*?<\/trkseg>/g, ''), 'type');
    salida.push({
      formato: 'gpx', deporte: deporteDeTexto(tipo), deporte_original: tipo ?? null, titulo: titulo || null, dispositivo: creador,
      inicio, fin: puntos[puntos.length - 1].ms, duracion_s: Math.round((puntos[puntos.length - 1].ms - inicio) / 1000),
      muestras: puntos.map((p) => {
        const x = { t: (p.ms - inicio) / 1000 };
        for (const k of ['fc', 'vel', 'alt', 'cad', 'pot', 'lat', 'lon']) if (p[k] !== null && p[k] !== undefined) x[k] = p[k];
        return x;
      }),
    });
  });
  return salida;
}

/* ------------------------------------------------------------------ */
/* TCX                                                                 */
/* ------------------------------------------------------------------ */

/**
 * Un archivo TCX (Training Center): una o más `<Activity>`; cada una con sus vueltas (`<Lap>`) y los puntos de cada vuelta (`<Trackpoint>`). El deporte es el
 * atributo `Sport` («Running», «Biking», «Other»): un «Other» no dice si fue fuerza o yoga y queda como `otro`. Las calorías son la suma de las vueltas.
 */
export function leeTcx(texto) {
  const salida = [];
  const creador = entidades(/<Creator\b[\s\S]*?<Name>([^<]*)<\/Name>/.exec(texto)?.[1] ?? '') || null;
  const actividades = texto.match(/<Activity\b[\s\S]*?<\/Activity>/g) ?? [];
  actividades.forEach((act) => {
    const deporte = /<Activity\b[^>]*\bSport="([^"]*)"/.exec(act)?.[1] ?? null;
    const idMs = hora(etiqueta(act, 'Id'));
    const vueltasXml = act.match(/<Lap\b[\s\S]*?<\/Lap>/g) ?? [];
    const puntos = [];
    const vueltas = [];
    let kcal = 0;
    vueltasXml.forEach((lap, i) => {
      const inicioLap = hora(/<Lap\b[^>]*\bStartTime="([^"]*)"/.exec(lap)?.[1]);
      const dur = numero(etiqueta(lap, 'TotalTimeSeconds'));
      const dist = numero(etiqueta(lap, 'DistanceMeters'));
      const cal = numero(etiqueta(lap, 'Calories'));
      if (cal) kcal += cal;
      const fc = numero(etiqueta(etiqueta(lap, 'AverageHeartRateBpm') ?? '', 'Value'));
      const fcmax = numero(etiqueta(etiqueta(lap, 'MaximumHeartRateBpm') ?? '', 'Value'));
      vueltas.push({ n: i + 1, tipo: 'manual', ms: inicioLap, dur, dist, fc, fcmax });
      const tps = lap.match(/<Trackpoint\b[\s\S]*?<\/Trackpoint>/g) ?? [];
      tps.forEach((tp) => {
        const ms = hora(etiqueta(tp, 'Time'));
        if (ms === null) return;
        const pos = etiqueta(tp, 'Position');
        puntos.push({
          ms, lat: pos ? numero(etiqueta(pos, 'LatitudeDegrees')) : null, lon: pos ? numero(etiqueta(pos, 'LongitudeDegrees')) : null,
          alt: numero(etiqueta(tp, 'AltitudeMeters')), dist: numero(etiqueta(tp, 'DistanceMeters')),
          fc: numero(etiqueta(etiqueta(tp, 'HeartRateBpm') ?? '', 'Value')), cad: numero(etiqueta(tp, 'Cadence') ?? etiqueta(tp, 'RunCadence')),
          vel: numero(etiqueta(tp, 'Speed')), pot: numero(etiqueta(tp, 'Watts')),
        });
      });
    });
    if (puntos.length < 2 && !(vueltas.length && vueltas.some((v) => v.dur))) return;
    puntos.sort((a, b) => a.ms - b.ms);
    const inicio = puntos.length ? puntos[0].ms : (idMs ?? vueltas[0]?.ms);
    if (inicio === null || inicio === undefined) return;
    const duracion = puntos.length > 1 ? Math.round((puntos[puntos.length - 1].ms - inicio) / 1000) : Math.round(vueltas.reduce((s, v) => s + (v.dur ?? 0), 0));
    // La duración de las vueltas (con pausas descontadas) manda si el archivo la trae completa.
    const sumaVueltas = Math.round(vueltas.reduce((s, v) => s + (v.dur ?? 0), 0));
    const distanciaDeVueltas = vueltas.reduce((s, v) => s + (v.dist ?? 0), 0);
    salida.push({
      formato: 'tcx', deporte: deporteDeTexto(deporte), deporte_original: deporte, titulo: null, dispositivo: creador,
      inicio, fin: puntos.length ? puntos[puntos.length - 1].ms : inicio + duracion * 1000, duracion_s: duracion,
      movimiento_s: sumaVueltas > 0 && sumaVueltas <= duracion ? sumaVueltas : null,
      distancia_m: distanciaDeVueltas > 0 ? Math.round(distanciaDeVueltas) : null, kcal_totales: kcal > 0 ? Math.round(kcal) : null,
      vueltas: vueltas.filter((v) => v.dur).map((v) => ({
        n: v.n, tipo: v.tipo, t0: v.ms !== null ? Math.round((v.ms - inicio) / 1000) : null, dur: Math.round(v.dur), dist: v.dist !== null ? Math.round(v.dist) : null,
        fc: v.fc, fcmax: v.fcmax, ritmo: v.dist > 50 && v.dur ? Math.round((v.dur / v.dist) * 1000) : null,
      })),
      muestras: puntos.map((p) => {
        const x = { t: (p.ms - inicio) / 1000 };
        for (const k of ['fc', 'vel', 'alt', 'cad', 'pot', 'lat', 'lon', 'dist']) if (p[k] !== null && p[k] !== undefined) x[k] = p[k];
        return x;
      }),
    });
  });
  return salida;
}

/** ¿Este texto es el export de Apple Salud (`<HealthData`)? Se mira solo el principio del archivo. */
export const esExportDeAppleSalud = (principio) => /<HealthData\b/.test(principio.slice(0, 20000));
