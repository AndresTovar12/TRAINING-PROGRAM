import { createContext, useContext, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Plus, ArrowUp, ArrowDown, Trash2, Copy, X, PlayCircle, Video, Zap, TrendingUp, Timer, Gauge, Footprints, StickyNote, Pencil, Mountain, Repeat, ArrowRight, Check, Armchair, Bike, Waves, ArrowLeftRight, Flame, Snowflake, ImageIcon, Package } from 'lucide-react';
import { T, FONT, KP, UI } from '@/lib/theme';
import { Contador } from '@/features/admin/piezas';
import { estimaUmbrales } from '@/lib/metricas/calculos';
import { umbralesDe } from '@/lib/metricasApi';
import { createExercise } from '@/lib/api';
import RepertoirePicker from '@/features/admin/RepertoirePicker';
import { claseNueva } from '@/lib/clases';
import { ligaExterna } from '@/lib/videos';
import { AccionesDeClase, TarjetaDeClase } from '@/features/admin/ClaseDeLaSesion';
import { useAviso } from '@/components/AvisoPasajero';
import { useIsDesktop } from '@/lib/useViewport';
import { useHojaDeslizable, useSigueMontado } from '@/lib/useHojaDeslizable';
import { supabase } from '@/lib/supabase';
import { VideoDelAtleta, VIOLETA_SU_VIDEO } from '@/lib/videoDelAtleta';
import { ZONAS, ZONA_SE_SIENTE, NOMBRE_MODO, MATERIAL, FORMAS_CAL, UNIDADES, PACE, nuevoId, pasoNuevo, filaSprint, itemTec, setTec, filaInt, U_RUTA, U_ESTATICA, DEPORTES, FORMAS_CAL_TRI, depDeParte } from '@/lib/catalogoDeLaLista';

/* EL EDITOR DE CORRER Y VELOCIDAD (11-12 nov 2026, prueba). Andrés: «no es posible hacer cualquier tipo de entrenamiento con el mismo formato».
   Una sesión de Correr (o de Velocidad, la de sprinters) es una lista que se lee de arriba a abajo, como se le escribiría al atleta.

   CUARTA VUELTA (12 nov 2026). Andrés: «no te enfoques en una opción por cada tipo de intervalo; haz que con el mismo editor sea fácil crear todas
   las versiones». Revisado con usability-psychologist y marketing-psychology (y emil-design-eng para lo visual):
     · POCAS PIEZAS, MUY FLEXIBLES. «Agregar» ofrece seis: Calentamiento, Técnica de carrera, Carrera continua, Intervalos, Descanso y Enfriamiento.
       Con ellas salen los 18 tipos de entreno de runner (Easy, Long, Tempo, Fartlek, Cuestas, Pirámide, Progresivo, Sprints…). Debajo de cada pieza
       van los nombres que buscaría el coach («series, repeticiones, fartlek, cuestas, pirámide, sprints»): se reconocen, no se recuerdan.
     · A LA VISTA, MÁXIMO 4 COSAS Y UN «MÁS OPCIONES». Lo demás (tiempo límite, material o terreno, pirámide, repetir en series, caminadora,
       cadencia, progresivo, nota) sale de ahí; lo que ya se usó se queda a la vista.
     · LA INTENSIDAD con 3 fichas según la Disciplina (Correr: Zona, Ritmo, Esfuerzo; Velocidad: Al máximo, Tiempo, Esfuerzo) y «Otra» para el resto.
       Ritmo y tiempo aceptan rango («entre 4:20 y 4:30»), que no se confunde con el progresivo («empieza a 5:30 y termina a 4:30»).
     · PALABRAS DEL COACH: Intervalos (no «repeticiones», que en Pesas son las reps), Enfriamiento, Al máximo, Distancia o tiempo, Tiempo límite,
       Material o terreno, Técnica de carrera, Mover arriba/abajo, pulsaciones (no «lpm»).
     · EL VIDEO DEL CALENTAMIENTO es como el de Clase (subir o pegar liga, la duración sale del video) o un calentamiento de sus Ejercicios (la
       categoría «Calentamiento»: Andrés lo buscaría en el repertorio, no en Mis planes).
   Datos en `day.tramos`:
     · { id, k: 'tr', rol: 'cal'|'continua'|'calma', nom, q, u, modo, z, vals, limS, nota, forma, items, video, prog, cam, cad }
     · { id, k: 'int', veces, tr: {…}, rec: { tipo, q, u, z }, con: { tipo, kg, txt }, lista: ['200', …], series: { n, q, u } }
     · { id, k: 'tec', ej: { exercise_id, name }, filas: [{ id, q, u: 'm'|'reps'|'s', dq, du: 'camina'|'trota'|'s'|'min'|'nada' }], con: { kg } }
       (antes: `items`, varios ejercicios con series; se lee igual)      · { id, k: 'desc', q, u, tipo: 'parado'|'camina' }
   Fuera de esta vuelta: lo que ve el atleta y el botón del reloj, bici/nado/triatlón, Hyrox, saltos y lanzamientos, calentamiento en Pesas. */

// Del más suave al más fuerte: el azul de la app, de claro a profundo. Sobre las tres claras va letra oscura; sobre las dos fuertes, blanca.
const COLOR_ZONA = ['#C7D2FB', '#97A9F5', '#6F8AF0', '#3557E4', '#1530A8'];
const TINTA_ZONA = [T.text, T.text, T.text, '#fff', '#fff'];
// El ámbar de «Falta…» en un tono que se lee sobre blanco (4.6 a 1; el ámbar de la marca da 3 a 1).
const AMBAR_TEXTO = '#B45F00';
const MORADO = KP.violet;
// El fondo de cada pieza de la lista y de cada opción de «Agregar», sobre la tarjeta blanca de la sesión.
const FONDO_PIEZA = '#F2F3F7';
// Sombra solo en lo que flota (la tarjeta abierta, los menús); las cerradas van planas sobre la bandeja.
const VERDE = KP.mint;
// El verde de «✓ Listo» en un tono que se lee sobre blanco.
const VERDE_TEXTO = '#067A55';
// Lo que se ve primero de la intensidad (zona, pace y esfuerzo en una carrera; máximo, tiempo y esfuerzo en un sprint) vive en `DEPORTES`.
/** Lo guardado ANTES de los pasos (un intervalo con `tr`, `rec`, `partes`, `lista`): se lee para convertirlo a pasos. */
const partesDe = (x) => [{ id: x.id, tr: x.tr, rec: x.rec, ej: x.ej, con: x.con }, ...(x.partes ?? [])];
/** Una Técnica en la forma de ahora (`{ sets }`), venga como venga. */
function tecDe(x) {
  if (Array.isArray(x.sets)) return { sets: x.sets };
  const extra = () => ({ ...(num(x.con?.kg) ? { peso: { q: x.con.kg, u: 'kg' } } : null), ...((x.mat ?? []).length ? { mat: x.mat } : null) });
  if (Array.isArray(x.filas)) {
    // Una pieza de un solo ejercicio con una fila por vez: si todas las filas son iguales, un Set de N veces; si cambian, la lista tal cual.
    const ej = x.ej ?? {};
    const filas = x.filas.length ? x.filas : [{ q: '', u: 'm', dq: '', du: 'camina' }];
    const iguales = filas.every((f) => f.q === filas[0].q && f.u === filas[0].u && f.dq === filas[0].dq && f.du === filas[0].du);
    const item = (f, k) => ({ id: `${x.id}-${k}`, exercise_id: ej.exercise_id, name: ej.name ?? '', q: f.q ?? '', u: f.u ?? 'm', dq: f.dq ?? '', du: f.du ?? 'camina', ...extra(), ...(k === 0 && x.nota ? { nota: x.nota } : null) });
    if (!ej.exercise_id && !filas.some((f) => num(f.q))) return { sets: [] };
    return { sets: [iguales ? { id: `${x.id}-s`, veces: filas.length, items: [item(filas[0], 0)], dq: '', du: 'camina' } : { id: `${x.id}-s`, veces: 1, items: filas.map(item), dq: '', du: 'camina' }] };
  }
  // Más antes: `items`, cada ejercicio con sus series. Cada uno es su Set, con sus series como veces (el mismo orden de antes).
  return { sets: (x.items ?? []).map((it, k) => ({ id: `${x.id}-s${k}`, veces: Math.max(1, Math.min(20, num(it.s) || 1)), dq: '', du: 'camina',
    items: [{ id: `${x.id}-${k}`, exercise_id: it.exercise_id, name: it.name ?? '', q: it.q ?? '', u: it.u ?? 'm', dq: '', du: 'camina', ...extra() }] })) };
}
/** Los minutos de una Técnica: cada vez de cada ejercicio (30 m ≈ 10 s; 10 reps ≈ 30 s) con su descanso (regresar ≈ 30 s), y lo de entre Sets. */
const minutosDescansoTec = (d) => (d.du === 's' ? num(d.dq) / 60 : d.du === 'min' ? num(d.dq) : d.du === 'nada' ? 0 : 0.5);
const minutosTec = (tc) => tc.sets.reduce((a, st, si) => a + Math.max(1, num(st.veces) || 1) * st.items.reduce((b, it) => b
  + (it.u === 's' ? num(it.q) / 60 : it.u === 'reps' ? num(it.q) * 0.05 : (num(it.q) / 1000) * 6) + minutosDescansoTec(it), 0)
  + (si < tc.sets.length - 1 ? minutosDescansoTec(st) : 0), 0);
/** «Skip A, Skip B y Skip C» */
const nombresTec = (tc) => juntaY([...new Set(tc.sets.flatMap((st) => st.items.map((it) => it.name).filter(Boolean)))]);
// El ícono de «Transición» es de la pantalla: el catálogo (puro, compartido con el conector de IA) no lleva íconos.
{ const trans = DEPORTES.tri.opciones.find((op) => op.id === 'trans'); if (trans) trans.icono = ArrowLeftRight; }
const ICONO_DE_PARTE = { nado: Waves, bici: Bike, correr: Footprints };
const ICONO_DE_GRUPO = { Nado: Waves, Bici: Bike, Carrera: Footprints };
const GRUPO_DE_OPCION = { nado: 'Nado', bici: 'Bici', correr: 'Carrera' };
/** El deporte del editor, para todo lo que se pinta dentro (las funciones sueltas reciben lo que necesitan por parámetro). */
const DeporteCtx = createContext(DEPORTES.correr);
const useDeporte = () => useContext(DeporteCtx);
/* EL MATERIAL DE NADO: una lista que trae cinco y a la que el coach agrega los suyos. En la maqueta se guarda en este navegador; en la app real
   va en el perfil del coach (como sus categorías). */
const MATERIAL_NADO = ['Aletas', 'Pull buoy', 'Tabla', 'Paletas', 'Snorkel'];
const LLAVE_MATERIAL = 'tl-material-nado';
const materialesDelCoach = () => { try { const l = JSON.parse(localStorage.getItem(LLAVE_MATERIAL) ?? '[]'); return Array.isArray(l) ? l : []; } catch { return []; } };
const esSprintX = (x) => x?.estilo === 'sprint';
/** INTERVALOS DENTRO DE UNA CARRERA: la pieza «Intervalos» y «Carrera continua» con «+ Agregar intervalos» usan la misma tabla.
    Primero el total; debajo, los renglones, cada uno con su distancia y su intensidad (correr más lento NO es descanso: es otro renglón con su pace).
    «Repetir hasta completar» encendido son los parejos; apagado, los disparejos. Lo que falte para el total es el último renglón («Para completar
    los 10 km»), con su propia intensidad en `ints.fin`. Lo guardado antes (`cambios: {a, b}`, y la intensidad general) se lee igual. */
const conInts = (t) => t?.rol === 'continua' || t?.rol === 'int';
function intsDe(t) {
  if (t.ints) return t.ints;
  if (t.cambios && (t.formato ?? 'int') === 'int') return { repite: true, lista: [{ id: `${t.id}-a`, ...t.cambios.a }, { id: `${t.id}-b`, ...t.cambios.b }] };
  return null;
}
/** La forma de decir la intensidad de toda la tabla (Pace, Zona…): se elige una vez, en el encabezado. */
const modoDeInts = (ints) => ints?.modo ?? ints?.lista?.find((p) => p.modo)?.modo;
/** El renglón «Para completar…»: su intensidad propia; lo guardado antes usaba la intensidad general de la carrera. */
const finDe = (t, ints) => ints?.fin ?? { z: t.z, vals: t.vals ?? {} };
const conProg = (t) => !!t.prog && (t.formato ?? 'prog') !== 'uno' && t.formato !== 'int';
/** CÓMO SE CORRE una Carrera continua (Andrés, 19 nov 2026): Constante (por default), Progresiva o Con intervalos. Una sola, elegida arriba;
    antes los intervalos eran un botón y la progresiva vivía en «Más opciones» junto a la cadencia, y no se entendía qué era de qué.
    Lo guardado antes se lee igual: con renglones de intervalos, «int»; con progresiva, «prog». La pieza Intervalos siempre es «int». */
function comoDe(t) {
  if (t?.rol === 'int') return 'int';
  if (t?.rol !== 'continua') return 'uno';
  if (t.como) return t.como;
  if (intsDe(t)?.lista?.length) return 'int';
  if (conProg(t)) return 'prog';
  return 'uno';
}
// Las intensidades que tienen sentido para ir de una a otra.
const enBase = { km: 1, m: 0.001, min: 1, s: 1 / 60 };
const tipoUnidad = (u) => (u === 'km' || u === 'm' ? 'dist' : u === 'min' || u === 's' ? 'tiempo' : null);
const segDe = (v) => (v && (num(v.min) || num(v.seg)) ? num(v.min) * 60 + num(v.seg) : 0);
const deSeg = (x) => ({ min: String(Math.floor(x / 60)), seg: dosDigitos(Math.round(x % 60) % 60) });
/** Un valor entre el de inicio y el de fin, en la fracción `f` (0 = inicio, 1 = fin), según la forma de la intensidad. */
function entre(modo, ini = {}, fin = {}, f) {
  const lin = (a, b) => a + (b - a) * f;
  const vi = ini.vals ?? {}; const vf = fin.vals ?? {};
  if (modo === 'zona') return ini.z && fin.z ? { z: Math.round(lin(ini.z, fin.z)) } : {};
  if (modo === 'rpe') return vi.rpe && vf.rpe ? { vals: { rpe: Math.round(lin(vi.rpe, vf.rpe)) } } : {};
  if (modo === 'pulso') {
    const de = num(vi.pulso?.de) && num(vf.pulso?.de) ? String(Math.round(lin(num(vi.pulso.de), num(vf.pulso.de)))) : '';
    const a = num(vi.pulso?.a) && num(vf.pulso?.a) ? String(Math.round(lin(num(vi.pulso.a), num(vf.pulso.a)))) : '';
    return de ? { vals: { pulso: { de, a } } } : {};
  }
  const r1 = segDe(vi.ritmo) && segDe(vf.ritmo) ? deSeg(lin(segDe(vi.ritmo), segDe(vf.ritmo))) : undefined;
  const r2 = segDe(vi.ritmo2) && segDe(vf.ritmo2) ? deSeg(lin(segDe(vi.ritmo2), segDe(vf.ritmo2))) : undefined;
  return r1 ? { vals: { ritmo: r1, ...(r2 ? { ritmo2: r2 } : {}) } } : {};
}
/** Los tramos que salen de «Empieza en → Termina en, cada N»: tantos como quepan en el total; el último, lo que sobre. */
function generaTramos(t, g) {
  const cada = num(g.cada?.q); const uc = g.cada?.u ?? 'km';
  if (!num(t.q) || !cada || tipoUnidad(t.u) !== tipoUnidad(uc)) return null;
  const total = num(t.q) * enBase[t.u]; const paso = cada * enBase[uc];
  const n = Math.max(1, Math.min(20, Math.ceil(total / paso - 1e-9)));
  return Array.from({ length: n }, (_, i) => {
    const resto = total - paso * i;
    const q = i === n - 1 && resto < paso - 1e-9 ? Math.round((resto / enBase[uc]) * 100) / 100 : cada;
    return { id: nuevoId(), q: String(q), u: uc, modo: g.modo, ...entre(g.modo, g.ini, g.fin, n === 1 ? 0 : i / (n - 1)) };
  });
}
/** La progresiva en la forma de ahora: { modo, ini, fin, cada, lista }. Lo guardado antes ({ desde, hasta, cada } en pace) se lee igual. */
function progDe(t) {
  const p = t.prog ?? {};
  if (p.lista || p.modo) return { modo: p.modo ?? 'ritmo', ini: p.ini ?? {}, fin: p.fin ?? {}, cada: p.cada ?? { q: '', u: 'km' }, lista: p.lista ?? [] };
  const g = { modo: 'ritmo', ini: { vals: p.desde ? { ritmo: p.desde } : {} }, fin: { vals: p.hasta ? { ritmo: p.hasta } : {} }, cada: p.cada ?? { q: '', u: 'km' } };
  return { ...g, lista: generaTramos(t, g) ?? [] };
}
/** Lo que le falta a la progresiva (se dice al cerrar la tarjeta). */
function faltanProg(t) {
  const g = progDe(t);
  if (!g.lista.length) return ['Faltan los tramos'];
  return [g.lista.some((f) => !num(f.q)) && 'Falta la distancia de un tramo',
    g.lista.some((f) => !fraseIntensidad(norm({ ...f, modo: g.modo, rol: 'continua' }))) && 'Falta la intensidad'].filter(Boolean);
}
/** Cuánto suma la lista y cuántas vueltas caben en el total (en km si todo es distancia; en min si todo es tiempo). */
function cuentaInts(t) {
  const ints = intsDe(t); if (!ints?.lista?.length) return null;
  const enKm = { km: 1, m: 0.001 }; const enMin = { min: 1, s: 1 / 60 };
  const base = enKm[t.u] ? enKm : enMin[t.u] ? enMin : null;
  if (!base || !num(t.q) || ints.lista.some((p) => !base[p.u] || !num(p.q))) return { vueltas: 0, suma: 0, base: null };
  const suma = ints.lista.reduce((a, p) => a + num(p.q) * base[p.u], 0);
  const total = num(t.q) * base[t.u];
  const vueltas = ints.repite ? Math.floor(total / suma + 1e-9) : 1;
  const resto = vueltas ? Math.max(0, total - suma * vueltas) : 0;
  return { vueltas, suma, total, resto: resto < 0.0005 ? 0 : resto, base: base === enKm ? 'km' : 'min', excede: suma > total + 1e-9 };
}
/** Lo que falta para el total, dicho como lo diría el coach: «5.5 km», «300 m», «2.5 min», «45 seg». */
const restoEnUnidad = (v, base) => (base === 'km'
  ? (v < 1 ? { q: String(Math.round(v * 1000)), u: 'm' } : { q: String(Math.round(v * 100) / 100), u: 'km' })
  : (v < 1 ? { q: String(Math.round(v * 60)), u: 's' } : { q: String(Math.round(v * 100) / 100), u: 'min' }));
/** Qué tan fuerte es un renglón, para saber cuáles son los intervalos (los fuertes) y cuáles los tramos lentos. */
function fuerza(p, lim) {
  const q = norm({ ...p, rol: 'continua' });
  if (!fraseIntensidad(q)) return null;
  const r = q.modo === 'ritmo' || q.modo === 'tiempo' ? ritmoDe(q) : 0;
  return r ? 100 - r : nivel(q, lim);
}
/** Todo lo que hará el atleta, en orden: las vueltas que quepan y, si falta, el renglón para completar. Los fuertes llevan su número
    (los que pasan de la mitad entre el más lento y el más rápido); los lentos, no. */
function secuenciaInts(t, lim) {
  const ints = intsDe(t); const lista = ints?.lista ?? [];
  if (!lista.length) return { filas: [], intervalos: 0 };
  const c = cuentaInts(t);
  const modo = modoDeInts(ints);
  const veces = ints.repite && c?.base && c.vueltas > 0 ? c.vueltas : 1;
  const filas = Array.from({ length: veces }, () => lista.map((p) => ({ ...p, modo }))).flat();
  if (c?.base && c.resto > 0) filas.push({ ...finDe(t, ints), id: `${t.id}-fin`, modo, ...restoEnUnidad(c.resto, c.base), fin: true });
  const fz = filas.map((f) => fuerza(f, lim));
  const val = fz.filter((v) => v != null);
  const hi = val.length ? Math.max(...val) : 0; const lo = val.length ? Math.min(...val) : 0;
  const parejo = hi - lo < 1e-6;
  const mitad = (hi + lo) / 2;
  let k = 0;
  const out = filas.map((f, i) => {
    const fuerte = f.fin ? !parejo && fz[i] != null && fz[i] >= mitad - 1e-9 : parejo || fz[i] == null || fz[i] >= mitad - 1e-9;
    return { ...f, n: fuerte ? ++k : null };
  });
  return { filas: out, intervalos: k };
}
/** Lo que le falta a la tabla (se dice al cerrar la tarjeta). */
function faltanInts(t) {
  const ints = intsDe(t); const lista = ints?.lista ?? [];
  if (!lista.length) return ['Faltan los intervalos'];
  const modo = modoDeInts(ints);
  const c = cuentaInts(t);
  const sinIntensidad = (p) => !fraseIntensidad(norm({ ...p, modo, rol: 'continua' }));
  return [
    lista.some((p) => !num(p.q)) && 'Falta la distancia de un intervalo',
    (!modo || lista.some(sinIntensidad) || (c?.resto > 0 && sinIntensidad(finDe(t, ints)))) && 'Falta la intensidad',
    c?.excede && 'Los intervalos suman más que el total',
  ].filter(Boolean);
}

/** INTERVALOS Y SPRINTS COMO PASOS: «Correr», «Caminar», «Descanso» (solo parado por completo) y «Repetir todo N veces».
    Lo guardado antes (`tr`, `rec`, `partes`, `lista`) se convierte a pasos al leerlo; al cambiar algo se guarda ya como pasos. */
function pasosDe(x) {
  if (Array.isArray(x.pasos)) return x.pasos;
  const out = [];
  const deRec = (r, id) => {
    if (!r || r.tipo === 'nada') return null;
    if (r.tipo === 'libre') return { id, tipo: 'descanso', q: '', u: 'min', completo: true };
    if (r.tipo === 'parado') return { id, tipo: 'descanso', q: r.q ?? '', u: r.u ?? 'min' };
    if (r.tipo === 'camina') return { id, tipo: 'caminar', q: r.q ?? '', u: r.u ?? 'm' };
    return { id, tipo: 'correr', q: r.q ?? '', u: r.u ?? 'm', modo: 'zona', z: r.z || 2, vals: {}, limS: null };
  };
  const corre = (tr, id, ej, con, q) => { const t = norm(tr ?? {}); return { id, tipo: 'correr', q: q ?? t.q ?? '', u: t.u ?? 'm', modo: t.modo, z: t.z, vals: t.vals ?? {}, limS: t.limS ?? null, ej, con }; };
  if (x.lista?.length) {
    x.lista.forEach((q, i) => { out.push(corre(x.tr, `${x.id}-c${i}`, x.ej, x.con, q)); if (i < x.lista.length - 1) { const d = deRec(x.rec, `${x.id}-r${i}`); if (d) out.push(d); } });
    return out;
  }
  partesDe(x).forEach((pt, i) => { out.push(corre(pt.tr, `${x.id}-c${i}`, pt.ej, pt.con)); const d = deRec(pt.rec, `${x.id}-r${i}`); if (d) out.push(d); });
  return out;
}
const vecesDe = (x) => (!Array.isArray(x.pasos) && x.lista?.length ? 1 : num(x.veces));
/** Los sprints de una pieza: sus renglones y lo que es de toda la pieza. Lo guardado antes (pasos con «Repetir todo», o `tr` y `rec`) se lee igual. */
function sprintsDe(x) {
  // Un renglón con «n» (la versión anterior, o lo guardado con «Repetir todo») se abre en n filas iguales, una por sprint.
  const abre = (filas) => filas.flatMap((f) => { const n = Math.max(1, Math.min(30, num(f.n) || 1)); const { n: _n, ...resto } = f; return Array.from({ length: n }, (_, k) => ({ ...resto, id: k ? `${f.id}-${k}` : f.id })); });
  if (Array.isArray(x.filas)) return { filas: abre(x.filas), modo: x.modo, z: x.z, vals: x.vals ?? {}, ej: x.ej, con: x.con, limS: x.limS ?? null };
  const pasos = pasosDe(x);
  const veces = vecesDe(x);
  const filas = [];
  pasos.forEach((p, i) => {
    if (p.tipo !== 'correr') return;
    const d = pasos[i + 1]?.tipo === 'descanso' ? pasos[i + 1] : null;
    filas.push({ id: p.id, n: veces ? String(veces) : '', q: p.q ?? '', u: p.u ?? 'm', dq: d && !d.completo ? (d.q ?? '') : '', du: d?.completo ? 'rec' : d?.u === 's' ? 's' : 'min' });
  });
  const primero = norm(pasos.find((p) => p.tipo === 'correr') ?? {});
  return { filas: filas.length ? abre(filas) : [filaSprint()], modo: primero.modo, z: primero.z, vals: primero.vals ?? {}, ej: primero.ej ?? x.ej, con: primero.con ?? x.con, limS: primero.limS ?? null };
}
const descansoDe = (f) => (f.du === 'rec' ? 'hasta recuperarse' : num(f.dq) ? `${f.dq} ${f.du === 's' ? 'seg' : 'min'}` : null);
/** La intensidad dicha como frase, para leerse junto al número: «en Zona 4», «a pace 4:30–5:00», «al máximo», «en 7.8 s». */
function fraseIntensidad(t) {
  const v = t?.vals ?? {};
  switch (t?.modo) {
    case 'zona': return t.z ? `en Zona ${t.z}` : null;
    case 'tope': return 'al máximo';
    case 'libre': return 'ritmo libre';
    case 'rpe': return v.rpe ? `esfuerzo ${v.rpe} de 10` : null;
    case 'pulso': return v.pulso?.de ? `a ${v.pulso.de}${v.pulso.a ? `–${v.pulso.a}` : ''} pulsaciones` : null;
    case 'ritmo': { const a = mmss(v.ritmo); const b = mmss(v.ritmo2); return a ? `a pace ${a}${b ? `–${b}` : ''}` : null; }
    case 'ritmo100': { const a = mmss(v.ritmo); const b = mmss(v.ritmo2); return a ? `a ${a}${b ? `–${b}` : ''} por 100 m` : null; }
    case 'w': return v.w?.de ? `a ${v.w.de}${v.w.a ? `–${v.w.a}` : ''} W` : null;
    case 'tiempo': { const a = mmss(v.tiempo); const b = mmss(v.tiempo2); return a ? `en ${a}${b ? `–${b}` : ''}` : null; }
    default: return null;
  }
}
const cuantoLargo = (p) => (num(p.q) ? `${p.q} ${p.u === 'm' ? 'metros' : unidadTexto(p.u)}` : null);

const num = (x) => { const n = parseFloat(String(x ?? '').replace(',', '.')); return Number.isFinite(n) && n > 0 ? n : 0; };
const dosDigitos = (n) => String(n).padStart(2, '0');
const tiempoCorto = (s) => (s < 60 ? `${Math.round(s * 10) / 10} s` : `${Math.floor(s / 60)}:${dosDigitos(s % 60)}`);
/** «4:30» o, sin minutos, «12 s» / «4.2 s» (los sprints se miden en segundos y décimas). */
const mmss = (v) => {
  if (!v || !(num(v.min) || num(v.seg))) return null;
  const sg = num(v.seg);
  if (!num(v.min)) return `${Math.round(sg * 10) / 10} s`;
  return `${num(v.min)}:${sg < 10 ? '0' : ''}${Math.round(sg * 10) / 10}`;
};
const aMin = (v) => (v && (num(v.min) || num(v.seg)) ? num(v.min) + num(v.seg) / 60 : 0);
const sinAcentos = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const unidadTexto = (u) => (u === 's' ? 'seg' : u);
/** Al cambiar la unidad, el número se convierte (15 min → 2.5 km; 2 km → 2000 m) en vez de quedarse «15 m». `ritmo`: min por km para pasar de tiempo a distancia. */
function convierte(q, de, a, ritmo = 6) {
  const n = num(q);
  if (!n || de === a) return q;
  const enMin = { min: 1, s: 1 / 60 }; const enKm = { km: 1, m: 1 / 1000 };
  let r;
  if (enMin[de] && enMin[a]) r = (n * enMin[de]) / enMin[a];
  else if (enKm[de] && enKm[a]) r = (n * enKm[de]) / enKm[a];
  else if (enMin[de] && enKm[a]) r = (n * enMin[de]) / ritmo / enKm[a];
  else if (enKm[de] && enMin[a]) r = (n * enKm[de] * ritmo) / enMin[a];
  else return q;
  // Redondeo de coach: metros de 100 en 100 (de 10 en 10 si es poco), km a medio, minutos enteros, segundos de 5 en 5.
  const red = a === 'm' ? (r >= 300 ? Math.round(r / 100) * 100 : Math.max(10, Math.round(r / 10) * 10)) : a === 'km' ? Math.max(0.5, Math.round(r * 2) / 2) : a === 's' ? Math.max(5, Math.round(r / 5) * 5) : Math.max(1, Math.round(r));
  return String(red);
}
/** Un calentamiento guiado lleva su marca en la ficha del ejercicio («Es un calentamiento guiado»), no en una categoría (las categorías se pueden borrar). */
const esGuiado = (e) => !!e?.guiado;
/** Calentamiento y enfriamiento se arman igual: trote, guiado o ejercicios. */
const conForma = (x) => x.k === 'tr' && (x.rol === 'cal' || x.rol === 'calma');
/** Lo que el coach ya usó en otros calentamientos y en Técnica de carrera, en todos los planes que puede ver: de ahí salen los sugeridos. */
// Solo cuentan las sesiones del mismo deporte: un drill de nado no se sugiere en la técnica de carrera. Sin Disciplina, es de carrera.
const DEPORTE_DE_DISCIPLINA = { correr: 'correr', velocidad: 'correr', bici: 'bici', nadar: 'nado', triatlon: 'tri' };
function juntaUsados(raiz, ejercicios, videos, intervalo = null, deporte = null) {
  const visto = new Set();
  const camina = (o) => {
    if (!o || typeof o !== 'object' || visto.has(o)) return;
    visto.add(o);
    if (Array.isArray(o.tramos) && (!deporte || !o.disciplina || (DEPORTE_DE_DISCIPLINA[o.disciplina] ?? 'correr') === deporte)) {
      o.tramos.forEach((x) => {
        if (!x) return;
        if (x.k === 'tec' || (conForma(x) && x.forma === 'ejercicios')) (x.items ?? []).forEach((it) => it.exercise_id && ejercicios.add(it.exercise_id));
        if (x.k === 'tec') tecDe(x).sets.forEach((st) => st.items.forEach((it) => it.exercise_id && ejercicios.add(it.exercise_id)));
        if (conForma(x) && x.forma === 'video' && x.video?.exercise_id) videos.add(x.video.exercise_id);
        if (x.k === 'int' && esSprintX(x)) { const e = sprintsDe(x).ej; if (e?.exercise_id) intervalo?.add(e.exercise_id); }
        else if (x.k === 'int') pasosDe(x).forEach((pt) => pt.ej?.exercise_id && intervalo?.add(pt.ej.exercise_id));
      });
    }
    (Array.isArray(o) ? o : Object.values(o)).forEach(camina);
  };
  camina(raiz);
}

