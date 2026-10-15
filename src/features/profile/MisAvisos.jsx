import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { CANALES, CATEGORIAS, POR_DEFECTO, guardaMiAviso, leeMisAvisos } from '@/lib/avisos';
import { useAviso } from '@/components/AvisoPasajero';
import { Fila, Grupo, Interruptor } from '@/components/ui';
import { KP } from '@/lib/theme';

/* «AVISOS» en Mi perfil (15 oct 2026). Se guarda cada cambio al instante en `preferencias_de_avisos`; quien MANDA los avisos (correo y notificaciones del teléfono) la lee antes de mandar.
   Las notificaciones del teléfono llegan con la app de la tienda: hoy el interruptor se guarda y se respeta cuando existan.
   Reestructura visual (15 oct 2026): renglones con interruptor, como «Avisos» de las capturas. Se separan en QUÉ (cada tipo de aviso) y POR DÓNDE (teléfono y correo),
   porque así se guarda: apagar «Mensajes» los apaga en los dos lados. */

export default function MisAvisos() {
  const { avisa } = useAviso();
  const [prefs, setPrefs] = useState(undefined);

  useEffect(() => {
    let vivo = true;
    leeMisAvisos().then((p) => { if (vivo) setPrefs(p); }).catch(() => { if (vivo) { setPrefs({ ...POR_DEFECTO }); avisa('No se pudieron leer tus avisos; se ven los de fábrica'); } });
    return () => { vivo = false; };
  }, [avisa]);

  async function cambia(id, valor) {
    const antes = prefs;
    setPrefs({ ...prefs, [id]: valor });
    try { await guardaMiAviso({ [id]: valor }); } catch { setPrefs(antes); avisa('No se pudo guardar. Inténtalo de nuevo.'); }
  }

  if (!prefs) return <div style={{ display: 'grid', placeItems: 'center', padding: 30 }}><Loader2 size={22} className="spin" color={KP.ink2} /></div>;

  return (
    <>
      <Grupo titulo="Qué te avisamos">
        {CATEGORIAS.map((c) => <Fila key={c.id} texto={c.texto} detalle={c.detalle} derecha={<Interruptor activo={!!prefs[c.id]} onCambio={(v) => cambia(c.id, v)} etiqueta={c.texto} />} />)}
      </Grupo>
      <Grupo titulo="Por dónde" pie="Los avisos en el teléfono llegan con la app de la tienda. Los correos de tu cuenta (como recuperar tu contraseña) siempre se mandan.">
        {CANALES.map((c) => <Fila key={c.id} texto={c.texto} derecha={<Interruptor activo={!!prefs[c.id]} onCambio={(v) => cambia(c.id, v)} etiqueta={c.texto} />} />)}
      </Grupo>
    </>
  );
}
