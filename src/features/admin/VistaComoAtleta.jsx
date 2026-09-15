import { useEffect } from 'react';
import { Eye, X } from 'lucide-react';
import { VistaDeAtletaProvider } from '@/contexts/VistaContext';
import { AppStateProvider } from '@/contexts/AppStateContext';
import { PlanProvider } from '@/contexts/PlanContext';
import TrainingApp from '@/features/training/TrainingApp';
import { FONT, KP } from '@/lib/theme';

const ALTO_AVISO = 52;

/**
 * La app de un atleta, tal como la ve él, abierta desde la cuenta de su coach
 * (o del master). Ver `VistaContext` para lo que es y lo que no es.
 *
 * El aviso de arriba no se puede cerrar ni se va al bajar: mientras esté la app
 * del atleta en pantalla, tiene que quedar claro de quién es y que no se guarda
 * nada. Sin él, un coach anotaría pesos creyendo que se guardan.
 */
export default function VistaComoAtleta({ atleta, onSalir }) {
  // Lo que la app del atleta pega arriba —la barra de fases y el botón de la
  // cuenta— se corre la altura del aviso leyendo esta variable. Fuera de este
  // modo no existe, vale 0 y nada se mueve.
  useEffect(() => {
    const raiz = document.documentElement;
    raiz.style.setProperty('--aviso-vista', `${ALTO_AVISO}px`);
    return () => raiz.style.removeProperty('--aviso-vista');
  }, []);

  const nombre = atleta.full_name || atleta.username;

  return (
    <VistaDeAtletaProvider atleta={atleta}>
      <div
        role="status"
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, height: ALTO_AVISO, zIndex: 1200,
          display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px',
          background: `linear-gradient(135deg, ${KP.blue}, ${KP.blueDk})`, color: '#fff',
          boxShadow: '0 2px 12px rgba(17,19,24,0.18)', fontFamily: FONT,
        }}
      >
        <Eye size={18} style={{ flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 13.5, fontWeight: 800, lineHeight: 1.25,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            Viendo como {nombre}
          </div>
          <div style={{ fontSize: 11.5, fontWeight: 600, opacity: 0.85, lineHeight: 1.25, whiteSpace: 'nowrap' }}>
            Nada de lo que toques se guarda
          </div>
        </div>
        <button
          type="button"
          onClick={onSalir}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0,
            height: 34, padding: '0 12px', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: '#fff', color: KP.blue, fontFamily: FONT, fontSize: 13, fontWeight: 800,
          }}
        >
          <X size={15} /> Salir
        </button>
      </div>
      <div style={{ height: ALTO_AVISO }} />
      <AppStateProvider>
        <PlanProvider>
          <TrainingApp />
        </PlanProvider>
      </AppStateProvider>
    </VistaDeAtletaProvider>
  );
}
