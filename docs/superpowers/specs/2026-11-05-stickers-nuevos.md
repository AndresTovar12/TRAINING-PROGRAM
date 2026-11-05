# Stickers: el orden nuevo, 36 stickers nuevos, variantes, frases, Totales y «Con foto»

**Maqueta aprobada:** artifact Ae6gZVupudXto8n1sKdj1j (versión 4). Es la fuente: cada sticker nuevo está dibujado ahí en HTML y CSS, con sus medidas, y la hoja funciona como debe funcionar en la app. Léela antes de empezar.
**Dos commits sobre main, en este orden.** La parte 2 depende de la 1.
**Lo que ya existe no se toca:** los 35 stickers de hoy, el motor de ranuras (`lib/stickers/catalogo.js`), la exportación a 3× (`exporta.js`), tocar para copiar y mantener para guardar, los 4 colores, la pestaña Video.

## Parte 1: los 19 stickers nuevos de arriba. Sonnet 5.5, esfuerzo alto.

### 1.1 El orden de la hoja
- La galería de «Stickers» sigue siendo **una sola lista, sin rótulos**. Solo cambia el orden: primero los 8 **discretos**, luego los 6 **runner**, luego las 5 **tarjetas**, luego los 35 de hoy en su orden de siempre.
- Cada sticker nuevo lleva la marca **«Nuevo»** (pastilla azul arriba a la derecha del mosaico) durante 30 días desde el build en que salió. Guarda la fecha en el catálogo, no en la base.

### 1.2 Los 8 discretos (`familia: 'discreto'`)
Chicos, centrados, la letra de la app (Bricolage, números en 800, etiquetas en 700 a 12.5 px). **Las unidades van del mismo color que el número**, no en acento. Ranuras con el motor de siempre (`PREF`):
1. **Un dato** (ancho): una etiqueta y un número a 46 px. Tres variantes: el primer, el segundo y el tercer dato de `PREF`.
2. **Dos datos** (ancho): dos pares en fila, 34 px.
3. **Dos datos y la línea** (ancho, obliga ruta): dos pares y la ruta chica (64 × 40, trazo 2.2, color de tinta) a la derecha.
4. **Tres en fila** (ancho): tres pares, 24 px.
5. **Cuatro** (ancho): 2 × 2, 26 px.
6. **Seis** (ancho): 3 × 2, 19 px con etiquetas de 11 px.
7. **La línea** (alto, obliga ruta): solo la ruta, 230 × 270, trazo 2.5, sin números.
8. **La línea y un dato** (alto, obliga ruta): la ruta 150 × 170 y el primer dato debajo, 28 px.

### 1.3 Los 6 runner (`familia: 'runner'`)
Todo centrado, etiqueta arriba y número abajo, y la marca **«Training Lab»** (`Lab` en acento) como firma. La ruta gruesa (6 a 7 px, puntas redondas) en el color de acento.
1. **Columna** (alto): tres pares a 36 px y la marca abajo.
2. **Columna con ruta** (300 × 420, obliga ruta): tres pares a 30 px, la ruta 130 × 110 y la marca.
3. **Ruta grande** (300 × 420, obliga ruta): la ruta 220 × 240 arriba; abajo la marca, tres datos chicos en fila (19 px) y el ícono de la actividad.
4. **Columna larga** (300 × 420): la marca arriba y cinco pares a 22 px.
5. **Marco** (300 × 420, obliga ruta): la marca arriba a la izquierda, la ruta 170 × 240 al centro, y los datos **escritos de lado** por los bordes derecho e izquierdo (girados 90°, 11 px, dos por lado).
6. **Boleto** (300 × 420): un recuadro de 192 px con borde de 2 px, la marca, la ruta (o el ícono de la actividad si no hay ruta), el día en grande (30 px) y la fecha; el borde de abajo en zigzag.

