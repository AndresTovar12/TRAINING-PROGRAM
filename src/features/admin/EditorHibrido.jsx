import { useEffect, useMemo, useState } from 'react';
import {
  Activity, ArrowLeftRight, ArrowRight, Bike, Check, ChevronDown, ChevronUp, Copy, Dumbbell, Flag, Footprints, Hourglass, ListOrdered, Minus,
  Mountain, PersonStanding, Repeat, RotateCcw, Shapes, SlidersHorizontal, Snowflake, StickyNote, Timer, Trash2, TrendingUp, Video, Waves, Zap,
} from 'lucide-react';
import RepertoirePicker from '@/features/admin/RepertoirePicker';
import ListaDesplegable from '@/components/ListaDesplegable';
import { updateExercise } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { disciplinasPorUso } from '@/lib/disciplinas';
import {
  UNIDADES, INT, PESOS, RANGO, GRUPO, tipoDe, permitidas, disciplinasDe, esCardio, comparteCasilla, llevaCargaExtra, lugarDe, cadenciaDe, titulosDe,
  nuevoId, setNuevo, renglonNuevo, loQueAprende, enBase, deBase, ponValores, acomoda, progresivaDe, intervalosDe, resumenDeSprints,
} from '@/lib/hibrido';

/* EL EDITOR HÍBRIDO (Hyrox, CrossFit y cualquier entrenamiento mixto; la Disciplina se llama «Híbrido», por dentro `hyrox`). Acordado con Andrés en un prototipo aparte, 19 nov 2026; las reglas están en `lib/hibrido.js`.
   · Una CADENA: una línea a la izquierda une los ejercicios del Set, uno tras otro. Así no se confunde con Pesas (tarjetas con barra azul).
   · Un renglón por ejercicio. Qué casillas trae lo decide su ficha. Se toca y se abre lo avanzado: lo de Pesas (cambia en cada vuelta, por
     lado…) o lo de Correr (constante, progresiva, con intervalos, sprints), con las mismas palabras del editor de Correr.
   · Los descansos viven en la cadena, donde ocurren: entre ejercicios, al final de la vuelta y entre Sets.
   Se guarda en `day.hibrido = { sets }`, aparte de `day.exercises` (Pesas) y de `day.tramos` (Correr). */

const ZONAS = [['', 'Elegir'], ['1', '1'], ['2', '2'], ['3', '3'], ['4', '4'], ['5', '5']];
const FORMATOS = [['rep', 'Se repite'], ['amrap', 'AMRAP'], ['emom', 'EMOM'], ['tiempo', 'Por tiempo']];
const UN_TRAMO = [['m', 'm'], ['km', 'km'], ['min', 'min'], ['seg', 'seg']];
const MATERIAL = [['trineo', 'Con trineo'], ['paracaidas', 'Con paracaídas'], ['vallas', 'Con vallas'], ['cuesta', 'En cuesta'], ['otro', 'Otro']];
const CON_MATERIAL = { trineo: 'con trineo', paracaidas: 'con paracaídas', vallas: 'con vallas', cuesta: 'en cuesta', otro: 'otro material' };
const TONOS = ['#C7D2FB', '#97A9F5', '#6F8AF0', '#3557E4', '#1530A8'];
const ICONO = { fuerza: Dumbbell, correr: Footprints, remo: Waves, ski: Snowflake, bici: Bike, cardio: Activity, duda: Shapes };

function Campo({ valor, onCambio, cl = '', ph = '', label, modo = 'decimal' }) {
  return <input className={`campo ${cl}`} value={valor ?? ''} placeholder={ph} inputMode={modo} aria-label={label} onChange={(e) => onCambio(e.target.value)} />;
}
/* LAS LISTAS SON LAS DE LA APP, NO LAS DEL NAVEGADOR (Andrés, 19 nov 2026: «todas las listas desplegables sean las de la aplicación»).
   Mismo componente que Pesas, Correr y el repertorio (`ListaDesplegable`), vestido como la casilla pequeña donde vive:
     uni   texto gris con flechita, junto a un número (reps, kg, min…)          zona  casilla gris (Zona, Pace, tipo de intensidad…)
     gris  casilla gris más alta (el formato del Set)                           azul  texto azul (el título de la tabla de intervalos) */
const ESTILOS_LISTA = {
  uni: { background: 'transparent', boxShadow: 'none', padding: '0 2px', minHeight: 40, borderRadius: 8, fontSize: 13, fontWeight: 800, color: '#6B7280', gap: 2 },
  azul: { background: 'transparent', boxShadow: 'none', padding: '0 2px', minHeight: 40, borderRadius: 8, fontSize: 13, fontWeight: 800, color: '#1E40E0', gap: 2 },
  zona: { background: '#EBEDF1', boxShadow: 'none', padding: '0 10px', minHeight: 40, borderRadius: 10, fontSize: 14.5, fontWeight: 800, color: '#111318', gap: 3, justifyContent: 'center' },
  gris: { background: '#EBEDF1', boxShadow: 'none', padding: '0 13px', minHeight: 40, borderRadius: 12, fontSize: 14, fontWeight: 800, color: '#111318', gap: 6 },
};
const ANCHO_LISTA = { uni: 190, azul: 240, zona: 220, gris: 200 };
function Lista({ ops, valor, onCambio, cl = 'uni', rotulo, label = 'Cambiar' }) {
  const k = cl.includes('gris') ? 'gris' : cl.includes('azul') ? 'azul' : cl.includes('zona') ? 'zona' : 'uni';
  // `corta` es lo que dice el botón cerrado; la lista, abierta, dice la etiqueta entera.
  const opciones = ops.map(([v, t]) => ({ valor: v, etiqueta: t, corta: v === valor && rotulo ? rotulo : undefined }));
  const actual = ops.find((o) => o[0] === valor)?.[1];
  return (
    <ListaDesplegable
      valor={valor ?? ''} onCambio={onCambio} opciones={opciones} etiqueta={label} marcador={rotulo ?? actual ?? 'Elegir'}
      estilo={ESTILOS_LISTA[k]} flecha={12} colorFlecha={k === 'azul' ? '#1E40E0' : '#6B7280'} anchoMinimo={ANCHO_LISTA[k]} alto={300}
    />
  );
}
function Mosaico({ Icono, texto, on, onClick, cl = '', abre = false }) {
  return (
    <button type="button" className={`mosaico${on ? ' on' : ''}${cl ? ` ${cl}` : ''}`} {...(abre ? { 'aria-haspopup': 'dialog' } : { 'aria-pressed': on })} onClick={onClick}>
      <Icono size={21} strokeWidth={2} aria-hidden="true" /><span>{texto}</span>
      {on && <i aria-hidden="true"><Check size={10} strokeWidth={3.6} color="#fff" /></i>}
    </button>
  );
}

