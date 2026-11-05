# El entreno y el reloj: el contrato

**Para quién es:** quien construya la app descargable (App Store, Google Play) o la del Apple Watch / Garmin. La web ya trae el *modo entreno* (pantalla completa, paso por paso). Este documento dice qué datos lo sostienen para que cualquier otro dispositivo —un reloj, una app nativa, la computadora— lea y escriba **lo mismo**, sin tocar la lógica.

> Decisión de Andrés (9 oct 2026): *no* se hace cardio con GPS en la web a medias; se deja todo listo para cuando exista la app descargable y el reloj. Lo que sigue es ese «todo listo».

## 1. La idea en una frase

El entreno es **un dato, no una pantalla**: una lista de pasos (lo que manda el coach) y un avance (lo que hizo el atleta). El paso que «toca» no se guarda: se calcula. Por eso el teléfono, el reloj y la computadora pueden marcar pasos distintos a la vez sin pisarse.

| Pieza | Dónde vive | Qué es |
|---|---|---|
| Pasos | `src/lib/entreno.js` → `pasosDeLaSesion(día)` | La sesión de un día, ya en pasos: ejercicio, descanso, reloj de formato, nota. Se calcula del plan; no se guarda. |
| Avance | `sessionsData[sesionId].entreno` (en `user_app_state.data`) | Lo hecho: marcas con hora. Sí se guarda. |
| Idioma de relojes | `src/lib/entrenoCanonico.js` → `aEntrenoCanonico(plan)` | Los pasos sin nada de pantalla, con palabras neutrales, listos para un adaptador. |

## 2. El avance (lo que se guarda)

```json
{
  "v": 1,
  "nombre": "Lower Strength",
  "inicio": 1791560000000,
  "fin": 1791563600000,
  "oculto": true,
  "hechos":   { "0.1.0": { "t": 1791560060000, "n": "Back Squat", "reps": "6", "kg": "107.5" },
                "d.0.1.0": { "t": 1791560220000, "p": 150 } },
  "saltados": { "3.1.0": { "t": 1791560500000, "n": "Hip Thrust" } },
  "extra":    { "d.0.1.0": 30 },
  "empezados":{ "1.2.0": 1791560900000 }
}
```

- **Horas en milisegundos de época** (`Date.now()`). Todo lo que se ve (cuánto queda de un descanso, el tiempo total) se calcula con la hora de ahora: nunca con un contador. Así aguanta una llamada, la pantalla bloqueada o que el sistema mate la app.
- **`nombre`** (10 oct 2026): el nombre de la sesión (sin la duración estimada) cuando se arrancó. Sirve para que el coach reconozca la sesión en sus métricas sin reconstruir el plan.
- **`hechos[clave]`**: el paso se hizo en `t`. `n` es el nombre del ejercicio en ese momento: si el coach cambió ese lugar por otro ejercicio, la marca vieja ya no cuenta. `reps`/`kg`/`seg` solo viajan si el atleta **cambió** lo planeado (`kg` siempre en kilos). `tecnica` queda reservada: el id del video que el atleta grabó de esa vuelta (ver `src/lib/funciones.js`).
- **`oculto`**: ya NO se escribe (23 oct 2026: se quitó la ✕ junto al botón del entreno). Los registros viejos que lo traen se ignoran: la sesión vuelve a ofrecer «Continuar». Un reloj puede ignorarlo.
- **`registro.ruta`** (fuera de `entreno`, en la sesión): `{ lat: [], lon: [] }`, el recorrido del entreno guiado (máximo ~300 puntos) si la persona dijo que sí a «¿Guardamos tu recorrido?» (se pregunta una vez por teléfono, `tl:recorrido`). Se escribe al salir o al terminar; la activity card lo ofrece como el sello «Con tu recorrido». Completo, sin recortar (decisión de Andrés, 23 oct 2026). Ver `lib/recorrido.js` y `features/training/useRecorrido.js`.
- **Paso con GPS**: un ejercicio que termina por distancia de 200 m o más se corre con mapa (`PasoConGps`); al llegar a la meta se marca hecho con `reps` = lo medido (en la unidad del paso) y `seg` = lo que tardó. «Sin GPS» se recuerda por ejercicio en el teléfono (`tl:sin-gps`).
- **La pantalla del paso con GPS** (`PasoConGps`, 23 oct 2026) es la captura «Cardio» de la reestructura visual, NO la oscura del registro libre (esa es de quien entra gratis a registrar): tarjeta del COLOR del tipo de sesión con «Vuelta 3 de 10 · 400 m a 4:30 min/km» y «Te faltan N m», medidor del ritmo contra el que pidió el coach (`ritmoObjetivo`/`estadoDeRitmo` de `lib/recorrido.js`; sin ritmo pedido, solo el número), mapita, distancia/tiempo (y pulso si hay reloj), «Siguiente: …», «Pausar» (congela tiempo y medición) y «Próxima vuelta». Ocupa el lugar del paso (con la barra «Workout» arriba); en un lapso del reloj va en una capa propia.
- **Que la app guíe** (23 oct 2026): la app avanza sola cuando PUEDE saber que algo terminó; la persona toca solo lo que únicamente ella sabe.
  - Sprint (`PasoConGps`): si se llegó avanzando (`llegando`), sale solo con el 3, 2, 1 en cuanto el GPS está listo (`arrancaSolo`); al llegar a la meta se ve el resultado 4 s y pasa solo al descanso (`sigueSolo`; «Seguir» lo adelanta, «Cambiar el resultado» lo detiene).
  - Lapsos por distancia de 200 m o más (`tramo.metros`, de `metrosDeLapso`): el reloj abre el mismo mapa encima (`gpsDelLapso` en `RelojDelBloque`), sin 3, 2, 1 propio (`sinCuenta`: ya lo dio el descanso o el reloj) y pasa al instante al llegar (`segResultado={0}`: quien corre kilómetros seguidos no puede esperar). El tiempo del lapso es el del GPS (`listoConTiempo`). Sin permiso o sin señal: «Seguir sin mapa» / «Lapso listo» a mano. «Sin GPS» se comparte con el sprint por nombre de ejercicio.
  - Al acabar un reloj, si ya sabe el resultado entero lo guarda y cierra solo a los 1.6 s: formato que anota `nada` (intervalos, personalizado) y lapsos completados (`cumplido` con `motivo === 'completo'`). Lo que solo la persona sabe (rondas de un AMRAP, cuántos intervalos de un EMOM salieron, lapsos parados a mano) sigue preguntando.
