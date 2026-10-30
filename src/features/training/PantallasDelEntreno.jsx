import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Bell, BellOff, Check, ChevronLeft, ChevronRight, List, MapPin, Minus, Pencil, Play, Plus, Timer, Video, X } from 'lucide-react';
import { LT, KP, FONT, NUM_STYLE, UI } from '@/lib/theme';
import { textoDeResultado } from '@/lib/formatos';
import { relojDe } from '@/lib/entrenoDatos';
import { acomodaPaso } from '@/lib/acomodoDelPaso';
import { useAviso } from '@/components/AvisoPasajero';

/**
 * Las pantallas del modo entreno: lo que se DIBUJA. Qué paso toca, cuándo avisar y qué se guarda lo decide `EntrenoDelDia`; aquí no
 * hay lógica del entreno, solo piezas que reciben lo que van a decir.
 *
 * Todo sigue la maqueta «Modo entreno» que Andrés aprobó (9 oct 2026), y el estilo de las otras pantallas completas (la ficha del
 * ejercicio, el reloj del bloque): una columna de 520 px que se desplaza, el botón principal fijo abajo y números enormes.
 *
 * LA REGLA DE ORO: se dibuja SOLO lo que el coach escribió. Sin video no hay hueco de video; sin cifras no hay tarjetas; sin
 * notas no hay párrafo. Una pantalla de un ejercicio que solo trae su nombre es el nombre, «Sigue: …» y un botón.
 *
 * SIN LETRAS GRISES (Andrés, 9 oct 2026: «nadie se va a detener mid workout a leer las letritas grises»): ni «Serie 2 de 4 · Vuelta 2 de 3»
 * en un renglón chiquito, ni «Toca Seguir cuando estés listo». Pero lo que se dice tiene que SE LEER: esa misma noche, ya probándolo, los
 * puntitos de las vueltas «no se entienden» y los botones de abajo «estaban muy escondidos». Entonces: la serie va con su palabra y todo lo que
 * se puede tocar es un botón de verdad, con borde y con lo que hace escrito. Y una pastilla («Serie 2 de 5») tampoco daba «una buena noción del
 * set» (Andrés, 9 oct 2026, «Experiencia de workout 2.0»): ahora la serie se EXPLICA en una tarjeta al lado de las cifras (`TarjetaDeLaSerie`). Y el tiempo que
 * llevas SÍ se ve, arriba, en una pastilla («En ningún momento puedo ver cuánto tiempo llevo entrenando»).
 */

/* ------------------------------------------------------------------ */
/* Piezas chicas                                                       */
/* ------------------------------------------------------------------ */

const redondo = {
  width: 40, height: 40, borderRadius: 13, border: 'none', cursor: 'pointer', background: LT.surface, boxShadow: '0 2px 8px rgba(17,19,24,0.08)',
  color: LT.text, display: 'grid', placeItems: 'center', flexShrink: 0, touchAction: 'manipulation',
};

const COLUMNA = { maxWidth: 520, margin: '0 auto', width: '100%', boxSizing: 'border-box' };

/** El botón grande de abajo. `variante`: 'azul' (lo principal), 'borde' (lo de al lado) o 'verde' (terminar). */
function BotonGrande({ children, onClick, variante = 'azul', disabled = false }) {
  const base = {
    width: '100%', minHeight: 60, borderRadius: 18, cursor: disabled ? 'default' : 'pointer', display: 'flex', alignItems: 'center',
    justifyContent: 'center', gap: 10, fontFamily: FONT, fontSize: 18, fontWeight: 800, touchAction: 'manipulation',
  };
  const estilos = {
    azul: { border: 'none', color: '#fff', background: KP.blue, boxShadow: '0 8px 20px rgba(30,64,224,0.22)' },
    // Reestructura visual (15 oct 2026), como «Fuerza» en las capturas de Andrés: «Listo» en tinta oscura con la palomita del color del tipo.
    oscuro: { border: 'none', color: '#fff', background: '#15171E', boxShadow: '0 10px 24px rgba(17,19,24,0.22)' },
    verde: { border: 'none', color: '#fff', background: LT.mint, boxShadow: '0 8px 22px rgba(0,163,114,0.24)' },
    borde: { border: 'none', color: LT.blue, background: LT.surface, minHeight: 54, fontSize: 16.5, boxShadow: '0 2px 10px rgba(17,19,24,0.07)' },
  };
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="kp-press" style={{ ...base, ...estilos[variante] }}>
      {children}
    </button>
  );
}

/**
 * «Mantén para terminar» (botones de la sesión, 29 oct 2026): terminar un entreno se hace MANTENIENDO el botón, igual en el entreno guiado, la carrera y el cronómetro. Un toque sin querer
 * no termina nada: una barra azul lo va llenando de izquierda a derecha durante 900 ms y, al llenarse, termina (`onTermina`). Si se suelta antes, la barra vuelve a cero y no pasa nada;
 * si el toque fue corto (menos de 400 ms) además avisa cómo se hace. Por eso no pregunta nada después: mantener YA es la pregunta.
 *
 * Tiene la cara del «Listo» oscuro (sin la palomita). Sin menú de mantener presionado ni selección de texto (en el iPhone, mantener un botón los abre), y `touch-action: none` para que el
 * dedo quieto no se vuelva un gesto de la página. `fondo`, `relleno`, `alto`, `radio` y `tamano` (de la letra) lo adaptan a las pantallas oscuras de la carrera; `estilo`, a la fila donde va.
 */
export function BotonDeMantener({ onTermina, etiqueta = null, texto = 'Mantén para terminar', fondo = '#15171E', relleno = KP.blue, alto = 60, radio = 18, tamano = 18, sombra = '0 10px 24px rgba(17,19,24,0.22)', disabled = false, estilo = null }) {
  const { avisa } = useAviso();
  const [llena, setLlena] = useState(false);
  const reloj = useRef(null);
  const desde = useRef(0); // cuándo se empezó a mantener; 0 = nadie lo está tocando
  const termino = useRef(onTermina);
  useEffect(() => { termino.current = onTermina; });
  useEffect(() => () => clearTimeout(reloj.current), []);

  const empieza = (e) => {
    if (disabled || desde.current || (e.type === 'pointerdown' && e.pointerType === 'mouse' && e.button !== 0)) return;
    desde.current = performance.now();
    setLlena(true);
    reloj.current = setTimeout(() => {
      reloj.current = null;
      desde.current = 0;
      termino.current();
      // Si la pantalla sigue aquí (algo salió sin terminar), el botón vuelve a estar listo.
      setLlena(false);
    }, 900);
  };
  const suelta = (e) => {
    if (!desde.current) return;
    const duro = performance.now() - desde.current;
    clearTimeout(reloj.current);
    reloj.current = null;
    desde.current = 0;
    setLlena(false);
    if (duro < 400 && (e.type === 'pointerup' || e.type === 'keyup')) avisa('Mantén presionado para terminar.');
  };
  const tecla = (e) => (e.key === 'Enter' || e.key === ' ') && !e.repeat;
  return (
    <button
      type="button" disabled={disabled} draggable={false} aria-label={etiqueta ?? undefined}
      onPointerDown={empieza} onPointerUp={suelta} onPointerLeave={suelta} onPointerCancel={suelta}
      onKeyDown={(e) => { if (tecla(e)) { e.preventDefault(); empieza(e); } }} onKeyUp={(e) => { if (tecla(e)) suelta(e); }}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        position: 'relative', overflow: 'hidden', width: '100%', minHeight: alto, borderRadius: radio, border: 'none', cursor: disabled ? 'default' : 'pointer', color: '#fff', background: fondo, boxShadow: sombra,
        fontFamily: FONT, fontSize: tamano, fontWeight: 800, touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none', WebkitTapHighlightColor: 'transparent',
        opacity: disabled ? 0.6 : 1, ...estilo,
      }}
    >
      <span aria-hidden="true" style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: llena ? '100%' : '0%', background: relleno, transition: llena ? 'width 900ms linear' : 'none', pointerEvents: 'none' }} />
      <span style={{ position: 'relative', pointerEvents: 'none' }}>{texto}</span>
    </button>
  );
}

