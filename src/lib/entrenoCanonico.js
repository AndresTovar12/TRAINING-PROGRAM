import { etiquetaDeTramo, expande } from './formatos.js';

/**
 * El entreno en el idioma que hablan TODOS los relojes: el contrato para el Apple Watch, Garmin, COROS… cuando la app sea descargable.
 *
 * POR QUÉ EXISTE. Andrés, 9 oct 2026: «dejar todo listo para cuando ya la app sea descargable en App Store y en el Apple Watch… Google Play, lo
 * que sea». Todas las plataformas guían un entreno con la MISMA estructura (ver `reference_relojes_inteligentes` en la memoria del proyecto): una
 * lista de pasos, cada uno con cómo termina (tiempo, distancia, calorías, un botón…), una meta opcional (ritmo, zona, potencia…), cuántas veces se
 * repite y el deporte. Los pasos de `lib/entreno.js` ya la traen; esto los limpia de todo lo que es de pantalla (textos, notas, encabezados), los
 * escribe con palabras que no dependen de la app y expande los relojes de formato (AMRAP, EMOM, Tabata…) en pasos con tiempo, que es lo único que
 * un reloj entiende. No manda nada a ningún lado: es el dato que un adaptador de Apple WorkoutKit (en Swift) o de un archivo FIT de Garmin leería.
 * El contrato completo, con los mapeos a cada plataforma, está en `docs/entreno-y-reloj.md`.
 *
 * LA FORMA. `{ v, nombre, deporte, pasos, grupos }`:
 *   pasos   la lista PLANA, en el orden en que se hacen. Cada uno:
 *             { clave, tipo, nombre, termina, meta, opcional, porLado?, serie?, vuelta?, vueltas?, lapso?, lapsos?, desde? }
 *             tipo     'trabajo' · 'recuperacion' (un descanso) · 'calentamiento' · 'enfriamiento' (reservados) · 'nota' (solo texto)
 *             termina  { por: 'reps' | 'tiempo' | 'distancia' | 'calorias' | 'boton', valor? , min?, max? }; tiempo en SEGUNDOS, distancia en METROS
 *             meta     null, o { tipo, min?, max?, texto? }: 'porcentaje1RM' · 'peso' (kg) · 'intensidad' (%) · 'rpe' · 'rir' ·
 *                      'ritmoPorKm' (seg/km) · 'zonaFC' · 'potencia' (W) · 'ritmoNadoPor100m' (seg/100 m) · 'texto'
 *             porLado  `true` si se hace con cada lado (cada pierna, cada brazo): un adaptador puede duplicar el paso o decírselo al atleta
 *             clave    la del paso en la app (`lib/entreno.js`): lo que un reloj devuelve («terminé el paso 12») se traduce a eso para marcarlo
 *             desde    en los pasos que salen de un reloj de formato (un tramo de un Tabata), la clave del paso de la app del que salieron
 *   grupos  pistas para PLEGAR repeticiones (Apple `IntervalBlock`, los pasos de repetición de un FIT): un Set que se repite `repeticiones`
 *           veces ocupa los pasos `desde`…`hasta` (índices de `pasos`, ambos incluidos; ya cuentan los descansos entre vueltas). Si hay vueltas
 *           opcionales («5-6»), `opcionales` las cuenta y van al final del grupo. El descanso de DESPUÉS del Set queda fuera. Un adaptador que no
 *           pliega (o que se pasa de pasos: Garmin los limita; verificar el tope) usa la lista plana y listo.
 */

const VERSION = 1;

const TIPO_DE_PASO = { trabajo: 'trabajo', recuperar: 'recuperacion', calentar: 'calentamiento', enfriar: 'enfriamiento' };
const TIPO_DE_META = {
  pct: 'porcentaje1RM', kg: 'peso', int: 'intensidad', rpe: 'rpe', rir: 'rir', ritmo: 'ritmoPorKm', zona: 'zonaFC', w: 'potencia', nado: 'ritmoNadoPor100m',
};

