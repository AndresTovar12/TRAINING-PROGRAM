import { useMemo, useState } from 'react';
import { ArrowRight, Check, CircleAlert, Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { LT, KP, FONT, NUM_STYLE, eyebrow } from '@/lib/theme';
import { facilMedioDuro } from '@/lib/metricas/derivados';
import { diaCorto, distanciaTexto, duracionTexto, rangoDeSemana, variacionTexto } from '@/lib/metricas/formato';
import { BarrasApiladas, BarraDeZonas, Chispa } from './Graficas';
import { COLORES_DE_ZONA } from './graficasUtil';
import { FilaDeEntreno } from './ListaDeEntrenos';
import { Dato, Insignia, Seccion, Tarjeta, TiempoGrande } from './Piezas';
import { TONOS } from './tonos';
import { ZONAS } from '@/lib/metricas/calculos';

/* RESUMEN: lo primero que ve el coach. Tres preguntas, tres tarjetas, en palabras: ¿cómo llega hoy? (la forma), ¿qué hizo esta semana? y ¿está recuperando bien?
   Abajo, las últimas 12 semanas y cómo reparte su esfuerzo. Todo se entiende sin saber qué es una zona ni un TSB; los nombres técnicos van chicos, para quien ya los conoce. */

const con = (n) => (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(Math.round(n));

function TarjetaDeForma({ d, alIrA }) {
  const t = TONOS[d.estado.tono];
  return (
    <Tarjeta style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={eyebrow(LT.text2)}>Forma de hoy</div>
        <Insignia tono={d.estado.tono}>{d.estado.titulo}</Insignia>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ color: t.c, fontSize: 44, fontWeight: 800, letterSpacing: -1.5, lineHeight: 1, ...NUM_STYLE }}>{con(d.forma.tsb)}</div>
        <Chispa valores={d.curva.slice(-28).map((p) => p.tsb)} color={t.c} />
      </div>
      <div style={{ fontSize: 14.5, lineHeight: 1.45, fontWeight: 500, color: LT.text }}>{d.estado.detalle}</div>
      <div style={{ display: 'flex', gap: 16, fontSize: 12.5, fontWeight: 600, color: LT.text2, ...NUM_STYLE }}>
        <span>Condición <b style={{ color: LT.text }}>{Math.round(d.forma.ctl)}</b></span>
        <span>Fatiga <b style={{ color: LT.text }}>{Math.round(d.forma.atl)}</b></span>
        {d.rampa !== null && <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 3 }}>{d.rampa >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}{con(d.rampa)} / sem</span>}
      </div>
      <button type="button" onClick={() => alIrA('carga')} style={enlace}>Ver la gráfica <ArrowRight size={14} /></button>
    </Tarjeta>
  );
}

const enlace = {
  alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 0', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: FONT,
  fontSize: 13.5, fontWeight: 800, color: LT.blue, touchAction: 'manipulation',
};

const LETRAS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const DIAS_LARGOS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

