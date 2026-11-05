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
5. **La hoja** (`src/features/stickers/HojaDeStickers.jsx`). Mosaicos cuadrados, dibujados conforme se desplazan. Pestañas Stickers · Con foto · Video. Tocar = copiar. Mantener 0.6 s = guardar. Mover el dedo = desplazar. En Video, tocar o mantener guarda el video. Se cierra con «Cerrar» o arrastrando la cabecera hacia abajo.
   - **Con foto:** solo los de identidad (Titular, Titular · récord, Firma, Eco, Grande) sobre una foto 9:16: tres de ejemplo (dibujadas) o una del carrete. La del carrete se queda en memoria (un enlace `blob:` local): nunca se sube. La misma foto sirve para el Polaroid (ver «La parte 2»).

## Los 19 de arriba (5 nov 2026, parte 1 de la especificación `docs/superpowers/specs/2026-11-05-stickers-nuevos.md`)

Maqueta aprobada: https://claude.ai/artifact/Ae6gZVupudXto8n1sKdj1j (versión 4). Manda sobre este texto en medidas y colores.

- **El orden de la hoja:** una sola lista, sin rótulos: 8 discretos, 6 runner, 5 tarjetas y luego los 35 de siempre. En el catálogo (`STICKERS`) los 19 van primero.
- **Dónde viven:** los datos y las ranuras en `lib/stickers/catalogo.js` (ids `d-…` discretos, `r-…` runner, `t-…` tarjetas; `familia: 'discreto' | 'runner' | 'tarjeta'`); el dibujo en `features/stickers/Nuevos.jsx` (centrados, etiqueta arriba y número abajo, unidades del color del número, firma «Training Lab»); el CSS al final de `stickers.css` (clases `n-…`).
- **Su tamaño:** cada uno trae su `lienzo` si no es el de su forma: discretos 300 × 200 (los de línea, 330), runner 330 o 420, tarjetas 530, 380, 530, 200 y 380. `lienzoDe(item, forma)` lo da; `exporta.js` lo usa para rasterizar a 3×.
- **Ranuras:** con `PREF` como los demás. Un sticker sale con todas sus ranuras llenas (Seis acepta una menos; Columna larga y Marco, algunas menos); los de línea o ruta (`obliga`) no salen sin ruta; la tarjeta de récord solo con `f.record`; el Boleto necesita al menos un dato. «Un dato» tiene tres caras (`caras`): el primer, el segundo y el tercer dato de `PREF`. La parte 1 dibuja la primera; el carrusel para ver las otras es de la parte 2 (`Sticker` ya acepta `cara`).
- **«Nuevo»:** cada uno trae `desde: '2026-11-05'`; `esNuevo(item)` es verdadero 30 días (`NUEVO_DIAS`). La pastilla azul va arriba a la derecha del mosaico. La fecha vive en el catálogo, no en la base.
- **Las tarjetas:** NO son transparentes (fondo, borde con brillo, curvas de nivel). Cambian con los cuatro colores: `TEMAS_TARJETA` (fondo, borde, brillo, texto, etiqueta, acento, ruta, halo, núcleo, topo, línea, apagado); `Sticker.jsx` los pone como variables `--tj-*`. La ruta es un neón (halo de 12 px al 55 % con desenfoque de 5, línea de 6 px, núcleo de 1.6 px) y sin punto al final. No entran en «Con foto» (no son `identidad`).
- **Trampa de WebKit:** `box-shadow` sale corrido y como un bloque duro al rasterizar con `modern-screenshot`. El brillo de la tarjeta y de la pastilla «RÉCORD» va con `filter: drop-shadow`, y el brillo de adentro con un borde desenfocado (`.n-tj::before`). No usar `box-shadow` con desenfoque dentro de un sticker. Tampoco `filterUnits` por defecto en el neón: la ruta recta (sin alto) desaparecería; va en unidades de usuario.
- **Que quepa:** los valores marcados `data-n-max` bajan de tamaño hasta caber (`ajustaSticker`), cada uno solo o, en una fila o rejilla, todos juntos (un maratón: «42.20 km  3:58:41»).
- **La hoja:** los mosaicos de «Stickers» son cuadrados (como la maqueta). Se DIBUJAN conforme se desplazan (`IntersectionObserver` a 250 px de la vista; ya dibujados se quedan): con los 52 stickers de un entreno completo, dibujarlos todos al abrir bloqueaba WebKit ~2 s.
- **Textos:** las etiquetas y los datos vienen de la ficha (en inglés, como siempre). El día y la fecha del Boleto y la tarjeta de récord, en español como la maqueta (`f.dia`: «martes»; `f.fechaCorta`: «20 oct»). La pastilla dice «RÉCORD».

