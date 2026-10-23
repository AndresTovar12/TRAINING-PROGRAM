import { Check, ChevronRight, Moon, Pause, Play } from 'lucide-react';
import { FONT, NUM_STYLE, UI } from '@/lib/theme';
import { aspectoDelTipo } from '@/lib/aspectoDelTipo';
import { etiquetaDePrograma } from '@/lib/programas';

/**
 * La tarjeta azul «Hoy te toca» de Home (reestructura visual, 15 oct 2026). Sustituye al «cartel» del 9 oct
 * (`TarjetaDeHoy`): mismo trabajo, la forma de las capturas de Andrés.
 *
 *   · Arriba: «● Hoy te toca» (o «Hoy te tocan dos», «Completada») y la fecha.
 *   · Cada sesión en su renglón: el ícono de su tipo en un cuadro, el nombre grande y debajo «● Tipo · 4 ejercicios · 60 min».
 *   · Abajo «Empezar» (blanco). Ya no hay «Cambiar día» (16 oct 2026): el plan se mueve desde «Vas en», y una sesión de otro día se suma con «Agregar a hoy».
 *
 * Variantes en este archivo: la de un solo programa (`HoyTeToca`), la de un equipo de profesionales
 * (`HoyTeTocaEquipo`: cada sesión abre la suya y dice de quién es), el día sin sesión (`HoyDescansas`) y el plan en pausa (`HoyEnPausa`).
 */

const NUMEROS = ['', 'una', 'dos', 'tres', 'cuatro'];
/* `cuando`: qué día enseña la tarjeta. Por defecto hoy; al tocar otro día en la tira de la semana, ese
   ({ fecha: Date, hoy: false }) y se dice «El viernes te toca». */
const etiquetaDeHoy = (n, hechas, cuando) => {
  if (hechas) return n > 1 ? 'Completadas' : 'Completada';
  // Otro día: «El viernes 23», con el número, porque en la semana que viene también hay un viernes.
  const quien = cuando?.hoy === false ? `El ${cuando.fecha.toLocaleDateString('es-MX', { weekday: 'long' })} ${cuando.fecha.getDate()}` : 'Hoy';
  return n > 1 ? `${quien} te tocan ${NUMEROS[n] ?? n}` : `${quien} te toca`;
};

function textoDeFecha(fecha = new Date()) {
  const t = fecha.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric' });
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** El marco azul de la tarjeta de hoy (también lo usa «Entrenar» de quien no tiene plan, `HeroDeEntrenar`). */
export function Marco({ etiqueta, punto = '#FFB547', fecha, children, estilo }) {
  return (
    <article style={{
      position: 'relative', overflow: 'hidden', borderRadius: 26, padding: '18px 18px 18px', color: '#fff', fontFamily: FONT,
      background: `radial-gradient(circle at 70% 18%, rgba(160,120,255,0.38), transparent 46%), ${UI.azul}`, boxShadow: UI.azulSombra, ...estilo,
    }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 13px', borderRadius: 999, background: 'rgba(255,255,255,0.14)', fontSize: 14, fontWeight: 700 }}>
          <i aria-hidden="true" style={{ width: 9, height: 9, borderRadius: '50%', background: punto }} />{etiqueta}
        </span>
        <span style={{ fontSize: 14, fontWeight: 600, opacity: 0.82 }}>{textoDeFecha(fecha)}</span>
      </div>
      {children}
    </article>
  );
}

/** El cuadro con el ícono del tipo de sesión, en su color. Hecha: una palomita verde. */
function IconoDeSesion({ day, hecha = false, chico = false }) {
  const { Icono, color } = aspectoDelTipo(day);
  const lado = chico ? 46 : 58;
  return (
    <span aria-hidden="true" style={{
      width: lado, height: lado, borderRadius: chico ? 14 : 18, flexShrink: 0, display: 'grid', placeItems: 'center',
      background: 'rgba(255,255,255,0.14)', border: 'none', color: hecha ? '#7CF0C5' : (color || '#fff'),
    }}
    >
      {hecha ? <Check size={chico ? 22 : 26} strokeWidth={2.6} /> : <Icono size={chico ? 22 : 26} strokeWidth={1.9} />}
    </span>
  );
}

/** «● Neural · 4 ejercicios · 60 min»: el punto va del color del tipo. */
function Meta({ color, partes }) {
  if (!partes.length) return null;
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 14, fontWeight: 600, opacity: 0.88, marginTop: 3, ...NUM_STYLE }}>
      {color && <i aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />}
      {partes.join(' · ')}
    </span>
  );
}

