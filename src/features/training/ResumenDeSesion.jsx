import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, Loader2, MoreHorizontal, Share2, Trophy, Watch } from 'lucide-react';
import { LT, FONT, NUM_STYLE, KP } from '@/lib/theme';
import { relojDeCronometro } from '@/lib/entrenoLibre';
import { distanciaTexto, fechaLarga, horaTexto } from '@/lib/metricas/formato';
import { tramoDeLaSesion } from '@/lib/metricas/porSerie';
import { muestrasDeRuta } from '@/lib/recorrido';
import { desdeKilos, etiquetaUnidad } from '@/lib/unidades';
import { guiadoDe, rutaDe } from '@/lib/stickers/ficha';
import { cargaHistorial, cargaSesionHecha, coachDe } from '@/lib/stickers/carga';
import { useTipoDeSesion } from '@/features/stickers/useTipoDeSesion';
import { useProgramadoDeLaSesion } from '@/features/stickers/HojaDeSesion';
import AvisoDeStickers from '@/features/stickers/AvisoDeStickers';
import MapaDeCarrera from '@/features/libre/MapaDeCarrera';
import IconoDeActividad from '@/features/libre/IconoDeActividad';
import { PastillaPlan } from '@/features/libre/TusEntrenos';
import { botonGrande, tarjetaBlanca } from '@/features/libre/estilosLibre';
import { RelojEnEntreno } from '@/features/reloj/TarjetasDelReloj';
import { AVISO_RELOJ_TRAJO } from '@/lib/relojApple';
import { useReloj } from '@/lib/relojConectado';

const HojaDeSesion = lazy(() => import('@/features/stickers/HojaDeSesion'));

/* LA PÁGINA DE UN WORKOUT DEL PLAN (fase 6 de los stickers, 29 oct 2026; prototipo de caminos). La misma forma que la del entreno libre (`ResumenLibre`):
   arriba el nombre de la sesión con el ícono de su tipo y la fecha; los números (tiempo, series hechas contra programadas «12/16», ejercicios, volumen);
   el récord del plan si lo hubo («Justo lo programado: 4 × 5 con 100 kg»); la nota que dejó el atleta; y «Compartir» fijo abajo, que abre la misma hoja de
   stickers del día en el plan (`HojaDeSesion`). Si el reloj trajo ese entreno, también su pulso y su ruta.
   Nada de esto se guarda aparte: todo sale de la sesión (`wr:sessions`) y, si lo hubo, del entreno del reloj que se hizo a la vez.
   «···» lleva solo «Ver en mi plan» (al día en Entrenar): sin borrar ni renombrar, el plan no se toca.
   `recien`: viene de terminar el workout (sale «Tus stickers están listos»). `conStickers`: abre ya con la hoja encima (el ⇪ de una fila).
   `alVerEnElPlan`: lleva al día; sin él (la sesión ya no está en el plan), no hay «···». Va dentro de `ComoPrograma` de su programa (ver `PaginaDeSesionGlobal`). */

const Dato = ({ valor, etiqueta }) => (
  <div style={{ minWidth: 0 }}>
    <div style={{ fontSize: 26, fontWeight: 800, color: LT.text, letterSpacing: -0.5, lineHeight: 1.1, whiteSpace: 'nowrap', ...NUM_STYLE }}>{valor}</div>
    <div style={{ fontSize: 12.5, fontWeight: 600, color: LT.text2, marginTop: 3 }}>{etiqueta}</div>
  </div>
);

