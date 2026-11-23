import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowLeftRight, Check, ChevronDown, ChevronUp, CirclePause, PlayCircle, Copy, Dumbbell, Package, Plus, Repeat, Ruler, StickyNote, Timer, Trash2, Video, Weight, X } from 'lucide-react';
import RepertoirePicker from '@/features/admin/RepertoirePicker';
import MediaUpload from '@/features/admin/MediaUpload';
import Portada from '@/components/Portada';
import { useAviso } from '@/components/AvisoPasajero';
import { BotonChico, CamposDeVideo, Extra, Interruptor, SetsDeEjercicios, Seccion, Segmentos } from '@/features/admin/EditorDeCorrer';
import { addExerciseMedia, createExercise, listExerciseMedia } from '@/lib/api';
import { T, FONT, KP, UI } from '@/lib/theme';
import { VideoDelAtleta, VIOLETA_SU_VIDEO } from '@/lib/videoDelAtleta';
import { CAMPOS_DE_DEPORTE, UNIDADES_DE_DEPORTE, itemDeDeporte, rid } from '@/lib/catalogoDeDeporte';

/**
 * EL EDITOR DE DEPORTE (acordado con Andrés en imágenes, 20 nov 2026).
 *
 * El caso de Andrés (notas del 11 nov): un coach de fútbol americano arma una sesión para un receptor, «releases on the line of scrimmage». Graba
 * seis ejercicios, cada uno con su ejemplo y su explicación, y pone cuántas veces se hace, a veces por lado. El descanso casi nunca lo ponen.
 * Por eso:
 *   · Una lista de ejercicios, en el orden en que se hacen (la misma línea numerada de Running y Clase). Cada uno se abre AHÍ MISMO, en su
 *     lugar, sin ventana encima (Andrés eligió este molde y pidió las piezas de la app).
 *   · Cerrado, cada ejercicio enseña su video, lo que se hace («5 veces por lado · 10 m en 4 seg»), «− 5 +» para cambiar las veces sin abrirlo,
 *     y si tiene Ejemplo y Explicación. Si falta uno, «+ Grabar …» ahí mismo (se guarda en la ficha: sirve para todas sus sesiones).
 *   · Abierto, solo lo básico: Veces y Por lado (Andrés: «muchas veces el ejercicio ya está explicado casi todo dentro del video»). Lo demás —
 *     Reps, Distancia, Tiempo, Descanso, Peso, Nota— no viene puesto: se agrega con sus mosaicos, «Agrega, si hace falta», y se quita con su X.
 *     Las veces no son filas (una por vez, como en Sprints): en deporte todas las veces son iguales (Andrés: «no se me hace lo más práctico»).
 *   · Sin «Así lo verá el atleta»: aquí no hace falta (Andrés: «aplicaba nada más para lo de running»).
 *   · Calentamiento y Enfriamiento, opcionales, al principio y al final, como en Clase: guiado (de sus calentamientos) o con ejercicios.
 *
 * Datos en `day.deporte = { items, cal, calma, necesita, nota }`:
 *   items: [{ id, exercise_id, name, veces, lado, reps, dist: { q, u }, tiempo: { q, u }, desc: { q, u }, peso: { q, u }, nota }]
 *   (lo que no se agregó, no existe: `undefined`). `cal` y `calma` tienen la forma de un calentamiento de Running.
 */

const AZUL = '#E8EDFB';
const RAYA = '#D5DDF3';
const VERDE_TEXTO = '#067A55';
const CAMPO = { border: 'none', borderRadius: 12, background: UI.relleno, minHeight: 46, padding: '0 12px', fontFamily: FONT, fontWeight: 800, fontSize: 16, color: T.text, width: '100%', boxSizing: 'border-box' };

// Lo que se agrega a un ejercicio, en el orden de los mosaicos. Reps va primero: es lo más común (Andrés).
// Los campos vienen del catálogo (`lib/catalogoDeDeporte.js`); aquí solo se les pone su ícono.
const ICONO_DEL_CAMPO = { reps: Repeat, dist: Ruler, tiempo: Timer, desc: CirclePause, peso: Weight, nota: StickyNote };
const OPCIONALES = CAMPOS_DE_DEPORTE.map((c) => ({ ...c, icono: ICONO_DEL_CAMPO[c.k] }));const UNIDADES = UNIDADES_DE_DEPORTE;

