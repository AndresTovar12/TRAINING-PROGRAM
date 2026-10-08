import { useState, useMemo, useEffect } from 'react';
import { Check, ChevronLeft, Timer, Minus, Plus, LineChart as LineChartIcon } from 'lucide-react';
import { LT, FONT, NUM_STYLE } from '@/lib/theme';
import { videosParaAtleta, portadaParaAtleta } from '@/lib/videos';
import TarjetaDeVideo from '@/features/training/TarjetaDeVideo';
import { aKilos, desdeKilos, pesoTexto, etiquetaUnidad } from '@/lib/unidades';
import { isLoadedExercise, formatIntensity, findPreviousWeight } from '@/lib/training-utils';
/* `unidad` de este archivo es la del PESO (kg o lb). La de la cantidad se
   importa con otro nombre para no pisarla. */
import {
  textoMeta, leeCantidad, leeCarga, esTiempo, metaEnSegundos, cargaEnSuUnidad,
  medida as infoMedida,
} from '@/lib/medidas';
import { vueltasDe, ejercicioDeVuelta, anotadoEnVuelta, conVueltaAnotada } from '@/lib/porVuelta';
import { lapsosDe, comoEjercicio } from '@/lib/lapsos';
import Cronometro from '@/components/Cronometro';
import { cargaPorPorcentaje } from '@/lib/cargaPorcentaje';
import { useUnRM } from '@/lib/unRM';
import { usePalabras } from '@/contexts/PalabrasContext';

/**
 * La pantalla de UN ejercicio, mientras se entrena.
 *
 * POR QUE ES PANTALLA COMPLETA Y NO UNA VENTANITA.
 * Antes esto era un cuadro flotante en medio de la pantalla, con márgenes por
 * los cuatro lados. Se veía como un aviso, no como el sitio donde estás. En el
 * gimnasio esta es LA pantalla: el atleta la tiene abierta entre series, mira
 * el video, anota el peso y sigue. Ocupar todo es lo correcto.
 *
 * EL NOMBRE VA ARRIBA DEL VIDEO, y el video en una tarjeta redondeada (ver
 * `TarjetaDeVideo`). Antes el nombre iba SOBRE una foto a todo el ancho y al
 * darle play todo saltaba a una caja negra: Andrés, 1 oct 2026, dijo que se veía
 * «como una página barata hecha sin esfuerzo» y enseñó una app que ya existe.
 *
 * LAS INSTRUCCIONES VAN EN TEXTO GRANDE, no en cajitas de colores. Son lo que
 * el coach quiere decirle: se leen de un vistazo con el teléfono en el suelo.
 *
 * Idea tomada de Avena, que Andrés puso como referencia.
 */
