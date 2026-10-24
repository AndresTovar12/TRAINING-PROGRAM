/* ENTREGAR UN ARCHIVO AL USUARIO. En el navegador se baja con un enlace `download`; dentro de la app de iPhone ese enlace NO hace nada, así que se guarda
   un archivo temporal y se abre el menú de compartir del iPhone (Guardar en Fotos, Archivos, WhatsApp, Instagram…). */

import { Capacitor } from '@capacitor/core';

const aBase64 = (blob) => new Promise((ok, falla) => {
  const lector = new FileReader();
  lector.onload = () => ok(String(lector.result).split(',')[1] ?? '');
  lector.onerror = () => falla(lector.error);
  lector.readAsDataURL(blob);
});

/** `blob`: un Blob o File. `nombre`: el nombre del archivo. Devuelve cuando ya se entregó (o se abrió el menú de compartir). */
export async function entregaArchivo(blob, nombre) {
  if (Capacitor.isNativePlatform()) {
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')]);
    const { uri } = await Filesystem.writeFile({ path: nombre, data: await aBase64(blob), directory: Directory.Cache });
    try {
      await Share.share({ files: [uri], dialogTitle: nombre });
    } catch (e) {
      // Cerrar el menú sin escoger nada no es un error.
      if (!/cancel/i.test(String(e?.message ?? e))) throw e;
    }
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
