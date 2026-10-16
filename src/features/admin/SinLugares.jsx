import { useEffect, useState } from 'react';
import { Store, Users, X } from 'lucide-react';
import { usePalabras } from '@/contexts/PalabrasContext';
import { T, FONT, KP, UI } from '@/lib/theme';
import { botonPrincipal, botonBlanco } from '@/features/misplanes/estilos';
import { atletasGratisDeFabrica, paquetesDeLugares } from '@/lib/lugaresApi';
import { paquetesQueAmplian, pesos, tituloSinLugares } from '@/lib/limiteDeAtletas';

/* «YA NO TIENES LUGARES» (14 oct 2026). Sale cuando un coach o fisio quiere agregar a mano un atleta más allá de su tope.

   Andrés: «explica que solo puede agregar 5 atletas gratis. Si quiere agregar más tiene 2 salidas: 1) que compren un programa, o 2) que pague derechos para tener más atletas, y un botón que lo lleve a pagar».
   El cobro llega con Stripe: hasta entonces el botón de pagar dice «Pronto» y no hace nada (`PAGO_ABIERTO`). */

const PAGO_ABIERTO = false;

const opcion = {
  background: UI.tarjeta, boxShadow: UI.sombraGrupo, borderRadius: UI.rGrupo, padding: '16px 16px 17px',
};

export default function SinLugares({ lugares, onCerrar, onIrA }) {
  const { t } = usePalabras(); // «atletas» según el oficio: pacientes, alumnos…
  const [paquetes, setPaquetes] = useState(null); // null = cargando
  const [gratis, setGratis] = useState(5);
  const [elegido, setElegido] = useState(null);

  useEffect(() => {
    let vivo = true;
    Promise.all([paquetesDeLugares(), atletasGratisDeFabrica()])
      .then(([p, g]) => {
        if (!vivo) return;
        const lista = paquetesQueAmplian(p, lugares);
        setPaquetes(lista);
        setGratis(g);
        setElegido(lista[0]?.id ?? null);
      })
      .catch(() => { if (vivo) setPaquetes([]); });
    return () => { vivo = false; };
  }, [lugares]);

  const vitrina = () => { onCerrar?.(); onIrA?.('vitrina'); };

  return (
    <div
      onMouseDown={onCerrar}
      style={{
        position: 'fixed', inset: 0, zIndex: 2700, background: 'rgba(17,19,24,0.5)',
        backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18,
      }}
    >
      <div
        role="dialog" aria-label="Sin lugares"
        onMouseDown={(e) => e.stopPropagation()}
        className="animate-fade-in"
        style={{
          width: '100%', maxWidth: 440, background: UI.fondo, borderRadius: 24,
          boxShadow: KP.shPop, fontFamily: FONT, padding: '20px 20px 18px', maxHeight: '88svh', overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 11, flexShrink: 0, display: 'grid', placeItems: 'center', background: T.accentBg, color: T.accent }}>
              <Users size={19} />
            </div>
            <div style={{ fontSize: 16.5, fontWeight: 800, color: T.text, lineHeight: 1.25 }}>{t(tituloSinLugares(lugares, gratis))}</div>
          </div>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: T.text2, padding: 4 }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={opcion}>
            <div style={{ fontSize: 14.5, fontWeight: 800, color: T.text, marginBottom: 4 }}>1 · Que compren un programa tuyo</div>
            <div style={{ fontSize: 13.5, color: T.text2, fontWeight: 600, lineHeight: 1.45, marginBottom: 11 }}>
              {t('Quien compra un plan tuyo no cuenta entre tus atletas.')}
            </div>
            <button type="button" onClick={vitrina} style={botonBlanco(true)}>
              <Store size={16} /> Ir a Mi vitrina
            </button>
          </div>

          <div style={opcion}>
            <div style={{ fontSize: 14.5, fontWeight: 800, color: T.text, marginBottom: 10 }}>2 · Paga derechos para tener más lugares</div>
            {paquetes === null ? (
              <div style={{ fontSize: 13.5, color: T.text3, fontWeight: 600 }}>Cargando…</div>
            ) : paquetes.length === 0 ? (
              <div style={{ fontSize: 13.5, color: T.text2, fontWeight: 600, lineHeight: 1.45 }}>Ya tienes el paquete más grande. Escríbenos y te armamos uno a tu medida.</div>
            ) : (
              <>
                <div role="radiogroup" aria-label="Paquete de lugares" style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                  {paquetes.map((p) => {
                    const activo = p.id === elegido;
                    return (
                      <button
                        key={p.id} type="button" role="radio" aria-checked={activo} onClick={() => setElegido(p.id)}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, minHeight: 46, padding: '0 14px',
                          borderRadius: UI.rCampo, cursor: 'pointer', fontFamily: FONT, fontSize: 15, fontWeight: 700, textAlign: 'left',
                          border: 'none', background: activo ? KP.blueSoft : UI.relleno, color: activo ? KP.blue : T.text,
                        }}
                      >
                        <span>{t(p.nombre)}</span>
                        <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', flexShrink: 0 }}>{pesos(p.precio_mxn)}/mes</span>
                      </button>
                    );
                  })}
                </div>
                <button type="button" disabled={!PAGO_ABIERTO || !elegido} style={{ ...botonPrincipal(true), width: '100%' }}>
                  {PAGO_ABIERTO ? 'Pagar' : 'Pagar · Pronto'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
