import { nombreDelDeporte } from '@/lib/metricas/deportes';
import { fechaLarga } from '@/lib/metricas/formato';
import { lineaDeEntreno } from '@/lib/resumenLibre';
import { diasEntre, hoyLocal, diaLocal } from '@/lib/metricas/forma';
import { haceCuanto } from '@/lib/semanaLibre';
import { actividadDeEntreno } from '@/lib/actividades';
import IconoDeActividad from './IconoDeActividad';
import { Grupo, Fila } from '@/components/ui';

// «hoy», «ayer», «hace 3 días» cuando es de esta semana; si no, la fecha entera (para que entre en una línea).
const cuando = (f) => { const dia = diaLocal(f.inicio, f.desfase_min); return dia && diasEntre(dia, hoyLocal()) < 7 ? haceCuanto(f) : fechaLarga(f.inicio, f.desfase_min); };

/* «TUS ENTRENOS»: lo que ha hecho, lo más nuevo primero (libres, del reloj o importados). Tocar uno abre su resumen, de donde se vuelve a sacar la activity card.
   Reestructura visual (15 oct 2026): una lista agrupada. Cada uno con el ícono de su actividad (Activity Tracker, 23 oct 2026); `propias`: las que creó. */
export default function TusEntrenos({ filas, alAbrir, propias = [] }) {
  if (!filas?.length) return null;
  return (
    <Grupo titulo="Tus entrenos">
      {filas.map((f) => (
        <Fila
          key={f.id} izquierda={<IconoDeActividad actividad={actividadDeEntreno(f, propias)} size={38} />} texto={f.titulo || nombreDelDeporte(f.deporte)}
          detalle={`${cuando(f)}${lineaDeEntreno(f) ? ` · ${lineaDeEntreno(f)}` : ''}`} onClick={() => alAbrir(f)}
        />
      ))}
    </Grupo>
  );
}
