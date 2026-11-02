import { useEffect, useRef } from 'react';
import { Check, Heart, Loader2, Pause, Play } from 'lucide-react';
import { FONT, NUM_STYLE } from '@/lib/theme';
import { MINIMO_DE_SEGUNDOS } from '@/lib/entrenoLibre';
import { BotonDeMantener } from '@/features/training/PantallasDelEntreno';
import { C, LETRA_DE_MARCA, nombreDeLaCorta } from './carrera';

/* LAS PIEZAS DE LA PANTALLA DE CARRERA (2 nov 2026; maqueta WVcKiJ2JhyChJqLwP3bhHD, colores A). Las comparten la carrera con mapa (`PantallaDeCarrera`) y las
   actividades sin mapa (`PantallaDelCronometro`): los colores, los números enormes, la hoja de abajo con «Pausar» o «Reanudar» y «Finalizar», el título «EN PAUSA»,
   el pulso del reloj y el aviso de la carrera muy corta. Los colores y lo que no es pantalla, en `carrera.js`. */

/** Un número enorme (el ritmo, la distancia, el tiempo sin mapa) con su etiqueta gris debajo. Se encoge en un teléfono angosto para no cortarse. */
export function NumeroGrande({ valor, etiqueta, color = C.texto, tamano = 100, rol, etiquetaAccesible }) {
  return (
    <div style={{ display: 'grid', justifyItems: 'center', gap: 6, minWidth: 0, maxWidth: '100%' }}>
      <div role={rol} aria-label={etiquetaAccesible} style={{ fontSize: `min(${tamano}px, ${Math.round(tamano / 3.9)}vw)`, fontWeight: 800, lineHeight: 1, letterSpacing: -3, color, whiteSpace: 'nowrap', ...NUM_STYLE }}>{valor}</div>
      {etiqueta && <div style={{ fontSize: 19, fontWeight: 500, color: C.gris }}>{etiqueta}</div>}
    </div>
  );
}

/** «♥ 142 lpm» en el color de acento, solo si el Apple Watch está mandando el pulso. */
export function Pulso({ lpm, tamano = 18 }) {
  if (!(lpm > 0)) return null;
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: tamano, fontWeight: 800, color: C.acento, ...NUM_STYLE }}>
      <Heart size={tamano - 2} fill="currentColor" strokeWidth={0} aria-hidden="true" /> {lpm} lpm
    </div>
  );
}