// `atleta` y `onVideoAtleta`: el botón «Su video» de cada ejercicio, el mismo de Gym (un video solo para este atleta, ver `MediaParaEsteAtleta`).
export default function EditorHibrido({ hibrido, onHibrido, repertoire = [], soloLectura = false, atleta = null, onVideoAtleta }) {
  const sets = hibrido?.sets ?? [];
  const [abierto, setAbierto] = useState(null);
  const [descansoAbierto, setDescansoAbierto] = useState(null);
  const [buscador, setBuscador] = useState(null);   // { set: id | null }
  const [porUso, setPorUso] = useState({});
  const [aprendido, setAprendido] = useState({});

  /* Las Disciplinas que se marcan solas: en qué sesiones se ha usado cada ejercicio. Mismo cálculo que la ficha del repertorio. */
  useEffect(() => {
    let vivo = true;
    Promise.resolve(supabase.from('plans').select('data'))
      .then(({ data }) => { if (vivo) setPorUso(Object.fromEntries(repertoire.map((e) => [e.id, disciplinasPorUso(data ?? [], e)]))); })
      .catch(() => {});
    return () => { vivo = false; };
  }, [repertoire]);

  const fichas = useMemo(() => new Map(repertoire.map((e) => [e.id, e])), [repertoire]);
  const fichaDe = (id) => { const f = fichas.get(id); return f ? { ...f, ...aprendido[id] } : (aprendido[id] ? { id, ...aprendido[id] } : null); };
  const discDe = (f) => disciplinasDe(f, porUso[f?.id] ?? []);
  const tipoDelRenglon = (it) => { const f = fichaDe(it.exercise_id); return tipoDe(f, discDe(f)); };

  const guarda = (fn) => { const S = structuredClone(sets); fn(S); onHibrido({ ...hibrido, sets: S }); };
  /* Cambia un renglón y, si la ficha no decía cómo se usa ese ejercicio, la app lo aprende de lo que el coach acaba de elegir. */
  const enRenglon = (si, ii, fn, aprende = false) => guarda((S) => {
    const it = S[si].items[ii];
    fn(it, S[si]);
    if (!aprende || !it.exercise_id) return;
    const f = fichaDe(it.exercise_id);
    const parche = loQueAprende(f, discDe(f), it);
    if (!parche) return;
    setAprendido((a) => ({ ...a, [it.exercise_id]: { ...a[it.exercise_id], ...parche } }));
    Promise.resolve(updateExercise(it.exercise_id, parche)).catch(() => {});
  });

  /* ---------- Las casillas del renglón ---------- */
  const valorInt = (it, obj, cual, alCambiar, cl = '') => {
    const t = it.int.tipo;
    if (t === 'tope') return null;
    if (t === 'zona') return <Lista ops={ZONAS} valor={obj[cual] || ''} onCambio={(v) => alCambiar(cual, v)} cl={`zona ${cl}`} label="Zona" />;
    const ph = { pace: '4:30', r500: '2:05', pulso: '150', w: '200', rpe: '8', tiempo: '9.5' }[t] ?? '2';
    return <Campo valor={obj[cual]} onCambio={(v) => alCambiar(cual, v)} cl={`${RANGO.includes(t) ? 'ch ' : ''}${cl}`} ph={ph} label={`${INT[t]}${RANGO.includes(t) ? (cual === 'a' ? ' desde' : ' hasta') : ''}`} />;
  };
  const cambiaTipoDeInt = (it, v) => {
    if (v === '-') { it.int = null; return; }
    it.int = { tipo: v, a: '', b: '' };
    if ((v === 'tope' || v === 'tiempo') && it.como !== 'sprint') it.como = 'sprint';
    if (it.pg) { it.pg.ini = { a: '', b: '' }; it.pg.fin = { a: '', b: '' }; it.pg.mi = false; ponValores(it); }
    if (it.iv) it.iv.lista.forEach((x) => { x.a = ''; x.b = ''; });
  };
  const casillaDeIntensidad = (it, si, ii, tipo) => {
    const t = it.int.tipo, cardio = esCardio(tipo, it);
    if (cardio && it.como === 'prog') { const g = it.pg ?? { ini: {}, fin: {} }; return <button type="button" className="zona" onClick={() => setAbierto(it.id)}>{INT[t]} {g.ini.a || '…'} <ArrowRight size={13} strokeWidth={2.6} aria-hidden="true" /> {g.fin.a || '…'}</button>; }
    if (cardio && it.como === 'int') return <button type="button" className="zona" onClick={() => setAbierto(it.id)}>{INT[t]} · {(it.iv?.lista ?? []).length} intervalos</button>;
    const ops = [...permitidas(tipo, fichaDe(it.exercise_id), it.como === 'sprint').int.map((k) => [k, INT[k]]), ['-', 'Quitar la intensidad']];
    const pon = (cual, v) => enRenglon(si, ii, (x) => { x.int[cual] = v; });
    return (
      <>
        <Lista ops={ops} valor={t} rotulo={INT[t]} label="Tipo de intensidad" onCambio={(v) => enRenglon(si, ii, (x) => cambiaTipoDeInt(x, v), true)} />
        {valorInt(it, it.int, 'a', pon)}{t === 'tiempo' && <span className="sep">seg</span>}
        {RANGO.includes(t) && <><span className="sep">a</span>{valorInt(it, it.int, 'b', pon)}</>}
      </>
    );
  };
  /* «Peso o intensidad». En fuerza, peso y esfuerzo comparten la casilla; en carrera y máquinas, ahí va la intensidad. */
  const casillaPrincipal = (it, si, ii, tipo) => {
    const P = permitidas(tipo, fichaDe(it.exercise_id), it.como === 'sprint'), R = 'Peso o intensidad';
    if (!comparteCasilla(tipo, it)) {
      if (it.int) return <span className="cel" data-r={R}>{casillaDeIntensidad(it, si, ii, tipo)}</span>;
      return <span className="cel" data-r={R}><button type="button" className="mas" title="Agregar intensidad" aria-label="Agregar intensidad" onClick={() => enRenglon(si, ii, (x) => cambiaTipoDeInt(x, P.int[0]), true)}>+</button></span>;
    }
    const ops = [...P.peso.map((x) => [x, x]), ...P.int.map((k) => [k, INT[k]])];
    const pon = (v) => enRenglon(si, ii, (x) => {
      if (v === '-') { x.peso = null; x.int = null; } else if (PESOS.includes(v)) { x.peso = { q: x.peso?.q ?? '', u: v }; x.int = null; } else { x.peso = null; cambiaTipoDeInt(x, v); }
    }, true);
    if (it.int) {
      const t = it.int.tipo, ponV = (cual, v) => enRenglon(si, ii, (x) => { x.int[cual] = v; });
      return <span className="cel" data-r={R}><Lista ops={[...ops, ['-', 'Quitar']]} valor={t} rotulo={INT[t]} label="Peso o intensidad" onCambio={pon} />{valorInt(it, it.int, 'a', ponV)}{RANGO.includes(t) && <><span className="sep">a</span>{valorInt(it, it.int, 'b', ponV)}</>}</span>;
    }
    if (it.peso) return <span className="cel" data-r={R}><Campo valor={it.peso.q} label="Peso" onCambio={(v) => enRenglon(si, ii, (x) => { x.peso.q = v; })} /><Lista ops={[...ops, ['-', 'Quitar']]} valor={it.peso.u} rotulo={it.peso.u} label="Peso o intensidad" onCambio={pon} /></span>;
    const grupos = [];
    if (P.peso.length) grupos.push(['Peso', P.peso.map((x) => [x, x])]);
    for (const g of ['Esfuerzo', 'Cardio']) { const o = P.int.filter((k) => GRUPO[k] === g).map((k) => [k, INT[k]]); if (o.length) grupos.push([g, o]); }
    return (
      <span className="cel" data-r={R}>
        <ListaDesplegable
          valor="" onCambio={pon} etiqueta="Agregar peso o intensidad" marcador="+" flecha={false} anchoMinimo={190} alto={320}
          grupos={grupos.map(([g, o]) => ({ titulo: g, opciones: o.map(([v, t]) => ({ valor: v, etiqueta: t })) }))}
          estilo={{ width: 40, height: 40, minHeight: 40, padding: 0, justifyContent: 'center', textAlign: 'center', background: '#F6F7FA', boxShadow: 'none', borderRadius: 10, fontSize: 18, fontWeight: 800, color: '#B4B9C4' }}
        />
      </span>
    );
  };
  /* «Carga extra»: el chaleco o el trineo de un ejercicio de carrera. Aparte de la intensidad, porque no es lo mismo. */
  const casillaDeCargaExtra = (it, si, ii, tipo) => {
    if (!llevaCargaExtra(tipo, it)) return <span className="cel sin" />;
    if (it.peso) {
      return (
        <span className="cel" data-r="Carga extra">
          <Campo valor={it.peso.q} label="Carga extra" onCambio={(v) => enRenglon(si, ii, (x) => { x.peso.q = v; })} />
          <Lista ops={[['kg', 'kg'], ['lb', 'lb'], ['-', 'Quitar la carga extra']]} valor={it.peso.u} rotulo={it.peso.u} label="Unidad de la carga extra" onCambio={(v) => enRenglon(si, ii, (x) => { if (v === '-') x.peso = null; else x.peso.u = v; })} />
        </span>
      );
    }
    return <span className="cel" data-r="Carga extra"><button type="button" className="mas" title="Agregar carga extra" aria-label="Agregar carga extra" onClick={() => enRenglon(si, ii, (x) => { x.peso = { q: '', u: 'kg' }; })}>+</button></span>;
  };

  /* ---------- El descanso, en la cadena ---------- */
  // `conTipo`: «Total / Activo». El de entre vueltas no lo lleva (Andrés, 21 nov 2026: «en descanso entre vueltas quítale lo de total y activo»).
  const descanso = (d, clave, ponlo, { q0, u0, anade, cola = null, de = '', conTipo = true }) => {
    if (!d) return <button type="button" className="tenue" onClick={() => { ponlo(() => ({ q: q0, u: u0, tipo: 'total' })); setDescansoAbierto(clave); }}>+ {anade}</button>;
    if (descansoAbierto !== clave) {
      return <><button type="button" className="pildora" onClick={() => setDescansoAbierto(clave)}><Timer size={14} strokeWidth={2.4} aria-hidden="true" /> {d.q || '…'} {d.u} de descanso{d.tipo === 'activo' ? ' activo' : ''}{de}</button>{cola}</>;
    }
    return (
      <>
        <span className="descanso">
          <Timer size={17} strokeWidth={2.4} aria-hidden="true" /><b>Descanso</b>
          <Campo valor={d.q} cl="b ch" label="Cuánto descanso" onCambio={(v) => ponlo((x) => ({ ...x, q: v }))} />
          <Lista ops={[['seg', 'seg'], ['min', 'min']]} valor={d.u} label="Unidad del descanso" onCambio={(v) => ponlo((x) => ({ ...x, u: v }))} />
          {conTipo && (
            <span className="seg" role="radiogroup" aria-label="Tipo de descanso">
              {[['total', 'Total'], ['activo', 'Activo']].map(([k, t]) => <button key={k} type="button" role="radio" aria-checked={d.tipo === k} className={d.tipo === k ? 'on' : ''} onClick={() => ponlo((x) => ({ ...x, tipo: k }))}>{t}</button>)}
            </span>
          )}
          <button type="button" className="bola" title="Listo" aria-label="Listo" onClick={() => setDescansoAbierto(null)}><Check size={15} strokeWidth={2.8} /></button>
          <button type="button" className="bola" title="Quitar el descanso" aria-label="Quitar el descanso" onClick={() => { ponlo(() => null); setDescansoAbierto(null); }}><Trash2 size={14} strokeWidth={2.2} /></button>
        </span>
        {cola}
      </>
    );
  };

  /* «Su video» (21 nov 2026, idea de Andrés): un cuadro más de «lo que le puedes agregar a este ejercicio», con el ícono violeta de Gym. Solo en el
     plan de un atleta y con un ejercicio del repertorio: en una plantilla de Mis planes no hay a quién dejarle el video. */
  const conSuVideo = (it) => !!(it.exercise_id && atleta?.id && onVideoAtleta);
  const cuadroSuVideo = (it) => conSuVideo(it) && (
    <Mosaico Icono={Video} texto="Su video" cl="su-video" abre onClick={() => onVideoAtleta({ ...it, exercise_id: it.exercise_id })} />
  );
  // Columnas según cuántos cuadros hay: 2 → 2, 3 → 3, 4 → 2×2, 5 o más → de 3 en 3.
  const rejilla = (n) => (n === 3 || n >= 5 ? 'tres' : 'dos');

  /* ---------- Adentro del renglón: lo de fuerza ---------- */
  const tiempoLimite = (it, si, ii, rotulo, ph) => it.limite !== null && (
    <div className="dato"><Hourglass size={17} aria-hidden="true" />{rotulo}
      <span className="cel"><Campo valor={it.limite.q} cl="ch" ph={it.limite.u === 'seg' ? '30' : ph} label={rotulo} onCambio={(v) => enRenglon(si, ii, (x) => { x.limite.q = v; })} />
        <Lista ops={[['min', 'min'], ['seg', 'seg']]} valor={it.limite.u} label={`Unidad de ${rotulo.toLowerCase()}`} onCambio={(v) => enRenglon(si, ii, (x) => { x.limite.u = v; })} /></span>
    </div>
  );
  const laNota = (it, si, ii) => it.nota !== null && <textarea className="nota" placeholder="Nota para este ejercicio" aria-label="Nota" value={it.nota} onChange={(e) => enRenglon(si, ii, (x) => { x.nota = e.target.value; })} />;
  const adentroDeFuerza = (it, si, ii, set) => {
    const puede = set.fmt === 'rep' && set.veces > 1;
    const vueltas = it.pv ? Array.from({ length: set.veces }, (_, k) => it.vueltas[k] ?? { q: it.q, p: it.peso?.q ?? '', a: it.int?.a ?? '', b: '' }) : [];
    const enVuelta = (k, campo, v) => enRenglon(si, ii, (x) => { x.vueltas = vueltas.map((w) => ({ ...w })); x.vueltas[k][campo] = v; });
    return (
      <div className={`panel${puede ? '' : ' uno'}`}>
        {puede && (
          <div className="tarjeta">
            <h3>Cambia en cada vuelta
              <button type="button" className={`inter${it.pv ? ' on' : ''}`} role="switch" aria-checked={it.pv} aria-label="Cambia en cada vuelta" onClick={() => enRenglon(si, ii, (x) => { x.pv = !x.pv; })}><i /></button>
            </h3>
            {it.pv ? vueltas.map((w, k) => (
              <div className="vuelta" key={k}>
                <span className="r"><i>{k + 1}</i>Vuelta</span>
                <span className="cel"><Campo valor={w.q} label={`Cuánto, vuelta ${k + 1}`} onCambio={(v) => enVuelta(k, 'q', v)} /><span className="uni">{it.u}</span></span>
                {it.peso && <span className="cel"><Campo valor={w.p} label={`Peso, vuelta ${k + 1}`} onCambio={(v) => enVuelta(k, 'p', v)} /><span className="uni">{it.peso.u}</span></span>}
                {it.int && <span className="cel"><span className="uni">{INT[it.int.tipo]}</span>{valorInt(it, w, 'a', (c, v) => enVuelta(k, c, v))}</span>}
              </div>
            )) : <div className="vuelta"><span className="r quieto">Igual en las {set.veces} vueltas</span></div>}
          </div>
        )}
        <div className="tarjeta">
          <h3>Más de este ejercicio</h3>
          <div className={`mosaicos ${rejilla(3 + (conSuVideo(it) ? 1 : 0))}`}>
            <Mosaico Icono={ArrowLeftRight} texto="Por lado" on={it.lado} onClick={() => enRenglon(si, ii, (x) => { x.lado = !x.lado; })} />
            <Mosaico Icono={Hourglass} texto="Límite de tiempo" on={it.limite !== null} onClick={() => enRenglon(si, ii, (x) => { x.limite = x.limite === null ? { q: '', u: 'min' } : null; })} />
            <Mosaico Icono={StickyNote} texto="Nota" on={it.nota !== null} onClick={() => enRenglon(si, ii, (x) => { x.nota = x.nota === null ? '' : null; })} />
            {cuadroSuVideo(it)}
          </div>
          {tiempoLimite(it, si, ii, 'Límite de tiempo', '2')}
          {laNota(it, si, ii)}
        </div>
      </div>
    );
  };

  /* ---------- Adentro del renglón: lo de cardio, con las palabras del editor de Correr ---------- */
  const rango = (t, obj, alCambiar, et) => (
    <>
      {t === 'zona'
        ? <Lista ops={ZONAS} valor={obj.a || ''} onCambio={(v) => alCambiar('a', v)} cl="zona" label={`${et} desde`} />
        : <Campo valor={obj.a} cl={RANGO.includes(t) ? 'ch' : ''} ph={{ pace: '4:30', r500: '2:05', pulso: '150', w: '200', rpe: '8' }[t] ?? ''} label={`${et} desde`} onCambio={(v) => alCambiar('a', v)} />}
      {RANGO.includes(t) && <><span className="sep">a</span><Campo valor={obj.b} cl="ch" ph={{ pace: '4:30', r500: '2:05', pulso: '150' }[t] ?? ''} label={`${et} hasta`} onCambio={(v) => alCambiar('b', v)} /></>}
    </>
  );
  const intensidadesDeTabla = (it, tipo) => permitidas(tipo, fichaDe(it.exercise_id)).int.filter((k) => !['tope', 'tiempo', 'rir'].includes(k)).map((k) => [k, INT[k]]);
  const progresiva = (it, si, ii, tipo) => {
    const g = it.pg, t = it.int.tipo;
    if (!g) return null;
    const T = enBase(it.q, it.u);
    const suma = g.lista.reduce((s, x) => { const b = enBase(x.q, x.u); return s + (b && T && b.g === T.g ? b.v : 0); }, 0);
    const descuadre = g.tramos && T && Math.abs(suma - T.v) > 0.5;
    const tono = (i) => (g.lista.length === 1 ? 4 : Math.round(1 + 3 * i / (g.lista.length - 1)));
    const enExtremo = (cual) => (lado, v) => enRenglon(si, ii, (x) => { x.pg[cual][lado] = v; x.pg.mi = false; ponValores(x); });
    return (
      <>
        <div className="prog-arriba">
          <span className="rot">Intensidad<span><Lista ops={intensidadesDeTabla(it, tipo)} valor={t} rotulo={INT[t]} cl="zona" label="Intensidad de la progresiva" onCambio={(v) => enRenglon(si, ii, (x) => cambiaTipoDeInt(x, v), true)} /></span></span>
          <span className="rot">Empieza en<span>{rango(t, g.ini, enExtremo('ini'), `${INT[t]}, empieza`)}</span></span>
          <span className="flecha"><ArrowRight size={18} strokeWidth={2.4} aria-hidden="true" /></span>
          <span className="rot">Termina en<span>{rango(t, g.fin, enExtremo('fin'), `${INT[t]}, termina`)}</span></span>
        </div>
        <button type="button" className={`op-tramos${g.tramos ? ' on' : ''}`} role="switch" aria-checked={g.tramos} aria-label="Dividir en tramos" onClick={() => enRenglon(si, ii, (x) => { x.pg.tramos = !x.pg.tramos; if (x.pg.tramos) acomoda(x); })}>
          <span className="ti"><ListOrdered size={19} strokeWidth={2.2} aria-hidden="true" /></span>
          <span className="tx"><b>Dividir en tramos</b>{g.tramos && <small>{g.lista.length && g.lista.every((x) => x.q && x.q === g.lista[0].q && x.u === g.lista[0].u) ? `${g.lista.length} tramos de ${g.lista[0].q} ${g.lista[0].u}` : `${g.lista.length} tramos`}</small>}</span>
          <span className="sw"><i /></span>
        </button>
        {g.tramos && (
          <div className="tabla-y-asi">
            <div>
              <div className="tabla-f enc"><span /><span>Tramo</span><span>{INT[t]}</span><span /></div>
              {g.lista.map((x, i) => (
                <div className="tabla-f" key={x.id} data-tramo={i + 1}>
                  <i style={{ background: TONOS[tono(i)], color: tono(i) > 2 ? '#fff' : '#1530A8' }}>{i + 1}</i>
                  <span className="cel">
                    <Campo valor={x.q} label={`Distancia o tiempo del tramo ${i + 1}`} onCambio={(v) => enRenglon(si, ii, (y) => { y.pg.lista[i].q = v; y.pg.mq = true; })} />
                    <Lista ops={UN_TRAMO} valor={x.u} label={`Unidad del tramo ${i + 1}`} onCambio={(v) => enRenglon(si, ii, (y) => { y.pg.lista[i].u = v; y.pg.mq = true; })} />
                  </span>
                  <span className="cel">{rango(t, x, (lado, v) => enRenglon(si, ii, (y) => { y.pg.lista[i][lado] = v; y.pg.mi = true; }), `${INT[t]} del tramo ${i + 1}`)}</span>
                  <button type="button" className="bola g" title="Borrar el tramo" aria-label={`Borrar el tramo ${i + 1}`} disabled={g.lista.length < 2} onClick={() => enRenglon(si, ii, (y) => { y.pg.lista.splice(i, 1); acomoda(y); })}><Trash2 size={14} strokeWidth={2.2} /></button>
                </div>
              ))}
              <div className="spr-pie"><button type="button" className="texto" onClick={() => enRenglon(si, ii, (y) => { y.pg.lista.push({ ...y.pg.lista[y.pg.lista.length - 1], id: nuevoId() }); acomoda(y); })}>+ Agregar tramo</button></div>
              {descuadre && <div className="aviso">Los tramos suman {deBase(suma, it.u)} {it.u}; el total es de {it.q} {it.u}. <button type="button" className="texto" onClick={() => enRenglon(si, ii, (y) => { y.pg.mq = false; acomoda(y); })}>Emparejar tramos</button></div>}
            </div>
            <div className="asi" role="region" aria-label="Así lo verá el atleta">
              <small>Así lo verá el atleta</small><b>{it.q || '…'} {it.u} · progresiva</b>
              {g.lista.map((x, i) => <div key={x.id}><span>{i + 1}</span><b>{x.q} {x.u}</b><em>{INT[t].toLowerCase()} {x.a}{RANGO.includes(t) && x.b ? `–${x.b}` : ''}</em></div>)}
            </div>
          </div>
        )}
      </>
    );
  };
  const conIntervalos = (it, si, ii, tipo) => {
    const v = it.iv, t = it.int.tipo;
    if (!v) return null;
    return (
      <>
        <div className="tabla-f enc"><span /><span>Intervalo</span><span><Lista ops={intensidadesDeTabla(it, tipo)} valor={t} rotulo={`Intensidad: ${INT[t]}`} cl="uni azul" label="Intensidad de los intervalos" onCambio={(w) => enRenglon(si, ii, (x) => cambiaTipoDeInt(x, w), true)} /></span><span /></div>
        {v.lista.map((x, i) => (
          <div className="tabla-f" key={x.id} data-intervalo={i + 1}>
            <i className="gris">{i + 1}</i>
            <span className="cel">
              <Campo valor={x.q} ph="400" label={`Distancia o tiempo del intervalo ${i + 1}`} onCambio={(w) => enRenglon(si, ii, (y) => { y.iv.lista[i].q = w; })} />
              <Lista ops={UN_TRAMO} valor={x.u} label={`Unidad del intervalo ${i + 1}`} onCambio={(w) => enRenglon(si, ii, (y) => { y.iv.lista[i].u = w; })} />
            </span>
            <span className="cel">{rango(t, x, (lado, w) => enRenglon(si, ii, (y) => { y.iv.lista[i][lado] = w; }), `${INT[t]} del intervalo ${i + 1}`)}</span>
            <button type="button" className="bola g" title="Borrar el intervalo" aria-label={`Borrar el intervalo ${i + 1}`} disabled={v.lista.length < 2} onClick={() => enRenglon(si, ii, (y) => { y.iv.lista.splice(i, 1); })}><Trash2 size={14} strokeWidth={2.2} /></button>
          </div>
        ))}
        <div className="spr-pie"><button type="button" className="texto" onClick={() => enRenglon(si, ii, (y) => { y.iv.lista.push({ ...y.iv.lista[y.iv.lista.length - 1], id: nuevoId() }); })}>+ Agregar intervalo</button></div>
        <button type="button" className="repite" role="switch" aria-checked={v.repite} onClick={() => enRenglon(si, ii, (y) => { y.iv.repite = !y.iv.repite; })}>
          <span className={`inter${v.repite ? ' on' : ''}`}><i /></span>Repetir hasta completar {it.q ? `los ${it.q} ${it.u}` : 'el total'}
        </button>
      </>
    );
  };
  const sprints = (it, si, ii) => (
    <div className="como">
      <div className="spr">
        <div className="spr-f enc"><span /><span>Distancia o tiempo</span><span>Descanso después</span><span /></div>
        {it.spr.map((f, i) => (
          <div className="spr-f" key={f.id} data-sprint={i + 1}>
            <i>{i + 1}</i>
            <span className="cel">
              <Campo valor={f.q} ph="60" label={`Distancia o tiempo, sprint ${i + 1}`} onCambio={(v) => enRenglon(si, ii, (y) => { y.spr[i].q = v; })} />
              <Lista ops={[['m', 'm'], ['km', 'km'], ['seg', 'seg']]} valor={f.u} label={`Unidad del sprint ${i + 1}`} onCambio={(v) => enRenglon(si, ii, (y) => { y.spr[i].u = v; })} />
            </span>
            <span className="cel">
              {f.du !== 'rec' && <Campo valor={f.dq} cl="ch" ph="1" label={`Descanso, sprint ${i + 1}`} onCambio={(v) => enRenglon(si, ii, (y) => { y.spr[i].dq = v; })} />}
              <Lista ops={[['seg', 'seg'], ['min', 'min'], ['rec', 'hasta recuperarse']]} valor={f.du} cl="zona" label={`Unidad del descanso, sprint ${i + 1}`} onCambio={(v) => enRenglon(si, ii, (y) => { y.spr[i].du = v; })} />
            </span>
            <span className="cel">
              <button type="button" className="bola g" title="Duplicar" aria-label={`Duplicar el sprint ${i + 1}`} onClick={() => enRenglon(si, ii, (y) => { y.spr.splice(i + 1, 0, { ...y.spr[i], id: nuevoId() }); })}><Copy size={14} strokeWidth={2.2} /></button>
              {it.spr.length > 1 && <button type="button" className="bola g" title="Borrar" aria-label={`Borrar el sprint ${i + 1}`} onClick={() => enRenglon(si, ii, (y) => { y.spr.splice(i, 1); })}><Trash2 size={14} strokeWidth={2.2} /></button>}
            </span>
          </div>
        ))}
        <div className="spr-pie"><button type="button" className="texto" onClick={() => enRenglon(si, ii, (y) => { y.spr.push({ ...y.spr[y.spr.length - 1], id: nuevoId() }); })}>+ Agregar sprint</button><small>copia el de arriba</small></div>
      </div>
      <div className="barras" aria-hidden="true">{it.spr.slice(0, 10).map((f) => <i key={f.id} style={{ background: TONOS[4] }} />)}</div>
    </div>
  );
  const adentroDeCardio = (it, si, ii, tipo) => {
    const ficha = fichaDe(it.exercise_id), [tituloComo, tituloTodo] = titulosDe(tipo), lugar = lugarDe(tipo);
    const pon = (k) => enRenglon(si, ii, (x) => {
      const P = (sprint) => permitidas(tipo, ficha, sprint).int;
      const t = x.int?.tipo;
      x.como = k;
      if (k === 'sprint') { if (!['tope', 'tiempo', 'rpe'].includes(t)) x.int = { tipo: 'tope', a: '', b: '' }; }
      else if ((k !== 'uno' && !x.int) || t === 'tope' || t === 'tiempo' || (k !== 'uno' && t === 'rir')) x.int = { tipo: P(false).filter((z) => k === 'uno' || z !== 'rir')[0], a: '', b: '' };
      if (k === 'prog') progresivaDe(x);
      if (k === 'int') intervalosDe(x);
    }, true);
    const modo = (k, Icono, texto) => <button key={k} type="button" role="radio" aria-checked={it.como === k} className={it.como === k ? 'on' : ''} onClick={() => pon(k)}><Icono size={17} strokeWidth={2.3} aria-hidden="true" />{texto}</button>;
    const t = it.int?.tipo;
    const ponV = (cual, v) => enRenglon(si, ii, (x) => { x.int[cual] = v; });
    const constante = (
      <div className="camposc"><span className="rot">Intensidad<span>
        {it.int ? (
          <>
            <Lista ops={[...permitidas(tipo, ficha).int.map((k) => [k, INT[k]]), ['-', 'Quitar la intensidad']]} valor={t} rotulo={INT[t]} cl="zona" label="Tipo de intensidad" onCambio={(v) => enRenglon(si, ii, (x) => cambiaTipoDeInt(x, v), true)} />
            {t === 'zona'
              ? <span className="zbtns" role="radiogroup" aria-label="Zona">{[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" role="radio" aria-checked={String(it.int.a) === String(n)} aria-label={`Zona ${n}`} className={String(it.int.a) === String(n) ? 'on' : ''} onClick={() => ponV('a', String(n))}>{n}</button>)}</span>
              : <>{valorInt(it, it.int, 'a', ponV, 'an')}{t === 'tiempo' && <span className="sep">seg</span>}{RANGO.includes(t) && <><span className="sep">a</span>{valorInt(it, it.int, 'b', ponV, 'an')}</>}</>}
          </>
        ) : <button type="button" className="mas" aria-label="Agregar intensidad" onClick={() => enRenglon(si, ii, (x) => cambiaTipoDeInt(x, permitidas(tipo, ficha).int[0]), true)}>+</button>}
      </span></span></div>
    );
    return (
      <div className="panel c">
        <div className="tarjeta">
          <h3>{tituloComo}</h3>
          <div className="modos" role="radiogroup" aria-label={tituloComo}>{modo('uno', Minus, 'Constante')}{modo('prog', TrendingUp, 'Progresiva')}{modo('int', Repeat, 'Con intervalos')}{modo('sprint', Zap, 'Sprints')}</div>
          {it.como === 'sprint' ? sprints(it, si, ii) : <div className="como2">{it.como === 'prog' && it.int ? progresiva(it, si, ii, tipo) : it.como === 'int' && it.int ? conIntervalos(it, si, ii, tipo) : constante}</div>}
        </div>
        <div className="tarjeta">
          <h3>{tituloTodo}</h3>
          <div className={`mosaicos ${rejilla(2 + (lugar === 'correr' || lugar === 'maquina' ? 1 : 0) + 1 + (conSuVideo(it) ? 1 : 0))}`}>
            {lugar === 'correr' && <Mosaico Icono={Footprints} texto="Caminadora" on={it.maq !== null} onClick={() => enRenglon(si, ii, (x) => { x.maq = x.maq === null ? '' : null; })} />}
            {lugar === 'maquina' && <Mosaico Icono={SlidersHorizontal} texto="Resistencia" on={it.maq !== null} onClick={() => enRenglon(si, ii, (x) => { x.maq = x.maq === null ? '' : null; })} />}
            {it.como === 'sprint'
              ? <Mosaico Icono={Mountain} texto="Material o terreno" on={it.mat !== null} onClick={() => enRenglon(si, ii, (x) => { x.mat = x.mat === null ? 'trineo' : null; })} />
              : <Mosaico Icono={Activity} texto="Cadencia" on={it.cad !== null} onClick={() => enRenglon(si, ii, (x) => { x.cad = x.cad === null ? '' : null; })} />}
            <Mosaico Icono={Hourglass} texto="Tiempo límite" on={it.limite !== null} onClick={() => enRenglon(si, ii, (x) => { x.limite = x.limite === null ? { q: '', u: x.como === 'sprint' ? 'seg' : 'min' } : null; })} />
            <Mosaico Icono={StickyNote} texto="Nota" on={it.nota !== null} onClick={() => enRenglon(si, ii, (x) => { x.nota = x.nota === null ? '' : null; })} />
            {cuadroSuVideo(it)}
          </div>
          {lugar === 'correr' && it.maq !== null && <div className="dato"><Footprints size={17} aria-hidden="true" />Caminadora · Inclinación <Campo valor={it.maq} cl="ch" ph="1" label="Inclinación" onCambio={(v) => enRenglon(si, ii, (x) => { x.maq = v; })} /><span className="u">%</span></div>}
          {lugar === 'maquina' && it.maq !== null && <div className="dato"><SlidersHorizontal size={17} aria-hidden="true" />Resistencia · Nivel <Campo valor={it.maq} cl="ch" ph="5" label="Nivel de resistencia" onCambio={(v) => enRenglon(si, ii, (x) => { x.maq = v; })} /></div>}
          {it.como === 'sprint' && it.mat !== null && <div className="dato"><Mountain size={17} aria-hidden="true" />Material o terreno <Lista ops={MATERIAL} valor={it.mat} cl="zona" label="Material o terreno" onCambio={(v) => enRenglon(si, ii, (x) => { x.mat = v; })} /></div>}
          {it.como !== 'sprint' && it.cad !== null && <div className="dato"><Activity size={17} aria-hidden="true" />Cadencia <Campo valor={it.cad} cl="ch" ph={tipo === 'bici' ? '90' : tipo === 'correr' ? '170' : '28'} label="Cadencia" onCambio={(v) => enRenglon(si, ii, (x) => { x.cad = v; })} /><span className="u">{cadenciaDe(tipo)}</span></div>}
          {tiempoLimite(it, si, ii, 'Tiempo límite', '6')}
          {laNota(it, si, ii)}
        </div>
      </div>
    );
  };

  /* ---------- Un renglón ---------- */
  const renglon = (set, si, it, ii) => {
    const tipo = tipoDelRenglon(it), ficha = fichaDe(it.exercise_id), ab = abierto === it.id, cardio = esCardio(tipo, it);
    const Icono = it.como === 'sprint' && cardio ? Zap : tipo === 'fuerza' && /peso corporal/i.test(ficha?.equipment ?? '') ? PersonStanding : ICONO[tipo];
    const abre = () => setAbierto(ab ? null : it.id);
    const mueve = (d) => guarda((S) => { const l = S[si].items, j = ii + d; if (j < 0 || j >= l.length) return; [l[ii], l[j]] = [l[j], l[ii]]; });
    const detalle = [ficha?.equipment || 'Sin equipo', it.lado && 'por lado', tipo === 'correr' && it.maq !== null && 'en caminadora', it.como === 'sprint' && it.mat && CON_MATERIAL[it.mat]].filter(Boolean).join(' · ');
    return (
      <div className={`tramo${ab ? ' arriba' : ''}`} key={it.id}>
        <span className="nodo"><span className="num">{ii + 1}</span></span>
        <div className={`fila${ab ? ' abierta' : ''}`} data-fila={it.name}>
          <div className="fila-in">
            <button type="button" className="ej" aria-expanded={ab} onClick={abre}>
              <span className="mini"><Icono size={18} aria-hidden="true" /></span>
              <span className="nom"><b>{it.name}</b><small>{detalle}</small></span>
            </button>
            <div className="campos">
              <span className="cel" data-r="Cuánto">
                {it.como === 'sprint' && cardio
                  ? <button type="button" className="zona" onClick={abre}>{resumenDeSprints(it)}</button>
                  : <><Campo valor={it.q} label="Cuánto" onCambio={(v) => enRenglon(si, ii, (x) => { x.q = v; acomoda(x); })} /><Lista ops={UNIDADES} valor={it.u} label="Unidad" onCambio={(v) => enRenglon(si, ii, (x) => { x.u = v; acomoda(x); }, true)} /></>}
              </span>
              {casillaPrincipal(it, si, ii, tipo)}
              {casillaDeCargaExtra(it, si, ii, tipo)}
            </div>
            <button type="button" className="chev" aria-label={`${ab ? 'Cerrar' : 'Abrir'} ${it.name}`} onClick={abre}>{ab ? <ChevronUp size={16} strokeWidth={2.6} /> : <ChevronDown size={16} strokeWidth={2.6} />}</button>
          </div>
          {ab && (
            <>
              {cardio ? adentroDeCardio(it, si, ii, tipo) : adentroDeFuerza(it, si, ii, set)}
              <div className="pie">
                {ii > 0 && <button type="button" onClick={() => mueve(-1)}><ChevronUp size={14} strokeWidth={2.6} /> Subir</button>}
                {ii < set.items.length - 1 && <button type="button" onClick={() => mueve(1)}><ChevronDown size={14} strokeWidth={2.6} /> Bajar</button>}
                <button type="button" className="q" onClick={() => { guarda((S) => { S[si].items.splice(ii, 1); }); setAbierto(null); }}><Trash2 size={14} strokeWidth={2.2} /> Quitar ejercicio</button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  /* ---------- Un Set: la cadena ---------- */
  const unSet = (set, si) => {
    const enSet = (fn) => guarda((S) => fn(S[si]));
    const hayDoble = set.items.some((it) => llevaCargaExtra(tipoDelRenglon(it), it));
    return (
      <div className="cadena" data-set={si + 1}>
        <i className="riel" />
        <div className="tramo cabeza-t">
          <span className="nodo"><span className="nset"><Repeat size={18} strokeWidth={2.4} aria-hidden="true" /></span></span>
          <div className="cabeza">
            <b className="t">Set {si + 1}</b>
            <Lista ops={FORMATOS} valor={set.fmt} cl="gris" label="Formato del Set" onCambio={(v) => enSet((s) => { s.fmt = v; })} />
            {set.fmt === 'rep' && (
              <span className="gris">
                <button type="button" className="paso" aria-label="Una vuelta menos" onClick={() => enSet((s) => { s.veces = Math.max(1, s.veces - 1); })}>−</button>
                <b>{set.veces}</b>
                <button type="button" className="paso" aria-label="Una vuelta más" onClick={() => enSet((s) => { s.veces = Math.min(20, s.veces + 1); })}>+</button>
                {set.veces === 1 ? 'vuelta' : 'vueltas'}
              </span>
            )}
            {(set.fmt === 'amrap' || set.fmt === 'emom') && <span className="gris"><Timer size={15} strokeWidth={2.4} aria-hidden="true" /><input value={set.min ?? ''} inputMode="numeric" aria-label="Minutos" onChange={(e) => enSet((s) => { s.min = e.target.value; })} />min</span>}
            <i className="aire" />
            <button type="button" className="redondo" title="Borrar el Set" aria-label={`Borrar el Set ${si + 1}`} onClick={() => guarda((S) => { S.splice(si, 1); })}><Trash2 size={16} strokeWidth={2.2} /></button>
          </div>
        </div>
        {set.items.length > 0 && <div className="tramo"><span /><div className="cols"><span>Ejercicio</span><span>Cuánto</span><span>Peso o intensidad</span><span>{hayDoble ? 'Carga extra' : ''}</span><span /></div></div>}
        {set.items.map((it, ii) => (
          <div key={it.id}>
            {renglon(set, si, it, ii)}
            {ii < set.items.length - 1 && (
              <div className="tramo"><span className="nodo"><span className="punto" /></span>
                <div className="hueco">{descanso(it.desc, it.id, (fn) => enRenglon(si, ii, (x) => { x.desc = fn(x.desc); }), { q0: '30', u0: 'seg', anade: 'Descanso' })}</div>
              </div>
            )}
          </div>
        ))}
        <div className="tramo cierre-t">
          <span className="nodo"><span className="nfin">{set.fmt === 'tiempo' ? <Flag size={16} strokeWidth={2.4} aria-hidden="true" /> : <RotateCcw size={16} strokeWidth={2.4} aria-hidden="true" />}</span></span>
          <div className="hueco">
            {set.fmt === 'rep' && set.veces > 1 && !set.descV && 'Vuelve a empezar '}
            {set.fmt === 'rep' && (set.veces > 1 ? descanso(set.descV, `${set.id}:v`, (fn) => enSet((s) => { s.descV = fn(s.descV); }), { q0: '2', u0: 'min', anade: 'Descanso entre vueltas', conTipo: false, cola: ' y vuelve a empezar' }) : 'Se hace una vez')}
            {set.fmt === 'amrap' && `Sin parar, hasta que acaben los ${set.min || '…'} min`}
            {set.fmt === 'emom' && `Cada minuto empieza un ejercicio, durante ${set.min || '…'} min`}
            {set.fmt === 'tiempo' && 'Lo más rápido posible'}
          </div>
        </div>
        {/* «+ Agregar ejercicio» al final del Set: es donde entra el ejercicio nuevo (como en Técnica, 21 nov 2026). */}
        <div className="mas-ej"><button type="button" onClick={() => setBuscador({ set: set.id })}>+ Agregar ejercicio</button></div>
      </div>
    );
  };

  const agrega = (elegidos) => {
    const destino = buscador?.set;
    guarda((S) => {
      let s = S.find((x) => x.id === destino);
      if (!s) { s = setNuevo(); S.push(s); }
      s.items.push(...elegidos.map((e) => { const f = fichaDe(e.id) ?? e; return renglonNuevo(f, discDe(f)); }));
    });
    setBuscador(null);
  };

  return (
    <fieldset className="tl-hib" disabled={soloLectura} data-editor-hibrido>
      <style>{CSS}</style>
      {sets.length === 0 ? (
        <div className="vacia">
          <div className="eslabones" aria-hidden="true">
            <span className="eslabon"><span><Dumbbell size={24} /></span>Pesas</span><i className="liga" />
            <span className="eslabon"><span><Footprints size={24} /></span>Carrera</span><i className="liga" />
            <span className="eslabon"><span><Waves size={24} /></span>Máquinas</span><i className="liga" />
            <span className="eslabon r"><span><Repeat size={20} strokeWidth={2.4} /></span>Se repite</span>
          </div>
          {!soloLectura && <button type="button" className="grande" onClick={() => setBuscador({ set: null })}>+ Agregar set</button>}
        </div>
      ) : (
        <>
          {sets.map((set, si) => (
            <div key={set.id}>
              {unSet(set, si)}
              {si < sets.length - 1 && (
                <div className="entre"><i /><span className="hueco">{descanso(set.descS, `${set.id}:s`, (fn) => guarda((S) => { S[si].descS = fn(S[si].descS); }), { q0: '3', u0: 'min', anade: 'Descanso entre Sets', de: ' entre Sets' })}</span></div>
              )}
            </div>
          ))}
          {!soloLectura && <button type="button" className="grande" onClick={() => setBuscador({ set: null })}>+ Agregar set</button>}
        </>
      )}
      {buscador && (
        <RepertoirePicker
          exercises={repertoire}
          title={buscador.set ? `Agregar al Set ${sets.findIndex((s) => s.id === buscador.set) + 1}` : 'Set nuevo: elige sus ejercicios'}
          // Arriba, los del Híbrido según su ficha (o por dónde se han usado); los demás, después. Misma regla que Gym.
          primero={(e) => discDe(e).includes('hyrox')}
          onClose={() => setBuscador(null)}
          onConfirm={agrega}
        />
      )}
    </fieldset>
  );
}

/* Los estilos del prototipo aprobado, encerrados en `.tl-hib` para no tocar nada más. Se acomoda según su propio ancho (no el de la pantalla):
   en la compu la sesión comparte lugar con la guía, y en el teléfono cada renglón baja sus casillas a una segunda línea. */
const CSS = `
.tl-hib{--az:#1E40E0;--azo:#1530A8;--acb:#E8EEFF;--g:#EBEDF1;--tx:#111318;--t2:#6B7280;--t3:#B4B9C4;--riel:#C7D2FB;--tinte:#F4F6FD;--rojo:#D92D20;
  border:none;padding:0;margin:14px 0 0;min-width:0;color:var(--tx);font-weight:600;container-type:inline-size;
  & *{box-sizing:border-box}
  & button,& input,& select,& textarea{font:inherit;color:inherit}
  & button{border:none;background:none;padding:0;cursor:pointer;-webkit-tap-highlight-color:transparent;touch-action:manipulation}
  & button:active{transform:scale(.97)}
  & button:disabled{opacity:.35;cursor:default}
  & svg{flex-shrink:0;display:block}
  .cadena{position:relative;background:#fff;border-radius:22px;padding:18px 18px 16px 10px;box-shadow:0 10px 30px rgba(17,19,24,.08)}
  .cadena>i.riel{position:absolute;left:33px;top:38px;bottom:34px;width:2px;background:var(--riel)}
  .tramo{display:grid;grid-template-columns:48px minmax(0,1fr);align-items:center}
  .tramo.arriba{align-items:start}.tramo.arriba>.nodo{margin-top:22px}
  .tramo.cabeza-t{padding-bottom:6px}.tramo.cierre-t{padding-top:4px}
  .nodo{position:relative;z-index:1;display:grid;place-items:center;justify-self:center}
  .num{width:28px;height:28px;border-radius:50%;display:grid;place-items:center;font-size:13px;font-weight:800;background:#fff;color:var(--az);box-shadow:0 0 0 2px var(--az),0 0 0 6px #fff}
  .nset{width:38px;height:38px;border-radius:50%;display:grid;place-items:center;background:var(--az);color:#fff;box-shadow:0 0 0 5px #fff}
  .nfin{width:32px;height:32px;border-radius:50%;display:grid;place-items:center;background:var(--acb);color:var(--az);box-shadow:0 0 0 5px #fff}
  .punto{width:10px;height:10px;border-radius:50%;background:var(--riel);box-shadow:0 0 0 4px #fff}
  .cabeza{display:flex;align-items:center;gap:9px;padding:0 12px;flex-wrap:wrap}
  .cabeza b.t{font-size:19px;font-weight:800;margin-right:4px}.cabeza .aire{flex:1}
  .gris{display:inline-flex;align-items:center;gap:6px;min-height:40px;padding:0 13px;border-radius:12px;background:var(--g);font-weight:800;font-size:14px;position:relative}
  .gris input{width:44px;border:none;background:#fff;border-radius:8px;min-height:30px;text-align:center;font-weight:800;font-size:15px}
  .gris>b{font-size:15.5px;min-width:14px;text-align:center}
  .paso{width:28px;height:28px;border-radius:8px;display:grid;place-items:center;color:var(--t2);font-weight:800;font-size:17px}
  .azulito{display:inline-flex;align-items:center;gap:6px;min-height:40px;padding:0 13px;border-radius:12px;background:var(--acb);color:var(--az);font-weight:800;font-size:14px}
  .redondo{width:40px;height:40px;border-radius:12px;display:grid;place-items:center;background:var(--g);color:#4B505C}
  .cols,.fila-in{display:grid;grid-template-columns:minmax(0,1.1fr) 150px 270px 150px 34px;column-gap:14px;align-items:center}
  .cols{padding:10px 12px 2px;font-size:12.5px;font-weight:800;color:var(--t2)}
  .fila{border-radius:16px;padding:8px 12px;margin:3px 0}
  .fila.abierta{background:var(--tinte);padding:10px 12px 14px}
  .ej{display:flex;align-items:center;gap:11px;min-width:0;text-align:left;border-radius:12px}
  .ej .nom{min-width:0}
  .ej b{display:block;font-size:15.5px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .ej small{display:block;font-size:12px;font-weight:600;color:var(--t2);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .mini{width:42px;height:42px;border-radius:11px;display:grid;place-items:center;background:var(--tx);color:#fff}
  .campos{display:contents}
  .cel{display:flex;align-items:center;gap:6px;min-width:0}
  .campo{border:none;border-radius:10px;background:var(--g);min-height:40px;width:56px;text-align:center;font-weight:800;font-size:15px;padding:0 4px;color:var(--tx)}
  .campo.b{background:#fff}.campo.ch{width:52px}.campo.an{width:66px}
  .campo::placeholder{color:#C2C7D0;font-weight:700}
  .uni{position:relative;display:inline-flex;align-items:center;gap:2px;font-weight:800;font-size:13px;color:var(--t2);min-height:40px;white-space:nowrap}
  .uni.azul{color:var(--az)}
  .zona{position:relative;display:inline-flex;align-items:center;justify-content:center;gap:3px;border-radius:10px;background:var(--g);min-height:40px;padding:0 10px;font-weight:800;font-size:14.5px;white-space:nowrap;color:var(--tx)}
  .sep{font-size:12px;font-weight:800;color:var(--t2)}
  .mas{position:relative;width:40px;height:40px;border-radius:10px;background:#F6F7FA;color:#B4B9C4;font-weight:800;font-size:18px;display:grid;place-items:center;cursor:pointer}
  .mas:hover{background:var(--acb);color:var(--az)}
  .chev{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:var(--g);color:#3B4252}
  .abierta .chev{background:var(--az);color:#fff}
  .pildora{display:inline-flex;align-items:center;gap:6px;min-height:32px;padding:0 12px;border-radius:999px;background:var(--acb);color:var(--az);font-weight:800;font-size:13px}
  .tenue{font-size:12.5px;font-weight:800;color:var(--t3);min-height:26px;padding:0 2px;border-radius:8px}
  .tenue:hover{color:var(--az)}
  .hueco{padding:2px 12px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:14px;font-weight:800;color:#3B4252}
  .descanso{display:inline-flex;align-items:center;gap:9px;padding:7px 9px 7px 13px;border-radius:16px;background:var(--acb);flex-wrap:wrap;color:var(--az)}
  .descanso>b{font-size:14px;font-weight:800;color:var(--az)}
  .seg{display:inline-flex;background:#fff;border-radius:11px;padding:3px}
  .seg button{min-height:34px;padding:0 14px;border-radius:9px;color:#4B505C;font-size:13.5px;font-weight:800}
  .seg button.on{background:var(--az);color:#fff}
  .bola{width:32px;height:32px;border-radius:50%;background:#fff;display:grid;place-items:center;color:var(--t2)}
  .bola.g{background:var(--g)}
  .entre{display:grid;grid-template-columns:48px 1fr;align-items:center;margin-left:10px;min-height:56px}
  .entre>i{justify-self:center;width:2px;height:100%;min-height:56px;background:var(--riel);opacity:.55}
  .entre .pildora,.entre .tenue{background:#fff;box-shadow:0 2px 8px rgba(17,19,24,.08);color:var(--az);min-height:34px;padding:0 13px;border-radius:999px;font-size:13.5px}
  .entre .descanso{background:#fff;box-shadow:0 2px 10px rgba(17,19,24,.1)}.entre .descanso .seg{background:var(--g)}.entre .descanso .campo.b,.entre .descanso .bola{background:var(--g)}
  .grande{display:grid;place-items:center;width:100%;max-width:320px;margin-left:auto !important;margin-right:auto !important;min-height:54px;border-radius:15px;background:var(--az);color:#fff;font-weight:800;font-size:16.5px;margin-top:16px}
  .panel{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:12px}
  .panel.c{grid-template-columns:1.25fr 1fr}.panel.uno{grid-template-columns:1fr}
  .tarjeta{background:#fff;border-radius:16px;padding:16px;box-shadow:0 2px 10px rgba(17,19,24,.05);min-width:0}
  .tarjeta h3{margin:0 0 12px;font-size:15.5px;font-weight:800;display:flex;align-items:center;justify-content:space-between;gap:10px}
  .inter{width:46px;height:27px;border-radius:999px;background:#CFD3DB;padding:3px;display:flex;flex-shrink:0;transition:background-color .16s ease-out}
  .inter i{width:21px;height:21px;border-radius:50%;background:#fff;transition:transform .16s ease-out}
  .inter.on{background:var(--az)}.inter.on i{transform:translateX(19px)}
  .vuelta{display:flex;align-items:center;gap:10px;margin-top:7px;flex-wrap:wrap}
  .vuelta .r{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:800;color:#3B4252;width:86px}
  .vuelta .r.quieto{width:auto;color:var(--t2)}
  .vuelta .r i{width:22px;height:22px;border-radius:50%;background:var(--acb);color:var(--az);display:grid;place-items:center;font-size:12px;font-style:normal;font-weight:800}
  .mosaicos{display:grid;gap:8px}.mosaicos.dos{grid-template-columns:1fr 1fr}.mosaicos.tres{grid-template-columns:repeat(3,1fr)}
  .mosaico{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;height:70px;border-radius:13px;background:var(--g);color:var(--tx);font-size:12.5px;font-weight:700;white-space:nowrap;width:100%}
  .mosaico svg{color:#4B505C}
  .mosaico.on{background:var(--acb);color:var(--az);font-weight:800}.mosaico.on svg{color:var(--az)}
  .mosaico.su-video svg{color:#7C5CFF}
  .mosaico>i{position:absolute;top:6px;right:6px;width:16px;height:16px;border-radius:50%;background:var(--az);display:grid;place-items:center}
  .dato{display:flex;align-items:center;gap:9px;margin-top:10px;font-size:14px;font-weight:800;color:#3B4252;flex-wrap:wrap}
  .dato>svg{color:var(--az)}.dato .u{font-size:13px;color:var(--t2)}
  .nota{width:100%;border:none;border-radius:11px;background:var(--g);min-height:44px;padding:11px 12px;font-size:15px;font-weight:600;resize:vertical;margin-top:10px}
  .modos{display:grid;grid-template-columns:repeat(4,1fr);background:var(--g);border-radius:13px;padding:4px;gap:2px}
  .modos button{display:flex;align-items:center;justify-content:center;gap:5px;min-height:42px;padding:0 6px;border-radius:10px;font-size:13.5px;white-space:nowrap;font-weight:800;color:#4B505C}
  .modos button svg{color:var(--t2)}
  .modos button.on{background:#fff;color:var(--az);box-shadow:0 1px 4px rgba(17,19,24,.14)}.modos button.on svg{color:var(--az)}
  .como{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-top:16px;flex-wrap:wrap}
  .como2{margin-top:14px}
  .camposc{display:flex;align-items:flex-end;gap:10px;flex-wrap:wrap}
  .rot{display:flex;flex-direction:column;gap:6px;font-size:12.5px;font-weight:800;color:var(--t2)}
  .rot>span{display:flex;align-items:center;gap:6px}
  .zbtns{display:inline-flex;gap:4px;background:var(--g);border-radius:12px;padding:4px}
  .zbtns button{width:38px;height:34px;border-radius:9px;font-size:15px;font-weight:800;color:#4B505C}
  .zbtns button.on{background:var(--az);color:#fff}
  .barras{display:flex;align-items:flex-end;gap:5px;height:64px}
  .barras i{width:12px;height:64px;border-radius:7px 7px 3px 3px}
  .spr{flex:1;min-width:0}
  .spr-f{display:grid;grid-template-columns:26px minmax(120px,1fr) minmax(170px,1.3fr) auto;column-gap:10px;align-items:center;margin-top:7px}
  .spr-f.enc{font-size:12.5px;font-weight:800;color:var(--t2);margin-top:0}
  .spr-f>i{width:24px;height:24px;border-radius:50%;background:var(--azo);color:#fff;display:grid;place-items:center;font-size:12px;font-style:normal;font-weight:800}
  .spr-pie{display:flex;align-items:baseline;gap:8px;margin-top:10px}.spr-pie small{font-size:12.5px;font-weight:600;color:var(--t2)}
  .texto{font-size:14px;font-weight:800;color:var(--az);border-radius:8px}
  .prog-arriba{display:flex;align-items:flex-end;gap:12px;flex-wrap:wrap}
  .flecha{color:#9CA3AF;padding-bottom:11px}
  .op-tramos{display:flex;align-items:center;gap:12px;width:100%;margin-top:16px;padding:10px 14px 10px 10px;border-radius:16px;background:#F4F5F8;text-align:left;transition:background-color .16s ease-out}
  .op-tramos.on{background:var(--acb)}
  .op-tramos .ti{width:40px;height:40px;border-radius:12px;display:grid;place-items:center;background:#fff;color:var(--az);box-shadow:0 1px 3px rgba(17,19,24,.08)}
  .op-tramos.on .ti{background:var(--az);color:#fff}
  .op-tramos .tx{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
  .op-tramos .tx b{font-size:15px;font-weight:800;color:var(--tx)}
  .op-tramos .tx small{font-size:12.5px;font-weight:700;color:var(--az)}
  .op-tramos .sw{width:50px;height:30px;border-radius:999px;background:#D5D9E0;padding:3px;flex-shrink:0;transition:background-color .16s ease-out}
  .op-tramos .sw i{display:block;width:24px;height:24px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(17,19,24,.25);transition:transform .2s cubic-bezier(.23,1,.32,1)}
  .op-tramos.on .sw{background:var(--az)}.op-tramos.on .sw i{transform:translateX(20px)}
  .tabla-y-asi{display:grid;grid-template-columns:minmax(0,1fr);gap:14px;margin-top:16px}
  .tabla-f{display:grid;grid-template-columns:26px 112px minmax(0,1fr) 32px;column-gap:10px;align-items:center;padding:7px 0;box-shadow:0 1px 0 #ECEEF2}
  .tabla-f.enc{font-size:12.5px;font-weight:800;color:var(--t2);padding:2px 0 8px}
  .tabla-f>i{width:24px;height:24px;border-radius:7px;display:grid;place-items:center;font-size:12px;font-style:normal;font-weight:800}
  .tabla-f>i.gris{background:var(--g);color:var(--t2)}
  .aviso{font-size:13.5px;font-weight:700;color:#B45F00;margin-top:8px}
  .asi{background:var(--tx);color:#fff;border-radius:16px;padding:14px 16px}
  .asi small{display:block;font-size:12px;font-weight:700;color:#9CA3AF}.asi>b{display:block;font-size:15.5px;font-weight:800;margin:3px 0 10px}
  .asi div{display:grid;grid-template-columns:14px auto 1fr;column-gap:9px;align-items:center;margin-top:7px;font-size:13.5px}
  .asi div span{color:#9CA3AF;font-size:12px;font-weight:700}.asi div em{font-style:normal;color:#C9CDD5;font-weight:600}
  .repite{display:flex;align-items:center;gap:10px;width:100%;margin-top:12px;padding:12px 14px;border-radius:14px;background:#F4F5F8;font-size:14px;font-weight:800;color:var(--tx);text-align:left}
  .pie{display:flex;align-items:center;justify-content:flex-end;gap:8px;margin-top:12px}
  .pie button{min-height:36px;padding:0 12px;border-radius:10px;background:#fff;font-size:13px;font-weight:800;color:#3B4252;display:inline-flex;align-items:center;gap:6px}
  .pie button.q{color:var(--rojo)}
  .vacia{background:var(--tinte);border-radius:18px;padding:30px 20px 26px;display:flex;flex-direction:column;align-items:center}
  .eslabones{display:flex;align-items:flex-start}
  .eslabon{display:flex;flex-direction:column;align-items:center;gap:8px;font-size:12.5px;font-weight:800;color:#3B4252;width:64px}
  .eslabon span{width:56px;height:56px;border-radius:14px;display:grid;place-items:center;background:var(--tx);color:#fff}
  .eslabon.r span{border-radius:50%;background:var(--az);width:46px;height:46px;margin-top:5px}
  .liga{width:30px;height:2px;background:var(--riel);margin-top:27px}
  .vacia .grande{max-width:360px;margin-top:22px}
  @container (max-width:880px){
    .cols{display:none}
    .fila-in{grid-template-columns:minmax(0,1fr) 34px;row-gap:10px}
    .campos{display:flex;flex-wrap:wrap;gap:8px 16px;grid-column:1/-1;grid-row:2}
    .cel.sin{display:none}
    .cel[data-r]::before{content:attr(data-r);font-size:11.5px;font-weight:800;color:var(--t2);margin-right:2px}
    .panel,.panel.c{grid-template-columns:1fr}
  }
  @container (max-width:560px){
    .grande{max-width:none}
    .cadena{padding:14px 10px 14px 4px}.cadena>i.riel{left:23px}.tramo{grid-template-columns:40px minmax(0,1fr)}
    .fila{padding:8px}.fila.abierta{padding:10px 8px 12px}.cabeza{padding:0 8px}.hueco{padding:2px 8px}
    .modos{grid-template-columns:1fr 1fr}.modos button{font-size:12.5px;gap:4px;padding:0 2px}.mosaicos.tres{grid-template-columns:1fr 1fr}.pildora{min-height:32px;height:auto;padding:6px 12px;text-align:left}
    .spr-f{grid-template-columns:24px 1fr;row-gap:6px}.spr-f.enc{display:none}.spr-f>.cel:nth-child(n+3){grid-column:2}
    .tabla-f{grid-template-columns:24px 1fr 32px;row-gap:6px}.tabla-f>.cel:nth-of-type(2){grid-column:2}.tabla-f.enc>span:nth-child(3){grid-column:2}
    .entre{grid-template-columns:40px 1fr;margin-left:4px}
  }
}
/* LA LISTA AGRUPADA (Andrés, 21 nov 2026; la misma de Técnica en EditorDeCorrer). Sin la línea con círculos: cada Set es UN mosaico azul
   claro sobre el blanco; adentro, renglones separados por rayas finas con el descanso escrito encima; el ejercicio abierto es una tarjeta
   blanca. Cada nivel contrasta con el de afuera (blanco → azul claro → blanco): nunca blanco sobre blanco. */
.tl-hib{--set:#E8EDFB;--raya:#D5DDF3;
  .cadena{background:var(--set);border-radius:18px;padding:0;box-shadow:none}
  .cadena>i.riel{display:none}
  .tramo{grid-template-columns:34px minmax(0,1fr)}
  .tramo.cabeza-t{grid-template-columns:minmax(0,1fr);padding:12px 12px 12px 16px;border-bottom:1.5px solid var(--raya)}
  .tramo.cabeza-t>.nodo{display:none}
  .cabeza{padding:0}.cabeza b.t{font-size:17px}
  .cabeza .gris{background:#fff}.redondo{background:transparent;width:34px}
  .nodo{justify-self:end}
  .num{width:auto;height:auto;background:transparent;box-shadow:none;color:var(--t2);font-size:14.5px}
  .punto{display:none}
  .nfin{width:auto;height:auto;background:transparent;box-shadow:none;color:var(--az)}
  .tramo.arriba>.nodo{margin-top:20px}
  .cols{padding:10px 12px 0 12px}
  .fila{padding:7px 12px;margin:0}
  .fila.abierta{background:#fff;border-radius:14px;margin:6px 8px 6px 0;padding:9px 10px 8px;box-shadow:0 1px 2px rgba(17,19,24,.06)}
  .campo,.zona{background:#fff}.fila.abierta .campo,.fila.abierta .zona{background:var(--g)}
  .chev{background:#fff}.abierta .chev{background:var(--az)}
  .cabeza button[aria-haspopup="listbox"],.fila:not(.abierta) .cel button[aria-haspopup="listbox"][style*="background: rgb(235, 237, 241)"]{background:#fff !important}
  .fila.abierta .panel{margin-top:8px}
  .fila.abierta .tarjeta{background:transparent;box-shadow:none;padding:6px 2px}
  .tramo:not(.cabeza-t):not(.cierre-t) .hueco::after{content:'';flex:1;height:1.5px;background:var(--raya)}
  .tramo:not(.cabeza-t):not(.cierre-t) .hueco{padding:0 12px}
  .hueco .pildora{background:transparent;padding:0;min-height:26px;color:#4B505C;font-size:13px}
  .hueco .pildora svg{color:#8A90A0}
  .tramo.cierre-t{border-top:1.5px solid var(--raya);padding:8px 0}
  .mas-ej{border-top:1.5px solid var(--raya);padding:6px 16px}
  .mas-ej button{min-height:38px;color:var(--az);font-weight:800;font-size:14px}
  .entre{grid-template-columns:1fr;margin:0;min-height:0;padding:12px 0;justify-items:center}
  .entre>i{display:none}
  .entre .pildora,.entre .tenue{background:transparent;box-shadow:none;color:#4B505C}
  .entre .pildora svg{color:#8A90A0}
  /* «+ Descanso» se toca, así que va en azul como «+ Agregar ejercicio» (Andrés, 21 nov 2026: «no se puede agregar un descanso por cada
     ejercicio»; sí se podía, pero el gris pálido no se veía). Lo ya puesto sigue en gris: azul solo para lo que se toca. */
  .tenue,.entre .tenue{color:var(--az);font-size:13.5px;min-height:34px}
  @container (max-width:560px){.cadena{padding:0}.tramo{grid-template-columns:28px minmax(0,1fr)}.tramo.cabeza-t{padding:10px 8px 10px 12px}.fila.abierta{margin:6px 6px 6px 0}}
}
@media (prefers-reduced-motion:reduce){.tl-hib *{transition:none!important}.tl-hib button:active{transform:none}}
`;
