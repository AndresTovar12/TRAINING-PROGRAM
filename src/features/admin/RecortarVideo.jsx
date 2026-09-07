/**
 * Elegir con qué tramo del video quedarse.
 *
 * QUÉ HACE Y QUÉ NO, dicho claro:
 *   SÍ: el atleta ve solo el tramo marcado. Grabas 30 segundos, te quedas con
 *       los 8 buenos, y eso es lo único que se reproduce.
 *   NO: el archivo sigue pesando lo mismo. Se recorta la reproducción, no el
 *       archivo.
 *
 * Por qué no se corta el archivo de verdad: hacerlo en el navegador obliga a
 * volver a comprimir el video, y eso le baja la calidad. Andrés dijo que la
 * calidad es lo que más le importa, así que se prefirió no tocar ni un pixel
 * del original. El precio es que el ahorro es de atención, no de espacio.
 */
import { useEffect, useRef, useState } from 'react';
import { Scissors, RotateCcw } from 'lucide-react';
import { T, FONT, NUM_STYLE } from '@/lib/theme';

const seg = (s) => {
  if (s == null || Number.isNaN(s)) return '0:00';
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, '0')}`;
};

export default function RecortarVideo({ url, inicio, fin, onCambio }) {
  const ref = useRef(null);
  const [duracion, setDuracion] = useState(null);
  const desde = inicio ?? 0;
  const hasta = fin ?? duracion ?? 0;

  // Al mover una manija, saltar ahí para ver exactamente dónde queda el corte.
  useEffect(() => {
    if (ref.current && inicio != null) ref.current.currentTime = inicio;
  }, [inicio]);

  if (!url) return null;

  const recortado = inicio != null || fin != null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontFamily: FONT }}>
      <video
        ref={ref}
        src={url}
        controls
        playsInline
        preload="metadata"
        onLoadedMetadata={(e) => setDuracion(e.currentTarget.duration)}
        style={{ width: '100%', borderRadius: 13, background: '#000' }}
      />

      {duracion ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Scissors size={14} color={T.accent} />
            <span style={{ fontSize: 12.5, fontWeight: 700, color: T.text2 }}>
              Quédate solo con lo bueno
            </span>
            {recortado && (
              <button
                type="button"
                onClick={() => onCambio({ inicio: null, fin: null })}
                style={{
                  marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5,
                  border: 'none', background: 'transparent', cursor: 'pointer',
                  color: T.text3, fontFamily: FONT, fontSize: 12, fontWeight: 700,
                }}
              >
                <RotateCcw size={12} /> Completo
              </button>
            )}
          </div>

          <label style={{ display: 'block' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, fontWeight: 700, color: T.text3, marginBottom: 4 }}>
              <span>Empieza en</span>
              <span style={NUM_STYLE}>{seg(desde)}</span>
            </div>
            <input
              type="range" min={0} max={duracion} step={0.1} value={desde}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                onCambio({ inicio: v, fin: fin != null && fin <= v ? null : fin });
              }}
              style={{ width: '100%', accentColor: T.accent }}
            />
          </label>

          <label style={{ display: 'block' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, fontWeight: 700, color: T.text3, marginBottom: 4 }}>
              <span>Termina en</span>
              <span style={NUM_STYLE}>{seg(hasta)}</span>
            </div>
            <input
              type="range" min={0} max={duracion} step={0.1} value={hasta}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                onCambio({ inicio: inicio != null && inicio >= v ? null : inicio, fin: v });
              }}
              style={{ width: '100%', accentColor: T.accent }}
            />
          </label>

          <div style={{ fontSize: 11.5, color: T.text3, fontWeight: 600, lineHeight: 1.45 }}>
            {recortado
              ? `El atleta verá ${seg(Math.max(0, hasta - desde))} de video, del ${seg(desde)} al ${seg(hasta)}.`
              : 'Ahora mismo se ve completo. Mueve las barras para acortarlo.'}
            {' '}El archivo no cambia de peso.
          </div>
        </>
      ) : (
        <div style={{ fontSize: 12, color: T.text3, fontWeight: 600 }}>Leyendo el video…</div>
      )}
    </div>
  );
}
