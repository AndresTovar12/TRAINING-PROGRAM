/* SESIONES PEGADAS: lo que un profesional (el fisio) le agrega al programa de
   otro (el del coach) sin tocarlo.

   Andrés, 1 oct 2026 (PDF «Cosas que arreglar de la cuenta de fisioterapeuta»,
   punto 7, «lo más importante»): el fisio ve una fase del programa del coach,
   escoge un día —«el miércoles»— y le crea ahí una sesión («fortalecimiento de
   tobillo»). Al atleta le aparece DENTRO del programa en que ya trabaja, con
   el nombre de quien la puso; el coach no puede moverla y el fisio no puede
   mover lo del coach.

   Y su matiz: «estiramientos lunes, miércoles y viernes por 12 meses» no se
   puede armar a mano, son 156 sesiones. Por eso se guarda UNA REGLA y no una
   fila por día: la sesión, en qué días de la semana cae y hasta dónde llega.
   La app la reparte en los días del programa al LEER, así que:
     · cambiar la sesión la cambia en todos los días;
     · si el coach alarga su programa, la regla «hasta que termine» llega
       también a las semanas nuevas;
     · se puede saltar una semana sin deshacer nada.

   DÓNDE VIVE. En una fila de `plans` por (atleta, autor), con `status` 'draft'
   y `data.tipo` 'pegadas'. Nada que lea los programas vivos (`status` 'active':
   las listas, el conector de IA, el avance) la ve, y reusa la seguridad de
   `plans`: solo la escribe quien la hizo. Forma de `data`:

       { tipo: 'pegadas', sesiones: [ regla, … ] }

       regla = {
         id,                       // estable: de él cuelgan las anotaciones del atleta
         nombre,
         sesion,                   // el día como lo arma el constructor: { name, cat, exercises | blocks }
         dias: ['Lun', 'Mié'],     // en qué días de la semana cae
         alcance: { tipo, desde, hasta, fases },
         omitir: [{ faseId, semana }],
         creada,
       }

   `alcance.tipo`:
     'todo'  — desde `desde` hasta que el programa termine (si se alarga, se alarga).
     'hasta' — desde `desde` hasta `hasta`.
     'fases' — en las fases de `fases` completas.
     'dia'   — solo la semana de `desde`.
   `desde` y `hasta` son { faseId, semana, n }: `n` es la posición de corrido de
   esa semana y sirve de respaldo si el coach borra la fase y la semana ya no
   existe con ese nombre.

   Todo esto es puro: no lee la base ni el reloj. */

export const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const ORDEN = { Lun: 0, Mar: 1, 'Mié': 2, Mie: 2, Jue: 3, Vie: 4, 'Sáb': 5, Sab: 5, Dom: 6 };
export const ordenDeDia = (dia) => ORDEN[dia] ?? 9;

const NOMBRE_LARGO = {
  Lun: 'lunes', Mar: 'martes', 'Mié': 'miércoles', Jue: 'jueves', Vie: 'viernes', 'Sáb': 'sábado', Dom: 'domingo',
};
export const nombreLargoDeDia = (dia) => NOMBRE_LARGO[dia] ?? String(dia ?? '').toLowerCase();

/** ¿Esta fila de `plans` es de sesiones pegadas (y no un programa)? */
export const esFilaDePegadas = (fila) => fila?.data?.tipo === 'pegadas';

/** Las reglas de una fila. */
export const reglasDe = (fila) => (Array.isArray(fila?.data?.sesiones) ? fila.data.sesiones : []);

const llaveDeSemana = (faseId, semana) => `${faseId}|${semana}`;

/** Las semanas de un programa, de corrido: [{ faseId, semana, n }]. */
export function semanasDelPrograma(fases) {
  const lista = [];
  (fases ?? []).forEach((f) => (f.weekData ?? []).forEach((w) => lista.push({ faseId: f.id, semana: w.num, n: lista.length })));
  return lista;
}

const posicion = (lista, ref) => (ref ? lista.findIndex((s) => s.faseId === ref.faseId && s.semana === ref.semana) : -1);

