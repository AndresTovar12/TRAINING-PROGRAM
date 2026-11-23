/**
 * LA CARA DEL ATLETA DE LAS PIEZAS DE LA LISTA (paso 4 del entreno del atleta, 22 nov 2026; reglas en `docs/atleta-piezas.md`).
 *
 * Running, Cycling, Swimming y Triatlón se arman en `EditorDeCorrer` y se guardan en `day.tramos`: una lista de piezas (Calentamiento,
 * Técnica, Carrera continua, Intervalos, Sprints, Series, Descanso, Transición, Enfriamiento). Hasta hoy el motor del entreno (`pasosDeLaSesion`
 * en `entreno.js`) solo leía `day.exercises` (Gym) y estas sesiones salían con 0 pasos: el atleta solo veía «Marcar como hecha».
 *
 * Aquí cada pieza tiene su CARA DEL ATLETA (`CARAS`): convierte lo que guardó el editor en los MISMOS pasos de siempre (ejercicio, descanso),
 * con su `termina` y su `meta`. Así todo lo que ya lee los pasos (la pantalla del entreno, la del GPS, la pantalla bloqueada, el Apple Watch,
 * el idioma de los relojes, los stickers) sirve sin cambiar. `scripts/revisa-caras.mjs` avisa si el editor ofrece una pieza que no está aquí.
 *
 * Las reglas que se aplican (decididas con Andrés el 22 nov 2026):
 *   · Por tiempo (Trote 10 min, intervalos de bici): `termina.por = 'tiempo'`, la app cuenta y pasa sola (regla 4) → `pasaSola: true`.
 *   · Por distancia: el GPS decide desde 200 m (como en Gym); menos, el atleta toca «Listo» (regla 9).
 *   · Técnica y calentamiento con ejercicios: un «Listo» por ejercicio, con sus veces (regla 6).
 *   · Nado: «Listo» al llegar al borde (regla 7); bici fija y caminadora: la máquina marca y toca «Listo» (regla 8).
 *   · Descanso con tiempo: cuenta y pasa solo; «hasta recuperarse»: sin cuenta, espera «Seguir» (regla 10).
 *   · Sprint con límite: `limiteSeg` (regla 11). Transición: el atleta toca al arrancar lo que sigue (regla 12).
 *
 * LAS CLAVES de estos pasos: `t<pieza>.<n>` (pieza = su lugar en `day.tramos`, n = el paso dentro de la pieza) y `d.<clave anterior>` para
 * un descanso. No tienen `idx`: no hay un `day.exercises[idx]` donde anotar reps o kilos.
 */

const MAX_PASOS_DE_PIEZA = 200;
const num = (x) => { const n = parseFloat(String(x ?? '').replace(',', '.')); return Number.isFinite(n) && n > 0 ? n : 0; };
const texto = (x) => String(x ?? '').trim();
const dos = (n) => String(n).padStart(2, '0');
const A_METROS = { m: 1, km: 1000, yd: 0.9144 };
// La unidad como la escribe el editor (`s`) y como la lee el motor (`seg`).
const UNIDAD = { s: 'seg', seg: 'seg', min: 'min', m: 'm', km: 'km', yd: 'yd', cal: 'cal', reps: 'reps' };
const DEPORTE = { correr: 'correr', bici: 'bici', nadar: 'natacion', triatlon: 'triatlon' };

/** «4:30» desde `{ min, seg }`; sin minutos, «12 s». `null` si no hay. */
function mmss(v) {
  if (!v || !(num(v.min) || num(v.seg))) return null;
  const s = num(v.seg);
  if (!num(v.min)) return `${Math.round(s * 10) / 10} s`;
  return `${num(v.min)}:${dos(Math.round(s))}`;
}
const segDe = (v) => (v && (num(v.min) || num(v.seg)) ? num(v.min) * 60 + num(v.seg) : 0);

