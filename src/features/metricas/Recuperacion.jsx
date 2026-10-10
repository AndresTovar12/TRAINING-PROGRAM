import { useMemo, useState } from 'react';
import { Moon } from 'lucide-react';
import { LT, KP, FONT, NUM_STYLE, eyebrow } from '@/lib/theme';
import { diaCorto } from '@/lib/metricas/formato';
import { diasEntre, sumaDias } from '@/lib/metricas/forma';
import { BarrasApiladas, GraficaDeLinea } from './Graficas';
import { marcasNumericas } from './graficasUtil';
import { Dato, EstadoVacio, Insignia, Seccion, Tarjeta } from './Piezas';
import { TONOS } from './tonos';

/* RECUPERACIÓN: lo que el reloj mide mientras el atleta NO entrena: pulso en reposo, HRV (variabilidad del pulso) y sueño. Cada línea se compara con lo normal de
   ese mismo atleta (su promedio de los 30 días anteriores): lo que importa no es el 52 en sí, sino que HOY esté 6 latidos por encima de su 52. */

const RANGOS = [{ id: 30, titulo: '30 días' }, { id: 90, titulo: '3 meses' }, { id: 180, titulo: '6 meses' }];
const mediana = (v) => { const o = [...v].sort((a, b) => a - b); const m = Math.floor(o.length / 2); return o.length ? (o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2) : null; };
const media = (v) => (v.length ? v.reduce((s, x) => s + x, 0) / v.length : null);

/** Una línea de un valor por día, con la franja de «lo normal» detrás. */
function LineaDiaria({ filas, campo, desde, hasta, color, unidad, banda, factor = 1, dec = 0 }) {
  const datos = filas.filter((f) => typeof f[campo] === 'number' && f[campo] > 0).map((f) => ({ i: diasEntre(desde, f.dia), v: f[campo] * factor, dia: f.dia }));
  if (datos.length < 2) return <div style={{ padding: '18px 4px', fontSize: 14, fontWeight: 500, color: LT.text2 }}>Todavía no hay suficientes días medidos.</div>;
  const valores = datos.map((p) => p.v);
  const base = banda ? mediana(valores) : null;
  const [lo, hi] = banda && base ? banda(base) : [null, null];
  const piso = Math.min(...valores, lo ?? Infinity);
  const techo = Math.max(...valores, hi ?? -Infinity);
  const holgura = Math.max(1, (techo - piso) * 0.15);
  const min = Math.floor(piso - holgura);
  const max = Math.ceil(techo + holgura);
  const total = diasEntre(desde, hasta);
  const paso = total <= 45 ? 7 : total <= 120 ? 14 : 30;
  const marcas = [];
  for (let i = total; i >= 0; i -= paso) marcas.push({ v: i, etiqueta: diaCorto(sumaDias(desde, i)) });
  return (
    <GraficaDeLinea
      series={[{ id: campo, nombre: campo, color, ancho: 2.4, puntos: datos.map((p) => [p.i, p.v]) }]}
      x={{ min: 0, max: total, marcas: marcas.reverse() }}
      y={{ min, max, marcas: marcasNumericas(min, max, 4).map((v) => ({ v, etiqueta: String(Math.round(v * 10) / 10) })) }}
      bandas={banda && base ? [{ y0: lo, y1: hi, color: KP.mint, etiqueta: 'Lo normal' }] : []}
      altura={170} margen={{ t: 8, r: 12, b: 24, l: 40 }}
      detalle={(x) => {
        const p = datos.reduce((mejor, q) => (Math.abs(q.i - x) < Math.abs(mejor.i - x) ? q : mejor), datos[0]);
        return { titulo: diaCorto(p.dia), filas: [{ color, texto: `${(Math.round(p.v * 10 ** dec) / 10 ** dec).toFixed(dec)} ${unidad}` }] };
      }}
      descripcion={`${campo} de los últimos días`}
    />
  );
}