- **`inicio`** se sella con el PRIMER «Listo» (o «Saltar»), no al abrir el entreno: abrir y cerrar sin hacer nada deja la sesión «sin empezar». Cada sesión del día (mañana y tarde, o las de un equipo) tiene su propio avance.
- **Los botones de la sesión** (29 oct 2026, prototipo de caminos, grupo «La sesión del día»; `features/training/BotonDelEntreno.jsx`, `useBotonesDeLaSesion`): un botón grande por estado, arriba de la lista de ejercicios. Sin empezar, «Iniciar entreno»; en curso, «Continuar · 14:32 · 3 de 16» (el mismo azul); hecha, la pastilla «✓ Hecha · 8:55 a. m.» y «Ver tu entreno» (abre la página del entreno). «Marcar como hecha» va gris debajo de la lista, solo sin empezar, para quien entrena sin la app (`terminaSesion`): no abre la página ni celebra. Ya no hay a la vista «Sesión terminada», «Stickers», «Deshacer» ni «Marcar sesión como terminada»: nada que se pueda tocar por error.
- **El «···» de la sesión** (en el encabezado de la tarjeta, o junto a la pastilla si no hay tarjeta; solo en curso o hecha) lleva lo que borra o reinicia y solo pregunta lo que borra. En curso: «Terminar ahora» (sin preguntar, abre la página con su celebración) y «Empezar de nuevo» (pregunta; deja la sesión en blanco sin guardarla en `anteriores`: nunca se terminó). Hecha: «Ver tu entreno», «Hacerla otra vez» (sin preguntar; lo hecho pasa a `anteriores` y abre el entreno guiado de una vez) y «Marcar como no hecha» (pregunta; lo hecho pasa a `anteriores` y sigue en «Tus entrenos»). **Dejar una sesión EN BLANCO** (`sesionEnBlanco`, antes «Deshacer», 23 oct 2026): el entreno, lo anotado de cada ejercicio (`exercises`), los resultados de los relojes (`formatos`) y el recorrido (`ruta`) pasan a `anteriores` (ver `archivaLoHecho`) y se quitan de la sesión; las notas se quedan. Así, al volver a hacerla, cada reloj corre otra vez.
- **El final del entreno guiado** (29 oct 2026): ya no hay pantalla «Entrenamiento terminado» con «Terminar sesión». En el ÚLTIMO paso que queda (`esElUltimoPaso`: el único sin marca, contando los opcionales; un descanso nunca lo es) «Listo» se vuelve «Mantén para terminar» (`BotonDeMantener`: una barra azul se llena en 900 ms; soltar antes no hace nada y un toque corto avisa «Mantén presionado para terminar.»). Al llenarse marca ese paso y termina (`terminarSesion`): guarda, cierra y abre la página del workout con `recien`. «Ver todo» trae «Terminar ahora» para cerrar con pasos pendientes. Si ya no queda ningún paso y la sesión no está terminada (datos viejos, o lo último fue «Saltar» el último paso, «Anotar resultados» o el resultado de un reloj), se termina sola. La carrera y el cronómetro del registro libre también terminan manteniendo el botón.
- **Un descanso** (`d.<clave>`) guarda `t` (cuándo terminó) y, si tenía cuenta, `p` (lo que se planeó, en segundos): junto con el `t` del paso anterior dice cuánto descansó de verdad. Un descanso que se cerró solo porque el atleta hizo un paso de adelante no lleva `p` (no se tomó).
- **`saltados`**: igual, pero el paso se saltó. Sigue pendiente en la lista.
- **`extra[clave]`**: segundos que se le sumaron a un descanso («+30 s»). **`empezados[clave]`**: cuándo se arrancó el cronómetro *opcional* de un paso con tiempo.
- **El paso actual = el primer paso de la lista sin marca.** No se guarda. Un descanso empieza cuando se marcó el paso anterior. Nada avanza solo.
- **Son objetos por llave, nunca listas**, a propósito: la base mezcla los objetos llave por llave a cualquier profundidad y *reemplaza* las listas enteras (ver `src/lib/estadoPorPartes.js`).

### Lo que deja un Set con reloj (`sesión.formatos[<idx>]`, 10 oct 2026)

Además del resultado de siempre (`anota`, `valor`, `extra`, `seg`, `tramos`, `de`, `en`), el reloj de un Set deja la **huella de cada tramo hecho**, en el mismo orden que `tramos`:

- **`ventanas`**: `[[empezó, terminó], …]` en milisegundos de época. Cada «Listo» cierra una y abre la siguiente; con la pantalla dormida cada ventana termina donde empieza la siguiente (no donde llegó el aviso). Una pausa dentro de un tramo no mueve su hora de arranque. El tramo que cortó el tope o el «Terminar» no tiene ventana (no se completó).
- **`lapsos`**: `[{ tipo: 'trabajo'|'descanso', plan, etiqueta, texto, vuelta }]`: qué era cada tramo (`plan` = segundos planeados o `null` si espera «Listo»; `texto` = lo que pedía, como «400 m»).

Con eso, y con el pulso del reloj de pulsera para esas horas, el coach ve «Por lapso» (`lib/metricas/porSerie.js`). Un reloj guardado antes de este cambio no trae ventanas: se acepta y simplemente no se corta por lapso. Pruebas: `scripts/prueba-formatos.mjs` y `scripts/prueba-entreno.mjs`.

### Cómo se escribe

La app no manda el estado entero: manda un **parche** con solo lo que cambió, a la función `mezclar_mi_estado` (`supabase.rpc('mezclar_mi_estado', { p_usuario, p_cambios })`). Borrar una llave se dice con `{"__borrar": true}`, no con `null`. Un «Listo» desde un reloj es, por ejemplo:

```json
{ "wr:sessions": { "<sesionId>": { "entreno": { "hechos": { "0.2.0": { "t": 1791560120000, "n": "Back Squat" } } } } } }
```

La llave de arriba es `wr:sessions` (con `@<programa>` detrás si el atleta tiene equipo: ver `claveDe` en `PlanContext`) y `sesionId` es `<fase>-w<semana>-d<día>` (ver `sessionId` en `training-utils.js` y `useIdDeSesion`). Dos dispositivos que marquen pasos distintos se juntan solos; si marcan el mismo, gana la última escritura de esa llave.

Para que el progreso de siempre (peso, repeticiones, récords, la IA) siga funcionando, la web además escribe en `exercises[idx]` al dar «Listo» (ver `exDataTrasListo` en `src/lib/entrenoDatos.js`). Una app nativa que quiera lo mismo debe hacer lo mismo; si solo marca pasos, el entreno avanza pero el historial de pesos no.

## 3. Las claves de los pasos

| Paso | Clave | Ejemplo |
|---|---|---|
| Ejercicio | `<idx>.<vuelta>.<lapso>` | `0.3.0` = ejercicio en la posición 0 de la lista del día, vuelta 3 (el lapso es siempre 0: un ejercicio con varios lapsos es un Set con reloj) |
| Set con reloj (AMRAP, EMOM… o varios lapsos) | `r.<idx>` | `r.2` |
| Nota (día de puras notas) | `n.<idx>` | `n.1` |
| Descanso | `d.<clave del paso anterior>` | `d.0.1.0` |

`idx` es la posición del ejercicio en `day.exercises`: la misma con la que la app ya guarda lo que anota el atleta. Insertar un ejercicio a media lista corre las posiciones; la marca lleva `n` para no confundirse, pero el progreso de lo recorrido se pierde. Es una limitación heredada de cómo se guarda desde siempre.

## 4. El entreno en el idioma de los relojes

`aEntrenoCanonico(plan, { nombre })` devuelve `{ v, nombre, deporte, pasos, grupos }`. Ejemplo (Back Squat ×5 al 78 % con 150 s de descanso, y una plancha ×2):

```json
{
  "v": 1, "nombre": "Lower Strength", "deporte": "fuerza",
  "pasos": [
    { "clave": "0.1.0",   "tipo": "trabajo",      "nombre": "Back Squat", "termina": { "por": "reps",   "valor": 5   },
      "meta": { "tipo": "porcentaje1RM", "min": 78, "max": 78 }, "opcional": false, "serie": 1, "vuelta": 1, "vueltas": 5 },
    { "clave": "d.0.1.0", "tipo": "recuperacion", "nombre": "Descanso",   "termina": { "por": "tiempo", "valor": 150 }, "meta": null, "opcional": false },
    "…",
    { "clave": "1.2.0",   "tipo": "trabajo",      "nombre": "Plancha lateral", "termina": { "por": "tiempo", "valor": 30 }, "meta": null,
      "opcional": false, "porLado": true, "serie": 2, "vuelta": 2, "vueltas": 2 }
  ],
  "grupos": [ { "serie": 1, "repeticiones": 5, "opcionales": 0, "desde": 0, "hasta": 8 }, { "serie": 2, "repeticiones": 2, "opcionales": 0, "desde": 10, "hasta": 11 } ]
}
```