/** La intensidad de una pieza o un renglón, como `meta` del motor (`{ tipo, texto, min, max }`), o `null`. */
export function metaDeIntensidad(t) {
  const v = t?.vals ?? {};
  const rango = (a, b, f = (x) => x) => (a ? { min: Math.min(f(a), f(b || a)), max: Math.max(f(a), f(b || a)) } : null);
  switch (t?.modo) {
    case 'zona': return t.z ? { tipo: 'zona', texto: `Zona ${t.z}`, min: t.z, max: t.z } : null;
    case 'tope': return { tipo: 'texto', texto: 'Al máximo' };
    case 'libre': return { tipo: 'texto', texto: 'Ritmo libre' };
    case 'rpe': return v.rpe ? { tipo: 'rpe', texto: `RPE ${v.rpe}`, min: Number(v.rpe), max: Number(v.rpe) } : null;
    case 'pulso': return num(v.pulso?.de) ? { tipo: 'texto', texto: `${v.pulso.de}${num(v.pulso.a) ? `–${v.pulso.a}` : ''} pulsaciones` } : null;
    case 'ritmo': {
      const a = mmss(v.ritmo); const b = mmss(v.ritmo2);
      return a ? { tipo: 'ritmo', texto: `${a}${b ? `–${b}` : ''} min/km`, ...rango(segDe(v.ritmo), segDe(v.ritmo2)) } : null;
    }
    case 'ritmo100': {
      const a = mmss(v.ritmo); const b = mmss(v.ritmo2);
      return a ? { tipo: 'nado', texto: `${a}${b ? `–${b}` : ''} /100 m`, ...rango(segDe(v.ritmo), segDe(v.ritmo2)) } : null;
    }
    case 'w': return num(v.w?.de) ? { tipo: 'w', texto: `${v.w.de}${num(v.w.a) ? `–${v.w.a}` : ''} W`, ...rango(num(v.w.de), num(v.w.a)) } : null;
    case 'tiempo': {
      const a = mmss(v.tiempo); const b = mmss(v.tiempo2);
      return a ? { tipo: 'texto', texto: `en ${a}${b ? `–${b}` : ''}` } : null;
    }
    default: return null;
  }
}

/** Cómo termina «cuánto» (`q` en la unidad `u`): por tiempo, por distancia, por calorías, o con un toque si no dice. */
export function terminaDeCuanto(q, u) {
  const n = num(q);
  const unidad = UNIDAD[u] ?? u;
  if (!n) return { por: 'boton' };
  if (unidad === 'min' || unidad === 'seg') { const s = Math.round(n * (unidad === 'min' ? 60 : 1)); return { por: 'tiempo', min: s, max: s, valor: s, cantidad: String(q), unidad }; }
  if (A_METROS[unidad]) { const m = Math.round(n * A_METROS[unidad] * 100) / 100; return { por: 'distancia', min: m, max: m, valor: m, cantidad: String(q), unidad }; }
  if (unidad === 'cal') return { por: 'calorias', min: n, max: n, valor: n, cantidad: String(q), unidad };
  if (unidad === 'reps') return { por: 'reps', min: n, max: n, valor: n, cantidad: String(q), unidad };
  return { por: 'boton', texto: `${q} ${u}` };
}
const cuantoTexto = (q, u) => (num(q) ? `${q} ${UNIDAD[u] ?? u}` : '');
// El texto del paso es CUÁNTO (como `textoMeta` en Gym: «800 m»); la intensidad va en `meta` y cada pantalla la junta como necesita.
const conMeta = (base) => base;

/** Un descanso escrito como `q` y `u` (o «hasta recuperarse»), como paso del motor. `null` si no hay. */
function descanso(q, u, despuesDe, entre, extra = {}) {
  if (u === 'rec') return { clave: `d.${despuesDe}`, tipo: 'descanso', entre, intensidad: 'recuperar', texto: 'Hasta recuperarte', seg: null, segMax: null, termina: { por: 'boton' }, recuperar: true, ...extra };
  if (u === 'nada' || u === 'camina' || u === 'trota') return null;
  const n = num(q);
  if (!n) return null;
  const s = Math.round(n * (u === 'min' ? 60 : 1));
  return { clave: `d.${despuesDe}`, tipo: 'descanso', entre, intensidad: 'recuperar', texto: `${q} ${u === 'min' ? 'min' : 'seg'}`, seg: s, segMax: null, termina: { por: 'tiempo', min: s, max: s, valor: s }, ...extra };
}

/* ------------------------------------------------------------------ */
/* Lo guardado antes, leído en la forma de ahora (mismo criterio que EditorDeCorrer) */
/* ------------------------------------------------------------------ */

function normaliza(t) {
  if (!t || t.vals) return t;
  const vals = {};
  const n = String(t.val ?? '').match(/\d+/g)?.map(Number) ?? [];
  if (t.modo === 'ritmo' && n.length >= 2) vals.ritmo = { min: String(n[0]), seg: dos(n[1]) };
  if (t.modo === 'pulso' && n.length) vals.pulso = { de: String(n[0]), a: String(n[1] ?? '') };
  if (t.modo === 'rpe' && n.length) vals.rpe = n[0];
  return { ...t, vals };
}

