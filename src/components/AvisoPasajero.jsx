import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Loader2 } from 'lucide-react';
import { FONT, KP } from '@/lib/theme';

/**
 * El aviso chico que sale abajo un momento: «✓ Guardado en Mis planes».
 *
 * POR QUÉ EXISTE. Andrés, 2 oct 2026: al guardar desde el plan de un atleta la ventana se cerraba y
 * no decía nada; al borrar o mover una carpeta la pantalla tardaba un par de segundos en cambiar sin
 * decir nada. Sin una palabra de vuelta uno no sabe si pasó. Los errores NO van aquí: esos se quedan
 * escritos en la pantalla, donde no desaparecen solos.
 *
 * CÓMO SE USA.
 *   const { avisa, trabajando } = useAviso();
 *   avisa('Guardado en Mis planes');                       // ✓ y se va solo
 *   await trabajando('Eliminando…', () => borrar(), 'Eliminado'); // gira mientras dura, luego ✓
 *   avisa('Movido a «Fuerza»', { accion: { texto: 'Deshacer', alTocar: () => … } }); // con un botón; dura más
 *
 * `trabajando` devuelve lo que devuelva `hacer` y, si falla, quita el aviso y deja pasar el error para
 * que quien llama lo escriba donde corresponde. Sin proveedor no hace nada y `hacer` corre igual.
 */

const Ctx = createContext(null);

const SIN_PROVEEDOR = { avisa: () => {}, trabajando: (_texto, hacer) => hacer() };

// eslint-disable-next-line react-refresh/only-export-components
export const useAviso = () => useContext(Ctx) ?? SIN_PROVEEDOR;

export function AvisoProvider({ children }) {
  const [aviso, setAviso] = useState(null); // { texto, ocupado }
  const reloj = useRef(null);

  const quita = useCallback(() => {
    clearTimeout(reloj.current);
    setAviso(null);
  }, []);

  // Con un botón («Deshacer») el aviso se queda más: da tiempo de verlo y de tocarlo.
  const avisa = useCallback((texto, { accion = null } = {}) => {
    clearTimeout(reloj.current);
    setAviso({ texto, ocupado: false, accion });
    reloj.current = setTimeout(() => setAviso(null), accion ? 7000 : 2600);
  }, []);

  const trabajando = useCallback(async (texto, hacer, listo) => {
    clearTimeout(reloj.current);
    setAviso({ texto, ocupado: true });
    try {
      const resultado = await hacer();
      if (!listo) quita();
      else if (typeof listo === 'string') avisa(listo);
      else avisa(listo.texto, { accion: listo.accion });
      return resultado;
    } catch (e) {
      quita();
      throw e;
    }
  }, [avisa, quita]);

  useEffect(() => () => clearTimeout(reloj.current), []);

  const valor = useMemo(() => ({ avisa, trabajando }), [avisa, trabajando]);

  return (
    <Ctx.Provider value={valor}>
      {children}
      {aviso && createPortal(
        <div
          role="status" aria-live="polite"
          style={{
            position: 'fixed', left: 0, right: 0, bottom: 'calc(22px + env(safe-area-inset-bottom))', zIndex: 6100,
            display: 'flex', justifyContent: 'center', padding: '0 16px', pointerEvents: 'none',
          }}
        >
          <div
            className="animate-fade-in"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 9, maxWidth: '100%', padding: '11px 17px', borderRadius: 999,
              background: 'rgba(17,19,24,0.94)', color: '#fff', fontFamily: FONT, fontSize: 13.5, fontWeight: 700,
              boxShadow: KP.shPop, pointerEvents: aviso.accion ? 'auto' : 'none',
            }}
          >
            {aviso.ocupado
              ? <Loader2 size={16} className="spin" style={{ flexShrink: 0 }} />
              : <Check size={16} color="#3DD9A0" style={{ flexShrink: 0 }} />}
            <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{aviso.texto}</span>
            {aviso.accion && (
              <button
                type="button" onClick={() => { const { alTocar } = aviso.accion; quita(); alTocar(); }}
                style={{
                  border: 'none', background: 'transparent', cursor: 'pointer', color: '#8FA8FF', fontFamily: FONT,
                  fontSize: 13.5, fontWeight: 800, padding: '2px 4px', marginLeft: 2, flexShrink: 0,
                }}
              >
                {aviso.accion.texto}
              </button>
            )}
          </div>
        </div>,
        document.body,
      )}
    </Ctx.Provider>
  );
}
