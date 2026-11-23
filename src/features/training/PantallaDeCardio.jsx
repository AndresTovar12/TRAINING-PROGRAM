import { useEffect, useRef, useState } from 'react';
import { Camera, Check, ChevronLeft, ChevronRight, List, Map as IconoMapa, Minimize2, MoreHorizontal, Pause, Play, Smartphone, Volume2, VolumeX, X } from 'lucide-react';
import { FONT, LT, NUM_STYLE } from '@/lib/theme';
import { relojDe } from '@/lib/entrenoDatos';
import { BotonDeMantener } from '@/features/training/PantallasDelEntreno';
import { VideoRecortado } from '@/features/training/VideoRecortado';
import { ligaExterna } from '@/lib/videos';
import { EnQueVas } from '@/features/training/EnQueVas';

/**
 * EL ENTRENO DE LA LISTA, PRIMERO LOS NÚMEROS (paso 4 del entreno del atleta, 22 nov 2026; dibujos aprobados en `pw/p3-correr2.html`,
 * `p3-velocidad.html` y `p3-nbt.html`). Andrés: «lo que le quise copiar a Aura Share y a Strava… cuando empiezas a correr te aparece una pantalla
 * negra con los datos… en grande; arriba en la esquina puedes cerrar esa pantalla y te aparece el mapa».
 *
 * Es la pantalla de Running, Cycling, Swimming y Triatlón (los pasos de `pasosDeLaLista.js`). Lo mismo en todas:
 *   · arriba: «Workout» (la lista), el tiempo total y, si el paso va con GPS, el mapa en la esquina;
 *   · debajo: en qué va («Tramo 3 de 8 · 1 km rápido») con sus rayitas;
 *   · en medio: pocos números grandes, el más importante primero;
 *   · abajo: «Sigue …» y los botones. BOTÓN AZUL GRANDE = lo toca el atleta; sin él, la app avanza sola.
 * Lo que no está a la vista (tramo anterior, sonido, terminar) vive en «Workout».
 */

export const NEGRO = '#000';
export const TARJETA = '#15161A';
export const GRIS = '#1C1D22';
export const TENUE = '#8D93A0';
export const AZUL = '#2F5BFF';
export const VERDE = '#2BD69A';
export const AMBAR = '#FFB020';
export const ROJO = '#FF4D5E';

