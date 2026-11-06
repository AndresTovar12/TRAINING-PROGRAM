import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Loader2, Maximize2, Minimize2, Settings, Watch } from 'lucide-react';
import { FONT, NUM_STYLE } from '@/lib/theme';
import { MINIMO_DE_SEGUNDOS, relojDeCronometro } from '@/lib/entrenoLibre';
import { guardaEntrenoLibre } from '@/lib/entrenoLibreApi';
import { nombreDelDeporte } from '@/lib/metricas/deportes';
import { miles } from '@/lib/metricas/formato';
import { enVivo, fuenteDeUbicacion, textoDeRitmo } from '@/lib/ubicacion';
import { escuchaPantallaBloqueada, muestraEnPantallaBloqueada, quitaDePantallaBloqueada } from '@/lib/pantallaBloqueada';
import { enviaAlReloj, terminaEnReloj } from '@/lib/relojApple';
import { useAviso } from '@/components/AvisoPasajero';
import IconoDeTipo from '@/components/IconoDeTipo';
import { Fila, Grupo, Interruptor, Segmentado } from '@/components/ui';
import { useStorageOpcional } from '@/contexts/AppStateContext';
import MapaDeCarrera from './MapaDeCarrera';
import { actividadDeDeporte } from '@/lib/actividades';
import { LLAVE_PAUSA_AUTOMATICA, useSenalGps, useUbicacionActual } from './useEntrenoLibre';
import { TIPOS_DE_MAPA, guardaTipoDeMapa, leeTipoDeMapa, usaMapaNativo } from '@/lib/mapaNativo';
import { useBarraDeEstadoClara } from '@/lib/barraDeEstado';
import { abrePerfil } from '@/lib/abrePerfil';
import { Hoja, HojaDelRecorrido } from '@/features/training/PantallasDelEntreno';
import { guardaPermisoDelRecorrido, permisoDelRecorrido } from '@/features/training/useRecorrido';
import { saludDisponible } from '@/lib/saludDelTelefono';
import { AvisoDeCorta, HojaDeAbajo, NumeroGrande, Pulso, TituloDePausa } from './PiezasDeCarrera';
import { C, redondo, usePulsoDelReloj } from './carrera';
import { useBarraDeLaApp } from './barraDeLaApp';
import { useAuth } from '@/contexts/AuthContext';
import { useReloj } from '@/lib/relojConectado';
import { nombreDeTraza, ponTrazaEncendida, trazaEncendida, ultimaTraza } from '@/lib/trazaGps';
import { entregaArchivo } from '@/lib/entregaArchivo';

/* LA CARRERA CON GPS A PANTALLA COMPLETA. Desde el 2 nov 2026, la forma de las capturas que le gustaron a Andrés con los colores de Training Lab (maqueta
   WVcKiJ2JhyChJqLwP3bhHD, colores A, línea «con brillo»; spec `docs/superpowers/specs/2026-11-02-pantalla-de-carrera.md`):
     1. Antes de salir: el mapa entero, «GPS listo» y una fila de tres botones redondos: la actividad, «INICIAR» (azul) y «AJUSTES». La barra de la app se queda.
     2. Corriendo, los números: fondo negro, el tiempo arriba en rojo y el ritmo y la distancia enormes. Un solo botón: «Pausar».
     3. Corriendo, el mapa: el ícono de arriba cambia a la vista de mapa, con una tarjeta negra (tiempo, ritmo y distancia). Se recuerda durante esa carrera.
     4. En pausa (desde las dos vistas): el mapa teñido de azul desde arriba, «EN PAUSA», la tarjeta en gris y «Reanudar» o «Finalizar» (se mantiene).
        «Finalizar» guarda; con menos de 30 s sale «Carrera demasiado corta». Al guardar sigue el resumen de siempre (celebración y stickers).
   EL MAPA ES UNO SOLO desde «antes de salir» hasta finalizar: va detrás de todo y, en los números, queda tapado por el negro (vivo, siguiendo al corredor). Así
   cambiar de vista o pausar es instantáneo y el mapa de Apple no se vuelve a crear.
   Correr, caminar, bici y senderismo; los demás deportes siguen con el cronómetro (`PantallaDelCronometro`, la misma pantalla de números sin mapa).
   La fuente de los puntos es intercambiable (`lib/ubicacion.js`): hoy el navegador, en la app de la tienda el teléfono o el reloj. */

