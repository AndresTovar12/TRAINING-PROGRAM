import { Activity, Flame, History, Play, Timer } from 'lucide-react';
import { CartelDeHoy } from '@/features/training/TarjetaDeHoy';
import { relojDeCronometro } from '@/lib/entrenoLibre';
import { nombreDelDeporte } from '@/lib/metricas/deportes';
import { haceCuanto, textoDeLaSemana } from '@/lib/semanaLibre';
import { distanciaTexto } from '@/lib/metricas/formato';
import { COLOR_DE_DEPORTE, ICONOS } from '@/features/metricas/tonos';
import './widgets.css';

/* EL CARTEL «ENTRENAR» (12 oct 2026): lo primero que ve en Home quien no tiene plan. Es el mismo cartel de «Hoy te toca» (azul, con el resplandor teñido del deporte y el play redondo),
   pero cuenta SU semana: los siete días con los que ya entrenó, cuántos entrenos y cuánto tiempo, y cuál fue el último. Tocar cualquier parte abre la hoja de deportes; con un cronómetro
   corriendo, el cartel pasa a «Entreno en curso» con el tiempo y el play se vuelve «Seguir». */

const LETRAS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const DIAS_LARGOS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

export default function HeroDeEntrenar({ deporte, semana, ultimo, enCurso = false, segundos = 0, alAbrir }) {
  const Icono = ICONOS[deporte] ?? Activity;
  const color = COLOR_DE_DEPORTE[deporte] ?? '#7A8191';
  const hechos = semana.dias.map((d, i) => (d.entreno ? DIAS_LARGOS[i] : null)).filter(Boolean);
  const abre = (e) => { e?.stopPropagation?.(); alAbrir(); };

  return (
    <CartelDeHoy colores={[color]} etiqueta={enCurso ? 'Entreno en curso' : 'Listo para entrenar'} onClick={alAbrir}>
      <div className="tl-hoy-escena">
        <div className="tl-hoy-discos"><span className="tl-hoy-disco" aria-hidden="true"><Icono /></span></div>
      </div>
      <div>
        <h3 className="tl-hoy-tit">{enCurso ? <>{nombreDelDeporte(deporte)} · <span style={{ fontVariantNumeric: 'tabular-nums' }}>{relojDeCronometro(segundos)}</span></> : 'Entrenar'}</h3>
        <div className="tl-hoy-meta">
          {enCurso
            ? <span><Timer aria-hidden="true" />Toca para seguir</span>
            : (
              <>
                <span><Flame aria-hidden="true" />{textoDeLaSemana(semana)}</span>
                {ultimo && <span><History aria-hidden="true" />Último: {nombreDelDeporte(ultimo.deporte)}{ultimo.distancia_m >= 100 ? ` · ${distanciaTexto(ultimo.distancia_m)}` : ''} · {haceCuanto(ultimo)}</span>}
              </>
            )}
        </div>
      </div>
      <div className="tl-hoy-abajo" style={{ '--tc': color }}>
        <div className="tl-w-semana" role="img" aria-label={hechos.length ? `Esta semana entrenaste ${hechos.join(', ')}` : 'Esta semana todavía no has entrenado'}>
          {semana.dias.map((d, i) => <span key={d.dia} className={`tl-w-dia${d.entreno ? ' hecho' : ''}${d.esHoy ? ' hoy' : ''}`} aria-hidden="true">{LETRAS[i]}</span>)}
        </div>
        <button type="button" className={`tl-hoy-big${enCurso ? ' ver' : ''}`} aria-label={enCurso ? 'Seguir el entreno' : 'Elegir un deporte y entrenar'} onClick={abre}>
          <span className="tl-hoy-play">{enCurso ? <Timer aria-hidden="true" /> : <Play aria-hidden="true" />}</span>
        </button>
      </div>
    </CartelDeHoy>
  );
}