/** La barra de arriba: «Workout», el tiempo total y (si hay) el botón del mapa. */
export function BarraOscura({ tiempo, onLista, onMapa = null, chip = null, mapaAbierto = false, onMas = null }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, minHeight: 40 }}>
      <button type="button" onClick={onLista} className="kp-press" aria-label="Ver la lista de tu entreno"
        style={{ height: 38, padding: '0 12px 0 10px', borderRadius: 12, border: 'none', background: GRIS, color: '#fff', display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: FONT, fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>
        <List size={16} /> Workout
      </button>
      {tiempo ? <span role="timer" aria-label={`Llevas ${tiempo}`} style={{ fontSize: 24, fontWeight: 800, color: ROJO, ...NUM_STYLE }}>{tiempo}</span> : <span />}
      {onMapa ? (
        <button type="button" onClick={onMapa} className="kp-press" aria-label={mapaAbierto ? 'Cerrar el mapa' : 'Ver el mapa'}
          style={{ width: 38, height: 38, borderRadius: 19, border: 'none', background: GRIS, color: '#fff', display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
          {mapaAbierto ? <Minimize2 size={17} /> : <IconoMapa size={17} />}
        </button>
      ) : (chip ? <span style={{ fontSize: 12, fontWeight: 800, background: GRIS, color: '#9AA0AE', borderRadius: 99, padding: '7px 10px' }}>{chip}</span> : (onMas ? null : <span style={{ width: 38 }} />))}
      {onMas && (
        <button type="button" onClick={onMas} className="kp-press" aria-label="Más opciones"
          style={{ width: 38, height: 38, borderRadius: 19, border: 'none', background: GRIS, color: '#fff', display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0 }}>
          <MoreHorizontal size={18} />
        </button>
      )}
    </div>
  );
}

/** «Tramo 3 de 8 · 1 km rápido» y sus rayitas (`n` rayas, `hechas` llenas, la actual a `parte`). */
export function EnQueVa({ titulo, detalle, n = 0, hechas = 0, parte = 0, cuenta = null, linea = null }) {
  // Lo que se repite («Tramo 3 de 8», «Sprint 2 de 4»): la misma pieza que todas las pantallas (`EnQueVas`, 23 nov 2026), en negro y con el rojo de la
  // pantalla de carrera (los colores de la negra son los de la carrera libre, aprobados el 2 nov 2026). Debajo, qué es («1 km · 4:20 min/km»).
  if (cuenta) {
    return (
      <div style={{ marginTop: 14 }}>
        <EnQueVas {...cuenta} oscura color={ROJO} parte={parte} />
        {linea && <div style={{ fontSize: 14, fontWeight: 700, color: '#9AA0AE', marginTop: 8 }}>{linea}</div>}
      </div>
    );
  }
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontSize: 15, fontWeight: 800, lineHeight: 1.3 }}>{titulo}{detalle ? <span style={{ color: '#9AA0AE', fontWeight: 700 }}> · {detalle}</span> : null}</div>
      {n > 1 && (
        <div aria-hidden="true" style={{ display: 'flex', gap: 4, marginTop: 8 }}>
          {Array.from({ length: Math.min(n, 30) }, (_, i) => (
            <span key={i} style={{ flex: 1, height: 5, borderRadius: 3, background: '#2C2E35', overflow: 'hidden' }}>
              <span style={{ display: 'block', height: '100%', width: `${i < hechas ? 100 : i === hechas ? Math.round(parte * 100) : 0}%`, background: ROJO }} />
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function Numero({ valor, etiqueta, tam = 76, color = '#fff', children = null }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: tam, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 0.95, color, ...NUM_STYLE }}>{valor}</div>
      {etiqueta && <div style={{ fontSize: 14, fontWeight: 600, color: TENUE, marginTop: 6 }}>{etiqueta}</div>}
      {children}
    </div>
  );
}

export function Sigue({ titulo = 'Sigue', nombre, detalle }) {
  if (!nombre) return null;
  return (
    <div style={{ background: TARJETA, borderRadius: 16, padding: '10px 13px' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: TENUE }}>{titulo}</div>
      <div style={{ fontSize: 15, fontWeight: 800 }}>{nombre}{detalle ? <span style={{ color: TENUE, fontWeight: 700 }}> · {detalle}</span> : null}</div>
    </div>
  );
}

/** Lo que el coach le dejó dicho al atleta en ESTE paso («Sal explosivo», «Respira por la nariz»). Doble revisión del 23 nov 2026: en la pantalla
    negra no salía. Va arriba de «Sigue», corta (2 renglones; tocar la abre entera). */
/** El tiempo de la serie de nado que acaba de hacer («Tu serie 1 · 1:28 ✓ en tu ritmo»; regla 7), en la pantalla clara. */
export function TardoClaro({ tardo }) {
  if (!tardo) return null;
  return (
    <div style={{ background: LT.surface, borderRadius: 16, padding: '10px 12px', textAlign: 'center' }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: LT.text2 }}>{tardo.titulo}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: tardo.bien === false ? '#B45309' : tardo.bien ? LT.mint : LT.text, ...NUM_STYLE }}>{tardo.valor}{tardo.estado ? <span style={{ fontSize: 13, marginLeft: 8 }}>{tardo.estado}</span> : null}</div>
    </div>
  );
}