// Con el respaldo `n`: si la semana ya no existe, la que cae más cerca de donde estaba.
function posicionAprox(lista, ref) {
  const i = posicion(lista, ref);
  if (i >= 0) return i;
  return Number.isInteger(ref?.n) && lista.length ? Math.min(Math.max(ref.n, 0), lista.length - 1) : -1;
}

/**
 * Las posiciones (de corrido) de las semanas del programa en que cae una
 * regla, ya sin las que se saltaron. Programa vacío, nada.
 */
export function indicesDeLaRegla(regla, lista) {
  if (!lista.length) return [];
  const a = regla?.alcance ?? { tipo: 'todo' };
  let indices = [];
  if (a.tipo === 'fases') {
    lista.forEach((s, i) => { if ((a.fases ?? []).includes(s.faseId)) indices.push(i); });
  } else if (a.tipo === 'dia') {
    const i = posicion(lista, a.desde);
    if (i >= 0) indices = [i];
  } else {
    const desde = Math.max(0, posicionAprox(lista, a.desde));
    const fin = a.tipo === 'hasta' && a.hasta ? posicionAprox(lista, a.hasta) : -1;
    const hasta = fin < 0 ? lista.length - 1 : Math.max(fin, desde);
    for (let i = desde; i <= hasta; i += 1) indices.push(i);
  }
  const fuera = new Set((regla?.omitir ?? []).map((o) => llaveDeSemana(o.faseId, o.semana)));
  return indices.filter((i) => !fuera.has(llaveDeSemana(lista[i].faseId, lista[i].semana)));
}

/** ¿La regla se quedó sin ningún lugar en el programa (el coach lo cambió)? */
export const esHuerfana = (regla, fases) => {
  const lista = semanasDelPrograma(fases);
  return lista.length > 0 && indicesDeLaRegla(regla, lista).length === 0;
};

/** Cuántos días y cuántas semanas ocupa una regla: «105 días (35 semanas × 3)». */
export function cuantoOcupa(regla, fases) {
  const semanas = indicesDeLaRegla(regla, semanasDelPrograma(fases)).length;
  const porSemana = (regla?.dias ?? []).length;
  return { semanas, porSemana, dias: semanas * porSemana };
}

const copia = (o) => (typeof structuredClone === 'function' ? structuredClone(o) : JSON.parse(JSON.stringify(o)));

/**
 * El programa del coach con las sesiones de UN autor repartidas en sus días.
 * Devuelve fases con la MISMA forma (mismos ids y números de fase y semana) que
 * las del coach, pero cada semana solo trae lo del autor: así se lee, se marca y
 * se anota igual que cualquier programa, y el puntero del coach vale para los dos.
 *
 * Cada día lleva `sid` (la regla y el día de la semana), que da la llave ESTABLE
 * de lo que anote el atleta. Ver `adaptadorDeRegistros`.
 *
 * En una rutina que se repite (`semanal`) hay una sola semana que vuelve cada
 * semana del calendario: ahí las reglas caen siempre, sin rangos.
 */
export function fasesConPegadas(reglas, fasesDelCoach, { autorId = null, semanal = false } = {}) {
  const lista = semanasDelPrograma(fasesDelCoach);
  const aplica = (reglas ?? []).map((r) => new Set(
    semanal ? lista.map((_, i) => i) : indicesDeLaRegla(r, lista),
  ));
  let n = -1;
  return (fasesDelCoach ?? []).map((f) => ({
    id: f.id,
    num: f.num,
    name: f.name,
    fullName: f.fullName ?? f.name,
    color: f.color,
    mode: f.mode,
    weeks: f.weeks,
    duration: f.duration,
    weekData: (f.weekData ?? []).map((w) => {
      n += 1;
      const days = [];
      (reglas ?? []).forEach((r, ri) => {
        if (!aplica[ri].has(n)) return;
        [...(r.dias ?? [])].sort((a, b) => ordenDeDia(a) - ordenDeDia(b)).forEach((dia) => {
          const sesion = copia(r.sesion ?? {});
          days.push({
            ...sesion,
            day: dia,
            name: sesion.name || r.nombre || 'Sesión',
            sid: `${r.id}-${dia}`,
            reglaId: r.id,
            autorId,
          });
        });
      });
      return { num: w.num, label: '', load: '', days };
    }),
  }));
}