// Un botón de texto (para las hojas: «Cancelar», «Seguir»…).
function BotonDeTexto({ children, onClick, disabled = false, color = LT.text2 }) {
  return (
    <button
      type="button" onClick={onClick} disabled={disabled}
      style={{
        border: 'none', background: 'transparent', cursor: disabled ? 'default' : 'pointer', fontFamily: FONT, fontSize: 15, fontWeight: 800,
        color: disabled ? LT.borderHi : color, padding: '10px 6px', display: 'inline-flex', alignItems: 'center', gap: 4, touchAction: 'manipulation',
      }}
    >
      {children}
    </button>
  );
}

function Pastilla({ children, fuerte = false }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 999, fontSize: 12.5, fontWeight: 800,
      background: fuerte ? LT.blueSoft : LT.surface2, color: fuerte ? LT.blue : LT.text2, ...NUM_STYLE,
    }}>
      {children}
    </span>
  );
}

// La etiqueta de lo que es un Set («BI-SERIE», «CON RELOJ»): azul suave; gris (`suave`) si es un aviso («OPCIONAL»); `chica` cuando va junto a otra cosa en un renglón.
function Etiqueta({ children, suave = false, chica = false }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, padding: chica ? '3px 7px' : '4px 9px', borderRadius: 7, fontSize: chica ? 11.5 : 12.5, fontWeight: 700,
      whiteSpace: 'nowrap', background: suave ? LT.surface2 : LT.blueSoft, color: suave ? LT.text2 : LT.blue,
    }}>
      {children}
    </span>
  );
}

/**
 * En qué serie va, con su palabra: «Serie 2 de 5». Antes eran puntos junto al nombre (llena = hecha, anillo = la que va) y Andrés los probó con su
 * iPhone: «los puntitos de los sets no se les entiende ni representan lo suficiente… al menos no en las primeras experiencias del usuario». Una
 * pastilla azul con la palabra se lee a la primera. `puntos` viene de `puntosDeVueltas`: cada vuelta del Set es una serie del ejercicio (o del par,
 * en una bi-serie). Con una sola vuelta no sale.
 */
export function SerieDelSet({ puntos }) {
  if (!puntos || puntos.length < 2) return null;
  const queVa = puntos.findIndex((p) => p.estado === 'actual');
  const numero = queVa >= 0 ? queVa + 1 : Math.min(puntos.length, puntos.filter((p) => p.estado === 'hecha').length + 1);
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', flexShrink: 0, whiteSpace: 'nowrap', padding: '6px 12px', borderRadius: 999, fontSize: 14, fontWeight: 800,
      background: LT.blueSoft, color: LT.blue, ...NUM_STYLE,
    }}>
      Serie {numero} de {puntos.length}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* La barra de arriba                                                  */
/* ------------------------------------------------------------------ */

/**
 * La barra de arriba, como «Fuerza» en las capturas de Andrés (reestructura visual): «≡ Workout» en el color del tipo, los segmentos del avance en ese color y el
 * tiempo que llevas. SIN la ✕ (16 oct 2026: «no arreglaste la x como venía en la carpeta»): en la captura no hay una; «Workout» abre «Tu entreno» y ahí están
 * «Seguir», «Terminar entreno» y «Salir y seguir después» (el avance ya está guardado y «Continuar entreno» lo retoma). Sin `tiempo` (todavía no inicia, o pasaron
 * muchas horas) no sale el tiempo.
 */
export function BarraDelEntreno({ segmentos, fondo, palabras, tiempo, onLista, color = LT.blue }) {
  return (
    <div style={{ position: 'sticky', top: 0, zIndex: 5, background: fondo, padding: 'calc(10px + env(safe-area-inset-top)) 0 8px' }}>
      <div style={{ ...COLUMNA, padding: '0 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {onLista && (
            <button
              type="button" onClick={onLista} className="kp-press" aria-label="Ver la lista de tu entreno"
              style={{
                height: 40, padding: '0 14px 0 11px', borderRadius: 13, border: 'none', background: color, color: '#fff', cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 7, flexShrink: 0, fontFamily: FONT, fontSize: 14.5, fontWeight: 700, touchAction: 'manipulation',
                boxShadow: '0 6px 14px rgba(17,19,24,0.14)',
              }}
            >
              <List size={17} /> Workout
            </button>
          )}
          <div style={{ flex: 1, display: 'flex', gap: 5 }} aria-hidden="true">
            {segmentos.map((f, i) => (
              <span key={i} style={{ flex: 1, height: 5, borderRadius: 3, background: 'rgba(17,19,24,0.1)', overflow: 'hidden' }}>
                <span style={{ display: 'block', height: '100%', width: `${Math.round(f * 100)}%`, background: color, borderRadius: 3, transition: 'width 0.25s' }} />
              </span>
            ))}
          </div>
          {tiempo && (
            <span
              role="timer" aria-label={`Llevas ${tiempo}`}
              style={{ flexShrink: 0, fontFamily: FONT, fontSize: 16, fontWeight: 800, color: LT.text, ...NUM_STYLE }}
            >
              {tiempo}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Un ejercicio (o una nota)                                           */
/* ------------------------------------------------------------------ */

/**
 * La serie EXPLICADA, junto a las cifras (ver `resumenDeLaSerie`). Andrés, 9 oct 2026: «¿te parece que "Serie 1 de 3" le da una buena noción al usuario del
 * set? Yo no creo». Dice DÓNDE vas, en tres piezas: el número de la serie GRANDE (con su «de 3» y una barrita que se va llenando), lo que es el Set
 * («BI-SERIE») y, si son varios ejercicios, el par A/B con el que toca resaltado.
 *
 * Y NADA MÁS. Andrés (10 oct 2026) quitó «Luego» y «Descanso»: «solo estorba y satura». Lo bonito sale de la jerarquía, no de más texto: lo que toca es lo más
 * fuerte (letra azul y fila sombreada), lo que sigue se apaga y lo que ya hiciste lleva su palomita.
 */
function TarjetaDeLaSerie({ resumen, color = null }) {
  const { etiqueta, numero, total, puntos, par } = resumen;
  /* Reestructura visual (15 oct 2026), como «Fuerza» en las capturas: la tarjeta va del COLOR del tipo de sesión (morado en Gym) con letra blanca, y lo que toca
     en un renglón blanco. Sin color (un tipo propio con un color raro), blanca como antes. */
  const enColor = !!color;
  const cuenta = numero !== null && total > 1;
  // Un ejercicio que se repite (sin par): la tarjeta es solo el contador, y se centra para no quedar con un hueco abajo.
  const sola = !par;
  return (
    <div
      role="group" aria-label={[etiqueta, cuenta ? `serie ${numero} de ${total}` : null].filter(Boolean).join(', ')}
      style={{
        flex: 1, minWidth: 0, background: enColor ? color : LT.surface, borderRadius: 20, padding: '12px 12px 10px',
        boxShadow: enColor ? '0 10px 22px rgba(17,19,24,0.16)' : '0 2px 10px rgba(17,19,24,0.06)',
        display: 'flex', flexDirection: 'column', justifyContent: sola ? 'center' : 'flex-start', gap: 10,
      }}
    >
      {(cuenta || etiqueta) && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px 8px' }}>
          {cuenta && (
            <div className="pa-nocorta" style={{ display: 'flex', alignItems: 'baseline', gap: 5, minWidth: 0, overflow: 'hidden', whiteSpace: 'nowrap', ...NUM_STYLE }}>
              {/* Crecen y se achican con el paso (`--k`, ver `lib/acomodoDelPaso.js`); fuera del paso `--k` no existe y valen lo de siempre. */}
              <span style={{ fontSize: 'calc(15px * min(var(--k, 1), 1.2))', fontWeight: 700, color: enColor ? 'rgba(255,255,255,0.85)' : LT.text2 }}>Serie</span>
              <span style={{ fontSize: `calc(${sola ? 34 : 26}px * var(--k, 1))`, fontWeight: 800, letterSpacing: -0.8, lineHeight: 1, color: enColor ? '#fff' : LT.blue }}>{numero}</span>
              <span style={{ fontSize: 'calc(15px * min(var(--k, 1), 1.2))', fontWeight: 700, color: enColor ? 'rgba(255,255,255,0.85)' : LT.text2 }}>de {total}</span>
            </div>
          )}
          {etiqueta && (enColor
            ? <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', background: 'rgba(255,255,255,0.18)', padding: '4px 8px', borderRadius: 8 }}>{etiqueta}</span>
            : <Etiqueta chica={cuenta}>{etiqueta}</Etiqueta>)}
        </div>
      )}
      {cuenta && <BarraDeSeries puntos={puntos} enColor={enColor} />}
      {par && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, margin: '0 -4px -2px' }}>
          {par.map((l) => <FilaDelPar key={l.letra} {...l} color={enColor ? color : null} />)}
        </div>
      )}
    </div>
  );
}