/** «EN PAUSA», grande, con la letra de los stickers. `automatica`: la puso la app porque te detuviste (se quita sola al volver a moverte). */
export function TituloDePausa({ automatica = false }) {
  return (
    <div style={{ textAlign: 'center', pointerEvents: 'none' }}>
      {/* estilo-ok: «EN PAUSA» en mayúsculas, como la maqueta aprobada de la pantalla de carrera (2 nov 2026) */}
      <div style={{ fontFamily: LETRA_DE_MARCA, fontVariationSettings: "'opsz' 96", fontSize: 46, fontWeight: 800, lineHeight: 1, letterSpacing: -1, color: C.texto }}>{'EN PAUSA'}</div>
      {automatica && <div style={{ marginTop: 8, fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.78)', whiteSpace: 'nowrap' }}>Pausa automática</div>}
    </div>
  );
}

const pildora = (fondo, extra) => ({
  flex: 1, minWidth: 0, minHeight: 58, borderRadius: 99, border: 'none', cursor: 'pointer', fontFamily: FONT, fontSize: 17, fontWeight: 800, color: '#fff',
  background: fondo, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10, touchAction: 'manipulation', ...extra,
});

/* LA HOJA DE ABAJO: su asita y, corriendo, un solo botón ancho «Pausar»; en pausa, «Reanudar» (azul) y «Finalizar» (se MANTIENE 1 s: el fondo se llena de
   izquierda a derecha y, si se suelta antes, se vacía; así un toque sin querer no cierra la carrera), con la ayuda gris debajo. `guardando`: ya se está guardando. */
export function HojaDeAbajo({ pausado, guardando = false, error = null, onPausa, onReanuda, onFinaliza }) {
  return (
    <div data-map-overlay style={{ background: C.hoja, borderRadius: '28px 28px 0 0', padding: '12px 18px calc(14px + env(safe-area-inset-bottom))', fontFamily: FONT }}>
      <div aria-hidden="true" style={{ width: 38, height: 5, borderRadius: 99, background: C.asa, margin: '0 auto 14px' }} />
      {error && <div role="alert" style={{ marginBottom: 10, padding: '10px 12px', borderRadius: 14, background: 'rgba(255,77,106,0.16)', color: '#FFB3C0', fontSize: 14, fontWeight: 600 }}>{error}</div>}
      {pausado ? (
        <>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" onClick={onReanuda} disabled={guardando} style={pildora(C.azul, { opacity: guardando ? 0.6 : 1 })}><Play size={17} fill="#fff" strokeWidth={0} /> Reanudar</button>
            <BotonDeMantener
              onTermina={onFinaliza} disabled={guardando} etiqueta="Mantén para finalizar" ms={1000} vaciaMs={250}
              texto={guardando ? <><Loader2 size={17} className="spin" /> Guardando…</> : <><Check size={17} strokeWidth={3} /> Finalizar</>}
              fondo={C.acentoOscuro} relleno={C.acento} alto={58} radio={99} tamano={17} sombra="none"
              // estilo-ok: el borde del color de acento de «Finalizar», como la maqueta aprobada (2 nov 2026)
              estilo={{ flex: 1, width: 'auto', minWidth: 0, border: `2px solid ${C.acento}` }}
            />
          </div>
          <p style={{ textAlign: 'center', fontSize: 12, fontWeight: 600, color: C.gris, margin: '10px 0 0' }}>Mantén «Finalizar» para terminar</p>
        </>
      ) : (
        <div style={{ display: 'flex' }}>
          <button type="button" onClick={onPausa} style={pildora(C.azul)}><Pause size={18} fill="#fff" strokeWidth={0} /> Pausar</button>
        </div>
      )}
    </div>
  );
}

const VERBOS = { correr: ['Corre', 'corriendo'], caminar: ['Camina', 'caminando'], senderismo: ['Camina', 'caminando'], bici: ['Pedalea', 'pedaleando'] };

/* SI FUE MUY CORTA (menos de `MINIMO_DE_SEGUNDOS`): antes no se guardaba y no se decía nada. Ahora un aviso sobre la pantalla, con el fondo oscurecido:
   «Descartar» (no guarda) o «Seguir corriendo» (reanuda). */
export function AvisoDeCorta({ deporte, actividad = null, onDescartar, onSeguir }) {
  const seguir = useRef(null);
  useEffect(() => { seguir.current?.focus(); }, []);
  const [verbo, seguirHaciendo] = VERBOS[deporte] ?? ['Entrena', 'entrenando'];
  return (
    <div data-map-overlay style={{ position: 'absolute', inset: 0, zIndex: 20, background: 'rgba(0,0,0,0.6)', display: 'grid', placeItems: 'center', padding: 24, fontFamily: FONT }}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="carrera-corta" style={{ width: '100%', maxWidth: 360, background: '#1C1D22', borderRadius: 22, padding: '20px 18px 16px', textAlign: 'center', color: C.texto }}>
        <h3 id="carrera-corta" style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 800 }}>{nombreDeLaCorta(deporte, actividad)} demasiado corta</h3>
        <p style={{ margin: '0 0 16px', fontSize: 14, color: '#B8BAC2', lineHeight: 1.4 }}>{verbo} al menos {MINIMO_DE_SEGUNDOS} segundos para guardar tu actividad.</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <button type="button" onClick={onDescartar} style={{ minHeight: 46, borderRadius: 14, border: 'none', background: '#2C2D33', color: '#fff', fontFamily: FONT, fontWeight: 800, fontSize: 15, cursor: 'pointer', touchAction: 'manipulation' }}>Descartar</button>
          <button ref={seguir} type="button" onClick={onSeguir} style={{ minHeight: 46, borderRadius: 14, border: 'none', background: '#fff', color: '#111318', fontFamily: FONT, fontWeight: 800, fontSize: 15, cursor: 'pointer', touchAction: 'manipulation' }}>Seguir {seguirHaciendo}</button>
        </div>
      </div>
    </div>
  );
}