export const botonBlanco = {
  flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 54, borderRadius: 18, border: 'none',
  background: '#fff', color: '#1E40E0', fontFamily: FONT, fontSize: 17, fontWeight: 800, cursor: 'pointer', boxShadow: '0 10px 22px rgba(4,12,70,0.28)',
};

/**
 * Un programa. `sesiones`: [{ day, nombre, meta: ['Neural', '4 ejercicios', '60 min'] }] (una o las dos de un día con
 * mañana y tarde). `completada`: el día ya está hecho («Empezar» pasa a «Ver detalle»).
 */
export function HoyTeToca({ sesiones, completada = false, enMarcha = false, onAbrir, cuando, estilo }) {
  // Con dos sesiones el día, cada una lleva SU botón y su estado: la de la mañana puede estar terminada y la de la tarde sin empezar.
  const cadaUna = sesiones.length > 1 && sesiones.every((s) => typeof s.onAbrir === 'function');
  const todas = cadaUna ? sesiones.every((s) => s.hecha) : completada;
  const textoDe = (hecha, curso) => (hecha ? <>Ver detalle <ChevronRight size={19} aria-hidden="true" /></> : <><Play size={18} fill="currentColor" aria-hidden="true" />{curso ? 'Seguir' : 'Empezar'}</>);
  return (
    <Marco etiqueta={etiquetaDeHoy(sesiones.length, todas, cuando)} punto={todas ? '#7CF0C5' : '#FFB547'} fecha={cuando?.fecha} estilo={estilo}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 18 }}>
        {sesiones.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0, flexWrap: cadaUna ? 'wrap' : 'nowrap' }}>
            <IconoDeSesion day={s.day} hecha={cadaUna ? s.hecha : completada} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <h3 style={{ margin: 0, fontSize: sesiones.length > 1 ? 24 : 28, fontWeight: 800, letterSpacing: -0.5, lineHeight: 1.12, overflowWrap: 'anywhere' }}>{s.nombre}</h3>
              <Meta color={aspectoDelTipo(s.day).color} partes={s.meta ?? []} />
            </div>
            {cadaUna && (
              <button type="button" className="kp-press" onClick={s.onAbrir} style={{ ...botonBlanco, flex: '0 0 auto', minHeight: 46, padding: '0 16px', fontSize: 15 }}>
                {textoDe(s.hecha, s.enMarcha)}
              </button>
            )}
          </div>
        ))}
      </div>
      {!cadaUna && (
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button type="button" className="kp-press" onClick={onAbrir} style={botonBlanco}>
            {textoDe(completada, enMarcha)}
          </button>
        </div>
      )}
    </Marco>
  );
}

/**
 * Con equipo (coach, fisio…): lo de hoy de todos en UNA tarjeta, y cada sesión abre la suya. Va con el nombre de
 * quien la puso (Andrés, 1 oct 2026: «el programa es un todo; la autoría es etiqueta»).
 * `entradas`: las de `entradasDeHoy` ({ programa, day, dayIdx, partes: [{ nombre, ejercicios, minutos, hecha }] }).
 */
