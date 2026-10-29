import { useEffect } from 'react';
import { App as AppNativa } from '@capacitor/app';
import { useAuth } from '@/contexts/AuthContext';
import { saludDisponible, ultimaSincronizacion } from '@/lib/saludDelTelefono';
import { AVISO_RELOJ_TERMINO, AVISO_RELOJ_TRAJO } from '@/lib/relojApple';
import { ponTrayendo, recargaDelReloj, relojAhora, useVigilaElReloj } from '@/lib/relojConectado';
import { traeDelReloj, traeLoDeAntes } from '@/lib/sincronizaSalud';

/* EL RELOJ ENTRA SOLO (fase 3 de los stickers, 28 oct 2026; fase 5, 29 oct 2026). A quien conectó su Apple Watch (la conexión vive en la cuenta y este iPhone
   ya dio el permiso) se le trae lo nuevo de Apple Salud:
     · al abrir la app y al volver a ella: siempre las últimas 3 horas (lo que acaba de grabar el reloj llega sin esperar), y los últimos 7 días
       (nunca antes de conectar) como mucho una vez cada 30 minutos;
     · al terminar un entreno con el reloj (`terminaEnReloj` avisa): a los 8 s, las últimas 3 horas; si no llegó nada, otra vez a los 20 s y a los 60 s, sin el
       límite de 30 minutos. Mientras, la página del entreno dice «Trayendo tu pulso del reloj…».
   Lo de antes de conectar se trae una sola vez, en segundo plano, después de lo nuevo (`traeLoDeAntes`). Nunca pide el permiso. Callado: si falla (sin red,
   sin permiso), se intenta la próxima vez. No dibuja nada. */

const CADA_MS = 30 * 60 * 1000;
const ESPERAS_MS = [8000, 20000, 60000];

async function alAbrir(userId) {
  await recargaDelReloj(userId);
  const ultima = ultimaSincronizacion();
  const tocaLaSemana = !ultima || Date.now() - ultima >= CADA_MS;
  try { await traeDelReloj(tocaLaSemana ? {} : { horas: 3 }); } catch { /* la próxima vez */ }
  traeLoDeAntes();
}

let porEntreno = 0;
async function alTerminarEntreno() {
  const { conexion, aqui, reloj } = relojAhora();
  if (!conexion || !aqui || !reloj.emparejado) return;
  const vuelta = ++porEntreno;
  ponTrayendo(true);
  let trajo = null;
  const inicio = Date.now();
  for (const espera of ESPERAS_MS) {
    await new Promise((r) => setTimeout(r, Math.max(0, espera - (Date.now() - inicio))));
    if (vuelta !== porEntreno) return; // terminó otro entreno: esa vuelta manda
    try {
      const r = await traeDelReloj({ horas: 3 });
      if (r && (r.nuevos > 0 || r.enriquecidos?.length > 0)) { trajo = r; break; }
    } catch { /* se intenta en la siguiente espera */ }
  }
  if (vuelta !== porEntreno) return;
  ponTrayendo(false);
  window.dispatchEvent(new CustomEvent(AVISO_RELOJ_TRAJO, { detail: trajo }));
}

export default function SincronizaReloj() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  useVigilaElReloj(userId);
  useEffect(() => {
    if (!saludDisponible() || !userId) return undefined;
    alAbrir(userId);
    const oyente = AppNativa.addListener('appStateChange', ({ isActive }) => { if (isActive) alAbrir(userId); });
    window.addEventListener(AVISO_RELOJ_TERMINO, alTerminarEntreno);
    return () => {
      oyente.then((o) => o.remove()).catch(() => {});
      window.removeEventListener(AVISO_RELOJ_TERMINO, alTerminarEntreno);
    };
  }, [userId]);
  return null;
}
