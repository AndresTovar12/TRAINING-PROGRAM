import { Camera, Check, ChevronLeft, ChevronRight, Pencil } from 'lucide-react';
import { FONT, LT, NUM_STYLE } from '@/lib/theme';
import { BotonDeMantener } from '@/features/training/PantallasDelEntreno';
import { EnQueVas } from '@/features/training/EnQueVas';
import { cuentaDelPaso } from '@/lib/enQueVas';

/**
 * LA TÉCNICA CON EL TELÉFONO EN EL PISO (23 nov 2026). Andrés: «nadie o casi nadie va a tener el teléfono en la mano… hacer técnica de algo, muy
 * difícilmente vas a tener el teléfono en la mano».
 *
 * Es la cara clara (regla 18) de Técnica y del calentamiento o enfriamiento con ejercicios. El teléfono está en el piso o en la banca, en la salida:
 *   · el video arranca solo, sin sonido, y se repite (lo ve una vez y lo deja);
 *   · la cifra («2 × 30 m») es grande, para leerla de pie, lejos;
 *   · «Listo» es un botón grande, de todo el ancho, fácil de atinar al regresar;
 *   · lo demás (anterior, anotar, grabar técnica, saltar) va en botones chicos encima: se usan pocas veces. Son los mismos que en Gym; no se pierde nada.
 */
export function PasoDeLejos({ paso, video, sigue, nota, tecnica, puedeAnterior, onAnterior, onAnotar = null, onListo, onSaltar, esUltimo, onTerminar, color, boton = 'Listo', ayuda = null }) {
  const c = color || LT.blue;
  const cuenta = cuentaDelPaso(paso);
  // La cifra: lo que dice el paso («2 × 30 m»), o su cantidad («30 m», «100 m») en un sprint o una serie de nado (23 nov 2026: ya no van en la negra).
  const cuanto = paso.termina?.texto || (paso.termina?.cantidad ? `${paso.termina.cantidad} ${paso.termina.unidad === 'seg' ? 'seg' : paso.termina.unidad}` : '');
  const limite = paso.limiteSeg ? `en menos de ${paso.limiteSeg < 60 ? `${paso.limiteSeg} seg` : `${Math.floor(paso.limiteSeg / 60)}:${String(paso.limiteSeg % 60).padStart(2, '0')} min`}` : null;
  // Lo que acompaña a la cifra («por lado», «regreso caminando», «con trineo 20 kg»), la intensidad («Al máximo», «1:45 /100 m») y el límite.
  const extras = [paso.meta?.texto, ...String(paso.texto ?? '').split(' · ').filter((t) => t && t !== cuanto), limite].filter(Boolean);
  const redondo = (etiqueta, onClick, hijo, disabled = false) => (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={etiqueta} className="kp-press"
      style={{ width: 52, height: 52, borderRadius: 26, border: 'none', background: LT.surface, color: disabled ? LT.text3 : LT.text, display: 'grid', placeItems: 'center', cursor: disabled ? 'default' : 'pointer', boxShadow: '0 1px 3px rgba(17,19,24,.08)', opacity: disabled ? 0.55 : 1 }}>
      {hijo}
    </button>
  );
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', color: LT.text, fontFamily: FONT }}>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '4px 18px 10px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          {paso.encabezado && paso.encabezado !== paso.nombre && <div style={{ fontSize: 14, fontWeight: 700, color: LT.text2 }}>{paso.encabezado}</div>}
          <h1 style={{ margin: 0, fontSize: 36, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.05, overflowWrap: 'anywhere' }}>{paso.nombre}</h1>
        </div>
        {video && <div data-de-lejos-video="">{video}</div>}
        {cuanto && (
          <div style={{ textAlign: 'center', padding: '4px 0' }}>
            <div data-cifra-de-lejos="" style={{ fontSize: cuanto.length > 9 ? 54 : 68, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1, ...NUM_STYLE }}>{cuanto}</div>
            {/* En qué va: la misma pieza que todas las pantallas del entreno (`EnQueVas`, 23 nov 2026), en grande para leerla de lejos. */}
            {cuenta && <div style={{ marginTop: 12 }}><EnQueVas {...cuenta} color={c} grande centrada /></div>}
            {extras.length > 0 && <div style={{ fontSize: 16, fontWeight: 700, color: LT.text2, marginTop: 8 }}>{extras.join(' · ')}</div>}
          </div>
        )}
        {nota && <p style={{ margin: 0, fontSize: 15, lineHeight: 1.45, color: '#2E2F3A', textAlign: 'center' }}>{nota}</p>}
      </div>
      <div style={{ flexShrink: 0, padding: '8px 18px calc(12px + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* «Sigue» en tarjeta, como en el video guiado y el descanso (revisión de estilo, 23 nov 2026: antes era una línea suelta). */}
        {sigue && (
          <div style={{ background: LT.surface, borderRadius: 16, padding: '9px 14px', boxShadow: '0 1px 3px rgba(17,19,24,.06)' }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: LT.text2 }}>Sigue</div>
            <div style={{ fontSize: 15.5, fontWeight: 800, color: LT.text, overflowWrap: 'anywhere' }}>{sigue}</div>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 14 }}>
          {redondo('Anterior', onAnterior, <ChevronLeft size={24} />, !puedeAnterior)}
          {onAnotar && redondo('Anotar resultados', onAnotar, <Pencil size={20} color={c} />)}
          {tecnica && redondo(tecnica.etiqueta, tecnica.onClick, tecnica.enviada ? <Check size={21} color={LT.mint} /> : <Camera size={21} color={c} />)}
          {redondo('Saltar', onSaltar, <ChevronRight size={24} />)}
        </div>
        {esUltimo && onTerminar ? (
          // «Terminar» es verde en todas las pantallas claras, como la bandera de Gym (revisión de estilo, 23 nov 2026); aquí ancho, por el teléfono en el piso.
          <BotonDeMantener onTermina={onTerminar} texto="Mantén para terminar" fondo={LT.mint} relleno="#0B3D24" alto={96} radio={28} tamano={22} sombra="none" />
        ) : (
          <button type="button" onClick={onListo} className="kp-press"
            style={{ width: '100%', minHeight: 96, borderRadius: 28, border: 'none', background: c, color: '#fff', fontFamily: FONT, fontSize: 30, fontWeight: 800, cursor: 'pointer', touchAction: 'manipulation', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <span style={{ display: 'grid', placeItems: 'center' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}><Check size={30} strokeWidth={3} /> {boton}</span>
              {ayuda && <span style={{ fontSize: 13.5, fontWeight: 700, opacity: 0.9, marginTop: 2 }}>{ayuda}</span>}
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
