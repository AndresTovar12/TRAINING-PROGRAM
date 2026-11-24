/**
 * LAS LIGAS DE VIDEO Y EL PUENTE (24 nov 2026). Andrés: «que se pueda utilizar el link» de cualquier red, dentro de la app.
 * Revisa que cada red se reconozca y dé su reproductor oficial, y que el puente (`public/reproductor/puente.js`) solo acepte esos reproductores.
 */
import { LIGAS, ligaExterna, avisaFin } from '../src/lib/ligas.js';
import { reproductorDe, PERMITIDOS } from '../public/reproductor/puente.js';

let fallas = 0;
const mal = (t) => { fallas += 1; console.log(`✗ ${t}`); };
const igual = (a, b, t) => (JSON.stringify(a) === JSON.stringify(b) ? null : mal(`${t}\n   esperaba ${JSON.stringify(b)}\n   salió    ${JSON.stringify(a)}`));

const EJEMPLOS = {
  YouTube: 'https://www.youtube.com/watch?v=abcdef12', Vimeo: 'https://vimeo.com/123456', TikTok: 'https://www.tiktok.com/@coach/video/7300000000',
  Instagram: 'https://www.instagram.com/reel/Cx1AbC/', Facebook: 'https://www.facebook.com/coach/videos/1234567890', 'Google Drive': 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view?usp=sharing',
  Dropbox: 'https://www.dropbox.com/scl/fi/abc123/sentadilla.mp4?rlkey=xyz&dl=0',
};
// Cada red de la lista tiene su ejemplo, su reproductor y el puente lo acepta (si se suma una red y no se le da permiso en el puente, falla aquí).
for (const l of LIGAS) {
  const ej = EJEMPLOS[l.de];
  if (!ej) { mal(`La red «${l.de}» no tiene ejemplo en esta prueba`); continue; }
  const liga = ligaExterna(ej);
  igual(liga?.de, l.de, `${l.de}: se reconoce`);
  if (!PERMITIDOS[l.de]) mal(`${l.de}: el puente no la acepta (falta en PERMITIDOS)`);
  else if (!reproductorDe(l.de, liga.embed, 'https://app.traininglabapp.com')) mal(`${l.de}: el puente rechazó su reproductor oficial (${liga.embed})`);
}
igual(ligaExterna(EJEMPLOS.Dropbox).embed, 'https://www.dropbox.com/scl/fi/abc123/sentadilla.mp4?rlkey=xyz&raw=1', 'Dropbox: el archivo mismo (raw=1)');
igual([avisaFin(ligaExterna(EJEMPLOS.YouTube)), avisaFin(ligaExterna(EJEMPLOS.TikTok)), avisaFin(null)], [true, false, false], 'avisan cuándo termina: YouTube sí, TikTok no');
igual(new URL(reproductorDe('YouTube', 'https://www.youtube.com/embed/abcdef12', 'https://app.traininglabapp.com')).searchParams.get('origin'), 'https://app.traininglabapp.com', 'YouTube recibe el sitio de donde se reproduce');
// El puente NO es una puerta para poner cualquier página dentro de nuestro dominio.
for (const [de, e] of [['YouTube', 'https://evil.com/embed/x'], ['YouTube', 'http://www.youtube.com/embed/x'], ['Facebook', 'https://www.facebook.com/login'], ['Inventada', 'https://www.youtube.com/embed/x'], ['Instagram', 'https://www.instagram.com/accounts/login/'], ['YouTube', 'javascript:alert(1)']]) {
  if (reproductorDe(de, e, 'https://app.traininglabapp.com')) mal(`El puente aceptó lo que no debe: ${de} ${e}`);
}
igual(ligaExterna('https://otro-sitio.com/video')?.de, 'Enlace', 'una dirección desconocida no se incrusta');
igual(ligaExterna('https://videos.traininglabapp.com/media/a.mp4'), null, 'un archivo nuestro no es una liga');

console.log(fallas ? `\nprueba-ligas: ${fallas} falla(s)` : 'prueba-ligas: las 7 redes y el puente, todo bien.');
process.exit(fallas ? 1 : 0);
