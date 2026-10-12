import { useEffect, useMemo, useState } from 'react';
import { Download, PlusSquare, Share, Smartphone } from 'lucide-react';
import { LT } from '@/lib/theme';
import { plataformaDeInstalacion } from '@/lib/instalarApp';
import { botonAzul } from './estilosDeTienda';

/* «Ten Training Lab en tu teléfono»: la sección de la página «Listo» que enseña a instalar la app según dónde esté la persona (ver `lib/instalarApp.js`).
   Quien compró puede estar en Safari con la app ya instalada, sin ella, o dentro de Instagram: por eso siempre dice con qué correo entrar, y no se muestra si ya abrió esto desde el ícono. */

const Paso = ({ n, icono: Icono, children }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 15, fontWeight: 600, lineHeight: 1.4 }}>
    <span style={{ width: 28, height: 28, borderRadius: 9, background: LT.blueSoft, color: LT.blue, display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 14, flexShrink: 0 }}>{n}</span>
    <span style={{ flex: 1 }}>{children}</span>
    {Icono && <Icono size={20} color={LT.blue} style={{ flexShrink: 0 }} />}
  </div>
);

// Chrome avisa que se puede instalar con este evento; se guarda para usarlo cuando la persona toque el botón.
function useAvisoDeInstalacion() {
  const [evento, setEvento] = useState(null);
  const [instalada, setInstalada] = useState(false);
  useEffect(() => {
    const alOfrecer = (e) => { e.preventDefault(); setEvento(e); };
    const alInstalar = () => { setInstalada(true); setEvento(null); };
    window.addEventListener('beforeinstallprompt', alOfrecer);
    window.addEventListener('appinstalled', alInstalar);
    return () => { window.removeEventListener('beforeinstallprompt', alOfrecer); window.removeEventListener('appinstalled', alInstalar); };
  }, []);
  const instala = async () => {
    if (!evento) return;
    evento.prompt();
    try { await evento.userChoice; } catch { /* cerró el aviso */ }
    setEvento(null);
  };
  return { puedeInstalar: !!evento, instala, instalada };
}

export default function InstalarApp({ correo }) {
  const { plataforma, navegadorInterno } = useMemo(() => plataformaDeInstalacion({
    userAgent: navigator.userAgent,
    standalone: !!(window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true),
    maxTouchPoints: navigator.maxTouchPoints,
  }), []);
  const { puedeInstalar, instala, instalada } = useAvisoDeInstalacion();

  if (plataforma === 'instalada' || instalada) return null;
  if (plataforma === 'escritorio' && !puedeInstalar) return null;

  return (
    <div style={{ background: LT.surface, borderRadius: 20, padding: 16, boxShadow: '0 1px 4px rgba(17,19,24,0.06)', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 17, fontWeight: 800 }}>
        <Smartphone size={20} color={LT.blue} /> Ten Training Lab en tu teléfono
      </div>

      {navegadorInterno ? (
        <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.5 }}>
          Estás en el navegador de otra app. Para instalarla, abre esta página en Safari o Chrome: toca los tres puntos o el menú y elige abrir en el navegador.
        </div>
      ) : puedeInstalar ? (
        <button type="button" onClick={instala} style={botonAzul(false)}><Download size={20} /> Instalar la app</button>
      ) : plataforma === 'ios' ? (
        <>
          <Paso n="1" icono={Share}>Toca <b>Compartir</b>, abajo en Safari.</Paso>
          <Paso n="2" icono={PlusSquare}>Elige <b>Agregar a pantalla de inicio</b>.</Paso>
        </>
      ) : (
        <Paso n="1">Toca el menú del navegador (los tres puntos) y elige <b>Instalar app</b>.</Paso>
      )}

      {correo && <div style={{ fontSize: 14, fontWeight: 600, color: LT.text2, lineHeight: 1.45 }}>¿Ya la tienes instalada? Ábrela desde tu pantalla de inicio y entra con <b style={{ color: LT.text }}>{correo}</b>.</div>}
    </div>
  );
}
