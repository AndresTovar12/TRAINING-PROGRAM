import { useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { comoReloj } from '@/lib/medidas';
import { FONT } from '@/lib/theme';

/**
 * Lo que se usa cuando el ejercicio se mide en tiempo.
 *
 * Andrés, 24 sep 2026: "es buena idea lo de cronómetro pero, igual que se
 * pueda solo escribir si el atleta quiere, ¿no crees?". Sí: puede haber hecho
 * la plancha sin darle al play, o haberlo parado tarde. El número se toca y se
 * teclea siempre, corra el reloj o esté parado.
 *
 * NO GUARDA SU PROPIA CUENTA. El único dato es lo anotado, y el reloj de al
 * lado se calcula de ahí. Con una cuenta aparte había dos versiones de lo
 * mismo, y se desincronizaban: el número decía 45 y el reloj seguía en 00:00.
 *
 * El reloj cuenta segundos, y guarda en la unidad del ejercicio: si está en
 * minutos, guarda minutos. Así lo registrado y la meta hablan el mismo idioma
 * y se pueden comparar.
 */
export default function Cronometro({ valor, unidad: uMedida, metaSeg, onCambio, circulo, LT, NUM_STYLE }) {
  const enMinutos = uMedida === 'min';
  const aSegundos = (v) => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? Math.round(enMinutos ? n * 60 : n) : 0;
  };

  const [corriendo, setCorriendo] = useState(false);

  /* El intervalo se crea una vez por arranque, así que dentro no puede leer
     `valor` ni `onCambio` directamente: se quedaría con los del momento en que
     arrancó. Las referencias siempre traen los de ahora. */
  const ahora = useRef({ valor, onCambio });
  // Se pone al día DESPUÉS de dibujar, no durante: tocar una referencia a
  // media pintada es justo lo que React pide no hacer, y aquí no hace falta —
  // quien la lee es el intervalo, un segundo más tarde.
  useEffect(() => { ahora.current = { valor, onCambio }; });

  useEffect(() => {
    if (!corriendo) return undefined;
    const t = setInterval(() => {
      const s = aSegundos(ahora.current.valor) + 1;
      ahora.current.onCambio(String(enMinutos ? Math.round((s / 60) * 100) / 100 : s));
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [corriendo, enMinutos]);

  const segundos = aSegundos(valor);
  const llego = metaSeg !== null && segundos >= metaSeg;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); setCorriendo(!corriendo); }}
        aria-label={corriendo ? 'Parar el cronómetro' : 'Arrancar el cronómetro'}
        style={{ ...circulo(!corriendo), touchAction: 'manipulation' }}
      >
        {corriendo ? <Pause size={19} strokeWidth={3} /> : <Play size={19} strokeWidth={3} />}
      </button>
      <input
        type="text"
        inputMode="decimal"
        value={valor ?? ''}
        placeholder="—"
        // Escribir manda sobre el reloj: si lo corrige a mano, el reloj para.
        onChange={(e) => { setCorriendo(false); onCambio(e.target.value); }}
        aria-label={enMinutos ? 'Minutos que aguantaste' : 'Segundos que aguantaste'}
        style={{
          width: 62, border: 'none', background: 'transparent', textAlign: 'center',
          fontSize: 27, fontWeight: 800, outline: 'none', fontFamily: FONT, padding: 0,
          color: llego ? LT.blue : (valor ? LT.text : LT.text3), ...NUM_STYLE,
        }}
      />
      {/* El mismo dato en minutos y segundos: el número es lo que se guarda, el
          reloj es para mirarlo de reojo mientras aguanta. */}
      <span style={{ fontSize: 12.5, fontWeight: 700, color: LT.text3, width: 44, ...NUM_STYLE }}>
        {comoReloj(segundos)}
      </span>
    </div>
  );
}

