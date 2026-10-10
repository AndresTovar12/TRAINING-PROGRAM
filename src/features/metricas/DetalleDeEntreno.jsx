import { useEffect, useMemo, useState } from 'react';
import { Activity, ChevronLeft, Dumbbell, Share2, Trash2 } from 'lucide-react';
import { LT, KP, FONT, NUM_STYLE } from '@/lib/theme';
import { useConfirmacion } from '@/components/Confirmacion';
import { ZONAS, limitesDeZonas, zonaDe } from '@/lib/metricas/calculos';
import { DEPORTES, nombreDelDeporte } from '@/lib/metricas/deportes';
import { borraActividad, getActividad, getSeries } from '@/lib/metricasApi';
import { filasPorSerie } from '@/lib/metricas/porSerie';
import { sellosDeActividad, sellosDeSesionGuiada } from '@/lib/sello/datos';
import {
  distanciaTexto, duracionTexto, fechaLarga, horaTexto, relojTexto, ritmoTexto, velocidadTexto,
} from '@/lib/metricas/formato';
import { BarraDeZonas, GraficaDeLinea, RutaEnMapa } from './Graficas';
import { COLORES_DE_ZONA, ejeDeTiempo, marcasNumericas } from './graficasUtil';
import { Cargando, Dato, MosaicoDeDeporte, Seccion, Tarjeta } from './Piezas';
import PorSerie from './PorSerie';
import { ICONOS } from './tonos';
import EditorDelSello from '@/features/sello/EditorDelSello';

/* EL DETALLE DE UN ENTRENO: lo que el coach abre cuando quiere ver cómo fue de verdad.
   Arriba, los números de siempre; después el pulso en el tiempo con sus zonas pintadas detrás (se ve de golpe si fue fácil o duro), el ritmo, la ruta, el tiempo
   en cada zona y las vueltas. Todo con el valor exacto a un toque (arrastrando el dedo por la gráfica).

   Si ese entreno se hizo con el entreno guiado de la app (`sesion`, ver `useMetricas`), antes de las gráficas va «Por serie»: cada serie, lapso o set con su tiempo,
   su pulso y lo que descansó. Una sesión guiada SIN reloj de pulsera llega aquí como un entreno de origen `app`: no tiene pulso ni gráficas, solo «Por serie». */

const METODOS = { escrito: 'escrito a mano', visto: 'el más alto que se le ha visto', edad: 'estimado por su edad', medido: 'medido en reposo', estimado: 'estimado', 'por defecto': 'valor por defecto' };

// Un promedio móvil para que el ritmo no baile de un segundo a otro.
function suaviza(valores, ventana = 5) {
  return valores.map((_, i) => {
    const trozo = valores.slice(Math.max(0, i - Math.floor(ventana / 2)), i + Math.ceil(ventana / 2)).filter((v) => typeof v === 'number');
    return trozo.length ? trozo.reduce((s, v) => s + v, 0) / trozo.length : null;
  });
}

const indiceMasCercano = (t, x) => {
  let lo = 0; let hi = t.length - 1;
  while (lo < hi) { const m = (lo + hi) >> 1; if (t[m] < x) lo = m + 1; else hi = m; }
  return lo > 0 && Math.abs(t[lo - 1] - x) < Math.abs(t[lo] - x) ? lo - 1 : lo;
};

