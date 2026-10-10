import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import HojaFlotante from '@/components/HojaFlotante';
import { useAviso } from '@/components/AvisoPasajero';
import { useConfirmacion } from '@/components/Confirmacion';
import { aspectoDelTipo } from '@/lib/aspectoDelTipo';
import { FONT, KP, LT } from '@/lib/theme';
import MosaicoDeTipo from '@/features/admin/MosaicoDeTipo';
import { TIPO_FIJO } from '@/features/admin/useTiposDeSesion';

/**
 * «Tipos de sesión»: el lugar donde un coach ADMINISTRA los suyos y los de la app.
 *
 * Andrés, 9 oct 2026: «cada coach debe poder agregar tipos de sesión pero también eliminar los que no les gusten, entonces ahorita no hay espacio para
 * eso». El menú del selector es chico a propósito (elegir es rápido); administrar necesita espacio, y esta hoja se lo da (card en la compu, pantalla
 * completa en el teléfono).
 *
 *   · LOS TUYOS: «Quitar» con confirmación, porque no hay vuelta atrás (se borra de la base; las sesiones que ya lo usan no cambian).
 *   · DE LA APP: «Quitar» sin confirmación pero con «Deshacer», y se guardan en «Quitados» para volver a ponerlos cuando quiera. «OFF» no se quita.
 */

const etiqueta = { fontSize: 11, fontWeight: 800, letterSpacing: 0.9, textTransform: 'uppercase', color: LT.text3 };

function Cabecera({ texto, cuenta, accion }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '20px 4px 8px', ...etiqueta }}>
      <span>{texto}</span>
      <span style={{ color: LT.borderHi }}>{cuenta}</span>
      {accion}
    </div>
  );
}

function Caja({ children }) {
  return <div style={{ background: LT.surface, border: `1px solid ${LT.border}`, borderRadius: 18, overflow: 'hidden' }}>{children}</div>;
}

function Fila({ aspecto, nombre, resaltada = false, primera = false, children }) {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 13, minHeight: 60, padding: '8px 8px 8px 12px', borderTop: primera ? 'none' : `1px solid ${LT.surface2}`,
        background: resaltada ? LT.blueSoft : 'transparent', transition: 'background 1.4s ease-out',
      }}
    >
      <MosaicoDeTipo aspecto={aspecto} tam={40} />
      <span style={{ flex: 1, minWidth: 0, fontSize: 16, fontWeight: 700, color: LT.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nombre}</span>
      {children}
    </div>
  );
}

