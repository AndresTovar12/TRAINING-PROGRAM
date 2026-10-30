import { Fragment, useState } from 'react';
import { Check, ChevronDown, ChevronRight, ChevronUp, Moon, Pause, Play } from 'lucide-react';
import { FONT, NUM_STYLE, UI } from '@/lib/theme';
import { NombreDeSesion } from '@/features/training/home/TextoDelNombre';
import { pegaSeparadores } from '@/features/training/home/nombreDeSesion';
import { aspectoDelTipo } from '@/lib/aspectoDelTipo';
import { etiquetaDePrograma } from '@/lib/programas';

/**
 * La tarjeta azul «Hoy te toca» de Home (reestructura visual, 15 oct 2026). Sustituye al «cartel» del 9 oct
 * (`TarjetaDeHoy`): mismo trabajo, la forma de las capturas de Andrés.
 *
 *   · Hoy no lleva franja de arriba (30 oct 2026, ejemplo de Andrés: menos datos; la fecha ya la dice el saludo). Solo al ver OTRO día de la tira
 *     sale «● El viernes 23 te toca» con su fecha.
 *   · Cada sesión en su renglón: el ícono de su tipo en un cuadro, el nombre grande y debajo «● Tipo · 60 min» (sin cuántos ejercicios: 30 oct 2026).
 *   · Abajo «Empezar» (blanco). Ya no hay «Cambiar día» (16 oct 2026): el plan se mueve desde «Vas en», y una sesión de otro día se suma con «Agregar a hoy».
 *
 * EL NOMBRE MANDA (24 oct 2026; Andrés: «nunca puede salir mal el nombre ni esa card», con 1 o con 10 workouts y con cualquier largo). Por eso:
 *   · el nombre ocupa SIEMPRE todo el ancho de su columna: el botón de acción va en su propio renglón (o en la franja de arriba), nunca a su lado;
 *   · la letra se achica sola y el nombre se corta con «…» a las 3 líneas (ver `nombreDeSesion.js` y `TextoDelNombre.jsx` y `.nombre-texto` en `index.css`); una palabra solo se
 *     parte a media letra si ni con la letra mínima cabe;
 *   · se ven 3 sesiones; las demás quedan tras «+N más» (se despliegan sin salir de la tarjeta, cada una con su botón).
 * Candado: `npm run prueba:tarjeta-hoy`.
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
  // Sin `etiqueta` (la tarjeta de hoy) no hay franja de arriba: ni la pastilla ni la fecha.
  return (
    <article style={{
      position: 'relative', overflow: 'hidden', borderRadius: 26, padding: '18px 18px 18px', color: '#fff', fontFamily: FONT,
      background: `radial-gradient(circle at 70% 18%, rgba(160,120,255,0.38), transparent 46%), ${UI.azul}`, boxShadow: UI.azulSombra, ...estilo,
    }}
    >
      {/* Con letra grande del sistema o «El miércoles 23 te tocan tres» la etiqueta y la fecha no caben en un renglón: la fecha baja, no se encima. */}
      {etiqueta && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px 10px' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0, maxWidth: '100%', padding: '7px 13px', borderRadius: 999, background: 'rgba(255,255,255,0.14)', fontSize: 14, fontWeight: 700, lineHeight: 1.25 }}>
          <i aria-hidden="true" style={{ width: 9, height: 9, borderRadius: '50%', background: punto, flexShrink: 0 }} /><span className="texto-largo">{etiqueta}</span>
        </span>
        <span style={{ fontSize: 14, fontWeight: 600, opacity: 0.82, marginLeft: 'auto' }}>{textoDeFecha(fecha)}</span>
      </div>}
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

/**
 * «● Neural · 4 ejercicios · 60 min»: el punto va del color del tipo. Cada pedazo corto («4 ejercicios») es una unidad que no se parte; el punto viaja pegado
 * a la primera unidad y el «·» a la última de su pedazo, así ningún renglón empieza con «·» ni se queda con el punto solo.
 */
function Meta({ color, partes }) {
  if (!partes.length) return null;
  const unidades = partes.flatMap((parte, i) => {
    const texto = String(parte);
    const separador = i < partes.length - 1 ? ' ·' : '';
    if (texto.length <= 20) return [texto + separador];
    const palabras = texto.split(/\s+/);
    return palabras.map((w, j) => w + (j === palabras.length - 1 ? separador : ''));
  });
  return (
    <span className="texto-largo" style={{ display: 'block', fontSize: 14, fontWeight: 600, lineHeight: 1.4, opacity: 0.88, marginTop: 3, ...NUM_STYLE }}>
      {unidades.map((u, i) => (
        <Fragment key={i}>
          {i > 0 && ' '}
          <span style={{ whiteSpace: u.length <= 24 ? 'nowrap' : 'normal' }}>
            {i === 0 && color && <i aria-hidden="true" style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: color, marginRight: 6, verticalAlign: 'middle' }} />}
            {u}
          </span>
        </Fragment>
      ))}
    </span>
  );
}

