import { Users } from 'lucide-react';
import { FONT, UI } from '@/lib/theme';

/* «CARLOS TE ESTÁ ARMANDO TU PLAN» (inicio nuevo, 30 oct 2026). Con entrenador y sin plan todavía: su foto o iniciales, su nombre y «Te avisamos cuando esté listo.»
   Sin botón: no hay nada que hacer.
   Home sin plan (2 nov 2026): `dentro` es la fila que va DENTRO de la tarjeta azul «Tu plan» (`TarjetaTuPlan`); sin `dentro` es la tarjeta azul entera, que solo
   queda en lo que ve un coach al mirar la app de su atleta. «Empieza aquí» (el renglón de registrar, el del código, el del reloj y «Sobre ti») se quitó de ese Home:
   registrar es el punto de la barra, el código está en «Tu plan», y Salud y «Sobre ti» ya se piden en el inicio. */

/** El primer nombre de quien atiende, para «Carlos te está armando tu plan». */
const nombreDe = (coach) => (coach?.full_name || coach?.username || '').trim();

export default function TeEstaArmando({ coach, dentro = false }) {
  const nombre = nombreDe(coach);
  const corto = nombre.split(/\s+/)[0];
  const ini = nombre.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
  return (
    <div style={{
      display: 'flex', gap: 12, alignItems: 'center', color: '#fff', fontFamily: FONT,
      ...(dentro ? { borderRadius: 18, padding: 12, background: 'rgba(255,255,255,0.12)', marginTop: 14, position: 'relative' } : { borderRadius: 22, padding: 16, background: UI.azul }),
    }}>
      <span style={{ width: dentro ? 40 : 44, height: dentro ? 40 : 44, borderRadius: '50%', background: 'rgba(255,255,255,0.18)', display: 'grid', placeItems: 'center', fontSize: 15, fontWeight: 800, flex: 'none', overflow: 'hidden' }}>
        {coach?.avatar_url ? <img src={coach.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : ini || <Users size={20} />}
      </span>
      <span style={{ minWidth: 0 }}>
        <b style={{ display: 'block', fontSize: 16 }}>{corto ? `${corto} te está armando tu plan` : 'Tu plan está en camino'}</b>
        <span style={{ display: 'block', fontSize: 13.5, opacity: 0.85, lineHeight: 1.35 }}>Te avisamos cuando esté listo.</span>
      </span>
    </div>
  );
}
