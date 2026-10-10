/* FUERZA SIN APARATO: lo que se puede saber del trabajo de fuerza de un atleta solo con lo que anotó en el entreno guiado de la app, sin reloj de pulsera.

   Andrés (10 oct 2026): «hay métricas del entrenamiento que valga la pena agregar de la app descargable sin el Apple Watch» → los kilos totales de la semana, el
   máximo estimado de cada levantamiento, los récords y cuántas series del plan se cumplieron. Todo sale de las series de `filasPorSerie` (kilos, reps y de dónde
   salen: lo que el atleta escribió o lo que dejó del plan).

   Los kilos van siempre en KILOS (como se guardan); quien dibuja los convierte a la unidad del atleta.

   Todo es puro y no importa nada de la app (ni `@/`). */
import { diaLocal, lunesDe, sumaDias } from './forma.js';
import { filasPorSerie } from './porSerie.js';

/** Un máximo estimado a partir de una serie: la fórmula de Epley (kilos × (1 + reps / 30)). Con una rep es el propio peso; de 13 reps para arriba no es confiable. */
export function maximoEstimado(kg, reps) {
  if (!(kg > 0) || !(reps >= 1) || reps > 12) return null;
  return reps === 1 ? kg : kg * (1 + reps / 30);
}

const quitaAcentos = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const repsNumero = (r) => {
  const n = parseFloat(String(r ?? '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
};
const redondea = (v, d = 1) => Math.round(v * 10 ** d) / 10 ** d;

/**
 * El análisis completo de fuerza a partir de las sesiones guiadas (`sesionesGuiadas`).
 *   hoy        `AAAA-MM-DD` de quien mira
 *   desfaseMin cuántos minutos de diferencia con UTC tiene la hora de quien mira (para saber en qué DÍA cayó cada sesión); por defecto el del equipo
 *
 * Devuelve `{ hay, semana, semanas, maximos, records }`:
 *   semana    esta semana (de lunes a hoy): `{ lunes, kilos, series, hechas, saltadas, sesiones }` y `anterior`: la semana pasada HASTA el mismo día de la semana,
 *             para comparar a la misma altura; `cambio` es el por ciento de diferencia en kilos (o `null` si no hay con qué comparar)
 *   semanas   las últimas 8 semanas (`[{ lunes, kilos, series }]`), de la más vieja a la más nueva, para las barras
 *   maximos   por levantamiento (nombre sin distinguir mayúsculas ni acentos): `{ nombre, e1rm, kg, reps, dia, fuente, record }`, de más a menos reciente
 *   records   los máximos que se estrenaron en los últimos 30 días: la mejor marca de ese levantamiento es de entonces y superó a la anterior
 * `hay` es falso si el atleta no tiene ninguna serie con kilos.
 */
export function analisisDeFuerza(sesiones, { hoy, desfaseMin } = {}) {
  const series = []; // cada serie hecha, con su día
  const sesionesPorDia = new Map();
  (sesiones ?? []).forEach((s) => {
    const dia = diaLocal(s.inicio, desfaseMin ?? -new Date(s.inicio).getTimezoneOffset());
    if (!dia) return;
    const { filas } = filasPorSerie(s);
    let hechas = 0;
    let saltadas = 0;
    filas.forEach((f) => {
      if (f.tipo === 'saltada') { saltadas += 1; return; }
      if (f.tipo !== 'serie') return;
      hechas += 1;
      series.push({ dia, nombre: f.nombre, kg: f.kg > 0 ? f.kg : null, reps: repsNumero(f.reps), fuente: f.fuente });
    });
    if (hechas + saltadas > 0) sesionesPorDia.set(`${s.id}`, { dia, hechas, saltadas });
  });
  if (!series.some((x) => x.kg !== null)) return { hay: false, semana: null, semanas: [], maximos: [], records: [] };

  const lunesHoy = lunesDe(hoy);
  const kilosDe = (x) => (x.kg !== null && x.reps !== null ? x.kg * x.reps : 0);
  const entre = (desde, hasta) => series.filter((x) => x.dia >= desde && x.dia <= hasta);
  const totales = (lista) => ({ kilos: Math.round(lista.reduce((s, x) => s + kilosDe(x), 0)), series: lista.length });

  // Esta semana y la pasada hasta el mismo día.
  const lunesPasado = sumaDias(lunesHoy, -7);
  const actual = entre(lunesHoy, hoy);
  const anterior = entre(lunesPasado, sumaDias(hoy, -7));
  const sesDe = (desde, hasta) => [...sesionesPorDia.values()].filter((s) => s.dia >= desde && s.dia <= hasta);
  const dActual = sesDe(lunesHoy, hoy);
  const ta = totales(actual);
  const tp = totales(anterior);
  const semana = {
    lunes: lunesHoy, ...ta,
    hechas: dActual.reduce((s, x) => s + x.hechas, 0), saltadas: dActual.reduce((s, x) => s + x.saltadas, 0), sesiones: dActual.length,
    anterior: { lunes: lunesPasado, ...tp },
    cambio: tp.kilos > 0 ? Math.round(((ta.kilos - tp.kilos) / tp.kilos) * 100) : null,
  };

  const semanas = [];
  for (let i = 7; i >= 0; i -= 1) {
    const lunes = sumaDias(lunesHoy, -7 * i);
    semanas.push({ lunes, ...totales(entre(lunes, sumaDias(lunes, 6))) });
  }

  // El máximo estimado de cada levantamiento, y si el último es un récord (superó a todo lo anterior).
  const porNombre = new Map();
  series.forEach((x) => {
    const e1rm = maximoEstimado(x.kg, x.reps);
    if (e1rm === null) return;
    const k = quitaAcentos(x.nombre);
    if (!porNombre.has(k)) porNombre.set(k, []);
    porNombre.get(k).push({ ...x, e1rm });
  });
  const maximos = [];
  porNombre.forEach((lista) => {
    const mejor = lista.reduce((m, x) => (x.e1rm > m.e1rm || (x.e1rm === m.e1rm && x.dia > m.dia) ? x : m), lista[0]);
    const antes = lista.filter((x) => x.dia < mejor.dia);
    const previo = antes.length ? Math.max(...antes.map((x) => x.e1rm)) : null;
    const reciente = lista.reduce((m, x) => (x.dia > m ? x.dia : m), '');
    maximos.push({
      nombre: mejor.nombre, e1rm: redondea(mejor.e1rm), kg: mejor.kg, reps: mejor.reps, dia: mejor.dia, fuente: mejor.fuente,
      previo: previo === null ? null : redondea(previo), record: previo !== null && mejor.e1rm > previo, ultimoDia: reciente,
    });
  });
  maximos.sort((a, b) => (a.ultimoDia < b.ultimoDia ? 1 : a.ultimoDia > b.ultimoDia ? -1 : b.e1rm - a.e1rm));
  const limite = sumaDias(hoy, -30);
  const records = maximos.filter((m) => m.record && m.dia >= limite).sort((a, b) => (a.dia < b.dia ? 1 : -1));
  return { hay: true, semana, semanas, maximos, records };
}