### 1.4 Las 5 tarjetas (`familia: 'tarjeta'`)
Son la tarjeta de Andrés y su hermana. **No son transparentes:** una tarjeta de esquinas de 30 px con fondo, borde con brillo y curvas de nivel de mapa topográfico de fondo (trazos finos al 24 %). La ruta es un **neón**: halo de 12 px al 55 % con desenfoque de 5, línea de 6 px y un núcleo de 1.6 px más claro. Sin punto al final de la ruta. Etiquetas arriba (13.5 px, 600) y números blancos (800); unidades del mismo color. La marca **«Training Lab»** abajo.
**Cambian con los 4 colores**, con estos temas exactos (fondo, borde, brillo, texto, etiqueta, acento, ruta, halo, núcleo, topo, línea, apagado):
- **Blanco** (la original): fondo `radial-gradient(120% 80% at 50% 0%, #0A2142, #04122A 45%, #020A18)`, borde `#1E9BFF`, brillo `rgba(30,155,255,.55)`, texto `#FFFFFF`, etiqueta `#E9F0FF`, acento `#3578FF`, ruta `#22C8FF`, halo `#1FC2FF`, núcleo `#B9EEFF`, topo `#3E7BD6`, línea `#1E7BFF`, apagado `#1d3558`.
- **Negro** (tarjeta clara): fondo `radial-gradient(120% 80% at 50% 0%, #FFFFFF, #F2F4F8 55%, #E6EAF1)`, borde `#0B0D12`, brillo `rgba(0,0,0,.16)`, texto `#0B0D12`, etiqueta `#3B404D`, acento `#2F55F0`, ruta `#2F55F0`, halo `rgba(47,85,240,.45)`, núcleo `#C9D5FF`, topo `#7D889E`, línea `#0B0D12`, apagado `#D3D8E2`.
- **Azul:** fondo `radial-gradient(120% 80% at 50% 0%, #4A74FF, #2448E6 50%, #1633B9)`, borde `#FFFFFF`, brillo `rgba(255,255,255,.45)`, texto `#FFFFFF`, etiqueta `#E3EAFF`, acento `#A9C4FF`, ruta `#FFFFFF`, halo `#BFD0FF`, núcleo `#FFFFFF`, topo `#DCE6FF`, línea `#FFFFFF`, apagado `rgba(255,255,255,.28)`.
- **Coral:** fondo `radial-gradient(120% 80% at 50% 0%, #3B1610, #200A07 50%, #120504)`, borde `#FF6B4A`, brillo `rgba(255,107,74,.55)`, texto `#FFFFFF`, etiqueta `#FFE4DC`, acento `#FF6B4A`, ruta `#FF7A57`, halo `#FF6B4A`, núcleo `#FFD3C6`, topo `#D9573C`, línea `#FF6B4A`, apagado `#4A1C14`.
Las cinco:
1. **Tarjeta con ruta** (300 × 530, obliga ruta): la ruta 220 × 150, tres pares a 46 px separados por una línea de luz (120 × 2 px, degradado), la marca.
2. **Tarjeta con ruta, datos en fila** (300 × 380, obliga ruta): la ruta 230 × 170 y tres pares chicos en fila (24 px).
3. **Tarjeta sin ruta** (300 × 530): el ícono de la actividad a 86 px con brillo, el tipo de sesión en mayúsculas espaciadas, tres pares a 44 px, la marca.
4. **Tarjeta chica** (300 × 200): dos pares a 40 px y la marca.
5. **Tarjeta de récord** (300 × 380, obliga `f.record`): pastilla «RÉCORD» con borde y brillo, el nombre del récord, el valor a 72 px con brillo, la fecha, la marca.
En «Con foto» no entran (no son transparentes).

