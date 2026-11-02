# La pantalla de carrera: la forma de las capturas, con los colores de Training Lab

**Modelo:** Opus 5.5, esfuerzo alto. Toca la web, el mapa nativo (el parche de `@capgo/capacitor-native-map`) y la pantalla bloqueada (Swift).
**Un commit sobre main.** Maqueta aprobada: artifact WVcKiJ2JhyChJqLwP3bhHD (colores **A**, línea **«Con brillo»**).

Archivos principales:
- `src/features/libre/PantallaDeCarrera.jsx`
- `src/features/libre/MapaNativo.jsx`
- `src/features/libre/MapaDeCarrera.jsx`
- `patches/@capgo+capacitor-native-map+8.1.2.patch`
- `ios/App/App/EntrenoLiveActivity.swift`
- `src/features/libre/PantallaDelCronometro.jsx`

## Colores (opción A)

Sobre fondo negro:
- Fondo: negro puro `#000000`.
- Tarjeta: `#0B0C10`.
- Hoja de abajo: `#16171C`.
- Gris de las etiquetas: `#8A8F9C`.
- **Azul de acción:** `#2F55F0`. Es el azul de Training Lab, un poco más claro para que se lea sobre negro. Va en «INICIAR», «Pausar», «Reanudar», el punto del corredor y la línea.
- **Acento:** `#FF4D6A`. Es el rojo de los stickers. Va en el tiempo, el pulso y «Finalizar» (fondo `#8A1F33` que se llena de `#FF4D6A`).
- Sin rosa ni azul eléctrico.

## 1. Antes de salir

- El mapa a pantalla completa, con la brújula arriba a la derecha y los botones del mapa a la derecha: ruta, 2D/3D y centrar.
- Encima de los botones, la pastilla «GPS listo», con su punto verde (o «Buscando GPS…», como hoy).
- Abajo, una fila de tres botones redondos:
  - **La actividad:** su ícono en un círculo gris oscuro, con una palomita azul y su nombre en mayúsculas debajo («CORRER»). Abre `ElegirActividad`, como hoy.
  - **«INICIAR»:** un círculo azul grande, de unos 96 px.
  - **«AJUSTES»:** un engrane. Abre en una hoja los ajustes de la carrera que ya existen: la pausa automática y el tipo de mapa. No agregues ajustes nuevos.
- La barra de abajo de la app se queda.

## 2. Corriendo: los números

- **Fondo negro puro.** No va el mapa chico de hoy.
- **Arriba al centro, el tiempo** en el color de acento, grande (unos 40 px, peso 800, números de ancho fijo).
- **Arriba a la derecha, el ícono de «achicar»:** cambia a la vista de mapa.
- **En el centro,** entre el tiempo y la hoja de abajo, con el mismo espacio arriba y abajo:
  - El ritmo enorme (unos 100 px, peso 800), con «Ritmo (/km)» debajo en gris. Sin dato todavía: «–:––».
  - La distancia enorme, con «Distancia (km)» debajo.
  - Con Apple Watch, debajo el pulso en el color de acento: «♥ 142 lpm».
- **Abajo, la hoja oscura** con su asita y un solo botón ancho, en forma de píldora: «Pausar».

## 3. Corriendo: el mapa

- El mapa a pantalla completa.
- **Abajo, en una sola columna** y con 12 px entre cada cosa: los botones del mapa (pegados a la derecha), la tarjeta y la hoja con «Pausar». Así nunca se enciman ni quedan huecos distintos.
- **La tarjeta negra:**
  - Arriba: el ícono de la actividad, el tiempo en el color de acento y el ícono de «agrandar», que regresa a los números.
  - Abajo, dos columnas: el ritmo y la distancia, grandes.
  - Con Apple Watch, el pulso debajo.
- **Recuerda la última vista** (números o mapa) durante esa carrera.

## 4. La línea del recorrido: «Con brillo»

Tres capas, de abajo hacia arriba:
1. **Halo:** del azul, ancho (unos 18 px), al 45 %, difuminado.
2. **Borde oscuro:** `#0B0C12` al 90 %, de unos 12 px. Despega la línea del mapa.
3. **La línea:** unos 7.5 px, con degradado a lo largo: de `#7FA0FF` en la salida a `#2F55F0` en la punta.

Además:
- Puntas y esquinas redondas.
- Un punto blanco con borde oscuro donde empezó.
- El punto del corredor y su cono van en la punta y apuntan hacia donde va.

**En el mapa nativo** (`MapaNativo.jsx` y el parche): hoy es una sola polilínea. Pasa a tres polilíneas encimadas, en ese orden. Para el degradado usa `MKGradientPolylineRenderer`. Si el halo difuminado no se puede en MapKit, usa una polilínea ancha y transparente sin difuminar.

