import { ArrowRight, CalendarDays, Check, Moon, Play } from 'lucide-react';

/**
 * La tarjeta «Hoy te toca» de Home: el cartel.
 *
 * Andrés, 9 oct 2026 (PDF «Arreglar widget feo»): la tarjeta azul «está muy feo… es de los más importantes… se ve
 * super opacado por el de salud… uno parece hecho por un profesional y el otro por un amateur». Se enseñaron tres
 * ideas en una maqueta (`docs/maquetas/2026-10-09-hoy-te-toca.html`) y eligió «C · Cartel»:
 *
 *   · El ícono del TIPO de sesión (el mismo de las tarjetas del día) brilla en un disco, y su color tiñe el resplandor
 *     de la tarjeta. Con dos sesiones, un disco por cada una.
 *   · El nombre va en grande, de un vistazo. Debajo, cuántos ejercicios y cuánto dura.
 *   · UN solo botón protagonista: el play redondo. «Cambiar día» queda aparte, chico y a la izquierda.
 *   · En un celular ocupa todo el ancho (antes compartía la fila con la foto y le tocaba media pantalla: el nombre se
 *     partía en tres renglones); la foto baja a una banda.
 *
 * Los estilos viven en `index.css` (`.tl-hoy-*`): necesitan container queries y pseudo-elementos. El tamaño lo decide
 * el ancho de la tarjeta, no el de la pantalla.
 */

const ES_HEX = /^#[0-9a-f]{6}$/i;
const rgba = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

// Dónde cae el halo de cada sesión (x e y en %) y qué tan fuerte y ancho es, según cuántas sesiones hay.
const HALOS = {
  1: { puntos: [[74, 30]], alfa: 0.62, radio: 52 },
  2: { puntos: [[64, 30], [92, 38]], alfa: 0.5, radio: 45 },
  3: { puntos: [[54, 30], [76, 38], [98, 30]], alfa: 0.42, radio: 40 },
};

/**
 * El resplandor de detrás: un halo por sesión (hasta tres) con el color de su tipo, y abajo a la izquierda una luz azul
 * clara que le da profundidad. Un color propio que no sea #RRGGBB no se puede aclarar: ese halo se omite, y si no queda
 * ninguno sale uno blanco tenue.
 */
function brilloDelCartel(colores) {
  const hex = colores.filter((c) => ES_HEX.test(c || '')).slice(0, 3);
  const luz = 'radial-gradient(circle at 8% 110%, rgba(110, 140, 255, 0.38), transparent 50%)';
  if (hex.length === 0) return `radial-gradient(circle at 74% 30%, rgba(255, 255, 255, 0.22), transparent 52%), ${luz}`;
  const { puntos, alfa, radio } = HALOS[hex.length];
  return [...hex.map((c, i) => `radial-gradient(circle at ${puntos[i][0]}% ${puntos[i][1]}%, ${rgba(c, alfa)}, transparent ${radio}%)`), luz].join(', ');
}

/**
 * El cartel vacío: el fondo, el resplandor y la píldora de arriba («● Hoy te toca»). Lo comparten la tarjeta de
 * siempre y la del equipo. `onClick`: con él toda la tarjeta abre algo; sin él, la tarjeta es solo un marco.
 */
export function CartelDeHoy({ colores = [], etiqueta, onClick, style, children }) {
  const principal = colores.find((c) => ES_HEX.test(c || '')) ?? '#fff';
  return (
    <div className="tl-hoy-w" style={style}>
      <article
        className={`tl-hoy${onClick ? '' : ' fija'}`} onClick={onClick}
        style={{ '--tc': principal, '--glow': brilloDelCartel(colores) }}
      >
        <span className="tl-hoy-brillo" aria-hidden="true" />
        <div className="tl-hoy-grid">
          <div className="tl-hoy-cab"><i aria-hidden="true" />{etiqueta}</div>
          {children}
        </div>
      </article>
    </div>
  );
}