## La parte 2 (5 nov 2026): personalidad, variantes, frases, Totales, Polaroid y «Con foto»

Misma maqueta (versión 4). Lo que se agregó:

- **El orden de la hoja (Actividad):** una sola lista, sin rótulos: 8 discretos, 6 runner, 5 tarjetas, **12 con personalidad** y luego los 35 de siempre.
- **Las familias nuevas** (`familia` en el catálogo): `personalidad` (ids `p-…`) y, en su propio catálogo, los de Totales (`TOTALES`, ids `s-…`, `familia: 'totales'`; la tarjeta de la semana es `tarjeta`). Se dibujan en `Nuevos.jsx` (`Personalidad` y `Totales`), con CSS al final de `stickers.css`.
- **Los 12 con personalidad:** Itálica, Máquina de escribir, Reloj digital, Frase grande, Burbuja, Código de barras, Polaroid, Un momento, Día gigante, Resaltador, Corazón y Sello redondo. Ranuras con `PREF`, como todos. Marcas en el catálogo: `perso` (lleva la frase: Frase grande y Burbuja), `fija` (no cambia con los cuatro colores: Burbuja, Polaroid, Resaltador y Corazón) y `conFoto` (el Polaroid). Textos en español donde la maqueta los pone en español (la Burbuja dice «Corrió 5.08 km» o «Entrenó 18 series», `pieDeBurbuja`; el Resaltador «5.08 kilómetros en 26:33», `fraseResaltador`); la ficha trae `fechaNum` («20.10.26»), `hora24` («7:12») y `fechaLarga` («20 de octubre»).
- **Las caras (variantes):** `caras` en el catálogo (un número o `(f, r) => n`; en «Un dato», una por dato). Tienen dos Itálica, Reloj digital (si hay tres datos), Burbuja, Un momento, Día gigante y Corazón; «Un dato», tres; en Totales, «Esta semana» y «Mes gigante» (si hubo kilómetros). El mosaico es un carrusel horizontal con `scroll-snap` y puntitos (6 px; el activo blanco, o negro con la tinta negra). Deslizar o tocar un puntito cambia de cara; mover el dedo más de 10 px no copia; tocar copia la cara que se ve y mantener la guarda (`pngDeSticker({ cara })`). No se recuerda al cerrar. Con el mouse, el carrusel se arrastra.
- **El asomo:** la primera vez del día que se abre la hoja, el primer mosaico con caras se asoma (35 % y regresa, con una animación; 1 s). Se anota en el teléfono (`localStorage`, `tl.stickers.asomo`). Con «reducir movimiento», no.
- **Frases («✎ Personalizar»):** botón arriba a la izquierda de los personalizables. Abre `HojaDeFrases.jsx`: English primero y Español, «Escribe la tuya» (40 letras, `FRASE_MAX`) con «Usar», y las frases (`FRASES`) como burbujas azules en dos columnas. La elegida va a todos los personalizables a la vez y se recuerda en el teléfono (`tl.stickers.frase`); la de entrada es «pov: locked in». Al cerrar, la galería regresa al sticker desde el que se abrió y lo marca 1.6 s con un borde blanco. Una frase larga nunca se corta: `tamDeFrase` baja la letra para que quepa en 3 renglones y, al dibujarse, `data-n-alto` la baja más si hiciera falta.
- **Totales:** dos pestañas de texto debajo de los colores, en «Stickers»: Actividad y Totales. Totales son 6 (Esta semana, Semana en barras, Mes en puntos, Mes gigante, Semana a máquina y Tarjeta de la semana) con la semana (lunes a domingo) y el mes de HOY, de todos los entrenos (`lib/stickers/totales.js`, `totalesDe`). Salen del historial del año que ya trae el entreno (`cargaHistorial`): no hay otra consulta. El entreno que se comparte cuenta siempre. Sin kilómetros, las barras y la máquina cuentan minutos. Sin entrenos en la semana no salen los de semana; sin ninguno en el mes (ni en la semana) no sale nada y la pestaña dice «Entrena esta semana y aquí aparecen tus totales».
- **El Polaroid:** sale vacío (el hueco gris con la cámara). Sin foto, tocarlo o mantenerlo abre el carrete; con foto, copia y guarda. «＋ Poner foto» arriba a la izquierda (dice «Cambiar foto» cuando ya hay una). La foto es la misma de «Con foto» (si eliges una en una, sirve en la otra), vive en memoria y se suelta al cerrar la hoja.
- **Las dos letras nuevas:** Instrument Serif (regular e itálica) y Space Mono (400 y 700), de Google Fonts, licencia OFL (el texto de la licencia va junto a ellas en `public/fonts`). Declaradas en `index.css` como Bricolage (latin y latin-ext). `Sticker.jsx` espera a las cinco (`document.fonts.load`) antes de medir y de rasterizar.

