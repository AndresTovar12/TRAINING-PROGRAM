import { ChevronRight, Folder } from 'lucide-react';
import { T, FONT } from '@/lib/theme';
import {
  TIPOS, ETIQUETA_DE_TIPO, coincide, descendientesDe, hijasDe, porNombre, rutaDeCarpeta, textoDeResumen, textoDeRuta,
} from '@/lib/misPlanesDatos';
import { COLOR_DE_TIPO, FONDO_DE_TIPO, ICONO_DE_TIPO } from '@/features/misplanes/estilos';

/* Lo que se enseña de «Mis planes»: las carpetas de un nivel y lo que hay dentro, con su ruta arriba.
   Lo usan la pestaña (con sus botones por fila) y los selectores («Desde Mis planes», «Asignar»),
   que solo dejan elegir. Con texto en `buscar` se busca en TODAS las carpetas y cada resultado dice
   en cuál está. */

// «hace 3 días», para saber qué tan reciente es lo guardado.
function hace(fecha) {
  const ms = Date.now() - new Date(fecha).getTime();
  const min = Math.round(ms / 60000);
  if (!Number.isFinite(min) || min < 1) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  if (d < 30) return d === 1 ? 'ayer' : `hace ${d} días`;
  return new Date(fecha).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function ListaDeMisPlanes({
  carpetas, items, tipos = TIPOS, nivel = null, onNivel, buscar = '', onItem, accionesItem, accionesCarpeta, vacio,
}) {
  const buscando = buscar.trim().length > 0;
  const visibles = items.filter((i) => tipos.includes(i.tipo));
  const subcarpetas = buscando ? [] : hijasDe(carpetas, nivel);
  const enNivel = (buscando
    ? visibles.filter((i) => coincide(i, buscar))
    : visibles.filter((i) => (i.carpetaId ?? null) === (nivel ?? null))
  ).sort(porNombre);
  const ruta = rutaDeCarpeta(carpetas, nivel);

  // Cuántas cosas hay dentro de una carpeta, contando lo de sus subcarpetas.
  const cuantasEn = (id) => {
    const dentro = new Set([id, ...descendientesDe(carpetas, id)]);
    return visibles.filter((i) => dentro.has(i.carpetaId)).length;
  };

  const migaja = (texto, alTocar, ultima) => (
    <button
      type="button" onClick={alTocar} disabled={ultima}
      style={{
        border: 'none', background: 'transparent', padding: '4px 2px', cursor: ultima ? 'default' : 'pointer',
        fontFamily: FONT, fontSize: 13, fontWeight: ultima ? 800 : 700, color: ultima ? T.text : T.accent,
      }}
    >
      {texto}
    </button>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {!buscando && (nivel != null) && (
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 2, marginBottom: 2 }}>
          {migaja('Mis planes', () => onNivel(null), false)}
          {ruta.map((c, i) => (
            <span key={c.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
              <ChevronRight size={13} color={T.text3} />
              {migaja(c.nombre, () => onNivel(c.id), i === ruta.length - 1)}
            </span>
          ))}
        </div>
      )}

      {subcarpetas.map((c) => {
        const n = cuantasEn(c.id);
        const hijas = hijasDe(carpetas, c.id).length;
        return (
          <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              type="button" onClick={() => onNivel(c.id)}
              style={{
                flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', cursor: 'pointer',
                padding: '12px 13px', background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 14, fontFamily: FONT,
              }}
            >
              <span style={{ width: 38, height: 38, borderRadius: 11, background: T.bg3, color: T.text2, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <Folder size={19} />
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 14.5, fontWeight: 800, color: T.text, overflowWrap: 'anywhere' }}>{c.nombre}</span>
                <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.text3, marginTop: 2 }}>
                  {[hijas ? `${hijas} ${hijas === 1 ? 'carpeta' : 'carpetas'}` : null, n ? `${n} ${n === 1 ? 'cosa' : 'cosas'}` : null]
                    .filter(Boolean).join(' · ') || 'Vacía'}
                </span>
              </span>
              <ChevronRight size={16} color={T.text3} style={{ flexShrink: 0 }} />
            </button>
            {accionesCarpeta?.(c)}
          </div>
        );
      })}

      {enNivel.map((item) => {
        const Icono = ICONO_DE_TIPO[item.tipo];
        const color = COLOR_DE_TIPO[item.tipo];
        const resumen = textoDeResumen(item.tipo, item.resumen);
        return (
          // Una sola tarjeta: el contenido a la izquierda y las acciones («Asignar», «⋯») a la derecha; en un celular, que no
          // cabe todo en una línea, las acciones bajan dentro de la misma tarjeta en lugar de aplastar el nombre.
          <div
            key={`${item.tabla}-${item.id}`}
            style={{
              display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0 6px', background: T.bg2,
              border: `1px solid ${T.border}`, borderRadius: 14,
            }}
          >
            <button
              type="button" onClick={() => onItem?.(item)} disabled={!onItem}
              style={{
                flex: '1 1 240px', minWidth: 0, display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
                cursor: onItem ? 'pointer' : 'default', padding: '12px 13px', background: 'transparent',
                border: 'none', borderRadius: 14, fontFamily: FONT,
              }}
            >
              <span style={{ width: 38, height: 38, borderRadius: 11, background: FONDO_DE_TIPO[item.tipo], color, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <Icono size={19} />
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '3px 8px' }}>
                  <span style={{ fontSize: 14.5, fontWeight: 800, color: T.text, overflowWrap: 'anywhere' }}>{item.nombre}</span>
                  {item.origen && (
                    <span style={{ fontSize: 10.5, fontWeight: 800, color: T.text2, background: T.bg3, borderRadius: 6, padding: '2px 7px', letterSpacing: 0.2 }}>
                      {item.origen}
                    </span>
                  )}
                </span>
                <span style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color, marginTop: 3 }}>
                  {[ETIQUETA_DE_TIPO[item.tipo], resumen].filter(Boolean).join(' · ')}
                </span>
                {item.descripcion && (
                  <span style={{ display: 'block', fontSize: 12.5, fontWeight: 500, color: T.text2, marginTop: 3, lineHeight: 1.4, overflowWrap: 'anywhere' }}>
                    {item.descripcion}
                  </span>
                )}
                <span style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: T.text3, marginTop: 3 }}>
                  {buscando ? `${textoDeRuta(carpetas, item.carpetaId)} · ` : ''}{hace(item.actualizado)}
                </span>
              </span>
            </button>
            {accionesItem && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto', padding: '8px 10px' }}>
                {accionesItem(item)}
              </div>
            )}
          </div>
        );
      })}

      {subcarpetas.length === 0 && enNivel.length === 0 && (
        vacio ?? (
          <div style={{ textAlign: 'center', padding: '30px 16px', color: T.text3, fontWeight: 600, fontSize: 13.5, lineHeight: 1.5 }}>
            {buscando ? `Nada coincide con «${buscar.trim()}».` : 'Aquí no hay nada todavía.'}
          </div>
        )
      )}
    </div>
  );
}
