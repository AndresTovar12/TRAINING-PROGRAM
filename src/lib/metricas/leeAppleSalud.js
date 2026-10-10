/* Lector del EXPORT de Apple Salud (`export.xml`): la forma de traer lo que mide el Apple Watch SIN la app instalable.

   Andrés (10 oct 2026): «especialmente con el Apple Watch… ritmo cardiaco, etc.». Mientras la app descargable no exista, el atleta puede abrir Salud en su iPhone →
   su foto → «Exportar todos los datos de salud», y mandar ese ZIP a Training Lab: de ahí salen sus entrenos con el pulso por muestras, y cada día su pulso en
   reposo, su HRV y su sueño.

   Ese archivo pesa cientos de MB (una línea por cada latido medido, paso, caloría…), así que NO se lee de golpe: `alimenta()` recibe el texto en trozos de ~1 MB
   y recorre las etiquetas una por una, guardando solo lo que sirve. Un trozo puede cortar una etiqueta a la mitad: lo que no está completo se queda en espera
   del siguiente.

   Qué se guarda:
     · cada `<Workout>` (un entreno) con su tipo, hora, duración, distancia, calorías y el resumen de pulso; y los latidos medidos dentro de su ventana
     · cada día: pulso en reposo, HRV (SDNN), sueño (sin contar dos veces lo que midieron el reloj y el teléfono), pasos, calorías, VO2 máx, oxígeno, respiración, peso
   La ruta (GPS) de cada entreno vive en archivos .gpx aparte dentro del ZIP: aquí solo se anota cuál (`ruta_ref`); `unePorRutas` la une después.

   Todo es puro y no importa nada de la app (ni `@/`): solo `./deportes.js`. */
import { deporteDeApple } from './deportes.js';

/* ------------------------------------------------------------------ */
/* Fechas y atributos                                                  */
/* ------------------------------------------------------------------ */

/** `2026-05-01 08:14:03 -0600` → `{ ms, dia: '2026-05-01', desfase: -360, pared }` (`pared`: la hora de la pared, como si fuera UTC, para sumar horas sin zonas). */
export function fechaDeApple(s) {
  if (!s || s.length < 19) return null;
  const y = +s.slice(0, 4); const mo = +s.slice(5, 7); const d = +s.slice(8, 10);
  const h = +s.slice(11, 13); const mi = +s.slice(14, 16); const se = +s.slice(17, 19);
  if (!(y > 1990 && mo >= 1 && mo <= 12 && d >= 1 && d <= 31)) return null;
  const pared = Date.UTC(y, mo - 1, d, h, mi, se);
  const z = /([+-])(\d\d):?(\d\d)\s*$/.exec(s.slice(19));
  const desfase = z ? (z[1] === '-' ? -1 : 1) * (+z[2] * 60 + +z[3]) : 0;
  return { ms: pared - desfase * 60000, dia: s.slice(0, 10), desfase, pared };
}

// El valor de un atributo de una etiqueta (` nombre="valor"`), sin armar toda la tabla de atributos: hay millones de etiquetas.
function atributo(etiqueta, nombre) {
  const k = etiqueta.indexOf(` ${nombre}="`);
  if (k < 0) return null;
  const a = k + nombre.length + 3;
  const b = etiqueta.indexOf('"', a);
  return b < 0 ? null : etiqueta.slice(a, b);
}
const entidades = (t) => (t ?? '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const numero = (t) => {
  const n = Number.parseFloat(t);
  return Number.isFinite(n) ? n : null;
};

const aMetros = (v, u) => (v === null ? null : u === 'km' ? v * 1000 : u === 'mi' ? v * 1609.344 : u === 'yd' ? v * 0.9144 : v);
const aKcal = (v, u) => (v === null ? null : /kj/i.test(u ?? '') ? v / 4.184 : v);
const aSegundos = (v, u) => (v === null ? null : u === 'min' ? v * 60 : u === 'hr' || u === 'h' ? v * 3600 : v);

/* ------------------------------------------------------------------ */
/* Los tipos de registro que sirven                                    */
/* ------------------------------------------------------------------ */

