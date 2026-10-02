import { useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { T, FONT } from '@/lib/theme';
import { PLURAL_DE_TIPO } from '@/lib/misPlanesDatos';
import { useMisPlanes } from '@/lib/useMisPlanes';
import Ventana from '@/features/misplanes/Ventana';
import ListaDeMisPlanes from '@/features/misplanes/ListaDeMisPlanes';
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

  const chip = (valor, texto) => {
    const activa = filtro === valor;
    return (
      <button
        key={texto} type="button" onClick={() => setFiltro(valor)}
        style={{
          padding: '7px 13px', borderRadius: 999, cursor: 'pointer', fontFamily: FONT, fontSize: 13, fontWeight: 800, whiteSpace: 'nowrap',
          border: `1.5px solid ${activa ? T.accent : T.border}`, background: activa ? T.accent : T.bg2, color: activa ? '#fff' : T.text2,
        }}
      >
        {texto}
      </button>
    );
  };

  return (
    <Ventana titulo={titulo} subtitulo={subtitulo} onCerrar={onCerrar} ancho={520}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ position: 'relative' }}>
          <Search size={16} color={T.text3} style={{ position: 'absolute', left: 12, top: 13 }} />
          <input
            value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar por nombre o descripción"
            style={{ ...campo, paddingLeft: 36 }}
          />
        </div>
        {tipos.length > 1 && (
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
            {chip(null, 'Todo')}
            {tipos.map((t) => chip(t, PLURAL_DE_TIPO[t]))}
          </div>
        )}
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
