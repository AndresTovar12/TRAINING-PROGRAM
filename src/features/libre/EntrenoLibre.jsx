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
import HeroDeEntrenar from './HeroDeEntrenar';
import HojaDeDemos from './HojaDeDemos';
import OpcionesDeEntrenar from './OpcionesDeEntrenar';
import PantallaDelCronometro from './PantallaDelCronometro';
import PantallaDeCarrera from './PantallaDeCarrera';
import ResumenLibre from './ResumenLibre';
import TusEntrenos from './TusEntrenos';
import { useDemos } from './useDemos';
import { useCronometroLibre, useEntrenosRecientes } from './useEntrenoLibre';
import { Cuadro, CuadroBlanco, PlayChico } from '@/features/training/home/Cuadros';

/* EL ENTRENO LIBRE, armado (12 oct 2026): lo que ve alguien en Home o en la pestaña Entrenar para entrenar por su cuenta, tenga o no un plan.
     · `variante="completa"` (sin plan): la tarjeta azul «Entrenar» (su semana, su último entreno, «Empezar»), la de Explorar, los cuadros de color (`cuadros`, p. ej. Salud,
       y Activity card), los blancos chicos (Demo workout y `chicos`, p. ej. 1RM) y «Tus entrenos» (reestructura visual, 15 oct 2026).
     · `variante="cuadros"` (Home con plan, reestructura visual del 15 oct 2026): solo dos cuadros, «Entrenar libre» y «Activity card», para ir en la cuadrícula de Home junto a Salud
       y la fase. «Tus entrenos» queda en la pestaña Entrenar.
     · `enLinea` (pestaña Entrenar): las opciones puestas directo, y «Tus entrenos».
     · `variante="historial"` (Home con plan, 23 oct 2026): solo «Tus entrenos», lo que registró por su cuenta (auditoría p29).
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

// El aviso de Explorar al cerrar la activity card sale una vez por visita (dura lo que la pestaña del navegador).
const yaSeLeOfrecio = () => { try { return sessionStorage.getItem('tl:explorar-ofrecido') === '1'; } catch { return false; } };
const marcaOfrecido = () => { try { sessionStorage.setItem('tl:explorar-ofrecido', '1'); } catch { /* sin almacenamiento: puede salir otra vez */ } };