const Q = 'HKQuantityTypeIdentifier';
const TIPOS = {
  [`${Q}HeartRate`]: 'fc', [`${Q}RestingHeartRate`]: 'reposo', [`${Q}HeartRateVariabilitySDNN`]: 'hrv', [`${Q}StepCount`]: 'pasos',
  [`${Q}ActiveEnergyBurned`]: 'kcalA', [`${Q}BasalEnergyBurned`]: 'kcalB', [`${Q}VO2Max`]: 'vo2', [`${Q}OxygenSaturation`]: 'spo2',
  [`${Q}RespiratoryRate`]: 'resp', [`${Q}BodyMass`]: 'peso', HKCategoryTypeIdentifierSleepAnalysis: 'sueno',
};

const ETAPAS = {
  HKCategoryValueSleepAnalysisAsleepCore: 'dormido', HKCategoryValueSleepAnalysisAsleepDeep: 'profundo', HKCategoryValueSleepAnalysisAsleepREM: 'rem',
  HKCategoryValueSleepAnalysisAsleepUnspecified: 'dormido', HKCategoryValueSleepAnalysisAsleep: 'dormido', HKCategoryValueSleepAnalysisAwake: 'despierto',
};

// Una lista de números que crece sin copiarse cada vez (los latidos son millones).
function lista(Tipo, inicial = 1 << 14) {
  let a = new Tipo(inicial);
  let n = 0;
  return {
    mete(v) {
      if (n === a.length) { const b = new Tipo(a.length * 2); b.set(a); a = b; }
      a[n] = v; n += 1;
    },
    get n() { return n; },
    get a() { return a; },
  };
}

const mediana = (v) => {
  const o = [...v].sort((x, y) => x - y);
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
};

// La longitud total que cubren unos intervalos [a, b] sin contar dos veces lo que se encima (el reloj y el teléfono miden la misma noche).
function uniones(intervalos) {
  if (!intervalos.length) return 0;
  const o = [...intervalos].sort((x, y) => x[0] - y[0]);
  let total = 0;
  let [a, b] = o[0];
  for (let i = 1; i < o.length; i += 1) {
    if (o[i][0] <= b) b = Math.max(b, o[i][1]);
    else { total += b - a; [a, b] = o[i]; }
  }
  return total + (b - a);
}

/* ------------------------------------------------------------------ */
/* El lector                                                           */
/* ------------------------------------------------------------------ */

/**
 * Un lector que se alimenta por trozos. `desde` y `hasta` (`AAAA-MM-DD`, en la hora local de cada dato) recortan lo que se guarda: con años de historia
 * conviene pedir solo el último año.
 *
 *   const lector = creaLectorDeAppleSalud({ desde: '2025-10-01' });
 *   lector.alimenta(trozo1); lector.alimenta(trozo2); …
 *   const { entrenos, recuperacion, perfil, resumen } = lector.termina();
 */
