import { useState, useMemo, useEffect } from 'react';
import { ChevronLeft, Play, Dumbbell, Timer, Minus, Plus, LineChart as LineChartIcon } from 'lucide-react';
import { LT, FONT, NUM_STYLE } from '@/lib/theme';
import { videosParaAtleta, portadaParaAtleta } from '@/lib/videos';
import { VideoRecortado } from '@/features/training/ExerciseMediaModal';
import { aKilos, desdeKilos, pesoTexto, etiquetaUnidad } from '@/lib/unidades';
import { isLoadedExercise, formatIntensity, findPreviousWeight } from '@/lib/training-utils';

/**
 * La pantalla de UN ejercicio, mientras se entrena.
 *
 * POR QUE ES PANTALLA COMPLETA Y NO UNA VENTANITA.
 * Antes esto era un cuadro flotante en medio de la pantalla, con márgenes por
 * los cuatro lados. Se veía como un aviso, no como el sitio donde estás. En el
 * gimnasio esta es LA pantalla: el atleta la tiene abierta entre series, mira
 * el video, anota el peso y sigue. Ocupar todo es lo correcto.
 *
 * EL NOMBRE VA SOBRE LA IMAGEN, no debajo. Así la foto llega hasta arriba sin
 * una franja de título encima, y el texto queda donde el ojo ya está mirando.
 *
 * LAS INSTRUCCIONES VAN EN TEXTO GRANDE, no en cajitas de colores. Son lo que
 * el coach quiere decirle: se leen de un vistazo con el teléfono en el suelo.
 *
 * Idea tomada de Avena, que Andrés puso como referencia.
 */
