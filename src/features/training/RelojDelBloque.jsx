import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Pause, Play, Plus, Minus, Volume2, VolumeX, X } from 'lucide-react';
import { LT, FONT, NUM_STYLE, UI } from '@/lib/theme';
import { useConfirmacion } from '@/components/Confirmacion';
import { expande, etiquetaDeTramo, limpiaResultado, relojTexto, textoDeTiempo, vistaDe } from '@/lib/formatos';
import {
  nuevoReloj, inicia, pausa, avanza, listo, listoConTiempo, termina, sumaRonda, vista, sugerido as sugeridoDe,
} from '@/lib/relojDeFormato';
import { METROS_PARA_GPS } from '@/lib/recorrido';
import PasoConGps from '@/features/training/PasoConGps';
import { leeRelojGuardado, guardaReloj, borraReloj } from '@/lib/relojGuardado';
import { preparaAudio, pitido } from '@/lib/pitidos';
import { usePantallaEncendida } from '@/lib/pantallaEncendida';
import { textoMeta } from '@/lib/medidas';
import { lapsosDe } from '@/lib/lapsos';
import { formatIntensity } from '@/lib/training-utils';
import ResultadoDelBloque from '@/features/training/ResultadoDelBloque';

/**
 * El reloj de un Set con formato (AMRAP, EMOM, Tabata, Fartlek…), a pantalla completa.
 *
 * Igual que la ficha de un ejercicio: es LA pantalla mientras se entrena, con el teléfono en el
 * suelo y las manos ocupadas. Números enormes, un solo botón grande, y todo lo demás pequeño.
 * No sabe qué es un AMRAP: corre los tramos que le da `expande` (ver `lib/formatos.js` y
 * `lib/relojDeFormato.js`). El reloj es una ayuda, no una obligación: el resultado también se
 * puede anotar a mano desde la tarjeta del Set sin abrir esto.
 *
 * CERRAR PAUSA. La X no deja el reloj corriendo a escondidas: lo pausa y lo guarda. Al volver
 * a abrirlo está donde lo dejó. Si la app se recarga con el reloj en marcha (el sistema mató la
 * pestaña), al volver sigue contando desde la hora real, porque lo guardado es CUÁNDO empezó.
 *
 * CÓMO ARRANCA. Tres maneras, según quién lo abrió y por qué:
 *   · `empezarYa`: la persona acaba de tocar «Empezar» (o «Iniciar reloj» en la lista): corre ya, sin otro «Iniciar».
 *   · `conCuenta`: lo abrió el MODO ENTRENO porque la persona avanzó («Iniciar entreno», «Listo», «Seguir») y toca un reloj.
 *     Andrés, 9 oct 2026: «si ya le piqué a iniciar entrenamiento y se supone que tú me guías, ¿por qué no inicias el reloj?».
 *     Corre solo, pero con un 3, 2, 1 que se puede cancelar: nadie empieza a correr en el mismo instante en que toca un botón.
 *   · sin ninguno: se abre en cero y espera su «Iniciar».
 */

const LLAVE_DEL_SONIDO = 'tl:reloj:sonido';
// Los segundos del «3, 2, 1» con que arranca solo (`conCuenta`).
const SEG_DE_CUENTA = 3;
const leeSonido = () => {
  try { return window.localStorage.getItem(LLAVE_DEL_SONIDO) !== 'no'; } catch { return true; }
};

