import { FONT, LT, UI } from '@/lib/theme';

/**
 * La hoja del «···» (29 oct 2026): sube desde abajo con las acciones de algo y un «Cancelar» aparte. La usan la página de un entreno (Cambiar el nombre, Borrar…) y la sesión del día
 * en el plan (Terminar ahora, Hacerla otra vez…): una sola, para que los dos «···» se vean y se toquen igual.
 *
 * `acciones`: `[{ texto, onClick, peligro? }]` (`peligro`: en rojo). Tocar una cierra la hoja y la corre. `etiqueta`: lo que lee el lector de pantalla. `capa`: encima de la pantalla que la abre
 * (la página del entreno va en 3200 y el entreno guiado en 3000; las preguntas de `Confirmacion` en 5000 quedan por encima).
 */
export default function HojaDeAcciones({ acciones, alCerrar, etiqueta = 'Opciones', capa = 3260 }) {
  const opcion = { display: 'block', width: '100%', minHeight: 56, border: 'none', background: 'transparent', fontFamily: FONT, fontSize: 17, fontWeight: 600, color: LT.text, cursor: 'pointer', touchAction: 'manipulation' };
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: capa, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      <div onClick={alCerrar} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.42)' }} />
      <div role="dialog" aria-label={etiqueta} style={{ position: 'relative', display: 'grid', gap: 8, padding: '0 10px calc(10px + env(safe-area-inset-bottom))', maxWidth: 560, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden' }}>
          {acciones.map((a, i) => (
            <button key={a.texto} type="button" autoFocus={i === 0} onClick={() => { alCerrar(); a.onClick(); }} style={{ ...opcion, borderTop: i ? `1px solid ${UI.hilo}` : 'none', color: a.peligro ? '#D92D20' : LT.text }}>{a.texto}</button>
          ))}
        </div>
        <button type="button" onClick={alCerrar} style={{ ...opcion, background: '#fff', borderRadius: 16, fontWeight: 700 }}>Cancelar</button>
      </div>
    </div>
  );
}
