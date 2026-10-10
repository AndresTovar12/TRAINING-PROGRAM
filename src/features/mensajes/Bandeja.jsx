import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { T, KP, FONT } from '@/lib/theme';
import { Avatar, NumeroRojo } from '@/features/mensajes/piezas';
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
        width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', cursor: 'pointer', textAlign: 'left', fontFamily: FONT, touchAction: 'manipulation',
        border: `1px solid ${abierta ? `${T.accent}55` : KP.line}`, borderRadius: 18, background: abierta ? T.accentBg : KP.surface,
      }}
    >
      <Avatar nombre={f.otro_nombre} url={f.otro_avatar} tam={48} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ flex: 1, minWidth: 0, fontSize: 15.5, fontWeight: 800, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.otro_nombre}</span>
          <span style={{ flexShrink: 0, fontSize: 12, fontWeight: 700, color: f.sin_leer ? KP.danger : T.text3, fontVariantNumeric: 'tabular-nums' }}>{cuandoTexto(f.ultimo_en)}</span>
        </span>
        {etiqueta && <span style={{ display: 'block', fontSize: 12, fontWeight: 700, color: T.accent, marginTop: 1 }}>{etiqueta}</span>}
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
          <span style={{
            flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: f.sin_leer ? 700 : 500, color: f.sin_leer ? T.text : T.text2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            fontStyle: f.ultimo_borrado ? 'italic' : 'normal',
          }}
          >
            {previa || (f.activa ? 'Escribe el primer mensaje' : '')}
          </span>
          {f.por_revisar > 0 && (
            <span style={{ flexShrink: 0, padding: '2px 8px', borderRadius: 999, background: KP.blueSoft, color: T.accent, fontSize: 11.5, fontWeight: 800 }}>
              {f.por_revisar === 1 ? '1 por revisar' : `${f.por_revisar} por revisar`}
            </span>
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

  const chip = (id, texto, n) => (
    <button
      key={id} type="button" aria-pressed={filtro === id} onClick={() => setFiltro(id)} className="kp-press"
      style={{
        minHeight: 38, padding: '0 14px', borderRadius: 999, cursor: 'pointer', fontFamily: FONT, fontSize: 13.5, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 6, touchAction: 'manipulation',
        border: `1.5px solid ${filtro === id ? T.accent : T.borderHi}`, background: filtro === id ? T.accent : KP.surface, color: filtro === id ? '#fff' : T.text,
      }}
    >
      {texto}{n > 0 && <span style={{ fontVariantNumeric: 'tabular-nums', opacity: 0.85 }}>{n}</span>}
    </button>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {conFiltros && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 2 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {chip('todas', 'Todas', 0)}
            {chip('sin_leer', 'Sin leer', totales.sin_leer)}
            {chip('por_revisar', 'Por revisar', totales.por_revisar)}
          </div>
          {filas.length > MUCHAS && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 44, padding: '0 14px', borderRadius: 14, background: KP.surface, border: `1.5px solid ${T.border}` }}>
              <Search size={17} color={T.text3} aria-hidden="true" />
              <input
                type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar persona" aria-label="Buscar persona"
                style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontFamily: FONT, fontSize: 16, color: T.text }}
              />
            </label>
          )}
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