// Cómo termina, solo con números (lo que escribió el coach tal cual, «8-10 reps», es de pantalla y se queda en la app).
function terminaCanonica(t) {
  if (!t || t.por === 'boton') return { por: 'boton' };
  const salida = { por: t.por };
  if (t.valor !== null && t.valor !== undefined) salida.valor = t.valor;
  else { salida.min = t.min; salida.max = t.max; }
  if (t.bloques) { salida.bloques = t.bloques; if (t.entreBloques) salida.entreBloques = t.entreBloques; }
  return salida;
}

function metaCanonica(m) {
  if (!m) return null;
  if (m.tipo === 'texto' || m.min === undefined) return { tipo: 'texto', texto: m.texto };
  return { tipo: TIPO_DE_META[m.tipo] ?? 'texto', min: m.min, max: m.max, ...(TIPO_DE_META[m.tipo] ? null : { texto: m.texto }) };
}

// Un paso de la app → uno o varios canónicos (un reloj de formato se vuelve sus tramos).
function pasosCanonicos(paso) {
  const comun = { opcional: !!paso.opcional };
  if (paso.tipo === 'descanso') {
    return [{ clave: paso.clave, tipo: 'recuperacion', nombre: 'Descanso', termina: terminaCanonica(paso.termina), meta: null, ...comun }];
  }
  if (paso.tipo === 'nota') {
    return [{ clave: paso.clave, tipo: 'nota', nombre: paso.nombre, termina: { por: 'boton' }, meta: null, ...comun }];
  }
  if (paso.tipo === 'reloj') {
    const tramos = expande(paso.formato, paso.miembros.length);
    if (!tramos.length) return [{ clave: paso.clave, tipo: 'trabajo', nombre: paso.nombre, termina: { por: 'boton' }, meta: null, ...comun }];
    return tramos.map((t, k) => ({
      clave: `${paso.clave}#${k}`,
      desde: paso.clave,
      tipo: t.tipo === 'descanso' ? 'recuperacion' : 'trabajo',
      nombre: [etiquetaDeTramo(t), t.ejercicio !== null ? paso.miembros[t.ejercicio]?.nombre : null].filter(Boolean).join(' · '),
      termina: t.seg === null ? { por: 'boton' } : { por: 'tiempo', valor: t.seg },
      meta: null,
      ...comun,
    }));
  }
  return [{
    clave: paso.clave,
    tipo: TIPO_DE_PASO[paso.intensidad] ?? 'trabajo',
    nombre: paso.nombre,
    termina: terminaCanonica(paso.termina),
    meta: metaCanonica(paso.meta),
    ...comun,
    ...(paso.porLado ? { porLado: true } : null),
    serie: paso.serie,
    vuelta: paso.vuelta,
    vueltas: paso.vueltas,
    ...(paso.lapsos > 1 ? { lapso: paso.lapso, lapsos: paso.lapsos } : null),
  }];
}

/** El plan de pasos de una sesión (`pasosDeLaSesion`) como un entreno que cualquier reloj puede seguir: ver «LA FORMA». */
export function aEntrenoCanonico(plan, { nombre = '' } = {}) {
  const pasos = [];
  // Para cada paso de la app: dónde empiezan y terminan sus pasos canónicos (un reloj de formato ocupa varios).
  const lugar = plan.pasos.map((p) => {
    const desde = pasos.length;
    pasos.push(...pasosCanonicos(p));
    return { paso: p, desde, hasta: pasos.length - 1 };
  });
  const grupos = [];
  for (let s = 1; s <= plan.series; s += 1) {
    const deLaSerie = lugar.filter((l) => l.paso.serie === s);
    const primero = deLaSerie.find((l) => l.paso.tipo === 'ejercicio');
    if (!primero || primero.paso.vueltasMin <= 1) continue;
    // El descanso de DESPUÉS del Set (`entre: 'sets'`) no es de ningún grupo: viene detrás.
    const ultimo = deLaSerie.filter((l) => l.paso.tipo === 'ejercicio').pop();
    grupos.push({
      serie: s, repeticiones: primero.paso.vueltasMin, opcionales: primero.paso.vueltas - primero.paso.vueltasMin, desde: primero.desde, hasta: ultimo.hasta,
    });
  }
  return { v: VERSION, nombre, deporte: plan.deporte, pasos, grupos };
}
