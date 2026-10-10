/* Lee archivos de entrenos en un Worker (la pantalla no se congela) y, si el navegador no puede abrir uno, en la propia pantalla.

   Devuelve `{ promesa, cancela }`. `cancela()` apaga el Worker al instante y la promesa se rechaza con «Importación cancelada». */
export function leeEnSegundoPlano(archivos, opciones, alProgreso) {
  let worker = null;
  let rechaza = () => {};
  const promesa = new Promise((resolve, reject) => {
    rechaza = reject;
    try {
      worker = new Worker(new URL('./metricas.worker.js', import.meta.url), { type: 'module' });
    } catch {
      worker = null;
    }
    if (!worker) {
      import('@/lib/metricas/importa').then(({ leeArchivos }) => leeArchivos(archivos, { ...opciones, alProgreso })).then(resolve, reject);
      return;
    }
    worker.onmessage = (e) => {
      const m = e.data;
      if (m.tipo === 'progreso') alProgreso?.(m.p);
      else if (m.tipo === 'listo') { worker.terminate(); resolve(m.res); }
      else if (m.tipo === 'error') { worker.terminate(); reject(new Error(m.mensaje)); }
    };
    worker.onerror = () => { worker.terminate(); reject(new Error('No se pudo abrir el lector de archivos de este navegador')); };
    worker.postMessage({ archivos, opciones: { desde: opciones?.desde ?? null, hasta: opciones?.hasta ?? null } });
  });
  return {
    promesa,
    cancela: () => { worker?.terminate(); rechaza(new Error('Importación cancelada')); },
  };
}
