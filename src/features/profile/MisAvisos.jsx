import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { CANALES, CATEGORIAS, POR_DEFECTO, guardaMiAviso, leeMisAvisos } from '@/lib/avisos';
import { Aviso, Interruptor, tarjeta, titulo } from '@/features/profile/piezas';
import { T } from '@/lib/theme';

/* «AVISOS» en Mi perfil (15 oct 2026). Se guarda cada cambio al instante en `preferencias_de_avisos`; quien MANDA los avisos (correo y notificaciones del teléfono) la lee antes de mandar.
   Las notificaciones del teléfono llegan con la app de la tienda: hoy el interruptor se guarda y se respeta cuando existan. */

function Fila({ texto, detalle, activo, onCambio, primera }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px', borderTop: primera ? 'none' : `1px solid ${T.border}` }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 700, color: T.text }}>{texto}</div>
        {detalle && <div style={{ fontSize: 12.5, fontWeight: 600, color: T.text2, marginTop: 2, lineHeight: 1.4 }}>{detalle}</div>}
      </div>
      <Interruptor activo={activo} onCambio={onCambio} etiqueta={texto} />
    </div>
  );
}

export default function MisAvisos() {
  const [prefs, setPrefs] = useState(undefined);
  const [error, setError] = useState('');

  useEffect(() => {
    let vivo = true;
    leeMisAvisos().then((p) => { if (vivo) setPrefs(p); }).catch(() => { if (vivo) { setPrefs({ ...POR_DEFECTO }); setError('No se pudieron leer tus avisos; se ven los de fábrica.'); } });
    return () => { vivo = false; };
  }, []);

  async function cambia(id, valor) {
    const antes = prefs;
    setPrefs({ ...prefs, [id]: valor });
    setError('');
    try { await guardaMiAviso({ [id]: valor }); } catch { setPrefs(antes); setError('No se pudo guardar. Inténtalo de nuevo.'); }
  }

  if (!prefs) return <div style={{ display: 'grid', placeItems: 'center', padding: 30 }}><Loader2 size={22} className="spin" color={T.text2} /></div>;

  return (
    <>
      {error && <Aviso tono="malo" role="alert">{error}</Aviso>}
      <div>
        <div style={titulo}>Qué quieres que te avisemos</div>
        <div style={{ ...tarjeta, padding: 0 }}>
          {CATEGORIAS.map((c, i) => <Fila key={c.id} primera={i === 0} texto={c.texto} detalle={c.detalle} activo={!!prefs[c.id]} onCambio={(v) => cambia(c.id, v)} />)}
        </div>
      </div>
      <div>
        <div style={titulo}>Por dónde</div>
        <div style={{ ...tarjeta, padding: 0 }}>
          {CANALES.map((c, i) => <Fila key={c.id} primera={i === 0} texto={c.texto} activo={!!prefs[c.id]} onCambio={(v) => cambia(c.id, v)} />)}
        </div>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: T.text3, marginTop: 8, lineHeight: 1.5 }}>
          Los avisos en el teléfono llegan con la app de la tienda. Lo que dejes aquí se respeta desde el primer día. Los correos de tu cuenta (como recuperar tu contraseña) siempre se mandan.
        </div>
      </div>
    </>
  );
}
