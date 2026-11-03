# Pausa automática: rápida y sin falsos. A pie con el rebote del cuerpo, sobre ruedas con el GPS

**Modelo:** Opus 5.5, esfuerzo alto. Toca Swift (`MovimientoPlugin.swift`), la lógica pura (`lib/`) y una pantalla (`ElegirActividad.jsx`).
**Dos commits sobre main, en este orden.** El B depende del A.

## Qué está mal hoy (visto en el código, en 6aae0a0)

- `decideMarcha` en `src/lib/entrenoLibre.js` pausa a pie cuando se juntan dos cosas: el podómetro lleva 3 s sin avisar (`AVISO_VIGENTE_MS` en `sensorDeMovimiento.js`) y **una sola** lectura del GPS sale lenta (`gps.racha(gps.lento)` acepta una lectura). Eso da pausas en falso corriendo.
- Al parar de verdad con error de GPS alto, las lecturas se descartan y la pausa tarda hasta 17 s.
- El podómetro (`CMPedometer`) avisa cuando quiere. No sirve para decidir en 1 s.
- Las reglas van por `deporte` (`UMBRALES_DE_PAUSA` solo tiene correr, caminar, senderismo y bici). Las actividades propias y patines, surf, remo y kayak caen en `otro` y no tienen pausa automática.

## La idea

Dos familias de actividades con mapa:
- **A pie** (correr, caminar, senderismo, trail): el cuerpo rebota con cada paso. Parado, no rebota. Esa señal sale del acelerómetro y se lee en 1 s.
- **Sobre ruedas o en el agua** (bici, patines, surf, remo, kayak): no hay rebote. Se usa el GPS, con la barra alta: el error del GPS parado (~0.9 m/s) queda muy por debajo de pedalear.

Sin mapa: no hay pausa automática, como hoy.

## Commit A: la familia de cada actividad

### A1. Catálogo (`src/lib/actividades.js`)
- Cada actividad con `gps: true` lleva `desplazamiento: 'pie' | 'ruedas'`.
  - `pie`: correr, caminar, senderismo, trail.
  - `ruedas`: bici, patines, surf, remo, kayak.
- Las actividades sin `gps` no llevan el campo.
- `limpiaPropia` acepta `desplazamiento` solo si es `'pie'` o `'ruedas'`; si la propia lleva `gps` y no tiene el campo, queda `null` (pendiente de preguntar).
- Nueva función `desplazamientoDe(actividad)`: devuelve `'pie'`, `'ruedas'` o `null`.

### A2. Al crear una actividad propia (`src/features/libre/ElegirActividad.jsx`)
- Si la persona contesta sí a «¿Te mueves de un lugar a otro?», aparece una segunda pregunta, en el mismo estilo:
  - «¿Cómo te mueves?»
  - Dos opciones: **«A pie»** y **«Sobre ruedas o en el agua»**.
  - Viene marcada «A pie». Debajo, en chico: «Así sabemos cuándo pausar solo.»
- Si contesta no, la segunda pregunta no aparece.

### A3. Las propias que ya existen
- Al **iniciar** una carrera con una actividad propia que lleva `gps` y tiene `desplazamiento: null`, antes del mapa sale una hoja con la misma pregunta y las dos opciones. Se guarda en la actividad y no vuelve a preguntar.
- Se puede cambiar después: en la lista de actividades, al editar una propia.

### A4. Pruebas del A
- `limpiaPropia` y `creaActividad` guardan y validan el campo.
- `desplazamientoDe` de cada actividad del catálogo con mapa da `pie` o `ruedas`, nunca `null`.

Commit: «Actividades: a pie o sobre ruedas, para la pausa automática».

## Commit B: la nueva pausa automática

### B1. El rebote, en el plugin nativo (`ios/App/App/MovimientoPlugin.swift`)
- Se enciende `CMMotionManager` con `deviceMotion` a 20 Hz, además de lo que ya hay. Se apaga al detener, como lo demás.
- Cada segundo manda **un** aviso `rebote` con:
  - `en`: la hora en ms.
  - `valor`: la desviación estándar de la magnitud de `userAcceleration` en ese segundo, en g (sin la gravedad).
- Swift no decide nada. Solo mide y avisa, como hoy con el podómetro.
- `estado()` dice también si hay acelerómetro (`hayRebote`).

### B2. La señal en lo puro (`src/lib/sensorDeMovimiento.js`)
- Nueva señal `rebota`: hay rebote si el último aviso tiene `valor ≥ REBOTE_MINIMO` y llegó hace menos de 2 s.
- `REBOTE_MINIMO` arranca en **0.12 g**. Es un punto de partida, no un hecho. Se ajusta con las trazas reales (B6). Déjalo como constante exportada, en un solo lugar.
- `sinRebote(ahora)`: cuántos segundos seguidos llevan los avisos por debajo del mínimo.
- `movimientoNativo.js` recibe el evento `rebote` y lo pasa igual que `pasos`.

### B3. Las reglas (`src/lib/entrenoLibre.js`)
Sustituyen a `decideMarcha`. Reciben la familia (`'pie' | 'ruedas'`), no el deporte.

