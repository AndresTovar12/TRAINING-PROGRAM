import {
  cursorAlDia, defaultCursor, isValidCursor, resolveCursor, sessionForToday, sessionIdFor,
  ejerciciosDelBloque, esDescanso, diasDeEstaSemana,
} from '@/lib/training-utils';
import { bloquesHechos, minutosDeTag, sesionesDelTitulo, textoDeSesiones } from '@/lib/sesiones';
import { esDeSalud } from '@/lib/palabras';
import { LT, oficioCorto } from '@/lib/theme';

/* PROGRAMAS de un atleta: el de su coach principal y el de cada profesional de
   su equipo. Todo puro (sin leer la base ni el reloj por su cuenta): la portada,
   la pestaña «Plan» y las pruebas usan las mismas funciones.

   Un «programa» es lo que arma `PlanContext`: { id, clave, esPrincipal,
   profesional, phases, kind, hasPlan, … }. `clave` es el id del profesional
   (null = el coach principal) y da el sufijo de los registros del atleta:
   `wr:sessions@<clave>` y `wr:cursor@<clave>`. El principal sigue en
   `wr:sessions` y `wr:cursor`, sin migrar nada.

   LO PEGADO (`lib/pegadas.js`) también es un programa de esta lista (`sobre`):
   las sesiones de un profesional repartidas en los días del programa del coach.
   No tiene puntero propio —sigue al del coach (`sigueA`)— y lo que anota el
   atleta se guarda con llaves estables, así que se lee y se escribe a través de
   `registrosDe` y `escribeRegistro` y no directo de la tienda. */

// El coach principal es azul, como siempre; los demás profesionales rotan de color.
const COLORES = [LT.blue, '#00A372', '#7C5CFF', '#E07B00'];
export const colorDePrograma = (indice) => COLORES[indice % COLORES.length];

/** `wr:sessions` → `wr:sessions@<profesional>` para un programa de equipo. */
export const claveDeRegistro = (base, programa) => (programa?.clave ? `${base}@${programa.clave}` : base);

/**
 * Lo que el atleta lleva anotado de un programa, con las llaves por posición
 * que usa toda la app (`f6-w3-d2`). En lo pegado se traduce desde las llaves
 * estables con que se guarda.
 */
export function registrosDe(programa, store) {
  const guardado = store?.[claveDeRegistro('wr:sessions', programa)] ?? {};
  return programa?.vistaDeRegistros ? programa.vistaDeRegistros(guardado) : guardado;
}

/**
 * Escribe lo que anota el atleta de una sesión: `id` es la llave por posición
 * de siempre y `actualiza` el registro nuevo o una función del anterior. En lo
 * pegado se guarda con la llave estable. `setStore` es el de `useAppState`.
 */
export function escribeRegistro(setStore, programa, id, actualiza) {
  const clave = claveDeRegistro('wr:sessions', programa);
  const llave = programa?.llaveEstable ? programa.llaveEstable(id) : id;
  setStore((prev) => {
    const registros = prev?.[clave] ?? {};
    const antes = registros[llave] ?? {};
    const despues = typeof actualiza === 'function' ? actualiza(antes) : actualiza;
    return { ...prev, [clave]: { ...registros, [llave]: despues } };
  });
}

/** El puntero de un programa, puesto al día con el calendario. NO lo guarda. */
export function cursorDePrograma(programa, store, hoy = new Date()) {
  // Lo pegado va donde va el coach: misma fase y misma semana.
  if (programa?.sigueA) {
    const delCoach = cursorDePrograma(programa.sigueA, store, hoy);
    return delCoach
      ? { phaseId: delCoach.phaseId, weekNum: delCoach.weekNum, dayIdx: 0, fijadoEn: delCoach.fijadoEn }
      : null;
  }
  const guardado = store?.[claveDeRegistro('wr:cursor', programa)];
  const base = isValidCursor(programa.phases, guardado) ? guardado : defaultCursor(programa.phases);
  return cursorAlDia(programa.phases, base, hoy);
}

/** Fase y semana de calendario en que va el atleta dentro de un programa. */
function ubicacion(programa, cursor) {
  const fases = programa.phases ?? [];
  if (programa.kind !== 'weekly') {
    // Lo pegado puede tener semanas sin ningún día: no se valida el día, solo se busca la semana.
    if (programa.sigueA && cursor) {
      const phase = fases.find((f) => f.id === cursor.phaseId);
      const week = phase?.weekData?.find((w) => w.num === cursor.weekNum);
      if (phase && week) return { phase, week };
    }
    const r = resolveCursor(fases, cursor);
    if (r) return { phase: r.phase, week: r.week };
  }
  return { phase: fases[0] ?? null, week: fases[0]?.weekData?.[0] ?? null };
}

