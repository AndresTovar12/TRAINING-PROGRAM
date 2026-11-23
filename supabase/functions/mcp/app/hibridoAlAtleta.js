/**
 * EL HÍBRIDO LLEGA AL ATLETA (23 nov 2026). El editor guarda una cadena de Sets (`day.hibrido.sets`, ver `lib/hibrido.js`); el atleta no tenía nada
 * («Hyrox · simulacro» solo enseñaba el nombre y «Marcar como hecha»).
 *
 * Diseño aprobado (fotos reales, `pw/hibrido2.html`): el Híbrido NO trae pantallas nuevas. Usa las de Gym:
 *   · fuerza → la pantalla de Gym (cifras, kilos, anotar, grabar técnica);
 *   · carrera de 200 m o más → la negra con GPS (la decide `esPasoConGps`, igual que en Gym);
 *   · sprint corto → «de lejos» (el teléfono en el piso; `cara: 'lejos'`);
 *   · máquina (remo, bici, esquí) o caminadora → la de Gym con su «Listo», sin GPS (`sinGps`);
 *   · AMRAP, EMOM y «Por tiempo» → el reloj de Set de siempre, con la regla 19 y «Terminé» al final de «Por tiempo» (regla 14).
 *
 * Por eso la traducción es a EJERCICIOS DE GYM (los de `day.exercises`), no a pasos: así todo lo de Gym funciona igual sin tocarlo (los índices,
 * los kilos, lo anotado, los relojes y su resultado, lo que ve el coach). `conHibrido(day)` le pone esos ejercicios a un día Híbrido que no tiene
 * ejercicios propios; siempre el MISMO objeto para el mismo día (las pantallas lo comparan).
 *
 * Campos que solo entiende el motor del entreno: `_cara` (la cara del paso) y `_sinGps`.
 */