### 1.5 Pruebas de la parte 1
- `npm run pruebas` con el catálogo: los 19 nuevos aparecen en ese orden antes de los 35; los que obligan ruta no salen sin ruta; ningún sticker sale con «N/A»; una ranura vacía desaparece.
- Exportar cada uno a 3× en los 4 colores: el PNG de la tarjeta trae el fondo; los demás, transparente.
- En el iPhone: la hoja carga en menos de 1 s con los 54 stickers. Si tarda más, dibuja los mosaicos conforme se desplazan.

Commit: «Stickers: 8 discretos, 6 runner y 5 tarjetas al frente de la hoja».

## Parte 2: personalidad, variantes, frases, Totales, Polaroid y «Con foto». Opus 5.5, esfuerzo alto.

### 2.1 Dos letras nuevas, guardadas en la app
- **Instrument Serif** (regular e itálica) y **Space Mono** (400 y 700), las dos de licencia libre (OFL). Van en `public/fonts` con `@font-face` en `index.css`, como Bricolage, para que funcionen sin internet y entren en el PNG exportado.
- Espera a que carguen (`document.fonts.load`) antes de rasterizar, como ya se hace con Bricolage.

### 2.2 Variantes dentro del mosaico
- Un sticker puede tener **varias caras** (`caras: [...]` en el catálogo). El mosaico las muestra como un carrusel horizontal con `scroll-snap`, y **puntitos** abajo (6 px, el activo en blanco; en color negro, en negro).
- Deslizar de lado dentro del mosaico cambia de cara. Tocar un puntito también. Mover el dedo más de 10 px no copia (ya existe para desplazar la lista: ahora también para el carrusel).
- Tocar copia **la cara que se ve**; mantener guarda esa misma. Al cerrar la hoja no se recuerda la cara.
- **Al abrir la hoja la primera vez en el día**, el primer mosaico con variantes se asoma: se desplaza un 35 % y regresa en 0.5 s. Una vez, no cada apertura.

### 2.3 Los 12 con personalidad (`familia: 'personalidad'`, van después de las tarjetas y antes de los 35)
1. **Itálica** (300 × 260). Cara 1: el nombre de la sesión en Instrument Serif itálica a 38 px y tres pares debajo en serif (etiqueta 13 px, valor itálica 24 px). Cara 2: la fecha y la hora en serif 15 px, el primer dato itálica a 64 px, el nombre de la sesión 20 px.
2. **Máquina de escribir** (300 × 260): Space Mono 14 px, interlineado 1.75, alineado a la izquierda, `CLAVE: valor` con el valor alineado a la derecha a 9 caracteres. Filas: DATE, ACTV y las primeras cuatro claves de `PREF` en inglés corto (DIST, PACE, TIME, ELEV, SETS, VOL, KCAL, BPM).
3. **Reloj digital** (300 × 200): Space Mono 700 con `text-shadow` del color de tinta (brillo). Cara 1: dos datos a 42 px con sus claves debajo en 11 px espaciadas. Cara 2: un dato a 56 px.
4. **Frase grande** (300 × 220, **personalizable**): la frase en serif itálica a 40 px (máximo 260 px de ancho, hasta 3 renglones) y debajo los dos primeros datos en una línea de 12.5 px.
5. **Burbuja** (300 × 180, **personalizable**, no cambia con los colores): un mensaje con **piquito**. Cara 1: fondo `#2F7BFF`, texto blanco, piquito abajo a la derecha. Cara 2: fondo `#E9E9EB`, texto `#111`, piquito abajo a la izquierda. Letra del sistema 19 px 600, relleno 10 × 16, radio 21 px, la esquina del piquito 16 px. El piquito es un SVG de 31 × 34 detrás de la burbuja: `M0 0 H12 C12 17 19 27 31 32 C18 34.5 7 33 0 29 Z` (espejado para la izquierda). Debajo, en gris `#B9C0CF` 12 px: «Corrió 5.08 km» o «Entrenó 18 series» (verbo según el deporte).
6. **Código de barras** (300 × 200): Space Mono; arriba la fecha y el primer dato; barras de 230 × 70 (ancho de barra 2, 3 o 5 px, generadas con una semilla fija, siempre iguales); abajo el tipo corto, el segundo y el tercer dato.
7. **Polaroid** (300 × 330, **con tu foto**, no cambia con los colores): un marco `#FBFAF6` de 206 px girado −3°, con sombra; adentro la foto 182 × 182 recortada al centro; debajo la fecha en serif itálica 22 px y los dos primeros datos en Space Mono 10 px. **Sin foto**, el hueco es `#E4E2DC` con un ícono de cámara y «Toca para poner una foto». Ver 2.6.
8. **Un momento** (300 × 200): serif. Cara 1: «Empezó a las» y la hora a 78 px. Cara 2: «Fecha» y «20 de octubre» en itálica a 52 px.
9. **Día gigante** (300 × 220): Bricolage. Cara 1: el día de la semana en mayúsculas, 78 px, `wdth` 75; debajo el primer dato a 24 px. Cara 2: el día a 30 px en acento, la ruta en línea delgada (200 × 40) si hay, y el primer dato a 44 px.
10. **Resaltador** (300 × 180, no cambia con los colores): una frase en serif 24 px sobre texto `#151515` con fondo amarillo `#FFE14D` como marcador (`box-decoration-break: clone`): «5.08 kilómetros en 26:33» o «18 series en 52 min».
11. **Corazón** (300 × 160, no cambia con los colores): una píldora. Cara 1: fondo `#FF2D55`, texto blanco, «♥ 5.08 km». Cara 2: fondo blanco, texto `#FF2D55`.
12. **Sello redondo** (300 × 300): SVG de 240 px: dos círculos (trazo 2.5 y 1.5), un texto en arco con `textPath` y `textLength` para que cierre exacto («TRAINING LAB · CARRERA · 20.10.26 · MARTES ·»), y al centro el primer dato a 46 px con su unidad debajo.