- **`termina.por`**: `reps` · `tiempo` (segundos) · `distancia` (metros; km y yardas ya convertidos) · `calorias` · `boton` (termina cuando el atleta lo dice).
- **`meta.tipo`**: `porcentaje1RM` · `peso` (kg) · `intensidad` (%) · `rpe` · `rir` · `ritmoPorKm` (segundos por km) · `zonaFC` · `potencia` (W) · `ritmoNadoPor100m` (segundos) · `texto` (lo que no encaja, tal cual lo escribió el coach). Los kilos que salen de «78 %» dependen del 1RM del atleta y **no** viajan aquí.
- **`tipo`**: `trabajo` · `recuperacion` · `nota`. Reservados: `calentamiento` y `enfriamiento` (hoy el editor no los marca).
- **Un reloj de formato** (AMRAP, EMOM, Tabata, intervalos…) sale ya **expandido en sus tramos con tiempo** (`clave` = `r.2#0`, `r.2#1`…, y `desde` = `r.2`); un reloj solo entiende pasos con tiempo.
- **Un Set en lapsos personalizados** con más de un tramo de trabajo (varios lapsos o varias rondas) es, para el atleta, UN paso con reloj (`r.<idx>`: una sola puerta de inicio), pero para un reloj de pulsera es la sucesión de sus lapsos: sale **abierto en sus pasos de trabajo y descanso, con su distancia, su ritmo y su zona** (`clave` = `r.0#0.1.0`, `r.0#d.0.1.1`…, y `desde` = `r.0`). Con un solo lapso y una sola ronda no lleva reloj: es un ejercicio más.
- **`grupos`**: pista para plegar repeticiones. El Set de la `serie` 1 se repite 5 veces y ocupa los pasos 0 a 8 (incluidos los descansos *entre* vueltas); el descanso de *después* del Set (índice 9) queda fuera. Con vueltas opcionales («5-6 veces») `opcionales` las cuenta y van al final. Un adaptador que no pliega usa la lista plana.
- **`deporte`**: `fuerza`, `velocidad`, `correr`, `bici`, `natacion`, `yoga`, `movilidad`, `recuperacion`, `futbol`, `pruebas`, `equipo`, `terapia`, `clase`, o `null` en un tipo propio del coach (habría que preguntar una vez «¿qué mide el reloj?»).

La lista plana es el **mapa de regreso**: el paso *i* que ejecutó el reloj es `pasos[i]`, y su `clave` (o `desde`) es lo que se marca en `hechos`.

## 5. Mapeo a cada plataforma (de la investigación del 9 oct 2026; verificar al integrar)

**Apple Watch.** Necesita una app **nativa** de iOS (con Capacitor sería un plugin en Swift). WorkoutKit (iOS 17 / watchOS 10): un `CustomWorkout` con calentamiento, `IntervalBlock`s (con iteraciones fijas) y enfriamiento; cada `IntervalStep` es `.work` o `.recovery` con una meta (`.time`, `.distance`, `.energy` o `.open`) y **una** alerta (ritmo, velocidad, zona o rango de pulso, potencia, cadencia). `trabajo` → `.work`, `recuperacion` → `.recovery`; `grupos` → `IntervalBlock`; `ritmoPorKm`/`zonaFC`/`potencia` → la alerta del paso. WorkoutKit **no tiene metas por repeticiones**: un paso `termina.por = reps` se manda como `.open` y su nombre dice «5 reps». El entreno se agenda en la app Entrenamiento del reloj (ventana de ±7 días) y los resultados vuelven por HealthKit (pulso, distancia, ritmo; no los segmentos de intervalo).

**Garmin.** La vía oficial es la *Training API* del Connect Developer Program, pero **las solicitudes nuevas están pausadas** (2026). Alternativa: una app Connect IQ propia, que baja el entreno de nuestro servidor y guía con pulso/ritmo en vivo. El formato es un archivo FIT: cada paso es un `workout_step` con `duration_type` (`time`, `distance`, `calories`, `open`, `repeat_until_steps_cmplt`), `target_type` (`speed`, `heart_rate`, `power`, `open`) e `intensity` (`warmup`, `active`, `rest`, `cooldown`). `grupos` → pasos de repetición. Garmin limita los pasos de un entreno (verificar el tope vigente): ahí conviene plegar con `grupos`.

**COROS, Polar, Suunto, Wahoo.** Entran por sus programas de socios o por TrainingPeaks como puente (de pago); con este formato cada uno es un adaptador chico más una solicitud.

## 6. Cómo arranca un reloj (para quien guíe desde otro dispositivo)

**Un solo «empezar» por intención.** Andrés (9 oct 2026): «si ya le piqué a iniciar entrenamiento y se supone que tú me guías, ¿por qué no inicias el reloj?». La regla, que cualquier app o reloj que guíe debe repetir:

- Cuando la persona **avanza** (iniciar o continuar el entreno, «Listo», «Seguir», «Saltar») y el paso al que llega es un **reloj**, el reloj corre solo, con una cuenta de 3 segundos que se puede cancelar. Nadie empieza a correr en el mismo instante en que toca un botón.
- Cuando la persona **vuelve** a un paso (atrás, «Ver todo») o **cancela** la cuenta, nada arranca; tampoco al recargar la app (el entreno guiado solo se abre con su botón): ve el Set con su botón «Empezar» (o «Seguir», si el reloj iba a medias).
- Un reloj que ya tiene resultado no arranca solo.
- **Un descanso que llega a cero termina solo**: avisa y se pasa al paso que sigue (un instante después, para que se oiga el aviso). «Seguir» lo adelanta y «+30 s» lo alarga antes de que acabe; ya no cuenta hacia arriba («+0:09»). Andrés (9 oct 2026): eso «podría perder el punto de que la app guíe en el entrenamiento y podría ser redundante con el botón de +30 s». Un descanso escrito con palabras («Recuperación total») no tiene cuenta y espera «Seguir». Un ejercicio, en cambio, siempre espera el «Listo» de la persona.
- **En el descanso se ve el video del ejercicio que sigue**, dentro de la tarjeta «Sigue» (la misma tarjeta de video de la pantalla del ejercicio). Andrés (10 oct 2026): «que mientras está el atleta en descanso pueda ver el video del ejercicio que sigue». Sin video (o si el paso que sigue es un Set con reloj), «Sigue» es la tarjeta de siempre, abajo junto a los botones.

## 7. Lo que NO está (a propósito)

- (Actualizado 27 oct 2026) La app de iPhone YA existe (TestFlight, ver `docs/app-iphone.md`) y trae el GPS del teléfono con pantalla bloqueada (`lib/nativo.js`) y el mapa de Apple (`MapaNativo.jsx`). Este documento y `entrenoCanonico.js` siguen siendo la base de los pasos; el adaptador del reloj es la app TrainingLabWatch.
- **El GPS en la web** solo mide con la pantalla encendida (el navegador no da ubicación en segundo plano); la carrera con pantalla bloqueada es de la app. Desde el 27 oct 2026: un punto por segundo, el ritmo de ahora sale de la velocidad del GPS (mediana de 10 s), el temblor de alguien parado no suma metros, y en una pausa el GPS sigue encendido (se ignoran los puntos) para no perder segundos al reanudar.
- **Parado no suma metros (30 oct 2026, `agregaPunto` en `lib/ubicacion.js`).** Bajo techo el GPS deriva despacio y salta varios metros al cambiar de satélite; antes un solo punto que se alejaba más que su error sumaba el salto entero (simulado: 200 m en 10 minutos quieto en un cuarto). Ahora moverse se decide con una ventana:
  - El **ancla** es el último lugar firme. Parado, cada punto entra en el lugar del ancla (`q: 1`, cero metros) con su lugar real en `r`.
  - **Señales de moverse**: con la velocidad del iPhone, que la dé (≥ 0.5 m/s) y que el punto de verdad se haya desplazado eso desde el anterior (la velocidad con ruido de alguien quieto no basta, ni un salto de un segundo); sin ella, la distancia de los últimos 5 s (≥ 1 m/s) y ese mismo paso.
  - **Saliendo de parado**, un punto es candidato (`c: 1`) si hay señales de moverse y se salió del radio del ancla (`max(su error, error del ancla)`) o el iPhone dice que va a más de 1 m/s. Se acepta con 3 candidatos seguidos (3 s); con 2 si ya está fuera del radio y va a más de 1 m/s (correr no espera 3 s). Al aceptar, los candidatos vuelven a su lugar real (no se pierde el arranque) y el punto nuevo es el ancla.
  - **Ya en movimiento**, cada punto con señales de moverse cuenta, segundo a segundo (la cámara y el punto del mapa no avanzan a saltos); el primero sin ellas lo deja parado.
  - La ruta que se guarda solo lleva `t`, `lat` y `lon` (`q`, `r`, `c` y `vq` viven solo mientras corre). Prueba: `scripts/prueba-ruta.mjs` (quieto 10 min con deriva, sin velocidad / con 0 / con ruido de 0.3 a 1.4 m/s: menos de 10 m en cinco sorteos; caminando, la distancia arranca en 3 s con el iPhone y 8 s en la web).
