import { useRef, useState } from 'react';
import { FONT, KP } from '@/lib/theme';
import { GRIS } from '@/features/inicio/estilos';

/* LAS SEIS CAJAS DEL CÓDIGO DEL CORREO (inicio nuevo, 30 oct 2026). Se ven seis cajas, pero se escribe en UN campo de verdad, transparente encima de ellas:
   así el iPhone ofrece el código que llegó al correo arriba del teclado (`autocomplete="one-time-code"`), pegar funciona, y borrar va de una en una.
   La caja que sigue lleva el anillo azul. `valor`: lo escrito (solo números, hasta 6). `onCambio(valor)`. `error`: el texto rojo de abajo. */
export default function CajasDelCodigo({ valor, onCambio, error = '', deshabilitado = false, autoFocus = true }) {
  const campo = useRef(null);
  const [foco, setFoco] = useState(false);
  const digitos = valor.padEnd(6, ' ').split('');
  return (
    <div style={{ margin: '4px 0 14px' }}>
      <div style={{ position: 'relative' }} onClick={() => campo.current?.focus()}>
        <div aria-hidden="true" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 8 }}>
          {digitos.map((d, k) => {
            const toca = foco && k === Math.min(valor.length, 5);
            return (
              <span
                key={k}
                style={{
                  height: 58, borderRadius: 14, display: 'grid', placeItems: 'center', fontFamily: FONT, fontSize: 24, fontWeight: 800,
                  color: KP.ink, fontVariantNumeric: 'tabular-nums', background: toca ? '#fff' : GRIS,
                  // estilo-ok: el anillo dice en qué caja va el siguiente número; en rojo si el código no sirvió
                  boxShadow: error && !valor ? `inset 0 0 0 2px ${KP.danger}` : toca ? `inset 0 0 0 2px ${KP.blue}` : 'none',
                }}
              >
                {d.trim()}
              </span>
            );
          })}
        </div>
        <input
          ref={campo}
          aria-label="Código de 6 números"
          value={valor}
          onChange={(e) => onCambio(e.target.value.replace(/\D/g, '').slice(0, 6))}
          onFocus={() => setFoco(true)}
          onBlur={() => setFoco(false)}
          inputMode="numeric" autoComplete="one-time-code" maxLength={6} autoFocus={autoFocus} disabled={deshabilitado}
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, border: 'none', background: 'transparent',
            // 16 px: por debajo, el iPhone acerca la pantalla al escribir.
            fontSize: 16, color: 'transparent', caretColor: 'transparent', cursor: 'text',
          }}
        />
      </div>
      {error && <p role="alert" style={{ color: KP.danger, fontSize: 13.5, fontWeight: 700, margin: '10px 2px 0', fontFamily: FONT, lineHeight: 1.4 }}>{error}</p>}
    </div>
  );
}