const hay = (v) => v !== undefined && v !== null;
const lleno = (v) => (typeof v === 'object' ? String(v?.q ?? '').trim() : String(v ?? '').trim());

/** Lo que se hace, en una frase: «5 veces por lado · 8 reps · 10 m en 4 seg · 20 kg · descanso 1 min». */
function resumenDeDeporte(it) {
  const n = String(it.veces ?? '').trim();
  const partes = [];
  if (n) partes.push(`${n} ${n === '1' ? 'vez' : 'veces'}${it.lado ? ' por lado' : ''}`);
  else if (it.lado) partes.push('Por lado');
  if (lleno(it.reps)) partes.push(`${String(it.reps).trim()} reps`);
  const d = lleno(it.dist) ? `${it.dist.q} ${it.dist.u}` : null;
  const t = lleno(it.tiempo) ? `${it.tiempo.q} ${it.tiempo.u}` : null;
  if (d && t) partes.push(`${d} en ${t}`); else if (d || t) partes.push(d || t);
  if (lleno(it.peso)) partes.push(`${it.peso.q} ${it.peso.u}`);
  if (lleno(it.desc)) partes.push(`descanso ${it.desc.q} ${it.desc.u}`);
  return partes.join(' · ');
}

/** «− 5 +»: el número se cambia con los botones o escribiéndolo. */
function Pasos({ valor, onCambio, grande = false, etiqueta }) {
  const n = parseInt(valor, 10);
  const pon = (x) => onCambio(String(Math.max(1, Math.min(99, x))));
  const alto = grande ? 48 : 40;
  const boton = (signo, alTocar, apagado) => (
    <button type="button" onClick={alTocar} disabled={apagado} aria-label={`${signo === '+' ? 'Una más' : 'Una menos'}: ${etiqueta}`} className="kp-press"
      style={{ width: grande ? 42 : 36, height: alto, border: 'none', background: 'transparent', cursor: apagado ? 'default' : 'pointer', fontFamily: FONT, fontSize: 20, fontWeight: 700, color: T.text2, opacity: apagado ? 0.35 : 1, display: 'grid', placeItems: 'center' }}>
      {signo === '+' ? '+' : '−'}
    </button>
  );
  return (
    <span data-pasos={etiqueta} style={{ display: 'inline-flex', alignItems: 'center', background: grande ? UI.relleno : '#fff', borderRadius: 12, height: alto, flexShrink: 0 }}>
      {boton('−', () => pon((Number.isFinite(n) ? n : 1) - 1), !Number.isFinite(n) || n <= 1)}
      <input value={valor ?? ''} inputMode="numeric" aria-label={etiqueta}
        onChange={(e) => onCambio(e.target.value.replace(/\D/g, '').slice(0, 2))}
        style={{ width: grande ? 34 : 28, border: 'none', background: 'transparent', textAlign: 'center', fontFamily: FONT, fontWeight: 800, fontSize: grande ? 20 : 17, color: T.text, padding: 0 }} />
      {boton('+', () => pon((Number.isFinite(n) ? n : 0) + 1), Number.isFinite(n) && n >= 99)}
    </span>
  );
}