// Lo que dice debajo del número, según el formato. Solo cambia el texto: el reloj corre igual.
function textoDeAvance(id, formato, v, nEjercicios, rondas = 1) {
  const { tramo } = v;
  if (!tramo) return '';
  // Lapsos personalizados: de qué ronda y de qué lapso es el tramo (un descanso es de la ronda en curso).
  if (id === 'lapsos') {
    const ronda = rondas > 1 ? `Ronda ${tramo.vuelta} de ${rondas}` : '';
    const lapso = tramo.tipo === 'trabajo' && tramo.de > 1 ? `Lapso ${tramo.lapso + 1} de ${tramo.de}` : '';
    return [lapso, ronda].filter(Boolean).join(' · ');
  }
  if (id === 'emom') return `Intervalo ${v.i + 1} de ${v.n}`;
  if (id === 'tabata' || id === 'intervalos') return `Ronda ${tramo.vuelta} de ${formato.vueltas}`;
  if (id === 'fartlek') return `Tramo ${tramo.vuelta} de ${formato.vueltas}`;
  if (id === 'portiempo') return formato.turnan && nEjercicios > 1 ? `Estación ${v.i + 1} de ${v.n}` : `Ronda ${v.i + 1} de ${v.n}`;
  if (id === 'amrap') return '';
  return `Tramo ${v.i + 1} de ${v.n}`;
}

function BotonGrande({ children, onClick, color = LT.blue }) {
  return (
    <button
      type="button" onClick={onClick}
      style={{
        width: '100%', minHeight: 60, borderRadius: 18, border: 'none', cursor: 'pointer', background: color, color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontFamily: FONT, fontSize: 18, fontWeight: 800,
        touchAction: 'manipulation',
      }}
    >
      {children}
    </button>
  );
}

function BotonChico({ children, onClick, peligro = false }) {
  return (
    <button
      type="button" onClick={onClick}
      style={{
        flex: 1, minHeight: 46, borderRadius: 14, cursor: 'pointer', background: UI.relleno,
        border: 'none', color: peligro ? LT.danger : LT.text, display: 'flex', alignItems: 'center',
        justifyContent: 'center', gap: 7, fontFamily: FONT, fontSize: 15, fontWeight: 700, touchAction: 'manipulation',
      }}
    >
      {children}
    </button>
  );
}

/**
 * `plan`: los tramos ya armados, para un Set en «Lapsos personalizados» (ver `tramosDeLapsos` en `lib/lapsos.js`); sin él,
 * salen del formato. Con lapsos, `formato` solo trae lo que el resultado necesita (`anota`).
 *
 * QUE LA APP GUÍE (23 oct 2026). Dos cosas, las dos con la misma regla: la app avanza sola cuando puede saber que algo terminó.
 *   · `conGps`: un lapso por DISTANCIA de 200 m o más (un 1 km) se corre con la misma pantalla de mapa del sprint (`PasoConGps`) y termina solo al llegar a la
 *     meta; el descanso de después y el lapso siguiente ya corrían solos. Sin GPS, o si la persona elige «Sin GPS» (`sinGps[nombre]`, `alElegirSinGps`), el lapso
 *     sigue esperando su «Lapso listo»: la app nunca espera una señal que no llega.
 *   · Al acabar, si el reloj ya sabe el resultado entero (un formato que no anota nada; unos lapsos que se completaron todos), lo guarda y se cierra solo, sin
 *     preguntar «¿Marcar como hecho?». Si falta algo que solo la persona sabe (las rondas de un AMRAP, cuántos intervalos de un EMOM salieron), sí se pregunta.
 */
const SEG_DEL_FIN = 1.6; // lo que se ve el «Terminaste» antes de cerrar solo