### 2.4 Frases («Personalizar»)
- Los stickers personalizables llevan el botón **«✎ Personalizar»** arriba a la izquierda del mosaico. Abre una hoja «Elige una frase» sobre la hoja de stickers, con dos pestañas de idioma, **English primero y Español segundo**, un campo «Escribe la tuya» (máximo 40 letras) con botón «Usar», y las frases como burbujas azules en dos columnas. «Listo» cierra.
- **Las listas:**
  - English: pov: locked in · one more mile · built different · rain or shine · earned it · quiet miles · therapy session · no days off · slow but steady · main character run.
  - Español: mente fuerte, piernas cansadas · otro día, otro kilómetro · hoy sí fui · terapia de los martes · lo hice por mí · sin excusas · mis piernas opinan distinto · modo bestia · poco a poco · ni la lluvia me paró.
- La frase elegida **se aplica a todos los stickers personalizables** a la vez. Al cerrar la hoja de frases, la galería regresa al sticker desde el que se abrió y lo marca 1.6 s con un borde blanco.
- La frase se recuerda en el teléfono (`localStorage`) para la próxima vez. La frase que sale de entrada es «pov: locked in».

### 2.5 La pestaña «Totales»
- Debajo de las pestañas Stickers · Con foto · Video, en «Stickers», dos pestañas de texto subrayadas: **Actividad** y **Totales**. Actividad es la lista de siempre. Totales son stickers de **la semana y el mes**, de todos los entrenos de la persona, del plan y libres. Usa lo que ya calculan los stickers «Semana» y «Mes» de hoy y `lib/semanaLibre.js`; si hace falta otra consulta, una sola al abrir la pestaña.
- Los 6 de Totales, en este orden:
  1. **Esta semana** (ancho): cara 1 los km de la semana a 52 px; cara 2 entrenos y tiempo.
  2. **Semana en barras** (300 × 260): el total y siete barras (una por día, 16 px de ancho, redondeadas, la vacía al 30 %) con L M M J V S D.
  3. **Mes en puntos** (300 × 300): el nombre del mes y «19 entrenos»; una cuadrícula de 7 columnas con un punto por día, lleno si hubo entreno y hueco al 45 % si no.
  4. **Mes gigante** (300 × 240): el mes a 30 px y los km a 92 px `wdth` 75; cara 2, el número de entrenos.
  5. **Semana a máquina** (300 × 280): Space Mono, siete filas «LUN … 5.1 KM» y la fila TOTAL con línea arriba.
  6. **Tarjeta de la semana** (300 × 420, familia tarjeta, con los 4 temas): «ESTA SEMANA», el total a 58 px, las siete barras con brillo, entrenos y tiempo, la marca.
