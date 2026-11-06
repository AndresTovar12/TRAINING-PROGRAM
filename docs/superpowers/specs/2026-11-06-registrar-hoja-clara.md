# Registrar actividad: pantalla clara, símbolos nuevos, dos deportes y nadar con mapa

**Modelo:** Sonnet 5.5, esfuerzo alto.

Maquetas aprobadas por Andrés (6 nov 2026): JFsJCSjMhVWE34zREdjTdp (la propuesta 2, «Lista agrupada»), Pu6JPH6GTWEQcNgXp6JE1n (la versión B, «Todo azul»), GQ2EDQg19GTodbaUPnJ4fJ (los símbolos, sin cuadro), RFnjZbSj7iAEbDpmDofTHE (fútbol americano y flag football).

Un commit sobre main. Es el «ajuste anterior» que mencionaba el texto de nadar en el reloj. Notas de Andrés: «los símbolos no me agradan nada» y «esa pantalla está horrible, ni sé si hace match con la app». Hoy es una pantalla negra con una lista larga; el resto de la app es clara.

## 1. Los símbolos (src/lib/iconosDeTipo.datos.js)

Regla de siempre: un `id` NUNCA cambia ni se reutiliza. Los nuevos llevan id nuevo; los viejos se quedan para lo que ya los usa.

Agrega (con `nombre`, `cat`, `origen`, `palabras` con lo más importante primero, y `svg`):
- `tenis-correr` (cardio): Hugeicons «running-shoes», MIT, de línea, viewBox 24. SVG exacto:
  <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12.406 18.992c1.038.748 1.557 1.122 2.156 1.315s1.239.193 2.518.193H19c1.414 0 2.121 0 2.56-.44c.44-.439.44-1.146.44-2.56h-5.21c-.64 0-.96 0-1.259-.097c-.3-.096-.559-.283-1.078-.657L3 8.5l-.69 1.036a1.84 1.84 0 0 0 .455 2.515zM3 8.5l3-5l.307 1.842a2.305 2.305 0 0 0 4.275.765l.558-.976a1.252 1.252 0 0 1 2.206.06l3.93 7.862A.81.81 0 0 0 18 13.5a4 4 0 0 1 4 4m-9.5-8l2-1M14 12l2-1M6 20.5h12m-16-3h3"/>
- De Phosphor (MIT, @phosphor-icons/core, peso «regular», viewBox 256, RELLENOS): `huellas` (footprints), `bota` (boot), `bicicleta` (bicycle), `loto` (flower-lotus), `guante` (boxing-glove), `balon-futbol` (soccer-ball), `balon-basquet` (basketball), `mano` (hand-palm), `balon-americano` (football).
- Dibujados para Training Lab (de línea, viewBox 24; el trazo lo pone quien los pinta):
  · `bici-fija`: <circle cx="7" cy="14.5" r="3.5"/><path d="M7 14.5l4-5.5h5"/><path d="M11 9l3 6.5"/><path d="M9.5 5.5h4"/><path d="M11.5 5.5V9"/><path d="M16 9l1.5-3H20"/><path d="M4 20.5h16"/><path d="M14 15.5v5"/>
  · `tabla-surf`: <path d="M18.2 3.2c2.4 1.6-.6 9.4-5.2 14-4.6 4.6-8.4 4.4-9.6 3.4s-1.2-5 3.4-9.6c4.6-4.6 9-9.4 11.4-7.8z"/><path d="M5.2 19.4L17.6 4.2"/><path d="M7.4 16.4l-3-.4"/>
  · `pala-padel`: <path d="M12 2.8c3.9 0 6.2 2.9 6.2 6.4 0 3.9-2.9 6.3-6.2 6.3s-6.2-2.4-6.2-6.3c0-3.5 2.3-6.4 6.2-6.4z"/><path d="M10.6 15.5l-.3 5.7h3.4l-.3-5.7"/><circle cx="9.8" cy="7.6" r=".55"/><circle cx="14.2" cy="7.6" r=".55"/><circle cx="12" cy="6" r=".55"/><circle cx="9.8" cy="10.6" r=".55"/><circle cx="14.2" cy="10.6" r=".55"/><circle cx="12" cy="9.1" r=".55"/><circle cx="12" cy="12.2" r=".55"/>
  · `cinturon-banderas`: <path d="M2.5 7.6c6 2.1 13 2.1 19 0M2.5 10.6c6 2.1 13 2.1 19 0M2.5 7.6v3M21.5 7.6v3"/><rect x="10.2" y="8.4" width="3.6" height="3.3" rx=".7"/><path d="M5.6 11.6c-.4 2.6-1.4 5.1-3.1 7.5l3 .1 1 2.3c1.5-2.7 2.3-5.7 2.3-8.9"/><path d="M18.4 11.6c.4 2.6 1.4 5.1 3.1 7.5l-3 .1-1 2.3c-1.5-2.7-2.3-5.7-2.3-8.9"/>
  · `hyrox`: un rectángulo redondeado de línea (x 1, y 7, 22 × 10, radio 2) con la palabra HYROX adentro, en Bricolage 800 condensada (wdth 75), convertida a trazos al generar el ícono para que no dependa de la letra. Nuestra letra, no el logo de HYROX (es marca registrada).
