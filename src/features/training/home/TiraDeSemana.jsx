import { useEffect, useRef } from 'react';
import { Check } from 'lucide-react';
import { FONT, KP, NUM_STYLE, UI } from '@/lib/theme';

/**
 * La tira de los siete días (reestructura visual, 15 oct 2026): «Lun 12 · Mar 13 · …». La usan Home y la pantalla
 * de la sesión (sola o con equipo), así que se ve y se toca igual en las tres: el día elegido va en azul, hoy lleva
 * borde azul aunque se mire otro, cada sesión es un puntito (de su color, si se sabe) y lo ya hecho, una palomita.
 */
const LARGOS = { Lun: 'Lunes', Mar: 'Martes', 'Mié': 'Miércoles', Jue: 'Jueves', Vie: 'Viernes', 'Sáb': 'Sábado', Dom: 'Domingo' };

/** El número del día del mes de cada día de esta semana (lunes a domingo), según el calendario de quien mira. */
function numerosDeLaSemana(hoy = new Date()) {
  const lunes = new Date(hoy);
  lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => { const d = new Date(lunes); d.setDate(lunes.getDate() + i); return d.getDate(); });
}

/** La fecha de cada día de esta semana (lunes a domingo). */
export function fechaDeLaSemana(posicion, hoy = new Date()) {
  const d = new Date(hoy);
  d.setHours(12, 0, 0, 0);
  d.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7) + posicion);
  return d;
}

/**
 * Un día de la tira. `puntos`: los colores de sus sesiones (hasta 3). `hecho`: todo lo de ese día terminado (palomita).
 * `empezada`: dejó una a medias (el punto lleva un anillo). `deshabilitado`: ese día no hay nada que abrir.
 */
export function BotonDeDia({ corto, numero, puesto = false, esHoy = false, puntos = [], hecho = false, empezada = false, deshabilitado = false, onClick, etiqueta }) {
  const color = puesto ? '#fff' : esHoy ? KP.blue : deshabilitado ? '#C2C7D0' : KP.ink;
  return (
    <button
      type="button" onClick={deshabilitado ? undefined : onClick} disabled={deshabilitado} aria-pressed={puesto} aria-label={etiqueta}
      className={deshabilitado ? undefined : 'kp-press'}
      style={{
        flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '9px 0 8px', borderRadius: 16,
        border: 'none', fontFamily: FONT, touchAction: 'manipulation', cursor: deshabilitado ? 'default' : 'pointer',
        background: puesto ? UI.azul : 'transparent', color, boxShadow: puesto ? UI.azulSombra : esHoy ? `inset 0 0 0 2px ${KP.blue}` : 'none', /* estilo-ok: aro de «hoy» en la tira de días (pieza aprobada) */
      }}
    >
      <span style={{ fontSize: 12.5, fontWeight: 600, color: puesto ? 'rgba(255,255,255,0.85)' : esHoy ? KP.blue : deshabilitado ? '#C2C7D0' : KP.ink2 }}>{corto}</span>
      <span style={{ fontSize: 21, fontWeight: 800, lineHeight: 1.1, ...NUM_STYLE }}>{numero}</span>
      <span aria-hidden="true" style={{ display: 'flex', alignItems: 'center', gap: 3, height: 10 }}>
        {hecho
          ? <Check size={12} strokeWidth={3.5} color={puesto ? '#fff' : KP.mint} />
          : puntos.slice(0, 3).map((c, j) => (
            <i key={j} style={{ width: 5, height: 5, borderRadius: '50%', background: puesto ? '#fff' : (c || KP.ink), boxShadow: empezada && j === 0 && !puesto ? `0 0 0 2.5px ${KP.blue}44` : 'none' }} />
          ))}
      </span>
    </button>
  );
}

