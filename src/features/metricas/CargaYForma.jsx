import { useMemo, useState } from 'react';
import { Info } from 'lucide-react';
import { LT, KP, FONT, NUM_STYLE, eyebrow } from '@/lib/theme';
import { diaCorto } from '@/lib/metricas/formato';
import { diasEntre, sumaDias } from '@/lib/metricas/forma';
import { GraficaDeLinea } from './Graficas';
import { marcasNumericas } from './graficasUtil';
import { Seccion, Tarjeta } from './Piezas';
import { TONOS } from './tonos';

/* CARGA Y FORMA: la gráfica que más usan los coaches de resistencia (la de TrainingPeaks), dicha en español.
     Condición  lo que su cuerpo ya aguanta (la carga de las últimas ~6 semanas, promediada)
     Fatiga     lo que trae encima esta semana
     Forma      condición − fatiga: positiva = llega con energía, negativa = trae carga encima
   Andrés (10 oct 2026): «que se vea fácil de entender». Por eso arriba va UNA frase con el estado de hoy, y debajo dos gráficas separadas (no tres líneas en
   la misma): una para lo que su cuerpo aguanta contra lo que trae encima, otra solo para la forma, con las zonas pintadas y nombradas. */

const RANGOS = [{ id: 42, titulo: '6 semanas' }, { id: 90, titulo: '3 meses' }, { id: 180, titulo: '6 meses' }, { id: 365, titulo: '12 meses' }];
const COLOR_CONDICION = '#1E40E0';
const COLOR_FATIGA = '#E8590C';