/** Los sprints o series de una pieza `k: 'int'`: un renglón por sprint con su descanso, y lo que es de toda la pieza. */
function sprintsDe(x) {
  const abre = (filas) => filas.flatMap((f) => Array.from({ length: Math.max(1, Math.min(30, num(f.n) || 1)) }, (_, k) => ({ ...f, id: k ? `${f.id}-${k}` : f.id })));
  if (Array.isArray(x.filas)) return { filas: abre(x.filas), intensidad: x, ej: x.ej, con: x.con, limS: x.limS ?? null };
  // Antes: `veces` + `tr` (el sprint) + `rec` (el descanso), o `partes` / `lista`.
  const partes = [{ tr: x.tr, rec: x.rec, ej: x.ej, con: x.con }, ...(x.partes ?? [])];
  const veces = x.lista?.length ? 1 : Math.max(1, num(x.veces) || 1);
  const durec = (r) => (!r || r.tipo === 'nada' ? 'nada' : r.tipo === 'libre' ? 'rec' : r.tipo === 'camina' ? 'camina' : r.u === 's' ? 's' : 'min');
  const filas = x.lista?.length
    ? x.lista.map((q, i) => ({ id: `${x.id}-${i}`, q: String(q), u: x.tr?.u ?? 'm', dq: x.rec?.q ?? '', du: durec(x.rec) }))
    : partes.filter((p) => p.tr).map((p, i) => ({ id: `${x.id}-${i}`, n: String(veces), q: p.tr.q ?? '', u: p.tr.u ?? 'm', dq: p.rec?.q ?? '', du: durec(p.rec) }));
  const primero = normaliza(x.tr ?? {});
  return { filas: abre(filas), intensidad: primero, ej: x.ej, con: x.con, limS: primero.limS ?? null };
}

/** Una Técnica en la forma de ahora (`{ sets }`), venga como venga (ver `tecDe` en EditorDeCorrer). */
function setsDeTecnica(x) {
  if (Array.isArray(x.sets)) return x.sets;
  if (Array.isArray(x.filas)) {
    const ej = x.ej ?? {};
    const filas = x.filas.length ? x.filas : [];
    const iguales = filas.every((f) => f.q === filas[0].q && f.u === filas[0].u && f.dq === filas[0].dq && f.du === filas[0].du);
    const item = (f, k) => ({ id: `${x.id}-${k}`, exercise_id: ej.exercise_id, name: ej.name ?? '', q: f.q ?? '', u: f.u ?? 'm', dq: f.dq ?? '', du: f.du ?? 'camina' });
    if (!filas.length) return [];
    return [iguales ? { id: `${x.id}-s`, veces: filas.length, items: [item(filas[0], 0)], dq: '', du: 'camina' } : { id: `${x.id}-s`, veces: 1, items: filas.map(item), dq: '', du: 'camina' }];
  }
  return (x.items ?? []).map((it, k) => ({ id: `${x.id}-s${k}`, veces: Math.max(1, Math.min(20, num(it.s) || 1)), dq: '', du: 'camina',
    items: [{ id: `${x.id}-${k}`, exercise_id: it.exercise_id, name: it.name ?? '', q: it.q ?? '', u: it.u ?? 'm', dq: '', du: 'camina' }] }));
}
const REGRESO = { camina: 'regreso caminando', trota: 'regreso trotando' };

/* ------------------------------------------------------------------ */
/* Las caras                                                           */
/* ------------------------------------------------------------------ */

/**
 * Los Sets de ejercicios (Técnica, o un calentamiento «Ejercicios»): UNO POR UNO. Un «Listo» por cada vez que se hace un ejercicio.
 *
 * Antes (regla 6, 22 nov 2026), un ejercicio que se repetía igual salía junto («3 × 10 reps», un solo «Listo»). Andrés, 23 nov 2026: «dice 3 × 10,
 * ¿no se supone que debería de ir uno por uno?». Tenía dos fallas: era inconsistente (10, 10, 10 salía junto y 10, 12, 15 uno por uno) y el descanso
 * entre vueltas quedaba como texto, sin cronometrarse. Ahora cada vuelta es su paso («10 reps · Vuelta 1 de 3»), la app lleva la cuenta y el descanso
 * con tiempo se cuenta. «Regreso caminando» o «trotando» no es un descanso con reloj: se dice bajo la cifra.
 */
