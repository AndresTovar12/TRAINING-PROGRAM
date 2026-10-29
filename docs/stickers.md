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

## Pruebas

- `node scripts/prueba-stickers.mjs`: la ficha, las ranuras y el catálogo (las pruebas de aceptación que son puras).
- Lo que se pinta se revisa a ojo en pantalla, en los cuatro colores, con nombres largos y con un maratón (42.20 km, 3:58:41).

## Sin verificar

- Cuánto tarda en el iPhone armar el video (aquí, con la vista de prueba en segundo plano, tardó 46 s; con el codificador del chip debería ser mucho menos).

- Que Safari de iPhone respete `font-variation-settings` (wdth 75 en Eco) al rasterizar. Si falla, el plan B es dibujar en canvas con las mismas reglas.
- Que copiar una imagen al portapapeles funcione dentro de la app del iPhone. Si falla, sale «No se pudo copiar. Mantén presionado el sticker para guardarlo.».
