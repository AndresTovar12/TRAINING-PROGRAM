import { HardDrive } from 'lucide-react';
import { useMiEspacio } from '@/lib/espacioApi';
import { estadoDelEspacio } from '@/lib/espacio';
import { T, FONT } from '@/lib/theme';

/**
 * «Espacio de videos: 2.1 GB de 10 GB». Una sola barra, arriba de la lista de ejercicios.
 *
 * POR QUÉ EXISTE. Los videos se pagan por lo que pesan guardados, así que cada coach tiene un espacio (la regla vive en la base: `espacio_del_coach`). Quien sube clases de una
 * hora necesita ver cuánto lleva ANTES de topar con la pared. No se repite en cada botón de subir: ahí solo sale el aviso cuando un video no cabe.
 *
 * No sale para el dueño (sin tope) ni mientras no se sabe el espacio. Se pinta de naranja desde 80 % y de rojo al llenarse.
 */
export default function EspacioDeVideos({ activo = true }) {
  const espacio = useMiEspacio(activo);
  const e = estadoDelEspacio(espacio);
  if (!activo || !e) return null;

  const color = e.lleno ? T.danger : e.casiLleno ? '#B45309' : T.accent;
  return (
    <div
      role="group"
      aria-label={`Espacio de videos: ${e.texto}`}
      style={{ background: T.bg2, border: 'none', borderRadius: 12, padding: '10px 14px', marginBottom: 16 }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, fontFamily: FONT }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 800, color: T.text }}>
          <HardDrive size={15} color={color} /> Espacio de videos
        </span>
        <span style={{ fontSize: 13, fontWeight: 700, color }}>
          {e.texto} <span style={{ color: T.text3, fontWeight: 600 }}>· {e.horas}</span>
        </span>
      </div>
      <div style={{ height: 6, borderRadius: 999, background: T.bg3, marginTop: 8, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${e.pct}%`, background: color, borderRadius: 999, transition: 'width .3s' }} />
      </div>
      {(e.lleno || e.casiLleno) && (
        <div style={{ fontFamily: FONT, fontSize: 12.5, fontWeight: 600, color, marginTop: 7, lineHeight: 1.4 }}>
          {e.lleno ? 'Espacio lleno: borra videos que ya no uses para subir otros.' : 'Te queda poco espacio. Borra videos que ya no uses.'}
        </div>
      )}
    </div>
  );
}