function pasosDeSets(sets, base, ctx) {
  const pasos = [];
  sets.forEach((set, si) => {
    const items = (set.items ?? []).filter((it) => texto(it.name));
    if (!items.length) return;
    const vueltas = Math.max(1, Math.min(20, num(set.veces) || 1));
    // El mismo ejercicio escrito varias veces con cantidades distintas (Switches 10 · 12 · 15) también son sus vueltas: «Vuelta 2 de 3».
    const elMismo = vueltas === 1 && items.length > 1 && items.every((it) => texto(it.name) === texto(items[0].name));
    for (let v = 1; v <= vueltas; v += 1) {
      items.forEach((it, ii) => {
        const clave = `${base}.${si}.${v}.${ii}`;
        const cuanto = cuantoTexto(it.q, it.u);
        const regreso = REGRESO[it.du] ?? null;
        const extras = [it.lado && 'por lado', num(it.peso?.q) && `${it.peso.q} ${it.peso.u ?? 'kg'}`, (it.mat ?? []).length && it.mat.join(', ')].filter(Boolean);
        pasos.push({
          clave, tipo: 'ejercicio', nombre: texto(it.name), exercise_id: it.exercise_id ?? null,
          texto: [cuanto, ...extras, regreso].filter(Boolean).join(' · '),
          // Lo que dice la cifra grande de la pantalla del paso («10 reps»): termina con un toque, pero dice cuánto.
          termina: { por: 'boton', ...(cuanto ? { texto: cuanto } : null) }, meta: null, vuelta: elMismo ? ii + 1 : v, vueltas: elMismo ? items.length : vueltas,
          ...(texto(it.nota) ? { nota: texto(it.nota) } : null), ...ctx,
          // Con el teléfono en el piso (regla 18): lo que importa es ver cómo se hace, no unos números. Ver `lib/caraDelPaso.js`.
          cara: 'lejos',
        });
        const ultimo = v === vueltas && ii === items.length - 1;
        const d = ultimo ? null : descanso(it.dq, it.du, clave, ii === items.length - 1 ? 'rondas' : 'ejercicios');
        if (d) pasos.push(d);
      });
    }
    if (si < sets.length - 1) { const d = descanso(set.dq, set.du, pasos[pasos.length - 1]?.clave ?? `${base}.${si}`, 'sets'); if (d) pasos.push(d); }
  });
  return pasos;
}

/** Calentamiento y Enfriamiento: Trote, Nado o Rodada (por tiempo o distancia), Guiado (un video) o Ejercicios. */
function calentamiento(x, base, ctx) {
  const intensidad = x.rol === 'calma' ? 'enfriar' : 'calentar';
  const comun = { ...ctx, intensidad, ...(texto(x.nota) ? { nota: texto(x.nota) } : null) };
  if (x.forma === 'video') {
    const v = x.video ?? {};
    const s = num(v.duracion) || num(x.q) * 60;
    return [{
      clave: `${base}.0`, tipo: 'ejercicio', nombre: texto(v.nombre) || x.nom || 'Calentamiento', guiado: true,
      video: v.url ? { url: v.url, inicio: v.inicio ?? null, fin: v.fin ?? null, exercise_id: v.exercise_id ?? null } : null,
      texto: s ? `Guiado · ${s < 60 ? `${Math.round(s)} seg` : `${Math.round(s / 60)} min`}` : 'Guiado', termina: s ? { por: 'tiempo', min: s, max: s, valor: s, cantidad: String(Math.round(s / 60)), unidad: 'min' } : { por: 'boton' },
      // No pasa por el reloj: pasa al terminar el VIDEO (regla 1; ver `PantallaDeCardio`). El tiempo queda para los relojes de pulsera.
      meta: null, pasaSola: false, ...comun,
      // Está en su lugar siguiendo un video (regla 18). Sin video elegido no hay qué seguir: queda como un paso de Gym con su cronómetro.
      cara: v.url ? 'guiado' : 'gym',
    }];
  }
  if (x.forma === 'ejercicios') {
    const sets = Array.isArray(x.sets) ? x.sets : setsDeTecnica({ id: x.id, items: x.items });
    return pasosDeSets(sets, base, comun);
  }
  const meta = metaDeIntensidad(normaliza(x));
  const termina = terminaDeCuanto(x.q, x.u);
  return [{ clave: `${base}.0`, tipo: 'ejercicio', nombre: x.nom || (x.rol === 'calma' ? 'Enfriamiento' : 'Calentamiento'), texto: [conMeta(cuantoTexto(x.q, x.u), meta), ...extrasDeLaPieza(x)].filter(Boolean).join(' · '), termina, meta, pasaSola: termina.por === 'tiempo', ...comun }];
}