### Qué tenía «Con foto» (5 nov 2026)

Andrés: «está la pestaña, pero no sirve». Medido en el WebKit de Playwright con perfil iPhone (agente de WKWebView) con HEIC de 12 y 48 MP y JPG de 12 MP, antes de arreglar:

- **Era el sospechoso 1:** el PNG salía **sin la foto**, y el aviso decía «Copiado». `modern-screenshot` mete la foto dentro de un SVG y lo dibuja en un lienzo; WebKit no alcanza a decodificar una foto grande ahí adentro antes de dibujarlo. Con una foto de 12 MP faltó todas las veces; con una lisa, a veces salía a la segunda. Pasarla como `data:` no bastaba con una foto pesada; achicada a 1600 px sí salía. En la web había además otra causa: la CSP (`connect-src` sin `blob:`) ni deja leer el `blob:`.
- **No era el 2:** `aImagenWeb` con una HEIC de 12 MP tardaba 1-2.7 s y con una de 48 MP unos 4 s, sin fallar.
- **No era el 3:** copiar el PNG de 900 × 1599 respondió bien (1-2.5 s) en WebKit. En el iPhone real no se pudo medir.
- **El arreglo:** la foto ya no pasa por `modern-screenshot`. Cada `<img data-foto>` se esconde al rasterizar y se dibuja aparte en un lienzo, en su lugar exacto (`exporta.js`): «abajo» (el fondo de «Con foto», con el velo encima) o «arriba» (el Polaroid, girado −3°). Y la foto se prepara al elegirla (`preparaFoto`): la lee el propio teléfono (la HEIC también), la achica a 4 MP y avisa «Preparando tu foto…», con tope de 30 s. Después: la foto sale en el PNG copiado y en el guardado, con HEIC y JPG, en la app y con la CSP de la web.

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
4. **Hecha (28 oct 2026):** la ubicación silenciosa y Garmin (ver abajo y `docs/garmin.md`).
5. **Hecha (29 oct 2026):** la experiencia del Apple Watch (ver abajo).

## El Apple Watch (HealthKit, fase 3)

