import { useMemo, useState } from 'react';
import { Play, Share2, Timer } from 'lucide-react';
import HojaFlotante from '@/components/HojaFlotante';
import { LT, FONT } from '@/lib/theme';
import { usePlan } from '@/contexts/PlanContext';
import TarjetaDeExplorar from '@/features/explorar/TarjetaDeExplorar';
import { relojDeCronometro } from '@/lib/entrenoLibre';
import { nombreDelDeporte } from '@/lib/metricas/deportes';
import { deporteDelCartel, resumenDeLaSemana, textoDeLaSemana } from '@/lib/semanaLibre';
import { actividadDeDeporte, actividadDeEntreno, propiasDe } from '@/lib/actividades';
import { useStorage } from '@/contexts/AppStateContext';
import ElegirActividad from './ElegirActividad';
import CelebracionLibre from './CelebracionLibre';
import { recordDe } from '@/lib/resumenLibre';
import { filaDelRecord, fraseDeActividad, heroeDeActividad } from '@/lib/paginaDelEntreno';
import HeroDeEntrenar from './HeroDeEntrenar';
import HojaDeDemos from './HojaDeDemos';
import OpcionesDeEntrenar from './OpcionesDeEntrenar';
import PantallaDelCronometro from './PantallaDelCronometro';
import PantallaDeCarrera from './PantallaDeCarrera';
import ResumenLibre from './ResumenLibre';
import HistorialCompleto from './HistorialCompleto';
import TusEntrenos from './TusEntrenos';
import { useDemos } from './useDemos';
import { useCronometroLibre, useEntrenosRecientes } from './useEntrenoLibre';
import { CuadroBlanco, Cuadrito } from '@/features/training/home/Cuadros';
import { abreSesionHecha } from '@/lib/abreSesionHecha';

/* EL ENTRENO LIBRE, armado (12 oct 2026): lo que ve alguien en Home o en la pestaña Entrenar para entrenar por su cuenta, tenga o no un plan.
     · `variante="completa"` (sin plan): la tarjeta azul «Entrenar» (su semana, su último entreno, «Empezar»), la de Explorar, los cuadros de color (`cuadros`, p. ej. Salud),
       los blancos chicos (Demo workout y `chicos`, p. ej. 1RM) y «Tus entrenos» (reestructura visual, 15 oct 2026).
     · `variante="atajos"` (Home con plan, 30 oct 2026): los cuadritos «Libre» (con el reloj si hay un entreno en curso) y «Stickers» (los del último entreno,
       con un punto mientras sea de los últimos dos días y no los haya abierto), para la fila de atajos de Home.
       Fase 7 (29 oct 2026): el cuadro «Stickers» se quitó (hacía pensar que solo había una tarjeta); los stickers viven en cada entreno de «Tus entrenos».
     `volverA`: lo que dice el botón de regreso de «Ver todos» («Home», o «Atrás» desde Entrenar).
     · `enLinea` (pestaña Entrenar): las opciones puestas directo, y «Tus entrenos».
     · `variante="historial"` (Home con plan, 23 oct 2026): solo «Tus entrenos» (auditoría p29); desde la fase 6 (29 oct 2026), con los workouts del plan.
     · `variante="punto"` (23 oct 2026, Activity Tracker): lo que abre el punto ● del centro de la barra: directo «listo para empezar» con la última actividad
       (mapa e «Iniciar», estilo Aura); el botón de la izquierda cambia de actividad (`ElegirActividad`: lista por grupos, buscador y «Crear la mía»). No dibuja nada más;
       al cerrarse llama a `alCerrar`. «Empezar» de la tarjeta azul de Home hace lo mismo.
   El cronómetro vive en `localStorage` y sigue aunque se cierre la hoja: el cartel pasa a «Entreno en curso». «Demo workout» sale solo si hay demos; al elegir uno se abre como el workout de hoy
   (`abreDemo`) y `alIrAHome` (si se da) lleva a Home. Ver `lib/entrenoLibre.js` y `lib/semanaLibre.js`. */

// «8.2 km · ayer»: la última salida del mismo deporte, para «Antes de salir».
function ultimaSalida(filas, deporte) {
  const f = (filas ?? []).find((x) => x.deporte === deporte && x.distancia_m > 0);
  if (!f) return null;
  const dias = Math.round((new Date().setHours(12, 0, 0, 0) - new Date(f.inicio).setHours(12, 0, 0, 0)) / 86400000);
  const cuando = dias <= 0 ? 'hoy' : dias === 1 ? 'ayer' : `hace ${dias} días`;
  return `${(f.distancia_m / 1000).toFixed(1)} km · ${cuando}`;
}

