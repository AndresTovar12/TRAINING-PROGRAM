import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Loader2, MapPin, Pause, Play, X } from 'lucide-react';
import { LT, FONT, NUM_STYLE } from '@/lib/theme';
import { agregaPunto, enVivo, fuenteDeUbicacion, textoDeRitmo } from '@/lib/ubicacion';
import { avanceDelPaso, estadoDeRitmo, pedidoEnUnaLinea, ritmoObjetivo, sinSenal } from '@/lib/recorrido';
import { relojDeCronometro } from '@/lib/entrenoLibre';
import MapaDeCarrera from '@/features/libre/MapaDeCarrera';
import { AMBAR as AMBAR_OSCURO, BarraOscura, BotonOscuro, EnQueVa, HojaDePausa, NEGRO, NotaOscura, Numero, PreguntaOscura, Sigue, TENUE, VERDE as VERDE_OSCURO } from '@/features/training/PantallaDeCardio';
import { relojDe } from '@/lib/entrenoDatos';
import { vibra } from '@/lib/avisosNativos';
import { pitido } from '@/lib/pitidos';
import { useSenalGps, useUbicacionActual } from '@/features/libre/useEntrenoLibre';

/* EL CARDIO DEL PLAN, CON GPS (23 oct 2026). Un paso de 200 m o más (un sprint, un kilómetro, ver `lib/recorrido.js`) se hace con esta pantalla: la de la captura
   «Cardio» de la reestructura visual (`REESTRUCTURA VISUAL/USUARIO:ATLETA/TELEFONO/WORKOUT`). Andrés eligió ESTA y no la oscura del registro libre: «ayuda más a una persona
   que ya tiene una meta, que ya tiene una planificación»; la oscura es para quien entra gratis a registrar lo suyo (`PantallaDeCarrera`).
   El COLOR de la tarjeta de arriba es el del tipo de sesión que le puso el coach (`aspectoDelTipo`), no un rojo fijo.

   Qué lleva: la tarjeta con «Vuelta 3 de 10 · 400 m a 4:30 min/km» y «Te faltan 120 m», el medidor del ritmo CONTRA lo que pidió el coach (solo si lo pidió como ritmo),
   el mapita, la distancia y el tiempo (y el pulso si hay reloj), «Siguiente: …», y «Pausar» / «Próxima vuelta».
     1. Antes de salir: la meta y «Iniciar» (y «Sin GPS»).
     2. Corriendo: todo en vivo. «Pausar» congela el tiempo y deja de medir. «Próxima vuelta» termina con lo recorrido.
     3. Al llegar a la meta termina SOLA y enseña el resultado; pasa sola a lo que sigue. Si el GPS midió mal, «Cambiar el resultado».
     4. Sin señal 5 segundos: aviso en ámbar y que elija la persona (esperar, terminar con lo que lleva, anotarlo a mano o seguir sin mapa). No se borra nada.

   QUE LA APP GUÍE (Andrés: «pareciera que el humano está guiando el workout en lugar de que la app»). La regla: la app avanza sola cuando PUEDE saber que algo terminó;
   la persona toca solo lo que únicamente ella sabe. Por eso:
     · `arrancaSolo`: se llegó AVANZANDO (acabó el descanso o el paso anterior): en cuanto el GPS está listo corre el 3, 2, 1 y sale, sin otro «Iniciar».
       Si el GPS tarda, el botón «Iniciar» sigue ahí; nunca se espera una señal que no llega.
     · `sinCuenta`: quien lo usa ya dio su propio aviso (el reloj de lapsos cuenta 3, 2, 1 al terminar el descanso): sale corriendo en el instante en que se abre.
     · `sigueSolo`: al llegar a la meta se enseña el resultado `segResultado` segundos y pasa solo a lo que sigue. «Seguir» lo adelanta; «Cambiar el resultado» lo detiene.
       Con `segResultado={0}` no se enseña nada y pasa al instante: así en los kilómetros seguidos de unos lapsos, donde la persona sigue corriendo y el siguiente ya
       tiene que estar midiendo.

   No es una ventana: ocupa el lugar del paso (arriba queda la barra «Workout» del entreno). Quien lo use en otro sitio le pone su propia cabecera con `cabecera`.
   `paso`: `{ nombre, vuelta?, vueltas?, serieTexto? }`. `meta`: los metros. `carga`: lo que pide además («4:30 min/km», «100%»). `siguiente`: lo que viene, ya escrito.
   `color`: el del tipo de sesión. `pulso`: el del reloj, o `null` (sin reloj no sale el cuadrito).
   Lo que se manda al terminar: `onTermina({ metros, seg, fin })` (`fin`: la hora en que llegó, no la de cuando se toca «Seguir»). Sin `onAnotar` no se ofrece
   «Cambiar el resultado» ni «Anotar a mano» (en un lapso no hay a dónde anotarlo). */