export function creaLectorDeAppleSalud({ desde = null, hasta = null } = {}) {
  let resto = '';
  const fc = { t: lista(Float64Array), v: lista(Uint8Array) };
  const entrenos = [];
  let actual = null;
  const dias = new Map();
  const perfil = {};
  const cuenta = { registros: 0, entrenos: 0 };
  const dentro = (dia) => dia && (!desde || dia >= desde) && (!hasta || dia <= hasta);
  const diaDe = (dia) => {
    let d = dias.get(dia);
    if (!d) { d = { reposo: [], hrv: [], spo2: [], resp: [], pasos: new Map(), kcalA: new Map(), kcalB: new Map(), vo2: null, peso: null, sueno: [] }; dias.set(dia, d); }
    return d;
  };

  function registro(e) {
    const clave = TIPOS[atributo(e, 'type')];
    if (!clave) return;
    const ini = fechaDeApple(atributo(e, 'startDate'));
    if (!ini || !dentro(ini.dia)) return;
    cuenta.registros += 1;
    const valor = atributo(e, 'value');
    if (clave === 'sueno') {
      const fin = fechaDeApple(atributo(e, 'endDate'));
      const etapa = ETAPAS[valor];
      if (!fin || !etapa || fin.pared <= ini.pared) return;
      // La noche cuenta en el día en que se despierta: se corta al mediodía (una siesta de la tarde se va con la noche siguiente).
      const dia = new Date(fin.pared + 12 * 3600000).toISOString().slice(0, 10);
      if (dentro(dia)) diaDe(dia).sueno.push([ini.ms, fin.ms, etapa]);
      return;
    }
    const v = numero(valor);
    if (v === null) return;
    const unidad = atributo(e, 'unit');
    if (clave === 'fc') {
      if (v >= 30 && v <= 240) { fc.t.mete(ini.ms); fc.v.mete(Math.round(v)); }
      return;
    }
    const d = diaDe(ini.dia);
    const fuente = atributo(e, 'sourceName') ?? '?';
    if (clave === 'reposo') d.reposo.push(v);
    else if (clave === 'hrv') d.hrv.push(v);
    else if (clave === 'pasos') d.pasos.set(fuente, (d.pasos.get(fuente) ?? 0) + v);
    else if (clave === 'kcalA') d.kcalA.set(fuente, (d.kcalA.get(fuente) ?? 0) + aKcal(v, unidad));
    else if (clave === 'kcalB') d.kcalB.set(fuente, (d.kcalB.get(fuente) ?? 0) + aKcal(v, unidad));
    else if (clave === 'vo2') d.vo2 = v;
    else if (clave === 'spo2') d.spo2.push(v <= 1.5 ? v * 100 : v);
    else if (clave === 'resp') d.resp.push(v);
    else if (clave === 'peso') d.peso = unidad === 'lb' ? v * 0.45359237 : v;
  }

  function abreEntreno(e) {
    const ini = fechaDeApple(atributo(e, 'startDate'));
    const fin = fechaDeApple(atributo(e, 'endDate'));
    if (!ini || !fin || !dentro(ini.dia)) { actual = { ignorar: true }; return; }
    const tipo = atributo(e, 'workoutActivityType');
    const dispositivoTexto = entidades(atributo(e, 'device') ?? '');
    const nombreDelReloj = /name:([^,>]+)/.exec(dispositivoTexto)?.[1]?.trim() ?? null;
    const fuente = entidades(atributo(e, 'sourceName') ?? '');
    actual = {
      ignorar: false, tipo, ini, fin,
      duracion: aSegundos(numero(atributo(e, 'duration')), atributo(e, 'durationUnit')),
      distancia: aMetros(numero(atributo(e, 'totalDistance')), atributo(e, 'totalDistanceUnit')),
      kcal: aKcal(numero(atributo(e, 'totalEnergyBurned')), atributo(e, 'totalEnergyBurnedUnit')),
      dispositivo: nombreDelReloj || (/watch/i.test(fuente) ? 'Apple Watch' : fuente) || null,
      estadisticas: {}, ruta_ref: null,
    };
  }

  function cierraEntreno() {
    if (actual && !actual.ignorar) { entrenos.push(actual); cuenta.entrenos += 1; }
    actual = null;
  }

  function estadistica(e) {
    if (!actual || actual.ignorar) return;
    const tipo = atributo(e, 'type');
    if (!tipo) return;
    actual.estadisticas[tipo.replace(Q, '')] = {
      media: numero(atributo(e, 'average')), min: numero(atributo(e, 'minimum')), max: numero(atributo(e, 'maximum')), suma: numero(atributo(e, 'sum')), unidad: atributo(e, 'unit'),
    };
  }

  function etiqueta(e) {
    if (e.startsWith('<Record ')) registro(e);
    else if (e.startsWith('<Workout ')) { abreEntreno(e); if (e.endsWith('/>')) cierraEntreno(); }
    else if (e.startsWith('<WorkoutStatistics ')) estadistica(e);
    else if (e.startsWith('<FileReference ')) { if (actual && !actual.ignorar) actual.ruta_ref = atributo(e, 'path'); }
    else if (e === '</Workout>') cierraEntreno();
    else if (e.startsWith('<Me ')) {
      perfil.fecha_nacimiento = atributo(e, 'HKCharacteristicTypeIdentifierDateOfBirth');
      const sexo = atributo(e, 'HKCharacteristicTypeIdentifierBiologicalSex') ?? '';
      perfil.genero = /Female/.test(sexo) ? 'f' : (/Male/.test(sexo) ? 'm' : null);
    }
  }

  return {
    /** Recibe el siguiente trozo de texto del export. */
    alimenta(texto) {
      const buffer = resto + texto;
      let pos = 0;
      for (;;) {
        const i = buffer.indexOf('<', pos);
        if (i === -1) { resto = ''; return; }
        const j = buffer.indexOf('>', i);
        if (j === -1) { resto = buffer.slice(i); return; }
        etiqueta(buffer.slice(i, j + 1));
        pos = j + 1;
      }
    },

    /** Cierra la lectura y arma lo que se encontró. */
    termina() {
      // Los latidos, en orden de hora (casi siempre ya lo están).
      const n = fc.t.n;
      const tiempos = fc.t.a;
      const valores = fc.v.a;
      let ordenado = true;
      for (let i = 1; i < n; i += 1) if (tiempos[i] < tiempos[i - 1]) { ordenado = false; break; }
      let idx = null;
      if (!ordenado) {
        idx = Array.from({ length: n }, (_, i) => i).sort((a, b) => tiempos[a] - tiempos[b]);
      }
      const tAt = (k) => (idx ? tiempos[idx[k]] : tiempos[k]);
      const vAt = (k) => (idx ? valores[idx[k]] : valores[k]);
      // El primer latido a la hora `ms` o después (búsqueda binaria).
      const primero = (ms) => {
        let a = 0; let b = n;
        while (a < b) { const m = (a + b) >> 1; if (tAt(m) < ms) a = m + 1; else b = m; }
        return a;
      };

      const salida = entrenos.map((w) => {
        const inicio = w.ini.ms;
        const muestras = [];
        for (let k = primero(inicio); k < n && tAt(k) <= w.fin.ms; k += 1) muestras.push({ t: (tAt(k) - inicio) / 1000, fc: vAt(k) });
        const hr = w.estadisticas.HeartRate;
        const distanciaStat = Object.entries(w.estadisticas).find(([k]) => /^Distance(WalkingRunning|Cycling|Swimming)$/.test(k))?.[1];
        const kcalStat = w.estadisticas.ActiveEnergyBurned;
        const potencia = w.estadisticas.RunningPower ?? w.estadisticas.CyclingPower;
        const duracion = Math.round((w.fin.ms - inicio) / 1000);
        return {
          formato: 'apple_salud', deporte: deporteDeApple(w.tipo), deporte_original: w.tipo ?? null, titulo: null, dispositivo: w.dispositivo,
          inicio, fin: w.fin.ms, desfase_min: w.ini.desfase, duracion_s: duracion,
          movimiento_s: w.duracion !== null && w.duracion > 0 && w.duracion <= duracion ? Math.round(w.duracion) : null,
          distancia_m: (w.distancia ?? (distanciaStat ? aMetros(distanciaStat.suma, distanciaStat.unidad) : null)) > 0 ? Math.round(w.distancia ?? aMetros(distanciaStat.suma, distanciaStat.unidad)) : null,
          kcal_activas: (w.kcal ?? (kcalStat ? aKcal(kcalStat.suma, kcalStat.unidad) : null)) > 0 ? Math.round(w.kcal ?? aKcal(kcalStat.suma, kcalStat.unidad)) : null,
          resumen: {
            fc_media: hr?.media ? Math.round(hr.media) : null, fc_max: hr?.max ? Math.round(hr.max) : null, fc_min: hr?.min ? Math.round(hr.min) : null,
            potencia_media: potencia?.media ? Math.round(potencia.media) : null,
          },
          ruta_ref: w.ruta_ref, muestras,
        };
      }).sort((a, b) => a.inicio - b.inicio);

      const recuperacion = [];
      [...dias.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).forEach(([dia, d]) => {
        const maxDe = (mapa) => (mapa.size ? Math.max(...mapa.values()) : null);
        const asleep = d.sueno.filter((s) => s[2] !== 'despierto').map((s) => [s[0], s[1]]);
        const sueno = uniones(asleep);
        const fila = {
          dia,
          fc_reposo: d.reposo.length ? Math.round(mediana(d.reposo)) : null,
          hrv_ms: d.hrv.length ? Math.round(mediana(d.hrv) * 10) / 10 : null,
          hrv_tipo: d.hrv.length ? 'sdnn' : null,
          sueno_s: sueno > 0 ? Math.round(sueno / 1000) : null,
          sueno_profundo_s: d.sueno.some((s) => s[2] === 'profundo') ? Math.round(uniones(d.sueno.filter((s) => s[2] === 'profundo').map((s) => [s[0], s[1]])) / 1000) : null,
          sueno_rem_s: d.sueno.some((s) => s[2] === 'rem') ? Math.round(uniones(d.sueno.filter((s) => s[2] === 'rem').map((s) => [s[0], s[1]])) / 1000) : null,
          sueno_despierto_s: d.sueno.some((s) => s[2] === 'despierto') ? Math.round(uniones(d.sueno.filter((s) => s[2] === 'despierto').map((s) => [s[0], s[1]])) / 1000) : null,
          pasos: maxDe(d.pasos) !== null ? Math.round(maxDe(d.pasos)) : null,
          kcal_activas: maxDe(d.kcalA) !== null ? Math.round(maxDe(d.kcalA)) : null,
          kcal_basales: maxDe(d.kcalB) !== null ? Math.round(maxDe(d.kcalB)) : null,
          vo2max: d.vo2 !== null ? Math.round(d.vo2 * 10) / 10 : null,
          spo2: d.spo2.length ? Math.round((d.spo2.reduce((s, x) => s + x, 0) / d.spo2.length) * 10) / 10 : null,
          frec_respiratoria: d.resp.length ? Math.round((d.resp.reduce((s, x) => s + x, 0) / d.resp.length) * 10) / 10 : null,
          peso_kg: d.peso !== null ? Math.round(d.peso * 10) / 10 : null,
          origen: 'apple_salud',
        };
        if (Object.entries(fila).some(([k, v]) => !['dia', 'origen', 'hrv_tipo'].includes(k) && v !== null)) recuperacion.push(fila);
      });
      return { entrenos: salida, recuperacion, perfil, resumen: { registros: cuenta.registros, entrenos: salida.length, latidos: n } };
    },
  };
}