- **La pausa automática: a pie con el rebote del cuerpo, sobre ruedas con el GPS (3 nov 2026; spec `docs/superpowers/specs/2026-11-03-pausa-automatica-rebote.md`).** Historia: el 2 nov, parado en la calle entre edificios, la carrera sumó 50 m en 87 s (el iPhone daba ~0.9 m/s quieto y la posición brincaba con esa velocidad) y se agregó el sensor de movimiento. El 3 nov (builds 79-80) el podómetro y la actividad decidían y daban pausas en falso (el podómetro avisa cuando quiere) o tardaban hasta 17 s (con error alto se descartaban las lecturas). Ahora:
  - **Las familias** (`desplazamiento`, `desplazamientoDe` en `lib/actividades.js`): toda actividad con mapa es `pie` (correr, caminar, senderismo, trail) o `ruedas` (bici, patines, surf, remo, kayak). Una propia lo dice al crearla («¿Cómo te mueves?»); una vieja, al iniciarla la primera vez (`HojaComoTeMueves`); se cambia en «Creadas por ti». El cronómetro guarda la familia (`desplazamiento`; uno viejo, la de su deporte, `familiaDelDeporte`). Sin mapa no hay pausa automática.
  - **El sensor.** `MovimientoPlugin.swift` (registrado en `MainViewController.swift` y en `ios/ci/agrega_extensiones.rb`) enciende `CMMotionActivityManager`, `CMPedometer` y, desde el 3 nov, `CMMotionManager.deviceMotion` a 20 Hz. Cada segundo manda un aviso `rebote` con la desviación estándar de la magnitud de `userAcceleration` (g, sin la gravedad) de ese segundo; el rebote no pide permiso. `estado()`/`inicia()` dicen `hayRebote`. Swift no decide nada. El permiso de movimiento (`NSMotionUsageDescription`: «Para saber cuándo te detienes y no sumar metros de más») lo pide iOS en la primera carrera.
  - **Las señales** (`senales`, `lib/sensorDeMovimiento.js`): `rebota` (el último aviso ≥ `REBOTE_MINIMO` y de hace menos de 2 s), `sinRebote` (segundos seguidos por debajo; cada aviso cuenta el segundo de antes), `reboteVivo` (llegó un aviso en los últimos 2.5 s; si no, como sin acelerómetro) y `enBici` (la actividad dice «en bici»). **`REBOTE_MINIMO` = 0.12 g**, un punto de partida: se ajusta con las trazas reales. El podómetro y la cadencia ya no deciden (se siguen guardando en la traza).
  - **A pie, con acelerómetro** (`decideMarcha` en `lib/entrenoLibre.js`): pausa con 1.5 s seguidos sin rebote (el GPS no participa). Reanuda con rebote ≥ 1 s Y avance real del GPS (la mediana de los pasos de cada segundo de los puntos con error ≤ 20 m de los últimos 5 s ≥ 0.6 m/s, `AVANCE_A_PIE`; hasta el 5 nov era 1.2 y caminar lento no se reanudaba): mover el teléfono con las manos da rebote pero no avance. Sin GPS bueno (ningún punto con error ≤ 20 m en 10 s, un túnel): reanuda con 3 s seguidos de rebote. Perder la señal nunca pausa. **Los metros:** sin rebote el punto entra parado (`agregaPunto` con `quieto`) aunque todavía no se haya pausado; con rebote y avance, `mueve`; si no, las reglas del GPS. Ojo (5 nov, medido con trazas sintéticas): parado entre edificios con error de 15-20 m y el GPS «caminando» a ~0.9 m/s, mover el teléfono con las manos reanuda en falso al segundo de rebote (la barra de 0.6 deja pasar ese avance falso) y suma metros mientras dura; con error de 25 m reanuda a los 3 s de rebote por la regla sin GPS bueno, sin sumar metros.
  - **Sobre ruedas o en el agua** (y a pie sin acelerómetro, la web): velocidad = desplazamiento de los últimos 5 s entre el tiempo, con los puntos de error ≤ 30 m (con mucho error también cuentan). Ruedas: pausa con < 1.0 m/s 3 s seguidos si la actividad no dice «en bici»; reanuda con > 2.0 m/s 2 s seguidos. A pie sin acelerómetro: < 0.6 y > 1.0. Sin puntos en 5 s no decide nada. El rebote no se usa. **Bici y patines (5 nov 2026)**: con lectura buena (error ≤ 20 m) cuenta la velocidad del iPhone: pausa con < 1.5 m/s (`VELOCIDAD_PARA_PAUSAR_SOBRE_RUEDAS`) 2 s seguidos si la actividad no dice «en bici» (parado, el iPhone inventa ~0.9 m/s y queda abajo); reanuda con > 2.0 m/s 2 s seguidos, con la velocidad del iPhone o con el desplazamiento de 5 s. Con error > 20 m, el desplazamiento de 5 s y 3 s, como antes. Surf, remo, kayak y las propias sobre ruedas o en el agua, igual que antes (`pausaConVelocidad` decide por el id de la actividad; la traza lo guarda en `actividad`). «N s seguidos» (`racha`): de la primera a la última lectura que cumplen, sin huecos de más de 2 s, pasan N s o más; con una lectura por segundo, 2 s son tres lecturas seguidas. El veto «en bici» retrasa la pausa lo que el sensor tarde en dejar de decirlo: si lo dice 5 s después de parar, pausa a los 5.4 s; 10 s, a los 10.4 s.
  - **Para las dos** (`decidePausaAutomatica(estado, marcha, ahora, { reanudadoEnS, pausadoEnS })`): después de reanudar (sola o a mano), 8 s sin poder pausar; después de una pausa automática, 3 s sin poder reanudar. La pausa cuenta desde que se detuvo (nunca antes de arrancar o reanudar). El interruptor «Pausa automática» manda: apagado no corre nada de esto (tampoco «sin rebote no suma»; la ruta queda con las reglas del GPS).
  - **En la ruta** (`agregaPunto(muestras, punto, t, sensor)`): `quieto` → el punto entra parado (`q: 1`) diga lo que diga el GPS. Saliendo de parado con `mueve` basta una señal del GPS (señales de moverse o fuera del radio); con `null`, la ventana de 3 candidatos de siempre. Parado guarda `vel: 0` (la del iPhone en `vq`): el ritmo de ahora dice «parado».
  - **Reglas del GPS más estrictas** (la ruta, siempre): con error de más de 12 m la velocidad del iPhone no cuenta (se usa la distancia de los últimos 5 s, ≥ 1 m/s) y salir de parado sin sensor pide además alejarse 5 m más allá del radio del ancla.
  - **Un solo camino** (`lib/pasoDeCarrera.js`): lo que hace la carrera con cada punto (pausa automática y luego la ruta) y con cada aviso de rebote (solo la pausa, sin esperar al GPS). Lo usan `useCronometroLibre` y la prueba que reproduce trazas, así que hacen exactamente lo mismo.
  - **La traza del GPS** (`lib/trazaGps.js`, formato `traza-gps/3`). Solo cuentas de prueba (las de `cuentas_de_prueba`, `soy_cuenta_de_prueba`) y el dueño: «Guardar traza del GPS» en Ajustes de la carrera. Se anota cada punto, cada aviso del sensor tal como llegó (también `rebote`, con `valor`) y cada cambio de marcha (`marcha`, `{ a: 'quieto' | 'en-marcha', motivo: 'sin-rebote' | 'rebote+avance' | 'sin-gps' | 'gps-lento' | 'gps-rapido' }`), con la familia de la carrera; en el teléfono (`localStorage`, solo la última, hasta 3 h; nunca se sube). Las `/1` y `/2` se siguen leyendo (sin rebote: reglas del GPS). «Exportar la última traza» la entrega con `entregaArchivo`. Se pone en `scripts/trazas/`; `prueba-ruta.mjs` reproduce todas y dice, parada por parada, los segundos para pausar y reanudar, las pausas en falso y el rebote parado y en marcha (p10/p50/p90, para ajustar `REBOTE_MINIMO`). Las paradas de verdad salen de `paradas` (se pueden escribir a mano en el archivo: `[[desde, hasta], …]` en segundos) o, sin ellas, del GPS mirando hacia adelante (`paradasDe`). Exige: `quieto-*.json` menos de 5 m y la pausa en menos de 10 s; `corriendo-*.json` ninguna pausa; y lo que diga su `esperado`. Las sintéticas las escribe `scripts/trazas-sinteticas.mjs`.
  - **Prueba** (`scripts/prueba-ruta.mjs`, las 8 trazas de B6 en `scripts/trazas/`, contra el código de 6aae0a0). 1, corriendo con el podómetro callado 9 s y una lectura a 0.3 m/s: antes pausaba en falso a los 45.4 s; ahora no. 2, girar el teléfono 5 veces corriendo: ni antes ni ahora pausa. 3, parar de golpe con el GPS a 25 m inventando 0.9 m/s: antes pausaba a los 15.4 s; ahora a los 2 s. 4, parado moviendo el teléfono: antes se reanudaba (a los 24.4 s) y volvía a pausar; ahora sigue en pausa. 5, volver a correr: antes reanudaba a los 3.4 s; ahora a los 1.4 s. 6, túnel corriendo 15 s: ni antes ni ahora pausa. 7, bici en el semáforo entre edificios: antes nunca pausaba; ahora pausa a los 7.4 s (el contrato pide ≤ 4 s: con un promedio de 5 s y 3 s seguidos no se alcanza; queda `pendiente` en la traza) y reanuda a los 2.4 s. 8, bici con una lectura mala: ni antes ni ahora pausa. Bici con la velocidad del iPhone (5 nov, contra 9f65c30): para de golpe a 6 m/s con el iPhone en 0.9 m/s, antes 7.4 s, ahora 2.4 s; una lectura a 0.5 m/s, no pausa; dos lecturas a 1.2 m/s (1 s), no pausa; parada con el iPhone brincando entre 0.5 y 1.4 m/s, antes 7.4 s, ahora 2.4 s y no se reanuda. El 7 sigue en 7.4 s porque, parada, todas sus lecturas traen error de 25 m. Quieto 3 min en la calle (cinco sorteos): 0 m y la pausa a los 2 s; sin acelerómetro (la web) 0-66 m, porque la pausa a pie espera < 0.6 m/s de desplazamiento y el GPS «camina» a ~0.9. Caminar después de 20 s quieto: la distancia arranca a los 2.4 s y da 203 m. Correr parejo: lo mismo con y sin sensor, sin pausas. Caminar lento (5 nov): a 1.0 m/s después de una parada, antes nunca reanudaba; ahora a los 2.4 s.