const SEGUNDOS_DEL_RESULTADO = 4; // lo que se ve el resultado de un sprint antes de pasar solo al descanso

const BLANCO = '#FFFFFF';
const VERDE = LT.mint;
const AMBAR = LT.warning;

const caja = { background: LT.surface, borderRadius: 20, boxShadow: '0 1px 2px rgba(17,19,24,0.04)' };
const kmTexto = (m) => `${(Math.max(0, m) / 1000).toFixed(2)}`;

function Boton({ children, onClick, variante = 'claro', disabled = false, ancho = false }) {
  const estilos = {
    oscuro: { background: LT.text, color: BLANCO },
    claro: { background: LT.surface, color: LT.text, boxShadow: '0 1px 2px rgba(17,19,24,0.06)' },
    suave: { background: 'rgba(17,19,24,0.07)', color: LT.text },
  }[variante];
  return (
    <button
      type="button" onClick={onClick} disabled={disabled}
      style={{
        flex: ancho ? '1 1 100%' : 1, minHeight: 58, borderRadius: 18, border: 'none', cursor: disabled ? 'default' : 'pointer', fontFamily: FONT, fontSize: 17, fontWeight: 800,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 9, touchAction: 'manipulation', opacity: disabled ? 0.5 : 1, ...estilos,
      }}
    >
      {children}
    </button>
  );
}

function Cuadrito({ valor, etiqueta }) {
  return (
    <div style={{ flex: 1, minWidth: 0, background: 'rgba(17,19,24,0.05)', borderRadius: 16, padding: '10px 6px', textAlign: 'center' }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: LT.text, lineHeight: 1.1, ...NUM_STYLE }}>{valor}</div>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: LT.text2, marginTop: 3 }}>{etiqueta}</div>
    </div>
  );
}

// El medidor del ritmo de ahora contra lo que pidió el coach: lento a la izquierda, rápido a la derecha, la zona buena en verde y un marcador.
function MedidorDeRitmo({ estado, objetivo, ritmoSKm }) {
  const dicho = { bien: ['Buen ritmo', VERDE], rapido: ['Baja el ritmo', AMBAR], lento: ['Sube el ritmo', AMBAR] }[estado?.estado];
  return (
    <div style={{ ...caja, padding: '14px 16px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span style={{ fontSize: 40, fontWeight: 800, letterSpacing: -1, lineHeight: 1, color: LT.text, ...NUM_STYLE }}>{textoDeRitmo(ritmoSKm)}</span>
          <span style={{ fontSize: 15, fontWeight: 700, color: LT.text2 }}>/km</span>
        </div>
        {dicho
          ? <span style={{ background: dicho[1], color: BLANCO, borderRadius: 99, padding: '6px 14px', fontSize: 14.5, fontWeight: 800 }}>{dicho[0]}</span>
          : <span style={{ color: LT.text3, fontSize: 14, fontWeight: 700 }}>Tomando ritmo…</span>}
      </div>
      {objetivo && (
        <>
          <div style={{ position: 'relative', height: 10, borderRadius: 5, background: 'rgba(17,19,24,0.08)', margin: '14px 0 8px' }}>
            {estado && <span aria-hidden="true" style={{ position: 'absolute', top: 0, bottom: 0, left: `${estado.zona[0] * 100}%`, width: `${(estado.zona[1] - estado.zona[0]) * 100}%`, borderRadius: 5, background: VERDE }} />}
            {estado && <span aria-hidden="true" style={{ position: 'absolute', top: -5, width: 5, height: 20, borderRadius: 3, background: LT.text, left: `calc(${estado.pos * 100}% - 2px)`, transition: 'left .4s' }} />}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, fontWeight: 600, color: LT.text3, ...NUM_STYLE }}>
            <span>lento</span>
            <span>{textoDeRitmo(objetivo.min)} – {textoDeRitmo(objetivo.max)}</span>
            <span>rápido</span>
          </div>
        </>
      )}
    </div>
  );
}

