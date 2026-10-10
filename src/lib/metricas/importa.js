/* IMPORTAR ARCHIVOS de entrenos: lo que el atleta (o su coach) suelta en Training Lab para que el coach vea las métricas.

   Acepta, solos o dentro de un ZIP (y con `.gz`):
     .fit .gpx .tcx            un entreno cada uno (Garmin, Polar, Suunto, COROS, Wahoo, Strava, TrainingPeaks…)
     export.xml / export.zip   el export de Apple Salud: entrenos del Apple Watch con su pulso, y cada día el reposo, la HRV y el sueño
     el ZIP de Strava          sus actividades en .fit.gz/.gpx/.tcx.gz y `activities.csv` (de ahí salen el nombre y el tipo de cada una)

   Se lee en trozos: un ZIP de Apple Salud pesa más de 1 GB y no cabe en la memoria de un teléfono. Cada entreno se «prepara» (ver `construye.js`) apenas se
   lee y sus muestras se sueltan, así que una importación de miles de entrenos tampoco las junta todas.

   Este archivo corre en un Worker (ver `metricas.worker.js`) y en Node (las pruebas): solo usa lo que tienen los dos (`File`/`Blob`, `TextDecoder`).
   No importa nada de la app (ni `@/`). */
import { Unzip, UnzipInflate, UnzipPassThrough, gunzipSync, unzipSync } from 'fflate';
import { leeGpx, leeTcx } from './leeXml.js';
import { leeFit } from './leeFit.js';
import { creaLectorDeAppleSalud, unePorRutas } from './leeAppleSalud.js';
import { preparaEntreno } from './construye.js';
import { deporteDeTexto } from './deportes.js';

const TROZO = 4 * 1024 * 1024;
const decodifica = (bytes) => new TextDecoder('utf-8').decode(bytes);
const bytesDe = async (archivo, a = 0, b = archivo.size) => new Uint8Array(await archivo.slice(a, b).arrayBuffer());
const sinAcentos = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/* ------------------------------------------------------------------ */
/* El CSV de Strava                                                    */
/* ------------------------------------------------------------------ */

/** Un CSV a filas de textos. Entiende comillas, comas y saltos de línea dentro de un campo. */
export function leeCsv(texto) {
  const filas = [];
  let fila = [];
  let campo = '';
  let comillas = false;
  for (let i = 0; i < texto.length; i += 1) {
    const c = texto[i];
    if (comillas) {
      if (c === '"') { if (texto[i + 1] === '"') { campo += '"'; i += 1; } else comillas = false; } else campo += c;
    } else if (c === '"') comillas = true;
    else if (c === ',') { fila.push(campo); campo = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i += 1;
      fila.push(campo); campo = '';
      if (fila.length > 1 || fila[0] !== '') filas.push(fila);
      fila = [];
    } else campo += c;
  }
  if (campo !== '' || fila.length) { fila.push(campo); filas.push(fila); }
  return filas;
}

/** De `activities.csv` de Strava: `Map { archivo → { titulo, tipo } }`. Sirve con el CSV en inglés y en español. */
export function leeActividadesDeStrava(texto) {
  const filas = leeCsv(texto);
  if (filas.length < 2) return new Map();
  const cab = filas[0].map(sinAcentos);
  const col = (...nombres) => cab.findIndex((c) => nombres.some((n) => c === n));
  const iArchivo = col('filename', 'nombre del archivo', 'archivo');
  const iNombre = col('activity name', 'nombre de la actividad');
  const iTipo = col('activity type', 'tipo de actividad');
  const mapa = new Map();
  if (iArchivo < 0) return mapa;
  filas.slice(1).forEach((f) => {
    const archivo = (f[iArchivo] ?? '').trim();
    if (archivo) mapa.set(archivo, { titulo: iNombre >= 0 ? (f[iNombre] ?? '').trim() || null : null, tipo: iTipo >= 0 ? (f[iTipo] ?? '').trim() || null : null });
  });
  return mapa;
}

/* ------------------------------------------------------------------ */
/* Un archivo suelto                                                   */
/* ------------------------------------------------------------------ */

const extension = (nombre) => {
  const n = nombre.toLowerCase();
  const sinGz = n.endsWith('.gz') ? n.slice(0, -3) : n;
  return { gz: n.endsWith('.gz'), ext: sinGz.includes('.') ? sinGz.slice(sinGz.lastIndexOf('.') + 1) : '' };
};

/**
 * Lee UN archivo de un entreno (ya en bytes) y devuelve sus entrenos crudos. `nombre` decide el formato (`.fit`, `.gpx`, `.tcx`, con o sin `.gz`).
 * Un archivo que no es de ninguno de esos tipos devuelve `null` (no es un error: el ZIP trae también fotos y otros archivos).
 */
