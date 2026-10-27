import { useState } from 'react';
import { FONT } from '@/lib/theme';
import BotonEntendido from '@/components/BotonEntendido';

/**
 * El aviso de la mudanza (Andrés, 26 oct 2026): la app vivió primero en Vercel y ahora vive en app.traininglabapp.com.
 * Mientras Vercel siga encendido, quien la abra ahí ve esta franja arriba con la dirección nueva. En cualquier otra
 * dirección no sale. Se cierra con «Entendido» solo en esa pestaña: si la vuelve a abrir, vuelve a salir hasta que Vercel se apague.
 * Es independiente de todo lo demás (sin sesión ni proveedores) para que también salga en la pantalla de entrar.
 */
const DIRECCION_NUEVA = 'https://app.traininglabapp.com';
const CLAVE = 'tl:aviso-mudanza-cerrado';
const enVercel = () => /(^|\.)vercel\.app$/i.test(window.location.hostname);

export default function AvisoDeMudanza() {
  const [cerrado, setCerrado] = useState(() => {
    try { return sessionStorage.getItem(CLAVE) === '1'; } catch { return false; }
  });
  if (!enVercel() || cerrado) return null;
  const cierra = () => {
    try { sessionStorage.setItem(CLAVE, '1'); } catch { /* sin almacenamiento: se cierra solo en esta carga */ }
    setCerrado(true);
  };
  return (
    <div
      role="status"
      style={{
        position: 'sticky', top: 0, zIndex: 9000, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        padding: 'calc(env(safe-area-inset-top, 0px) + 10px) 16px 10px', background: '#1E40E0', color: '#fff', fontFamily: FONT,
        boxShadow: '0 2px 12px rgba(0,0,0,.25)',
      }}
    >
      <div style={{ flex: '1 1 220px', fontSize: 13.5, lineHeight: 1.4, fontWeight: 600 }}>
        Training Lab se está mudando a una dirección nueva. Pronto esta dejará de funcionar. Entra desde{' '}
        <a href={DIRECCION_NUEVA} style={{ color: '#fff', fontWeight: 800, textDecoration: 'underline' }}>app.traininglabapp.com</a>
        {' '}(tendrás que iniciar sesión de nuevo).
      </div>
      <BotonEntendido onClick={cierra} color="#fff" style={{ background: 'rgba(255,255,255,.18)' }} />
    </div>
  );
}
