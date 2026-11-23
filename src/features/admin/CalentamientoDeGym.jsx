import { useMemo } from 'react';
import { X } from 'lucide-react';
import { CamposDeVideo, Segmentos, SetsDeEjercicios } from '@/features/admin/EditorDeCorrer';
import { T, FONT } from '@/lib/theme';

/**
 * EL CALENTAMIENTO EN GYM (Andrés, 21 nov 2026: «me parece bien tu idea»). Es la MISMA pieza que Clase y Deporte: un bloque gris arriba del
 * Set 1, con «Guiado» (un video del repertorio, los marcados en su ficha «Es un calentamiento guiado») o «Ejercicios» (la lista agrupada).
 * No lleva banda azul ni número: se lee como «antes de los Sets» y el Set 1 sigue siendo el Set 1 (las flechas «→ Set N» no cambian).
 * Se agrega con la pastilla «Calentamiento» del pie, junto a «Nota» y «Ejercicio nuevo» (Andrés eligió esa opción contra un «+ Calentamiento»
 * arriba del Set 1); al tocarla, el bloque aparece arriba y la pantalla sube hasta él.
 * Se guarda aparte, en `day.calentamiento` ({ forma: 'video' | 'ejercicios', video, q, u, items, sets }), como `claseExtra.cal` en Clase.
 */
export default function CalentamientoDeGym({ cal, onCal, repertoire = [], categorias = [], atleta, onEjercicioCreado, soloLectura = false }) {
  const calentamientos = useMemo(() => (repertoire ?? []).filter((e) => !!e?.guiado), [repertoire]);
  const nombreAtleta = (atleta?.full_name || atleta?.username || '').split(' ')[0];

  // Sin calentamiento no se ve nada aquí: se agrega con la pastilla «Calentamiento» del pie, junto a «Nota» (Andrés, 21 nov 2026, opción B).
  if (!cal) return null;

  const forma = cal.forma ?? 'video';
  const pon = (c) => onCal({ ...cal, ...c });
  return (
    <div data-calentamiento-gym={forma} style={{ background: '#F4F5F9', borderRadius: 20, padding: '12px 14px 14px', fontFamily: FONT }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 32, marginBottom: 10 }}>
        <span style={{ flex: 1, fontSize: 16, fontWeight: 800, color: T.text }}>Calentamiento</span>
        {!soloLectura && (
          <button type="button" onClick={() => onCal(undefined)} aria-label="Quitar el calentamiento" className="kp-press"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: 'none', background: 'transparent', color: T.text2, fontFamily: FONT, fontWeight: 700, fontSize: 13, minHeight: 32, padding: '0 6px', cursor: 'pointer' }}>
            <X size={14} strokeWidth={2.4} aria-hidden="true" /> Quitar
          </button>
        )}
      </div>
      <div style={{ display: 'flex', maxWidth: 300, marginBottom: 12 }}>
        <Segmentos opciones={[['video', 'Guiado'], ['ejercicios', 'Ejercicios']]} valor={forma} etiqueta="Cómo calienta" onCambio={(f) => pon({ forma: f, items: cal.items ?? [] })} />
      </div>
      {forma === 'video'
        ? <CamposDeVideo t={{ q: '', u: 'min', ...cal }} calentamientos={calentamientos} categorias={categorias} nombreAtleta={nombreAtleta} onEjercicioCreado={onEjercicioCreado} onCambio={pon} />
        : <SetsDeEjercicios t={{ id: 'cal', ...cal }} de="el calentamiento" repertoire={repertoire} onEjercicioCreado={onEjercicioCreado} onCambio={(c) => pon(c)} />}
    </div>
  );
}