/** Un tramo con la forma de ahora (los de la primera vuelta guardaban la intensidad como texto en `val` y el límite como texto en `lim`). */
function norm(t) {
  if (!t || t.vals) return t;
  const vals = {};
  const n = String(t.val ?? '').match(/\d+/g)?.map(Number) ?? [];
  if (t.modo === 'ritmo' && n.length >= 2) vals.ritmo = { min: String(n[0]), seg: dosDigitos(n[1]) };
  if (t.modo === 'pulso' && n.length) vals.pulso = { de: String(n[0]), a: String(n[1] ?? '') };
  if (t.modo === 'rpe' && n.length) vals.rpe = n[0];
  const l = String(t.lim ?? '').match(/\d+/g)?.map(Number) ?? [];
  const limS = l.length >= 2 && /:/.test(t.lim) ? l[0] * 60 + l[1] : l.length ? l[0] : null;
  const { val: _v, lim: _l, ...resto } = t;
  return { ...resto, vals, limS };
}
const kmDe = (q, u) => (u === 'km' ? num(q) : u === 'm' ? num(q) / 1000 : 0);
/** El ritmo (min por km) que dice el tramo: su ritmo escrito, o el que sale de su tiempo objetivo y su distancia. */
function ritmoDe(t, q = t.q) {
  const v = t.vals ?? {};
  if (t.modo === 'ritmo' || t.modo === 'ritmo100') { const a = aMin(v.ritmo); const b = aMin(v.ritmo2); const m = a && b ? (a + b) / 2 : a; return t.modo === 'ritmo100' ? m * 10 : m; }
  if (t.modo === 'tiempo') { const km = kmDe(q, t.u); const a = aMin(v.tiempo); const b = aMin(v.tiempo2); const ti = a && b ? (a + b) / 2 : a; return km && ti ? ti / km : 0; }
  return 0;
}
const nivelPorRitmo = (p) => (!p ? 0 : p < 4 ? 5 : p < 4.75 ? 4 : p < 5.5 ? 3 : p < 6.25 ? 2 : 1);
/** Qué tan fuerte es, del 1 al 5: el color y la altura de su barra. */
function nivel(t, lim, q) {
  if (t.modo === 'zona') return t.z || 2;
  if (t.modo === 'tope') return 5;
  if (t.modo === 'libre') return 2;
  // Potencia y ritmo de nado no tienen una escala común: color medio hasta que el atleta tenga sus zonas.
  if (t.modo === 'w' || t.modo === 'ritmo100') return 3;
  if (t.modo === 'rpe') return Math.min(5, Math.max(1, Math.ceil((t.vals?.rpe ?? 0) / 2))) || 3;
  if (t.modo === 'pulso') { const a = num(t.vals?.pulso?.a) || num(t.vals?.pulso?.de); return a && lim[0] ? 1 + lim.filter((l) => a > l).length : 3; }
  return nivelPorRitmo(ritmoDe(t, q)) || (t.modo === 'tiempo' ? 4 : 3);
}
// `pace`: los minutos por km de cada zona del deporte (Running, Cycling o Swimming), solo para estimar.
function minutos(t, n, q = t.q, pace = PACE) {
  if (t.u === 'min') return num(q);
  if (t.u === 's') return num(q) / 60;
  if (t.u === 'cal') return num(q) / 12;
  if (t.modo === 'tiempo') { const a = aMin(t.vals?.tiempo); if (a) return a; }
  return kmDe(q, t.u) * (ritmoDe(t, q) || pace[Math.max(1, Math.round(n)) - 1]);
}
const kms = (t, n, q = t.q, pace = PACE) => (t.u === 'km' || t.u === 'm' ? kmDe(q, t.u) : minutos(t, n, q, pace) / (ritmoDe(t, q) || pace[Math.max(1, Math.round(n)) - 1]));
const duracion = (m) => { const r = Math.round(m); return r >= 60 ? `${Math.floor(r / 60)} h ${dosDigitos(r % 60)} min` : `${r} min`; };
const minutosItems = (items = []) => items.reduce((a, it) => a + Math.max(1, num(it.s)) * 0.75, 0);

/** Las barras de una cosa de la lista: cada repetición la suya; los descansos parados, un hueco. */
function barrasDe(x, lim, pace = PACE) {
  if (x.k === 'tec') return [{ m: Math.max(1, minutosTec(tecDe(x))), km: 0, n: 1.5, c: MORADO, id: x.id }];
  if (x.k === 'desc') return [{ m: num(x.q) / (x.u === 's' ? 60 : 1), km: 0, n: x.tipo === 'camina' ? 0.6 : 0, c: x.tipo === 'camina' ? COLOR_ZONA[0] : null, id: x.id }];
  // La transición: un hueco corto (sin tiempo escrito, un minuto).
  if (x.k === 'trans') return [{ m: num(x.q) ? num(x.q) / (x.u === 's' ? 60 : 1) : 1, km: 0, n: 0.6, c: KP.lineHi, id: x.id }];
  if (conForma(x) && x.forma === 'video') return [{ m: (x.video?.duracion ? x.video.duracion / 60 : num(x.q)) || 5, km: 0, n: 1.5, c: VERDE, id: x.id }];
  if (conForma(x) && x.forma === 'ejercicios') return [{ m: Math.max(2, Array.isArray(x.sets) ? minutosTec({ sets: x.sets }) : minutosItems(x.items)), km: 0, n: 1.5, c: MORADO, id: x.id }];
  if (x.k === 'tr') {
    const t = norm(x);
    const como = comoDe(t);
    const ints = como === 'int' ? intsDe(t) : null;
    if (ints?.lista?.length) {
      // Cada renglón con su intensidad, en el orden en que lo hará el atleta (las vueltas que quepan y el renglón para completar).
      return secuenciaInts(t, lim).filas.map((f) => {
        const q = norm({ ...f, rol: 'continua' });
        const n = fraseIntensidad(q) ? nivel(q, lim) : 2;
        return { m: minutos(q, n, q.q, pace), km: kms(q, n, q.q, pace), n, id: x.id };
      });
    }
    if (como === 'prog') {
      // Progresiva: cada tramo con su intensidad, de la primera a la última.
      const g = progDe(t);
      if (g.lista.length) {
        return g.lista.map((f, i) => {
          const q = norm({ ...f, modo: g.modo, rol: 'continua' });
          const n = fraseIntensidad(q) ? nivel(q, lim) : 2 + Math.round((i / Math.max(1, g.lista.length - 1)) * 2);
          return { m: minutos(q, n, q.q, pace), km: kms(q, n, q.q, pace), n, id: x.id };
        });
      }
    }
    const n = nivel(t, lim); return [{ m: minutos(t, n, t.q, pace), km: kms(t, n, t.q, pace), n, id: x.id }];
  }
  // Sprints: cada renglón, tantas veces como diga; después de cada uno, su descanso (un hueco).
  if (esSprintX(x)) {
    const s = sprintsDe(x);
    const t = { modo: s.modo, z: s.z, vals: s.vals };
    const bloque = [];
    s.filas.forEach((f) => {
      const q = norm({ ...t, q: f.q, u: f.u });
      const lv = fraseIntensidad(q) ? nivel(q, lim, f.q) : 5;
      {
        bloque.push({ m: Math.max(minutos(q, lv, q.q, pace), 0.15), km: kms(q, lv, q.q, pace), n: lv, id: x.id });
        bloque.push({ m: f.du === 'rec' ? 3 : f.du === 's' ? num(f.dq) / 60 : num(f.dq), km: 0, n: 0, id: x.id });
      }
    });
    const nS = Math.max(1, num(x.series?.n) || 1);
    const out = [];
    for (let k = 0; k < nS; k++) { out.push(...bloque); if (k < nS - 1) out.push({ m: num(x.series.q) / (x.series.u === 's' ? 60 : 1), km: 0, n: 0, id: x.id }); }
    return out;
  }
  // Intervalos (lo guardado antes como pasos): tantas veces como diga «Repetir todo». El descanso del final de la última vez no se cuenta.
  const pasos = pasosDe(x).map((p) => (p.tipo === 'correr' ? norm(p) : p));
  const veces = Math.max(1, vecesDe(x) || 1);
  const bloque = [];
  for (let v = 0; v < veces; v++) {
    pasos.forEach((p, j) => {
      const ultimo = v === veces - 1 && j === pasos.length - 1;
      if (p.tipo === 'descanso') { if (!ultimo) bloque.push({ m: p.completo ? 2 : num(p.q) / (p.u === 's' ? 60 : 1), km: 0, n: 0, id: x.id }); return; }
      if (p.tipo === 'caminar') { const km = kmDe(p.q, p.u); const m = p.u === 'min' ? num(p.q) : p.u === 's' ? num(p.q) / 60 : km * 10; bloque.push({ m, km: km || m / 10, n: 0.6, c: COLOR_ZONA[0], id: x.id }); return; }
      const n = nivel(p, lim); bloque.push({ m: minutos(p, n, p.q, pace), km: kms(p, n, p.q, pace), n, id: x.id });
    });
  }
  const nSeries = Math.max(1, num(x.series?.n) || 1);
  const out = [];
  for (let s = 0; s < nSeries; s++) {
    out.push(...bloque);
    if (s < nSeries - 1) out.push({ m: num(x.series.q) / (x.series.u === 's' ? 60 : 1), km: 0, n: 0, id: x.id });
  }
  return out;
}

/** Flechas del teclado dentro de un grupo de opciones (`role="radiogroup"`): mueven la elección, como en cualquier control nativo. */
const conFlechas = (opciones, valor, onCambio) => (e) => {
  const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
  if (!d) return;
  e.preventDefault();
  const grupo = e.currentTarget;
  const i = Math.max(0, opciones.indexOf(valor));
  onCambio(opciones[(i + d + opciones.length) % opciones.length]);
  requestAnimationFrame(() => grupo?.querySelector('[aria-checked="true"]')?.focus());
};

const frasesMaterial = (c) => (!c || c.tipo === 'nada' ? '' : c.tipo === 'trineo' ? `con trineo${num(c.kg) ? ` ${c.kg} kg` : ''}` : c.tipo === 'paracaidas' ? 'con paracaídas'
  : c.tipo === 'vallas' ? `con vallas${c.txt ? ` (${c.txt})` : ''}` : c.tipo === 'cuesta' ? `en cuesta${c.txt ? ` (${c.txt})` : ''}` : (c.txt ? `con ${c.txt}` : ''));
const fraseItems = (items = []) => {
  if (!items.length) return '';
  const nombres = items.map((it) => it.name).join(', ');
  const uno = items[0];
  const iguales = items.every((it) => it.s === uno.s && it.q === uno.q && it.u === uno.u);
  return iguales && num(uno.q) ? `${nombres} · ${uno.s} × ${uno.q} ${unidadTexto(uno.u)}` : items.map((it) => `${it.name}${num(it.q) ? ` ${it.s} × ${it.q} ${unidadTexto(it.u)}` : ''}`).join(', ');
};

export default function EditorDeCorrer({ tramos: tramosGuardados = [], onTramos, atleta = null, soloLectura = false, repertoire = [], categorias = [], onEjercicioCreado, deporte = 'correr', lugar, onLugar }) {
  const tramos = tramosGuardados;
  // El deporte de la sesión (Running, Cycling o Swimming): sus palabras, sus medidas y sus partes. Cycling, además, en ruta o estática.
  const enRuta = deporte === 'bici' && lugar === 'ruta';
  const dep = useMemo(() => (deporte === 'bici' ? { ...DEPORTES.bici, unidades: enRuta ? U_RUTA : U_ESTATICA, lugar: enRuta ? 'ruta' : 'estatica' } : DEPORTES[deporte] ?? DEPORTES.correr), [deporte, enRuta]);
  const OPCIONES = dep.opciones;
  const esCompu = useIsDesktop();
  const { avisa } = useAviso();
  const [abierto, setAbierto] = useState(null);
  const [agregando, setAgregando] = useState(false);
  // La que se acaba de cerrar con «Listo» (se ilumina un momento).
  const [recien, setRecien] = useState(null);
  // EL EDITOR DE CORRER (Andrés eligió la vista A el 18 nov): la lista numerada del entreno y, a su lado, la pieza abierta. En dos columnas
  // desde 640 px; más angosto (el teléfono), la lista ocupa la pantalla y la pieza entra de lado en su propia pantalla.
  const caja = useRef(null);
  const [ancho, setAncho] = useState(0);
  useEffect(() => {
    const el = caja.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([e]) => setAncho(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const dosColumnas = ancho >= 640;
  const botonAgregar = useRef(null);
  const enfocarCuanto = useRef(null);
  // El pulso máximo del atleta: el que escribió el coach, el más alto visto en sus entrenos o el de su edad (`estimaUmbrales`). Sin atleta, ninguno.
  const [fcMax, setFcMax] = useState(null);
  useEffect(() => {
    if (!atleta?.id) return undefined;
    let vivo = true;
    umbralesDe(atleta.id)
      .then((u) => { if (vivo) setFcMax({ valor: u?.umbrales?.fc_max ?? estimaUmbrales({}).fc_max, metodo: u?.umbrales?.metodo?.fc_max ?? 'por defecto' }); })
      .catch(() => { if (vivo) setFcMax({ valor: estimaUmbrales({}).fc_max, metodo: 'por defecto' }); });
    return () => { vivo = false; };
  }, [atleta?.id]);
  const limites = useMemo(() => (fcMax ? ZONAS.slice(0, 4).map((z) => Math.round(fcMax.valor * z.hasta)) : [0, 0, 0, 0]), [fcMax]);
  const rango = (z) => {
    const Z = ZONAS[z - 1];
    if (!fcMax) return z === 1 ? `< ${Z.hasta * 100} %` : z === 5 ? `> ${Z.desde * 100} %` : `${Z.desde * 100}–${Z.hasta * 100} %`;
    return z === 1 ? `< ${limites[0]}` : z === 5 ? `> ${limites[3]}` : `${limites[z - 2]}–${limites[z - 1]}`;
  };
  const rangoLargo = (z) => `${rango(z)}${fcMax ? ' pulsaciones' : ' del pulso máximo'}`;
  const nombreAtleta = (atleta?.full_name || atleta?.username || '').split(' ')[0];
  // Lo que ya usó en calentamientos y técnica (en todos sus planes y en esta sesión): sale primero. No depende de ninguna categoría.
  const [usadosGuardados, setUsadosGuardados] = useState({ ejercicios: new Set(), videos: new Set(), intervalo: new Set() });
  useEffect(() => {
    let vivo = true;
    Promise.resolve(supabase.from('plans').select('data'))
      .then(({ data }) => {
        if (!vivo) return;
        const ejercicios = new Set(); const videos = new Set(); const intervalo = new Set();
        juntaUsados(data ?? [], ejercicios, videos, intervalo, dep.id);
        setUsadosGuardados({ ejercicios, videos, intervalo });
      })
      .catch(() => {});
    return () => { vivo = false; };
  }, [dep.id]);
  const usados = useMemo(() => {
    const ejercicios = new Set(usadosGuardados.ejercicios); const videos = new Set(usadosGuardados.videos); const intervalo = new Set(usadosGuardados.intervalo);
    juntaUsados({ tramos }, ejercicios, videos, intervalo);
    return { ejercicios, videos, intervalo };
  }, [usadosGuardados, tramos]);
  // Sus videos: primero los que ya usó en un calentamiento, luego los demás.
  const calentamientos = useMemo(() => {
    const vids = (repertoire ?? []).filter(esGuiado);
    return [...vids.filter((e) => usados.videos.has(e.id)), ...vids.filter((e) => !usados.videos.has(e.id))];
  }, [repertoire, usados]);

  // Al abrir uno nuevo: se ve y el cursor queda en «Distancia o tiempo».
  useEffect(() => {
    if (!enfocarCuanto.current || abierto !== enfocarCuanto.current) return;
    const el = document.querySelector(`[data-corre-cuanto="${abierto}"]`);
    if (el) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); el.focus({ preventScroll: true }); }
    enfocarCuanto.current = null;
  }, [abierto]);

  const cambia = (lista) => onTramos(lista);
  const parchea = (id, f) => cambia(tramos.map((x) => (x.id === id ? f(x) : x)));
  const mueve = (i, d) => { const j = i + d; if (j < 0 || j >= tramos.length) return; const l = [...tramos]; [l[i], l[j]] = [l[j], l[i]]; cambia(l); };
  const borra = (id) => {
    const antes = tramos;
    cambia(tramos.filter((x) => x.id !== id));
    setAbierto(null);
    avisa('Se borró', { accion: { texto: 'Deshacer', alTocar: () => cambia(antes) } });
  };
  const duplica = (i) => {
    const copia = JSON.parse(JSON.stringify(tramos[i]));
    copia.id = nuevoId();
    if (copia.tr) copia.tr.id = nuevoId();
    (copia.partes ?? []).forEach((pt) => { pt.id = nuevoId(); if (pt.tr) pt.tr.id = nuevoId(); });
    (copia.pasos ?? []).forEach((pt) => { pt.id = nuevoId(); });
    (copia.ints?.lista ?? []).forEach((pt) => { pt.id = nuevoId(); });
    (copia.items ?? []).forEach((it) => { it.id = nuevoId(); });
    (copia.filas ?? []).forEach((f) => { f.id = nuevoId(); });
    cambia([...tramos.slice(0, i + 1), copia, ...tramos.slice(i + 1)]);
    setAbierto(copia.id);
  };
  // LO NUEVO ENTRA SIEMPRE AL FINAL (Andrés, 18 nov: «ya no sabes qué pusiste primero, qué pusiste después»): nada salta de lugar.
  // El orden se cambia con «Mover arriba» y «Mover abajo».
  const agrega = (op) => {
    const nuevo = op.crea();
    cambia([...tramos, nuevo]);
    enfocarCuanto.current = nuevo.id;
    setAbierto(nuevo.id);
    setAgregando(false);
  };
  const cierraAgregar = () => { setAgregando(false); requestAnimationFrame(() => botonAgregar.current?.focus()); };

  // El siguiente lógico; sin esconder los demás.
  // En Triatlón, el orden de la prueba: nado, transición, bici, transición, carrera.
  // Cada deporte cuenta una vez, aunque tenga varias partes (un nado continuo y unas series son el mismo nado).
  const deportesHechos = [...new Set(tramos.filter((x) => x.dxp && !conForma(x)).map((x) => x.dxp))];
  const sigDeporte = ['nado-continua', 'bici-continua', 'correr-continua'][Math.min(2, deportesHechos.length)];

  const barras = useMemo(() => tramos.flatMap((x) => barrasDe(x, limites, depDeParte(x, dep).pace)), [tramos, limites, dep]);
  const totalMin = barras.reduce((a, b) => a + b.m, 0);
  const totalKm = barras.reduce((a, b) => a + b.km, 0);

  const cuanto = (t, q = t.q) => (num(q) ? `${q} ${unidadTexto(t.u)}` : null);

  const vacio = !tramos.length;
  const panel = (enHoja, fijo = false) => (
    <PanelAgregar
      titulo={vacio ? '¿Con qué empieza?' : '¿Qué sigue?'} limites={limites}
      // Todo desde el inicio, en todos los deportes (Andrés, 21 nov 2026): antes Descanso y Enfriamiento salían hasta tener algo.
      opciones={OPCIONES}
      onElige={agrega} onCerrar={vacio || fijo ? null : cierraAgregar} enHoja={enHoja}
      grupoInicial={dep.id === 'tri' ? GRUPO_DE_OPCION[sigDeporte.split('-')[0]] : undefined}
    />
  );

  // EL RESUMEN NO ES UNA PIEZA (Andrés: «parece que ambos son bloques de la rutina»): va FUERA de la bandeja, sin tarjeta, como encabezado
  // que se lee. La bandeja gris guarda solo lo que el atleta hará. Sin datos todavía, no aparece (no dice «0 min»).
  const conResumen = !vacio && totalMin > 0;

  /** Qué dice cada pieza por fuera: su título, una línea y lo que le falta. */
  const resumen = (x0) => {
    const x = x0.k === 'tr' ? norm(x0) : x0;
    const deEjercicios = x.k === 'tec' || (conForma(x) && x.forma === 'ejercicios');
    const deVideo = conForma(x) && x.forma === 'video';
    // TÍTULO Y UNA LÍNEA (Andrés: «el cómo te brindan la info es tanto que no se entiende»): qué es, y cuánto. El detalle, al abrir.
    const pasos = x.k === 'int' ? pasosDe(x).map((p) => (p.tipo === 'correr' ? norm(p) : p)) : [];
    const corren = pasos.filter((p) => p.tipo === 'correr');
    const sp = x.k === 'int' && esSprintX(x) ? sprintsDe(x) : null;
    const tc = x.k === 'tec' ? tecDe(x) : null;
    const conDatos = tc ? tc.sets.some((st) => st.items.length) : sp ? sp.filas.some((f) => num(f.q)) : x.k === 'int' ? corren.some((p) => num(p.q)) : x.k === 'tr' && !conForma(x) || (conForma(x) && (x.forma ?? 'trote') === 'trote') ? num(x.q) > 0 : true;
    let titulo; let detalle; let falta = [];
    if (x.k === 'trans') {
      return { x, titulo: 'Transición', detalle: num(x.q) ? `En menos de ${x.q} ${unidadTexto(x.u)}` : 'Lo más rápido que pueda', falta: [], conDatos: true };
    }
    if (x.k === 'desc') {
      titulo = 'Descanso';
      detalle = num(x.q) ? `${x.q} ${unidadTexto(x.u)} · ${x.tipo === 'camina' ? 'activo' : 'total'}` : 'Sin datos todavía';
      if (!num(x.q)) falta = ['Falta cuánto dura'];
    } else if (tc) {
      titulo = x.nom || dep.tecnica || 'Técnica de carrera';
      const st0 = tc.sets[0];
      const solo = tc.sets.length === 1 && st0.items.length === 1 ? st0.items[0] : null;
      const veces = (n) => (num(n) > 1 ? `${n} veces` : null);
      detalle = !conDatos ? 'Sin ejercicios todavía'
        : solo ? [solo.name, veces(st0.veces), num(solo.q) ? `${solo.q} ${unidadTexto(solo.u)}` : null, (solo.mat ?? []).length ? `con ${juntaY(solo.mat).toLowerCase()}` : null].filter(Boolean).join(' · ')
          : tc.sets.length === 1 ? [nombresTec(tc), veces(st0.veces)].filter(Boolean).join(' · ')
            : `${tc.sets.length} sets · ${nombresTec(tc)}`;
      falta = [!conDatos && 'Falta el ejercicio', tc.sets.some((st) => st.items.some((it) => !num(it.q))) && 'Falta la distancia, reps o tiempo'].filter(Boolean).slice(0, 2);
    } else if (sp) {
      const esSerie = x.rol === 'series';
      titulo = esSerie ? 'Series' : 'Sprints';
      const total = sp.filas.filter((f) => num(f.q)).length;
      const dist = [...new Set(sp.filas.filter((f) => num(f.q)).map((f) => `${f.q} ${unidadTexto(f.u)}`))];
      const cuantos = total ? (esSerie ? `${total} ${total === 1 ? 'serie' : 'series'}` : `${total} ${total === 1 ? 'sprint' : 'sprints'}`) : null;
      detalle = !conDatos ? 'Sin datos todavía'
        : [num(x.series?.n) > 1 ? `${x.series.n} bloques` : null, cuantos, dist.join(' + '), sp.ej?.name].filter(Boolean).join(' · ');
      falta = [
        !fraseIntensidad({ modo: sp.modo, z: sp.z, vals: sp.vals }) && 'Falta la intensidad',
        sp.filas.some((f) => !num(f.q)) && 'Falta la distancia o el tiempo',
        sp.filas.some((f) => !descansoDe(f)) && 'Falta el descanso',
      ].filter(Boolean).slice(0, 2);
    } else if (x.k === 'int') {
      const veces = vecesDe(x);
      const nS = num(x.series?.n);
      titulo = esSprintX(x) ? 'Sprints' : 'Intervalos';
      const dist = [...new Set(corren.map(cuantoLargo).filter(Boolean))];
      const nombres = [...new Set(corren.filter((p) => p.ej).map((p) => p.ej.name))];
      detalle = !conDatos ? 'Sin datos todavía'
        : [nS > 1 ? `${nS} series` : null, veces ? `${veces} ${veces === 1 ? 'vez' : 'veces'}` : null, dist.join(' + '), nombres.join(', ')].filter(Boolean).join(' · ');
      falta = [
        corren.some((p) => !num(p.q)) && 'Falta la distancia o el tiempo',
        corren.some((p) => !fraseIntensidad(p)) && 'Falta la intensidad',
        pasos.some((p) => p.tipo === 'descanso' && !p.completo && !num(p.q)) && 'Falta cuánto dura el descanso',
        pasos.some((p) => p.tipo === 'caminar' && !num(p.q)) && 'Falta cuánto camina',
        !veces && 'Falta cuántas veces',
      ].filter(Boolean);
    } else if (deEjercicios) {
      titulo = x.nom;
      { const tcal = Array.isArray(x.sets) ? { sets: x.sets } : null;
        const n = tcal ? tcal.sets.length : 0;
        detalle = tcal ? (n ? `Ejercicios · ${n > 1 ? `${n} sets · ` : ''}${nombresTec(tcal)}${n === 1 && num(tcal.sets[0].veces) > 1 ? ` · ${tcal.sets[0].veces} veces` : ''}` : 'Ejercicios')
          : fraseItems(x.items) ? `Ejercicios · ${fraseItems(x.items)}` : 'Ejercicios'; }
      if (!(x.items?.length || x.sets?.some((st) => st.items.length))) falta = ['Faltan los ejercicios'];
    } else if (deVideo) {
      titulo = x.nom;
      // Sin video no hay duración que decir.
      const dur = !x.video?.url ? 0 : x.video.duracion ? Math.round(x.video.duracion / 60) : num(x.q);
      detalle = ['Guiado', x.video?.nombre, dur ? `${dur} min` : null].filter(Boolean).join(' · ');
      if (!x.video?.url) falta = ['Falta el video'];
    } else {
      titulo = x.nom;
      const como = comoDe(x);
      const conTabla = como === 'int';
      const prog = como === 'prog';
      const fr = fraseIntensidad(x);
      const deTrote = conForma(x);
      const dx = depDeParte(x, dep);
      detalle = !num(x.q) ? 'Sin datos todavía'
        : conTabla ? `${cuanto(x)} con intervalos`
          : prog ? `${cuanto(x)} ${dx.progresiva.toLowerCase()}`
            : `${cuanto(x)}${deTrote ? ` ${dx.deSuave}` : ''}${x.ej?.name && !deTrote ? ` · ${x.ej.name}` : ''}${fr ? ` ${fr}` : ''}`;
      // Como mucho dos avisos: más ya no se leen.
      falta = [!num(x.q) && 'Falta la distancia o el tiempo',
        ...(conTabla ? faltanInts(x) : prog ? faltanProg(x) : [!fr && 'Falta la intensidad'])].filter(Boolean).slice(0, 2);
    }
    return { x, titulo, detalle, falta, conDatos };
  };

  /** El interior de una pieza (Calentamiento, Intervalos y Carrera continua ya aprobados; no se tocan). Las piezas con tabla usan todo el ancho. */
  // En Triatlón, cada parte se pinta con las palabras, medidas y ejercicios de su deporte.
  const interiorDe = (x) => (x.dxp && !conForma(x) ? <DeporteCtx.Provider value={depDeParte(x, dep)}>{interiorBase(x)}</DeporteCtx.Provider> : interiorBase(x));
  const interiorBase = (x) => (
    <div style={{ maxWidth: (x.k === 'tr' && conInts(x)) || esSprintX(x) || x.k === 'tec' ? 'none' : 600 }}>
        {x.k === 'trans' ? (
          <CamposDeTransicion x={x} onCambio={(p) => parchea(x.id, (o) => ({ ...o, ...p }))} />
        ) : x.k === 'desc' ? (
          <CamposDeDescanso d={x} onCambio={(p) => parchea(x.id, (o) => ({ ...o, ...p }))} />
        ) : x.k === 'tec' ? (
          <CamposDeTecnica x={x} repertoire={repertoire} usados={usados.ejercicios} onEjercicioCreado={onEjercicioCreado} onCambio={(f) => parchea(x.id, f)} avisa={avisa} />
        ) : conForma(x) ? (
          <>
            <Fila rotulo={x.rol === 'calma' ? 'Cómo enfría' : 'Cómo calienta'}>
              {dep.id === 'tri' ? (
                // En Triatlón, el trote, la rodada o el nado es de un deporte (`dxp`); cambiarlo vacía la cantidad y la intensidad, que eran de otro deporte.
                <Segmentos opciones={FORMAS_CAL_TRI} etiqueta={x.rol === 'calma' ? 'Cómo enfría' : 'Cómo calienta'}
                  valor={(x.forma ?? 'trote') !== 'trote' ? x.forma : x.dxp === 'nado' || x.dxp === 'bici' ? x.dxp : 'trote'}
                  onCambio={(v) => parchea(x.id, (o) => (['nado', 'bici', 'trote'].includes(v)
                    ? { ...norm(o), forma: 'trote', dxp: v === 'trote' ? 'correr' : v, items: o.items ?? [], ...((o.dxp ?? 'correr') === (v === 'trote' ? 'correr' : v) ? {} : { q: '', u: v === 'nado' ? 'm' : 'min', modo: undefined, z: undefined, vals: {} }) }
                    : { ...norm(o), forma: v, items: o.items ?? [] }))} />
              ) : (
                <Segmentos opciones={[['trote', dep.suave], ...FORMAS_CAL.slice(1)]} valor={x.forma ?? 'trote'} etiqueta={x.rol === 'calma' ? 'Cómo enfría' : 'Cómo calienta'} onCambio={(forma) => parchea(x.id, (o) => ({ ...norm(o), forma, items: o.items ?? [] }))} />
              )}
            </Fila>
            {(x.forma ?? 'trote') === 'trote' && (
              <DeporteCtx.Provider value={depDeParte(x, dep)}>
                <CamposDeCarrera t={x} onCambio={(p) => parchea(x.id, (o) => ({ ...norm(o), ...p }))} rango={rango} rangoLargo={rangoLargo} />
              </DeporteCtx.Provider>
            )}
            {x.forma === 'video' && <CamposDeVideo t={x} calentamientos={calentamientos} categorias={categorias} nombreAtleta={nombreAtleta} onEjercicioCreado={onEjercicioCreado} onCambio={(p) => parchea(x.id, (o) => ({ ...norm(o), ...p }))} />}
            {x.forma === 'ejercicios' && <SetsDeEjercicios t={x} de={x.rol === 'calma' ? 'el enfriamiento' : 'el calentamiento'} repertoire={repertoire} usados={usados.ejercicios} onEjercicioCreado={onEjercicioCreado} onCambio={(c) => parchea(x.id, (o) => ({ ...norm(o), ...c }))} />}
          </>
        ) : x.k === 'tr' ? (
          <CamposDeCarrera t={x} conProgresivo={x.rol === 'continua'} conIntervalos={conInts(x)} siempreIntervalos={x.rol === 'int'} onCambio={(p) => parchea(x.id, (o) => ({ ...norm(o), ...p }))} rango={rango} rangoLargo={rangoLargo} limites={limites} avisa={avisa}
            repertoire={repertoire} usados={usados.intervalo} onEjercicioCreado={onEjercicioCreado} />
        ) : (
          esSprintX(x)
            ? <CamposDeSprints x={x} usados={usados.intervalo} repertoire={repertoire} onEjercicioCreado={onEjercicioCreado} onCambio={(f) => parchea(x.id, f)} rango={rango} rangoLargo={rangoLargo} limites={limites} avisa={avisa} />
            : <CamposDePasos x={x} esSprint={false} usados={usados.intervalo} repertoire={repertoire} onEjercicioCreado={onEjercicioCreado} onCambio={(f) => parchea(x.id, f)} rango={rango} rangoLargo={rangoLargo} limites={limites} avisa={avisa} />
        )}
    </div>
  );

  /** Mover, Duplicar, Borrar y «Listo». */
  const pieDe = (x, i, conListo) => (
    <div style={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', borderTop: `1px solid ${KP.line}`, marginTop: 6, paddingTop: 8 }}>
      {i > 0 && <BotonChico icono={ArrowUp} onClick={() => mueve(i, -1)}>Mover arriba</BotonChico>}
      {i < tramos.length - 1 && <BotonChico icono={ArrowDown} onClick={() => mueve(i, 1)}>Mover abajo</BotonChico>}
      <BotonChico icono={Copy} onClick={() => duplica(i)}>Duplicar</BotonChico>
      <BotonChico icono={Trash2} onClick={() => borra(x.id)} peligro>Borrar</BotonChico>
      {conListo && (
        <button type="button" onClick={termina} className="kp-press"
          style={{ marginLeft: 'auto', minHeight: 46, padding: '0 26px', border: 'none', borderRadius: 12, background: T.accent, color: '#fff', fontFamily: FONT, fontWeight: 800, fontSize: 15, cursor: 'pointer', boxShadow: KP.shBtn }}>
          Listo
        </button>
      )}
    </div>
  );

  /** El número de la pieza, en su riel: la línea gris une una con la siguiente para que se lea el orden. */
  const riel = (i, encendido) => (
    <span aria-hidden="true" style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
      {i < tramos.length - 1 && <i style={{ position: 'absolute', top: 30, bottom: -10, width: 2, background: '#D5D8DF' }} />}
      <b aria-hidden="true" style={{ position: 'relative', width: 30, height: 30, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 13.5, fontWeight: 800,
        background: encendido ? T.accent : UI.relleno, color: encendido ? '#fff' : T.text, transition: 'background .15s ease' }}>{i + 1}</b>
    </span>
  );
  /* LA PANTALLA COMPLETA, MÁS LIMPIA (Andrés, 20 nov 2026: «viendo la big picture, siento que está saturado»). Sin «✓ Listo» ni «Editando»
     en cada tarjeta: la abierta ya se ve azul, y lo que falta lo sigue diciendo el aviso ámbar «Falta…». */
  const estado = () => null;

  // Abrir una pieza; «Listo» la cierra, deja la lista a la vista y la pieza se ilumina un momento: así se ve que quedó.
  const abre = (id) => { setAbierto(id); setAgregando(false); };
  const termina = () => {
    const id = abierto;
    setAbierto(null);
    setRecien(id);
    setTimeout(() => setRecien((r) => (r === id ? null : r)), 1600);
    requestAnimationFrame(() => document.querySelector(`[data-pieza-boton="${id}"]`)?.focus({ preventScroll: true }));
  };
  const abiertoX = tramos.find((x) => x.id === abierto) ?? null;
  // (Un calentamiento con ejercicios o guiado no usa zonas, aunque guarde la de su trote.)
  const conZonas = !!abiertoX && !(conForma(abiertoX) && (abiertoX.forma ?? 'trote') !== 'trote') && abiertoX.k !== 'tec' && /"modo":"(zona|pulso)"/.test(JSON.stringify(abiertoX.k === 'tr' ? norm(abiertoX) : abiertoX));
  const iAbierto = abiertoX ? tramos.indexOf(abiertoX) : -1;

  // En Triatlón, cada parte lleva el ícono de su deporte junto al título (la transición, sus flechas).
  const iconoDeParte = (x) => {
    const Icono = x.k === 'trans' ? ArrowLeftRight : x.dxp && !conForma(x) ? ICONO_DE_PARTE[x.dxp] : null;
    return Icono ? <Icono size={16} strokeWidth={2.3} aria-hidden="true" style={{ flexShrink: 0, color: x.k === 'trans' ? T.text2 : T.text }} /> : null;
  };
  // A · LA LISTA A UN LADO. La lista numerada no se abre ni se cierra; la pieza que se edita va aparte (a la derecha, o en su hoja en pantallas angostas).
  const tarjetaDeLista = (x0, i) => {
    const r = resumen(x0);
    const editando = abierto === r.x.id;
    return (
      <div key={r.x.id} data-pieza={r.x.id} style={{ display: 'grid', gridTemplateColumns: '30px minmax(0, 1fr)', gap: 10 }}>
        {riel(i, editando)}
        <button type="button" data-pieza-boton={r.x.id} onClick={() => (editando ? termina() : abre(r.x.id))}
          aria-expanded={editando} aria-controls={editando ? `corre-${r.x.id}` : undefined}
          className={`kp-press${recien === r.x.id ? ' tl-corre-recien' : ''}`}
          style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', border: 'none', borderRadius: 14, padding: '11px 13px', textAlign: 'left', cursor: 'pointer', fontFamily: FONT, color: T.text, minHeight: 58,
            background: editando ? KP.blueSoft : FONDO_PIEZA, transition: 'background .15s ease' }}>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 7 }}>{iconoDeParte(r.x)}{r.titulo}</span>
              {estado(r, editando)}
            </span>
            {r.detalle && <span data-detalle style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', fontSize: 13.5, fontWeight: 600, color: T.text2, marginTop: 2, lineHeight: 1.35 }}>{r.detalle}</span>}
            {r.falta.length > 0 && !editando && <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: AMBAR_TEXTO, marginTop: 2 }}>{r.falta.join(' · ')}</span>}
          </span>
        </button>
      </div>
    );
  };
  const hojaDePieza = (enHoja) => {
    const r = resumen(abiertoX);
    return (
      <section id={`corre-${r.x.id}`} aria-label={r.titulo} className={enHoja ? undefined : 'tl-corre-entra'}
        style={{ background: T.bg2, padding: enHoja ? '14px 16px 16px' : '2px 0 6px 24px', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 12, borderBottom: `1px solid ${KP.line}`, marginBottom: 14 }}>
          <b aria-hidden="true" style={{ width: 32, height: 32, borderRadius: '50%', display: 'grid', placeItems: 'center', background: T.accent, color: '#fff', fontSize: 14, fontWeight: 800, flexShrink: 0 }}>{iAbierto + 1}</b>
          <span style={{ minWidth: 0 }}>
            {/* Sin el resumen debajo: ya está en la tarjeta de la izquierda (no se repite). */}
            <span style={{ display: 'block', fontSize: 18, fontWeight: 800, color: T.text }}>{r.titulo}</span>
          </span>
        </div>
        {!soloLectura && interiorDe(r.x)}
        {!soloLectura && pieDe(r.x, iAbierto, true)}
      </section>
    );
  };

  const botonAgregarPieza = (alTocar) => (
    <button ref={botonAgregar} type="button" onClick={alTocar} className="kp-press" aria-haspopup="dialog"
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 52, borderRadius: 14, border: 'none', background: T.accent, color: '#fff', fontFamily: FONT, fontWeight: 800, fontSize: 15.5, cursor: 'pointer', boxShadow: KP.shBtn, marginLeft: 40 }}>
      <Plus size={19} aria-hidden="true" /> Agregar
    </button>
  );
  // En la vista A ancha, «¿Qué sigue?» vive a la derecha cuando no hay pieza abierta; «Agregar» lo trae y le da el foco.
  const alPanel = () => { setAbierto(null); requestAnimationFrame(() => (document.querySelector('[data-opcion][data-sugerido="1"]') ?? document.querySelector('[data-opcion]'))?.focus()); };

  return (
    <DeporteCtx.Provider value={dep}>
    <div ref={caja} style={{ fontFamily: FONT }}>
    <style>{ESTILOS}</style>
    {deporte === 'bici' && (
      // DÓNDE SE RUEDA (Andrés, 20 nov 2026): una vez, para toda la sesión. Casi siempre es estática, por eso nace así.
      <div data-donde-se-rueda={dep.lugar} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 14, padding: '0 4px' }}>
        <span style={{ fontSize: 14, fontWeight: 800, color: T.text }}>Dónde se rueda</span>
        <div style={{ display: 'flex', width: 240 }}>
          <Segmentos opciones={[['estatica', 'Estática'], ['ruta', 'En ruta']]} valor={dep.lugar} etiqueta="Dónde se rueda" onCambio={(v) => !soloLectura && onLugar?.(v)} />
        </div>
      </div>
    )}
    {conResumen && (
      <section aria-label="Resumen del entreno" style={{ marginTop: 14, padding: '0 4px', fontFamily: FONT }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: T.text2 }}>Resumen del entreno</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: T.text2 }}>·</span>
          <span style={{ fontSize: 14, fontWeight: 800, color: T.text }}>{duracion(totalMin)}</span>
          {totalKm > 0 && <><span style={{ fontSize: 13, fontWeight: 700, color: T.text2 }}>·</span><span style={{ fontSize: 14, fontWeight: 800, color: T.text }}>{totalKm.toFixed(1)} km</span></>}
          <span style={{ fontSize: 12.5, fontWeight: 600, color: T.text3 }}>aprox.</span>
        </div>
        <div aria-hidden="true" style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 34, marginTop: 8, borderBottom: `2px solid ${KP.lineHi}` }}>
          {barras.map((b, i) => {
            const marcada = abierto;
            return (
              <span
                key={i} onClick={() => abre(b.id)}
                style={{ display: 'block', flex: `${Math.max(b.m, 0.4)} 1 0`, minWidth: 3, height: b.n ? `${b.n * 20}%` : '6%', background: b.c ?? (b.n ? COLOR_ZONA[Math.round(b.n) - 1] : KP.lineHi), borderRadius: '3px 3px 0 0', cursor: 'pointer',
                  opacity: marcada && marcada !== b.id ? 0.4 : 1, transition: 'height .2s ease, opacity .16s ease' }}
              />
            );
          })}
        </div>
        {/* Las zonas del atleta, solo cuando la pieza abierta se arma con zona o pulso: al armar técnica o sprints no se usan. */}
        {conZonas && <div style={{ fontSize: 12.5, fontWeight: 600, color: T.text2, marginTop: 6, lineHeight: 1.4 }}>
          {fcMax
            ? <>Zonas de <b style={{ color: T.text }}>{nombreAtleta || 'este atleta'}</b>: pulso máximo {fcMax.valor} pulsaciones{fcMax.metodo === 'por defecto' ? ' (aún sin datos suyos: se ajusta solo con sus entrenos)' : ''}.</>
            : 'Las zonas se ajustan al pulso máximo de cada atleta.'}
        </div>}
      </section>
    )}
    {/* La bandeja gris: solo las piezas del entreno. */}
    <div className="tl-corre" style={{ marginTop: conResumen ? 16 : 14, fontFamily: FONT }}>
      {vacio ? (!soloLectura && panel(false)) : dosColumnas ? (
        // Sin cajas dentro de cajas: la lista y la pieza van directo sobre la tarjeta de la sesión, separadas por una línea.
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 260px) minmax(0, 1fr)', alignItems: 'stretch' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingRight: 20, borderRight: `1px solid ${KP.line}` }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: T.text2, margin: '2px 2px 0' }}>El entreno, en orden</span>
            {tramos.map((x0, i) => tarjetaDeLista(x0, i))}
            {!soloLectura && botonAgregarPieza(alPanel)}
          </div>
          <div style={{ minWidth: 0 }}>
            {abiertoX ? hojaDePieza(false) : !soloLectura && <div style={{ paddingLeft: 16 }}>{panel(false, true)}</div>}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {tramos.map((x0, i) => tarjetaDeLista(x0, i))}
          {/* En una compu angosta, «¿Qué sigue?» va aquí mismo (antes no salía: era un error); en el teléfono, en su hoja. */}
          {!soloLectura && (agregando && esCompu ? <div data-panel-agregar style={{ marginLeft: 40 }}>{panel(false)}</div> : botonAgregarPieza(() => { setAgregando(true); setAbierto(null); }))}
        </div>
      )}
      {!soloLectura && !vacio && !esCompu && <HojaDeAgregar abierta={agregando} alCerrar={cierraAgregar}>{panel(true)}</HojaDeAgregar>}
      {/* A en pantallas angostas: la pieza entra de lado, en su propia pantalla, con «‹ Entreno» para volver (como en el iPhone). */}
      {!soloLectura && !vacio && !dosColumnas && abiertoX && (
        <PantallaDePieza alVolver={termina}>{hojaDePieza(true)}</PantallaDePieza>
      )}
    </div>
    </div>
    </DeporteCtx.Provider>
  );
}