/** Los renglones de unos intervalos, ya repetidos las vueltas que quepan en el total, más el que completa. */
function renglonesDeIntervalos(x) {
  const ints = x.ints ?? (x.cambios ? { repite: true, lista: [x.cambios.a, x.cambios.b].filter(Boolean) } : null);
  const lista = ints?.lista ?? [];
  if (!lista.length) return [];
  const modo = ints.modo ?? lista.find((p) => p.modo)?.modo;
  const enKm = { km: 1, m: 0.001 }; const enMin = { min: 1, s: 1 / 60 };
  const base = enKm[x.u] ? enKm : enMin[x.u] ? enMin : null;
  let veces = 1; let resto = 0;
  if (ints.repite && base && num(x.q) && lista.every((p) => base[p.u] && num(p.q))) {
    const suma = lista.reduce((a, p) => a + num(p.q) * base[p.u], 0);
    const total = num(x.q) * base[x.u];
    veces = Math.max(1, Math.min(60, Math.floor(total / suma + 1e-9)));
    resto = Math.max(0, total - suma * veces);
    if (resto < 0.0005) resto = 0;
  }
  const filas = Array.from({ length: veces }, () => lista.map((p) => ({ ...p, modo }))).flat();
  if (resto > 0) {
    const fin = ints.fin ?? { z: x.z, vals: x.vals ?? {} };
    const enU = base === enKm ? (resto < 1 ? { q: String(Math.round(resto * 1000)), u: 'm' } : { q: String(Math.round(resto * 100) / 100), u: 'km' })
      : (resto < 1 ? { q: String(Math.round(resto * 60)), u: 's' } : { q: String(Math.round(resto * 100) / 100), u: 'min' });
    filas.push({ ...fin, modo, ...enU, fin: true });
  }
  return filas;
}

/**
 * Lo de «Para toda la carrera / rodada» que escribe el coach (cadencia, caminadora, resistencia, postura, terreno), dicho en palabras del atleta.
 * Doble revisión del 23 nov 2026: velocidad e inclinación de la caminadora, terreno y «sentado o de pie» se perdían.
 */
const POSTURA = { sentado: 'sentado', pie: 'de pie', alterna: 'alternando sentado y de pie' };
const TERRENO = { plano: 'terreno plano', subida: 'en subida', mixto: 'terreno mixto' };
function extrasDeLaPieza(x) {
  const cam = x.cam && typeof x.cam === 'object' ? x.cam : null;
  const caminadora = x.cam ? ['en caminadora', num(cam?.kmh) && `a ${cam.kmh} km/h`, num(cam?.inc) && `inclinación ${cam.inc} %`].filter(Boolean).join(' ') : null;
  return [num(x.cad) && `cadencia ${x.cad}`, num(x.res) && `resistencia ${x.res}`, POSTURA[x.pos], TERRENO[x.ter], caminadora].filter(Boolean);
}

/** Carrera, Rodada o Nado continuo (y la pieza Intervalos): constante, progresiva o con intervalos. Sin paradas entre tramos. */
function continua(x, base, ctx) {
  const ints = x.rol === 'int' || x.como === 'int' || (!x.como && (x.ints?.lista?.length || x.cambios));
  const prog = !ints && (x.como === 'prog' || (!x.como && x.prog && (x.formato ?? 'prog') !== 'uno'));
  const extras = extrasDeLaPieza(x);
  const comun = { ...ctx, intensidad: 'trabajo', ...(texto(x.nota) ? { nota: texto(x.nota) } : null) };
  if (ints || prog) {
    const filas = ints ? renglonesDeIntervalos(x) : (x.prog?.lista ?? []).map((f) => ({ ...f, modo: x.prog.modo ?? f.modo }));
    if (filas.length) {
      return filas.slice(0, MAX_PASOS_DE_PIEZA).map((f, i) => {
        const meta = metaDeIntensidad(normaliza(f));
        const termina = terminaDeCuanto(f.q, f.u);
        return {
          clave: `${base}.${i}`, tipo: 'ejercicio', nombre: x.nom || (ints ? 'Intervalos' : 'Progresiva'), tramo: i + 1, tramos: filas.length,
          texto: [conMeta(cuantoTexto(f.q, f.u), meta), ...extras].filter(Boolean).join(' · '), termina, meta, sinParar: i < filas.length - 1, pasaSola: termina.por === 'tiempo', ...comun,
        };
      });
    }
  }
  const meta = metaDeIntensidad(normaliza(x));
  const termina = terminaDeCuanto(x.q, x.u);
  return [{ clave: `${base}.0`, tipo: 'ejercicio', nombre: x.nom || 'Carrera continua', texto: [conMeta(cuantoTexto(x.q, x.u), meta), ...extras].filter(Boolean).join(' · '), termina, meta, pasaSola: termina.por === 'tiempo', ...(x.limS ? { limiteSeg: x.limS } : null), ...comun }];
}

