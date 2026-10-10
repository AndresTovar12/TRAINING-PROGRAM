import { useMemo } from 'react';
import { HeartPulse, Timer, TrendingDown } from 'lucide-react';
import { LT, KP, NUM_STYLE } from '@/lib/theme';
import { desdeKilos, etiquetaUnidad } from '@/lib/unidades';
import { TEXTO_DE_FUENTE } from '@/lib/metricas/porSerie';
import { duracionTexto, relojTexto, ritmoTexto } from '@/lib/metricas/formato';
import { Seccion, Tarjeta } from './Piezas';

/* «POR SERIE»: cada serie, lapso o set de un entreno guiado, con lo que importa de cada uno. Se arma en `lib/metricas/porSerie.js`; aquí solo se dibuja.

   Andrés (10 oct 2026): el coach quiere ver, de un set de lapsos o de sprints, las métricas de cada lapso; y de un set normal, sus series. Cada número dice de
   dónde sale con las palabras que él aprobó: «Lo midió la app», «Lo midió el reloj», «Lo escribió a mano» y «Dejó lo del plan». Los kilos y las reps llevan su
   etiqueta; el tiempo lleva el ícono del cronómetro (la app lo mide) y el pulso el del corazón (lo mide el reloj de pulsera). */

const ESTILO_DE_FUENTE = {
  escrito: { fondo: KP.blueSoft, color: LT.blue },
  plan: { fondo: LT.surface2, color: LT.text2 },
  app: { fondo: KP.mintSoft, color: KP.mint },
  reloj: { fondo: KP.dangerSoft, color: KP.danger },
};

/** La etiqueta chica de dónde sale un número. */
export function EtiquetaDeFuente({ fuente }) {
  const e = ESTILO_DE_FUENTE[fuente];
  if (!e) return null;
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 999, background: e.fondo, color: e.color, fontSize: 11.5, fontWeight: 800, whiteSpace: 'nowrap' }}>
      {TEXTO_DE_FUENTE[fuente]}
    </span>
  );
}

const Dato = ({ icono: Icono, titulo, color = LT.text3, children }) => (
  <span title={titulo} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 700, color: LT.text, ...NUM_STYLE }}>
    <Icono size={14} color={color} aria-hidden="true" />
    <span className="sr-only" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>{titulo}: </span>
    {children}
  </span>
);

/** Lo que dice la carga de una serie: «100 kg × 5 reps». */
function textoDeCarga(f, unidadPeso) {
  const partes = [];
  if (f.kg !== null && f.kg !== undefined) partes.push(`${desdeKilos(f.kg, unidadPeso)} ${etiquetaUnidad(unidadPeso)}`);
  if (f.reps) partes.push(`${f.reps} ${f.reps === '1' ? 'rep' : 'reps'}`);
  return partes.join(' × ');
}

function Descanso({ d }) {
  if (!d || !(d.realS >= 0)) return null;
  const plan = d.planS ? ` · plan ${relojTexto(d.planS)}` : '';
  return (
    <>
      <Dato icono={Timer} titulo="Descanso, lo midió la app" color={KP.mint}>Descansó {relojTexto(d.realS)}{plan}</Dato>
      {d.bajoFc > 0 && <Dato icono={TrendingDown} titulo="Lo que bajó el pulso en el descanso, lo midió el reloj" color={KP.danger}>Bajó {d.bajoFc} lpm</Dato>}
    </>
  );
}

