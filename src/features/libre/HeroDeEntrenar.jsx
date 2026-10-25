import { Play, Timer } from 'lucide-react';
import { Marco, botonBlanco } from '@/features/training/home/HoyTeToca';
import { relojDeCronometro } from '@/lib/entrenoLibre';
import { nombreDelDeporte } from '@/lib/metricas/deportes';
import { haceCuanto, textoDeLaSemana } from '@/lib/semanaLibre';
import { distanciaTexto } from '@/lib/metricas/formato';
import { NUM_STYLE } from '@/lib/theme';

/* LA TARJETA AZUL «ENTRENAR» (12 oct 2026; forma nueva el 15 oct, reestructura visual): lo primero que ve en Home quien no tiene plan. Cuenta SU semana —los siete días con
   los que ya entrenó, cuántos entrenos y cuál fue el último— y lleva a la hoja de deportes con «Empezar». Quien todavía no ha entrenado nunca lee «Entrena hoy, aunque no
   tengas plan». Con un cronómetro corriendo pasa a «Entreno en curso» con el tiempo, y el botón dice «Seguir». */

const LETRAS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const DIAS_LARGOS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

export default function HeroDeEntrenar({ deporte, semana, ultimo, enCurso = false, segundos = 0, alAbrir }) {
  const hechos = semana.dias.map((d, i) => (d.entreno ? DIAS_LARGOS[i] : null)).filter(Boolean);
  const titulo = enCurso ? <>{nombreDelDeporte(deporte)} · <span style={NUM_STYLE}>{relojDeCronometro(segundos)}</span></> : ultimo ? 'Entrenar' : 'Entrena hoy, aunque no tengas plan';
  const detalle = enCurso ? 'Tu entreno sigue contando'
    : ultimo ? [textoDeLaSemana(semana), `Último: ${nombreDelDeporte(ultimo.deporte)}${ultimo.distancia_m >= 100 ? ` · ${distanciaTexto(ultimo.distancia_m)}` : ''} · ${haceCuanto(ultimo)}`].join(' · ')
      : 'Correr, bici, nadar o caminar: la app lleva tu tiempo y tu distancia.';
  return (
    <Marco etiqueta={enCurso ? 'Entreno en curso' : 'Entrenar'} punto={enCurso ? '#7CF0C5' : '#FFB547'}>
      <h3 className="texto-largo" style={{ margin: '16px 0 0', fontSize: 28, fontWeight: 800, letterSpacing: -0.5, lineHeight: 1.12 }}>{titulo}</h3>
      <p className="texto-largo" style={{ margin: '6px 0 0', fontSize: 14.5, fontWeight: 600, opacity: 0.85, lineHeight: 1.4 }}>{detalle}</p>
      {ultimo && !enCurso && (
        <div role="img" aria-label={hechos.length ? `Esta semana entrenaste ${hechos.join(', ')}` : 'Esta semana todavía no has entrenado'} style={{ display: 'flex', gap: 6, marginTop: 14 }}>
          {semana.dias.map((d, i) => (
            <span key={d.dia} aria-hidden="true" style={{
              width: 30, height: 30, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 800,
              background: d.entreno ? '#fff' : 'rgba(255,255,255,0.14)', color: d.entreno ? '#1E40E0' : 'rgba(255,255,255,0.86)',
              boxShadow: d.esHoy ? '0 0 0 2px rgba(255,255,255,0.8)' : 'none',
            }}
            >{LETRAS[i]}</span>
          ))}
        </div>
      )}
      <button type="button" className="kp-press" onClick={alAbrir} style={{ ...botonBlanco, width: '100%', marginTop: 18 }}>
        {enCurso ? <><Timer size={18} aria-hidden="true" />Seguir</> : <><Play size={18} fill="currentColor" aria-hidden="true" />Empezar</>}
      </button>
    </Marco>
  );
}
