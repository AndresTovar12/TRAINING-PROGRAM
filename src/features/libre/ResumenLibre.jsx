import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, Share2, Trophy } from 'lucide-react';
import HojaFlotante from '@/components/HojaFlotante';
import { LT, FONT, NUM_STYLE, KP } from '@/lib/theme';
import { datosDelResumen } from '@/lib/resumenLibre';
import { nombreDelDeporte } from '@/lib/metricas/deportes';
import { fechaLarga, horaTexto } from '@/lib/metricas/formato';
import { sellosDeActividad } from '@/lib/sello/datos';
import { getSeries } from '@/lib/metricasApi';
import { muestrasDeRuta } from '@/lib/recorrido';
import { textoDeRitmo } from '@/lib/ubicacion';
import { actividadDeEntreno } from '@/lib/actividades';
import { ICONOS } from '@/features/metricas/tonos';
import MapaDeCarrera from './MapaDeCarrera';
import IconoDeActividad from './IconoDeActividad';
import { botonBlancoGrande, botonGrande, tarjetaBlanca } from './estilosLibre';

const EditorDelSello = lazy(() => import('@/features/sello/EditorDelSello'));

/* LA PÁGINA DE LA ACTIVIDAD (23 oct 2026, Activity Tracker; maqueta v4, pantalla «Tu actividad»). Al terminar un entreno, después de la celebración, se abre sola su activity
   card (como Aura) y al cerrarla se cae AQUÍ, en la página de esa actividad, no de regreso a Home. Desde «Tus entrenos» se abre igual, sin la tarjeta.
   Lleva: el mapa con la ruta (si llevó GPS), la fecha y el nombre con su ícono, el récord si lo rompió, los números, «Por kilómetro» (el más rápido en azul) y
   «Compartir activity card». Antes era una hoja con el resumen (12 oct 2026; reestructura visual el 15 oct).
   `fila`: la fila de `actividades`. `muestras`: la ruta recién medida (si no, se lee la guardada). `record`: lo de `recordDe`. `empiezaEnTarjeta`: abre ya con la tarjeta encima. */

const Dato = ({ valor, etiqueta }) => (
  <div style={{ minWidth: 0 }}>
    <div style={{ fontSize: 26, fontWeight: 800, color: LT.text, letterSpacing: -0.5, lineHeight: 1.1, ...NUM_STYLE }}>{valor}</div>
    <div style={{ fontSize: 12.5, fontWeight: 600, color: LT.text2, marginTop: 3 }}>{etiqueta}</div>
  </div>
);