export default function ResumenDeSesion({ atletaId, registro, sesionId, nombre, dia = null, tipo = null, color = null, coachId = null, unidadPeso = 'kg', recien = false, conStickers = false, alCerrar, alVerEnElPlan = null }) {
  const tramo = useMemo(() => tramoDeLaSesion(registro), [registro]);
  const guiado = useMemo(() => guiadoDe(registro), [registro]);
  const { programadas = null, record = null } = useProgramadoDeLaSesion({ dia, registro, sesionId });
  const tipoDeSesion = useTipoDeSesion();
  const [verStickers, setVerStickers] = useState(conStickers);
  const [menu, setMenu] = useState(false);

  /* Lo que no viene con la sesión: el entreno del reloj que se hizo a la vez (pulso, ruta, calorías), el @usuario del coach y el historial del año (para el aviso
     de stickers). Se lee al abrir y otra vez cuando el reloj trae algo nuevo (al terminar con el Apple Watch, `SincronizaReloj` lo trae a los 8, 20 y 60 s). */
  const [cargado, setCargado] = useState(null); // { entreno, fila, series }
  const [vuelta, setVuelta] = useState(0);
  // Lo de la sesión se toma al abrir (como en la hoja de stickers): mientras la página está abierta no hay que volver a buscar con otros datos.
  const paraCargar = useRef({ atletaId, registro, sesionId, nombre, tipo, coachId, unidadPeso, programadas, record, tipoDeSesion });
  useEffect(() => {
    const d = paraCargar.current;
    let vivo = true;
    (async () => {
      const coach = await coachDe(d.coachId);
      const r = await cargaSesionHecha({ ...d, coach });
      if (!r || !vivo) return;
      const historial = await cargaHistorial({ atletaId: d.atletaId, inicioMs: r.entreno.inicioMs, tipoDeSesion: d.tipoDeSesion });
      if (vivo) setCargado({ ...r, entreno: { ...r.entreno, historial } });
    })().catch(() => {});
    return () => { vivo = false; };
  }, [vuelta]);
  useEffect(() => {
    const alTraer = (e) => { if (e.detail?.nuevos > 0 || e.detail?.enriquecidos?.length > 0) setVuelta((v) => v + 1); };
    window.addEventListener(AVISO_RELOJ_TRAJO, alTraer);
    return () => window.removeEventListener(AVISO_RELOJ_TRAJO, alTraer);
  }, []);

  const fila = cargado?.fila ?? null;
  const { conexion: relojConexion, aqui: relojAqui, trayendo } = useReloj();
  const pulsoDelReloj = fila?.fc_media > 0;
  const trayendoPulso = recien && trayendo && !!relojConexion && relojAqui && !pulsoDelReloj;
  const ruta = useMemo(() => {
    const m = muestrasDeRuta(cargado?.series?.ruta ?? registro?.ruta);
    return m.length >= 2 && rutaDe(m) ? m : null;
  }, [cargado, registro]);

  // Cuándo fue: la hora del reloj si lo hubo (es la que tiene su zona horaria); si no, la de la sesión en este teléfono.
  const inicio = fila?.inicio ?? (tramo ? new Date(tramo.inicio).toISOString() : null);
  const desfase = fila ? fila.desfase_min : (tramo ? -new Date(tramo.inicio).getTimezoneOffset() : null);
  const segundos = fila?.duracion_s ?? (tramo ? Math.round((tramo.fin - tramo.inicio) / 1000) : null);
  const datos = [
    segundos > 0 && { valor: relojDeCronometro(segundos), etiqueta: 'tiempo' },
    guiado?.series > 0 && { valor: programadas ? `${guiado.series}/${programadas}` : String(guiado.series), etiqueta: 'series' },
    guiado?.ejercicios > 0 && { valor: String(guiado.ejercicios), etiqueta: guiado.ejercicios === 1 ? 'ejercicio' : 'ejercicios' },
    // La unidad chica, como en el pulso: «2,000 kg» grande no cabe en una columna del teléfono.
    guiado?.volumen > 0 && { valor: <>{Math.round(desdeKilos(guiado.volumen, unidadPeso)).toLocaleString('es-MX')}<small style={{ fontSize: 14, fontWeight: 700, marginLeft: 3 }}>{etiquetaUnidad(unidadPeso)}</small></>, etiqueta: 'volumen' },
    fila?.distancia_m >= 100 && { valor: distanciaTexto(fila.distancia_m), etiqueta: 'distancia' },
  ].filter(Boolean);
  const nota = String(registro?.notes ?? '').trim();
  const opcion = { display: 'block', width: '100%', minHeight: 56, border: 'none', background: 'transparent', fontFamily: FONT, fontSize: 17, fontWeight: 600, color: LT.text, cursor: 'pointer' };

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={nombre} style={{ position: 'fixed', inset: 0, zIndex: 3200, background: LT.bg, fontFamily: FONT, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: 'calc(10px + env(safe-area-inset-top)) 12px 8px', maxWidth: 560, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        <button type="button" onClick={alCerrar} className="kp-press" style={{ display: 'inline-flex', alignItems: 'center', gap: 2, padding: '8px 12px 8px 6px', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: FONT, fontSize: 15.5, fontWeight: 800, color: LT.blue }}>
          <ChevronLeft size={20} /> Listo
        </button>
        {alVerEnElPlan && (
          <button type="button" onClick={() => setMenu(true)} aria-label="Más opciones" className="kp-press" style={{ width: 44, height: 44, borderRadius: 14, border: 'none', background: LT.surface, color: LT.text, display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
            <MoreHorizontal size={22} />
          </button>
        )}
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ maxWidth: 560, margin: '0 auto', padding: '0 16px calc(96px + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {ruta && (
            <div style={{ height: 220, borderRadius: 22, overflow: 'hidden', background: '#1A1F33' }}>
              <MapaDeCarrera muestras={ruta} sigue={false} alto="100%" redondo={false} />
            </div>
          )}
          <div style={{ ...tarjetaBlanca, padding: '18px 18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <IconoDeActividad actividad={{ nombre: tipo?.nombre ?? nombre, icono: tipo?.icono ?? 'pesa', color: color ?? KP.blue }} size={46} />
              <div style={{ minWidth: 0 }}>
                {inicio && <div style={{ fontSize: 13, fontWeight: 700, color: KP.blue, ...NUM_STYLE }}>{fechaLarga(inicio, desfase)} · {horaTexto(inicio, desfase)}</div>}
                <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.5, color: LT.text, marginTop: 2, overflowWrap: 'break-word' }}>{nombre}<PastillaPlan /></div>
              </div>
            </div>
            {record && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginTop: 14, padding: '7px 12px', borderRadius: 99, background: '#FFF4D6', color: '#8A5A00', fontSize: 14, fontWeight: 800 }}>
                <Trophy size={16} /> {record.texto}
              </div>
            )}
            {datos.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: 14, marginTop: 18 }}>
                {datos.map((d) => <Dato key={d.etiqueta} {...d} />)}
              </div>
            )}
          </div>
          {trayendoPulso && (
            <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#fff', borderRadius: 18, padding: '14px 16px', fontSize: 14.5, fontWeight: 600, color: LT.text2 }}>
              <Loader2 size={20} className="spin" color={KP.blue} />Trayendo tu pulso del reloj…
            </div>
          )}
          {pulsoDelReloj && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
                {[[fila.fc_media, 'lpm', 'Pulso medio', true], [fila.fc_max, 'lpm', 'Pulso máximo', true], [fila.kcal_activas ? Math.round(fila.kcal_activas) : null, 'kcal', 'Calorías', false]].map(([v, u, t, rojo]) => (
                  <div key={t} style={{ ...tarjetaBlanca, padding: '12px 12px 11px', borderRadius: 18, minWidth: 0 }}>
                    <b style={{ display: 'block', fontSize: 21, fontWeight: 800, letterSpacing: -0.3, lineHeight: 1.1, whiteSpace: 'nowrap', color: rojo ? '#E5364F' : LT.text, ...NUM_STYLE }}>
                      {v ? <>{v.toLocaleString('es-MX')}<small style={{ fontSize: 12, fontWeight: 700, marginLeft: 2 }}>{u}</small></> : '—'}
                    </b>
                    <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: LT.text2, marginTop: 3 }}>{t}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '10px 4px 0', fontSize: 12.5, fontWeight: 600, color: LT.text2 }}><Watch size={14} />Lo midió tu reloj</div>
            </div>
          )}
          {nota && (
            <div style={{ ...tarjetaBlanca, padding: '14px 16px' }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: LT.text2, marginBottom: 4 }}>Tu nota</div>
              <div style={{ fontSize: 15, lineHeight: 1.45, color: LT.text, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{nota}</div>
            </div>
          )}
          {recien && cargado?.entreno && <AvisoDeStickers entreno={cargado.entreno} alAbrir={() => setVerStickers(true)} />}
          {recien && !trayendoPulso && <RelojEnEntreno conPulso={pulsoDelReloj} />}
        </div>
      </div>
      {/* «Compartir» fijo abajo: el mismo de todas las páginas de un entreno. */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '12px 16px calc(10px + env(safe-area-inset-bottom))', background: LT.bg }}>
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          <button type="button" onClick={() => setVerStickers(true)} className="kp-press" style={botonGrande()}><Share2 size={20} /> Compartir</button>
        </div>
      </div>

      {menu && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 3260, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div onClick={() => setMenu(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.42)' }} />
          <div role="dialog" aria-label="Opciones del entreno" style={{ position: 'relative', display: 'grid', gap: 8, padding: '0 10px calc(10px + env(safe-area-inset-bottom))', maxWidth: 560, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
            <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden' }}>
              <button type="button" autoFocus onClick={() => { setMenu(false); alVerEnElPlan(); }} style={opcion}>Ver en mi plan</button>
            </div>
            <button type="button" onClick={() => setMenu(false)} style={{ ...opcion, background: '#fff', borderRadius: 16, fontWeight: 700 }}>Cancelar</button>
          </div>
        </div>
      )}
      {verStickers && (
        <Suspense fallback={null}>
          <HojaDeSesion
            atletaId={atletaId} registro={registro} sesionId={sesionId} nombre={nombre} dia={dia} tipo={tipo} coachId={coachId}
            unidadPeso={unidadPeso} capa={3300} onCerrar={() => setVerStickers(false)}
          />
        </Suspense>
      )}
    </div>,
    document.body,
  );
}