export function NotaOscura({ texto }) {
  const [abierta, setAbierta] = useState(false);
  if (!texto) return null;
  return (
    <button type="button" onClick={() => setAbierta((a) => !a)} data-nota-del-coach="" aria-expanded={abierta}
      style={{ textAlign: 'left', width: '100%', border: 'none', background: TARJETA, borderRadius: 16, padding: '10px 13px', color: '#fff', fontFamily: FONT, cursor: 'pointer' }}>
      <span style={{ display: 'block', fontSize: 12, fontWeight: 700, color: TENUE }}>Nota de tu coach</span>
      <span style={{ display: '-webkit-box', WebkitLineClamp: abierta ? 'unset' : 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', fontSize: 15, fontWeight: 700, lineHeight: 1.35 }}>{texto}</span>
    </button>
  );
}

export function BotonOscuro({ children, onClick, azul = false, ancho = false, label }) {
  return (
    <button type="button" onClick={onClick} className="kp-press" aria-label={label}
      style={{ flex: ancho ? 1.4 : 1, minHeight: 52, borderRadius: 26, border: 'none', background: azul ? AZUL : GRIS, color: '#fff', fontFamily: FONT, fontSize: 16, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer', touchAction: 'manipulation' }}>
      {children}
    </button>
  );
}

/** El botón enorme de lo que solo el atleta sabe («Listo», «Llegué», «Ya voy en la bici»). En el último paso se mantiene para terminar. */
export function BotonGrande({ texto, ayuda, onClick, esUltimo = false, onTerminar }) {
  if (esUltimo) {
    return <BotonDeMantener onTermina={onTerminar} texto="Mantén para terminar" fondo="#1B2C7A" relleno={AZUL} alto={120} radio={28} tamano={22} sombra="none" />;
  }
  return (
    <button type="button" onClick={onClick} className="kp-press"
      style={{ width: '100%', minHeight: 128, borderRadius: 28, border: 'none', background: AZUL, color: '#fff', fontFamily: FONT, cursor: 'pointer', touchAction: 'manipulation', display: 'grid', placeItems: 'center', textAlign: 'center', padding: 10 }}>
      <span>
        <span style={{ display: 'block', fontSize: 30, fontWeight: 800, lineHeight: 1.1 }}>{texto}</span>
        {ayuda && <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, opacity: 0.85, marginTop: 4 }}>{ayuda}</span>}
      </span>
    </button>
  );
}

const DE_DEPORTE = { bici: 'Ya voy en la bici', correr: 'Ya voy corriendo', nado: 'Ya voy nadando' };
const CHIP_DE_META = (meta) => (meta?.tipo === 'w' ? null : meta?.texto ?? null);


/**
 * Un paso de la lista SIN GPS: por tiempo (cuenta sola), o algo que el atleta termina («Listo», «Llegué»). Con GPS va `PasoConGps` (`oscura`).
 */
export function PantallaDeCardio(props) {
  if (props.paso.cara === 'guiado' && props.paso.video?.url) return <PasoGuiado key={props.paso.clave} {...props} />;
  return <PasoDeCardio {...props} />;
}

const SEGUNDOS_LISTO = 4;

/**
 * EL CALENTAMIENTO GUIADO (regla 1, 22 nov 2026: «pasa sola»). El video grande; al terminar dice «✓ Calentamiento listo · Sigue: …» unos segundos
 * y pasa solo. «Seguir ya» lo adelanta; mientras corre está «Saltar». Si el video es de TikTok o Instagram la app no puede saber cuándo acaba: sale
 * «Listo» para que el atleta avise.
 */
function PasoGuiado(props) {
  return props.clara ? <PasoGuiadoClaro {...props} /> : <PasoGuiadoOscuro {...props} />;
}

/** Lo que comparten las dos caras del calentamiento guiado: cuándo acabó el video y el «pasa solo» de unos segundos. */
function useGuiado(paso, esUltimo, onListo, onTerminar) {
  const [acabo, setAcabo] = useState(false);
  const liga = ligaExterna(paso.video.url);
  const sabeCuandoAcaba = !liga || liga.de === 'YouTube' || liga.de === 'Vimeo';
  const sigue = useRef(onListo);
  useEffect(() => { sigue.current = esUltimo ? onTerminar : onListo; });
  useEffect(() => {
    if (!acabo) return undefined;
    const t = setTimeout(() => sigue.current?.(), SEGUNDOS_LISTO * 1000);
    return () => clearTimeout(t);
  }, [acabo]);
  const video = { url: paso.video.url, inicio: paso.video.inicio ?? null, fin: paso.video.fin ?? null, sinAudio: false, encuadre: null };
  const aspecto = liga && liga.de !== 'YouTube' && liga.de !== 'Vimeo' ? '9 / 16' : '16 / 9';
  const duracion = paso.termina?.valor > 0 ? (paso.termina.valor < 60 ? `${paso.termina.valor} seg` : `${Math.round(paso.termina.valor / 60)} min`) : null;
  return { acabo, setAcabo, liga, sabeCuandoAcaba, sigue, video, aspecto, duracion };
}

/**
 * LA CARA CLARA (regla 18, 23 nov 2026: «la pantalla negra solo es para cuando se necesita»). El atleta está en su lugar siguiendo un video: no
 * necesita números, necesita ver. Va como Gym: el fondo del tipo, la barra «Workout» de arriba (la pone `EntrenoDelDia`), el nombre grande y el video.
 */
function PasoGuiadoClaro({ paso, siguiente, enQueVa, esUltimo, onListo, onSaltar, onTerminar, opciones, color }) {
  const { acabo, setAcabo, liga, sabeCuandoAcaba, sigue, video, aspecto, duracion } = useGuiado(paso, esUltimo, onListo, onTerminar);
  const c = color || LT.blue;
  const boton = (texto, onClick, principal = false, label) => (
    <button type="button" onClick={onClick} className="kp-press" aria-label={label}
      style={{ flex: principal ? 1.6 : 1, minHeight: 54, borderRadius: 27, border: 'none', background: principal ? c : LT.surface, color: principal ? '#fff' : LT.text, fontFamily: FONT, fontSize: 16, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer', touchAction: 'manipulation', boxShadow: principal ? 'none' : '0 1px 3px rgba(17,19,24,.08)' }}>
      {texto}
    </button>
  );
  return (
    <div style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '6px 16px 14px', color: LT.text }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: LT.text2 }}>{enQueVa.titulo}</div>
      <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.05, marginTop: 4 }}>{paso.nombre}</div>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 12, padding: '14px 0' }}>
        {acabo ? (
          <div data-calentamiento-listo="" style={{ background: LT.surface, borderRadius: 24, padding: '34px 18px', textAlign: 'center' }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: LT.mint }}>✓ {paso.deClase ? 'Video terminado' : `${enQueVa.titulo} listo`}</div>
            {siguiente && <div style={{ fontSize: 15, fontWeight: 700, color: LT.text2, marginTop: 6 }}>Sigue: {siguiente.nombre}</div>}
            <div aria-hidden="true" style={{ height: 5, borderRadius: 3, background: LT.surface2, marginTop: 16, overflow: 'hidden' }}>
              <span style={{ display: 'block', height: '100%', background: LT.mint, animation: `tl-listo ${SEGUNDOS_LISTO}s linear forwards` }} />
            </div>
            <style>{'@keyframes tl-listo{from{width:0}to{width:100%}}'}</style>
          </div>
        ) : (
          <div style={{ position: 'relative', width: '100%', aspectRatio: aspecto, maxHeight: '58vh', borderRadius: 20, overflow: 'hidden', background: '#111' }}>
            <VideoRecortado video={video} estilo={liga ? { width: '100%' } : undefined} reproduce onFin={() => setAcabo(true)} />
          </div>
        )}
        {!acabo && duracion && <div style={{ textAlign: 'center', fontSize: 14, fontWeight: 700, color: LT.text2 }}>{duracion} · pasa solo al terminar el video</div>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {!acabo && siguiente && (
          <div style={{ background: LT.surface, borderRadius: 16, padding: '10px 13px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: LT.text2 }}>Sigue</div>
            <div style={{ fontSize: 15, fontWeight: 800 }}>{siguiente.nombre}{siguiente.detalle ? <span style={{ color: LT.text2, fontWeight: 700 }}> · {siguiente.detalle}</span> : null}</div>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          {opciones?.puedeAnterior && boton(<ChevronLeft size={20} />, opciones.onAnterior, false, 'Volver al anterior')}
          {acabo
            ? boton('Seguir ya', () => sigue.current?.(), true)
            : sabeCuandoAcaba
              ? boton('Saltar', onSaltar)
              : boton('Listo', () => sigue.current?.(), true)}
        </div>
      </div>
    </div>
  );
}

function PasoGuiadoOscuro({ paso, siguiente, tiempo, enQueVa, esUltimo, onLista, onListo, onSaltar, onTerminar, opciones }) {
  const [acabo, setAcabo] = useState(false);
  const [hoja, setHoja] = useState(false);
  const liga = ligaExterna(paso.video.url);
  const sabeCuandoAcaba = !liga || liga.de === 'YouTube' || liga.de === 'Vimeo';
  const sigue = useRef(onListo);
  useEffect(() => { sigue.current = esUltimo ? onTerminar : onListo; });
  useEffect(() => {
    if (!acabo) return undefined;
    const t = setTimeout(() => sigue.current?.(), SEGUNDOS_LISTO * 1000);
    return () => clearTimeout(t);
  }, [acabo]);
  const video = { url: paso.video.url, inicio: paso.video.inicio ?? null, fin: paso.video.fin ?? null, sinAudio: false, encuadre: null };
  return (
    <div style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '0 16px 14px' }}>
      <BarraOscura tiempo={tiempo} onLista={onLista} onMas={() => setHoja(true)} />
      <EnQueVa titulo={enQueVa.titulo} detalle={paso.nombre !== enQueVa.titulo ? paso.nombre : 'guiado'} />
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 14, padding: '12px 0' }}>
        {acabo ? (
          <div data-calentamiento-listo="" style={{ background: 'rgba(43,214,154,.14)', borderRadius: 24, padding: '34px 18px', textAlign: 'center' }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: VERDE }}>✓ {paso.deClase ? 'Video terminado' : `${enQueVa.titulo} listo`}</div>
            {siguiente && <div style={{ fontSize: 15, fontWeight: 700, color: '#CFF5E6', marginTop: 6 }}>Sigue: {siguiente.nombre}</div>}
            <div aria-hidden="true" style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,.15)', marginTop: 16, overflow: 'hidden' }}>
              <span style={{ display: 'block', height: '100%', background: VERDE, animation: `tl-listo ${SEGUNDOS_LISTO}s linear forwards` }} />
            </div>
            <style>{'@keyframes tl-listo{from{width:0}to{width:100%}}'}</style>
          </div>
        ) : (
          <div style={{ position: 'relative', width: '100%', aspectRatio: liga && liga.de !== 'YouTube' && liga.de !== 'Vimeo' ? '9 / 16' : '16 / 9', maxHeight: '56vh', borderRadius: 20, overflow: 'hidden', background: '#111' }}>
            <VideoRecortado video={video} estilo={liga ? { width: '100%' } : undefined} reproduce onFin={() => setAcabo(true)} />
          </div>
        )}
        {!acabo && paso.termina?.valor > 0 && <div style={{ textAlign: 'center', fontSize: 14, fontWeight: 700, color: TENUE }}>{paso.termina.valor < 60 ? `${paso.termina.valor} seg` : `${Math.round(paso.termina.valor / 60)} min`} · pasa solo al terminar el video</div>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {!acabo && siguiente && <Sigue nombre={siguiente.nombre} detalle={siguiente.detalle} />}
        <div style={{ display: 'flex', gap: 8 }}>
          {acabo
            ? <BotonOscuro azul ancho onClick={() => sigue.current?.()}>Seguir ya</BotonOscuro>
            : sabeCuandoAcaba
              ? <BotonOscuro onClick={onSaltar}>Saltar</BotonOscuro>
              : <BotonOscuro azul ancho onClick={() => sigue.current?.()}>Listo</BotonOscuro>}
        </div>
      </div>
      {hoja && (
        <HojaDePausa enPausa={false} titulo={enQueVa.titulo} seguir="Volver" onSeguir={() => setHoja(false)}
          opciones={{ ...opciones, onAnterior: () => { setHoja(false); opciones?.onAnterior?.(); }, onSaltar: () => { setHoja(false); onSaltar(); }, onTerminar: () => { setHoja(false); opciones?.onTerminar?.(); } }} />
      )}
    </div>
  );
}

