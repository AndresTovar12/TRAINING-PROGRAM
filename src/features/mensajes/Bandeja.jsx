import { useMemo, useState } from 'react';
import { T, KP, FONT } from '@/lib/theme';
import { NumeroRojo } from '@/features/mensajes/piezas';
import { Avatar as AvatarDeColor, Buscador, Pastilla, Segmentado } from '@/components/ui';
import { cuandoTexto, llaveDe, vistaPrevia } from '@/features/mensajes/formato';

/* LA LISTA DE CONVERSACIONES: una fila por persona con quien se puede hablar, la más reciente arriba.

   Al atleta le salen su coach y cada profesional de su equipo (una conversación con cada uno). Al profesional le salen sus atletas, y trae filtros: «Sin leer» y
   «Por revisar» (las técnicas que mandaron y todavía no contesta). Con muchos atletas aparece un buscador.

   `filas`: de la función `bandeja`. `abierta`: la llave de la conversación que está abierta (se resalta en la vista de computadora). */

const MUCHAS = 8;

function Fila({ f, uid, abierta, etiqueta, alAbrir }) {
  const yoEscribi = f.ultimo_autor === uid;
  const previa = vistaPrevia(f, yoEscribi);
  return (
    <button
      type="button" onClick={() => alAbrir(f)} className="kp-press"
      aria-label={`${f.otro_nombre}${f.sin_leer ? `, ${f.sin_leer} sin leer` : ''}`}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 13, padding: '14px 16px', cursor: 'pointer', textAlign: 'left', fontFamily: FONT, touchAction: 'manipulation',
        border: 'none', borderRadius: 20, background: abierta ? T.accentBg : KP.surface, boxShadow: abierta ? `inset 0 0 0 1.5px ${T.accent}55` : '0 2px 10px rgba(17,19,24,0.05)',
      }}
    >
      <AvatarDeColor nombre={f.otro_nombre} foto={f.otro_avatar} tamano={52} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ flex: 1, minWidth: 0, fontSize: 17, fontWeight: 700, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.otro_nombre}</span>
          <span style={{ flexShrink: 0, fontSize: 12, fontWeight: 700, color: f.sin_leer ? KP.danger : T.text3, fontVariantNumeric: 'tabular-nums' }}>{cuandoTexto(f.ultimo_en)}</span>
        </span>
        {etiqueta && <span style={{ display: 'block', fontSize: 12, fontWeight: 700, color: T.accent, marginTop: 1 }}>{etiqueta}</span>}
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
          <span style={{
            flex: 1, minWidth: 0, fontSize: 14.5, fontWeight: f.sin_leer ? 700 : 500, color: f.sin_leer ? T.text : T.text2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            fontStyle: f.ultimo_borrado ? 'italic' : 'normal',
          }}
          >
            {previa || (f.activa ? 'Escribe el primer mensaje' : '')}
          </span>
          {f.por_revisar > 0 && (
            <Pastilla tono="azul">{f.por_revisar === 1 ? '1 por revisar' : `${f.por_revisar} por revisar`}</Pastilla>
          )}
          <NumeroRojo n={f.sin_leer} />
        </span>
      </span>
    </button>
  );
}

export default function Bandeja({ filas, uid, abierta = null, alAbrir, conFiltros = false, etiquetaDe = () => null, vacio = null }) {
  const [filtro, setFiltro] = useState('todas');
  const [busca, setBusca] = useState('');

  const visibles = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return filas.filter((f) => {
      if (filtro === 'sin_leer' && !(f.sin_leer > 0)) return false;
      if (filtro === 'por_revisar' && !(f.por_revisar > 0)) return false;
      if (!q) return true;
      return `${f.otro_nombre} ${f.otro_usuario ?? ''}`.toLowerCase().includes(q);
    });
  }, [filas, filtro, busca]);

  const totales = useMemo(() => ({
    sin_leer: filas.filter((f) => f.sin_leer > 0).length,
    por_revisar: filas.filter((f) => f.por_revisar > 0).length,
  }), [filas]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {conFiltros && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 2 }}>
          {/* Reestructura visual (15 oct 2026): una de tres a la vista (el segmentado de `components/ui`) y el buscador gris. */}
          <Segmentado
            etiqueta="Ver" valor={filtro} onCambio={setFiltro}
            opciones={[
              { valor: 'todas', texto: 'Todas' },
              { valor: 'sin_leer', texto: totales.sin_leer ? `Sin leer · ${totales.sin_leer}` : 'Sin leer' },
              { valor: 'por_revisar', texto: totales.por_revisar ? `Por revisar · ${totales.por_revisar}` : 'Por revisar' },
            ]}
          />
          {filas.length > MUCHAS && <Buscador valor={busca} onCambio={setBusca} marcador="Buscar persona" />}
        </div>
      )}
      {visibles.map((f) => <Fila key={llaveDe(f)} f={f} uid={uid} abierta={abierta === llaveDe(f)} etiqueta={etiquetaDe(f)} alAbrir={alAbrir} />)}
      {visibles.length === 0 && (
        <div style={{ padding: '36px 12px', textAlign: 'center', fontSize: 14.5, fontWeight: 600, color: T.text2 }}>
          {filas.length === 0 ? vacio : (filtro === 'por_revisar' ? 'No hay técnicas por revisar.' : filtro === 'sin_leer' ? 'No tienes mensajes sin leer.' : 'Nadie coincide con la búsqueda.')}
        </div>
      )}
    </div>
  );
}
