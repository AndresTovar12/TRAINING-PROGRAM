import { ChevronRight } from 'lucide-react';
import { LT, FONT, NUM_STYLE } from '@/lib/theme';
import { nombreDelDeporte } from '@/lib/metricas/deportes';
import { fechaLarga } from '@/lib/metricas/formato';
import { lineaDeEntreno } from '@/lib/resumenLibre';
import { diasEntre, hoyLocal, diaLocal } from '@/lib/metricas/forma';
import { haceCuanto } from '@/lib/semanaLibre';

// «hoy», «ayer», «hace 3 días» cuando es de esta semana; si no, la fecha entera (para que entre en una línea).
const cuando = (f) => { const dia = diaLocal(f.inicio, f.desfase_min); return dia && diasEntre(dia, hoyLocal()) < 7 ? haceCuanto(f) : fechaLarga(f.inicio, f.desfase_min); };
import { MosaicoDeDeporte } from '@/features/metricas/Piezas';

/* «TUS ENTRENOS»: lo que ha hecho, lo más nuevo primero (libres, del reloj o importados). Tocar uno abre su resumen, de donde se vuelve a sacar la activity card. */

export default function TusEntrenos({ filas, alAbrir }) {
  if (!filas?.length) return null;
  return (
    <section aria-label="Tus entrenos" style={{ display: 'flex', flexDirection: 'column', gap: 10, fontFamily: FONT }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: LT.text3, textTransform: 'uppercase', letterSpacing: 0.7 }}>Tus entrenos</div>
      {filas.map((f) => (
        <button
          key={f.id} type="button" onClick={() => alAbrir(f)} className="kp-press"
          style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', cursor: 'pointer', fontFamily: FONT, background: LT.surface, border: `1.5px solid ${LT.border}`, borderRadius: 16, padding: '10px 12px', minHeight: 60 }}
        >
          <MosaicoDeDeporte deporte={f.deporte} size={40} />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 15.5, fontWeight: 800, color: LT.text, overflowWrap: 'anywhere' }}>{f.titulo || nombreDelDeporte(f.deporte)}</span>
            <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: LT.text2, marginTop: 2, ...NUM_STYLE }}>{cuando(f)}{lineaDeEntreno(f) ? ` · ${lineaDeEntreno(f)}` : ''}</span>
          </span>
          <ChevronRight size={18} color={LT.text3} />
        </button>
      ))}
    </section>
  );
}
