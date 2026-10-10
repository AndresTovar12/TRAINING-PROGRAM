import { useCallback, useEffect, useRef, useState } from 'react';
import { LIMITES } from '@/features/mensajes/adjuntos';

/* LA GRABADORA DE LA NOTA DE VOZ: pide el micrófono, graba con `MediaRecorder` y entrega un archivo con su duración.

   Safari de iPhone graba `audio/mp4`; Chrome y Firefox, `audio/webm` u `ogg`. Se elige el primero que el navegador sepa. La duración se mide con el reloj (los
   archivos de `MediaRecorder` no traen la duración y un `<audio>` a veces dice «infinito»). Se corta sola a los 3 minutos. Cancelar tira lo grabado.

   `alTerminar(archivo, segundos)`: ya hay nota. `alFallar(texto)`: no se pudo (sin permiso, sin micrófono, navegador viejo). */

const FORMATOS = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
const elegido = () => (typeof MediaRecorder === 'undefined' ? null : FORMATOS.find((m) => MediaRecorder.isTypeSupported?.(m)) ?? null);
export const puedeGrabarVoz = () => !!elegido() && !!navigator.mediaDevices?.getUserMedia;

export function useGrabadoraDeVoz({ alTerminar, alFallar }) {
  const [estado, setEstado] = useState({ grabando: false, segundos: 0 });
  const grabadora = useRef(null);
  const trozos = useRef([]);
  const flujo = useRef(null);
  const reloj = useRef(null);
  const empezo = useRef(0);
  const cancelada = useRef(false);
  const avisos = useRef({ alTerminar, alFallar });
  useEffect(() => { avisos.current = { alTerminar, alFallar }; });

  const suelta = useCallback(() => {
    clearInterval(reloj.current);
    flujo.current?.getTracks().forEach((t) => t.stop());
    flujo.current = null;
  }, []);

  const termina = useCallback(() => {
    if (grabadora.current && grabadora.current.state !== 'inactive') grabadora.current.stop();
  }, []);

  const cancela = useCallback(() => {
    cancelada.current = true;
    termina();
  }, [termina]);

  const inicia = useCallback(async () => {
    const mime = elegido();
    if (!mime || !navigator.mediaDevices?.getUserMedia) { avisos.current.alFallar?.('Este navegador no puede grabar notas de voz.'); return; }
    try {
      flujo.current = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      avisos.current.alFallar?.('No se pudo abrir el micrófono. Revisa que el navegador tenga permiso.');
      return;
    }
    cancelada.current = false;
    trozos.current = [];
    const rec = new MediaRecorder(flujo.current, { mimeType: mime });
    grabadora.current = rec;
    rec.ondataavailable = (e) => { if (e.data?.size) trozos.current.push(e.data); };
    rec.onstop = () => {
      const segundos = Math.max(1, Math.round((Date.now() - empezo.current) / 1000));
      suelta();
      setEstado({ grabando: false, segundos: 0 });
      const blob = new Blob(trozos.current, { type: mime.split(';')[0] });
      trozos.current = [];
      if (cancelada.current || blob.size === 0) return;
      const ext = mime.startsWith('audio/mp4') ? 'm4a' : (mime.includes('ogg') ? 'ogg' : 'webm');
      avisos.current.alTerminar?.(new File([blob], `voz.${ext}`, { type: blob.type }), segundos);
    };
    rec.start(1000);
    empezo.current = Date.now();
    setEstado({ grabando: true, segundos: 0 });
    reloj.current = setInterval(() => {
      const s = Math.floor((Date.now() - empezo.current) / 1000);
      setEstado({ grabando: true, segundos: s });
      if (s >= LIMITES.vozSegundos) termina();
    }, 250);
  }, [suelta, termina]);

  // Si la pantalla se cierra grabando, se apaga el micrófono y no se manda nada.
  useEffect(() => () => { cancelada.current = true; if (grabadora.current?.state === 'recording') grabadora.current.stop(); suelta(); }, [suelta]);

  return { ...estado, inicia, termina, cancela };
}
