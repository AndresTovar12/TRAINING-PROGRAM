import { Dumbbell, Trophy } from 'lucide-react';
import { LT, KP, NUM_STYLE } from '@/lib/theme';
import { desdeKilos, etiquetaUnidad } from '@/lib/unidades';
import { diaCorto, variacionTexto } from '@/lib/metricas/formato';
import { sumaDias } from '@/lib/metricas/forma';
import { BarrasApiladas } from './Graficas';
import { EtiquetaDeFuente } from './PorSerie';
import { Dato, EstadoVacio, Insignia, Seccion, Tarjeta } from './Piezas';

/* FUERZA: lo que se puede saber del trabajo de fuerza con solo lo que el atleta anotó en el entreno guiado, sin reloj de pulsera (ver `lib/metricas/fuerza.js`).
   Andrés (10 oct 2026): kilos totales de la semana, máximo estimado de cada levantamiento, récords y series cumplidas. */

const AYUDA_DE_MAXIMOS = (
  <>
    El <strong>máximo estimado</strong> es lo que el atleta levantaría de una sola repetición, calculado con su mejor serie (kilos × (1 + reps ÷ 30)). Es una
    estimación, no una prueba de 1RM. La etiqueta de al lado dice si esos kilos y reps los escribió a mano o si tocó «Listo» y dejó lo del plan: en ese caso es lo
    que decía el plan, no algo comprobado. De 13 reps para arriba no se estima.
  </>
);

const miles = (n) => Math.round(n).toLocaleString('es-MX');

/** `a`: lo que devuelve `analisisDeFuerza` (lo calcula quien arma las pestañas, que también necesita saber si hay algo). `unidadPeso`: la del atleta. */
export default function Fuerza({ a, hoy, unidadPeso = 'kg' }) {
  const u = etiquetaUnidad(unidadPeso);
  const aUnidad = (kg) => (unidadPeso === 'lb' ? Math.round(desdeKilos(kg, 'lb')) : Math.round(kg));

  if (!a.hay) {
    return (
      <EstadoVacio
        icono={Dumbbell} titulo="Todavía no hay series con peso"
        texto="Cuando el atleta haga entrenos guiados con kilos desde la app, aquí verás cuánto levanta cada semana, su máximo estimado de cada levantamiento y sus récords."
      />
    );
  }
  const { semana, semanas, maximos, records } = a;
  const cumplidas = semana.hechas + semana.saltadas;
  const cambio = variacionTexto(semana.cambio);
  const limiteReciente = sumaDias(hoy, -30);

  const barras = semanas.map((s, i) => ({
    clave: s.lunes, etiqueta: diaCorto(s.lunes), marca: i === semanas.length - 1, partes: [{ valor: aUnidad(s.kilos), color: LT.blue, nombre: 'Kilos levantados' }],
  }));

  return (
    <div>
      <Tarjeta relleno={18}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16 }}>
          <Dato grande valor={miles(aUnidad(semana.kilos))} unidad={u} etiqueta="levantados esta semana" />
          <Dato
            grande valor={cumplidas > 0 ? `${semana.hechas} de ${cumplidas}` : '—'} unidad={cumplidas > 0 ? 'series' : ''}
            etiqueta={semana.saltadas > 0 ? `cumplidas (${semana.saltadas} ${semana.saltadas === 1 ? 'saltada' : 'saltadas'})` : 'cumplidas'}
          />
        </div>
        {cambio && (
          <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Insignia tono={semana.cambio > 0 ? 'verde' : semana.cambio < 0 ? 'ambar' : 'neutro'}>{cambio}</Insignia>
            <span style={{ fontSize: 13.5, fontWeight: 600, color: LT.text2 }}>contra la semana pasada a esta altura ({miles(aUnidad(semana.anterior.kilos))} {u})</span>
          </div>
        )}
      </Tarjeta>

      <Seccion titulo="Kilos por semana">
        <Tarjeta relleno={12}>
          <BarrasApiladas
            barras={barras} altura={200} descripcion="Kilos levantados cada semana, las últimas ocho"
            formato={(v, eje) => (eje && v >= 1000 ? `${Math.round(v / 100) / 10}k` : `${miles(v)} ${u}`)}
          />
        </Tarjeta>
      </Seccion>

      {records.length > 0 && (
        <Seccion titulo="Récords de los últimos 30 días">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {records.map((r) => (
              <Tarjeta key={r.nombre} relleno={14} style={{ borderRadius: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
                <span aria-hidden="true" style={{ width: 40, height: 40, borderRadius: 13, background: KP.amberSoft, color: KP.amber, display: 'grid', placeItems: 'center', flexShrink: 0 }}><Trophy size={20} /></span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 15.5, fontWeight: 800, color: LT.text, overflowWrap: 'anywhere' }}>{r.nombre}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: LT.text2, ...NUM_STYLE }}>
                    {diaCorto(r.dia)} · pasó de {aUnidad(r.previo)} a {aUnidad(r.e1rm)} {u} estimados
                  </div>
                </div>
              </Tarjeta>
            ))}
          </div>
        </Seccion>
      )}

      <Seccion titulo="Máximo estimado por levantamiento" ayuda={AYUDA_DE_MAXIMOS}>
        {maximos.length === 0 ? (
          <div style={{ fontSize: 14.5, fontWeight: 500, color: LT.text2, lineHeight: 1.45 }}>Hacen falta series con peso de 12 repeticiones o menos para estimar un máximo.</div>
        ) : (
          <Tarjeta relleno={4}>
            {maximos.map((m, i) => (
              <div key={m.nombre} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 12px', borderTop: i === 0 ? 'none' : `1px solid ${KP.line}` }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 15.5, fontWeight: 800, color: LT.text, overflowWrap: 'anywhere' }}>
                    {m.nombre}
                    {m.record && m.dia >= limiteReciente && <span style={{ marginLeft: 8, verticalAlign: 'middle' }}><Insignia tono="ambar" icono={Trophy}>Récord</Insignia></span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px 8px', marginTop: 3, fontSize: 13, fontWeight: 600, color: LT.text2, ...NUM_STYLE }}>
                    <span>{desdeKilos(m.kg, unidadPeso)} {u} × {m.reps} · {diaCorto(m.dia)}</span>
                    <EtiquetaDeFuente fuente={m.fuente} />
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <span style={{ fontSize: 22, fontWeight: 800, color: LT.text, letterSpacing: -0.5, ...NUM_STYLE }}>≈{aUnidad(m.e1rm)}</span>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: LT.text2, marginLeft: 3 }}>{u}</span>
                </div>
              </div>
            ))}
          </Tarjeta>
        )}
      </Seccion>
    </div>
  );
}
