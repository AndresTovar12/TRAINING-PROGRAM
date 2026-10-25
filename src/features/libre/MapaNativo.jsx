import { useEffect, useMemo, useRef, useState } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { Navigation } from 'lucide-react';
import {
  metrosEntre, ANGULO_3D, COLOR_RUTA, ESPERA_MAXIMA_MS, GROSOR_RUTA, ZOOM_INICIAL, ZOOM_SIGUE,
  adelgazaRuta, claveDeRuta, rumboDeRuta, ponClase, quitaClase, conTiempoLimite, creaFila, encuadre, inicioDelMapa, planDeEnvio, puntosDeMuestras, ubicacionGuardada,
} from '@/lib/mapaNativo';

/* EL MAPA DE APPLE DENTRO DE LA APP DE IPHONE (25 oct 2026). Andrés: el mapa dibujado por la página «se siente feo, como web». Este es el mapa de verdad del
   teléfono (MapKit), con el plugin `@capgo/capacitor-native-map`. No lo usa nadie directo: lo escoge `MapaDeCarrera`, que si algo falla (el plugin no existe, no
   crea el mapa o no avisa que está listo en ~4 s) vuelve solo al mapa de siempre (MapLibre). Mismas props que `MapaDeCarrera`, más `pantallaCompleta`.

   DOS MANERAS DE PONERLO:
   · `pantallaCompleta` (antes de salir y mapa grande en vivo): el mapa va DETRÁS de la página (`toBack`) y la página queda transparente encima. Para que se vea hay
     que hacer transparente el fondo de la pantalla y esconder la app de abajo: eso lo hace la clase `mapa-nativo-pantalla` de `index.css`, que se pone aquí cuando el
     mapa ya está listo y se quita al irse. Lo que debe recibir toques (paneles, botones) ya los recibe solo si tiene fondo o es botón; el panel de abajo lleva
     `data-mapa-panel` para que el corredor no quede tapado por él.
   · Mapa en un rectángulo (resumen, mini, tarjeta de un paso): el mapa se monta EN la página, justo en el rectángulo (`element`), y la sigue al moverse. Encima de ese
     rectángulo no debe haber nada de la página: el mapa nativo se pinta sobre ella.

   LA CÁMARA (25 oct, tras probarlo en el iPhone): la mueve este código con cada punto del GPS (`sigueAlCorredor`): zoom fijo, 3D a 45° y girada hacia donde va
   el corredor. NO se usa el seguimiento automático de MapKit: ponía su propia distancia y peleaba con todo. Si el usuario mueve el mapa con el dedo se deja de
   seguir (la flecha se vacía) y al tocarla vuelve. Botones 2D/3D y flecha: HTML flotando a la derecha, arriba del panel.

   Un solo mapa nativo a la vez (`dueno`): crear y destruir van en fila (`fila`), porque React en desarrollo monta, desmonta y vuelve a montar enseguida. */

const ESQUEMA = 'dark'; // el mapa de siempre ya era oscuro; cámbialo a 'default' para que siga el claro/oscuro del teléfono
const fila = creaFila();
let dueno = null;
let contador = 0;



const textoGuardado = () => { try { return localStorage.getItem('tl:ultima-ubicacion'); } catch { return null; } };

/** Cuánto tapa el panel de abajo (en puntos, desde su borde de arriba hasta el fondo de la pantalla). */
/* El plugin llama a `registerPlugin('NativeMap')` por dentro; su clase `NativeMap` no trae «seguir al usuario», así que se llama con el puente de bajo nivel
   (el mismo plugin ya registrado, sin registrarlo dos veces). */
const puenteDelMapa = () => Capacitor.Plugins?.NativeMap ?? registerPlugin('NativeMap');

const botonDelMapa = { width: 48, height: 48, borderRadius: 24, border: 'none', background: 'rgba(28,32,48,0.88)', color: '#fff', display: 'grid', placeItems: 'center', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 800, touchAction: 'manipulation', backdropFilter: 'blur(10px)', boxShadow: '0 4px 14px rgba(0,0,0,0.35)' };

/** Los márgenes del mapa a pantalla completa: abajo TODO el panel (el logo y «Legal» de Apple quedan arriba de él) y arriba lo justo para que el punto del corredor
    caiga cerca del centro de la pantalla y no a un tercio (con solo el margen de abajo, el punto salía muy arriba). */
const margenesDelMapa = () => {
  const abajo = reservaDelPanel();
  return { top: Math.max(0, Math.round(abajo - window.innerHeight * 0.1)), left: 0, right: 0, bottom: abajo };
};