const con = (n) => (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(Math.round(n));

/** Cuánto cambió la condición en la última semana, en una frase («subió 3 puntos»). */
function rampaTexto(r) {
  const n = Math.abs(Math.round(r));
  if (n === 0) return 'La condición se mantuvo esta semana.';
  return `La condición ${r > 0 ? 'subió' : 'bajó'} ${n} ${n === 1 ? 'punto' : 'puntos'} esta semana${r > 8 ? ' (sube rápido: cuidado)' : ''}.`;
}

/** Marcas del eje de fechas: cada semana, cada dos o cada mes según el rango (siempre en lunes o día 1, para que se lean). */
function marcasDeFechas(primerDia, ultimoDia) {
  const total = diasEntre(primerDia, ultimoDia);
  const marcas = [];
  const paso = total <= 60 ? 7 : total <= 130 ? 14 : total <= 220 ? 30 : 60;
  for (let i = total; i >= 0; i -= paso) marcas.push({ v: i, etiqueta: diaCorto(sumaDias(primerDia, i)) });
  return marcas.reverse();
}

export default function CargaYForma({ d }) {
  const [rango, setRango] = useState(90);
  const curva = useMemo(() => d.curva.slice(-(rango + 1)), [d.curva, rango]);
  const vista = useMemo(() => {
    if (curva.length < 2) return null;
    const primerDia = curva[0].dia;
    const ultimoDia = curva[curva.length - 1].dia;
    const x = { min: 0, max: curva.length - 1, marcas: marcasDeFechas(primerDia, ultimoDia) };
    const maxY = Math.max(10, ...curva.map((p) => Math.max(p.ctl, p.atl)));
    const techo = Math.ceil((maxY * 1.1) / 10) * 10;
    const tsbs = curva.map((p) => p.tsb);
    const minT = Math.min(-45, Math.floor((Math.min(...tsbs) - 5) / 5) * 5);
    const maxT = Math.max(30, Math.ceil((Math.max(...tsbs) + 5) / 5) * 5);
    return { primerDia, x, techo, minT, maxT };
  }, [curva]);

  if (!d.estado || !vista) {
    return <div style={{ padding: '28px 4px', fontSize: 14.5, fontWeight: 500, color: LT.text2, lineHeight: 1.5 }}>Hacen falta entrenos con pulso de al menos un par de semanas para dibujar la condición, la fatiga y la forma.</div>;
  }
  const t = TONOS[d.estado.tono];
  const detalle = (xv) => {
    const i = Math.min(curva.length - 1, Math.max(0, Math.round(xv)));
    const p = curva[i];
    return { titulo: diaCorto(p.dia), p };
  };
  const puntos = (campo) => curva.map((p, i) => [i, p[campo]]);
  const pocoHistorial = d.diasDeHistorial < 42;
  const estimadas = d.lista.filter((a) => a.carga_metodo === 'estimada').length;

  return (
    <div>
      <Tarjeta style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', borderColor: `${t.c}33`, background: `linear-gradient(135deg, ${t.soft}, ${KP.surface} 70%)` }}>
        <div style={{ minWidth: 0, flex: '1 1 260px' }}>
          <div style={eyebrow(LT.text2)}>Forma de hoy</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '8px 0 6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 28, fontWeight: 800, letterSpacing: -0.7, color: t.c }}>{d.estado.titulo}</span>
          </div>
          <div style={{ fontSize: 14.5, lineHeight: 1.5, fontWeight: 500, color: LT.text }}>{d.estado.detalle}</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, auto)', gap: '4px 22px', ...NUM_STYLE }}>
          {[['Condición', Math.round(d.forma.ctl), COLOR_CONDICION], ['Fatiga', Math.round(d.forma.atl), COLOR_FATIGA], ['Forma', con(d.forma.tsb), t.c]].map(([n, v, c]) => (
            <div key={n}>
              <div style={{ fontSize: 26, fontWeight: 800, color: c, letterSpacing: -0.6, lineHeight: 1.1 }}>{v}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: LT.text2 }}>{n}</div>
            </div>
          ))}
          {d.rampa !== null && <div style={{ gridColumn: '1 / -1', fontSize: 12.5, fontWeight: 600, color: LT.text2 }}>{rampaTexto(d.rampa)}</div>}
        </div>
      </Tarjeta>

      {pocoHistorial && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 12, padding: '10px 12px', borderRadius: 12, background: KP.amberSoft, color: LT.text, fontSize: 13.5, lineHeight: 1.45, fontWeight: 500 }}>
          <Info size={16} color={KP.amber} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>Solo hay {d.diasDeHistorial} días de historial. La condición necesita unas 6 semanas para ser confiable: ahora tiende a verse más baja de lo real.</span>
        </div>
      )}

      <div role="group" aria-label="Periodo" style={{ display: 'flex', gap: 6, marginTop: 16, flexWrap: 'wrap' }}>
        {RANGOS.map((r) => (
          <button
            key={r.id} type="button" aria-pressed={rango === r.id} onClick={() => setRango(r.id)}
            style={{
              minHeight: 36, padding: '0 13px', borderRadius: 999, cursor: 'pointer', fontFamily: FONT, fontSize: 13.5, fontWeight: 800, touchAction: 'manipulation',
              border: `1.5px solid ${rango === r.id ? LT.blue : LT.borderHi}`, background: rango === r.id ? LT.blue : LT.surface, color: rango === r.id ? '#fff' : LT.text,
            }}
          >
            {r.titulo}
          </button>
        ))}
      </div>

      <Seccion
        titulo="Lo que aguanta y lo que trae encima"
        ayuda="Cada entreno tiene una carga, que se calcula de su pulso y de cuánto tiempo estuvo cerca de su máximo (una hora justo en su umbral vale 100). La CONDICIÓN (azul) es el promedio de las últimas ~6 semanas: lo que su cuerpo ya aguanta. La FATIGA (naranja, punteada) es el promedio de la última semana: lo que trae encima. Cuando la fatiga pasa mucho a la condición, está cargado."
      >
        <Tarjeta relleno={12}>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', margin: '0 4px 6px' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: LT.text }}><span style={{ width: 18, height: 3, borderRadius: 2, background: COLOR_CONDICION }} />Condición (CTL)</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: LT.text }}><span style={{ width: 18, height: 0, borderTop: `3px dashed ${COLOR_FATIGA}` }} />Fatiga (ATL)</span>
          </div>
          <GraficaDeLinea
            series={[
              { id: 'ctl', nombre: 'Condición', color: COLOR_CONDICION, ancho: 2.6, area: true, opacidadArea: 0.12, puntos: puntos('ctl') },
              { id: 'atl', nombre: 'Fatiga', color: COLOR_FATIGA, ancho: 2, discontinua: true, puntos: puntos('atl') },
            ]}
            x={vista.x} y={{ min: 0, max: vista.techo, marcas: marcasNumericas(0, vista.techo, 5).map((v) => ({ v, etiqueta: String(v) })) }} altura={230}
            detalle={(xv) => { const { titulo, p } = detalle(xv); return { titulo, filas: [{ color: COLOR_CONDICION, texto: `Condición ${Math.round(p.ctl)}` }, { color: COLOR_FATIGA, texto: `Fatiga ${Math.round(p.atl)}` }, ...(p.carga > 0 ? [{ color: '#8A93A6', texto: `Carga del día ${Math.round(p.carga)}` }] : [])] }; }}
            descripcion={`Condición y fatiga de los últimos ${rango} días. Hoy: condición ${Math.round(d.forma.ctl)}, fatiga ${Math.round(d.forma.atl)}`}
          />
        </Tarjeta>
      </Seccion>

      <Seccion
        titulo="Cómo llega a cada día (forma)"
        ayuda="La forma es la condición menos la fatiga de ayer. Por encima de cero llega con energía; por debajo, trae carga encima. Las franjas de color dicen qué significa cada tramo: entre −10 y −30 es donde se suele entrenar fuerte sin pasarse; por debajo de −30 ya hay riesgo."
      >
        <Tarjeta relleno={12}>
          <GraficaDeLinea
            series={[{ id: 'tsb', nombre: 'Forma', color: LT.text, ancho: 2.2, puntos: puntos('tsb') }]}
            x={vista.x} cero
            y={{ min: vista.minT, max: vista.maxT, marcas: marcasNumericas(vista.minT, vista.maxT, 6).map((v) => ({ v, etiqueta: con(v) === '0' ? '0' : con(v) })) }}
            bandas={[
              { y0: 25, y1: 300, color: KP.blue, etiqueta: 'Mucho descanso' },
              { y0: 5, y1: 25, color: KP.mint, etiqueta: 'En plena forma' },
              { y0: -10, y1: 5, color: '#8A93A6', etiqueta: 'Equilibrio' },
              { y0: -30, y1: -10, color: KP.amber, etiqueta: 'Entrenando fuerte' },
              { y0: -300, y1: -30, color: KP.danger, etiqueta: 'Sobrecarga' },
            ]}
            altura={250}
            detalle={(xv) => { const { titulo, p } = detalle(xv); return { titulo, filas: [{ color: LT.text, texto: `Forma ${con(p.tsb)}` }] }; }}
            descripcion={`Forma de los últimos ${rango} días. Hoy: ${con(d.forma.tsb)}, ${d.estado.titulo.toLowerCase()}`}
          />
        </Tarjeta>
      </Seccion>

      {estimadas > 0 && (
        <div style={{ marginTop: 14, fontSize: 12.5, fontWeight: 600, color: LT.text2, lineHeight: 1.5 }}>
          {estimadas} de {d.lista.length} entrenos no traen pulso: su carga se estimó por el deporte y el tiempo (con «≈» en la lista).
        </div>
      )}
    </div>
  );
}
