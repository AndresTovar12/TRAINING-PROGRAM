import { useState } from 'react';
import { ChevronRight, ChevronUp, Check, Loader2, UserPlus } from 'lucide-react';
import { invitarAlEquipo } from '@/lib/api';
import { T, FONT, KP } from '@/lib/theme';
import { textoDeAviso } from '@/lib/programas';

/* Lo del EQUIPO de un atleta en los paneles de los profesionales: agregar a
   alguien, los avisos al coach principal y los grupos de la lista («Esperando
   que acepte», «Ya no están contigo»). Ver la migración `equipo_etapa_2`. */

/** Cada aviso pendiente del coach principal, con su «Entendido». */
export function AvisosDelCoach({ avisos, onEntendido }) {
  if (!avisos.length) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
      {avisos.map((a) => (
        <div
          key={`${a.atletaId}-${a.profesionalId}`}
          role="status"
          style={{
            display: 'flex', alignItems: 'center', gap: 12, background: T.bg2, borderRadius: 14, padding: '12px 14px',
            border: `1.5px solid ${KP.blueSoft}`, flexWrap: 'wrap',
          }}
        >
          <span style={{ flex: '1 1 200px', fontSize: 14, fontWeight: 700, color: T.text, lineHeight: 1.4 }}>{textoDeAviso(a)}</span>
          <button
            type="button"
            onClick={() => onEntendido(a)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontFamily: FONT, fontSize: 13.5, fontWeight: 800,
              border: `1.5px solid ${T.accent}`, background: T.bg2, color: T.accent, borderRadius: 11, padding: '8px 14px',
            }}
          >
            <Check size={15} strokeWidth={3} /> Entendido
          </button>
        </div>
      ))}
    </div>
  );
}

/** Un grupo plegado al final de la lista: «Esperando que acepte (2) ›». */
export function GrupoPlegable({ titulo, cuenta, children }) {
  const [abierto, setAbierto] = useState(false);
  if (!cuenta) return null;
  return (
    <div style={{ marginTop: 18 }}>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 2px', border: 'none', background: 'transparent',
          cursor: 'pointer', fontFamily: FONT, fontSize: 13.5, fontWeight: 800, color: T.text2,
        }}
      >
        {titulo} ({cuenta})
        {abierto ? <ChevronUp size={15} /> : <ChevronRight size={15} />}
      </button>
      {abierto && <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</div>}
    </div>
  );
}

/** Un renglón de esos grupos: nombre y qué pasa. Con `onClick`, se abre (si no, es solo informativo). */
export function FilaDeEquipo({ nombre, detalle, onClick }) {
  const cuerpo = (
    <>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 14.5, fontWeight: 800, color: T.text, overflowWrap: 'anywhere' }}>{nombre}</span>
        <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: T.text2, marginTop: 2, lineHeight: 1.4 }}>{detalle}</span>
      </span>
      {onClick && <ChevronRight size={17} color={T.text3} />}
    </>
  );
  const estilo = {
    display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', width: '100%', background: T.bg2, borderRadius: 14,
    padding: '12px 14px', border: `1px solid ${T.border}`, fontFamily: FONT,
  };
  return onClick
    ? <button type="button" onClick={onClick} style={{ ...estilo, cursor: 'pointer' }}>{cuerpo}</button>
    : <div style={estilo}>{cuerpo}</div>;
}

/**
 * «Agregar al equipo», en la ficha del atleta de su coach principal (y del master):
 * su código o @usuario, y el ATLETA acepta. Un fisio, por ejemplo.
 */
export function AgregarAlEquipo({ atleta, Seccion, abierta, onToggle, onInvitado }) {
  const [ref, setRef] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState('');
  const [error, setError] = useState('');
  const nombre = atleta.full_name || atleta.username;

  async function invitar(e) {
    e.preventDefault();
    const limpio = ref.trim().replace(/^@/, '');
    if (!limpio) return;
    setOcupado(true);
    setError('');
    setAviso('');
    try {
      await invitarAlEquipo(atleta.id, limpio);
      setAviso(`Listo: se lo mandamos a ${nombre}. Lo verá arriba de su «Hoy» y en «Mi equipo»; hasta que acepte, nadie ve nada.`);
      setRef('');
      onInvitado?.();
    } catch (err) {
      setError(err.message || 'No se pudo invitar.');
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Seccion titulo="Agregar al equipo" abierta={abierta} onToggle={onToggle}>
      <p style={{ fontSize: 13, color: T.text2, lineHeight: 1.5, margin: '0 0 10px', fontWeight: 500 }}>
        Suma a un fisio u otro profesional al equipo de {nombre}. Escribe su código o @usuario; {nombre} tiene que aceptar.
      </p>
      <form onSubmit={invitar} style={{ display: 'flex', gap: 8 }}>
        <input
          value={ref}
          onChange={(e) => { setRef(e.target.value); setError(''); setAviso(''); }}
          placeholder="Código o @usuario"
          aria-label="Código o usuario de quien se agrega"
          autoCapitalize="none"
          spellCheck={false}
          style={{
            flex: 1, minWidth: 0, border: `1.5px solid ${T.border}`, borderRadius: 11, padding: '11px 12px', fontFamily: FONT,
            fontSize: 16, fontWeight: 500, color: T.text, background: T.bg2, outline: 'none',
          }}
        />
        <button
          type="submit"
          disabled={ocupado || !ref.trim()}
          className="kp-press"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontFamily: FONT, fontSize: 14, fontWeight: 800,
            borderRadius: 11, padding: '0 15px', border: `1.5px solid ${T.accent}`, background: T.bg2, color: T.accent,
            opacity: ocupado || !ref.trim() ? 0.55 : 1,
          }}
        >
          {ocupado ? <Loader2 size={15} className="spin" /> : <UserPlus size={16} />} Invitar
        </button>
      </form>
      {aviso && <div role="status" style={{ marginTop: 10, fontSize: 13.5, fontWeight: 700, color: '#00805A', lineHeight: 1.45 }}>{aviso}</div>}
      {error && <div role="alert" style={{ marginTop: 10, fontSize: 13.5, fontWeight: 700, color: T.danger }}>{error}</div>}
    </Seccion>
  );
}