/* LLAVES ESTABLES DE LO QUE ANOTA EL ATLETA.
   Todo lo que el atleta anota de un día (peso, hecha, notas) se guarda con la
   llave de su POSICIÓN en la semana: `f6-w3-d2`. Para un programa normal eso
   está bien. Para una sesión pegada no: la posición cambia en cuanto el fisio
   agrega otra sesión, cambia los días de una regla o salta una semana, y lo
   anotado se le pegaría a otro día sin avisar.

   Así que lo de las sesiones pegadas se guarda con la llave de la REGLA y el día
   de la semana: `f6-w3-k3j9a2xq-Lun`. Y para no tocar el resto de la app, que
   sigue pidiendo y escribiendo por posición, aquí se traduce en las dos
   direcciones:

     vista(guardado)   → lo guardado, visto con llaves de posición
     llaveEstable(id)  → la llave de posición, vuelta a la estable (para escribir)

   En una rutina que se repite la llave lleva la semana del calendario:
   `wk-2026-W40-d1` ↔ `wk-2026-W40-k3j9a2xq-Lun`. */
export function adaptadorDeRegistros(fases, kind = 'periodized') {
  const aPosicion = new Map();
  const aEstable = new Map();
  const posicionDeSid = new Map();
  const sidDePosicion = new Map();
  (fases ?? []).forEach((f) => (f.weekData ?? []).forEach((w) => (w.days ?? []).forEach((d, idx) => {
    if (!d.sid) return;
    if (kind === 'weekly') {
      posicionDeSid.set(d.sid, idx);
      sidDePosicion.set(idx, d.sid);
    } else {
      const porPosicion = `${f.id}-w${w.num}-d${idx}`;
      const estable = `${f.id}-w${w.num}-${d.sid}`;
      aPosicion.set(estable, porPosicion);
      aEstable.set(porPosicion, estable);
    }
  })));

  const SEMANAL_ESTABLE = /^(wk-\d{4}-W\d{2})-(.+)$/;
  const SEMANAL_POSICION = /^(wk-\d{4}-W\d{2})-d(\d+)$/;

  const vista = (guardado) => {
    const salida = {};
    Object.entries(guardado ?? {}).forEach(([llave, valor]) => {
      if (kind === 'weekly') {
        const m = SEMANAL_ESTABLE.exec(llave);
        if (m && posicionDeSid.has(m[2])) salida[`${m[1]}-d${posicionDeSid.get(m[2])}`] = valor;
      } else if (aPosicion.has(llave)) {
        salida[aPosicion.get(llave)] = valor;
      }
    });
    return salida;
  };

  const llaveEstable = (id) => {
    if (kind === 'weekly') {
      const m = SEMANAL_POSICION.exec(String(id));
      return m && sidDePosicion.has(Number(m[2])) ? `${m[1]}-${sidDePosicion.get(Number(m[2]))}` : id;
    }
    return aEstable.get(id) ?? id;
  };

  return { vista, llaveEstable };
}

/** Un id corto para la regla, del tamaño de los que ya usa el constructor de planes. */
export const idDeRegla = () => (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)).replace(/-/g, '').slice(0, 8);

/** Una regla nueva, lista para guardar. */
export function nuevaRegla({ sesion, dias, alcance }) {
  return {
    id: idDeRegla(),
    nombre: sesion?.name || 'Sesión',
    sesion,
    dias,
    alcance,
    omitir: [],
    creada: new Date().toISOString(),
  };
}

/** «Se pondrá en 105 días (35 semanas × 3)», o lo que toque decir. */
export function textoDeCuantoOcupa(regla, fases, { semanal = false } = {}) {
  if (semanal) return `Se repite cada semana: ${regla.dias.length === 1 ? '1 día' : `${regla.dias.length} días`} por semana.`;
  const { semanas, porSemana, dias } = cuantoOcupa(regla, fases);
  if (!dias) return 'No cae en ningún día del programa todavía.';
  if (dias === 1) return 'Se pondrá en 1 día.';
  return `Se pondrá en ${dias} días (${semanas === 1 ? '1 semana' : `${semanas} semanas`} × ${porSemana}).`;
}
