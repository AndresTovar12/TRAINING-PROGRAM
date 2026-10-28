import { useEffect } from 'react';
import { App as AppNativa } from '@capacitor/app';
import { useAuth } from '@/contexts/AuthContext';
import { guardaImportacion } from '@/lib/metricasApi';
import { leeSalud, marcaSincronizada, saludDisponible, ultimaSincronizacion } from '@/lib/saludDelTelefono';

/* EL RELOJ ENTRA SOLO (fase 3 de los stickers, 28 oct 2026). A quien ya conectó su Apple Watch (Mi perfil → Dispositivos), al abrir la app o volver a ella se
   le traen los entrenos nuevos de Apple Salud (los últimos 7 días; los que ya estaban no se repiten), como mucho una vez cada 30 minutos. Nunca pide el permiso:
   eso solo pasa al tocar «Conectar Apple Watch». Callado: si falla (sin red, sin permiso), se intenta la próxima vez. No dibuja nada. */

const CADA_MS = 30 * 60 * 1000;
let enCurso = false;

async function sincroniza(userId) {
  const ultima = ultimaSincronizacion();
  if (!userId || !ultima || enCurso || Date.now() - ultima < CADA_MS) return;
  enCurso = true;
  try {
    const resultado = await leeSalud({ dias: 7 });
    await guardaImportacion({ atletaId: userId, subidoPor: userId, resultado, desfaseMin: -new Date().getTimezoneOffset() });
    marcaSincronizada();
  } catch { /* la próxima vez */ } finally {
    enCurso = false;
  }
}

export default function SincronizaReloj() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  useEffect(() => {
    if (!saludDisponible() || !userId) return undefined;
    sincroniza(userId);
    const oyente = AppNativa.addListener('appStateChange', ({ isActive }) => { if (isActive) sincroniza(userId); });
    return () => { oyente.then((o) => o.remove()).catch(() => {}); };
  }, [userId]);
  return null;
}
