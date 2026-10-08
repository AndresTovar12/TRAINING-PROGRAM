import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Trash2 } from 'lucide-react';
import BotonEntendido from '@/components/BotonEntendido';
import CampoDescanso from '@/components/CampoDescanso';
import { CeldaDeReps, CeldaDeCarga } from '@/components/RepsYCarga';
import { IconBtn } from '@/features/admin/piezas';
import { useRepsYCarga } from '@/lib/useRepsYCarga';
import { tipoDeCargaAlEscribir } from '@/lib/medidas';
import { lapsosDe, parcheDeLapsos, comoEjercicio, MAX_LAPSOS } from '@/lib/lapsos';
import { T, FONT } from '@/lib/theme';

/**
 * Los lapsos de UN ejercicio dentro de un Set en «Lapsos personalizados»: filas numeradas, una por lapso, con lo
 * mismo que lleva una línea de ejercicio —cuánto, con qué carga, cuánto descansa— y «+ Lapso» para agregar otro.
 *
 * Andrés, 8 oct 2026: «lo que no me gusta es que la personalización aparece abajo del set como si fuera otro set»
 * y «el coach se tiene que adaptar al editor y no el editor al coach». Por eso los lapsos viven DENTRO de la tarjeta
 * del ejercicio, debajo de su nombre (como las vueltas de «Por vuelta»), y valen para cualquier ejercicio: Correr
 * con tres lapsos, un Thruster con uno. No hay que decidir antes en qué se mide.
 *
 * Cada fila usa las MISMAS casillas que la línea de un ejercicio (la lista de lo que se mide, la de la carga, el
 * descanso), así que sabe todo lo que ellas saben: ritmos, zonas, rangos. Para eso trata a cada lapso como si fuera un
 * ejercicio (`comoEjercicio`) y su parche se guarda en ese lapso. «Por lado» es del ejercicio, no de cada lapso.
 */

const frase = { fontSize: 12.5, fontWeight: 700, color: T.text2, fontFamily: FONT };

const botonChico = {
  display: 'inline-flex', alignItems: 'center', gap: 4, minHeight: 28, padding: '0 11px', borderRadius: 999,
  cursor: 'pointer', fontFamily: FONT, fontSize: 12.5, fontWeight: 800, touchAction: 'manipulation', flexShrink: 0,
  border: `1.5px solid ${T.accent}`, background: '#fff', color: T.accent,
};

// Una fila: el número del lapso y sus tres casillas. Es un fragmento de la rejilla de arriba: cada pieza es una celda.
function FilaDeLapso({ ex, lapso, k, tipoPrevio, onCambio, onQuitar, puedeQuitar, estiloInput, angosta }) {
  const comoEj = comoEjercicio(ex, lapso);
  const rc = useRepsYCarga({
    ex: comoEj,
    // «Por lado» y lo que sobra de la línea no son del lapso: solo lo que él guarda.
    onPatch: (p) => { const { porLado: _lado, ...suyo } = p; onCambio(suyo); },
    tipoInicial: tipoPrevio,
  });
  return (
    <>
      <span aria-hidden="true" style={{ paddingBottom: 9, textAlign: 'center', fontSize: 11.5, fontWeight: 800, color: T.text3 }}>
        {k + 1}
      </span>
      <CeldaDeReps rc={rc} compacto estiloInput={estiloInput} />
      <CeldaDeCarga rc={rc} compacto estiloInput={estiloInput} />
      {/* En el teléfono el descanso baja a su renglón y la papelera se queda arriba, en la última columna. */}
      {angosta && <IconBtn icon={Trash2} danger onClick={onQuitar} disabled={!puedeQuitar} title="Quitar el lapso" />}
      <div style={angosta ? { gridColumn: '2 / 4' } : undefined}>
        <CampoDescanso ex={comoEj} onPatch={onCambio} compacto estiloInput={estiloInput} />
      </div>
      {!angosta && <IconBtn icon={Trash2} danger onClick={onQuitar} disabled={!puedeQuitar} title="Quitar el lapso" />}
    </>
  );
}

/**
 * La burbuja que señala el «+ Lapso» CADA VEZ que se elige «Lapsos personalizados» (no solo la primera): dice qué es y
 * da un ejemplo de cardio. No bloquea nada: se quita con «Entendido» o tocando en cualquier otro lado.
 *
 * Va fuera de la tarjeta (en `document.body`, fija): la tarjeta de ejercicio recorta lo que se sale, y la burbuja tiene
 * que poder asomarse. Se recoloca al desplazar o girar la pantalla.
 */
