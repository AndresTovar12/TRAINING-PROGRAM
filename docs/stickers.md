# Stickers

Lo que el atleta saca de la app para su historia de Instagram (o para pegar encima de un video). Sustituyen al «sello» / «activity card» (28 oct 2026). Las decisiones son de Andrés; el prototipo de referencia es https://claude.ai/artifact/JQhitX6n6A48Q6QcJRn8Sx.

## Cómo funciona

1. **La ficha de datos** (`src/lib/stickers/ficha.js`). Una sola para toda la app. Cada dato es `{ k, v, u, l }`: clave, valor ya escrito, unidad y nombre en inglés. Solo existen los datos que el entreno sí tiene, así que nunca sale «N/A».
   - `entrenoDeActividad(...)`: un entreno de la tabla `actividades` (libre, del reloj o importado).
   - `entrenoDeSesion(...)`: una sesión guiada del plan sin reloj.
   - `lib/stickers/carga.js`: para una sesión guiada, busca primero si el reloj trajo ese mismo entreno (completo, con sus vueltas). También trae el historial del año (`cargaHistorial`: Semana, Mes, Racha) y el @usuario del coach (`coachDe`: «Programmed by»).
   - El tipo: en el plan, el que eligió el coach (`tipoParaStickers(day)` en `lib/aspectoDelTipo.js`: su nombre y el ícono del catálogo); en un entreno libre, el de la actividad. `useTipoDeSesion` le pone su tipo a cada sesión guiada del historial.
   - Las vueltas (parciales por km) NO vienen en la lista de entrenos: la página del entreno, Mis métricas y la hoja del plan leen el entreno completo (`getActividad`).
2. **El catálogo** (`src/lib/stickers/catalogo.js`). Cada sticker tiene **ranuras con suplentes**: cada ranura toma el primer dato que el entreno tenga. Un sticker solo desaparece si una ranura obligatoria se queda vacía (los de ruta sin GPS). Un mismo dato no se repite dentro de un sticker.
3. **El dibujo** (`src/features/stickers/Sticker.jsx` y `stickers.css`). HTML + CSS con Bricolage Grotesque. Los números bajan de tamaño hasta caber; nunca se cortan ni se envuelven.
4. **La exportación** (`src/features/stickers/exporta.js`). El sticker se dibuja otra vez fuera de la pantalla, a su tamaño real, y `modern-screenshot` lo rasteriza a 3× con fondo transparente: 900 × 600 (ancho) o 900 × 990 (alto). En «Con foto», 900 × 1599 con la foto debajo.
   - **Video:** 3 s, 900 × 990, mp4. Se arman capas con el mismo dibujo y se codifican cuadro por cuadro con `mediabunny` (el codificador H.264 del teléfono): cada cuadro con su tiempo exacto. Si el teléfono no sabe, se graba en vivo con `MediaRecorder`. Un video no puede ser transparente: va sobre el fondo de la hoja (blanco con la tinta negra).
5. **La hoja** (`src/features/stickers/HojaDeStickers.jsx`). Pestañas Stickers · Con foto · Video. Tocar = copiar. Mantener 0.6 s = guardar. Mover el dedo = desplazar. En Video, tocar o mantener guarda el video. Se cierra con «Cerrar» o arrastrando la cabecera hacia abajo.
   - **Con foto:** solo los de identidad (Titular, Titular · récord, Firma, Eco, Grande) sobre una foto 9:16: tres de ejemplo (dibujadas) o una del carrete. La del carrete se queda en memoria (un enlace `blob:` local): nunca se sube.

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

## Récords (los stickers Titular · récord y Récord)

`recordDe` (`src/lib/resumenLibre.js`) solo corre para quien NO tiene plan. Dice el valor, la diferencia contra el mejor anterior y la fecha de ese mejor (`detalle`). La ficha lo pasa al inglés («1.10 km more than your best on Oct 9»). «La primera vez» no cuenta como récord en los stickers (no hay contra qué).

En un workout del plan (`src/lib/stickers/plan.js`, `recordDelPlan`): se compara cada serie hecha contra su paso del plan. Es récord si en un ejercicio igualó los kilos programados en todas sus series y esos kilos son más que lo que había levantado antes en ese ejercicio («Justo lo programado: 4 × 5 con 100 kg»). Si se pasó (más kilos o más reps), no se celebra. Si la sesión va en %, RPE o texto, no hay récord. Sin marca anterior tampoco (no hay contra qué).

«Lo que tocó hoy» dice las series hechas contra las PROGRAMADAS (`seriesProgramadas`): «12/16 sets». Si no se saben (un AMRAP, o desde Mis métricas), solo «12 sets».

## Fases

1. **Hecha (28 oct 2026):** ficha, motor de ranuras, hoja nueva y 6 stickers: Titular, Firma, Eco, Grande, Fila, Ruta y dato.
2. **Hecha (28 oct 2026):** los 29 restantes, «Con foto» y «Video». El volumen solo sale en Lista y Columna.
3. **Hecha (28 oct 2026):** HealthKit en la app nativa (ver abajo).
4. Garmin y la ubicación silenciosa.

## El Apple Watch (HealthKit, fase 3)

- Mi perfil → Dispositivos → «Apple Salud y Apple Watch». Al prenderlo sale primero para qué es (`PARA_QUE_ES` en `src/lib/saludDelTelefono.js`) y el botón «Conectar Apple Watch»: solo ahí se pide el permiso de HealthKit. Si dice «Ahora no», no se le pide nada al iPhone.
- Cada HKWorkout entra como una fila de `actividades` con `origen = 'healthkit'` (`src/lib/metricas/leeHealthKit.js` → `preparaEntreno` → `construyeActividad`): tipo, inicio, fin, duración, distancia y energía activa (las del entreno, o la suma de sus muestras), pulso (media, máxima y zonas), desnivel (HKMetadataKeyElevationAscended) y la ruta (HKWorkoutRoute). Desde ahí la ficha de stickers es la misma.
- El plugin `@capgo/capacitor-health` no traía la ruta ni el desnivel: se le agregó con `patches/@capgo+capacitor-health+8.11.12.patch` (método `queryWorkoutRoute`, el desnivel en metros y el permiso de la ruta junto con el de los entrenos).
- Ya conectado, al abrir la app o volver a ella se traen los entrenos nuevos de los últimos 7 días, como mucho cada 30 min (`src/features/profile/SincronizaReloj.jsx`). Nunca pide el permiso ahí.
- Nada de archivos FIT.

## Pruebas

- `node scripts/prueba-stickers.mjs`: la ficha, las ranuras y el catálogo (las pruebas de aceptación que son puras).
- Lo que se pinta se revisa a ojo en pantalla, en los cuatro colores, con nombres largos y con un maratón (42.20 km, 3:58:41).

## Sin verificar

- Cuánto tarda en el iPhone armar el video (aquí, con la vista de prueba en segundo plano, tardó 46 s; con el codificador del chip debería ser mucho menos).

- Que Safari de iPhone respete `font-variation-settings` (wdth 75 en Eco) al rasterizar. Si falla, el plan B es dibujar en canvas con las mismas reglas.
- Que copiar una imagen al portapapeles funcione dentro de la app del iPhone. Si falla, sale «No se pudo copiar. Mantén presionado el sticker para guardarlo.».