/** Lo que dura y cuántos ejercicios trae una sesión (una sola: sin sumar dobles). */
export function datosDeSesion({ day, week, dayIdx }) {
  const reales = (lista) => (lista || []).filter((e) => !e.isNote).length;
  const bloques = day?.blocks || [];
  const ejercicios = bloques.length
    ? bloques.reduce((n, b) => n + reales(ejerciciosDelBloque(week, dayIdx, b)), 0)
    : reales(day?.exercises);
  const minutos = bloques.length === 1 ? minutosDeTag(bloques[0].tag) : null;
  return { ejercicios, minutos };
}

/**
 * Las sesiones de UN día, una por una, para la lista de «Hoy»: un doble sin nombre propio
 * da una por turno (AM, PM) y todo lo demás, una sola. Cada una dice cuántos ejercicios
 * trae, cuánto dura y si va hecha; `registro` es lo que el atleta lleva anotado de ese día.
 *
 * Así la lista enseña SESIONES y no autores: el doble del coach y la del fisio quedan
 * juntos, cada uno con su etiqueta (Andrés, 2 oct 2026: «el programa es un todo»).
 */
export function partesDelDia({ day, week, dayIdx }, registro) {
  const sesiones = sesionesDelTitulo(day);
  const bloques = day?.blocks || [];
  if (sesiones.length > 1 && sesiones.length === bloques.length) {
    const hechos = bloquesHechos(registro, bloques.length);
    return sesiones.map((s, bloque) => ({
      ...s,
      bloque,
      ejercicios: (ejerciciosDelBloque(week, dayIdx, bloques[bloque]) || []).filter((e) => !e.isNote).length,
      minutos: minutosDeTag(bloques[bloque].tag),
      hecha: hechos[bloque],
    }));
  }
  return [{
    turno: null,
    nombre: textoDeSesiones(sesiones) || day?.day || '',
    bloque: null,
    ...datosDeSesion({ day, week, dayIdx }),
    hecha: !!registro?.completed,
  }];
}

/**
 * La sesión de HOY de un programa, lista para pintar en una tarjeta:
 * { …sessionForToday, hecha, titulo, ejercicios, minutos }. Si hoy no toca, null.
 */
export function sesionDeHoy(programa, store, hoy = new Date()) {
  if (!programa?.hasPlan) return null;
  const cursor = cursorDePrograma(programa, store, hoy);
  const sesion = sessionForToday(programa.phases, programa.kind, cursor, hoy);
  if (!sesion) return null;
  const registros = registrosDe(programa, store);
  return {
    ...sesion,
    hecha: !!registros[sesion.id]?.completed,
    titulo: textoDeSesiones(sesionesDelTitulo(sesion.day)) || sesion.day.day,
    ...datosDeSesion(sesion),
  };
}

/** «Beto López» → «Beto». */
export const nombreCorto = (nombreCompleto) => String(nombreCompleto ?? '').trim().split(/\s+/)[0] || '';

/** «fisio» si el oficio es de salud, si no «coach»: para etiquetas como «con fisio · Juan». */
export const rolDeProfesion = (profesion) => (esDeSalud(profesion) ? 'fisio' : 'coach');

/** De quién es el programa, en una palabra. */
export const rolDelPrograma = (programa) => rolDeProfesion(programa?.profesional?.profesion);

/** El aviso al coach principal: «Laura ahora también va con Juan, fisioterapeuta.» */
export function textoDeAviso({ atleta, profesional, oficio }) {
  const o = oficioCorto(oficio);
  return `${atleta} ahora también va con ${profesional}${o ? `, ${o.toLowerCase()}` : ''}.`;
}

/** «Beto · coach», «Juan · fisio». Sin nombre a mano, solo el rol. */
export function etiquetaDePrograma(programa) {
  const nombre = nombreCorto(programa?.profesional?.full_name);
  return nombre ? `${nombre} · ${rolDelPrograma(programa)}` : rolDelPrograma(programa);
}