export async function leeEntrenosDe(nombre, bytes) {
  const { gz, ext } = extension(nombre);
  let datos = bytes;
  if (gz) datos = gunzipSync(bytes);
  if (ext === 'fit') return leeFit(datos);
  if (ext === 'gpx') return leeGpx(decodifica(datos));
  if (ext === 'tcx') return leeTcx(decodifica(datos));
  return null;
}

/* ------------------------------------------------------------------ */
/* La tanda completa                                                   */
/* ------------------------------------------------------------------ */

/**
 * Lee los archivos que soltó la persona. Devuelve:
 *   entrenos      los entrenos ya «preparados» (ver `preparaEntreno`), de los más viejos a los más nuevos
 *   recuperacion  las filas por día de Apple Salud (reposo, HRV, sueño…)
 *   perfil        `{ fecha_nacimiento, genero }` si el export de Apple Salud lo traía
 *   ignorados     `[{ nombre, motivo }]` de lo que no se pudo leer o no es un entreno
 * Opciones: `desde`/`hasta` (`AAAA-MM-DD`) recortan lo que se guarda; `alProgreso({ archivo, leidos, total, entrenos })`; `cancelado()` para parar.
 */
export async function leeArchivos(archivos, { desde = null, hasta = null, alProgreso = () => {}, cancelado = () => false } = {}) {
  const res = { entrenos: [], recuperacion: [], perfil: null, ignorados: [] };
  const csvDeStrava = new Map();
  const rutas = new Map();
  let apple = null;

  const dentro = (e) => {
    const dia = new Date(e.inicio + (e.desfase_min ?? 0) * 60000).toISOString().slice(0, 10);
    return (!desde || dia >= desde) && (!hasta || dia <= hasta);
  };
  const guarda = (crudos, nombre) => {
    (crudos ?? []).forEach((c) => {
      if (!dentro(c)) return;
      if (!c.muestras.length && !(c.duracion_s > 0)) return;
      res.entrenos.push(preparaEntreno({ ...c, archivo: nombre }));
    });
  };
  const ignora = (nombre, motivo) => res.ignorados.push({ nombre, motivo });
  const progreso = (archivo, leidos, total) => alProgreso({ archivo, leidos, total, entrenos: res.entrenos.length });

  // Un archivo de un entreno ya en bytes: del ZIP o suelto.
  async function procesa(nombre, bytes) {
    const base = nombre.split('/').pop();
    const baseBajo = base.toLowerCase();
    try {
      if (baseBajo === 'activities.csv') { leeActividadesDeStrava(decodifica(bytes)).forEach((v, k) => csvDeStrava.set(k, v)); return; }
      if (/(^|\/)workout-routes\/.+\.gpx$/i.test(nombre)) {
        const g = leeGpx(decodifica(bytes))[0];
        if (g) rutas.set(base, { inicio: g.inicio, muestras: g.muestras });
        return;
      }
      const crudos = await leeEntrenosDe(nombre, bytes);
      if (crudos === null) return;
      if (!crudos.length) { ignora(nombre, 'No trae un entreno (sin hora o sin datos)'); return; }
      guarda(crudos, nombre);
    } catch (e) {
      ignora(nombre, e?.message ?? 'No se pudo leer');
    }
  }

  // Un export de Apple Salud, el texto que llega por trozos.
  const lectorDeApple = () => { apple ??= creaLectorDeAppleSalud({ desde, hasta }); return apple; };

  async function leeZip(archivo) {
    let reconocidas = 0;
    let pendientes = 0;
    const trabajos = new Set();
    const lanza = (nombre, bytes) => {
      pendientes += 1;
      const t = procesa(nombre, bytes).finally(() => { pendientes -= 1; trabajos.delete(t); });
      trabajos.add(t);
    };
    const unzip = new Unzip((entrada) => {
      const nombre = entrada.name;
      const bajo = nombre.toLowerCase();
      if (bajo.endsWith('/')) return;
      const base = bajo.split('/').pop();
      if (base === 'export.xml') {
        reconocidas += 1;
        const lector = lectorDeApple();
        const dec = new TextDecoder('utf-8');
        entrada.ondata = (err, trozo, final) => {
          if (err) { ignora(nombre, 'El ZIP está dañado'); return; }
          lector.alimenta(dec.decode(trozo, { stream: !final }));
        };
        entrada.start();
        return;
      }
      const esRuta = /(^|\/)workout-routes\/.+\.gpx$/.test(bajo);
      const esEntreno = /\.(fit|gpx|tcx)(\.gz)?$/.test(base) && !esRuta;
      if (!esRuta && !esEntreno && base !== 'activities.csv') return;
      reconocidas += 1;
      const partes = [];
      entrada.ondata = (err, trozo, final) => {
        if (err) { ignora(nombre, 'El ZIP está dañado'); return; }
        partes.push(trozo);
        if (!final) return;
        const total = partes.reduce((s, p) => s + p.length, 0);
        const bytes = new Uint8Array(total);
        let o = 0;
        partes.forEach((p) => { bytes.set(p, o); o += p.length; });
        lanza(nombre, bytes);
      };
      entrada.start();
    });
    unzip.register(UnzipInflate);
    unzip.register(UnzipPassThrough);
    for (let a = 0; a < archivo.size; a += TROZO) {
      if (cancelado()) throw new Error('Importación cancelada');
      unzip.push(await bytesDe(archivo, a, a + TROZO), a + TROZO >= archivo.size);
      progreso(archivo.name, Math.min(a + TROZO, archivo.size), archivo.size);
      // Si los archivos salen más rápido de lo que se leen, se espera (no se juntan miles en memoria).
      while (pendientes > 30) await Promise.race([...trabajos]);
    }
    await Promise.all([...trabajos]);
    if (reconocidas === 0) {
      // Algunos ZIP no se pueden recorrer en trozos (guardan los tamaños al final): se abre completo, pidiendo solo lo que sirve.
      const todo = unzipSync(await bytesDe(archivo), { filter: (f) => /export\.xml$|\.(fit|gpx|tcx)(\.gz)?$|activities\.csv$/i.test(f.name) });
      const nombres = Object.keys(todo);
      for (const nombre of nombres) {
        if (cancelado()) throw new Error('Importación cancelada');
        if (nombre.toLowerCase().split('/').pop() === 'export.xml') {
          const lector = lectorDeApple();
          const dec = new TextDecoder('utf-8');
          for (let o = 0; o < todo[nombre].length; o += TROZO) lector.alimenta(dec.decode(todo[nombre].subarray(o, o + TROZO), { stream: o + TROZO < todo[nombre].length }));
        } else await procesa(nombre, todo[nombre]);
        delete todo[nombre];
      }
      if (!nombres.length) ignora(archivo.name, 'El ZIP no trae entrenos (.fit, .gpx, .tcx) ni el export de Apple Salud');
    }
  }

  async function leeXmlGrande(archivo) {
    // Un .xml: puede ser el export de Apple Salud (enorme) o un GPX/TCX suelto. Se mira el principio.
    const principio = decodifica(await bytesDe(archivo, 0, Math.min(archivo.size, 20000)));
    if (/<HealthData\b/.test(principio)) {
      const lector = lectorDeApple();
      const dec = new TextDecoder('utf-8');
      for (let a = 0; a < archivo.size; a += TROZO) {
        if (cancelado()) throw new Error('Importación cancelada');
        lector.alimenta(dec.decode(await bytesDe(archivo, a, a + TROZO), { stream: a + TROZO < archivo.size }));
        progreso(archivo.name, Math.min(a + TROZO, archivo.size), archivo.size);
      }
      return;
    }
    if (/<gpx\b/.test(principio)) return procesa(archivo.name.replace(/\.xml$/i, '.gpx'), await bytesDe(archivo));
    if (/<TrainingCenterDatabase\b/.test(principio)) return procesa(archivo.name.replace(/\.xml$/i, '.tcx'), await bytesDe(archivo));
    ignora(archivo.name, 'No es un entreno ni el export de Apple Salud');
  }

  for (const archivo of archivos) {
    if (cancelado()) throw new Error('Importación cancelada');
    const nombre = archivo.name;
    const { gz, ext } = extension(nombre);
    progreso(nombre, 0, archivo.size);
    try {
      if (ext === 'zip' && !gz) await leeZip(archivo);
      else if (ext === 'xml') await leeXmlGrande(archivo);
      else if (ext === 'fit' || ext === 'gpx' || ext === 'tcx') await procesa(nombre, await bytesDe(archivo));
      else if (ext === 'csv') await procesa(nombre, await bytesDe(archivo));
      else ignora(nombre, 'Ese tipo de archivo no se lee (solo .fit, .gpx, .tcx, .zip y el export de Apple Salud)');
    } catch (e) {
      if (/cancelada/.test(e?.message ?? '')) throw e;
      ignora(nombre, e?.message ?? 'No se pudo leer');
    }
    progreso(nombre, archivo.size, archivo.size);
  }

  // El export de Apple Salud: sus entrenos se unen a sus rutas y entran como los demás.
  if (apple) {
    const a = apple.termina();
    unePorRutas(a.entrenos, rutas);
    guarda(a.entrenos, 'export.xml');
    res.recuperacion = a.recuperacion;
    res.perfil = a.perfil;
  }
  // El nombre y el tipo de cada actividad de Strava, de su CSV.
  res.entrenos.forEach((e) => {
    const meta = csvDeStrava.get(e.archivo) ?? [...csvDeStrava.entries()].find(([k]) => e.archivo?.endsWith(k) || k.endsWith(e.archivo ?? '\0'))?.[1];
    if (!meta) return;
    if (meta.titulo && !e.titulo) e.titulo = meta.titulo;
    if (meta.tipo) {
      e.deporte_original = e.deporte_original ?? meta.tipo;
      if (e.deporte === 'otro') e.deporte = deporteDeTexto(meta.tipo);
    }
  });
  res.entrenos.sort((x, y) => x.inicio - y.inicio);
  return res;
}
