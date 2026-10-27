import { useEffect, useMemo, useRef, useState } from 'react';
import { trazoDeRuta } from '@/lib/ubicacion';
import { leeUbicacionGuardada, usaMapaNativo } from '@/lib/mapaNativo';
import MapaNativo from './MapaNativo';

/* EL MAPA DE LA CARRERA (16 oct 2026). Andrés eligió mapa CON CALLES; su costo es fijo y mínimo: el archivo (México + EE. UU., 10 GB, zoom 14) vive en R2 y casi cabe en el cupo gratis (24 oct 2026).

   Las calles salen de un mapa propio guardado en Cloudflare (Protomaps: datos de OpenStreetMap en un solo archivo `.pmtiles`), sin otra
   empresa cobrando por cada carrera. La dirección del archivo va en `VITE_MAPA_URL`. Mientras no esté, o si algo falla al cargarlo, se
   dibuja la ruta sola sobre fondo oscuro: la carrera nunca se queda sin mapa.

   `muestras`: los puntos de la ruta (ver `lib/ubicacion.js`). `sigue`: centrar en el último punto (corriendo) en vez de encuadrar toda la
   ruta (resumen). `interactivo`: se puede mover con el dedo. `alto`: en px o '100%'.

   ESTE ARCHIVO ES EL DESPACHADOR (25 oct 2026). En la app de iPhone intenta primero el mapa de Apple (`MapaNativo.jsx`); si no existe el plugin, no se crea o no
   avisa que está listo en ~8 s, vuelve solo a este mapa de abajo (MapLibre), que es también el de la web. `pantallaCompleta`: el mapa ocupa toda la pantalla y la
   interfaz va encima (solo lo usa el mapa nativo; el de abajo no lo necesita). */

const URL_DEL_MAPA = import.meta.env.VITE_MAPA_URL || '';
const COLOR_RUTA = '#FF5A5F';
const AZUL_YO = '#2F6BFF';

/* Las calles de Protomaps «dark» salían gris oscuro sobre casi negro y no se leían (comparado con Aura, 25 oct 2026). Se parte de ese mismo tema y se suben el
   contraste: las calles principales más claras y con borde oscuro, los edificios con relleno visible y el agua y los parques con algo de color. */
const COLORES_CON_CONTRASTE = {
  earth: '#262c3d', background: '#262c3d', water: '#1b3b63', park_a: '#1f4234', park_b: '#1b3a2d', wood_a: '#1f3a2f', wood_b: '#1f3a2f',
  industrial: '#2b3144', school: '#2d3347', hospital: '#2f3347', pedestrian: '#2d3448', buildings: '#434d6b',
  minor_service: '#566079', minor_service_casing: '#141826', minor_a: '#6a748f', minor_b: '#5d6783', minor_casing: '#141826', other: '#566079',
  link: '#8089a3', link_casing: '#141826', major: '#a3abc2', major_casing_early: '#141826', major_casing_late: '#141826', highway: '#d3d8e6', highway_casing_early: '#141826', highway_casing_late: '#141826',
  bridges_other: '#566079', bridges_minor: '#6a748f', bridges_link: '#8089a3', bridges_major: '#a3abc2', bridges_highway: '#d3d8e6',
  bridges_other_casing: '#141826', bridges_minor_casing: '#141826', bridges_link_casing: '#141826', bridges_major_casing: '#141826', bridges_highway_casing: '#141826',
  tunnel_other: '#3a4258', tunnel_minor: '#3a4258', tunnel_link: '#3a4258', tunnel_major: '#3a4258', tunnel_highway: '#3a4258',
};

/* Si el mapa nativo falla, no se vuelve a intentar durante un minuto (cada intento perdería hasta 8 s) y después sí: antes quedaba roto toda la sesión por un
   solo fallo en frío. Va por separado: que falle un mapa chico en un rectángulo (montarse en la página es lo delicado) no debe quitarle el mapa de Apple a la
   pantalla completa de la carrera, y al revés. Guarda la hora del fallo. */