/** Atajo para un export que ya está completo en un texto (las pruebas y los archivos chicos). */
export function leeAppleSalud(texto, opciones) {
  const lector = creaLectorDeAppleSalud(opciones);
  const trozo = 1 << 20;
  for (let i = 0; i < texto.length; i += trozo) lector.alimenta(texto.slice(i, i + trozo));
  return lector.termina();
}

/**
 * Une la ruta de cada entreno (los .gpx de `workout-routes/`) a sus muestras. `rutas`: `Map { nombre-del-archivo → muestras del GPX }`. Se casa por el
 * nombre del archivo (la última parte de `ruta_ref`) y, si no, por la hora de inicio más cercana (a menos de 2 minutos).
 */
export function unePorRutas(entrenos, rutas) {
  const lista = [...rutas.entries()];
  entrenos.forEach((e) => {
    if (!e.ruta_ref) return;
    const nombre = e.ruta_ref.split('/').pop();
    const ruta = rutas.get(nombre) ?? lista.find(([k]) => k.endsWith(nombre))?.[1] ?? null;
    if (!ruta || !ruta.muestras?.length) return;
    // La ruta trae su propia hora de inicio: se pasa a segundos desde el inicio del entreno.
    const desfase = (ruta.inicio - e.inicio) / 1000;
    const rutaMuestras = ruta.muestras.map((m) => ({ ...m, t: m.t + desfase })).filter((m) => m.t >= -5 && m.t <= e.duracion_s + 5);
    e.muestras = [...e.muestras, ...rutaMuestras].sort((a, b) => a.t - b.t);
  });
  return entrenos;
}