function FilaDeSerie({ f, indice, unidadPeso }) {
  const saltada = f.tipo === 'saltada';
  let principal;
  let fuente = null;
  if (saltada) principal = <span style={{ color: LT.text3, fontStyle: 'italic', fontWeight: 600 }}>Saltó {f.vuelta ? `la serie ${f.vuelta}` : 'este paso'}</span>;
  else if (f.tipo === 'serie') { principal = textoDeCarga(f, unidadPeso) || 'Hecha'; fuente = f.fuente; }
  else if (f.tipo === 'lapso') principal = [f.texto, f.planS && !f.texto ? duracionTexto(f.planS) : null].filter(Boolean).join(' · ') || 'Lapso';
  else { principal = f.valor || 'Hecho'; fuente = f.fuente; }

  const etiqueta = f.tipo === 'set' ? '•' : (f.tipo === 'lapso' ? (f.vuelta ?? indice + 1) : (f.vuelta ?? indice + 1));
  const datos = [];
  if (!saltada) {
    if (f.durS > 0) datos.push(<Dato key="t" icono={Timer} titulo="Tiempo, lo midió la app" color={KP.mint}>{f.durS >= 100 ? relojTexto(f.durS) : `${f.durS} s`}</Dato>);
    if (f.ritmoSKm) datos.push(<Dato key="r" icono={Timer} titulo="Ritmo, de la distancia y el tiempo que midió la app" color={KP.mint}>{ritmoTexto(f.ritmoSKm)} /km</Dato>);
    if (f.fc) datos.push(<Dato key="f" icono={HeartPulse} titulo="Pulso, lo midió el reloj" color={KP.danger}>{f.fc.media} lpm · máx {f.fc.max}</Dato>);
    if (f.descanso) datos.push(<Descanso key="d" d={f.descanso} />);
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '30px minmax(0, 1fr)', columnGap: 10, padding: '11px 0', borderTop: `1px solid ${KP.line}`, opacity: saltada ? 0.8 : 1 }}>
      <span aria-hidden="true" style={{ width: 28, height: 28, borderRadius: 9, background: LT.surface2, color: LT.text2, display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 800, ...NUM_STYLE }}>
        {etiqueta}
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px 10px', fontSize: 15, fontWeight: 800, color: LT.text, ...NUM_STYLE }}>
          <span>{principal}</span>
          {fuente && <EtiquetaDeFuente fuente={fuente} />}
        </div>
        {datos.length > 0 && <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', marginTop: 5 }}>{datos}</div>}
      </div>
    </div>
  );
}

const AYUDA = (
  <>
    Cada serie, lapso o set del entreno guiado, en el orden en que pasó. El <strong>tiempo</strong> lo mide la app, el <strong>pulso</strong> lo mide el reloj de
    pulsera (solo si hay uno que coincida con la hora) y los <strong>kilos y reps</strong> dicen si el atleta los escribió a mano o si tocó «Listo» y dejó lo que decía
    el plan, que no es lo mismo que haberlo comprobado. Una serie solo trae su tiempo cuando antes hubo un descanso marcado.
  </>
);

/**
 * `resultado`: lo que devuelve `filasPorSerie`. `unidadPeso`: 'kg' o 'lb', la del atleta. `conReloj`: hay un entreno de reloj de pulsera unido (si no, se
 * avisa que el pulso no está, solo una vez y en una línea).
 */
export default function PorSerie({ resultado, unidadPeso = 'kg', conReloj = false }) {
  const grupos = useMemo(() => {
    const por = new Map();
    (resultado?.filas ?? []).forEach((f) => {
      const k = f.nombre;
      if (!por.has(k)) por.set(k, []);
      por.get(k).push(f);
    });
    return [...por.entries()];
  }, [resultado]);
  if (!grupos.length) return null;
  const { resumen, hayPulso } = resultado;
  const chips = [
    resumen.series > 0 && `${resumen.series} ${resumen.series === 1 ? 'serie' : 'series'}`,
    resumen.lapsos > 0 && `${resumen.lapsos} ${resumen.lapsos === 1 ? 'lapso' : 'lapsos'}`,
    resumen.descansoMedioS !== null && `descanso medio ${relojTexto(resumen.descansoMedioS)}`,
    resumen.saltadas > 0 && `${resumen.saltadas} ${resumen.saltadas === 1 ? 'saltada' : 'saltadas'}`,
  ].filter(Boolean);

  return (
    <Seccion titulo="Por serie" ayuda={AYUDA}>
      {chips.length > 0 && (
        <div style={{ fontSize: 13, fontWeight: 700, color: LT.text2, margin: '-2px 2px 10px', ...NUM_STYLE }}>{chips.join(' · ')}</div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {grupos.map(([nombre, filas]) => (
          <Tarjeta key={nombre} relleno={14} style={{ borderRadius: 18 }}>
            <div style={{ fontSize: 15.5, fontWeight: 800, color: LT.text, paddingBottom: 8, overflowWrap: 'anywhere' }}>{nombre}</div>
            {filas.map((f, i) => <FilaDeSerie key={f.clave} f={f} indice={i} unidadPeso={unidadPeso} />)}
          </Tarjeta>
        ))}
      </div>
      {conReloj && !hayPulso && (
        <div style={{ marginTop: 10, fontSize: 13, fontWeight: 600, color: LT.text2, lineHeight: 1.4 }}>
          El reloj de pulsera no dejó pulso en estas horas, así que no hay pulso por serie.
        </div>
      )}
    </Seccion>
  );
}