/** «aletas y snorkel», «aletas, tabla y snorkel». */
const juntaY = (l = []) => (l.length < 2 ? (l[0] ?? '') : `${l.slice(0, -1).join(', ')} y ${l[l.length - 1]}`);

/* ---------------- Agregar ---------------- */

/* SIN «SUGERIDO» (Andrés, 21 nov 2026): la app ya no propone qué sigue; el coach elige. Cada opción conserva su forma de mosaico
   (Andrés: «este estilo me encanta»), en el azul claro de los Sets en lugar del gris. */
function PanelAgregar({ titulo, limites, onElige, onCerrar, enHoja, opciones, grupoInicial }) {
  const ref = useRef(null);
  /* TRIATLÓN: PRIMERO EL DEPORTE, LUEGO EL TIPO (Andrés lo pidió revisar con usability-psychologist, 20 nov 2026). La lista de 13 opciones
     repetía «Sprints» tres veces e «Intervalos» dos: fácil agregar unos sprints de carrera queriendo de bici. Arriba una barra Nado · Bici ·
     Carrera (la misma de «Cómo se corre»); abajo solo los tipos de ese deporte; al final, en botones chicos, lo que sirve para cualquiera.
     La barra abre en el deporte que toca por el orden de la prueba: lo normal sigue siendo un solo toque. */
  const grupos = [...new Set(opciones.map((op) => op.grupo).filter(Boolean))];
  const [grupo, setGrupo] = useState(grupoInicial ?? grupos[0]);
  // Si cambia el deporte que toca (se agregó una parte), la barra lo sigue.
  const [grupoAntes, setGrupoAntes] = useState(grupoInicial);
  if (grupoInicial !== grupoAntes) { setGrupoAntes(grupoInicial); if (grupoInicial) setGrupo(grupoInicial); }
  // Esc cierra; al abrirse, el foco va a la primera opción.
  useEffect(() => {
    if (!onCerrar) return undefined;
    const primero = ref.current?.querySelector('[data-opcion]');
    primero?.focus({ preventScroll: true });
    const tecla = (e) => { if (e.key === 'Escape') { e.preventDefault(); onCerrar(); } };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, [onCerrar]);
  const muestras = useMemo(() => Object.fromEntries(opciones.filter((op) => !op.icono).map((op) => { const t = op.tipo ?? op.id; return [op.id, t === 'int' ? MUESTRA_INT : t === 'series' ? MUESTRA_SERIES : op.crea()]; })), [opciones]);
  const tarjeta = (op) => {
    const tipo = op.tipo ?? op.id;
    return (
      <button key={op.id} type="button" onClick={() => onElige(op)} data-opcion={op.id} className="kp-press tl-opcion"
        style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', minHeight: 60, padding: '10px 12px', borderRadius: 14, border: 'none', textAlign: 'left', cursor: 'pointer', fontFamily: FONT,
          background: AZUL_SET, color: T.text }}>
        {(tipo === 'int' || tipo === 'sprint' || tipo === 'series') && <MiniGraficaDe op={op} x={muestras[op.id]} limites={limites} />}
        {op.icono && !op.grupo && op.id !== 'trans' && (
          <span aria-hidden="true" style={{ width: 40, height: 40, borderRadius: 11, display: 'grid', placeItems: 'center', flexShrink: 0, background: op.gris ? '#fff' : T.text, color: op.gris ? T.text2 : '#fff' }}>
            <op.icono size={20} strokeWidth={2.2} />
          </span>
        )}
        <span style={{ flex: 1, minWidth: 0 }}>
          <b style={{ display: 'block', fontSize: 15, fontWeight: 800 }}>{op.titulo}</b>
          <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: T.text2, marginTop: 2 }}>{op.ej}</span>
        </span>
        <Plus size={18} color={T.accent} aria-hidden="true" style={{ flexShrink: 0 }} />
      </button>
    );
  };
  const bloque = (lista) => (
    <div data-opciones style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{lista.map((op) => tarjeta(op))}</div>
  );
  return (
    <div ref={ref} role={onCerrar ? 'dialog' : undefined} aria-label={titulo} className={enHoja ? 'tl-corre-hoja' : 'tl-corre-entra'}
      style={{ background: 'transparent', borderRadius: 18, padding: enHoja ? '4px 16px 16px' : '6px 2px 4px', fontFamily: FONT }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 10px', paddingLeft: 4 }}>
        <span style={{ flex: 1, fontSize: 16.5, fontWeight: 800, color: T.text, letterSpacing: -0.2 }}>{titulo}</span>
        {onCerrar && (
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="kp-press"
            style={{ width: 44, height: 44, borderRadius: 12, border: 'none', background: UI.relleno, color: T.text2, display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <X size={18} />
          </button>
        )}
      </div>
      {grupos.length ? (() => {
        const generales = opciones.filter((op) => !op.grupo);
        return (
          <>
            <div data-deportes={grupo} style={{ display: 'flex', marginBottom: 10 }}>
              <Segmentos etiqueta="Deporte" valor={grupo} onCambio={setGrupo}
                opciones={grupos.map((g) => { const I = ICONO_DE_GRUPO[g]; return [g, <span key={g} style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>{I && <I size={16} strokeWidth={2.3} aria-hidden="true" />}{g}</span>]; })} />
            </div>
            {bloque(opciones.filter((op) => op.grupo === grupo))}
            <div style={{ fontSize: 13, fontWeight: 700, color: T.text2, margin: '14px 4px 8px' }}>Para cualquier deporte</div>
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
              {generales.map((op) => (
                <button key={op.id} type="button" onClick={() => onElige(op)} data-opcion={op.id} className="kp-press" aria-label={`${op.titulo}: ${op.ej}`}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 7, minHeight: 44, padding: '0 14px', borderRadius: 12, border: 'none', cursor: 'pointer', fontFamily: FONT, fontWeight: 800, fontSize: 14, background: AZUL_SET, color: T.text }}>
                  {op.icono && <op.icono size={16} strokeWidth={2.3} aria-hidden="true" color={T.text2} />}{op.titulo}
                </button>
              ))}
            </div>
          </>
        );
      })() : (
        bloque(opciones)
      )}
      <div style={{ fontSize: 13, fontWeight: 600, color: T.text2, margin: '10px 0 0 4px' }}>Todo se puede cambiar después.</div>
    </div>
  );
}

// La forma de unas series de nado, solo para el dibujo de «Agregar»: varias iguales, con un descanso corto.
const MUESTRA_SERIES = { id: 'muestra-series', k: 'int', rol: 'series', estilo: 'sprint', modo: 'zona', z: 4, vals: {}, filas: [1, 2, 3, 4].map((n) => ({ id: `s${n}`, q: '100', u: 'm', dq: '20', du: 's' })) };
// La forma de unos intervalos, solo para el dibujo de «Agregar» (la pieza nace vacía).
const MUESTRA_INT = { id: 'muestra-int', k: 'tr', rol: 'int', q: '4', u: 'km', vals: {}, ints: { repite: true, modo: 'zona', lista: [{ id: 'a', q: '400', u: 'm', modo: 'zona', z: 4, vals: {} }, { id: 'b', q: '400', u: 'm', modo: 'zona', z: 2, vals: {} }] } };
/** La gráfica chica de una opción, con el ritmo de su deporte (en Triatlón, el de su grupo). */
function MiniGraficaDe({ op, x, limites }) {
  const dep = useDeporte();
  const dxp = op.grupo ? { Nado: 'nado', Bici: 'bici', Carrera: 'correr' }[op.grupo] : null;
  return dxp ? <DeporteCtx.Provider value={depDeParte({ dxp }, dep)}><MiniGrafica x={x} limites={limites} /></DeporteCtx.Provider> : <MiniGrafica x={x} limites={limites} />;
}
function MiniGrafica({ x, limites }) {
  const dep = useDeporte();
  const b = barrasDe(x, limites, dep.pace);
  return (
    <span aria-hidden="true" style={{ width: 48, height: 28, display: 'flex', alignItems: 'flex-end', gap: 1, flexShrink: 0, borderBottom: `2px solid ${KP.lineHi}` }}>
      {b.map((y, i) => (
        <i key={i} style={{ display: 'block', flex: `${Math.max(y.m, 0.5)} 1 0`, minWidth: 1, height: y.n ? `${y.n * 20}%` : '6%', background: y.c ?? (y.n ? COLOR_ZONA[Math.round(y.n) - 1] : 'transparent'), borderRadius: '2px 2px 0 0' }} />
      ))}
    </span>
  );
}

/** En el teléfono, «Agregar» sube como hoja desde abajo (la misma de Entrenar: se cierra tocando fuera o deslizando). */
function HojaDeAgregar({ abierta, alCerrar, children }) {
  const montada = useSigueMontado(abierta);
  if (!montada) return null;
  return <HojaMontada abierta={abierta} alCerrar={alCerrar}>{children}</HojaMontada>;
}
function HojaMontada({ abierta, alCerrar, children }) {
  const { hoja, velo } = useHojaDeslizable({ abierta, alCerrar });
  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 3300, fontFamily: FONT, display: 'flex', alignItems: 'flex-end', ...(abierta ? {} : { pointerEvents: 'none' }) }}>
      <style>{ESTILOS}</style>
      <div ref={velo} aria-hidden="true" onClick={alCerrar} style={{ position: 'absolute', inset: 0, background: 'rgba(17,19,24,0.32)' }} />
      <div ref={hoja}
        className="animate-sheet"
        style={{ position: 'relative', width: '100%', boxSizing: 'border-box', background: T.bg2, borderRadius: '24px 24px 0 0', maxHeight: 'calc(100% - max(46px, env(safe-area-inset-top) + 12px))', overflowY: 'auto', overscrollBehavior: 'contain', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div aria-hidden="true" style={{ width: 38, height: 5, borderRadius: 3, background: '#D5D8DF', margin: '8px auto 6px' }} />
        {children}
      </div>
    </div>,
    document.body,
  );
}

/** A en el teléfono (Andrés: «no me encanta que se abra desde abajo»): la pieza entra desde la derecha a pantalla completa, como una pantalla
    más del iPhone. Arriba, «‹ Entreno» regresa a la lista (igual que «Listo»). Esc también regresa. */
function PantallaDePieza({ alVolver, children }) {
  useEffect(() => {
    // Esc regresa, salvo que haya una lista abierta adentro (Esc cierra primero esa lista).
    const tecla = (e) => { if (e.key === 'Escape' && !document.querySelector('.tl-corre-lado [role="menu"]')) { e.preventDefault(); alVolver(); } };
    document.addEventListener('keydown', tecla);
    const antes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', tecla); document.body.style.overflow = antes; };
  }, [alVolver]);
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Pieza del entreno" className="tl-corre tl-corre-lado"
      style={{ position: 'fixed', inset: 0, zIndex: 3300, background: T.bg2, display: 'flex', flexDirection: 'column', fontFamily: FONT }}>
      <style>{ESTILOS}</style>
      <div style={{ display: 'flex', alignItems: 'center', minHeight: 52, padding: 'env(safe-area-inset-top) 8px 0', borderBottom: `1px solid ${KP.line}`, flexShrink: 0 }}>
        <button type="button" onClick={alVolver} className="kp-press"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 2, minHeight: 44, padding: '0 10px 0 4px', border: 'none', background: 'transparent', color: T.accent, fontFamily: FONT, fontWeight: 800, fontSize: 16, cursor: 'pointer' }}>
          <ChevronDown size={22} aria-hidden="true" style={{ transform: 'rotate(90deg)' }} /> Entreno
        </button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'contain', paddingBottom: 'env(safe-area-inset-bottom)' }}>{children}</div>
    </div>,
    document.body,
  );
}

/* ---------------- Las piezas por dentro ---------------- */

/** «Más opciones»: un solo enlace que abre lo que no se usa a cada rato. Lo que ya se usó se queda a la vista (lo decide quien lo pinta). */
function MasOpciones({ opciones }) {
  const [abierto, setAbierto] = useState(false);
  const libres = opciones.filter((o) => !o.activo);
  if (!libres.length) return null;
  return (
    <div style={{ marginTop: 2 }}>
      {abierto ? (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '4px 0' }}>
          {libres.map((o) => (
            <button key={o.id} type="button" onClick={() => { o.activar(); setAbierto(false); }} className="kp-press"
              style={{ border: 'none', borderRadius: 11, minHeight: 40, padding: '0 12px', background: UI.relleno, color: T.text, fontFamily: FONT, fontWeight: 700, fontSize: 13.5, cursor: 'pointer' }}>
              + {o.label}
            </button>
          ))}
        </div>
      ) : (
        <BotonTexto gris onClick={() => setAbierto(true)}>Más opciones</BotonTexto>
      )}
    </div>
  );
}

/** LO QUE SE AGREGA DESDE «MÁS OPCIONES» (Andrés, 19 nov 2026: «funciona perfectamente; el único defecto es que cuando aparece en el
    editor para que agregues los datos se ve feo»). Con el mismo lenguaje que las partes de Sprints: su ícono en un círculo, su título en
    negrita y lo que se llena debajo, alineado. «Quitar» a la derecha, con su X. Entra con un movimiento suave. */
const ICONO_EXTRA = {
  Progresiva: TrendingUp, 'Tiempo límite': Timer, Caminadora: Gauge, Cadencia: Footprints, 'Nota para el atleta': StickyNote,
  Nombre: Pencil, 'Material o terreno': Mountain, 'En series': Repeat, Resistencia: Gauge, 'Sentado o de pie': Armchair, Terreno: Mountain, Ejercicio: PlayCircle,
  // Clase (20 nov 2026; ver `EditorDeClase`).
  Calentamiento: Flame, Enfriamiento: Snowflake, Portada: ImageIcon, 'Lo que necesita': Package, 'Nota para el alumno': StickyNote,
};
export function Extra({ rotulo, onQuitar, children }) {
  const dep = useDeporte();
  // La cadencia de la bici no son pasos: su ícono es la bici.
  const Icono = (rotulo === 'Cadencia' && dep.id === 'bici' ? Bike : ICONO_EXTRA[rotulo]) ?? Plus;
  return (
    <div className="tl-corre-entra" data-extra={rotulo} style={{ display: 'grid', gridTemplateColumns: '28px minmax(0, 1fr)', columnGap: 12, margin: '4px 0 18px' }}>
      <span aria-hidden="true" style={{ width: 28, height: 28, borderRadius: '50%', display: 'grid', placeItems: 'center', background: KP.blueSoft, color: T.accent }}>
        <Icono size={15} strokeWidth={2.4} />
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 28, marginBottom: 10 }}>
          <span style={{ flex: 1, fontSize: 16, fontWeight: 800, color: T.text }}>{rotulo}</span>
          <button type="button" onClick={onQuitar} aria-label={`Quitar ${rotulo}`} className="kp-press"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: 'none', background: 'transparent', color: T.text2, fontFamily: FONT, fontWeight: 700, fontSize: 13, minHeight: 32, padding: '0 6px', cursor: 'pointer' }}>
            <X size={14} strokeWidth={2.4} aria-hidden="true" /> Quitar
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Una carrera (calentamiento trotando, carrera continua, enfriamiento, intervalos): el total y la intensidad, nada más a la vista.
    Con intervalos (la pieza «Intervalos», o «+ Agregar intervalos» en Carrera continua), la intensidad general se va: cada renglón lleva la suya. */
