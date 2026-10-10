import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LT, FONT } from '@/lib/theme';
import { useCuerpoQuieto } from '@/lib/useCuerpoQuieto';
import { usePantallaEncendida } from '@/lib/pantallaEncendida';
import { preparaAudio, pitido } from '@/lib/pitidos';
import { isLoadedExercise } from '@/lib/training-utils';
import { cargaPorPorcentaje } from '@/lib/cargaPorcentaje';
import { aKilos, desdeKilos, etiquetaUnidad } from '@/lib/unidades';
import { FORMATOS, textoDeResultado, tramosDeTrabajo, vistaDe } from '@/lib/formatos';
import { anotadoEnVuelta } from '@/lib/porVuelta';
import { palabrasDelEntreno } from '@/lib/entrenoPalabras';
import { FUNCIONES } from '@/lib/funciones';
import {
  cuentaDe, empiezaPaso, marcaListo, masDescanso as sumaDescanso, pasosDeLaSesion, quitaCronometro, saltaPaso, terminaEntreno, vistaDelEntreno, vuelveAtras,
} from '@/lib/entreno';
import {
  camposDeCambiar, cantidadPlaneada, cifrasDelPaso, exDataTrasListo, puntosDeVueltas, segmentosDeAvance, serieALaVista, tarjetasDeLaLista, textoDeLoPlaneado,
  tiempoTotal,
} from '@/lib/entrenoDatos';
import Portada from '@/components/Portada';
import RelojDelBloque from '@/features/training/RelojDelBloque';
import ResultadoDelBloque from '@/features/training/ResultadoDelBloque';
import TarjetaDeVideo from '@/features/training/TarjetaDeVideo';
import {
  BarraDelEntreno, CronometroDelPaso, HojaDeCambiar, HojaDeLista, HojaDeTecnica, PantallaDeDescanso, PantallaDeFin, PantallaDePaso,
  PantallaDeReloj,
} from '@/features/training/PantallasDelEntreno';

/**
 * El MODO ENTRENO a pantalla completa: «Iniciar» → un paso a la vez → descansos → el final.
 *
 * Andrés, 9 oct 2026 (EXPERIENCIA DE WORKOUTS): hacer un workout era hacer scroll por una lista. Aquí la sesión del día es una
 * secuencia: el ejercicio que toca, con su video y sus cifras, un solo botón («Listo») y, si el coach lo escribió, el descanso.
 *
 * ESTE ARCHIVO NO SABE DE PLANES NI DE BASE DE DATOS: recibe el día, el registro del atleta y funciones para escribirlo. Todo lo que
 * decide el entreno (qué paso toca, cuánto queda de un descanso, qué cuenta como hecho) lo calcula `lib/entreno.js`; lo que se dice
 * de cada paso, `lib/entrenoDatos.js`; lo que se dibuja, `PantallasDelEntreno.jsx`. Aquí solo se pegan, con tres cuidados:
 *
 *   · EL AVANCE ES UN DATO, NO UNA PANTALLA. Cada «Listo» se escribe al instante en `sesión.entreno`; no hay nada que «guardar al
 *     salir». Una llamada, el teléfono bloqueado o iOS matando la pestaña no pierden nada: al volver se calcula todo de nuevo.
 *   · «LISTO» DA POR HECHO LO PLANEADO y escribe también el registro de siempre (`exercises[idx]`: peso y reps hechas) para que el
 *     progreso, los récords y la IA sigan leyendo lo mismo. «Cambiar» solo trae lo que salió distinto (ver `exDataTrasListo`).
 *   · EL RELOJ SIRVE Y NUNCA MANDA. Los avisos son sonidos opcionales; nada avanza solo; el tiempo total va chico y callado.
 *
 * `onGrabarTecnica(paso)` (opcional) es quien graba la técnica: mientras `FUNCIONES.grabarTecnica` esté apagada, la cámara de cada paso solo dice «Pronto».
 * `medios(ex)` dice la foto y los videos de un ejercicio (`{ portada, videos }`), `oneRMs` los máximos del atleta (para pasar «78 %» a
 * kilos) y `salud` que es un paciente (sin 1RM). `sesionId` y `userId` son la llave con la que el reloj de un Set recuerda dónde iba.
 */

// La misma preferencia que el reloj de un Set: quien silenció uno, silenció los dos.
const LLAVE_DEL_SONIDO = 'tl:reloj:sonido';
const leeSonido = () => {
  try { return window.localStorage.getItem(LLAVE_DEL_SONIDO) !== 'no'; } catch { return true; }
};