/** La última vista (números o mapa) de la carrera que va: se recuerda aunque se minimice y se vuelva a abrir (por su hora de inicio). */
const vistaGuardada = { inicio: null, vista: 'numeros' };
/** El ícono de la actividad en la pantalla bloqueada (SF Symbols). */
const SIMBOLO = { correr: 'figure.run', caminar: 'figure.walk', senderismo: 'figure.hiking', bici: 'figure.outdoor.cycle', natacion: 'figure.pool.swim' };
/** En pausa el mapa se tiñe de azul desde arriba y se desvanece hacia la mitad (va en la página, encima del mapa). */
const TINTE = 'linear-gradient(180deg, rgba(47,85,240,0.55) 0%, rgba(20,20,60,0.35) 45%, rgba(0,0,0,0) 75%)'; /* estilo-ok: el tinte azul de la pausa, maqueta aprobada (2 nov 2026) */
/** Los botones redondos sobre el mapa: casi negros, como los del mapa. */
const sobreElMapa = { ...redondo, background: 'rgba(10,10,14,0.85)' };

// La hora de ahora, en grande, para «listo para empezar» sin mapa (gimnasio, pádel…), como el «Entreno» de Aura.
const horaDeAhora = () => {
  const [hora, ...resto] = new Date().toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' }).split(/\s+/);
  return { hora, sufijo: resto.join(' ') }; // «10:49» en grande y «p.m.» chico (junto no cabe en un teléfono)
};

/* `actividad`: la que eligió (`lib/actividades.js`; desde el 23 oct 2026, Activity Tracker): su nombre y su ícono se ven aquí, y si NO lleva mapa (gimnasio, pádel) «listo
   para empezar» enseña la hora en grande en vez del mapa y arranca el cronómetro sin GPS. Con mapa, «INICIAR» espera a que el GPS esté listo (en Aura los primeros
   segundos daban ritmos absurdos); «Empezar sin GPS» (en Ajustes) sigue ahí por si la señal no llega. */