// La barrita de las series: una pieza por serie. La que va, azul fuerte; las hechas, azul suave; las que faltan, vacías. Con muchas series, una sola barra.
function BarraDeSeries({ puntos, enColor = false }) {
  const pista = enColor ? 'rgba(255,255,255,0.25)' : 'rgba(17,19,24,0.1)';
  const lleno = enColor ? '#fff' : LT.blue;
  if (puntos.length > 12) {
    const hechas = puntos.filter((p) => p.estado !== 'pendiente').length;
    return (
      <div aria-hidden="true" style={{ height: 5, borderRadius: 3, background: pista, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.round((hechas / puntos.length) * 100)}%`, background: lleno, borderRadius: 3 }} />
      </div>
    );
  }
  return (
    <div aria-hidden="true" style={{ display: 'flex', gap: 4 }}>
      {puntos.map((p, i) => (
        <span
          key={i}
          style={{
            flex: 1, height: 5, borderRadius: 3, background: p.estado === 'pendiente' ? pista : lleno, opacity: p.estado === 'hecha' ? 0.45 : 1,
            transition: 'opacity 0.25s, background 0.25s',
          }}
        />
      ))}
    </div>
  );
}

// Un ejercicio del par (A, B…): el que toca, con su letra en azul y la fila sombreada; el que ya hiciste, con su palomita; el que falta, apagado.
function FilaDelPar({ letra, nombre, estado, color = null }) {
  const toca = estado === 'actual';
  const hecho = estado === 'hecho';
  // En la tarjeta de color: lo que toca en un renglón blanco con su letra del color; lo demás, sobre el color, en blanco translúcido.
  const insignia = color
    ? (toca ? { background: color, color: '#fff' } : hecho ? { background: 'rgba(255,255,255,0.9)', color } : { background: 'rgba(255,255,255,0.2)', color: '#fff' })
    : toca
      ? { background: LT.blue, color: '#fff' }
      : (hecho ? { background: KP.mintSoft, color: LT.mint } : { background: LT.surface, border: 'none', color: LT.text2 });
  const fondoFila = color ? (toca ? '#fff' : 'rgba(255,255,255,0.12)') : (toca ? LT.blueSoft : 'transparent');
  const tinta = color ? (toca ? LT.text : '#fff') : (toca ? LT.text : LT.text2);
  return (
    <div
      aria-current={toca ? 'step' : undefined}
      style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, padding: '7px 8px 7px 7px', borderRadius: 12, background: fondoFila }}
    >
      <span style={{ width: 22, height: 22, borderRadius: 7, flexShrink: 0, boxSizing: 'border-box', display: 'grid', placeItems: 'center', fontSize: 12.5, fontWeight: 800, ...insignia }}>
        {hecho ? <Check size={13} strokeWidth={3.2} aria-label="Hecho" /> : letra}
      </span>
      <span style={{
        minWidth: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 14.5, fontWeight: toca ? 800 : 600, color: tinta,
      }}>
        {nombre}
      </span>
    </div>
  );
}

/**
 * El cronómetro OPCIONAL de un paso con tiempo (la plancha de 30 seg, el «2 min» de un lapso). Es una ayuda, nunca una orden: al llegar
 * a cero avisa y sigue contando hacia arriba, pero no marca nada ni avanza.
 */
function CronometroDelPaso({ segundos, cuenta, onEmpezar, onQuitar }) {
  if (!cuenta) {
    return (
      <button
        type="button" onClick={onEmpezar} className="kp-press"
        style={{
          width: '100%', minHeight: 50, borderRadius: 16, border: 'none', boxShadow: '0 2px 10px rgba(17,19,24,0.07)', background: LT.surface, color: LT.text, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: FONT, fontSize: 15.5, fontWeight: 800, touchAction: 'manipulation',
        }}
      >
        <Timer size={19} /> Empezar cronómetro · {relojDe(segundos)}
      </button>
    );
  }
  return (
    <div style={{ background: LT.surface, border: 'none', borderRadius: 18, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: cuenta.vencido ? LT.mint : LT.text2 }}>{cuenta.vencido ? 'Tiempo cumplido' : 'Cronómetro'}</div>
        <div role="timer" style={{ fontSize: 46, fontWeight: 800, lineHeight: 1.05, letterSpacing: -1, color: cuenta.vencido ? LT.mint : LT.text, ...NUM_STYLE }}>
          {cuenta.vencido ? `+${relojDe(cuenta.pasado)}` : relojDe(cuenta.restan)}
        </div>
      </div>
      <BotonDeTexto onClick={onQuitar}>Detener</BotonDeTexto>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* La barra redonda de abajo                                           */
/* ------------------------------------------------------------------ */

// El halo del botón del centro, del color del tipo (un «#RRGGBB» admite su transparencia pegada; otro color, un halo neutro).
const halo = (c) => (/^#[0-9a-f]{6}$/i.test(c || '') ? `${c}33` : 'rgba(30,64,224,0.2)');

/**
 * LA BARRA DE ABAJO, UNA SOLA FILA (Andrés, 30 oct 2026, con su captura): cinco botones redondos sin palabras, ‹ Anterior · ✎ Anotar · ✓ Listo · 🎥 Técnica · › Saltar.
 * Antes eran hasta tres renglones de botones (234 px con el borde del iPhone); ahora ~124. Cada botón dice lo que hace en `aria-label`.
 * Un lugar que no aplica (sin «Anotar», sin cámara) queda VACÍO y no se mueven los demás: Anterior, el centro y Saltar siempre están donde mismo.
 * `centro`: el botón grande (`BotonDelCentro`); `aviso`: una línea encima («Mantén ✓ para terminar»); `extra`: un botón de texto encima (el GPS).
 */
function BarraRedonda({ izquierda, segundo, centro, cuarto, derecha, aviso = null, extra = null }) {
  const lugar = (b) => b ?? <span aria-hidden="true" style={{ width: 56, height: 56, flexShrink: 0 }} />;
  return (
    <div style={{ flexShrink: 0, padding: '8px 0 calc(12px + env(safe-area-inset-bottom))' }}>
      <div style={{ ...COLUMNA, padding: '0 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {extra}
        {aviso && <div style={{ textAlign: 'center', fontSize: 13, fontWeight: 700, color: LT.text2 }}>{aviso}</div>}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {lugar(izquierda)}{lugar(segundo)}{centro}{lugar(cuarto)}{lugar(derecha)}
        </div>
      </div>
    </div>
  );
}

// Un botón redondo blanco de la barra. `color`: el del ícono (los de acción van del color del tipo; las flechas, en tinta).
function BotonRedondo({ etiqueta, onClick, disabled = false, color = LT.text, children, marca = null }) {
  return (
    <button
      type="button" onClick={onClick} disabled={disabled} aria-label={etiqueta} title={etiqueta} className="kp-press"
      style={{
        position: 'relative', width: 56, height: 56, borderRadius: '50%', flexShrink: 0, border: 'none', cursor: disabled ? 'default' : 'pointer', display: 'grid', placeItems: 'center',
        background: LT.surface, color: disabled ? LT.text3 : color, boxShadow: disabled ? 'none' : '0 6px 16px rgba(17,19,24,0.08)', opacity: disabled ? 0.55 : 1, touchAction: 'manipulation',
        fontFamily: FONT, fontSize: 15, fontWeight: 800, ...NUM_STYLE,
      }}
    >
      {children}
      {marca}
    </button>
  );
}

// La cámara de «Grabar técnica» como botón de la barra: con su ✓ verde si ya mandó la de esta serie. Mientras la función no sale, la misma cámara abre la hoja que
// explica que viene pronto (`onClick` ya lo decide `EntrenoDelDia`).
function TecnicaRedonda({ tecnica, color }) {
  if (!tecnica) return null;
  return (
    <BotonRedondo
      etiqueta={tecnica.enviada ? `${tecnica.etiqueta} (ya mandaste una)` : tecnica.etiqueta} onClick={tecnica.onClick} color={tecnica.enviada ? LT.mint : color}
      marca={tecnica.enviada ? <span aria-hidden="true" style={{ position: 'absolute', top: 2, right: 2, width: 18, height: 18, borderRadius: '50%', background: LT.mint, color: '#fff', display: 'grid', placeItems: 'center' }}><Check size={11} strokeWidth={3.5} /></span> : null}
    >
      <Video size={23} />
    </BotonRedondo>
  );
}

/**
 * El botón grande del centro: «Listo» (✓), «Empezar»/«Seguir» (▶) o, en el último paso, ✓ que se MANTIENE para terminar (con su anillo que se llena; ver `BotonDeMantener`).
 */
function BotonDelCentro({ tipo = 'listo', etiqueta, onClick, color = null }) {
  const c = color || LT.blue;
  const cara = {
    width: 74, height: 74, borderRadius: '50%', flexShrink: 0, border: 'none', display: 'grid', placeItems: 'center', color: '#fff', cursor: 'pointer', padding: 0,
    /* estilo-ok: el botón del centro de la captura de Andrés (30 oct 2026), del color del tipo con su halo */ background: `linear-gradient(160deg, ${c} 0%, ${c} 45%, #15171E 160%)`, boxShadow: `0 0 0 8px ${halo(c)}, 0 14px 30px rgba(17,19,24,0.25)`, touchAction: 'manipulation',
  };
  const icono = tipo === 'empezar' ? <Play size={28} fill="#fff" style={{ marginLeft: 3 }} /> : <Check size={34} strokeWidth={3} />;
  if (tipo === 'mantener') {
    return (
      <BotonDeMantener
        onTermina={onClick} etiqueta={etiqueta || 'Mantén para terminar'} texto={icono} relleno="rgba(255,255,255,0.28)" fondo={cara.background} alto={74} radio={37}
        sombra={cara.boxShadow} estilo={{ width: 74, minHeight: 74, height: 74, flexShrink: 0, display: 'grid', placeItems: 'center' }}
      />
    );
  }
  return <button type="button" onClick={onClick} aria-label={etiqueta} title={etiqueta} className="kp-press" style={cara}>{icono}</button>;
}

/* ------------------------------------------------------------------ */
/* Las cifras en una tarjeta, y qué significan                         */
/* ------------------------------------------------------------------ */

/**
 * Las cifras del paso en UNA tarjeta blanca con rayitas (antes, una caja con sombra cada una: tres sombras se veían más cargado). La de esfuerzo (carga, RIR,
 * RPE, zona…) lleva su palabra del color del tipo con un «?» lleno y se toca para saber qué es (`onQueEs`). La primera vez que la persona ve una, un globo
 * encima le dice que se puede tocar (`globo`). Los kilos van del color del tipo.
 */
function TarjetaDeCifras({ cifras, color = null, onQueEs = null, globo = false }) {
  const c = color || LT.blue;
  const primera = cifras.findIndex((x) => x.explica);
  return (
    <div className="pa-cifras" style={{ background: LT.surface, borderRadius: 16, boxShadow: '0 2px 10px rgba(17,19,24,0.06)' }}>
      {cifras.map((x, i) => {
        const explica = !!x.explica && !!onQueEs;
        const cuerpo = (
          <>
            <span className={`pa-num${x.texto ? ' texto' : ''}${x.texto ? '' : ' pa-nocorta'}`} style={{ '--n': String(x.valor).length, color: x.destacado ? c : LT.text, ...NUM_STYLE }}>{x.valor}</span>
            <span className="pa-rot" style={{ color: explica ? c : LT.text2, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              {x.etiqueta}
              {explica && <span aria-hidden="true" style={{ width: 15, height: 15, borderRadius: '50%', background: c, color: '#fff', display: 'inline-grid', placeItems: 'center', fontSize: 10, fontWeight: 800 }}>?</span>}
            </span>
            {explica && globo && i === primera && <span className="pa-globo" aria-hidden="true">Toca para saber qué es</span>}
          </>
        );
        return explica ? (
          <button
            key={i} type="button" className="pa-cifra kp-press" onClick={() => onQueEs(x)} aria-label={`${x.valor} ${x.etiqueta}. Toca para saber qué es`}
            style={{ border: 'none', background: 'none', cursor: 'pointer', fontFamily: FONT, color: 'inherit' }}
          >
            {cuerpo}
          </button>
        ) : <div key={i} className="pa-cifra">{cuerpo}</div>;
      })}
    </div>
  );
}

/** La hojita de «¿qué es?» de una cifra: su nombre con su número, lo que significa y «Entendido». */
export function HojaDeQueEs({ titulo, texto, color = null, onCerrar }) {
  return (
    <Hoja etiqueta={titulo} titulo={titulo} onCerrar={onCerrar}>
      <p style={{ margin: '0 0 18px', fontSize: 16, lineHeight: 1.5, fontWeight: 500, color: LT.text }}>{texto}</p>
      <button
        type="button" onClick={onCerrar} className="kp-press"
        style={{ width: '100%', minHeight: 52, borderRadius: 16, border: 'none', cursor: 'pointer', background: color || LT.blue, color: '#fff', fontFamily: FONT, fontSize: 16.5, fontWeight: 800 }}
      >
        Entendido
      </button>
    </Hoja>
  );
}

/**
 * La pantalla de un ejercicio: nombre (con las vueltas en puntos si el Set se repite), video (si el coach lo tiene), las cifras, la nota en
 * texto grande y «Listo». En una bi-serie, arriba, el tipo y el par A/B. Si no trae nada más que el nombre, el nombre se queda solo en el
 * centro con «Sigue: …» (el hueco de un video o de unas cifras vacías se lee como un fallo de la app).
 */
export function PantallaDePaso({
  paso, video, cifras, anotado, sigue, resumen, cronometro, etiquetaDeCambiar, puedeAnterior, tecnica,
  onListo, onCambiar, onSaltar, onAnterior, color = null, onUsarGps = null, esUltimo = false, onTerminar = null,
  onQueEs = null, globo = false, notaDe = null,
}) {
  const nota = [paso.nota, paso.cue].filter(Boolean);
  const hayCronometro = paso.tipo === 'ejercicio' && paso.termina?.por === 'tiempo' && cronometro;
  const solo = !video && !cifras.length && !nota.length && !hayCronometro && !anotado && !resumen && !paso.opcional;
  const c = color || LT.blue;

  /* EL ACOMODO (30 oct 2026, ver `lib/acomodoDelPaso.js`): al cambiar de paso, al girar o cambiar de tamaño la pantalla, al saberse la forma del video y al
     prender el cronómetro, se vuelve a medir el espacio y a repartirlo. Se hace sobre el DOM, sin volver a dibujar. */
  const desplaza = useRef(null);
  const pa = useRef(null);
  const crono = useRef(null);
  const llave = [paso.clave, cifras.map((x) => x.valor).join('|'), anotado, nota.join('|'), !!resumen, !!video, !!hayCronometro].join('§');
  useLayoutEffect(() => {
    if (solo) return undefined;
    const corre = () => acomodaPaso(desplaza.current, pa.current);
    corre();
    const ro = new ResizeObserver(corre);
    if (desplaza.current) ro.observe(desplaza.current);
    if (crono.current) ro.observe(crono.current);
    const mo = new MutationObserver(corre);
    if (pa.current) mo.observe(pa.current, { attributes: true, attributeFilter: ['data-aspecto'], subtree: true });
    if (document.fonts?.ready) document.fonts.ready.then(corre).catch(() => {});
    return () => { ro.disconnect(); mo.disconnect(); };
  }, [llave, solo]);

  const barra = (
    <BarraRedonda
      izquierda={<BotonRedondo etiqueta="Anterior" onClick={onAnterior} disabled={!puedeAnterior}><ChevronLeft size={26} /></BotonRedondo>}
      segundo={etiquetaDeCambiar ? <BotonRedondo etiqueta={etiquetaDeCambiar} onClick={onCambiar} color={c}><Pencil size={22} /></BotonRedondo> : null}
      centro={esUltimo && onTerminar
        ? <BotonDelCentro tipo="mantener" etiqueta="Mantén para terminar" onClick={onTerminar} color={color} />
        : <BotonDelCentro etiqueta="Listo" onClick={onListo} color={color} />}
      cuarto={paso.tipo === 'ejercicio' ? <TecnicaRedonda tecnica={tecnica} color={c} /> : null}
      derecha={<BotonRedondo etiqueta="Saltar" onClick={onSaltar}><ChevronRight size={26} /></BotonRedondo>}
      // En el último paso que queda, ✓ se MANTIENE para terminar: terminar es un solo paso, sin pantalla de «terminado».
      aviso={esUltimo && onTerminar ? 'Mantén ✓ para terminar' : null}
      // Un paso de 200 m o más que se hace sin mapa (eligió «Sin GPS» o cerró el mapa): se puede volver a él.
      extra={onUsarGps ? <BotonDeTexto onClick={onUsarGps} color={c}><MapPin size={16} /> Usar el mapa (GPS)</BotonDeTexto> : null}
    />
  );

  if (solo) {
    return (
      <>
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          <div style={{ ...COLUMNA, padding: '0 18px 18px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            {paso.encabezado && <div style={{ fontSize: 13, fontWeight: 700, color: LT.text2, textAlign: 'center' }}>{paso.encabezado}</div>}
            <h1 style={{ margin: '0 0 10px', fontSize: 38, fontWeight: 800, letterSpacing: -0.7, lineHeight: 1.1, color: LT.text, textAlign: 'center', overflowWrap: 'anywhere', textWrap: 'balance' }}>
              {paso.nombre}
            </h1>
            {sigue && (
              <div style={{ textAlign: 'center', fontSize: 15, fontWeight: 700, color: LT.text3 }}>
                Sigue: <b style={{ color: LT.text2 }}>{sigue}</b>
              </div>
            )}
          </div>
        </div>
        {barra}
      </>
    );
  }

  return (
    <>
      <div ref={desplaza} style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '12px 0 14px' }}>
        <div ref={pa} className="pa" data-modo={video ? 'arriba' : 'sin'} style={{ ...COLUMNA, padding: '0 18px', color: LT.text }}>
          {(paso.encabezado || paso.opcional) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 'calc(-6px * var(--k))' }}>
              {paso.encabezado && <span style={{ fontSize: 13, fontWeight: 700, color: LT.text2 }}>{paso.encabezado}</span>}
              {paso.opcional && <Etiqueta suave>Opcional</Etiqueta>}
            </div>
          )}
          <h1 className="pa-tit">{paso.nombre}</h1>
          {(video || resumen || cifras.length > 0) && (
            <div className="pa-cuerpo">
              {video && <div className="pa-vid">{video}</div>}
              {(resumen || cifras.length > 0) && (
                <div className="pa-der">
                  {resumen && <div className="pa-serie" style={{ display: 'flex', minWidth: 0 }}><TarjetaDeLaSerie resumen={resumen} color={color} /></div>}
                  {cifras.length > 0 && <TarjetaDeCifras cifras={cifras} color={color} onQueEs={onQueEs} globo={globo} />}
                </div>
              )}
            </div>
          )}
          {hayCronometro && <div ref={crono}>{cronometro}</div>}
          {anotado && (
            <div><Pastilla fuerte><Check size={14} strokeWidth={3} /> Hoy: {anotado}</Pastilla></div>
          )}
          {nota.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {/* De quién es la nota («Nota de Carlos», con su inicial): se lee como algo que te dijo una persona, no como texto de la app. */}
              {notaDe && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 800, color: c }}>
                  {notaDe.inicial && (
                    <span aria-hidden="true" style={{ width: 22, height: 22, borderRadius: '50%', background: halo(c), display: 'grid', placeItems: 'center', fontSize: 11.5, fontWeight: 800 }}>{notaDe.inicial}</span>
                  )}
                  {notaDe.texto}
                </div>
              )}
              {nota.map((t, i) => <p key={i} className="pa-nota" style={{ color: '#2E2F3A' }}>{t}</p>)}
              <button
                type="button" className="pa-vermas" onClick={() => { if (pa.current) pa.current.dataset.corta = '0'; }}
                style={{ alignSelf: 'flex-start', border: 'none', background: 'none', padding: '2px 0', cursor: 'pointer', fontFamily: FONT, fontSize: 14, fontWeight: 800, color: c }}
              >
                Ver la nota completa
              </button>
            </div>
          )}
        </div>
      </div>
      {barra}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Antes de empezar                                                    */
