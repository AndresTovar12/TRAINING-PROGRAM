import { ChevronRight, HeartPulse, Layers } from 'lucide-react';
import { FONT, NUM_STYLE } from '@/lib/theme';
import { separaFoto } from '@/lib/fotoConFoco';
import { NombreDeSesion } from '@/features/training/home/TextoDelNombre';
import { pegaSeparadores } from '@/features/training/home/nombreDeSesion';

/**
 * Los cuadros de Home (reestructura visual, 15 oct 2026): Salud, la fase, Entrenar libre y Stickers, de dos
 * en dos. Cada uno: arriba su ícono en un cuadrito y su nombre; abajo, grande, lo que hoy importa de él
 * («Recuperado», «Fuerza máxima», «2 entrenos», «1:12:40») y una línea debajo. Todo el cuadro se toca.
 *
 * Los colores son los de siempre en Home (coral para Salud, azules para el plan, tinta para los stickers).
 */
const TONOS = {
  coral: { /* estilo-ok: cuadros de color de Home (capturas aprobadas) */ fondo: 'linear-gradient(150deg, #FF8E5E 0%, #F2555A 55%, #DD4A92 100%)', sombra: 'rgba(221,74,146,0.28)' },
  cielo: { /* estilo-ok: cuadros de color de Home (capturas aprobadas) */ fondo: 'linear-gradient(160deg, #6AA8FF 0%, #3B7BF5 50%, #1E4FE0 100%)', sombra: 'rgba(30,79,224,0.28)' },
  azul: { /* estilo-ok: cuadros de color de Home (capturas aprobadas) */ fondo: 'linear-gradient(160deg, #2448E8 0%, #1733B8 55%, #0D1A66 100%)', sombra: 'rgba(14,30,120,0.32)' },
  violeta: { /* estilo-ok: el cuadrito de 1RM (ejemplo de Andrés, 30 oct 2026) */ fondo: 'linear-gradient(160deg, #A48BFF 0%, #7C5CFF 55%, #5A3DD8 100%)', sombra: 'rgba(90,61,216,0.26)' },
  tinta: { /* estilo-ok: cuadros de color de Home (capturas aprobadas) */ fondo: 'linear-gradient(165deg, #2B3263 0%, #171C3E 58%, #0B0E24 100%)', sombra: 'rgba(12,16,52,0.34)' },
};

/* EL NOMBRE MANDA (24 oct 2026): el título de un cuadro es a veces el nombre de un plan o de una fase, de cualquier largo, en una columna de ~105 px (320 px de
   pantalla, dos cuadros por renglón). Por eso la letra se achica sola según el ancho y la palabra más larga, y se corta a 3 líneas con «…» (ver
   `nombreDeSesion.js` y `TextoDelNombre.jsx`); la etiqueta y la línea de abajo se parten por palabras y nunca desbordan. Candado: `npm run prueba:tarjeta-hoy`. */
/* `accion` va abajo a la derecha, junto a lo grande (el play de «Entrenar libre»): arriba, en un cuadro de 165 px de ancho, no le dejaba
   lugar al nombre. */
export function Cuadro({ tono = 'azul', Icono, etiqueta, titulo, sub, onClick, accion, abajo, foto, etiquetaAccesible }) {
  const t = TONOS[tono] ?? TONOS.azul;
  const { url, x, y } = foto ? separaFoto(foto) : {};
  return (
    <button
      type="button" onClick={onClick} className="kp-press" aria-label={etiquetaAccesible ?? [etiqueta, titulo, sub].filter(Boolean).join('. ')}
      style={{
        position: 'relative', isolation: 'isolate', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        minHeight: 172, padding: 16, border: 'none', borderRadius: 24, textAlign: 'left', color: '#fff', cursor: 'pointer', fontFamily: FONT,
        background: t.fondo, boxShadow: `0 12px 26px ${t.sombra}`, touchAction: 'manipulation', minWidth: 0,
      }}
    >
      {url && (
        <>
          <img src={url} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: `${x}% ${y}%`, zIndex: -2 }} />
          <span aria-hidden="true" style={{ /* estilo-ok: velo para leer sobre la foto */ position: 'absolute', inset: 0, zIndex: -1, background: 'linear-gradient(180deg, rgba(8,14,50,0.45) 0%, rgba(8,14,50,0.15) 40%, rgba(8,14,50,0.82) 100%)' }} />
        </>
      )}
      {!url && <span aria-hidden="true" style={{ position: 'absolute', inset: 0, zIndex: -1, background: 'radial-gradient(circle at 85% 8%, rgba(255,255,255,0.24), transparent 48%)' }} />}
      <span style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
        <span aria-hidden="true" style={{ width: 40, height: 40, borderRadius: 13, display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,0.18)', flexShrink: 0 }}>
          <Icono size={20} />
        </span>
        <span className="texto-corto" title={typeof etiqueta === 'string' ? etiqueta : undefined} style={{ flex: 1, fontSize: 15, fontWeight: 600, lineHeight: 1.2 }}>{etiqueta}</span>
      </span>
      <span style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginTop: 18, width: '100%' }}>
        <span style={{ display: 'block', flex: 1, minWidth: 0 }}>
          <NombreDeSesion texto={titulo} en="span" tamanos={[21, 19, 17, 16]} umbrales={[12, 20, 32]} estilo={{ letterSpacing: -0.4, ...NUM_STYLE }} />
          {sub && <span className="texto-corto" title={typeof sub === 'string' ? sub : undefined} style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.3, opacity: 0.88, marginTop: 3 }}>{pegaSeparadores(sub)}</span>}
          {abajo}
        </span>
        {accion}
      </span>
    </button>
  );
}