- (Fase 5: ahora es la pantalla «Conecta tu Apple Watch», ver abajo.) Solo al tocar «Conectar» se pide el permiso de HealthKit. Si dice «Ahora no», no se le pide nada al iPhone.
- Cada HKWorkout entra como una fila de `actividades` con `origen = 'healthkit'` (`src/lib/metricas/leeHealthKit.js` → `preparaEntreno` → `construyeActividad`): tipo, inicio, fin, duración, distancia y energía activa (las del entreno, o la suma de sus muestras), pulso (media, máxima y zonas), desnivel (HKMetadataKeyElevationAscended) y la ruta (HKWorkoutRoute). Desde ahí la ficha de stickers es la misma.
- El plugin `@capgo/capacitor-health` no traía la ruta ni el desnivel: se le agregó con `patches/@capgo+capacitor-health+8.11.12.patch` (método `queryWorkoutRoute`, el desnivel en metros y el permiso de la ruta junto con el de los entrenos).
- Ya conectado, al abrir la app o volver a ella se traen los entrenos nuevos de los últimos 7 días (nunca antes de conectar), como mucho cada 30 min (`src/features/profile/SincronizaReloj.jsx`). Nunca pide el permiso ahí.
- Nada de archivos FIT.

## La experiencia del Apple Watch (fase 5, 29 oct 2026)

Prototipo aprobado: https://claude.ai/artifact/1kttQGTS8apYoeDH2JVcoo (manda sobre el texto). Lo de la fase 3 de arriba cambió así:

- **Un solo «Conectar Apple Watch»** (`src/features/reloj/ConectaReloj.jsx`): pide de una vez leer y ESCRIBIR entrenos, pulso y energía activa (el parche del plugin ahora acepta `workouts` para escribir y lo reporta en `writeAuthorized`/`writeDenied`). El reloj ya no pregunta. «Ahora no» no le pide nada al iPhone.
- **Cómo se sabe si dijo que no** (`revisaPermiso`): si negó escribir entrenos, o si no se puede leer ni un paso de 60 días → «No pudimos leer nada». «Ya lo encendí» repite solo esas dos revisiones.
- **La conexión vive en la cuenta**: `dispositivos_conectados` (`apple_salud`, estado `ok`), con `conectado_en` puesto por el servidor (`conecta_apple_salud`, que no cambia la fecha al volver a conectar). El permiso es del teléfono: marca local `salud:permiso-aqui`. Con la fila y sin la marca: «Vuelve a conectar tu Apple Watch». Estado compartido: `src/lib/relojConectado.js`.
- **Todo cuenta desde que conecta**: `leeSalud({ desde })` nunca lee antes de `conectado_en`. Al terminar un entreno con el reloj, `SincronizaReloj` lee las últimas 3 h a los 8, 20 y 60 s; si el entreno ya estaba (uno de la app), se le pone el pulso del reloj (`metricas.pulso_de = 'apple_watch'`) en vez de repetirlo.
- **Lo de antes, solo para las cuentas**: hasta 12 meses de resúmenes en `actividades_previas` y `recuperacion_previa` (`leeLoDeAntes` → `guardaPrevias`, una vez por cuenta: `detalle.previas`). Entran a la condición/fatiga/forma (la gráfica pinta solo desde que conectó) y a «lo normal» de la recuperación (la base de 30 días). Ninguna lista, récord ni pantalla los enseña. El conector de IA hace lo mismo.
- **Dónde se entera**: paso `reloj` del inicio de cuenta (con reloj: conectar; sin reloj o en la web: «Training Lab funciona con tu Apple Watch»), tarjeta de Home la primera semana (y «Vemos que ya tienes Apple Watch» una vez), la página del entreno, Mis métricas, Dispositivos (botón «Conectar», página del reloj; en la web «En la app del iPhone») y el coach («Pedirle que conecte su reloj»: mensaje tipo `reloj`, una vez al día, `pide_conectar_reloj`).
- **Solo administradores**: «Probar como si tuviera Apple Watch» (el dueño y sus cuentas de prueba, `soy_cuenta_de_prueba`). Vale para esa cuenta y solo en la app del iPhone.
- SQL: `docs/sql/2026-10-29-reloj-fase-5.sql`. Prueba pura: `node scripts/prueba-reloj.mjs`.