- **El mapa gira con una sola mano (30 oct 2026).** La brújula del iPhone gira el mapa (`setHeadingFollow`, parche del plugin). Con cada punto la página mandaba también su rumbo atrasado (`followCamera({ heading })`) y en el carro el mapa regresaba 2-3° y volvía a avanzar. Ahora, si la brújula sigue al mapa, el parche ignora el `heading` de la página y la página ya no lo manda (`giraConBrujula` en `MapaNativo.jsx`); solo lo manda con «norte arriba», en los mapas sin brújula y en el respaldo sin parche. Yendo a más de 2 m/s gira el rumbo del GPS (`course`) y la brújula se calla, como Apple Maps al manejar; el cambio entre los dos se suaviza con el mismo 0.4 por lectura de la brújula. Si iOS marca la brújula como no confiable (`headingAccuracy < 0`), sus lecturas se siguen descartando; en el carro el rumbo del GPS cubre ese hueco.
- Lo que el sensor mide de vuelta (pulso, ruta, ritmo por vuelta) no tiene dónde guardarse todavía. Cuando haya app nativa: probablemente `entreno.sensor` por paso, con la misma regla de objetos por llave.
- «Grabar técnica para el coach» está apagado (`src/lib/funciones.js`); hoy solo existe su botón con «Pronto» y el campo `tecnica`.

## 8. Cómo probarlo

```
node scripts/prueba-entreno.mjs            # los pasos y el avance, con horas inventadas
node scripts/prueba-entreno-datos.mjs      # lo que se dice de un paso y el registro de siempre
node scripts/prueba-entreno-canonico.mjs   # el idioma de los relojes
```

## 9. Conectar Salud y el Apple Watch al crear la cuenta (1 nov 2026; antes, 30 oct)

Son **dos pasos** del inicio (`src/features/inicio/Inicio.jsx`), en la app del iPhone, para todos los atletas, tengan o no Apple Watch. Detalle y textos en `docs/inicio.md`.

- **`reloj` = «Conecta Apple Salud»** (`CuerpoDeSalud`): igual para todos, solo habla de Salud (qué entra y qué sale). «Conectar Apple Salud» abre `ConectaReloj` con `empezar="pedir"` y `enInicio`; «Ahora no» pasa al siguiente paso sin pedir nada. Fuera del inicio (Home, Mi perfil → Dispositivos, `ConectaRelojGlobal`; «Empieza aquí» se quitó el 2 nov 2026) se sigue usando `CuerpoDeConectar` («Conecta tu Apple Watch» / «Conecta Apple Salud» con su tarjeta oscura) y sus pantallas «Listo» y «Falta un paso».
- **«Conectando Apple Salud…»** (`ConectandoSalud.jsx`): barra y cuatro renglones. Regla: **nada avanza por tiempo**, cada renglón se marca cuando termina su llamada real (`pideSalud`; `revisaPermiso` + `conectaEnLaCuenta`; `traeLoDeAntes` con su `alAvance({ fase, hechos, total })`; la recuperación + `guardaPrevias`). Las únicas esperas: 8 s para «Continuar» y 1.5 s de la pantalla verde. `traeLoDeAntes` devuelve `{ estado: 'ya' | 'nada' | 'listo' | 'fallo', entrenos, dias }`, nunca rechaza, y solo hay una lectura a la vez (si `SincronizaReloj` ya la arrancó, quien llegue después se cuelga de esa). Lo de antes sigue siendo solo para las cuentas: va a `actividades_previas` y `recuperacion_previa` y ninguna pantalla lo enseña.
- **Fuera del inicio** «Conectando» ya no dibuja un reloj cuando no hay reloj emparejado: sin reloj sale el corazón de Salud (`RelojDibujado modo="sync"` solo con reloj).
- **`tu-reloj` = «Tu Apple Watch»** (`TuReloj.jsx`, solo en la app del iPhone): a) sin reloj, b) con reloj sin conectar Salud (desde aquí se puede conectar), c) con reloj y la app, Salud conectada, d) con reloj sin la app: pasos para instalarla. El modo de prueba de los administradores cuenta como app instalada, así que da b y c; el caso d solo sale con un reloj emparejado de verdad sin la app (o en la página de prueba con `reloj=sinapp`).
- **Bienvenida:** pastilla «Apple Salud conectada» si conectó, y «Apple Watch listo» solo si además hay reloj con la app. Ya no existe «Apple Watch conectado».
- **En la web:** `AvisoDelReloj`, solo cuenta, con «Continuar»; `tu-reloj` no existe.