function CamposDeCarrera({ t, onCambio, rango, rangoLargo, conProgresivo = false, conIntervalos = false, siempreIntervalos = false, limites = [0, 0, 0, 0], avisa, repertoire = [], usados = new Set(), onEjercicioCreado }) {
  const dep = useDeporte();
  const [abiertos, setAbiertos] = useState({});
  const abre = (k) => setAbiertos((a) => ({ ...a, [k]: true }));
  const cierra = (k, p) => { setAbiertos((a) => ({ ...a, [k]: false })); onCambio(p); };
  const ver = (k, hay) => hay || abiertos[k];
  // LA CARRERA CONTINUA tiene tres zonas (19 nov 2026): el total, «Cómo se corre» (Constante, Progresiva o Con intervalos) y «Para toda la
  // carrera» (cadencia, caminadora, tiempo límite, nota). El lugar dice a qué se aplica cada cosa.
  const esContinua = conProgresivo;
  const como = siempreIntervalos ? 'int' : esContinua ? comoDe(t) : 'uno';
  const conTabla = conIntervalos && como === 'int';
  const prog = esContinua && como === 'prog';
  const verLimite = !conTabla && !prog && ver('limite', !!t.limS) && (t.u === 'm' || t.u === 'km');
  // La intensidad que ya eligió para la carrera pasa a la tabla: su forma, al encabezado; sus valores, al renglón para completar.
  const empieza = () => ({ ints: { repite: true, modo: t.modo, lista: [filaInt(t.modo), filaInt(t.modo)], fin: { z: t.z, vals: t.vals ?? {} } }, cambios: undefined, formato: undefined });
  const ponComo = (c) => {
    if (c === como) return;
    if (c === 'int') onCambio({ como: 'int', ...(intsDe(t)?.lista?.length ? {} : empieza()) });
    else if (c === 'prog') {
      // La progresiva arranca con la forma de intensidad que ya tenía la carrera (o pace).
      const g = t.prog?.modo || t.prog?.lista ? progDe(t) : { modo: dep.modosProg.includes(t.modo) ? t.modo : dep.modosProg[0], ini: {}, fin: {}, cada: { q: '', u: t.u === 'min' || t.u === 's' ? 'min' : dep.id === 'nado' ? 'm' : 'km' }, lista: [] };
      onCambio({ como: 'prog', prog: g, formato: undefined });
    } else onCambio({ como: 'uno', formato: undefined });
  };
  // Cambiar el total vuelve a repartir los tramos de la progresiva.
  const cambiaTotal = (p) => {
    const base = p.u && p.u !== 'm' && p.u !== 'km' ? { ...p, limS: null } : p;
    if (!prog) { onCambio(base); return; }
    const g = progDe(t); const lista = generaTramos({ ...t, ...base }, g);
    onCambio({ ...base, prog: { ...g, lista: lista ?? g.lista } });
  };
  const barras = (conTabla || prog) && num(t.q) ? barrasDe({ ...t, como }, limites, dep.pace) : [];
  // Lo de «Para toda la…» cambia con el deporte: caminadora en Running; resistencia, postura o terreno en Cycling; el estilo en Swimming.
  const bici = dep.id === 'bici'; const nado = dep.id === 'nado'; const estatica = bici && dep.lugar !== 'ruta';
  const opciones = [
    ...(nado && esContinua ? [{ id: 'ej', label: 'Ejercicio', activo: ver('ej', !!t.ej), activar: () => abre('ej') }] : []),
    ...(!conTabla && !prog && (t.u === 'm' || t.u === 'km') ? [{ id: 'limite', label: 'Tiempo límite', activo: verLimite, activar: () => abre('limite') }] : []),
    ...(dep.cadencia ? [{ id: 'cad', label: 'Cadencia', activo: ver('cad', !!t.cad), activar: () => abre('cad') }] : []),
    ...(dep.id === 'correr' ? [{ id: 'cam', label: 'Caminadora', activo: ver('cam', !!t.cam), activar: () => { abre('cam'); onCambio({ cam: t.cam ?? {} }); } }] : []),
    ...(estatica ? [{ id: 'res', label: 'Resistencia', activo: ver('res', !!t.res), activar: () => abre('res') }] : []),
    ...(estatica ? [{ id: 'pos', label: 'Sentado o de pie', activo: ver('pos', !!t.pos), activar: () => { abre('pos'); onCambio({ pos: t.pos ?? 'sentado' }); } }] : []),
    ...(bici && !estatica ? [{ id: 'ter', label: 'Terreno', activo: ver('ter', !!t.ter), activar: () => { abre('ter'); onCambio({ ter: t.ter ?? 'plano' }); } }] : []),
    { id: 'nota', label: esContinua ? 'Nota' : 'Nota para el atleta', activo: ver('nota', !!t.nota), activar: () => abre('nota') },
    { id: 'nom', label: esContinua ? 'Nombre' : 'Cambiar el nombre', activo: ver('nom', false), activar: () => abre('nom') },
  ];
  const extras = (
    <>
      {ver('ej', !!t.ej) && nado && (
        <Extra rotulo="Ejercicio" onQuitar={() => cierra('ej', { ej: undefined })}>
          <EjercicioDeIntervalo grande ej={t.ej} usados={usados} repertoire={repertoire} onEjercicioCreado={onEjercicioCreado} onCambio={(ej) => onCambio({ ej })} />
        </Extra>
      )}
      {verLimite && <Extra rotulo="Tiempo límite" onQuitar={() => cierra('limite', { limS: null })}><TiempoMinSeg segundos={t.limS} onCambio={(limS) => onCambio({ limS })} /></Extra>}
      {ver('cad', !!t.cad) && dep.cadencia && <Extra rotulo="Cadencia" onQuitar={() => cierra('cad', { cad: undefined })}><Cadencia valor={t.cad} onCambio={(cad) => onCambio({ cad })} /></Extra>}
      {ver('cam', !!t.cam) && <Extra rotulo="Caminadora" onQuitar={() => cierra('cam', { cam: undefined })}><Caminadora cam={t.cam ?? {}} onCambio={(cam) => onCambio({ cam })} /></Extra>}
      {ver('res', !!t.res) && estatica && (
        <Extra rotulo="Resistencia" onQuitar={() => cierra('res', { res: undefined })}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Corto>Nivel</Corto>
            <input value={t.res ?? ''} onChange={(e) => onCambio({ res: e.target.value.replace(/[^\d.,]/g, '').slice(0, 4) })} inputMode="decimal" placeholder="8" aria-label="Nivel de resistencia" style={{ ...CAMPO, width: 80, textAlign: 'center', fontSize: 20 }} />
            <Corto>el que marca la bici</Corto>
          </div>
        </Extra>
      )}
      {ver('pos', !!t.pos) && estatica && (
        <Extra rotulo="Sentado o de pie" onQuitar={() => cierra('pos', { pos: undefined })}>
          <div style={{ display: 'flex', maxWidth: 320 }}><Segmentos opciones={[['sentado', 'Sentado'], ['pie', 'De pie'], ['alterna', 'Alternando']]} valor={t.pos} etiqueta="Sentado o de pie" onCambio={(pos) => onCambio({ pos })} /></div>
        </Extra>
      )}
      {ver('ter', !!t.ter) && bici && !estatica && (
        <Extra rotulo="Terreno" onQuitar={() => cierra('ter', { ter: undefined })}>
          <div style={{ display: 'flex', maxWidth: 320 }}><Segmentos opciones={[['plano', 'Plano'], ['subida', 'Subida'], ['mixto', 'Mixto']]} valor={t.ter} etiqueta="Terreno" onCambio={(ter) => onCambio({ ter })} /></div>
        </Extra>
      )}
      {ver('nota', !!t.nota) && <Extra rotulo="Nota para el atleta" onQuitar={() => cierra('nota', { nota: '' })}><Texto valor={t.nota} onCambio={(nota) => onCambio({ nota })} ejemplo="En pista, carril 1" etiqueta="Nota para el atleta" /></Extra>}
      {ver('nom', false) && <Extra rotulo="Nombre" onQuitar={() => setAbiertos((a) => ({ ...a, nom: false }))}><Texto valor={t.nom} onCambio={(nom) => onCambio({ nom })} ejemplo="Fondo" etiqueta="Nombre" /></Extra>}
    </>
  );
  if (!esContinua) {
    return (
      <>
        {barras.length > 1 && <GraficaGrande barras={barras} />}
        <Fila rotulo={conTabla ? dep.total : 'Distancia o tiempo'} seccion={conTabla ? KP.lineHi : null}>
          {(id) => <Cantidad id={id} valor={t.q} unidad={t.u} unidades={dep.unidades} marca={t.id} ritmo={ritmoDe(t) || dep.pace[(t.z || 2) - 1]} onCambio={cambiaTotal} />}
        </Fila>
        {conTabla ? (
          <>
            <div aria-hidden="true" style={{ height: 1, background: KP.line, margin: '2px 0 14px' }} />
            <TablaDeIntervalos t={t} siempre={siempreIntervalos} onCambio={onCambio} limites={limites} rango={rango} avisa={avisa} />
          </>
        ) : (
          <Fila><Intensidad t={t} onCambio={onCambio} rango={rango} rangoLargo={rangoLargo} /></Fila>
        )}
        {extras}
        <MasOpciones opciones={opciones} />
      </>
    );
  }
  return (
    <>
      {barras.length > 1 && <GraficaGrande barras={barras} />}
      <Fila rotulo={dep.total} seccion={KP.lineHi}>
        {(id) => <Cantidad id={id} valor={t.q} unidad={t.u} unidades={dep.unidades} marca={t.id} ritmo={ritmoDe(t) || dep.pace[(t.z || 2) - 1]} onCambio={cambiaTotal} />}
      </Fila>
      <div aria-hidden="true" style={{ height: 1, background: KP.line, margin: '2px 0 16px' }} />
      <Seccion color={T.accent}>{dep.como}</Seccion>
      <div data-como-se-corre={como} style={{ marginBottom: 16, display: 'flex', maxWidth: 480 }}>
        <Segmentos opciones={[['uno', 'Constante'], ['prog', dep.progresiva], ['int', 'Con intervalos']]} valor={como} etiqueta={dep.como} onCambio={ponComo} />
      </div>
      {como === 'int' ? (
        <TablaDeIntervalos t={t} siempre onCambio={onCambio} limites={limites} rango={rango} avisa={avisa} sinTitulo />
      ) : como === 'prog' ? (
        <TablaProgresiva t={t} onCambio={onCambio} limites={limites} rango={rango} avisa={avisa} />
      ) : (
        <Fila><Intensidad t={t} onCambio={onCambio} rango={rango} rangoLargo={rangoLargo} /></Fila>
      )}
      <div data-toda-la-carrera="1" style={{ marginTop: 18 }}>
        <Seccion color={T.accent}>{dep.todo}</Seccion>
        {extras}
        <ChipsDeOpciones opciones={opciones} />
      </div>
    </>
  );
}

/** Lo que se puede agregar a toda la carrera, siempre a la vista (en la Carrera continua ya no hay «Más opciones» escondido). */
export function ChipsDeOpciones({ opciones }) {
  const libres = opciones.filter((o) => !o.activo);
  if (!libres.length) return null;
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '2px 0 8px' }}>
      {libres.map((o) => (
        <button key={o.id} type="button" onClick={o.activar} className="kp-press"
          style={{ border: 'none', borderRadius: 11, minHeight: 42, padding: '0 14px', background: UI.relleno, color: T.text, fontFamily: FONT, fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>
          + {o.label}
        </button>
      ))}
    </div>
  );
}

/** PROGRESIVA (acordado con Andrés en imágenes, 19 nov 2026). Arriba, tres casillas con su nombre: la intensidad (Pace, Zona, Esfuerzo o
    Pulso), «Empieza en → Termina en» (con rango: «5:30 a 5:40») y «Cada». Con eso la lista de tramos se llena sola; cada tramo se puede
    cambiar (distancia, unidad e intensidad) y quedan disparejos. Es la misma tabla de Intervalos, sin «repetir». */
function TablaProgresiva({ t, onCambio, limites, rango, avisa }) {
  const dep = useDeporte();
  const g = progDe(t);
  const [menu, setMenu] = useState(false);
  const foco = useRef(null);
  useEffect(() => {
    if (!foco.current) return;
    document.querySelector(`[data-int-q="${foco.current}"]`)?.focus();
    foco.current = null;
  });
  const pon = (n) => onCambio({ prog: n, como: 'prog', formato: undefined });
  // Cambiar algo de arriba vuelve a llenar la lista.
  const ponArriba = (c) => { const n = { ...g, ...c }; const lista = generaTramos(t, n); pon({ ...n, lista: lista ?? n.lista }); };
  const cambiaFila = (id, c) => pon({ ...g, lista: g.lista.map((f) => (f.id === id ? { ...f, ...c } : f)) });
  const agrega = () => { const ult = g.lista[g.lista.length - 1]; const n = { ...(ult ? JSON.parse(JSON.stringify(ult)) : { q: '', u: g.cada?.u ?? 'km', modo: g.modo }), id: nuevoId() }; foco.current = n.id; pon({ ...g, lista: [...g.lista, n] }); };
  const colorDe = (f) => { const q = norm({ ...f, modo: g.modo, rol: 'continua' }); return fraseIntensidad(q) ? nivel(q, limites) : 0; };
  // ¿Los tramos suman el total? Solo se dice si no (y si todo está en la misma clase de unidad).
  const tu = tipoUnidad(t.u);
  const suma = g.lista.every((f) => num(f.q) && tipoUnidad(f.u) === tu) ? g.lista.reduce((a, f) => a + num(f.q) * enBase[f.u], 0) : null;
  const total = num(t.q) * (enBase[t.u] ?? 0);
  const descuadre = suma != null && total && Math.abs(suma - total) > 1e-6 ? restoEnUnidad(suma, tu === 'dist' ? 'km' : 'min') : null;
  const sufijo = { rpe: 'de 10', pulso: 'pulsaciones', w: 'W', ritmo100: 'por 100 m' }[g.modo];
  const modos = dep.modosProg.map((m) => [m, NOMBRE_MODO[m]]);
  const rotulo = (r) => <span style={{ fontSize: 12.5, fontWeight: 700, color: T.text2 }}>{r}</span>;
  const columna = (r, hijo) => <span style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>{rotulo(r)}{hijo}</span>;
  const CAJA = { ...CELDA, minHeight: 46, borderRadius: 12, fontSize: 17 };
  const filas = g.lista.map((f, i) => ({ ...f, modo: g.modo, n: i + 1 }));
  const COLS = '22px 92px minmax(0, 1fr) 32px';
  return (
    <div className="tl-int" style={{ marginBottom: 6 }}>
      <div className="tl-int-rejilla">
        <div style={{ minWidth: 0 }}>
          <div data-prog-arriba="1" style={{ display: 'flex', alignItems: 'flex-end', columnGap: 18, rowGap: 12, flexWrap: 'wrap', margin: '0 0 16px' }}>
            {columna('Intensidad', (
              <ListaQueBaja valor={g.modo} opciones={modos} abierto={menu} setAbierto={setMenu} anchoMin={160}
                onElige={(m) => ponArriba({ modo: m, ini: {}, fin: {}, lista: g.lista.map((f) => ({ ...f, modo: m, z: undefined, vals: {} })) })}
                etiqueta={`Intensidad de la progresiva: ${NOMBRE_MODO[g.modo]}`}
                estiloBoton={{ ...CAJA, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0 12px', fontSize: 14.5 }}
                contenido={<>{NOMBRE_MODO[g.modo]}<ChevronDown size={14} aria-hidden="true" /></>} />
            ))}
            {/* «Empieza en → Termina en» van juntos: si no cabe la fila, bajan los dos, nunca la flecha sola. */}
            <span style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
              {columna('Empieza en', <CeldaIntensidad grande p={{ ...g.ini, modo: g.modo }} modo={g.modo} nombre="empieza" rango={rango} onCambio={(v) => ponArriba({ ini: { ...g.ini, ...v } })} />)}
              <ArrowRight size={20} color={T.text3} aria-hidden="true" style={{ marginBottom: 13, flexShrink: 0 }} />
              {columna('Termina en', <CeldaIntensidad grande p={{ ...g.fin, modo: g.modo }} modo={g.modo} nombre="termina" rango={rango} onCambio={(v) => ponArriba({ fin: { ...g.fin, ...v } })} />)}
              {sufijo && <span style={{ fontSize: 14, fontWeight: 700, color: T.text2, marginBottom: 13, whiteSpace: 'nowrap' }}>{sufijo}</span>}
            </span>
            {columna('Cada', (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <input value={g.cada?.q ?? ''} onChange={(e) => ponArriba({ cada: { u: 'km', ...g.cada, q: e.target.value.replace(/[^\d.,]/g, '').slice(0, 5) } })} inputMode="decimal"
                  aria-label="Cada cuánto cambia" style={{ ...CAJA, width: 60 }} />
                <ListaQueBaja valor={g.cada?.u ?? 'km'} opciones={dep.unidades} anchoMin={110} onElige={(u) => ponArriba({ cada: { q: '', ...g.cada, u } })}
                  etiqueta={`Unidad de cada tramo: ${unidadTexto(g.cada?.u ?? 'km')}`}
                  estiloBoton={{ ...CAJA, display: 'inline-flex', alignItems: 'center', gap: 4, padding: '0 10px', fontSize: 14.5 }}
                  contenido={<>{unidadTexto(g.cada?.u ?? 'km')}<ChevronDown size={14} aria-hidden="true" /></>} />
              </span>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: COLS, gap: 4, alignItems: 'center', padding: '0 0 4px' }}>
            <span />{rotulo('Tramo')}{rotulo(NOMBRE_MODO[g.modo])}<span />
          </div>
          {g.lista.map((f, i) => (
            <div key={f.id} data-prog-tramo={i + 1} style={{ display: 'grid', gridTemplateColumns: COLS, gap: 4, alignItems: 'center', padding: '7px 0', borderTop: `1px solid ${KP.line}` }}>
              <Numero n={i + 1} nivel={colorDe(f)} />
              <span style={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0 }}>
                <input data-int-q={f.id} value={f.q ?? ''} onChange={(e) => cambiaFila(f.id, { q: e.target.value.replace(/[^\d.,]/g, '').slice(0, 6) })} inputMode="decimal"
                  aria-label={`Distancia o tiempo del tramo ${i + 1}`} style={{ ...CELDA, width: 48 }} />
                <MenuUnidad valor={f.u} etiqueta={`Unidad del tramo ${i + 1}`} onCambio={(u) => cambiaFila(f.id, { u })} />
              </span>
              <CeldaIntensidad p={f} modo={g.modo} nombre={`tramo ${i + 1}`} rango={rango} onCambio={(v) => cambiaFila(f.id, v)} />
              <MenuDePaso ancho={32} nombre={`tramo ${i + 1}`} acciones={{
                arriba: i > 0 ? () => { const k = [...g.lista]; [k[i - 1], k[i]] = [k[i], k[i - 1]]; pon({ ...g, lista: k }); } : null,
                abajo: i < g.lista.length - 1 ? () => { const k = [...g.lista]; [k[i + 1], k[i]] = [k[i], k[i + 1]]; pon({ ...g, lista: k }); } : null,
                duplicar: () => pon({ ...g, lista: [...g.lista.slice(0, i + 1), { ...JSON.parse(JSON.stringify(f)), id: nuevoId() }, ...g.lista.slice(i + 1)] }),
                borrar: () => { const antes = t.prog; pon({ ...g, lista: g.lista.filter((_, k) => k !== i) }); avisa?.('Se borró', { accion: { texto: 'Deshacer', alTocar: () => onCambio({ prog: antes }) } }); },
              }} />
            </div>
          ))}
          <div style={{ borderTop: `1px solid ${KP.line}`, paddingTop: 2 }}>
            <BotonTexto onClick={agrega}>+ Agregar tramo</BotonTexto>
          </div>
          {!g.lista.length && <Ayuda>Llena «Empieza en», «Termina en» y «Cada», y los tramos salen solos.</Ayuda>}
          {descuadre && <div style={{ fontSize: 13, fontWeight: 700, color: AMBAR_TEXTO, margin: '4px 0 8px' }}>{`Los tramos suman ${descuadre.q} ${unidadTexto(descuadre.u)}; el total es ${t.q} ${unidadTexto(t.u)}.`}</div>}
        </div>
        {g.lista.some((f) => num(f.q)) && <AsiLoVera t={t} filas={filas} intervalos={filas.length} limites={limites} encabezado={[num(t.q) ? `${t.q} ${unidadTexto(t.u)}` : null, dep.progresiva.toLowerCase()].filter(Boolean).join(' · ')} />}
      </div>
    </div>
  );
}

function TablaDeIntervalos({ t, siempre, onCambio, limites, rango, avisa, sinTitulo = false }) {
  const ints = intsDe(t) ?? { repite: true, lista: [] };
  const lista = ints.lista ?? [];
  const modo = modoDeInts(ints);
  const fin = finDe(t, ints);
  const [menu, setMenu] = useState(false);
  // El renglón nuevo recibe el cursor en su distancia.
  const foco = useRef(null);
  useEffect(() => {
    if (!foco.current) return;
    document.querySelector(`[data-int-q="${foco.current}"]`)?.focus();
    foco.current = null;
  });
  const base = { ...ints, modo, fin, lista };
  // Sin renglones, la Carrera continua vuelve a ser una carrera con su intensidad (la del renglón para completar). La pieza Intervalos no.
  const pon = (n) => {
    if (!siempre && !n.lista.length) { onCambio({ ints: undefined, cambios: undefined, formato: undefined, modo: n.modo, z: n.fin?.z, vals: n.fin?.vals ?? {} }); return; }
    onCambio({ ints: n, cambios: undefined, formato: undefined });
  };
  const cambiaFila = (id, c) => pon({ ...base, lista: lista.map((p) => (p.id === id ? { ...p, ...c } : p)) });
  const ponModo = (m) => { setMenu(false); pon({ ...base, modo: m, lista: lista.map((p) => ({ ...p, modo: m })) }); };
  const agrega = () => { const n = filaInt(modo); foco.current = n.id; pon({ ...base, lista: [...lista, n] }); };
  const c = cuentaInts(t);
  const conFin = !!(c?.base && c.resto > 0);
  const totalTxt = num(t.q) ? `los ${t.q} ${unidadTexto(t.u)}` : 'el total';
  const { filas, intervalos } = secuenciaInts(t, limites);
  const llenos = lista.length > 0 && lista.every((p) => num(p.q));
  const colorDe = (p) => { const q = norm({ ...p, modo, rol: 'continua' }); return fraseIntensidad(q) ? nivel(q, limites) : 0; };
  // Medido en iPhone 13: el renglón tiene 274 px; así caben número, distancia, pace «4:30 a 5:00» y «···» sin encimarse.
  const COLS = '22px 92px minmax(0, 1fr) 32px';
  // En la compu, «Así lo verá el atleta» va a la derecha de la tabla (si la pieza mide 640 px o más); en el teléfono, abajo.
  return (
    <div className="tl-int" style={{ marginBottom: 6 }}>
      <div className="tl-int-rejilla">
      <div style={{ minWidth: 0 }}>
      {!sinTitulo && <Seccion color={T.accent}>Los intervalos</Seccion>}
      <div style={{ display: 'grid', gridTemplateColumns: COLS, gap: 4, alignItems: 'center', padding: '0 0 4px' }}>
        <span />
        <span style={{ fontSize: 12.5, fontWeight: 700, color: T.text2 }}>Intervalo</span>
        <MenuDeModo valor={modo} abierto={menu} setAbierto={setMenu} onElige={ponModo} />
        <span />
      </div>
      {lista.map((p, i) => {
        const nv = colorDe(p);
        return (
          <div key={p.id} data-int-fila={i + 1} style={{ display: 'grid', gridTemplateColumns: COLS, gap: 4, alignItems: 'center', padding: '7px 0', borderTop: `1px solid ${KP.line}` }}>
            <Numero n={i + 1} nivel={nv} />
            <span style={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0 }}>
              <input data-int-q={p.id} value={p.q ?? ''} onChange={(e) => cambiaFila(p.id, { q: e.target.value.replace(/[^\d.,]/g, '').slice(0, 6) })} inputMode="decimal"
                aria-label={`Distancia o tiempo del intervalo ${i + 1}`} style={{ ...CELDA, width: 48 }} />
              <MenuUnidad valor={p.u} etiqueta={`Unidad del intervalo ${i + 1}`} onCambio={(u) => cambiaFila(p.id, { u })} />
            </span>
            <CeldaIntensidad p={p} modo={modo} nombre={`intervalo ${i + 1}`} rango={rango} onCambio={(v) => cambiaFila(p.id, v)} onSinModo={() => setMenu(true)} />
            <MenuDePaso ancho={32} nombre={`intervalo ${i + 1}`} acciones={{
              arriba: i > 0 ? () => { const k = [...lista]; [k[i - 1], k[i]] = [k[i], k[i - 1]]; pon({ ...base, lista: k }); } : null,
              abajo: i < lista.length - 1 ? () => { const k = [...lista]; [k[i + 1], k[i]] = [k[i], k[i + 1]]; pon({ ...base, lista: k }); } : null,
              duplicar: () => pon({ ...base, lista: [...lista.slice(0, i + 1), { ...JSON.parse(JSON.stringify(p)), id: nuevoId() }, ...lista.slice(i + 1)] }),
              borrar: () => { const antes = ints; pon({ ...base, lista: lista.filter((_, k) => k !== i) }); avisa?.('Se borró', { accion: { texto: 'Deshacer', alTocar: () => onCambio({ ints: antes }) } }); },
            }} />
          </div>
        );
      })}
      {conFin && (() => {
        const r = restoEnUnidad(c.resto, c.base);
        return (
          <div data-int-fin="1" style={{ display: 'grid', gridTemplateColumns: COLS, gap: 4, rowGap: 4, alignItems: 'center', padding: '7px 0', borderTop: `1px solid ${KP.line}` }}>
            <span />
            <span style={{ gridColumn: '2 / 5', fontSize: 12.5, fontWeight: 700, color: T.text2 }}>Para completar {totalTxt}</span>
            <Numero n={lista.length + 1} nivel={colorDe(fin)} />
            <b style={{ fontSize: 15.5, fontWeight: 800, color: T.text, paddingLeft: 4, whiteSpace: 'nowrap' }}>{r.q} {r.u === 'm' ? 'm' : unidadTexto(r.u)}</b>
            <CeldaIntensidad p={{ ...fin, modo }} modo={modo} nombre="para completar" rango={rango} onCambio={(v) => pon({ ...base, fin: { ...fin, ...v } })} onSinModo={() => setMenu(true)} />
            <span />
          </div>
        );
      })()}
      <div style={{ borderTop: `1px solid ${KP.line}`, paddingTop: 2 }}>
        <BotonTexto onClick={agrega}>+ Agregar intervalo</BotonTexto>
      </div>
      {llenos && c?.excede && <div style={{ fontSize: 13, fontWeight: 700, color: AMBAR_TEXTO, margin: '0 0 8px' }}>Los intervalos suman más que el total.</div>}
      {llenos && !c?.base && num(t.q) > 0 && <Ayuda>Para calcular lo que falta, escribe todo en distancia o todo en tiempo.</Ayuda>}
      <Interruptor encendido={ints.repite !== false} onCambio={(repite) => pon({ ...base, repite })}>Repetir hasta completar {totalTxt}</Interruptor>
      </div>
      {lista.some((p) => num(p.q)) && <AsiLoVera t={t} filas={filas} intervalos={intervalos} limites={limites} />}
      </div>
    </div>
  );
}

/** El número del renglón, con el color de su intensidad (sin intensidad todavía, gris). */
function Numero({ n, nivel: nv }) {
  return (
    <span aria-hidden="true" style={{ width: 22, height: 22, borderRadius: 7, display: 'grid', placeItems: 'center', fontSize: 12.5, fontWeight: 800,
      background: nv ? COLOR_ZONA[Math.round(nv) - 1] : KP.lineHi, color: nv ? TINTA_ZONA[Math.round(nv) - 1] : T.text2 }}>{n}</span>
  );
}

/** El título de una parte de la tarjeta, con su rayita de color. */
export function Seccion({ color, children, htmlFor }) {
  const Etiqueta = htmlFor ? 'label' : 'div';
  return (
    <Etiqueta htmlFor={htmlFor} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15.5, fontWeight: 800, color: T.text, margin: '0 0 10px' }}>
      <i aria-hidden="true" style={{ width: 6, height: 18, borderRadius: 3, background: color, flexShrink: 0 }} />{children}
    </Etiqueta>
  );
}

/** UNA SOLA LISTA PARA TODA LA TABLA (Andrés: «ambas deberían salir como la segunda»): la unidad, la forma de la intensidad, la zona y el
    esfuerzo bajan igual, en una tarjeta blanca con la elegida en azul claro. No se usa la lista del sistema, que en cada lugar se ve distinta.
    Se cierra al elegir, con Esc o tocando fuera; las flechas mueven entre opciones. Si no cabe a la derecha, se abre hacia la izquierda. */