const LETRAS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'; // estilo-ok: las letras de los Sets (A, B, C), no texto en mayúsculas
const lleno = (v) => v !== null && v !== undefined && String(v).trim() !== '';
const num = (v) => { const n = Number(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : null; };

/** «30 seg», «2 min»: lo que entiende `lecturaDeDescanso`. */
const textoDeDescanso = (d) => (d && lleno(d.q) ? `${String(d.q).trim()} ${d.u === 'seg' || d.u === 's' ? 'seg' : 'min'}` : '');

const UNIDAD = { reps: 'reps', m: 'm', km: 'km', seg: 'seg', min: 'min', cal: 'cal', yd: 'm' };

function textoDeIntensidad(int) {
  if (!int || !int.tipo) return '';
  const { tipo, a, b } = int;
  const rango = (sufijo) => (lleno(a) ? `${a}${lleno(b) ? `-${b}` : ''}${sufijo}` : '');
  switch (tipo) {
    case 'rpe': return lleno(a) ? `RPE ${a}` : '';
    case 'rir': return lleno(a) ? `RIR ${a}` : '';
    case 'pace': return rango(' min/km');
    case 'zona': return lleno(a) ? `Zona ${a}` : '';
    case 'pulso': return rango(' ppm');
    case 'w': return rango(' W');
    case 'r500': return rango(' /500 m');
    case 'tope': return 'Al máximo';
    case 'tiempo': return lleno(a) ? `en ${a}` : '';
    default: return '';
  }
}

function textoDePeso(peso, comoCargaExtra) {
  if (!peso || !lleno(peso.q)) return '';
  const t = peso.u === '% 1RM' ? `${peso.q}% 1RM` : `${peso.q} ${peso.u || 'kg'}`;
  return comoCargaExtra ? `con ${t}` : t;
}

const MATERIAL = { trineo: 'con trineo', paracaidas: 'con paracaídas', vallas: 'con vallas', cuesta: 'en cuesta' };
const MAQUINA = /\b(remo|row|erg|ski|esqu[ií]|bici|bike|assault|airbike|el[ií]ptica|caminadora|treadmill)\b/i;
const DE_MAQUINA = ['remo', 'ski', 'bici'];

/** ¿Es cardio (lleva lo de «Cómo se corre»)? Lo dice el tipo que guardó el editor o, en datos viejos, lo que trae el renglón. */
const esCardio = (it) => (it.tipo ? ['correr', 'remo', 'ski', 'bici', 'cardio'].includes(it.tipo)
  : (it.como && it.como !== 'uno') || ['pace', 'zona', 'pulso', 'w', 'r500', 'tope', 'tiempo'].includes(it.int?.tipo) || ['m', 'km'].includes(it.u));
/** ¿Se hace en una máquina o en la caminadora? Entonces el teléfono no se mueve: sin GPS. */
const sinGpsDe = (it) => (it.tipo ? DE_MAQUINA.includes(it.tipo) : (['w', 'r500'].includes(it.int?.tipo) || MAQUINA.test(String(it.name ?? '')))) || (it.maq !== null && it.maq !== undefined);

const metros = (q, u) => { const n = num(q); if (n === null) return null; return u === 'km' ? n * 1000 : u === 'm' ? n : null; };

/** Lo que acompaña a la intensidad de un cardio: la carga extra, el material, la cadencia, la caminadora o la resistencia. */
function extrasDeCardio(it) {
  return [
    textoDePeso(it.peso, true),
    it.como === 'sprint' && it.mat ? MATERIAL[it.mat] : '',
    lleno(it.cad) ? `cadencia ${it.cad}` : '',
    it.maq !== null && it.maq !== undefined ? (MAQUINA.test(String(it.name ?? '')) && !/caminadora|treadmill/i.test(String(it.name ?? '')) ? `resistencia ${it.maq || '…'}` : `en caminadora${lleno(it.maq) ? ` inclinación ${it.maq} %` : ''}`) : '',
  ].filter(Boolean);
}

/** Un renglón del Híbrido → uno o varios ejercicios de Gym (un sprint por fila, un tramo por fila de la progresiva o de los intervalos). */
function ejerciciosDelRenglon(it) {
  const cardio = esCardio(it);
  const base = {
    exercise_id: it.exercise_id ?? null,
    name: String(it.name ?? '').trim() || 'Ejercicio',
    notes: lleno(it.nota) ? String(it.nota) : '',
    ...(it.lado ? { porLado: true } : null),
    ...(it.limite && lleno(it.limite.q) ? { enMenosDe: String((num(it.limite.q) ?? 0) * (it.limite.u === 'seg' ? 1 : 60)) } : null),
    ...(cardio && sinGpsDe(it) ? { _sinGps: true } : null),
  };
  const intensidad = (int) => (cardio
    ? [textoDeIntensidad(int), ...extrasDeCardio(it)].filter(Boolean).join(' · ')
    : [textoDePeso(it.peso, false), textoDeIntensidad(int)].filter(Boolean).join(' · '));

  if (cardio && it.como === 'sprint' && Array.isArray(it.spr)) {
    const filas = it.spr.filter((f) => lleno(f.q));
    return filas.map((f, k) => {
      const m = metros(f.q, f.u);
      return {
        ...base,
        // El número del sprint no va pegado al nombre: va en «en qué vas» («Sprint 1 de 4 · serie 1 de 3»), como en la lista.
        ...(filas.length > 1 ? { _sprint: { k: k + 1, n: filas.length } } : null),
        reps: String(f.q), unidad: UNIDAD[f.u] ?? 'm', intensity: intensidad(it.int),
        _descanso: textoDeDescanso({ q: f.dq, u: f.du }),
        // Un sprint corto se hace con el teléfono en el piso (regla 18): «de lejos», con su «Listo» al volver.
        ...(m !== null && m < 200 && !base._sinGps ? { _cara: 'lejos' } : null),
      };
    });
  }
  const tramos = cardio && it.como === 'prog' && it.pg?.lista?.length ? it.pg.lista
    : cardio && it.como === 'int' && it.iv?.lista?.length ? tramosDeIntervalos(it)
      : null;
  if (tramos) {
    const con = tramos.filter((t) => lleno(t.q));
    return con.map((t, k) => ({
      ...base,
      name: con.length > 1 ? `${base.name} · tramo ${k + 1} de ${con.length}` : base.name,
      reps: String(t.q), unidad: UNIDAD[t.u] ?? 'm', intensity: intensidad({ ...it.int, a: t.a, b: t.b }),
      _descanso: '',
    }));
  }
  const pv = it.pv && Array.isArray(it.vueltas) && it.vueltas.length
    ? { porVuelta: it.vueltas.map((w) => {
      const int = it.int ? { ...it.int, a: lleno(w.a) ? w.a : it.int.a } : null;
      const peso = lleno(w.p) ? { q: w.p, u: it.peso?.u || 'kg' } : it.peso;
      return { reps: String(lleno(w.q) ? w.q : (it.q ?? '')), intensity: cardio ? intensidad(int) : [textoDePeso(peso, false), textoDeIntensidad(int)].filter(Boolean).join(' · ') };
    }) }
    : null;
  return [{
    ...base,
    reps: lleno(it.q) ? String(it.q) : '', unidad: UNIDAD[it.u] ?? 'reps', intensity: intensidad(it.int),
    ...(pv ?? null),
    _descanso: textoDeDescanso(it.desc),
  }];
}

/** Los intervalos: la lista una vez o, con «Repetir hasta completar», hasta llegar al total del renglón (máx. 30 tramos). */
function tramosDeIntervalos(it) {
  const lista = it.iv.lista.filter((t) => lleno(t.q));
  if (!it.iv.repite || !lista.length) return lista;
  const total = metros(it.q, it.u) ?? (it.u === 'min' ? (num(it.q) ?? 0) * 60 : it.u === 'seg' ? num(it.q) : null);
  const valor = (t) => metros(t.q, t.u) ?? (t.u === 'min' ? (num(t.q) ?? 0) * 60 : t.u === 'seg' ? num(t.q) : null);
  if (!total) return lista;
  const salida = [];
  let suma = 0;
  for (let k = 0; suma < total && salida.length < 30; k += 1) {
    const t = lista[k % lista.length];
    const v = valor(t);
    if (!v) break;
    salida.push(t);
    suma += v;
  }
  return salida;
}

/** El formato del reloj de un Set del Híbrido (AMRAP, EMOM o «Por tiempo»), con los ejercicios que lleva. */
function formatoDelSet(set, n) {
  const min = Math.max(1, Math.round(num(set.min) ?? 10));
  if (set.fmt === 'amrap') return { id: 'amrap', pasos: [{ tipo: 'trabajo', seg: min * 60 }], vueltas: 1, tope: null, turnan: false, anota: 'rondas' };
  // «Cada minuto empieza un ejercicio, durante N min»: los ejercicios se turnan; N minutos son N tramos de 1 min.
  if (set.fmt === 'emom') return { id: 'emom', pasos: [{ tipo: 'trabajo', seg: 60 }], vueltas: Math.max(1, Math.ceil(min / Math.max(1, n))), tope: null, turnan: n > 1, anota: 'cumplido' };
  // «Lo más rápido posible» (regla 14): un solo tramo abierto; «Empezar», el reloj corre y «Terminé» al final.
  return { id: 'portiempo', pasos: [{ tipo: 'trabajo', seg: null }], vueltas: 1, tope: null, turnan: false, anota: 'tiempo' };
}

/** La cadena del Híbrido como ejercicios de Gym, en orden, con su letra de Set. */
export function ejerciciosDelHibrido(hibrido) {
  const sets = Array.isArray(hibrido?.sets) ? hibrido.sets.filter((s) => s && Array.isArray(s.items) && s.items.length) : [];
  const salida = [];
  sets.forEach((set, k) => {
    const letra = LETRAS[k] ?? `S${k + 1}`;
    const filas = set.items.flatMap(ejerciciosDelRenglon);
    if (!filas.length) return;
    const conReloj = set.fmt === 'amrap' || set.fmt === 'emom' || set.fmt === 'tiempo';
    const formato = conReloj ? formatoDelSet(set, filas.length) : null;
    const veces = conReloj ? 1 : Math.max(1, Math.round(num(set.veces) ?? 1));
    filas.forEach((f, i) => {
      const ultimo = i === filas.length - 1;
      const { _descanso, ...ex } = f;
      salida.push({
        ...ex,
        set: letra,
        sets: String(veces),
        // Al final de cada vuelta va el descanso entre vueltas; entre ejercicios, el de cada uno.
        descanso: conReloj ? '' : (ultimo ? textoDeDescanso(set.descV) : _descanso),
        ...(ultimo ? { descansoSet: textoDeDescanso(set.descS) } : null),
        ...(formato ? { formato } : null),
      });
    });
  });
  return salida;
}

const hechos = new WeakMap();
/** El día con los ejercicios de su Híbrido (si es Híbrido y no trae ejercicios propios). Siempre el mismo objeto para el mismo día. */
export function conHibrido(day) {
  if (!day || typeof day !== 'object' || !Array.isArray(day.hibrido?.sets) || !day.hibrido.sets.length) return day;
  if (Array.isArray(day.exercises) && day.exercises.some((e) => e && !e.isNote)) return day;
  if (hechos.has(day)) return hechos.get(day);
  const exercises = ejerciciosDelHibrido(day.hibrido);
  const salida = exercises.length ? { ...day, exercises } : day;
  hechos.set(day, salida);
  return salida;
}