## Los caminos del plan (fase 6, 29 oct 2026)

Del prototipo de caminos: https://claude.ai/artifact/BFogHsa2GUJGS1Fr332YgD. Nada nuevo se guarda: un workout del plan sigue viviendo en `wr:sessions` (o `wr:sessions@<clave>`).

- **Un solo historial**: «Tus entrenos» (Home 4, Entrenar 6) mezcla `actividades` con las sesiones guiadas terminadas (`completedAt`), lo más nuevo primero (`src/lib/entrenosDelPlan.js`, `useEntrenosRecientes().entrenos`). Una sesión que el reloj también trajo (`uneConActividades`) sale una vez: la actividad, con el nombre y el tipo de la sesión. Cada fila del plan: ícono del tipo (`tipoParaStickers`), nombre, «cuándo · N series · tiempo» y la pastilla gris «Plan».
- **La página del workout** (`src/features/training/ResumenDeSesion.jsx`): como la del libre. Números (tiempo, «12/16» series, ejercicios, volumen), récord del plan, la nota del atleta, pulso y ruta si hubo reloj, «Compartir» abajo (`HojaDeSesion`). «···» solo «Ver en mi plan». Se abre con `abreSesionHecha` (fila, ⇪, «Ver todos» y «Terminar» del entreno guiado); la escucha `PaginaDeSesionGlobal`, montada en `TrainingApp`, dentro del programa de la sesión.
- **«Ver todos»** (`src/features/libre/HistorialCompleto.jsx`): todo, por mes, páginas de 50 al llegar abajo. Las sesiones más viejas que la última actividad leída esperan a su página.
- **Mis métricas, «Últimos entrenos»**: también los workouts del plan, con «Plan» (el ícono del tipo solo en la app del atleta; el coach ve el del deporte).
- Prueba pura: `node scripts/prueba-entrenos-del-plan.mjs`.

## La página del entreno y los caminos (fase 7, 29 oct 2026)

Prototipo: https://claude.ai/artifact/EFSp16EiF1rVYb5U7emtNE (los seis caminos del panel). Manda sobre la página, la celebración y las listas; el de stickers sigue mandando en la hoja.

- **La regla de los números** (`lib/paginaDelEntreno.js`, probada en `scripts/prueba-pagina-del-entreno.mjs`): un número protagonista con su unidad chica («5.00 km», «16 de 16», «1 h 10 min», «1,500 m»), una frase que dice qué significa (su primera vez, la más larga del mes, la que va en la semana y si fue la más rápida, o una neutra con el dato), dos o tres secundarios (carrera Tiempo y Ritmo; bici Tiempo, Velocidad y Subida; plan Tiempo y Volumen; Pulso medio en rojo si cabe), y el tiempo sin ceros de más («0:07»).
- **Una sola página** (`features/libre/PaginaDelEntreno.jsx`) para `ResumenLibre` y `ResumenDeSesion`: mapa de 250 px o franja de 200 px del color del tipo, la tarjeta montada encima, el récord en su fila (contra qué se compara), la tarjeta de stickers en abanico, lo del Apple Watch, y las secciones «Por kilómetro», «Tu pulso» (fácil, medio y duro), «Lo que hiciste» y «Tu nota» (se guarda en `notes` de la sesión). Barra con el nombre al bajar; «Compartir» con la flecha hacia arriba.
- **Un entreno viejo** también dice si fue récord: libre, contra sus entrenos de antes del mismo deporte (`entrenosAnteriores`); del plan, contra lo que levantó ANTES de esa sesión.
- **Al terminar un workout del plan**: la misma celebración azul que la carrera, luego la página. `PantallaDeFin` ya no lleva «Compartir stickers» ni la nota.
- **«Tus entrenos»**: «Ver todos» como enlace, pastilla «Plan» azul clarito, plan «cuándo · tiempo · kilos», libres «cuándo · 5.00 km · 5:27 /km», tarjeta cuando no hay nada, las sesiones marcadas a mano, y también al final de Entrenar con plan. Sin el cuadro «Stickers» de Home.
- **«Ver todos»**: «‹ Home» o «‹ Atrás», «11 entrenos · desde septiembre», filtros por actividad (el plan cuenta como Fuerza), total de cada mes, y la invitación a un plan solo a quien no tiene.

