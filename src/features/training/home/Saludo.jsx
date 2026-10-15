import { FONT, KP, LT, eyebrow } from '@/lib/theme';

/**
 * El saludo de arriba de Home (reestructura visual, 15 oct 2026): «HOY, JUE 15 / ¡Hola, Andrés! 👋». Lo usan Home con plan y sin plan.
 * El botón de la cuenta está fijo arriba a la derecha (`App.jsx`): por eso el margen derecho grande.
 */
export default function Saludo({ nombre }) {
  const hoy = new Date().toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric' }).replace('.', '').replace(',', '');
  const primero = String(nombre || '').trim().split(/\s+/)[0];
  return (
    <header style={{ padding: '22px 84px 4px 20px', maxWidth: 1180, margin: '0 auto', boxSizing: 'border-box', fontFamily: FONT }}>
      <div style={eyebrow(KP.blue)}>Hoy, {hoy}</div>
      <h1 style={{ margin: '8px 0 0', fontSize: 'clamp(26px, 7.4vw, 32px)', fontWeight: 800, color: LT.text, letterSpacing: -0.6, lineHeight: 1.1, overflowWrap: 'break-word' }}>
        ¡Hola{primero ? `, ${primero}` : ''}! <span aria-hidden="true">👋</span>
      </h1>
    </header>
  );
}