- Sin ningún entreno en la semana, los de semana no salen; sin ninguno en el mes, no sale nada y la pestaña dice «Entrena esta semana y aquí aparecen tus totales».

### 2.6 El Polaroid y «Con foto» con tu foto
- **El Polaroid** sale vacío. Tocarlo sin foto abre el carrete (el mismo `<input type="file" accept="image/*">` y `aImagenWeb` que usa «Con foto»); con foto, tocarlo copia y mantenerlo guarda. El botón **«＋ Poner foto»** arriba a la izquierda del mosaico abre el carrete, y dice «Cambiar foto» cuando ya hay una. La foto vive en memoria (`blob:`), nunca se sube, y se suelta al cerrar la hoja. La misma foto sirve para «Con foto».
- **«Con foto» hoy no funciona en el iPhone** (Andrés, 5 nov 2026): está la pestaña, pero no sirve. Reprodúcelo en el iPhone con una foto del carrete y arréglalo. Lo que está escrito: `eligeDelCarrete` → `aImagenWeb` → `URL.createObjectURL` → `<img>` dentro de `.stk-foto` → `pngDeSticker({ forma: 'historia', foto })` con `modern-screenshot`. Tres sospechosos, en este orden:
  1. `modern-screenshot` no logra leer el `blob:` desde el nodo que se monta fuera de pantalla en la app (`capacitor://`): el PNG sale sin la foto o la promesa falla. Si es eso, pásale la foto como `data:` o dibújala en un canvas antes de rasterizar.
  2. `aImagenWeb` con una HEIC grande del iPhone tarda o falla en silencio.
  3. Copiar al portapapeles un PNG de 900 × 1599 con foto falla y el aviso no lo dice.
  Dime cuál era. Que funcione también con las tres fotos de ejemplo.
- «Con foto» sigue mostrando solo los de identidad, como hoy. No agregues los nuevos ahí.

### 2.7 Pruebas de la parte 2
- `npm run pruebas`: las caras de cada sticker; las ranuras de los 12 y de los 6 de Totales; sin ruta no salen los que la obligan; una frase de 40 letras cabe en Frase grande y en Burbuja sin cortarse.
- Exportar a 3× cada cara de cada sticker nuevo en los 4 colores, y los de Totales. Las dos letras nuevas aparecen en el PNG (ábrelo: no debe caer a la letra del sistema).
- En el iPhone: deslizar un mosaico cambia de cara y no copia; tocar un puntito cambia de cara; «Personalizar» → elegir una frase → la galería regresa al sticker marcado; «Poner foto» en el Polaroid abre el carrete y el PNG copiado trae la foto; «Con foto» con una foto del carrete se copia y se guarda con la foto; Totales con una semana real.
- En Android (web instalada): lo mismo, salvo copiar al portapapeles donde no se pueda (ahí el aviso ya ofrece «Guardar»).

Commit: «Stickers: 12 con personalidad, variantes, frases, Totales, Polaroid y «Con foto» arreglado».

## Al terminar
- Actualiza `docs/stickers.md`: el orden nuevo, las familias, las caras, las frases, Totales, las dos letras y qué tenía «Con foto».
- Dime los dos hashes, el número de build de TestFlight, qué tenía «Con foto» y lo que no pudiste probar.
