import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { FONT, KP } from '@/lib/theme';

/**
 * El "¿seguro?" de la app, en vez del `window.confirm` del navegador.
 *
 * POR QUÉ EXISTE. El cuadro gris del navegador tiene tres problemas:
 *   1. En el iPhone sale con el nombre del sitio encima y botones en inglés:
 *      parece un error del sistema, no una pregunta de la app.
 *   2. Bloquea el hilo entero: mientras está abierto, la app se congela.
 *   3. Hay navegadores y paneles de vista previa que directamente NO lo
 *      enseñan y contestan "cancelar" solos. Ahí el botón parece muerto:
 *      lo tocas y no pasa nada. A Andrés le pasó con la X de "crear plan"
 *      (17 sep 2026) y creyó que la app estaba rota.
 *
 * CÓMO SE USA. Es una pregunta que se espera, igual que el confirm de antes:
 *
 *   const pregunta = useConfirmacion();
 *   if (!await pregunta({ titulo: '¿Eliminar la fase?', peligro: true })) return;
 *
 * Devuelve `true` si la persona confirma y `false` si cancela, cierra con
 * Escape o toca fuera. Nunca lanza.
 */

const Ctx = createContext(null);

/** Pregunta de sí o no, sin proveedor: no se puede preguntar, así que no se hace. */
const SIN_PROVEEDOR = () => Promise.resolve(false);

export function useConfirmacion() {
  return useContext(Ctx) ?? SIN_PROVEEDOR;
}

export function ConfirmacionProvider({ children }) {
  const [abierta, setAbierta] = useState(null);
  const resolver = useRef(null);
  const botonRef = useRef(null);

  const pregunta = useCallback((opciones) => {
    const texto = typeof opciones === 'string' ? { titulo: opciones } : (opciones || {});
    return new Promise((resolve) => {
      resolver.current = resolve;
      setAbierta({
        titulo: texto.titulo || '¿Seguro?',
        detalle: texto.detalle || '',
        confirmar: texto.confirmar || 'Sí, continuar',
        cancelar: texto.cancelar || 'Cancelar',
        peligro: !!texto.peligro,
      });
    });
  }, []);

  const cierra = useCallback((respuesta) => {
    setAbierta(null);
    const r = resolver.current;
    resolver.current = null;
    if (r) r(respuesta);
  }, []);

  // Escape cancela. El foco entra al botón que confirma: quien use teclado
  // contesta con Enter sin buscar nada, y quien use lector de pantalla
  // escucha la pregunta al abrirse.
  useEffect(() => {
    if (!abierta) return undefined;
    const alTeclear = (e) => { if (e.key === 'Escape') cierra(false); };
    document.addEventListener('keydown', alTeclear);
    botonRef.current?.focus();
    return () => document.removeEventListener('keydown', alTeclear);
  }, [abierta, cierra]);

  const color = abierta?.peligro ? KP.danger : KP.blue;

  return (
    <Ctx.Provider value={pregunta}>
      {children}
      {abierta && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={abierta.titulo}
          onClick={(e) => { if (e.target === e.currentTarget) cierra(false); }}
          style={{
            position: 'fixed', inset: 0, zIndex: 5000, display: 'grid', placeItems: 'center',
            padding: 20, background: 'rgba(17, 19, 24, 0.45)', fontFamily: FONT,
          }}
        >
          <div
            className="animate-fade-in"
            style={{
              width: '100%', maxWidth: 380, background: KP.surface, borderRadius: 20,
              border: `1px solid ${KP.line}`, boxShadow: KP.shPop, padding: 22,
              display: 'flex', flexDirection: 'column', gap: 14,
            }}
          >
            <div style={{ display: 'flex', gap: 13, alignItems: 'flex-start' }}>
              {abierta.peligro && (
                <span
                  style={{
                    width: 38, height: 38, borderRadius: 12, flexShrink: 0,
                    background: KP.dangerSoft, color: KP.danger, display: 'grid', placeItems: 'center',
                  }}
                >
                  <AlertTriangle size={19} />
                </span>
              )}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 17, fontWeight: 800, color: KP.ink, lineHeight: 1.3 }}>
                  {abierta.titulo}
                </div>
                {abierta.detalle && (
                  <div style={{ fontSize: 13.5, color: KP.ink2, lineHeight: 1.5, marginTop: 6, fontWeight: 500 }}>
                    {abierta.detalle}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 9 }}>
              <button
                type="button"
                onClick={() => cierra(false)}
                className="kp-press"
                style={{
                  flex: 1, padding: '13px 14px', borderRadius: 13, cursor: 'pointer',
                  border: `1.5px solid ${KP.line}`, background: KP.surface, color: KP.ink,
                  fontFamily: FONT, fontSize: 14.5, fontWeight: 700,
                }}
              >
                {abierta.cancelar}
              </button>
              <button
                ref={botonRef}
                type="button"
                onClick={() => cierra(true)}
                className="kp-press"
                style={{
                  flex: 1, padding: '13px 14px', borderRadius: 13, cursor: 'pointer',
                  border: 'none', background: color, color: '#fff',
                  fontFamily: FONT, fontSize: 14.5, fontWeight: 800,
                }}
              >
                {abierta.confirmar}
              </button>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}