export default function PasoConGps({
  paso, meta, carga = '', siguiente = null, color = null, pulso = null, cabecera = null,
  arrancaSolo = false, sigueSolo = true, segResultado = SEGUNDOS_DEL_RESULTADO, sinCuenta = false,
  onTermina, onSinGps, onAnotar, onCerrar,
  // LA VERSIÓN NEGRA (22 nov 2026, la de la lista: Running, Cycling…): primero los números, el mapa en la esquina. `tiempoTotal`, `onLista`, `enQueVa`
  // y `sigue` ({ nombre, detalle }) son de la barra y del pie; `limiteSeg` el límite del sprint (regla 11).
  oscura = false, tiempoTotal = null, onLista = null, enQueVa = null, sigue = null, limiteSeg = null, kmTotalesAntes = 0,
  // Regla 13: dijo que lleva el teléfono, pero lleva 30 seg sin moverse en un tramo por metros: se le pregunta si lo dejó apoyado.
  onApoyado = null, sonido = false,
  // La hoja de pausa (23 nov 2026): tramo anterior, saltar, sonido, el teléfono y terminar. Ver `HojaDePausa`.
  opciones = null,
}) {
  const [fase, setFase] = useState(sinCuenta ? 'corriendo' : 'antes'); // antes | cuenta | corriendo | llego
  const [cuenta, setCuenta] = useState(3);
  const [desde, setDesde] = useState(() => (sinCuenta ? Date.now() : null));
  const [ahora, setAhora] = useState(() => Date.now());
  const [muestras, setMuestras] = useState([]);
  const [final, setFinal] = useState(null); // { metros, seg, fin }
  const [esperando, setEsperando] = useState(false); // eligió «seguir esperando» la señal
  const [ultimoPunto, setUltimoPunto] = useState(() => (sinCuenta ? Date.now() : NaN)); // la hora del último punto bueno del GPS
  const [pausadoDesde, setPausadoDesde] = useState(null); // la hora en que se pausó, o `null`
  const [pausaAcum, setPausaAcum] = useState(0); // los milisegundos que ya estuvo en pausa (las pausas terminadas)
  const tras = useRef(false); // se reanudó una pausa y todavía no entra un punto: el primero que entre queda marcado
  const pausa = useRef({ desde: null, acum: 0 }); // lo mismo, para el GPS (que no debe volver a suscribirse en cada pausa); el dibujo usa el estado, no esto
  // Con `sinCuenta` (los lapsos) no hay pantalla de «antes», pero igual se oye la señal mientras no llega el primer punto: si no hay permiso, no se espera nada.
  const senal = useSenalGps(fase === 'antes' || (sinCuenta && fase === 'corriendo' && muestras.length === 0));
  const aqui = useUbicacionActual(fase === 'antes');
  useEffect(() => {
    if (sinCuenta && (senal === 'negado' || senal === 'no_hay')) onCerrar();
  }, [sinCuenta, senal, onCerrar]);
  // El tiempo cuenta lo corrido: lo pausado no suma.
  const segDe = (hasta) => Math.max(0, (hasta - desde - pausaAcum - (pausadoDesde ? hasta - pausadoDesde : 0)) / 1000);
  const seg = desde ? (final ? final.seg : segDe(ahora)) : 0;
  const segEntero = Math.floor(seg);
  const vivo = useMemo(() => enVivo(muestras, segEntero), [muestras, segEntero]); // `segEntero`: sin puntos nuevos por un rato, el último ritmo ya no es de ahora
  const avance = avanceDelPaso(vivo.distanciaM, meta);
  const perdido = fase === 'corriendo' && !pausadoDesde && !esperando && sinSenal(ultimoPunto, ahora);
  const objetivo = useMemo(() => ritmoObjetivo(carga), [carga]);
  const estado = estadoDeRitmo(vivo.ritmoSKm, objetivo);
  const serie = paso.serieTexto ?? (paso.vueltas > 1 ? `Vuelta ${paso.vuelta} de ${paso.vueltas}` : paso.nombre);
  const pedido = pedidoEnUnaLinea(`${meta} m`, carga);
  const colorDelTipo = color || LT.blue;

  // Se llegó avanzando: en cuanto el GPS está listo, empieza solo la cuenta. Con otra señal (buscando, negado…) no hace nada: se queda el botón.
  useEffect(() => {
    if (fase === 'antes' && arrancaSolo && senal === 'lista') { setCuenta(3); setFase('cuenta'); }
  }, [fase, arrancaSolo, senal]);

  // Llegó a la meta: se ve el resultado unos segundos y sigue solo. Se guarda la función de hoy para que el temporizador no se reinicie en cada dibujo.
  const alTerminar = useRef(onTermina);
  useEffect(() => { alTerminar.current = onTermina; });
  useEffect(() => {
    if (fase !== 'llego' || !final || !sigueSolo) return undefined;
    const t = setTimeout(() => alTerminar.current(final), segResultado * 1000);
    return () => clearTimeout(t);
  }, [fase, final, sigueSolo, segResultado]);

  // La cuenta 3, 2, 1 antes de salir: nadie arranca en el mismo instante en que toca el botón.
  useEffect(() => {
    if (fase !== 'cuenta') return undefined;
    const t = setTimeout(() => {
      if (cuenta > 1) { setCuenta((c) => c - 1); return; }
      const t0 = Date.now();
      setDesde(t0); setUltimoPunto(t0); setAhora(t0); setFase('corriendo');
    }, 1000);
    return () => clearTimeout(t);
  }, [fase, cuenta]);

  // El reloj de la pantalla: solo avisa que se vuelva a dibujar (todo se cuenta con la hora).
  useEffect(() => {
    if (fase !== 'corriendo') return undefined;
    const id = setInterval(() => setAhora(Date.now()), 250);
    return () => clearInterval(id);
  }, [fase]);

  useEffect(() => { tras.current = false; }, [muestras]); // entró un punto (los que no sirven no cambian `muestras`)

  // Los puntos del GPS mientras corre (la misma fuente que el registro libre; en la app de la tienda, la del teléfono o el reloj). En pausa no se mide.
  useEffect(() => {
    if (fase !== 'corriendo' || !desde) return undefined;
    const fuente = fuenteDeUbicacion();
    if (!fuente.disponible()) return undefined;
    return fuente.sigue((p) => {
      if (pausa.current.desde) return;
      if (p.precision <= 30) { setUltimoPunto(Date.now()); setEsperando(false); }
      // El primer punto tras una pausa queda marcado: el ritmo de ahora no mide una ventana que cruce la pausa (`agregaPunto`).
      const t = (Date.now() - desde - pausa.current.acum) / 1000;
      const trasPausa = tras.current;
      setMuestras((m) => agregaPunto(m, p, t, null, { trasPausa }));
    }, () => {});
  }, [fase, desde]);

  // Llegó a la meta: termina solo.
  const termina = (metros) => {
    const fin = Date.now();
    setFinal({ metros: Math.round(metros), seg: Math.max(1, Math.round(segDe(fin))), fin });
    setFase('llego');
  };
  useEffect(() => {
    if (fase === 'corriendo' && !pausadoDesde && avance.llego) termina(vivo.distanciaM);
  });

  const alternaPausa = () => {
    const t = Date.now();
    if (pausa.current.desde) {
      pausa.current = { desde: null, acum: pausa.current.acum + (t - pausa.current.desde) };
      tras.current = true;
      setPausaAcum(pausa.current.acum);
      setPausadoDesde(null);
      setUltimoPunto(t);
    } else {
      pausa.current = { ...pausa.current, desde: t };
      setPausadoDesde(t);
    }
    setAhora(t);
  };

  const lleno = fase === 'llego' && !!final;
  const nSeg = paso.vueltas > 1 ? paso.vueltas : 1;
  const parteDeSeg = (i) => {
    const hecha = lleno ? 1 : avance.parte;
    if (nSeg === 1) return hecha;
    return i < paso.vuelta - 1 ? 1 : (i === paso.vuelta - 1 ? hecha : 0);
  };
  const antesDeSalir = fase === 'antes' || fase === 'cuenta';

  /* La tarjeta del color del tipo, arriba: en todas las fases. */
  const tarjetaDeColor = (
    <div style={{ position: 'relative', overflow: 'hidden', background: colorDelTipo, color: BLANCO, borderRadius: 22, padding: '14px 18px 16px', boxShadow: '0 8px 20px rgba(17,19,24,0.12)' }}>
      <span aria-hidden="true" style={{ position: 'absolute', right: -40, top: -50, width: 170, height: 170, borderRadius: '50%', background: 'rgba(255,255,255,0.13)' }} />
      <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ fontSize: 15, fontWeight: 800, whiteSpace: 'nowrap', flexShrink: 0 }}>{serie}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 700, opacity: 0.92, textAlign: 'right', minWidth: 0, overflowWrap: 'anywhere', ...NUM_STYLE }}>{pedido}</span>
          {onCerrar && fase !== 'cuenta' && fase !== 'llego' && (
            <button type="button" onClick={onCerrar} aria-label="Cerrar el mapa" style={{ width: 30, height: 30, borderRadius: 15, border: 'none', background: 'rgba(255,255,255,0.22)', color: BLANCO, display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0 }}><X size={16} /></button>
          )}
        </div>
      </div>
      <div style={{ position: 'relative', fontSize: 15, fontWeight: 600, opacity: 0.9, marginTop: 6 }}>
        {lleno
          ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Check size={16} strokeWidth={3} /> Vuelta lista</span>
          : (antesDeSalir ? 'Lo que pidió tu coach' : (pausadoDesde ? 'En pausa' : 'Te faltan'))}
      </div>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'baseline', gap: 6, lineHeight: 1 }}>
        <span style={{ fontSize: 92, fontWeight: 800, letterSpacing: -3, ...NUM_STYLE }}>{antesDeSalir ? meta : (lleno ? final.metros : avance.faltan)}</span>
        <span style={{ fontSize: 28, fontWeight: 700, opacity: 0.9 }}>m</span>
      </div>
      <div style={{ position: 'relative', display: 'flex', gap: 5, marginTop: 12 }} aria-hidden="true">
        {Array.from({ length: nSeg }, (_, i) => (
          <span key={i} style={{ flex: 1, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.28)', overflow: 'hidden' }}>
            <span style={{ display: 'block', height: '100%', width: `${Math.round(parteDeSeg(i) * 100)}%`, background: BLANCO, borderRadius: 3, transition: 'width .4s' }} />
          </span>
        ))}
      </div>
    </div>
  );

  const bolitaDeGps = (perdido || senal === 'sin_senal') ? AMBAR : '#22C38E';
  // El chip «GPS» va DEBAJO del mapa y no encima: el mapa nativo de Apple se pinta sobre la página y taparía lo que esté en su rectángulo.
  const mapita = (
    <div>
      <div style={{ position: 'relative', height: 150, borderRadius: 20, overflow: 'hidden', background: '#1A1F33' }}>
        <MapaDeCarrera muestras={muestras.length || !aqui ? muestras : [aqui]} sigue={fase !== 'llego'} alto="100%" redondo={false} puntoAzul />
      </div>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 8, padding: '3px 9px', borderRadius: 99, background: 'rgba(15,18,32,0.7)', color: BLANCO, fontSize: 12, fontWeight: 700 }}>
        <MapPin size={12} /> GPS
        <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: 3, background: bolitaDeGps }} />
      </span>
    </div>
  );

  const ritmoPromedio = lleno && final.metros > 0 ? (final.seg / final.metros) * 1000 : null;
  const cuadritos = (
    <div style={{ display: 'flex', gap: 8 }}>
      <Cuadrito valor={`${kmTexto(lleno ? final.metros : vivo.distanciaM)} km`} etiqueta="Distancia" />
      <Cuadrito valor={relojDeCronometro(seg)} etiqueta="Tiempo" />
      {lleno ? <Cuadrito valor={textoDeRitmo(ritmoPromedio)} etiqueta="Ritmo /km" /> : (pulso != null && <Cuadrito valor={String(pulso)} etiqueta="Pulso" />)}
    </div>
  );

  let pie = null;
  if (fase === 'llego') {
    pie = (
      <>
        <button type="button" onClick={() => onTermina(final)} style={{ position: 'relative', overflow: 'hidden', flex: '1 1 100%', minHeight: 58, borderRadius: 18, border: 'none', cursor: 'pointer', fontFamily: FONT, fontSize: 17, fontWeight: 800, color: BLANCO, background: LT.text, touchAction: 'manipulation' }}>
          {sigueSolo && segResultado > 0 && <span aria-hidden="true" style={{ position: 'absolute', left: 0, bottom: 0, height: 4, background: colorDelTipo, animation: `gps-sigue ${segResultado}s linear forwards` }} />}
          Seguir
        </button>
        {onAnotar && <Boton variante="suave" ancho onClick={() => onAnotar(final)}>Cambiar el resultado</Boton>}
      </>
    );
  } else if (fase === 'antes') {
    const sinGps = senal === 'no_hay' || senal === 'negado';
    pie = (
      <>
        {onSinGps && <Boton variante="claro" onClick={onSinGps}><MapPin size={18} /> Sin GPS</Boton>}
        <Boton variante="oscuro" disabled={sinGps} onClick={() => { setCuenta(3); setFase('cuenta'); }}>
          <span aria-hidden="true" style={{ width: 30, height: 30, borderRadius: '50%', background: colorDelTipo, display: 'grid', placeItems: 'center' }}><Play size={15} fill="#fff" /></span> Iniciar
        </Boton>
      </>
    );
  } else if (perdido) {
    pie = (
      <>
        <div role="alert" style={{ flex: '1 1 100%', padding: '10px 12px', borderRadius: 14, background: 'rgba(224,123,0,0.12)', color: '#8A4B00', fontSize: 14, fontWeight: 600, lineHeight: 1.35 }}>
          Perdimos la señal. Llevas unos {vivo.distanciaM} m de {meta}. Lo recorrido se guardó.
        </div>
        <Boton variante="oscuro" ancho onClick={() => setEsperando(true)}>Seguir esperando la señal</Boton>
        <Boton variante="suave" onClick={() => termina(vivo.distanciaM)}>Terminar con lo que llevo</Boton>
        {onAnotar
          ? <Boton variante="suave" onClick={() => onAnotar({ metros: vivo.distanciaM, seg: Math.round(seg) })}>Anotar a mano</Boton>
          : <Boton variante="suave" onClick={onCerrar}>Seguir sin mapa</Boton>}
      </>
    );
  } else if (fase === 'corriendo') {
    pie = (
      <>
        <Boton variante="claro" onClick={alternaPausa}>{pausadoDesde ? <><Play size={18} fill="currentColor" /> Seguir</> : <><Pause size={18} fill="currentColor" /> Pausar</>}</Boton>
        <Boton variante="oscuro" onClick={() => termina(vivo.distanciaM)}>
          <span aria-hidden="true" style={{ width: 22, height: 22, borderRadius: '50%', background: colorDelTipo, display: 'grid', placeItems: 'center' }}><span style={{ width: 8, height: 8, borderRadius: 4, background: BLANCO }} /></span> Próxima vuelta
        </Boton>
      </>
    );
  }

  /* ---------- LA VERSIÓN NEGRA ---------- */
  const [verMapa, setVerMapa] = useState(false);
  const [hojaPausa, setHojaPausa] = useState(false);
  const [noEstaApoyado, setNoEstaApoyado] = useState(false);
  const quieto = oscura && !!onApoyado && !noEstaApoyado && fase === 'corriendo' && !pausadoDesde && seg >= 30 && (vivo.distanciaM || 0) < 10;
  const fueraAntes = useRef(false);
  const fuera = !!estado && estado.estado !== 'bien' && fase === 'corriendo' && !pausadoDesde;
  // Fuera de ritmo vibra al salirse (regla 5); se calla al volver.
  useEffect(() => {
    if (oscura && fuera && !fueraAntes.current) { vibra('toque'); setTimeout(() => vibra('toque'), 250); if (sonido) pitido(estado?.estado === 'rapido' ? 'rapido' : 'lento'); }
    fueraAntes.current = fuera;
  }, [oscura, fuera, sonido, estado?.estado]);
  // Faltan 100 m (en tramos de 300 m o más): un pitido corto, para que no lo agarre de sorpresa.
  const prontoAvisado = useRef(false);
  useEffect(() => {
    if (!oscura || prontoAvisado.current || fase !== 'corriendo' || meta < 300 || avance.faltan > 100) return;
    prontoAvisado.current = true;
    if (sonido) pitido('pronto');
    vibra('toque');
  }, [oscura, fase, meta, avance.faltan, sonido]);
  if (oscura) {
    const ritmoTxt = textoDeRitmo(lleno ? ritmoPromedio : vivo.ritmoSKm);
    const colorRitmo = !estado || lleno ? '#fff' : estado.estado === 'bien' ? VERDE_OSCURO : AMBAR_OSCURO;
    const faltan = antesDeSalir ? meta : (lleno ? final.metros : avance.faltan);
    const enKm = (m) => (m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`);
    const segFinal = lleno ? final.seg : null;
    const enSeg = (x) => (x < 60 ? `${Math.round(x * 10) / 10} seg` : relojDe(x));
    const senalTxt = { lista: 'GPS listo', buscando: 'Buscando GPS…', negado: 'Sin permiso de ubicación', sin_senal: 'Sin señal de GPS', no_hay: 'Sin GPS' }[senal];
    const logro = lleno && limiteSeg ? segFinal <= limiteSeg : null;
    const estadoTxt = { bien: '✓ En tu ritmo', lento: `Vas lento · sube a ${objetivo ? `${textoDeRitmo(objetivo.min)}–${textoDeRitmo(objetivo.max)}` : ''}`, rapido: `Vas rápido · baja a ${objetivo ? `${textoDeRitmo(objetivo.min)}–${textoDeRitmo(objetivo.max)}` : ''}` }[estado?.estado];
    const botones = (() => {
      if (fase === 'llego') return (<><BotonOscuro onClick={() => onAnotar?.(final)}>Cambiar</BotonOscuro><BotonOscuro azul ancho onClick={() => onTermina(final)}>Seguir</BotonOscuro></>);
      if (fase === 'antes') {
        const sinGps = senal === 'no_hay' || senal === 'negado';
        return (<>{onSinGps && <BotonOscuro onClick={onSinGps}><MapPin size={17} /> Sin GPS</BotonOscuro>}<BotonOscuro azul ancho onClick={() => { if (!sinGps) { setCuenta(3); setFase('cuenta'); } }}><Play size={17} fill="#fff" /> {sinGps ? 'Sin señal' : 'Iniciar'}</BotonOscuro></>);
      }
      if (perdido) return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
          <div role="alert" style={{ background: 'rgba(255,176,32,.14)', color: AMBAR_OSCURO, borderRadius: 14, padding: '10px 12px', fontSize: 14, fontWeight: 700, lineHeight: 1.35 }}>Perdimos la señal. Llevas unos {Math.round(vivo.distanciaM)} m de {meta}. Lo recorrido se guardó.</div>
          <div style={{ display: 'flex', gap: 8 }}><BotonOscuro onClick={() => setEsperando(true)}>Esperar señal</BotonOscuro><BotonOscuro azul ancho onClick={() => termina(vivo.distanciaM)}>Terminar el tramo</BotonOscuro></div>
          {onAnotar && <BotonOscuro onClick={() => onAnotar({ metros: vivo.distanciaM, seg: Math.round(seg) })}>Anotar a mano</BotonOscuro>}
        </div>
      );
      if (fase === 'cuenta') return (<BotonOscuro onClick={() => setFase('antes')}>Cancelar</BotonOscuro>);
      return (<><BotonOscuro azul ancho onClick={() => { if (!pausadoDesde) alternaPausa(); setHojaPausa(true); }}>{pausadoDesde ? <><Play size={17} fill="#fff" /> Seguir</> : <><Pause size={17} fill="#fff" /> Pausar</>}</BotonOscuro><BotonOscuro onClick={() => termina(vivo.distanciaM)} label="Terminar este tramo y pasar al siguiente">Siguiente</BotonOscuro></>);
    })();
    if (verMapa) {
      return (
        <div style={{ position: 'relative', flex: 1, minHeight: 0, background: NEGRO, color: '#fff', fontFamily: FONT }}>
          <div style={{ position: 'absolute', inset: 0 }}><MapaDeCarrera muestras={muestras.length || !aqui ? muestras : [aqui]} sigue={fase !== 'llego'} alto="100%" redondo={false} puntoAzul /></div>
          <div style={{ position: 'absolute', left: 16, right: 16, top: 0 }}><BarraOscura tiempo={tiempoTotal} onLista={onLista} onMapa={() => setVerMapa(false)} mapaAbierto /></div>
          <div style={{ position: 'absolute', left: 12, right: 12, bottom: 82, background: '#0D0E12', borderRadius: 18, padding: '11px 14px' }}>
            <div style={{ fontSize: 12.5, fontWeight: 800, color: '#9AA0AE' }}>{enQueVa?.titulo}{enQueVa?.detalle ? ` · ${enQueVa.detalle}` : ''}</div>
            <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 6, textAlign: 'center' }}>
              <div><div style={{ fontSize: 26, fontWeight: 800, ...NUM_STYLE }}>{faltan} m</div><div style={{ fontSize: 11.5, color: TENUE, fontWeight: 600 }}>{antesDeSalir ? 'La meta' : 'Te faltan'}</div></div>
              <div><div style={{ fontSize: 26, fontWeight: 800, color: colorRitmo, ...NUM_STYLE }}>{ritmoTxt}</div><div style={{ fontSize: 11.5, color: TENUE, fontWeight: 600 }}>Ritmo (/km)</div></div>
            </div>
          </div>
          <div style={{ position: 'absolute', left: 12, right: 12, bottom: 14, display: 'flex', gap: 8 }}>{botones}</div>
        </div>
      );
    }
    return (
      <div role="group" aria-label={paso.nombre} style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '0 16px 14px', background: NEGRO, color: '#fff', fontFamily: FONT }}>
        {(hojaPausa || (pausadoDesde && fase === 'corriendo')) && opciones && (
          <HojaDePausa enPausa={!!pausadoDesde} seguir={pausadoDesde ? 'Seguir' : 'Volver'} titulo={pausadoDesde ? `En pausa · ${enQueVa?.titulo ?? paso.nombre}` : (enQueVa?.titulo ?? paso.nombre)} tiempo={tiempoTotal} onSeguir={() => { if (pausadoDesde) alternaPausa(); setHojaPausa(false); }}
            opciones={{ ...opciones, onSaltar: () => { setHojaPausa(false); termina(vivo.distanciaM); }, onAnterior: () => { setHojaPausa(false); opciones.onAnterior?.(); }, onTerminar: () => { setHojaPausa(false); opciones.onTerminar?.(); }, telefono: opciones.telefono ? { ...opciones.telefono, onCambia: () => { setHojaPausa(false); opciones.telefono.onCambia(); } } : null }} />
        )}
        {quieto && (
          <PreguntaOscura titulo="Tu teléfono no se está moviendo" texto="¿Lo dejaste apoyado? Así no puede medir tus metros."
            si="Sí, lo dejé apoyado" no="No, voy corriendo" onSi={onApoyado} onNo={() => setNoEstaApoyado(true)} />
        )}
        {/* «···» (23 nov 2026): las opciones sin parar el tramo. «Pausar» sigue parándolo. */}
        <BarraOscura tiempo={tiempoTotal} onLista={onLista} onMapa={() => setVerMapa(true)} onMas={opciones ? () => setHojaPausa(true) : null} />
        {fuera && estadoTxt && (
          <div role="alert" style={{ marginTop: 12, background: AMBAR_OSCURO, color: '#111318', borderRadius: 16, padding: '10px 12px', fontWeight: 800, fontSize: 15 }}>{estadoTxt}</div>
        )}
        {enQueVa && <EnQueVa {...enQueVa} parte={lleno ? 1 : avance.parte} />}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 18 }}>
          {fase === 'cuenta' ? <Numero valor={cuenta} etiqueta="Prepárate" tam={140} /> : lleno ? (
            <>
              <Numero valor={enSeg(segFinal)} etiqueta={limiteSeg ? `Límite: ${enSeg(limiteSeg)}` : `${final.metros} m`} tam={76} color={logro === false ? AMBAR_OSCURO : logro ? VERDE_OSCURO : '#fff'} />
              {logro !== null && <span style={{ fontSize: 13.5, fontWeight: 800, borderRadius: 99, padding: '6px 12px', background: logro ? 'rgba(43,214,154,.16)' : 'rgba(255,176,32,.16)', color: logro ? VERDE_OSCURO : AMBAR_OSCURO }}>{logro ? `Lo lograste · ${enSeg(limiteSeg - segFinal)} abajo` : `${enSeg(segFinal - limiteSeg)} arriba del límite`}</span>}
              {sigueSolo && segResultado > 0 && <span style={{ fontSize: 13, color: TENUE, fontWeight: 700 }}>Sigue solo en unos segundos</span>}
            </>
          ) : (
            <>
              <Numero valor={`${faltan} m`} etiqueta={antesDeSalir ? `${senalTxt ?? ''} · la meta` : (pausadoDesde ? 'En pausa · te faltan' : 'Te faltan')} tam={faltan >= 1000 ? 64 : 76} />
              {!antesDeSalir && (
                <Numero valor={ritmoTxt} etiqueta={objetivo ? `Ritmo (/km) · pedido ${textoDeRitmo(objetivo.min)}–${textoDeRitmo(objetivo.max)}` : 'Ritmo (/km)'} tam={54} color={colorRitmo}>
                  {estado && <span style={{ display: 'inline-block', marginTop: 7, fontSize: 12.5, fontWeight: 800, borderRadius: 99, padding: '4px 10px', background: estado.estado === 'bien' ? 'rgba(43,214,154,.16)' : 'rgba(255,176,32,.16)', color: colorRitmo }}>{estado.estado === 'bien' ? '✓ En tu ritmo' : estado.estado === 'lento' ? 'Más lento' : 'Más rápido'}</span>}
                </Numero>
              )}
              <div style={{ display: 'flex', gap: 26, justifyContent: 'center' }}>
                <Numero valor={enKm(kmTotalesAntes + (vivo.distanciaM || 0))} etiqueta="total" tam={28} />
                <Numero valor={relojDe(seg)} etiqueta="este tramo" tam={28} />
                {pulso != null && <Numero valor={pulso} etiqueta="pulso" tam={28} />}
              </div>
            </>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <NotaOscura texto={paso.nota} />
          {sigue && <Sigue titulo={paso.sinParar ? 'Sigue, sin parar' : 'Sigue'} nombre={sigue.nombre} detalle={sigue.detalle} />}
          <div style={{ display: 'flex', gap: 8 }}>{botones}</div>
        </div>
      </div>
    );
  }

  const textoDeSenal = { lista: 'GPS listo', buscando: 'Buscando GPS…', negado: 'Sin permiso de ubicación', sin_senal: 'Sin señal de GPS', no_hay: 'Sin GPS' }[senal];
  return (
    <div role="group" aria-label={paso.nombre} style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', fontFamily: FONT, color: LT.text }}>
      {cabecera}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        <div style={{ maxWidth: 520, margin: '0 auto', padding: '8px 18px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {tarjetaDeColor}
          {!antesDeSalir && !lleno && <MedidorDeRitmo estado={estado} objetivo={objetivo} ritmoSKm={vivo.ritmoSKm} />}
          {mapita}
          {!antesDeSalir && cuadritos}
          {fase === 'antes' && (
            <div style={{ ...caja, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, fontSize: 14.5, fontWeight: 600, color: LT.text2 }}>
              {senal === 'buscando' ? <Loader2 size={16} className="spin" /> : <span aria-hidden="true" style={{ width: 9, height: 9, borderRadius: 5, background: senal === 'lista' ? VERDE : AMBAR }} />}
              <span role="status">{textoDeSenal}{arrancaSolo && senal !== 'negado' && senal !== 'no_hay' ? ' · sales solo en cuanto esté listo' : ''}</span>
            </div>
          )}
          {siguiente && <div style={{ fontSize: 14, fontWeight: 600, color: LT.text2, padding: '0 2px' }}>Siguiente: <b style={{ color: LT.text }}>{siguiente}</b></div>}
        </div>
      </div>
      <div style={{ flexShrink: 0, padding: '8px 0 calc(12px + env(safe-area-inset-bottom))' }}>
        <div style={{ maxWidth: 520, margin: '0 auto', padding: '0 18px', display: 'flex', flexWrap: 'wrap', gap: 10 }}>{pie}</div>
      </div>
      {fase === 'cuenta' && (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'rgba(244,245,248,0.82)', zIndex: 2 }} aria-live="assertive">
          <div style={{ width: 190, height: 190, borderRadius: 95, background: colorDelTipo, color: BLANCO, display: 'grid', placeItems: 'center', fontSize: 104, fontWeight: 900, ...NUM_STYLE }}>{cuenta}</div>
        </div>
      )}
    </div>
  );
}
