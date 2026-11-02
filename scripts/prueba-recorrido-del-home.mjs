/* El recorrido de la primera vez (Home sin plan, 2 nov 2026): los seis pasos con sus textos, el globo que nunca se sale de la pantalla y el hueco que cae sobre la pieza.
   `node scripts/prueba-recorrido-del-home.mjs`. */
import assert from 'node:assert/strict';
import { PASOS, colocaElGlobo, desplazamientoParaVer, mascaraDelHueco } from '../src/lib/recorridoDelHome.js';

// Los pasos, en orden y con el texto del spec.
assert.deepEqual(PASOS.map((p) => p.id), ['registrar', 'explorar', 'plan', 'semana', 'atajos', 'perfil']);
assert.deepEqual(PASOS.map((p) => p.titulo), ['Entrena y comparte', 'Explora planes', 'Tu plan', 'Tu semana', 'Tus atajos', 'Tu perfil']);
const texto = (id, o = {}) => PASOS.find((p) => p.id === id).texto(o);
assert.equal(texto('registrar'), 'Corre, ve al gym, nada: empieza aquí. Al terminar, tu entreno se vuelve un sticker para tu historia de Instagram.');
assert.equal(texto('plan', { conCoach: false }), 'Cuando tengas un plan, aquí vas a ver lo que te toca cada día. Búscalo, o pon el código de tu coach.');
assert.equal(texto('plan', { conCoach: true, nombreCoach: 'Carlos' }), 'Aquí vas a ver lo que te toca cada día. Carlos te está armando tu plan; te avisamos cuando esté listo.');
assert.match(texto('perfil'), /puedes volver a ver este recorrido\.$/);

// El globo: debajo si cabe, arriba si no, siempre dentro de la pantalla y con la flecha sobre el centro de la pieza. iPhone SE (375×667) y grande (430×932), con la isla y la barra de inicio.
const pantallas = [{ w: 375, h: 667, arriba: 20, abajo: 0 }, { w: 430, h: 932, arriba: 59, abajo: 34 }];
const huecos = [
  { x: 160, y: 590, w: 70, h: 70 }, // el punto de Registrar, en la barra
  { x: 290, y: 600, w: 80, h: 60 }, // Explorar, a la derecha de la barra
  { x: 310, y: 22, w: 62, h: 62 }, // la cuenta, arriba a la derecha
  { x: 12, y: 130, w: 350, h: 70 }, // la tira
  { x: 12, y: 90, w: 350, h: 270 }, // la tarjeta azul
  { x: 12, y: 300, w: 350, h: 160 }, // los atajos
];
for (const pantalla of pantallas) {
  for (const hueco of huecos) {
    for (const alto of [150, 190, 240]) {
      const g = colocaElGlobo({ hueco, alto, pantalla });
      assert.ok(g.left >= 16 && g.left + g.ancho <= pantalla.w - 16, `horizontal ${JSON.stringify([pantalla.w, hueco, alto])}`);
      assert.ok(g.top >= pantalla.arriba + 16 && g.top + alto <= pantalla.h - pantalla.abajo - 16, `vertical ${JSON.stringify([pantalla.w, hueco, alto])}`);
      assert.ok(g.flecha >= 28 && g.flecha <= g.ancho - 28, 'la flecha no se pega a las esquinas');
      const centro = hueco.x + hueco.w / 2;
      if (centro - g.left >= 28 && centro - g.left <= g.ancho - 28) assert.equal(Math.round(g.left + g.flecha), Math.round(centro), 'la flecha apunta al centro de la pieza');
      if (g.abajo) assert.ok(g.top >= hueco.y + hueco.h, 'debajo no tapa la pieza'); else assert.ok(g.top + alto <= hueco.y, 'arriba no tapa la pieza');
    }
  }
}
const P = pantallas[0];
assert.equal(colocaElGlobo({ hueco: huecos[3], alto: 190, pantalla: P }).abajo, true, 'la tira: el globo cabe debajo');
assert.equal(colocaElGlobo({ hueco: huecos[0], alto: 190, pantalla: P }).abajo, false, 'la barra de abajo: el globo va arriba');

// Mover la página: lo que se ve entero y deja lugar al globo no se mueve; lo demás baja hasta quedar debajo del botón de la cuenta.
const limites = { arriba: 20 + 84, abajo: 667 - 76 };
assert.equal(desplazamientoParaVer({ rect: { top: 130, bottom: 200 }, alto: 190, pantalla: P, limites }), 0, 'la tira ya se ve');
assert.equal(desplazamientoParaVer({ rect: { top: 640, bottom: 800 }, alto: 190, pantalla: P, limites }), 640 - limites.arriba, 'los atajos están abajo: la página baja');
assert.equal(desplazamientoParaVer({ rect: { top: -300, bottom: -230 }, alto: 190, pantalla: P, limites }), -300 - limites.arriba, 'una pieza más arriba: la página sube');
assert.equal(desplazamientoParaVer({ rect: { top: 400, bottom: 560 }, alto: 190, pantalla: P, limites }), 0, 'se ve entera y el globo cabe arriba de ella');
assert.equal(desplazamientoParaVer({ rect: { top: 150, bottom: 560 }, alto: 190, pantalla: P, limites }), 150 - limites.arriba, 'se ve entera pero el globo no cabe ni arriba ni abajo: la sube');

// La máscara: un rectángulo con un hueco (regla par-impar) del tamaño pedido; el radio nunca pasa de la mitad del lado.
const m = decodeURIComponent(mascaraDelHueco(375, 667, { x: 10, y: 20, w: 100, h: 40 }, 999));
assert.match(m, /width='375' height='667'/);
assert.match(m, /fill-rule='evenodd'/);
assert.match(m, /A20,20 0 0 1 110,40/, 'esquinas de media altura como tope');

console.log('prueba-recorrido-del-home: todo bien');
