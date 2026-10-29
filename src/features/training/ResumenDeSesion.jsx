import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { LT, KP } from '@/lib/theme';
import { useStorage } from '@/contexts/AppStateContext';
import { tramoDeLaSesion } from '@/lib/metricas/porSerie';
import { muestrasDeRuta } from '@/lib/recorrido';
import { desdeKilos, etiquetaUnidad } from '@/lib/unidades';
import { guiadoDe, rutaDe } from '@/lib/stickers/ficha';
import { cargaHistorial, cargaSesionHecha, quienProgramo } from '@/lib/stickers/carga';
import { cuandoFue, ejerciciosDeLaSesion, filaDelRecordDelPlan, miles, numerosDeSesion, zonasSimples } from '@/lib/paginaDelEntreno';
import { useTipoDeSesion } from '@/features/stickers/useTipoDeSesion';
import { useProgramadoDeLaSesion } from '@/features/stickers/HojaDeSesion';
import AvisoDeStickers from '@/features/stickers/AvisoDeStickers';
import PaginaDelEntreno, { LoQueHiciste, TuNota, TuPulso } from '@/features/libre/PaginaDelEntreno';
import { RelojEnEntreno } from '@/features/reloj/TarjetasDelReloj';
import { AVISO_RELOJ_TRAJO } from '@/lib/relojApple';
import { useReloj } from '@/lib/relojConectado';

/** «100 kg», «47.5 kg», «220 lb»: un peso en su unidad, con un decimal solo si lo tiene. */
const pesoTexto = (kg, unidadPeso) => {
  const v = Math.round(desdeKilos(kg, unidadPeso) * 10) / 10;
  return `${Number.isInteger(v) ? miles(v) : v.toFixed(1)} ${etiquetaUnidad(unidadPeso)}`;
};

const HojaDeSesion = lazy(() => import('@/features/stickers/HojaDeSesion'));

/* LA PÁGINA DE UN WORKOUT DEL PLAN (fase 6 de los stickers, 29 oct 2026; fase 7: la misma forma que la de un entreno libre, `PaginaDelEntreno`).
   Arriba la franja del color del tipo (o el mapa, si el reloj trajo una ruta); la tarjeta con «Hoy, 8:55 a. m. · de @coach», el nombre de la sesión, las series
   hechas contra las programadas en grande («16 de 16»), la frase («Todas las series que programó Andrés») y Tiempo y Volumen (con reloj, Pulso medio).
   El récord del plan en su fila («Récord en Back Squat: 100 kg × 5 · Justo lo programado…»). Luego «Lo que hiciste» (cada ejercicio, lo programado y «4/4»),
   «Tu nota» (se escribe aquí y se guarda en la sesión, como antes al final del entreno) y «Tu pulso» si lo midió el reloj.
   Nada de esto se guarda aparte: todo sale de la sesión (`wr:sessions`) y, si lo hubo, del entreno del reloj que se hizo a la vez.
   «···» lleva solo «Ver en mi plan» (al día en Entrenar): sin borrar ni renombrar, el plan no se toca.
   `almacen`: dónde vive la sesión (para guardar la nota). `recien`: viene de terminar el workout (sale «Tus stickers están listos»). `conStickers`: abre ya con
   la hoja encima (el ⇪ de una fila). `alVerEnElPlan`: lleva al día; sin él (la sesión ya no está en el plan), no hay «···».
   Va dentro de `ComoPrograma` de su programa (ver `PaginaDeSesionGlobal`): el récord se compara con lo que levantó en ESE plan. */

