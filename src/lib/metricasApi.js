import { supabase } from '@/lib/supabase';
import { estimaUmbrales } from '@/lib/metricas/calculos';
import { diaLocal, pulsoEnReposoMediano, pulsoMaximoVisto, sumaDias } from '@/lib/metricas/forma';
import { construyeActividad, recalculaConUmbrales, separaRepetidos } from '@/lib/metricas/construye';

/* El acceso a la base de las MÉTRICAS del entrenamiento: entrenos (`actividades`), sus series, la recuperación de cada día y los umbrales del atleta.
   Los permisos los pone la base (igual que `plans`): el atleta ve y guarda lo suyo; el coach (o quien lo atiende) ve y guarda lo de sus atletas.
   Ver `docs/metricas-del-entrenamiento.md`. */

// Lo que se pide para la LISTA de entrenos: sin las vueltas, las métricas extra ni las series, que pesan y solo hacen falta al abrir uno.
const COLUMNAS_DE_LA_LISTA = 'id,atleta_id,origen,formato,dispositivo,deporte,titulo,inicio,fin,desfase_min,duracion_s,movimiento_s,distancia_m,desnivel_pos_m,fc_media,fc_max,fc_min,kcal_activas,kcal_totales,zonas_s,umbrales,carga,carga_metodo';
const PAGINA = 1000;

/** Los entrenos de un atleta desde `desdeDia` (`AAAA-MM-DD`), del más nuevo al más viejo. Pide por páginas: la base devuelve hasta 1000 filas por vez. */
export async function listActividades(atletaId, { desdeDia = null, tope = 5000 } = {}) {
  const filas = [];
  for (let desde = 0; desde < tope; desde += PAGINA) {
    let q = supabase.from('actividades').select(COLUMNAS_DE_LA_LISTA).eq('atleta_id', atletaId).order('inicio', { ascending: false }).range(desde, desde + PAGINA - 1);
    if (desdeDia) q = q.gte('inicio', `${desdeDia}T00:00:00Z`);
    const { data, error } = await q;
    if (error) throw error;
    filas.push(...(data ?? []));
    if ((data ?? []).length < PAGINA) break;
  }
  return filas;
}

