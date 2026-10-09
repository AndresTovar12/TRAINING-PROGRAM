/**
 * El editor que aparece JUSTO DESPUÉS de elegir o tomar una foto, antes de
 * subirla. El hermano del de video, con lo que aplica a una foto: recortar.
 *
 * POR QUÉ EXISTE. Andrés: "me parece que está bien el tema de la edición de
 * videos y todo eso, pero también para las fotos de portada se debería poder
 * hacer algún recorte o algo así". Y es peor en las fotos que en los videos:
 * una foto del carrete sale apaisada del teléfono y la portada del ejercicio es
 * un recuadro. Sin recorte, el navegador decide qué mitad tira — y suele tirar
 * justo la persona.
 *
 * QUÉ LE HACE AL ARCHIVO: lo corta de verdad. Al revés que en el video, aquí sí
 * se tocan los píxeles, porque cortar una foto no le quita calidad a lo que
 * queda y además la hace pesar menos. En el video, reencodar sí costaría
 * calidad, así que el recorte se guarda al lado y se aplica al reproducir.
 */
import { useEffect, useState } from 'react';
import PantallaDeEncuadre from '@/features/admin/PantallaDeEncuadre';
import { archivoDesdeUrl } from '@/features/admin/recorte';

/* La foto no tiene tira de tiempo ni sonido: lo único que se le hace es encuadrarla, así que su editor ES la pantalla de
   encuadre (ver `PantallaDeEncuadre`), con la misma cara que el recorte del video. Su ✓ además sube la foto, y mientras
   sube enseña el avance en el propio botón. */
export default function EditorFoto({ archivo, url, onCancelar, onListo, subiendo, avance }) {
  const [medidas, setMedidas] = useState(null); // tamaño real, en píxeles

  /* UNA SOLA FUENTE: siempre se trabaja sobre un archivo.
     Si llega una foto ya subida, primero se la baja. Así lo que se enseña y lo
     que se recorta es una dirección temporal del propio navegador, sin
     restricciones de dominio ni lienzos "sucios" que no se puedan exportar. */
  const [archivoReal, setArchivoReal] = useState(archivo ?? null);
  const [err, setErr] = useState('');
  useEffect(() => {
    if (archivo) { setArchivoReal(archivo); return undefined; }
    if (!url) return undefined;
    let vivo = true;
    archivoDesdeUrl(url)
      .then((f) => { if (vivo) setArchivoReal(f); })
      .catch((e) => { if (vivo) setErr(e.message || 'No se pudo leer la foto.'); });
    return () => { vivo = false; };
  }, [archivo, url]);

  /* La dirección temporal del archivo.
     SE CREA Y SE LIBERA DENTRO DEL MISMO EFECTO, a propósito. Tenerla en un
     useMemo y liberarla en un efecto aparte parece equivalente y no lo es:
     React monta, desmonta y vuelve a montar cada pantalla para cazar errores,
     y en ese ida y vuelta la dirección se liberaba pero no se volvía a crear.
     Resultado: la foto no cargaba. Medido, no deducido: `naturalWidth` valía 0. */
  const [local, setLocal] = useState(null);
  useEffect(() => {
    if (!archivoReal) { setLocal(null); return undefined; }
    const u = URL.createObjectURL(archivoReal);
    setLocal(u);
    return () => URL.revokeObjectURL(u);
  }, [archivoReal]);

  // Las medidas salen de la propia foto, antes de dibujar el marco (que necesita su proporción exacta).
  useEffect(() => {
    if (!local) { setMedidas(null); return undefined; }
    let vivo = true;
    const img = new Image();
    img.onload = () => { if (vivo) setMedidas({ w: img.naturalWidth || 1, h: img.naturalHeight || 1 }); };
    img.onerror = () => { if (vivo) setErr('No se pudo leer la foto.'); };
    img.src = local;
    return () => { vivo = false; };
  }, [local]);

  if (err && !local) {
    return (
      <PantallaDeEncuadre
        medio={null} medidas={null} onCancelar={onCancelar} onListo={() => {}} ocupado={false} mensaje={err} zIndex={6000}
      />
    );
  }

  return (
    <PantallaDeEncuadre
      medio={local ? { tipo: 'foto', src: local } : null} medidas={medidas} zIndex={6000}
      ocupado={!!subiendo} avance={avance ?? 0}
      mensaje="Abriendo la foto…" onCancelar={onCancelar}
      onListo={(recorte) => onListo({ encuadre: recorte, archivo: archivoReal })}
    />
  );
}
