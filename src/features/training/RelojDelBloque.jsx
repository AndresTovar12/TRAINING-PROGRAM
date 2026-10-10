import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Pause, Play, Plus, Minus, Volume2, VolumeX, X } from 'lucide-react';
import { LT, FONT, NUM_STYLE } from '@/lib/theme';
import { useConfirmacion } from '@/components/Confirmacion';
import { expande, etiquetaDeTramo, relojTexto, textoDeTiempo, vistaDe } from '@/lib/formatos';
import {
  nuevoReloj, inicia, pausa, avanza, listo, termina, sumaRonda, vista, sugerido as sugeridoDe,
} from '@/lib/relojDeFormato';
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
 */

const LLAVE_DEL_SONIDO = 'tl:reloj:sonido';
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
        flex: 1, minHeight: 46, borderRadius: 14, cursor: 'pointer', background: LT.surface,
        border: `1.5px solid ${LT.borderHi}`, color: peligro ? LT.danger : LT.text, display: 'flex', alignItems: 'center',
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
 */
export default function RelojDelBloque({ formato, plan: planDado = null, ejercicios, serie, clave, resumen, empezarYa = false, onGuardar, onCerrar }) {
  const pregunta = useConfirmacion();
  const nEj = ejercicios.length;
  // Los tramos de lapsos se guardan como texto para que su identidad no cambie con cada dibujo de la pantalla de arriba.
  const claveDelPlan = useMemo(() => (planDado ? JSON.stringify(planDado) : null), [planDado]);
  const plan = useMemo(() => (claveDelPlan ? JSON.parse(claveDelPlan) : expande(formato, nEj)), [claveDelPlan, formato, nEj]);
  const tope = formato.tope ?? null;
  const firma = useMemo(() => JSON.stringify(claveDelPlan ? [formato, nEj, claveDelPlan] : [formato, nEj]), [formato, nEj, claveDelPlan]);
  const id = claveDelPlan ? 'lapsos' : vistaDe(formato);
  const rondas = plan.reduce((m, t) => Math.max(m, t.vuelta ?? 1), 1);

  // `empezarYa`: quien lo abre acaba de decir «Empezar» (o «Iniciar reloj»): que no pida un «Iniciar» más. Si lo dejó pausado, sigue pausado.
  const [est, setEst] = useState(() => {
    const guardado = leeRelojGuardado(clave, firma, plan);
    return empezarYa && guardado.fase === 'listo' ? inicia(guardado, Date.now()) : guardado;
  });
  const [ahora, setAhora] = useState(() => Date.now());
  const [sonido, setSonido] = useState(leeSonido);

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

  // Cada cambio de estado se guarda: si la app se recarga, el reloj sigue donde iba.
  useEffect(() => { guardaReloj(clave, firma, est); }, [clave, firma, est]);

  usePantallaEncendida(est.fase === 'corriendo');

  const v = vista(est, plan, ahora, tope);

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
  const terminar = async () => {
    if (await pregunta({ titulo: '¿Terminar ahora?', detalle: 'Lo que llevas hasta aquí cuenta como tu resultado.', confirmar: 'Sí, terminar' })) {
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

  const { tramo, proximo } = v;
  const enCurso = v.fase === 'corriendo' || v.fase === 'pausa';
  const abierto = !!tramo && tramo.seg === null;
  const color = tramo?.tipo === 'descanso' ? LT.warning : LT.blue;

  let grande = '00:00';
  if (v.fase === 'fin') grande = relojTexto(v.totalSeg);
  else if (tramo) grande = relojTexto(abierto ? v.transcurridoSeg : v.restanteSeg);

  let rotulo = '';
  if (v.fase === 'fin') rotulo = 'Terminaste';
  else if (id === 'amrap') rotulo = 'Tiempo restante';
  else if (tramo) rotulo = etiquetaDeTramo(tramo);
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
                width: 38, height: 38, borderRadius: '50%', border: `1px solid ${LT.border}`, cursor: 'pointer', background: LT.surface,
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
                width: 38, height: 38, borderRadius: '50%', border: `1px solid ${LT.border}`, cursor: 'pointer', background: LT.surface,
                color: sonido ? LT.blue : LT.text3, display: 'grid', placeItems: 'center', flexShrink: 0,
              }}
            >
              {sonido ? <Volume2 size={19} /> : <VolumeX size={19} />}
            </button>
          </div>

          {/* ---------- El reloj ---------- */}
          <div style={{ textAlign: 'center', padding: '22px 0 8px' }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: v.fase === 'fin' ? LT.mint : color, minHeight: 24, letterSpacing: 0.2 }}>{rotulo}</div>
            <div
              aria-live="off" role="timer"
              style={{
                fontSize: grande.length > 5 ? 70 : 96, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2,
                color: v.fase === 'fin' ? LT.text : color, ...NUM_STYLE,
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
              display: 'flex', alignItems: 'center', gap: 12, border: `1.5px solid ${LT.border}`, borderRadius: 18, background: LT.surface,
              padding: '12px 14px', margin: '14px 0 4px',
            }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: LT.text3 }}>Rondas</div>
                <div style={{ fontSize: 34, fontWeight: 800, color: LT.text, lineHeight: 1.1, ...NUM_STYLE }}>{v.rondas}</div>
              </div>
              <button
                type="button" onClick={() => setEst((e) => sumaRonda(e, -1))} aria-label="Quitar una ronda" disabled={v.rondas === 0}
                style={{
                  width: 46, height: 46, borderRadius: '50%', border: `1.5px solid ${LT.borderHi}`, background: 'transparent', color: LT.text2,
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

          {/* ---------- Los ejercicios ---------- */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, margin: '16px 0 24px' }}>
            {ejercicios.map(({ ex }, i) => {
              const toca = quien === i;
              return (
                <div
                  key={i}
                  style={{
                    display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, padding: '10px 13px', borderRadius: 12,
                    background: toca ? LT.blueSoft : LT.surface, border: `1px solid ${toca ? LT.blue : LT.border}`,
                  }}
                >
                  <span style={{ fontSize: 15, fontWeight: toca ? 800 : 700, color: toca ? LT.blue : LT.text, overflowWrap: 'anywhere' }}>{ex.name}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: toca ? LT.blue : LT.text3, flexShrink: 0, ...NUM_STYLE }}>
                    {(lapsosDe(ex)?.length ?? 0) > 1 ? `${lapsosDe(ex).length} lapsos` : textoMeta(ex)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ---------- Los botones, fijos abajo ---------- */}
      {v.fase !== 'fin' && (
        <div style={{ flexShrink: 0, borderTop: `1px solid ${LT.border}`, background: LT.surface }}>
          <div style={{ maxWidth: 520, margin: '0 auto', padding: '12px 18px calc(12px + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {v.fase === 'listo' && <BotonGrande onClick={empieza}><Play size={22} fill="#fff" /> Iniciar</BotonGrande>}
            {v.fase === 'corriendo' && (abierto
              ? (
                <>
                  <BotonGrande onClick={hecho}><Check size={22} strokeWidth={3} /> {id === 'lapsos' ? 'Lapso listo' : 'Listo'}</BotonGrande>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <BotonChico onClick={pausar}><Pause size={17} /> Pausa</BotonChico>
                    <BotonChico onClick={terminar}>Terminar</BotonChico>
                  </div>
                </>
              )
              : (
                <>
                  <BotonGrande onClick={pausar} color={LT.text}><Pause size={22} fill="#fff" /> Pausa</BotonGrande>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <BotonChico onClick={terminar}>Terminar</BotonChico>
                  </div>
                </>
              ))}
            {v.fase === 'pausa' && (
              <>
                <BotonGrande onClick={empieza}><Play size={22} fill="#fff" /> Seguir</BotonGrande>
                <div style={{ display: 'flex', gap: 10 }}>
                  <BotonChico onClick={terminar}>Terminar</BotonChico>
                  <BotonChico onClick={reiniciar} peligro>Empezar de nuevo</BotonChico>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {v.fase === 'fin' && (
        <ResultadoDelBloque
          formato={formato} sugerido={sugeridoDe(est, plan)} resumen={resumen} textoDeCerrar="No guardar" cierraAlTocarFuera={false}
          onGuardar={(r) => { borraReloj(clave); onGuardar(r); onCerrar(); }}
          onCerrar={() => { borraReloj(clave); onCerrar(); }}
        />
      )}
    </div>
  );
}