function GraficaDePulso({ series, fila, fcMax }) {
  const t = series.t;
  const fc = series.fc;
  const validos = fc.filter((v) => typeof v === 'number');
  if (!validos.length) return null;
  const min = Math.max(40, Math.floor((Math.min(...validos) - 8) / 10) * 10);
  const max = Math.min(230, Math.ceil((Math.max(...validos) + 8) / 10) * 10);
  const limites = limitesDeZonas(fcMax);
  const bandas = ZONAS.map((z, i) => ({ y0: i === 0 ? 0 : limites[i - 1], y1: i === 4 ? 300 : limites[i], color: COLORES_DE_ZONA[i], etiqueta: `Z${z.z}` }))
    .filter((b) => b.y1 > min && b.y0 < max);
  const duracion = Math.max(t[t.length - 1], fila.duracion_s ?? 0);
  const ritmo = series.vel ? series.vel.map((v) => (v > 0.5 ? 1000 / v : null)) : null;
  const detalle = (x) => {
    const i = indiceMasCercano(t, x);
    const filas = [{ color: LT.blue, texto: `${fc[i] ?? '—'} lpm${fc[i] ? ` · Z${zonaDe(fc[i], fcMax)}` : ''}` }];
    if (ritmo && DEPORTES[fila.deporte]?.ritmo && ritmo[i]) filas.push({ color: '#00B3C7', texto: `${ritmoTexto(ritmo[i])} /km` });
    else if (series.vel && series.vel[i] > 0 && fila.deporte === 'bici') filas.push({ color: '#00B3C7', texto: `${velocidadTexto(series.vel[i])} km/h` });
    if (series.alt && typeof series.alt[i] === 'number') filas.push({ color: '#9AA3B2', texto: `${Math.round(series.alt[i])} m` });
    return { titulo: relojTexto(t[i]), filas };
  };
  const vueltas = (fila.vueltas ?? []).filter((v) => v.t0 > 0 && v.tipo !== 'km').map((v) => ({ x: v.t0 }));
  return (
    <GraficaDeLinea
      series={[{ id: 'fc', nombre: 'Pulso', color: LT.blue, ancho: 2.2, puntos: t.map((x, i) => [x, typeof fc[i] === 'number' ? fc[i] : null]) }]}
      x={ejeDeTiempo(duracion)} y={{ min, max, marcas: marcasNumericas(min, max, 5).map((v) => ({ v, etiqueta: String(v) })) }}
      bandas={bandas} lineasV={vueltas} altura={250} detalle={detalle}
      descripcion={`Pulso durante el entreno: de ${Math.min(...validos)} a ${Math.max(...validos)} latidos por minuto`}
    />
  );
}

function GraficaDeRitmo({ series, fila }) {
  const t = series.t;
  if (!series.vel) return null;
  const conRitmo = DEPORTES[fila.deporte]?.ritmo;
  if (conRitmo) {
    const bruto = series.vel.map((v) => (v > 0.5 ? 1000 / v : null));
    const lisa = suaviza(bruto).map((v) => (v !== null && v >= 150 && v <= 900 ? v : null));
    const validos = lisa.filter((v) => v !== null).sort((a, b) => a - b);
    if (validos.length < 5) return null;
    const rapido = Math.max(150, Math.floor((validos[Math.floor(validos.length * 0.03)] - 15) / 30) * 30);
    const lento = Math.min(900, Math.ceil((validos[Math.floor(validos.length * 0.97)] + 15) / 30) * 30);
    const marcas = [];
    for (let v = rapido; v <= lento; v += (lento - rapido) > 240 ? 60 : 30) marcas.push({ v, etiqueta: ritmoTexto(v) });
    return (
      <GraficaDeLinea
        series={[{ id: 'ritmo', nombre: 'Ritmo', color: '#00A3B8', ancho: 2.2, area: false, puntos: t.map((x, i) => [x, lisa[i] === null ? null : Math.min(lento, Math.max(rapido, lisa[i]))]) }]}
        x={ejeDeTiempo(Math.max(t[t.length - 1], fila.duracion_s ?? 0))} y={{ min: lento, max: rapido, marcas }} altura={190} margen={{ t: 10, r: 12, b: 24, l: 44 }}
        detalle={(x) => { const i = indiceMasCercano(t, x); return { titulo: relojTexto(t[i]), filas: [{ color: '#00A3B8', texto: lisa[i] ? `${ritmoTexto(lisa[i])} /km` : 'Parado' }] }; }}
        descripcion="Ritmo durante el entreno, en minutos por kilómetro (arriba es más rápido)"
      />
    );
  }
  // En bici y demás: velocidad en km/h.
  const kmh = suaviza(series.vel.map((v) => (typeof v === 'number' ? v * 3.6 : null)));
  const validos = kmh.filter((v) => v !== null);
  if (validos.length < 5) return null;
  const max = Math.ceil(Math.max(...validos) / 5) * 5;
  return (
    <GraficaDeLinea
      series={[{ id: 'vel', nombre: 'Velocidad', color: '#00A3B8', ancho: 2.2, area: true, puntos: t.map((x, i) => [x, kmh[i]]) }]}
      x={ejeDeTiempo(Math.max(t[t.length - 1], fila.duracion_s ?? 0))} y={{ min: 0, max, marcas: marcasNumericas(0, max, 5).map((v) => ({ v, etiqueta: String(v) })) }} altura={190}
      detalle={(x) => { const i = indiceMasCercano(t, x); return { titulo: relojTexto(t[i]), filas: [{ color: '#00A3B8', texto: `${(Math.round(kmh[i] * 10) / 10).toFixed(1)} km/h` }] }; }}
      descripcion="Velocidad durante el entreno, en kilómetros por hora"
    />
  );
}