// El aviso de Explorar al cerrar la hoja de stickers sale una vez por visita (dura lo que la pestaña del navegador).
// Cuántos de sus últimos entrenos se leen (la semana, la frase de la página, el récord al guardar).
const LEIDOS = 40;

const yaSeLeOfrecio = () => { try { return sessionStorage.getItem('tl:explorar-ofrecido') === '1'; } catch { return false; } };
const marcaOfrecido = () => { try { sessionStorage.setItem('tl:explorar-ofrecido', '1'); } catch { /* sin almacenamiento: puede salir otra vez */ } };

export default function EntrenoLibre({ userId, unidadPeso = 'kg', enLinea = false, variante = 'completa', alIrAHome = null, conEmpujon = false, alIrAExplorar = null, cuadros = null, chicos = null, alCerrar = null, volverA = 'Home' }) {
  const crono = useCronometroLibre(userId);
  const { filas, entrenos, recarga } = useEntrenosRecientes(userId, LEIDOS);
  const { abreDemo, hasPlan } = usePlan();
  const demos = useDemos(userId);
  const [propiasGuardadas, setPropias] = useStorage('actividades:propias', []);
  // El último entreno cuyos stickers ya abrió desde el atajo (`variante="atajos"`): mientras no, el cuadrito lleva su punto.
  const [stickersVistos, setStickersVistos] = useStorage('ui:stickers-vistos', null);
  const [ahora] = useState(() => Date.now()); // «los últimos dos días» se cuentan desde que se abrió Home
  const propias = useMemo(() => propiasDe(propiasGuardadas), [propiasGuardadas]);
  const enPunto = variante === 'punto';
  // El punto ● abre directo «listo para empezar» (o el entreno que va, si hay uno corriendo).
  const [hoja, setHoja] = useState(() => (enPunto ? 'cronometro' : null)); // null | 'elegir' | 'demos' | 'cronometro' | { resumen: fila, stickers?, recien?, celebrar?, empujon? }
  const alDemo = demos?.length ? () => setHoja('demos') : null;
  const enCurso = !!crono.cronometro;
  const semana = useMemo(() => resumenDeLaSemana(filas ?? []), [filas]);
  const ultimo = filas?.[0] ?? null;
  const deporte = enCurso ? crono.cronometro.deporte : deporteDelCartel(filas);
  /* LA ACTIVIDAD que va a hacer (`lib/actividades.js`): antes de arrancar todas pasan por «listo para empezar» (`PantallaDeCarrera`): con mapa, el mapa y la señal del GPS;
     sin mapa, la hora en grande. `pendiente` es esa actividad mientras no arranca. De entrada, la última que hizo (o Correr). */
  const ultimaActividad = () => actividadDeEntreno(filas?.[0], propias) ?? actividadDeDeporte('correr');
  const [pendiente, setPendiente] = useState(() => (enPunto && !enCurso ? actividadDeDeporte('correr') : null));
  const [eligioAMano, setEligioAMano] = useState(false);
  // Al cargar sus entrenos, el punto arranca con su última actividad (si no la cambió ya él).
  const ultimaId = filas ? actividadDeEntreno(filas[0], propias)?.id : null;
  const [ultimaVista, setUltimaVista] = useState(null);
  if (enPunto && !enCurso && !eligioAMano && ultimaId && ultimaId !== ultimaVista && pendiente) {
    setUltimaVista(ultimaId);
    setPendiente(ultimaActividad());
  }
  const elige = (act) => { setEligioAMano(true); setPendiente(act); setHoja('cronometro'); };
  const eligeDeporte = (d) => elige(actividadDeDeporte(d));
  // Cerrar del todo. En el punto, avisa para que la barra lo quite.
  const cierra = () => { setPendiente(null); setHoja(null); if (enPunto) alCerrar?.(); };
  /* AL GUARDAR (Activity Tracker, paso 3; stickers, 28 oct 2026): la celebración corta (con el récord si lo rompió, contra sus entrenos de antes) y luego la página de
     la actividad con el aviso «Tus stickers están listos». La hoja de stickers NUNCA se abre sola. El récord se cuenta con la lista de ANTES de recargarla, y solo
     para quien NO tiene plan (decisión 1.11: con plan manda lo programado; ni «Tu ritmo más rápido» ni «Tu distancia más larga» en un entreno libre). */
  const alGuardar = (fila, extra = {}) => {
    const record = hasPlan ? null : recordDe(fila, filas ?? []);
    recarga();
    setHoja({ resumen: fila, celebrar: true, recien: true, muestras: extra.muestras ?? null, actividad: extra.actividad ?? null, record });
  };
  const abreElCartel = () => { if (!enCurso) setPendiente(ultimaActividad()); setHoja('cronometro'); };
  const comparte = (fila) => setHoja({ resumen: fila, stickers: true });
  /* Una fila de «Tus entrenos» (fase 6): un workout del plan abre SU página (`PaginaDeSesionGlobal`, también si el reloj lo trajo); lo demás, la del entreno libre. */
  const abreEntreno = (e) => (e.plan ? abreSesionHecha({ almacen: e.plan.s.almacen, id: e.plan.s.id }) : setHoja({ resumen: e.actividad }));
  const comparteEntreno = (e) => (e.plan ? abreSesionHecha({ almacen: e.plan.s.almacen, id: e.plan.s.id, stickers: true }) : comparte(e.actividad));
  const [verTodos, setVerTodos] = useState(false);
  const creaPropia = (act) => setPropias((prev) => [act, ...propiasDe(prev)].slice(0, 30));
  const conExplorar = conEmpujon && !!alIrAExplorar;

  const hojas = (
    <>
      {verTodos && (
        <HistorialCompleto
          userId={userId} propias={propias} unidadPeso={unidadPeso} volverA={volverA} alAbrir={abreEntreno} alCompartir={comparteEntreno} alCerrar={() => setVerTodos(false)}
          // La invitación a un plan, solo a quien no tiene: lleva a Explorar.
          alQuererPlan={!hasPlan && alIrAExplorar ? () => { setVerTodos(false); alIrAExplorar(); } : null}
        />
      )}
      {hoja === 'elegir' && (
        <ElegirActividad
          filas={filas ?? []} propias={propias} alElegir={elige}
          alCrear={(act) => { creaPropia(act); elige(act); }}
          alCerrar={() => (pendiente ? setHoja('cronometro') : cierra())}
        />
      )}
      {hoja === 'demos' && demos?.length > 0 && (
        <HojaDeDemos demos={demos} alCerrar={() => setHoja(null)} alElegir={(d) => { abreDemo(d); setHoja(null); alIrAHome?.(); }} />
      )}
      {/* Con GPS (correr, caminar, bici, senderismo): la carrera a pantalla completa. Sin GPS: el cronómetro de siempre. */}
      {hoja === 'cronometro' && ((pendiente && !enCurso) || (enCurso && crono.cronometro.gps)) && (
        <PantallaDeCarrera
          userId={userId} crono={crono} pendiente={enCurso ? null : pendiente?.deporte ?? null} actividad={enCurso ? null : pendiente}
          ultimo={ultimaSalida(filas, pendiente?.deporte ?? crono.cronometro?.deporte)}
          alEmpezar={({ gps, silencio }) => { crono.inicia(pendiente.deporte, { gps, silencio, actividad: pendiente }); setPendiente(null); }}
          alMinimizar={cierra}
          alCambiarDeporte={() => setHoja('elegir')}
          alGuardado={alGuardar}
        />
      )}
      {hoja === 'cronometro' && enCurso && !crono.cronometro.gps && (
        <PantallaDelCronometro
          userId={userId} crono={crono} pendiente={null}
          alEmpezar={() => {}}
          alMinimizar={cierra}
          alGuardado={alGuardar}
        />
      )}
      {hoja?.resumen && hoja.celebrar && (
        <CelebracionLibre
          nombre={hoja.resumen.titulo || hoja.actividad?.nombre || nombreDelDeporte(hoja.resumen.deporte)} numero={heroeDeActividad(hoja.resumen)}
          muestras={hoja.muestras} actividad={hoja.actividad ?? actividadDeEntreno(hoja.resumen, propias)}
          // Un récord, con contra qué se compara; si no lo hubo pero es su primera vez («Tu primera carrera en Training Lab»), también se celebra.
          record={filaDelRecord(hoja.record) ?? (() => { const f = fraseDeActividad(hoja.resumen, { otras: filas ?? [], propias }); return f.startsWith('Tu primer') ? { titulo: f.replace(/\.$/, '') } : null; })()}
          alTerminar={() => setHoja({ ...hoja, celebrar: false })}
        />
      )}
      {hoja?.resumen && !hoja.celebrar && (
        <ResumenLibre
          key={hoja.resumen.id} fila={hoja.resumen} unidadPeso={unidadPeso} alCerrar={cierra} conStickers={!!hoja.stickers} recien={!!hoja.recien}
          muestras={hoja.muestras ?? null} record={hoja.record ?? null} actividad={hoja.actividad ?? null}
          propias={propias} filas={filas ?? []} desde={filas?.length >= LEIDOS ? Date.parse(filas[filas.length - 1].inicio) : null} conRecord={!hasPlan}
          alCrearPropia={creaPropia} alCambiar={recarga} alBorrado={recarga}
          // Al cerrar la hoja de stickers, una sola vez por visita y solo a quien no tiene plan ni entrenador: «¿Quieres un plan hecho por un coach?».
          alCerrarStickers={conEmpujon && alIrAExplorar && !yaSeLeOfrecio() ? () => { marcaOfrecido(); setHoja({ ...hoja, empujon: true }); } : undefined}
        />
      )}
      {hoja?.resumen && hoja.empujon && (
        <HojaFlotante titulo="Explorar" onCerrar={cierra} capa={3250}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <TarjetaDeExplorar alTocar={() => { cierra(); alIrAExplorar(); }} />
            <button type="button" onClick={cierra} className="kp-press" style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: FONT, fontSize: 15, fontWeight: 800, color: LT.text2, padding: '10px 0' }}>Ahora no</button>
          </div>
        </HojaFlotante>
      )}
    </>
  );

  if (enPunto) return hojas;

  // Solo «Tus entrenos» (Home con plan), abajo de lo del plan. Sin entrenos no dibuja nada.
  if (variante === 'historial') {
    return (
      <>
        <TusEntrenos entrenos={entrenos?.slice(0, 4)} unidadPeso={unidadPeso} propias={propias} alAbrir={abreEntreno} alCompartir={comparteEntreno} alVerTodos={() => setVerTodos(true)} />
        {hojas}
      </>
    );
  }

  if (variante === 'atajos') {
    const ultimoEntreno = entrenos?.[0] ?? null;
    const nuevos = !!ultimoEntreno && ahora - (ultimoEntreno.ms || 0) < 2 * 86400000 && stickersVistos !== ultimoEntreno.clave;
    // Sin ningún entreno todavía, «Stickers» abre la lista completa (ahí dice cómo se consiguen).
    const abreStickers = () => {
      if (!ultimoEntreno) { setVerTodos(true); return; }
      setStickersVistos(ultimoEntreno.clave);
      comparteEntreno(ultimoEntreno);
    };
    return (
      <>
        <Cuadrito
          tono="azul" Icono={enCurso ? Timer : Play} texto={enCurso ? relojDeCronometro(crono.segundos) : 'Libre'} onClick={abreElCartel}
          etiquetaAccesible={enCurso ? `Seguir tu entreno de ${nombreDelDeporte(deporte)}` : `Entrenar libre: ${textoDeLaSemana(semana)}`}
        />
        <Cuadrito tono="tinta" Icono={Share2} texto="Stickers" onClick={abreStickers} aviso={nuevos} etiquetaAccesible={nuevos ? 'Stickers: tienes nuevos' : 'Stickers'} />
        {hojas}
      </>
    );
  }

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, fontFamily: FONT }}>
        {enLinea ? (
          enCurso
            ? <HeroDeEntrenar deporte={deporte} semana={semana} ultimo={ultimo} enCurso segundos={crono.segundos} alAbrir={abreElCartel} />
            : <OpcionesDeEntrenar alElegir={eligeDeporte} alDemo={alDemo} alTodas={() => setHoja('elegir')} />
        ) : (
          <>
            <HeroDeEntrenar deporte={deporte} semana={semana} ultimo={ultimo} enCurso={enCurso} segundos={crono.segundos} alAbrir={abreElCartel} />
            {conExplorar && <TarjetaDeExplorar alTocar={alIrAExplorar} />}
            {/* Sin el cuadro «Stickers» (fase 7): el de Salud va con los blancos chicos, en la misma cuadrícula. */}
            {(cuadros || alDemo || chicos) && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
                {cuadros}
                {alDemo && <CuadroBlanco Icono={Play} titulo="Demo workout" color="#7C5CFF" fondo="#EFEBFF" onClick={alDemo} />}
                {chicos}
              </div>
            )}
          </>
        )}
        <TusEntrenos entrenos={entrenos?.slice(0, 6)} unidadPeso={unidadPeso} propias={propias} alAbrir={abreEntreno} alCompartir={comparteEntreno} alVerTodos={() => setVerTodos(true)} />
      </div>

      {hojas}
    </>
  );
}