/* ------------------------------------------------------------------ */

/**
 * «Antes de empezar» (23 oct 2026): lo que el coach dejó dicho para TODA la sesión (sus notas y la clase) vive en la lista del día, no en el entreno; como «Empezar» ya abre
 * el entreno directo, esta pantalla sale primero, SOLO si hay algo que decir. Sin notas ni clase, el entreno arranca en el paso 1 como siempre.
 */
export function PantallaAntesDeEmpezar({ nombre, notas, clase, onEmpezar, onSalir }) {
  return (
    <>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ ...COLUMNA, padding: '8px 18px 18px' }}>
          <Etiqueta suave>Antes de empezar</Etiqueta>
          <h1 style={{ margin: '12px 0 14px', fontSize: 30, fontWeight: 800, letterSpacing: -0.7, lineHeight: 1.1, color: LT.text, overflowWrap: 'anywhere' }}>{nombre}</h1>
          {clase}
          {notas.length > 0 && (
            <div style={{ background: LT.surface, borderRadius: 18, padding: '14px 16px', boxShadow: '0 1px 2px rgba(17,19,24,0.04)' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: LT.text2, marginBottom: 8 }}>Notas del coach</div>
              {notas.map((n, i) => <p key={i} style={{ margin: i ? '10px 0 0' : 0, fontSize: 17, lineHeight: 1.5, fontWeight: 500, color: LT.text }}>{n}</p>)}
            </div>
          )}
        </div>
      </div>
      <div style={{ flexShrink: 0, padding: '10px 0 calc(10px + env(safe-area-inset-bottom))' }}>
        <div style={{ ...COLUMNA, padding: '0 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <BotonGrande onClick={onEmpezar}><Play size={20} fill="#fff" /> Empezar</BotonGrande>
          <BotonDeTexto onClick={onSalir}>Salir</BotonDeTexto>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Un Set con reloj                                                    */
/* ------------------------------------------------------------------ */

/**
 * Un Set con reloj (un formato como AMRAP, EMOM o Tabata, o varios lapsos seguidos) es UN paso: lo corre el reloj de siempre
 * (`RelojDelBloque`), que es la pantalla protagonista mientras dura. Aquí solo se dice qué es, con qué ejercicios (y, en lapsos, qué lapsos),
 * y se abre el reloj o se anota el resultado a mano.
 */
export function PantallaDeReloj({ paso, detalle, resultado, puedeAnterior, tecnica, enMarcha = false, onIniciar, onAnotar, onListo, onSaltar, onAnterior, color = null, esUltimo = false, onTerminar = null }) {
  const conLapsos = !!paso.deLapsos;
  return (
    <>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ ...COLUMNA, padding: '0 18px 18px' }}>
          {paso.encabezado && (
            <div style={{ fontSize: 13, fontWeight: 700, color: LT.text2, marginTop: 14 }}>{paso.encabezado}</div>
          )}
          <div style={{ marginTop: 12 }}><Etiqueta>Con reloj</Etiqueta></div>
          <h1 style={{ margin: '12px 0 8px', fontSize: 30, fontWeight: 800, letterSpacing: -0.7, lineHeight: 1.1, color: LT.text, overflowWrap: 'anywhere' }}>{paso.resumen}</h1>
          {detalle && <p style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 500, color: LT.text2, lineHeight: 1.45 }}>{detalle}</p>}
          <div style={{ background: LT.surface, border: 'none', borderRadius: 18, padding: '4px 16px', marginTop: detalle ? 0 : 12 }}>
            {paso.miembros.map((m, i) => (
              <div key={m.idx} style={{ padding: '13px 0', borderTop: i > 0 ? `1px solid ${LT.border}` : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
                  <span style={{ fontSize: 16.5, fontWeight: 800, color: LT.text, overflowWrap: 'anywhere' }}>{m.nombre}</span>
                  {!m.lapsos && (
                    <span style={{ fontSize: 14, fontWeight: 700, color: LT.text2, flexShrink: 0, textAlign: 'right', ...NUM_STYLE }}>
                      {[m.texto, m.carga].filter(Boolean).join(' · ')}
                    </span>
                  )}
                </div>
                {m.lapsos && (
                  <div style={{ marginTop: 5 }}>
                    {m.lapsos.map((l, j) => (
                      <div key={j} style={{ display: 'flex', alignItems: 'baseline', gap: 9, padding: '3px 0', fontSize: 14, fontWeight: 600, color: LT.text2, lineHeight: 1.35, ...NUM_STYLE }}>
                        <span style={{ width: 12, flexShrink: 0, textAlign: 'center', fontSize: 12, fontWeight: 800, color: LT.text3 }}>{j + 1}</span>
                        <span>{[l.texto, l.carga, l.descanso ? `descanso ${l.descanso}` : null].filter(Boolean).join(' · ') || '—'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          {resultado && (
            <div style={{ marginTop: 14 }}><Pastilla fuerte><Check size={14} strokeWidth={3} /> Resultado: {textoDeResultado(resultado, conLapsos ? 'lapso' : undefined)}</Pastilla></div>
          )}
          {paso.nota && <p style={{ margin: '14px 0 0', fontSize: 18, lineHeight: 1.5, fontWeight: 500, color: LT.text }}>{paso.nota}</p>}
        </div>
      </div>
      {/* Esta pantalla ya NO es un paso obligado entre «Iniciar entreno» y el reloj (Andrés: «si ya le piqué a iniciar entrenamiento, ¿por qué
          tengo que picar iniciar reloj?»): al avanzar, `EntrenoDelDia` abre el reloj solo, con su 3, 2, 1. Aquí se llega al volver atrás, al tocar
          el Set en «Ver todo», al retomar el entreno o al cancelar la cuenta; el botón arranca ya (o sigue, si el reloj iba a medias).
          La barra redonda (30 oct 2026): sin resultado, ▶ Empezar al centro y ✎ «Anotar sin reloj»; con resultado, ✓ Listo y ✎ «Cambiar el resultado». */}
      <BarraRedonda
        izquierda={<BotonRedondo etiqueta="Anterior" onClick={onAnterior} disabled={!puedeAnterior}><ChevronLeft size={26} /></BotonRedondo>}
        segundo={<BotonRedondo etiqueta={resultado ? 'Cambiar el resultado' : 'Anotar sin reloj'} onClick={onAnotar} color={color || LT.blue}><Pencil size={22} /></BotonRedondo>}
        centro={!resultado
          ? <BotonDelCentro tipo="empezar" etiqueta={enMarcha ? 'Seguir el reloj' : 'Empezar el reloj'} onClick={onIniciar} color={color} />
          : esUltimo && onTerminar
            ? <BotonDelCentro tipo="mantener" etiqueta="Mantén para terminar" onClick={onTerminar} color={color} />
            : <BotonDelCentro etiqueta="Listo" onClick={onListo} color={color} />}
        cuarto={<TecnicaRedonda tecnica={tecnica} color={color || LT.blue} />}
        derecha={<BotonRedondo etiqueta="Saltar" onClick={onSaltar}><ChevronRight size={26} /></BotonRedondo>}
        aviso={resultado && esUltimo && onTerminar ? 'Mantén ✓ para terminar' : null}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* El descanso                                                         */
/* ------------------------------------------------------------------ */

/**
 * El descanso: solo existe porque el coach lo escribió. Cuenta hacia abajo y, al llegar a cero, avisa y la app pasa sola a lo que sigue: «Seguir»
 * lo adelanta y «+30 s» lo alarga ANTES de que acabe. Antes seguía contando hacia arriba («+0:09»); Andrés (9 oct 2026): «podría perderse el punto de
 * que la app guíe en entrenamiento y podría ser redundante con el botón de +30 s». Un descanso escrito con palabras («Recuperación total») no tiene
 * cuenta: se lee tal cual y espera «Seguir».
 * `siguiente` es lo que viene (para ir acomodándose): su nombre, lo planeado y sus vueltas en puntos. Si el ejercicio que sigue tiene video (o foto), llega en
 * `video` y se VE aquí, en la tarjeta de «Sigue»: Andrés (10 oct 2026): «que mientras está el atleta en descanso pueda ver el video del ejercicio que sigue».
 * Sin video, «Sigue» es la tarjeta de siempre, abajo junto a los botones. Sin frases que expliquen el botón: el botón ya dice «Seguir».
 */
export function PantallaDeDescanso({ descanso, siguiente, video, sonido, puedeAnterior, onSeguir, onMas, onAnterior, onSonido, color = null }) {
  const { paso } = descanso;
  const conCuenta = descanso.restan !== null;
  const conVideo = !!siguiente && !!video;
  // Al llegar a cero el descanso se acaba y la app sigue sola (ver `EntrenoDelDia`): ya no hay un «+0:09» que cuente de más.
  const grande = !conCuenta ? '' : relojDe(Math.max(0, descanso.restan));
  const avance = !conCuenta || descanso.seg <= 0 ? 0 : Math.min(1, Math.max(0, (descanso.seg - descanso.restan) / descanso.seg));
  // Con el video a la vista, la cuenta se achica un poco para que quepan las dos cosas sin tener que desplazarse.
  const tamano = grande.length > 5 ? (conVideo ? 60 : 76) : (conVideo ? 84 : 108);
  const datosDelSiguiente = siguiente && (
    <>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: LT.text2 }}>Sigue</div>
        <div style={{ fontSize: 17, fontWeight: 800, color: LT.text, overflowWrap: 'anywhere', lineHeight: 1.2, marginTop: 2 }}>{siguiente.nombre}</div>
        {siguiente.detalle && <div style={{ fontSize: 13, fontWeight: 600, color: LT.text2, marginTop: 3, ...NUM_STYLE }}>{siguiente.detalle}</div>}
      </div>
      <SerieDelSet puntos={siguiente.puntos} />
    </>
  );
  return (
    <>
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        <div style={{ ...COLUMNA, padding: conVideo ? '8px 18px 14px' : '0 18px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: -0.2, color: LT.text }}>Descanso</div>
          {conCuenta ? (
            <>
              <div role="timer" style={{ fontSize: tamano, fontWeight: 800, lineHeight: 1.05, letterSpacing: -3, color: descanso.vencido ? LT.text2 : LT.text, margin: conVideo ? '4px 0 12px' : '8px 0 14px', ...NUM_STYLE }}>
                {grande}
              </div>
              <div style={{ height: 6, borderRadius: 3, background: 'rgba(17,19,24,0.12)', margin: '0 28px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.round((descanso.vencido ? 1 : avance) * 100)}%`, background: color || LT.blue, borderRadius: 3, transition: 'width 0.25s linear' }} />
              </div>
              {paso.segMax && <div style={{ marginTop: 14, fontSize: 13.5, fontWeight: 700, color: LT.text3, ...NUM_STYLE }}>Puedes llegar hasta {relojDe(paso.segMax + descanso.extra)}</div>}
            </>
          ) : (
            <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: -0.6, lineHeight: 1.15, color: LT.text, margin: '14px 0 0', overflowWrap: 'anywhere' }}>{paso.texto}</div>
          )}
          {conVideo && (
            <div style={{ marginTop: 18, textAlign: 'left', background: LT.surface, borderRadius: 22, padding: 8, boxShadow: '0 2px 10px rgba(17,19,24,0.07)' }}>
              {video}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 6px 4px' }}>{datosDelSiguiente}</div>
            </div>
          )}
        </div>
      </div>
      {/* «Sigue» va arriba de la barra, como siempre; la barra es la redonda (30 oct 2026): ‹ Anterior · 🔔 aviso · ▶ Seguir · +30 s. */}
      {siguiente && !conVideo && (
        <div style={{ ...COLUMNA, padding: '0 18px', flexShrink: 0 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, background: LT.surface, borderRadius: 18, padding: '12px 14px', boxShadow: '0 2px 10px rgba(17,19,24,0.07)',
          }}>
            {datosDelSiguiente}
          </div>
        </div>
      )}
      <BarraRedonda
        izquierda={<BotonRedondo etiqueta="Anterior" onClick={onAnterior} disabled={!puedeAnterior}><ChevronLeft size={26} /></BotonRedondo>}
        segundo={conCuenta ? (
          <BotonRedondo etiqueta={sonido ? 'Aviso al terminar: prendido' : 'Aviso al terminar: apagado'} onClick={onSonido} color={sonido ? (color || LT.blue) : LT.text3}>
            {sonido ? <Bell size={22} /> : <BellOff size={22} />}
          </BotonRedondo>
        ) : null}
        centro={<BotonDelCentro tipo="empezar" etiqueta="Seguir" onClick={onSeguir} color={color} />}
        cuarto={conCuenta ? <BotonRedondo etiqueta="30 segundos más" onClick={onMas}>+30</BotonRedondo> : null}
        derecha={null}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Las hojas                                                           */
/* ------------------------------------------------------------------ */

// La hoja que sube desde abajo, como la de «Tu resultado» del reloj.
function Hoja({ etiqueta, titulo, subtitulo, icono, conCierre = false, onCerrar, children }) {
  return (
    <div
      onMouseDown={onCerrar}
      style={{ position: 'fixed', inset: 0, zIndex: 3100, background: 'rgba(17,19,24,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-label={etiqueta} className="animate-sheet"
        style={{
          width: '100%', maxWidth: 520, background: UI.fondo, borderRadius: '24px 24px 0 0', fontFamily: FONT, boxSizing: 'border-box',
          padding: '10px 18px calc(16px + env(safe-area-inset-bottom))', maxHeight: '92svh', overflowY: 'auto',
        }}
      >
        <div aria-hidden="true" style={{ width: 38, height: 4, borderRadius: 2, background: LT.borderHi, margin: '0 auto 14px' }} />
        {icono && (
          <div aria-hidden="true" style={{ width: 52, height: 52, borderRadius: 16, background: LT.blueSoft, color: LT.blue, display: 'grid', placeItems: 'center', marginBottom: 12 }}>
            {icono}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: LT.text, letterSpacing: -0.4 }}>{titulo}</div>
          {conCierre && <button type="button" onClick={onCerrar} aria-label="Cerrar" style={redondo}><X size={19} /></button>}
        </div>
        {subtitulo && <div style={{ fontSize: 14.5, fontWeight: 500, color: LT.text2, margin: '5px 0 0', lineHeight: 1.45 }}>{subtitulo}</div>}
        <div style={{ marginTop: 16 }}>{children}</div>
      </div>
    </div>
  );
}

const circulo = (relleno) => ({
  width: 46, height: 46, borderRadius: '50%', flexShrink: 0, cursor: 'pointer', display: 'grid', placeItems: 'center', fontFamily: FONT,
  touchAction: 'manipulation', border: 'none', background: relleno ? LT.blue : LT.surface2,
  color: relleno ? '#fff' : LT.text2,
});

// Una pastillita de las filas de «Ver todo» («5 reps», «≈105 kg»): gris, o azul si es el peso.
function Pastillita({ children, fuerte = false }) {
  return (
    <span style={{
      fontSize: 11.5, fontWeight: 700, padding: '3px 8px', borderRadius: 7, whiteSpace: 'nowrap', background: fuerte ? LT.blueSoft : LT.surface2,
      color: fuerte ? LT.blue : LT.text2, ...NUM_STYLE,
    }}>
      {children}
    </span>
  );
}

// Un ejercicio en «Ver todo»: su foto (o su número, o la palomita si ya se hizo), su nombre y lo planeado. El que toca va en azul suave.
function FilaDeLaLista({ fila, n, miniatura, conLinea, onElegir }) {
  const hecho = fila.estado === 'hecho';
  const toca = fila.estado === 'actual';
  return (
    <button
      type="button" disabled={hecho} onClick={() => onElegir(fila.clave)} aria-current={toca ? 'step' : undefined}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', border: 'none', borderTop: conLinea ? '1px solid #ECEEF2' : 'none',
        background: 'transparent', textAlign: 'left', fontFamily: FONT, cursor: hecho ? 'default' : 'pointer', touchAction: 'manipulation', opacity: hecho ? 0.55 : 1,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: 'relative', width: 48, height: 48, borderRadius: 13, flexShrink: 0, overflow: 'visible', display: 'grid', placeItems: 'center',
          fontSize: 14, fontWeight: 800, color: LT.text3, background: miniatura ? '#1B1D24' : '#EEF0F4',
        }}
      >
        {/* Reestructura visual (16 oct 2026), como «Tu entreno» de las capturas: lo hecho conserva su miniatura, apagada, con la palomita verde encima. */}
        {hecho && <span style={{ /* estilo-ok: aro del palomeo */ position: 'absolute', right: -5, bottom: -5, width: 22, height: 22, borderRadius: 11, background: LT.mint, color: '#fff', display: 'grid', placeItems: 'center', border: '2px solid #fff', zIndex: 1 }}><Check size={12} strokeWidth={3.5} /></span>}
        {miniatura && (
          <>
            {miniatura.nodo}
            {miniatura.conVideo && (
              <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'rgba(0,0,0,0.25)', color: '#fff' }}>
                <Play size={15} fill="#fff" />
              </span>
            )}
          </>
        )}
        {!miniatura && n}
      </span>
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: 'block', fontSize: 15.5, fontWeight: 700, color: LT.text, lineHeight: 1.25, overflowWrap: 'anywhere' }}>{fila.nombre}</span>
        {(fila.pastillas.length > 0 || fila.estado === 'saltado') && (
          <span style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 5 }}>
            {fila.pastillas.map((x, i) => <Pastillita key={i} fuerte={x.fuerte}>{x.texto}</Pastillita>)}
            {fila.estado === 'saltado' && <Pastillita>Saltado</Pastillita>}
          </span>
        )}
      </span>
      {toca
        ? <span style={{ flexShrink: 0, fontSize: 12, fontWeight: 700, color: '#fff', background: LT.blue, padding: '4px 8px', borderRadius: 8 }}>Ahora</span>
        : !hecho && <ChevronRight size={18} color={LT.text3} style={{ flexShrink: 0 }} />}
    </button>
  );
}

/**
 * «Ver todo»: el entreno como lo escribió el coach, UNA TARJETA POR SET. La del Set que toca lleva borde azul; el ejercicio que toca, azul suave.
 * Las vueltas de un Set van como «Serie 2 de 5» en su encabezado (no una fila por vuelta). Tocar un ejercicio que falta lleva a él (lo saltado sigue ahí);
 * lo hecho no se toca. «Seguir» cierra la hoja y el atleta sigue donde iba; «Terminar entreno» da por cerrado lo que falte.
 *
 * `tarjetas` viene de `tarjetasDeLaLista`; `miniaturaDe(fila)` dice la foto o el video de ese ejercicio (`{ nodo, conVideo }`) o `null`.
 */
export function HojaDeLista({ tarjetas, miniaturaDe, palabras, onElegir, onTerminar, onSalir, onCerrar }) {
  return (
    <Hoja etiqueta={palabras.listaTitulo} titulo={palabras.listaTitulo} conCierre onCerrar={onCerrar}>
      {tarjetas.map((t, ti) => {
        const hechoElReloj = t.reloj && t.filas[0]?.estado === 'hecho';
        const derecha = t.reloj
          ? (t.resultado || hechoElReloj
            ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 700, padding: '3px 8px', borderRadius: 7, background: KP.mintSoft, color: LT.mint, ...NUM_STYLE }}>
                <Check size={11} strokeWidth={3.5} /> {t.resultado || 'Hecho'}
              </span>
            ) : null)
          : (t.puntos.length > 1 ? <SerieDelSet puntos={t.puntos} /> : null);
        const conEncabezado = !!(t.titulo || t.etiqueta || derecha);
        return (
          <section
            key={ti}
            style={{
              border: 'none', borderRadius: 20, background: LT.surface, marginBottom: 10, overflow: 'hidden',
              boxShadow: '0 1px 2px rgba(17,19,24,0.04)',
            }}
          >
            {conEncabezado && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '11px 13px 9px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  {t.titulo && <b style={{ fontSize: 14.5, fontWeight: 800, color: LT.blue, whiteSpace: 'nowrap' }}>{t.titulo}</b>}
                  {t.etiqueta && <Pastillita fuerte>{t.etiqueta}</Pastillita>}
                </span>
                {derecha}
              </div>
            )}
            {t.filas.map((f, fi) => (
              <FilaDeLaLista key={`${f.idx}.${fi}`} fila={f} n={fi + 1} miniatura={miniaturaDe(f)} conLinea={conEncabezado || fi > 0} onElegir={onElegir} />
            ))}
          </section>
        );
      })}
      <div style={{ marginTop: 14 }}><BotonGrande onClick={onCerrar}>Seguir</BotonGrande></div>
      <div style={{ textAlign: 'center', marginTop: 6 }}>
        <button type="button" onClick={onTerminar} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: FONT, fontSize: 15.5, fontWeight: 800, color: LT.blue, padding: '10px 14px', touchAction: 'manipulation' }}>{palabras.listaTerminar}</button>
      </div>
      {onSalir && (
        <div style={{ textAlign: 'center' }}>
          <button type="button" onClick={onSalir} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: FONT, fontSize: 15, fontWeight: 600, color: LT.text2, padding: '8px 14px', touchAction: 'manipulation' }}>{palabras.listaSalir}</button>
        </div>
      )}
    </Hoja>
  );
}

