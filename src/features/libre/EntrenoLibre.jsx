import { useMemo, useState } from 'react';
import { Play, Share2, Timer } from 'lucide-react';
import HojaFlotante from '@/components/HojaFlotante';
import { LT, FONT } from '@/lib/theme';
import { usePlan } from '@/contexts/PlanContext';
import TarjetaDeExplorar from '@/features/explorar/TarjetaDeExplorar';
import { relojDeCronometro } from '@/lib/entrenoLibre';
import { fuenteDeUbicacion, usaGps } from '@/lib/ubicacion';
import { nombreDelDeporte } from '@/lib/metricas/deportes';
import { deporteDelCartel, resumenDeLaSemana, textoDeLaSemana } from '@/lib/semanaLibre';
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

export default function EntrenoLibre({ userId, unidadPeso = 'kg', enLinea = false, variante = 'completa', alIrAHome = null, conEmpujon = false, alIrAExplorar = null, cuadros = null, chicos = null }) {
  const crono = useCronometroLibre(userId);
  const { filas, recarga } = useEntrenosRecientes(userId, 40);
  const { abreDemo } = usePlan();
  const demos = useDemos(userId);
  const [hoja, setHoja] = useState(null); // null | 'elegir' | 'demos' | 'cronometro' | 'empujon' | { resumen: fila, tarjeta?: boolean }
  const alDemo = demos?.length ? () => setHoja('demos') : null;
  const enCurso = !!crono.cronometro;
  const semana = useMemo(() => resumenDeLaSemana(filas ?? []), [filas]);
  const ultimo = filas?.[0] ?? null;
  const deporte = enCurso ? crono.cronometro.deporte : deporteDelCartel(filas);
  // Correr, caminar y bici pasan antes por «Antes de salir» (la señal del GPS); los demás arrancan ya. Ver `PantallaDelCronometro`.
  const [pendiente, setPendiente] = useState(null);
  const elige = (d) => {
    if (usaGps(d) && fuenteDeUbicacion().disponible()) { setPendiente(d); setHoja('cronometro'); return; }
    crono.inicia(d); setHoja('cronometro');
  };
  const abreElCartel = () => setHoja(enCurso ? 'cronometro' : 'elegir');
  const abreLaTarjeta = () => setHoja(ultimo ? { resumen: ultimo, tarjeta: true } : 'elegir');
  const conExplorar = conEmpujon && !!alIrAExplorar;

  const hojas = (
    <>
      {hoja === 'elegir' && (
        <HojaFlotante titulo="Entrenar" onCerrar={() => setHoja(null)}>
          <OpcionesDeEntrenar alElegir={elige} alDemo={alDemo} />
        </HojaFlotante>
      )}
      {hoja === 'demos' && demos?.length > 0 && (
        <HojaDeDemos demos={demos} alCerrar={() => setHoja(null)} alElegir={(d) => { abreDemo(d); setHoja(null); alIrAHome?.(); }} />
      )}
      {/* Con GPS (correr, caminar, bici, senderismo): la carrera a pantalla completa. Sin GPS: el cronómetro de siempre. */}
      {hoja === 'cronometro' && ((pendiente && !enCurso) || (enCurso && crono.cronometro.gps)) && (
        <PantallaDeCarrera
          userId={userId} crono={crono} pendiente={enCurso ? null : pendiente} ultimo={ultimaSalida(filas, pendiente ?? crono.cronometro?.deporte)}
          alEmpezar={({ gps }) => { crono.inicia(pendiente, { gps }); setPendiente(null); }}
          alMinimizar={() => { setPendiente(null); setHoja(null); }}
          alCambiarDeporte={() => { setPendiente(null); setHoja('elegir'); }}
          alGuardado={(fila) => { recarga(); setHoja({ resumen: fila }); }}
        />
      )}
      {hoja === 'cronometro' && enCurso && !crono.cronometro.gps && (
        <PantallaDelCronometro
          userId={userId} crono={crono} pendiente={enCurso ? null : pendiente}
          alEmpezar={({ gps }) => { crono.inicia(pendiente, { gps }); setPendiente(null); }}
          alMinimizar={() => { setPendiente(null); setHoja(null); }}
          alGuardado={(fila) => { recarga(); setHoja({ resumen: fila }); }}
        />
      )}
      {hoja?.resumen && (
        <ResumenLibre
          fila={hoja.resumen} unidadPeso={unidadPeso} alCerrar={() => setHoja(null)} empiezaEnTarjeta={!!hoja.tarjeta}
          // Al cerrar la activity card, una sola vez por visita y solo a quien no tiene plan ni entrenador: «¿Quieres un plan hecho por un coach?».
          alCerrarTarjeta={conEmpujon && alIrAExplorar && !yaSeLeOfrecio() ? () => { marcaOfrecido(); setHoja({ ...hoja, empujon: true }); } : undefined}
        />
      )}
      {hoja?.resumen && hoja.empujon && (
        <HojaFlotante titulo="Explorar" onCerrar={() => setHoja(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <TarjetaDeExplorar alTocar={() => { setHoja(null); alIrAExplorar(); }} />
            <button type="button" onClick={() => setHoja(null)} className="kp-press" style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: FONT, fontSize: 15, fontWeight: 800, color: LT.text2, padding: '10px 0' }}>Ahora no</button>
          </div>
        </HojaFlotante>
      )}
    </>
  );

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
            : <OpcionesDeEntrenar alElegir={elige} alDemo={alDemo} />
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
        <TusEntrenos filas={filas?.slice(0, 6)} alAbrir={(fila) => setHoja({ resumen: fila })} />
      </div>

      {hojas}
    </>
  );
}