function GraficaDeAltura({ series, fila }) {
  const alt = series.alt;
  if (!alt || (fila.desnivel_pos_m ?? 0) < 15) return null;
  const validos = alt.filter((v) => typeof v === 'number');
  if (validos.length < 5) return null;
  const min = Math.floor(Math.min(...validos) / 10) * 10 - 5;
  const max = Math.ceil(Math.max(...validos) / 10) * 10 + 5;
  const t = series.t;
  return (
    <GraficaDeLinea
      series={[{ id: 'alt', nombre: 'Altura', color: '#8A93A6', ancho: 1.8, area: true, opacidadArea: 0.18, puntos: t.map((x, i) => [x, typeof alt[i] === 'number' ? alt[i] : null]) }]}
      x={ejeDeTiempo(Math.max(t[t.length - 1], fila.duracion_s ?? 0))} y={{ min, max, marcas: marcasNumericas(min, max, 3).map((v) => ({ v, etiqueta: `${v} m` })) }} altura={130}
      margen={{ t: 8, r: 12, b: 24, l: 52 }} descripcion="Altura durante el entreno, en metros"
    />
  );
}

/** ¿La serie trae suficientes valores de esa medida (potencia, cadencia) para dibujarla? */
const hayMedida = (series, campo) => Array.isArray(series?.[campo]) && series[campo].filter((v) => typeof v === 'number' && v > 0).length >= 5;

/** Una medida sencilla en el tiempo (potencia, cadencia): una línea con su eje desde cero y la lectura de cada momento al tocar. `paso`: de cuánto en cuánto sube el eje. */
function GraficaDeUnaMedida({ series, fila, campo, nombre, color, unidad, paso }) {
  const t = series.t;
  const v = series[campo];
  const max = Math.max(paso, Math.ceil(Math.max(...v.filter((x) => typeof x === 'number')) / paso) * paso);
  return (
    <GraficaDeLinea
      series={[{ id: campo, nombre, color, ancho: 2, area: true, opacidadArea: 0.1, puntos: t.map((x, i) => [x, typeof v[i] === 'number' && v[i] > 0 ? v[i] : null]) }]}
      x={ejeDeTiempo(Math.max(t[t.length - 1], fila.duracion_s ?? 0))} y={{ min: 0, max, marcas: marcasNumericas(0, max, 4).map((m) => ({ v: m, etiqueta: String(m) })) }} altura={170}
      detalle={(x) => { const i = indiceMasCercano(t, x); return { titulo: relojTexto(t[i]), filas: [{ color, texto: `${Math.round(v[i] ?? 0)} ${unidad}` }] }; }}
      descripcion={`${nombre} durante el entreno, en ${unidad}`}
    />
  );
}