Prueba en el navegador: `qa-reloj.html?vista=inicio&reloj=no|si|sinapp` (ver `docs/inicio.md`, «Cómo probarlo»), o `qa-reloj.html?vista=puerta&reloj=si` con la App real y una sesión falsa.

## 10. El Apple Watch sin el iPhone (1 nov 2026, parte 3 del encargo «inicio, sin conexión y reloj»)

**La meta:** la persona deja el iPhone en el carro, entrena con el reloj y nada se pierde ni llega dos veces. Maqueta aprobada: https://claude.ai/artifact/WRoxF49VXm14MC7i8HgC86. La cola del teléfono que esto usa está en `docs/sin-conexion.md`, sección 10.

El reloj ya no es solo un control remoto. Tiene dos maneras de entrenar:

- **El iPhone guía y el reloj acompaña** (como antes): el iPhone manda lo que toca, el reloj mide el pulso, lo devuelve en vivo y deja tocar «Listo». Nuevo: al terminar, el reloj manda su pulso con `transferUserInfo` (modo `acompana`) y le llega al entreno del iPhone en segundos, sin esperar a Salud.
- **El reloj solo**: con el plan que le llegó, entrena una sesión del plan o un entreno libre. Toda la lógica corre en el reloj.

### 10.1 Del iPhone al reloj, antes de salir

- **Qué viaja** (`planParaElReloj` en `src/lib/relojSinTelefono.js` → `PlanDelReloj` en `PlanDelReloj.swift`): las sesiones de hoy y de los 2 días siguientes de TODOS sus programas (coach, fisio, comprado; con `entradasDeHoy`), cada una con su nombre, de quién es (`de`, `rol`), el color de su programa, sus minutos (solo si el nombre los trae) y sus pasos; cuáles ya se hicieron; «Tus actividades» (`tusActividades`, máximo 6); el catálogo para «Ver todas» (las propias primero, en «Tuyas»); la unidad de peso; el id de la cuenta; y si dijo que sí a «¿Guardamos tu recorrido?».
- **Los pasos son los mismos de `pasosDeLaSesion`**, con sus claves (`0.1.0`, `d.0.1.0`, `r.2`, `n.1`), en llaves cortas: serie y vuelta, reps planeadas (texto y número), kilos del plan (de su 1RM o fijos, con la misma regla que `kilosDe` de `EntrenoDelDia`; en libras se ven en libras redondeadas a 5 y se guardan en kilos), si lleva peso, «por lado», segundos de cada descanso, metros de un paso por distancia. Una sesión con más de 150 pasos (o sin pasos: una clase) viaja sin pasos y el reloj la corre como cronómetro.
- **Cuándo se manda** (`PlanAlReloj` en `src/features/reloj/RelojSinTelefono.jsx`, dentro de la app del atleta): al abrir la app y al volver a ella (aunque no haya cambiado: así el reloj sabe a qué hora llegó), y cada vez que cambia el plan, una sesión se termina o hay un entreno libre nuevo. Se arma un momento (1.5 s) después del último cambio, no en cada «Listo». Nunca el plan de un atleta que su coach está mirando, ni un demo workout.
- **Cómo:** por el contexto de WatchConnectivity (`updateApplicationContext`), que llega aunque el reloj esté dormido. El contexto del iPhone lleva el plan Y lo que toca en el entreno que guía el iPhone (`guiado`): `ReceptorDelReloj` los junta para que mandar uno no borre el otro.
- **El reloj lo guarda en disco** (`plan.json`). Como trae 3 días, si el iPhone no se abrió esta mañana, el plan de hoy ya llegó ayer. Debajo de cada sesión: «Llegó a las 7:02».
- **Tope:** el plan se queda bajo 48 KB (el contexto no promete más de ~64 KB): si no cabe, los días de después pierden sus pasos.

### 10.2 Las pantallas del reloj (`VistasDelReloj.swift`)

- **Inicio:** arriba las sesiones de hoy, cada una con su rayita de color, de quién es y sus minutos; las hechas apagadas con ✓. Una sola sesión: tarjeta con «Empezar». Cuatro o más: se ven 3 y «Ver todas». Abajo «Entreno libre»; sin plan o en día de descanso, en azul y grande.
- **Si el plan de hoy no está en el reloj:** «Tu plan de hoy no está en el reloj. Ábrelo en tu iPhone y vuelve aquí.» y «Entreno libre» debajo. Sin plan (o una cuenta de coach): solo «Entreno libre», sin ese aviso.
- **Detalle:** nombre, de quién, minutos, los ejercicios («4×8 por lado»), «Llegó a las…», «Atrás» y «Empezar» (u «Otra vez» si ya se hizo).
- **Una serie:** «2/3 · 5:12», la rayita de series, el ejercicio, «Serie 3 de 4», reps y peso (se tocan para cambiarlos con + y − o con la corona; «Hecho» los guarda), el pulso y «Listo». Un paso por distancia enseña los metros que lleva («320 de 800 m») y vibra al llegar.
- **Los controles** (deslizando a la derecha desde la serie): Pausa, Saltar ejercicio, Terminar y Volver. «Terminar» pregunta: «¿Terminar ahora? Hiciste N de M series. Se guarda lo que hiciste y {quien} lo ve así.» o, sin ninguna serie, «Aún no marcas ninguna serie, así que no se guarda nada.»
- **El descanso:** cuenta solo y vibra al acabar; «+15 s», «Saltar» y «Deshacer el último «Listo»». Un descanso escrito con palabras espera «Seguir».
- **Al terminar:** tiempo, series y pulso medio. «Guardado en tu reloj. Pasa a tu iPhone y a {quien} cuando estén cerca.» hasta que WatchConnectivity dice que llegó; entonces «Ya está en tu iPhone.»; y «{quien} ya lo ve.» solo cuando el iPhone avisa que ya subió. Nada de eso cambia por tiempo.
- **Entreno libre:** «Tus actividades» (4 sin scroll, con su color; «tuya» y «mapa») y «Ver todas» (el catálogo por grupos, con la corona). Las dos con «‹». Las actividades se crean solo en el iPhone. Con mapa: distancia, tiempo, ritmo y pulso con el GPS del reloj. Sin mapa: tiempo y pulso. Pausa y Terminar. Nadar: el reloj bloquea la pantalla contra el agua solo (`enableWaterLock`), en alberca de 25 m.

### 10.3 El entreno en el reloj (`EntrenoDelReloj.swift`, `MedidorDelReloj.swift`)

- **Las mismas reglas que `lib/entreno.js`:** el paso que toca es el primero sin marca; «Listo» da por hecho lo planeado y solo viaja lo que cambió (`reps`, `kg` en kilos); un descanso empieza con la marca anterior y termina a SU hora (aunque la pantalla estuviera apagada), con `p`; «+15 s» va a `extra`; «Deshacer» le quita la marca al último paso y a sus descansos (como `vuelveAtras`); «Saltar ejercicio» salta lo que falta de ese ejercicio (en una bi-serie, solo ese); la pausa congela el tiempo y alarga el descanso lo que duró.
- **En disco con cada serie** (`entreno.json`, entero, cada vez que cambia algo; el pulso cada 12 lecturas y la ruta cada 30 puntos). Si el reloj se apaga a mitad del entreno, no se pierde nada de lo ya marcado.
- **Volver al entreno:** mientras hay uno en curso, la app abre en él, no en el inicio (al bajar la muñeca o abrir otra app y volver). Si el reloj se reinició, watchOS abre la app (`handleActiveWorkoutRecovery`), se recupera el entreno de Salud (`recoverActiveWorkoutSession`) y sigue donde iba.
- **Salud:** `HKWorkoutSession` y `HKLiveWorkoutBuilder` (los de antes). Cada entreno que guarda lleva en sus metadatos la marca `TrainingLab` (`reloj` o `acompana`). El reloj pide además permiso de la ruta y la distancia la primera vez que lo necesita.
- **Con mapa:** GPS del reloj en precisión alta; la ruta va a Salud con `HKWorkoutRouteBuilder` (puntos con error de 50 m o menos) y al iPhone.
- **Sin mapa, la ubicación en silencio** (`docs/stickers.md`, 8b): precisión baja (~100 m) hasta que hay movimiento de verdad (se alejó más de 80 m, o va a 1.2 m/s o más); entonces alta; tras 3 min quieto, baja. Solo entran a la línea los puntos de 30 m de error o menos. Nunca se vuelve distancia ni ritmo (`sinNumerosDeLaRuta`) y no se guarda en Salud. Solo si dijo que sí a «¿Guardamos tu recorrido?»; nunca con menos de 30 % de batería ni en bajo consumo: ahí no se guarda y no hay línea.
- **La batería:** cada entreno del reloj mide la batería al empezar y al terminar y con qué ubicación iba, y eso se guarda con el entreno (`actividades.metricas.bateria_reloj = { inicio, fin, minutos, ubicacion }`). Para sacar cuánto gasta la ubicación en silencio: `select metricas->'bateria_reloj' from actividades where metricas ? 'bateria_reloj'` (entrenos con `silencio` contra entrenos con `no`, por hora).