/** El circulito blanco con el play, arriba a la derecha de «Entrenar libre». */
export function PlayChico({ Icono }) {
  return (
    <span aria-hidden="true" style={{ width: 40, height: 40, borderRadius: '50%', background: '#fff', color: '#1E40E0', display: 'grid', placeItems: 'center', flexShrink: 0, boxShadow: '0 6px 14px rgba(4,12,70,0.3)' }}>
      <Icono size={17} fill="currentColor" style={{ marginLeft: 2 }} />
    </span>
  );
}

const NIVELES_DE_DOLOR = ['Dolor leve', 'Dolor moderado', 'Dolor fuerte'];
const NIVELES_DE_MOLESTIA = ['Molestia leve', 'Molestia moderada', 'Molestia fuerte'];
const etiquetaDeDolor = (n, salud) => (n === 0
  ? (salud ? 'Sin molestia' : 'Sin dolor')
  : (salud ? NIVELES_DE_MOLESTIA : NIVELES_DE_DOLOR)[n <= 3 ? 0 : n <= 6 ? 1 : 2]);
const MEDIDAS_DEL_RELOJ = [['Reposo', 'reposo', 'lpm'], ['HRV', 'hrv', 'ms'], ['Sueño', 'sueno', 'h']];

/**
 * Salud: lo de hoy. Con reloj, su veredicto («Recuperado») y abajo el dolor o las medidas; sin reloj, el dolor anotado;
 * sin nada, «¿Cómo estás?» (Andrés, 10 oct: lo único que se anota a mano es el dolor). `salud`: el coach es un fisio
 * (se dice «molestia»). `reloj`: `useRecuperacionReciente()`.
 */
export function CuadroDeSalud({ dolor, reloj, salud = false, onAbrir }) {
  const hayDolor = dolor != null;
  const titulo = reloj?.lectura?.titulo ?? (hayDolor ? etiquetaDeDolor(dolor, salud) : '¿Cómo estás?');
  const medidas = MEDIDAS_DEL_RELOJ.filter(([, k]) => reloj?.recientes?.[k]).map(([n, k, u]) => `${n} ${reloj.recientes[k].valor} ${u}`);
  const sub = hayDolor ? `${salud ? 'Molestia' : 'Dolor'} ${dolor} de 10` : medidas.length ? medidas.slice(0, 2).join(' · ') : 'Anota cómo amaneciste';
  return (
    <Cuadro
      tono="coral" Icono={HeartPulse} etiqueta="Salud" titulo={titulo} sub={sub} onClick={onAbrir}
    />
  );
}

/**
 * El programa: la fase en que va (o la semana, o su rutina) y una rayita por fase con las hechas en blanco. Si la fase
 * o el plan traen foto, va de fondo (Andrés, 7 oct: la foto es dato de cada plan). Abre el programa completo.
 * `fases`: cuántas tiene; `actual`: la posición (0…) de la de hoy; null en una rutina semanal.
 */
export function CuadroDePrograma({ etiqueta, titulo, sub, foto, fases = 0, actual = null, onAbrir }) {
  return (
    <Cuadro
      tono="cielo" Icono={Layers} etiqueta={etiqueta} titulo={titulo} sub={sub} onClick={onAbrir} foto={foto} etiquetaAccesible={`${etiqueta}: ${titulo}. Ver el programa`}
      abajo={fases > 1 && actual != null ? (
        <span aria-hidden="true" style={{ display: 'flex', gap: 4, marginTop: 10 }}>
          {Array.from({ length: Math.min(fases, 12) }, (_, i) => (
            <i key={i} style={{ flex: 1, height: 5, borderRadius: 99, background: i <= actual ? '#fff' : 'rgba(255,255,255,0.3)' }} />
          ))}
        </span>
      ) : null}
    />
  );
}

