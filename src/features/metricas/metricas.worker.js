/* El trabajador que LEE los archivos de entrenos, fuera de la pantalla.

   Un export de Apple Salud pesa más de 1 GB y leerlo toma de segundos a minutos: si se hiciera en la pantalla, la app se quedaría congelada. Aquí se lee en un
   Worker y se le va avisando a la pantalla cómo va. Para cancelar, la pantalla simplemente apaga el Worker (`terminate`). Ver `lib/metricas/importa.js`. */
import { leeArchivos } from '@/lib/metricas/importa';

self.onmessage = async (e) => {
  const { archivos, opciones } = e.data;
  try {
    const res = await leeArchivos(archivos, { ...opciones, alProgreso: (p) => self.postMessage({ tipo: 'progreso', p }) });
    self.postMessage({ tipo: 'listo', res });
  } catch (err) {
    self.postMessage({ tipo: 'error', mensaje: err?.message ?? 'No se pudieron leer los archivos' });
  }
};
