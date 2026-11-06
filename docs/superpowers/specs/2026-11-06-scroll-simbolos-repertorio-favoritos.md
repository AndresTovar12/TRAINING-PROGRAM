# Cuatro cambios: scroll de la lista, símbolos de 8 actividades, repertorio del coach y un solo color con Favoritos

**Modelo:** Opus 5.5, esfuerzo alto. Spec de Andrés (6 nov 2026), copiada tal cual.

Cuatro cambios sobre main, en este orden, cada uno en su propio commit. Opus 5.5, esfuerzo alto. Si uno falla, para y avisa antes de seguir con el siguiente.

Maquetas aprobadas por Andrés (6 nov 2026): 9o78ef564XdcBg5TCkFxAA (tiene dos versiones en su historial: la parte 1 «Las actividades» y «Repertorio del coach»).

Regla de siempre para el catálogo de íconos (src/lib/iconosDeTipo.datos.js): un `id` NUNCA cambia, nunca se borra y nunca se reutiliza.

=====================================================================
COMMIT 1 · Registrar: la lista sobre el mapa ya no se traba al hacer scroll
=====================================================================

El error (Andrés, build 94): con «¿Qué vas a hacer?» abierta encima del mapa de Apple, la lista se traba y va a saltos al hacer scroll.

La causa, en el plugin del mapa (@capgo/capacitor-native-map 8.1.2, dist/esm/touch-routing.js): mientras hay un mapa `toBack`, `installIosTouchRoutingCachePublisher` deja un oyente de `scroll` en `window` (en captura, así que también oye el scroll de la lista) y un MutationObserver. Cada scroll corre `collectWebCaptureRects()` en el siguiente cuadro: un `getComputedStyle` por CADA elemento de la página (también los de #root, que está escondido) y un `postMessage` al nativo. Son 60 a 120 barridos por segundo mientras la lista se mueve. Además `useHojaDeslizable` escucha `touchmove` en modo no pasivo, así que el iPhone no puede mover la lista por su cuenta: espera al código en cada cuadro, y el código está ocupado con el barrido. Antes del commit «Registrar: la hoja se abre sobre el mapa…» esto no pasaba porque al abrir la lista el mapa se destruía y con él el barrido.

Qué hacer:
1. Mientras la hoja está abierta encima de un mapa `toBack` (hay clase `native-map-to-back` en <html>), el plugin no debe barrer la página. La hoja tapa toda la pantalla con el velo (fondo al 32 %), así que en ese rato el mapa no necesita toques y los rectángulos que ya tiene el nativo bastan.
   - Importa de '@capgo/capacitor-native-map/dist/esm/touch-routing.js' (el paquete no tiene mapa de `exports`, el import profundo funciona) `publishIosTouchRoutingCache`, `installIosTouchRoutingCachePublisher` y `uninstallIosTouchRoutingCachePublisher`. Fíjalo con un comentario: es un interior del plugin, pinneado a 8.1.2; si el plugin se actualiza, hay que revisar esto.
   - Al abrir la hoja (`abierta` pasa a verdadero) y SOLO si existe la clase `native-map-to-back`: primero `publishIosTouchRoutingCache()` (para que el nativo ya tenga el rectángulo del velo), después `uninstallIosTouchRoutingCachePublisher()`. Recuerda en un ref que fuimos nosotros.
   - Al cerrar (`abierta` pasa a falso) o al desmontar: si fuimos nosotros Y la clase `native-map-to-back` SIGUE en <html>, `installIosTouchRoutingCachePublisher()` (vuelve a barrer una vez y el mapa recupera los toques). Si la clase ya no está (se eligió una actividad sin mapa y el mapa se destruyó mientras la hoja estaba abierta), NO reinstales: el contador del plugin quedaría en 1 sin mapa y barrería toda la app para siempre.
   - Vive en `useHojaDeslizable` (sirve a las dos hojas) o en la `Hoja` de ElegirActividad.jsx; tú decides, pero en un solo lugar.
2. En la web y en Android no cambia nada (la clase no existe).
3. Si prefieres otro camino que logre lo mismo (que el scroll de la lista no dispare el barrido mientras la hoja está abierta, sin tocar el contador del plugin a ciegas), explícalo en el commit.

Pruebas:
- Con el puente falso del mapa nativo y un `window.webkit.messageHandlers.nativeMapTouchRouting` falso que cuente los `postMessage`: abrir la hoja sobre el mapa, hacer scroll de la lista 2 segundos, cerrar. Cuenta esperada: 1 al abrir, 0 durante el scroll, 1 al cerrar.
- El mismo recorrido eligiendo una actividad sin mapa con la hoja abierta: al final el contador del plugin queda en 0 y no hay oyente de scroll.
- Sin mapa (Entrenar → «Todas las actividades»): no se llama ni install ni uninstall.
- Lo que no se pueda medir sin iPhone, dilo.

Commit: «Registrar: la lista sobre el mapa ya no se traba al hacer scroll».

=====================================================================
COMMIT 2 · Registrar: los símbolos que faltaban en 8 actividades
=====================================================================

## 1. Símbolos nuevos (src/lib/iconosDeTipo.datos.js)

Agrega estos con `nombre`, `cat`, `origen`, `palabras` y `svg`:

- `montana-picos` (montana, «Montaña con picos», palabras: 'montana picos cumbre cerro sierra'): Hugeicons «mountain», MIT. SVG exacto:
  <g fill="none" stroke="currentColor" stroke-linejoin="round"><path d="M16 20H2l3.225-9.244C6.795 6.252 7.58 4 9 4c1.337 0 2.112 2 3.512 6"/><path stroke-linecap="round" d="M6 20h16l-4.593-7.341C15.88 10.219 15.117 9 14 9c-1.118 0-1.88 1.22-3.407 3.659L9.128 15"/></g>
- `tapete` (mente, «Tapete», palabras: 'tapete yoga mat colchoneta pilates estiramiento'): Hugeicons «yoga-mat», MIT. SVG exacto:
  <g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="m10.505 15.01l6.635-4.51q.282-.211.496-.488c.486-.63.476-1.505.168-2.237A4.55 4.55 0 0 0 13.6 5c-.936 0-1.805.28-2.528.758l-7.08 4.999"/><path d="M5.995 13.507c0 .696.369 2.079 2.04 2.459c1.007.228 3.938-.735 2.504-3.527s-4.887-2.807-6.292-1.871c-.859.52-2.526 2.148-2.21 4.312c.113 1.31 1.145 3.97 4.375 4.122h9.892c.922-.073 1.112-.207 1.814-.746c.945-.848 2.522-2.408 3.439-3.434c.198-.222.411-.45.439-.746c.145-1.577-2.247-.894-3.98-1.082"/></g>
- `pickleball` (pelota, «Pickleball», palabras: 'pickleball pala pelota raqueta'): Material Symbols «pickleball-outline-rounded», Apache 2.0. RELLENO en caja 24: `relleno: true`, `caja: '0 0 24 24'`. SVG exacto:
  <path d="M7.075 14.475q.475.475 1.05.7t1.2.225t1.2-.225t1.05-.7l.9-.9q.475-.475.7-1.05t.225-1.2t-.225-1.187t-.7-1.038l-3.8-3.8q-.3-.3-.712-.3t-.713.3L3.3 9.275q-.3.3-.3.7t.3.7zm2.225 2.9q-1 0-1.937-.375t-1.688-1.125l-3.8-3.775q-.425-.425-.65-.987T1 9.975t.225-1.137t.65-.988L5.85 3.875q.425-.425.988-.65T7.974 3t1.138.225t.987.65l3.775 3.8q.75.75 1.125 1.688t.375 1.937q0 .9-.312 1.788T14.1 14.7l5.175 5.175q.3.3.3.713t-.3.712t-.7.3t-.7-.3L12.7 16.125q-.725.65-1.612.95t-1.788.3M19.5 9q-1.45 0-2.475-1.025T16 5.5t1.025-2.475T19.5 2t2.475 1.025T23 5.5t-1.025 2.475T19.5 9m0-2q.625 0 1.063-.437T21 5.5t-.437-1.062T19.5 4t-1.062.438T18 5.5t.438 1.063T19.5 7"/>
- Dibujados para Training Lab (de línea, caja 24, el trazo lo pone quien los pinta):
  · `canoa` (agua, «Canoa», palabras: 'canoa remo remar bote'): <path d="M2.5 13.5h19c-.9 2.6-2.9 4-5.7 4H8.2c-2.8 0-4.8-1.4-5.7-4z"/><path d="M17.5 3l-7.2 15.5"/><path d="M10.3 18.5l-1 2.2a1.1 1.1 0 0 0 2 .9l1-2.2"/><path d="M6 13.5v-1.2a1.3 1.3 0 0 1 2.6 0v1.2"/>
  · `eliptica` (cardio, «Elíptica», palabras: 'eliptica maquina cardio gimnasio'): <path d="M3 20.5h18"/><ellipse cx="9.5" cy="15.5" rx="5" ry="2.6"/><path d="M6.5 13.6l5.5 3.8"/><path d="M15.5 20.5V8"/><path d="M15.5 8l3.5-4"/><path d="M15.5 8L12 4.5"/><path d="M5 20.5v-2.2M14 20.5v-2.2"/>
  · `reformer` (mente, «Reformer», palabras: 'reformer pilates cama maquina'): <rect x="2" y="14" width="20" height="3" rx="1.5"/><path d="M4.5 17v3.5M19.5 17v3.5"/><rect x="5.5" y="10.5" width="8" height="3.5" rx="1"/><path d="M8 10.5V8.5M11 10.5V8.5"/><path d="M18 14l1.6-6.5"/><path d="M18.4 7.5h2.6"/>
- Agrega Material Symbols (Apache 2.0, Copyright Google LLC) al aviso de LICENCIAS.

## 2. Las actividades (src/lib/actividades.js)

Cambia `icono`:
- senderismo → montana-picos (deja de repetir la bota de Trail)
- remo → canoa
- kayak → kayak (el que tenía Remo)
- eliptica → eliptica
- pickleball → pickleball
- yoga → tapete
- pilates → reformer
- movilidad → estirar (el muñequito estirando, que dejó libre Pilates)

Las demás se quedan igual. En aspectoDelTipo.js, el tipo de sesión yoga pasa de loto a tapete, igual que la actividad.

## 3. Pruebas
- Ninguna de las 29 actividades repite símbolo con otra.
- Cada `icono` de actividades.js existe en el catálogo.
- `sugiereIcono`: «canoa» → canoa, «elíptica» → eliptica, «pickleball» → pickleball, «tapete» → tapete, «reformer» → reformer.
- `npm run pruebas` y `npm run build` limpios.

Commit: «Registrar: los símbolos que faltaban en 8 actividades».

=====================================================================
COMMIT 3 · Repertorio del coach: menos muñequitos, sin repetidos y 104 símbolos nuevos
=====================================================================

Archivo: src/lib/iconosDeTipo.datos.js (el catálogo que ve el coach en «Tipo nuevo»). Hoy tiene 267. Usa `tapete`, que crea el commit 2.

## 1. Ocultar 29 (no borrar)
- Campo nuevo `oculto: true` en la entrada.
- `armaCatalogo` los deja en `porId`: un tipo viejo que ya lo usa se sigue dibujando igual, y la actividad Movilidad sigue con `estirar`.
- `buscaIconos` y `sugiereIcono` los saltan siempre.
- Las `palabras` del oculto se suman, sin repetir, a las del que va después de la flecha. Así buscar «natación» encuentra los goggles.

gimnasia → anillas, sprint → tenis-movimiento, caminadora → caminadora-2, salto-pared → cajon-salto, nadar → goggles, buceo → visor-snorkel, polo-acuatico → balon-waterpolo, esqui → esquis, skate → patineta, snowboard → tabla-snowboard, estirar → tapete, persona → columna, accesible → rodillo, correr → tenis-correr, caminar → huellas-pies, pasos → huellas-pies, huellas → huellas-pies, bici → bicicleta, calzado → tenis-correr, senderismo → bota, futbol → balon-futbol, basquet → balon-basquet, americano → balon-americano, jugador → equipo, balonmano → pelota, karate → guante, mano → mano-palma, yoga → tapete, estirar-2 → tapete

## 2. La categoría `pelota`
Su nombre pasa a «Deportes» (antes «Pelota y equipo»). El id `pelota` no cambia.

## 3. Agregar 104
Cada renglón: id | nombre | fuente:dibujo | palabras. Van al final del bloque de su categoría, en este orden.

Cómo sacar el dibujo EXACTO (bájalos con `npm pack` en una carpeta temporal; NO los agregues a package.json):
- h: → @iconify-json/hugeicons@1.2.35 · t: → @iconify-json/tabler@1.2.43 · ll: → @iconify-json/lucide-lab@1.2.3 · hi: → @iconify-json/healthicons@1.2.18. El `svg` es `icons[nombre].body` de icons.json, quitándole todos los `stroke-width="…"` (el trazo lo pone quien lo pinta). Si el body no trae `stroke=`, lleva `relleno: true`. Si el ícono no mide 24 × 24, lleva `caja` con su medida.
- p: → @phosphor-icons/core@2.1.1, archivo assets/regular/<nombre>.svg. El `svg` es lo de adentro del <svg>, con `caja: '0 0 256 256'` y `relleno: true` (igual que `bota`).
- `origen` igual que lo escribo (h:, t:, ll:, hi:, p:, tl:).

[fuerza]
anillas | Gimnasia | h:gymnastic-rings | gimnasia calistenia acrobacia barras anillas
mancuernas | Mancuernas | h:dumbbell-03 | mancuernas pesas dumbbell
press-banca | Press de banca | h:equipment-bench-press | press banca pecho bench
discos | Discos | h:equipment-gym-01 | discos pesas placas
dominadas | Barra de dominadas | h:equipment-gym-02 | dominadas barra pull up
rack | Rack | h:equipment-gym-03 | rack sentadilla squat
espalda | Espalda | h:back-muscle-body | espalda dorsales
abdomen | Abdomen | h:body-part-six-pack | abdomen core abs
banda | Banda elástica | tl (abajo) | banda liga elastica resistencia

[cardio]
tenis-movimiento | Sprint | p:sneaker-move | sprint velocidad carrera rapida atletismo tenis
caminadora-2 | Caminadora | h:treadmill-01 | caminadora cinta banda correr gimnasio maquina
cajon-salto | Salto | tl (abajo) | salto saltar pliometria brinco cajon box jump
monitor-cardiaco | Monitor cardiaco | h:cardiogram-01 | monitor cardiaco pulso frecuencia
bandera-cuadros | Bandera a cuadros | p:flag-checkered | bandera meta carrera
maquina-cardio | Máquina de cardio | h:treadmill-02 | maquina cardio bici estatica
carretera | Carretera | p:road-horizon | carretera camino ruta
calcetas | Calcetas | h:socks | calcetas calcetines
pista | Pista de atletismo | tl (abajo) | pista atletismo track field tartan vueltas carriles

[agua]
goggles | Natación | p:goggles | natacion nadar alberca piscina crol goggles lentes
visor-snorkel | Buceo | t:scuba-mask | buceo bucear apnea submarinismo visor snorkel careta
balon-waterpolo | Polo acuático | h:water-polo | polo acuatico waterpolo pelota alberca balon
gorra-natacion | Gorra de natación | h:swimming-cap | gorra natacion
windsurf | Windsurf | h:wind-surf | windsurf vela
cana-pescar | Caña de pescar | h:fishing-rod | cana pescar pesca
toallas | Toallas | h:towels | toallas
ola | Ola | h:tsunami | ola mar

[montana]
esquis | Esquí | ll:skis | esqui esquiar nieve salto esquis
patineta | Skateboard | t:skateboard | skateboard patineta tabla skate
tabla-snowboard | Snowboard | ll:snowboard | snowboard tabla nieve invierno
cordillera | Cordillera | p:mountains | cordillera montanas
camper | Camper | h:camper | camper viaje
fogata | Fogata | h:campfire | fogata fuego campamento
palmera | Palmera | h:tree-palm | palmera playa
lentes-sol | Lentes de sol | h:sunglasses | lentes sol
globo | Globo | h:hot-air-balloon | globo aerostatico
senal-sendero | Señal de sendero | p:signpost | senal sendero senderismo

[pelota]
cono | Cono | h:traffic-cone | cono conos agilidad drills
silbato | Silbato | h:whistle | silbato arbitro coach entrenador
cancha | Cancha | h:football-pitch | cancha campo futbol soccer
raqueta-tenis | Raqueta de tenis | ll:tennis-racket | raqueta tenis
badminton | Bádminton | h:badminton-shuttle | badminton gallito volante
hockey | Hockey | h:hockey | hockey palo cesped
frisbee | Frisbee | h:frisbee | frisbee ultimate disco
aro-basquet | Aro de básquet | h:basketball-hoop | aro canasta basquet
cancha-basquet | Cancha de básquet | p:court-basketball | cancha basquet
casco-americano | Casco americano | p:football-helmet | casco futbol americano
bat | Bat | h:baseball-bat | bat beisbol softbol
casco-beisbol | Casco de béisbol | h:baseball-helmet | casco beisbol
gorra | Gorra | p:baseball-cap | gorra beisbol
palo-golf | Palo de golf | h:golf-bat | palo golf
pelota-golf | Pelota de golf | h:golf-ball | pelota golf
hoyo-golf | Hoyo de golf | h:golf-hole | hoyo golf green
carrito-golf | Carrito de golf | h:golf-cart | carrito golf
hockey-hielo | Hockey sobre hielo | h:ice-hockey | hockey hielo
pinos | Pinos de boliche | h:bowling-pins | pinos boliche bolos
bat-criquet | Bat de críquet | h:cricket-bat | criquet bat
mesa-billar | Mesa de billar | h:pool-table | mesa billar pool
cono-chico | Cono chico | h:cone-01 | cono chico platillo
primer-lugar | Primer lugar | h:medal-first-place | primer lugar medalla ganador
marcador-partido | Marcador | t:scoreboard | marcador partido score
estadio | Estadio | t:building-stadium | estadio
pelota-playa | Pelota de playa | p:beach-ball | pelota playa
hyrox-2 | Hyrox | tl: el MISMO svg de la entrada `hyrox` (cópialo tal cual) | hyrox competencia fitness funcional carrera

[combate]
costal | Costal | h:boxing-bag | costal saco box
pera-box | Pera de box | h:punching-ball-01 | pera box
casco-espartano | Casco espartano | h:spartan-helmet | casco espartano guerrero
esgrima | Esgrima | h:fencing | esgrima espada
careta-esgrima | Careta de esgrima | h:fencing-mask | careta esgrima
caballo-ajedrez | Caballo de ajedrez | h:chess-knight | caballo ajedrez
dardo | Dardo | h:dart | dardo dardos

[mente]
columna | Postura | hi:spine-outline-24px | postura de pie cuerpo columna espalda vertebras
rodillo | Movilidad | tl (abajo) | movilidad adaptado inclusivo cuerpo rodillo foam roller liberacion miofascial
pelota-yoga | Pelota de yoga | h:yoga-ball | pelota yoga fitball
cerebro-2 | Mente | h:brain-02 | mente cerebro
aro-pilates | Aro de pilates | tl (abajo) | aro pilates magic circle
pelota-chica | Pelota chica | tl (abajo) | pelota chica pilates
corazon-sano | Corazón sano | h:heart-check | corazon sano salud
tulipan | Tulipán | p:flower-tulip | tulipan flor

[salud]
frasco-medicina | Frasco de medicina | h:medicine-bottle-01 | medicina frasco
frasco-pastillas | Frasco de pastillas | h:pill-bottle | pastillas frasco suplementos
revision-corazon | Revisión de corazón | h:scan-heart | revision corazon
curitas | Curitas | p:bandaids | curitas

[descanso]
alarma | Alarma | h:alarm-clock | alarma despertador
te | Té | p:tea-bag | te infusion

[nutricion]
arroz | Arroz | h:rice-bowl-01 | arroz
sandia | Sandía | h:watermelon | sandia fruta
pasta | Pasta | h:spaghetti | pasta espagueti
verduras | Verduras | h:leafy-green | verduras vegetales
tazon | Tazón | p:bowl-food | tazon bowl
caldo | Caldo | p:bowl-steam | caldo sopa
tetera | Tetera | h:kettle | tetera te
helado | Helado | h:ice-cream-cone | helado postre
pastelito | Pastelito | h:cupcake-01 | pastelito postre

[pruebas]
cinta-metrica | Cinta métrica | h:tape-measure | cinta metrica medidas
bascula-piso | Báscula de piso | h:weight-scale | bascula peso
rendimiento | Rendimiento | h:dashboard-speed-02 | rendimiento medicion
electro | Electro | h:cardiogram-02 | electro corazon
peso-corporal | Peso corporal | h:body-weight | peso corporal composicion

[clases]
agenda-coach | Agenda del coach | h:calendar-user | agenda coach citas
gafete | Gafete | h:id-card-lanyard | gafete credencial

[otros]
fuegos-artificiales | Fuegos artificiales | h:fireworks | fuegos artificiales celebracion
globos | Globos | h:balloons | globos fiesta
banderin | Banderín | p:flag-banner | banderin
escudo-estrella | Escudo con estrella | p:shield-star | escudo estrella

Los dibujados por Training Lab (de línea, caja 24):
  · cajon-salto: <path d="M3.5 21v-7.5a1.5 1.5 0 0 1 1.5-1.5h14a1.5 1.5 0 0 1 1.5 1.5V21"/><path d="M3.5 16h17"/><path d="M12 9.5V3"/><path d="M9 6l3-3 3 3"/>
  · rodillo: <ellipse cx="5.5" cy="12" rx="2.5" ry="5"/><path d="M5.5 7h13a2.5 5 0 0 1 0 10h-13"/><path d="M10 7.3v9.4M14 7.3v9.4"/>
  · banda: <rect x="2.5" y="3" width="6" height="2.6" rx="1.3"/><rect x="15.5" y="18.4" width="6" height="2.6" rx="1.3"/><path d="M5.5 5.6c0 7.5 13 5.3 13 12.8"/>
  · aro-pilates: <circle cx="12" cy="12" r="8"/><path d="M3 12h2.5M18.5 12H21"/><rect x="1.8" y="9.5" width="2.6" height="5" rx="1.1"/><rect x="19.6" y="9.5" width="2.6" height="5" rx="1.1"/>
  · pelota-chica: <circle cx="12" cy="10.5" r="6"/><path d="M6.6 8.4c3.6 1.4 7.2 1.4 10.8 0"/><path d="M3 20h18"/>
  · pista: <rect x="1.8" y="5" width="20.4" height="14" rx="7"/><rect x="4.4" y="7.4" width="15.2" height="9.2" rx="4.6"/><rect x="7" y="9.8" width="10" height="4.4" rx="2.2"/><path d="M13.5 14.2V19"/>

## 4. Licencias (aviso LICENCIAS del archivo)
- Lucide Lab: ISC License. Copyright (c) Lucide Contributors.
- Healthicons: MIT License. Copyright (c) Resolve to Save Lives.
- Hugeicons: quita la aclaración «running-shoes»; ahora son varios.
- Los tl: nuevos: cajón de salto, rodillo, banda elástica, aro de pilates, pelota chica, pista de atletismo y la copia de Hyrox.

## 5. La copia del conector
`supabase/functions/mcp/app/iconosDeTipo.datos.js` se regenera con `scripts/compartir-con-mcp.mjs`, no a mano.

## 6. Pruebas (scripts/prueba-iconos-de-tipo.mjs)
- `buscaIconos(cat, '')` devuelve 348 y ninguno oculto.
- `porId.get('nadar')` y `porId.get('estirar')` siguen existiendo.
- `sugiereIcono` nunca devuelve un oculto: «natación» → goggles, «correr» → tenis-correr, «esquí» → esquis, «gimnasia» → anillas, «cono» → cono, «atletismo» → pista.
- Ningún id repetido. Cada dibujo nuevo pinta algo (no queda vacío).
- `npm run pruebas` y `npm run build` limpios.

Commit: «Repertorio del coach: menos muñequitos, sin repetidos y 104 símbolos nuevos».

=====================================================================
COMMIT 4 · Tipos de sesión: un solo color en las listas y «Favoritos» al crear uno
=====================================================================

Notas de Andrés (6 nov 2026): en «Tipos de sesión» la lista sale de varios colores; la quiere de un solo color, como cuando el atleta elige su actividad.

## 1. Un solo color en las listas
- `MosaicoDeTipo` acepta `color` opcional; si llega, pinta el símbolo de ese color en lugar de `tinta`.
- En `HojaTiposDeSesion.jsx` (las listas «Los tuyos» y «De la app») y en `SelectorTipoSesion.jsx` (solo la lista que se despliega, con «Los tuyos» y «De la app»; el botón cerrado que enseña el tipo actual no cambia), todos los símbolos en el azul de la marca: `KP.blue` (#1E40E0).
- La tarjeta del día y el resto de la app NO cambian: ahí el color sigue diciendo qué tipo es.
- La rejilla de «Tipo nuevo» se queda como está (negro, y el elegido en azul), igual que «Crear mi actividad» del atleta.

## 2. «Favoritos» en «Tipo nuevo» (HojaTipoNuevo.jsx)
- Un chip «Favoritos» justo después de «Todos». «Todos» sigue siendo el que sale al abrir.
- En `iconosDeTipo.datos.js` exporta `FAVORITOS`, la lista de ids en este orden:
  pesa, hyrox, tenis-correr, tenis-movimiento, huellas-pies, goggles, gorra-natacion, bicicleta, bici-fija, balon-americano, cinturon-banderas, tapete, loto, balon-basquet, pista, balon-futbol, pala-padel, voleibol, mancuernas, pesa-rusa, guante, cronometro, rayo, cono
- `buscaIconos(cat, texto, 'favoritos')` devuelve esos, en ese orden, sin ocultos; con texto, filtra dentro de ellos como en cualquier categoría. Es un caso aparte: 'favoritos' no es una `cat` de las entradas.
- Pásale `FAVORITOS` a `armaCatalogo` para que viaje con el catálogo (se carga aparte, como hoy).

## 3. Pruebas
- Con el chip «Favoritos», la rejilla enseña los 24 en ese orden.
- Ningún id de `FAVORITOS` falta en el catálogo ni está oculto.
- Las listas de «Tipos de sesión» y la lista desplegada del selector del editor pintan todos los símbolos en #1E40E0; la tarjeta del día conserva el color de su tipo.
- `npm run pruebas` y `npm run build` limpios.

Commit: «Tipos de sesión: un solo color en las listas y Favoritos al crear uno».

=====================================================================
Al final: `npm run check` en verde y dime los 4 hashes y el número de build de TestFlight.