const CLAVE_DE_DIA = { Mie: 'Mié', Sab: 'Sáb' };
/**
 * ¿El programa trae al menos una sesión? Uno con sus fases y semanas pero sin ningún día (el
 * profesional borró la única sesión) existe, pero no tiene nada que enseñar.
 */
export const tieneSesiones = (fases) => (Array.isArray(fases) ? fases : []).some((f) => (
  (Array.isArray(f?.weekData) ? f.weekData : []).some((w) => (
    (Array.isArray(w?.days) ? w.days : []).some((d) => !esDescanso(d))
  ))
));

/**
 * Una rutina semanal sin ninguna sesión es un programa «fantasma»: Andrés, 1 oct 2026, el fisio
 * borró su única sesión y «Editar mi programa» y «Ver el programa» seguían ahí, en blanco. Se
 * trata como si no hubiera programa. Solo la rutina: un programa de varias semanas sin días
 * todavía puede tener una estructura que vale la pena (fases, semanas con nombre).
 */
export const esProgramaFantasma = (data) => data?.kind === 'weekly' && !tieneSesiones(data?.phases);

/** El día de la semana como lo escribe la app ('Mié', no 'Mie'), de un texto o de un día del plan. */
export const normalizaDia = (dia) => CLAVE_DE_DIA[dia] ?? dia;
const claveDelDia = (day) => normalizaDia(day?.day);

/** Quién es el autor de un programa, como llave de un filtro. El coach sin cuenta a mano es `coach`. */
export const autorDe = (programa) => programa?.profesionalId ?? 'coach';

/**
 * Las personas que tienen algo en el programa del atleta, con su color: lo que
 * alimenta las pastillas «Todo · Andrés · Ana». Quien ya dio de alta no cuenta
 * (su programa queda solo para consultar). Una persona sale UNA vez aunque tenga
 * un programa aparte y sesiones pegadas.
 */
export function autoresDe(programas) {
  const vistos = new Map();
  (programas ?? []).forEach((p) => {
    // Un programa sin ninguna sesión no cuenta: quien lo armó no tiene nada puesto.
    if (!p?.conSesiones || p.altaEn) return;
    const llave = autorDe(p);
    if (vistos.has(llave)) return;
    vistos.set(llave, {
      id: llave,
      nombre: nombreCorto(p.profesional?.full_name) || rolDelPrograma(p),
      etiqueta: etiquetaDePrograma(p),
      color: p.color ?? colorDePrograma(vistos.size),
    });
  });
  return [...vistos.values()];
}

/**
 * TODAS las sesiones de HOY de un programa, una por una (no solo la primera):
 * un fisio puede pegar dos el mismo día. Cada una lista para pintar:
 * { programa, phase, week, dayIdx, day, id, hecha, titulo, ejercicios, minutos, partes },
 * donde `partes` son las sesiones de ese día una por una (ver `partesDelDia`).
 *
 * El día que el atleta eligió hoy con «Cambiar día» gana al calendario, como
 * siempre (lo resuelve `sessionForToday`), y entonces es esa y solo esa.
 */
export function sesionesDeHoy(programa, store, hoy = new Date()) {
  if (!programa?.hasPlan) return [];
  const unica = sesionDeHoy(programa, store, hoy);
  if (!unica) return [];
  const registros = registrosDe(programa, store);
  const comoEntrada = (s) => ({
    programa, phase: s.phase, week: s.week, dayIdx: s.dayIdx, day: s.day, id: s.id,
    hecha: s.hecha, titulo: s.titulo, ejercicios: s.ejercicios, minutos: s.minutos,
    partes: partesDelDia(s, registros[s.id]),
  });
  if (unica.elegido || (unica.sesionesHoy ?? 1) <= 1) return [comoEntrada(unica)];
  const { phase, week } = ubicacion(programa, cursorDePrograma(programa, store, hoy));
  const clave = claveDelDia(unica.day);
  return (week?.days ?? [])
    .map((day, idx) => ({ day, idx }))
    .filter(({ day }) => claveDelDia(day) === clave && !esDescanso(day))
    .map(({ day, idx }) => {
      const id = sessionIdFor(programa.kind, phase.id, week.num, idx, hoy);
      const sesion = { phase, week, dayIdx: idx, day };
      return comoEntrada({
        ...sesion, id,
        hecha: !!registros[id]?.completed,
        titulo: textoDeSesiones(sesionesDelTitulo(day)) || day.day,
        ...datosDeSesion(sesion),
      });
    });
}

