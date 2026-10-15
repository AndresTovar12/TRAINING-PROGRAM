import { useState } from 'react';
import { ArrowLeft, Library, Play } from 'lucide-react';
import HojaFlotante from '@/components/HojaFlotante';
import TarjetaDeClase from '@/features/training/TarjetaDeClase';
import { duracionTexto } from '@/lib/clases';
import { plural } from '@/lib/plural';
import { LT, FONT } from '@/lib/theme';
import { Grupo, Fila, IconoDeFila } from '@/components/ui';

/* LA BIBLIOTECA DE CLASES, del lado de quien la compró («todas mis clases», 12 oct 2026; ver `docs/sql/2026-10-12-biblioteca-de-clases.sql`).

   Es una membresía: da acceso a TODAS las clases de «Mis planes» de quien la vende, también las que agregue después. Llega por `programa-comprado` (`biblioteca.clases`) y solo con la
   membresía al día; con la membresía vencida la lista viene vacía y aquí se dice cómo renovarla. Una clase se abre con el mismo reproductor de siempre (`TarjetaDeClase`).
   `biblioteca`: { id, titulo, estado, clases: [{ id, nombre, descripcion, clase }], vendedor } (lo arma `PlanContext`). */

const vigente = (b) => b.estado === 'activa' || b.estado === 'gracia';

/** La tarjeta de la portada: «Biblioteca de {coach} · 24 clases ›». Reestructura visual (15 oct 2026): un renglón de lista agrupada. */
export function TarjetaDeBiblioteca({ biblioteca, onAbrir }) {
  const n = biblioteca.clases.length;
  return (
    <Grupo>
      <Fila
        izquierda={<IconoDeFila><Library size={19} /></IconoDeFila>} texto={biblioteca.titulo}
        detalle={vigente(biblioteca) ? plural(n, 'clase', 'clases') : 'Membresía vencida'}
        valor={vigente(biblioteca) ? null : 'Renovar'} onClick={onAbrir}
      />
    </Grupo>
  );
}

/** La biblioteca abierta: la lista de clases y, al tocar una, su reproductor. */
export function HojaDeBiblioteca({ biblioteca, onCerrar }) {
  const [abierta, setAbierta] = useState(null);
  const v = biblioteca.vendedor;
  const quien = v?.nombre || v?.usuario || '';

  return (
    <HojaFlotante titulo={biblioteca.titulo} subtitulo={quien ? `de ${quien}` : undefined} onCerrar={onCerrar}>
      {abierta ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontFamily: FONT }}>
          <button
            type="button" onClick={() => setAbierta(null)}
            style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: FONT, fontSize: 14, fontWeight: 800, color: LT.blue, padding: '4px 2px' }}
          >
            <ArrowLeft size={16} /> Todas las clases
          </button>
          <div style={{ fontSize: 19, fontWeight: 800, color: LT.text, lineHeight: 1.25, overflowWrap: 'anywhere' }}>{abierta.nombre}</div>
          <TarjetaDeClase clase={abierta.clase} nombre={abierta.nombre} />
          {abierta.descripcion && <div style={{ fontSize: 15, fontWeight: 500, color: LT.text, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{abierta.descripcion}</div>}
        </div>
      ) : !vigente(biblioteca) ? (
        <div style={{ textAlign: 'center', padding: '28px 12px', fontFamily: FONT }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: LT.text }}>Tu membresía venció</div>
          <div style={{ fontSize: 14.5, fontWeight: 600, color: LT.text2, lineHeight: 1.5, margin: '8px auto 0', maxWidth: 320 }}>Para volver a ver las clases, renuévala desde la página de {quien || 'tu instructora'}.</div>
          {v?.usuario && (
            <a href={`/@${v.usuario}`} style={{ display: 'inline-flex', alignItems: 'center', minHeight: 50, marginTop: 18, padding: '0 22px', borderRadius: 16, background: LT.blue, color: '#fff', fontWeight: 700, fontSize: 16, textDecoration: 'none' }}>Ir a su página</a>
          )}
        </div>
      ) : biblioteca.clases.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '28px 12px', fontFamily: FONT, fontSize: 15, fontWeight: 600, color: LT.text2 }}>Todavía no hay clases. Aparecerán aquí en cuanto {quien || 'tu instructora'} las agregue.</div>
      ) : (
        <Grupo>
          {biblioteca.clases.map((c) => (
            <Fila
              key={c.id} izquierda={<IconoDeFila><Play size={16} fill="currentColor" /></IconoDeFila>} texto={c.nombre}
              valor={duracionTexto(c.clase?.duracion) || null} valorTono="neutro" onClick={() => setAbierta(c)}
            />
          ))}
        </Grupo>
      )}
    </HojaFlotante>
  );
}
