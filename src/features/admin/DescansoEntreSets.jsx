import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Timer } from 'lucide-react';
import { Contador } from '@/features/admin/piezas';
import { leeDescanso, componeDescanso } from '@/lib/medidas';
import { T, FONT } from '@/lib/theme';

/**
 * El descanso ENTRE dos Sets: lo que se descansa al terminar un Set, antes de empezar el siguiente.
 *
 * Andrés, 8 oct 2026, sobre «cluster + descanso entre sets»: «está bien colocado pero bastante feo». Ahora vive donde
 * pasa, en la raya que separa los dos Sets: sin descanso, un «+ Descanso» chico; con descanso, un chip «⏱ 2 min» que
 * abre un menú pegado con − +, segundos o minutos, y «Quitar el descanso».
 *
 * Es del SET, no de un ejercicio: se guarda en el último ejercicio del Set (`descansoSet`, ver `lib/setsDeUnaSesion.js`) y
 * se cuenta una sola vez, después de la ÚLTIMA vuelta. El descanso de cada ejercicio sigue siendo el de entre sus series.
 */

const DESCANSO_NUEVO = '2 min';

const botonChico = {
  display: 'inline-flex', alignItems: 'center', gap: 4, minHeight: 28, padding: '0 11px', borderRadius: 999,
  cursor: 'pointer', fontFamily: FONT, fontSize: 12.5, fontWeight: 800, touchAction: 'manipulation', flexShrink: 0,
  border: `1.5px solid ${T.accent}`, background: '#fff', color: T.accent,
};

// El menú pegado al chip. Se cierra tocando fuera o con Escape.
function MenuDelDescanso({ ancla, numero, valor, onCambio, onCerrar }) {
  const [sitio, setSitio] = useState(null);
  const cierra = useRef(onCerrar);
  useEffect(() => { cierra.current = onCerrar; }, [onCerrar]);

  useLayoutEffect(() => {
    const mide = () => {
      const r = ancla.current?.getBoundingClientRect();
      if (!r) return;
      setSitio({ top: r.bottom + 8, left: Math.max(8, Math.min(r.left + r.width / 2 - 140, window.innerWidth - 288)) });
    };
    mide();
    // Por si el botón del que cuelga todavía no tiene lugar en este dibujo.
    const marco = requestAnimationFrame(mide);
    window.addEventListener('scroll', mide, true);
    window.addEventListener('resize', mide);
    return () => { cancelAnimationFrame(marco); window.removeEventListener('scroll', mide, true); window.removeEventListener('resize', mide); };
  }, [ancla]);

  useEffect(() => {
    const afuera = (e) => {
      if (e.target?.closest?.('[data-menu-descanso-set], [data-chip-descanso-set]')) return;
      cierra.current();
    };
    const tecla = (e) => { if (e.key === 'Escape') cierra.current(); };
    document.addEventListener('pointerdown', afuera, true);
    document.addEventListener('keydown', tecla);
    return () => { document.removeEventListener('pointerdown', afuera, true); document.removeEventListener('keydown', tecla); };
  }, []);

  if (!sitio) return null;
  const leido = leeDescanso({ descanso: valor });
  const numerico = leido.unidad && /^\d+(?:[.,]\d+)?$/.test(leido.cantidad);
  const n = numerico ? parseFloat(leido.cantidad.replace(',', '.')) : 0;
  const paso = leido.unidad === 'min' ? 1 : 5;
  const pon = (unidad, cantidad) => onCambio(componeDescanso(unidad, String(cantidad)));
  const cambiaUnidad = (u) => {
    if (u === leido.unidad) return;
    pon(u, u === 'min' ? Math.max(1, Math.round(n / 60)) : n * 60);
  };
  const segmento = (u, texto) => (
    <button
      key={u} type="button" onClick={() => cambiaUnidad(u)} aria-pressed={leido.unidad === u}
      style={{
        border: 'none', cursor: 'pointer', padding: '6px 11px', fontFamily: FONT, fontSize: 12.5, fontWeight: 800,
        background: leido.unidad === u ? T.accent : T.bg2, color: leido.unidad === u ? '#fff' : T.text2, touchAction: 'manipulation',
      }}
    >{texto}</button>
  );

  return createPortal(
    <div
      data-menu-descanso-set role="dialog" aria-label="El descanso entre Sets"
      style={{
        position: 'fixed', zIndex: 2900, top: sitio.top, left: sitio.left, width: 280, boxSizing: 'border-box', background: T.bg2,
        border: `1px solid ${T.border}`, borderRadius: 14, padding: '10px 12px 8px', fontFamily: FONT,
        boxShadow: '0 16px 44px rgba(17,19,24,0.16)',
      }}
    >
      <div style={{ fontSize: 12.5, fontWeight: 800, color: T.text2, padding: '2px 2px 9px' }}>
        Después del Set {numero}, antes del siguiente
      </div>
      {numerico ? (
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <Contador
            texto={String(n)} etiqueta="descanso" ancho={44}
            onMenos={() => pon(leido.unidad, Math.max(paso, n - paso))} menosApagado={n <= paso}
            onMas={() => pon(leido.unidad, n + paso)}
          />
          <span style={{ display: 'inline-flex', borderRadius: 10, border: `1.5px solid ${T.border}`, overflow: 'hidden' }}>
            {segmento('seg', 'seg')}{segmento('min', 'min')}
          </span>
        </div>
      ) : (
        // Un texto que no es un número («Recuperación total») se respeta y se edita como texto.
        <input
          value={valor} onChange={(e) => onCambio(e.target.value)} aria-label="Descanso entre Sets"
          style={{
            width: '100%', boxSizing: 'border-box', border: `1.5px solid ${T.border}`, borderRadius: 10, padding: '8px 10px',
            fontFamily: FONT, fontSize: 14, fontWeight: 600, color: T.text, background: T.bg, outline: 'none',
          }}
        />
      )}
      <button
        type="button" onClick={() => { onCambio(''); onCerrar(); }}
        style={{ marginTop: 8, border: 'none', background: 'transparent', color: T.danger, fontFamily: FONT, fontSize: 12.5, fontWeight: 800, cursor: 'pointer', padding: '6px 2px' }}
      >
        Quitar el descanso
      </button>
    </div>,
    document.body,
  );
}

