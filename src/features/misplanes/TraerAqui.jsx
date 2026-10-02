import { useMemo, useState } from 'react';
import { Folder, Search } from 'lucide-react';
import { T, FONT } from '@/lib/theme';
import {
  ETIQUETA_DE_TIPO, TIPOS, carpetasQueSePuedenTraer, claveDeCarpeta, claveDeItem, coincide, porNombre, textoDeResumen, textoDeRuta,
} from '@/lib/misPlanesDatos';
import Ventana from '@/features/misplanes/Ventana';
import FiltroDeTipo from '@/features/misplanes/FiltroDeTipo';
import {
  botonBlanco, botonPrincipal, campo, COLOR_DE_TIPO, etiquetaChica, FONDO_DE_TIPO, ICONO_DE_TIPO,
} from '@/features/misplanes/estilos';

/**
 * «Traer algo que ya tengo»: lo que ya guardaste —cosas sueltas y las de otras carpetas, y también carpetas
 * enteras— con una casilla cada uno; al terminar se mueve todo a ESTA carpeta (Andrés, 2 oct 2026: poder
 * agregar a una carpeta lo que existe ya). Lo que ya está aquí no sale. Las cosas van agrupadas por la
 * carpeta donde están hoy, para encontrarlas por su lugar.
 *
 * `alTraer({ items, carpetas })` recibe lo elegido (las filas ya leídas) y quien llama lo mueve.
 */
export default function TraerAqui({ carpetaId, carpetas, items, alTraer, onCerrar }) {
  const [buscar, setBuscar] = useState('');
  const [filtro, setFiltro] = useState(null);
  const [elegidos, setElegidos] = useState(() => new Set());
  const aqui = carpetas.find((c) => c.id === carpetaId);

  const posibles = useMemo(() => {
    const tipos = filtro ? [filtro] : TIPOS;
    const cosas = items.filter((i) => (i.carpetaId ?? null) !== (carpetaId ?? null) && tipos.includes(i.tipo) && coincide(i, buscar));
    // Con un filtro de clase puesto, las carpetas no entran: no son de ninguna clase.
    const lasCarpetas = filtro ? [] : carpetasQueSePuedenTraer(carpetas, carpetaId)
      .filter((c) => coincide({ nombre: c.nombre }, buscar)).sort(porNombre);
    const porLugar = new Map();
    cosas.forEach((i) => {
      const lugar = i.carpetaId ?? null;
      if (!porLugar.has(lugar)) porLugar.set(lugar, []);
      porLugar.get(lugar).push(i);
    });
    const grupos = [...porLugar.entries()]
      .map(([id, lista]) => ({ id, titulo: textoDeRuta(carpetas, id), lista: lista.sort(porNombre) }))
      .sort((a, b) => (a.id == null ? -1 : b.id == null ? 1 : a.titulo.localeCompare(b.titulo, 'es', { sensitivity: 'base' })));
    return { carpetas: lasCarpetas, grupos, total: cosas.length + lasCarpetas.length };
  }, [items, carpetas, carpetaId, filtro, buscar]);

  const alternar = (clave) => setElegidos((prev) => {
    const n = new Set(prev);
    if (n.has(clave)) n.delete(clave); else n.add(clave);
    return n;
  });

  const traer = () => alTraer({
    items: items.filter((i) => elegidos.has(claveDeItem(i))),
    carpetas: carpetas.filter((c) => elegidos.has(claveDeCarpeta(c))),
  });

  const fila = (clave, Icono, color, fondo, nombre, linea) => (
    <label
      key={clave}
      style={{
        display: 'flex', alignItems: 'center', gap: 11, cursor: 'pointer', padding: '9px 12px', background: T.bg2,
        border: `1.5px solid ${elegidos.has(clave) ? T.accent : T.border}`, borderRadius: 12,
      }}
    >
      <input type="checkbox" checked={elegidos.has(clave)} onChange={() => alternar(clave)} style={{ width: 19, height: 19, accentColor: T.accent, flexShrink: 0 }} />
      <span style={{ width: 34, height: 34, borderRadius: 10, background: fondo, color, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
        <Icono size={17} />
      </span>
      <span style={{ flex: 1, minWidth: 0, fontFamily: FONT }}>
        <span style={{ display: 'block', fontSize: 14, fontWeight: 800, color: T.text, overflowWrap: 'anywhere' }}>{nombre}</span>
        {linea && <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color, marginTop: 1 }}>{linea}</span>}
      </span>
    </label>
  );

  const n = elegidos.size;
  return (
    <Ventana
      titulo={aqui ? `Traer a «${aqui.nombre}»` : 'Traer'} subtitulo="Marca lo que quieras meter en esta carpeta." onCerrar={onCerrar} ancho={520}
      pie={(
        <>
          <button type="button" onClick={onCerrar} style={botonBlanco()}>Cancelar</button>
          <button type="button" onClick={traer} disabled={n === 0} style={botonPrincipal(n === 0)}>
            {n === 0 ? 'Traer' : `Traer ${n}`}
          </button>
        </>
      )}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
            <Search size={16} color={T.text3} style={{ position: 'absolute', left: 12, top: 13 }} />
            <input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar en Mis planes" style={{ ...campo, paddingLeft: 36 }} />
          </div>
          <FiltroDeTipo tipos={TIPOS} valor={filtro} onCambio={setFiltro} />
        </div>

        {posibles.total === 0 && (
          <div style={{ textAlign: 'center', padding: '26px 12px', fontSize: 13.5, fontWeight: 600, color: T.text3 }}>
            {buscar.trim() || filtro ? 'Nada coincide.' : 'No tienes nada más para traer.'}
          </div>
        )}

        {posibles.carpetas.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={etiquetaChica}>Carpetas</div>
            {posibles.carpetas.map((c) => fila(
              claveDeCarpeta(c), Folder, T.text2, T.bg3, c.nombre,
              `en ${c.parent_id ? textoDeRuta(carpetas, c.parent_id) : 'Mis planes'}`,
            ))}
          </div>
        )}

        {posibles.grupos.map((g) => (
          <div key={g.id ?? 'arriba'} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={etiquetaChica}>{g.titulo}</div>
            {g.lista.map((i) => fila(
              claveDeItem(i), ICONO_DE_TIPO[i.tipo], COLOR_DE_TIPO[i.tipo], FONDO_DE_TIPO[i.tipo], i.nombre,
              [ETIQUETA_DE_TIPO[i.tipo], textoDeResumen(i.tipo, i.resumen)].filter(Boolean).join(' · '),
            ))}
          </div>
        ))}
      </div>
    </Ventana>
  );
}