export default function FichaEjercicio({
  ex, exData, onUpdate, sessionsData, sessionKey, kind, oneRMs, plan,
  repertoire, medias, perfil,
  serie, posicion, total,
  onCerrar, onSiguiente, onOmitir,
}) {
  const unidad = perfil?.unidad_peso || 'kg';
  const u = etiquetaUnidad(unidad);

  const portada = portadaParaAtleta(repertoire, medias, perfil);
  const videos = videosParaAtleta(repertoire, medias, perfil);
  const hayMedia = !!portada || videos.length > 0;

  /* CUANDO EL EJERCICIO CAMBIA DE UNA VUELTA A OTRA (10 al 60 %, 8 al 70 %…), cada vuelta se anota por
     separado: la meta y las casillas de abajo son las de la vuelta elegida arriba. Al abrir cae en la primera
     que falta por anotar. Lo que no cambia —el nombre, el video, las notas, el descanso— es del ejercicio. */
  const vueltas = vueltasDe(ex);
  const [vuelta, setVuelta] = useState(() => {
    if (!vueltas) return 0;
    const falta = vueltas.findIndex((_, i) => { const v = anotadoEnVuelta(exData, i); return !v.weight && !v.repsHechas; });
    return falta < 0 ? 0 : falta;
  });
  const iv = vueltas ? Math.min(vuelta, vueltas.length - 1) : 0;
  // El ejercicio tal como es en la vuelta que se está anotando (el mismo, si todas son iguales).
  const exV = vueltas ? ejercicioDeVuelta(ex, vueltas[iv]) : ex;
  const datos = vueltas ? anotadoEnVuelta(exData, iv) : (exData ?? {});
  const guarda = (d) => onUpdate(vueltas ? conVueltaAnotada(exData, iv, d) : d);

  const conPeso = isLoadedExercise(ex);
  const intensidad = cargaEnSuUnidad(exV, unidad) ?? formatIntensity(exV.intensity);
  /* LOS LAPSOS: con varios, la ficha los enseña en orden —cuánto, carga y descanso de cada uno— en lugar de una sola meta.
     Cada lapso trae su propio descanso, así que tampoco dice «Descansa X entre cada serie». */
  const lapsosDeLaFicha = lapsosDe(ex);
  const lapsos = lapsosDeLaFicha && lapsosDeLaFicha.length > 1 ? lapsosDeLaFicha : null;
  const descanso = lapsos ? null : ((ex.descanso || '').trim() || null);

  const anterior = useMemo(
    // El de la vez pasada, no el que se acaba de anotar en esta sesión.
    () => (ex.name ? findPreviousWeight(plan, sessionsData, ex.name, { kind, actual: sessionKey }) : null),
    [plan, sessionsData, ex.name, kind, sessionKey],
  );

  /* Los kilos que son el «75%» del plan, de SU 1RM y de ESE levantamiento (ver `lib/cargaPorcentaje.js`).
     Los pacientes de un fisio no tienen 1RM. */
  const { salud } = usePalabras();
  const { ponRM } = useUnRM();
  const carga = salud ? null : cargaPorPorcentaje(exV, oneRMs, unidad);
  // El peso de la vez pasada: el de ESTA vuelta si entonces también se anotó por vueltas; si no, el del ejercicio.
  const pesoPasado = (vueltas && anterior?.vueltas?.[iv]?.weight) || anterior?.weight || null;

  /* El peso se guarda en kilos y se escribe en la unidad del atleta, así que
     el campo necesita su propio borrador. Sin él, cada tecla iría a kilos y
     volvería redondeada. */
  const pesoGuardado = pesoTexto(datos.weight, unidad);
  const [pesoEscrito, setPesoEscrito] = useState(pesoGuardado);
  useEffect(() => {
    const a = pesoEscrito.trim() === '' ? null : parseFloat(pesoEscrito);
    const b = pesoGuardado === '' ? null : parseFloat(pesoGuardado);
    if (a !== b) setPesoEscrito(pesoGuardado);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pesoGuardado]);

  // Los discos suben de 2,5 en 2,5 kilos o de 5 en 5 libras.
  const paso = unidad === 'lb' ? 5 : 2.5;

  /* BAJAR DESDE VACÍO NO ANOTA NADA, Y BAJAR DESDE CERO BORRA.
     Andrés, 18 sep 2026: "le puse 0 reps porque le moví a las flechitas y no
     supe qué hacer y se guardó 0 reps". Antes el `−` sobre un campo vacío
     escribía un 0 —por el `Math.max(0, …)`— y desde ahí no había salida: 0
     menos uno volvía a ser 0. Ahora el mismo gesto que lo creó lo deshace. */
  const mueve = (dir) => {
    const vacio = pesoEscrito.trim() === '';
    const actual = vacio ? 0 : parseFloat(pesoEscrito) || 0;
    if (dir < 0 && (vacio || actual <= 0)) { escribePeso(''); return; }
    // Desde vacío, el «+» empieza en lo que pide el plan: llegar a 105 kg de 2,5 en 2,5 son 42 toques.
    if (vacio && dir > 0 && pesoDeLaMeta) { escribePeso(String(pesoDeLaMeta)); return; }
    escribePeso(String(Math.round((actual + dir * paso) * 100) / 100));
  };
  /* Cuánto sube y baja la flecha, según lo que se mida. Subir de uno en uno
     hasta 800 metros no lo hace nadie: son 800 toques. Los pasos son los que
     se usan al hablar — los metros de diez en diez, los segundos de cinco en
     cinco, los kilómetros de medio en medio. */
  const PASO_CANTIDAD = { reps: 1, seg: 5, min: 1, m: 10, km: 0.5, yd: 5, cal: 1 };
  const medida = leeCantidad(exV);
  const pasoCantidad = PASO_CANTIDAD[medida.unidad] ?? 1;
  const enTiempo = !medida.libre && esTiempo(medida.unidad);

  /* LO QUE PIDE EL PLAN, para que el «+» arranque ahí en vez de en cero. De un rango («8-10») vale el
     primero. El peso sale del porcentaje de su 1RM o de un peso fijo («20 kg»), ya en su unidad. */
  const cantidadDeLaMeta = (() => {
    const n = medida.libre ? NaN : parseFloat(String(medida.cantidad).replace(',', '.'));
    return Number.isFinite(n) && n > 0 ? n : null;
  })();
  const pesoDeLaMeta = (() => {
    if (carga && !carga.falta) return carga.desde;
    const fijo = leeCarga(exV);
    const kilos = fijo.tipo === 'kg' ? parseFloat(fijo.cantidad.replace(',', '.')) : NaN;
    if (!Number.isFinite(kilos) || kilos <= 0) return null;
    return unidad === 'lb' ? Math.round(desdeKilos(kilos, 'lb') / paso) * paso : kilos;
  })();

  const mueveReps = (dir) => {
    const actual = parseFloat(datos.repsHechas);
    const hay = Number.isFinite(actual);
    if (dir < 0 && (!hay || actual <= 0)) { guarda({ ...datos, repsHechas: '' }); return; }
    if (!hay && dir > 0 && cantidadDeLaMeta) { guarda({ ...datos, repsHechas: String(cantidadDeLaMeta) }); return; }
    const nuevo = (hay ? actual : 0) + dir * pasoCantidad;
    // Redondeo a dos decimales: 0.5 + 0.5 en coma flotante da 1.0000000000001.
    guarda({ ...datos, repsHechas: String(Math.round(Math.max(0, nuevo) * 100) / 100) });
  };

  const escribePeso = (v) => {
    setPesoEscrito(v);
    guarda({ ...datos, weight: v === '' ? '' : String(aKilos(v, unidad)) });
  };

  const esUltimo = posicion >= total;
  // "Meta: 30 yd", no "Meta: 30 yd reps": lo dice la unidad del ejercicio.
  const meta = [textoMeta(exV), intensidad].filter(Boolean).join(' · ');
  // En un Set de un solo ejercicio, el botón grande lleva de una vuelta a la siguiente. Con varios
  // ejercicios (bi-serie) sigue pasando al siguiente ejercicio, que cae en la misma vuelta.
  const quedanVueltas = !!vueltas && total === 1 && iv < vueltas.length - 1;

  const circulo = (relleno) => ({
    width: 46, height: 46, borderRadius: '50%', flexShrink: 0, cursor: 'pointer',
    display: 'grid', placeItems: 'center', fontFamily: FONT,
    border: relleno ? 'none' : `1.5px solid ${LT.borderHi}`,
    background: relleno ? LT.blue : 'transparent',
    color: relleno ? '#fff' : LT.text2,
  });

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 3000, background: LT.bg,
      display: 'flex', flexDirection: 'column', fontFamily: FONT,
    }}>
      {/* Lo de arriba —cabecera, nombre y video— y lo de abajo —lo que hay que
          hacer— corren en UNA sola columna que se desplaza, con «Seguir» fijo al
          pie. En una pantalla chica el video se va por arriba al bajar a anotar;
          en una normal cabe todo sin tocar. En la compu la columna no pasa de
          520 px de ancho. */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ maxWidth: 520, margin: '0 auto' }}>
          {/* ---------- Cabecera, nombre y video ---------- */}
          <div style={{
            position: 'sticky', top: 0, zIndex: 5, background: LT.bg,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: 'calc(10px + env(safe-area-inset-top)) 18px 6px',
          }}>
            <button
              type="button" onClick={onCerrar} aria-label="Volver"
              style={{
                width: 38, height: 38, borderRadius: '50%', border: `1px solid ${LT.border}`, cursor: 'pointer',
                background: LT.surface, color: LT.text, display: 'grid', placeItems: 'center',
              }}
            >
              <ChevronLeft size={22} />
            </button>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: LT.text2, ...NUM_STYLE }}>
              {/* «Ejercicio 1 de 1» no dice nada: solo se cuenta cuando hay más de uno. */}
              Serie {serie}{total > 1 ? ` · Ejercicio ${posicion} de ${total}` : ''}
            </span>
          </div>

          <div style={{ padding: '6px 18px 0' }}>
            <div style={{
              fontSize: 25, fontWeight: 800, color: LT.text, lineHeight: 1.15,
              letterSpacing: -0.4, textWrap: 'balance',
            }}>
              {ex.name}
            </div>
            {lapsos ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6, marginTop: 10 }}>
                {lapsos.map((l, j) => {
                  const deEste = comoEjercicio(ex, l);
                  const queHacer = [textoMeta(deEste), cargaEnSuUnidad(deEste, unidad) ?? formatIntensity(deEste.intensity), l.descanso ? `descanso ${l.descanso}` : null]
                    .filter(Boolean).join(' · ');
                  return (
                    <span key={j} style={{
                      display: 'inline-flex', alignItems: 'baseline', gap: 9, padding: '6px 13px', borderRadius: 999,
                      background: LT.blueSoft, color: LT.blue, fontSize: 13, fontWeight: 700, ...NUM_STYLE,
                    }}>
                      <span style={{ width: 12, textAlign: 'center', fontSize: 11.5, fontWeight: 800, opacity: 0.75 }}>{j + 1}</span>
                      {queHacer || '—'}
                    </span>
                  );
                })}
              </div>
            ) : meta && (
              <span style={{
                display: 'inline-block', marginTop: 10, padding: '6px 13px', borderRadius: 999,
                background: LT.blueSoft, color: LT.blue, fontSize: 13, fontWeight: 700, ...NUM_STYLE,
              }}>
                {vueltas ? `Vuelta ${iv + 1}` : 'Meta'}: {meta}
              </span>
            )}
          </div>

          {/* Sin foto ni video no hay tarjeta: reservar un hueco oscuro que no enseña
              nada es el mismo error que tenía la lista del repertorio (80 de 81
              ejercicios están así hoy). Con `key` del ejercicio, al pasar al
              siguiente todo vuelve a su estado inicial. */}
          {hayMedia && (
            <div style={{ padding: '0 18px' }}>
              <TarjetaDeVideo key={ex.name} videos={videos} portada={portada} nombre={ex.name} />
            </div>
          )}

          {/* ---------- Lo que hay que hacer ---------- */}
          <div style={{ padding: '20px 18px 24px' }}>
        {/* Aquí vivía una fila de pastillas con los ángulos. Ya no hace falta:
            los videos se deslizan arriba y los puntos dicen cuántos hay. */}

        {/* Cada línea aparece solo si el coach la escribió. Un hueco vacío se
            lee como un fallo de la app, no como "no hay nada que decir". */}
        {ex.notes && (
          <p style={{
            fontSize: 17, color: LT.text, lineHeight: 1.5, margin: '0 0 14px', fontWeight: 500,
          }}>
            {ex.notes}
          </p>
        )}

        {ex.cue && (
          <p style={{
            fontSize: 17, color: LT.text, lineHeight: 1.5, margin: '0 0 14px', fontWeight: 500,
          }}>
            {ex.cue}
          </p>
        )}

        {descanso && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14,
            fontSize: 16, color: LT.text2, fontWeight: 600,
          }}>
            <Timer size={18} color={LT.text3} style={{ flexShrink: 0 }} />
            Descansa {descanso} entre cada serie
          </div>
        )}

        {/* Antes este bloque entero dependía de `conPeso`: en un ejercicio de
            peso corporal la ficha se quedaba con el video y NADA debajo, y el
            atleta no tenía dónde decir cuántas hizo. Ahora las reps se anotan
            siempre y el peso solo cuando lleva carga. */}
        <div style={{
          fontSize: 13.5, color: LT.text3, fontWeight: 600, margin: '18px 0 10px',
        }}>
          {vueltas ? 'Registra cada vuelta' : 'Registra lo que hiciste'}
        </div>

        {vueltas && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 12 }}>
            {vueltas.map((_, j) => {
              const anotada = anotadoEnVuelta(exData, j);
              const hecha = !!(anotada.weight || anotada.repsHechas);
              const elegida = j === iv;
              return (
                <button
                  key={j} type="button" onClick={() => setVuelta(j)} aria-pressed={elegida}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5, minHeight: 38, padding: '0 14px', borderRadius: 999,
                    cursor: 'pointer', fontFamily: FONT, fontSize: 14, fontWeight: 800, touchAction: 'manipulation', ...NUM_STYLE,
                    border: `1.5px solid ${elegida ? LT.blue : LT.borderHi}`,
                    background: elegida ? LT.blue : LT.surface, color: elegida ? '#fff' : LT.text2,
                  }}
                >
                  Vuelta {j + 1}{hecha && <Check size={14} strokeWidth={3} />}
                </button>
              );
            })}
          </div>
        )}

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          border: `1.5px solid ${LT.border}`, borderRadius: 18, padding: '16px 16px',
          background: LT.surface, marginBottom: conPeso ? 10 : 0,
        }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 16.5, fontWeight: 800, color: LT.text }}>
              {medida.libre ? 'Reps' : infoMedida(medida.unidad).rotulo}{' '}
              <span style={{ color: LT.text3, fontWeight: 600 }}>
                {enTiempo ? 'que aguantaste' : 'que hiciste'}
              </span>
            </div>
            <div style={{ fontSize: 13, color: LT.text3, fontWeight: 600, marginTop: 3 }}>
              {textoMeta(exV) && !lapsos ? `Meta: ${textoMeta(exV)}` : 'Lo que te haya salido'}
            </div>
          </div>

          {/* En tiempo, el cronómetro. En todo lo demás, las flechas — con el
              paso de cada unidad, no de uno en uno. */}
          {enTiempo ? (
            <Cronometro
              // Con `key`, al cambiar de vuelta el reloj arranca parado y con lo de esa vuelta.
              key={iv}
              valor={datos.repsHechas ?? ''}
              unidad={medida.unidad}
              metaSeg={metaEnSegundos(exV)}
              onCambio={(v) => guarda({ ...datos, repsHechas: v })}
              circulo={circulo}
              LT={LT}
              NUM_STYLE={NUM_STYLE}
            />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
              <button type="button" onClick={() => mueveReps(-1)} aria-label="Bajar" style={circulo(false)}>
                <Minus size={20} strokeWidth={3} />
              </button>
              <input
                type="number" inputMode="decimal" value={datos.repsHechas ?? ''} placeholder="—"
                onChange={(e) => guarda({ ...datos, repsHechas: e.target.value })}
                style={{
                  width: 58, border: 'none', background: 'transparent', textAlign: 'center',
                  fontSize: 27, fontWeight: 800, outline: 'none', fontFamily: FONT, padding: 0,
                  color: datos.repsHechas ? LT.text : LT.text3, ...NUM_STYLE,
                }}
              />
              <button type="button" onClick={() => mueveReps(1)} aria-label="Subir" style={circulo(true)}>
                <Plus size={20} strokeWidth={3} />
              </button>
            </div>
          )}
        </div>

        {conPeso && (
          <>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
              border: `1.5px solid ${LT.border}`, borderRadius: 18, padding: '16px 16px',
              background: LT.surface,
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 16.5, fontWeight: 800, color: LT.text }}>
                  Peso <span style={{ color: LT.text3, fontWeight: 600 }}>{u}</span>
                </div>
                <div style={{ fontSize: 13, color: LT.text3, fontWeight: 600, marginTop: 3 }}>
                  {pesoPasado
                    ? `La vez pasada: ${desdeKilos(pesoPasado, unidad)}`
                    : 'Primera vez que lo registras'}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
                <button type="button" onClick={() => mueve(-1)} aria-label="Bajar el peso" style={circulo(false)}>
                  <Minus size={20} strokeWidth={3} />
                </button>
                <input
                  type="number" inputMode="decimal" value={pesoEscrito} placeholder="—"
                  onChange={(e) => escribePeso(e.target.value)}
                  style={{
                    width: 58, border: 'none', background: 'transparent', textAlign: 'center',
                    fontSize: 27, fontWeight: 800, outline: 'none', fontFamily: FONT, padding: 0,
                    color: pesoEscrito ? LT.text : LT.text3, ...NUM_STYLE,
                  }}
                />
                <button type="button" onClick={() => mueve(1)} aria-label="Subir el peso" style={circulo(true)}>
                  <Plus size={20} strokeWidth={3} />
                </button>
              </div>
            </div>

            {carga && !carga.falta && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 7, marginTop: 11,
                fontSize: 13.5, color: LT.text3, fontWeight: 600, ...NUM_STYLE,
              }}>
                <LineChartIcon size={14} style={{ flexShrink: 0 }} />
                <span>
                  {textoDePorcentaje(carga.porcentaje)} de tu 1RM de {carga.lift.nombre}:{' '}
                  <b style={{ color: LT.blue }}>{carga.texto}</b>
                </span>
              </div>
            )}
            {carga?.falta && (
              <PedirUnRM
                carga={carga} unidad={unidad}
                onGuardar={(kilos) => ponRM(carga.lift.key, kilos)}
              />
            )}
          </>
        )}
          </div>
        </div>
      </div>

      {/* ---------- Seguir ---------- */}
      <div style={{ flexShrink: 0, borderTop: `1px solid ${LT.border}`, background: LT.surface }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, maxWidth: 520, margin: '0 auto',
          padding: '12px 18px calc(12px + env(safe-area-inset-bottom))',
        }}>
        <button
          type="button"
          onClick={esUltimo ? onCerrar : onOmitir}
          style={{
            border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: FONT,
            fontSize: 15, fontWeight: 700, color: LT.text2, padding: '12px 6px', flexShrink: 0,
          }}
        >
          {esUltimo ? 'Cerrar' : 'Omitir'}
        </button>
        <button
          type="button"
          onClick={quedanVueltas ? () => setVuelta(iv + 1) : esUltimo ? onCerrar : onSiguiente}
          style={{
            flex: 1, minHeight: 52, borderRadius: 15, border: 'none', cursor: 'pointer',
            background: LT.blue, color: '#fff', fontFamily: FONT,
            fontSize: 16, fontWeight: 800,
          }}
        >
          {quedanVueltas ? 'Siguiente vuelta' : esUltimo ? 'Listo' : 'Guardar y siguiente'}
        </button>
        </div>
      </div>
    </div>
  );
}

