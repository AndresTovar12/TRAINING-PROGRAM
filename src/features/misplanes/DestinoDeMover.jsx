import { useMemo, useState } from 'react';
import { FolderOpen, Folder, FolderPlus, Search } from 'lucide-react';
import { T, FONT } from '@/lib/theme';
import {
  arbolDeCarpetas, cabeCarpetaEn, coincide, puedenMoverseCarpetas, textoDeRuta,
} from '@/lib/misPlanesDatos';
import Ventana from '@/features/misplanes/Ventana';
import DialogoGuardar from '@/features/misplanes/DialogoGuardar';
import { campo } from '@/features/misplanes/estilos';

/**
 * «Mover a…»: tus carpetas puestas como un árbol, con sangría (la de adentro un poco más a la derecha), y UN
 * toque en la carpeta mueve (Andrés, 2 oct 2026: antes eran cuatro toques y de una en una). La sangría es
 * también la forma de que se note que una carpeta puede tener carpetas adentro; y cada fila tiene su «+» para
 * crear una carpeta dentro de esa.
 *
 * `cosas`: `{ items, carpetas }` lo que se va a mover. `alElegir(destinoId)`: `null` = arriba de todo («Sin
 * carpeta»). `crearCarpeta(nombre, padreId)` crea la carpeta y vuelve a leer la lista (llega entonces en
 * `carpetas`). Una fila se apaga si ahí YA está todo lo que se mueve, o si una carpeta no cabe ahí (dentro de sí
 * misma o pasando del límite de niveles).
 */
export default function DestinoDeMover({ titulo, cosas, carpetas, alElegir, crearCarpeta, onCerrar }) {
  const [buscar, setBuscar] = useState('');
  const [nueva, setNueva] = useState(null); // { padre, nombre }: dentro de cuál se crea una carpeta
  const arbol = useMemo(() => arbolDeCarpetas(carpetas), [carpetas]);
  const items = cosas.items ?? [];
  const aMover = cosas.carpetas ?? [];
  const buscando = buscar.trim().length > 0;

  const yaEstaAhi = (id) => items.every((i) => (i.carpetaId ?? null) === id) && aMover.every((c) => (c.parent_id ?? null) === id);
  const filas = buscando
    ? arbol.filter(({ carpeta }) => coincide({ nombre: carpeta.nombre }, buscar)).map(({ carpeta }) => ({ carpeta, nivel: 0 }))
    : arbol;

  const fila = ({ id, nombre, nivel, ruta }) => {
    const aqui = yaEstaAhi(id);
    const noCabe = !puedenMoverseCarpetas(carpetas, aMover, id);
    const apagada = aqui || noCabe;
    const Icono = id == null ? FolderOpen : Folder;
    return (
      <div key={id ?? 'arriba'} style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: nivel * 16 }}>
        <button
          type="button" disabled={apagada} onClick={() => alElegir(id)}
          title={noCabe && !aqui ? 'Ahí no cabe: quedaría dentro de sí misma o pasaría del límite de niveles.' : undefined}
          style={{
            flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 11, textAlign: 'left', padding: '10px 12px',
            cursor: apagada ? 'default' : 'pointer', background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 12,
            fontFamily: FONT, opacity: noCabe && !aqui ? 0.45 : 1,
          }}
        >
          <Icono size={18} color={id == null ? T.accent : T.text2} style={{ flexShrink: 0 }} />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: T.text, overflowWrap: 'anywhere' }}>{nombre}</span>
            {ruta && <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.text3, marginTop: 1 }}>{ruta}</span>}
          </span>
          {aqui && <span style={{ fontSize: 12, fontWeight: 700, color: T.text3, flexShrink: 0 }}>Está aquí</span>}
        </button>
        {cabeCarpetaEn(carpetas, id) && (
          <button
            type="button" onClick={() => setNueva({ padre: id, nombre })} className="kp-ico"
            aria-label={id == null ? 'Nueva carpeta' : `Nueva carpeta dentro de ${nombre}`}
            title={id == null ? 'Nueva carpeta' : `Nueva carpeta dentro de «${nombre}»`}
            style={{ width: 38, height: 38, borderRadius: 11, border: 'none', cursor: 'pointer', flexShrink: 0, background: 'transparent', color: T.accent, display: 'grid', placeItems: 'center' }}
          >
            <FolderPlus size={18} />
          </button>
        )}
      </div>
    );
  };

  return (
    <Ventana titulo={titulo} subtitulo="Toca la carpeta a donde va." onCerrar={onCerrar} ancho={480}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {arbol.length > 8 && (
          <div style={{ position: 'relative', marginBottom: 2 }}>
            <Search size={16} color={T.text3} style={{ position: 'absolute', left: 12, top: 13 }} />
            <input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar carpeta" style={{ ...campo, paddingLeft: 36 }} />
          </div>
        )}
        {!buscando && fila({ id: null, nombre: 'Sin carpeta', nivel: 0 })}
        {filas.map(({ carpeta, nivel }) => fila({
          id: carpeta.id, nombre: carpeta.nombre, nivel, ruta: buscando && carpeta.parent_id ? textoDeRuta(carpetas, carpeta.parent_id) : null,
        }))}
        {buscando && filas.length === 0 && (
          <div style={{ fontSize: 13.5, fontWeight: 600, color: T.text3, padding: 10 }}>Nada coincide con «{buscar.trim()}».</div>
        )}
        {!buscando && arbol.length === 0 && (
          <div style={{ fontSize: 13.5, fontWeight: 600, color: T.text3, padding: '4px 2px' }}>
            Todavía no tienes carpetas. Crea la primera con el botón de la carpeta con «+».
          </div>
        )}
      </div>

      {nueva && (
        <DialogoGuardar
          titulo={nueva.padre == null ? 'Nueva carpeta' : `Nueva carpeta dentro de «${nueva.nombre}»`}
          soloNombre textoBoton="Crear" placeholder="Ej. Pretemporada"
          onGuardar={async ({ nombre }) => { await crearCarpeta(nombre, nueva.padre); }}
          onCerrar={() => setNueva(null)}
        />
      )}
    </Ventana>
  );
}