function PasoDeCardio({ paso, cuenta, siguiente, video, pulso, tiempo, enQueVa, esUltimo, onLista, onListo, onSaltar, onPausa, onTerminar, opciones, tecnica }) {
  const [hoja, setHoja] = useState(false);
  const porTiempo = paso.termina?.por === 'tiempo' && !!paso.pasaSola;
  const nado = paso.deporteDeLaParte === 'nado';
  /* EL SPRINT CORTO (menos de 200 m, sin GPS; 23 nov 2026). El teléfono se queda en la salida. Andrés: «nadie va a tocar un botón en el teléfono antes
     de hacer un sprint, chance después sí». Se toca «Listo» AL VOLVER y el descanso cuenta desde ahí: la caminata de regreso suma unos segundos de
     descanso, y en un sprint al máximo descansar de más no estorba. */
  const salida = !paso.transicion && !nado && paso.sprints > 0 && paso.termina?.por === 'distancia' && Number(paso.termina.min) > 0 && Number(paso.termina.min) < 200;
  const textoGrande = paso.transicion ? (DE_DEPORTE[siguiente?.deporteDeLaParte] ?? 'Listo') : nado ? 'Llegué' : 'Listo';
  const ayuda = paso.transicion ? 'toca al arrancar' : salida ? 'tócalo al volver · ahí empieza tu descanso' : 'toca en cualquier parte';
  const meta = paso.meta;
  const cuanto = paso.termina?.texto || (paso.termina?.cantidad ? `${paso.termina.cantidad} ${paso.termina.unidad === 'seg' ? 'seg' : paso.termina.unidad}` : '');
  // El límite («en menos de 15 seg»): en un sprint de 200 m o más lo cuenta el GPS (`PasoConGps`); aquí, sin GPS, se dice (doble revisión, 23 nov 2026).
  const chips = [CHIP_DE_META(meta), ...String(paso.texto ?? '').split(' · ').slice(1), paso.limiteSeg ? `en menos de ${paso.limiteSeg < 60 ? `${paso.limiteSeg} seg` : relojDe(paso.limiteSeg)}` : null].filter(Boolean);

  let centro;
  if (porTiempo) {
    const restan = cuenta ? Math.max(0, cuenta.restan) : (paso.termina.valor ?? paso.termina.min);
    centro = (
      <>
        <Numero valor={relojDe(restan)} etiqueta={`${cuenta?.pausado ? 'En pausa · ' : ''}Quedan (de ${paso.termina.cantidad} ${paso.termina.unidad})`} tam={80} />
        {(meta || pulso != null) && (
          <div style={{ display: 'flex', gap: 8, width: '100%' }}>
            {meta && (
              <div style={{ flex: 1, background: TARJETA, borderRadius: 16, padding: '10px 8px', textAlign: 'center' }}>
                {meta.tipo === 'w' && <div style={{ fontSize: 11.5, fontWeight: 800, color: AMBAR }}>Pide</div>}
                <div style={{ fontSize: meta.texto.length > 9 ? 22 : 28, fontWeight: 800, whiteSpace: 'nowrap', ...NUM_STYLE }}>{meta.tipo === 'w' ? meta.texto.replace(' W', '') : meta.texto}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: TENUE }}>{meta.tipo === 'w' ? 'vatios · los marca tu bici' : 'intensidad'}</div>
              </div>
            )}
            {pulso != null && (
              <div style={{ flex: 1, background: TARJETA, borderRadius: 16, padding: '10px 8px', textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#FF7A85', ...NUM_STYLE }}>{pulso}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: TENUE }}>pulso</div>
              </div>
            )}
          </div>
        )}
      </>
    );
  } else {
    centro = (
      <>
        {paso.nombre !== enQueVa.titulo && <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.02em', textAlign: 'center', lineHeight: 1.05 }}>{paso.nombre}</div>}
        {cuanto && <Numero valor={cuanto} etiqueta={paso.transicion ? 'meta' : null} tam={cuanto.length > 7 ? 56 : 72} />}
        {chips.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
            {chips.map((c) => <span key={c} style={{ fontSize: 13, fontWeight: 800, background: GRIS, borderRadius: 99, padding: '6px 11px' }}>{c}</span>)}
          </div>
        )}
      </>
    );
  }

  return (
    <div style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '0 16px 14px' }}>
      <BarraOscura tiempo={tiempo} onLista={onLista} chip={paso.sinGps && !porTiempo ? (nado ? 'Alberca' : 'Sin GPS') : null} onMas={() => setHoja(true)} />
      <EnQueVa {...enQueVa} parte={porTiempo && cuenta ? Math.min(1, Math.max(0, 1 - cuenta.restan / cuenta.seg)) : 0} />
      {video && <div style={{ marginTop: 12, borderRadius: 18, overflow: 'hidden', maxHeight: '26vh' }}>{video}</div>}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 14, padding: '12px 0' }}>{centro}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        <NotaOscura texto={paso.nota} />
        {siguiente && <Sigue titulo={paso.sinParar ? 'Sigue, sin parar' : 'Sigue'} nombre={siguiente.nombre} detalle={siguiente.detalle} />}
        {porTiempo ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <BotonOscuro azul ancho onClick={() => { if (!cuenta?.pausado) onPausa(); setHoja(true); }}>{cuenta?.pausado ? <><Play size={17} fill="#fff" /> Seguir</> : <><Pause size={17} fill="#fff" /> Pausar</>}</BotonOscuro>
            <BotonOscuro onClick={onSaltar}>Siguiente</BotonOscuro>
          </div>
        ) : (
          <>
            {(paso.pieza === 'tec' || (paso.exercise_id && !paso.sprints)) && <BotonDeTecnica tecnica={tecnica} />}
            <BotonGrande texto={textoGrande} ayuda={ayuda} onClick={onListo} esUltimo={esUltimo} onTerminar={onTerminar} />
          </>
        )}
      </div>
      {(hoja || (porTiempo && cuenta?.pausado)) && (
        <HojaDePausa
          // «···» también en un paso por tiempo (23 nov 2026): abre las opciones SIN parar la cuenta; «Pausar» sigue parándola.
          enPausa={porTiempo && !!cuenta?.pausado} titulo={porTiempo && cuenta?.pausado ? `En pausa · ${enQueVa.titulo}` : enQueVa.titulo} tiempo={porTiempo && cuenta ? relojDe(Math.max(0, cuenta.restan)) : null}
          seguir={porTiempo && cuenta?.pausado ? 'Seguir' : 'Volver'} onSeguir={() => { if (porTiempo && cuenta?.pausado) onPausa(); setHoja(false); }}
          opciones={{ ...opciones, onAnterior: () => { setHoja(false); opciones?.onAnterior?.(); }, onSaltar: () => { setHoja(false); onSaltar(); }, onTerminar: () => { setHoja(false); opciones?.onTerminar?.(); } }}
        />
      )}
    </div>
  );
}