/**
 * `sesiones`: [{ nombre, aspecto }], una por sesión de hoy (`aspecto` es el de `aspectoDelTipo`). `meta`: los datos de
 * abajo, [{ Icono?, texto }]. `completada`: el día ya está hecho (el play pasa a ser una flecha: «Ver detalle»).
 * `onCambiarDia`: sin él no sale el botón (en una rutina que se repite el día lo decide el calendario, no un puntero).
 * `style`: el lugar que ocupa en la fila (`flex`, ancho…).
 */
export function TarjetaDeHoy({ sesiones, completada = false, meta = [], onAbrir, onCambiarDia, style }) {
  const varios = sesiones.length > 1;
  const sinPropagar = (fn) => (e) => { e.stopPropagation(); fn(); };
  return (
    <CartelDeHoy
      colores={sesiones.map((s) => s.aspecto.color)} etiqueta={completada ? 'Completada' : 'Hoy te toca'} onClick={onAbrir} style={style}
    >
      <div className="tl-hoy-escena">
        <div className={`tl-hoy-discos${varios ? ' varios' : ''}`}>
          {sesiones.slice(0, 3).map((s, i) => {
            const { Icono } = s.aspecto;
            return (
              <span key={i} className={`tl-hoy-disco${completada ? ' ok' : ''}`} aria-hidden="true">
                {completada ? <Check /> : <Icono />}
              </span>
            );
          })}
        </div>
      </div>

      <div>
        {varios ? (
          <ul className="tl-hoy-ses">{sesiones.map((s, i) => <li key={i}>{s.nombre}</li>)}</ul>
        ) : (
          <h3 className="tl-hoy-tit">{sesiones[0].nombre}</h3>
        )}
        {meta.length > 0 && (
          <div className="tl-hoy-meta">
            {meta.map(({ Icono, texto }) => <span key={texto}>{Icono && <Icono aria-hidden="true" />}{texto}</span>)}
          </div>
        )}
      </div>

      <div className="tl-hoy-abajo">
        {onCambiarDia ? (
          <button type="button" className="tl-hoy-ghost" aria-label="Cambiar día" onClick={sinPropagar(onCambiarDia)}>
            <CalendarDays aria-hidden="true" /><span>Cambiar día</span>
          </button>
        ) : <span />}
        <button
          type="button" className={`tl-hoy-big${completada ? ' ver' : ''}`} aria-label={completada ? 'Ver detalle' : 'Empezar sesión'}
          onClick={sinPropagar(onAbrir)}
        >
          <span className="tl-hoy-play">{completada ? <ArrowRight aria-hidden="true" /> : <Play aria-hidden="true" />}</span>
        </button>
      </div>
    </CartelDeHoy>
  );
}

/**
 * Hoy no entrena: la misma plaza, en calma. Blanca, con una luna y lo que sigue. Antes esta tarjeta era un bloque de
 * texto con un botón; ahora tiene la presencia de la azul pero no compite con ella (nada que empezar).
 * `siguiente`: «Sigue: viernes · Lower Strength», o null si en la semana ya no hay nada (entonces sale `vacia`).
 */
export function TarjetaDeDescanso({ titulo, siguiente, vacia, boton, onVerPlan, style }) {
  return (
    <div className="tl-hoy-w" style={style}>
      <article className="tl-descanso">
        <div className="tl-descanso-cab">
          <span className="tl-descanso-luna" aria-hidden="true"><Moon /></span>
          <h3>{titulo}</h3>
        </div>
        {siguiente
          ? <span className="tl-descanso-sig"><CalendarDays aria-hidden="true" />{siguiente}</span>
          : <p className="tl-descanso-vacia">{vacia}</p>}
        <button type="button" className="tl-descanso-ver" onClick={onVerPlan}>
          {boton}<ArrowRight aria-hidden="true" />
        </button>
      </article>
    </div>
  );
}