### 10.4 Del reloj al iPhone

- **Cada entreno terminado se manda con `transferUserInfo`** (`{ id, resultado }`, el resultado en JSON: `ResultadoDelReloj`). Antes se guarda en disco del reloj (`por-mandar/`) y se borra cuando WatchConnectivity dice que llegó; si la app del reloj se cerró en medio, se manda otra vez al abrirse.
- **En el iPhone, `ReceptorDelReloj` lo guarda en disco al recibirlo**, aunque la web no corra (se activa en `AppDelegate`). Al abrir la app pasa a la cola de la parte 2 con su id y solo entonces se borra (ver `docs/sin-conexion.md`, sección 10).
- **Se ve igual que si se hubiera hecho en el iPhone** (`aplicaSesionDelReloj`, `preparaLibreDelReloj`): las series marcadas en su sesión del plan (`entreno`, `exercises[idx]` con `exDataTrasListo`, la ruta, `completed`), el entreno libre en «Tus entrenos» (aunque no haya señal), y el sticker. En Home, la marca **«Llegó de tu Apple Watch»** en «Tus entrenos» (`registro.delReloj` en una sesión; `metricas.llego_del_reloj` en una fila de `actividades`).
- **El pulso y la ruta de una sesión del plan** se guardan como la fila que Salud habría traído (`crudoDelReloj` → `guardaImportacion`, `origen = 'healthkit'`, con el id del reloj): así «Tu pulso», «Por serie» del coach y los stickers lo ven igual que antes.

### 10.5 Que nada llegue dos veces

- **La regla:** el reloj manda el UUID de su `HKWorkout` con el resultado, y es el id de todo lo que se guarda (cola, `actividades`, `delReloj`). Al traer de Salud (`leeSalud` y `leeLoDeAntes`) se salta todo entreno cuyo UUID ya llegó del reloj (`tl:reloj:llegados`) y todo el que guardó la app del reloj con su marca (`saltaLosDelReloj`: fuente `com.traininglabapp.app…` y metadato `TrainingLab`). Los de antes de esta versión no traen la marca y entran como siempre (el reloj de antes no mandaba nada).
- **Lo que ya hacía `guardaImportacion`** (revisado el 1 nov 2026): SÍ quitaba duplicados, pero por HORA, no por UUID. Busca lo que ya hay en `actividades` dos días antes y después y descarta un entreno que se encima en 70 % o más con uno guardado (`esElMismo`/`separaRepetidos`); a uno del iPhone sin pulso le pone el pulso del reloj (`pulso_de = 'apple_watch'`). Y la base no deja dos con la misma hora al segundo y la misma duración (`unique (atleta_id, origen_clave)`). Eso no bastaba: si Salud traía el entreno del reloj ANTES de que llegara su resultado, se guardaba como `healthkit` y luego el del reloj (otra hora de inicio al segundo, otra duración) entraba como otro. Por eso la marca y el UUID.
- `guardaImportacion` ahora acepta el id de la fila (`idDeLaBase`): repetir el mismo entreno del reloj no hace otro.

### 10.6 Reloj e iPhone al mismo tiempo

- **Empezó en el iPhone:** como antes, el reloj acompaña. Si el reloj ya tiene un entreno suyo, ignora el arranque del iPhone.
- **Empezó en el reloj y se acerca el iPhone:** el reloj sigue mandando. Publica en su contexto «tengo un entreno en curso»; el iPhone dice **«Entreno en curso en tu reloj»** (Home y el botón de la sesión, `EntrenoEnElReloj`) y no deja empezar otro (ni el entreno guiado ni uno libre). Se quita cuando el reloj termina (o si es de hace más de 8 horas: el reloj se apagó).
- **El plan cambia durante un entreno:** el reloj termina con la versión que tenía (los pasos viajan dentro del entreno); el plan nuevo se aplica a lo siguiente.
- **✓ en los dos sentidos:** lo hecho en el iPhone cambia el plan (`hecha`) y se le manda al reloj; lo hecho en el reloj sale con ✓ ahí de una vez y en el iPhone en cuanto llega.

### 10.7 Archivos

| Dónde | Qué |
|---|---|
| `ios/App/TrainingLabWatch/PlanDelReloj.swift` | Lo que viaja (plan y resultado) y el disco del reloj |
| `ios/App/TrainingLabWatch/EntrenoDelReloj.swift` | El entreno sin pantalla: pasos, marcas, descanso, deshacer, pausa |
| `ios/App/TrainingLabWatch/MedidorDelReloj.swift` | Salud, pulso, ubicación (GPS y en silencio) |
| `ios/App/TrainingLabWatch/ModeloDelEntreno.swift` | Todo junto: WatchConnectivity, el plan, empezar, terminar, mandar |
| `ios/App/TrainingLabWatch/VistasDelReloj.swift` | Las pantallas de la maqueta (`VistaDelEntreno.swift`: la de cuando guía el iPhone) |
| `ios/App/App/EntrenoWatchPlugin.swift` | `ReceptorDelReloj` (disco, contexto) y el plugin |
| `src/lib/relojSinTelefono.js` | Lo puro: el plan, leer el resultado, aplicarlo, que nada llegue dos veces |
| `src/lib/relojSinTelefonoApi.js` | A la cola y a la base |
| `src/features/reloj/RelojSinTelefono.jsx` | `RecibeDelReloj`, `PlanAlReloj` (y `SinPlanAlReloj` para una cuenta de coach: su reloj sabe de quién es y que no hay plan), `EntrenoEnElReloj` |

`ios/ci/agrega_extensiones.rb` agrega los archivos nuevos al objetivo del reloj; el Info.plist del reloj trae el permiso de ubicación.

### 10.8 Cómo se probó y qué falta

- `npm run pruebas` corre `scripts/prueba-reloj-sin-iphone.mjs` (30 pruebas): los pasos del reloj son los del iPhone, kilos y libras, el plan y su tope, leer el resultado, la sesión en su lugar (y una sola vez, y «Otra vez», y a medias), el pulso como fila de Salud, la carrera y el pádel, menos de 30 s, el modo «acompana», saltar lo de Salud, la marca, «en curso», y la cola sin señal y al volver (sin duplicar).
- `node scripts/prueba-reloj-webkit.mjs` (9 pasos, no está en `npm run check`): WebKit con perfil de iPhone y el plugin falso (`scripts/qa/reloj-sin-iphone.*`): lo que llegó con la app cerrada pasa a la cola y solo entonces se borra del plugin, sin duplicar, los UUID anotados, «Llegó de tu Apple Watch», «Entreno en curso en tu reloj», el plan como texto y lo que llega con la app abierta.
- El Swift (reloj y plugin) se revisó con el compilador de esta Mac contra el SDK de macOS, con imitaciones de WatchKit y WatchConnectivity (no hay SDK de watchOS aquí); se compila de verdad en la nube (`ios-testflight.yml`).
- **Solo con un Apple Watch de verdad** (los 6 pasos de la parte 3.7): el reloj sin el iPhone, las pantallas, la corona, la vibración, el GPS del reloj, la ruta, la ubicación en silencio y su batería, «volver al entreno», `transferUserInfo` con el iPhone lejos y la app cerrada, y nadar.