/** Lo de hoy de TODOS los programas, el del coach principal primero. */
export function entradasDeHoy(programas, store, hoy = new Date()) {
  return (programas ?? [])
    // Quien ya te dio de alta no te manda sesiones: su programa queda solo para consultar.
    .filter((p) => p?.hasPlan && !p.altaEn)
    .flatMap((p) => sesionesDeHoy(p, store, hoy));
}

/**
 * La semana de calendario (lunes a domingo) con lo de TODOS juntos: el programa
 * del coach, lo que otros le pegaron y los programas aparte. Devuelve los 7 días
 * y en cada uno sus `fuentes`, una por sesión:
 *   { programa, phase, week, idx, day, id, hecha, descanso }
 * en el orden de los programas (el del coach principal primero).
 *
 * Cada programa se ubica por su propio puntero, salvo con `vista` —{ faseId,
 * semana }—: entonces se enseña ESA semana de la línea del coach (y lo pegado a
 * ella, que tiene las mismas semanas). Los programas aparte van en su propia
 * línea de tiempo y solo salen cuando se mira la semana en que va el atleta.
 *
 * Un descanso solo se cuenta si no hay otra sesión ese día: «Descanso» al lado
 * de la sesión del fisio sería una contradicción.
 */
export function semanaUnificada(programas, store, { vista = null, hoy = new Date() } = {}) {
  const dias = diasDeEstaSemana(hoy).map((d) => ({ ...d, fuentes: [] }));
  const principal = (programas ?? []).find((p) => p.esPrincipal) ?? null;
  const cursorCoach = principal ? cursorDePrograma(principal, store, hoy) : null;
  const esSemanaActual = !vista
    || (!!cursorCoach && cursorCoach.phaseId === vista.faseId && cursorCoach.weekNum === vista.semana)
    || principal?.kind === 'weekly';
  (programas ?? []).forEach((programa) => {
    if (!programa?.hasPlan || programa.altaEn) return;
    const delCoach = programa.esPrincipal || !!programa.sigueA;
    let phase = null;
    let week = null;
    if (vista && delCoach) {
      phase = (programa.phases ?? []).find((f) => f.id === vista.faseId) ?? null;
      week = phase?.weekData?.find((w) => w.num === vista.semana) ?? null;
    }
    if (!week && (!vista || esSemanaActual)) {
      ({ phase, week } = ubicacion(programa, cursorDePrograma(programa, store, hoy)));
    }
    if (!week) return;
    const registros = registrosDe(programa, store);
    (week.days ?? []).forEach((day, idx) => {
      const d = dias.find((x) => x.clave === claveDelDia(day));
      if (!d) return;
      const id = sessionIdFor(programa.kind, phase.id, week.num, idx, hoy);
      d.fuentes.push({
        programa, phase, week, idx, day, id,
        hecha: !!registros[id]?.completed,
        descanso: esDescanso(day),
      });
    });
  });
  dias.forEach((d) => {
    if (d.fuentes.some((f) => !f.descanso)) d.fuentes = d.fuentes.filter((f) => !f.descanso);
  });
  return dias;
}

/**
 * El resumen de la semana para la tarjeta «Tu semana» de «Hoy», con lo de todos
 * (y, con `filtro`, solo lo de una persona). Misma forma que `weekOverview`:
 * { days, next, trainingDays }, para que la tarjeta no se entere de la diferencia.
 */
export function resumenDeLaSemana(dias, filtro = null) {
  const days = (dias ?? []).map((d) => {
    const fuentes = d.fuentes.filter((f) => !filtro || autorDe(f.programa) === filtro);
    const reales = fuentes.filter((f) => !f.descanso);
    return {
      key: d.clave,
      isToday: d.esHoy,
      hasSession: reales.length > 0,
      descanso: fuentes.length > 0 && reales.length === 0,
      sesiones: reales.length,
      name: reales.map((f) => textoDeSesiones(sesionesDelTitulo(f.day))).filter(Boolean).join(' + ') || null,
      dayIdx: reales[0]?.idx ?? null,
    };
  });
  const hoy = days.findIndex((d) => d.isToday);
  const conPosicion = days.map((d, pos) => ({ ...d, pos }));
  const next = conPosicion.filter((d) => d.hasSession && d.pos > hoy)[0]
    ?? conPosicion.filter((d) => d.hasSession)[0]
    ?? null;
  return { days, next, trainingDays: days.filter((d) => d.hasSession).length };
}
