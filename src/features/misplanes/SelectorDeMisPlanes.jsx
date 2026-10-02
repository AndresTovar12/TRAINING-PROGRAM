import { useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { T } from '@/lib/theme';
import { useMisPlanes } from '@/lib/useMisPlanes';
import Ventana from '@/features/misplanes/Ventana';
import ListaDeMisPlanes from '@/features/misplanes/ListaDeMisPlanes';
import FiltroDeTipo from '@/features/misplanes/FiltroDeTipo';
import { campo } from '@/features/misplanes/estilos';

/**
 * «Desde Mis planes»: elegir algo de lo guardado, navegando por las carpetas o buscando. Lo usan el
 * editor (un workout para un día, una rutina para una semana), la pantalla de crear un plan y la
 * ficha de un atleta. Solo deja ELEGIR: guardar, mover o borrar se hace en la pestaña Mis planes.
 *
 * `tipos`: qué clases de cosas enseña. `onElegir(item)` recibe la fila (sin su contenido: se abre
 * con `abrirItem`).
 */
export default function SelectorDeMisPlanes({ tipos, titulo = 'Desde Mis planes', subtitulo, onElegir, onCerrar }) {
  const { cargando, error, carpetas, items } = useMisPlanes();
  const [nivel, setNivel] = useState(null);
  const [buscar, setBuscar] = useState('');
  const [filtro, setFiltro] = useState(null);
  const tiposVistos = filtro ? [filtro] : tipos;

  return (
    <Ventana titulo={titulo} subtitulo={subtitulo} onCerrar={onCerrar} ancho={520}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
            <Search size={16} color={T.text3} style={{ position: 'absolute', left: 12, top: 13 }} />
            <input
              value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar en Mis planes"
              style={{ ...campo, paddingLeft: 36 }}
            />
          </div>
          <FiltroDeTipo tipos={tipos} valor={filtro} onCambio={setFiltro} />
        </div>
        {cargando ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.text2, fontWeight: 600, padding: 16 }}>
            <Loader2 size={16} className="spin" /> Cargando…
          </div>
        ) : error ? (
          <div style={{ color: T.danger, fontWeight: 700, fontSize: 13.5 }}>{error}</div>
        ) : (
          <ListaDeMisPlanes
            carpetas={carpetas} items={items} tipos={tiposVistos} nivel={nivel} onNivel={setNivel} buscar={buscar}
            onItem={onElegir}
            vacio={(
              <div style={{ textAlign: 'center', padding: '28px 16px', color: T.text3, fontWeight: 600, fontSize: 13.5, lineHeight: 1.5 }}>
                {buscar.trim()
                  ? `Nada coincide con «${buscar.trim()}».`
                  : nivel != null ? 'Esta carpeta está vacía.' : 'Todavía no has guardado nada de esto en Mis planes.'}
              </div>
            )}
          />
        )}
      </div>
    </Ventana>
  );
}