export default function EntrenoDelDia({
  dia, aspecto, registro, onRegistro, onFormato, sesionId, userId, unidadDePeso = 'kg', oneRMs, salud = false, medios, alCerrar, onGrabarTecnica,
}) {
  // La página de atrás se queda quieta mientras el entreno está abierto (ver `useCuerpoQuieto`).
  useCuerpoQuieto();
  // La pantalla no se apaga entre series: con las manos llenas de magnesio nadie la quiere tocar para despertarla.
  usePantallaEncendida(true);

  const plan = useMemo(() => pasosDeLaSesion(dia), [dia]);
  const palabras = palabrasDelEntreno(salud);
  const entreno = registro?.entreno;
  const [ahora, setAhora] = useState(() => Date.now());
  // Un paso que se tocó en la lista («Tu entreno»): se ve ese en vez del que sigue. `null` = seguir el orden.
  const [enfoque, setEnfoque] = useState(null);
  const [hoja, setHoja] = useState(null);
  const [verFin, setVerFin] = useState(false);
  const [reloj, setReloj] = useState(false);
  const [anotando, setAnotando] = useState(false);
  const [sonido, setSonido] = useState(leeSonido);

  const vista = vistaDelEntreno(plan, entreno, ahora);
  const enfocado = enfoque ? plan.pasos.find((p) => p.clave === enfoque && p.tipo !== 'descanso') : null;
  const paso = enfocado && vista.estados[enfocado.i] !== 'hecho' ? enfocado : vista.actual;
  const enDescanso = !!paso && paso.tipo === 'descanso';
  const cuenta = paso && paso.tipo !== 'descanso' ? cuentaDe(paso, entreno, ahora) : null;
  const mostrarFin = verFin || vista.completo;
  // La foto y los videos se piden UNA vez por paso (no en cada tic del reloj): con una lista nueva cada vez, el video se reiniciaría.
  const mediosDelPaso = useMemo(() => (paso && paso.tipo === 'ejercicio' ? (medios?.(dia.exercises[paso.idx]) ?? null) : null), [paso, medios, dia]);
  const mediosDelSiguiente = useMemo(() => {
    const s = vista.siguiente;
    return s && s.tipo === 'ejercicio' ? (medios?.(dia.exercises[s.idx]) ?? null) : null;
  }, [vista.siguiente, medios, dia]);

  /* ---------- La hora: el tic solo avisa a la pantalla que se vuelva a dibujar; todo se calcula con la hora ---------- */
  const necesitaTic = enDescanso || !!cuenta;
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), necesitaTic ? 250 : 1000);
    const alVolver = () => { if (document.visibilityState === 'visible') setAhora(Date.now()); };
    document.addEventListener('visibilitychange', alVolver);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', alVolver); };
  }, [necesitaTic]);

  // El aviso al llegar a cero (un descanso o un cronómetro): suena UNA vez, y solo si se vio llegar; al volver con el tiempo ya vencido, no.
  const previo = useRef({ clave: null, vencido: false });
  useEffect(() => {
    const ahoraMismo = enDescanso && vista.descanso
      ? { clave: vista.descanso.paso.clave, vencido: vista.descanso.vencido }
      : (cuenta ? { clave: `c.${paso.clave}`, vencido: cuenta.vencido } : null);
    const p = previo.current;
    if (ahoraMismo && sonido && ahoraMismo.clave === p.clave && ahoraMismo.vencido && !p.vencido) pitido('fin');
    previo.current = ahoraMismo ?? { clave: null, vencido: false };
  });

  /* ---------- Lo que se sabe de un paso ---------- */
  const exDe = useCallback((p) => (p && p.idx !== undefined ? dia.exercises[p.idx] : null), [dia]);

  // Los kilos del plan para ese paso, en la unidad del atleta: de su 1RM (si el plan dice «78 %») o un peso fijo. Los pacientes no tienen 1RM.
  const kilosDe = useCallback((p) => {
    if (!p || p.tipo !== 'ejercicio' || !p.meta) return null;
    const unidad = etiquetaUnidad(unidadDePeso);
    if (p.meta.tipo === 'kg' && p.meta.min > 0) {
      const valor = unidadDePeso === 'lb' ? Math.round(desdeKilos(p.meta.min, 'lb') / 5) * 5 : p.meta.min;
      return { valor, numero: valor, unidad, aprox: false, kg: String(p.meta.min) };
    }
    if (p.meta.tipo === 'pct' && !salud) {
      const c = cargaPorPorcentaje({ ...exDe(p), intensity: p.meta.texto }, oneRMs, unidadDePeso);
      if (c && !c.falta) {
        return { valor: c.desde === c.hasta ? c.desde : `${c.desde}–${c.hasta}`, numero: c.desde, unidad, aprox: true, kg: String(aKilos(c.desde, unidadDePeso)) };
      }
    }
    return null;
  }, [exDe, oneRMs, salud, unidadDePeso]);

  const conPeso = (p) => !!exDe(p) && isLoadedExercise(exDe(p));

  // Lo que ya quedó anotado hoy de este ejercicio (en esta vuelta): «6 reps · 107.5 kg».
  const anotadoDe = (p) => {
    if (!p || p.tipo !== 'ejercicio' || p.lapsos > 1) return '';
    const exData = registro?.exercises?.[p.idx];
    const hay = p.vueltas > 1 ? anotadoEnVuelta(exData, p.vuelta - 1) : (exData ?? {});
    return [
      hay.repsHechas ? `${hay.repsHechas} ${hay.repsHechas === '1' ? 'rep' : 'reps'}` : null,
      hay.weight ? `${desdeKilos(hay.weight, unidadDePeso)} ${etiquetaUnidad(unidadDePeso)}` : null,
    ].filter(Boolean).join(' · ');
  };

  const videoDe = (ex, m) => {
    if (!ex || !m || (!m.portada && !(m.videos?.length))) return null;
    return <TarjetaDeVideo key={ex.name} videos={m.videos ?? []} portada={m.portada} nombre={ex.name} />;
  };
  const miniaturaDe = (m) => {
    const v = m?.videos?.[0];
    if (!m || (!m.portada && !v)) return null;
    return (
      <span style={{ position: 'relative', width: 46, height: 46, borderRadius: 12, overflow: 'hidden', flexShrink: 0, background: '#0E1015' }}>
        <Portada foto={m.portada} video={v?.url} desde={v?.inicio} hasta={v?.fin} style={{ position: 'absolute', inset: 0 }} />
      </span>
    );
  };

  // La foto o el video de un ejercicio, para su fila en «Ver todo»: `{ nodo, conVideo }`, o `null` si no tiene (entonces va su número).
  const miniaturaDeFila = (fila) => {
    const ex = dia.exercises[fila.idx];
    const m = ex && !ex.isNote ? medios?.(ex) : null;
    const v = m?.videos?.[0];
    if (!m || (!m.portada && !v)) return null;
    return { nodo: <Portada foto={m.portada} video={v?.url} desde={v?.inicio} hasta={v?.fin} style={{ position: 'absolute', inset: 0 }} />, conVideo: !!m.videos?.length };
  };
  // Lo que quedó anotado de un Set con reloj («8 rondas»), o `null`.
  const resultadoDe = (p) => {
    const r = registro?.formatos?.[p.claveFormato];
    return r ? textoDeResultado(r, p.deLapsos ? 'lapso' : undefined) : null;
  };

  /* ---------- Las acciones: cada una escribe en el registro al instante ---------- */
  const escribe = (cambio) => onRegistro(cambio);

  const listo = (real) => {
    const t = Date.now();
    setAhora(t);
    preparaAudio();
    const objetivo = paso;
    if (!objetivo) return;
    const clave = enfocado && objetivo === enfocado ? enfocado.clave : undefined;
    const kilos = kilosDe(objetivo);
    const ex = exDe(objetivo);
    escribe((prev) => {
      const siguiente = { ...prev, entreno: marcaListo(plan, prev?.entreno, t, real, clave) };
      if (objetivo.tipo !== 'ejercicio') return siguiente;
      const dato = exDataTrasListo({
        paso: objetivo, exData: prev?.exercises?.[objetivo.idx], kgPlaneados: kilos?.kg ?? null, conPeso: !!ex && isLoadedExercise(ex), real,
      });
      return dato ? { ...siguiente, exercises: { ...(prev?.exercises || {}), [objetivo.idx]: dato } } : siguiente;
    });
    setEnfoque(null);
  };
  const saltar = () => {
    const t = Date.now();
    setAhora(t);
    const clave = enfocado && paso === enfocado ? enfocado.clave : undefined;
    escribe((prev) => ({ ...prev, entreno: saltaPaso(plan, prev?.entreno, t, clave) }));
    setEnfoque(null);
  };
  // Mirando un paso que se tocó en «Ver todo», «Anterior» regresa a donde iba: asomarse a otro ejercicio no deshace lo hecho.
  const mirandoOtro = !!enfocado && paso === enfocado;
  const anterior = () => {
    if (mirandoOtro) { setEnfoque(null); return; }
    escribe((prev) => ({ ...prev, entreno: vuelveAtras(plan, prev?.entreno) }));
    setEnfoque(null);
    setVerFin(false);
  };
  const seguirDelDescanso = () => { preparaAudio(); listo(); };
  const masDescanso = () => escribe((prev) => ({ ...prev, entreno: sumaDescanso(plan, prev?.entreno, 30) }));
  const empezarCronometro = () => {
    const t = Date.now();
    setAhora(t);
    preparaAudio();
    const clave = enfocado && paso === enfocado ? enfocado.clave : undefined;
    escribe((prev) => ({ ...prev, entreno: empiezaPaso(plan, prev?.entreno, t, clave) }));
  };
  const detenerCronometro = () => {
    const clave = enfocado && paso === enfocado ? enfocado.clave : undefined;
    escribe((prev) => ({ ...prev, entreno: quitaCronometro(plan, prev?.entreno, clave) }));
  };
  const alternaSonido = () => {
    const nuevo = !sonido;
    setSonido(nuevo);
    if (nuevo) preparaAudio();
    try { window.localStorage.setItem(LLAVE_DEL_SONIDO, nuevo ? 'si' : 'no'); } catch { /* sin almacenamiento */ }
  };
  const terminarSesion = () => {
    const t = Date.now();
    escribe((prev) => ({
      ...prev,
      entreno: terminaEntreno(prev?.entreno, t),
      completed: true,
      completedAt: prev?.completed && prev?.completedAt ? prev.completedAt : new Date(t).toISOString(),
    }));
    alCerrar();
  };
  // La cámara de «grabar técnica»: apagada solo explica que viene; prendida (y con quien la grabe) llama a `onGrabarTecnica`.
  const tecnicaActiva = FUNCIONES.grabarTecnica && !!onGrabarTecnica;
  // La guía completa («Ver todo», el par A/B, el cronómetro de cada paso) es de la app descargable; la web va con la básica (ver `lib/funciones.js`).
  const completo = FUNCIONES.entrenoCompleto;
  const abreTecnica = () => { if (tecnicaActiva) onGrabarTecnica(paso); else setHoja('tecnica'); };
  const volverAlEntreno = () => {
    // Con todo hecho no queda ningún paso al que volver: se regresa al último.
    if (vista.completo) anterior(); else setVerFin(false);
  };

  /* ---------- Un Set con reloj ---------- */
  const resultadoDelReloj = paso?.tipo === 'reloj' ? (registro?.formatos?.[paso.claveFormato] ?? null) : null;
  const guardaResultado = (r) => {
    onFormato(paso.claveFormato, r);
    setReloj(false);
    setAnotando(false);
    listo();
  };

  // Lo que se dice bajo el título de un Set con reloj: lo que es el formato, o las rondas de unos lapsos.
  const detalleDelReloj = (p) => (p.deLapsos ? (p.rondas > 1 ? `${p.rondas} rondas` : '') : FORMATOS[vistaDe(p.formato)]?.detalle);

  /* ---------- Qué se dibuja ---------- */
  const fondo = enDescanso && aspecto?.fondo ? `${aspecto.fondo}, ${LT.bg}` : LT.bg;
  const segmentos = segmentosDeAvance(plan, vista.estados);
  /* El tiempo que llevas: arriba, en una pastilla, y al final en el resumen. Lo quitamos del paso (9 oct, mañana: «letritas grises») y esa noche
     Andrés lo extrañó: «en ningún momento puedo ver cuánto tiempo llevo entrenando». Pasadas muchas horas (retomar al día siguiente) no se dice. */
  const tiempo = tiempoTotal(vista.transcurrido) ?? '';
  // El paso que toca, o (en un descanso) el que viene: de ahí salen los puntos de las vueltas y lo que se resalta en «Ver todo».
  const queToca = enDescanso ? vista.siguiente : paso;
  const serieDelPaso = paso?.tipo === 'ejercicio' ? serieALaVista(plan, vista.estados, paso) : null;
  const puntosDelPaso = paso?.tipo === 'ejercicio' ? puntosDeVueltas(plan, vista.estados, paso.serie, paso.clave) : [];

  const siguienteDeDescanso = enDescanso && vista.siguiente ? {
    nombre: vista.siguiente.tipo === 'reloj' ? vista.siguiente.resumen : vista.siguiente.nombre,
    detalle: vista.siguiente.tipo === 'reloj' ? '' : textoDeLoPlaneado(vista.siguiente, kilosDe(vista.siguiente)),
    puntos: vista.siguiente.tipo === 'ejercicio' ? puntosDeVueltas(plan, vista.estados, vista.siguiente.serie, vista.siguiente.clave) : [],
  } : null;

  const kilosDelPaso = kilosDe(paso);
  const camposCambiar = paso && paso.tipo === 'ejercicio' ? camposDeCambiar(paso, { conPeso: conPeso(paso) }) : [];
  const cambiar = camposCambiar.length > 0 ? {
    campos: camposCambiar,
    planeado: { reps: cantidadPlaneada(paso) ?? '', kg: kilosDelPaso ? String(kilosDelPaso.numero) : '' },
  } : null;

  /* Qué dice el botón de ajustar lo hecho: «Cambiar» a secas no decía QUÉ (Andrés, 9 oct 2026: «¿cambiar qué?»). Con lo planeado se «cambia»; sin
     nada planeado se «anota»; y siempre se dice qué: reps, kilos, tiempo… */
  const textoDeCambiar = cambiar
    ? (cambiar.planeado.reps || cambiar.planeado.kg
      ? `Cambiar ${camposCambiar.map((c) => (c.clave === 'kg' ? 'kilos' : c.rotulo.toLowerCase())).join(' o ')}`
      : `Anotar ${camposCambiar.map((c) => (c.clave === 'kg' ? 'kilos' : c.rotulo.toLowerCase())).join(' y ')}`)
    : null;

  const resumenDeFin = [
    { valor: tiempo || '—', etiqueta: 'Tiempo' },
    { valor: String(vista.hechos), etiqueta: 'Hechos' },
    vista.saltados > 0
      ? { valor: String(vista.saltados), etiqueta: 'Saltados' }
      : { valor: String(segmentos.filter((f) => f > 0).length), etiqueta: 'Series' },
  ];

  const sinPasos = !paso && !mostrarFin;
  if (sinPasos) return null;

  let pantalla;
  if (mostrarFin) {
    pantalla = (
      <PantallaDeFin
        resumen={resumenDeFin} notas={registro?.notes ?? ''} yaTerminada={!!registro?.completed} palabras={palabras}
        onNotas={(notes) => escribe((prev) => ({ ...prev, notes }))}
        onTerminar={terminarSesion} onVolver={volverAlEntreno}
      />
    );
  } else if (enDescanso) {
    pantalla = (
      <PantallaDeDescanso
        descanso={vista.descanso} siguiente={siguienteDeDescanso} miniatura={miniaturaDe(mediosDelSiguiente)} sonido={sonido}
        puedeAnterior={vista.puedeAnterior} onSeguir={seguirDelDescanso} onMas={masDescanso} onAnterior={anterior} onSonido={alternaSonido}
      />
    );
  } else if (paso.tipo === 'reloj') {
    pantalla = (
      <PantallaDeReloj
        paso={paso} detalle={detalleDelReloj(paso)} resultado={resultadoDelReloj} puedeAnterior={vista.puedeAnterior || mirandoOtro}
        onIniciar={() => { preparaAudio(); setReloj(true); }} onAnotar={() => setAnotando(true)} onListo={() => listo()}
        onSaltar={saltar} onAnterior={anterior} tecnica={completo ? { activa: tecnicaActiva, etiqueta: palabras.tecnicaTitulo, onClick: abreTecnica } : null}
      />
    );
  } else {
    const siguiente = vista.siguiente && vista.siguiente !== paso ? (vista.siguiente.tipo === 'reloj' ? vista.siguiente.resumen : vista.siguiente.nombre) : '';
    pantalla = (
      <PantallaDePaso
        paso={paso} video={paso.tipo === 'ejercicio' ? videoDe(exDe(paso), mediosDelPaso) : null} cifras={cifrasDelPaso(paso, kilosDelPaso)} anotado={anotadoDe(paso)}
        sigue={siguiente} serie={serieDelPaso} serieSimple={!completo} puntos={puntosDelPaso}
        cronometro={completo && paso.termina?.por === 'tiempo' ? (
          <CronometroDelPaso segundos={paso.termina.valor ?? paso.termina.min} cuenta={cuenta} onEmpezar={empezarCronometro} onQuitar={detenerCronometro} />
        ) : null}
        etiquetaDeCambiar={textoDeCambiar} puedeAnterior={vista.puedeAnterior || mirandoOtro}
        onListo={() => listo()} onCambiar={() => setHoja('cambiar')} onSaltar={saltar} onAnterior={anterior}
        tecnica={completo ? { activa: tecnicaActiva, etiqueta: palabras.tecnicaTitulo, onClick: abreTecnica } : null}
      />
    );
  }

  const ejerciciosDelReloj = paso?.tipo === 'reloj' ? paso.miembros.map((m) => ({ ex: dia.exercises[m.idx], idx: m.idx })) : [];
  // Un Set en lapsos corre los tramos que armó el motor (ver `pasosDeLaSesion`); un formato, los suyos.
  const tramosDelReloj = paso?.tipo === 'reloj' ? (paso.deLapsos ? paso.tramos.filter((t) => t.tipo === 'trabajo').length : tramosDeTrabajo(paso.formato, paso.miembros.length)) : 0;
  const nombreDelReloj = paso?.deLapsos ? 'Lapsos personalizados' : paso?.resumen;

  return createPortal(
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: '100dvh', zIndex: 3000, background: fondo, display: 'flex', flexDirection: 'column', fontFamily: FONT,
      }}
    >
      {!mostrarFin && (
        <BarraDelEntreno
          segmentos={segmentos} fondo={fondo} palabras={palabras} tiempo={tiempo || null}
          onCerrar={alCerrar} onLista={completo ? () => setHoja('lista') : undefined}
        />
      )}
      {pantalla}

      {hoja === 'lista' && (
        <HojaDeLista
          tarjetas={tarjetasDeLaLista(plan, vista.estados, queToca?.clave ?? null, { kilosDe, resultadoDe })} miniaturaDe={miniaturaDeFila} palabras={palabras}
          onElegir={(clave) => { setEnfoque(clave); setHoja(null); }}
          onTerminar={() => { setHoja(null); setVerFin(true); }}
          onCerrar={() => setHoja(null)}
        />
      )}
      {hoja === 'cambiar' && cambiar && (
        <HojaDeCambiar
          campos={cambiar.campos} planeado={cambiar.planeado} inicial={{}} unidadDePeso={etiquetaUnidad(unidadDePeso)}
          resumen={textoDeLoPlaneado(paso, kilosDelPaso)}
          onGuardar={(tocado) => {
            setHoja(null);
            const real = {};
            if (tocado.reps !== undefined && tocado.reps !== '') real.reps = tocado.reps;
            if (tocado.kg !== undefined && tocado.kg !== '') real.kg = String(aKilos(tocado.kg, unidadDePeso));
            listo(Object.keys(real).length ? real : undefined);
          }}
          onCerrar={() => setHoja(null)}
        />
      )}
      {hoja === 'tecnica' && <HojaDeTecnica palabras={palabras} onCerrar={() => setHoja(null)} />}

      {reloj && paso?.tipo === 'reloj' && (
        <RelojDelBloque
          formato={paso.formato} plan={paso.tramos ?? null} ejercicios={ejerciciosDelReloj} serie={paso.serie} resumen={nombreDelReloj}
          clave={`${userId}:${sesionId}:${paso.claveFormato}`} empezarYa onGuardar={guardaResultado} onCerrar={() => setReloj(false)}
        />
      )}
      {anotando && paso?.tipo === 'reloj' && (
        <ResultadoDelBloque
          formato={paso.formato} resumen={nombreDelReloj} inicial={resultadoDelReloj}
          sugerido={{ seg: null, rondas: 0, tramos: [], completados: tramosDelReloj, de: tramosDelReloj }}
          onGuardar={guardaResultado}
          onBorrar={resultadoDelReloj ? () => { onFormato(paso.claveFormato, null); setAnotando(false); } : undefined}
          onCerrar={() => setAnotando(false)}
        />
      )}
    </div>,
    document.body,
  );
}
