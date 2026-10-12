import { useMemo, useState } from 'react';
import { Compass, Dumbbell, Play, Timer } from 'lucide-react';
import HojaFlotante from '@/components/HojaFlotante';
import { LT, FONT } from '@/lib/theme';
import { usePlan } from '@/contexts/PlanContext';
import TarjetaDeExplorar from '@/features/explorar/TarjetaDeExplorar';
import { relojDeCronometro } from '@/lib/entrenoLibre';
import { nombreDelDeporte } from '@/lib/metricas/deportes';
import { deporteDelCartel, resumenDeLaSemana, textoDeLaSemana } from '@/lib/semanaLibre';
import { ICONOS } from '@/features/metricas/tonos';
import HeroDeEntrenar from './HeroDeEntrenar';
import HojaDeDemos from './HojaDeDemos';
import OpcionesDeEntrenar from './OpcionesDeEntrenar';
import PantallaDelCronometro from './PantallaDelCronometro';
import ResumenLibre from './ResumenLibre';
import TusEntrenos from './TusEntrenos';
import Widget from './Widget';
import WidgetDeActivityCard from './WidgetDeActivityCard';
import { useDemos } from './useDemos';
import { useCronometroLibre, useEntrenosRecientes } from './useEntrenoLibre';

/* EL ENTRENO LIBRE, armado (12 oct 2026): lo que ve alguien en Home o en la pestaña Entrenar para entrenar por su cuenta, tenga o no un plan.
     · `variante="completa"` (sin plan): el cartel «Entrenar» (su semana, su último entreno, play), una cuadrícula de widgets (Activity card, Explorar, Demo workout y los que se le pasen
       de hijos: Salud, 1RM…) y «Tus entrenos».
     · `variante="compacta"` (con plan): una tira azul «Entrenar» y «Tus entrenos»; el cartel grande de Home ya es el de su plan.
     · `enLinea` (pestaña Entrenar): las opciones puestas directo, y «Tus entrenos».
   El cronómetro vive en `localStorage` y sigue aunque se cierre la hoja: el cartel pasa a «Entreno en curso». «Demo workout» sale solo si hay demos; al elegir uno se abre como el workout de hoy
   (`abreDemo`) y `alIrAHome` (si se da) lleva a Home. Ver `lib/entrenoLibre.js` y `lib/semanaLibre.js`. */

// El aviso de Explorar al cerrar la activity card sale una vez por visita (dura lo que la pestaña del navegador).
const yaSeLeOfrecio = () => { try { return sessionStorage.getItem('tl:explorar-ofrecido') === '1'; } catch { return false; } };
const marcaOfrecido = () => { try { sessionStorage.setItem('tl:explorar-ofrecido', '1'); } catch { /* sin almacenamiento: puede salir otra vez */ } };

export default function EntrenoLibre({ userId, unidadPeso = 'kg', enLinea = false, variante = 'completa', alIrAHome = null, conEmpujon = false, alIrAExplorar = null, children = null }) {
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
  const elige = (d) => { crono.inicia(d); setHoja('cronometro'); };
  const abreElCartel = () => setHoja(enCurso ? 'cronometro' : 'elegir');
  const abreLaTarjeta = () => setHoja(ultimo ? { resumen: ultimo, tarjeta: true } : 'elegir');
  const conExplorar = conEmpujon && !!alIrAExplorar;
  const IconoDeporte = ICONOS[deporte] ?? Timer;

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, fontFamily: FONT }}>
        {enLinea ? (
          enCurso
            ? <HeroDeEntrenar deporte={deporte} semana={semana} ultimo={ultimo} enCurso segundos={crono.segundos} alAbrir={abreElCartel} />
            : <OpcionesDeEntrenar alElegir={elige} alDemo={alDemo} />
        ) : variante === 'compacta' ? (
          <button
            type="button" onClick={abreElCartel} className="tl-w tira" data-tono="azul"
            aria-label={enCurso ? `Seguir tu entreno de ${nombreDelDeporte(deporte)}` : 'Entrenar: elegir un deporte'}
          >
            <span className="tl-w-ic" aria-hidden="true"><IconoDeporte /></span>
            <span className="tl-w-texto">
              <span className="tl-w-tit" style={{ display: 'block' }}>{enCurso ? `${nombreDelDeporte(deporte)} · ${relojDeCronometro(crono.segundos)}` : 'Entrenar'}</span>
              <span className="tl-w-sub" style={{ display: 'block' }}>{enCurso ? 'Entreno en curso · toca para seguir' : textoDeLaSemana(semana)}</span>
            </span>
            <span className="tl-w-play" aria-hidden="true">{enCurso ? <Timer /> : <Play />}</span>
          </button>
        ) : (
          <>
            <HeroDeEntrenar deporte={deporte} semana={semana} ultimo={ultimo} enCurso={enCurso} segundos={crono.segundos} alAbrir={abreElCartel} />
            <div className="tl-w-grid">
              <WidgetDeActivityCard ultimo={ultimo} alTocar={abreLaTarjeta} />
              {conExplorar && <Widget tono="violeta" Icono={Compass} titulo="Explorar" sub="Planes de coaches" alTocar={alIrAExplorar} />}
              {alDemo && <Widget tono="menta" Icono={Dumbbell} titulo="Demo workout" sub="Mira cómo se inicia" alTocar={alDemo} />}
              {children}
            </div>
          </>
        )}
        <TusEntrenos filas={filas?.slice(0, 6)} alAbrir={(fila) => setHoja({ resumen: fila })} />
      </div>

      {hoja === 'elegir' && (
        <HojaFlotante titulo="Entrenar" onCerrar={() => setHoja(null)}>
          <OpcionesDeEntrenar alElegir={elige} alDemo={alDemo} />
        </HojaFlotante>
      )}
      {hoja === 'demos' && demos?.length > 0 && (
        <HojaDeDemos demos={demos} alCerrar={() => setHoja(null)} alElegir={(d) => { abreDemo(d); setHoja(null); alIrAHome?.(); }} />
      )}
      {hoja === 'cronometro' && enCurso && (
        <PantallaDelCronometro
          userId={userId} crono={crono} alMinimizar={() => setHoja(null)}
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
}
