import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LT, FONT } from '@/lib/theme';
import { useCuerpoQuieto } from '@/lib/useCuerpoQuieto';
import { usePantallaEncendida } from '@/lib/pantallaEncendida';
import { avisaCuandoTermine, quitaAviso, vibra, AVISO_DE_DESCANSO, AVISO_DE_CRONOMETRO } from '@/lib/avisosNativos';
import { muestraEnPantallaBloqueada, quitaDePantallaBloqueada } from '@/lib/pantallaBloqueada';
import { enviaAlReloj, escuchaReloj, terminaEnReloj } from '@/lib/relojApple';
import { preparaAudio, pitido } from '@/lib/pitidos';
import { isLoadedExercise, sinDuracion } from '@/lib/training-utils';
import { cargaPorPorcentaje } from '@/lib/cargaPorcentaje';
import { aKilos, desdeKilos, etiquetaUnidad } from '@/lib/unidades';
import { FORMATOS, textoDeResultado, tramosDeTrabajo, vistaDe } from '@/lib/formatos';
import { anotadoEnVuelta } from '@/lib/porVuelta';
import { textoDeHecho } from '@/lib/medidas';
import { palabrasDelEntreno } from '@/lib/entrenoPalabras';
import { FUNCIONES } from '@/lib/funciones';
import { relojAMedias } from '@/lib/relojGuardado';
import {
  cuentaDe, empiezaPaso, esElUltimoPaso, iniciaEntreno, marcaListo, masDescanso as sumaDescanso, pausaDescanso, pasosDeLaSesion, quitaCronometro, saltaPaso, terminaEntreno, vistaDelEntreno, vuelveAtras,
} from '@/lib/entreno';
import { useAviso } from '@/components/AvisoPasajero';
import {
  camposDeCambiar, cantidadPlaneada, cifrasConExplicacion, exDataTrasListo, queEsLaCifra, puntosDeVueltas, resumenDeLaSerie, segmentosDeAvance, tarjetasDeLaLista, textoDeLoPlaneado,
  tiempoTotal,
} from '@/lib/entrenoDatos';
import Portada from '@/components/Portada';
import RelojDelBloque from '@/features/training/RelojDelBloque';
import ResultadoDelBloque from '@/features/training/ResultadoDelBloque';
import TarjetaDeVideo from '@/features/training/TarjetaDeVideo';
import TarjetaDeClase from '@/features/training/TarjetaDeClase';
import PasoConGps from '@/features/training/PasoConGps';
import { useRecorrido } from '@/features/training/useRecorrido';
import { cantidadEnUnidad, esPasoConGps, METROS_PARA_GPS, metrosDelPaso, pedidoEnUnaLinea } from '@/lib/recorrido';
import { fuenteDeUbicacion } from '@/lib/ubicacion';
import { claseDe } from '@/lib/clases';
import {
  BarraDelEntreno, CronometroDelPaso, HojaDeCambiar, HojaDeLista, HojaDelRecorrido, HojaDeQueEs, HojaDeTecnica, PantallaAntesDeEmpezar, PantallaDeDescanso, PantallaDePaso,
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
 *   · EL RELOJ SIRVE Y NO TE DEJA PERDIDO. Los avisos son sonidos opcionales y el tiempo total va chico y callado. Un ejercicio siempre espera tu «Listo»; lo único
 *     que sigue solo es lo que la app mide por ti: un descanso que llega a cero (avisa y pasa a lo que sigue) y un reloj al que llegas avanzando (ver abajo).
 *   · UN SOLO «EMPEZAR» POR INTENCIÓN. Andrés (9 oct 2026): «si ya le piqué a iniciar entrenamiento y se supone que tú me guías, ¿por qué no
 *     inicias el reloj?». Cuando la persona AVANZA (`llegando`: «Iniciar entreno», «Continuar entreno», «Listo», «Seguir», «Saltar») y el
 *     paso al que llega es un reloj, el reloj se abre y corre solo, con un 3, 2, 1 que se cancela (ver `conCuenta` en `RelojDelBloque`). Volver atrás,
 *     tocar un paso en «Ver todo» o recargar la app NUNCA arrancan nada: ahí sí está la pantalla del Set con su «Empezar».
 *
 * `onGrabarTecnica(paso)` (opcional) es quien graba la técnica: mientras `FUNCIONES.grabarTecnica` esté apagada, la cámara de cada paso solo dice «Pronto».
 * `medios(ex)` dice la foto y los videos de un ejercicio (`{ portada, videos }`), `oneRMs` los máximos del atleta (para pasar «78 %» a
 * kilos) y `salud` que es un paciente (sin 1RM). `sesionId` y `userId` son la llave con la que el reloj de un Set recuerda dónde iba.
 */

// La grabadora de técnica se carga solo cuando se pide (ver `features/stickers` y `features/mensajes`).
const GrabaTecnica = lazy(() => import('@/features/mensajes/GrabaTecnica'));

// La misma preferencia que el reloj de un Set: quien silenció uno, silenció los dos.
const LLAVE_DEL_SONIDO = 'tl:reloj:sonido';
// Los ejercicios para los que se eligió «Sin GPS» (pista techada, caminadora): se recuerdan en este teléfono.
const LLAVE_SIN_GPS = 'tl:sin-gps';
// Que ya abrió una vez «¿qué es?» de una cifra de esfuerzo: el globo de «Toca para saber qué es» ya no sale.
const LLAVE_QUE_ES = 'tl:que-es-visto';
const leeSonido = () => {
  try { return window.localStorage.getItem(LLAVE_DEL_SONIDO) !== 'no'; } catch { return true; }
};

export default function EntrenoDelDia({
  dia, aspecto, registro, onRegistro, onFormato, sesionId, userId, unidadDePeso = 'kg', oneRMs, salud = false, medios, alCerrar, alTerminado = null, destinoDeTecnica = null,
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
  /* «¿QUÉ ES?» (Andrés, 30 oct 2026): la cifra de esfuerzo (carga, RIR, RPE, zona…) se toca y una hojita dice qué significa. La primera vez que alguien ve una en
     este teléfono, un globo le dice que se puede tocar; al abrir una explicación ya no vuelve a salir. */
  const [queEs, setQueEs] = useState(null);
  const [queEsVisto, setQueEsVisto] = useState(() => { try { return window.localStorage.getItem(LLAVE_QUE_ES) === '1'; } catch { return false; } });
  const { avisa } = useAviso();
  // La técnica que se está grabando (el paso, congelado al tocar la cámara) y la última que se mandó de cada paso: `{ [clave]: idDeLaTécnica }`.
  const [grabandoTecnica, setGrabandoTecnica] = useState(null);
  const [tecnicasMandadas, setTecnicasMandadas] = useState({});
  // `reloj`: la persona tocó «Empezar» en la pantalla del Set (corre ya). `llegando`: lo último que hizo fue AVANZAR; empieza en `true` porque este entreno solo
  // se abre con el botón «Iniciar entreno» o «Continuar entreno» del día. `cerradoEn`: el Set cuyo reloj cerró a mano, para que no se vuelva a abrir solo.
  const [reloj, setReloj] = useState(false);
  const [llegando, setLlegando] = useState(true);
  const [cerradoEn, setCerradoEn] = useState(null);
  const [anotando, setAnotando] = useState(false);
  const [sonido, setSonido] = useState(leeSonido);
  // «Antes de empezar»: las notas de la sesión y su clase, solo si hay y todavía no se ha hecho nada.
  const notasDeLaSesion = useMemo(() => (Array.isArray(dia.notes) ? dia.notes : []).map((n) => String(n ?? '').trim()).filter(Boolean), [dia]);
  const claseDeLaSesion = claseDe(dia);
  // EL GPS (23 oct 2026, ver `lib/recorrido.js`): el recorrido en silencio (si dijo que sí), y los pasos de 200 m o más con mapa. `cerradoGps`: el paso en
  // que cerró el mapa (se ve el paso normal); `sinGps`: los ejercicios para los que eligió «Sin GPS» (se recuerda en este teléfono); `medidoGps`: lo que midió el
  // GPS cuando pidió anotarlo a mano (arranca ahí).
  const recorrido = useRecorrido({ sesionId, rutaGuardada: registro?.ruta });
  const [cerradoGps, setCerradoGps] = useState(null);
  const [sinGps, setSinGps] = useState(() => { try { return JSON.parse(window.localStorage.getItem(LLAVE_SIN_GPS) ?? '{}') ?? {}; } catch { return {}; } });
  const [medidoGps, setMedidoGps] = useState(null);
  /* EL GPS VIVO TODO EL ENTRENO (auditoría del GPS, 27 oct 2026): si la sesión tiene pasos de 200 m o más o lapsos por distancia, se queda una escucha
     abierta mientras el entreno está abierto. Así el teléfono no apaga el GPS en los descansos ni entre un sprint y otro, y cada uno arranca con señal.
     Espera a que conteste «¿Guardamos tu recorrido?» (si no, el permiso del GPS taparía la pregunta). Los puntos de esta escucha no se usan. */
  const sesionConGps = useMemo(() => plan.pasos.some((p) => esPasoConGps(p)
    || (p.tipo === 'reloj' && p.deLapsos && (p.tramos ?? []).some((t) => t.tipo === 'trabajo' && t.seg == null && Number(t.metros) >= METROS_PARA_GPS))), [plan]);
  const gpsContestado = recorrido.permiso !== null || !recorrido.disponible;
  useEffect(() => {
    if (!sesionConGps || !gpsContestado) return undefined;
    const fuente = fuenteDeUbicacion();
    if (!fuente.disponible()) return undefined;
    return fuente.sigue(() => {}, () => {});
  }, [sesionConGps, gpsContestado]);
  const [antes, setAntes] = useState(() => (notasDeLaSesion.length > 0 || !!claseDeLaSesion) && !(entreno?.inicio) && Object.keys(entreno?.hechos ?? {}).length === 0 && Object.keys(entreno?.saltados ?? {}).length === 0);

  const vista = vistaDelEntreno(plan, entreno, ahora);
  const enfocado = enfoque ? plan.pasos.find((p) => p.clave === enfoque && p.tipo !== 'descanso') : null;
  const paso = enfocado && vista.estados[enfocado.i] !== 'hecho' ? enfocado : vista.actual;
  const enDescanso = !!paso && paso.tipo === 'descanso';
  const cuenta = paso && paso.tipo !== 'descanso' ? cuentaDe(paso, entreno, ahora) : null;
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
    if (ahoraMismo && ahoraMismo.clave === p.clave && ahoraMismo.vencido && !p.vencido) {
      if (sonido) pitido('fin');
      vibra('fin');
    }
    previo.current = ahoraMismo ?? { clave: null, vencido: false };
  });

  /* Con el teléfono bloqueado el JavaScript se congela y nada de lo de arriba suena: se deja un AVISO del teléfono para la hora exacta en que termina el descanso (o el
     cronómetro del paso), y se quita si el atleta avanza antes. En la web no hace nada. */
  const finDelDescanso = enDescanso && vista.descanso && !vista.descanso.vencido ? vista.descanso.fin : null;
  const siguienteNombre = vista.siguiente?.nombre ?? '';
  useEffect(() => {
    if (!finDelDescanso) { quitaAviso(AVISO_DE_DESCANSO); return undefined; }
    avisaCuandoTermine({ id: AVISO_DE_DESCANSO, fin: finDelDescanso, cuerpo: siguienteNombre ? `Terminó el descanso. Sigue: ${siguienteNombre}` : 'Terminó el descanso.' });
    return () => { quitaAviso(AVISO_DE_DESCANSO); };
  }, [finDelDescanso, siguienteNombre]);
  const finDeLaCuenta = cuenta && !cuenta.vencido ? cuenta.fin : null;
  const nombreDelPaso = paso?.nombre ?? '';
  useEffect(() => {
    if (!finDeLaCuenta) { quitaAviso(AVISO_DE_CRONOMETRO); return undefined; }
    avisaCuandoTermine({ id: AVISO_DE_CRONOMETRO, fin: finDeLaCuenta, cuerpo: nombreDelPaso ? `Se acabó el tiempo de ${nombreDelPaso}.` : 'Se acabó el tiempo.' });
    return () => { quitaAviso(AVISO_DE_CRONOMETRO); };
  }, [finDeLaCuenta, nombreDelPaso]);
  /* La pantalla bloqueada y la isla dinámica (Live Activity): lo que toca ahora y cuánto falta. Se actualiza solo al cambiar de paso o de descanso; los tiempos son horas y el
     teléfono los cuenta. Al cerrar el entreno o terminarlo, se quita. */
  const hayEntreno = !!entreno?.inicio && !vista.completo;
  const nombreDePaso = paso?.nombre ?? '';
  const claveDePaso = paso?.clave ?? '';
  const serieTexto = paso?.vueltas > 1 ? `Serie ${paso.vuelta} de ${paso.vueltas}` : '';
  useEffect(() => {
    if (!hayEntreno || !paso) return;
    const nombre = plan?.nombre || dia?.name || 'Entreno';
    let datos = null;
    if (enDescanso) {
      datos = {
        nombre, tipo: 'descanso', titulo: 'Descanso', detalle: siguienteNombre ? `Sigue: ${siguienteNombre}` : '',
        ...(finDelDescanso ? { finMs: finDelDescanso } : { inicioMs: entreno.inicio }),
      };
    } else if (paso.tipo === 'ejercicio') {
      datos = {
        nombre, tipo: 'trabajo', titulo: nombreDePaso, detalle: serieTexto,
        ...(finDeLaCuenta ? { finMs: finDeLaCuenta } : { inicioMs: entreno.inicio }),
      };
    }
    if (!datos) return;
    muestraEnPantallaBloqueada(datos);
    // El reloj recibe lo mismo, más el deporte (para medir el pulso con el tipo de entreno correcto).
    enviaAlReloj({ ...datos, deporte: plan?.deporte ?? 'otro' });
    // Solo cuando cambia algo de lo que se ve; el resto (el entreno entero, el plan) cambia en cada tic y no debe mandar una actualización por segundo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hayEntreno, enDescanso, claveDePaso, nombreDePaso, serieTexto, siguienteNombre, finDelDescanso, finDeLaCuenta]);
  useEffect(() => { if (!hayEntreno) { quitaDePantallaBloqueada(); terminaEnReloj(); } }, [hayEntreno]);
  useEffect(() => () => { quitaDePantallaBloqueada(); terminaEnReloj(); }, []);


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
      textoDeHecho(hay.repsHechas, hay.unidadHecha),
      hay.weight ? `${desdeKilos(hay.weight, unidadDePeso)} ${etiquetaUnidad(unidadDePeso)}` : null,
    ].filter(Boolean).join(' · ');
  };

  const videoDe = (ex, m, opciones) => {
    if (!ex || !m || (!m.portada && !(m.videos?.length))) return null;
    return <TarjetaDeVideo key={ex.name} videos={m.videos ?? []} portada={m.portada} nombre={ex.name} {...opciones} />;
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

  // Lo que ya quedó anotado de un paso (de esta vuelta): `{ repsHechas, weight }`, o `{}`.
  const guardadoDe = (p) => {
    if (!p || p.tipo !== 'ejercicio' || p.lapsos > 1) return {};
    const exData = registro?.exercises?.[p.idx];
    return (p.vueltas > 1 ? anotadoEnVuelta(exData, p.vuelta - 1) : exData) ?? {};
  };

  const listo = (real) => {
    vibra('listo');
    const t = Date.now();
    setAhora(t);
    preparaAudio();
    const objetivo = paso;
    if (!objetivo) return;
    // Si de este paso se mandó una técnica, su id queda ligado a esta vuelta (`hechos[clave].tecnica`).
    const tecnica = tecnicasMandadas[objetivo.clave];
    if (tecnica) real = { ...(real ?? {}), tecnica };
    const clave = enfocado && objetivo === enfocado ? enfocado.clave : undefined;
    const kilos = kilosDe(objetivo);
    const ex = exDe(objetivo);
    /* Volver con «Anterior» y dar «Listo» sin tocar nada deja lo que ya estaba anotado; pero la marca tiene que decir que es de él, no «lo del
       plan»: si lo anotado difiere de lo planeado, viaja en la marca igual que cuando lo escribió. */
    if (objetivo.tipo === 'ejercicio' && real?.reps === undefined && real?.kg === undefined) {
      const g = guardadoDe(objetivo);
      const extra = {};
      if (g.repsHechas !== undefined && String(g.repsHechas).trim() !== '' && String(g.repsHechas) !== String(cantidadPlaneada(objetivo) ?? '')) extra.reps = String(g.repsHechas);
      if (g.weight !== undefined && String(g.weight).trim() !== '' && String(g.weight) !== String(kilos?.kg ?? '')) extra.kg = String(g.weight);
      if (Object.keys(extra).length) real = { ...(real ?? {}), ...extra };
    }
    escribe((prev) => {
      const siguiente = { ...prev, entreno: marcaListo(plan, prev?.entreno, t, real, clave) };
      if (objetivo.tipo !== 'ejercicio') return siguiente;
      const dato = exDataTrasListo({
        paso: objetivo, exData: prev?.exercises?.[objetivo.idx], kgPlaneados: kilos?.kg ?? null, conPeso: !!ex && isLoadedExercise(ex), real,
      });
      return dato ? { ...siguiente, exercises: { ...(prev?.exercises || {}), [objetivo.idx]: dato } } : siguiente;
    });
    setEnfoque(null);
    setLlegando(true);
  };
  const saltar = () => {
    const t = Date.now();
    setAhora(t);
    const clave = enfocado && paso === enfocado ? enfocado.clave : undefined;
    escribe((prev) => ({ ...prev, entreno: saltaPaso(plan, prev?.entreno, t, clave) }));
    setEnfoque(null);
    setLlegando(true);
  };
  // Mirando un paso que se tocó en «Ver todo», «Anterior» regresa a donde iba: asomarse a otro ejercicio no deshace lo hecho.
  const mirandoOtro = !!enfocado && paso === enfocado;
  const anterior = () => {
    setLlegando(false);
    setCerradoEn(null);
    if (mirandoOtro) { setEnfoque(null); return; }
    escribe((prev) => ({ ...prev, entreno: vuelveAtras(plan, prev?.entreno) }));
    setEnfoque(null);
  };
  const seguirDelDescanso = () => { preparaAudio(); listo(); };

  /* Lo que llega del Apple Watch: el pulso en vivo, y «Listo» / «Siguiente» tocados en la muñeca. Las funciones cambian en cada dibujo; se guardan en una referencia para que
     el oyente (que se arma una sola vez) siempre llame a la de ahora. */
  const [pulsoDelReloj, setPulsoDelReloj] = useState(null);
  const accionesDelReloj = useRef({});
  useEffect(() => { accionesDelReloj.current = { listo: () => listo(), siguiente: () => saltar() }; });
  useEffect(() => escuchaReloj({ alAccion: (a) => accionesDelReloj.current[a]?.(), alPulso: setPulsoDelReloj }), []);

  /* UN DESCANSO QUE LLEGA A CERO TERMINA SOLO: el pitido avisa y la app pasa a lo que sigue (un instante después, para que se oiga). Andrés (9 oct 2026,
     «Experiencia de workout 2.0»): el «+0:09» que seguía contando de más «podría perder el punto de que la app guíe en el entrenamiento y podría ser
     redundante con el botón de +30 s». «Seguir» lo adelanta; «+30 s» lo alarga antes de que acabe. Un descanso escrito con palabras no cuenta: espera «Seguir». */
  const descansoVencido = enDescanso && !!vista.descanso?.vencido;
  const sigueDelDescanso = useRef(null);
  useEffect(() => { sigueDelDescanso.current = seguirDelDescanso; });
  useEffect(() => {
    if (!descansoVencido) return undefined;
    const t = setTimeout(() => sigueDelDescanso.current?.(), 350);
    return () => clearTimeout(t);
  }, [descansoVencido]);
  const masDescanso = () => escribe((prev) => ({ ...prev, entreno: sumaDescanso(plan, prev?.entreno, 30) }));
  // El botón grande del descanso pausa y reanuda la cuenta (30 oct 2026); en pausa no avanza sola ni deja aviso del teléfono (su `fin` es `null`).
  const pausarDescanso = () => {
    const t = Date.now();
    setAhora(t);
    escribe((prev) => ({ ...prev, entreno: pausaDescanso(plan, prev?.entreno, t) }));
  };
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
  /* TERMINAR ES UN SOLO PASO (botones de la sesión, 29 oct 2026): ya no hay pantalla de «Entrenamiento terminado» con su «Terminar sesión». En el último paso, «Listo» es «Mantén para
     terminar» (`terminarManteniendo`), y desde «Ver todo» está «Terminar ahora». Guarda, cierra y abre la página del workout, que pone su celebración (`PaginaDeSesionGlobal`). */
  const terminando = useRef(false);
  const terminarSesion = () => {
    if (terminando.current) return;
    terminando.current = true;
    const t = Date.now();
    const ruta = recorrido.ruta();
    recorrido.limpia();
    escribe((prev) => ({
      ...prev,
      ...(ruta ? { ruta } : null),
      entreno: terminaEntreno(prev?.entreno, t),
      completed: true,
      completedAt: prev?.completed && prev?.completedAt ? prev.completedAt : new Date(t).toISOString(),
    }));
    alCerrar();
    // Fase 6 (29 oct 2026): «Terminar» ya no regresa al plan, lleva a la página de este workout con «Tus stickers están listos».
    alTerminado?.();
  };
  /* Ya no queda ningún paso y la sesión no está terminada: se termina de una vez. Pasa con datos viejos (un entreno que quedó completo antes de este cambio) y cuando lo último
     que se hizo no fue un «Listo» sino «Saltar» el último paso, «Anotar resultados» o el resultado de un reloj: si no, la pantalla se quedaría sin paso que enseñar. */
  const yaCompleto = vista.completo && !registro?.completed;
  useEffect(() => { if (yaCompleto) terminarSesion(); });  // `terminarSesion` se cuida sola de correr una vez
  // El último paso: marca «Listo» (con lo real que haya) y termina.
  const terminarManteniendo = (real) => { listo(real); terminarSesion(); };
  // Salir sin terminar: la línea del recorrido también se pasa a la sesión (así no depende solo de este teléfono).
  const cerrar = () => {
    const ruta = recorrido.ruta();
    if (ruta) escribe((prev) => ({ ...prev, ruta }));
    if (vista.hechos + vista.saltados > 0) avisa('Tu avance se guardó. Sigue cuando quieras.');
    alCerrar();
  };
  // La cámara de «grabar técnica» (también en la web): sale si la función está prendida y hay a quién mandársela (quien puso el ejercicio); apagada, solo explica que viene.
  const tecnicaActiva = FUNCIONES.grabarTecnica && !!destinoDeTecnica?.id;
  // La guía completa («Ver todo», el par A/B, el cronómetro de cada paso) es de la app descargable; la web va con la básica (ver `lib/funciones.js`).
  const completo = FUNCIONES.entrenoCompleto;
  const abreTecnica = () => { if (tecnicaActiva) setGrabandoTecnica(paso); else setHoja('tecnica'); };
  const nombreDelDestino = (destinoDeTecnica?.nombre ?? '').trim().split(/\s+/)[0] || 'tu coach';
  // Lo que se le pasa a las pantallas del paso: prendida, la cámara con su ✓ si ya se mandó una de esta serie; apagada, su «Pronto» (solo en la guía completa).
  const tecnicaDelPaso = FUNCIONES.grabarTecnica
    ? (tecnicaActiva && paso ? { activa: true, etiqueta: `Grabar técnica para ${nombreDelDestino}`, onClick: abreTecnica, enviada: !!tecnicasMandadas[paso.clave] } : null)
    : (completo ? { activa: false, etiqueta: palabras.tecnicaTitulo, onClick: abreTecnica } : null);

  // El último paso que queda (contando los opcionales): ahí «Listo» se termina manteniendo el botón (ver `terminarManteniendo`).
  const esUltimo = !!paso && esElUltimoPaso(plan, entreno, paso);

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
  /* El fondo va teñido del color del tipo en TODA la sesión (reestructura visual, 15 oct 2026: «Fuerza» morado clarito, «Cardio» rojo clarito, como en las
     capturas de Andrés); antes solo en el descanso. */
  const fondo = aspecto?.fondo ? `${aspecto.fondo}, ${LT.bg}` : LT.bg;
  const colorDelTipo = aspecto?.fuerte ?? null; // oscurecido lo justo para la letra blanca encima
  const segmentos = segmentosDeAvance(plan, vista.estados);
  /* El tiempo que llevas: arriba, en una pastilla, y al final en el resumen. Lo quitamos del paso (9 oct, mañana: «letritas grises») y esa noche
     Andrés lo extrañó: «en ningún momento puedo ver cuánto tiempo llevo entrenando». Pasadas muchas horas (retomar al día siguiente) no se dice. */
  const tiempo = tiempoTotal(vista.transcurrido) ?? '';
  // El paso que toca, o (en un descanso) el que viene: de ahí salen los puntos de las vueltas y lo que se resalta en «Ver todo».
  const queToca = enDescanso ? vista.siguiente : paso;
  const resumenDeLaSerieDelPaso = paso?.tipo === 'ejercicio' ? resumenDeLaSerie(plan, vista.estados, paso) : null;

  const siguienteDeDescanso = enDescanso && vista.siguiente ? {
    nombre: vista.siguiente.tipo === 'reloj' ? vista.siguiente.resumen : vista.siguiente.nombre,
    detalle: vista.siguiente.tipo === 'reloj' ? '' : textoDeLoPlaneado(vista.siguiente, kilosDe(vista.siguiente)),
    puntos: vista.siguiente.tipo === 'ejercicio' ? puntosDeVueltas(plan, vista.estados, vista.siguiente.serie, vista.siguiente.clave) : [],
  } : null;

  const kilosDelPaso = kilosDe(paso);
  const camposCambiar = paso && paso.tipo === 'ejercicio' ? camposDeCambiar(paso, { conPeso: conPeso(paso) }) : [];
  // «Anotar resultados» arranca en lo que ya se anotó de este paso; solo lo que aún no tiene nada arranca en lo planeado.
  const anotadoYa = guardadoDe(paso);
  const loAnotado = {
    ...(String(anotadoYa.repsHechas ?? '').trim() !== '' ? { reps: String(anotadoYa.repsHechas) } : null),
    ...(String(anotadoYa.weight ?? '').trim() !== '' ? { kg: String(desdeKilos(anotadoYa.weight, unidadDePeso)) } : null),
  };
  const cambiar = camposCambiar.length > 0 ? {
    campos: camposCambiar,
    planeado: { reps: cantidadPlaneada(paso) ?? '', kg: kilosDelPaso ? String(kilosDelPaso.numero) : '' },
  } : null;

  /* Qué dice el botón de ajustar lo hecho. Era «Cambiar reps o kilos» (9 oct 2026: «¿cambiar qué?»); Andrés, 16 oct 2026: «cambia el botón de "cambiar reps" por
     "anotar resultados"». Es lo que se hace ahí: anotar lo que salió, sea reps, kilos o tiempo. */
  const textoDeCambiar = cambiar ? 'Anotar resultados' : null;

  const sinPasos = !paso;
  if (sinPasos) return null;

  let pantalla;
  if (antes) {
    pantalla = (
      <PantallaAntesDeEmpezar
        nombre={sinDuracion(dia.name || '') || 'Tu sesión'} notas={notasDeLaSesion}
        clase={claseDeLaSesion ? <TarjetaDeClase clase={claseDeLaSesion} nombre={dia.name || ''} /> : null}
        onEmpezar={() => { preparaAudio(); setAntes(false); }} onSalir={cerrar}
      />
    );
  } else if (enDescanso) {
    pantalla = (
      <PantallaDeDescanso
        descanso={vista.descanso} siguiente={siguienteDeDescanso} video={videoDe(exDe(vista.siguiente), mediosDelSiguiente, { enCarta: true, altoMaximo: '30vh' })} sonido={sonido}
        puedeAnterior={vista.puedeAnterior} onSeguir={seguirDelDescanso} onMas={masDescanso} onPausa={pausarDescanso} onAnterior={anterior} onSonido={alternaSonido} color={colorDelTipo}
      />
    );
  } else if (paso.tipo === 'reloj') {
    pantalla = (
      <PantallaDeReloj
        paso={paso} detalle={detalleDelReloj(paso)} resultado={resultadoDelReloj} puedeAnterior={vista.puedeAnterior || mirandoOtro}
        enMarcha={relojAMedias(`${userId}:${sesionId}:${paso.claveFormato}`)}
        onIniciar={() => { preparaAudio(); setReloj(true); }} onAnotar={() => setAnotando(true)} onListo={() => listo()}
        onSaltar={saltar} onAnterior={anterior} tecnica={tecnicaDelPaso} color={colorDelTipo}
        esUltimo={esUltimo} onTerminar={() => terminarManteniendo()}
      />
    );
  } else {
    const siguiente = vista.siguiente && vista.siguiente !== paso ? (vista.siguiente.tipo === 'reloj' ? vista.siguiente.resumen : vista.siguiente.nombre) : '';
    pantalla = (
      <PantallaDePaso
        // El video toma el alto y el ancho que le da el acomodo del paso (ver `lib/acomodoDelPaso.js`).
        paso={paso} video={paso.tipo === 'ejercicio' ? videoDe(exDe(paso), mediosDelPaso, { alto: 'var(--vh)', anchoMaximo: 'var(--vid-max, 100%)', sinMargen: true }) : null}
        cifras={cifrasConExplicacion(paso, kilosDelPaso)} anotado={anotadoDe(paso)}
        onQueEs={(c) => {
          setQueEs(queEsLaCifra(c, kilosDelPaso ? `${kilosDelPaso.aprox ? '≈' : ''}${kilosDelPaso.valor} ${kilosDelPaso.unidad}` : null));
          setQueEsVisto(true);
          try { window.localStorage.setItem(LLAVE_QUE_ES, '1'); } catch { /* sin almacenamiento: el globo puede volver a salir */ }
        }}
        globo={!queEsVisto}
        notaDe={destinoDeTecnica?.nombre?.trim()
          ? { texto: `Nota de ${nombreDelDestino}`, inicial: nombreDelDestino.charAt(0).toUpperCase() }
          : { texto: salud ? 'Nota de tu fisio' : 'Nota de tu coach', inicial: null }}
        sigue={siguiente} resumen={resumenDeLaSerieDelPaso}
        cronometro={completo && paso.termina?.por === 'tiempo' ? (
          <CronometroDelPaso segundos={paso.termina.valor ?? paso.termina.min} cuenta={cuenta} onEmpezar={empezarCronometro} onQuitar={detenerCronometro} />
        ) : null}
        etiquetaDeCambiar={textoDeCambiar} puedeAnterior={vista.puedeAnterior || mirandoOtro}
        onListo={() => listo()} onCambiar={() => setHoja('cambiar')} onSaltar={saltar} onAnterior={anterior}
        tecnica={tecnicaDelPaso} color={colorDelTipo} esUltimo={esUltimo} onTerminar={() => terminarManteniendo()}
        onUsarGps={esPasoConGps(paso) && fuenteDeUbicacion().disponible() && (cerradoGps === paso.clave || sinGps[paso.nombre]) ? () => {
          setCerradoGps(null);
          const { [paso.nombre]: _quitado, ...resto } = sinGps;
          setSinGps(resto);
          try { window.localStorage.setItem(LLAVE_SIN_GPS, JSON.stringify(resto)); } catch { /* sin almacenamiento */ }
        } : null}
      />
    );
  }

  const ejerciciosDelReloj = paso?.tipo === 'reloj' ? paso.miembros.map((m) => ({ ex: dia.exercises[m.idx], idx: m.idx })) : [];
  // Un Set en lapsos corre los tramos que armó el motor (ver `pasosDeLaSesion`); un formato, los suyos.
  const tramosDelReloj = paso?.tipo === 'reloj' ? (paso.deLapsos ? paso.tramos.filter((t) => t.tipo === 'trabajo').length : tramosDeTrabajo(paso.formato, paso.miembros.length)) : 0;
  const nombreDelReloj = paso?.deLapsos ? 'Lapsos personalizados' : paso?.resumen;
  // El reloj se abre SOLO cuando se llegó avanzando a un Set con reloj que no tiene resultado, y la persona no lo cerró ya.
  const relojSolo = llegando && paso?.tipo === 'reloj' && !mirandoOtro && !resultadoDelReloj && !anotando && cerradoEn !== paso.claveFormato;
  const cierraReloj = () => { setReloj(false); setCerradoEn(paso?.claveFormato ?? null); };
  // ¿El paso que toca va con mapa? 200 m o más, el teléfono tiene GPS, no lo cerró y no eligió «Sin GPS» para ese ejercicio. En la pantalla del final o en
  // «Antes de empezar», no.
  const conGps = !antes && !enDescanso && !!paso && esPasoConGps(paso) && fuenteDeUbicacion().disponible()
    && cerradoGps !== paso.clave && !sinGps[paso.nombre]
    // Mientras no contesta «¿Guardamos tu recorrido?», el mapa espera: si no, la pregunta quedaría tapada debajo.
    && (recorrido.permiso !== null || !recorrido.disponible);

  // «Sin GPS» para un ejercicio: se recuerda en este teléfono. Lo usan el sprint y los lapsos por distancia del reloj.
  const eligeSinGps = (nombre) => {
    const nuevo = { ...sinGps, [nombre]: true };
    setSinGps(nuevo);
    try { window.localStorage.setItem(LLAVE_SIN_GPS, JSON.stringify(nuevo)); } catch { /* sin almacenamiento: vale por ahora */ }
  };
  // «Siguiente: …» de la pantalla con mapa: el descanso que sigue, o el siguiente ejercicio con lo que pide («400 m a 4:25 min/km»).
  const sigPasoGps = paso?.i != null ? plan.pasos[paso.i + 1] : null;
  const siguienteDeGps = !sigPasoGps ? null : (sigPasoGps.tipo === 'descanso'
    ? `Descanso${sigPasoGps.texto ? ` ${sigPasoGps.texto}` : ''}`
    : [sigPasoGps.nombre === paso.nombre ? null : sigPasoGps.nombre, pedidoEnUnaLinea(sigPasoGps.texto || '', sigPasoGps.meta?.texto ?? '')].filter(Boolean).join(' · '));
  // Los lapsos por distancia del reloj también llevan mapa; mismas condiciones que el paso (el teléfono tiene GPS y ya contestó «¿Guardamos tu recorrido?»).
  const gpsEnElReloj = fuenteDeUbicacion().disponible() && (recorrido.permiso !== null || !recorrido.disponible);

  return createPortal(
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: '100dvh', zIndex: 3000, background: fondo, display: 'flex', flexDirection: 'column', fontFamily: FONT,
      }}
    >
      <BarraDelEntreno
        segmentos={segmentos} fondo={fondo} palabras={palabras} tiempo={tiempo || null} color={colorDelTipo ?? undefined}
        onLista={() => { setLlegando(false); setHoja('lista'); }}
      />
      {/* El paso con GPS (200 m o más) ocupa el lugar del paso normal, con la barra «Workout» arriba; «Sin GPS» o cerrar el mapa devuelve el paso normal. */}
      {conGps ? (
        <PasoConGps
          key={paso.clave} paso={paso} meta={metrosDelPaso(paso)} carga={paso.meta?.texto ?? ''} color={colorDelTipo ?? undefined} siguiente={siguienteDeGps} pulso={pulsoDelReloj}
          onTermina={({ metros, seg, fin }) => {
            // Si el sprint fue lo primero del entreno, el entreno empezó cuando arrancó el sprint (no al marcarlo): si no, el tiempo total no lo contaría.
            escribe((prev) => ({ ...prev, entreno: iniciaEntreno(prev?.entreno, fin - seg * 1000, plan) }));
            listo({ reps: cantidadEnUnidad(metros, paso.termina.unidad), seg });
          }}
          arrancaSolo={llegando}
          onSinGps={() => eligeSinGps(paso.nombre)}
          onAnotar={({ metros }) => { setMedidoGps({ clave: paso.clave, reps: cantidadEnUnidad(metros, paso.termina.unidad) }); setCerradoGps(paso.clave); setHoja('cambiar'); }}
          onCerrar={() => setCerradoGps(paso.clave)}
        />
      ) : pantalla}
      {/* «¿Guardamos tu recorrido?»: una sola vez por teléfono, al abrir el primer entreno guiado. */}
      {recorrido.disponible && recorrido.permiso === null && <HojaDelRecorrido onSi={() => recorrido.decide('si')} onNo={() => recorrido.decide('no')} />}

      {hoja === 'lista' && (
        <HojaDeLista
          tarjetas={tarjetasDeLaLista(plan, vista.estados, queToca?.clave ?? null, { kilosDe, resultadoDe })} miniaturaDe={miniaturaDeFila} palabras={palabras}
          onElegir={(clave) => { setLlegando(false); setEnfoque(clave); setHoja(null); }}
          onTerminar={terminarSesion}
          onSalir={cerrar}
          onCerrar={() => setHoja(null)}
        />
      )}
      {hoja === 'cambiar' && cambiar && (
        <HojaDeCambiar
          campos={cambiar.campos} planeado={cambiar.planeado} inicial={medidoGps && medidoGps.clave === paso?.clave ? { ...loAnotado, reps: medidoGps.reps } : loAnotado} unidadDePeso={etiquetaUnidad(unidadDePeso)}
          resumen={textoDeLoPlaneado(paso, kilosDelPaso)}
          onGuardar={(tocado) => {
            setHoja(null);
            setMedidoGps(null);
            const real = {};
            if (tocado.reps !== undefined && tocado.reps !== '') real.reps = tocado.reps;
            if (tocado.kg !== undefined && tocado.kg !== '') real.kg = String(aKilos(tocado.kg, unidadDePeso));
            listo(Object.keys(real).length ? real : undefined);
          }}
          onCerrar={() => { setHoja(null); setMedidoGps(null); }}
        />
      )}
      {hoja === 'tecnica' && <HojaDeTecnica palabras={palabras} onCerrar={() => setHoja(null)} />}
      {queEs && <HojaDeQueEs titulo={queEs.titulo} texto={queEs.texto} color={colorDelTipo} onCerrar={() => setQueEs(null)} />}
      {grabandoTecnica && tecnicaActiva && (
        <Suspense fallback={null}>
          <GrabaTecnica
            atletaId={userId} destino={destinoDeTecnica} sesionId={sesionId} clave={grabandoTecnica.clave}
            ejercicio={grabandoTecnica.tipo === 'ejercicio' ? grabandoTecnica.nombre : (grabandoTecnica.resumen || 'Set')}
            detalle={grabandoTecnica.tipo === 'ejercicio' && grabandoTecnica.vueltas > 1 ? `Serie ${grabandoTecnica.vuelta} de ${grabandoTecnica.vueltas}` : null}
            intentoDe={tecnicasMandadas[grabandoTecnica.clave] ?? null}
            alEnviar={(id) => setTecnicasMandadas((prev) => ({ ...prev, [grabandoTecnica.clave]: id }))}
            alCerrar={() => setGrabandoTecnica(null)}
          />
        </Suspense>
      )}

      {!antes && (reloj || relojSolo) && paso?.tipo === 'reloj' && (
        <RelojDelBloque
          key={paso.claveFormato}
          formato={paso.formato} plan={paso.tramos ?? null} ejercicios={ejerciciosDelReloj} serie={paso.serie} resumen={nombreDelReloj}
          clave={`${userId}:${sesionId}:${paso.claveFormato}`} empezarYa={reloj} conCuenta={!reloj} onGuardar={guardaResultado} onCerrar={cierraReloj}
          conGps={gpsEnElReloj} sinGps={sinGps} alElegirSinGps={eligeSinGps} colorDelTipo={colorDelTipo ?? undefined} fondo={fondo}
          videoDe={(ex) => videoDe(ex, medios?.(ex) ?? null, { altoMaximo: '24vh' })}
          miniaturaDe={(ex) => { const m = medios?.(ex); return m && (m.portada || m.videos?.[0]) ? <Portada foto={m.portada} video={m.videos?.[0]?.url} desde={m.videos?.[0]?.inicio} hasta={m.videos?.[0]?.fin} style={{ position: 'absolute', inset: 0 }} /> : null; }}
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
