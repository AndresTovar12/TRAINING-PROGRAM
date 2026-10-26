import { useState } from 'react';
import { Bell, BellOff, Check, ChevronLeft, ChevronRight, List, MapPin, Minus, Pencil, Play, Plus, Share2, Timer, Video, X } from 'lucide-react';
import { LT, KP, FONT, NUM_STYLE, UI } from '@/lib/theme';
import { textoDeResultado } from '@/lib/formatos';
import { relojDe } from '@/lib/entrenoDatos';

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
 * Un botón de los que NO son lo principal pero tienen que verse («Anterior», «Saltar», «Anotar resultados»): borde y letra firmes, con lo que
 * hace escrito. Andrés (9 oct 2026): los de texto suelto de abajo «están muy escondidos, ni me había percatado de que estaban».
 * `ancho`: ocupa toda la línea; si no, comparte la fila con su vecino a partes iguales.
 */
function BotonSecundario({ children, onClick, disabled = false, ancho = false }) {
  return (
    <button
      type="button" onClick={onClick} disabled={disabled} className="kp-press"
      style={{
        flex: ancho ? undefined : 1, width: ancho ? '100%' : undefined, minWidth: 0, minHeight: 50, borderRadius: 16, cursor: disabled ? 'default' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '0 10px', fontFamily: FONT, fontSize: 15.5, fontWeight: 800,
        // Blanco y sin borde sobre el fondo teñido (reestructura visual, 15 oct 2026); siguen siendo botones enteros, no texto suelto (Andrés, 9 oct: «muy escondidos»).
        touchAction: 'manipulation', border: 'none', background: LT.surface, boxShadow: disabled ? 'none' : '0 2px 10px rgba(17,19,24,0.07)',
        color: disabled ? LT.text3 : LT.text, opacity: disabled ? 0.6 : 1,
      }}
    >
      {children}
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

/**
 * «Grabar técnica para el coach»: la cámara de cada paso. Mientras la función esté apagada (`lib/funciones.js`) lleva su «Pronto», igual que
 * «Mensajes»; en un teléfono muy angosto la palabra se esconde (`.pronto-texto`) y queda el ícono, para que quepa la fila.
 */
function BotonDeTecnica({ activa, etiqueta, onClick, enviada = false }) {
  // Prendida: un botón con su borde (como la ✕ de «quitar»): una cámara suelta no se leía como botón. Con ✓ verde si ya mandó la de esta serie.
  if (activa) {
    return (
      <button
        type="button" onClick={onClick} aria-label={enviada ? `${etiqueta} (ya mandaste una)` : etiqueta} className="kp-press"
        style={{
          width: 50, minHeight: 50, flexShrink: 0, borderRadius: 16, border: 'none', boxShadow: '0 2px 10px rgba(17,19,24,0.07)', background: LT.surface, color: enviada ? LT.mint : LT.text,
          cursor: 'pointer', display: 'grid', placeItems: 'center', touchAction: 'manipulation', position: 'relative',
        }}
      >
        <Video size={20} />
        {enviada && <span aria-hidden="true" style={{ position: 'absolute', top: -5, right: -5, width: 18, height: 18, borderRadius: '50%', background: LT.mint, color: '#fff', display: 'grid', placeItems: 'center' }}><Check size={11} strokeWidth={3.5} /></span>}
      </button>
    );
  }
  return (
    <button
      type="button" onClick={onClick} aria-label={etiqueta}
      style={{
        border: 'none', background: 'transparent', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 4px',
        color: LT.text2, touchAction: 'manipulation',
      }}
    >
      <Video size={19} />
      {!activa && (
        <span
          className="pronto-texto"
          style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: 0.3, padding: '3px 7px', borderRadius: 7, background: LT.surface2, color: LT.text2 }}
        >
          Pronto
        </span>
      )}
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

// Una cifra grande con su rótulo debajo: «5 reps», «78% carga», «≈105 kg». El número se achica solo para caber en UNA línea en un teléfono
// angosto (ver `.cifra-valor` en index.css): «78» arriba y «%» abajo se leería como dos cosas distintas.
function Cifra({ valor, etiqueta, destacado = false, texto = false }) {
  return (
    <div className="cifra" style={{
      flex: 1, minWidth: 0, background: LT.surface, borderRadius: 18, padding: '8px 8px 7px', textAlign: 'center', boxShadow: '0 2px 10px rgba(17,19,24,0.06)',
      display: 'flex', flexDirection: 'column', justifyContent: 'center',
    }}>
      <div
        className={texto ? 'cifra-texto-chica' : 'cifra-valor-chica'}
        style={{ '--n': String(valor).length, fontWeight: 800, color: destacado ? LT.blue : LT.text, ...NUM_STYLE }}
      >
        {valor}
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, color: LT.text2, marginTop: 2 }}>{etiqueta}</div>
    </div>
  );
}

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
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, ...NUM_STYLE }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: enColor ? 'rgba(255,255,255,0.85)' : LT.text2 }}>Serie</span>
              <span style={{ fontSize: sola ? 34 : 26, fontWeight: 800, letterSpacing: -0.8, lineHeight: 1, color: enColor ? '#fff' : LT.blue }}>{numero}</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: enColor ? 'rgba(255,255,255,0.85)' : LT.text2 }}>de {total}</span>
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