export default function EntrenoLibre({ userId, unidadPeso = 'kg', enLinea = false, variante = 'completa', alIrAHome = null, conEmpujon = false, alIrAExplorar = null, cuadros = null, chicos = null, alCerrar = null }) {
  const crono = useCronometroLibre(userId);
  const { filas, recarga } = useEntrenosRecientes(userId, 40);
  const { abreDemo } = usePlan();
  const demos = useDemos(userId);
  const [propiasGuardadas, setPropias] = useStorage('actividades:propias', []);
  const propias = useMemo(() => propiasDe(propiasGuardadas), [propiasGuardadas]);
  const enPunto = variante === 'punto';
  // El punto ● abre directo «listo para empezar» (o el entreno que va, si hay uno corriendo).
  const [hoja, setHoja] = useState(() => (enPunto ? 'cronometro' : null)); // null | 'elegir' | 'demos' | 'cronometro' | 'empujon' | { resumen: fila, tarjeta?: boolean }
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
  /* AL GUARDAR (Activity Tracker, paso 3): la celebración corta (con el récord si lo rompió, contra sus entrenos de antes), luego se abre sola la activity card y, al cerrarla,
     queda la página de la actividad. El récord se cuenta con la lista de ANTES de recargarla. */
  const alGuardar = (fila, extra = {}) => {
    const record = recordDe(fila, filas ?? []);
    recarga();
    setHoja({ resumen: fila, celebrar: true, tarjeta: true, muestras: extra.muestras ?? null, actividad: extra.actividad ?? null, record });
  };
  const abreElCartel = () => { if (!enCurso) setPendiente(ultimaActividad()); setHoja('cronometro'); };
  const abreLaTarjeta = () => setHoja(ultimo ? { resumen: ultimo, tarjeta: true } : 'elegir');
  const conExplorar = conEmpujon && !!alIrAExplorar;

  const hojas = (
    <>
      {hoja === 'elegir' && (
        <ElegirActividad
          filas={filas ?? []} propias={propias} alElegir={elige}
          alCrear={(act) => { setPropias((prev) => [act, ...propiasDe(prev)].slice(0, 30)); elige(act); }}
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
          alEmpezar={({ gps }) => { crono.inicia(pendiente.deporte, { gps, actividad: pendiente }); setPendiente(null); }}
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
        <CelebracionLibre fila={hoja.resumen} muestras={hoja.muestras} actividad={hoja.actividad} record={hoja.record} alTerminar={() => setHoja({ ...hoja, celebrar: false })} />
      )}
      {hoja?.resumen && !hoja.celebrar && (
        <ResumenLibre
          fila={hoja.resumen} unidadPeso={unidadPeso} alCerrar={cierra} empiezaEnTarjeta={!!hoja.tarjeta}
          muestras={hoja.muestras ?? null} record={hoja.record ?? null} actividad={hoja.actividad ?? null}
          // Al cerrar la activity card, una sola vez por visita y solo a quien no tiene plan ni entrenador: «¿Quieres un plan hecho por un coach?».
          alCerrarTarjeta={conEmpujon && alIrAExplorar && !yaSeLeOfrecio() ? () => { marcaOfrecido(); setHoja({ ...hoja, empujon: true }); } : undefined}
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

  // Solo «Tus entrenos» (Home con plan): lo que registró por su cuenta, abajo de lo del plan. Sin entrenos libres no dibuja nada.
  if (variante === 'historial') {
    return (
      <>
        <TusEntrenos filas={filas?.slice(0, 4)} propias={propias} alAbrir={(fila) => setHoja({ resumen: fila })} />
        {hojas}
      </>
    );
  }

  if (variante === 'cuadros') {
    return (
      <>
        <Cuadro
          tono="azul" Icono={Timer} etiqueta="Entrenar libre" onClick={abreElCartel} accion={<PlayChico Icono={enCurso ? Timer : Play} />}
          // El número solo, grande: con el play al lado no cabe «Sin entrenos» en un cuadro de 165 px.
          titulo={enCurso ? relojDeCronometro(crono.segundos) : String(semana.entrenos)}
          sub={enCurso ? `${nombreDelDeporte(deporte)} en curso` : `${semana.entrenos === 1 ? 'entreno' : 'entrenos'} esta semana`}
          etiquetaAccesible={enCurso ? `Seguir tu entreno de ${nombreDelDeporte(deporte)}` : `Entrenar libre: ${textoDeLaSemana(semana)}`}
        />
        <Cuadro
          tono="tinta" Icono={Share2} etiqueta="Activity card" onClick={abreLaTarjeta}
          titulo={ultimo ? relojDeCronometro(ultimo.duracion_s) : '0:00'} sub={ultimo ? 'Último entreno' : 'Tu primer entreno'}
          etiquetaAccesible={ultimo ? 'Abrir la activity card de tu último entreno' : 'Activity card: entrena y sácala para tus historias'}
        />
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
              {cuadros}
              <Cuadro
                tono="tinta" Icono={Share2} etiqueta="Activity card" onClick={abreLaTarjeta}
                titulo={ultimo ? relojDeCronometro(ultimo.duracion_s) : '0:00'} sub={ultimo ? 'Último entreno' : 'Tu primer entreno'}
                etiquetaAccesible={ultimo ? 'Abrir la activity card de tu último entreno' : 'Activity card: entrena y sácala para tus historias'}
              />
            </div>
            {(alDemo || chicos) && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
                {alDemo && <CuadroBlanco Icono={Play} titulo="Demo workout" color="#7C5CFF" fondo="#EFEBFF" onClick={alDemo} />}
                {chicos}
              </div>
            )}
          </>
        )}
        <TusEntrenos filas={filas?.slice(0, 6)} propias={propias} alAbrir={(fila) => setHoja({ resumen: fila })} />
      </div>

      {hojas}
    </>
  );
}
