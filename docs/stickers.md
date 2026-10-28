# Stickers

Lo que el atleta saca de la app para su historia de Instagram (o para pegar encima de un video). Sustituyen al «sello» / «activity card» (28 oct 2026). Las decisiones son de Andrés; el prototipo de referencia es https://claude.ai/artifact/JQhitX6n6A48Q6QcJRn8Sx.

## Cómo funciona

1. **La ficha de datos** (`src/lib/stickers/ficha.js`). Una sola para toda la app. Cada dato es `{ k, v, u, l }`: clave, valor ya escrito, unidad y nombre en inglés. Solo existen los datos que el entreno sí tiene, así que nunca sale «N/A».
   - `entrenoDeActividad(...)`: un entreno de la tabla `actividades` (libre, del reloj o importado).
   - `entrenoDeSesion(...)`: una sesión guiada del plan sin reloj.
   - `lib/stickers/carga.js`: para una sesión guiada, busca primero si el reloj trajo ese mismo entreno.
2. **El catálogo** (`src/lib/stickers/catalogo.js`). Cada sticker tiene **ranuras con suplentes**: cada ranura toma el primer dato que el entreno tenga. Un sticker solo desaparece si una ranura obligatoria se queda vacía (los de ruta sin GPS). Un mismo dato no se repite dentro de un sticker.
3. **El dibujo** (`src/features/stickers/Sticker.jsx` y `stickers.css`). HTML + CSS con Bricolage Grotesque. Los números bajan de tamaño hasta caber; nunca se cortan ni se envuelven.
4. **La exportación** (`src/features/stickers/exporta.js`). El sticker se dibuja otra vez fuera de la pantalla, a su tamaño real, y `modern-screenshot` lo rasteriza a 3× con fondo transparente: 900 × 600 (ancho) o 900 × 990 (alto).
5. **La hoja** (`src/features/stickers/HojaDeStickers.jsx`). Tocar = copiar. Mantener 0.6 s = guardar. Mover el dedo = desplazar. Se cierra con «Cerrar» o arrastrando la cabecera hacia abajo.

## La fuente

Bricolage Grotesque, variable (opsz 12–96, wdth 75–100, wght 500–800), descargada de Google Fonts y guardada en `public/fonts/` (latin y latin-ext). No se pide a Google en vivo por dos razones:
- `modern-screenshot` mete la fuente dentro del PNG leyéndola del mismo sitio: con la de Google la CSP lo bloquearía.
- En la app del iPhone funciona sin internet.

## Puertas de la hoja

- El aviso «Tus stickers están listos» en la página del entreno (solo al venir de terminar).
- El ⇪ de cada fila de «Tus entrenos».
- «Compartir», fijo abajo en la página del entreno.
- «Stickers» en Mis métricas (detalle de un entreno, solo el propio atleta).
- En el plan: «Compartir stickers» al final del entreno guiado y «Stickers» en el día terminado.

Nunca se abre sola al terminar: celebración → página del entreno con el aviso.

## Récords

`recordDe` (`src/lib/resumenLibre.js`) solo corre para quien NO tiene plan. Dice el valor, la diferencia contra el mejor anterior y la fecha de ese mejor (`detalle`).

## Fases

1. **Hecha (28 oct 2026):** ficha, motor de ranuras, hoja nueva y 6 stickers: Titular, Firma, Eco, Grande, Fila, Ruta y dato.
2. Los 29 restantes, «Con foto» y «Video».
3. HealthKit en la app nativa.
4. Garmin y la ubicación silenciosa.

## Pruebas

- `node scripts/prueba-stickers.mjs`: la ficha, las ranuras y el catálogo (las pruebas de aceptación que son puras).
- Lo que se pinta se revisa a ojo en pantalla, en los cuatro colores, con nombres largos y con un maratón (42.20 km, 3:58:41).

## Sin verificar

- Que Safari de iPhone respete `font-variation-settings` (wdth 75 en Eco) al rasterizar. Si falla, el plan B es dibujar en canvas con las mismas reglas.
- Que copiar una imagen al portapapeles funcione dentro de la app del iPhone. Si falla, sale «No se pudo copiar. Mantén presionado el sticker para guardarlo.».
