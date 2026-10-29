import { useState } from 'react';
import { Watch, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useAviso } from '@/components/AvisoPasajero';
import { FONT, KP } from '@/lib/theme';
import { saludDisponible } from '@/lib/saludDelTelefono';
import { abreConectaReloj } from '@/lib/abreConectaReloj';
import { cierraInvitacion, useReloj } from '@/lib/relojConectado';

/* DÓNDE SE ENTERA EL ATLETA (fase 5, 29 oct 2026; textos del prototipo). Las invitaciones a conectar salen SOLO a quien tiene un Apple Watch emparejado
   (`estadoDelReloj`, o el modo de prueba de los administradores) y todavía no lo conecta. En la web no salen: ahí no se puede leer Salud. */

const tarjeta = { background: '#fff', borderRadius: 22, padding: 16, boxShadow: '0 1px 2px rgba(17,19,24,.04)', display: 'grid', gap: 14, position: 'relative', fontFamily: FONT };
const icono = { width: 44, height: 44, borderRadius: 14, background: KP.blueSoft, color: KP.blue, display: 'grid', placeItems: 'center' };
const botonAzul = { flex: 1, minHeight: 44, borderRadius: 14, border: 'none', background: KP.blue, color: '#fff', font: `800 15px ${FONT}`, cursor: 'pointer' };
const botonGris = { minHeight: 44, borderRadius: 14, border: 'none', background: '#EBEDF1', color: KP.ink, font: `700 14.5px ${FONT}`, padding: '0 16px', cursor: 'pointer' };
const DIAS_DE_INVITACION = 7;

function Invitacion({ titulo, texto, conCerrar = false, alCerrar, botones }) {
  return (
    <article aria-label={titulo} style={tarjeta}>
      {conCerrar && (
        <button type="button" onClick={alCerrar} aria-label="No mostrar más" style={{ position: 'absolute', top: 10, right: 10, width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'transparent', color: KP.ink3, display: 'grid', placeItems: 'center', cursor: 'pointer' }}><X size={17} /></button>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '44px 1fr', gap: 12, alignItems: 'start', paddingRight: conCerrar ? 24 : 0 }}>
        <span style={icono}><Watch size={22} /></span>
        <div>
          <b style={{ display: 'block', fontSize: 16, lineHeight: 1.3, color: KP.ink }}>{titulo}</b>
          <p style={{ margin: '3px 0 0', fontSize: 13.5, lineHeight: 1.45, color: KP.ink2 }}>{texto}</p>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>{botones}</div>
    </article>
  );
}

/** Home: «Vuelve a conectar tu Apple Watch» (la conexión está en la cuenta y falta este iPhone) o la invitación de la primera semana. */
export function RelojEnHome() {
  const { user } = useAuth();
  const { listo, conexion, aqui, reloj, estreno, cerrada } = useReloj();
  const { avisa } = useAviso();
  const [ahora] = useState(() => Date.now());
  if (!saludDisponible() || !listo) return null;
  if (conexion && !aqui) {
    return (
      <article style={{ display: 'grid', gridTemplateColumns: '40px 1fr', gap: 12, alignItems: 'center', background: KP.blueSoft, borderRadius: 20, padding: 14, fontFamily: FONT }}>
        <span style={{ width: 36, height: 36, borderRadius: 11, background: '#fff', color: KP.blue, display: 'grid', placeItems: 'center' }}><Watch size={18} /></span>
        <span>
          <b style={{ display: 'block', fontSize: 15, lineHeight: 1.3, color: KP.ink }}>Vuelve a conectar tu Apple Watch</b>
          <span style={{ display: 'block', fontSize: 13, color: KP.ink2, marginTop: 2, lineHeight: 1.35 }}>Ya lo tenías conectado en tu otro iPhone. En este falta un toque.</span>
        </span>
        <button type="button" className="kp-press" onClick={() => abreConectaReloj('inicio', { reconectar: true })} style={{ ...botonAzul, gridColumn: '1 / -1' }}>Conectar en este iPhone</button>
      </article>
    );
  }
  const edadDias = user?.created_at ? (ahora - Date.parse(user.created_at)) / 86400000 : Infinity;
  const toca = reloj.emparejado && !conexion && !cerrada && (reloj.prueba || estreno || edadDias < DIAS_DE_INVITACION);
  if (!toca) return null;
  const cierra = () => { cierraInvitacion(); avisa('Listo. Lo encuentras en Mi perfil, Dispositivos.'); };
  return (
    <Invitacion
      conCerrar alCerrar={cierra}
      titulo={estreno ? 'Vemos que ya tienes Apple Watch' : 'Conecta tu Apple Watch'}
      texto={estreno ? 'Conéctalo y te sigue mientras entrenas: el descanso, tu ritmo y tu pulso en tu muñeca.' : 'Desde hoy, tus entrenos del reloj entran solos, con tu pulso y tu ruta. Tu coach también los ve.'}
      botones={<button type="button" className="kp-press" onClick={() => abreConectaReloj('inicio')} style={botonAzul}>Conectar</button>}
    />
  );
}

/**
 * La página del entreno, debajo de «Tus stickers están listos». Sin conectar: «Tu próximo entreno, con tu pulso» (nunca promete pulso para el entreno ya hecho).
 * Ya conectado y este entreno sin pulso: la nota verde. `conPulso`: este entreno ya trae el pulso del reloj.
 */
export function RelojEnEntreno({ conPulso }) {
  const { listo, conexion, aqui, reloj } = useReloj();
  const [ahoraNo, setAhoraNo] = useState(false);
  if (!saludDisponible() || !listo || conPulso || !reloj.emparejado) return null;
  if (conexion && aqui) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: KP.mintSoft, color: '#047857', borderRadius: 18, padding: '13px 15px', fontSize: 14, fontWeight: 700, lineHeight: 1.35, fontFamily: FONT }}>
        <Watch size={18} style={{ flex: 'none' }} /><span>Apple Watch conectado. Tu próximo entreno trae tu pulso y tu ruta.</span>
      </div>
    );
  }
  if (conexion || ahoraNo) return null;
  return (
    <Invitacion
      titulo="Tu próximo entreno, con tu pulso"
      texto="Conecta tu Apple Watch y desde el próximo entreno tus stickers llevan tu pulso y tu ruta."
      botones={(
        <>
          <button type="button" className="kp-press" onClick={() => abreConectaReloj('entreno')} style={botonAzul}>Conectar</button>
          <button type="button" className="kp-press" onClick={() => setAhoraNo(true)} style={botonGris}>Ahora no</button>
        </>
      )}
    />
  );
}
