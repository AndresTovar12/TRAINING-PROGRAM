import { nombreDelDeporte } from '@/lib/metricas/deportes';
import { fechaLarga } from '@/lib/metricas/formato';
import { lineaDeEntreno } from '@/lib/resumenLibre';
import { diasEntre, hoyLocal, diaLocal } from '@/lib/metricas/forma';
import { haceCuanto } from '@/lib/semanaLibre';
import { actividadDeEntreno } from '@/lib/actividades';
import { Share } from 'lucide-react';
import { KP } from '@/lib/theme';
import IconoDeActividad from './IconoDeActividad';
import { Grupo, Fila } from '@/components/ui';

// «hoy», «ayer», «hace 3 días» cuando es de esta semana; si no, la fecha entera (para que entre en una línea).
const cuando = (f) => { const dia = diaLocal(f.inicio, f.desfase_min); return dia && diasEntre(dia, hoyLocal()) < 7 ? haceCuanto(f) : fechaLarga(f.inicio, f.desfase_min); };

/* «TUS ENTRENOS»: lo que ha hecho, lo más nuevo primero (libres, del reloj o importados). Tocar uno abre su página.
   Reestructura visual (15 oct 2026): una lista agrupada. Cada uno con el ícono de su actividad (Activity Tracker, 23 oct 2026); `propias`: las que creó.
   Stickers (28 oct 2026): el ⇪ de cada fila (44 × 44, sin círculo de fondo) abre directo sus stickers (`alCompartir`). */
export default function TusEntrenos({ filas, alAbrir, alCompartir, propias = [] }) {
  if (!filas?.length) return null;
  return (
    <Grupo titulo="Tus entrenos">
      {filas.map((f) => {
        const nombre = f.titulo || nombreDelDeporte(f.deporte);
        const datos = {
          izquierda: <IconoDeActividad actividad={actividadDeEntreno(f, propias)} size={38} />, texto: nombre,
          detalle: `${cuando(f)}${lineaDeEntreno(f) ? ` · ${lineaDeEntreno(f)}` : ''}`, onClick: () => alAbrir(f),
        };
        if (!alCompartir) return <Fila key={f.id} {...datos} />;
        // Sin la flecha ›: a la derecha va el ⇪ (fuera de la fila: un botón no puede ir dentro de otro).
        const fila = <Fila {...datos} derecha={<span aria-hidden="true" />} />;
        return (
          <div key={f.id} className="ui-fila" style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: 0 }}>{fila}</div>
            <button
              type="button" onClick={() => alCompartir(f)} aria-label={`Compartir los stickers de ${nombre}`} className="kp-press"
              style={{ width: 44, height: 44, marginRight: 8, flexShrink: 0, border: 'none', background: 'transparent', color: KP.blue, display: 'grid', placeItems: 'center', cursor: 'pointer', touchAction: 'manipulation' }}
            >
              <Share size={21} />
            </button>
          </div>
        );
      })}
    </Grupo>
  );
}
