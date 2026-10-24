import IconoDeTipo from '@/components/IconoDeTipo';

/* El cuadrito de color con el ícono de una actividad (`lib/actividades.js`): el mismo lenguaje que los deportes (`MosaicoDeDeporte`) y los tipos de sesión, con un ícono de
   línea del catálogo de la app. Sin emojis (Andrés, 23 oct 2026: «no tienen personalidad»). `oscuro`: va sobre las pantallas oscuras (el velo del color, más fuerte). */
export default function IconoDeActividad({ actividad, size = 38, oscuro = false }) {
  const color = actividad?.color ?? '#7A8191';
  return (
    <span aria-hidden="true" style={{ width: size, height: size, borderRadius: size * 0.3, flexShrink: 0, display: 'grid', placeItems: 'center', background: `${color}${oscuro ? '33' : '1F'}`, color }}>
      <IconoDeTipo id={actividad?.icono ?? null} nombre={actividad?.nombre ?? ''} size={Math.round(size * 0.52)} />
    </span>
  );
}