export default function Recuperacion({ d, recuperacion, hoy }) {
  const [rango, setRango] = useState(30);
  const desde = sumaDias(hoy, -rango);
  const filas = useMemo(() => recuperacion.filter((f) => f.dia >= desde && f.dia <= hoy), [recuperacion, desde, hoy]);
  const r = d.recuperacion;
  const t = TONOS[r.veredicto.tono];

  if (!recuperacion.length) {
    return (
      <EstadoVacio icono={Moon} titulo="Sin datos de recuperación" texto="El pulso en reposo, la HRV y el sueño los mide el Apple Watch (u otro reloj) mientras no entrena. Se traen al importar el export de Apple Salud: en el iPhone, Salud → tu foto → Exportar todos los datos de salud." />
    );
  }

  const noches = filas.filter((f) => f.sueno_s > 0).map((f) => {
    const profundo = f.sueno_profundo_s ?? 0;
    const rem = f.sueno_rem_s ?? 0;
    return { clave: f.dia, etiqueta: diaCorto(f.dia), partes: [
      { valor: profundo / 3600, color: '#5B3FD6', nombre: 'Profundo' },
      { valor: rem / 3600, color: '#3DA9F5', nombre: 'REM' },
      { valor: Math.max(0, f.sueno_s - profundo - rem) / 3600, color: '#A9C9F5', nombre: profundo || rem ? 'Ligero' : 'Dormido' },
    ] };
  });
  const sueno7 = media(filas.slice(-7).filter((f) => f.sueno_s > 0).map((f) => f.sueno_s / 3600));
  const otras = [
    ['vo2max', 'VO₂ máx', 'ml/kg/min', 1], ['pasos', 'pasos al día (7 d)', '', 0], ['peso_kg', 'peso', 'kg', 1], ['spo2', 'oxígeno en sangre', '%', 0], ['frec_respiratoria', 'respiraciones', 'por min', 1],
  ].map(([c, etiqueta, unidad, dec]) => {
    const vals = filas.filter((f) => typeof f[c] === 'number' && f[c] > 0);
    if (!vals.length) return null;
    const v = c === 'pasos' ? media(vals.slice(-7).map((f) => f[c])) : vals[vals.length - 1][c];
    return { c, etiqueta, unidad, valor: (Math.round(v * 10 ** dec) / 10 ** dec).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }) };
  }).filter(Boolean);

  return (
    <div>
      <Tarjeta style={{ borderColor: `${t.c}33`, background: `linear-gradient(135deg, ${t.soft}, ${KP.surface} 70%)` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <div style={eyebrow(LT.text2)}>Recuperación de hoy</div>
          <Insignia tono={r.veredicto.tono}>{r.veredicto.titulo}</Insignia>
        </div>
        <div style={{ fontSize: 15, lineHeight: 1.5, fontWeight: 500, color: LT.text, margin: '10px 0 14px' }}>{r.veredicto.detalle}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 14 }}>
          <Dato valor={r.reposo.siete ?? '—'} unidad="lpm" etiqueta={`pulso en reposo${r.reposo.diferencia ? ` (${r.reposo.diferencia > 0 ? '+' : '−'}${Math.abs(r.reposo.diferencia)} vs lo normal)` : ''}`} />
          <Dato valor={r.hrv.siete ?? '—'} unidad="ms" etiqueta={`HRV${r.hrv.diferencia ? ` (${r.hrv.diferencia > 0 ? '+' : '−'}${Math.abs(Math.round(r.hrv.diferencia * 100))} % vs lo normal)` : ''}`} />
          <Dato valor={sueno7 ? (Math.round(sueno7 * 10) / 10).toFixed(1) : '—'} unidad="h" etiqueta="sueño por noche (7 d)" />
        </div>
      </Tarjeta>

      <div role="group" aria-label="Periodo" style={{ display: 'flex', gap: 6, marginTop: 16 }}>
        {RANGOS.map((x) => (
          <button
            key={x.id} type="button" aria-pressed={rango === x.id} onClick={() => setRango(x.id)}
            style={{
              minHeight: 36, padding: '0 13px', borderRadius: 999, cursor: 'pointer', fontFamily: FONT, fontSize: 13.5, fontWeight: 800, touchAction: 'manipulation',
              border: `1.5px solid ${rango === x.id ? LT.blue : LT.borderHi}`, background: rango === x.id ? LT.blue : LT.surface, color: rango === x.id ? '#fff' : LT.text,
            }}
          >
            {x.titulo}
          </button>
        ))}
      </div>

      <Seccion titulo="Pulso en reposo" ayuda="El pulso de la persona cuando no hace nada. Si de pronto sube 3 o más latidos sobre lo que es normal en esa persona, puede venir con cansancio, enfermedad o estrés. Bajarlo poco a poco con el entrenamiento es buena señal.">
        <Tarjeta relleno={12}><LineaDiaria filas={filas} campo="fc_reposo" desde={desde} hasta={hoy} color="#E0475B" unidad="lpm" banda={(b) => [b - 3, b + 3]} /></Tarjeta>
      </Seccion>
      <Seccion titulo="Variabilidad del pulso (HRV)" ayuda="La HRV mide cuánto varía el tiempo entre latido y latido. Más alta suele significar mejor recuperación. Lo que importa es compararla con lo normal de la misma persona: si baja un 10 % o más y se queda ahí varios días, conviene aligerar.">
        <Tarjeta relleno={12}><LineaDiaria filas={filas} campo="hrv_ms" desde={desde} hasta={hoy} color="#5B3FD6" unidad="ms" banda={(b) => [b * 0.9, b * 1.1]} /></Tarjeta>
      </Seccion>
      <Seccion titulo="Sueño" ayuda="Las horas dormidas cada noche, partidas en sueño profundo, REM y ligero cuando el reloj lo mide. Menos de 6 horas y media de promedio ya cuenta como señal de alerta.">
        <Tarjeta relleno={12}>
          {noches.length > 1 ? (
            <>
              <BarrasApiladas barras={noches} altura={190} formato={(v, eje) => (eje ? `${Math.round(v)} h` : `${(Math.round(v * 10) / 10).toFixed(1)} h`)} descripcion="Horas de sueño por noche" />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', marginTop: 8 }}>
                {[['Profundo', '#5B3FD6'], ['REM', '#3DA9F5'], ['Ligero o dormido', '#A9C9F5']].map(([n, c]) => (
                  <span key={n} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: LT.text2 }}><span style={{ width: 9, height: 9, borderRadius: 3, background: c }} />{n}</span>
                ))}
              </div>
            </>
          ) : <div style={{ padding: '18px 4px', fontSize: 14, fontWeight: 500, color: LT.text2 }}>Todavía no hay suficientes noches medidas.</div>}
        </Tarjeta>
      </Seccion>
      {otras.length > 0 && (
        <Seccion titulo="Otras medidas">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
            {otras.map((o) => <Tarjeta key={o.c} relleno={14} style={{ borderRadius: 16 }}><Dato valor={o.valor} unidad={o.unidad} etiqueta={o.etiqueta} /></Tarjeta>)}
          </div>
        </Seccion>
      )}
      <div style={{ marginTop: 16, fontSize: 12.5, fontWeight: 600, color: LT.text3, ...NUM_STYLE }}>Los datos vienen del export de Apple Salud; se actualizan cada vez que se importa uno nuevo.</div>
    </div>
  );
}
