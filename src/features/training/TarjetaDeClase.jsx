import { PlayCircle } from 'lucide-react';
import TarjetaDeVideo from '@/features/training/TarjetaDeVideo';
import { duracionTexto } from '@/lib/clases';
import { ligaExterna } from '@/lib/videos';
import { LT, KP, FONT } from '@/lib/theme';

/**
 * LA CLASE DE UNA SESIÓN, del lado del alumno (ver `lib/clases.js`): lo primero que ve al abrir la sesión, antes de cualquier Set.
 * «Clase · 45 min» y debajo el reproductor de siempre (el mismo de los ejercicios: foto, play grande, controles sencillos; una liga de
 * YouTube o Vimeo se incrusta). Al terminar, el alumno marca la sesión como terminada con el botón de siempre.
 *
 * `nombre`: el de la sesión, para la foto de respaldo. `clase`: lo que trae `sesion.clase`.
 */
export default function TarjetaDeClase({ clase, nombre = '' }) {
  const dura = duracionTexto(clase.duracion);
  const externa = ligaExterna(clase.url);
  const video = {
    id: 'clase', url: clase.url, inicio: clase.inicio ?? null, fin: clase.fin ?? null, sinAudio: false, encuadre: null,
    escrita: null, etiqueta: 'Clase', proposito: undefined,
  };
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: FONT, fontSize: 15, fontWeight: 800, color: LT.text }}>
        <PlayCircle size={18} color={KP.mint} />
        Clase
        {(dura || externa?.de) && <span style={{ fontWeight: 700, color: KP.mint }}>· {[dura, externa?.de].filter(Boolean).join(' · ')}</span>}
      </div>
      <TarjetaDeVideo videos={[video]} nombre={nombre} altoMaximo="46vh" />
    </div>
  );
}