export const botonBlanco = {
  flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 54, borderRadius: 18, border: 'none',
  background: '#fff', color: '#1E40E0', fontFamily: FONT, fontSize: 17, fontWeight: 800, cursor: 'pointer', boxShadow: '0 10px 22px rgba(4,12,70,0.28)',
};

/** Cuántas sesiones se ven de entrada; las demás esperan tras «+N más». Con más, la tarjeta crecería sin tope. */
const VISIBLES = 3;

/** El renglón «+N más» / «Ver menos»: despliega o pliega las sesiones que no caben sin salir de la tarjeta. */
function BotonDeMas({ abierta, faltan, onClick }) {
  return (
    <button
      type="button" className="kp-press" onClick={onClick} aria-expanded={abierta}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', minHeight: 44, borderRadius: 16, border: 'none',
        background: 'rgba(255,255,255,0.14)', color: '#fff', fontFamily: FONT, fontSize: 15, fontWeight: 700, cursor: 'pointer',
      }}
    >
      {abierta ? <>Ver menos <ChevronUp size={18} aria-hidden="true" /></> : <>+{faltan} más <ChevronDown size={18} aria-hidden="true" /></>}
    </button>
  );
}

/** Una raya fina entre sesiones. */
const Raya = () => <i aria-hidden="true" style={{ display: 'block', height: 1, background: 'rgba(255,255,255,0.16)' }} />;

/**
 * Un programa. `sesiones`: [{ day, nombre, meta: ['Neural', '4 ejercicios', '60 min'] }] (una o las dos de un día con
 * mañana y tarde, o las que sean). `completada`: el día ya está hecho («Empezar» pasa a «Ver detalle»).
 *
 * Cada sesión: [ícono + nombre + meta] en una fila y, DEBAJO, su botón de ancho completo. El nombre nunca comparte renglón con un botón.
 */