/** La tabla de vueltas: tiempo, distancia, ritmo (con barra: más larga = más rápida), pulso. */
function TablaDeVueltas({ vueltas, deporte }) {
  const conRitmo = DEPORTES[deporte]?.ritmo;
  const ritmos = vueltas.map((v) => v.ritmo).filter((r) => r > 0);
  const rapido = Math.min(...ritmos);
  const lento = Math.max(...ritmos);
  const celda = { fontSize: 14, fontWeight: 700, color: LT.text, ...NUM_STYLE };
  const cabecera = { fontSize: 11, fontWeight: 700, color: LT.text3, letterSpacing: 0.5, textTransform: 'uppercase' };
  return (
    <div role="table" aria-label="Vueltas" style={{ display: 'flex', flexDirection: 'column' }}>
      <div role="row" style={{ display: 'grid', gridTemplateColumns: '34px 1fr 64px 1.3fr 52px', gap: 8, padding: '0 0 8px', borderBottom: `1px solid ${KP.line}` }}>
        <span role="columnheader" style={cabecera}>#</span>
        <span role="columnheader" style={cabecera}>Tiempo</span>
        <span role="columnheader" style={cabecera}>Dist.</span>
        <span role="columnheader" style={cabecera}>{conRitmo ? 'Ritmo' : 'Promedio'}</span>
        <span role="columnheader" style={{ ...cabecera, textAlign: 'right' }}>FC</span>
      </div>
      {vueltas.map((v) => {
        const mejor = ritmos.length > 1 && v.ritmo === rapido;
        const barra = v.ritmo > 0 && lento > rapido ? 0.35 + 0.65 * ((lento - v.ritmo) / (lento - rapido)) : 0.6;
        return (
          <div key={v.n} role="row" style={{ display: 'grid', gridTemplateColumns: '34px 1fr 64px 1.3fr 52px', gap: 8, alignItems: 'center', padding: '9px 0', borderBottom: `1px solid ${KP.line}` }}>
            <span role="cell" style={{ ...celda, color: LT.text2 }}>{v.n}</span>
            <span role="cell" style={celda}>{relojTexto(v.dur)}</span>
            <span role="cell" style={{ ...celda, fontWeight: 600, color: LT.text2 }}>{v.dist ? (v.dist >= 1000 ? `${(v.dist / 1000).toFixed(2)} km` : `${v.dist} m`) : '—'}</span>
            <span role="cell" style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              {conRitmo && v.ritmo > 0 ? (
                <>
                  <span style={{ ...celda, width: 40 }}>{ritmoTexto(v.ritmo)}</span>
                  <span aria-hidden="true" style={{ flex: 1, height: 8, borderRadius: 4, background: LT.surface2, overflow: 'hidden' }}>
                    <span style={{ display: 'block', height: '100%', width: `${Math.round(barra * 100)}%`, borderRadius: 4, background: mejor ? KP.mint : '#00A3B8' }} />
                  </span>
                </>
              ) : <span style={{ ...celda, fontWeight: 600, color: LT.text2 }}>{v.dist && v.dur ? `${velocidadTexto(v.dist / v.dur)} km/h` : '—'}</span>}
            </span>
            <span role="cell" style={{ ...celda, textAlign: 'right' }}>{v.fc ?? '—'}</span>
          </div>
        );
      })}
    </div>
  );
}

function SeriesDeFuerza({ sets }) {
  const series = sets.filter((s) => s.tipo === 'serie');
  if (!series.length) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {series.map((s, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: `1px solid ${KP.line}`, fontSize: 14, fontWeight: 700, color: LT.text, ...NUM_STYLE }}>
          <span style={{ width: 28, color: LT.text2 }}>{i + 1}</span>
          <span style={{ flex: 1 }}>{s.reps ? `${s.reps} reps` : '—'}{s.kg ? ` × ${s.kg} kg` : ''}</span>
          <span style={{ color: LT.text2, fontWeight: 600 }}>{s.dur ? duracionTexto(s.dur) : ''}</span>
        </div>
      ))}
    </div>
  );
}