/**
 * Un descanso de la lista: con tiempo cuenta y pasa solo; «hasta recuperarte» sube y espera «Seguir», con el pulso si hay reloj (regla 10).
 * Después de un sprint corto se puede anotar el tiempo, si alguien lo midió (regla 9). Después de una serie de nado, cuánto tardó (regla 7).
 */
export function DescansoOscuro({ descanso, ahora, siguiente, pulso, tiempo, onLista, onSeguir, onMas, onPausa, anotable, onAnota, tardo, opciones }) {
  const [hoja, setHoja] = useState(false);
  const recuperar = descanso.seg === null;
  const llevas = Math.max(0, Math.round((ahora - descanso.desde) / 1000));
  return (
    <div style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '0 16px 14px' }}>
      {/* «···» también en el descanso con reloj (23 nov 2026): antes las opciones solo salían con «Pausar», y para cambiar el sonido había que parar el
          descanso. Ahora se abren sin pausarlo. */}
      <BarraOscura tiempo={tiempo} onLista={onLista} onMas={() => setHoja(true)} />
      <EnQueVa titulo="Descanso" detalle={recuperar ? 'hasta recuperarte' : (siguiente ? `antes de: ${siguiente.nombre.charAt(0).toLowerCase()}${siguiente.nombre.slice(1)}` : null)} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 16 }}>
        {recuperar
          ? <Numero valor={relojDe(llevas)} etiqueta="Llevas descansando" tam={84} />
          : <Numero valor={relojDe(Math.max(0, descanso.restan))} etiqueta={`${descanso.pausado ? 'En pausa · ' : ''}Quedan (de ${relojDe(descanso.seg)})`} tam={92} />}
        {recuperar && pulso != null && (
          <Numero valor={pulso} etiqueta="pulso en vivo: mira cómo baja" tam={46} color="#FF7A85" />
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {tardo && (
          <div style={{ background: TARJETA, borderRadius: 16, padding: '10px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: TENUE }}>{tardo.titulo}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: tardo.bien === false ? AMBAR : tardo.bien ? VERDE : '#fff', ...NUM_STYLE }}>{tardo.valor}{tardo.estado ? <span style={{ fontSize: 13, marginLeft: 8 }}>{tardo.estado}</span> : null}</div>
          </div>
        )}
        {anotable && <AnotaTiempo key={anotable.clave} titulo={anotable.titulo} inicial={anotable.seg} onAnota={onAnota} />}
        {siguiente && <Sigue nombre={siguiente.nombre} detalle={siguiente.detalle} />}
        <div style={{ display: 'flex', gap: 8 }}>
          {recuperar ? (
            <BotonOscuro azul ancho onClick={onSeguir}>Seguir</BotonOscuro>
          ) : (
            <>
              <BotonOscuro onClick={onMas}>+30 s</BotonOscuro>
              <BotonOscuro azul ancho onClick={() => { if (!descanso.pausado) onPausa(); setHoja(true); }}>{descanso.pausado ? <><Play size={17} fill="#fff" /> Seguir</> : <><Pause size={17} fill="#fff" /> Pausar</>}</BotonOscuro>
              <BotonOscuro onClick={onSeguir} label="Saltar el descanso">Saltar</BotonOscuro>
            </>
          )}
        </div>
      </div>
      {(hoja || descanso.pausado) && (
        <HojaDePausa enPausa={!!descanso.pausado} titulo={descanso.pausado ? 'En pausa · descanso' : 'Descanso'} tiempo={descanso.seg !== null ? relojDe(Math.max(0, descanso.restan)) : null}
          seguir={descanso.pausado ? 'Seguir' : 'Volver'} onSeguir={() => { if (descanso.pausado) onPausa(); setHoja(false); }}
          opciones={{ ...opciones, onSaltar: () => { setHoja(false); onSeguir(); }, onAnterior: () => { setHoja(false); opciones?.onAnterior?.(); }, onTerminar: () => { setHoja(false); opciones?.onTerminar?.(); } }} />
      )}
    </div>
  );
}

/** «¿Te midieron el sprint 2? Opcional»: un número en segundos que se guarda al salir de la casilla. */
export function AnotaTiempo({ titulo, inicial, onAnota, clara = false }) {
  const [valor, setValor] = useState(inicial ? String(inicial) : '');
  const ultimo = useRef(inicial ? String(inicial) : '');
  const guarda = () => {
    const v = valor.replace(',', '.').trim();
    if (v === ultimo.current) return;
    ultimo.current = v;
    const n = parseFloat(v);
    onAnota(Number.isFinite(n) && n > 0 ? n : null);
  };
  return (
    <label style={{ display: 'block', background: clara ? LT.surface : TARJETA, color: clara ? LT.text : '#fff', borderRadius: 16, padding: '10px 12px', textAlign: 'left' }}>
      <span style={{ fontSize: 13.5, fontWeight: 800 }}>{titulo} <span style={{ color: clara ? LT.text2 : TENUE, fontWeight: 700 }}>Opcional</span></span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
        <input value={valor} onChange={(e) => setValor(e.target.value.replace(/[^\d.,]/g, ''))} onBlur={guarda} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
          inputMode="decimal" placeholder="4.3" aria-label={titulo}
          style={{ flex: 1, height: 46, borderRadius: 12, border: 'none', background: clara ? LT.surface2 : '#24252B', color: clara ? LT.text : '#fff', fontFamily: FONT, fontSize: 20, fontWeight: 800, padding: '0 12px' }} />
        <span style={{ fontSize: 14, fontWeight: 700, color: clara ? LT.text2 : TENUE }}>seg</span>
      </span>
    </label>
  );
}

/**
 * Una pregunta abajo, en negro (regla 13: «¿Llevas el teléfono contigo?» y sus dos avisos). Los botones dicen la acción completa: se entienden
 * sin leer la pregunta. `icono`: el dibujo del teléfono, solo en la primera.
 */
/** Una pregunta en hoja, de abajo. `clara`: sobre una pantalla clara (Técnica, calentamiento con ejercicios) la hoja también va clara (regla 18). */
export function PreguntaOscura({ titulo, texto, si, no, onSi, onNo, icono = false, clara = false }) {
  const fondo = clara ? LT.surface : TARJETA;
  const letra = clara ? LT.text : '#fff';
  return (
    <div role="dialog" aria-modal="true" aria-label={titulo} style={{ position: 'absolute', inset: 0, zIndex: 20, background: clara ? 'rgba(17,19,24,0.35)' : 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'flex-end', fontFamily: FONT }}>
      <div style={{ width: '100%', background: fondo, color: letra, borderRadius: '26px 26px 0 0', padding: '18px 18px calc(18px + env(safe-area-inset-bottom))' }}>
        {icono && (
          <span aria-hidden="true" style={{ width: 42, height: 42, borderRadius: 21, background: clara ? LT.surface2 : '#2A2B31', display: 'grid', placeItems: 'center', marginBottom: 10 }}>
            <Smartphone size={21} />
          </span>
        )}
        <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.2 }}>{titulo}</div>
        <div style={{ fontSize: 14.5, color: clara ? LT.text2 : '#A3A9B6', marginTop: 7, lineHeight: 1.45 }}>{texto}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 14 }}>
          <button type="button" onClick={onSi} className="kp-press" style={{ minHeight: 54, borderRadius: 27, border: 'none', background: AZUL, color: '#fff', fontFamily: FONT, fontSize: 16, fontWeight: 800, cursor: 'pointer' }}>{si}</button>
          <button type="button" onClick={onNo} className="kp-press" style={{ minHeight: 54, borderRadius: 27, border: 'none', background: clara ? LT.surface2 : '#24252B', color: letra, fontFamily: FONT, fontSize: 16, fontWeight: 800, cursor: 'pointer' }}>{no}</button>
        </div>
      </div>
    </div>
  );
}