// Un campo de «Cambiar»: el número con su − y su +, igual que los de la ficha del ejercicio.
function CampoDeCambiar({ rotulo, planeado, valor, paso, decimal, onCambio }) {
  const mueve = (d) => {
    const base = parseFloat(String(valor).replace(',', '.'));
    // Bajar desde vacío (o desde cero) no anota nada: el mismo gesto que lo creó lo deshace (ver la ficha del ejercicio).
    if (d < 0 && (!Number.isFinite(base) || base <= 0)) { onCambio(''); return; }
    const sigue = Number.isFinite(base) ? base : (parseFloat(String(planeado).replace(',', '.')) || 0);
    onCambio(String(Math.max(0, Math.round((sigue + d * paso) * 100) / 100)));
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px 12px', background: LT.surface, borderRadius: 20, padding: '14px 16px', boxShadow: '0 1px 2px rgba(17,19,24,0.04)' }}>
      <div style={{ minWidth: 0, flex: '1 1 110px' }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: LT.text }}>{rotulo}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginLeft: 'auto' }}>
        <button type="button" onClick={() => mueve(-1)} aria-label={`Bajar ${rotulo}`} style={circulo(false)}><Minus size={20} strokeWidth={3} /></button>
        <input
          type="number" inputMode={decimal ? 'decimal' : 'numeric'} value={valor} placeholder="—" aria-label={rotulo} className="sin-flechas"
          onChange={(e) => onCambio(e.target.value)}
          style={{
            width: 70, border: 'none', background: 'transparent', textAlign: 'center', fontSize: 27, fontWeight: 800, outline: 'none', fontFamily: FONT, padding: 0,
            color: valor === '' ? LT.text3 : LT.text, ...NUM_STYLE,
          }}
        />
        <button type="button" onClick={() => mueve(1)} aria-label={`Subir ${rotulo}`} style={circulo(true)}><Plus size={20} strokeWidth={3} /></button>
      </div>
    </div>
  );
}

