import { HeartPulse, Layers } from 'lucide-react';
import { FONT, NUM_STYLE } from '@/lib/theme';
import { separaFoto } from '@/lib/fotoConFoco';

/**
 * Los cuadros de Home (reestructura visual, 15 oct 2026): Salud, la fase, Entrenar libre y Activity card, de dos
 * en dos. Cada uno: arriba su ícono en un cuadrito y su nombre; abajo, grande, lo que hoy importa de él
 * («Recuperado», «Fuerza máxima», «2 entrenos», «1:12:40») y una línea debajo. Todo el cuadro se toca.
 *
 * Los colores son los de siempre en Home (coral para Salud, azules para el plan, tinta para la activity card).
 */
const TONOS = {
  coral: { fondo: 'linear-gradient(150deg, #FF8E5E 0%, #F2555A 55%, #DD4A92 100%)', sombra: 'rgba(221,74,146,0.28)' },
  cielo: { fondo: 'linear-gradient(160deg, #6AA8FF 0%, #3B7BF5 50%, #1E4FE0 100%)', sombra: 'rgba(30,79,224,0.28)' },
  azul: { fondo: 'linear-gradient(160deg, #2448E8 0%, #1733B8 55%, #0D1A66 100%)', sombra: 'rgba(14,30,120,0.32)' },
  tinta: { fondo: 'linear-gradient(165deg, #2B3263 0%, #171C3E 58%, #0B0E24 100%)', sombra: 'rgba(12,16,52,0.34)' },
};

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
          <span aria-hidden="true" style={{ position: 'absolute', inset: 0, zIndex: -1, background: 'linear-gradient(180deg, rgba(8,14,50,0.45) 0%, rgba(8,14,50,0.15) 40%, rgba(8,14,50,0.82) 100%)' }} />
        </>
      )}
      {!url && <span aria-hidden="true" style={{ position: 'absolute', inset: 0, zIndex: -1, background: 'radial-gradient(circle at 85% 8%, rgba(255,255,255,0.24), transparent 48%)' }} />}
      <span style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
        <span aria-hidden="true" style={{ width: 40, height: 40, borderRadius: 13, display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,0.18)', flexShrink: 0 }}>
          <Icono size={20} />
        </span>
        <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 600, lineHeight: 1.2 }}>{etiqueta}</span>
      </span>
      <span style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginTop: 18, width: '100%' }}>
        <span style={{ display: 'block', flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 21, fontWeight: 800, letterSpacing: -0.4, lineHeight: 1.12, overflowWrap: 'break-word', ...NUM_STYLE }}>{titulo}</span>
          {sub && <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, opacity: 0.88, marginTop: 3 }}>{sub}</span>}
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
        <span style={{ display: 'block', fontSize: 16, fontWeight: 700, color: '#111318', lineHeight: 1.2 }}>{titulo}</span>
        {sub && <span style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#5B616E', marginTop: 2 }}>{sub}</span>}
      </span>
    </button>
  );
}