const MATERIAL = { trineo: 'con trineo', paracaidas: 'con paracaídas', vallas: 'con vallas', cuesta: 'en cuesta' };

/**
 * Sprints y Series: un paso por sprint con su descanso. 200 m o más los termina el GPS; menos, el atleta (regla 9).
 *
 * «En series» (`x.series = { n, q, u }`, doble revisión del 23 nov 2026): el bloque de sprints se repite `n` veces con `q u` de descanso entre series.
 * Antes se perdía: 4 sprints en 3 series salían como 4, no 12. Cada sprint dice su serie («Sprint 2 de 4 · serie 1 de 3»).
 */
function sprints(x, base, ctx) {
  if (Array.isArray(x.pasos) && x.pasos.length) return intervalosEnPasos(x, base, ctx);
  const s = sprintsDe(x);
  const meta = metaDeIntensidad(normaliza(s.intensidad));
  const con = s.con ?? {};
  const material = [MATERIAL[con.tipo] && `${MATERIAL[con.tipo]}${num(con.kg) ? ` ${con.kg} kg` : ''}`, con.tipo === 'otro' && texto(con.txt), con.tipo === 'nada' && num(con.kg) && `${con.kg} kg`].filter(Boolean);
  const nombre = texto(s.ej?.name) || (x.rol === 'series' ? 'Serie' : 'Sprint');
  const series = Math.max(1, Math.min(20, num(x.series?.n) || 1));
  const filas = s.filas.filter((f) => num(f.q)).slice(0, Math.floor(MAX_PASOS_DE_PIEZA / series));
  const pasos = [];
  for (let k = 0; k < series; k += 1) {
    filas.forEach((f, i) => {
      const n = k * filas.length + i;
      const clave = `${base}.${n}`;
      pasos.push({
        clave, tipo: 'ejercicio', nombre, exercise_id: s.ej?.exercise_id ?? null, sprint: i + 1, sprints: filas.length, vuelta: i + 1, vueltas: filas.length,
        ...(series > 1 ? { bloque: k + 1, bloques: series } : null),
        texto: [conMeta(cuantoTexto(f.q, f.u), meta), ...material].filter(Boolean).join(' · '), termina: terminaDeCuanto(f.q, f.u), meta,
        ...(s.limS ? { limiteSeg: s.limS } : null), ...(texto(x.nota) ? { nota: texto(x.nota) } : null), ...ctx, intensidad: 'trabajo',
      });
      const ultimoDeLaSerie = i === filas.length - 1;
      if (!ultimoDeLaSerie) { const d = descanso(f.dq, f.du, clave, 'rondas'); if (d) pasos.push(d); }
      else if (k < series - 1) { const d = descanso(x.series?.q, x.series?.u === 's' ? 's' : 'min', clave, 'series', { texto: `${x.series?.q} ${x.series?.u === 's' ? 'seg' : 'min'} · entre series` }); if (d) pasos.push(d); }
    });
  }
  return pasos;
}

/**
 * Intervalos guardados como PASOS (Correr · Caminar · Descanso, y «Repetir todo N veces»): así guarda el editor una pieza vieja en cuanto el coach
 * la toca (`CamposDePasos` en EditorDeCorrer). Doble revisión del 23 nov 2026: no le llegaba nada al atleta.
 */
