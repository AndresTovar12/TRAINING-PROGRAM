# Tarjetas de stickers: el fondo al 40 % (transparentoso)

**Modelo:** Sonnet 5.5, esfuerzo alto.

Maqueta aprobada: artifact Ae6gZVupudXto8n1sKdj1j (versión 5, el control «Fondo de la tarjeta» en 40 %).

## Lo que cambia

SOLO el fondo de las tarjetas. Todo lo de adentro se queda igual: el borde, el brillo de afuera y de adentro, las curvas de nivel, la ruta neón, los números, las rayas de luz y la marca.

En `src/lib/stickers/catalogo.js`, en `TEMAS_TARJETA`, cambia solo `fondo` de cada tema por estos (los mismos colores, al 40 %). Usa rgba, no color-mix: así lo rasteriza bien modern-screenshot en el iPhone.

- blanco: `radial-gradient(120% 80% at 50% 0%, rgba(10,33,66,.4) 0%, rgba(4,18,42,.4) 45%, rgba(2,10,24,.4) 100%)`
- negro: `radial-gradient(120% 80% at 50% 0%, rgba(255,255,255,.4) 0%, rgba(242,244,248,.4) 55%, rgba(230,234,241,.4) 100%)`
- azul: `radial-gradient(120% 80% at 50% 0%, rgba(74,116,255,.4) 0%, rgba(36,72,230,.4) 50%, rgba(22,51,185,.4) 100%)`
- coral: `radial-gradient(120% 80% at 50% 0%, rgba(59,22,16,.4) 0%, rgba(32,10,7,.4) 50%, rgba(18,5,4,.4) 100%)`

Aplica a las 6 tarjetas: las 5 de Actividad y «Tarjeta de la semana» de Totales.

## Revisa

1. El PNG exportado de cada tarjeta, en los 4 colores: el fondo sale translúcido (ábrelo sobre una foto o sobre el damero y se ve a través), y el borde y el brillo siguen igual.
2. En el mosaico de la hoja, sobre el fondo oscuro de la hoja, la tarjeta se sigue leyendo.
3. `npm run check` en verde.
4. Actualiza `docs/stickers.md`: las tarjetas llevan el fondo al 40 % (Andrés, 5 nov 2026).

Commit: «Stickers: las tarjetas con el fondo al 40 %, transparentoso».
Dime el hash y el número de build de TestFlight.
