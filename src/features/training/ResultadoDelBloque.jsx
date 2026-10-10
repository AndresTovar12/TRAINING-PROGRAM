import { useState } from 'react';
import { Minus, Plus, X } from 'lucide-react';
import { LT, FONT, NUM_STYLE } from '@/lib/theme';
import { limpiaResultado, relojTexto } from '@/lib/formatos';

/**
 * Lo que el atleta anota al terminar un Set con formato: rondas, tiempo, repeticiones…
 *
 * Sale solo cuando se acaba el reloj, y también se abre a mano desde la tarjeta del Set
 * («Anotar resultado» o tocando lo ya anotado): el reloj es una ayuda, no una obligación.
 * Mismo principio que el cronómetro de un ejercicio (Andrés, 24 sep 2026: «que se pueda solo
 * escribir si el atleta quiere»): puede haber hecho el Set sin darle al play, o haberlo parado
 * tarde. Lo que el reloj ya sabe viene escrito de antemano, pero siempre se puede corregir.
 *
 * `formato.anota` decide los campos. Un campo vacío se guarda como vacío (`null`), no como cero:
 * «no lo anotó» y «hizo cero» no son lo mismo.
 */

const circulo = (relleno) => ({
  width: 46, height: 46, borderRadius: '50%', flexShrink: 0, cursor: 'pointer', display: 'grid', placeItems: 'center',
  fontFamily: FONT, touchAction: 'manipulation',
  border: relleno ? 'none' : `1.5px solid ${LT.borderHi}`, background: relleno ? LT.blue : 'transparent', color: relleno ? '#fff' : LT.text2,
});

const num = (t) => {
  const x = parseFloat(String(t ?? '').replace(',', '.'));
  return Number.isFinite(x) ? x : null;
};

// Un número grande con su − y su +, igual que los de la ficha de un ejercicio.
function NumeroGrande({ etiqueta, detalle, valor, onCambio, paso = 1, unidad, decimal = false }) {
  const mueve = (d) => {
    const base = num(valor) ?? 0;
    onCambio(String(Math.max(0, Math.round((base + d * paso) * 100) / 100)));
  };
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, border: `1.5px solid ${LT.border}`,
      borderRadius: 18, padding: '14px 16px', background: LT.surface,
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: LT.text }}>{etiqueta}</div>
        {detalle && <div style={{ fontSize: 13, color: LT.text3, fontWeight: 600, marginTop: 3 }}>{detalle}</div>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <button type="button" onClick={() => mueve(-1)} aria-label={`Bajar ${etiqueta}`} style={circulo(false)}><Minus size={20} strokeWidth={3} /></button>
        <input
          type="text" inputMode={decimal ? 'decimal' : 'numeric'} value={valor} placeholder="—" aria-label={etiqueta}
          onChange={(e) => onCambio(e.target.value)}
          style={{
            width: 64, border: 'none', background: 'transparent', textAlign: 'center', fontSize: 27, fontWeight: 800,
            outline: 'none', fontFamily: FONT, padding: 0, color: valor ? LT.text : LT.text3, ...NUM_STYLE,
          }}
        />
        {unidad && <span style={{ fontSize: 13, fontWeight: 700, color: LT.text3, marginLeft: -4 }}>{unidad}</span>}
        <button type="button" onClick={() => mueve(1)} aria-label={`Subir ${etiqueta}`} style={circulo(true)}><Plus size={20} strokeWidth={3} /></button>
      </div>
    </div>
  );
}