**En el mapa web** (`MapaDeCarrera.jsx`, maplibre): las mismas tres capas como capas `line`, con `line-blur` para el halo y `line-gradient` (con `lineMetrics: true` en la fuente) para el degradado.

**Que no se trabe:** la línea se sigue actualizando como hoy (`adelgazaRuta`, cada cuánto se manda). Cambiar de una polilínea a tres no debe hacer que el mapa parpadee. Reemplaza las tres juntas.

## 5. En pausa

- Se llega a la pausa desde los números o desde el mapa. En los dos casos, la pausa se ve sobre el mapa, con el tinte azul. Al reanudar, regresa a la vista en la que estaba.
- **El mapa se tiñe de azul desde arriba:** un degradado del azul al 55 % arriba que se desvanece hacia la mitad. Va en la capa web, encima del mapa.
- **Arriba, grande:** «EN PAUSA», en mayúsculas, de unos 46 px, con la misma letra de los stickers y de la celebración al terminar. No agregues una fuente nueva.
- **La tarjeta se pone gris:** el tiempo en gris, los números en gris claro, y la etiqueta del ritmo cambia a «Ritmo promedio (/km)».
- **En la hoja, dos botones lado a lado:**
  - **«Reanudar»:** azul, con su ícono de play.
  - **«Finalizar»:** fondo `#8A1F33` con borde `#FF4D6A`, y su palomita.
- **«Finalizar» se mantiene presionado:** el fondo se llena de izquierda a derecha con `#FF4D6A` en 1 segundo. Si se suelta antes, se vacía. Usa `BotonDeMantener` con esta forma.
- Debajo, en gris chico: «Mantén «Finalizar» para terminar».

## 6. Si la carrera fue muy corta

- Si se finaliza con menos de `MINIMO_DE_SEGUNDOS` (30 s), hoy no se guarda y no se dice nada.
- Ahora sale un aviso sobre la pantalla de pausa, con el fondo oscurecido:
  - Título: «Carrera demasiado corta».
  - Texto: «Corre al menos 30 segundos para guardar tu actividad.»
  - Botones: «Descartar» (gris) y «Seguir corriendo» (blanco). «Seguir corriendo» reanuda.
- El texto usa el nombre de la actividad: «Caminata demasiado corta», «Rodada demasiado corta».

## 7. Pantalla bloqueada (`EntrenoLiveActivity.swift`)

- La misma tarjeta negra:
  - Arriba: el ícono de la actividad, el tiempo en `#FF4D6A` y un botón redondo de pausa a la derecha.
  - Abajo, dos columnas: el ritmo y la distancia, grandes, con sus etiquetas en gris.
- En pausa: el tiempo en gris y «Ritmo promedio».

## 8. Las actividades sin mapa (`PantallaDelCronometro.jsx`)

- La misma pantalla de números, sin mapa: fondo negro, arriba el nombre de la actividad («Pádel», «Gimnasio»), al centro el tiempo enorme y, con Apple Watch, el pulso debajo.
- Abajo, «Pausar»; en pausa, «Reanudar» y «Finalizar» manteniendo, sobre el mismo fondo negro (no hay mapa que teñir).
- No llevan el ícono de cambiar vista ni la línea.

## Qué no tocar

- El GPS: el filtro de precisión, la pausa automática, «parado no suma metros».
- La cámara que sigue al corredor y la brújula.
- El resumen después de guardar, con sus stickers.
- `guardaEntrenoLibre`.

## Cómo probar

1. `npm run check` en verde.
2. En el iPhone, una carrera real de 5 minutos:
   - «INICIAR» lleva a los números.
   - El ícono cambia entre números y mapa.
   - La línea sale con halo, borde y degradado, y sigue la calle sin parpadear.
   - «Pausar» lleva a la pausa, con el azul y «EN PAUSA».
   - «Reanudar» funciona y regresa a la vista en la que estabas.
   - Mantener «Finalizar» la guarda.
3. Una carrera de 10 s: «Carrera demasiado corta». «Descartar» no guarda y «Seguir corriendo» reanuda.
4. Bloquear el teléfono corriendo: la tarjeta negra con el tiempo en rojo. En pausa, el tiempo se ve gris.
5. Con Apple Watch: el pulso aparece en los números y en la tarjeta.
6. Un entreno de gimnasio (sin mapa): la misma pantalla de números, sin mapa.
7. En una pantalla chica (iPhone SE): nada se encima y los números no se cortan.

## Al terminar

- Actualiza `docs/entreno-y-reloj.md`, en la sección de la carrera.
- Commit: «Carrera: números a pantalla completa, mapa con tarjeta, pausa en azul y línea con brillo».
- Dime el hash y el número de build de TestFlight.