function ListaQueBaja({ valor, opciones, onElige, etiqueta, contenido, estiloBoton, abierto: abiertoFuera, setAbierto: setAbiertoFuera, anchoMin = 150 }) {
  const [abiertoPropio, setAbiertoPropio] = useState(false);
  const abierto = abiertoFuera ?? abiertoPropio;
  const setAbierto = setAbiertoFuera ?? setAbiertoPropio;
  const [aLaDerecha, setALaDerecha] = useState(false);
  const ref = useRef(null);
  const lista = useRef(null);
  useEffect(() => {
    if (!abierto) return undefined;
    const fuera = (e) => { if (!ref.current?.contains(e.target)) setAbierto(false); };
    const tecla = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); setAbierto(false); ref.current?.querySelector('button')?.focus(); return; }
      const d = { ArrowDown: 1, ArrowUp: -1 }[e.key];
      if (!d) return;
      const items = [...(lista.current?.querySelectorAll('[role="menuitemradio"]') ?? [])];
      const i = items.indexOf(document.activeElement);
      e.preventDefault();
      items[(i + d + items.length) % items.length]?.focus();
    };
    document.addEventListener('pointerdown', fuera);
    document.addEventListener('keydown', tecla);
    const r = lista.current?.getBoundingClientRect();
    setALaDerecha(!!r && r.right > document.documentElement.clientWidth - 8);
    (lista.current?.querySelector('[aria-checked="true"]') ?? lista.current?.querySelector('[role="menuitemradio"]'))?.focus();
    return () => { document.removeEventListener('pointerdown', fuera); document.removeEventListener('keydown', tecla); };
  }, [abierto, setAbierto]);
  return (
    <div ref={ref} style={{ position: 'relative', minWidth: 0, display: 'inline-flex' }}>
      <button type="button" onClick={() => setAbierto(!abierto)} aria-haspopup="menu" aria-expanded={abierto} aria-label={etiqueta} style={{ cursor: 'pointer', fontFamily: FONT, ...estiloBoton }}>
        {contenido}
      </button>
      {abierto && (
        <div ref={lista} role="menu" aria-label={etiqueta} className="tl-corre-menu"
          style={{ position: 'absolute', ...(aLaDerecha ? { right: 0 } : { left: 0 }), top: 'calc(100% + 4px)', zIndex: 30, minWidth: anchoMin, background: T.bg2, borderRadius: 14, padding: 6, boxShadow: '0 10px 30px rgba(17,19,24,0.16), 0 2px 6px rgba(17,19,24,0.08)', transformOrigin: aLaDerecha ? 'top right' : 'top left' }}>
          {opciones.map(([v, l, detalle]) => {
            const on = v === valor;
            return (
              <button key={v} type="button" role="menuitemradio" aria-checked={on} onClick={() => { setAbierto(false); onElige(v); }}
                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', minHeight: 44, padding: '0 12px', border: 'none', borderRadius: 10, cursor: 'pointer', fontFamily: FONT, fontWeight: on ? 800 : 700, fontSize: 14.5, textAlign: 'left', whiteSpace: 'nowrap',
                  background: on ? KP.blueSoft : 'transparent', color: on ? T.accent : T.text }}>
                <span style={{ flex: 1 }}>{l}</span>
                {detalle && <span style={{ fontSize: 12.5, fontWeight: 600, color: on ? T.accent : T.text2 }}>{detalle}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** La unidad de un renglón: «m ▾». */
function MenuUnidad({ valor, onCambio, etiqueta }) {
  const dep = useDeporte();
  return (
    <ListaQueBaja valor={valor} opciones={dep.unidades} onElige={onCambio} etiqueta={`${etiqueta}: ${unidadTexto(valor)}`} anchoMin={110}
      estiloBoton={{ display: 'inline-flex', alignItems: 'center', gap: 2, border: 'none', background: 'transparent', padding: '0 2px', minHeight: 40, fontWeight: 800, fontSize: 13.5, color: T.text2, flexShrink: 0 }}
      contenido={<>{unidadTexto(valor)}<ChevronDown size={13} aria-hidden="true" /></>} />
  );
}

/** El encabezado de la columna de intensidad: «Pace ▾». Se elige una vez para toda la tabla. Sin elegir, dice «Intensidad ▾». */
function MenuDeModo({ valor, abierto, setAbierto, onElige }) {
  const dep = useDeporte();
  const modos = dep.modosTabla.map((m) => [m, m === 'tope' ? 'Al máximo' : NOMBRE_MODO[m]]);
  return (
    <ListaQueBaja valor={valor} opciones={modos} onElige={onElige} abierto={abierto} setAbierto={setAbierto} anchoMin={170}
      etiqueta={`Intensidad de los intervalos: ${valor ? NOMBRE_MODO[valor] : 'sin elegir'}`}
      estiloBoton={{ display: 'inline-flex', alignItems: 'center', gap: 3, border: 'none', background: 'transparent', padding: 0, minHeight: 36, fontWeight: 800, fontSize: 13, color: valor ? T.text : T.accent }}
      contenido={<>{valor ? NOMBRE_MODO[valor] : 'Intensidad'} <ChevronDown size={14} aria-hidden="true" style={{ transform: abierto ? 'rotate(180deg)' : 'none', transition: 'transform .16s ease' }} /></>} />
  );
}

/** La intensidad de un renglón, según el encabezado: Pace «4:30 a 5:00», Zona, Esfuerzo, Pulso «150 a 160», Tiempo, Al máximo o Libre. */
function CeldaIntensidad({ p, modo, nombre, rango, onCambio, onSinModo, grande = false }) {
  const v = p.vals ?? {};
  // Grande: las casillas de arriba de la Progresiva (46 px, como las demás casillas de la pieza).
  const CELDA = grande ? { ...CELDA_CHICA, minHeight: 46, borderRadius: 12, fontSize: 17 } : CELDA_CHICA;
  const ancho = (w) => (grande ? Math.round(w * 1.25) : w);
  const pon = (k, valor) => onCambio({ vals: { ...v, [k]: valor } });
  const fila = { display: 'flex', alignItems: 'center', gap: 3, minWidth: 0 };
  const a = <span style={{ fontSize: 12.5, fontWeight: 800, color: T.text2 }}>a</span>;
  if (!modo) {
    return (
      <button type="button" onClick={onSinModo} aria-label={`Elegir la intensidad, ${nombre}`}
        style={{ ...CELDA, width: '100%', maxWidth: 106, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 8, cursor: 'pointer', color: T.text3 }}>
        <ChevronDown size={14} aria-hidden="true" />
      </button>
    );
  }
  if (modo === 'ritmo' || modo === 'ritmo100' || modo === 'tiempo') {
    const [k1, k2] = modo === 'tiempo' ? ['tiempo', 'tiempo2'] : ['ritmo', 'ritmo2'];
    const que = NOMBRE_MODO[modo];
    return <span style={fila}><CajaTiempo estilo={{ ...CELDA, width: ancho(48) }} valor={v[k1]} onCambio={(x) => pon(k1, x)} etiqueta={`${que} desde, ${nombre}`} />{a}<CajaTiempo estilo={{ ...CELDA, width: ancho(48) }} valor={v[k2]} onCambio={(x) => pon(k2, x)} etiqueta={`${que} hasta, ${nombre}`} /></span>;
  }
  if (modo === 'pulso' || modo === 'w') {
    const caja = (k) => <input value={v[modo]?.[k] ?? ''} onChange={(e) => pon(modo, { ...v[modo], [k]: e.target.value.replace(/\D/g, '').slice(0, modo === 'w' ? 4 : 3) })} inputMode="numeric" aria-label={`${modo === 'w' ? 'Potencia' : 'Pulsaciones'} ${k === 'de' ? 'desde' : 'hasta'}, ${nombre}`} style={{ ...CELDA, width: ancho(48) }} />;
    return <span style={fila}>{caja('de')}{a}{caja('a')}</span>;
  }
  if (modo === 'zona' || modo === 'rpe') {
    const opciones = modo === 'zona' ? [1, 2, 3, 4, 5].map((n) => [n, `Zona ${n}`, rango ? rango(n) : null]) : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => [n, `${n} de 10`]);
    const valor = modo === 'zona' ? p.z : v.rpe;
    const texto = valor ? (modo === 'zona' ? `Zona ${valor}` : `${valor} de 10`) : '';
    return (
      <ListaQueBaja valor={valor} opciones={opciones} anchoMin={modo === 'zona' ? 170 : 120}
        onElige={(n) => onCambio(modo === 'zona' ? { z: n } : { vals: { ...v, rpe: n } })}
        etiqueta={`${modo === 'zona' ? 'Zona' : 'Esfuerzo'}, ${nombre}${texto ? `: ${texto}` : ''}`}
        estiloBoton={{ ...CELDA, width: ancho(104), maxWidth: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4, padding: '0 8px 0 10px' }}
        contenido={<><span>{texto}</span><ChevronDown size={14} color={T.text2} aria-hidden="true" /></>} />
    );
  }
  return <span style={{ fontSize: 14, fontWeight: 800, color: T.text2, paddingLeft: 2 }}>{modo === 'tope' ? 'Al máximo' : 'Libre'}</span>;
}

/** Un tiempo en una sola caja: «4:30». En el teléfono no hay «:» en el teclado de números: «430» también es 4:30. */
function CajaTiempo({ valor, onCambio, etiqueta, estilo }) {
  const aTexto = (x) => (x && (num(x.min) || num(x.seg)) ? `${num(x.min)}:${dosDigitos(Math.min(59, Math.round(num(x.seg))))}` : '');
  const [texto, setTexto] = useState(null);
  const lee = (s) => {
    if (!s) return undefined;
    if (s.includes(':')) { const [m, sg = ''] = s.split(':'); return { min: m.slice(0, 2), seg: sg.slice(0, 2) }; }
    if (s.length <= 2) return { min: s, seg: '' };
    return { min: s.slice(0, -2), seg: s.slice(-2) };
  };
  return (
    <input value={texto ?? aTexto(valor)} inputMode="numeric" aria-label={etiqueta}
      onFocus={() => setTexto(aTexto(valor))} onBlur={() => setTexto(null)}
      onChange={(e) => { const s = e.target.value.replace(/[^\d:]/g, '').slice(0, 5); setTexto(s); onCambio(lee(s)); }}
      style={estilo ?? { ...CELDA, width: 48 }} />
  );
}

/** Encendido o apagado, con su frase al lado (toda la frase se puede tocar). */
export function Interruptor({ encendido, onCambio, children }) {
  return (
    <button type="button" role="switch" aria-checked={encendido} onClick={() => onCambio(!encendido)}
      style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', border: 'none', background: '#F4F5F8', borderRadius: 12, padding: '10px 12px', margin: '6px 0 12px', minHeight: 48, cursor: 'pointer', fontFamily: FONT, textAlign: 'left' }}>
      <span aria-hidden="true" style={{ width: 42, height: 26, borderRadius: 13, background: encendido ? T.accent : '#D5D8DF', position: 'relative', flexShrink: 0, transition: 'background .16s ease' }}>
        <i style={{ position: 'absolute', top: 2, left: encendido ? 18 : 2, width: 22, height: 22, borderRadius: '50%', background: '#fff', transition: 'left .16s ease' }} />
      </span>
      <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{children}</span>
    </button>
  );
}

/** «Así lo verá el atleta»: la lista completa, en orden, sin «repite N veces». Los intervalos fuertes, numerados. */
function AsiLoVera({ t, filas, intervalos, limites, encabezado }) {
  const MAX = 60;
  const corto = (f) => {
    const q = norm({ ...f, rol: 'continua' });
    const fr = fraseIntensidad(q);
    return fr ? fr.replace(/^a pace /, 'pace ').replace(/^a /, '').replace(/^en Zona/, 'Zona') : '—';
  };
  return (
    <div aria-label="Así lo verá el atleta" role="region" style={{ background: '#111318', borderRadius: 14, padding: '12px 14px', margin: '0 0 12px', color: '#fff' }}>
      <div style={{ fontSize: 12.5, fontWeight: 800, color: '#9CA3AF' }}>Así lo verá el atleta</div>
      <div style={{ fontSize: 15, fontWeight: 800, margin: '2px 0 8px' }}>{encabezado ?? [num(t.q) ? `${t.q} ${unidadTexto(t.u)}` : null, `${intervalos} ${intervalos === 1 ? 'intervalo' : 'intervalos'}`].filter(Boolean).join(' · ')}</div>
      {filas.slice(0, MAX).map((f, i) => {
        const q = norm({ ...f, rol: 'continua' });
        const nv = fraseIntensidad(q) ? nivel(q, limites) : 0;
        return (
          <div key={`${f.id}-${i}`} data-asi-fila style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 14, fontWeight: 700, padding: '3px 0' }}>
            <em style={{ fontStyle: 'normal', width: 18, textAlign: 'right', fontSize: 12.5, fontWeight: 800, color: '#9CA3AF', flexShrink: 0 }}>{f.n ?? ''}</em>
            <i aria-hidden="true" style={{ width: 8, height: 20, borderRadius: 3, background: nv ? COLOR_ZONA[Math.round(nv) - 1] : '#3A3F4B', flexShrink: 0 }} />
            <b style={{ fontWeight: 800, minWidth: 58, whiteSpace: 'nowrap' }}>{num(f.q) ? `${f.q} ${unidadTexto(f.u)}` : '—'}</b>
            <span style={{ color: '#C9CDD6', fontWeight: 600 }}>{corto(f)}</span>
          </div>
        );
      })}
      {filas.length > MAX && <div style={{ fontSize: 13, fontWeight: 700, color: '#9CA3AF', marginTop: 4 }}>y {filas.length - MAX} más</div>}
    </div>
  );
}

/** SPRINTS (acordado con Andrés en imágenes, 19 nov 2026). Tres partes numeradas, en el orden en que se piensa: 1 Ejercicio · 2 Intensidad ·
    3 Sprints y descanso. Cada número cambia a ✓ verde cuando su parte está completa. «Distancia o tiempo» y el botón de Intensidad son los
    mismos de Calentamiento (Andrés: «eso me gusta»). Sin renglones de «Descanso» ni «Repetir todo»: el descanso va en el mismo renglón.
    A la derecha (o abajo, si no cabe), «Así lo verá el atleta». */
function CamposDeSprints({ x, onCambio, rango, rangoLargo, repertoire = [], onEjercicioCreado, usados = new Set(), limites = [0, 0, 0, 0], avisa }) {
  const dep = useDeporte();
  // SERIES de Swimming: la misma pantalla que Sprints, con sus palabras y la intensidad de un nado (ritmo por 100 m primero).
  const esSerie = x.rol === 'series';
  const una = esSerie ? 'serie' : 'sprint';
  // En Cycling no hay ejercicio que elegir: es la bici. Las partes se numeran sin él.
  const conEj = dep.conEjercicio;
  const nI = conEj ? 2 : 1;
  const s = sprintsDe(x);
  const [abiertos, setAbiertos] = useState({});
  const ver = (k, hay) => hay || abiertos[k];
  // Al guardar, ya en la forma nueva: lo de antes (pasos, tr, rec, «Repetir todo») se va.
  const guarda = (f) => onCambio((o) => {
    const base = { ...o, ...sprintsDe(o), pasos: undefined, tr: undefined, rec: undefined, partes: undefined, lista: undefined, veces: undefined };
    return { ...base, ...(typeof f === 'function' ? f(base) : f) };
  });
  const cambiaFila = (id, c) => guarda((o) => ({ filas: o.filas.map((f) => (f.id === id ? { ...f, ...c } : f)) }));
  const foco = useRef(null);
  useEffect(() => {
    if (!foco.current) return;
    document.querySelector(`[data-corre-cuanto="${foco.current}"]`)?.focus();
    foco.current = null;
  });
  const agrega = () => { const ult = s.filas[s.filas.length - 1]; const n = { ...(ult ?? filaSprint()), id: nuevoId() }; foco.current = n.id; guarda((o) => ({ filas: [...o.filas, n] })); };
  const t = norm({ modo: s.modo, z: s.z, vals: s.vals, q: s.filas[0]?.q, u: s.filas[0]?.u });
  const ficha = s.ej ? (repertoire ?? []).find((e) => e.id === s.ej.exercise_id) : null;
  const pidePeso = s.ej && (ficha?.carga_tipo === 'kg' || num(s.con?.kg) > 0 || abiertos.peso);
  const conTerreno = dep.id === 'correr' && (['paracaidas', 'vallas', 'cuesta', 'otro'].includes(s.con?.tipo) || (!s.ej && s.con?.tipo === 'trineo'));
  const enDistancia = s.filas.every((f) => f.u === 'm' || f.u === 'km');
  const unidades = dep.id === 'correr' ? UNIDADES : dep.unidades;
  const okIntensidad = !!fraseIntensidad(t);
  const okNumeros = s.filas.every((f) => num(f.q) && descansoDe(f));
  const okEjercicio = !!s.ej || okIntensidad || s.filas.some((f) => num(f.q));
  const materiales = s.ej ? MATERIAL.filter(([v]) => v !== 'trineo') : MATERIAL;
  return (
    <div className="tl-int">
      <div className="tl-spr-rejilla">
        <div style={{ minWidth: 0 }}>
          {conEj && <ParteNumerada n={1} ok={okEjercicio} titulo="Ejercicio">
            <EjercicioDeIntervalo grande ej={s.ej} libre serie={esSerie} usados={usados} repertoire={repertoire} onEjercicioCreado={onEjercicioCreado} onCambio={(ej) => guarda({ ej })} />
            {pidePeso && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                <label style={{ fontSize: 14, fontWeight: 800, color: T.text }} htmlFor={`peso-${x.id}`}>Peso</label>
                <input id={`peso-${x.id}`} value={s.con?.kg ?? ''} onChange={(e) => guarda((o) => ({ con: { tipo: 'nada', txt: '', ...o.con, kg: e.target.value.replace(/[^\d.,]/g, '') } }))} inputMode="decimal" style={{ ...CAMPO, width: 72, textAlign: 'center', fontSize: 18, minHeight: 42 }} />
                <Corto>kg</Corto>
              </div>
            )}
          </ParteNumerada>}
          <ParteNumerada n={nI} ok={okIntensidad} titulo={null}>
            <Intensidad t={t} familia={esSerie ? 'correr' : 'sprint'} onCambio={(c) => guarda(c)} rango={rango} rangoLargo={rangoLargo} />
          </ParteNumerada>
          <ParteNumerada n={nI + 1} ok={okNumeros} titulo={esSerie ? 'Series y descanso' : 'Sprints y descanso'}>
            <div className="tl-spr-enc" aria-hidden="true">
              <span /><span>Distancia o tiempo</span><span>Descanso después</span><span />
            </div>
            {s.filas.map((f, i) => (
              <div key={f.id} className="tl-spr-fila" data-sprint-fila={i + 1}>
                <span className="tl-spr-num" aria-hidden="true" style={{ background: num(f.q) ? '#1530A8' : KP.lineHi, color: num(f.q) ? '#fff' : T.text2 }}>{i + 1}</span>
                <div className="tl-spr-dist">
                  <Cantidad valor={f.q} unidad={f.u} unidades={unidades} convertir={false} marca={i === 0 ? x.id : f.id} etiqueta={`Distancia o tiempo, ${una} ${i + 1}`} onCambio={(c) => cambiaFila(f.id, c)} />
                </div>
                <div className="tl-spr-desc">
                  <span className="tl-spr-rot">Descanso</span>
                  {f.du !== 'rec' && (
                    <input value={f.dq ?? ''} onChange={(e) => cambiaFila(f.id, { dq: e.target.value.replace(/[^\d.,]/g, '').slice(0, 4) })} inputMode="decimal"
                      aria-label={`Descanso, ${una} ${i + 1}`} style={{ ...CAMPO, width: 64, textAlign: 'center', fontSize: 20, padding: '0 6px', flexShrink: 0 }} />
                  )}
                  <ListaQueBaja valor={f.du ?? 'min'} opciones={[['s', 'seg'], ['min', 'min'], ['rec', 'hasta recuperarse']]} anchoMin={190}
                    onElige={(du) => cambiaFila(f.id, { du })}
                    etiqueta={`Unidad del descanso, ${una} ${i + 1}: ${f.du === 'rec' ? 'hasta recuperarse' : f.du === 's' ? 'seg' : 'min'}`}
                    estiloBoton={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 46, padding: '0 12px', border: 'none', borderRadius: 12, background: UI.relleno, color: T.text, fontWeight: 800, fontSize: 14.5, whiteSpace: 'nowrap' }}
                    contenido={<>{f.du === 'rec' ? 'hasta recuperarse' : f.du === 's' ? 'seg' : 'min'}<ChevronDown size={15} aria-hidden="true" /></>} />
                </div>
                <span className="tl-spr-menu">
                  <MenuDePaso ancho={32} nombre={`${una} ${i + 1}`} acciones={{
                    arriba: i > 0 ? () => guarda((o) => { const k = [...o.filas]; [k[i - 1], k[i]] = [k[i], k[i - 1]]; return { filas: k }; }) : null,
                    abajo: i < s.filas.length - 1 ? () => guarda((o) => { const k = [...o.filas]; [k[i + 1], k[i]] = [k[i], k[i + 1]]; return { filas: k }; }) : null,
                    duplicar: () => guarda((o) => ({ filas: [...o.filas.slice(0, i + 1), { ...o.filas[i], id: nuevoId() }, ...o.filas.slice(i + 1)] })),
                    borrar: s.filas.length > 1 ? () => { const antes = x; guarda((o) => ({ filas: o.filas.filter((_, k) => k !== i) })); avisa?.('Se borró', { accion: { texto: 'Deshacer', alTocar: () => onCambio(() => antes) } }); } : null,
                  }} />
                </span>
              </div>
            ))}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, borderTop: `1px solid ${KP.line}`, paddingTop: 4 }}>
              <BotonTexto onClick={agrega}>{esSerie ? '+ Agregar serie' : '+ Agregar sprint'}</BotonTexto>
              {s.filas.some((f) => num(f.q)) && <span style={{ fontSize: 12.5, fontWeight: 600, color: T.text2 }}>copia el de arriba</span>}
            </div>
          </ParteNumerada>
          {ver('terreno', conTerreno) && (
            <Extra rotulo="Material o terreno" onQuitar={() => { setAbiertos((a) => ({ ...a, terreno: false })); guarda((o) => ({ con: o.con?.kg ? { tipo: 'nada', kg: o.con.kg, txt: '' } : undefined })); }}>
              <Opciones opciones={materiales} valor={s.con?.tipo ?? 'nada'} etiqueta="Material o terreno" onCambio={(tipo) => guarda((o) => ({ con: { kg: '', txt: '', ...o.con, tipo } }))} />
              {['vallas', 'cuesta', 'otro'].includes(s.con?.tipo) && (
                <input value={s.con.txt ?? ''} onChange={(e) => guarda((o) => ({ con: { ...o.con, txt: e.target.value } }))}
                  aria-label={{ vallas: 'Cuántas vallas y altura', cuesta: 'Qué tan empinada', otro: 'Con qué' }[s.con.tipo]} style={{ ...CAMPO, marginTop: 10 }} />
              )}
            </Extra>
          )}
          {ver('limite', !!s.limS) && enDistancia && <Extra rotulo="Tiempo límite" onQuitar={() => { setAbiertos((a) => ({ ...a, limite: false })); guarda({ limS: null }); }}><TiempoMinSeg segundos={s.limS} onCambio={(limS) => guarda({ limS })} /></Extra>}
          {ver('series', num(x.series?.n) > 1) && (
            <Extra rotulo="En series" onQuitar={() => { setAbiertos((a) => ({ ...a, series: false })); guarda({ series: undefined }); }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <input value={x.series?.n ?? ''} onChange={(e) => guarda((o) => ({ series: { q: '', u: 'min', ...o.series, n: e.target.value.replace(/\D/g, '').slice(0, 2) } }))} inputMode="numeric" aria-label="Cuántas series" style={{ ...CAMPO, width: 64, textAlign: 'center', fontSize: 20 }} />
                <Corto>series, con</Corto>
                <Cantidad valor={x.series?.q ?? ''} unidad={x.series?.u ?? 'min'} unidades={[['s', 'seg'], ['min', 'min']]} etiqueta="Descanso entre series" onCambio={(c) => guarda((o) => ({ series: { n: '', ...o.series, ...c } }))} />
                <Corto>de descanso entre series</Corto>
              </div>
            </Extra>
          )}
          {ver('nota', !!x.nota) && <Extra rotulo="Nota para el atleta" onQuitar={() => { setAbiertos((a) => ({ ...a, nota: false })); guarda({ nota: '' }); }}><Texto valor={x.nota} onCambio={(nota) => guarda({ nota })} ejemplo="En pista, carril 1" etiqueta="Nota para el atleta" /></Extra>}
          <div style={{ paddingLeft: 40 }}>
            <MasOpciones opciones={[
              ...(s.ej && dep.id === 'correr' ? [{ id: 'peso', label: 'Peso', activo: !!pidePeso, activar: () => setAbiertos((a) => ({ ...a, peso: true })) }] : []),
              ...(dep.id === 'correr' ? [{ id: 'terreno', label: 'Material o terreno', activo: ver('terreno', conTerreno), activar: () => setAbiertos((a) => ({ ...a, terreno: true })) }] : []),
              ...(enDistancia ? [{ id: 'limite', label: 'Tiempo límite', activo: ver('limite', !!s.limS), activar: () => setAbiertos((a) => ({ ...a, limite: true })) }] : []),
              { id: 'series', label: 'En series', activo: ver('series', num(x.series?.n) > 1), activar: () => setAbiertos((a) => ({ ...a, series: true })) },
              { id: 'nota', label: 'Nota para el atleta', activo: ver('nota', !!x.nota), activar: () => setAbiertos((a) => ({ ...a, nota: true })) },
            ]} />
          </div>
        </div>
        <AsiLoVeranLosSprints x={x} s={s} limites={limites} una={una} />
      </div>
    </div>
  );
}

/** TÉCNICA DE CARRERA (acordado con Andrés en imágenes, 19 nov 2026): el mismo lenguaje que Sprints. 1 Ejercicio (uno solo, grande, con su
    video) · 2 Veces y descanso (una fila por cada vez, con su descanso). «+ Agregar otra vez» copia la de arriba. A la derecha, «Así lo verá». */