export default function ResumenLibre({ fila, unidadPeso = 'kg', alCerrar, alCerrarTarjeta, empiezaEnTarjeta = false, muestras = null, record = null, actividad = null }) {
  const [verTarjeta, setVerTarjeta] = useState(empiezaEnTarjeta);
  // La ruta guardada (de un entreno con GPS): se lee una vez. La recién medida ya viene en `muestras`.
  const [series, setSeries] = useState(null);
  useEffect(() => {
    if (!fila?.id || (Array.isArray(muestras) && muestras.length >= 2)) return undefined;
    let vivo = true;
    getSeries(fila.id).then((s) => { if (vivo) setSeries(s); }).catch(() => {});
    return () => { vivo = false; };
  }, [fila?.id, muestras]);
  const ruta = useMemo(() => {
    if (Array.isArray(muestras) && muestras.length >= 2) return muestras;
    const m = muestrasDeRuta(series?.ruta);
    return m.length >= 2 ? m : null;
  }, [muestras, series]);
  // Con la ruta, la tarjeta también ofrece el diseño con la línea.
  const seriesDeTarjeta = useMemo(() => (ruta ? { ...(series ?? {}), ruta: { lat: ruta.map((p) => p.lat), lon: ruta.map((p) => p.lon) } } : series), [ruta, series]);
  const sellos = useMemo(() => sellosDeActividad({ fila, series: seriesDeTarjeta, sesion: null, unidadPeso }).sellos, [fila, seriesDeTarjeta, unidadPeso]);
  const nombre = fila.titulo || nombreDelDeporte(fila.deporte);
  const act = actividad ?? actividadDeEntreno(fila);
  // Se comparan por RITMO (segundos por km), no por lo que duró cada tramo: el último casi nunca es un kilómetro entero y por ser corto parecería el más rápido.
  const kms = (fila.vueltas ?? []).filter((v) => v.tipo === 'km' && v.dur > 0 && v.dist > 0).map((v) => ({ ...v, paso: v.ritmo ?? Math.round((v.dur / v.dist) * 1000) }));
  const rapido = kms.length ? Math.min(...kms.map((k) => k.paso)) : 0;
  const lento = kms.length ? Math.max(...kms.map((k) => k.paso)) : 0;
  const enBici = fila.deporte === 'bici';
  const cierraTarjeta = () => { setVerTarjeta(false); alCerrarTarjeta?.(); };

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={nombre} style={{ position: 'fixed', inset: 0, zIndex: 3200, background: LT.bg, fontFamily: FONT, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: 'calc(10px + env(safe-area-inset-top)) 12px 8px', maxWidth: 560, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        <button type="button" onClick={alCerrar} className="kp-press" style={{ display: 'inline-flex', alignItems: 'center', gap: 2, padding: '8px 12px 8px 6px', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: FONT, fontSize: 15.5, fontWeight: 800, color: LT.blue }}>
          <ChevronLeft size={20} /> Listo
        </button>
        {sellos.length > 0 && (
          <button type="button" onClick={() => setVerTarjeta(true)} aria-label="Compartir activity card" className="kp-press" style={{ width: 42, height: 42, borderRadius: 14, border: 'none', background: LT.surface, color: LT.text, display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
            <Share2 size={19} />
          </button>
        )}
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ maxWidth: 560, margin: '0 auto', padding: '0 16px calc(24px + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {ruta && (
            <div style={{ height: 220, borderRadius: 22, overflow: 'hidden', background: '#1A1F33' }}>
              <MapaDeCarrera muestras={ruta} sigue={false} alto="100%" redondo={false} />
            </div>
          )}
          <div style={{ ...tarjetaBlanca, padding: '18px 18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <IconoDeActividad actividad={act} size={46} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: KP.blue, ...NUM_STYLE }}>{fechaLarga(fila.inicio, fila.desfase_min)} · {horaTexto(fila.inicio, fila.desfase_min)}</div>
                <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.5, color: LT.text, marginTop: 2, overflowWrap: 'break-word' }}>{nombre}</div>
              </div>
            </div>
            {record && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginTop: 14, padding: '7px 12px', borderRadius: 99, background: '#FFF4D6', color: '#8A5A00', fontSize: 14, fontWeight: 800 }}>
                <Trophy size={16} /> {record.texto}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: 14, marginTop: 18 }}>
              {datosDelResumen(fila).map((d) => <Dato key={d.etiqueta} {...d} />)}
            </div>
          </div>
          {kms.length > 0 && (
            <div>
              <div style={{ fontSize: 17, fontWeight: 800, color: LT.text, margin: '4px 2px 8px' }}>Por kilómetro</div>
              <div style={{ ...tarjetaBlanca, padding: '4px 16px' }}>
                {kms.map((k, i) => {
                  const ancho = lento === rapido ? 70 : 35 + ((lento - k.paso) / (lento - rapido)) * 55;
                  return (
                    <div key={k.n} style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 46, borderTop: i > 0 ? '1px solid #ECEEF2' : 'none' }}>
                      <span style={{ minWidth: 20, fontSize: 14, fontWeight: 600, color: LT.text2, ...NUM_STYLE }}>{k.n}{k.dist < 990 ? <span style={{ fontSize: 11.5 }}> · {(k.dist / 1000).toFixed(2)} km</span> : null}</span>
                      <span style={{ flex: 1, height: 7, borderRadius: 4, background: '#EEF0F4', overflow: 'hidden' }}>
                        <span style={{ display: 'block', height: '100%', width: `${ancho}%`, borderRadius: 4, background: k.paso === rapido ? KP.blue : '#FF8A8E' }} />
                      </span>
                      <span style={{ width: 52, textAlign: 'right', fontSize: 15, fontWeight: 800, color: LT.text, ...NUM_STYLE }}>{enBici ? `${(3600 / k.paso).toFixed(1)}` : textoDeRitmo(k.paso)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {sellos.length > 0 && (
            <button type="button" onClick={() => setVerTarjeta(true)} className="kp-press" style={botonGrande()}><Share2 size={20} /> Compartir activity card</button>
          )}
          <button type="button" onClick={alCerrar} className="kp-press" style={botonBlancoGrande()}>Listo</button>
        </div>
      </div>
      {verTarjeta && (
        <HojaFlotante titulo="Activity card" onCerrar={cierraTarjeta} capa={3250}>
          <Suspense fallback={null}><EditorDelSello sellos={sellos} Icono={ICONOS[fila.deporte]} /></Suspense>
        </HojaFlotante>
      )}
    </div>,
    document.body,
  );
}