/**
 * El cuadro blanco chico (Demo workout, 1RM): un ícono en su cuadrito de color y el nombre. Va de dos en dos debajo de los cuadros
 * de color, para lo que se usa menos.
 */
export function CuadroBlanco({ Icono, titulo, sub, color = '#1E40E0', fondo = '#EEF1FE', onClick }) {
  return (
    <button
      type="button" onClick={onClick} className="kp-press"
      style={{
        display: 'flex', alignItems: 'center', gap: 12, minHeight: 76, padding: '12px 14px', border: 'none', borderRadius: 22, background: '#fff',
        boxShadow: '0 1px 3px rgba(17,19,24,0.06)', textAlign: 'left', cursor: 'pointer', fontFamily: FONT, minWidth: 0, touchAction: 'manipulation',
      }}
    >
      <span aria-hidden="true" style={{ width: 44, height: 44, borderRadius: 14, background: fondo, color, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
        <Icono size={21} />
      </span>
      <span style={{ minWidth: 0 }}>
        <span className="texto-corto" style={{ fontSize: 16, fontWeight: 700, color: '#111318', lineHeight: 1.2 }}>{titulo}</span>
        {sub && <span className="texto-corto" style={{ fontSize: 13, fontWeight: 500, color: '#5B616E', marginTop: 2 }}>{sub}</span>}
      </span>
    </button>
  );
}

/* LOS ATAJOS DE HOME (30 oct 2026, Andrés eligió la «C» del lienzo): Salud en una franja de color y los demás en cuadritos con la palabra ADENTRO
   («ningún widget acostumbra tener las palabras afuera»). Ya no llevan datos: el atajo solo dice qué es y abre lo mismo que el cuadro grande de antes. */

/** Salud, la franja de arriba de los atajos. A la derecha, lo de hoy: lo que dijo el reloj, el dolor anotado o «¿Cómo amaneciste?» si aún no hay nada. */
export function FranjaDeSalud({ dolor, reloj, salud = false, onAbrir }) {
  const lectura = reloj?.lectura?.titulo ?? (dolor != null ? etiquetaDeDolor(dolor, salud) : '¿Cómo amaneciste?');
  return (
    <button
      type="button" onClick={onAbrir} className="kp-press" aria-label={`Salud: ${lectura}`}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, width: '100%', minWidth: 0, minHeight: 56, padding: '0 14px 0 16px', border: 'none', borderRadius: 18,
        background: TONOS.coral.fondo, boxShadow: `0 8px 18px ${TONOS.coral.sombra}`, color: '#fff', fontFamily: FONT, textAlign: 'left', cursor: 'pointer', touchAction: 'manipulation',
      }}
    >
      <HeartPulse size={20} aria-hidden="true" style={{ flexShrink: 0 }} />
      <span style={{ flex: '1 0 auto', fontSize: 15.5, fontWeight: 700 }}>Salud</span>
      <span className="texto-corto" style={{ minWidth: 0, fontSize: 14, fontWeight: 600, opacity: 0.9 }}>{lectura}</span>
      <ChevronRight size={18} aria-hidden="true" style={{ flexShrink: 0 }} />
    </button>
  );
}

/** Un cuadrito: el ícono y la palabra adentro. `aviso`: el punto rojo de arriba, solo cuando el atajo tiene algo nuevo para ti. */
export function Cuadrito({ tono = 'azul', Icono, texto, onClick, aviso = false, etiquetaAccesible }) {
  const t = TONOS[tono] ?? TONOS.azul;
  return (
    <button
      type="button" onClick={onClick} className="kp-press" aria-label={etiquetaAccesible ?? texto}
      style={{
        position: 'relative', aspectRatio: '1', minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
        padding: 6, border: 'none', borderRadius: 18, background: t.fondo, boxShadow: `0 8px 18px ${t.sombra}`, color: '#fff', cursor: 'pointer',
        fontFamily: FONT, fontSize: 12, fontWeight: 700, lineHeight: 1.1, textAlign: 'center', touchAction: 'manipulation', ...NUM_STYLE,
      }}
    >
      <Icono size={24} aria-hidden="true" />
      <span className="texto-corto" style={{ maxWidth: '100%' }}>{texto}</span>
      {aviso && <span aria-hidden="true" style={{ position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: '50%', background: '#FF3D5A', boxShadow: '0 0 0 3px #F2F3F7' }} />}
    </button>
  );
}