function CamposDeTecnica({ x, onCambio, repertoire = [], onEjercicioCreado, usados = new Set(), avisa, de, abreSolo = true }) {
  // «Su video»: la ventana del video solo para este atleta (ver `lib/videoDelAtleta.js`). Sin atleta (una plantilla), no hay cuadro.
  const videoAt = useContext(VideoDelAtleta);
  const dep = useDeporte();
  const nado = dep.id === 'nado';
  const DESCANSOS = dep.descansoTec;
  const duInicial = DESCANSOS[0][0];
  const tc = tecDe(x);
  const sets = tc.sets;
  // Una pieza nueva abre directo el buscador (como antes); `{ set: null }` es un Set nuevo, `{ set, cambia }` cambia un ejercicio.
  // (En un calentamiento no: al volver a abrirlo vacío, el buscador saldría solo cada vez. Ahí se toca «+ Agregar set».)
  const [buscador, setBuscador] = useState(() => (sets.length || !abreSolo ? null : { set: null }));
  const [abierto, setAbierto] = useState(null);
  const [extras, setExtras] = useState({});
  // Al guardar, ya en la forma nueva: lo de antes (`ej`, `filas`, `items`, `con`, `mat`, `nota`) se va.
  const guarda = (fn) => onCambio((o) => {
    const S = structuredClone(tecDe(o).sets);
    fn(S);
    return { ...o, ej: undefined, filas: undefined, items: undefined, con: undefined, mat: undefined, nota: undefined, nom: o.nom || dep.tecnica || 'Técnica de carrera', sets: S };
  });
  const fichaDe = (it) => (repertoire ?? []).find((e) => e.id === it.exercise_id) ?? null;
  const unidadDe = (e) => (e?.medida === 'reps' ? 'reps' : e?.medida === 'seg' ? 's' : 'm');
  const nuevo = (e) => ({ ...itemTec(e, unidadDe(e), duInicial), dq: nado ? '15' : '' });
  const agrega = (elegidos) => {
    if (!elegidos.length) { setBuscador(null); return; }
    const b = buscador;
    guarda((S) => {
      if (b?.cambia) { const it = S.flatMap((st) => st.items).find((y) => y.id === b.cambia); if (it) { it.exercise_id = elegidos[0].id; it.name = elegidos[0].name; } return; }
      const st = S.find((y) => y.id === b?.set);
      if (st) st.items.push(...elegidos.map(nuevo));
      else S.push({ ...setTec(elegidos.map(nuevo), duInicial), dq: nado ? '30' : '' });
    });
    setBuscador(null);
  };
  const crea = async (nombre) => {
    const fila = await createExercise({ name: nombre, medida: 'm', carga_tipo: 'nada' });
    onEjercicioCreado?.(fila); agrega([fila]);
  };
  const DE_TEC = (e) => usados.has(e.id) || dep.buscaTec.test(sinAcentos(e.name));
  const nombreDu = (du) => (DESCANSOS.find(([v]) => v === du) ?? DESCANSOS[0])[1];

  /* El descanso, en la cadena donde ocurre: una píldora que es su propia lista; con seg o min, su número al lado. */
  const descanso = (d, pon, { cola = '', etiqueta }) => (
    <span className="tl-tec-desc">
      <ListaQueBaja valor={d.du ?? duInicial} opciones={DESCANSOS} anchoMin={200} onElige={(du) => pon({ du })} etiqueta={`${etiqueta}: ${nombreDu(d.du)}`}
        estiloBoton={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 28, padding: 0, border: 'none', background: 'transparent', color: '#4B505C', fontWeight: 800, fontSize: 13, whiteSpace: 'nowrap' }}
        contenido={<><Timer size={14} strokeWidth={2.4} aria-hidden="true" color="#8A90A0" />{(d.du === 's' || d.du === 'min') ? (num(d.dq) ? `${d.dq} ${d.du === 's' ? 'seg' : 'min'}` : `Descanso en ${d.du === 's' ? 'seg' : 'min'}`) : nombreDu(d.du)}{cola}</>} />
      {(d.du === 's' || d.du === 'min') && (
        <input value={d.dq ?? ''} onChange={(e) => pon({ dq: e.target.value.replace(/[^\d.,]/g, '').slice(0, 4) })} inputMode="decimal" aria-label={`${etiqueta}, cuánto`}
          placeholder={d.du === 's' ? '30' : '2'} className="tl-tec-num" />
      )}
    </span>
  );

  const titulo = (t, onQuitar) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 26, marginBottom: 6 }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: T.text2 }}>{t}</span>
      <button type="button" onClick={onQuitar} aria-label={`Quitar ${t.toLowerCase()}`} className="kp-press"
        style={{ width: 26, height: 26, border: 'none', borderRadius: 8, background: 'transparent', color: T.text3, display: 'grid', placeItems: 'center', cursor: 'pointer', marginLeft: 'auto' }}>
        <X size={15} strokeWidth={2.4} aria-hidden="true" />
      </button>
    </div>
  );

  /* Lo que se abre al tocar un ejercicio (lo de Deporte): Por lado; lo agregado, con su título y su X arriba; «Agrega, si hace falta». */
  const adentro = (it, si, ii) => {
    const st = sets[si];
    const en = (fn) => guarda((S) => fn(S[si].items[ii], S[si], S));
    const ver = (k) => it[k] !== undefined || extras[`${it.id}:${k}`];
    const ops = [
      ...(nado ? [] : [{ id: 'peso', label: 'Peso', icono: Gauge, nace: { q: '', u: 'kg' } }]),
      ...(nado ? [{ id: 'mat', label: 'Material', icono: Package, nace: [] }] : []),
      { id: 'nota', label: 'Nota', icono: StickyNote, nace: '' },
    ];
    const faltan = ops.filter((o) => !ver(o.id));
    const suVideo = it.exercise_id && videoAt.atleta?.id && videoAt.abrir ? videoAt.abrir : null;
    return (
      <div className="tl-tec-panel tl-corre-entra">
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 28, flexWrap: 'wrap' }}>
          <div data-por-lado style={{ marginTop: ver('peso') || ver('mat') ? 32 : 0 }}>
            <Interruptor encendido={!!it.lado} onCambio={(v) => en((y) => { y.lado = v || undefined; })}>Por lado</Interruptor>
          </div>
          {ver('peso') && (
            <div data-dato="peso">
              {titulo('Peso', () => { setExtras((e) => ({ ...e, [`${it.id}:peso`]: false })); en((y) => { y.peso = undefined; }); })}
              <span className="tl-tec-caja"><input value={it.peso?.q ?? ''} autoFocus={!it.peso?.q} inputMode="decimal" aria-label={`Peso de ${it.name}`}
                onChange={(e) => { const q = e.target.value.replace(/[^\d.,]/g, '').slice(0, 5); en((y) => { y.peso = { u: 'kg', ...y.peso, q }; }); }} /><small>kg</small></span>
            </div>
          )}
          {ver('mat') && (
            <div data-dato="mat" style={{ minWidth: 220 }}>
              {titulo('Material', () => { setExtras((e) => ({ ...e, [`${it.id}:mat`]: false })); en((y) => { y.mat = undefined; }); })}
              <ListaDeMaterial valor={it.mat ?? []} onCambio={(mat) => en((y) => { y.mat = mat; })} />
            </div>
          )}
        </div>
        {ver('nota') && (
          <div data-dato="nota" style={{ marginTop: 14, maxWidth: 620 }}>
            {titulo('Nota para el atleta', () => { setExtras((e) => ({ ...e, [`${it.id}:nota`]: false })); en((y) => { y.nota = undefined; }); })}
            <textarea value={it.nota ?? ''} autoFocus={!it.nota} rows={2} onChange={(e) => { const v = e.target.value; en((y) => { y.nota = v; }); }}
              placeholder={nado ? 'Codo alto, patada desde la cadera' : 'Rodillas arriba, brazos activos'} aria-label={`Nota de ${it.name}`}
              style={{ ...CAMPO, fontWeight: 600, fontSize: 15, minHeight: 64, padding: '10px 12px', resize: 'vertical', lineHeight: 1.4 }} />
          </div>
        )}
        {(faltan.length > 0 || suVideo) && (
          <div data-agrega-ejercicio style={{ marginTop: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.text2, marginBottom: 8 }}>Agrega, si hace falta</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {faltan.map((o) => (
                <button key={o.id} type="button" data-mosaico={o.id} className="kp-press"
                  onClick={() => { setExtras((e) => ({ ...e, [`${it.id}:${o.id}`]: true })); en((y) => { y[o.id] = structuredClone(o.nace); }); }}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, width: 140, height: 68, borderRadius: 13, border: 'none', background: UI.relleno, color: T.text, fontFamily: FONT, fontWeight: 700, fontSize: 13.5, cursor: 'pointer' }}>
                  <o.icono size={20} strokeWidth={2} color="#4B505C" aria-hidden="true" />{o.label}
                </button>
              ))}
              {/* «Su video» (21 nov 2026): el video solo para este atleta, el mismo de Gym. Ver `lib/videoDelAtleta.js`. */}
              {suVideo && (
                <button type="button" data-mosaico="su-video" className="kp-press" aria-haspopup="dialog" onClick={() => suVideo({ ...it, exercise_id: it.exercise_id })}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, width: 140, height: 68, borderRadius: 13, border: 'none', background: UI.relleno, color: T.text, fontFamily: FONT, fontWeight: 700, fontSize: 13.5, cursor: 'pointer' }}>
                  <Video size={20} strokeWidth={2} color={VIOLETA_SU_VIDEO} aria-hidden="true" />Su video
                </button>
              )}
            </div>
          </div>
        )}
        <div style={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', borderTop: `1px solid ${KP.line}`, marginTop: 14, paddingTop: 6 }}>
          {ii > 0 && <BotonChico icono={ArrowUp} onClick={() => { en((y, S) => { const l = S.items; [l[ii - 1], l[ii]] = [l[ii], l[ii - 1]]; }); }}>Mover arriba</BotonChico>}
          {ii < st.items.length - 1 && <BotonChico icono={ArrowDown} onClick={() => { en((y, S) => { const l = S.items; [l[ii + 1], l[ii]] = [l[ii], l[ii + 1]]; }); }}>Mover abajo</BotonChico>}
          <BotonChico icono={Copy} onClick={() => { const id = nuevoId(); en((y, S) => { S.items.splice(ii + 1, 0, { ...structuredClone(y), id }); }); setAbierto(id); }}>Duplicar</BotonChico>
          <BotonChico icono={ArrowLeftRight} onClick={() => setBuscador({ set: st.id, cambia: it.id })}>Cambiar ejercicio</BotonChico>
          <BotonChico icono={Trash2} peligro onClick={() => {
            const antes = x;
            guarda((S) => { S[si].items.splice(ii, 1); if (!S[si].items.length) S.splice(si, 1); });
            setAbierto(null);
            avisa?.('Se quitó', { accion: { texto: 'Deshacer', alTocar: () => onCambio(() => antes) } });
          }}>Quitar</BotonChico>
        </div>
      </div>
    );
  };

  const renglon = (it, si, ii) => {
    const ficha = fichaDe(it);
    const ab = abierto === it.id;
    const conVideo = !!(ficha?.video_url || ficha?.video_link);
    const detalle = [it.lado && 'por lado', num(it.peso?.q) && `${it.peso.q} kg`, (it.mat ?? []).length && juntaY(it.mat).toLowerCase()].filter(Boolean).join(' · ');
    const abre = () => setAbierto(ab ? null : it.id);
    return (
      <div key={it.id}>
        <div className={`tl-tec-fila${ab ? ' abierta' : ''}`} data-tec-ej={it.name}>
          <div className="tl-tec-fila-in">
            <span className="tl-tec-n" aria-hidden="true">{ii + 1}</span>
            <button type="button" className="tl-tec-ej" aria-expanded={ab} onClick={abre}>
              <span className="tl-tec-mini" aria-hidden="true">{conVideo ? <PlayCircle size={19} strokeWidth={2} /> : nado ? <Waves size={18} strokeWidth={2.2} /> : <Footprints size={18} strokeWidth={2.2} />}</span>
              <span style={{ minWidth: 0 }}><b>{it.name || 'Ejercicio'}</b>{detalle && <small>{detalle}</small>}</span>
            </button>
            <span className="tl-tec-cuanto">
              <input value={it.q ?? ''} inputMode="decimal" placeholder={it.u === 'reps' ? '10' : it.u === 's' ? '20' : nado ? '50' : '30'} aria-label={`Distancia, reps o tiempo de ${it.name}`}
                onChange={(e) => { const q = e.target.value.replace(/[^\d.,]/g, '').slice(0, 5); guarda((S) => { S[si].items[ii].q = q; }); }} />
              <ListaQueBaja valor={it.u} opciones={dep.unidadesTec} anchoMin={120} onElige={(u) => guarda((S) => { S[si].items[ii].u = u; })} etiqueta={`Unidad de ${it.name}`}
                estiloBoton={{ display: 'inline-flex', alignItems: 'center', gap: 2, minHeight: 40, padding: '0 4px', border: 'none', background: 'transparent', color: T.text2, fontWeight: 800, fontSize: 13.5 }}
                contenido={<>{(dep.unidadesTec.find(([v]) => v === it.u) ?? dep.unidadesTec[0])[1]}<ChevronDown size={13} aria-hidden="true" /></>} />
            </span>
            <button type="button" className="tl-tec-chev" aria-label={`${ab ? 'Cerrar' : 'Abrir'} ${it.name}`} onClick={abre}>
              <ChevronDown size={16} strokeWidth={2.6} style={{ transform: ab ? 'rotate(180deg)' : 'none', transition: 'transform .16s ease' }} />
            </button>
          </div>
          {ab && adentro(it, si, ii)}
        </div>
      </div>
    );
  };

  const unSet = (st, si) => {
    const enSet = (fn) => guarda((S) => fn(S[si]));
    const ultimo = st.items[st.items.length - 1];
    const veces = Math.max(1, num(st.veces) || 1);
    return (
      <div className="tl-tec-cadena" data-tec-set={si + 1}>
        <div className="tl-tec-cabeza">
          <b style={{ fontSize: 17, fontWeight: 800, marginRight: 4 }}>Set {si + 1}</b>
          <span className="tl-tec-gris" data-veces>
            <button type="button" aria-label="Una vez menos" disabled={veces <= 1} onClick={() => enSet((y) => { y.veces = Math.max(1, veces - 1); })}>−</button>
            <b>{veces}</b>
            <button type="button" aria-label="Una vez más" disabled={veces >= 20} onClick={() => enSet((y) => { y.veces = Math.min(20, veces + 1); })}>+</button>
            {veces === 1 ? 'vez' : 'veces'}
          </span>
          <i style={{ flex: 1 }} />
          <button type="button" className="tl-tec-redondo" aria-label={`Borrar el Set ${si + 1}`} title="Borrar el Set"
            onClick={() => { const antes = x; guarda((S) => { S.splice(si, 1); }); avisa?.('Se borró el Set', { accion: { texto: 'Deshacer', alTocar: () => onCambio(() => antes) } }); }}>
            <Trash2 size={16} strokeWidth={2.2} />
          </button>
        </div>
        {st.items.map((it, ii) => (
          <div key={it.id}>
            {renglon(it, si, ii)}
            {ii < st.items.length - 1 && (
              <div className="tl-tec-entre-ej">{descanso(it, (c) => guarda((S) => { Object.assign(S[si].items[ii], c); }), { etiqueta: `Descanso después de ${it.name}` })}<i /></div>
            )}
          </div>
        ))}
        {veces > 1 && ultimo && (
          <div className="tl-tec-cierre">
            <RotateCcwIcono />
            {descanso(ultimo, (c) => guarda((S) => { Object.assign(S[si].items[S[si].items.length - 1], c); }), { etiqueta: 'Descanso antes de volver a empezar' })}
            <span>y vuelve a empezar</span>
          </div>
        )}
        <div className="tl-tec-mas">
          <button type="button" onClick={() => setBuscador({ set: st.id })}>+ Agregar ejercicio</button>
        </div>
      </div>
    );
  };

  return (
    <div className="tl-tec" data-tec>
      <style>{CSS_TEC}</style>
      {sets.length === 0 ? (
        <div style={{ background: '#F4F5F9', borderRadius: 18, padding: '22px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 16.5, fontWeight: 800, color: T.text }}>Agrega los ejercicios de {de ?? (nado ? 'la técnica de nado' : 'la técnica')}</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: T.text2, marginTop: 4 }}>Varios en un Set se hacen uno tras otro y vuelve a empezar.</div>
        </div>
      ) : sets.map((st, si) => (
        <div key={st.id}>
          {unSet(st, si)}
          {si < sets.length - 1 && (
            <div className="tl-tec-entre">
              {descanso(st, (c) => guarda((S) => { Object.assign(S[si], c); }), { cola: ' entre Sets', etiqueta: 'Descanso entre Sets' })}
            </div>
          )}
        </div>
      ))}
      {!buscador && (
        <button type="button" className="tl-tec-azulito" data-agregar-set style={{ marginTop: 14 }} onClick={() => setBuscador({ set: null })}>
          + Agregar set
        </button>
      )}
      {buscador && (
        <RepertoirePicker
          uno={!!buscador.cambia}
          exercises={(repertoire ?? []).filter((e) => !esGuiado(e))}
          title={buscador.cambia ? 'Cambiar ejercicio' : buscador.set ? `Agregar al Set ${sets.findIndex((y) => y.id === buscador.set) + 1}` : sets.length ? 'Set nuevo: elige sus ejercicios' : `Ejercicios de ${de ?? (dep.tecnica ? dep.tecnica.toLowerCase() : 'técnica')}`}
          primero={DE_TEC}
          alCrear={crea}
          onClose={() => setBuscador(null)}
          onConfirm={agrega}
        />
      )}
    </div>
  );
}

function RotateCcwIcono() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#1E40E0" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>;
}

/* LA TÉCNICA COMO LISTA AGRUPADA (Andrés, 20-21 nov 2026). Antes: tarjetas blancas sobre blanco, una dentro de otra («como recortes de la misma
   hoja pegados en la hoja»), y una línea con círculos para decir el orden. Ahora cada Set es UN mosaico azul claro sobre el blanco; adentro no
   hay más cajas: renglones separados por rayas finas, y el descanso escrito sobre la raya. Cada nivel contrasta con el de afuera (blanco →
   azul claro → blanco); el ejercicio abierto es una tarjeta blanca dentro del Set. El azul se reserva para lo que se toca. */
const AZUL_SET = '#E8EDFB';
const RAYA_SET = '#D5DDF3';
const CSS_TEC = `
.tl-tec{--az:#1E40E0;--acb:#E8EEFF;--g:#EBEDF1;font-family:${FONT};color:#111318;container-type:inline-size}
.tl-tec button{font-family:inherit}
.tl-tec-cadena{background:${AZUL_SET};border-radius:18px;overflow:hidden}
.tl-tec-cabeza{display:flex;align-items:center;gap:9px;flex-wrap:wrap;padding:12px 12px 12px 16px;border-bottom:1.5px solid ${RAYA_SET}}
.tl-tec-gris{display:inline-flex;align-items:center;gap:6px;min-height:40px;padding:0 12px;border-radius:12px;background:#fff;font-weight:800;font-size:14px}
.tl-tec-gris>b{font-size:15.5px;min-width:16px;text-align:center}
.tl-tec-gris button{width:28px;height:28px;border:none;border-radius:8px;background:transparent;display:grid;place-items:center;color:#6B7280;font-weight:800;font-size:17px;cursor:pointer}
.tl-tec-gris button:disabled{opacity:.35;cursor:default}
.tl-tec-azulito{display:inline-flex;align-items:center;gap:6px;min-height:40px;padding:0 13px;border:none;border-radius:12px;background:var(--acb);color:var(--az);font-weight:800;font-size:14px;cursor:pointer}
.tl-tec-redondo{width:34px;height:40px;border:none;border-radius:12px;display:grid;place-items:center;background:transparent;color:#4B505C;cursor:pointer}
.tl-tec-fila{padding:9px 16px}
.tl-tec-fila.abierta{background:#fff;border-radius:14px;margin:6px 8px;padding:9px 8px 6px;box-shadow:0 1px 2px rgba(17,19,24,.06)}
.tl-tec-fila-in{display:flex;align-items:center;gap:12px}
.tl-tec-n{width:18px;flex-shrink:0;font-size:14.5px;font-weight:800;color:#6B7280;text-align:center}
.tl-tec-ej{flex:1;min-width:0;display:flex;align-items:center;gap:11px;border:none;background:transparent;padding:0;text-align:left;cursor:pointer;color:inherit}
.tl-tec-ej b{display:block;font-size:15.5px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tl-tec-ej small{display:block;font-size:12.5px;font-weight:600;color:#6B7280;margin-top:1px}
.tl-tec-mini{width:42px;height:42px;border-radius:11px;display:grid;place-items:center;background:#111318;color:#fff;flex-shrink:0}
.tl-tec-cuanto{display:flex;align-items:center;gap:2px;flex-shrink:0}
.tl-tec-cuanto input,.tl-tec-num,.tl-tec-caja input{border:none;border-radius:10px;background:#fff;min-height:40px;width:58px;text-align:center;font-weight:800;font-size:15.5px;color:#111318;font-family:inherit}
.tl-tec-fila.abierta .tl-tec-cuanto input{background:#F2F3F7}
.tl-tec-cuanto input::placeholder,.tl-tec-num::placeholder{color:#B4BAC6;font-weight:700}
.tl-tec-num{width:52px;min-height:30px;font-size:14px}
.tl-tec-caja{display:inline-flex;align-items:center;gap:6px;background:#F2F3F7;border-radius:12px;padding:0 12px 0 4px;min-height:44px}
.tl-tec-caja input{background:transparent !important;width:46px;font-size:17px}.tl-tec-caja small{font-size:13.5px;font-weight:700;color:#6B7280}
.tl-tec-chev{width:34px;height:34px;border:none;border-radius:50%;display:grid;place-items:center;background:#fff;color:#3B4252;cursor:pointer;flex-shrink:0}
.abierta .tl-tec-chev{background:var(--az);color:#fff}
.tl-tec-panel{padding:6px 0 0 30px;margin-top:4px}
.tl-tec-panel [data-por-lado] button[role="switch"]{margin:0 !important;width:auto !important;padding:10px 16px 10px 12px !important}
.tl-tec-desc{display:inline-flex;align-items:center;gap:6px}
.tl-tec-entre-ej{display:flex;align-items:center;gap:10px;padding:0 16px 0 46px}
.tl-tec-entre-ej>i{flex:1;height:1.5px;background:${RAYA_SET}}
.tl-tec-cierre{display:flex;align-items:center;gap:8px;flex-wrap:wrap;border-top:1.5px solid ${RAYA_SET};padding:10px 16px;font-size:13.5px;font-weight:800;color:#4B505C}
.tl-tec-mas{border-top:1.5px solid ${RAYA_SET};padding:6px 16px}
.tl-tec-mas button{border:none;background:transparent;padding:0;min-height:38px;color:var(--az);font-weight:800;font-size:14px;cursor:pointer}
.tl-tec-entre{display:flex;justify-content:center;padding:12px 0}
@container (max-width: 560px){.tl-tec-fila-in{flex-wrap:wrap}.tl-tec-ej{flex-basis:calc(100% - 30px)}.tl-tec-panel{padding-left:0}.tl-tec-entre-ej{padding-left:16px}}
`;

/** Una parte de Sprints con su número (gris) que cambia a ✓ verde cuando está completa. */
function ParteNumerada({ n, ok, titulo, children }) {
  return (
    <div data-parte={n} style={{ display: 'grid', gridTemplateColumns: '28px minmax(0, 1fr)', columnGap: 12, marginBottom: 20 }}>
      <span aria-label={ok ? 'Completo' : `Parte ${n}`} style={{ width: 26, height: 26, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 800, marginTop: titulo ? 1 : 8,
        background: ok ? '#E3F6EF' : UI.relleno, color: ok ? VERDE_TEXTO : T.text2 }}>{ok ? '✓' : n}</span>
      <div style={{ minWidth: 0 }}>
        {titulo && <div style={{ fontSize: 16, fontWeight: 800, color: T.text, margin: '3px 0 10px' }}>{titulo}</div>}
        {children}
      </div>
    </div>
  );
}

/** «Así lo verá el atleta» de Sprints: cada sprint en orden, con su descanso debajo. Vacío, unas líneas grises que dicen de dónde sale. */
function AsiLoVeranLosSprints({ x, s, limites, una = 'sprint' }) {
  const t = { modo: s.modo, z: s.z, vals: s.vals };
  const fr = fraseIntensidad(t);
  const lista = [];
  const nS = Math.max(1, num(x.series?.n) || 1);
  for (let k = 0; k < nS; k++) s.filas.forEach((f) => { if (num(f.q)) lista.push(f); });
  const total = lista.length;
  const kg = num(s.con?.kg) ? `${s.con.kg} kg` : null;
  const encabezado = [total ? `${total} ${total === 1 ? una : `${una}s`}` : null, [s.ej?.name, kg].filter(Boolean).join(', ') || null].filter(Boolean).join(' · ');
  const MAX = 40;
  return (
    <div role="region" aria-label="Así lo verá el atleta" style={{ background: '#111318', borderRadius: 14, padding: '12px 14px', margin: '0 0 12px', color: '#fff', alignSelf: 'start' }}>
      <div style={{ fontSize: 12.5, fontWeight: 800, color: '#9CA3AF' }}>Así lo verá el atleta</div>
      {!total ? (
        <>
          {[70, 55, 62].map((w) => <div key={w} aria-hidden="true" style={{ height: 10, borderRadius: 5, background: '#2A2E37', margin: '10px 0', width: `${w}%` }} />)}
          <div style={{ fontSize: 13, fontWeight: 600, color: '#9CA3AF', marginTop: 8 }}>Se llena con los números de la izquierda.</div>
        </>
      ) : (
        <>
          <div style={{ fontSize: 15, fontWeight: 800, margin: '2px 0 8px' }}>{encabezado}</div>
          {lista.slice(0, MAX).map((f, i) => {
            const q = norm({ ...t, q: f.q, u: f.u });
            const nv = fr ? nivel(q, limites, f.q) : 0;
            const d = descansoDe(f);
            return (
              <div key={i} data-asi-fila>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 14, fontWeight: 700, padding: '3px 0' }}>
                  <em style={{ fontStyle: 'normal', width: 18, textAlign: 'right', fontSize: 12.5, fontWeight: 800, color: '#9CA3AF', flexShrink: 0 }}>{i + 1}</em>
                  <i aria-hidden="true" style={{ width: 8, height: 20, borderRadius: 3, background: nv ? COLOR_ZONA[Math.round(nv) - 1] : '#3A3F4B', flexShrink: 0 }} />
                  <b style={{ fontWeight: 800, minWidth: 50, whiteSpace: 'nowrap' }}>{num(f.q) ? `${f.q} ${unidadTexto(f.u)}` : '—'}</b>
                  <span style={{ color: '#C9CDD6', fontWeight: 600 }}>{fr ? fr.replace(/^a pace /, 'pace ').replace(/^a /, '').replace(/^en Zona/, 'Zona') : '—'}</span>
                </div>
                {d && <div style={{ fontSize: 12.5, fontWeight: 600, color: '#9CA3AF', padding: '0 0 3px 45px' }}>descanso {d}</div>}
              </div>
            );
          })}
          {total > MAX && <div style={{ fontSize: 13, fontWeight: 700, color: '#9CA3AF', marginTop: 4 }}>y {total - MAX} más</div>}
        </>
      )}
    </div>
  );
}

/** INTERVALOS Y SPRINTS. Se lee de arriba a abajo, como se le diría al atleta: «Correr 400 m a pace 4:30–5:00», «Descanso 2 min»
    (descanso es solo parado por completo; correr más lento es otro «Correr»), «Repetir todo 6 veces». Una línea gris une lo que se repite.
    Cada dato está en su renglón; tocarlo lo abre ahí mismo. «···» mueve, duplica o borra. Nada nace con valores puestos. */
function CamposDePasos({ x, esSprint, onCambio, rango, rangoLargo, repertoire = [], onEjercicioCreado, usados = new Set(), limites = [0, 0, 0, 0], avisa }) {
  const pasos = pasosDe(x);
  const vacio = !pasos.some((p) => num(p.q));
  const [abierto, setAbierto] = useState(vacio ? (pasos[0]?.id ?? null) : null);
  const [abiertos, setAbiertos] = useState({});
  const ver = (k, hay) => hay || abiertos[k];
  // Al guardar, ya como pasos: lo viejo (tr, rec, partes, lista…) se va; la nota, la caminadora y la cadencia pasan al intervalo.
  const limpia = (o, lista) => ({
    ...o, pasos: lista, veces: Array.isArray(o.pasos) ? o.veces : (o.lista?.length ? '1' : o.veces),
    nota: o.nota ?? o.tr?.nota ?? '', cam: o.cam ?? o.tr?.cam, cad: o.cad ?? o.tr?.cad,
    tr: undefined, rec: undefined, partes: undefined, lista: undefined, ej: undefined, con: undefined,
  });
  const cambiaLista = (f) => onCambio((o) => limpia(o, f(pasosDe(o))));
  const cambiaPaso = (id, c) => cambiaLista((l) => l.map((p) => (p.id === id ? { ...p, ...(typeof c === 'function' ? c(p) : c) } : p)));
  const par = (p) => onCambio((o) => ({ ...limpia(o, pasosDe(o)), ...p }));
  const agrega = (tipo) => { const n = pasoNuevo(tipo); cambiaLista((l) => [...l, n]); setAbierto(n.id); };
  const extras = { nota: x.nota ?? x.tr?.nota ?? '', cam: x.cam ?? x.tr?.cam, cad: x.cad ?? x.tr?.cad };
  const barras = vacio ? [] : barrasDe(x, limites);
  return (
    <>
      {barras.length > 0 && <GraficaGrande barras={barras} />}
      <div style={{ borderLeft: `3px solid ${KP.lineHi}`, borderRadius: 2, paddingLeft: 9, marginBottom: 8 }}>
        {pasos.map((p, i) => (
          <PasoDeIntervalo key={p.id} p={p} i={i} total={pasos.length} esSprint={esSprint} marca={i === 0 ? x.id : undefined}
            abierto={abierto === p.id} onAbrir={() => setAbierto(abierto === p.id ? null : p.id)}
            onCambio={(c) => cambiaPaso(p.id, c)} repertoire={repertoire} onEjercicioCreado={onEjercicioCreado} usados={usados} rango={rango} rangoLargo={rangoLargo} limites={limites}
            acciones={{ arriba: i > 0 ? () => cambiaLista((l) => { const k = [...l]; [k[i - 1], k[i]] = [k[i], k[i - 1]]; return k; }) : null,
              abajo: i < pasos.length - 1 ? () => cambiaLista((l) => { const k = [...l]; [k[i + 1], k[i]] = [k[i], k[i + 1]]; return k; }) : null,
              duplicar: () => cambiaLista((l) => [...l.slice(0, i + 1), { ...JSON.parse(JSON.stringify(l[i])), id: nuevoId() }, ...l.slice(i + 1)]),
              borrar: () => { const antes = x; cambiaLista((l) => l.filter((_, k) => k !== i)); avisa?.('Se borró', { accion: { texto: 'Deshacer', alTocar: () => onCambio(() => antes) } }); } }} />
        ))}
        <RepetirTodo veces={x.veces ?? ''} onVeces={(veces) => par({ veces })} />
      </div>
      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', margin: '2px 2px 4px' }}>
        <BotonTexto onClick={() => agrega('correr')}>{esSprint ? '+ Sprint' : '+ Correr'}</BotonTexto>
        {!esSprint && <BotonTexto onClick={() => agrega('caminar')}>+ Caminar</BotonTexto>}
        <BotonTexto onClick={() => agrega('descanso')}>+ Descanso</BotonTexto>
      </div>
      {ver('series', num(x.series?.n) > 1) && (
        <Extra rotulo="En series" onQuitar={() => { setAbiertos((a) => ({ ...a, series: false })); par({ series: undefined }); }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <input value={x.series?.n ?? ''} onChange={(e) => par({ series: { q: '', u: 'min', ...x.series, n: e.target.value.replace(/\D/g, '').slice(0, 2) } })} inputMode="numeric" aria-label="Cuántas series" style={{ ...CAMPO, width: 64, textAlign: 'center', fontSize: 20 }} />
            <Corto>series, con</Corto>
          </div>
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Cantidad valor={x.series?.q ?? ''} unidad={x.series?.u ?? 'min'} unidades={[['s', 'seg'], ['min', 'min']]} etiqueta="Descanso entre series" onCambio={(p) => par({ series: { n: '', ...x.series, ...p } })} />
            <Corto>de descanso entre series</Corto>
          </div>
        </Extra>
      )}
      {ver('cam', !!extras.cam) && <Extra rotulo="Caminadora" onQuitar={() => { setAbiertos((a) => ({ ...a, cam: false })); par({ cam: undefined }); }}><Caminadora cam={extras.cam ?? {}} onCambio={(cam) => par({ cam })} /></Extra>}
      {ver('cad', !!extras.cad) && <Extra rotulo="Cadencia" onQuitar={() => { setAbiertos((a) => ({ ...a, cad: false })); par({ cad: undefined }); }}><Cadencia valor={extras.cad} onCambio={(cad) => par({ cad })} /></Extra>}
      {ver('nota', !!extras.nota) && <Extra rotulo="Nota para el atleta" onQuitar={() => { setAbiertos((a) => ({ ...a, nota: false })); par({ nota: '' }); }}><Texto valor={extras.nota} onCambio={(nota) => par({ nota })} ejemplo="En pista, carril 1" etiqueta="Nota para el atleta" /></Extra>}
      <MasOpciones opciones={[
        { id: 'series', label: 'En series', activo: ver('series', num(x.series?.n) > 1), activar: () => setAbiertos((a) => ({ ...a, series: true })) },
        { id: 'nota', label: 'Nota para el atleta', activo: ver('nota', !!extras.nota), activar: () => setAbiertos((a) => ({ ...a, nota: true })) },
        { id: 'cam', label: 'Caminadora', activo: ver('cam', !!extras.cam), activar: () => { setAbiertos((a) => ({ ...a, cam: true })); par({ cam: extras.cam ?? {} }); } },
        { id: 'cad', label: 'Cadencia', activo: ver('cad', !!extras.cad), activar: () => setAbiertos((a) => ({ ...a, cad: true })) },
      ]} />
    </>
  );
}

/** Un paso de Intervalos o Sprints: su renglón (nombre y datos) y, abierto, sus campos. */
function PasoDeIntervalo({ p, i, total, esSprint, marca, abierto, onAbrir, onCambio, repertoire, onEjercicioCreado, usados, rango, rangoLargo, limites, acciones }) {
  const [verEj, setVerEj] = useState(false);
  const [verPeso, setVerPeso] = useState(false);
  const [verTerreno, setVerTerreno] = useState(false);
  const [verLimite, setVerLimite] = useState(false);
  void i; void total;
  const t = p.tipo === 'correr' ? norm(p) : p;
  const ficha = p.ej ? (repertoire ?? []).find((e) => e.id === p.ej.exercise_id) : null;
  const conVideo = !!(ficha?.video_url || ficha?.video_link);
  const conTerreno = ['paracaidas', 'vallas', 'cuesta', 'otro'].includes(p.con?.tipo) || (!p.ej && p.con?.tipo === 'trineo');
  const pidePeso = p.ej && (ficha?.carga_tipo === 'kg' || num(p.con?.kg) > 0 || verPeso);
  const muestraMaterial = conTerreno || verTerreno;
  const materiales = p.ej ? MATERIAL.filter(([v]) => v !== 'trineo') : MATERIAL;
  const enDistancia = p.u === 'm' || p.u === 'km';
  const muestraLimite = enDistancia && (!!p.limS || verLimite);
  const fr = fraseIntensidad(t);
  let etiqueta; let chips; let color;
  if (p.tipo === 'descanso') {
    etiqueta = 'Descanso'; color = '#D5D8DF';
    chips = [p.completo ? { v: 'completo' } : num(p.q) ? { v: `${p.q} ${unidadTexto(p.u)}` } : { ph: 'Tiempo' }];
  } else if (p.tipo === 'caminar') {
    etiqueta = 'Caminar'; color = num(p.q) ? COLOR_ZONA[0] : KP.lineHi;
    chips = [num(p.q) ? { v: `${p.q} ${unidadTexto(p.u)}` } : { ph: 'Distancia o tiempo' }];
  } else {
    etiqueta = p.ej ? p.ej.name : esSprint ? 'Sprint' : 'Correr';
    color = num(p.q) && fr ? COLOR_ZONA[nivel(t, limites) - 1] : KP.lineHi;
    chips = [
      num(p.q) ? { v: `${p.q} ${unidadTexto(p.u)}` } : { ph: 'Distancia o tiempo' },
      num(p.con?.kg) ? { v: `con ${p.con.kg} kg` } : null,
      fr ? { v: fr } : { ph: 'Intensidad' },
      conTerreno && frasesMaterial({ ...p.con, kg: p.ej ? '' : p.con?.kg }) ? { v: frasesMaterial({ ...p.con, kg: p.ej ? '' : p.con?.kg }) } : null,
      p.limS ? { v: `en menos de ${tiempoCorto(p.limS)}` } : null,
    ].filter(Boolean);
  }
  return (
    <PasoFila etiqueta={etiqueta} video={conVideo} chips={chips} color={color} abierto={abierto} onAbrir={onAbrir} acciones={acciones}>
      {p.tipo === 'descanso' ? (
        <>
          <Fila rotulo="Descanso">
            <Segmentos opciones={[['tiempo', 'Con tiempo'], ['completo', 'Completo']]} valor={p.completo ? 'completo' : 'tiempo'} etiqueta="Tipo de descanso" onCambio={(v) => onCambio({ completo: v === 'completo' })} />
          </Fila>
          {p.completo ? <Ayuda>Descanso total, hasta recuperarse por completo.</Ayuda> : (
            <Fila rotulo="Tiempo">
              {(id) => <Cantidad id={id} marca={marca} valor={p.q} unidad={p.u} unidades={[['s', 'seg'], ['min', 'min']]} onCambio={onCambio} />}
            </Fila>
          )}
        </>
      ) : p.tipo === 'caminar' ? (
        <Fila rotulo="Distancia o tiempo">
          {(id) => <Cantidad id={id} marca={marca} valor={p.q} unidad={p.u} unidades={[['m', 'm'], ['km', 'km'], ['min', 'min']]} ritmo={10} onCambio={onCambio} />}
        </Fila>
      ) : (
        <>
          {(esSprint || verEj || p.ej) && (
            <Fila rotulo="Ejercicio">
              <EjercicioDeIntervalo ej={p.ej} libre={esSprint} usados={usados} repertoire={repertoire} onEjercicioCreado={onEjercicioCreado} onCambio={(ej) => onCambio({ ej })} />
            </Fila>
          )}
          <Fila rotulo="Distancia o tiempo">
            {(id) => <Cantidad id={id} marca={marca} valor={p.q} unidad={p.u} unidades={UNIDADES} ritmo={ritmoDe(t) || PACE[(t.z || 4) - 1]} onCambio={(c) => onCambio(c.u && c.u !== 'm' && c.u !== 'km' ? { ...c, limS: null } : c)} />}
          </Fila>
          <Fila>
            <Intensidad t={t} familia={esSprint ? 'sprint' : 'correr'} onCambio={onCambio} rango={rango} rangoLargo={rangoLargo} />
          </Fila>
          {pidePeso && (
            <Fila rotulo="Peso">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input value={p.con?.kg ?? ''} onChange={(e) => onCambio((pt) => ({ con: { tipo: 'nada', txt: '', ...pt.con, kg: e.target.value.replace(/[^\d.,]/g, '') } }))} inputMode="decimal" aria-label="Peso en kg" style={{ ...CAMPO, width: 92, textAlign: 'center', fontSize: 20 }} />
                <Corto>kg</Corto>
              </div>
            </Fila>
          )}
          {muestraMaterial && (
            <Fila rotulo="Material o terreno">
              <Opciones opciones={materiales} valor={p.con?.tipo ?? 'nada'} etiqueta="Material o terreno" onCambio={(tipo) => onCambio((pt) => ({ con: { kg: '', txt: '', ...pt.con, tipo } }))} />
              {!p.ej && p.con?.tipo === 'trineo' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                  <input value={p.con.kg ?? ''} onChange={(e) => onCambio((pt) => ({ con: { ...pt.con, kg: e.target.value.replace(/[^\d.,]/g, '') } }))} inputMode="decimal" aria-label="Peso del trineo en kg" style={{ ...CAMPO, width: 92, textAlign: 'center', fontSize: 20 }} />
                  <Corto>kg</Corto>
                </div>
              )}
              {['vallas', 'cuesta', 'otro'].includes(p.con?.tipo) && (
                <input value={p.con.txt ?? ''} onChange={(e) => onCambio((pt) => ({ con: { ...pt.con, txt: e.target.value } }))}
                  placeholder={{ vallas: 'Cuántas vallas y altura', cuesta: 'Qué tan empinada', otro: 'Con qué' }[p.con.tipo]}
                  aria-label={{ vallas: 'Cuántas vallas y altura', cuesta: 'Qué tan empinada', otro: 'Con qué' }[p.con.tipo]} style={{ ...CAMPO, marginTop: 10 }} />
              )}
            </Fila>
          )}
          {muestraLimite && <Fila rotulo="Tiempo límite"><TiempoMinSeg segundos={p.limS} onCambio={(limS) => onCambio({ limS })} /></Fila>}
          <MasOpciones opciones={[
            ...(esSprint ? [] : [{ id: 'ej', label: 'Ejercicio de tu repertorio', activo: verEj || !!p.ej, activar: () => setVerEj(true) }]),
            ...(p.ej ? [{ id: 'peso', label: 'Peso', activo: !!pidePeso, activar: () => setVerPeso(true) }] : []),
            { id: 'terreno', label: 'Material o terreno', activo: muestraMaterial, activar: () => setVerTerreno(true) },
            ...(enDistancia ? [{ id: 'limite', label: 'Tiempo límite', activo: muestraLimite, activar: () => setVerLimite(true) }] : []),
          ]} />
        </>
      )}
    </PasoFila>
  );
}