const reservaDelPanel = () => {
  const panel = document.querySelector('[data-mapa-panel]');
  return panel ? Math.max(0, Math.round(window.innerHeight - panel.getBoundingClientRect().top)) : 0;
};

export default function MapaNativo({ muestras, sigue = true, interactivo = false, alto = 220, redondo = true, pantallaCompleta = false, alFallar }) {
  const caja = useRef(null);
  const puntos = useMemo(() => puntosDeMuestras(muestras), [muestras]);
  const [activo, setActivo] = useState(false);
  const [siguiendo, setSiguiendo] = useState(true); // la cámara va siguiendo al corredor (si arrastró el mapa con el dedo, no)
  const [en3d, setEn3d] = useState(true);
  const [foto, setFoto] = useState(null);
  const [alturaPanel, setAlturaPanel] = useState(0); // los botones redondos van justo arriba del panel de abajo
  const acciones = useRef({});
  const dato = useRef({ puntos, sigue });
  const empuja = useRef(null);
  const fallar = useRef(alFallar);
  useEffect(() => { fallar.current = alFallar; });

  // Lo que cambia (puntos nuevos, seguir o encuadrar) se manda al mapa sin recrearlo y con tope de una vez por segundo.
  useEffect(() => { dato.current = { puntos, sigue }; empuja.current?.(); }, [puntos, sigue]);

  useEffect(() => {
    const ficha = {};
    if (dueno) { fallar.current?.('ocupado'); return undefined; }
    dueno = ficha;
    const id = `tl-mapa-${++contador}`;
    const limite = Date.now() + ESPERA_MAXIMA_MS;
    const restante = () => Math.max(250, limite - Date.now());
    // El resumen (ni pantalla completa, ni sigue, ni se mueve) se enseña como foto fija del mapa de Apple.
    const comoFoto = !pantallaCompleta && !dato.current.sigue && !interactivo;
    const e = {
      vivo: true, mapa: null, LatLngBounds: null, elemento: null, listo: false, ids: [], ultimoEnvioMs: 0, claveEnviada: null, reloj: null, ocupado: false, otraVez: false, necesitaZoom: false,
      // `siguiendo`: la cámara va con el corredor (hasta que mueva el mapa con el dedo). `en3d`: inclinado 45°. `rumbo`: hacia dónde va (el mapa gira con él).
      siguiendo: true, en3d: dato.current.sigue, conocido: false, rumbo: 0,
    };
    setEn3d(e.en3d);

    const dibujaRuta = async (ruta) => {
      const { mapa } = e;
      if (ruta.length < 2) {
        if (e.ids.length) { const viejos = e.ids; e.ids = []; await mapa.removePolylines(viejos); }
        return;
      }
      // Primero la línea nueva y luego se quita la vieja: así no parpadea.
      const nuevos = await mapa.addPolylines([{ path: adelgazaRuta(ruta), strokeColor: COLOR_RUTA, strokeWeight: GROSOR_RUTA }]);
      const viejos = e.ids;
      e.ids = nuevos;
      if (viejos.length) await mapa.removePolylines(viejos);
    };

    /* LA CÁMARA LA LLEVA ESTE CÓDIGO, NO MAPKIT (25 oct 2026). El seguimiento automático de MapKit («followWithHeading») ponía su propia distancia, aplanaba el 3D y
       peleaba con cualquier ajuste: el mapa se veía lejos, se acercaba y se alejaba solo, y el botón de la flecha no sabía si seguía o no. Ahora, con cada punto del
       GPS (como mucho una vez por segundo) se pone la cámara: centrada en el corredor, al zoom fijo, inclinada en 3D y girada hacia donde va. El punto azul es el
       de Apple (`enableCurrentLocation`). Si el usuario mueve el mapa con el dedo, se deja de seguir; la flecha lo regresa. */
    const sigueAlCorredor = async (donde, primera) => {
      const rumbo = rumboDeRuta(dato.current.puntos);
      if (rumbo != null && e.en3d) e.rumbo = rumbo;
      await e.mapa.setCamera({
        coordinate: donde, zoom: ZOOM_SIGUE, angle: e.en3d ? ANGULO_3D : 0, bearing: e.en3d ? e.rumbo : 0,
        animate: !primera, animationDuration: 900,
      });
    };

    const mueveCamara = async (ruta, sigueAhora, primera) => {
      const { mapa } = e;
      if (sigueAhora) {
        if (!e.siguiendo) return; // movió el mapa con el dedo: la cámara se queda donde la dejó
        // Sin puntos todavía (antes de salir), la última ubicación conocida; sin nada, no se mueve.
        const donde = ruta.at(-1) ?? (e.conocido ? e.centroInicial : null);
        if (!donde) return;
        // El GPS tiembla unos metros aunque estés quieto: si el corredor no se movió de verdad desde la última vez que se centró, la cámara se queda quieta
        // (antes se re-centraba CADA segundo y el mapa nunca estaba quieto).
        if (!primera && !e.necesitaZoom && e.ultimoCentro && metrosEntre(e.ultimoCentro, donde) < 5) return;
        e.ultimoCentro = donde;
        // Sin ubicación al abrir el mapa estaba en todo México: al llegar la primera, se acerca de golpe (sin animar desde tan lejos).
        await sigueAlCorredor(donde, primera || e.necesitaZoom);
        e.necesitaZoom = false;
        return;
      }
      const ultimo = ruta.at(-1);
      if (!ultimo) return;
      const enc = encuadre(ruta);
      if (enc.tipo === 'punto') { await mapa.setCamera({ coordinate: enc.centro, zoom: ZOOM_INICIAL, angle: 0, animate: false }); return; }
      await mapa.setCamera({ angle: 0, animate: false }); // el resumen se ve plano
      if (pantallaCompleta) await mapa.setPadding({ top: 0, left: 0, right: 0, bottom: reservaDelPanel() }); // el resumen encuadra toda la ruta: sin margen de arriba
      await mapa.fitBounds(new e.LatLngBounds({ southwest: enc.southwest, northeast: enc.northeast, center: enc.centro }), 40);
    };

    const aplica = async (primera = false) => {
      if (!e.vivo || !e.listo) return;
      if (e.ocupado) { e.otraVez = true; return; }
      e.ocupado = true;
      try {
        const { puntos: ruta, sigue: sigueAhora } = dato.current;
        e.claveEnviada = claveDeRuta(ruta, sigueAhora);
        e.ultimoEnvioMs = Date.now();
        await dibujaRuta(ruta);
        if (e.vivo) await mueveCamara(ruta, sigueAhora, primera);
      } catch (err) {
        console.warn('Mapa nativo (ruta):', err);
      } finally {
        e.ocupado = false;
        if (e.otraVez) { e.otraVez = false; empuja.current?.(); }
      }
    };

    empuja.current = () => {
      if (!e.vivo || !e.listo) return;
      const plan = planDeEnvio({ ahora: Date.now(), ultimoEnvioMs: e.ultimoEnvioMs, claveActual: claveDeRuta(dato.current.puntos, dato.current.sigue), claveEnviada: e.claveEnviada });
      if (plan.accion === 'ahora') { clearTimeout(e.reloj); e.reloj = null; aplica(); }
      else if (plan.accion === 'esperar' && !e.reloj) e.reloj = setTimeout(() => { e.reloj = null; empuja.current?.(); }, plan.esperaMs);
    };

    const arranca = async () => {
      if (!e.vivo) return; // montaje de prueba que React ya deshizo: ni se crea
      const modulo = await conTiempoLimite(import('@capgo/capacitor-native-map'), restante(), 'el plugin del mapa no cargó');
      if (!e.vivo) return;
      const { NativeMap, LatLngBounds } = modulo;
      if (!pantallaCompleta) {
        // El elemento propio del plugin: en iPhone el mapa se monta en el «scroll» interno que este elemento crea. Se pone VACÍO (el plugin lo llena).
        e.elemento = document.createElement('capacitor-native-map');
        Object.assign(e.elemento.style, { display: 'block', position: 'absolute', top: '0', left: '0', width: '100%', height: '100%' });
        caja.current.appendChild(e.elemento);
        const r = e.elemento.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) { const err = new Error('el rectángulo del mapa no tiene tamaño'); err.razon = 'sin-tamano'; throw err; }
      }
      const inicio = inicioDelMapa(dato.current.puntos, ubicacionGuardada(textoGuardado()), dato.current.sigue ? ZOOM_SIGUE : ZOOM_INICIAL);
      e.necesitaZoom = !inicio.conocido;
      e.conocido = inicio.conocido;
      e.centroInicial = inicio.centro;
      let avisaListo;
      const listo = new Promise((res) => { avisaListo = res; });
      const creada = NativeMap.create({
        id,
        toBack: pantallaCompleta,
        ...(e.elemento ? { element: e.elemento } : {}),
        config: {
          center: inicio.centro,
          zoom: inicio.zoom,
          ...(pantallaCompleta ? { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight } : {}),
          // Como Aura: edificios en 3D y brújula, pero sin letreros de negocios. Sin gestos cuando no es interactivo para no robar el scroll.
          mapType: 'standard', colorScheme: ESQUEMA, showsPointsOfInterest: false, showsCompass: true, showsBuildings: true, showsScale: false, showsTraffic: false,
          gestures: { scroll: interactivo, zoom: interactivo, rotate: false, pitch: false },
        },
      }, () => avisaListo());
      let mapa;
      try {
        mapa = await conTiempoLimite(creada, restante(), 'el mapa nativo no se creó a tiempo');
        await conTiempoLimite(listo, restante(), 'el mapa nativo no avisó que estaba listo');
      } catch (err) {
        creada.then((m) => m.destroy()).catch(() => {}); // si llega tarde, se tira
        // Si el plugin se quedó a medias, su clase de «página transparente» se quedaría puesta: aquí se quita para que la app se vea normal en el respaldo.
        if (pantallaCompleta) { document.documentElement.classList.remove('native-map-to-back'); document.body.classList.remove('native-map-to-back'); }
        throw err;
      }
      if (!e.vivo) { mapa.destroy().catch(() => {}); return; }
      e.mapa = mapa;
      e.LatLngBounds = LatLngBounds;
      try { await mapa.enableCurrentLocation(true); } catch (err) { console.warn('Mapa nativo (punto azul):', err); }
      if (!e.vivo) return;
      // Pantalla completa: el margen de abajo es TODO el panel, para que el logo y «Legal» de Apple queden arriba del panel (Apple exige que se vean).
      if (pantallaCompleta) {
        try { await mapa.setPadding(dato.current.sigue ? margenesDelMapa() : { top: 0, left: 0, right: 0, bottom: reservaDelPanel() }); } catch (err) { console.warn('Mapa nativo (márgenes):', err); }
      }
      // Si el usuario mueve el mapa con el dedo (arrastrar o pellizcar), se deja de seguir y la flecha se vacía. Lo que mueve este código no cuenta (no es gesto).
      if (interactivo) {
        try {
          await mapa.setOnCameraMoveStartedListener((d) => {
            if (!d?.isGesture || !e.siguiendo) return;
            e.siguiendo = false;
            setSiguiendo(false);
          });
        } catch (err) { console.warn('Mapa nativo (arrastre):', err); }
      }
      acciones.current = {
        alterna3D: async () => {
          e.en3d = !e.en3d;
          setEn3d(e.en3d);
          try {
            if (!e.en3d) e.rumbo = 0; // en 2D, con el norte arriba
            await e.mapa.setCamera({ angle: e.en3d ? ANGULO_3D : 0, bearing: e.en3d ? e.rumbo : 0, animate: true, animationDuration: 500 });
          } catch (err) { console.warn('Mapa nativo (2D/3D):', err); }
        },
        recentra: async () => {
          // Vuelve a seguir al corredor: la cámara va a su último punto ya, sin esperar al siguiente punto del GPS.
          e.siguiendo = true;
          setSiguiendo(true);
          const donde = dato.current.puntos.at(-1) ?? (e.conocido ? e.centroInicial : null);
          e.ultimoCentro = donde;
          try { if (donde) await sigueAlCorredor(donde, false); } catch (err) { console.warn('Mapa nativo (volver):', err); }
        },
      };
      e.listo = true;
      if (!e.vivo) return; // se cerró mientras arrancaba: no se esconde nada
      if (pantallaCompleta) { ponClase(id); setAlturaPanel(reservaDelPanel()); setActivo(true); }
      await aplica(true);
      if (comoFoto && e.vivo) await vuelveFoto();
      else if (!pantallaCompleta && e.vivo) await compruebaMontado();
    };

    /* Un mapa en un rectángulo se monta buscando por dentro la vista que WebKit crea para su elemento; si no la encuentra, el plugin avisa «listo» igual y queda
       un cuadro oscuro. Una foto de prueba lo delata (sin montarse, el mapa no tiene tamaño y la foto falla): en ese caso, el mapa de siempre. */
    const compruebaMontado = async () => {
      // Dos intentos: una foto que falla una vez (el mapa aún cargando) no debe cambiar un mapa que sí está bien por el de siempre.
      for (let intento = 1; intento <= 2; intento += 1) {
        await new Promise((res) => { setTimeout(res, intento === 1 ? 1200 : 2000); });
        if (!e.vivo || !e.mapa) return;
        try {
          await conTiempoLimite(puenteDelMapa().takeSnapshot({ id }), 4000, 'el mapa chico no respondió');
          return;
        } catch (err) {
          console.warn(`Mapa nativo (rectángulo sin montar, intento ${intento}):`, err);
          if (intento === 2 && e.vivo) fallar.current?.('fallo');
        }
      }
    };

    /* EL RESUMEN SE VUELVE FOTO. Un mapa vivo dentro de una página que se desplaza se queda con el dedo (no deja bajar la página si empiezas encima de él) y
       no respeta las esquinas de la tarjeta. El resumen no se mueve: se le toma una foto al mapa ya encuadrado, se enseña como imagen y el mapa nativo se cierra.
       Si la foto falla, se queda el mapa vivo. */
    const vuelveFoto = async () => {
      await new Promise((res) => { setTimeout(res, 900); }); // que terminen de llegar las calles
      if (!e.vivo || !e.mapa) return;
      try {
        const { image } = await conTiempoLimite(puenteDelMapa().takeSnapshot({ id }), 4000, 'la foto del mapa tardó demasiado');
        if (!e.vivo || !image) return;
        setFoto(image);
        e.listo = false;
        const { mapa, elemento } = e;
        e.mapa = null;
        fila(async () => { try { await mapa?.destroy(); } catch { /* ya no estaba */ } elemento?.remove(); }).catch(() => {});
        if (dueno === ficha) dueno = null; // con la foto puesta ya no ocupa el mapa nativo: otra pantalla lo puede usar
      } catch (err) {
        console.warn('Mapa nativo (foto del resumen):', err);
        if (e.vivo) fallar.current?.('fallo'); // sin foto el mapa chico quedó vacío: mejor el mapa de siempre que un cuadro oscuro
      }
    };

    fila(arranca).catch((err) => {
      if (!e.vivo) return;
      console.warn('Mapa nativo no disponible, uso el de siempre:', err);
      fallar.current?.(err?.razon ?? 'fallo');
    });

    return () => {
      e.vivo = false;
      clearTimeout(e.reloj);
      empuja.current = null;
      acciones.current = {};
      if (dueno === ficha) dueno = null;
      quitaClase(id);
      // Destruir va en la fila, detrás de cualquier creación en camino (que al terminar verá que ya no vive y se tira sola).
      fila(async () => {
        const { mapa, elemento } = e;
        e.mapa = null;
        try { await mapa?.destroy(); } catch (err) { console.warn('Mapa nativo (cerrar):', err); }
        elemento?.remove();
      }).catch(() => {});
    };
    // El mapa se arma una sola vez por montaje; los puntos nuevos entran por `empuja`. `interactivo` y `pantallaCompleta` no cambian en la vida de un mapa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ position: 'relative', height: alto, borderRadius: redondo ? 20 : 0, overflow: 'hidden', background: pantallaCompleta && activo ? 'transparent' : '#1B1F2E' }}>
      <div ref={caja} style={{ position: 'absolute', inset: 0 }} />
      {foto && <img src={foto} alt="Tu ruta en el mapa" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
      {pantallaCompleta && activo && (
        // Los dos botones redondos de la derecha (como Aura), justo arriba del panel de abajo (no arriba: ahí sale la brújula del mapa).
        // `zIndex`: el degradado del panel de abajo sube por encima de esta zona y, aunque se vea transparente, se quedaba con el toque de la flecha (25 oct 2026).
        <div style={{ position: 'absolute', zIndex: 5, right: 14, bottom: alturaPanel + 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button type="button" data-map-overlay onClick={() => acciones.current.alterna3D?.()} aria-label={en3d ? 'Ver el mapa en 2D' : 'Ver el mapa en 3D'} style={botonDelMapa}>{en3d ? '2D' : '3D'}</button>
          {interactivo && <button
            type="button" data-map-overlay onClick={() => acciones.current.recentra?.()} aria-label={siguiendo ? 'Siguiendo tu ubicación' : 'Volver a mi ubicación'} aria-pressed={siguiendo}
            // Como Apple Maps: flecha RELLENA mientras te sigue; VACÍA cuando moviste el mapa (tócala para volver a ti).
            style={{ ...botonDelMapa, color: siguiendo ? '#4F8BFF' : '#FFFFFF' }}
          >
            <Navigation size={20} fill={siguiendo ? 'currentColor' : 'none'} />
          </button>}
        </div>
      )}
    </div>
  );
}
