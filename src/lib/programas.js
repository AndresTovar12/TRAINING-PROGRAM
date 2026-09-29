import {
  cursorAlDia, defaultCursor, isValidCursor, resolveCursor, sessionForToday, sessionIdFor,
  ejerciciosDelBloque, esDescanso, diasDeEstaSemana,
} from '@/lib/training-utils';
import { minutosDeTag, sesionesDelTitulo, textoDeSesiones } from '@/lib/sesiones';
import { esDeSalud } from '@/lib/palabras';
import { LT, oficioCorto } from '@/lib/theme';

/* PROGRAMAS de un atleta: el de su coach principal y el de cada profesional de
   su equipo. Todo puro (sin leer la base ni el reloj por su cuenta): la portada,
   la pestaña «Plan» y las pruebas usan las mismas funciones.

   Un «programa» es lo que arma `PlanContext`: { id, clave, esPrincipal,
   profesional, phases, kind, hasPlan, … }. `clave` es el id del profesional
   (null = el coach principal) y da el sufijo de los registros del atleta:
   `wr:sessions@<clave>` y `wr:cursor@<clave>`. El principal sigue en
   `wr:sessions` y `wr:cursor`, sin migrar nada. */

// El coach principal es azul, como siempre; los demás profesionales rotan de color.
const COLORES = [LT.blue, '#00A372', '#7C5CFF', '#E07B00'];
export const colorDePrograma = (indice) => COLORES[indice % COLORES.length];

/** `wr:sessions` → `wr:sessions@<profesional>` para un programa de equipo. */
export const claveDeRegistro = (base, programa) => (programa?.clave ? `${base}@${programa.clave}` : base);

/** El puntero de un programa, puesto al día con el calendario. NO lo guarda. */
export function cursorDePrograma(programa, store, hoy = new Date()) {
  const guardado = store?.[claveDeRegistro('wr:cursor', programa)];
  const base = isValidCursor(programa.phases, guardado) ? guardado : defaultCursor(programa.phases);
  return cursorAlDia(programa.phases, base, hoy);
}

/** Fase y semana de calendario en que va el atleta dentro de un programa. */
function ubicacion(programa, cursor) {
  const fases = programa.phases ?? [];
  if (programa.kind !== 'weekly') {
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
 * La sesión de HOY de un programa, lista para pintar en una tarjeta:
 * { …sessionForToday, hecha, titulo, ejercicios, minutos }. Si hoy no toca, null.
 */
export function sesionDeHoy(programa, store, hoy = new Date()) {
  if (!programa?.hasPlan) return null;
  const cursor = cursorDePrograma(programa, store, hoy);
  const sesion = sessionForToday(programa.phases, programa.kind, cursor, hoy);
  if (!sesion) return null;
  const registros = store?.[claveDeRegistro('wr:sessions', programa)] ?? {};
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
 * La semana de calendario (lunes a domingo) con lo de CADA programa, cada uno
 * según su propio puntero. Devuelve los 7 días, cada uno con sus `entradas`:
 * { programaId, clave, titulo, hecha, phase, week, dayIdx }, en el orden en que
 * vienen los programas (el del coach principal primero).
 */
export function semanaDeTodos(programas, store, hoy = new Date()) {
  const dias = diasDeEstaSemana(hoy).map((d) => ({ ...d, entradas: [] }));
  (programas ?? []).forEach((programa) => {
    if (!programa?.hasPlan) return;
    const { phase, week } = ubicacion(programa, cursorDePrograma(programa, store, hoy));
    if (!week) return;
    const registros = store?.[claveDeRegistro('wr:sessions', programa)] ?? {};
    const porDia = new Map();
    (week.days ?? []).forEach((day, idx) => {
      if (esDescanso(day)) return;
      const clave = CLAVE_DE_DIA[day.day] ?? day.day;
      if (!porDia.has(clave)) porDia.set(clave, []);
      porDia.get(clave).push({ day, idx });
    });
    dias.forEach((d) => {
      const delDia = porDia.get(d.clave) ?? [];
      if (!delDia.length) return;
      const ids = delDia.map((x) => sessionIdFor(programa.kind, phase.id, week.num, x.idx, hoy));
      d.entradas.push({
        programaId: programa.id,
        clave: programa.clave,
        titulo: textoDeSesiones(sesionesDelTitulo(delDia.map((x) => x.day))) || delDia[0].day.day,
        hecha: ids.every((id) => !!registros[id]?.completed),
        phase,
        week,
        dayIdx: delDia[0].idx,
      });
    });
  });
  return dias;
}