/** Un entreno completo (con sus vueltas y métricas extra), o `null`. */
export async function getActividad(id) {
  const { data, error } = await supabase.from('actividades').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

/** Las series en el tiempo de un entreno (pulso, velocidad, altura, ruta), o `null` si no se guardaron. */
export async function getSeries(actividadId) {
  const { data, error } = await supabase.from('actividad_series').select('series').eq('actividad_id', actividadId).maybeSingle();
  if (error) throw error;
  return data?.series ?? null;
}

/** Borra un entreno (y sus series: caen en cascada). */
export async function borraActividad(id) {
  const { error } = await supabase.from('actividades').delete().eq('id', id);
  if (error) throw error;
}

/** La recuperación de cada día (pulso en reposo, HRV, sueño…) desde `desdeDia`, del más viejo al más nuevo. */
export async function listRecuperacion(atletaId, { desdeDia = null } = {}) {
  const filas = [];
  for (let desde = 0; desde < 5000; desde += PAGINA) {
    let q = supabase.from('recuperacion_diaria').select('*').eq('atleta_id', atletaId).order('dia', { ascending: true }).range(desde, desde + PAGINA - 1);
    if (desdeDia) q = q.gte('dia', desdeDia);
    const { data, error } = await q;
    if (error) throw error;
    filas.push(...(data ?? []));
    if ((data ?? []).length < PAGINA) break;
  }
  return filas;
}

/** Los umbrales que escribió el atleta o su coach (pulso máximo, de reposo y de umbral), o `null` si nadie los escribió. */
export async function getUmbrales(atletaId) {
  const { data, error } = await supabase.from('umbrales_atleta').select('*').eq('atleta_id', atletaId).maybeSingle();
  if (error) throw error;
  return data;
}

/** Guarda los umbrales escritos. Un campo vacío (`null`) vuelve a estimarse solo. */
export async function guardaUmbrales(atletaId, { fc_max = null, fc_reposo = null, fc_umbral = null }, quien) {
  const { error } = await supabase.from('umbrales_atleta').upsert({
    atleta_id: atletaId, fc_max, fc_reposo, fc_umbral, actualizado_por: quien ?? null, actualizado_en: new Date().toISOString(),
  }, { onConflict: 'atleta_id' });
  if (error) throw error;
}

/** La fecha de nacimiento y el género del atleta tal como los tiene su perfil (`null` lo que falte): sirven para estimar el pulso máximo y la curva de carga. */
async function perfilDeMetricas(atletaId) {
  const { data } = await supabase.from('profiles').select('fecha_nacimiento,genero').eq('id', atletaId).maybeSingle();
  return { fechaNacimiento: data?.fecha_nacimiento ?? null, genero: data?.genero ? (/^f/i.test(data.genero) ? 'f' : 'm') : null };
}

/**
 * Con qué umbrales se calculan las zonas y la carga de este atleta ahora mismo: lo que escribieron manda; lo que falta se estima de su edad, de su pulso más
 * alto visto y de su pulso en reposo. `{ umbrales, genero, escritos, delReloj }`; `umbrales.metodo` dice de dónde sale cada uno.
 *
 * La edad y el género salen del perfil; si el perfil no los tiene, de lo que se guardó junto a los umbrales, y si tampoco, de lo que trae el archivo que se
 * está importando (`extra`). `delReloj` es lo que sabe el archivo y no está guardado en ningún lado: `guardaImportacion` lo guarda, para que las zonas salgan
 * igual al importar que al mirarlas después.
 */
export async function umbralesDe(atletaId, { extra = {} } = {}) {
  const hoy = new Date();
  const hoyDia = hoy.toISOString().slice(0, 10);
  const [escritos, perfil, recientes, reposos] = await Promise.all([
    getUmbrales(atletaId),
    perfilDeMetricas(atletaId),
    listActividades(atletaId, { desdeDia: sumaDias(hoyDia, -180), tope: 1000 }),
    listRecuperacion(atletaId, { desdeDia: sumaDias(hoyDia, -45) }),
  ]);
  const visto = pulsoMaximoVisto([...recientes, ...(extra.actividades ?? [])], { hoy: hoyDia });
  const reposo = pulsoEnReposoMediano([...reposos, ...(extra.recuperacion ?? [])], { hoy: hoyDia });
  const fechaNacimiento = perfil.fechaNacimiento ?? escritos?.fecha_nacimiento ?? extra.fecha_nacimiento ?? null;
  const genero = perfil.genero ?? escritos?.genero ?? extra.genero ?? 'm';
  const delReloj = {};
  if (!perfil.fechaNacimiento && !escritos?.fecha_nacimiento && extra.fecha_nacimiento) delReloj.fecha_nacimiento = extra.fecha_nacimiento;
  if (!perfil.genero && !escritos?.genero && (extra.genero === 'm' || extra.genero === 'f')) delReloj.genero = extra.genero;
  const umbrales = estimaUmbrales({ configurados: escritos ?? {}, fechaNacimiento, observadoFcMax: visto, reposoMediano: reposo, hoy });
  return { umbrales, genero, escritos, delReloj };
}

/* ------------------------------------------------------------------ */
/* Guardar una importación                                             */
/* ------------------------------------------------------------------ */

const enLotes = (lista, n) => Array.from({ length: Math.ceil(lista.length / n) }, (_, i) => lista.slice(i * n, i * n + n));
const nuevoId = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`);

/**
 * Guarda lo que leyó `leeArchivos`: los entrenos nuevos (con sus series, solo los de los últimos `diasConSeries` días) y la recuperación diaria.
 * Los que ya estaban (el mismo entreno por otro camino) no se repiten. `alAvance({ hechos, total, fase })` para la barra.
 * Devuelve `{ nuevos, repetidos, dias, umbrales }`.
 */
export async function guardaImportacion({ atletaId, subidoPor, resultado, desfaseMin = 0, diasConSeries = 365, alAvance = () => {} }) {
  const hoy = new Date();
  const { umbrales, genero, delReloj } = await umbralesDe(atletaId, {
    extra: {
      actividades: resultado.entrenos.map((e) => ({ inicio: new Date(e.inicio).toISOString(), desfase_min: e.desfase_min ?? desfaseMin, fc_max: e.resumen?.fc_max ?? e.calculado?.fc_max ?? null })),
      recuperacion: resultado.recuperacion,
      genero: resultado.perfil?.genero ?? null,
      fecha_nacimiento: resultado.perfil?.fecha_nacimiento ?? null,
    },
  });

  // La edad y el género que trae el archivo (Apple Salud) y el perfil no tiene: se guardan junto a los umbrales para que las zonas no cambien al volver a mirarlas.
  if (Object.keys(delReloj).length) {
    const { error } = await supabase.from('umbrales_atleta').upsert({ atleta_id: atletaId, ...delReloj, actualizado_por: subidoPor ?? null, actualizado_en: new Date().toISOString() }, { onConflict: 'atleta_id' });
    if (error) throw error;
  }

  // Lo que ya había en esas fechas, para no repetirlo.
  let existentes = [];
  if (resultado.entrenos.length) {
    const ini = new Date(resultado.entrenos[0].inicio - 2 * 86400000).toISOString();
    const fin = new Date(resultado.entrenos[resultado.entrenos.length - 1].inicio + 2 * 86400000).toISOString();
    for (let desde = 0; desde < 5000; desde += PAGINA) {
      const { data, error } = await supabase.from('actividades').select('id,inicio,duracion_s').eq('atleta_id', atletaId).gte('inicio', ini).lte('inicio', fin).range(desde, desde + PAGINA - 1);
      if (error) throw error;
      existentes.push(...(data ?? []));
      if ((data ?? []).length < PAGINA) break;
    }
  }
  const { nuevos, repetidos } = separaRepetidos(resultado.entrenos, existentes);

  const limiteSeries = sumaDias(hoy.toISOString().slice(0, 10), -diasConSeries);
  const construidos = nuevos.map((p) => {
    const apple = p.formato === 'apple_salud';
    const { fila, series } = construyeActividad(p, {
      umbrales, genero, desfaseMin, origen: apple ? 'apple_salud' : 'archivo',
      conSeries: (diaLocal(p.inicio, p.desfase_min ?? desfaseMin) ?? '') >= limiteSeries,
    });
    return { fila: { ...fila, id: nuevoId(), atleta_id: atletaId, subido_por: subidoPor ?? null }, series };
  });

  const total = construidos.length + resultado.recuperacion.length;
  let hechos = 0;
  let deEntrenos = 0;
  let deDias = 0;
  // `parte` dice qué se está guardando («entrenos» o «días de recuperación») y cuántos van de esa parte: la barra suma las dos, el texto las cuenta por separado.
  const avanza = (n, parte) => {
    hechos += n;
    if (parte === 'entrenos') deEntrenos += n; else deDias += n;
    alAvance({ hechos, total, fase: 'guardando', parte, hechosParte: parte === 'entrenos' ? deEntrenos : deDias, totalParte: parte === 'entrenos' ? construidos.length : resultado.recuperacion.length });
  };
  alAvance({ hechos: 0, total, fase: 'guardando', parte: construidos.length ? 'entrenos' : 'días de recuperación', hechosParte: 0, totalParte: construidos.length || resultado.recuperacion.length });

  for (const lote of enLotes(construidos, 20)) {
    const { error } = await supabase.from('actividades').insert(lote.map((c) => c.fila));
    if (error) {
      // Una repetida que la base conoce y yo no (otra pestaña guardó lo mismo): se intenta una por una y se salta la que ya está.
      if (error.code !== '23505') throw error;
      for (const c of lote) {
        const { error: e2 } = await supabase.from('actividades').insert(c.fila);
        if (e2 && e2.code !== '23505') throw e2;
        if (e2) c.series = null;
      }
    }
    const conSeries = lote.filter((c) => c.series).map((c) => ({ actividad_id: c.fila.id, atleta_id: atletaId, series: c.series }));
    for (const s of enLotes(conSeries, 4)) {
      const { error: e3 } = await supabase.from('actividad_series').insert(s);
      if (e3) throw e3;
    }
    avanza(lote.length, 'entrenos');
  }

  for (const lote of enLotes(resultado.recuperacion, 200)) {
    const { error } = await supabase.from('recuperacion_diaria').upsert(lote.map((r) => ({ ...r, atleta_id: atletaId, actualizada_en: new Date().toISOString() })), { onConflict: 'atleta_id,dia' });
    if (error) throw error;
    avanza(lote.length, 'días de recuperación');
  }
  return { nuevos: construidos.length, repetidos: repetidos.length, dias: resultado.recuperacion.length, umbrales };
}

/**
 * Vuelve a contar las zonas y la carga de TODOS los entrenos de un atleta con sus umbrales de ahora (se llama al cambiar los umbrales). Usa las series
 * guardadas: un entreno sin series (de una importación grande, viejo) conserva lo que tenía. Devuelve cuántos cambió.
 */
export async function recalculaTodo(atletaId, { alAvance = () => {} } = {}) {
  const { umbrales, genero } = await umbralesDe(atletaId);
  const filas = await listActividades(atletaId, { tope: 5000 });
  let cambiados = 0;
  let hechos = 0;
  for (const lote of enLotes(filas, 8)) {
    const { data, error } = await supabase.from('actividad_series').select('actividad_id,series').in('actividad_id', lote.map((f) => f.id));
    if (error) throw error;
    const porId = new Map((data ?? []).map((s) => [s.actividad_id, s.series]));
    await Promise.all(lote.map(async (fila) => {
      const nuevo = recalculaConUmbrales(fila, porId.get(fila.id), umbrales, genero);
      if (!nuevo) return;
      const { error: e2 } = await supabase.from('actividades').update(nuevo).eq('id', fila.id);
      if (e2) throw e2;
      cambiados += 1;
    }));
    hechos += lote.length;
    alAvance({ hechos, total: filas.length, fase: 'recalculando' });
  }
  return cambiados;
}
