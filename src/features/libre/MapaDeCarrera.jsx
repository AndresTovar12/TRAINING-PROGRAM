import { useEffect, useMemo, useRef, useState } from 'react';
import { trazoDeRuta } from '@/lib/ubicacion';

/* EL MAPA DE LA CARRERA (16 oct 2026). Andrés eligió mapa CON CALLES; su costo ya está en el Excel «Costos y margen» (unos $133 pesos al mes, fijo).

   Las calles salen de un mapa propio guardado en Cloudflare (Protomaps: datos de OpenStreetMap en un solo archivo `.pmtiles`), sin otra
   empresa cobrando por cada carrera. La dirección del archivo va en `VITE_MAPA_URL`. Mientras no esté, o si algo falla al cargarlo, se
   dibuja la ruta sola sobre fondo oscuro: la carrera nunca se queda sin mapa.

   `muestras`: los puntos de la ruta (ver `lib/ubicacion.js`). `sigue`: centrar en el último punto (corriendo) en vez de encuadrar toda la
   ruta (resumen). `interactivo`: se puede mover con el dedo. `alto`: en px o '100%'. */

const URL_DEL_MAPA = import.meta.env.VITE_MAPA_URL || '';
const COLOR_RUTA = '#FF5A5F';

export default function MapaDeCarrera({ muestras, sigue = true, interactivo = false, alto = 220, redondo = true, puntoAzul = false }) {
  const [conCalles, setConCalles] = useState(!!URL_DEL_MAPA);
  return (
    <div style={{ position: 'relative', height: alto, borderRadius: redondo ? 20 : 0, overflow: 'hidden', background: '#1B1F2E' }}>
      {conCalles
        ? <ConCalles muestras={muestras} sigue={sigue} interactivo={interactivo} puntoAzul={puntoAzul} alFallar={() => setConCalles(false)} />
        : <SinCalles muestras={muestras} puntoAzul={puntoAzul} />}
    </div>
  );
}

const coordenadas = (muestras) => (muestras ?? []).filter((m) => typeof m.lat === 'number' && typeof m.lon === 'number').map((m) => [m.lon, m.lat]);

function ConCalles({ muestras, sigue, interactivo, puntoAzul, alFallar }) {
  const caja = useRef(null);
  const mapa = useRef(null);
  const listo = useRef(false);
  const puntos = useMemo(() => coordenadas(muestras), [muestras]);
  const ultimos = useRef(puntos);
  useEffect(() => { ultimos.current = puntos; });

  // El mapa se arma una vez; las librerías se bajan solo aquí (pesan) y no en el resto de la app.
  useEffect(() => {
    let vivo = true;
    let instancia = null;
    (async () => {
      try {
        const [{ default: maplibregl }, { Protocol }, base] = await Promise.all([
          import('maplibre-gl'), import('pmtiles'), import('@protomaps/basemaps'), import('maplibre-gl/dist/maplibre-gl.css'),
        ]);
        if (!vivo || !caja.current) return;
        if (!window.__pmtilesListo) { maplibregl.addProtocol('pmtiles', new Protocol().tile); window.__pmtilesListo = true; }
        // Las capas oscuras de Protomaps SIN letreros: los nombres de calles piden fuentes de otro sitio, y corriendo no hacen falta.
        const capas = base.layers('calles', base.namedFlavor('dark'), { lang: 'es' }).filter((c) => c.type !== 'symbol');
        const inicio = ultimos.current.at(-1) ?? [-99.13, 19.43];
        instancia = new maplibregl.Map({
          container: caja.current,
          style: { version: 8, sources: { calles: { type: 'vector', url: `pmtiles://${URL_DEL_MAPA}`, attribution: '© OpenStreetMap' } }, layers: capas },
          center: inicio, zoom: 15, interactive: interactivo, attributionControl: { compact: true },
        });
        instancia.on('error', (e) => { if (!listo.current && /pmtiles|Failed to fetch|404/i.test(String(e?.error?.message ?? ''))) alFallar(); });
        instancia.on('load', () => {
          listo.current = true;
          instancia.addSource('ruta', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'LineString', coordinates: ultimos.current } } });
          instancia.addLayer({ id: 'ruta', type: 'line', source: 'ruta', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': COLOR_RUTA, 'line-width': 5 } });
          instancia.addSource('yo', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
          instancia.addLayer({ id: 'yo-borde', type: 'circle', source: 'yo', paint: { 'circle-radius': 9, 'circle-color': '#fff' } });
          instancia.addLayer({ id: 'yo', type: 'circle', source: 'yo', paint: { 'circle-radius': 6, 'circle-color': puntoAzul ? '#2F6BFF' : COLOR_RUTA } });
          mapa.current = instancia;
          pinta(instancia, ultimos.current, sigue);
        });
      } catch {
        if (vivo) alFallar();
      }
    })();
    return () => { vivo = false; instancia?.remove(); mapa.current = null; listo.current = false; };
    // El mapa se arma una sola vez; los puntos nuevos se pintan en el efecto de abajo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (mapa.current) pinta(mapa.current, puntos, sigue); }, [puntos, sigue]);

  return <div ref={caja} style={{ position: 'absolute', inset: 0 }} />;
}

function pinta(m, puntos, sigue) {
  m.getSource('ruta')?.setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: puntos } });
  const ultimo = puntos.at(-1);
  m.getSource('yo')?.setData({ type: 'FeatureCollection', features: ultimo ? [{ type: 'Feature', geometry: { type: 'Point', coordinates: ultimo } }] : [] });
  if (!ultimo) return;
  if (sigue) { m.easeTo({ center: ultimo, duration: 600 }); return; }
  const lon = puntos.map((p) => p[0]); const lat = puntos.map((p) => p[1]);
  m.fitBounds([[Math.min(...lon), Math.min(...lat)], [Math.max(...lon), Math.max(...lat)]], { padding: 40, duration: 0, maxZoom: 16 });
}

/** Sin el mapa de calles: la ruta sola, del mismo rojo, sobre fondo oscuro. */
function SinCalles({ muestras, puntoAzul }) {
  const trazo = useMemo(() => trazoDeRuta(muestras ?? [], { ancho: 360, alto: 240, margen: 28 }), [muestras]);
  return (
    <svg viewBox="0 0 360 240" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Tu ruta" style={{ position: 'absolute', inset: 0 }}>
      {trazo ? (
        <>
          <path d={trazo.d} fill="none" stroke={COLOR_RUTA} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx={trazo.inicio[0]} cy={trazo.inicio[1]} r="6" fill="#22C38E" stroke="#fff" strokeWidth="2.5" />
          <circle cx={trazo.fin[0]} cy={trazo.fin[1]} r="7" fill={puntoAzul ? '#2F6BFF' : COLOR_RUTA} stroke="#fff" strokeWidth="3" />
        </>
      ) : (
        <circle cx="180" cy="120" r="9" fill="#2F6BFF" stroke="#fff" strokeWidth="3" />
      )}
    </svg>
  );
}