/** El renglón de un paso: el nombre y sus datos en cápsulas (lo vacío, en gris, dice qué va ahí). Tocarlo lo abre; «···» mueve, duplica o borra. */
function PasoFila({ etiqueta, video = false, chips, color, abierto, onAbrir, acciones, children }) {
  return (
    <div style={{ background: abierto ? T.bg2 : '#F2F3F7', borderRadius: 13, marginBottom: 6, boxShadow: abierto ? '0 4px 16px rgba(17,19,24,0.10)' : 'none', transition: 'background .15s ease, box-shadow .15s ease' }}>
      <div style={{ display: 'flex', alignItems: 'stretch' }}>
        <button type="button" onClick={onAbrir} aria-expanded={abierto} className="kp-press"
          style={{ flex: 1, minWidth: 0, display: 'flex', gap: 9, padding: '9px 4px 9px 10px', border: 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer', fontFamily: FONT, color: T.text, minHeight: 52 }}>
          <span aria-hidden="true" style={{ width: 6, borderRadius: 3, background: color, flexShrink: 0 }} />
          <span style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <span style={{ fontSize: 15, fontWeight: 800, marginRight: 2, whiteSpace: 'nowrap' }}>{video && <PlayCircle size={14} color={T.accent} aria-hidden="true" style={{ verticalAlign: -2, marginRight: 4 }} />}{etiqueta}</span>
            {chips.map((c, k) => (
              <span key={k} style={{ background: T.bg2, borderRadius: 9, padding: '6px 9px', fontSize: c.ph ? 13.5 : 14.5, fontWeight: c.ph ? 600 : 800, color: c.ph ? T.text2 : T.text, boxShadow: '0 1px 2px rgba(17,19,24,0.08)', whiteSpace: 'nowrap' }}>{c.ph ?? c.v}</span>
            ))}
          </span>
        </button>
        <MenuDePaso nombre={etiqueta} acciones={acciones} />
      </div>
      {abierto && <div className="tl-corre-entra" style={{ padding: '6px 12px 10px' }}>{children}</div>}
    </div>
  );
}

/** «···»: Mover arriba, Mover abajo, Duplicar y Borrar (con «Deshacer»). El mismo control en todos los renglones. */
function MenuDePaso({ nombre, acciones, ancho = 44 }) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!abierto) return undefined;
    const fuera = (e) => { if (!ref.current?.contains(e.target)) setAbierto(false); };
    const tecla = (e) => { if (e.key === 'Escape') { e.preventDefault(); setAbierto(false); } };
    document.addEventListener('pointerdown', fuera); document.addEventListener('keydown', tecla);
    return () => { document.removeEventListener('pointerdown', fuera); document.removeEventListener('keydown', tecla); };
  }, [abierto]);
  const item = (texto, f, peligro = false) => f && (
    <button key={texto} type="button" role="menuitem" onClick={() => { setAbierto(false); f(); }}
      style={{ display: 'flex', width: '100%', minHeight: 44, padding: '0 12px', border: 'none', borderRadius: 10, background: 'transparent', cursor: 'pointer', fontFamily: FONT, fontWeight: 700, fontSize: 14.5, textAlign: 'left', alignItems: 'center', color: peligro ? T.danger : T.text }}>
      {texto}
    </button>
  );
  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button type="button" onClick={() => setAbierto((a) => !a)} aria-haspopup="menu" aria-expanded={abierto} aria-label={`Opciones de ${nombre}`}
        style={{ width: ancho, height: '100%', minHeight: 44, border: 'none', background: 'transparent', color: T.text2, cursor: 'pointer', fontFamily: FONT, fontWeight: 800, fontSize: 18, letterSpacing: 1 }}>
        ···
      </button>
      {abierto && (
        <div role="menu" className="tl-corre-menu" style={{ position: 'absolute', right: 4, top: 'calc(100% - 4px)', zIndex: 30, minWidth: 180, background: T.bg2, borderRadius: 14, padding: 6, boxShadow: '0 10px 30px rgba(17,19,24,0.16), 0 2px 6px rgba(17,19,24,0.08)', transformOrigin: 'top right' }}>
          {item('Mover arriba', acciones.arriba)}
          {item('Mover abajo', acciones.abajo)}
          {item('Duplicar', acciones.duplicar)}
          {item('Borrar', acciones.borrar, true)}
        </div>
      )}
    </div>
  );
}

/** «Repetir todo ___ veces»: el número se escribe ahí mismo; «veces» va fuera del cuadro para que se entienda aunque esté vacío. */
function RepetirTodo({ veces, onVeces }) {
  const id = useId();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, background: KP.blueSoft, borderRadius: 13, padding: '8px 10px', minHeight: 52 }}>
      <span aria-hidden="true" style={{ width: 6, alignSelf: 'stretch', borderRadius: 3, background: T.accent, flexShrink: 0 }} />
      <label htmlFor={id} style={{ fontSize: 15, fontWeight: 800, color: T.accent }}>Repetir todo</label>
      <input id={id} value={veces} onChange={(e) => onVeces(e.target.value.replace(/\D/g, '').slice(0, 2))} inputMode="numeric"
        style={{ width: 60, minHeight: 40, border: 'none', borderRadius: 9, background: T.bg2, textAlign: 'center', fontFamily: FONT, fontWeight: 800, fontSize: 17, color: T.text, boxShadow: '0 1px 2px rgba(17,19,24,0.08)' }} />
      <span style={{ fontSize: 14, fontWeight: 700, color: T.text2 }}>veces</span>
    </div>
  );
}

/** La gráfica de la pieza abierta: la forma del entreno, de un vistazo. */
function GraficaGrande({ barras }) {
  return (
    <div aria-hidden="true" style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 40, borderBottom: `2px solid ${KP.lineHi}`, margin: '0 0 12px' }}>
      {barras.map((b, i) => (
        <span key={i} style={{ display: 'block', flex: `${Math.max(b.m, 0.3)} 1 0`, minWidth: 3, height: b.n ? `${b.n * 20}%` : '6%', background: b.c ?? (b.n ? COLOR_ZONA[Math.round(b.n) - 1] : KP.lineHi), borderRadius: '3px 3px 0 0' }} />
      ))}
    </div>
  );
}



/** LA TRANSICIÓN de Triatlón: lo más rápido que pueda (lo de casi siempre) o en menos de un tiempo. */
function CamposDeTransicion({ x, onCambio }) {
  const [conTiempo, setConTiempo] = useState(num(x.q) > 0);
  return (
    <>
      <Fila rotulo="Cómo se hace">
        <div style={{ display: 'flex', maxWidth: 440 }}>
          <Segmentos opciones={[['tope', 'Lo más rápido que pueda'], ['tiempo', 'Con tiempo objetivo']]} valor={conTiempo ? 'tiempo' : 'tope'} etiqueta="Cómo se hace la transición"
            onCambio={(v) => { setConTiempo(v === 'tiempo'); if (v === 'tope') onCambio({ q: '' }); }} />
        </div>
      </Fila>
      {conTiempo && (
        <Fila rotulo="En menos de">
          {(id) => <Cantidad id={id} valor={x.q} unidad={x.u ?? 's'} unidades={[['s', 'seg'], ['min', 'min']]} marca={x.id} convertir={false} onCambio={(p) => onCambio(p)} />}
        </Fila>
      )}
      <Fila rotulo="Nota para el atleta">
        {(id) => <Texto id={id} valor={x.nota} onCambio={(nota) => onCambio({ nota })} ejemplo="Casco puesto antes de tocar la bici" />}
      </Fila>
    </>
  );
}

function CamposDeDescanso({ d, onCambio }) {
  return (
    <>
      {/* «Total» y «Activo» (Andrés, 19 nov 2026: «parado o caminando, ese lenguaje está terrible»). Se guarda igual: parado / camina. */}
      <Fila rotulo="Tipo de descanso">
        <Segmentos opciones={[['parado', 'Total'], ['camina', 'Activo']]} valor={d.tipo} etiqueta="Tipo de descanso" onCambio={(tipo) => onCambio({ tipo })} />
      </Fila>
      <div style={{ fontSize: 13, fontWeight: 600, color: T.text2, lineHeight: 1.4, margin: '-6px 0 16px' }}>{d.tipo === 'camina' ? 'Activo: sigue moviéndose suave, caminando o trotando.' : 'Total: sin moverse, para recuperarse.'}</div>
      <Fila rotulo="Cuánto descansa">
        {(id) => <Cantidad id={id} valor={d.q} unidad={d.u} unidades={[['s', 'seg'], ['min', 'min']]} marca={d.id} onCambio={onCambio} />}
      </Fila>
    </>
  );
}

/** La intensidad: «Intensidad [Zona ⌄]», un solo botón que baja la lista de formas (Andrés, 19 nov: las pestañas «funcionan pero se ven feas»).
    Es el mismo control que el encabezado «Pace ⌄» de la tabla de Intervalos. Primero las de esta Disciplina, luego las demás.
    Sin elegir dice «Elegir» (nada nace elegido). Cada modo guarda su valor: cambiar de modo no borra nada. */
function Intensidad({ t, familia, onCambio, rango, rangoLargo }) {
  const dep = useDeporte();
  // Lo que se ve primero: en una carrera, rodada o nado, lo de su deporte; en un sprint, al máximo primero.
  const base = familia === 'sprint' ? dep.modosSprint : dep.modos;
  const otras = dep.todos.filter((m) => !base.includes(m));
  const v = t.vals ?? {};
  const pon = (modo, valor) => onCambio({ vals: { ...v, [modo]: valor } });
  const opciones = [...base, ...otras].map((m) => [m, m === 'tope' ? 'Al máximo' : NOMBRE_MODO[m]]);
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 15, fontWeight: 800, color: T.text }}>Intensidad</span>
        <ListaQueBaja valor={t.modo} opciones={opciones} onElige={(modo) => onCambio({ modo })} anchoMin={170}
          etiqueta={`Cómo dices la intensidad: ${t.modo ? NOMBRE_MODO[t.modo] : 'sin elegir'}`}
          estiloBoton={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 40, padding: '0 12px', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 14.5,
            background: t.modo ? UI.relleno : KP.blueSoft, color: t.modo ? T.text : T.accent }}
          contenido={<>{t.modo ? NOMBRE_MODO[t.modo] : 'Elegir'}<ChevronDown size={15} aria-hidden="true" /></>} />
      </div>
      <div style={{ marginTop: 10 }}>
        {t.modo === 'zona' && (
          <>
            <Zonas valor={t.z} onCambio={(z) => onCambio({ z })} rango={rango} rangoLargo={rangoLargo} />
          </>
        )}
        {t.modo === 'ritmo' && <Rango a={v.ritmo} b={v.ritmo2} sufijo="min por km" ejA={['4', '20']} ejB={['4', '30']} onA={(x) => pon('ritmo', x)} onB={(x) => pon('ritmo2', x)} />}
        {t.modo === 'ritmo100' && <Rango a={v.ritmo} b={v.ritmo2} sufijo="por 100 m" ejA={['1', '25']} ejB={['1', '30']} onA={(x) => pon('ritmo', x)} onB={(x) => pon('ritmo2', x)} />}
        {t.modo === 'w' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Corto>Entre</Corto>
            <input value={v.w?.de ?? ''} onChange={(e) => pon('w', { ...v.w, de: e.target.value.replace(/\D/g, '').slice(0, 4) })} inputMode="numeric" placeholder="200" aria-label="Potencia desde" style={{ ...CAMPO, width: 84, textAlign: 'center', fontSize: 20 }} />
            <Corto>y</Corto>
            <input value={v.w?.a ?? ''} onChange={(e) => pon('w', { ...v.w, a: e.target.value.replace(/\D/g, '').slice(0, 4) })} inputMode="numeric" placeholder="220" aria-label="Potencia hasta" style={{ ...CAMPO, width: 84, textAlign: 'center', fontSize: 20 }} />
            <Corto>W</Corto>
          </div>
        )}
        {t.modo === 'tiempo' && (
          <>
            <Rango a={v.tiempo} b={v.tiempo2} sufijo={t.u === 'm' || t.u === 'km' ? `cada ${t.q || '…'} ${t.u}` : 'min : seg'} ejA={['1', '26']} ejB={['1', '28']} onA={(x) => pon('tiempo', x)} onB={(x) => pon('tiempo2', x)} />
            <Ayuda>El tiempo en que debe hacer cada repetición.</Ayuda>
          </>
        )}
        {t.modo === 'pulso' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Corto>Entre</Corto>
            <input value={v.pulso?.de ?? ''} onChange={(e) => pon('pulso', { ...v.pulso, de: e.target.value.replace(/\D/g, '').slice(0, 3) })} inputMode="numeric" placeholder="150" aria-label="Pulsaciones desde" style={{ ...CAMPO, width: 80, textAlign: 'center', fontSize: 20 }} />
            <Corto>y</Corto>
            <input value={v.pulso?.a ?? ''} onChange={(e) => pon('pulso', { ...v.pulso, a: e.target.value.replace(/\D/g, '').slice(0, 3) })} inputMode="numeric" placeholder="160" aria-label="Pulsaciones hasta" style={{ ...CAMPO, width: 80, textAlign: 'center', fontSize: 20 }} />
            <Corto>pulsaciones</Corto>
          </div>
        )}
        {t.modo === 'rpe' && (
          <>
            <div role="radiogroup" aria-label="Esfuerzo del 1 al 10" onKeyDown={conFlechas([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], v.rpe, (n) => pon('rpe', n))}
              style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(44px, 1fr))', gap: 5 }}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => {
                const on = v.rpe === n;
                return (
                  <button key={n} type="button" role="radio" aria-checked={on} tabIndex={on || (!v.rpe && n === 1) ? 0 : -1} onClick={() => pon('rpe', n)}
                    style={{ minHeight: 44, borderRadius: 11, border: 'none', cursor: 'pointer', fontFamily: FONT, fontWeight: 800, fontSize: 15, background: on ? T.accent : UI.relleno, color: on ? '#fff' : T.text }}>{n}</button>
                );
              })}
            </div>
            <Ayuda>1 es muy fácil; 10, lo máximo que puede dar.</Ayuda>
          </>
        )}
        {t.modo === 'tope' && <Ayuda>Lo más rápido que pueda.</Ayuda>}
        {t.modo === 'libre' && <Ayuda>Sin objetivo: a su ritmo.</Ayuda>}
      </div>
    </>
  );
}


/** Un tiempo, o un rango de tiempos: «4:20» o «entre 4:20 y 4:30». El segundo es opcional. */
function Rango({ a, b, sufijo, ejA, ejB, onA, onB }) {
  const [conB, setConB] = useState(!!mmss(b));
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      {conB && <Corto>Entre</Corto>}
      <MinSeg valor={a} onCambio={onA} ejemplo={ejA} etiqueta={conB ? 'Desde' : 'Tiempo'} />
      {conB && (
        <>
          <Corto>y</Corto>
          <MinSeg valor={b} onCambio={onB} ejemplo={ejB} etiqueta="Hasta" />
        </>
      )}
      <Corto>{sufijo}</Corto>
      {conB
        ? <BotonTexto onClick={() => { setConB(false); onB(undefined); }}>Uno solo</BotonTexto>
        : <BotonTexto onClick={() => setConB(true)}>Poner rango</BotonTexto>}
    </div>
  );
}

function MinSeg({ valor, onCambio, ejemplo = ['4', '30'], etiqueta = 'Tiempo' }) {
  const v = valor ?? {};
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <input value={v.min ?? ''} onChange={(e) => onCambio({ ...v, min: e.target.value.replace(/\D/g, '').slice(0, 2) })} inputMode="numeric" placeholder={ejemplo[0]} aria-label={`${etiqueta}: minutos`} style={{ ...CAMPO, width: 60, textAlign: 'center', padding: '0 6px', fontSize: 20 }} />
      <b style={{ fontSize: 18, color: T.text2 }}>:</b>
      {/* Los segundos aceptan décimas («4.2»): un sprint de 30 m se mide así. */}
      <input value={v.seg ?? ''} onChange={(e) => onCambio({ ...v, seg: e.target.value.replace(',', '.').replace(/[^\d.]/g, '').replace(/^(\d*\.\d?).*$/, '$1').slice(0, 4) })}
        onBlur={() => { if (!v.seg) return; const n = Math.min(59.9, num(v.seg)); onCambio({ ...v, seg: Number.isInteger(n) ? dosDigitos(n) : String(n) }); }} inputMode="decimal" placeholder={ejemplo[1]} aria-label={`${etiqueta}: segundos`} style={{ ...CAMPO, width: 64, textAlign: 'center', padding: '0 6px', fontSize: 20 }} />
    </span>
  );
}

function TiempoMinSeg({ segundos, onCambio }) {
  const [v, setV] = useState(segundos ? { min: String(Math.floor(segundos / 60)), seg: dosDigitos(segundos % 60) } : {});
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <Corto>En menos de</Corto>
      <MinSeg valor={v} ejemplo={['0', '50']} etiqueta="Tiempo límite" onCambio={(n) => { setV(n); const total = num(n.min) * 60 + Math.min(59, num(n.seg)); onCambio(total || null); }} />
      <Corto>min : seg</Corto>
    </div>
  );
}

function Caminadora({ cam, onCambio }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <input value={cam.kmh ?? ''} onChange={(e) => onCambio({ ...cam, kmh: e.target.value.replace(/[^\d.,]/g, '') })} inputMode="decimal" placeholder="12" aria-label="Velocidad de la caminadora en km/h" style={{ ...CAMPO, width: 80, textAlign: 'center', fontSize: 20 }} />
      <Corto>km/h</Corto>
      <input value={cam.inc ?? ''} onChange={(e) => onCambio({ ...cam, inc: e.target.value.replace(/[^\d.,]/g, '') })} inputMode="decimal" placeholder="1" aria-label="Inclinación en por ciento" style={{ ...CAMPO, width: 72, textAlign: 'center', fontSize: 20, marginLeft: 8 }} />
      <Corto>% de inclinación</Corto>
    </div>
  );
}

function Cadencia({ valor, onCambio }) {
  const [unidad, ejemplo] = useDeporte().cadencia ?? ['pasos por minuto', '180'];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <input value={valor ?? ''} onChange={(e) => onCambio(e.target.value.replace(/\D/g, '').slice(0, 3))} inputMode="numeric" placeholder={ejemplo} aria-label={`Cadencia en ${unidad}`} style={{ ...CAMPO, width: 88, textAlign: 'center', fontSize: 20 }} />
      <Corto>{unidad}</Corto>
    </div>
  );
}

/** CALENTAMIENTO Y ENFRIAMIENTO CON EJERCICIOS, EN SETS (Andrés, 21 nov 2026: lo mismo que Técnica). La misma pieza: Sets en un bloque azul,
    renglones con rayas, «− 2 + veces» en el Set. `t` es el calentamiento (o lo que tenga `sets` o los `items` de antes); `onCambio` recibe
    `{ sets, items }`: `items` se sigue escribiendo, en plano (con sus veces en `s`), para lo que todavía lo lee (lo que ve el atleta). */
export function SetsDeEjercicios({ t, onCambio, repertoire, onEjercicioCreado, usados, de = 'el calentamiento' }) {
  const x = { id: t.id ?? 'cal', sets: t.sets, items: t.items };
  const cambia = (fn) => {
    const nuevo = typeof fn === 'function' ? fn(x) : { ...x, ...fn };
    const sets = nuevo.sets ?? [];
    const items = sets.flatMap((st) => st.items.map((it) => ({ id: it.id, exercise_id: it.exercise_id, name: it.name, s: String(Math.max(1, num(st.veces) || 1)), q: it.q, u: it.u })));
    onCambio({ sets, items });
  };
  return <CamposDeTecnica x={x} onCambio={cambia} repertoire={repertoire} onEjercicioCreado={onEjercicioCreado} usados={usados} de={de} abreSolo={false} />;
}

/** Ejercicios de sus Ejercicios dentro de la lista (técnica o calentamiento): cada uno con series × metros, reps o segundos. Si no existe, se crea aquí. */
export function ListaDeEjercicios({ items, repertoire, onCambio, onEjercicioCreado, usados = new Set() }) {
  const [buscando, setBuscando] = useState(!items.length);
  const [q, setQ] = useState('');
  const [creando, setCreando] = useState(false);
  const cambiaItem = (id, p) => onCambio(items.map((it) => (it.id === id ? { ...it, ...p } : it)));
  const quita = (id) => onCambio(items.filter((it) => it.id !== id));
  // Los calentamientos guiados no son ejercicios sueltos: salen en «Guiado», no aquí. Sin buscar, primero los que ya usó en calentamientos y técnica.
  const ya = new Set(items.map((it) => it.exercise_id));
  const ejercicios = (repertoire ?? []).filter((e) => !esGuiado(e) && !ya.has(e.id));
  const sugeridos = ejercicios.filter((e) => usados.has(e.id));
  const encontrados = q ? ejercicios.filter((e) => sinAcentos(e.name).includes(sinAcentos(q))).slice(0, 8) : (sugeridos.length ? sugeridos : ejercicios).slice(0, 8);
  const exacto = (repertoire ?? []).some((e) => sinAcentos(e.name) === sinAcentos(q.trim()));
  const agrega = (e) => {
    const u = e.medida === 'reps' ? 'reps' : e.medida === 'seg' ? 's' : 'm';
    onCambio([...items, { id: nuevoId(), exercise_id: e.id, name: e.name, s: '2', q: u === 'reps' ? '10' : u === 's' ? '20' : '30', u }]);
    setQ('');
  };
  const crea = async () => {
    const nombre = q.trim();
    if (!nombre) return;
    setCreando(true);
    try {
      const fila = await createExercise({ name: nombre, medida: 'm', carga_tipo: 'nada' });
      onEjercicioCreado?.(fila);
      agrega(fila);
    } finally { setCreando(false); }
  };
  return (
    <div>
      {items.map((it) => (
        <div key={it.id} style={{ background: KP.surfaceMuted, borderRadius: 14, padding: '10px 12px', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <b style={{ flex: 1, fontSize: 15, fontWeight: 800, color: T.text }}>{it.name}</b>
            <button type="button" onClick={() => quita(it.id)} aria-label={`Quitar ${it.name}`} className="kp-press"
              style={{ width: 44, height: 44, borderRadius: 11, border: 'none', background: 'transparent', color: T.text3, display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
              <X size={17} />
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: T.text2 }}>
              Series
              <Contador texto={String(it.s)} etiqueta={`series de ${it.name}`} onMenos={() => cambiaItem(it.id, { s: String(Math.max(1, num(it.s) - 1)) })} onMas={() => cambiaItem(it.id, { s: String(Math.min(20, num(it.s) + 1)) })} menosApagado={num(it.s) <= 1} ancho={30} />
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, flex: '1 1 220px' }}>
              <Cantidad convertir={false} valor={it.q} unidad={it.u} unidades={[['m', 'm'], ['reps', 'reps'], ['s', 'seg']]} etiqueta={`Cuánto de ${it.name}`} onCambio={(p) => cambiaItem(it.id, p)} />
            </span>
          </div>
        </div>
      ))}
      {buscando ? (
        <div style={{ background: KP.surfaceMuted, borderRadius: 14, padding: 10 }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Busca en tus ejercicios: skip, switches…" aria-label="Buscar en tus ejercicios" style={CAMPO} autoFocus={!!items.length} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
            {!q && sugeridos.length > 0 && <div style={{ fontSize: 12.5, fontWeight: 700, color: T.text2, margin: '2px 4px 2px' }}>Los que ya usaste</div>}
            {encontrados.map((e) => (
              <button key={e.id} type="button" onClick={() => agrega(e)} className="kp-press"
                style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 48, padding: '0 12px', borderRadius: 11, border: 'none', background: T.bg2, boxShadow: KP.shCard, textAlign: 'left', cursor: 'pointer', fontFamily: FONT, color: T.text }}>
                <span style={{ flex: 1, fontSize: 14.5, fontWeight: 700 }}>{e.name}</span>
                {e.equipment && sinAcentos(e.equipment) !== 'peso corporal' && <span style={{ fontSize: 12.5, fontWeight: 600, color: T.text2 }}>{e.equipment}</span>}
                <Plus size={16} color={T.accent} aria-hidden="true" />
              </button>
            ))}
            {q.trim() && !exacto && (
              <button type="button" onClick={crea} disabled={creando} className="kp-press"
                style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 48, padding: '0 12px', borderRadius: 11, border: 'none', background: KP.blueSoft, textAlign: 'left', cursor: 'pointer', fontFamily: FONT, color: T.accent, fontWeight: 800, fontSize: 14.5 }}>
                <Plus size={16} aria-hidden="true" /> {creando ? 'Creando…' : `Crear «${q.trim()}» en tus ejercicios`}
              </button>
            )}
          </div>
          {!q && sugeridos.length > 0 && <Ayuda>Escribe para buscar en todos tus ejercicios.</Ayuda>}
          {items.length > 0 && <BotonTexto onClick={() => setBuscando(false)}>Listo</BotonTexto>}
        </div>
      ) : (
        <BotonTexto onClick={() => setBuscando(true)}>+ Agregar ejercicio</BotonTexto>
      )}
    </div>
  );
}