export default function ResultadoDelBloque({
  formato, sugerido = null, inicial = null, resumen, onGuardar, onBorrar, onCerrar, textoDeCerrar = 'Ahora no',
  // Con el reloj recién terminado un toque fuera de la hoja NO la cierra: tirar sin querer un
  // resultado que acaba de costar 12 minutos es peor que tener que tocar «No guardar».
  cierraAlTocarFuera = true,
}) {
  const anota = formato.anota;
  const de = inicial?.de ?? sugerido?.de ?? null;

  const [valor, setValor] = useState(() => {
    if (inicial && inicial.valor !== null && inicial.valor !== undefined && anota !== 'tiempo') return String(inicial.valor);
    if (anota === 'rondas' && sugerido?.rondas) return String(sugerido.rondas);
    if (anota === 'cumplido' && sugerido?.completados !== undefined) return String(sugerido.completados);
    return '';
  });
  const [extra, setExtra] = useState(inicial?.extra != null ? String(inicial.extra) : '');
  const segIni = anota === 'tiempo' ? (inicial?.valor ?? sugerido?.seg ?? null) : null;
  const [min, setMin] = useState(segIni !== null ? String(Math.floor(segIni / 60)) : '');
  const [seg, setSeg] = useState(segIni !== null ? String(segIni % 60) : '');

  const guardar = () => {
    let v = null;
    if (anota === 'tiempo') {
      const m = num(min);
      const s = num(seg);
      v = m === null && s === null ? null : (m ?? 0) * 60 + (s ?? 0);
    } else if (anota !== 'nada') v = num(valor);
    onGuardar(limpiaResultado({
      anota, valor: v, extra: anota === 'rondas' ? num(extra) : null,
      seg: sugerido?.seg ?? inicial?.seg ?? (anota === 'tiempo' ? v : null),
      tramos: sugerido?.tramos ?? inicial?.tramos, de, en: new Date().toISOString(),
    }));
  };

  const campos = {
    rondas: (
      <>
        <NumeroGrande etiqueta="Rondas" detalle="Las que completaste" valor={valor} onCambio={setValor} />
        <NumeroGrande etiqueta="Reps sueltas" detalle="De la ronda que no terminaste" valor={extra} onCambio={setExtra} />
      </>
    ),
    tiempo: (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, border: `1.5px solid ${LT.border}`,
        borderRadius: 18, padding: '14px 16px', background: LT.surface,
      }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: LT.text }}>Tiempo</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          {[['min', min, setMin, 'min'], ['seg', seg, setSeg, 's']].map(([etiqueta, v, set, sufijo]) => (
            <span key={etiqueta} style={{ display: 'inline-flex', alignItems: 'baseline', gap: 4 }}>
              <input
                type="text" inputMode="numeric" value={v} placeholder="0" aria-label={etiqueta === 'min' ? 'Minutos' : 'Segundos'}
                onChange={(e) => set(e.target.value.replace(/\D/g, '').slice(0, 3))}
                style={{
                  width: 58, border: `1.5px solid ${LT.border}`, borderRadius: 12, background: LT.bg, textAlign: 'center',
                  fontSize: 27, fontWeight: 800, outline: 'none', fontFamily: FONT, padding: '6px 0', color: LT.text, ...NUM_STYLE,
                }}
              />
              <span style={{ fontSize: 14, fontWeight: 700, color: LT.text3 }}>{sufijo}</span>
            </span>
          ))}
        </div>
      </div>
    ),
    reps: <NumeroGrande etiqueta="Repeticiones" detalle="En total" valor={valor} onCambio={setValor} />,
    km: <NumeroGrande etiqueta="Distancia" valor={valor} onCambio={setValor} paso={0.5} unidad="km" decimal />,
    m: <NumeroGrande etiqueta="Distancia" valor={valor} onCambio={setValor} paso={50} unidad="m" decimal />,
    cal: <NumeroGrande etiqueta="Calorías" valor={valor} onCambio={setValor} paso={5} unidad="cal" />,
    cumplido: (
      <NumeroGrande
        etiqueta={formato?.id === 'lapsos' ? 'Lapsos completados' : 'Tramos completados'} detalle={de ? `De ${de}` : undefined} valor={valor} onCambio={setValor}
      />
    ),
    nada: null,
  };

  const lineaDelReloj = sugerido?.seg ? `Duró ${relojTexto(sugerido.seg)}` : null;

  return (
    <div
      onMouseDown={cierraAlTocarFuera ? onCerrar : undefined}
      style={{
        position: 'fixed', inset: 0, zIndex: 3100, background: 'rgba(17,19,24,0.5)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-label="Tu resultado" className="animate-sheet"
        style={{
          width: '100%', maxWidth: 520, background: LT.bg, borderRadius: '22px 22px 0 0', fontFamily: FONT,
          padding: '16px 18px calc(16px + env(safe-area-inset-bottom))', maxHeight: '92svh', overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: LT.text, letterSpacing: -0.3 }}>Tu resultado</div>
            <div style={{ fontSize: 13.5, color: LT.text2, fontWeight: 600, marginTop: 3 }}>
              {[resumen, lineaDelReloj].filter(Boolean).join(' · ')}
            </div>
          </div>
          <button
            type="button" onClick={onCerrar} aria-label="Cerrar"
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: LT.text2, padding: 4 }}
          >
            <X size={22} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {campos[anota] ?? null}
          {anota === 'nada' && (
            <div style={{ fontSize: 15, color: LT.text2, fontWeight: 600, lineHeight: 1.5 }}>
              Este formato no pide anotar nada: solo queda marcado como hecho.
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
          <button
            type="button" onClick={guardar}
            style={{
              minHeight: 52, borderRadius: 15, border: 'none', cursor: 'pointer', background: LT.blue, color: '#fff',
              fontFamily: FONT, fontSize: 16, fontWeight: 800, touchAction: 'manipulation',
            }}
          >
            {anota === 'nada' ? 'Marcar como hecho' : 'Guardar'}
          </button>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 22 }}>
            <button
              type="button" onClick={onCerrar}
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: FONT, fontSize: 14.5, fontWeight: 700, color: LT.text2, padding: '10px 6px' }}
            >
              {textoDeCerrar}
            </button>
            {onBorrar && (
              <button
                type="button" onClick={onBorrar}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: FONT, fontSize: 14.5, fontWeight: 700, color: LT.danger, padding: '10px 6px' }}
              >
                Borrar resultado
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