function BurbujaDeLapsos({ ancla, onCerrar }) {
  const [sitio, setSitio] = useState(null);
  const cierra = useRef(onCerrar);
  useEffect(() => { cierra.current = onCerrar; }, [onCerrar]);

  useLayoutEffect(() => {
    const el = ancla.current;
    if (!el) return undefined;
    // Que el botón y su explicación se vean juntos, aunque el Set esté lejos de la pantalla.
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const mide = () => {
      const r = el.getBoundingClientRect();
      setSitio({ top: r.bottom + 10, left: Math.max(8, Math.min(r.left - 8, window.innerWidth - 286)) });
    };
    mide();
    window.addEventListener('scroll', mide, true);
    window.addEventListener('resize', mide);
    return () => { window.removeEventListener('scroll', mide, true); window.removeEventListener('resize', mide); };
  }, [ancla]);

  // Tocar en otro lado la quita; tocar la burbuja o el propio «+ Lapso» no.
  useEffect(() => {
    const afuera = (e) => {
      if (e.target?.closest?.('[data-burbuja-lapsos], [data-mas-lapso]')) return;
      cierra.current();
    };
    document.addEventListener('pointerdown', afuera, true);
    return () => document.removeEventListener('pointerdown', afuera, true);
  }, []);

  if (!sitio) return null;
  const ejemplo = { background: 'rgba(255,255,255,0.16)', borderRadius: 10, padding: '7px 9px', marginTop: 8, fontSize: 12, fontWeight: 700, lineHeight: 1.5 };
  const num = { display: 'inline-block', width: 16, opacity: 0.8, fontStyle: 'normal' };
  return createPortal(
    <div
      data-burbuja-lapsos role="note"
      style={{
        position: 'fixed', zIndex: 2900, top: sitio.top, left: sitio.left, width: 'min(270px, calc(100vw - 16px))', boxSizing: 'border-box',
        background: T.accent, color: '#fff', borderRadius: 14, padding: '11px 12px 10px', fontFamily: FONT, fontSize: 13, fontWeight: 600,
        lineHeight: 1.4, boxShadow: '0 14px 34px rgba(30,64,224,0.35)',
      }}
    >
      <span aria-hidden="true" style={{ position: 'absolute', top: -7, left: 22, width: 14, height: 14, background: T.accent, transform: 'rotate(45deg)', borderRadius: 3 }} />
      <b style={{ display: 'block', fontSize: 14, fontWeight: 800, marginBottom: 3 }}>Un ejercicio, varios lapsos</b>
      Con «+ Lapso» armas un intervalo con un solo ejercicio. Por ejemplo, Correr:
      <div style={ejemplo}>
        <i style={num}>1</i>800 m · rápido (4:34 min/km)<br />
        <i style={num}>2</i>2 min · suave (6:39 min/km)
      </div>
      <BotonEntendido color={T.accent} onClick={() => cierra.current()} style={{ marginTop: 8, minHeight: 0, padding: '5px 10px', borderRadius: 9, fontSize: 12.5 }} />
    </div>,
    document.body,
  );
}

/**
 * `columnasCompu`: la rejilla de la compu (número, reps, carga, descanso, papelera); en el teléfono y en las tarjetas
 * (`angosta`) son dos columnas y el descanso baja a su renglón. `burbuja`: si se señala el «+ Lapso» de este ejercicio.
 */
export default function LapsosDelEjercicio({ ex, onPatch, estiloInput, angosta, columnasCompu, burbuja = false, onCerrarBurbuja }) {
  const lapsos = lapsosDe(ex) ?? [];
  const ancla = useRef(null);
  const guarda = (nuevos) => onPatch(parcheDeLapsos(nuevos));
  const cambia = (k, parche) => guarda(lapsos.map((l, i) => (i === k ? { ...l, ...parche } : l)));
  const quita = (k) => { if (lapsos.length > 1) guarda(lapsos.filter((_, i) => i !== k)); };
  // El lapso nuevo sigue en lo mismo que el último: la misma unidad, y el mismo tipo de carga (casilla vacía).
  const agrega = () => {
    if (lapsos.length >= MAX_LAPSOS) return;
    const ultimo = lapsos[lapsos.length - 1];
    guarda([...lapsos, { reps: '', unidad: ultimo?.unidad ?? '', intensity: '', descanso: '' }]);
  };

  return (
    <div style={{ minWidth: 0 }}>
      <div style={{
        display: 'grid', gap: '6px 8px', alignItems: 'end',
        gridTemplateColumns: angosta ? '16px minmax(0, 1fr) minmax(0, 1fr) 30px' : columnasCompu,
      }}>
        {lapsos.map((l, k) => (
          <FilaDeLapso
            key={k} ex={ex} lapso={l} k={k} estiloInput={estiloInput} angosta={angosta}
            tipoPrevio={k > 0 ? tipoDeCargaAlEscribir(lapsos[k - 1].intensity) : null}
            onCambio={(p) => cambia(k, p)} onQuitar={() => quita(k)} puedeQuitar={lapsos.length > 1}
          />
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px 12px', marginTop: 9 }}>
        <span ref={ancla} style={{ position: 'relative', display: 'inline-flex' }}>
          <button type="button" className="kp-accion" data-mas-lapso onClick={agrega} disabled={lapsos.length >= MAX_LAPSOS} style={botonChico}>
            <Plus size={13} strokeWidth={2.8} /> Lapso
          </button>
        </span>
        <span style={{ ...frase, fontWeight: 600 }}>
          {lapsos.length} {lapsos.length === 1 ? 'lapso' : 'lapsos seguidos'}{ex.name ? ` de ${ex.name}` : ''}
        </span>
      </div>
      {burbuja && <BurbujaDeLapsos ancla={ancla} onCerrar={onCerrarBurbuja} />}
    </div>
  );
}

/**
 * La casilla «Por lado» de un ejercicio en lapsos: es del ejercicio entero (cada pierna, cada brazo), no de cada lapso.
 * Mismo aspecto que la de la línea normal (`DebajoDeRepsYCarga`).
 */
export function PorLadoDelEjercicio({ ex, onPatch }) {
  const marcado = ex?.porLado === true;
  return (
    <label
      className={marcado ? undefined : 'kp-accion'} title="Las reps son por cada lado: cada pierna, cada brazo."
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontFamily: FONT, fontSize: 12.5, fontWeight: 700, color: T.text2 }}
    >
      <input
        type="checkbox" checked={marcado} onChange={(e) => onPatch({ porLado: e.target.checked ? true : undefined })}
        style={{ width: 16, height: 16, margin: 0, accentColor: T.accent, cursor: 'pointer' }}
      />
      Por lado
    </label>
  );
}