export default function ResumenDeSesion({ atletaId, almacen = 'wr:sessions', registro, sesionId, nombre, dia = null, tipo = null, color = null, coachId = null, unidadPeso = 'kg', recien = false, conStickers = false, alCerrar, alVerEnElPlan = null }) {
  const tramo = useMemo(() => tramoDeLaSesion(registro), [registro]);
  const guiado = useMemo(() => guiadoDe(registro), [registro]);
  const { programadas = null, record = null } = useProgramadoDeLaSesion({ dia, registro, sesionId });
  const tipoDeSesion = useTipoDeSesion();
  const [verStickers, setVerStickers] = useState(conStickers);

  /* Lo que no viene con la sesión: el entreno del reloj que se hizo a la vez (pulso, ruta, calorías), el coach y el historial del año (para el aviso de
     stickers). Se lee al abrir y otra vez cuando el reloj trae algo nuevo (al terminar con el Apple Watch, `SincronizaReloj` lo trae a los 8, 20 y 60 s). */
  const [cargado, setCargado] = useState(null); // { entreno, fila, series }
  const [coach, setCoach] = useState(null); // { usuario, nombre }
  const [vuelta, setVuelta] = useState(0);
  // Lo de la sesión se toma al abrir (como en la hoja de stickers): mientras la página está abierta no hay que volver a buscar con otros datos.
  const paraCargar = useRef({ atletaId, registro, sesionId, nombre, tipo, coachId, unidadPeso, programadas, record, tipoDeSesion });
  useEffect(() => {
    const d = paraCargar.current;
    let vivo = true;
    (async () => {
      const quien = await quienProgramo(d.coachId);
      if (vivo) setCoach(quien);
      const r = await cargaSesionHecha({ ...d, coach: quien?.usuario ?? null });
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

  /* «Tu nota»: se guarda en la sesión (`notes`), donde la escribía antes al final del entreno. Una vez anterior (`#2`) vive en `anteriores`. */
  const [, setSesiones] = useStorage(almacen, {});
  const guardaNota = (notes) => setSesiones((prev) => {
    const [base, vez] = String(sesionId).split('#');
    const actual = prev?.[base];
    if (!actual) return prev;
    if (!vez) return { ...prev, [base]: { ...actual, notes } };
    const anteriores = Array.isArray(actual.anteriores) ? [...actual.anteriores] : [];
    if (!anteriores[Number(vez) - 1]) return prev;
    anteriores[Number(vez) - 1] = { ...anteriores[Number(vez) - 1], notes };
    return { ...prev, [base]: { ...actual, anteriores } };
  });

  const fila = cargado?.fila ?? null;
  const { conexion: relojConexion, aqui: relojAqui, trayendo } = useReloj();
  const pulsoDelReloj = fila?.fc_media > 0;
  const trayendoPulso = recien && trayendo && !!relojConexion && relojAqui && !pulsoDelReloj;
  const ruta = useMemo(() => {
    const m = muestrasDeRuta(cargado?.series?.ruta ?? registro?.ruta);
    return m.length >= 2 && rutaDe(m) ? m : null;
  }, [cargado, registro]);

  // Cuándo fue: la hora del reloj si lo hubo (es la que tiene su zona horaria); si no, la de la sesión en este teléfono (marcada a mano: cuando la marcó).
  const marcadaMs = Date.parse(registro?.completedAt);
  const inicio = fila?.inicio ?? (tramo ? tramo.inicio : (Number.isFinite(marcadaMs) ? marcadaMs : null));
  const desfase = fila ? fila.desfase_min : (inicio !== null ? -new Date(inicio).getTimezoneOffset() : 0);
  const segundos = fila?.duracion_s ?? (tramo ? Math.round((tramo.fin - tramo.inicio) / 1000) : 0);
  const unidad = etiquetaUnidad(unidadPeso);
  const kilos = (kg) => pesoTexto(kg, unidadPeso);
  const ejercicios = useMemo(() => (dia ? ejerciciosDeLaSesion(dia, registro, { kilos: (kg) => pesoTexto(kg, unidadPeso) }) : []), [dia, registro, unidadPeso]);
  const hechas = guiado?.series ?? 0;
  const numeros = numerosDeSesion({
    hechas, programadas, segundos, volumen: guiado?.volumen > 0 ? desdeKilos(guiado.volumen, unidadPeso) : 0, unidad,
    fc: fila?.fc_media, coach: coach?.nombre ?? null, ejercicios, manual: !tramo,
  });
  const meta = [inicio !== null ? cuandoFue(inicio, desfase) : null, coach?.usuario ? `de ${coach.usuario}` : null].filter(Boolean).join(' · ');

  return (
    <PaginaDelEntreno
      nombre={nombre} meta={meta} ruta={ruta} actividad={{ nombre: tipo?.nombre ?? nombre, icono: tipo?.icono ?? 'pesa', color: color ?? KP.blue }}
      heroe={numeros.heroe} frase={numeros.frase} secundarios={numeros.secundarios} delReloj={pulsoDelReloj}
      record={filaDelRecordDelPlan(record, { kilos })} alCerrar={alCerrar} alCompartir={() => setVerStickers(true)}
      opciones={alVerEnElPlan ? [{ texto: 'Ver en mi plan', onClick: alVerEnElPlan }] : []}
      debajo={recien ? (
        <>
          {cargado?.entreno && <AvisoDeStickers entreno={cargado.entreno} numero={{ valor: String(hechas), unidad: 'sets' }} alAbrir={() => setVerStickers(true)} />}
          {trayendoPulso ? (
            <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#fff', borderRadius: 18, padding: '14px 16px', fontSize: 14.5, fontWeight: 600, color: LT.text2 }}>
              <Loader2 size={20} className="spin" color={KP.blue} />Trayendo tu pulso del reloj…
            </div>
          ) : <RelojEnEntreno conPulso={pulsoDelReloj} />}
        </>
      ) : null}
      encima={verStickers && (
        <Suspense fallback={null}>
          <HojaDeSesion
            atletaId={atletaId} registro={registro} sesionId={sesionId} nombre={nombre} dia={dia} tipo={tipo} coachId={coachId}
            unidadPeso={unidadPeso} capa={3300} onCerrar={() => setVerStickers(false)}
          />
        </Suspense>
      )}
    >
      <LoQueHiciste
        ejercicios={ejercicios} recordEn={record?.ejercicio ?? null}
        sub={`${ejercicios.length} ${ejercicios.length === 1 ? 'ejercicio' : 'ejercicios'}${hechas > 0 ? ` · ${programadas ? `${hechas} de ${programadas}` : hechas} series` : ''}`}
      />
      <TuNota key={sesionId} nota={String(registro?.notes ?? '')} coach={coach?.nombre ?? null} alGuardar={guardaNota} />
      {fila && <TuPulso media={fila.fc_media} maximo={fila.fc_max} zonas={zonasSimples(fila.zonas_s)} />}
    </PaginaDelEntreno>
  );
}