export function HoyTeToca({ sesiones, completada = false, enMarcha = false, onAbrir, cuando, estilo }) {
  const [abierta, setAbierta] = useState(false);
  // Con dos sesiones el día, cada una lleva SU botón y su estado: la de la mañana puede estar terminada y la de la tarde sin empezar.
  const cadaUna = sesiones.length > 1 && sesiones.every((s) => typeof s.onAbrir === 'function');
  const todas = cadaUna ? sesiones.every((s) => s.hecha) : completada;
  const visibles = abierta ? sesiones : sesiones.slice(0, VISIBLES);
  const faltan = sesiones.length - VISIBLES;
  // Cuantas más se ven, más chica la letra y menos líneas por nombre (1 sesión: 28 px y 3 líneas; 2: un tramo menos; 3 o más: dos tramos y 2 líneas).
  const bajar = visibles.length >= 3 ? 2 : visibles.length > 1 ? 1 : 0;
  const lineas = visibles.length >= 3 ? 2 : 3;
  const verbo = (hecha, curso) => (hecha ? 'Ver detalle' : curso ? 'Seguir' : 'Empezar');
  const textoDe = (hecha, curso) => (hecha ? <>Ver detalle <ChevronRight size={19} aria-hidden="true" /></> : <><Play size={18} fill="currentColor" aria-hidden="true" />{curso ? 'Seguir' : 'Empezar'}</>);
  const nombres = sesiones.map((s) => s.nombre ?? '').filter(Boolean).join(', ');
  const otroDia = cuando?.hoy === false;
  return (
    <Marco etiqueta={otroDia ? etiquetaDeHoy(sesiones.length, todas, cuando) : null} punto={todas ? '#7CF0C5' : '#FFB547'} fecha={cuando?.fecha} estilo={estilo}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: otroDia ? 18 : 0 }}>
        {visibles.map((s, i) => (
          <Fragment key={i}>
            {i > 0 && <Raya />}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
                <IconoDeSesion day={s.day} hecha={cadaUna ? s.hecha : completada} chico={visibles.length > 1} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <NombreDeSesion texto={s.nombre} desde={bajar} lineas={lineas} />
                  <Meta color={aspectoDelTipo(s.day).color} partes={s.meta ?? []} />
                </div>
              </div>
              {cadaUna && (
                <button
                  type="button" className="kp-press" onClick={s.onAbrir} aria-label={`${verbo(s.hecha, s.enMarcha)}: ${s.nombre ?? ''}`} title={s.nombre}
                  style={{ ...botonBlanco, flex: '0 0 auto', width: '100%', minHeight: 46, fontSize: 15 }}
                >
                  {textoDe(s.hecha, s.enMarcha)}
                </button>
              )}
            </div>
          </Fragment>
        ))}
        {faltan > 0 && <BotonDeMas abierta={abierta} faltan={faltan} onClick={() => setAbierta((a) => !a)} />}
      </div>
      {!cadaUna && (
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button type="button" className="kp-press" onClick={onAbrir} aria-label={nombres ? `${verbo(completada, enMarcha)}: ${nombres}` : undefined} title={nombres || undefined} style={botonBlanco}>
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
 *
 * Cada fila es un botón entero. Arriba una franja con [ícono · quién la puso · el play redondo] y DEBAJO el nombre con todo el ancho de la fila:
 * antes el nombre compartía renglón con el ícono y el play y quedaba en una columna de ~110 px.
 */
export function HoyTeTocaEquipo({ entradas, onAbrir, conAutor = true, cuando, estilo }) {
  const [abierta, setAbierta] = useState(false);
  const filas = entradas.flatMap((e) => e.partes.map((p) => ({ e, p })));
  const todas = filas.length > 0 && filas.every(({ p }) => p.hecha);
  const visibles = abierta ? filas : filas.slice(0, VISIBLES);
  const faltan = filas.length - VISIBLES;
  const otroDia = cuando?.hoy === false;
  return (
    <Marco etiqueta={otroDia ? etiquetaDeHoy(filas.length, todas, cuando) : null} punto={todas ? '#7CF0C5' : '#FFB547'} fecha={cuando?.fecha} estilo={estilo}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: otroDia ? 16 : 0 }}>
        {visibles.map(({ e, p }) => {
          const meta = [p.minutos || null].filter(Boolean);
          const autor = conAutor ? etiquetaDePrograma(e.programa) : null;
          return (
            <button
              key={`${e.programa.id}-${e.dayIdx}-${p.bloque ?? 'dia'}`} type="button" onClick={() => onAbrir(e)} className="kp-press"
              aria-label={`${autor ? `${autor}: ` : ''}${p.nombre ?? ''}. ${p.hecha ? 'Terminada' : 'Empezar'}`} title={p.nombre}
              style={{
                display: 'flex', flexDirection: 'column', gap: 8, width: '100%', minWidth: 0, textAlign: 'left', padding: 12, borderRadius: 20, cursor: 'pointer',
                background: 'rgba(255,255,255,0.14)', border: 'none', color: '#fff', fontFamily: FONT,
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', minWidth: 0 }}>
                <IconoDeSesion day={e.day} hecha={p.hecha} chico />
                <span style={{ flex: 1, minWidth: 0 }}>
                  {autor && (
                    <span className="texto-corto" style={{ fontSize: 12.5, fontWeight: 700, lineHeight: 1.3, opacity: 0.9 }}>
                      <i aria-hidden="true" style={{ display: 'inline-block', width: 8, height: 8, marginRight: 6, borderRadius: '50%', verticalAlign: 'middle', background: e.programa.color ?? '#fff' }} />{autor}
                    </span>
                  )}
                </span>
                <span aria-hidden="true" style={{
                  width: 44, height: 44, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center',
                  background: p.hecha ? 'rgba(124,240,197,0.18)' : '#fff', color: p.hecha ? '#7CF0C5' : '#1E40E0',
                }}
                >
                  {p.hecha ? <Check size={20} strokeWidth={3} /> : <Play size={17} fill="currentColor" style={{ marginLeft: 2 }} />}
                </span>
              </span>
              <span style={{ display: 'block', width: '100%', minWidth: 0 }}>
                <NombreDeSesion texto={p.nombre} en="span" tamanos={[21, 19, 18, 17]} umbrales={[24, 44, 70]} desde={visibles.length >= 3 ? 1 : 0} lineas={visibles.length >= 3 ? 2 : 3} />
                <Meta color={null} partes={meta} />
              </span>
            </button>
          );
        })}
        {faltan > 0 && <BotonDeMas abierta={abierta} faltan={faltan} onClick={() => setAbierta((a) => !a)} />}
      </div>
    </Marco>
  );
}

/** El título de las tarjetas en calma (descanso, pausa): mismos tramos que el nombre, un poco más chico. */
const TITULO_EN_CALMA = { tamanos: [26, 22, 19, 17], umbrales: [20, 34, 52] };

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
        <div style={{ flex: 1, minWidth: 0 }}>
          <NombreDeSesion texto={titulo} {...TITULO_EN_CALMA} />
          {(siguiente ?? vacia) && <span className="texto-largo" style={{ display: 'block', fontSize: 14, fontWeight: 600, lineHeight: 1.4, opacity: 0.85, marginTop: 3 }}>{pegaSeparadores(siguiente ?? vacia)}</span>}
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
        <div style={{ flex: 1, minWidth: 0 }}>
          <NombreDeSesion texto={etiqueta ? `${etiqueta}: en pausa` : 'Tu plan está en pausa'} {...TITULO_EN_CALMA} />
          <span className="texto-largo" style={{ display: 'block', fontSize: 14, fontWeight: 600, lineHeight: 1.4, opacity: 0.85, marginTop: 3 }}>Te espera {pegaSeparadores(texto)}</span>
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