/** Los siete botones de una semana. `dias`: los de `weekOverview` (o su versión de equipo). `elegido`: la posición (0 = lunes) o null. */
function SieteDias({ dias, elegido, fecha, onElegir }) {
  const numeros = numerosDeLaSemana(fecha);
  return dias.map((d, i) => {
    const dice = d.hasSession ? `${d.sesiones} ${d.sesiones === 1 ? 'sesión' : 'sesiones'}${d.name ? `: ${d.name}` : ''}` : d.descanso ? 'descanso' : 'sin sesión';
    return (
      <BotonDeDia
        key={d.key} corto={d.key} numero={numeros[i]} puesto={i === elegido} esHoy={d.isToday}
        puntos={Array.from({ length: Math.min(d.sesiones || 0, 3) }, () => null)} onClick={() => onElegir?.(i)}
        etiqueta={`${LARGOS[d.key] ?? d.key} ${numeros[i]}${d.isToday ? ', hoy' : ''}: ${dice}`}
      />
    );
  });
}

/**
 * La tira de Home: cada día se toca (Andrés, 15 oct: «que cuando el atleta le pique vea su home de ese día») y la tarjeta azul enseña lo
 * de ese día. `dias`: los de `weekOverview` (o su versión de equipo). `elegido`: la posición (0 = lunes). `onElegir(posición)`.
 *
 * SE DESLIZA CON EL DEDO (Andrés, 16 oct 2026: «da la impresión de que se puede deslizar… el deslizamiento no acompaña el dedo»). Con
 * `semanas` ([{ fecha, dias }], esta semana primero) la tira es un carrusel: cada semana es una página del ancho de la tira y el
 * desplazamiento es el NATIVO del teléfono (sigue al dedo, con inercia y con el «imán» que la deja en una semana entera). Al quedarse quieta
 * en otra página avisa con `onSemana(n)`. `semana`: la que se mira (también la mueve desde fuera, p. ej. «Volver a hoy»).
 * Sin `semanas`, es la tira de siempre, de una sola semana.
 */
export default function TiraDeSemana({ dias = [], elegido, onElegir, semanas = null, semana = 0, onSemana }) {
  const caja = useRef(null);
  const quieta = useRef(null);
  const paginas = semanas?.length > 1 ? semanas : null;

  // Si la semana cambia desde fuera («Volver a hoy»), la tira va a ella.
  useEffect(() => {
    const el = caja.current;
    if (!el || !paginas) return;
    const destino = semana * el.clientWidth;
    if (Math.abs(el.scrollLeft - destino) > 2) el.scrollTo({ left: destino, behavior: 'smooth' });
  }, [semana, paginas]);

  if (!paginas) {
    return (
      <div role="group" aria-label="Tu semana" style={{ display: 'flex', gap: 4 }}>
        <SieteDias dias={dias} elegido={elegido} onElegir={onElegir} />
      </div>
    );
  }

  // Cuando deja de moverse, ¿en qué semana quedó?
  const alMover = () => {
    clearTimeout(quieta.current);
    quieta.current = setTimeout(() => {
      const el = caja.current;
      if (!el) return;
      const n = Math.round(el.scrollLeft / el.clientWidth);
      if (n !== semana) onSemana?.(n);
    }, 90);
  };

  return (
    <div
      ref={caja} onScroll={alMover} className="sin-barra" aria-label="Tus semanas"
      style={{
        display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory', overscrollBehaviorX: 'contain',
        WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none',
      }}
    >
      {paginas.map((p, n) => (
        <div
          key={n} role="group" aria-label={n === 0 ? 'Esta semana' : `Semana ${n + 1}`}
          style={{ flex: '0 0 100%', minWidth: 0, display: 'flex', gap: 4, scrollSnapAlign: 'start', scrollSnapStop: 'always' }}
        >
          <SieteDias dias={p.dias} elegido={n === semana ? elegido : null} fecha={p.fecha} onElegir={(i) => { if (n !== semana) onSemana?.(n); onElegir?.(i); }} />
        </div>
      ))}
    </div>
  );
}
