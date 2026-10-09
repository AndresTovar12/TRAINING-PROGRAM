/**
 * Las miniaturas de la tira del tiempo, sacadas MIENTRAS SE GRABA, de la propia vista previa de la cámara.
 *
 * Andrés, 9 oct 2026, comparando con WhatsApp cuadro por cuadro: al parar de grabar, nosotros enseñábamos un negro con un
 * giro y luego la tira se llenaba de izquierda a derecha; WhatsApp pasa de la cámara al editor con la tira ya completa.
 * Sacar las diez miniaturas DESPUÉS de grabar cuesta abrir el archivo y saltar a diez puntos (≈0,4 s en un iPhone). Sacarlas
 * durante la grabación no cuesta nada que se note: cada cuarto de segundo se copia el cuadro de la vista previa a un lienzo
 * de 80 px de alto (unos milisegundos) y se guarda como una imagen de pocos KB.
 *
 * Al parar, `termina()` reparte diez a lo largo de lo grabado (la más cercana a cada punto) y las entrega al editor junto
 * con una FOTO GRANDE del primer cuadro: así el editor abre con la imagen y la tira ya puestas, antes de que el archivo
 * se haya abierto siquiera. `foto()` saca una foto grande de lo que se ve AHORA: sirve para congelar la pantalla al parar,
 * en vez de ponerla en negro.
 *
 * Nada de esto puede dejar al coach sin grabar: si un lienzo no se deja leer, se devuelve lo que haya (o nada) y el editor
 * saca las miniaturas del archivo como siempre.
 */

const CUANTAS = 10;
const ALTO = 80;            // el alto de la tira
const CADA_MS = 250;        // una captura cada cuarto de segundo
const TOPE = 400;           // guardadas de más, se adelgazan: una de cada dos, y se captura la mitad de seguido
const ANCHO_DE_LA_FOTO = 720;

/** Un lienzo con el cuadro actual del video, de `ancho` px (o menos, si el video es más chico). Lanza si no hay cuadro. */
function aLienzo(video, ancho, alto = null) {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) throw new Error('la vista previa no tiene medidas');
  const k = alto ? alto / h : Math.min(1, ancho / w);
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * k));
  c.height = Math.max(1, Math.round(h * k));
  c.getContext('2d').drawImage(video, 0, 0, c.width, c.height);
  return c;
}

/**
 * Empieza a capturar de `video` (el <video> de la vista previa, ya reproduciendo). Devuelve `{ foto, termina }`.
 * Llamar a `termina()` SIEMPRE (también si la grabación falla): es lo que para el reloj de capturas.
 */
export function miniaturasEnVivo(video, { cuantas = CUANTAS, cada = CADA_MS } = {}) {
  let lista = [];              // [{ t: segundos desde el inicio, src: data URL }]
  let paso = cada;
  let reloj = null;
  let terminado = false;
  const t0 = performance.now();
  const ahora = () => (performance.now() - t0) / 1000;

  // El primer cuadro, grande: es la imagen con la que abre el editor.
  let portada = null;
  try { portada = aLienzo(video, ANCHO_DE_LA_FOTO).toDataURL('image/jpeg', 0.8); } catch { portada = null; }

  const toma = () => {
    if (terminado) return;
    try {
      lista.push({ t: ahora(), src: aLienzo(video, 0, ALTO).toDataURL('image/jpeg', 0.65) });
    } catch { /* un cuadro que no se pudo leer: se sigue con el siguiente */ }
    if (lista.length >= TOPE) {
      lista = lista.filter((_, i) => i % 2 === 0);
      paso *= 2;
    }
    reloj = window.setTimeout(toma, paso);
  };
  toma();

  return {
    /** Una foto grande de lo que se ve ahora mismo, o `null` si no se pudo. */
    foto() {
      try { return aLienzo(video, ANCHO_DE_LA_FOTO).toDataURL('image/jpeg', 0.8); } catch { return null; }
    },
    /**
     * Para de capturar y devuelve `{ miniaturas, portada, duracion }`: las `cuantas` miniaturas repartidas a lo largo de lo
     * grabado (`duracion` en segundos: lo que marcó el reloj entre empezar y parar), o `null` si no se consiguió ninguna.
     */
    termina() {
      terminado = true;
      window.clearTimeout(reloj);
      const duracion = ahora();
      if (!lista.length) return null;
      const miniaturas = Array.from({ length: cuantas }, (_, i) => {
        const objetivo = (duracion / cuantas) * i + duracion / (cuantas * 2);
        let mejor = lista[0];
        for (const c of lista) if (Math.abs(c.t - objetivo) < Math.abs(mejor.t - objetivo)) mejor = c;
        return mejor.src;
      });
      return { miniaturas, portada, duracion };
    },
  };
}