## 11. La pantalla de carrera (2 nov 2026)

Spec: `docs/superpowers/specs/2026-11-02-pantalla-de-carrera.md`. Maqueta aprobada: artifact WVcKiJ2JhyChJqLwP3bhHD (colores **A**, línea **«Con brillo»**).

### 11.1 Qué se ve

- **Colores (opción A).** Fondo negro puro; tarjeta `#0B0C10`; hoja de abajo `#16171C`; etiquetas `#8A8F9C`. Azul de acción `#2F55F0` («INICIAR», «Pausar», «Reanudar», el corredor, la línea). Acento `#FF4D6A` (el tiempo, el pulso, «Finalizar»). Viven en `features/libre/carrera.js` (`C`).
- **Antes de salir.** El mapa entero. Brújula arriba a la derecha; tipo de mapa, 2D/3D y centrar en columna a la derecha. «GPS listo» encima de la fila de tres botones: la actividad (abre `ElegirActividad`), «INICIAR» (círculo de 96 px) y «AJUSTES» (pausa automática, tipo de mapa y «Empezar sin GPS»; desde el 2 nov 2026, solo cuentas de prueba: «Guardar traza del GPS» y «Exportar la última traza», ver la sección 7). Sin mapa (gimnasio, pádel): la hora en grande y «RELOJ» en lugar de «AJUSTES». La barra de la app se queda: `TrainingApp` la presta por contexto (`features/libre/barraDeLaApp.js`); tocar otra sección cierra la carrera.
- **Corriendo, los números.** Negro. Arriba el tiempo (40 px, acento). Arriba a la derecha, «achicar» → mapa. En medio, el ritmo y la distancia (100 px; se encogen en pantallas angostas) y, con Apple Watch, «♥ 142 lpm». Abajo, la hoja con «Pausar».
- **Corriendo, el mapa.** Abajo una columna con 12 px entre cada cosa: los botones del mapa, la tarjeta (ícono, tiempo, «agrandar»; ritmo y distancia; pulso) y la hoja. Los botones se re-acomodan solos con un `ResizeObserver` sobre `[data-mapa-panel]` (`clavePanel`). La vista se recuerda durante esa carrera (`vistaGuardada`, por la hora de inicio).
- **En pausa** (desde las dos vistas): siempre sobre el mapa, teñido de azul desde arriba (degradado en la página, `TINTE`). «EN PAUSA» en Bricolage Grotesque (la letra de los stickers), 46 px. La tarjeta en gris y «Ritmo promedio (/km)». «Reanudar» (azul) y «Finalizar» (`BotonDeMantener` con `ms={1000}` y `vaciaMs`: fondo `#8A1F33`, borde y relleno `#FF4D6A`). Reanudar regresa a la vista en la que estaba.
- **Finalizar guarda directo.** Ya no hay resumen antes de guardar: al llenarse «Finalizar» se guarda y sigue la celebración y la página con sus stickers. Con menos de `MINIMO_DE_SEGUNDOS` (30 s): aviso «Carrera demasiado corta» («Caminata…», «Rodada…»), con «Descartar» (no guarda) y «Seguir corriendo» (reanuda).
- **Sin mapa** (`PantallaDelCronometro`): la misma pantalla de números sin mapa: el nombre arriba, el tiempo enorme en el acento, el pulso, «Pausar»; en pausa «EN PAUSA», «Reanudar» y «Finalizar». Ahora también manda el entreno al Apple Watch (para que mida el pulso) y a la pantalla bloqueada. Una salida de cardio sin GPS sigue preguntando la distancia.

### 11.2 Un solo mapa de principio a fin

El mapa está siempre en el mismo lugar del árbol de `PantallaDeCarrera`: el de «antes de salir» es el mismo que corre y pausa. En la vista de números queda vivo detrás del negro (`oculto`: sin botones), así cambiar de vista o pausar es instantáneo y la cámara sigue al corredor. Al arrancar, mientras no hay puntos, el mapa recibe la última ubicación (`ultimoAqui`) para no regresar a donde abrió.

### 11.3 La línea «con brillo»

Tres capas, de abajo hacia arriba (`LINEA_CON_BRILLO` y `capasDeRuta` en `lib/mapaNativo.js`):

| Capa | Mapa de Apple (parche) | Mapa web (MapLibre) |
|---|---|---|
| Halo: azul, 18 px, 45 % | polilínea ancha y translúcida, **sin difuminar** (MapKit no difumina líneas) | `line-blur: 5` |
| Borde `#0B0C12`, 12 px, 90 % | polilínea | capa `line` |
| Línea 7.5 px, `#7FA0FF` → `#2F55F0` | `MKGradientPolylineRenderer` | `line-gradient` con `lineMetrics: true` |
| Punto blanco de la salida | `SalidaDeRuta` (overlay propio, mide lo mismo a cualquier acercamiento) | capa `circle` |

Las tres capas y la salida van en UNA llamada a `addPolylines` y se quitan juntas después (primero las nuevas, luego las viejas): no parpadea. El ritmo de envío no cambió (`adelgazaRuta`, una vez por segundo). Puntas y esquinas redondas. `LineaDeRuta` agranda la caja de cada capa para que lo ancho no se corte en la orilla. La foto del resumen (`Snapshot.swift`) dibuja las capas en el orden del mapa, con el degradado por tramos y la salida. El corredor (`VistaDelCorredor`) pasó al azul de acción.

### 11.4 Pantalla bloqueada

`EntrenoWidget.swift`: si el estado trae `distancia`, se dibuja la tarjeta de la carrera (ícono `simbolo`, el tiempo en `#FF4D6A`, botón redondo; ritmo y distancia con sus etiquetas grises; pulso). En pausa el tiempo va fijo y gris (`transcurridoS`) y la etiqueta es `etiquetaRitmo` («Ritmo promedio (/km)»). El botón redondo es un `LiveActivityIntent` (`AccionDeLaTarjeta`, en `EntrenoLiveActivity.swift`, iOS 17+): iOS lo corre dentro de la app, avisa por `NotificationCenter`, `EntrenoLivePlugin` lo pasa a la página como `accion` y `escuchaPantallaBloqueada` pausa o reanuda. En iOS 16 el botón solo se ve. Los workouts del plan conservan su tarjeta de siempre.

### 11.5 Cómo se probó y qué falta

- `scripts/prueba-mapa-nativo.mjs`: las tres capas en orden, con la misma ruta, y la salida solo en la de arriba.
- WebKit con perfil de iPhone (SE 375×667 y 430×932), página temporal `qa-carrera.html` / `qa-carrera-nativo.html` (excluidas de git; cronómetro, reloj y guardado falsos; servidor en el 5173 con `--mode production` para que el archivo del mapa deje entrar): nada se encima, ningún número se corta, cada botón recibe su toque (`elementFromPoint`), pausa y regreso desde las dos vistas, «Finalizar» manteniendo guarda y soltarlo antes no, el aviso de 12 s, gimnasio con y sin pulso, y con el puente falso: tres capas en una llamada y 12 px entre los botones del mapa y la tarjeta.
- El Swift se revisó con `swiftc -typecheck` contra el SDK de macOS con imitaciones (ActivityKit, Capacitor; `AppIntent` en lugar de `LiveActivityIntent`, que no existe en macOS). El parche se probó aplicándolo sobre el paquete recién bajado.
- **Solo en el iPhone:** la línea de verdad sobre MapKit (halo, borde, degradado, sin parpadeo), la cámara y la brújula con el mapa vivo detrás de los números, el botón de la pantalla bloqueada, el pulso del Apple Watch, y la barra de la app en «antes de salir».