const REINTENTO_MS = 60000;
const roto = { pantalla: 0, rectangulo: 0 };
const estaRoto = (modo) => Date.now() - roto[modo] < REINTENTO_MS;

export default function MapaDeCarrera(props) {
  const modo = props.pantallaCompleta ? 'pantalla' : 'rectangulo';
  const [motor, setMotor] = useState(() => (usaMapaNativo() && !estaRoto(modo) ? 'nativo' : 'web'));
  if (motor === 'nativo') {
    // Que otro mapa nativo ya esté abierto ('ocupado') o que el rectángulo aún no tenga tamaño ('sin-tamano') no es un fallo del plugin: solo este usa el de siempre.
    return <MapaNativo {...props} alFallar={(razon) => { if (razon === 'fallo') roto[modo] = Date.now(); setMotor('web'); }} />;
  }
  return <MapaWeb {...props} />;
}

function MapaWeb({ muestras, sigue = true, interactivo = false, alto = 220, redondo = true, puntoAzul = false }) {
  const [conCalles, setConCalles] = useState(!!URL_DEL_MAPA);
  return (
    <div style={{ position: 'relative', height: alto, borderRadius: redondo ? 20 : 0, overflow: 'hidden', background: '#1B1F2E' }}>
      {conCalles
        ? <ConCalles muestras={muestras} sigue={sigue} interactivo={interactivo} puntoAzul={puntoAzul} alFallar={() => setConCalles(false)} />
        : <SinCalles muestras={muestras} puntoAzul={puntoAzul} />}
    </div>
  );
}

/** La última ubicación conocida (la guarda `useUbicacionActual`) como `[lon, lat]` de MapLibre: el mapa abre ahí y no en el Zócalo. */
function ubicacionGuardada() {
  const g = leeUbicacionGuardada();
  return g ? [g.lng, g.lat] : null;
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
        // maplibre-gl se fijó en la 5.24: la 6 sacó su trabajador (worker) a un archivo aparte que Vite no empaqueta y el mapa se quedaba sin dibujar (24 oct 2026).
        // La 5 lo trae adentro. `mod.default ?? mod` funciona con las dos formas de exportar.
        const [mod, { Protocol }, base] = await Promise.all([
          import('maplibre-gl'), import('pmtiles'), import('@protomaps/basemaps'), import('maplibre-gl/dist/maplibre-gl.css'),
        ]);
        const maplibregl = mod.default ?? mod;
        if (!vivo || !caja.current) return;
        if (!window.__pmtilesListo) { maplibregl.addProtocol('pmtiles', new Protocol().tile); window.__pmtilesListo = true; }
        // Las capas oscuras de Protomaps SIN letreros: los nombres de calles piden fuentes de otro sitio, y corriendo no hacen falta.
        const capas = base.layers('calles', { ...base.namedFlavor('dark'), ...COLORES_CON_CONTRASTE }, { lang: 'es' }).filter((c) => c.type !== 'symbol');
        const inicio = ultimos.current.at(-1) ?? ubicacionGuardada() ?? [-99.13, 19.43];
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
          // El punto con halo (un círculo grande y transparente alrededor), como el punto azul del teléfono.
          const colorYo = puntoAzul ? AZUL_YO : COLOR_RUTA;
          instancia.addLayer({ id: 'yo-halo', type: 'circle', source: 'yo', paint: { 'circle-radius': 18, 'circle-color': colorYo, 'circle-opacity': 0.25 } });
          instancia.addLayer({ id: 'yo-borde', type: 'circle', source: 'yo', paint: { 'circle-radius': 9, 'circle-color': '#fff' } });
          instancia.addLayer({ id: 'yo', type: 'circle', source: 'yo', paint: { 'circle-radius': 6, 'circle-color': colorYo } });
          mapa.current = instancia;
          pinta(instancia, ultimos.current, sigue);
        });
      } catch (e) {
        console.error('Mapa con calles:', e);
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