export function HoyTeTocaEquipo({ entradas, onAbrir, conAutor = true, cuando, estilo }) {
  const filas = entradas.flatMap((e) => e.partes.map((p) => ({ e, p })));
  const todas = filas.length > 0 && filas.every(({ p }) => p.hecha);
  return (
    <Marco etiqueta={etiquetaDeHoy(filas.length, todas, cuando)} punto={todas ? '#7CF0C5' : '#FFB547'} fecha={cuando?.fecha} estilo={estilo}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
        {filas.map(({ e, p }) => {
          const meta = [p.ejercicios ? `${p.ejercicios} ${p.ejercicios === 1 ? 'ejercicio' : 'ejercicios'}` : null, p.minutos || null].filter(Boolean);
          return (
            <button
              key={`${e.programa.id}-${e.dayIdx}-${p.bloque ?? 'dia'}`} type="button" onClick={() => onAbrir(e)} className="kp-press"
              style={{
                display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', padding: 12, borderRadius: 20, cursor: 'pointer',
                background: 'rgba(255,255,255,0.14)', border: 'none', color: '#fff', fontFamily: FONT,
              }}
            >
              <IconoDeSesion day={e.day} hecha={p.hecha} chico />
              <span style={{ flex: 1, minWidth: 0 }}>
                {conAutor && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, opacity: 0.9 }}>
                    <i aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: e.programa.color ?? '#fff' }} />{etiquetaDePrograma(e.programa)}
                  </span>
                )}
                <span style={{ display: 'block', fontSize: 19, fontWeight: 800, lineHeight: 1.2, overflowWrap: 'anywhere' }}>{p.nombre}</span>
                <Meta color={null} partes={meta} />
              </span>
              <span aria-label={p.hecha ? 'Terminada' : 'Empezar'} style={{
                width: 44, height: 44, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center',
                background: p.hecha ? 'rgba(124,240,197,0.18)' : '#fff', color: p.hecha ? '#7CF0C5' : '#1E40E0',
              }}
              >
                {p.hecha ? <Check size={20} strokeWidth={3} /> : <Play size={17} fill="currentColor" style={{ marginLeft: 2 }} />}
              </span>
            </button>
          );
        })}
      </div>
    </Marco>
  );
}

/**
 * Hoy no entrena: la misma tarjeta, en calma. Dice qué sigue y lleva a su plan.
 * `siguiente`: «Sigue: viernes · Lower Strength», o null (entonces sale `vacia`).
 */
export function HoyDescansas({ titulo, siguiente, vacia, boton, onVerPlan, cuando, estilo }) {
  return (
    <Marco etiqueta="Descanso" punto="#9DB4FF" fecha={cuando?.fecha} estilo={estilo}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 18 }}>
        <span aria-hidden="true" style={{ width: 58, height: 58, borderRadius: 18, display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,0.14)', border: 'none', flexShrink: 0 }}>
          <Moon size={26} />
        </span>
        <div style={{ minWidth: 0 }}>
          <h3 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: -0.5, lineHeight: 1.15 }}>{titulo}</h3>
          {(siguiente ?? vacia) && <span style={{ display: 'block', fontSize: 14, fontWeight: 600, opacity: 0.85, marginTop: 3 }}>{siguiente ?? vacia}</span>}
        </div>
      </div>
      <button type="button" className="kp-press" onClick={onVerPlan} style={{ ...botonBlanco, width: '100%', marginTop: 20 }}>
        {boton} <ChevronRight size={19} aria-hidden="true" />
      </button>
    </Marco>
  );
}

/**
 * El plan está en pausa (lo pausó el atleta o su coach): hoy no toca nada de él. Dice dónde se quedó y deja reanudar.
 * `onReanudar` va solo si quien mira puede (un coach que mira la app de su atleta no lo reanuda por él).
 */
export function HoyEnPausa({ texto, onReanudar, cuando, estilo, etiqueta }) {
  return (
    <Marco etiqueta="Plan en pausa" punto="#FFD27A" fecha={cuando?.fecha} estilo={estilo}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 18 }}>
        <span aria-hidden="true" style={{ width: 58, height: 58, borderRadius: 18, display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,0.14)', border: 'none', flexShrink: 0 }}>
          <Pause size={26} />
        </span>
        <div style={{ minWidth: 0 }}>
          <h3 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: -0.5, lineHeight: 1.15 }}>{etiqueta ? `${etiqueta}: en pausa` : 'Tu plan está en pausa'}</h3>
          <span style={{ display: 'block', fontSize: 14, fontWeight: 600, opacity: 0.85, marginTop: 3 }}>Te espera {texto}</span>
        </div>
      </div>
      {onReanudar && (
        <button type="button" className="kp-press" onClick={onReanudar} style={{ ...botonBlanco, width: '100%', marginTop: 20 }}>
          <Play size={18} fill="currentColor" aria-hidden="true" />Reanudar plan
        </button>
      )}
    </Marco>
  );
}