function BotonDeFila({ children, onClick, color = LT.text2, etiquetaAria }) {
  return (
    <button
      type="button" onClick={onClick} aria-label={etiquetaAria} className="kp-press"
      style={{
        minHeight: 44, padding: '0 14px', border: 'none', borderRadius: 12, background: 'transparent', cursor: 'pointer', fontFamily: FONT, fontSize: 14.5,
        fontWeight: 800, color, touchAction: 'manipulation', flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}

export default function HojaTiposDeSesion({ propios, base, baseQuitada, nuevoId = null, onNuevo, onQuitaPropio, onQuitaBase, onPonBase, onCerrar }) {
  const pregunta = useConfirmacion();
  const { avisa } = useAviso();
  const [verQuitados, setVerQuitados] = useState(false);
  const [error, setError] = useState('');
  // El tipo recién guardado se ilumina un momento y se apaga solo: así se ve dónde quedó.
  const [resaltado, setResaltado] = useState(nuevoId);
  useEffect(() => {
    if (!nuevoId) return undefined;
    const t = setTimeout(() => setResaltado(null), 1500);
    return () => clearTimeout(t);
  }, [nuevoId]);

  const quitaPropio = async (t) => {
    const va = await pregunta({
      titulo: `¿Quitar «${t.nombre}»?`,
      detalle: 'Las sesiones que ya lo usan no cambian: conservan su nombre, su color y su ícono.',
      confirmar: 'Sí, quitarlo',
      peligro: true,
    });
    if (!va) return;
    setError('');
    try {
      await onQuitaPropio(t);
      avisa(`«${t.nombre}» quitado`);
    } catch (e) {
      setError(e?.message || 'No se pudo quitar. Intenta de nuevo.');
    }
  };
  // Se quita al instante y se avisa con «Deshacer»; si la base no alcanza a guardarlo, se regresa solo y aquí se escribe el error.
  const quitaBase = (b) => {
    setError('');
    onQuitaBase(b.slug).catch(() => setError('No se pudo quitar. Intenta de nuevo.'));
    avisa(`«${b.label}» quitado`, { accion: { texto: 'Deshacer', alTocar: () => onPonBase(b.slug).catch(() => setError('No se pudo volver a poner. Intenta de nuevo.')) } });
  };
  const ponBase = (b) => {
    setError('');
    onPonBase(b.slug).catch(() => setError('No se pudo volver a poner. Intenta de nuevo.'));
  };

  const abiertosLosQuitados = verQuitados && baseQuitada.length > 0;
  const aspectoDe = (dia) => aspectoDelTipo(dia);

  return (
    <HojaFlotante titulo="Tipos de sesión" onCerrar={onCerrar}>
      <button
        type="button" onClick={onNuevo} className="kp-press"
        style={{
          width: '100%', minHeight: 52, border: 'none', borderRadius: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
          background: `linear-gradient(140deg, ${KP.blue}, ${KP.blueDk})`, boxShadow: KP.shBtn, color: '#fff', fontFamily: FONT, fontSize: 16, fontWeight: 800,
          touchAction: 'manipulation',
        }}
      >
        <Plus size={19} strokeWidth={2.6} /> Nuevo tipo
      </button>
      {error && <div role="alert" style={{ marginTop: 12, fontSize: 14, fontWeight: 700, color: LT.danger }}>{error}</div>}

      <Cabecera texto="Los tuyos" cuenta={propios.length} />
      {propios.length > 0 ? (
        <Caja>
          {propios.map((t, i) => (
            <Fila
              key={t.id} primera={i === 0} nombre={t.nombre} resaltada={resaltado === t.id}
              aspecto={aspectoDe({ cat: 'otro', catNombre: t.nombre, catColor: t.color, catIcono: t.icono })}
            >
              <BotonDeFila color={LT.danger} onClick={() => quitaPropio(t)} etiquetaAria={`Quitar ${t.nombre}`}>Quitar</BotonDeFila>
            </Fila>
          ))}
        </Caja>
      ) : (
        <div style={{ padding: '4px 4px 0', fontSize: 15, fontWeight: 500, color: LT.text2, lineHeight: 1.45 }}>Aquí van los tipos que crees.</div>
      )}

      <Cabecera texto="De la app" cuenta={base.length} />
      <Caja>
        {base.map((b, i) => (
          <Fila key={b.slug} primera={i === 0} nombre={b.label} aspecto={aspectoDe({ cat: b.slug })}>
            {b.slug !== TIPO_FIJO && <BotonDeFila onClick={() => quitaBase(b)} etiquetaAria={`Quitar ${b.label}`}>Quitar</BotonDeFila>}
          </Fila>
        ))}
      </Caja>

      {baseQuitada.length > 0 && (
        <>
          <Cabecera
            texto="Quitados" cuenta={baseQuitada.length}
            accion={(
              <button
                type="button" onClick={() => setVerQuitados((v) => !v)} aria-expanded={abiertosLosQuitados}
                style={{
                  marginLeft: 'auto', minHeight: 36, padding: '0 8px', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: FONT, fontSize: 13,
                  fontWeight: 800, letterSpacing: 0, textTransform: 'none', color: LT.blue, touchAction: 'manipulation',
                }}
              >
                {abiertosLosQuitados ? 'Ocultar' : 'Ver'}
              </button>
            )}
          />
          {abiertosLosQuitados && (
            <Caja>
              {baseQuitada.map((b, i) => (
                <Fila key={b.slug} primera={i === 0} nombre={b.label} aspecto={aspectoDe({ cat: b.slug })}>
                  <BotonDeFila color={LT.blue} onClick={() => ponBase(b)} etiquetaAria={`Volver a poner ${b.label}`}>Volver a poner</BotonDeFila>
                </Fila>
              ))}
            </Caja>
          )}
        </>
      )}
    </HojaFlotante>
  );
}