- Los rellenos llevan `caja: '0 0 256 256'` y `relleno: true`. IconoSvg (src/components/IconoDeTipo.jsx) los pinta con ese viewBox, `fill="currentColor"` y sin trazo.
- Agrega las licencias de Phosphor y Hugeicons al aviso de LICENCIAS del archivo.
- `sugiereIcono` los encuentra: «correr» → tenis-correr, «boxeo» → guante, «pádel» → pala-padel, «hyrox» → hyrox, «surf» → tabla-surf, «spinning» → bici-fija, «americano» → balon-americano, «flag» → cinturon-banderas.

## 2. Las actividades (src/lib/actividades.js)

- El grupo «En equipo» se llama «Deportes» (la clave del color se queda).
- Dos actividades nuevas en «Deportes», justo después de Fútbol: `americano` «Fútbol americano» (icono balon-americano, sin mapa, deporte 'otro') y `flag` «Flag football» (icono cinturon-banderas, sin mapa, deporte 'otro').
- «Nadar» lleva mapa, como en Strava (Andrés lo vio en un video: «Nado» se empieza desde el iPhone con GPS, para mar o lago con el teléfono en funda o boya). natacion pasa a `gps: true` y `desplazamiento: 'ruedas'` (la familia del agua: la pausa automática usa el GPS, no el rebote). En el iPhone va igual que correr o bici: mapa, ruta, distancia y ritmo por 100 m. En el reloj lo decide el texto de nadar en el reloj.
- Cambia `icono`: correr → tenis-correr, caminar → huellas, senderismo y trail → bota, bici → bicicleta, spinning → bici-fija, surf → tabla-surf, yoga → loto, box → guante, padel → pala-padel, futbol → balon-futbol, basquet → balon-basquet, jiujitsu → mano, hyrox → hyrox.
- Las demás se quedan con su dibujo de hoy.
- En aspectoDelTipo.js (los tipos de sesión de la app): correr → tenis-correr, bici → bicicleta, yoga → loto, football → balon-futbol, pintados con IconoDeTipo. El resto se queda.

## 3. Los símbolos sin cuadro

- IconoDeActividad: sin el cuadro de color. Solo el dibujo, al 74 % del tamaño, en la misma caja (las listas no se mueven). Trazo 1.6 en los de línea.
- Color: en todo lo de actividades (registrar, entreno libre, «Tus entrenos», Mis métricas) el azul de la marca, KP.blue #1E40E0. En fondo oscuro, #5B7BFF.
- Los tipos de sesión (MosaicoDeTipo, selector del editor, tarjeta del día) también sin cuadro y con trazo 1.6, pero conservan el color de su tipo: ahí el color dice qué tipo es.

## 4. La pantalla «¿Qué vas a hacer?» (src/features/libre/ElegirActividad.jsx)

Pasa de pantalla negra a una hoja clara que sube sobre la app, como la maqueta:
- Hoja con fondo #F4F5F8, esquinas de arriba de 28 px, asita gris, y arriba se ve la app oscurecida.
- Cabecera: «¿Qué vas a hacer?» (21 px, 800) y una equis en un círculo gris #E8EAEF de 34 px a la derecha.
- Buscador blanco, radio 14, con la lupa: «Busca: correr, pádel, waterpolo…».
- Lista agrupada, como Mi perfil: cada grupo en una tarjeta blanca (radio 20, sombra mínima de la app) con renglones de 10 × 14 px, línea fina #ECEEF2 entre renglones que empieza después del ícono, y una flechita gris #C2C6CF a la derecha.
- Cada renglón: el símbolo azul (caja de 30 px), el nombre (16 px, 600) y, si lleva mapa, «mapa» con el pin en verde #00A372, 12 px.
- El orden: «Tus actividades» primero (lo de hoy), luego los grupos del catálogo con su nombre arriba (13 px, 700, #5B616E), y al final «¿No está?» con «Crear mi actividad» en azul con un «+».
- Las propias (las que crea la persona) también con su símbolo en azul.
- La pantalla de crear y la de «¿Cómo te mueves?» se quedan como están, solo pasan a clara con estos mismos colores.

## Pruebas
1. npm run check en verde.
2. Una prueba: ningún id viejo desapareció del catálogo, y cada `icono` de actividades.js existe.
3. En el iPhone: abrir registrar, buscar «flag», elegir Fútbol americano y Flag football; crear una propia; empezar «Nadar» y ver que sale el mapa. Mándame capturas de: la hoja completa arriba y abajo, «Tus entrenos», el selector de tipo del editor y la tarjeta de un día.

Commit: «Registrar: hoja clara en lista, símbolos nuevos en azul, fútbol americano, flag football y nadar con mapa».
Dime el hash y el número de build de TestFlight.

## Notas al construir (6 nov 2026)

- Nadar con mapa y `desplazamiento: 'ruedas'` ya entraron en `c4b8592`. Falta el ritmo por 100 m en el iPhone mientras se nada.
- `c4b8592` le quitó la pausa automática a Nadar (`sinPausaAutomatica`): con las reglas de esa familia (pausa < 1.0 m/s, reanuda > 2.0 m/s) se pausaría sola y no volvería. Se queda así hasta que Andrés decida otra cosa.