function intervalosEnPasos(x, base, ctx) {
  const veces = Math.max(1, Math.min(30, num(x.veces) || 1));
  const lista = x.pasos.filter((p) => p && (p.tipo === 'descanso' || num(p.q)));
  const corre = lista.filter((p) => p.tipo === 'correr').length;
  const pasos = [];
  let n = 0;
  let c = 0;
  for (let v = 1; v <= veces; v += 1) {
    lista.forEach((p, i) => {
      const ultimo = v === veces && i === lista.length - 1;
      if (p.tipo === 'descanso') {
        if (ultimo || !pasos.length) return;
        const d = p.completo ? descanso('', 'rec', pasos[pasos.length - 1].clave, 'rondas') : descanso(p.q, p.u === 's' ? 's' : 'min', pasos[pasos.length - 1].clave, 'rondas');
        if (d) pasos.push(d);
        return;
      }
      const clave = `${base}.${n}`;
      n += 1;
      const camina = p.tipo === 'caminar';
      if (!camina) c += 1;
      const meta = camina ? null : metaDeIntensidad(normaliza(p));
      pasos.push({
        clave, tipo: 'ejercicio', nombre: camina ? 'Caminar' : (texto(p.ej?.name) || x.nom || 'Intervalo'), exercise_id: camina ? null : (p.ej?.exercise_id ?? null),
        ...(camina ? null : { sprint: c, sprints: corre * veces }), vuelta: v, vueltas: veces,
        texto: cuantoTexto(p.q, p.u), termina: terminaDeCuanto(p.q, p.u), meta, sinParar: camina || lista[i + 1]?.tipo === 'caminar',
        ...(p.limS ? { limiteSeg: p.limS } : null), ...(texto(x.nota) ? { nota: texto(x.nota) } : null), ...ctx, intensidad: camina ? 'recuperar' : 'trabajo',
      });
    });
  }
  return pasos.slice(0, MAX_PASOS_DE_PIEZA);
}

function tecnica(x, base, ctx) { return pasosDeSets(setsDeTecnica(x), base, { ...ctx, intensidad: 'trabajo' }); }

function descansoSuelto(x, base, ctx) {
  const n = num(x.q);
  const activo = x.tipo === 'camina';
  if (!n) return [];
  const s = Math.round(n * (x.u === 'min' ? 60 : 1));
  // Un descanso de la lista es un paso propio (no sigue a un ejercicio): su clave es la de la pieza.
  return [{ clave: `d.${base}`, tipo: 'descanso', entre: 'piezas', intensidad: 'recuperar', texto: `${x.q} ${x.u === 'min' ? 'min' : 'seg'}${activo ? ' · activo, moviéndote suave' : ''}`, seg: s, segMax: null, termina: { por: 'tiempo', min: s, max: s, valor: s }, ...ctx }];
}

function transicion(x, base, ctx) {
  const n = num(x.q);
  return [{ clave: `${base}.0`, tipo: 'ejercicio', nombre: 'Transición', texto: n ? `En menos de ${x.q} ${x.u === 'min' ? 'min' : 'seg'}` : 'Lo más rápido que puedas', termina: { por: 'boton', texto: n ? `< ${x.q} ${x.u === 'min' ? 'min' : 'seg'}` : 'Lo más rápido' }, meta: null, transicion: true, ...(n ? { limiteSeg: Math.round(n * (x.u === 'min' ? 60 : 1)) } : null), ...ctx, intensidad: 'trabajo' }];
}

/**
 * EL CALENTAMIENTO DE UNA SESIÓN DE SETS (Gym; después Clase y Deporte): la misma pieza que el calentamiento de la lista (`day.calentamiento`, con
 * `forma: 'video' | 'ejercicios'`). Doble revisión del 23 nov 2026: el coach lo armaba y al atleta no le llegaba nada. Va antes del Set 1, con su
 * encabezado «Calentamiento»; `serie: 0` (no cambia los números de los Sets) y sin GPS (no corre: sigue un video o hace ejercicios). `null` si está vacío.
 */
export function pasosDelCalentamiento(cal, base = 'cal') {
  if (!cal || typeof cal !== 'object') return [];
  const forma = cal.forma ?? 'video';
  if (forma === 'video' && !cal.video?.url && !num(cal.q)) return [];
  const x = { id: base, k: 'tr', rol: cal.rol === 'calma' ? 'calma' : 'cal', nom: cal.rol === 'calma' ? 'Enfriamiento' : 'Calentamiento', ...cal, forma };
  const ctx = { serie: 0, pieza: `tr:${x.rol}`, nombreDeLaPieza: x.nom, deLaLista: true, deporteDeLaParte: 'correr', sinGps: true };
  const suyos = calentamiento(x, base, ctx);
  if (suyos.length) suyos[0] = { ...suyos[0], encabezado: x.nom };
  return suyos.map((q) => (q.tipo === 'ejercicio' && !q.cara ? { ...q, cara: 'gym' } : q));
}

