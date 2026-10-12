/* INSTALAR TRAINING LAB EN EL TELÉFONO: cómo se hace según dónde está parada la persona.

   La app es una PWA (manifest + íconos): se instala desde el navegador, sin tienda. Lo que cambia es el camino:
     android     Chrome ofrece un botón propio (`beforeinstallprompt`); si no lo ofreció, el menú ⋮ → «Instalar app».
     ios         Safari: Compartir → «Agregar a pantalla de inicio». No hay botón que se pueda tocar desde la página.
     escritorio  Chrome/Edge a veces ofrecen el botón; si no, no se insiste.
     instalada   ya se abrió desde el ícono (modo «standalone»): no hay nada que instalar.
   Y un caso que importa de verdad: quien llega desde Instagram o TikTok abre el link DENTRO de la app de esa red (un navegador
   interno). Ahí no se puede instalar nada: hay que abrirlo en Safari/Chrome. Se detecta para decírselo en vez de dar pasos que no existen.
   Puro: se le pasan los datos del navegador, sin tocar `window`. */

const NAVEGADOR_INTERNO = /Instagram|FBAN|FBAV|FB_IAB|FBIOS|TikTok|musical_ly|Snapchat|Line\/|MicroMessenger|Twitter/i;

/**
 * { plataforma: 'instalada' | 'ios' | 'android' | 'escritorio', navegadorInterno: boolean }
 * `standalone`: la app ya corre desde su ícono. `maxTouchPoints`: un iPad moderno se presenta como Mac; la pantalla táctil lo delata.
 */
export function plataformaDeInstalacion({ userAgent = '', standalone = false, maxTouchPoints = 0 } = {}) {
  const ua = String(userAgent);
  const navegadorInterno = NAVEGADOR_INTERNO.test(ua);
  if (standalone) return { plataforma: 'instalada', navegadorInterno: false };
  const esIpadDisfrazado = /Macintosh/.test(ua) && Number(maxTouchPoints) > 1;
  if (/iPhone|iPad|iPod/.test(ua) || esIpadDisfrazado) return { plataforma: 'ios', navegadorInterno };
  if (/Android/.test(ua)) return { plataforma: 'android', navegadorInterno };
  return { plataforma: 'escritorio', navegadorInterno };
}