**A pie, con acelerómetro:**
- **Pausar:** 1.5 s seguidos sin rebote → quieto. El GPS no participa en pausar.
- **Reanudar:** rebote **y** avance real del GPS, los dos a la vez:
  - rebote al menos 1 s seguido, y
  - avance real: la regla que ya existe de los últimos 5 s de desplazamiento (la de `rapido` con error > 12 m), usada siempre, con o sin error.
  - Mover el teléfono con las manos da rebote pero no avance: no reanuda.
- **Sin GPS bueno** (ningún punto con error ≤ 20 m en los últimos 10 s, un túnel): reanuda con rebote solo, 3 s seguidos. Perder la señal nunca pausa.
- **Los metros:** sin rebote, el GPS no suma distancia aunque todavía no se haya pausado. Esto es lo que mata el «parado suma 50 m». Va en el mismo lugar donde hoy se decide si un punto suma (`agregaPunto` en `ubicacion.js`, con la ancla).

**Sobre ruedas o en el agua:**
- Velocidad = desplazamiento de los últimos 5 s entre 5 (no la velocidad instantánea del GPS).
- **Pausar:** esa velocidad < 1.0 m/s durante 3 s seguidos, y el sensor de actividad no dice «en bici» (el veto que ya existe).
- **Reanudar:** esa velocidad > 2.0 m/s durante 2 s seguidos.
- Sin lecturas buenas en 5 s: no decide nada.
- El rebote no se usa.

**Para las dos familias:**
- Después de reanudar, **8 s** sin poder pausar. Después de pausar, **3 s** sin poder reanudar.
- El interruptor «Pausa automática» de Dispositivos sigue mandando. Apagado, nada de esto corre.

**Sin acelerómetro** (web, o `hayRebote: false`): a pie se usan las reglas de ruedas con las barras de hoy (pausa < 0.6, reanuda > 1.0), siempre con el desplazamiento de 5 s. Es más lento, pero no da falsos.

### B4. La pantalla (`src/features/libre/PantallaDeCarrera.jsx`)
- Pasa la familia (`desplazamientoDe(act)`) en lugar de `deporte` a la lógica de pausa. Lo demás de la pantalla no cambia.
- Lo que se ve en pausa y al reanudar es lo mismo de hoy.

### B5. La traza (`src/lib/trazaGps.js`)
- Cada aviso `rebote` se guarda como evento (`tipo: 'rebote'`, con `valor`).
- Cada cambio de marcha (`en marcha` ↔ `quieto`) se guarda como evento `marcha`, con el motivo (`sin-rebote`, `rebote+avance`, `gps-lento`, `gps-rapido`, `sin-gps`).
- Sube el formato a `traza-gps/3`. Los `/1` y `/2` se siguen leyendo.
- `scripts/prueba-ruta.mjs` reproduce las trazas nuevas con las reglas nuevas y dice, por cada parada, cuántos segundos tardó en pausar y en reanudar.

### B6. Pruebas sintéticas (en `npm run pruebas`)
Trazas armadas a mano, con los avisos del sensor y los puntos del GPS en el tiempo:
1. Corriendo parejo, el podómetro se calla 9 s y una lectura del GPS sale a 0.3 m/s. **No pausa.**
2. Corriendo y girar el teléfono (el bug del video): el rebote sigue. **No pausa.**
3. Parar de golpe: rebote a cero, GPS con error 25 m inventando 0.9 m/s. **Pausa en ≤ 2 s.**
4. Parado y moviendo el teléfono con las manos: rebote sí, GPS sin avance. **Sigue en pausa.**
5. Volver a correr: rebote y avance. **Reanuda en ≤ 2 s.**
6. Túnel corriendo: 15 s sin GPS bueno, rebote presente. **No pausa.**
7. Bici en semáforo entre edificios: GPS con error 25 m inventando 0.9 m/s, sin «en bici». **Pausa en ≤ 4 s.** Al pedalear a 5 m/s, **reanuda en ≤ 3 s.**
8. Bici rodando a 3 m/s con una lectura mala. **No pausa.**

### B7. Pruebas reales (iPhone, con «Guardar traza del GPS» encendido)
1. Correr 10 min en calle con edificios, con 3 paradas de 10 s. Con la traza, dime por cada parada los segundos que tardó en pausar y en reanudar, y si hubo alguna pausa en falso.
2. Caminar 5 min con 2 paradas. Lo mismo.
3. Bici 10 min con 2 semáforos. Lo mismo.
4. Correr con el teléfono en la mano, en el bolsillo y en el brazo. Que pause en los tres.
5. Parado, mover el teléfono con las manos 10 s. Que no reanude.
6. Si `REBOTE_MINIMO` cambió después de ver las trazas, dime el valor final y por qué.

Commit: «Pausa automática: a pie con el rebote del cuerpo, sobre ruedas con el GPS».

## Qué no tocar
- El reloj: el entreno en el Apple Watch sigue con su lógica de hoy.
- El mapa, la línea, la tarjeta y las pantallas de la carrera.
- `guardaEntrenoLibre` y el resumen con stickers.

## Al terminar
- Actualiza `docs/entreno-y-reloj.md`, en la sección de la pausa automática: las dos familias, las reglas y el valor de `REBOTE_MINIMO`.
- Dime los dos hashes, el número de build de TestFlight, los tiempos de B7 y lo que no pudiste probar.