/** La semana de un vistazo: una barra por día, tan alta como lo que costó lo entrenado (la carga), con la letra del día debajo. Hoy va marcado; lo que falta por venir, tenue. */
function SemanaEnBarras({ dias }) {
  const tope = Math.max(40, ...dias.map((x) => x.carga));
  const texto = dias.map((x, i) => `${DIAS_LARGOS[i]}: ${x.futuro ? 'todavía no llega' : x.sesiones === 0 ? 'sin entreno' : `carga ${x.carga}`}`).join('; ');
  return (
    <div role="img" aria-label={`Carga de cada día de esta semana. ${texto}`} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 6, height: 68 }}>
      {dias.map((x, i) => (
        <div key={x.dia} title={`${diaCorto(x.dia)}${x.sesiones ? ` · carga ${x.carga}` : ''}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 5 }}>
          {x.sesiones > 0
            ? <span style={{ width: '100%', maxWidth: 26, height: Math.max(6, Math.round((x.carga / tope) * 46)), borderRadius: 7, background: LT.blue }} />
            : <span style={{ width: 10, height: 3, borderRadius: 2, background: x.futuro ? LT.border : LT.borderHi }} />}
          <span style={{ width: 20, height: 20, borderRadius: 10, display: 'grid', placeItems: 'center', fontSize: 11.5, fontWeight: x.esHoy ? 800 : 700, background: x.esHoy ? LT.blue : 'transparent', color: x.esHoy ? '#fff' : LT.text3 }}>{LETRAS[i]}</span>
        </div>
      ))}
    </div>
  );
}

function TarjetaDeSemana({ d, alIrA }) {
  const s = d.estaSemana;
  const p = d.semanaPasada;
  const cambio = variacionTexto(d.cambios.carga);
  return (
    <Tarjeta style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <div style={eyebrow(LT.text2)}>Esta semana</div>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: LT.text3, ...NUM_STYLE }}>{rangoDeSemana(s.lunes)}</span>
      </div>
      {s.sesiones === 0 ? (
        <div style={{ fontSize: 15, fontWeight: 600, color: LT.text2, lineHeight: 1.45 }}>Todavía no hay entrenos esta semana.{p.sesiones > 0 ? ` La pasada hizo ${p.sesiones} (${duracionTexto(p.duracion_s)}).` : ''}</div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <Dato valor={s.sesiones} etiqueta={s.sesiones === 1 ? 'entreno' : 'entrenos'} grande />
            <Dato valor={<TiempoGrande seg={s.duracion_s} />} etiqueta="de tiempo" grande />
            <Dato valor={s.carga} etiqueta="de carga" grande color={LT.blue} />
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', fontSize: 13, fontWeight: 600, color: LT.text2, ...NUM_STYLE }}>
            {s.distancia_m >= 100 && <span><b style={{ color: LT.text }}>{distanciaTexto(s.distancia_m)}</b> recorridos</span>}
            {s.fc_media && <span>Pulso medio <b style={{ color: LT.text }}>{s.fc_media}</b></span>}
            {cambio && <span style={{ color: d.cambios.carga > 25 ? KP.amber : LT.text2 }}>{cambio} de carga vs la semana pasada{d.semanaEnCurso ? ' a esta altura' : ''}</span>}
          </div>
          <SemanaEnBarras dias={d.diasDeLaSemana} />
        </>
      )}
      <button type="button" onClick={() => alIrA('entrenos')} style={enlace}>Ver sus entrenos <ArrowRight size={14} /></button>
    </Tarjeta>
  );
}

function FilaDeRecuperacion({ m, texto }) {
  const estados = {
    bien: { Icono: Check, c: KP.mint, soft: KP.mintSoft },
    atencion: { Icono: CircleAlert, c: KP.amber, soft: KP.amberSoft },
    'sin-base': { Icono: Minus, c: LT.text3, soft: LT.surface2 },
    'sin-datos': { Icono: Minus, c: LT.text3, soft: LT.surface2 },
  };
  const e = estados[m.estado] ?? estados['sin-datos'];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: `1px solid ${KP.line}` }}>
      <span aria-hidden="true" style={{ width: 24, height: 24, borderRadius: 8, flexShrink: 0, display: 'grid', placeItems: 'center', background: e.soft, color: e.c }}><e.Icono size={14} strokeWidth={3} /></span>
      <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 700, color: LT.text }}>{m.texto}
        {texto && <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: LT.text2 }}>{texto}</span>}
      </span>
      <span style={{ fontSize: 15, fontWeight: 800, color: LT.text, ...NUM_STYLE }}>{m.siete ?? '—'}<span style={{ fontSize: 12, fontWeight: 700, color: LT.text2 }}> {m.unidad}</span></span>
    </div>
  );
}

function TarjetaDeRecuperacion({ d, alIrA }) {
  const r = d.recuperacion;
  const sinDatos = r.veredicto.clave === 'sin-datos';
  return (
    <Tarjeta style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
        <div style={eyebrow(LT.text2)}>Recuperación</div>
        <Insignia tono={r.veredicto.tono}>{r.veredicto.titulo}</Insignia>
      </div>
      {sinDatos ? (
        <div style={{ fontSize: 14.5, lineHeight: 1.45, fontWeight: 500, color: LT.text2 }}>
          Sin pulso en reposo, HRV ni sueño de los últimos días. Se llenan al importar el export de Apple Salud del Apple Watch.
        </div>
      ) : (
        <>
          <div style={{ fontSize: 14.5, lineHeight: 1.45, fontWeight: 500, color: LT.text, marginBottom: 4 }}>{r.veredicto.detalle}</div>
          <FilaDeRecuperacion m={r.reposo} texto={r.reposo.base ? `Lo normal: ${r.reposo.base} lpm` : null} />
          <FilaDeRecuperacion m={r.hrv} texto={r.hrv.base ? `Lo normal: ${r.hrv.base} ms` : null} />
          <FilaDeRecuperacion m={r.sueno} texto="Promedio de 7 noches" />
        </>
      )}
      <button type="button" onClick={() => alIrA('recuperacion')} style={enlace}>Ver el detalle <ArrowRight size={14} /></button>
    </Tarjeta>
  );
}

const METRICAS = [
  { id: 'tiempo', titulo: 'Tiempo' }, { id: 'carga', titulo: 'Carga' }, { id: 'distancia', titulo: 'Distancia' },
];

function VolumenSemanal({ d }) {
  const [metrica, setMetrica] = useState('tiempo');
  const barras = useMemo(() => d.semanas.map((s, i) => {
    let partes;
    if (metrica === 'tiempo') {
      const conPulso = s.zonas_s.reduce((a, v) => a + v, 0);
      partes = [...s.zonas_s.map((v, k) => ({ valor: v, color: COLORES_DE_ZONA[k], nombre: `Z${k + 1} ${ZONAS[k].nombre}` })), { valor: Math.max(0, s.duracion_s - conPulso), color: '#D5D9E2', nombre: 'Sin pulso' }];
    } else if (metrica === 'carga') partes = [{ valor: s.carga, color: LT.blue, nombre: 'Carga' }];
    else partes = [{ valor: s.distancia_m / 1000, color: '#00B3C7', nombre: 'Distancia' }];
    return { clave: s.lunes, etiqueta: diaCorto(s.lunes), partes, marca: i === d.semanas.length - 1 };
  }), [d.semanas, metrica]);
  const formato = metrica === 'tiempo' ? (v, eje) => (eje ? `${Math.round(v / 3600)} h` : duracionTexto(v))
    : metrica === 'carga' ? (v) => String(Math.round(v)) : (v, eje) => (eje ? `${Math.round(v)} km` : `${(Math.round(v * 10) / 10).toFixed(1)} km`);
  return (
    <Tarjeta>
      <div role="group" aria-label="Qué medir" style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        {METRICAS.map((m) => (
          <button
            key={m.id} type="button" aria-pressed={metrica === m.id} onClick={() => setMetrica(m.id)}
            style={{
              minHeight: 34, padding: '0 13px', borderRadius: 10, cursor: 'pointer', fontFamily: FONT, fontSize: 13.5, fontWeight: 800, border: 'none', touchAction: 'manipulation',
              background: metrica === m.id ? LT.text : LT.surface2, color: metrica === m.id ? '#fff' : LT.text2,
            }}
          >
            {m.titulo}
          </button>
        ))}
      </div>
      <BarrasApiladas barras={barras} formato={formato} altura={210} descripcion={`Últimas 12 semanas: ${METRICAS.find((m) => m.id === metrica).titulo.toLowerCase()} por semana`} />
      {metrica === 'tiempo' && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', marginTop: 10 }}>
          {ZONAS.map((z, i) => (
            <span key={z.z} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: LT.text2 }}>
              <span style={{ width: 9, height: 9, borderRadius: 3, background: COLORES_DE_ZONA[i] }} />Z{z.z} {z.nombre}
            </span>
          ))}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: LT.text2 }}><span style={{ width: 9, height: 9, borderRadius: 3, background: '#D5D9E2' }} />Sin pulso</span>
        </div>
      )}
    </Tarjeta>
  );
}

function ZonasDeLasUltimas4({ d, umbrales }) {
  const g = facilMedioDuro(d.zonas4);
  return (
    <Tarjeta>
      {g ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10, marginBottom: 14 }}>
            <Dato valor={`${g.facil} %`} etiqueta="fácil (Z1–Z2)" grande />
            <Dato valor={`${g.medio} %`} etiqueta="medio (Z3)" grande />
            <Dato valor={`${g.duro} %`} etiqueta="duro (Z4–Z5)" grande />
          </div>
          <BarraDeZonas segundos={d.zonas4} fcMax={umbrales?.fc_max} />
          {d.conPulso < d.deLas4 && <div style={{ marginTop: 10, fontSize: 12.5, fontWeight: 600, color: LT.text2 }}>{d.deLas4 - d.conPulso} de {d.deLas4} entrenos no traen pulso: no cuentan aquí.</div>}
        </>
      ) : (
        <div style={{ fontSize: 14.5, fontWeight: 500, color: LT.text2, lineHeight: 1.45 }}>Ningún entreno de las últimas 4 semanas trae pulso, así que no se pueden contar las zonas.</div>
      )}
    </Tarjeta>
  );
}

export default function Resumen({ d, umbrales, alAbrir, alIrA }) {
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))', gap: 12 }}>
        {d.estado && <TarjetaDeForma d={d} alIrA={alIrA} />}
        <TarjetaDeSemana d={d} alIrA={alIrA} />
        <TarjetaDeRecuperacion d={d} alIrA={alIrA} />
      </div>
      <Seccion titulo="Las últimas 12 semanas" ayuda="Cada barra es una semana (lunes a domingo). En «Tiempo» los colores dicen cuánto de ese tiempo fue fácil, medio o duro según su pulso. «Carga» suma lo que costó cada entreno: una hora justo en su umbral vale 100 puntos.">
        <VolumenSemanal d={d} />
      </Seccion>
      <Seccion titulo="Cómo reparte su esfuerzo · últimas 4 semanas" ayuda="Se cuenta el tiempo que pasó en cada zona de pulso. Como referencia, quien entrena resistencia suele hacer cerca del 80 % fácil y 20 % duro; mucho tiempo «medio» deja cansado sin tanto beneficio.">
        <ZonasDeLasUltimas4 d={d} umbrales={umbrales} />
      </Seccion>
      <Seccion titulo="Últimos entrenos" derecha={<button type="button" onClick={() => alIrA('entrenos')} style={enlace}>Ver todos <ArrowRight size={14} /></button>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {d.ultimos.map((a) => <FilaDeEntreno key={a.id} a={a} alAbrir={alAbrir} />)}
        </div>
      </Seccion>
    </div>
  );
}