/**
 * «Lo que hiciste»: solo lo que salió distinto de lo planeado. Los campos arrancan en lo planeado; al guardar viaja SOLO lo que se
 * tocó (si no se cambió nada, es lo mismo que «Listo»). `campos`: de `camposDeCambiar`; `planeadoDe[clave]` y `inicialDe[clave]`
 * dicen de dónde arranca cada uno (reps: la cantidad; kg: los kilos del plan, en su unidad); `unidadDePeso` rotula los kilos.
 */
export function HojaDeCambiar({ campos, planeado, inicial, unidadDePeso, resumen, onGuardar, onCerrar }) {
  const [valores, setValores] = useState(() => Object.fromEntries(campos.map((c) => [c.clave, String(inicial[c.clave] ?? planeado[c.clave] ?? '')])));
  const cambio = (clave, v) => setValores((x) => ({ ...x, [clave]: v }));
  const tocados = campos.filter((c) => valores[c.clave] !== String(inicial[c.clave] ?? planeado[c.clave] ?? ''));
  const guarda = () => onGuardar(Object.fromEntries(tocados.map((c) => [c.clave, valores[c.clave]])));
  return (
    <Hoja
      etiqueta="Lo que hiciste" titulo="Lo que hiciste" onCerrar={onCerrar}
      subtitulo={resumen ? `Planeado: ${resumen}` : undefined}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {campos.map((c) => (
          <CampoDeCambiar
            key={c.clave}
            rotulo={c.clave === 'kg' ? `Peso (${unidadDePeso})` : c.rotulo}
            planeado={planeado[c.clave] ? `${planeado[c.clave]}${c.clave === 'kg' ? ` ${unidadDePeso}` : ''}` : ''}
            valor={valores[c.clave]} paso={c.clave === 'kg' ? (unidadDePeso === 'lb' ? 5 : 2.5) : c.paso} decimal={c.clave === 'kg' || c.paso < 1}
            onCambio={(v) => cambio(c.clave, v)}
          />
        ))}
      </div>
      <div style={{ marginTop: 18 }}><BotonGrande onClick={guarda}>Guardar y seguir</BotonGrande></div>
      <div style={{ textAlign: 'center', marginTop: 2 }}><BotonDeTexto onClick={onCerrar}>Cancelar</BotonDeTexto></div>
    </Hoja>
  );
}

