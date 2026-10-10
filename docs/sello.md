# El sello para redes (T•LAB)

**Pedido de Andrés, 10 oct 2026** (competir con el «sello» de Strava: una imagen con los números del entreno para pegarla en una historia de Instagram o en CapCut). El diseño lo eligió él de varias maquetas (`docs/maquetas/2026-10-10-sello-t-lab.html` tiene la última); quedó como la propuesta **B «Ancha»**.

## Cómo es

- **Solo tipografía**, como Strava: sin bordes, placas, discos ni círculos. Números blancos con una sombra suave. Un solo color, el azul `#3578FF`, para la ruta y el punto de T•LAB.
- Letra **Archivo ancha** (`wdth 125`, pesos 600 y 800; ver `index.html`), centrada. Etiqueta chica arriba, número grande, unidad pegada. **Todo el texto en inglés.**
- **T•LAB**: la T, un punto azul y LAB, medidos y centrados juntos; el punto va a media altura de las mayúsculas.
- Cuatro piezas que el atleta **arrastra por separado**: la ruta (o el ícono), los datos y el logo.
- Dos versiones: **Sin fondo** (PNG transparente recortado a las piezas, para pegarlo encima de un video) y **Con foto** (la historia entera, 1080 × 1920, con una foto de la galería; la foto nunca se sube: queda en el teléfono).
- Tres botones: **Compartir** (la hoja del teléfono; solo si el navegador la ofrece), **Guardar imagen** y **Copiar**.

## Qué números lleva (`src/lib/sello/datos.js`)

| Entreno | Sello | Línea |
|---|---|---|
| Cardio puro con distancia (correr, caminar, senderismo, bici, natación, remo, elíptica) | **Distance, Pace (o Speed), Time** | la ruta si el reloj la guardó; si no, el ícono |
| Todo lo demás | **Time, Avg heart rate, Calories** | el ícono del tipo de sesión |
| Mixto: no es cardio puro pero hizo ≥ 1 km (Hyrox, un circuito con carrera) | **los dos**; el atleta escoge el que se ve mejor | cardio: ruta o ícono; general: ícono |

Decisiones que tomé yo sin preguntarle (decírselas si pregunta):

- El ritmo es **min/km** al correr, caminar y en senderismo; **km/h** («Speed») en bici y elíptica; **min/100 m** en natación y **min/500 m** en remo.
- **Pulso medio y calorías vienen del reloj.** Una sesión guiada sin reloj no los tiene: su sello lleva **Time, Sets y Total volume** (kilos × reps de todas las series). Con reloj pero sin pulso o calorías, lo guiado completa hasta tres filas. Él no contestó esta pregunta; si prefiere «sin reloj no hay sello» o «que los teclee», se cambia en `filasGenerales` y `sellosDeSesionGuiada`.
- Se quitó la línea del **pulso** (decisión suya): lo de fuera de cardio lleva solo el ícono. Las maquetas con 5 formas de pulso quedaron descartadas.
- El tercer dato ya no se escoge: es fijo.

## Dónde se abre

1. **Final del entreno guiado** (`PantallaDeFin`): «Crear sello». Abre `HojaDelSello`, que busca si el reloj ya trajo ese entreno (`uneConActividades`, el mismo emparejamiento de «Por serie») y, si no, arma el sello con lo guiado (`src/lib/sello/carga.js`).
2. **Mis métricas › detalle de un entreno** (`DetalleDeEntreno`, solo el propio atleta): botón «Sello» arriba a la derecha; abre el editor en el mismo lugar.
3. **El día en el plan** (`TrainingApp`, «Sesión terminada»): botón «Sello» junto a «Deshacer». No sale en solo lectura (un coach mirando el plan de su atleta) ni si el entreno guiado no midió nada (`tramoDeLaSesion`).

## Piezas

- `src/lib/sello/datos.js`: qué números lleva cada sello (puro, con pruebas).
- `src/lib/sello/ruta.js`: de `lat/lon` del reloj a puntos dentro de un cuadro, sin deformar (corrige por el coseno de la latitud).
- `src/lib/sello/dibuja.js`: el dibujo en un lienzo de 360 × 640 unidades (3× al exportar). Las mismas funciones pintan la vista previa y la imagen.
- `src/lib/sello/icono.js`: el ícono del tipo de sesión (el componente de la app, también los 252 del catálogo) como imagen blanca.
- `src/features/sello/EditorDelSello.jsx`: vista previa, arrastre, fondo, foto y botones. `HojaDelSello.jsx`: la hoja con su carga.
- `scripts/prueba-sello.mjs`: `node scripts/prueba-sello.mjs`.

## Trampas

- **La letra viene de Google Fonts** (como Inter). El lienzo no la pinta hasta que carga: `cargaFuentes()` la espera. Sin internet sale con Arial y no se rompe.
- El lienzo **no tiene `letterSpacing` en todos los navegadores**: el espaciado de LAB se hace letra por letra.
- **iOS exige que `navigator.share` se llame enseguida tras el toque**. Por eso la imagen se va preparando mientras el atleta acomoda (250 ms de espera) y «Compartir» usa la ya hecha.
- **Fotos del iPhone puede perder la transparencia de un PNG.** «Guardar imagen» en iPhone abre Archivos; para Instagram sirve «Compartir» o «Copiar».
- El ícono se saca del componente con `createRoot` + `flushSync` **fuera del efecto** (`await Promise.resolve()` primero); dentro de un efecto React avisa. `react-dom/server` hacía lo mismo pero sumaba ~190 kB.
- Los HEIC del iPhone entran por `aImagenWeb` (la misma conversión que las fotos de ejercicios).
- El lienzo de la vista previa lleva `touch-action: none`: en teléfono, una vista previa a pantalla casi completa no deja desplazar la hoja desde ella.

## Cómo se probó (10 oct 2026)

Página temporal en la raíz con los proveedores reales (ver la memoria «probar una hoja con página temporal»): el detalle de un entreno guiado sin reloj, el final del entreno y la hoja con un entreno de reloj insertado para el paciente de QA (un «Hyrox» de 12.6 km con ruta: salieron los dos sellos; se borró después). Con Playwright: arrastre, guardar sin fondo (PNG transparente) y con foto (1080 × 1920). **No probado**: iPhone real (arrastre con el dedo, hoja de compartir, Fotos), ni el botón del día en el plan con la cuenta de un atleta (el QA solo tiene el fisio).

## Pendiente

- Probar en un iPhone real, también con una foto HEIC.
- **Botón directo a Instagram** cuando exista la app descargable: pasa por registrar la app en Meta (gratis) y por la llave de «Sharing to Stories». Anotado como decidido; yo lo conecto y lo guío.
- Que el atleta elija el color de la línea (azul, rosa o naranja): después, si le apetece.
- Que el coach cree el sello de su atleta: después.
- Recordar el acomodo de las piezas entre aperturas: hoy se pierde al cerrar.