## La ubicación silenciosa (sección 8b, fase 4)

- La app sigue la ubicación en CUALQUIER entreno: el guiado (`useRecorrido`) y el libre sin mapa (pádel, gimnasio, fútbol: `silencio` en `useCronometroLibre`). El cardio, como siempre.
- Precisión baja (unos 100 m, casi sin batería) hasta que hay movimiento de verdad; entonces alta; tras 3 min quieto, baja otra vez (`src/lib/rutaSilenciosa.js`, `useRutaEnSilencio`). El plugin del GPS se parchó para cambiar la precisión en vivo (`setAccuracy` en `patches/@capgo+background-geolocation+8.4.14.patch`); la escucha compartida (`src/lib/nativo.js`) usa la más alta que alguien pida.
- Los puntos se guardan como las muestras de un reloj (`{ t, lat, lon, alt? }`). `rutaDe` decide si hay línea (más de 300 m recorridos o a más de 150 m del inicio): un pádel en su cancha no tiene stickers de ruta ni mapa en su página.
- La ruta en silencio NUNCA se vuelve distancia, ritmo, kilómetros ni desnivel (`sinNumerosDeLaRuta` en `guardaEntrenoLibre`).
- El permiso: «¿Guardamos tu recorrido?» una sola vez, en el primer entreno (guiado o libre sin mapa), «para dibujar tu recorrido en tus stickers». Después iOS pide «Mientras usas la app» y luego «Siempre» (el plugin escala solo). Con «Ahora no», o si iOS lo niega, todo funciona igual y no hay línea.
- En el Apple Watch sin el iPhone (1 nov 2026): la misma regla, en el reloj (`MedidorDelReloj.swift`), solo si dijo que sí en su iPhone y nunca con menos de 30 % de batería ni en bajo consumo. Cada entreno del reloj guarda cuánta batería gastó. Ver `docs/entreno-y-reloj.md`, 10.3.

## Pruebas

- `node scripts/prueba-stickers.mjs`: la ficha, las ranuras y el catálogo (las pruebas de aceptación que son puras), incluidos los 19 nuevos: su orden antes de los 35, los de ruta sin ruta, sin «N/A», la ranura vacía y la marca «Nuevo». Y la parte 2: el orden de los 12, sus caras, sus ranuras, sus textos, las frases (una de 40 letras cabe en 3 renglones), y los 6 de Totales con una semana y un mes falsos (y sin semana, sin mes y sin kilómetros).
- Lo que se pinta se revisa a ojo en pantalla, en los cuatro colores, con nombres largos y con un maratón (42.20 km, 3:58:41).

## Sin verificar

- Cuánto tarda en el iPhone armar el video (aquí, con la vista de prueba en segundo plano, tardó 46 s; con el codificador del chip debería ser mucho menos).

- Que Safari de iPhone respete `font-variation-settings` (wdth 75 en Eco) al rasterizar. Si falla, el plan B es dibujar en canvas con las mismas reglas.
- Que copiar una imagen al portapapeles funcione dentro de la app del iPhone. Si falla, sale «No se pudo copiar. Mantén presionado el sticker para guardarlo.».
- La parte 2 en un iPhone real y en Android: deslizar con el dedo (en WebKit de Playwright solo se probó con el mouse y con los puntitos), el carrete de verdad, y «Con foto» con una foto del carrete (se probó con HEIC hechas con `sips`, no con una del iPhone).