/**
 * «¿Guardamos tu recorrido?» (23 oct 2026): se pregunta UNA vez, al abrir el primer entreno en este teléfono (guiado, o libre sin mapa: sección 8b). Con «Sí», el entreno guarda por dónde te mueves
 * para que tus stickers puedan llevar la línea (ver `useRecorrido`). «Ahora no» no rompe nada: los pasos de 200 m o más siguen ofreciendo el mapa.
 */
export function HojaDelRecorrido({ onSi, onNo }) {
  return (
    <Hoja etiqueta="Tu recorrido" titulo="¿Guardamos tu recorrido?" subtitulo="Mientras entrenas, la app guarda por dónde te moviste, para dibujar tu recorrido en tus stickers. Nadie lo ve si tú no lo compartes. Con la pantalla apagada también: el iPhone te pedirá «Siempre» después." icono={<MapPin size={25} />} onCerrar={onNo}>
      <BotonGrande onClick={onSi}>Sí, guardar</BotonGrande>
      <div style={{ textAlign: 'center', marginTop: 2 }}><BotonDeTexto onClick={onNo}>Ahora no</BotonDeTexto></div>
    </Hoja>
  );
}

/** «Grabar técnica para tu coach»: mientras no se prenda (`lib/funciones.js`), dice que viene y por dónde llegará. */
export function HojaDeTecnica({ palabras, onCerrar }) {
  return (
    <Hoja etiqueta={palabras.tecnicaTitulo} titulo={palabras.tecnicaTitulo} subtitulo={palabras.tecnicaTexto} icono={<Video size={25} />} onCerrar={onCerrar}>
      <BotonGrande onClick={onCerrar}>Entendido</BotonGrande>
    </Hoja>
  );
}

export { CronometroDelPaso };