/** Ejemplo y Explicación del ejercicio. Si falta uno, «+ Grabar …»: se sube por el mismo camino que en la ficha y se queda en ella. */
function VideosDelEjercicio({ ficha, media, onGrabado, soloLectura }) {
  const conEjemplo = !!(ficha?.video_url || ficha?.video_link) || media.some((m) => m.tipo === 'video' && m.proposito !== 'explicacion');
  const conExplicacion = media.some((m) => m.tipo === 'video' && m.proposito === 'explicacion');
  const pastilla = (texto) => (
    <span style={{ fontSize: 12.5, fontWeight: 700, color: '#3F4553', background: '#fff', borderRadius: 8, padding: '4px 8px', whiteSpace: 'nowrap' }}>{texto}</span>
  );
  const falta = (texto, proposito) => (soloLectura || !ficha?.id ? null : (
    <MediaUpload accept="video/*" kind="videos" value="" onChange={() => {}} proposito={proposito}
      alSubir={async (subida) => { const fila = await addExerciseMedia({ exerciseId: ficha.id, url: subida.url, proposito }); onGrabado?.(fila); }}
      botones={({ carrete, busy }) => (
        <button type="button" onClick={carrete} disabled={busy} data-grabar={proposito} className="kp-press"
          style={{ border: 'none', cursor: 'pointer', fontFamily: FONT, fontSize: 12.5, fontWeight: 800, color: T.accent, background: KP.blueSoft, borderRadius: 8, padding: '4px 8px', whiteSpace: 'nowrap' }}>
          {busy ? 'Subiendo…' : `+ Grabar ${texto}`}
        </button>
      )} />
  ));
  return (
    <span data-videos style={{ display: 'inline-flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      {conEjemplo ? pastilla('Ejemplo') : falta('ejemplo', 'ejemplo')}
      {conExplicacion ? pastilla('Explicación') : falta('explicación', 'explicacion')}
    </span>
  );
}

/** Un dato agregado (Reps, Distancia, Tiempo, Descanso, Peso): su rótulo arriba, el número, su unidad y la X para quitarlo. */
function Dato({ op, valor, onCambio, onQuitar, enfocar }) {
  const ref = useRef(null);
  useEffect(() => { if (enfocar) ref.current?.focus(); }, [enfocar]);
  const esObjeto = typeof op.nace === 'object';
  const q = esObjeto ? valor?.q ?? '' : valor ?? '';
  return (
    <div data-dato={op.k} style={{ minWidth: 0 }}>
      {/* El título y su X arriba, lejos de los números (Andrés, 20 nov 2026: la «×» junto a la unidad se leía como «por»). */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 26, marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: T.text2 }}>{op.label}</span>
        <button type="button" onClick={onQuitar} aria-label={`Quitar ${op.label.toLowerCase()}`} className="kp-press"
          style={{ width: 26, height: 26, border: 'none', borderRadius: 8, background: 'transparent', color: T.text3, display: 'grid', placeItems: 'center', cursor: 'pointer', marginLeft: 'auto' }}>
          <X size={15} strokeWidth={2.4} aria-hidden="true" />
        </button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input ref={ref} value={q} inputMode="decimal" aria-label={op.label}
          onChange={(e) => { const v = e.target.value.replace(/[^\d.,:]/g, '').slice(0, 6); onCambio(esObjeto ? { ...valor, q: v } : v); }}
          style={{ ...CAMPO, width: 74, textAlign: 'center' }} />
        {op.k === 'reps' && <span style={{ fontSize: 14, fontWeight: 700, color: T.text2 }}>reps</span>}
        {esObjeto && (
          <Segmentos compacto opciones={UNIDADES[op.k]} valor={valor?.u ?? op.nace.u} etiqueta={`Unidad de ${op.label.toLowerCase()}`} onCambio={(u) => onCambio({ ...valor, u })} />
        )}
      </div>
    </div>
  );
}

/** Mosaicos con ícono (los de «Agrega a tu clase»). */
function Mosaicos({ opciones, alto = 72, ancho = 'repeat(auto-fill, minmax(104px, 1fr))' }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: ancho, gap: 8 }}>
      {opciones.map((m) => (
        <button key={m.id} type="button" onClick={m.activar} data-mosaico={m.id} className="kp-press" {...(m.abre ? { 'aria-haspopup': 'dialog' } : null)}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, height: alto, padding: '0 6px', borderRadius: 13, border: 'none', background: UI.relleno, color: T.text, fontFamily: FONT, fontWeight: 700, fontSize: 13.5, cursor: 'pointer', textAlign: 'center' }}>
          <m.icono size={20} strokeWidth={2} color={m.color ?? '#4B505C'} aria-hidden="true" />
          {m.label}
        </button>
      ))}
    </div>
  );
}

