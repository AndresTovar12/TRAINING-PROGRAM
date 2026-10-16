import { useRef } from 'react';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
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

/**
 * La tira de Home: cada día se toca (Andrés, 15 oct: «que cuando el atleta le pique vea su home de ese día») y la tarjeta azul enseña lo
 * de ese día. `dias`: los de `weekOverview` (o su versión de equipo). `elegido`: la posición (0 = lunes). `onElegir(posición)`.
 *
 * SE DESLIZA (Andrés, 16 oct 2026: «da la impresión de que se puede deslizar, y no funciona»): con `onDeslizar(+1 | -1)` un dedo hacia la
 * izquierda pide la semana que viene y hacia la derecha la anterior. `fecha`: un día de la semana que se enseña (por defecto, esta).
 * `animar`: de qué lado entra la semana nueva (1 = desde la derecha, -1 = desde la izquierda, 0 = sin animación).
 */
export default function TiraDeSemana({ dias = [], elegido, onElegir, onDeslizar, fecha, animar = 0 }) {
  const numeros = numerosDeLaSemana(fecha);
  const dedo = useRef(null);
  const alTocar = (e) => { const t = e.touches[0]; dedo.current = { x: t.clientX, y: t.clientY }; };
  const alSoltar = (e) => {
    const ini = dedo.current; dedo.current = null;
    if (!ini || !onDeslizar) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - ini.x; const dy = t.clientY - ini.y;
    // Un deslizón claro y más horizontal que vertical: así el scroll de la pantalla y un toque normal no lo disparan.
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.5) onDeslizar(dx < 0 ? 1 : -1);
  };
  return (
    <div
      role="group" aria-label="Tu semana" className={animar > 0 ? 'tl-entra-der' : animar < 0 ? 'tl-entra-izq' : undefined}
      key={fecha ? fecha.toDateString() : 'hoy'}
      onTouchStart={onDeslizar ? alTocar : undefined} onTouchEnd={onDeslizar ? alSoltar : undefined}
      style={{ display: 'flex', gap: 4, touchAction: 'pan-y' }}
    >
      {dias.map((d, i) => {
        const dice = d.hasSession ? `${d.sesiones} ${d.sesiones === 1 ? 'sesión' : 'sesiones'}${d.name ? `: ${d.name}` : ''}` : d.descanso ? 'descanso' : 'sin sesión';
        return (
          <BotonDeDia
            key={d.key} corto={d.key} numero={numeros[i]} puesto={i === elegido} esHoy={d.isToday}
            puntos={Array.from({ length: Math.min(d.sesiones || 0, 3) }, () => null)} onClick={() => onElegir?.(i)}
            etiqueta={`${LARGOS[d.key] ?? d.key} ${numeros[i]}${d.isToday ? ', hoy' : ''}: ${dice}`}
          />
        );
      })}
    </div>
  );
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/**
 * El renglón de arriba de la tira cuando el plan tiene más semanas por delante: «‹  La semana que viene · Fase 4 · Sem 3  ›».
 * Dice qué semana se está mirando (la tira por sí sola no lo dice) y deja pasar de semana con un toque, no solo con el dedo.
 * `semana`: 0 = esta, 1 = la que viene… `hasta`: la última a la que se puede llegar. `donde`: dónde cae el plan esa semana.
 */
export function EtiquetaDeSemana({ semana, hasta, fecha, donde, onIr }) {
  const lunes = fechaDeLaSemana(0, fecha ?? new Date());
  const domingo = fechaDeLaSemana(6, fecha ?? new Date());
  const rango = `${lunes.getDate()} ${MESES[lunes.getMonth()]} – ${domingo.getDate()} ${MESES[domingo.getMonth()]}`;
  const nombre = semana === 0 ? 'Esta semana' : semana === 1 ? 'La semana que viene' : `Dentro de ${semana} semanas`;
  const flecha = (activa, Icono, etiqueta, a) => (
    <button
      type="button" onClick={activa ? () => onIr(a) : undefined} disabled={!activa} aria-label={etiqueta} className={activa ? 'kp-press' : undefined}
      style={{
        width: 34, height: 34, borderRadius: 12, border: 'none', display: 'grid', placeItems: 'center', flexShrink: 0, fontFamily: FONT,
        background: activa ? UI.relleno : 'transparent', color: activa ? KP.ink : '#C2C7D0', cursor: activa ? 'pointer' : 'default',
      }}
    >
      <Icono size={19} strokeWidth={2.4} />
    </button>
  );
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: FONT }}>
      {flecha(semana > 0, ChevronLeft, 'Semana anterior', semana - 1)}
      <div style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: KP.ink }}>{nombre}</div>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: KP.ink2, marginTop: 1 }}>{[rango, semana > 0 ? donde : null].filter(Boolean).join(' · ')}</div>
      </div>
      {flecha(semana < hasta, ChevronRight, 'Semana siguiente', semana + 1)}
    </div>
  );
}