/**
 * ¿Este paso tiene NÚMEROS QUE CAMBIAN en la pantalla? (Andrés, 23 nov 2026, sobre el sprint con trineo de 30 m: «¿para qué cambia la pantalla a color
 * negro? ¿cuál es la función?»). La negra es para lo que se mira mientras se avanza: una cuenta (por tiempo), los metros y el ritmo del GPS (200 m o
 * más, con GPS) o el reloj de la transición. Un sprint de 30 m, una serie de nado de 100 m o 5 km en la caminadora no tienen nada que cambie en la
 * pantalla: el atleta lo hace y toca al terminar. Esos van en la clara, «de lejos», con su video.
 */
function conNumerosEnVivo(p) {
  if (p.transicion) return true;
  if (p.termina?.por === 'tiempo') return true;
  return p.termina?.por === 'distancia' && !p.sinGps && Number(p.termina.min) >= 200;
}

/**
 * LAS CARAS: una por cada pieza que ofrece el editor. La llave es la de la pieza: `k` y, en `tr` e `int`, su `rol`.
 * `scripts/revisa-caras.mjs` compara esta lista con las piezas de `EditorDeCorrer.jsx`: una pieza nueva sin cara hace fallar la revisión.
 */
export const CARAS = {
  'tr:cal': calentamiento,
  'tr:calma': calentamiento,
  'tr:continua': continua,
  'tr:int': continua,
  'int:sprint': sprints,
  'int:series': sprints,
  tec: tecnica,
  desc: descansoSuelto,
  trans: transicion,
};
const NOMBRE_DE_PIEZA = { 'tr:cal': 'Calentamiento', 'tr:calma': 'Enfriamiento', 'tr:continua': 'Carrera continua', 'tr:int': 'Intervalos', 'int:sprint': 'Sprints', 'int:series': 'Series', tec: 'Técnica', desc: 'Descanso', trans: 'Transición' };
export const llaveDePieza = (x) => (x?.k === 'tr' || x?.k === 'int' ? `${x.k}:${x.rol ?? (x.k === 'int' ? 'sprint' : 'continua')}` : x?.k);

/** El deporte de una sesión de la lista, para los relojes: el de su Disciplina. */
export const deporteDeLaLista = (day) => DEPORTE[day?.disciplina] ?? 'correr';

/**
 * La lista de una sesión, en pasos (sin numerar: eso lo hace `pasosDeLaSesion`). `{ pasos, sinCara }`: `sinCara` son las piezas que no se supo
 * traducir (no debería pasar; la revisión lo cuida), para no esconderlas.
 */
export function pasosDeLaLista(day) {
  const piezas = Array.isArray(day?.tramos) ? day.tramos.filter((x) => x && typeof x === 'object') : [];
  const pasos = [];
  const sinCara = [];
  piezas.forEach((x, pi) => {
    const cara = CARAS[llaveDePieza(x)];
    if (!cara) { sinCara.push(llaveDePieza(x)); return; }
    // Sin GPS (reglas 7 y 8): en la alberca, en la bici fija y en la caminadora el teléfono no se mueve con el atleta.
    const deporte = x.dxp ?? (day.disciplina === 'nadar' ? 'nado' : day.disciplina === 'bici' ? 'bici' : 'correr');
    const sinGps = deporte === 'nado' || (deporte === 'bici' && !x.dxp && day.lugar !== 'ruta') || !!x.cam;
    const ctx = { serie: pi + 1, pieza: llaveDePieza(x), nombreDeLaPieza: texto(x.nom) || NOMBRE_DE_PIEZA[llaveDePieza(x)] || 'Parte', deLaLista: true, deporteDeLaParte: deporte, ...(sinGps ? { sinGps: true } : null) };
    const suyos = cara(x, `t${pi}`, ctx);
    if (suyos.length) suyos[0] = { ...suyos[0], encabezado: x.nom || suyos[0].nombre };
    // Cada paso dice qué pantalla le toca (`lib/caraDelPaso.js`). Lo que no dijo otra cosa: la negra SOLO si la pantalla tiene números que cambian.
    pasos.push(...suyos.map((p) => (p.tipo === 'ejercicio' && !p.cara ? { ...p, cara: conNumerosEnVivo(p) ? 'numeros' : 'lejos' } : p)));
  });
  // Dos descansos seguidos (un Descanso suelto después del descanso de un sprint) se dejan: los escribió el coach.
  return { pasos, sinCara };
}