const textoDePorcentaje = (p) => (p.min === p.max ? `${p.min}%` : `${p.min}-${p.max}%`);

/**
 * El plan pide un porcentaje de un levantamiento de la pestaña 1RM y todavía no hay 1RM guardado:
 * se anota aquí mismo, una vez, y desde entonces salen los kilos en toda la app. Se guarda en
 * `wr:onerm`, el mismo sitio que la pestaña 1RM, y siempre en kilos.
 */
function PedirUnRM({ carga, unidad, onGuardar }) {
  const [valor, setValor] = useState('');
  const n = parseFloat(valor.replace(',', '.'));
  const valido = Number.isFinite(n) && n > 0;
  return (
    <div style={{ marginTop: 11, border: `1.5px solid ${LT.border}`, borderRadius: 16, background: LT.surface, padding: '12px 14px' }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: LT.text, lineHeight: 1.4 }}>
        Pide {textoDePorcentaje(carga.porcentaje)} de tu 1RM de {carga.lift.nombre}. Anótalo una vez y aquí verás cuántos {unidad === 'lb' ? 'libras' : 'kilos'} son.
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <input
          value={valor} inputMode="decimal" placeholder={`Tu 1RM (${etiquetaUnidad(unidad)})`} aria-label={`Tu 1RM de ${carga.lift.nombre}`}
          onChange={(e) => setValor(e.target.value)}
          style={{
            flex: 1, minWidth: 0, border: `1.5px solid ${LT.border}`, borderRadius: 12, padding: '10px 12px', fontFamily: FONT,
            fontSize: 16, fontWeight: 700, color: LT.text, outline: 'none', background: LT.bg, ...NUM_STYLE,
          }}
        />
        <button
          type="button" disabled={!valido} onClick={() => onGuardar(aKilos(n, unidad))}
          style={{
            minHeight: 44, padding: '0 18px', borderRadius: 12, border: 'none', cursor: valido ? 'pointer' : 'default',
            background: LT.blue, color: '#fff', fontFamily: FONT, fontSize: 15, fontWeight: 800, opacity: valido ? 1 : 0.4,
            touchAction: 'manipulation',
          }}
        >
          Guardar
        </button>
      </div>
    </div>
  );
}