/** Guiado: un video que el atleta sigue completo. El botón principal elige uno de su repertorio (los marcados «Es un calentamiento guiado»,
    primero los que ya usó); subir o pegar uno nuevo son enlaces. Lo nuevo pregunta si se guarda en su repertorio o solo en esta sesión. */
export function CamposDeVideo({ t, calentamientos, categorias = [], nombreAtleta = '', onCambio, onEjercicioCreado }) {
  const [eligiendo, setEligiendo] = useState(false);
  // En la compu el botón va de su tamaño (Andrés, 21 nov 2026: «ese botón largo en la computadora se ve muy mal»); en el teléfono, a todo el ancho.
  const esCompu = useIsDesktop();
  const v = t.video;
  if (v?.url) {
    const nuevo = !v.exercise_id && !v.soloSesion;
    return (
      <div style={{ marginBottom: 10 }}>
        <TarjetaDeClase clase={v} titulo={v.nombre || 'Video guiado'} onCambiar={() => onCambio({ video: undefined })} onQuitar={() => onCambio({ video: undefined })} />
        {!v.duracion && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
            <Corto>Dura</Corto>
            <input value={t.q} onChange={(e) => onCambio({ q: e.target.value.replace(/[^\d.,]/g, ''), u: 'min' })} inputMode="decimal" aria-label="Cuánto dura el video en minutos" style={{ ...CAMPO, width: 80, textAlign: 'center', fontSize: 20 }} />
            <Corto>min</Corto>
          </div>
        )}
        {nuevo && <GuardarEnRepertorio video={v} minutos={v.duracion ? v.duracion / 60 : num(t.q)} categorias={categorias} nombreAtleta={nombreAtleta} onEjercicioCreado={onEjercicioCreado} onCambio={onCambio} />}
        {v.soloSesion && <Ayuda>Solo para esta sesión: no está en tu repertorio.</Ayuda>}
      </div>
    );
  }
  return (
    <div style={{ marginBottom: 10 }}>
      {calentamientos.length > 0 && (eligiendo ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
          <div style={{ ...ROTULO, margin: '0 2px 4px' }}>Tus calentamientos guiados</div>
          {calentamientos.map((e) => (
            <button key={e.id} type="button" className="kp-press"
              onClick={() => { setEligiendo(false); onCambio({ video: { ...claseNueva({ url: e.video_url || e.video_link || '', duracion: e.duracion_s }), nombre: e.name, exercise_id: e.id } }); }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 52, padding: '0 12px', borderRadius: 11, border: 'none', background: UI.relleno, textAlign: 'left', cursor: 'pointer', fontFamily: FONT, color: T.text }}>
              <PlayCircle size={18} color={T.accent} aria-hidden="true" />
              <span style={{ flex: 1, fontSize: 14.5, fontWeight: 700 }}>{e.name}</span>
              {num(e.duracion_s) > 0 && <span style={{ fontSize: 13, fontWeight: 700, color: T.text2 }}>{Math.round(e.duracion_s / 60)} min</span>}
            </button>
          ))}
        </div>
      ) : (
        <button type="button" onClick={() => setEligiendo(true)} className="kp-press"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: esCompu ? 'auto' : '100%', minHeight: 50, padding: esCompu ? '0 26px' : '0 14px', marginBottom: 4, borderRadius: 13, border: 'none', background: T.accent, color: '#fff', fontFamily: FONT, fontWeight: 800, fontSize: 15, cursor: 'pointer', boxShadow: KP.shBtn }}>
          <PlayCircle size={18} aria-hidden="true" /> Elegir de mi repertorio
        </button>
      ))}
      <AccionesDeClase conMias={false} discreto={calentamientos.length > 0} alElegir={(clase) => onCambio({ video: clase })} />
      {!calentamientos.length && <Ayuda>Para tenerlos a la mano: en la ficha de un ejercicio con video, enciende «Es un calentamiento guiado».</Ayuda>}
    </div>
  );
}

/** Un video nuevo (subido o pegado) no entra solo al repertorio: se pregunta. Guardarlo lo deja para otros atletas; si no, vive solo en esta sesión. */
function GuardarEnRepertorio({ video, minutos, categorias, nombreAtleta, onCambio, onEjercicioCreado }) {
  const [nombre, setNombre] = useState(nombreAtleta ? `Calentamiento de ${nombreAtleta}` : 'Calentamiento guiado');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const guarda = async () => {
    if (!nombre.trim()) return;
    setGuardando(true); setError('');
    try {
      const deLiga = !!ligaExterna(video.url);
      const cat = (categorias ?? []).find((c) => sinAcentos(c.name) === 'calentamiento') ?? (categorias ?? [])[0];
      const fila = await createExercise({
        name: nombre.trim(), category_id: cat?.id ?? null, medida: 'min', carga_tipo: 'nada', guiado: true,
        duracion_s: video.duracion || (minutos ? Math.round(minutos * 60) : null),
        video_link: deLiga ? video.url : null, video_url: deLiga ? null : video.url,
      });
      onEjercicioCreado?.(fila);
      onCambio({ video: { ...video, nombre: fila.name, exercise_id: fila.id } });
    } catch (e) {
      setError(e?.message || 'No se pudo guardar');
    } finally { setGuardando(false); }
  };
  return (
    <div style={{ background: KP.blueSoft, borderRadius: 14, padding: 12, marginTop: 10 }}>
      <div style={{ fontSize: 14.5, fontWeight: 800, color: T.text, marginBottom: 8 }}>¿Guardarlo en tu repertorio?</div>
      <input value={nombre} onChange={(e) => setNombre(e.target.value)} aria-label="Nombre del calentamiento" style={{ ...CAMPO, background: T.bg2 }} />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
        <button type="button" onClick={guarda} disabled={guardando || !nombre.trim()} className="kp-press"
          style={{ flex: '1 1 180px', minHeight: 46, border: 'none', borderRadius: 12, background: T.accent, color: '#fff', fontFamily: FONT, fontWeight: 800, fontSize: 14.5, cursor: 'pointer', opacity: guardando ? 0.6 : 1 }}>
          {guardando ? 'Guardando…' : 'Guardar en mi repertorio'}
        </button>
        <button type="button" onClick={() => onCambio({ video: { ...video, soloSesion: true } })} className="kp-press"
          style={{ flex: '1 1 140px', minHeight: 46, border: 'none', borderRadius: 12, background: 'transparent', color: T.accent, fontFamily: FONT, fontWeight: 800, fontSize: 14.5, cursor: 'pointer' }}>
          Solo para esta sesión
        </button>
      </div>
      {error && <div role="alert" style={{ color: T.danger, fontSize: 13, fontWeight: 700, marginTop: 8 }}>{error}</div>}
    </div>
  );
}

/** El ejercicio de su repertorio que es esta repetición (un sprint con trineo, por ejemplo): el atleta ve su video de ejemplo y su técnica. */
function EjercicioDeIntervalo({ ej, repertoire, onCambio, onEjercicioCreado, libre = false, usados = new Set(), grande = false, tecnica = false, serie = false }) {
  const dep = useDeporte();
  const sinEj = dep.libre;
  // En Técnica el ejercicio es obligatorio: recién agregada, abre directo la búsqueda con los que ya usó.
  const [buscando, setBuscando] = useState(tecnica && !ej);
  const ficha = ej ? (repertoire ?? []).find((e) => e.id === ej.exercise_id) : null;
  const conVideo = (e) => !!(e?.video_url || e?.video_link);
  // En Sprints, el ejercicio es lo primero y lo más grande (Andrés: «el ejercicio tiene muy poco protagonismo»).
  if (grande && !buscando) {
    const video = conVideo(ficha);
    return (
      <button type="button" onClick={() => setBuscando(true)} className="kp-press" aria-label={ej ? `Ejercicio: ${ej.name}. Cambiar` : tecnica ? 'Elegir el ejercicio' : `Ejercicio: ${sinEj}. Elegir ejercicio`}
        style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', maxWidth: 520, border: 'none', borderRadius: 14, background: UI.relleno, padding: '10px 14px 10px 10px', cursor: 'pointer', fontFamily: FONT, textAlign: 'left', color: T.text }}>
        <span aria-hidden="true" style={{ width: 56, height: 56, borderRadius: 11, display: 'grid', placeItems: 'center', flexShrink: 0, background: ej ? T.text : T.bg2, color: ej ? '#fff' : '#9CA3AF' }}>
          {ej ? <PlayCircle size={24} /> : <Zap size={24} />}
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 16.5, fontWeight: 800 }}>{ej ? ej.name : tecnica ? 'Sin ejercicio todavía' : sinEj}</span>
          <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: T.text2, marginTop: 2 }}>{ej ? `De tu repertorio · ${video ? 'con video' : 'aún sin video'}` : tecnica ? 'Elige uno de tu repertorio' : 'Sin ejercicio de tu repertorio'}</span>
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 13.5, fontWeight: 800, color: T.accent, whiteSpace: 'nowrap' }}><span className="tl-ej-txt">{ej ? 'Cambiar' : 'Elegir ejercicio'}</span><ChevronDown size={15} aria-hidden="true" /></span>
      </button>
    );
  }
  const tarjeta = (titulo, sub, icono) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: UI.relleno, borderRadius: 12, padding: '0 6px 0 12px', minHeight: 50 }}>
      {icono}
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 15, fontWeight: 800, color: T.text }}>{titulo}</span>
        <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: T.text2 }}>{sub}</span>
      </span>
      <BotonTexto onClick={() => setBuscando(true)}>Cambiar</BotonTexto>
    </div>
  );
  if (ej && !buscando) {
    return tarjeta(ej.name, conVideo(ficha) ? 'El atleta verá su video de ejemplo' : 'Aún sin video: agrégalo en Ejercicios', conVideo(ficha) ? <PlayCircle size={18} color={T.accent} aria-hidden="true" /> : null);
  }
  // En Sprints, sin ejercicio es «Sprint libre» (un valor, no un campo vacío que parezca obligatorio). En Intervalos, un enlace.
  if (!ej && !buscando) return libre ? tarjeta(sinEj, 'Sin ejercicio de tu repertorio', null) : <BotonTexto onClick={() => setBuscando(true)}>+ Elegir de tu repertorio</BotonTexto>;
  /* EL MISMO BUSCADOR QUE GYM Y HÍBRIDO (Andrés, 19 nov 2026: «la lista no es como las demás listas en donde escojo ejercicios»).
     Antes era una lista corta aquí mismo. Ahora es `RepertoirePicker` eligiendo uno solo: con sus filtros, su foto y su vista de lista o de
     cuadrícula. Lo de carrera va primero mientras no se busca nada (los que ya usó en intervalos o sprints y los que por su nombre lo son),
     y lo que no existe se crea con lo escrito, como antes. */
  const DE_CORRER = tecnica ? dep.buscaTec : dep.buscaInt;
  const deCorrer = (e) => usados.has(e.id) || DE_CORRER.test(sinAcentos(e.name));
  const elige = (e) => { onCambio(e ? { exercise_id: e.id, name: e.name } : undefined); setBuscando(false); };
  const crea = async (nombre) => {
    const fila = await createExercise({ name: nombre, medida: 'm', carga_tipo: 'nada' });
    onEjercicioCreado?.(fila); elige(fila);
  };
  return (
    <>
      {grande
        ? <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: T.text2, padding: '12px 2px' }}>Eligiendo el ejercicio…</span>
        : tarjeta(ej ? ej.name : libre ? sinEj : 'Sin ejercicio', 'Eligiendo el ejercicio…', null)}
      <RepertoirePicker
        uno
        exercises={(repertoire ?? []).filter((e) => !esGuiado(e))}
        title={tecnica ? 'Ejercicio de técnica' : serie ? 'Ejercicio de la serie' : libre ? 'Ejercicio del sprint' : dep.id === 'nado' ? 'Ejercicio del nado' : 'Ejercicio del intervalo'}
        primero={deCorrer}
        alCrear={crea}
        sinEjercicio={libre && ej ? { texto: `${sinEj} (sin ejercicio)`.replace('Sin ejercicio (sin ejercicio)', 'Sin ejercicio'), alTocar: () => elige(undefined) } : undefined}
        onClose={() => setBuscando(false)}
        onConfirm={(elegidos) => elige(elegidos[0])}
      />
    </>
  );
}

/** EL MATERIAL DE UN DRILL (Swimming, «Técnica de nado»). Una lista como las demás de la app: nace en «Sin material», se marca más de uno y
    al pie «Agregar material» guarda uno nuevo en la lista del coach para la próxima. Se cierra con Esc o tocando fuera. */
function ListaDeMaterial({ valor = [], onCambio }) {
  const [abierto, setAbierto] = useState(false);
  const [suyos, setSuyos] = useState(materialesDelCoach);
  const [nuevo, setNuevo] = useState(null);
  const ref = useRef(null);
  const todos = [...MATERIAL_NADO, ...suyos.filter((m) => !MATERIAL_NADO.includes(m)), ...valor.filter((m) => !MATERIAL_NADO.includes(m) && !suyos.includes(m))];
  useEffect(() => {
    if (!abierto) return undefined;
    const fuera = (e) => { if (!ref.current?.contains(e.target)) { setAbierto(false); setNuevo(null); } };
    const tecla = (e) => { if (e.key === 'Escape') { e.preventDefault(); setAbierto(false); setNuevo(null); ref.current?.querySelector('button')?.focus(); } };
    document.addEventListener('pointerdown', fuera);
    document.addEventListener('keydown', tecla);
    return () => { document.removeEventListener('pointerdown', fuera); document.removeEventListener('keydown', tecla); };
  }, [abierto]);
  const alterna = (m) => onCambio(valor.includes(m) ? valor.filter((v) => v !== m) : todos.filter((v) => v === m || valor.includes(v)));
  const guardaNuevo = () => {
    const n = String(nuevo ?? '').trim();
    if (!n) { setNuevo(null); return; }
    const ya = todos.find((m) => m.toLowerCase() === n.toLowerCase());
    if (!ya) { const l = [...suyos, n]; setSuyos(l); try { localStorage.setItem(LLAVE_MATERIAL, JSON.stringify(l)); } catch { /* sin espacio: solo para esta vez */ } }
    const elegido = ya ?? n;
    if (!valor.includes(elegido)) onCambio([...valor, elegido]);
    setNuevo(null);
  };
  const texto = valor.length ? juntaY(valor) : 'Sin material';
  const fila = (on) => ({ display: 'flex', alignItems: 'center', gap: 10, width: '100%', minHeight: 44, padding: '0 12px', border: 'none', borderRadius: 10, cursor: 'pointer', fontFamily: FONT, fontWeight: on ? 800 : 700, fontSize: 14.5, textAlign: 'left', whiteSpace: 'nowrap', background: on ? KP.blueSoft : 'transparent', color: on ? T.accent : T.text });
  return (
    <div ref={ref} data-material style={{ position: 'relative', display: 'inline-flex', maxWidth: '100%' }}>
      <button type="button" onClick={() => setAbierto(!abierto)} aria-haspopup="menu" aria-expanded={abierto} aria-label={`Material: ${texto}`}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 46, padding: '0 14px', border: 'none', borderRadius: 12, background: UI.relleno, color: valor.length ? T.text : T.text2, fontFamily: FONT, fontWeight: 800, fontSize: 15, cursor: 'pointer', maxWidth: '100%' }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{texto}</span><ChevronDown size={15} aria-hidden="true" style={{ flexShrink: 0 }} />
      </button>
      {abierto && (
        <div role="menu" aria-label="Material" className="tl-corre-menu"
          style={{ position: 'absolute', left: 0, top: 'calc(100% + 4px)', zIndex: 30, minWidth: 240, background: T.bg2, borderRadius: 14, padding: 6, boxShadow: '0 10px 30px rgba(17,19,24,0.16), 0 2px 6px rgba(17,19,24,0.08)' }}>
          <button type="button" role="menuitemradio" aria-checked={!valor.length} onClick={() => { onCambio([]); setAbierto(false); }} style={fila(!valor.length)}>
            <span style={{ flex: 1 }}>Sin material</span>{!valor.length && <Check size={17} strokeWidth={2.6} aria-hidden="true" />}
          </button>
          {todos.map((m) => {
            const on = valor.includes(m);
            // Solo se borran los que creó el coach; los 5 de inicio se quedan (Andrés, 21 nov 2026). Borrarlo de la lista no lo quita de las
            // sesiones que ya lo usan: ahí sigue escrito.
            const propio = suyos.includes(m) && !MATERIAL_NADO.includes(m);
            return (
              <div key={m} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <button type="button" role="menuitemcheckbox" aria-checked={on} onClick={() => alterna(m)} style={fila(on)}>
                  <span style={{ flex: 1 }}>{m}</span>{on && <Check size={17} strokeWidth={2.6} aria-hidden="true" />}
                </button>
                {propio && (
                  <button type="button" data-borra-material={m} aria-label={`Borrar «${m}» de tus materiales`} title="Borrar de tus materiales"
                    onClick={() => { const l = suyos.filter((x) => x !== m); setSuyos(l); try { localStorage.setItem(LLAVE_MATERIAL, JSON.stringify(l)); } catch { /* sin espacio: solo para esta vez */ } }}
                    style={{ flexShrink: 0, width: 36, height: 36, display: 'grid', placeItems: 'center', border: 'none', borderRadius: 10, background: 'transparent', color: T.danger, cursor: 'pointer' }}>
                    <Trash2 size={16} strokeWidth={2.2} aria-hidden="true" />
                  </button>
                )}
              </div>
            );
          })}
          <div style={{ borderTop: `1px solid ${KP.line}`, margin: '4px 0 0', padding: '6px 0 0' }}>
            {nuevo == null ? (
              <button type="button" onClick={() => setNuevo('')} style={{ ...fila(false), color: T.accent, fontWeight: 800 }}>
                <Plus size={16} aria-hidden="true" /> Agregar material
              </button>
            ) : (
              <div style={{ display: 'flex', gap: 6, padding: '0 4px 4px' }}>
                <input autoFocus value={nuevo} onChange={(e) => setNuevo(e.target.value.slice(0, 30))} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); guardaNuevo(); } }}
                  placeholder="Paracaídas" aria-label="Nombre del material nuevo" style={{ ...CAMPO, minHeight: 42, flex: 1, minWidth: 0 }} />
                <button type="button" onClick={guardaNuevo} className="kp-press"
                  style={{ border: 'none', borderRadius: 10, minHeight: 42, padding: '0 14px', background: T.accent, color: '#fff', fontFamily: FONT, fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>Agregar</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Zonas({ valor, onCambio, rango }) {
  return (
    <>
    <div role="radiogroup" aria-label="Zona" onKeyDown={conFlechas([1, 2, 3, 4, 5], valor, onCambio)} style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 5 }}>
      {ZONAS.map((Z) => {
        const on = valor === Z.z;
        return (
          <button key={Z.z} type="button" role="radio" aria-checked={on} tabIndex={on ? 0 : -1} onClick={() => onCambio(Z.z)} aria-label={`Zona ${Z.z}, ${Z.nombre}, ${rango(Z.z)}`}
            style={{ border: 'none', borderRadius: 12, minHeight: 64, padding: '6px 2px', cursor: 'pointer', fontFamily: FONT, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, position: 'relative', overflow: 'hidden',
              background: on ? COLOR_ZONA[Z.z - 1] : UI.relleno, color: on ? TINTA_ZONA[Z.z - 1] : T.text, transition: 'background .15s ease' }}>
            {!on && <i aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 4, background: COLOR_ZONA[Z.z - 1] }} />}
            <b style={{ fontSize: 15, fontWeight: 800 }}>Z{Z.z}</b>
            <span style={{ fontSize: 12, fontWeight: 700, opacity: 0.85, whiteSpace: 'nowrap' }}>{rango(Z.z)}</span>
          </button>
        );
      })}
    </div>
    {/* Dónde salgan las zonas, dicen cómo se sienten (la prueba de hablar) y sus pulsaciones. */}
    {valor && <Ayuda>Zona {valor}: <b style={{ color: T.text }}>{ZONA_SE_SIENTE[valor - 1]}</b></Ayuda>}
    </>
  );
}

/** Un número con su unidad: el número grande (es lo que se escribe), las unidades compactas a su lado.
    Cambiar la unidad convierte el número que puso la app (15 min → 2500 m), nunca el que acaba de escribir el coach: «8» y luego «km» son 8 km. */
function Cantidad({ id, valor, unidad, unidades, onCambio, marca, etiqueta, ritmo = 6, convertir = true }) {
  const escrito = useRef(false);
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', minWidth: 0 }}>
      <input id={id} data-corre-cuanto={marca} value={valor} onChange={(e) => { escrito.current = true; onCambio({ q: e.target.value.replace(/[^\d.,]/g, '') }); }} inputMode="decimal" aria-label={id ? undefined : etiqueta}
        style={{ ...CAMPO, width: 80, flexShrink: 0, textAlign: 'center', fontSize: 20, padding: '0 6px' }} />
      <Segmentos compacto opciones={unidades} valor={unidad} etiqueta="Unidad" onCambio={(u) => onCambio(convertir && !escrito.current ? { u, q: convierte(valor, unidad, u, ritmo) } : { u })} />
    </div>
  );
}

/** Pocas opciones en una pista (unidades, descanso): no se parte en renglones. */
export function Segmentos({ opciones, valor, onCambio, etiqueta, compacto = false, natural = false }) {
  const vals = opciones.map((o) => o[0]);
  return (
    <div role="radiogroup" aria-label={etiqueta} onKeyDown={conFlechas(vals, valor, onCambio)} style={{ display: 'flex', background: UI.relleno, borderRadius: 12, padding: 3, flex: compacto ? '0 0 auto' : 1, gap: 2, minWidth: 0 }}>
      {opciones.map(([v, l]) => {
        const on = v === valor;
        return (
          <button key={v} type="button" role="radio" aria-checked={on} tabIndex={on ? 0 : -1} onClick={() => onCambio(v)}
            style={{ flex: natural ? '0 0 auto' : 1, border: 'none', borderRadius: 9, minHeight: 42, minWidth: compacto ? 38 : 44, padding: compacto ? '0 7px' : '0 6px', cursor: 'pointer', fontFamily: FONT, fontWeight: 800, fontSize: 13.5, whiteSpace: 'nowrap',
              background: on ? T.bg2 : 'transparent', color: on ? T.text : T.text2, boxShadow: on ? KP.shCard : 'none', transition: 'background .12s ease' }}>
            {l}
          </button>
        );
      })}
    </div>
  );
}

/** Fichas en rejilla (intensidad, material o terreno). `enRejilla={false}`: las fichas van sueltas dentro de la rejilla de quien las pinta. */
function Opciones({ opciones, valor, onCambio, etiqueta, enRejilla = true }) {
  const vals = opciones.map((o) => o[0]);
  const fichas = opciones.map(([v, l]) => {
    const on = v === valor;
    return (
      <button key={v} type="button" role="radio" aria-checked={on} tabIndex={on ? 0 : -1} onClick={() => onCambio(v)}
        style={{ border: 'none', borderRadius: 11, minHeight: 44, padding: '0 4px', minWidth: 0, cursor: 'pointer', fontFamily: FONT, fontWeight: 800, fontSize: 13.5, whiteSpace: 'nowrap',
          background: on ? KP.blueSoft : UI.relleno, color: on ? T.accent : T.text, transition: 'background .12s ease' }}>
        {l}
      </button>
    );
  });
  return (
    <div role="radiogroup" aria-label={etiqueta} onKeyDown={conFlechas(vals, valor, onCambio)}
      style={enRejilla ? { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 6 } : { display: 'contents' }}>
      {fichas}
    </div>
  );
}

// Las cajas de la tabla de intervalos: más chicas que un campo suelto para que el renglón no se parta.
const CELDA_CHICA = { border: 'none', borderRadius: 10, background: UI.relleno, minHeight: 40, padding: '0 4px', fontFamily: FONT, fontWeight: 800, fontSize: 15.5, color: T.text, textAlign: 'center', boxSizing: 'border-box' };
const CAMPO = { border: 'none', borderRadius: 12, background: UI.relleno, minHeight: 46, padding: '0 12px', fontFamily: FONT, fontWeight: 800, fontSize: 16, color: T.text, width: '100%', boxSizing: 'border-box' };
const Texto = ({ id, valor, onCambio, ejemplo, etiqueta }) => <input id={id} value={valor ?? ''} onChange={(e) => onCambio(e.target.value)} placeholder={ejemplo} aria-label={id ? undefined : etiqueta} style={CAMPO} />;
const Corto = ({ children }) => <span style={{ fontSize: 14, fontWeight: 700, color: T.text2 }}>{children}</span>;
/** Un campo con su rótulo de verdad (`<label>` ligado a su casilla). `children` puede ser una función que recibe el id. */
const CELDA = CELDA_CHICA;
function Fila({ rotulo, children, seccion = null }) {
  const id = useId();
  const esFuncion = typeof children === 'function';
  return (
    <div style={{ marginBottom: 14 }}>
      {rotulo && seccion ? <Seccion color={seccion} htmlFor={esFuncion ? id : undefined}>{rotulo}</Seccion> : rotulo && (esFuncion
        ? <label htmlFor={id} style={ROTULO}>{rotulo}</label>
        : <div style={ROTULO}>{rotulo}</div>)}
      {esFuncion ? children(id) : children}
    </div>
  );
}
const ROTULO = { display: 'block', fontSize: 13, fontWeight: 700, color: T.text2, marginBottom: 6 };
const Ayuda = ({ children }) => <div style={{ fontSize: 13, fontWeight: 600, color: T.text2, marginTop: 8, lineHeight: 1.4 }}>{children}</div>;
const BotonTexto = ({ onClick, children, gris = false }) => (
  <button type="button" onClick={onClick} style={{ border: 'none', background: 'transparent', color: gris ? T.text2 : T.accent, fontFamily: FONT, fontWeight: 800, fontSize: 14, minHeight: 44, padding: 0, cursor: 'pointer' }}>{children}</button>
);
export function BotonChico({ icono: Icono, onClick, children, peligro = false, apagado = false }) {
  return (
    <button type="button" onClick={apagado ? undefined : onClick} disabled={apagado} className="kp-press"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', borderRadius: 11, minHeight: 44, padding: '0 10px', cursor: apagado ? 'default' : 'pointer', fontFamily: FONT, fontWeight: 700, fontSize: 13.5,
        background: 'transparent', color: peligro ? T.danger : T.text2, opacity: apagado ? 0.4 : 1 }}>
      <Icono size={16} aria-hidden="true" /> {children}
    </button>
  );
}

// El anillo del teclado y la entrada suave de lo que se abre (solo opacidad y movimiento; sin movimiento si la persona lo pidió).
const ESTILOS = `
.tl-corre button:focus-visible,.tl-corre input:focus-visible,.tl-corre select:focus-visible,.tl-corre-hoja button:focus-visible{outline:2px solid #1E40E0;outline-offset:2px} /* estilo-ok: anillo de foco del teclado */
.tl-corre input:focus,.tl-corre select:focus{box-shadow:inset 0 0 0 1.5px #1E40E0} /* estilo-ok: aro de foco al escribir */
.tl-corre-entra{animation:tl-corre-entra .16s ease-out}
.tl-int{container-type:inline-size}
.tl-spr-enc{display:none}
@container (max-width: 420px){.tl-ej-txt{display:none}}
.tl-spr-fila{display:grid;grid-template-columns:24px minmax(0,1fr) 32px;column-gap:12px;row-gap:8px;align-items:center;padding:10px 0;border-top:1px solid #ECEEF2}
.tl-spr-num{width:24px;height:24px;border-radius:7px;display:grid;place-items:center;font-size:12.5px;font-weight:800}
.tl-spr-dist{grid-column:2;min-width:0}
.tl-spr-desc{grid-column:2;display:flex;align-items:center;gap:8px}
.tl-spr-menu{grid-column:3;grid-row:1}
.tl-spr-rot{font-size:13px;font-weight:700;color:#5B616E;margin-right:4px}
@container (min-width: 600px){
.tl-spr-enc{display:grid;grid-template-columns:24px 262px minmax(0,1fr) 32px;column-gap:14px;font-size:13px;font-weight:700;color:#5B616E;padding:0 0 8px}
.tl-spr-fila{grid-template-columns:24px 262px minmax(0,1fr) 32px;column-gap:14px}
.tl-spr-desc{grid-column:3;grid-row:1}.tl-spr-menu{grid-column:4}.tl-spr-rot{display:none}}
@container (min-width: 860px){.tl-spr-rejilla{display:grid;grid-template-columns:minmax(0,1fr) 290px;column-gap:28px;align-items:start}}
@container (min-width: 640px){.tl-int-rejilla{display:grid;grid-template-columns:minmax(0,1fr) 270px;column-gap:24px;align-items:start}}
.tl-corre-recien{animation:tl-corre-recien 1.4s ease-out}
.tl-corre-lado{animation:tl-corre-lado .24s cubic-bezier(.32,.72,0,1)}
@keyframes tl-corre-lado{from{transform:translateX(100%)}to{transform:none}}
@keyframes tl-corre-recien{0%,35%{background:#DDF3EA}100%{background:#F2F3F7}}
@keyframes tl-corre-entra{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
.tl-corre-menu{transform-origin:top left;animation:tl-corre-menu .15s cubic-bezier(.23,1,.32,1)}
@keyframes tl-corre-menu{from{opacity:0;transform:scale(.97) translateY(-4px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion: reduce){.tl-corre-entra,.tl-corre-menu,.tl-corre-lado{animation:tl-corre-fade .12s linear}@keyframes tl-corre-fade{from{opacity:0}}}
`;
