import { useMemo, useState } from 'react';
import { ChevronRight, Folder, FolderPlus, Loader2 } from 'lucide-react';
import { T, FONT } from '@/lib/theme';
import {
  cabeCarpetaEn, descendientesDe, hijasDe, puedeMoverCarpeta, rutaDeCarpeta, textoDeRuta,
} from '@/lib/misPlanesDatos';
import { botonBlanco, campo } from '@/features/misplanes/estilos';

/**
 * Para elegir una carpeta: se entra de carpeta en carpeta, como en la compu, y la que se está
 * viendo es la elegida («Se guardará en: Football › Fuerza»). Arriba de todo es «Sin carpeta».
 *
 * `valor`/`onCambio`: la carpeta elegida (`null` = sin carpeta). `excluirId`: al MOVER una carpeta, no
 * puede ir dentro de sí misma ni de lo que cuelga de ella, y se esconde. `crearCarpeta(nombre, padreId)`
 * crea una carpeta y devuelve la fila: se entra a ella de una vez.
 */
export default function SelectorDeCarpeta({ carpetas, valor, onCambio, excluirId = null, crearCarpeta }) {
  const [nivel, setNivel] = useState(valor ?? null);
  const [creando, setCreando] = useState(false);
  const [nombre, setNombre] = useState('');
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState('');

  const escondidas = useMemo(
    () => (excluirId ? new Set([excluirId, ...descendientesDe(carpetas, excluirId)]) : new Set()),
    [carpetas, excluirId],
  );
  const hijas = hijasDe(carpetas, nivel).filter((c) => !escondidas.has(c.id));
  const ruta = rutaDeCarpeta(carpetas, nivel);
  const permitido = excluirId ? puedeMoverCarpeta(carpetas, excluirId, nivel) : true;

  const entrar = (id) => { setNivel(id); onCambio(id); setCreando(false); setError(''); };

  async function crear() {
    const limpio = nombre.trim();
    if (!limpio || trabajando) return;
    setTrabajando(true);
    setError('');
    try {
      const fila = await crearCarpeta(limpio, nivel);
      setNombre('');
      setCreando(false);
      entrar(fila.id);
    } catch (e) {
      setError(e.message || 'No se pudo crear la carpeta');
    } finally {
      setTrabajando(false);
    }
  }

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
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        {migaja('Sin carpeta', () => entrar(null), nivel == null)}
        {ruta.map((c, i) => (
          <span key={c.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
            <ChevronRight size={13} color={T.text3} />
            {migaja(c.nombre, () => entrar(c.id), i === ruta.length - 1)}
          </span>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
        {hijas.map((c) => (
          <button
            key={c.id} type="button" onClick={() => entrar(c.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 11, textAlign: 'left', cursor: 'pointer', padding: '10px 12px',
              background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 12, fontFamily: FONT,
            }}
          >
            <Folder size={17} color={T.text2} />
            <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 700, color: T.text, overflowWrap: 'anywhere' }}>{c.nombre}</span>
            <ChevronRight size={15} color={T.text3} />
          </button>
        ))}
        {hijas.length === 0 && (
          <div style={{ fontSize: 13, fontWeight: 600, color: T.text3, padding: '6px 2px' }}>
            {nivel == null ? 'Todavía no tienes carpetas.' : 'Esta carpeta no tiene subcarpetas.'}
          </div>
        )}
      </div>

      {crearCarpeta && (creando ? (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre de la carpeta"
            onKeyDown={(e) => { if (e.key === 'Enter') crear(); if (e.key === 'Escape') setCreando(false); }}
            style={{ ...campo, flex: 1 }}
          />
          <button type="button" onClick={crear} disabled={!nombre.trim() || trabajando} style={botonBlanco(true, !nombre.trim() || trabajando)}>
            {trabajando ? <Loader2 size={15} className="spin" /> : 'Crear'}
          </button>
        </div>
      ) : (
        cabeCarpetaEn(carpetas, nivel) ? (
          <button type="button" onClick={() => setCreando(true)} style={{ ...botonBlanco(true), alignSelf: 'flex-start' }}>
            <FolderPlus size={16} /> Nueva carpeta aquí
          </button>
        ) : (
          <div style={{ fontSize: 12.5, fontWeight: 600, color: T.text3 }}>Ya no caben más carpetas dentro de esta.</div>
        )
      ))}
      {error && <div style={{ fontSize: 13, fontWeight: 700, color: T.danger }}>{error}</div>}

      <div style={{ fontSize: 13, fontWeight: 700, color: permitido ? T.text2 : T.danger }}>
        {permitido ? `Se pondrá en: ${textoDeRuta(carpetas, nivel)}` : 'Ahí no se puede poner: queda dentro de sí misma o pasa del límite de niveles.'}
      </div>
    </div>
  );
}