/**
 * La pantalla de un ejercicio: nombre (con las vueltas en puntos si el Set se repite), video (si el coach lo tiene), las cifras, la nota en
 * texto grande y «Listo». En una bi-serie, arriba, el tipo y el par A/B. Si no trae nada más que el nombre, el nombre se queda solo en el
 * centro con «Sigue: …» (el hueco de un video o de unas cifras vacías se lee como un fallo de la app).
 */
export function PantallaDePaso({
  paso, video, cifras, anotado, sigue, resumen, cronometro, etiquetaDeCambiar, puedeAnterior, tecnica,
  onListo, onCambiar, onSaltar, onAnterior, color = null, onUsarGps = null,
}) {
  const nota = [paso.nota, paso.cue].filter(Boolean);
  const hayCronometro = paso.tipo === 'ejercicio' && paso.termina?.por === 'tiempo' && cronometro;
  const solo = !video && !cifras.length && !nota.length && !hayCronometro && !anotado && !resumen && !paso.opcional;
  return (
    <>
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        <div style={{ ...COLUMNA, padding: '0 18px 18px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: solo ? 'center' : 'flex-start' }}>
          {paso.encabezado && (
            <div style={{ fontSize: 13, fontWeight: 700, color: LT.text2, marginTop: 14, textAlign: solo ? 'center' : 'left' }}>
              {paso.encabezado}
            </div>
          )}
          {paso.opcional && <div style={{ marginTop: 8 }}><Etiqueta suave>Opcional</Etiqueta></div>}
          <div style={{ margin: solo ? '0 0 10px' : '14px 0 12px' }}>
            <h1 style={{
              margin: 0, fontSize: solo ? 38 : 30, fontWeight: 800, letterSpacing: -0.7, lineHeight: 1.1, color: LT.text,
              textAlign: solo ? 'center' : 'left', overflowWrap: 'anywhere', textWrap: 'balance',
            }}>
              {paso.nombre}
            </h1>
          </div>
          {solo && sigue && (
            <div style={{ textAlign: 'center', fontSize: 15, fontWeight: 700, color: LT.text3 }}>
              Sigue: <b style={{ color: LT.text2 }}>{sigue}</b>
            </div>
          )}
          {video && <div style={{ marginBottom: 14 }}>{video}</div>}
          {/* La serie explicada a la izquierda y las cifras APILADAS a la derecha (la mitad de espacio que antes). Sin serie que explicar, las cifras van en una fila. */}
          {(resumen || cifras.length > 0) && (
            <div style={{ display: 'flex', alignItems: 'stretch', gap: 10, marginBottom: 14 }}>
              {resumen && <TarjetaDeLaSerie resumen={resumen} color={color} />}
              {cifras.length > 0 && (
                <div style={{ display: 'flex', flexDirection: resumen ? 'column' : 'row', gap: 8, flex: resumen ? '0 0 38%' : 1, minWidth: 0 }}>
                  {cifras.map((c, i) => <Cifra key={i} {...c} />)}
                </div>
              )}
            </div>
          )}
          {hayCronometro && <div style={{ marginBottom: 14 }}>{cronometro}</div>}
          {anotado && (
            <div style={{ marginBottom: 14 }}>
              <Pastilla fuerte><Check size={14} strokeWidth={3} /> Hoy: {anotado}</Pastilla>
            </div>
          )}
          {nota.map((t, i) => (
            <p key={i} style={{ margin: '0 0 12px', fontSize: 18, lineHeight: 1.5, fontWeight: 500, color: LT.text }}>{t}</p>
          ))}
        </div>
      </div>
      <div style={{ flexShrink: 0, padding: '10px 0 calc(10px + env(safe-area-inset-bottom))' }}>
        <div style={{ ...COLUMNA, padding: '0 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <BotonGrande variante="oscuro" onClick={onListo}>
            <span aria-hidden="true" style={{ width: 30, height: 30, borderRadius: '50%', background: color || LT.blue, display: 'grid', placeItems: 'center' }}><Check size={18} strokeWidth={3} /></span> Listo
          </BotonGrande>
          {/* «Anotar resultados»: lo que se hace ahí (antes «Cambiar reps o kilos»). */}
          {etiquetaDeCambiar && <BotonSecundario ancho onClick={onCambiar}><Pencil size={17} /> {etiquetaDeCambiar}</BotonSecundario>}
          {/* Un paso de 200 m o más que se hace sin mapa (eligió «Sin GPS» o cerró el mapa): se puede volver a él. */}
          {onUsarGps && <BotonSecundario ancho onClick={onUsarGps}><MapPin size={17} /> Usar el mapa (GPS)</BotonSecundario>}
          <div style={{ display: 'flex', gap: 10 }}>
            <BotonSecundario onClick={onAnterior} disabled={!puedeAnterior}><ChevronLeft size={18} /> Anterior</BotonSecundario>
            <BotonSecundario onClick={onSaltar}>Saltar <ChevronRight size={18} /></BotonSecundario>
            {tecnica && paso.tipo === 'ejercicio' && <BotonDeTecnica {...tecnica} />}
          </div>
        </div>
      </div>
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
export function PantallaDeReloj({ paso, detalle, resultado, puedeAnterior, tecnica, enMarcha = false, onIniciar, onAnotar, onListo, onSaltar, onAnterior, color = null }) {
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
      <div style={{ flexShrink: 0, padding: '10px 0 calc(10px + env(safe-area-inset-bottom))' }}>
        <div style={{ ...COLUMNA, padding: '0 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Esta pantalla ya NO es un paso obligado entre «Iniciar entreno» y el reloj (Andrés: «si ya le piqué a iniciar entrenamiento, ¿por qué
              tengo que picar iniciar reloj?»): al avanzar, `EntrenoDelDia` abre el reloj solo, con su 3, 2, 1. Aquí se llega al volver atrás, al tocar
              el Set en «Ver todo», al retomar el entreno o al cancelar la cuenta; el botón arranca ya (o sigue, si el reloj iba a medias). */}
          {resultado ? (
            <>
              <BotonGrande variante="oscuro" onClick={onListo}>
                <span aria-hidden="true" style={{ width: 30, height: 30, borderRadius: '50%', background: color || LT.blue, display: 'grid', placeItems: 'center' }}><Check size={18} strokeWidth={3} /></span> Listo
              </BotonGrande>
              <BotonSecundario ancho onClick={onAnotar}><Pencil size={17} /> Cambiar el resultado</BotonSecundario>
            </>
          ) : (
            <>
              <BotonGrande onClick={onIniciar}><Play size={20} fill="#fff" /> {enMarcha ? 'Seguir' : 'Empezar'}</BotonGrande>
              <BotonSecundario ancho onClick={onAnotar}><Pencil size={17} /> Anotar sin reloj</BotonSecundario>
            </>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <BotonSecundario onClick={onAnterior} disabled={!puedeAnterior}><ChevronLeft size={18} /> Anterior</BotonSecundario>
            <BotonSecundario onClick={onSaltar}>Saltar <ChevronRight size={18} /></BotonSecundario>
            {tecnica && <BotonDeTecnica {...tecnica} />}
          </div>
        </div>
      </div>
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
      <div style={{ flexShrink: 0, padding: '10px 0 calc(10px + env(safe-area-inset-bottom))' }}>
        <div style={{ ...COLUMNA, padding: '0 18px' }}>
          {siguiente && !conVideo && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12, background: LT.surface, borderRadius: 18, padding: '12px 14px', marginBottom: 12, boxShadow: '0 2px 10px rgba(17,19,24,0.07)',
            }}>
              {datosDelSiguiente}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}><BotonGrande onClick={onSeguir}>Seguir</BotonGrande></div>
            {conCuenta && (
              <button
                type="button" onClick={onMas} className="kp-press"
                style={{
                  minWidth: 84, borderRadius: 18, border: 'none', boxShadow: '0 2px 10px rgba(17,19,24,0.07)', background: LT.surface, color: LT.text, cursor: 'pointer',
                  fontFamily: FONT, fontSize: 16, fontWeight: 800, touchAction: 'manipulation',
                }}
              >
                +30 s
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
            <BotonSecundario onClick={onAnterior} disabled={!puedeAnterior}><ChevronLeft size={18} /> Anterior</BotonSecundario>
            {conCuenta && (
              <BotonSecundario onClick={onSonido}>
                {sonido ? <Bell size={17} /> : <BellOff size={17} />} {sonido ? 'Con aviso' : 'Sin aviso'}
              </BotonSecundario>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* El final                                                            */
/* ------------------------------------------------------------------ */

/** «Entrenamiento terminado»: lo que se hizo, una nota para el coach y «Terminar sesión». El avance ya estaba guardado. */
export function PantallaDeFin({ resumen, notas, palabras, onNotas, onTerminar, onVolver, onSello, yaTerminada }) {
  return (
    <>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ ...COLUMNA, padding: '36px 18px 18px', textAlign: 'center' }}>
          <div style={{ width: 84, height: 84, borderRadius: '50%', background: LT.mint, color: '#fff', display: 'grid', placeItems: 'center', margin: '0 auto 16px' }}>
            <Check size={44} strokeWidth={3.2} />
          </div>
          <h1 style={{ margin: '0 0 20px', fontSize: 30, fontWeight: 800, letterSpacing: -0.7, color: LT.text }}>{palabras.finTitulo}</h1>
          <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
            {resumen.map((c) => <Cifra key={c.etiqueta} {...c} />)}
          </div>
          {onSello && <div style={{ marginBottom: 18 }}><BotonSecundario ancho onClick={onSello}><Share2 size={18} /> Activity card</BotonSecundario></div>}
          <label htmlFor="entreno-notas" style={{ display: 'block', textAlign: 'left', fontSize: 15, fontWeight: 800, color: LT.text, margin: '0 2px 8px' }}>
            {palabras.finNotas}
          </label>
          <textarea
            id="entreno-notas" value={notas} onChange={(e) => onNotas(e.target.value)} rows={4}
            style={{
              width: '100%', boxSizing: 'border-box', border: 'none', boxShadow: '0 2px 10px rgba(17,19,24,0.07)', borderRadius: 16, background: LT.surface, padding: '14px 16px',
              fontFamily: FONT, fontSize: 16, color: LT.text, resize: 'none', outline: 'none', textAlign: 'left',
            }}
          />
        </div>
      </div>
      <div style={{ flexShrink: 0, padding: '10px 0 calc(10px + env(safe-area-inset-bottom))' }}>
        <div style={{ ...COLUMNA, padding: '0 18px', textAlign: 'center' }}>
          <BotonGrande variante="verde" onClick={onTerminar}><Check size={21} strokeWidth={3} /> {yaTerminada ? 'Listo' : 'Terminar sesión'}</BotonGrande>
          <div style={{ marginTop: 10 }}><BotonSecundario ancho onClick={onVolver}><ChevronLeft size={18} /> {palabras.finVolver}</BotonSecundario></div>
        </div>
      </div>
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
 * «¿Guardamos tu recorrido?» (23 oct 2026): se pregunta UNA vez, al abrir el primer entreno guiado en este teléfono. Con «Sí», el entreno guarda por dónde te mueves
 * para que tu activity card pueda llevar la línea (ver `useRecorrido`). «Ahora no» no rompe nada: los pasos de 200 m o más siguen ofreciendo el mapa.
 */
export function HojaDelRecorrido({ onSi, onNo }) {
  return (
    <Hoja etiqueta="Tu recorrido" titulo="¿Guardamos tu recorrido?" subtitulo="Mientras entrenas, la app guarda por dónde te moviste. Sirve para que tu activity card pueda llevar la línea de tu recorrido. Nadie lo ve si tú no lo compartes." icono={<MapPin size={25} />} onCerrar={onNo}>
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