/**
 * LA HOJA DE PAUSA (23 nov 2026, Andrés: «me preocupa que solamente con la opción de pausar lo limitas demasiado»). Mientras corre hay pocos
 * botones (con el teléfono rebotando, cada botón de más es un toque por accidente); al pausar, o con «···» en una pantalla de «Listo», sale todo
 * lo demás, ya parado y con calma: tramo anterior, saltar, sonido, el teléfono (llevarlo o dejarlo apoyado) y terminar. Nada de lo que Gym tiene
 * se pierde.
 * `opciones`: { puedeAnterior, onAnterior, onSaltar, sonido, onSonido, telefono: { apoyado, onCambia } | null, onTerminar }.
 */
export function HojaDePausa({ titulo, tiempo, seguir = 'Seguir', onSeguir, opciones = {}, enPausa = true }) {
  const o = opciones;
  const fila = (icono, texto, onClick, extra = null, rojo = false) => (
    <button type="button" onClick={onClick} className="kp-press"
      style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', minHeight: 52, borderRadius: 14, border: 'none', background: '#1F2026', color: rojo ? '#FF6B78' : '#fff', padding: '0 14px', fontFamily: FONT, fontSize: 15.5, fontWeight: 700, cursor: 'pointer', textAlign: 'left' }}>
      {icono}<span style={{ flex: 1 }}>{texto}</span>{extra && <span style={{ fontSize: 13, color: TENUE, fontWeight: 700 }}>{extra}</span>}
    </button>
  );
  return (
    <div role="dialog" aria-modal="true" aria-label={enPausa ? 'En pausa' : 'Más opciones'} style={{ position: 'absolute', inset: 0, zIndex: 25, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end', fontFamily: FONT }}>
      <div style={{ width: '100%', background: TARJETA, color: '#fff', borderRadius: '26px 26px 0 0', padding: '14px 16px calc(16px + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div aria-hidden="true" style={{ width: 38, height: 5, borderRadius: 3, background: '#3A3C44', margin: '0 auto 4px' }} />
        <div style={{ textAlign: 'center', fontSize: 13, fontWeight: 700, color: TENUE }}>{titulo}</div>
        {tiempo && <div style={{ textAlign: 'center', fontSize: 38, fontWeight: 800, color: ROJO, ...NUM_STYLE }}>{tiempo}</div>}
        <button type="button" onClick={onSeguir} className="kp-press" style={{ minHeight: 54, borderRadius: 27, border: 'none', background: AZUL, color: '#fff', fontFamily: FONT, fontSize: 17, fontWeight: 800, cursor: 'pointer', marginBottom: 4 }}>{seguir}</button>
        {o.puedeAnterior && fila(<ChevronLeft size={19} />, o.anteriorTexto ?? 'Volver al anterior', o.onAnterior)}
        {o.onSaltar && fila(<ChevronRight size={19} />, o.saltarTexto ?? 'Saltar', o.onSaltar)}
        {o.onSonido && fila(o.sonido ? <Volume2 size={19} /> : <VolumeX size={19} />, 'Sonido y voz', o.onSonido, o.sonido ? 'Encendido' : 'Apagado')}
        {o.telefono && fila(<Smartphone size={19} />, 'El teléfono', o.telefono.onCambia, o.telefono.apoyado ? 'Lo dejo apoyado' : 'Lo llevo conmigo')}
        {o.onTerminar && fila(<X size={19} />, 'Terminar entreno', o.onTerminar, null, true)}
      </div>
    </div>
  );
}

/** «Grabar técnica» en una pantalla de «Listo» (Técnica y estaciones): la misma cámara de Gym. `tecnica`: { activa, etiqueta, onClick, enviada }. */
export function BotonDeTecnica({ tecnica }) {
  if (!tecnica) return null;
  return (
    <button type="button" onClick={tecnica.onClick} className="kp-press" aria-label={tecnica.etiqueta}
      style={{ minHeight: 46, borderRadius: 23, border: 'none', background: GRIS, color: '#fff', fontFamily: FONT, fontSize: 14.5, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer' }}>
      {tecnica.enviada ? <Check size={17} color={VERDE} /> : <Camera size={17} />} {tecnica.enviada ? 'Técnica enviada' : 'Grabar técnica'}
    </button>
  );
}