export default function DetalleDeEntreno({ actividad, sesion = null, unidadPeso = 'kg', conSello = false, alVolver, puedeBorrar, alBorrado }) {
  const pregunta = useConfirmacion();
  const soloApp = actividad.origen === 'app';
  // Una sesión guiada sin reloj no tiene qué pedirle a la base: llega completa (quien lo abre pone `key` por entreno, así que no hay que reiniciar).
  const [estado, setEstado] = useState(() => (soloApp ? { cargando: false, fila: actividad, series: null, error: null } : { cargando: true, fila: null, series: null, error: null }));
  const [borrando, setBorrando] = useState(false);
  const [verSello, setVerSello] = useState(false);

  useEffect(() => {
    if (soloApp) return undefined;
    let cancelado = false;
    (async () => {
      try {
        const [fila, series] = await Promise.all([getActividad(actividad.id), getSeries(actividad.id)]);
        if (!cancelado) setEstado({ cargando: false, fila: fila ?? actividad, series, error: null });
      } catch (e) {
        if (!cancelado) setEstado({ cargando: false, fila: actividad, series: null, error: e?.message ?? 'No se pudo cargar el entreno' });
      }
    })();
    return () => { cancelado = true; };
  }, [actividad, soloApp]);

  const fila = estado.fila ?? actividad;
  const porSerie = useMemo(
    () => (sesion && !estado.cargando ? filasPorSerie(sesion, { actividad: soloApp ? null : fila, series: estado.series }) : null),
    [sesion, estado.cargando, estado.series, fila, soloApp],
  );
  const fcMax = fila.umbrales?.fc_max ?? null;
  const conRitmo = DEPORTES[fila.deporte]?.ritmo;
  const ritmoMedio = fila.metricas?.ritmo_medio_s_km ?? (fila.distancia_m >= 100 && fila.movimiento_s ? Math.round((fila.movimiento_s / fila.distancia_m) * 1000) : null);
  const kmh = fila.distancia_m >= 100 && (fila.movimiento_s ?? fila.duracion_s) ? (fila.distancia_m / (fila.movimiento_s ?? fila.duracion_s)) * 3.6 : null;
  const kcal = fila.kcal_activas ?? fila.kcal_totales;
  const zonaMedia = fila.fc_media && fcMax ? zonaDe(fila.fc_media, fcMax) : null;
  const vueltas = fila.vueltas ?? [];
  const kmExtra = fila.metricas?.km ?? [];
  const sets = fila.metricas?.sets ?? [];
  const tieneRuta = !!estado.series?.ruta;
  // El sello para redes (solo lo ve el propio atleta): con los datos del reloj, o con lo que midió la app si fue una sesión guiada sin reloj.
  const sellos = useMemo(() => {
    if (!conSello || estado.cargando) return [];
    return soloApp
      ? sellosDeSesionGuiada({ registro: sesion?.registro, inicio: sesion?.inicio, fin: sesion?.fin, unidadPeso }).sellos
      : sellosDeActividad({ fila, series: estado.series, sesion, unidadPeso }).sellos;
  }, [conSello, estado.cargando, estado.series, soloApp, fila, sesion, unidadPeso]);

  const tiles = useMemo(() => [
    { valor: duracionTexto(fila.duracion_s), etiqueta: fila.movimiento_s && fila.duracion_s - fila.movimiento_s > 60 ? `de tiempo (${duracionTexto(fila.movimiento_s)} en movimiento)` : 'de tiempo' },
    fila.distancia_m >= 100 && { valor: distanciaTexto(fila.distancia_m).split(' ')[0], unidad: distanciaTexto(fila.distancia_m).split(' ')[1], etiqueta: 'distancia' },
    conRitmo && ritmoMedio && { valor: ritmoTexto(ritmoMedio), unidad: '/km', etiqueta: 'ritmo medio' },
    !conRitmo && kmh && { valor: (Math.round(kmh * 10) / 10).toFixed(1), unidad: 'km/h', etiqueta: 'velocidad media' },
    fila.fc_media > 0 && { valor: fila.fc_media, unidad: 'lpm', etiqueta: zonaMedia ? `pulso medio · Z${zonaMedia}` : 'pulso medio', color: zonaMedia ? COLORES_DE_ZONA[zonaMedia - 1] : undefined },
    fila.fc_max > 0 && { valor: fila.fc_max, unidad: 'lpm', etiqueta: 'pulso máximo' },
    kcal > 0 && { valor: Math.round(kcal), unidad: 'kcal', etiqueta: fila.kcal_activas ? 'calorías activas' : 'calorías' },
    fila.desnivel_pos_m > 0 && { valor: Math.round(fila.desnivel_pos_m), unidad: 'm', etiqueta: 'de subida' },
    fila.cadencia_media > 0 && { valor: Math.round(fila.cadencia_media), unidad: DEPORTES[fila.deporte]?.ritmo ? 'ppm' : 'rpm', etiqueta: 'cadencia' },
    fila.potencia_media > 0 && { valor: fila.potencia_media, unidad: 'W', etiqueta: 'potencia media' },
    fila.carga > 0 && { valor: `${fila.carga_metodo === 'estimada' ? '≈' : ''}${Math.round(fila.carga)}`, etiqueta: fila.carga_metodo === 'estimada' ? 'carga (estimada)' : 'carga', color: LT.blue },
  ].filter(Boolean), [fila, conRitmo, ritmoMedio, kmh, kcal, zonaMedia]);

  async function borrar() {
    const va = await pregunta({
      titulo: '¿Borrar este entreno?', detalle: 'Se quita del historial y de las gráficas. Si lo vuelves a importar, regresa.', confirmar: 'Sí, borrarlo', peligro: true,
    });
    if (!va) return;
    setBorrando(true);
    try { await borraActividad(actividad.id); alBorrado?.(); } catch (e) { setEstado((s) => ({ ...s, error: e?.message ?? 'No se pudo borrar' })); setBorrando(false); }
  }

  if (verSello && sellos.length) {
    return (
      <div>
        <button
          type="button" onClick={() => setVerSello(false)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 2, padding: '6px 10px 6px 4px', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: FONT, fontSize: 14.5, fontWeight: 800, color: LT.blue, touchAction: 'manipulation', marginBottom: 10 }}
        >
          <ChevronLeft size={18} /> Entreno
        </button>
        <EditorDelSello sellos={sellos} Icono={soloApp ? Dumbbell : (ICONOS[fila.deporte] ?? Activity)} />
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14 }}>
        <button
          type="button" onClick={alVolver}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 2, padding: '6px 10px 6px 4px', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: FONT, fontSize: 14.5, fontWeight: 800, color: LT.blue, touchAction: 'manipulation' }}
        >
          <ChevronLeft size={18} /> Entrenos
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {sellos.length > 0 && (
            <button
              type="button" onClick={() => setVerSello(true)} className="kp-press"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 12, border: `1.5px solid ${LT.blue}`, background: LT.surface, cursor: 'pointer', fontFamily: FONT, fontSize: 14, fontWeight: 800, color: LT.blue, touchAction: 'manipulation' }}
            >
              <Share2 size={15} /> Sello
            </button>
          )}
        {puedeBorrar && (
          <button
            type="button" onClick={borrar} disabled={borrando} aria-label="Borrar este entreno"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 10px', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: FONT, fontSize: 13.5, fontWeight: 700, color: KP.danger, touchAction: 'manipulation' }}
          >
            <Trash2 size={15} /> Borrar
          </button>
        )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
        <MosaicoDeDeporte deporte={fila.deporte} size={52} />
        <div style={{ minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: 21, fontWeight: 800, letterSpacing: -0.4, color: LT.text, overflowWrap: 'anywhere' }}>{fila.titulo || nombreDelDeporte(fila.deporte)}</h2>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: LT.text2, marginTop: 3, ...NUM_STYLE }}>
            {fechaLarga(fila.inicio, fila.desfase_min)} · {horaTexto(fila.inicio, fila.desfase_min)}{fila.dispositivo ? ` · ${fila.dispositivo}` : ''}
          </div>
        </div>
      </div>

      {estado.error && <div role="alert" style={{ padding: '10px 12px', borderRadius: 12, background: KP.dangerSoft, color: KP.danger, fontSize: 13.5, fontWeight: 700, marginBottom: 12 }}>{estado.error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(128px, 1fr))', gap: 10 }}>
        {tiles.map((t, i) => (
          <Tarjeta key={i} relleno={14} style={{ borderRadius: 16 }}><Dato valor={t.valor} unidad={t.unidad} etiqueta={t.etiqueta} color={t.color} /></Tarjeta>
        ))}
      </div>

      {estado.cargando ? <Cargando texto="Cargando el pulso y la ruta…" /> : (
        <>
          {porSerie && <PorSerie resultado={porSerie} unidadPeso={unidadPeso} conReloj={!soloApp} />}
          {estado.series?.fc && (
            <Seccion titulo="Pulso" ayuda="Las franjas de color son las zonas de pulso: cuanto más arriba, más duro. Arrastra el dedo (o el cursor) por la gráfica para ver el valor de cada momento. Las líneas punteadas verticales son cambios de vuelta.">
              <Tarjeta relleno={12}>
                {fcMax ? <GraficaDePulso series={estado.series} fila={fila} fcMax={fcMax} /> : null}
              </Tarjeta>
            </Seccion>
          )}
          {!estado.series?.fc && fila.fc_media > 0 && (
            <Seccion titulo="Pulso"><div style={{ fontSize: 14.5, color: LT.text2, fontWeight: 500, lineHeight: 1.45 }}>De este entreno solo se guardó el resumen: pulso medio {fila.fc_media} lpm y máximo {fila.fc_max} lpm. Las gráficas no están (es un entreno viejo de una importación grande).</div></Seccion>
          )}
          {!estado.series && !(fila.fc_media > 0) && !soloApp && (
            <Seccion titulo="Pulso"><div style={{ fontSize: 14.5, color: LT.text2, fontWeight: 500, lineHeight: 1.45 }}>Este entreno no trae pulso medido.</div></Seccion>
          )}
          {estado.series?.vel && (
            <Seccion titulo={conRitmo ? 'Ritmo' : 'Velocidad'}>
              <Tarjeta relleno={12}><GraficaDeRitmo series={estado.series} fila={fila} /></Tarjeta>
              {estado.series.alt && (fila.desnivel_pos_m ?? 0) >= 15 && <Tarjeta relleno={12} style={{ marginTop: 10 }}><div style={{ fontSize: 12, fontWeight: 700, color: LT.text2, margin: '0 0 2px 4px' }}>Altura</div><GraficaDeAltura series={estado.series} fila={fila} /></Tarjeta>}
            </Seccion>
          )}
          {hayMedida(estado.series, 'pot') && <Seccion titulo="Potencia"><Tarjeta relleno={12}><GraficaDeUnaMedida series={estado.series} fila={fila} campo="pot" nombre="Potencia" color="#E8590C" unidad="W" paso={50} /></Tarjeta></Seccion>}
          {hayMedida(estado.series, 'cad') && <Seccion titulo="Cadencia"><Tarjeta relleno={12}><GraficaDeUnaMedida series={estado.series} fila={fila} campo="cad" nombre="Cadencia" color="#7C3AED" unidad={fila.deporte === 'bici' ? 'rpm' : 'pasos/min'} paso={20} /></Tarjeta></Seccion>}
          {fila.zonas_s?.some((s) => s > 0) && (
            <Seccion titulo="Tiempo en cada zona" ayuda="Las zonas se calculan con el pulso máximo del atleta. Z1 es muy suave y Z5 es esfuerzo máximo. Debajo dice con qué números se calcularon, por si hay que corregirlos.">
              <Tarjeta><BarraDeZonas segundos={fila.zonas_s} fcMax={fcMax} /></Tarjeta>
              {fila.umbrales && (
                <div style={{ marginTop: 8, fontSize: 12.5, fontWeight: 600, color: LT.text2, lineHeight: 1.45 }}>
                  Calculado con pulso máximo {fila.umbrales.fc_max} lpm ({METODOS[fila.umbrales.metodo?.fc_max] ?? 'estimado'}) y en reposo {fila.umbrales.fc_reposo} lpm ({METODOS[fila.umbrales.metodo?.fc_reposo] ?? 'estimado'}).
                </div>
              )}
            </Seccion>
          )}
          {tieneRuta && <Seccion titulo="Ruta"><RutaEnMapa lat={estado.series.ruta.lat} lon={estado.series.ruta.lon} /></Seccion>}
          {vueltas.length > 1 && <Seccion titulo={vueltas[0]?.tipo === 'km' ? 'Por kilómetro' : 'Vueltas del reloj'}><Tarjeta relleno={14}><TablaDeVueltas vueltas={vueltas} deporte={fila.deporte} /></Tarjeta></Seccion>}
          {kmExtra.length > 1 && <Seccion titulo="Por kilómetro"><Tarjeta relleno={14}><TablaDeVueltas vueltas={kmExtra} deporte={fila.deporte} /></Tarjeta></Seccion>}
          {sets.length > 0 && <Seccion titulo="Series"><Tarjeta relleno={14}><SeriesDeFuerza sets={sets} /></Tarjeta></Seccion>}
        </>
      )}
    </div>
  );
}