export default function RelojDelBloque({ formato, plan: planDado = null, ejercicios, serie, clave, resumen, empezarYa = false, conCuenta = false, conGps = false, sinGps = null, alElegirSinGps = null, onGuardar, onCerrar, videoDe = null, miniaturaDe = null }) {
  const pregunta = useConfirmacion();
  const nEj = ejercicios.length;
  // El ejercicio cuyo video se abrió tocándolo en la lista (`null` = ninguno).
  const [verEj, setVerEj] = useState(null);
  // Los tramos de lapsos se guardan como texto para que su identidad no cambie con cada dibujo de la pantalla de arriba.
  const claveDelPlan = useMemo(() => (planDado ? JSON.stringify(planDado) : null), [planDado]);
  const plan = useMemo(() => (claveDelPlan ? JSON.parse(claveDelPlan) : expande(formato, nEj)), [claveDelPlan, formato, nEj]);
  const tope = formato.tope ?? null;
  const firma = useMemo(() => JSON.stringify(claveDelPlan ? [formato, nEj, claveDelPlan] : [formato, nEj]), [formato, nEj, claveDelPlan]);
  const id = claveDelPlan ? 'lapsos' : vistaDe(formato);
  const rondas = plan.reduce((m, t) => Math.max(m, t.vuelta ?? 1), 1);

  // `empezarYa`: quien lo abre acaba de tocar el botón grande («Empezar», «Seguir» o «Iniciar reloj»): que no pida otro «Iniciar» adentro.
  // Uno pausado también sigue: quien lo dejó en pausa y vuelve a tocar el botón grande quiere seguir, no encontrarse otro botón.
  const [est, setEst] = useState(() => {
    const guardado = leeRelojGuardado(clave, firma, plan);
    return empezarYa && (guardado.fase === 'listo' || guardado.fase === 'pausa') ? inicia(guardado, Date.now()) : guardado;
  });
  const [ahora, setAhora] = useState(() => Date.now());
  const [sonido, setSonido] = useState(leeSonido);
  // Los lapsos en los que cerró el mapa (se sigue con «Lapso listo»), por número de tramo.
  const [gpsCerrado, setGpsCerrado] = useState(() => new Set());
  // `conCuenta`: solo con el reloj en cero. Uno que ya iba (pausado) vuelve a donde estaba, sin cuenta.
  const [preparaHasta, setPreparaHasta] = useState(() => (conCuenta && est.fase === 'listo' ? Date.now() + SEG_DE_CUENTA * 1000 : null));

  // El reloj se calcula con la hora: este temporizador solo avisa a la pantalla que se vuelva a dibujar.
  useEffect(() => {
    if (est.fase !== 'corriendo') return undefined;
    const t = setInterval(() => {
      const ya = Date.now();
      setAhora(ya);
      setEst((e) => avanza(e, plan, ya, tope));
    }, 250);
    return () => clearInterval(t);
  }, [est.fase, plan, tope]);

  // El «3, 2, 1»: al llegar a cero el reloj arranca solo. Con `Date.now()` y no contando tics: si el teléfono duerme la pestaña, al volver ya toca.
  useEffect(() => {
    if (preparaHasta === null) return undefined;
    const t = setInterval(() => {
      const ya = Date.now();
      setAhora(ya);
      if (ya >= preparaHasta) {
        setPreparaHasta(null);
        setEst((e) => (e.fase === 'listo' ? inicia(e, ya) : e));
      }
    }, 100);
    return () => clearInterval(t);
  }, [preparaHasta]);

  // Cada cambio de estado se guarda: si la app se recarga, el reloj sigue donde iba.
  useEffect(() => { guardaReloj(clave, firma, est); }, [clave, firma, est]);

  usePantallaEncendida(est.fase === 'corriendo');

  const v = vista(est, plan, ahora, tope);
  const preparando = preparaHasta !== null && v.fase === 'listo';
  const cuentaAtras = preparando ? Math.max(1, Math.ceil((preparaHasta - ahora) / 1000)) : 0;

  // Un pitido por cada número de la cuenta; el del arranque lo da el de abajo («cambio»).
  useEffect(() => {
    if (cuentaAtras > 0 && sonido) pitido('cuenta');
  }, [cuentaAtras, sonido]);

  // Los pitidos: 3, 2, 1 en los tramos con tiempo, el cambio de tramo y el final.
  const previo = useRef({ i: est.i, restante: null, fase: est.fase });
  useEffect(() => {
    const p = previo.current;
    if (sonido) {
      if (v.fase === 'fin' && p.fase !== 'fin') pitido('fin');
      else if (v.fase === 'corriendo') {
        if (p.fase === 'listo' || (p.fase === 'corriendo' && v.i !== p.i)) pitido('cambio');
        else if (v.restanteSeg !== null && v.restanteSeg >= 1 && v.restanteSeg <= 3 && v.restanteSeg !== p.restante && v.tramo.seg > 3) pitido('cuenta');
      }
    }
    previo.current = { i: v.i, restante: v.restanteSeg, fase: v.fase };
  });

  const accion = (fn) => {
    const t = Date.now();
    setAhora(t);
    setEst((e) => fn(avanza(e, plan, t, tope), t));
  };
  const empieza = () => { preparaAudio(); accion((e, t) => inicia(e, t)); };
  const pausar = () => accion((e, t) => pausa(e, t));
  const hecho = () => accion((e, t) => listo(e, plan, t, tope));
  const hechoConTiempo = (seg) => accion((e, t) => listoConTiempo(e, plan, t, seg, tope));
  const terminar = async () => {
    if (await pregunta({ titulo: '¿Parar el reloj?', detalle: 'Lo que llevas hasta aquí cuenta como tu resultado.', confirmar: 'Sí, parar' })) {
      accion((e, t) => termina(e, plan, t, tope));
    }
  };
  const reiniciar = async () => {
    if (await pregunta({ titulo: '¿Empezar de nuevo?', detalle: 'Se borra lo que llevas.', confirmar: 'Sí, de nuevo', peligro: true })) {
      borraReloj(clave);
      setEst(nuevoReloj());
    }
  };
  const cierra = () => {
    // Un reloj en marcha se pausa y se guarda antes de irse: que no siga corriendo a escondidas.
    const t = Date.now();
    const e = est.fase === 'corriendo' ? pausa(avanza(est, plan, t, tope), t) : est;
    guardaReloj(clave, firma, e);
    onCerrar();
  };
  const alternaSonido = () => {
    const nuevo = !sonido;
    setSonido(nuevo);
    if (nuevo) preparaAudio();
    try { window.localStorage.setItem(LLAVE_DEL_SONIDO, nuevo ? 'si' : 'no'); } catch { /* sin almacenamiento */ }
  };

  // Al acabar: si el reloj ya lo sabe todo, guarda y cierra solo (ver arriba). Un ref guarda la función de hoy para que el temporizador no se reinicie en cada dibujo.
  const sabeTodo = v.fase === 'fin' && (formato.anota === 'nada' || (id === 'lapsos' && formato.anota === 'cumplido' && v.motivo === 'completo'));
  const guardaSolo = useRef(null);
  useEffect(() => {
    guardaSolo.current = () => {
      const sug = sugeridoDe(est, plan);
      borraReloj(clave);
      onGuardar(limpiaResultado({
        anota: formato.anota, valor: formato.anota === 'cumplido' ? sug.completados : null, extra: null, seg: sug.seg,
        tramos: sug.tramos, ventanas: sug.ventanas, lapsos: sug.lapsos, de: sug.de, en: new Date().toISOString(),
      }));
      onCerrar();
    };
  });
  useEffect(() => {
    if (!sabeTodo) return undefined;
    const t = setTimeout(() => guardaSolo.current(), SEG_DEL_FIN * 1000);
    return () => clearTimeout(t);
  }, [sabeTodo]);

  const { tramo, proximo } = v;
  const enCurso = v.fase === 'corriendo' || v.fase === 'pausa';
  const abierto = !!tramo && tramo.seg === null;
  const color = tramo?.tipo === 'descanso' ? LT.warning : LT.blue;
  // ¿Este lapso va con mapa? Corriendo, de trabajo, por distancia de 200 m o más, con GPS, sin que haya elegido «Sin GPS» ni cerrado el mapa.
  const gpsDelLapso = conGps && v.fase === 'corriendo' && !preparando && tramo?.tipo === 'trabajo' && tramo.seg === null && tramo.metros >= METROS_PARA_GPS
    && !sinGps?.[tramo.etiqueta] && !gpsCerrado.has(est.i);

  let grande = '00:00';
  if (v.fase === 'fin') grande = relojTexto(v.totalSeg);
  else if (tramo) grande = relojTexto(abierto ? v.transcurridoSeg : v.restanteSeg);

  let rotulo = '';
  if (v.fase === 'fin') rotulo = 'Terminaste';
  else if (preparando) rotulo = 'Prepárate';
  else if (id === 'amrap') rotulo = 'Tiempo restante';
  else if (tramo) rotulo = etiquetaDeTramo(tramo);
  // Mientras cuenta, el número manda; lo que viene primero («Lapso 1 de 4 · 1 km · 4:40 min/km») sigue debajo, que es justo lo que hay que saber.
  if (preparando) grande = String(cuentaAtras);
  const avance = v.fase === 'fin' ? '' : textoDeAvance(id, formato, v, nEj, rondas);
  // En lapsos, lo que toca en este tramo: «800 m · 4:34-5:00 min/km».
  const queToca = v.fase !== 'fin' && tramo?.tipo === 'trabajo' ? [tramo.texto, formatIntensity(tramo.carga)].filter(Boolean).join(' · ') : '';

  // A quién le toca: en un descanso, a quien sigue (para ir acomodándose).
  const quien = enCurso && tramo ? (tramo.tipo === 'trabajo' ? tramo.ejercicio : (proximo?.ejercicio ?? tramo.ejercicio)) : null;
  const cuentaRondas = formato.anota === 'rondas' && v.fase !== 'fin';

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 3000, background: LT.bg, display: 'flex', flexDirection: 'column', fontFamily: FONT }}>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ maxWidth: 520, margin: '0 auto', padding: '0 18px' }}>
          <div style={{
            position: 'sticky', top: 0, zIndex: 5, background: LT.bg, display: 'flex', alignItems: 'center', gap: 12,
            padding: 'calc(10px + env(safe-area-inset-top)) 0 8px',
          }}>
            <button
              type="button" onClick={cierra} aria-label="Cerrar el reloj"
              style={{
                width: 38, height: 38, borderRadius: '50%', border: 'none', cursor: 'pointer', background: UI.relleno,
                color: LT.text, display: 'grid', placeItems: 'center', flexShrink: 0,
              }}
            >
              <X size={20} />
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: LT.text }}>Serie {serie}</div>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: LT.text2, ...NUM_STYLE }}>{resumen}</div>
            </div>
            <button
              type="button" onClick={alternaSonido} aria-label={sonido ? 'Quitar el sonido' : 'Poner el sonido'}
              style={{
                width: 38, height: 38, borderRadius: '50%', border: 'none', cursor: 'pointer', background: UI.relleno,
                color: sonido ? LT.blue : LT.text3, display: 'grid', placeItems: 'center', flexShrink: 0,
              }}
            >
              {sonido ? <Volume2 size={19} /> : <VolumeX size={19} />}
            </button>
          </div>

          {/* ---------- El reloj ---------- */}
          <div style={{ textAlign: 'center', padding: '22px 0 8px' }}>
            {/* «En pausa» se nota de lejos (23 oct 2026, Andrés vio un 00:13 grande y no supo si corría): franja ámbar arriba y el número apagado, como la carrera libre. */}
            {v.fase === 'pausa' && (
              <div role="status" style={{ display: 'inline-block', marginBottom: 8, padding: '5px 14px', borderRadius: 99, background: 'rgba(255,176,32,0.18)', color: '#B86400', fontSize: 14, fontWeight: 800 }}>En pausa</div>
            )}
            <div style={{ fontSize: 17, fontWeight: 800, color: v.fase === 'fin' ? LT.mint : color, minHeight: 24, letterSpacing: 0.2 }}>{rotulo}</div>
            <div
              aria-live="off" role="timer"
              style={{
                fontSize: preparando ? 132 : (grande.length > 5 ? 70 : 96), fontWeight: 800, lineHeight: 1.05, letterSpacing: -2,
                color: v.fase === 'fin' ? LT.text : (v.fase === 'pausa' ? LT.text3 : color), ...NUM_STYLE,
              }}
            >
              {grande}
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: LT.text2, minHeight: 22, marginTop: 4, ...NUM_STYLE }}>{avance}</div>
            {queToca && <div style={{ fontSize: 17, fontWeight: 800, color: LT.text, marginTop: 4, ...NUM_STYLE }}>{queToca}</div>}
            {v.progreso !== null && enCurso && (
              <div style={{ height: 8, borderRadius: 4, background: LT.surface2, margin: '14px 6px 0', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.round(v.progreso * 100)}%`, background: color, borderRadius: 4 }} />
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap', fontSize: 13, fontWeight: 700, color: LT.text3, marginTop: 10, minHeight: 18, ...NUM_STYLE }}>
              {enCurso && proximo && (
                <span>Sigue: {etiquetaDeTramo(proximo)}{proximo.texto ? ` · ${proximo.texto}` : proximo.seg ? ` · ${textoDeTiempo(proximo.seg)}` : ''}</span>
              )}
              {enCurso && v.topeRestanteSeg !== null && <span>Tope: {relojTexto(v.topeRestanteSeg)}</span>}
            </div>
          </div>

          {/* ---------- Las rondas (AMRAP): lo que más se toca ---------- */}
          {cuentaRondas && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12, border: 'none', borderRadius: 18, background: LT.surface,
              padding: '12px 14px', margin: '14px 0 4px',
            }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: LT.text3 }}>Rondas</div>
                <div style={{ fontSize: 34, fontWeight: 800, color: LT.text, lineHeight: 1.1, ...NUM_STYLE }}>{v.rondas}</div>
              </div>
              <button
                type="button" onClick={() => setEst((e) => sumaRonda(e, -1))} aria-label="Quitar una ronda" disabled={v.rondas === 0}
                style={{
                  width: 46, height: 46, borderRadius: '50%', border: 'none', background: 'transparent', color: LT.text2,
                  display: 'grid', placeItems: 'center', cursor: 'pointer', opacity: v.rondas === 0 ? 0.35 : 1, touchAction: 'manipulation',
                }}
              >
                <Minus size={20} strokeWidth={3} />
              </button>
              <button
                type="button" onClick={() => setEst((e) => sumaRonda(e, 1))}
                style={{
                  minHeight: 56, padding: '0 22px', borderRadius: 16, border: 'none', background: LT.blue, color: '#fff', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 7, fontFamily: FONT, fontSize: 17, fontWeight: 800, touchAction: 'manipulation',
                }}
              >
                <Plus size={20} strokeWidth={3} /> Ronda
              </button>
            </div>
          )}

          {/* El video (o la foto) del ejercicio que toca, cuando se sabe cuál es (intervalos, EMOM, lapsos): 23 oct 2026, «los intervalos se ven sin el video del ejercicio». */}
          {videoDe && quien !== null && ejercicios[quien] && (() => { const nodo = videoDe(ejercicios[quien].ex); return nodo ? <div style={{ marginTop: 14 }}>{nodo}</div> : null; })()}

          {/* ---------- Los ejercicios ---------- */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, margin: '16px 0 24px' }}>
            {ejercicios.map(({ ex }, i) => {
              const toca = quien === i;
              // Tocar un ejercicio abre su video (si tiene y no es el que ya está arriba): sirve para verlo cuando se hacen todos juntos y no hay «el que toca».
              const nodoVideo = videoDe && verEj === i && !toca ? videoDe(ex) : null;
              const conVideo = !!videoDe && !!miniaturaDe && !!miniaturaDe(ex) && !toca;
              return (
                <Fragment key={i}>
                <div
                  role={conVideo ? 'button' : undefined} tabIndex={conVideo ? 0 : undefined} aria-expanded={conVideo ? verEj === i : undefined}
                  onClick={conVideo ? () => setVerEj((a) => (a === i ? null : i)) : undefined}
                  onKeyDown={conVideo ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setVerEj((a) => (a === i ? null : i)); } } : undefined}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 13px', borderRadius: 12,
                    background: toca ? LT.blueSoft : UI.relleno, border: 'none', cursor: conVideo ? 'pointer' : 'default',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    {miniaturaDe && (() => { const m = miniaturaDe(ex); return m ? <span aria-hidden="true" style={{ position: 'relative', width: 36, height: 36, borderRadius: 9, overflow: 'hidden', flexShrink: 0, background: '#1B1D24' }}>{m}</span> : null; })()}
                    <span style={{ fontSize: 15, fontWeight: toca ? 800 : 700, color: toca ? LT.blue : LT.text, overflowWrap: 'anywhere' }}>{ex.name}</span>
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: toca ? LT.blue : LT.text3, flexShrink: 0, ...NUM_STYLE }}>
                    {(lapsosDe(ex)?.length ?? 0) > 1 ? `${lapsosDe(ex).length} lapsos` : textoMeta(ex)}
                    {conVideo && <ChevronDown size={15} aria-hidden="true" style={{ marginLeft: 6, verticalAlign: '-3px', transform: verEj === i ? 'rotate(180deg)' : 'none' }} />}
                  </span>
                </div>
                {nodoVideo && <div style={{ marginBottom: 4 }}>{nodoVideo}</div>}
                </Fragment>
              );
            })}
          </div>
        </div>
      </div>

      {/* ---------- Los botones, fijos abajo ---------- */}
      {v.fase !== 'fin' && (
        <div style={{ flexShrink: 0, borderTop: `1px solid ${LT.border}`, background: LT.surface }}>
          <div style={{ maxWidth: 520, margin: '0 auto', padding: '12px 18px calc(12px + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Contando 3, 2, 1: un solo botón, «Cancelar», que deja el reloj en cero y regresa (quien no estaba listo no pierde nada). */}
            {preparando && <div style={{ display: 'flex' }}><BotonChico onClick={cierra}>Cancelar</BotonChico></div>}
            {v.fase === 'listo' && !preparando && <BotonGrande onClick={empieza}><Play size={22} fill="#fff" /> Iniciar</BotonGrande>}
            {v.fase === 'corriendo' && (abierto
              ? (
                <>
                  <BotonGrande onClick={hecho}><Check size={22} strokeWidth={3} /> {id === 'lapsos' ? 'Lapso listo' : 'Listo'}</BotonGrande>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <BotonChico onClick={pausar}><Pause size={17} /> Pausa</BotonChico>
                    <BotonChico onClick={terminar}>Parar</BotonChico>
                  </div>
                </>
              )
              : (
                <>
                  <BotonGrande onClick={pausar} color={LT.text}><Pause size={22} fill="#fff" /> Pausa</BotonGrande>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <BotonChico onClick={terminar}>Parar</BotonChico>
                  </div>
                </>
              ))}
            {v.fase === 'pausa' && (
              <>
                <BotonGrande onClick={empieza}><Play size={22} fill="#fff" /> Seguir</BotonGrande>
                <div style={{ display: 'flex', gap: 10 }}>
                  <BotonChico onClick={terminar}>Parar</BotonChico>
                  <BotonChico onClick={reiniciar} peligro>Empezar de nuevo</BotonChico>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* El lapso por distancia con mapa, encima del reloj (que sigue debajo contando: es el que guarda el tiempo y pasa al descanso). */}
      {gpsDelLapso && (
        <PasoConGps
          key={`${clave}:${est.i}`}
          paso={{ clave: `${clave}:${est.i}`, nombre: tramo.etiqueta, serieTexto: textoDeAvance(id, formato, v, nEj, rondas) || null }}
          meta={tramo.metros} carga={formatIntensity(tramo.carga)} sinCuenta segResultado={0}
          onTermina={({ seg }) => hechoConTiempo(seg)}
          onSinGps={() => { alElegirSinGps?.(tramo.etiqueta); setGpsCerrado((c) => new Set(c).add(est.i)); }}
          onCerrar={() => setGpsCerrado((c) => new Set(c).add(est.i))}
        />
      )}

      {v.fase === 'fin' && !sabeTodo && (
        <ResultadoDelBloque
          formato={formato} sugerido={sugeridoDe(est, plan)} resumen={resumen} textoDeCerrar="No guardar" cierraAlTocarFuera={false}
          onGuardar={(r) => { borraReloj(clave); onGuardar(r); onCerrar(); }}
          onCerrar={() => { borraReloj(clave); onCerrar(); }}
        />
      )}
    </div>
  );
}