/**
 * La raya entre un Set y el siguiente. `valor`: el descanso («2 min») o vacío. En solo lectura no cambia nada: sin descanso
 * no se dibuja, y con descanso el chip solo informa.
 */
export default function DescansoEntreSets({ numero, valor, onCambio, soloLectura = false }) {
  const [abierto, setAbierto] = useState(false);
  const chip = useRef(null);
  const hay = !!String(valor ?? '').trim();
  if (!hay && soloLectura) return null;
  const raya = <span aria-hidden="true" style={{ flex: 1, height: 1, background: T.borderHi }} />;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '0 2px' }}>
      {raya}
      {hay ? (
        <button
          ref={chip} type="button" data-chip-descanso-set className="kp-accion" disabled={soloLectura}
          onClick={() => setAbierto((a) => !a)} aria-expanded={abierto} title="El descanso entre este Set y el siguiente"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5, border: 'none', background: T.accentBg, color: T.accent,
            borderRadius: 999, padding: '5px 12px', fontFamily: FONT, fontSize: 12.5, fontWeight: 800,
            cursor: soloLectura ? 'default' : 'pointer', touchAction: 'manipulation',
          }}
        >
          <Timer size={13} strokeWidth={2.6} /> {String(valor).trim()}
        </button>
      ) : (
        <span ref={chip} style={{ display: 'inline-flex' }}>
          <button
            type="button" data-chip-descanso-set className="kp-accion" style={botonChico}
            onClick={() => { onCambio(DESCANSO_NUEVO); setAbierto(true); }}
          >
            <Plus size={13} strokeWidth={2.8} /> Descanso
          </button>
        </span>
      )}
      {raya}
      {abierto && hay && !soloLectura && (
        <MenuDelDescanso
          ancla={chip} numero={numero} valor={String(valor).trim()} onCambio={onCambio} onCerrar={() => setAbierto(false)}
        />
      )}
    </div>
  );
}