export default function FichaEjercicio({
  ex, exData, onUpdate, sessionsData, oneRMs, plan,
  repertoire, medias, perfil,
  serie, posicion, total,
  onCerrar, onSiguiente, onOmitir,
}) {
  const unidad = perfil?.unidad_peso || 'kg';
  const u = etiquetaUnidad(unidad);
  const [reproduciendo, setReproduciendo] = useState(false);
  const [angulo, setAngulo] = useState(0);

  const portada = portadaParaAtleta(repertoire, medias, perfil);
  const videos = videosParaAtleta(repertoire, medias, perfil);
  const video = videos[angulo] ?? videos[0] ?? null;

  // Al cambiar de ejercicio el reproductor vuelve a su estado inicial: si no,
  // el siguiente se abriría ya "reproduciendo" un video que no ha cargado.
  useEffect(() => { setReproduciendo(false); setAngulo(0); }, [ex?.name]);

  const conPeso = isLoadedExercise(ex);
  const intensidad = formatIntensity(ex.intensity);
  const descanso = (ex.descanso || '').trim() || null;

  const anterior = useMemo(
    () => (ex.name ? findPreviousWeight(plan, sessionsData, ex.name) : null),
    [plan, sessionsData, ex.name],
  );

  const recomendado = useMemo(() => {
    if (!ex.intensity) return null;
    const m = ex.intensity.match(/(\d+)%/);
    if (!m) return null;
    const pct = parseInt(m[1], 10);
    const n = (ex.name || '').toLowerCase();
    let key = null;
    if (n.includes('squat') && n.includes('front')) key = 'front_squat';
    else if (n.includes('squat')) key = 'back_squat';
    else if (n.includes('bench') && n.includes('incline')) key = 'incline_bench';
    else if (n.includes('bench')) key = 'bench_press';
    else if (n.includes('trap bar')) key = 'trap_bar_dl';
    else if (n.includes('deadlift') || n.includes('rdl') || n.includes('romanian')) key = 'deadlift';
    else if (n.includes('overhead') || (n.includes('press') && !n.includes('bench'))) key = 'overhead_press';
    else if (n.includes('row')) key = 'row';
    else if (n.includes('clean')) key = 'hang_clean';
    if (!key || !oneRMs?.[key]) return null;
    return Math.round(oneRMs[key] * pct / 100 * 2) / 2;
  }, [ex.intensity, ex.name, oneRMs]);

  /* El peso se guarda en kilos y se escribe en la unidad del atleta, así que
     el campo necesita su propio borrador. Sin él, cada tecla iría a kilos y
     volvería redondeada. */
  const pesoGuardado = pesoTexto(exData?.weight, unidad);
  const [pesoEscrito, setPesoEscrito] = useState(pesoGuardado);
  useEffect(() => {
    const a = pesoEscrito.trim() === '' ? null : parseFloat(pesoEscrito);
    const b = pesoGuardado === '' ? null : parseFloat(pesoGuardado);
    if (a !== b) setPesoEscrito(pesoGuardado);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pesoGuardado]);

  // Los discos suben de 2,5 en 2,5 kilos o de 5 en 5 libras.
  const paso = unidad === 'lb' ? 5 : 2.5;

  const mueve = (dir) => {
    const actual = pesoEscrito.trim() === '' ? 0 : parseFloat(pesoEscrito) || 0;
    const nuevo = Math.max(0, Math.round((actual + dir * paso) * 100) / 100);
    escribePeso(String(nuevo));
  };
  const escribePeso = (v) => {
    setPesoEscrito(v);
    onUpdate({ ...exData, weight: v === '' ? '' : String(aKilos(v, unidad)) });
  };

  const esUltimo = posicion >= total;
  const meta = [ex.reps && `${ex.reps} reps`, intensidad].filter(Boolean).join(' · ');

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
      {/* ---------- Media, con el nombre encima ---------- */}
      <div style={{
        position: 'relative', flexShrink: 0, background: '#0E1015',
        // Sin foto ni video esta zona no enseña nada: se le da lo justo para
        // que el nombre respire. 80 de 81 ejercicios están así hoy, y reservar
        // media pantalla para un hueco negro es el mismo error que tenía la
        // lista del repertorio.
        height: reproduciendo ? 'auto' : (portada || video ? 'min(46vh, 330px)' : 190),
      }}>
        {reproduciendo && video ? (
          <VideoRecortado
            video={video}
            estilo={{ width: '100%', maxHeight: '55vh', display: 'block', background: '#000' }}
          />
        ) : (
          <>
            {portada ? (
              <img src={portada} alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center' }}>
                <Dumbbell size={54} color="#2A3040" />
              </div>
            )}

            {/* Play grande y centrado, como el de Avena. Solo si hay video. */}
            {video && (
              <button
                type="button"
                onClick={() => setReproduciendo(true)}
                aria-label={`Ver el video de ${ex.name}`}
                style={{
                  position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
                  border: 'none', background: 'transparent', cursor: 'pointer', padding: 0,
                }}
              >
                <span style={{
                  width: 74, height: 74, borderRadius: '50%', display: 'grid', placeItems: 'center',
                  background: 'rgba(255,255,255,0.22)', backdropFilter: 'blur(3px)',
                  border: '2px solid rgba(255,255,255,0.55)',
                }}>
                  <Play size={30} color="#fff" fill="#fff" style={{ marginLeft: 4 }} />
                </span>
              </button>
            )}

            {/* Sombra para que el texto blanco se lea sobre cualquier foto. */}
            <div style={{
              position: 'absolute', left: 0, right: 0, bottom: 0, height: '62%',
              background: 'linear-gradient(to top, rgba(8,10,14,.92), rgba(8,10,14,0))',
              pointerEvents: 'none',
            }} />

            <div style={{ position: 'absolute', left: 18, right: 18, bottom: 16 }}>
              <div style={{
                fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,.72)', marginBottom: 5,
                ...NUM_STYLE,
              }}>
                Serie {serie} · Ejercicio {posicion} de {total}
              </div>
              <div style={{
                fontSize: 25, fontWeight: 800, color: '#fff', lineHeight: 1.15,
                letterSpacing: -0.4, textWrap: 'balance',
              }}>
                {ex.name}
              </div>
              {meta && (
                <span style={{
                  display: 'inline-block', marginTop: 10, padding: '6px 13px', borderRadius: 999,
                  background: 'rgba(255,255,255,.17)', color: '#fff',
                  fontSize: 13, fontWeight: 700, backdropFilter: 'blur(3px)', ...NUM_STYLE,
                }}>
                  Meta: {meta}
                </span>
              )}
            </div>
          </>
        )}

        <button
          type="button" onClick={onCerrar} aria-label="Volver"
          style={{
            position: 'absolute', top: 'calc(12px + env(safe-area-inset-top))', left: 12,
            width: 38, height: 38, borderRadius: '50%', border: 'none', cursor: 'pointer',
            background: 'rgba(8,10,14,0.5)', color: '#fff', display: 'grid', placeItems: 'center',
            backdropFilter: 'blur(6px)',
          }}
        >
          <ChevronLeft size={22} />
        </button>
      </div>

      {/* ---------- Lo que hay que hacer ---------- */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 18px 24px' }}>
        {videos.length > 1 && (
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 16 }}>
            {videos.map((v, i) => (
              <button
                key={v.id} type="button"
                onClick={() => { setAngulo(i); setReproduciendo(true); }}
                style={{
                  padding: '7px 14px', borderRadius: 999, cursor: 'pointer', fontFamily: FONT,
                  border: `1.5px solid ${i === angulo ? LT.blue : LT.border}`,
                  background: i === angulo ? LT.blueSoft : LT.surface,
                  color: i === angulo ? LT.blue : LT.text2,
                  fontSize: 12.5, fontWeight: 700,
                }}
              >
                {v.etiqueta}
              </button>
            ))}
          </div>
        )}

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

        {conPeso && (
          <>
            <div style={{
              fontSize: 13.5, color: LT.text3, fontWeight: 600, margin: '18px 0 10px',
            }}>
              Registra lo que hiciste
            </div>

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
                  {anterior
                    ? `La vez pasada: ${desdeKilos(anterior.weight, unidad)}`
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

            {recomendado !== null && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 7, marginTop: 11,
                fontSize: 13.5, color: LT.text3, fontWeight: 600, ...NUM_STYLE,
              }}>
                <LineChartIcon size={14} style={{ flexShrink: 0 }} />
                Según tu 1RM te tocaría ≈ {desdeKilos(recomendado, unidad)} {u}
              </div>
            )}
          </>
        )}
      </div>

      {/* ---------- Seguir ---------- */}
      <div style={{
        flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 18px calc(12px + env(safe-area-inset-bottom))',
        borderTop: `1px solid ${LT.border}`, background: LT.surface,
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
          onClick={esUltimo ? onCerrar : onSiguiente}
          style={{
            flex: 1, minHeight: 52, borderRadius: 15, border: 'none', cursor: 'pointer',
            background: LT.blue, color: '#fff', fontFamily: FONT,
            fontSize: 16, fontWeight: 800,
          }}
        >
          {esUltimo ? 'Listo' : 'Guardar y siguiente'}
        </button>
      </div>
    </div>
  );
}