export default function PantallaDeCarrera({ userId, crono, pendiente = null, actividad = null, alEmpezar, alMinimizar, alCambiarDeporte, alGuardado }) {
  const { cronometro, segundos, muestras } = crono;
  const { avisa } = useAviso();
  const barra = useBarraDeLaApp();
  /* EMPEZAR. Una actividad sin mapa (pádel, gimnasio) también se sigue en silencio para la línea de los stickers (sección 8b): la primera vez se pregunta UNA vez
     «¿Guardamos tu recorrido?» (la misma pregunta del entreno guiado) y después ya no. Con «Ahora no» todo funciona igual, sin línea. «Sin GPS» en cardio no se sigue. */
  const [preguntaRuta, setPreguntaRuta] = useState(null); // lo que se iba a empezar, mientras contesta
  const empieza = (opciones) => {
    if (opciones.silencio && fuenteDeUbicacion().disponible() && permisoDelRecorrido() === null) { setPreguntaRuta(opciones); return; }
    alEmpezar(opciones);
  };
  const contesta = (v) => { guardaPermisoDelRecorrido(v); const o = preguntaRuta; setPreguntaRuta(null); alEmpezar(o); };
  // «Reloj»: en la app del iPhone lleva a Mi perfil → Dispositivos (la carrera se minimiza para que se vea); en la web solo lo dice.
  const conectaReloj = () => {
    if (!saludDisponible()) { avisa('Con la app descargable, tu Apple Watch manda el pulso y las calorías mientras entrenas'); return; }
    alMinimizar?.();
    abrePerfil('dispositivos');
  };
  const deporte = pendiente ?? cronometro?.deporte ?? 'correr';
  const act = actividad ?? cronometro?.actividad ?? null;
  const nombre = act?.nombre ?? nombreDelDeporte(deporte);
  const icono = act ?? actividadDeDeporte(deporte);
  const conMapa = act ? !!act.gps : true;
  const enBici = deporte === 'bici';
  // Nadar (6 nov 2026): metros y ritmo por 100 m, como la página del entreno y los stickers; las demás actividades siguen en km y /km.
  const enAgua = deporte === 'natacion';
  const pausado = cronometro?.pausadoEn != null;
  // La pausa que puso la app porque te detuviste (se quita sola al volver a moverte) se nombra distinto de la que pusiste tú.
  const automatica = !!cronometro?.automatica;
  const [vista, cambiaVista] = useState(() => (cronometro && vistaGuardada.inicio === cronometro.inicio ? vistaGuardada.vista : 'numeros'));
  const ponVista = (v) => { vistaGuardada.inicio = cronometro?.inicio ?? null; vistaGuardada.vista = v; cambiaVista(v); };
  const [ajustes, setAjustes] = useState(false);
  const [tipoDeMapa, setTipoDeMapa] = useState(leeTipoDeMapa);
  const [pausaAutomatica, setPausaAutomatica, conAjustes] = useStorageOpcional(LLAVE_PAUSA_AUTOMATICA, true);
  /* «Guardar traza del GPS» (2 nov 2026, `lib/trazaGps.js`): solo para las cuentas de prueba (las de la tabla `cuentas_de_prueba`, `soy_cuenta_de_prueba`) y el
     dueño, el mismo criterio de «Probar como si tuviera Apple Watch» en Mi perfil → Dispositivos. */
  const { profile } = useAuth();
  const { soyDePrueba } = useReloj();
  const deFabrica = !!profile?.is_owner || soyDePrueba;
  const [conTraza, setConTraza] = useState(trazaEncendida);
  const [traza, setTraza] = useState(null);
  const [corta, setCorta] = useState(false); // «Carrera demasiado corta», al finalizar antes de 30 s
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  useBarraDeEstadoClara(true); // todas las pantallas de la carrera son oscuras: la hora y la batería en letras claras
  const senal = useSenalGps(!!pendiente && conMapa);
  const aqui = useUbicacionActual(!!pendiente && conMapa);
  // Al arrancar todavía no hay puntos de la carrera: el mapa se queda en donde estabas (y no regresa a donde abrió).
  const [ultimoAqui, setUltimoAqui] = useState(aqui);
  if (aqui && aqui !== ultimoAqui) setUltimoAqui(aqui);
  const paraElMapa = useMemo(() => {
    if (pendiente) return aqui ? [aqui] : [];
    return muestras.length ? muestras : (ultimoAqui ? [ultimoAqui] : []);
  }, [pendiente, aqui, muestras, ultimoAqui]);
  // Sin mapa, «listo para empezar» enseña la hora: que avance sola.
  const [, setTic] = useState(0);
  useEffect(() => {
    if (!pendiente || conMapa) return undefined;
    const id = setInterval(() => setTic((t) => t + 1), 15000);
    return () => clearInterval(id);
  }, [pendiente, conMapa]);
  const vivo = useMemo(() => enVivo(muestras), [muestras]);
  const km = vivo.distanciaM / 1000;
  const promedio = km > 0.05 ? segundos / km : null;
  const corriendoLibre = !!cronometro;
  const pulso = usePulsoDelReloj(corriendoLibre);

  /* La pantalla bloqueada, la isla dinámica y el Apple Watch: tiempo, distancia y ritmo. Con el GPS del teléfono corriendo, la app sigue despierta aunque se bloquee la pantalla, así que se
     actualiza cada 10 s (el cronómetro avanza solo, con la hora de inicio, que no cambia mientras no se pause). Pausa y reanudar se mandan al instante.
     Desde el 2 nov 2026 la pantalla bloqueada es la tarjeta negra de la vista de mapa: los números van sin unidad (la etiqueta la lleva) y, en pausa, el tiempo fijo. */
  const vivos = useRef({});
  useEffect(() => { vivos.current = { km, ritmo: vivo.ritmoSKm, promedio, segundos, nombre, deporte, enBici, enAgua, cronometro, pulso, crono }; });
  useEffect(() => {
    if (!corriendoLibre) { quitaDePantallaBloqueada(); terminaEnReloj(); return undefined; }
    const publica = () => {
      const v = vivos.current;
      const ritmo = textoDelRitmo(pausado ? v.promedio : v.ritmo, v.enBici, v.enAgua);
      const datos = {
        nombre: v.nombre, titulo: v.nombre, tipo: pausado ? 'pausa' : 'cardio',
        detalle: pausado ? (automatica ? 'Pausa automática' : 'En pausa') : v.enAgua ? `${miles(v.km * 1000)} m · ${ritmo} /100 m` : `${v.km.toFixed(2)} km · ${ritmo} ${v.enBici ? 'km/h' : '/km'}`,
        distancia: v.km.toFixed(2), ritmo, etiquetaRitmo: etiquetaDelRitmo(v.enBici, pausado, v.enAgua), simbolo: SIMBOLO[v.deporte] ?? 'figure.run',
        ...(v.pulso ? { pulso: v.pulso } : {}),
        // La hora de inicio FIJA (el inicio real más lo que lleva en pausa): el reloj de la pantalla bloqueada cuenta solo desde ahí. Antes se recalculaba cada
        // 10 s con los segundos enteros y el reloj brincaba un segundo atrás o adelante. En pausa no corre: va lo que lleva.
        ...(pausado || !v.cronometro ? { transcurridoS: v.segundos } : { inicioMs: v.cronometro.inicio + (v.cronometro.pausas ?? 0) }),
      };
      muestraEnPantallaBloqueada(datos);
      const { pulso: _delReloj, ...alReloj } = datos; // el pulso lo manda el reloj: no se le regresa
      enviaAlReloj({ ...alReloj, deporte: v.deporte });
    };
    publica();
    const id = setInterval(publica, 10000);
    return () => clearInterval(id);
  }, [corriendoLibre, pausado, automatica]);
  useEffect(() => () => { quitaDePantallaBloqueada(); terminaEnReloj(); }, []);
  // El botón redondo de la tarjeta en la pantalla bloqueada (iOS 17): pausa o reanuda aquí.
  useEffect(() => escuchaPantallaBloqueada((accion) => {
    const { cronometro: c, crono: cr } = vivos.current;
    if (!c || !cr) return;
    if (accion === 'pausa' && c.pausadoEn == null) cr.pausa();
    else if (accion === 'reanuda' && c.pausadoEn != null) cr.reanuda();
  }), []);

  /* FINALIZAR (se mantiene 1 s) guarda. Con menos de `MINIMO_DE_SEGUNDOS` no se guarda: sale el aviso «Carrera demasiado corta». */
  const finaliza = () => {
    const t = crono.termina();
    if (!t) return;
    if (t.duracionS < MINIMO_DE_SEGUNDOS) { setCorta(true); return; }
    guardar(t);
  };
  const guardar = async (t) => {
    setGuardando(true); setError(null);
    try {
      const fila = await guardaEntrenoLibre({
        atletaId: userId, deporte: t.deporte, inicioMs: t.inicioMs, duracionS: t.duracionS, distanciaM: null, muestras: t.muestras,
        titulo: t.actividad?.nombre ?? null, llevaDistancia: t.actividad ? !!t.actividad.gps : null,
      });
      crono.descarta();
      alGuardado(fila, { muestras: t.muestras, actividad: t.actividad });
    } catch (e) {
      setError(e?.message ?? 'No se pudo guardar. Revisa tu conexión e inténtalo otra vez.');
      setGuardando(false);
    }
  };

  // La barra de abajo de la app, dentro de «listo para empezar»: se mide para que la fila de «INICIAR» quede arriba de ella (y del punto ● que sobresale).
  const raiz = useRef(null);
  const [altoBarra, setAltoBarra] = useState(0);
  const conBarra = !!pendiente && !!barra;
  useLayoutEffect(() => {
    const nav = conBarra ? raiz.current?.querySelector('[data-barra-de-la-app]') : null;
    if (!nav || typeof ResizeObserver === 'undefined') return undefined;
    const ojo = new ResizeObserver(() => setAltoBarra(Math.round(nav.getBoundingClientRect().height)));
    ojo.observe(nav);
    return () => ojo.disconnect();
  }, [conBarra]);

  const fase = pendiente ? 'antes' : pausado ? 'pausa' : vista; // antes | numeros | mapa | pausa
  const enMapa = fase !== 'numeros';
  const pantalla = (hijos) => createPortal(
    <div ref={raiz} role="dialog" aria-modal="true" aria-label={nombre} data-mapa-portal style={{ position: 'fixed', inset: 0, zIndex: 3200, background: C.negro, color: C.texto, fontFamily: FONT, overflow: 'hidden' }}>
      {/* El mapa, siempre en el mismo lugar del árbol: el mismo desde «antes de salir» hasta finalizar. */}
      {conMapa && (
        <div style={{ position: 'absolute', inset: 0 }}>
          <MapaDeCarrera muestras={paraElMapa} alto="100%" redondo={false} puntoAzul pantallaCompleta interactivo oculto={!enMapa} clavePanel={fase} />
        </div>
      )}
      {hijos}
    </div>,
    document.body,
  );

  /* 1 · ANTES DE SALIR («listo para empezar»: lo que abre el punto ● de la barra) */
  if (pendiente) {
    const lista = senal === 'lista';
    const sinGps = senal === 'no_hay' || senal === 'negado';
    const esperandoGps = conMapa && senal === 'buscando';
    const textoSenal = { lista: 'GPS listo', buscando: 'Buscando GPS…', negado: 'Sin permiso de ubicación', sin_senal: 'Sin señal de GPS', no_hay: 'Sin GPS' }[senal];
    const lado = { display: 'grid', justifyItems: 'center', gap: 6, border: 'none', background: 'transparent', color: '#fff', cursor: 'pointer', fontFamily: FONT, fontSize: 10.5, fontWeight: 800, letterSpacing: '0.06em', padding: 0, width: 80, touchAction: 'manipulation' };
    const circulo = { width: 52, height: 52, borderRadius: 26, background: C.redondo, display: 'grid', placeItems: 'center', position: 'relative', color: '#fff' };
    const rotulo = { maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
    const abreAjustes = () => { setTipoDeMapa(leeTipoDeMapa()); setConTraza(trazaEncendida()); setTraza(ultimaTraza()); setAjustes(true); };
    const exportaTraza = async () => {
      const t = ultimaTraza();
      if (!t) return;
      try { await entregaArchivo(new Blob([JSON.stringify(t)], { type: 'application/json' }), nombreDeTraza(t)); } catch { avisa('No se pudo exportar la traza'); }
    };
    return pantalla(
      <>
        {!conMapa && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, paddingBottom: 160 }}>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: C.gris }}>Hora actual</span>
            <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 88, fontWeight: 800, letterSpacing: -3, lineHeight: 1, ...NUM_STYLE }}>{horaDeAhora().hora}</span>
              <span style={{ fontSize: 22, fontWeight: 700, color: C.gris }}>{horaDeAhora().sufijo}</span>
            </span>
            <span style={{ fontSize: 13.5, fontWeight: 600, color: C.gris }}>Sin reloj: la app lleva tu tiempo</span>
          </div>
        )}
        {/* Arriba a la izquierda, cerrar. La brújula la pone el mapa, arriba a la derecha. */}
        <button type="button" onClick={alMinimizar} aria-label="Cerrar" style={{ ...sobreElMapa, position: 'absolute', zIndex: 2, top: 'calc(14px + env(safe-area-inset-top))', left: 16 }}><ChevronDown size={22} /></button>
        {/* Abajo, sin fondo (se ve el mapa): «GPS listo» y la fila de tres botones redondos. Los botones del mapa van 12 px arriba de esto (`data-mapa-panel`). */}
        <div
          data-map-overlay data-mapa-panel
          style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, padding: `0 16px ${altoBarra ? `${altoBarra + 30}px` : 'calc(26px + env(safe-area-inset-bottom))'}` }}
        >
          {conMapa && (
            <span role="status" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 12px', borderRadius: 99, background: 'rgba(10,10,14,0.85)', color: '#fff', fontSize: 12.5, fontWeight: 700 }}>
              {senal === 'buscando' ? <Loader2 size={13} className="spin" /> : <span style={{ width: 8, height: 8, borderRadius: 4, background: lista ? C.verde : C.gris }} />} {textoSenal}
            </span>
          )}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18 }}>
            {/* La actividad: su ícono con la palomita azul y su nombre. Tocarla abre la lista para cambiarla. */}
            <button type="button" onClick={alCambiarDeporte} aria-label={`Cambiar de actividad (ahora: ${nombre})`} style={lado}>
              <span style={circulo}>
                <IconoDeTipo id={icono?.icono ?? null} nombre={icono?.nombre ?? ''} size={24} />
                <span aria-hidden="true" style={{ position: 'absolute', top: -3, right: -3, width: 18, height: 18, borderRadius: 9, background: C.azul, display: 'grid', placeItems: 'center', boxShadow: '0 0 0 2px #1A1A20' }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                </span>
              </span>
              {/* estilo-ok: el nombre de la actividad en mayúsculas, como la maqueta aprobada de la pantalla de carrera (2 nov 2026) */}
              <span style={rotulo}>{nombre.toLocaleUpperCase('es-MX')}</span>
            </button>
            <button
              type="button" onClick={() => empieza({ gps: conMapa && !sinGps, silencio: !conMapa })} disabled={esperandoGps} aria-label="Iniciar"
              style={{ width: 96, height: 96, borderRadius: 48, border: 'none', flexShrink: 0, background: esperandoGps ? 'rgba(255,255,255,0.14)' : C.azul, color: '#fff', cursor: esperandoGps ? 'default' : 'pointer', fontFamily: FONT, fontSize: esperandoGps ? 16 : 17, fontWeight: 800, letterSpacing: '0.02em', boxShadow: '0 0 0 6px rgba(255,255,255,0.06)', touchAction: 'manipulation' }}
            >
              {/* estilo-ok: «INICIAR» en mayúsculas, como la maqueta aprobada (2 nov 2026) */}
              {esperandoGps ? 'GPS…' : 'INICIAR'}
            </button>
            {conMapa ? (
              <button type="button" onClick={abreAjustes} aria-label="Ajustes de la carrera" style={lado}>
                <span style={circulo}><Settings size={22} /></span>
                {/* estilo-ok: «AJUSTES» en mayúsculas, como la maqueta aprobada (2 nov 2026) */}
                <span style={rotulo}>{'AJUSTES'}</span>
              </button>
            ) : (
              <button type="button" onClick={conectaReloj} aria-label="Conectar reloj" style={lado}>
                <span style={circulo}><Watch size={22} /></span>
                {/* estilo-ok: «RELOJ» en mayúsculas, como los otros dos botones de la fila (maqueta del 2 nov 2026) */}
                <span style={rotulo}>{'RELOJ'}</span>
              </button>
            )}
          </div>
        </div>
        {conBarra && barra(alMinimizar)}
        {ajustes && (
          // Los ajustes de la carrera que ya existían: la pausa automática (también está en Mi perfil → Dispositivos) y el tipo de mapa. Solo cuentas de
          // prueba: «Guardar traza del GPS» y exportarla.
          <Hoja etiqueta="Ajustes de la carrera" titulo="Ajustes" conCierre onCerrar={() => setAjustes(false)}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* Nadar no se pausa solo (`sinPausaAutomatica`): el interruptor no haría nada. */}
              {conAjustes && deporte !== 'natacion' && (
                <Grupo pie="El cronómetro se pausa solo cuando te detienes y sigue solo al volver a moverte.">
                  <Fila texto="Pausa automática" derecha={<Interruptor activo={pausaAutomatica !== false} etiqueta="Pausa automática" onCambio={(v) => setPausaAutomatica(v)} />} />
                </Grupo>
              )}
              {usaMapaNativo() && (
                <Grupo titulo="Tipo de mapa">
                  <Segmentado etiqueta="Tipo de mapa" valor={tipoDeMapa} onCambio={(t) => { setTipoDeMapa(t); guardaTipoDeMapa(t); }} opciones={TIPOS_DE_MAPA.map(([valor, texto]) => ({ valor, texto }))} />
                </Grupo>
              )}
              {deFabrica && (
                <Grupo titulo="Cuentas de prueba" pie="Guarda cada segundo lo que dicen el GPS y el sensor de movimiento, para revisarlo. Se queda en este teléfono.">
                  <Fila texto="Guardar traza del GPS" derecha={<Interruptor activo={conTraza} etiqueta="Guardar traza del GPS" onCambio={(v) => { ponTrazaEncendida(v); setConTraza(v); }} />} />
                  {traza?.filas?.length > 0 && <Fila texto="Exportar la última traza" detalle={`${traza.filas.length} puntos`} onClick={exportaTraza} />}
                </Grupo>
              )}
              {!sinGps && (
                <button type="button" onClick={() => { setAjustes(false); empieza({ gps: false }); }} style={{ border: 'none', background: 'transparent', color: C.azul, fontFamily: FONT, fontSize: 15, fontWeight: 800, padding: '8px 0', cursor: 'pointer' }}>
                  Empezar sin GPS
                </button>
              )}
            </div>
          </Hoja>
        )}
        {preguntaRuta && <HojaDelRecorrido onSi={() => contesta('si')} onNo={() => contesta('no')} />}
      </>,
    );
  }

  /* 2, 3 y 4 · CORRIENDO (números o mapa) y EN PAUSA */
  const tiempo = relojDeCronometro(segundos);
  const ritmoAhora = textoDelRitmo(pausado ? promedio : vivo.ritmoSKm, enBici, enAgua);
  const etiquetaRitmo = etiquetaDelRitmo(enBici, pausado, enAgua);
  const distancia = enAgua ? miles(vivo.distanciaM) : km.toFixed(2);
  const etiquetaDistancia = enAgua ? 'Distancia (m)' : 'Distancia (km)';
  const hoja = (
    <HojaDeAbajo
      pausado={pausado} guardando={guardando} error={error}
      onPausa={crono.pausa} onReanuda={crono.reanuda} onFinaliza={finaliza}
    />
  );
  const minimizar = (estilo) => (
    <button type="button" onClick={alMinimizar} aria-label="Minimizar" style={{ ...estilo, position: 'absolute', zIndex: 3, top: 'calc(14px + env(safe-area-inset-top))', left: 16 }}><ChevronDown size={22} /></button>
  );

  if (fase === 'numeros') {
    return pantalla(
      // Negro opaco encima del mapa (que sigue vivo detrás): así no se ve ni recibe toques.
      <div style={{ position: 'absolute', inset: 0, zIndex: 2, background: C.negro, display: 'flex', flexDirection: 'column' }}>
        {minimizar(redondo)}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 44, margin: 'calc(14px + env(safe-area-inset-top)) 68px 0', position: 'relative' }}>
          <div role="timer" aria-label="Tiempo" style={{ fontSize: 40, fontWeight: 800, lineHeight: 1, letterSpacing: -0.5, color: C.acento, ...NUM_STYLE }}>{tiempo}</div>
        </div>
        <button type="button" onClick={() => ponVista('mapa')} aria-label="Ver el mapa" style={{ ...redondo, background: 'transparent', position: 'absolute', zIndex: 3, top: 'calc(14px + env(safe-area-inset-top))', right: 16 }}><Minimize2 size={22} /></button>
        {/* En medio, con el mismo espacio arriba y abajo: el ritmo y la distancia enormes y, con Apple Watch, el pulso. */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'clamp(18px, 5svh, 40px)', padding: '12px 16px' }}>
          <NumeroGrande valor={ritmoAhora} etiqueta={etiquetaRitmo} />
          <NumeroGrande valor={distancia} etiqueta={etiquetaDistancia} />
          <Pulso lpm={pulso} />
        </div>
        {hoja}
      </div>,
    );
  }

  return pantalla(
    <>
      {fase === 'pausa' && <div aria-hidden="true" style={{ position: 'absolute', inset: 0, zIndex: 1, backgroundImage: TINTE, pointerEvents: 'none' }} />}
      {minimizar(sobreElMapa)}
      {fase === 'pausa' && (
        <div style={{ position: 'absolute', zIndex: 2, left: 64, right: 64, top: 'calc(14px + env(safe-area-inset-top))' }}><TituloDePausa automatica={automatica} /></div>
      )}
      {/* Abajo, en una columna con 12 px entre cada cosa: los botones del mapa (los pone el mapa, 12 px arriba de esto), la tarjeta y la hoja. */}
      <div data-map-overlay data-mapa-panel style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 2, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ margin: '0 16px', background: C.tarjeta, borderRadius: 22, padding: '12px 16px 14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 40px', alignItems: 'center' }}>
            <span aria-hidden="true" style={{ color: C.gris, display: 'grid' }}><IconoDeTipo id={icono?.icono ?? null} nombre={icono?.nombre ?? ''} size={22} /></span>
            <span role="timer" aria-label="Tiempo" style={{ textAlign: 'center', fontSize: 19, fontWeight: 800, lineHeight: 1, color: pausado ? C.gris : C.acento, ...NUM_STYLE }}>{tiempo}</span>
            {/* «Agrandar»: regresa a los números. En pausa no: al reanudar se vuelve a la vista en la que estaba. */}
            <button
              type="button" onClick={() => ponVista('numeros')} disabled={pausado} aria-label="Ver los números"
              style={{ justifySelf: 'end', width: 40, height: 40, margin: '-8px -8px -8px 0', border: 'none', background: 'transparent', color: pausado ? C.gris : '#fff', display: 'grid', placeItems: 'center', cursor: pausado ? 'default' : 'pointer', touchAction: 'manipulation' }}
            >
              <Maximize2 size={18} />
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', textAlign: 'center', marginTop: 8 }}>
            {[[ritmoAhora, etiquetaRitmo], [distancia, etiquetaDistancia]].map(([v, t]) => (
              <div key={t} style={{ minWidth: 0 }}>
                <div style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.05, letterSpacing: -0.5, color: pausado ? C.grisClaro : C.texto, ...NUM_STYLE }}>{v}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: C.gris }}>{t}</div>
              </div>
            ))}
          </div>
          {!pausado && pulso > 0 && <div style={{ textAlign: 'center', marginTop: 6 }}><Pulso lpm={pulso} tamano={16} /></div>}
        </div>
        {hoja}
      </div>
      {corta && (
        <AvisoDeCorta
          deporte={deporte} actividad={act}
          onDescartar={() => { crono.descarta(); alMinimizar(); }}
          onSeguir={() => { setCorta(false); crono.reanuda(); }}
        />
      )}
    </>,
  );
}

/** El ritmo que se ve: «5:19» (sin dato todavía, «–:––»); en bici, la velocidad: «28.4»; nadando, el tiempo por cada 100 m: «2:05». `sKm`: segundos por km, como lo da el GPS. */
function textoDelRitmo(sKm, enBici, enAgua = false) {
  if (enBici) return sKm > 0 ? (3600 / sKm).toFixed(1) : '–.–';
  if (enAgua) return sKm > 0 && sKm < 12000 ? textoDeRitmo(sKm / 10) : '–:––'; // 20 min por 100 m ya no es nadar: es ruido del GPS
  return sKm > 0 && sKm < 3600 ? textoDeRitmo(sKm) : '–:––';
}
const etiquetaDelRitmo = (enBici, pausado, enAgua = false) => {
  if (enBici) return pausado ? 'Velocidad promedio (km/h)' : 'Velocidad (km/h)';
  if (enAgua) return pausado ? 'Ritmo promedio (/100 m)' : 'Ritmo (/100 m)';
  return pausado ? 'Ritmo promedio (/km)' : 'Ritmo (/km)';
};