export default function EditorDeDeporte({ deporte, onDeporte, repertoire = [], categorias = [], onEjercicioCreado, atleta, soloLectura = false }) {
  // «Su video» de cada ejercicio (ver `lib/videoDelAtleta.js`): sin atleta (una plantilla) no hay cuadro.
  const videoAt = useContext(VideoDelAtleta);
  const suVideo = videoAt.atleta?.id && videoAt.abrir ? videoAt.abrir : null;
  const { avisa } = useAviso();
  const datos = deporte ?? {};
  const items = useMemo(() => datos.items ?? [], [datos.items]);
  const pon = (c) => onDeporte({ ...datos, ...c });
  const ponItems = (lista) => pon({ items: lista });
  const parchea = (id, c) => ponItems(items.map((x) => (x.id === id ? { ...x, ...c } : x)));

  const [abierto, setAbierto] = useState(null);
  const [eligiendo, setEligiendo] = useState(null); // 'agregar' | id del ejercicio que se cambia
  const [recien, setRecien] = useState(null);
  const [enfoca, setEnfoca] = useState(null);
  const [abiertos, setAbiertos] = useState({});

  // Los videos de las fichas (Ejemplo y Explicación), en una sola consulta.
  const ids = useMemo(() => [...new Set(items.map((x) => x.exercise_id).filter(Boolean))].sort().join(','), [items]);
  const [mediaGuardada, setMedia] = useState([]);
  useEffect(() => {
    let vivo = true;
    if (ids) listExerciseMedia(ids.split(',')).then((m) => { if (vivo) setMedia(m); }).catch(() => {});
    return () => { vivo = false; };
  }, [ids]);
  const media = ids ? mediaGuardada : [];
  const fichaDe = (it) => repertoire.find((e) => e.id === it.exercise_id) ?? null;
  const mediaDe = (it) => media.filter((m) => m.exercise_id === it.exercise_id);

  const termina = () => {
    const id = abierto;
    setAbierto(null); setRecien(id);
    setTimeout(() => setRecien((r) => (r === id ? null : r)), 1600);
    requestAnimationFrame(() => document.querySelector(`[data-dep-boton="${id}"]`)?.focus({ preventScroll: true }));
  };
  const mueve = (i, d) => { const l = [...items]; [l[i], l[i + d]] = [l[i + d], l[i]]; ponItems(l); };
  const duplica = (i) => { const copia = { ...structuredClone(items[i]), id: rid() }; ponItems([...items.slice(0, i + 1), copia, ...items.slice(i + 1)]); setAbierto(copia.id); };
  const borra = (id) => {
    const antes = datos;
    ponItems(items.filter((x) => x.id !== id));
    setAbierto(null);
    avisa('Se borró', { accion: { texto: 'Deshacer', alTocar: () => onDeporte(antes) } });
  };
  const nuevo = itemDeDeporte;
  const agrega = (elegidos) => {
    if (!elegidos.length) return;
    const nuevos = elegidos.map(nuevo);
    ponItems([...items, ...nuevos]);
    setAbierto(nuevos.length === 1 ? nuevos[0].id : null);
  };
  const crea = async (nombre) => {
    const fila = await createExercise({ name: nombre, carga_tipo: 'nada' });
    onEjercicioCreado?.(fila);
    if (eligiendo === 'agregar') agrega([fila]); else parchea(eligiendo, { exercise_id: fila.id, name: fila.name });
    setEligiendo(null);
  };
  const usadosEnDeporte = useMemo(() => new Set(items.map((x) => x.exercise_id)), [items]);

  /* CALENTAMIENTO Y ENFRIAMIENTO: opcionales, al principio y al final (como en Clase): guiado o con ejercicios. */
  const calentamientos = useMemo(() => (repertoire ?? []).filter((e) => !!e?.guiado), [repertoire]);
  const nombreAtleta = (atleta?.full_name || atleta?.username || '').split(' ')[0];
  const parteExtra = (k) => {
    const t = datos[k] ?? { forma: 'video' };
    const ponT = (c) => pon({ [k]: { ...t, ...c } });
    return (
      <>
        <div style={{ display: 'flex', maxWidth: 300, marginBottom: 12 }}>
          <Segmentos opciones={[['video', 'Guiado'], ['ejercicios', 'Ejercicios']]} valor={t.forma ?? 'video'} etiqueta={k === 'cal' ? 'Cómo calienta' : 'Cómo enfría'} onCambio={(forma) => ponT({ forma, items: t.items ?? [] })} />
        </div>
        {(t.forma ?? 'video') === 'video'
          ? <CamposDeVideo t={{ q: '', u: 'min', ...t }} calentamientos={calentamientos} categorias={categorias} nombreAtleta={nombreAtleta} onEjercicioCreado={onEjercicioCreado} onCambio={ponT} />
          : <SetsDeEjercicios t={{ id: k, ...t }} de={k === 'cal' ? 'el calentamiento' : 'el enfriamiento'} repertoire={repertoire} onEjercicioCreado={onEjercicioCreado} onCambio={(c) => ponT(c)} />}
      </>
    );
  };
  const resumenDeParte = (t) => {
    if (!t) return '';
    if ((t.forma ?? 'video') === 'ejercicios') return (t.items ?? []).length ? `Ejercicios · ${(t.items ?? []).map((x) => x.name).join(', ')}` : 'Ejercicios';
    const guiado = calentamientos.find((e) => e.id === t.video?.exercise_id)?.name ?? t.video?.name;
    return guiado ? `Guiado · ${guiado}` : [t.q && `${t.q} ${t.u ?? 'min'}`, 'Guiado'].filter(Boolean).join(' · ');
  };

  // Los números del riel: calentamiento (si hay), los ejercicios y el enfriamiento (si hay).
  const piezas = [
    ...(datos.cal ? [{ id: 'cal', parte: 'cal', titulo: 'Calentamiento' }] : []),
    ...items.map((it) => ({ id: it.id, it })),
    ...(datos.calma ? [{ id: 'calma', parte: 'calma', titulo: 'Enfriamiento' }] : []),
  ];

  /* LA LISTA AGRUPADA (Andrés, 21 nov 2026; la misma de Técnica y del Híbrido): sin la línea con círculos. Todo va en UN bloque azul claro;
     adentro, renglones separados por rayas finas; el número, sencillo; el que está abierto, una tarjeta blanca. */
  const riel = (n) => (
    <span aria-hidden="true" style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 22, fontSize: 14.5, fontWeight: 800, color: T.text2 }}>{n}</span>
  );
  // Sin «✓ Listo» ni «Editando» (como en Running): el abierto ya se ve como tarjeta blanca.
  const estado = () => null;
  const flecha = (editando) => (editando
    ? <ChevronUp size={19} strokeWidth={2.2} color={T.accent} aria-hidden="true" style={{ flexShrink: 0 }} />
    : <ChevronDown size={19} strokeWidth={2.2} color={T.text3} aria-hidden="true" style={{ flexShrink: 0 }} />);

  const pie = (i, conMover, extra) => (
    <div style={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', borderTop: `1px solid ${KP.line}`, marginTop: 14, paddingTop: 8 }}>
      {conMover && i > 0 && <BotonChico icono={ArrowUp} onClick={() => mueve(i, -1)}>Mover arriba</BotonChico>}
      {conMover && i < items.length - 1 && <BotonChico icono={ArrowDown} onClick={() => mueve(i, 1)}>Mover abajo</BotonChico>}
      {extra}
      <button type="button" onClick={termina} className="kp-press"
        style={{ marginLeft: 'auto', minHeight: 46, padding: '0 26px', border: 'none', borderRadius: 12, background: T.accent, color: '#fff', fontFamily: FONT, fontWeight: 800, fontSize: 15, cursor: 'pointer', boxShadow: KP.shBtn }}>
        Listo
      </button>
    </div>
  );

  const cuerpoDeEjercicio = (it, i) => {
    const presentes = OPCIONALES.filter((o) => hay(it[o.k]) && o.k !== 'nota');
    const faltan = OPCIONALES.filter((o) => !hay(it[o.k]));
    return (
      <div id={`dep-${it.id}`} className="tl-corre-entra" style={{ padding: '6px 14px 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <span aria-hidden="true" style={{ width: 26, height: 26, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'rgba(6,122,85,.1)', color: VERDE_TEXTO }}><Check size={15} strokeWidth={3} /></span>
          <span style={{ fontSize: 16, fontWeight: 800, color: T.text }}>Veces</span>
        </div>
        <div style={{ paddingLeft: 36 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 22, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Pasos grande valor={it.veces} etiqueta={`Veces de ${it.name}`} onCambio={(veces) => parchea(it.id, { veces })} />
              <div data-por-lado style={{ width: 'auto' }}>
                <Interruptor encendido={!!it.lado} onCambio={(lado) => parchea(it.id, { lado: lado || undefined })}>Por lado</Interruptor>
              </div>
            </div>
            {presentes.map((o) => (
              <Dato key={o.k} op={o} valor={it[o.k]} enfocar={enfoca === `${it.id}:${o.k}`}
                onCambio={(v) => parchea(it.id, { [o.k]: v })} onQuitar={() => parchea(it.id, { [o.k]: undefined })} />
            ))}
          </div>
          {hay(it.nota) && (
            <div data-dato="nota" style={{ marginTop: 14, maxWidth: 620 }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: T.text2 }}>Nota para el atleta</span>
                <button type="button" onClick={() => parchea(it.id, { nota: undefined })} aria-label="Quitar la nota" className="kp-press"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: 'none', background: 'transparent', color: T.text2, fontFamily: FONT, fontWeight: 700, fontSize: 13, minHeight: 30, cursor: 'pointer' }}>
                  <X size={14} strokeWidth={2.4} aria-hidden="true" /> Quitar
                </button>
              </div>
              <textarea value={it.nota} autoFocus={enfoca === `${it.id}:nota`} onChange={(e) => parchea(it.id, { nota: e.target.value })} rows={2}
                placeholder="Manos rápidas. No pierdas el primer paso." aria-label="Nota para el atleta"
                style={{ ...CAMPO, fontWeight: 600, fontSize: 15, minHeight: 64, padding: '10px 12px', resize: 'vertical', lineHeight: 1.4 }} />
            </div>
          )}
          {(faltan.length > 0 || (it.exercise_id && suVideo)) && (
            <div data-agrega-ejercicio style={{ marginTop: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.text2, marginBottom: 8 }}>Agrega, si hace falta</div>
              <div style={{ maxWidth: 7 * 112 }}>
                <Mosaicos opciones={[
                  ...faltan.map((o) => ({ id: o.k, label: o.label, icono: o.icono, activar: () => { parchea(it.id, { [o.k]: structuredClone(o.nace) }); setEnfoca(`${it.id}:${o.k}`); } })),
                  // «Su video» (21 nov 2026): el video solo para este atleta, el mismo de Gym. Ver `lib/videoDelAtleta.js`.
                  ...(it.exercise_id && suVideo ? [{ id: 'su-video', label: 'Su video', icono: Video, color: VIOLETA_SU_VIDEO, abre: true, activar: () => suVideo({ ...it, exercise_id: it.exercise_id }) }] : []),
                ]} />
              </div>
            </div>
          )}
        </div>
        {pie(i, true, (
          <>
            <BotonChico icono={Copy} onClick={() => duplica(i)}>Duplicar</BotonChico>
            <BotonChico icono={ArrowLeftRight} onClick={() => setEligiendo(it.id)}>Cambiar ejercicio</BotonChico>
            <BotonChico icono={Trash2} onClick={() => borra(it.id)} peligro>Borrar</BotonChico>
          </>
        ))}
      </div>
    );
  };

  const tarjeta = (p, n) => {
    const editando = abierto === p.id;
    const caja = editando
      ? { borderRadius: 14, background: '#fff', boxShadow: '0 1px 2px rgba(17,19,24,.06)', margin: '6px 8px 6px 0', minWidth: 0 }
      : { minWidth: 0 };
    const fila = { display: 'grid', gridTemplateColumns: '28px minmax(0, 1fr)', gap: 10, borderTop: n > 1 ? `1.5px solid ${RAYA}` : 'none' };
    const alTocar = () => (editando ? termina() : setAbierto(p.id));
    if (p.parte) {
      const t = datos[p.parte];
      return (
        <div key={p.id} data-dep={p.id} style={fila}>
          {riel(n)}
          <div style={caja}>
            <button type="button" data-dep-boton={p.id} onClick={alTocar} aria-expanded={editando} className={`kp-press${recien === p.id ? ' tl-corre-recien' : ''}`}
              style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', border: 'none', background: 'transparent', borderRadius: 16, padding: '11px 14px', textAlign: 'left', cursor: 'pointer', fontFamily: FONT, color: T.text, minHeight: 58 }}>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 15.5, fontWeight: 800 }}>{p.titulo}</span>
                <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: T.text2, marginTop: 2 }}>{resumenDeParte(t) || 'Guiado o con ejercicios'}</span>
              </span>
              {estado(editando, !!resumenDeParte(t))}
              {flecha(editando)}
            </button>
            {editando && (
              <div className="tl-corre-entra" style={{ padding: '6px 14px 8px' }}>
                {parteExtra(p.parte)}
                {pie(0, false, <BotonChico icono={Trash2} onClick={() => { pon({ [p.parte]: undefined }); setAbierto(null); }} peligro>Quitar</BotonChico>)}
              </div>
            )}
          </div>
        </div>
      );
    }
    const it = p.it;
    const i = items.indexOf(it);
    const ficha = fichaDe(it);
    const resumen = resumenDeDeporte(it);
    return (
      <div key={p.id} data-dep={p.id} style={fila}>
        {riel(n)}
        <div style={caja}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px 10px 10px', flexWrap: 'wrap' }}>
            <button type="button" data-dep-boton={p.id} onClick={alTocar} aria-expanded={editando} aria-controls={editando ? `dep-${it.id}` : undefined}
              className={`kp-press${recien === p.id ? ' tl-corre-recien' : ''}`}
              style={{ flex: '1 1 260px', minWidth: 0, display: 'flex', alignItems: 'center', gap: 14, border: 'none', background: 'transparent', padding: 0, textAlign: 'left', cursor: 'pointer', fontFamily: FONT, color: T.text }}>
              <Portada foto={ficha?.cover_image_url} video={ficha?.video_url || ficha?.video_link} desde={ficha?.recorte_inicio} hasta={ficha?.recorte_fin}
                style={{ width: 84, height: 52, borderRadius: 10, flexShrink: 0, background: '#0E1015' }}>
                {ficha?.video_url || ficha?.video_link ? <PlayCircle size={24} color="#fff" strokeWidth={1.8} /> : <Dumbbell size={18} color="#3A3F4C" />}
              </Portada>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 16, fontWeight: 800 }}>{it.name || 'Ejercicio'}</span>
                <span data-resumen style={{ display: 'block', fontSize: 14, fontWeight: 600, color: T.text2, marginTop: 2 }}>{resumen || 'Sin veces'}</span>
              </span>
            </button>
            {!editando && !soloLectura && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <Pasos valor={it.veces} etiqueta={`Veces de ${it.name}`} onCambio={(veces) => parchea(it.id, { veces })} />
                <span style={{ fontSize: 13.5, fontWeight: 700, color: T.text2 }}>veces</span>
              </span>
            )}
            <VideosDelEjercicio ficha={ficha} media={mediaDe(it)} soloLectura={soloLectura}
              onGrabado={(fila) => { if (fila) setMedia((m) => [...m, fila]); avisa('Video guardado en la ficha del ejercicio'); }} />
            {estado(editando, !!resumen)}
            <button type="button" onClick={alTocar} aria-label={editando ? 'Cerrar' : `Abrir ${it.name}`} tabIndex={-1}
              style={{ border: 'none', background: 'transparent', padding: 4, cursor: 'pointer', display: 'grid', placeItems: 'center' }}>{flecha(editando)}</button>
          </div>
          {editando && !soloLectura && cuerpoDeEjercicio(it, i)}
        </div>
      </div>
    );
  };

  const hueco = (k, texto) => (
    <div style={{ paddingBottom: 2 }}>
      <button type="button" data-agregar-parte={k} className="kp-press" onClick={() => { pon({ [k]: { forma: 'video' } }); setAbierto(k); }}
        style={{ display: 'flex', alignItems: 'baseline', gap: 10, minHeight: 44, padding: '10px 2px', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: FONT, textAlign: 'left' }}>
        <span style={{ fontSize: 14.5, fontWeight: 800, color: T.accent }}>+ {texto}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: T.text3 }}>Opcional</span>
      </button>
    </div>
  );

  const extrasDeSesion = [
    { id: 'necesita', label: 'Lo que necesita', icono: Package },
    { id: 'nota', label: 'Nota para el atleta', icono: StickyNote },
  ];

  return (
    <div data-editor-deporte={items.length ? 'con-ejercicios' : 'vacio'} style={{ marginTop: 14, fontFamily: FONT }}>
      <Seccion color={T.accent}>Los ejercicios, en orden</Seccion>
      {!soloLectura && !datos.cal && hueco('cal', 'Calentamiento')}
      {piezas.length > 0 && (
        <div data-lista-deporte style={{ background: AZUL, borderRadius: 18, padding: '4px 0', margin: '4px 0 8px' }}>
          {piezas.map((p, k) => tarjeta(p, k + 1))}
        </div>
      )}
      {!items.length && (
        <div style={{ margin: '4px 0 10px', fontSize: 14, fontWeight: 600, color: T.text2, lineHeight: 1.45 }}>
          Agrega los ejercicios de la sesión. Cada uno lleva su video, cuántas veces y, si quieres, por lado.
        </div>
      )}
      {!soloLectura && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', margin: '6px 0 0', flexWrap: 'wrap' }}>
          <button type="button" data-agregar-ejercicio onClick={() => setEligiendo('agregar')} className="kp-press" aria-haspopup="dialog"
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 52, padding: '0 28px', borderRadius: 14, border: 'none', background: T.accent, color: '#fff', fontFamily: FONT, fontWeight: 800, fontSize: 15.5, cursor: 'pointer', boxShadow: KP.shBtn }}>
            <Plus size={19} aria-hidden="true" /> Agregar ejercicio
          </button>
        </div>
      )}
      {!soloLectura && !datos.calma && <div style={{ marginTop: 6 }}>{hueco('calma', 'Enfriamiento')}</div>}

      {!soloLectura && (
        <div data-detalles-deporte style={{ marginTop: 22 }}>
          <Seccion color={T.accent}>Agrega a tu sesión</Seccion>
          {(hay(datos.necesita) || abiertos.necesita) && (
            <Extra rotulo="Lo que necesita" onQuitar={() => { setAbiertos((a) => ({ ...a, necesita: false })); pon({ necesita: undefined }); }}>
              <input value={datos.necesita ?? ''} onChange={(e) => pon({ necesita: e.target.value })} placeholder="Conos, balón, bandas" aria-label="Lo que necesita para la sesión" style={{ ...CAMPO, fontWeight: 700, fontSize: 15.5 }} />
            </Extra>
          )}
          {(hay(datos.nota) || abiertos.nota) && (
            <Extra rotulo="Nota para el atleta" onQuitar={() => { setAbiertos((a) => ({ ...a, nota: false })); pon({ nota: undefined }); }}>
              <textarea value={datos.nota ?? ''} onChange={(e) => pon({ nota: e.target.value })} rows={2} placeholder="Hoy trabajamos la salida contra press." aria-label="Nota para el atleta de la sesión"
                style={{ ...CAMPO, fontWeight: 600, fontSize: 15, minHeight: 72, padding: '12px', resize: 'vertical', lineHeight: 1.4 }} />
            </Extra>
          )}
          {extrasDeSesion.some((m) => !hay(datos[m.id]) && !abiertos[m.id]) && (
            <div style={{ maxWidth: 2 * 178 }}>
              <Mosaicos alto={78} ancho="repeat(2, minmax(0, 1fr))"
                opciones={extrasDeSesion.filter((m) => !hay(datos[m.id]) && !abiertos[m.id]).map((m) => ({ ...m, activar: () => { setAbiertos((a) => ({ ...a, [m.id]: true })); pon({ [m.id]: '' }); } }))} />
            </div>
          )}
          <div style={{ fontSize: 13, fontWeight: 600, color: T.text2, marginTop: 10 }}>Todo es opcional.</div>
        </div>
      )}

      {eligiendo && (
        <RepertoirePicker
          uno={eligiendo !== 'agregar'}
          exercises={(repertoire ?? []).filter((e) => !e?.guiado)}
          title={eligiendo === 'agregar' ? 'Agregar ejercicios' : 'Cambiar ejercicio'}
          primero={(e) => usadosEnDeporte.has(e.id)}
          alCrear={crea}
          onClose={() => setEligiendo(null)}
          onConfirm={(elegidos) => {
            if (eligiendo === 'agregar') agrega(elegidos);
            else if (elegidos[0]) parchea(eligiendo, { exercise_id: elegidos[0].id, name: elegidos[0].name });
            setEligiendo(null);
          }}
        />
      )}
    </div>
  );
}
