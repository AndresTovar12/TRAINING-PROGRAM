# La cara del atleta de cada pieza del editor (paso 1, 22 nov 2026)

Qué arma el coach en cada editor de la maqueta y qué le llega hoy al atleta. La lista sale del código (las listas de «Agregar» de cada
editor) y se probó con el motor real del entreno (`pasosDeLaSesion` en `lib/entreno.js`), no a ojo.

Cómo se probó: dos scripts sueltos, `pw/paso1-motor.mjs` (las sesiones de Ana, una por editor) y `pw/paso1-gym.mjs` (lo nuevo de Gym, Clase
y Deporte). Los dos están fuera del repo de la maqueta; la revisión automática de verdad se construye en el paso 4.

## El hecho central

`pasosDeLaSesion` solo lee `day.exercises`. Ninguna pantalla del atleta (`features/training`) lee `day.tramos`, `day.hibrido`, `day.deporte`,
`day.calentamiento` ni `day.claseExtra`. Resultado medido:

| Sesión de Ana | Disciplina | Dónde guarda | Pasos que arma el motor |
| --- | --- | --- | --- |
| Fuerza pierna | Gym | `exercises` | 19 |
| Series en pista | Running | `tramos` | 0 |
| Velocidad en pista | Running | `tramos` | 0 |
| Rodillo · intervalos | Cycling | `tramos` | 0 |
| Natación técnica | Swimming | `tramos` | 0 |
| Hyrox · simulacro | Híbrido | `hibrido.sets` | 0 |

Con 0 pasos el atleta no tiene «Iniciar entreno» y tampoco ve el contenido en la vista previa: solo el nombre y «Marcar como hecha».

## Las piezas, por editor

Estado: **llega** (el motor arma el paso) · **a medias** · **no llega**.

### Sets (Gym, Libre, Movilidad y rehab) → `day.exercises`
| Pieza | Estado | Nota |
| --- | --- | --- |
| Set normal (reps, carga, descanso, por lado, cambia en cada vuelta, cluster) | llega | ya funcionaba |
| Set con formato (AMRAP, EMOM, Tabata, Por tiempo…) | llega | paso `reloj` |
| Lapsos personalizados | llega | paso `reloj` con `tramos` |
| Intervalos de cardio (`intervalosDeCardio`) | llega | igual que lapsos; falta verlo en pantalla |
| «Nada, solo hacerlo» (`unidad: 'nada'`) | llega | paso con botón y sin texto; falta verlo en pantalla |
| Carga de cardio en una línea (Zona, vatios, ritmo) | llega | `meta.tipo` correcto |
| Límite de tiempo (`enMenosDe`) | a medias | sale en el texto («100 m · límite 40 s»); `termina` no lo trae: la app no lo cuenta ni dice si se cumplió |
| Descansos con flecha (→ ②, ↻ ①, → Set N) | llega | solo cambió cómo se dibuja en el editor |
| Calentamiento de Gym (`day.calentamiento`: Guiado o Ejercicios) | no llega | 0 pasos |

### Lista (Running, Cycling, Swimming, Triatlón) → `day.tramos`
Las piezas salen de `OPCIONES_CORRER`, `OPCIONES_BICI`, `OPCIONES_NADO` y `OPCIONES_TRI` en `EditorDeCorrer.jsx`. Ninguna llega.

| Molde (`k` / `rol`) | Running | Cycling | Swimming | Triatlón | Lo que guarda |
| --- | --- | --- | --- | --- | --- |
| Calentamiento (`tr` / `cal`) | sí | sí | sí | sí | `forma`: trote · video (Guiado) · ejercicios; en Triatlón también nado y bici |
| Técnica (`tec`) | de carrera | no | de nado | de carrera y de nado | `sets[{ veces, items[{ q, u, dq, du, lado, peso, mat, nota }], dq, du }]` |
| Continua (`tr` / `continua`) | Carrera | Rodada | Nado | las tres | constante · progresiva (`prog`) · con intervalos (`ints`) |
| Intervalos (`tr` / `int`) | sí | sí | no | carrera y bici | `ints { repite, lista[{ q, u, modo, z, vals }] }` |
| Sprints (`int` / `sprint`) | sí | sí | sí | las tres | `filas[{ q, u, dq, du }]`, `ej`, `con` (peso, material o terreno), `limS`, `series` |
| Series (`int` / `series`) | no | no | sí | nado | como Sprints, con descanso entre cada una |
| Descanso (`desc`) | sí | sí | sí | sí | `q, u, tipo`: total (parado) · activo (camina) |
| Enfriamiento (`tr` / `calma`) | sí | sí | sí | sí | igual que Calentamiento |
| Transición (`trans`) | no | no | no | sí | `q, u` («en menos de»; vacío = lo más rápido que pueda) |

Lo que cualquier pieza puede traer además: intensidad (`modo`: zona, ritmo, pulso, rpe, tiempo, tope, libre, w, ritmo100, con rango),
tiempo límite (`limS`), cadencia (`cad`), caminadora (`cam`), resistencia (`res`), sentado o de pie (`pos`), terreno (`ter`), nota, nombre
propio, ejercicio del repertorio con su video (`ej`), y `dxp` (el deporte de la parte, en Triatlón). Cycling guarda además `day.lugar`
(en ruta o estática).

### Cadena (Híbrido) → `day.hibrido.sets`
Ninguna llega.

| Pieza | Lo que guarda |
| --- | --- |
| Set «Se repite» | `fmt: 'rep'`, `veces`, `descV` (entre vueltas), `descS` (entre Sets) |
| Set AMRAP · EMOM · Por tiempo | `fmt`, `min` |
| Ejercicio de fuerza | `q, u, peso, int` (RPE, RIR), `lado`, `pv` + `vueltas` (cambia en cada vuelta), `limite`, `nota`, `desc` |
| Ejercicio de cardio, constante | `como: 'uno'`, `int` (pace, zona, pulso, vatios, ritmo /500 m), carga extra (`peso`) |
| Ejercicio de cardio, progresiva | `como: 'prog'`, `pg { ini, fin, lista }` |
| Ejercicio de cardio, con intervalos | `como: 'int'`, `iv { lista, repite }` |
| Ejercicio de cardio, sprints | `como: 'sprint'`, `spr[{ q, u, dq, du }]`, `mat` (material o terreno) |
| Extras del cardio | `maq` (caminadora o resistencia), `cad`, `limite`, `nota` |

### Deporte → `day.deporte`
Ninguna llega.

| Pieza | Lo que guarda |
| --- | --- |
| Ejercicio con video | `items[{ veces, lado, reps, dist, tiempo, desc, peso, nota }]` |
| Calentamiento · Enfriamiento | `cal`, `calma` (la forma de un calentamiento de Running) |
| Detalles | `necesita`, `nota` |

### Clase → `day.clase`, `day.claseExtra`, `day.exercises`
| Pieza | Estado | Nota |
| --- | --- | --- |
| Un video completo (`day.clase`) | llega | `TarjetaDeClase`, ya existía |
| Ejercicio por ejercicio (`claseModo: 'ejercicios'`) | llega | son los Sets de siempre |
| Calentamiento aparte (`claseExtra.cal`) y enfriamiento (`calma`, solo los que ya existían) | no llega | |
| Detalles: Lo que necesita, Nota para el alumno, Portada (`claseExtra`) | no llega | |

## Lo que se repite (menos traductores de los que parece)

- **Calentamiento y enfriamiento** tienen la misma forma en Running, Cycling, Swimming, Triatlón, Gym, Clase y Deporte
  (`forma: video | ejercicios`, más trote, nado o rodada en la lista). Un solo traductor sirve para los siete.
- **Sprints, Series y los sprints del Híbrido** son filas de «cuánto + descanso».
- **Continua, Intervalos y lo constante, progresivo o con intervalos del Híbrido** son tramos con su intensidad.
- **Técnica** y el calentamiento «con ejercicios» son Sets en cadena, como los del Híbrido.

## Lo que falta decidir (paso 2)

Para cada molde: cómo empieza, qué se ve mientras, cómo termina (sola o con un toque) y qué se guarda. Y un tipo de paso que hoy no
existe: el **video guiado** (un video que se sigue completo).

## Reglas decididas (paso 2, 22 nov 2026)

1. **Fin del video guiado:** la app pasa sola. Enseña «Calentamiento listo» unos segundos y luego lo que sigue; «Seguir ya» lo adelanta y
   «Saltar» está mientras corre el video. Si lo que sigue lleva cronómetro o GPS, espera el «Empezar» del atleta. (Andrés: «decide tú».)
2. **YouTube y Vimeo:** se ven dentro de la app con su reproductor oficial (así la app sabe cuándo terminan). «Abrir en YouTube» solo
   aparece si el video falla. En el iPhone hay que confirmar el «Error 153» (YouTube pide un referer que la app de Capacitor no manda).
3. **TikTok e Instagram:** se quedan como hoy: se acepta la liga y el atleta tiene el botón para abrirla fuera.
4. **Por tiempo (Trote 10 min, carrera de 10 min):** la app cuenta, vibra al acabar y pasa sola. Cuenta quien lleve el entreno: el
   teléfono o el reloj. El GPS no decide el final de algo por tiempo; solo guarda recorrido y ritmo. Por distancia, el GPS (o el reloj)
   decide el final, como ya funciona en Gym desde 200 m.
5. **Ritmo fuera de lo pedido:** vibra y avisa («Vas lento» / «Vas rápido») y se calla al volver al ritmo. Más adelante Andrés quiere
   que lo diga una voz.
6. **Técnica (Skip A 30 m, 3 veces): UNO POR UNO (cambiada el 23 nov 2026).** Cada vez es su paso: «30 m · Serie 1 de 3», un «Listo» por serie; la app lleva la cuenta y cronometra el descanso con tiempo. «Regreso caminando» se dice bajo la cifra. Antes era un «Listo» por ejercicio («3 × 30 m»); Andrés: «dice 3 × 10, ¿no se supone que debería de ir uno por uno?». Tenía dos fallas: 10, 10, 10 salía junto y 10, 12, 15 uno por uno; y el descanso entre vueltas quedaba como texto. Vale igual para el calentamiento con ejercicios (mismo código, `pasosDeSets`). En la lista del día sigue el resumen «3 × 10 reps». Pendiente con el mismo criterio: las «veces» de Deporte y las vueltas del Híbrido. Prueba: `pw/unoxuno-fotos.cjs`.
7. **Nado sin reloj:** toca «Listo» al terminar cada repetición (al llegar al borde); la app cuenta el descanso y suena al acabar.
8. **Caminadora o bici estática (km o cal sin GPS):** la máquina marca; el atleta toca «Listo» cuando llega.
10. **Descanso «hasta recuperarse»:** reloj que sube (cuánto lleva descansando), «Seguir» cuando quiera, y su pulso en vivo para que vea
    qué tan recuperado está. El pulso solo sale con un reloj conectado (Apple Watch o el que mande pulso); sin reloj, solo el tiempo.
11. **Sprint con límite (400 m en menos de 50 seg):** al llegar dice si lo logró («✓ 47 seg, lo lograste» o «53 seg, 3 seg arriba») y
    lo guarda para el coach. (Andrés: «decide tú».)
12. **Transición de Triatlón:** su reloj corre desde que acabó la parte anterior; el atleta toca al arrancar el deporte que sigue.

Nota sobre el GPS (22 nov 2026, pregunta de Andrés): el recorrido se graba en silencio durante TODO el entreno guiado si el atleta dijo
que sí (`useRecorrido`), sea cual sea el paso. Los 200 m (`METROS_PARA_GPS`) solo deciden si el GPS termina el paso; no apagan el
recorrido, que sigue sirviendo para los stickers.
9. **Sprint corto (menos de 200 m):** el atleta toca «Listo» al terminar (toda la pantalla es el botón) y arranca su descanso. En el
   descanso puede anotar su tiempo si alguien lo midió. La app no mide el tiempo con el toque: la reacción del atleta agrega décimas en
   un sprint de unos 4 seg.

### Lo que sale de estas reglas sin preguntar más (primera vuelta: Running, Cycling, Swimming, Triatlón)
- Calentamiento y Enfriamiento: Guiado (regla 1), Trote, Rodada o Nado por tiempo (regla 4) o por distancia (GPS, o «Listo» sin GPS:
  reglas 7 y 8), Ejercicios (regla 6).
- Carrera, Rodada y Nado continuos: por tiempo o distancia (reglas 4, 7 y 8); con ritmo, el aviso de la regla 5.
- Intervalos y Progresiva: cada tramo cambia solo al cumplirse (por tiempo o por GPS) y la meta de ritmo cambia con él (regla 5).
- Sprints y Series: 200 m o más con GPS, como ya funciona; menos, la regla 9; descansos con tiempo cuentan y pasan solos; sin tiempo,
  la regla 10; con límite, la regla 11.
- Descanso suelto: total o activo, cuenta y pasa solo.
- Transición: la regla 12.

## Paso 3: pantallas del teléfono, primera vuelta (22 nov 2026)

Dibujos en `/tmp/tl-sandbox/pw/`: `p3-correr2.html` (aprobado: «Mucho mejor»), `p3-dudas.html`, `p3-tripie.html`, `p3-apoyado.html`.

- **Running con plan: primero los números (versión 2).** Pantalla negra como la carrera libre (método de Aura Share y Strava): tres datos
  grandes, en este orden: lo que falta del tramo, el ritmo (verde en el ritmo pedido, ámbar fuera) y lo demás chico (km totales, pulso).
  Arriba: «Workout», el tiempo total y el botón del mapa en la esquina; debajo, el tramo («Tramo 3 de 8 · 1 km rápido») con sus rayitas.
  Abajo: «Sigue …», «Pausar» y «Saltar». El mapa se abre con la esquina y encima quedan los 2 datos clave. Reemplaza la pantalla clara
  del color del tipo (decisión del 23 oct 2026).
- **Nada se pierde de la pantalla de GPS de hoy:** «Tramo anterior», «Sonido y voz» y «Terminar entreno» van dentro de «Pausar». «Sin GPS»,
  «Cambiar el resultado» y «Anotar a mano» siguen en su momento (antes de salir, al llegar, sin señal).
- **Teléfono en la bolsa:** la pantalla bloqueada (Live Activity, ya existe) recibe el tramo y lo que falta; un sonido distinto por aviso
  (tramo nuevo, vas lento o rápido, faltan 100 m o 10 seg, fin) y la voz después. Sin verificar: si los pitidos suenan con la pantalla
  bloqueada (hoy son audio web).
- **Regla 13. Teléfono apoyado (tripié, banca, caminadora): pregunta + se da cuenta.** Al iniciar, solo si la sesión trae algo por metros:
  «¿Llevas el teléfono contigo?» · «Si lo dejas apoyado, no puede medir tus metros. Tú marcas cada tramo al terminarlo.» · [Lo llevo
  conmigo] [Lo dejo apoyado]. Si dijo que lo lleva y en un tramo por metros (nunca en un descanso) no se mueve 30 seg: «Tu teléfono no se
  está moviendo» · «¿Lo dejaste apoyado? Así no puede medir tus metros.» · [Sí, lo dejé apoyado] [No, voy corriendo]. Al revés: «Tu teléfono
  se está moviendo» · «¿Ya lo llevas contigo? Puedo volver a medir tus metros.» · [Sí, mide mis metros] [No, sigue igual]. Un «No» no vuelve
  a preguntar en ese tramo. Apoyado: los tramos por metros terminan con un «Listo» que ocupa media pantalla; lo que es por tiempo cuenta y
  pasa solo. La etiqueta de arriba dice «Apoyado».

## Paso 4, cerrado para la primera vuelta (23 nov 2026)

Construido en la maqueta y probado entrando como Ana (`?atleta`):
- **Traductor y revisión:** `lib/pasosDeLaLista.js` (la cara del atleta de cada pieza) y `scripts/revisa-caras.mjs` (en `npm run pruebas`).
- **Pantalla negra:** `features/training/PantallaDeCardio.jsx` y la versión `oscura` de `PasoConGps.jsx`. Por tiempo pasa solo (con pausa:
  `pausaPaso` en `entreno.js`); con GPS, ritmo en verde o ámbar, aviso y vibración; sprint corto con «Listo» y tiempo opcional en el descanso;
  sprint con límite; nado con «Llegué» y su tiempo en el descanso; bici fija con «Pide».
- **La lista de la sesión antes de empezar:** `features/training/ListaDeLaSesion.jsx`, en la página del día.
- **Teléfono apoyado (regla 13):** la pregunta al iniciar, «no se está moviendo» (30 seg sin metros) y «se está moviendo» (más de 40 m).
- **Avisos que se oyen:** `pitidos.js` con 'tramo', 'lento', 'rapido' y 'pronto'; la pantalla bloqueada dice el tramo y lo que pide.
- **Video guiado (reglas 1 y 2):** el paso guiado enseña el video y al terminar dice «✓ Calentamiento listo» y pasa solo a los 4 seg.
  `VideoRecortado` avisa al terminar (`onFin`) y usa el reproductor oficial de YouTube y Vimeo (dentro de la app, `playsinline`); «Abrir en
  YouTube» solo si el video falla. TikTok e Instagram siguen como antes.

Sin verificar (no se puede desde la maqueta): YouTube y Vimeo de verdad (la red de aquí los bloquea; el «Error 153» del iPhone), los pitidos con
la pantalla bloqueada, el mapa, y el ritmo en una carrera real (en la simulación salió ~10% más lento que la velocidad simulada).

## Regla 18: negra solo cuando se necesita (23 nov 2026)

Andrés: «el formato de pantalla negra solo es para cuando se necesita».

- **Negra:** el atleta necesita sus números. Carrera, rodada o nado continuo; intervalos; calentamiento de trote por tiempo; sprints y series; los descansos antes de ellos; la transición.
- **Clara, como Gym:** el atleta está en su lugar y necesita ver cómo se hace. Técnica (Skip A, Switches), calentamiento o enfriamiento con ejercicios, y calentamiento o enfriamiento guiado (corregido el 23 nov: primero había quedado en negra). Misma pantalla de Gym: video grande, cifra, «Listo», anterior, siguiente, anotar y grabar técnica.
- **El descanso** toma el color de lo que sigue, porque ahí se enseña lo que viene.
- **Casos dudosos, decididos por Claude (Andrés puede cambiarlos):** sprint corto en negra (guarda «¿Te midieron el sprint?»); series de nado en negra (el botón «Llegué» grande se toca con la mano mojada).
- **La hoja «¿Llevas el teléfono contigo?»** también va clara cuando sale sobre una pantalla clara.
- **Regla en corto:** va avanzando (corre, rueda, nada) → negra; está en su lugar → clara.
- **Código:** `pasosDeSets` y el calentamiento guiado marcan `comoGym: true` (`PasoGuiadoClaro` en `PantallaDeCardio.jsx`); `EntrenoDelDia.jsx` separa `sesionOscura` (preguntas del teléfono, metros, avisos) de `oscuro` (el color del paso que se ve).

## El teléfono casi nunca está en la mano (23 nov 2026)

Andrés: «nadie o casi nadie va a tener el teléfono en la mano nunca… hacer técnica de algo, muy difícilmente vas a tener el teléfono en la mano».
Se revisó cada momento del entreno (dibujo `pw/telefono.html`). Se arreglaron 4:

1. **Técnica y calentamiento con ejercicios** (`PasoDeLejos.jsx`): el video arranca solo, sin sonido, y se repite (`TarjetaDeVideo solo`, `VideoRecortado bucle`); la cifra va enorme («2 × 30 m»); «Listo» es un botón de todo el ancho. Se queda un «Listo» por ejercicio (regla 6): en técnica el atleta regresa caminando a la salida, donde está el teléfono.
2. **Sprint corto** (menos de 200 m, sin GPS): «Listo» se toca AL VOLVER a la salida, donde está el teléfono, y el descanso cuenta desde ahí. Primero se probó «Salgo» al arrancar; Andrés lo corrigió: «nadie va a tocar un botón en el teléfono antes de hacer un sprint, chance después sí». La caminata de regreso suma unos segundos de descanso; en un sprint al máximo, descansar de más no estorba (opinión de Claude). Regla 9 igual que antes.
3. **«¿Llevas el teléfono contigo?»**: se pregunta al llegar al primer tramo con GPS, no al empezar la sesión.
4. **Regla 14 (Híbrido «Por tiempo», aún sin construir)**: corregida en el dibujo `pw/regla14b.html`. Sin «Listo» por estación: «Empezar», el reloj corre solo y «Terminé» al final; las partes, opcionales, se anotan al final. Con reloj de pulsera cada parte se marca en la muñeca (paso 6).

Queda a medias: **series de nado** («Llegué» con la mano mojada). Solo se puede comprobar en una alberca real.

**Arreglos de capacidad (23 nov 2026, «¿se puede hacer todo?»):** el descanso con reloj tiene «···» (antes las opciones solo salían con «Pausar», que paraba el descanso); el lápiz de «Anotar resultados» volvió a la técnica; el video de un paso negro (sprint, serie de nado) arranca solo, sin sonido, y se repite, si es un video propio (uno de YouTube espera el toque: arrancaría con sonido). Prueba: `pw/botones2.cjs`, 24 de 24.
- «···» también en los pasos por tiempo y en el tramo con GPS, sin pausar (prueba `pw/botones3.cjs`, 11 de 11). El mapa abierto no tiene «···»: se cierra el mapa y ahí está.

## Segunda vuelta: reglas 14, 16 y 17 cerradas (23 nov 2026)

- **14 y 16 (son la misma: ¿cuenta antes de arrancar un reloj?).** Andrés: «si estamos hablando de cuando inicia un workout chance si aplica el 3,2,1 pero si el atleta no quiere perder tiempo chance el 3,2,1 le quita tiempo para dar una mejor marca». Confirmado el 23 nov 2026:
  - **Workout normal** (Tabata, EMOM, AMRAP, una plancha): se queda el 3, 2, 1 que ya existe al llegar a un reloj (`RelojDelBloque`, `conCuenta`).
  - **Cuando va por una marca** (formato «Por tiempo», «lo más rápido posible», el Híbrido de la regla 14): SIN cuenta automática. El reloj espera y arranca en el instante en que el atleta toca «Empezar».
  - Costo, dicho a Andrés: los segundos de dejar el teléfono en el piso cuentan en la marca. Lo resuelve del todo arrancar desde el reloj de pulsera (paso 6).
- **17 (al terminar el video de una clase).** Andrés: «No es clase lista si no se terminó todo». La clase es TODA la sesión: si después del video hay más, dice «✓ Video terminado · Sigue: …» y pasa solo; «Terminaste» solo sale cuando se acabó todo.

## Inspección antes de la segunda vuelta (Fable, 23 nov 2026)

Andrés pidió revisar las reglas de la vuelta 2 e inspeccionar el código para decir cuál es la estructura de lo que viene y qué hay que alistar.

### Lo medido (hechos)
- **Híbrido:** 0 pasos. Como Ana, «Hyrox · simulacro» solo enseña el nombre y «Marcar como hecha» (foto `insp-hyrox.png`).
- **Deporte:** 0 pasos. **Clase de un video con calentamiento aparte:** 0 pasos. **Gym con calentamiento:** el calentamiento se pierde sin avisar (salen solo los Sets). Script `pw/paso1-gym.mjs`.
- **Lo que ve el coach:** `filasPorSerie` (`lib/metricas/porSerie.js`) solo reconoce claves `N.N.N` (Sets) y `r.N` (reloj). Las de la lista (`t0.1`, `d.t0.1`) se ignoran: de una sesión de Running, Cycling, Swimming o Triatlón el coach ve el tiempo total y nada por tramo. Hueco de la primera vuelta.
- **Reloj de pulsera:** el contrato (`aEntrenoCanonico`) ya traduce bien las sesiones de la lista (tipos, metas y cómo termina). Nadie lo usa todavía en la app; el plan que viaja al Apple Watch sale de `planParaElReloj` y su regreso (`aplicaSesionDelReloj`) supone pasos con índice de ejercicio. Se revisa en el paso 6.
- **La app real** (repo, solo lectura) no tiene todavía los editores nuevos (Lista, Híbrido, Deporte, Clase) ni el traductor: todo esto va en el texto para el constructor (paso 7).
- **Repertorio real:** no existen «Skip A/B/C» ni «Switches»; «Sprint» y «Flying Sprint» no tienen video.

### Las reglas de la vuelta 2, revisadas
- 14 (Híbrido «Por tiempo»: Empezar → reloj → Terminé), 16 (3-2-1 en workout normal; sin cuenta cuando va por marca), 17 (clase: «Video terminado · Sigue»; «Terminaste» solo al acabar todo) y 18 (negra solo con números) son coherentes entre sí y con «el teléfono casi nunca está en la mano».
- Sin regla nueva (salen de las que ya hay): calentamiento de Gym, Clase y Deporte (reglas 1 y 6); Set «Se repite» del Híbrido (fuerza = pantalla clara de Gym; cardio de 200 m o más = negra con GPS; corto o máquina = «Listo»: reglas 4, 8, 9, 18); AMRAP y EMOM del Híbrido (el reloj que ya existe); ejercicio de Deporte (pantalla «de lejos», un «Listo» por ejercicio).
- Falta decidir con Andrés, con dibujo: (a) Deporte trae dos videos, Ejemplo y Explicación; la explicación tiene voz y no puede repetirse sola sin sonido. (b) La clase de un solo video hoy se ve en la página del día y se marca a mano; con la regla 17 pasaría a tener «Empezar» y modo guiado. (c) Límite de tiempo sin GPS («20 burpees en menos de 60 seg»): la app no sabe cuándo empezó si nadie toca.

### La estructura (decisión de diseño de Fable)
Toda sesión es la misma máquina: **Antes de empezar** (nota, lo que necesita) → **Calentamiento** → **Cuerpo** → **Enfriamiento**. Solo cambia el cuerpo: Sets (Gym), Lista (Running…), Cadena (Híbrido), Ejercicios con video (Deporte), Video o Sets (Clase). Y solo hay 4 pantallas, que YA existen: números (negra), ejercicio de lejos (clara), video guiado y reloj de Set. La vuelta 2 no necesita pantallas nuevas; necesita traductores.

### Lo que hay que alistar antes de construir (para Opus)
1. **HECHO (Fable, 23 nov 2026).** Cada paso dice su pantalla en `paso.cara`: `numeros` (negra), `lejos` (clara, teléfono en el piso), `guiado` (video) o `gym` (la de siempre; es la de un paso que no dice nada); un `tipo: 'reloj'` es el reloj. El descanso toma el color de lo que sigue. Vive en `lib/caraDelPaso.js` (`caraDelPaso`, `esDeNumeros`, `pantallaDelPaso`); la pone el traductor (`pasosDeLaLista.js`) y `EntrenoDelDia.jsx` ya no adivina (se fueron `sesionOscura`, `comoGym` y `pasoClaro`). Prueba: `scripts/prueba-cara-del-paso.mjs`, 21 de 21, dentro de `npm run pruebas`. De paso, «Antes de empezar» ya no sale sobre fondo negro en una sesión de lista. Como era antes: **Cada paso dice qué pantalla usa** (un solo campo), en vez de deducirlo de `deLaLista` + `comoGym` + `guiado`. Hoy, leyendo `EntrenoDelDia.jsx`, una sesión que mezcle pasos de lista y Sets pintaría los Sets sobre fondo negro (`oscuro = sesionOscura && !pasoClaro`). No se ve porque ninguna sesión mezcla todavía; el Híbrido y el calentamiento de Gym sí mezclan.
2. **El motor acepta calentamiento + cuerpo + enfriamiento en cualquier sesión.** Hoy es Lista o Sets, nunca los dos (`if (!hayEjercicios && piezas > 0)`).
3. **El reloj de Set sin índice de ejercicio** (AMRAP, EMOM y «Por tiempo» del Híbrido): `ejerciciosDelReloj` lee `dia.exercises[m.idx]` y el resultado se guarda en `formatos[idx]`.
4. **Que el coach vea lo hecho en pasos sin índice** (`filasPorSerie`): tramo, metros, tiempo, «lo lograste», tiempo anotado del sprint.
5. **La revisión automática y las sesiones de prueba**: `revisa-caras.mjs` solo cubre `EditorDeCorrer`; faltan Híbrido, Deporte, Clase y el calentamiento de Gym. Ana no tiene sesión de Deporte ni de Clase.

### Orden propuesto
Dibujos de la vuelta 2 (Fable) → Andrés aprueba → Opus alista 1 a 5 y construye, un editor a la vez: Híbrido, Deporte, Clase, lo nuevo de Gym.

## Opciones del coach que no le llegan al atleta (Fable, 23 nov 2026)

Andrés preguntó si quedaba algo más por arreglar, como el «3 × 10» y el «adivina la pantalla». Se probó cada pieza de la lista con TODAS sus opciones (`pw/insp-campos.mjs`) y se encontraron 5 huecos. Pendientes de arreglar:
1. **«Repetir en series»** (`x.series = { n, q, u }`): el traductor lo ignora. 4 sprints de 100 m en 3 series salen como 4 sprints, no 12. El resumen del propio editor sí lo cuenta (`EditorDeCorrer.jsx`, líneas 585 a 602).
2. **Nota para el atleta**: llega al paso en Continua, Intervalos y Sprints, pero ninguna pantalla negra la pinta (`PantallaDeCardio.jsx`, `PasoConGps.jsx`). En el calentamiento de trote, el traductor la pierde. Solo se ve en técnica (`PasoDeLejos`).
3. **Tiempo límite en sprint corto** (menos de 200 m): `limiteSeg` llega al paso pero solo `PasoConGps` lo usa.
4. **Terreno** (`ter`: plano, subida, mixto; bici en ruta): no llega.
5. **Sentado o de pie** (`pos`; bici estática): no llega.

Sí llegan: cadencia, resistencia, caminadora, material (trineo, paracaídas, vallas, cuesta, otro), ritmo, zona, vatios.
Causa: `revisa-caras.mjs` cuida que cada PIEZA tenga cara, no cada OPCIÓN de la pieza. Hay que ampliarla para que una opción nueva del editor sin su lugar en la pantalla haga fallar la revisión.

### Doble revisión de todos los editores: ARREGLADO (23 nov 2026)
Se revisó cada opción de cada editor (Lista a mano con `pw/insp-campos.mjs`; Gym, Híbrido, Deporte y Clase con dos revisiones aparte, comprobadas en el motor con `pw/insp-gym.mjs`). Se arreglaron 13:
- **Lista (7):** «En series» (ahora 12 sprints, con descanso entre series y «serie 1 de 3»); la nota del coach en la pantalla negra (`NotaOscura`, con y sin GPS) y en el calentamiento de trote; el tiempo límite en sprint corto (pastilla «en menos de 6 seg»); terreno; sentado o de pie; velocidad e inclinación de la caminadora (`extrasDeLaPieza`); intervalos guardados como pasos (`intervalosEnPasos`: Correr, Caminar, «Repetir todo», que antes daban 0 pasos).
- **Gym (6):** calentamiento (`pasosDelCalentamiento`, antes del Set 1, `serie: 0`); la nota dentro de un Set con reloj (antes de empezar y con el reloj corriendo); «en menos de» como cifra y como `limiteSeg` (el GPS lo cuenta en 200 m o más); la pausa del cluster como cifra; una nota después del último Set (paso `n.fin`); la carga con el reloj corriendo.
- **Revisión automática nueva:** `scripts/revisa-opciones.mjs` (32 de 32, dentro de `npm run pruebas`). Lee las opciones que ofrece `EditorDeCorrer.jsx` y falla si aparece una sin revisar.
- **Híbrido, Deporte y Clase:** aún sin cara del atleta; su inventario completo de opciones (más de 50) está en el reporte de la doble revisión y se usa al construirlos. Hallazgos para entonces: el Híbrido guarda valores que ya no enseña (al cambiar de formato); `mat: 'otro'` en el Híbrido no tiene dónde escribir qué material; en Deporte no está claro si `desc` es entre veces o después del ejercicio; Clase: portada, «lo que necesita», nota y calentamiento aparte no llegan.

## Híbrido: pantallas revisadas con fotos reales (23 nov 2026)
- Dibujo 1 (`pw/hibrido1.html`) se hizo de memoria y no era congruente; se rehízo con fotos reales de las pantallas que ya existen (`pw/hibrido2.html`, `pw/convideo.html`, script `pw/reales-hib.cjs`). El Híbrido usa: Gym (fuerza), la negra (carrera y sprints), los descansos de cada una, y el reloj de Set de Gym (AMRAP, EMOM, Por tiempo) con sus mismos botones. Lo único que cambia del reloj: «Por tiempo» sin «Prepárate» (reglas 14 y 16).
- **Videos en el reloj de Set (decidido por Andrés: «Los dos»):** hoy el video es una miniatura que hay que tocar con el reloj corriendo. (1) El descanso de antes del Set enseña los videos de los ejercicios que vienen; (2) con el reloj corriendo, el video del ejercicio sale arriba en grande, sin sonido y en bucle; si todos se hacen juntos (AMRAP), se turnan solos. Vale también para Gym.
- Observación sin decidir: el reloj de Set es blanco, cierra con X y usa azul, no el color de la sesión ni la barra «Workout». Ya era así en Gym.

## Negra SOLO con números en vivo, y el reloj de Set con el mismo estilo (23 nov 2026)
Andrés: «para qué cambia la pantalla a color negro [en el sprint con trineo de 30 m]? ¿cuál es la función?» y «me está confundiendo que me muestres dos estilos diferentes… con números azules».
- **Regla 18 afinada:** la negra es para lo que se mira mientras se avanza: una cuenta (por tiempo), metros y ritmo del GPS (200 m o más con GPS) o el reloj de la transición (`conNumerosEnVivo` en `pasosDeLaLista.js`). Lo demás va «de lejos» (`PasoDeLejos`): sprints cortos, natación por distancia (calentamiento, series, enfriamiento), caminadora o rodillo por distancia, «Caminar». Revisado en las sesiones de Ana: cambiaron los sprints de 30 m y 100 m y todo lo de Natación técnica por distancia.
- **Lo que no se perdió:** «Sprint 1 de 4 · serie 1 de 2», intensidad, material, límite y nota en `PasoDeLejos`; «Llegué» en natación («tócalo al llegar a la orilla») y «Listo, tócalo al volver» en sprints; en el descanso claro (`PantallaDeDescanso` de Gym): «¿Te midieron el sprint?» (`AnotaTiempo clara`), el tiempo de la serie de nado (`TardoClaro`) y «hasta recuperarte» con reloj que sube y pulso (prop `arriba`, `ahora`, `pulso`). El descanso dice «Sprint 2 de 4», la misma palabra que su pantalla.
- **Reloj de Set (AMRAP, EMOM, Tabata, Por tiempo, lapsos):** usa el color (`colorDelTipo`) y el fondo de la sesión, no azul sobre blanco. Mismos botones. Vale para Gym y el Híbrido.
- Pruebas: `scripts/prueba-cara-del-paso.mjs` (sprint corto clara, 400 m negra, natación clara, rodillo negra). Fotos: `pw/claros.cjs`, `pw/reales-hib.cjs`, `pw/rv-sprint.cjs`.

## Reloj de Set: videos antes y sin anotar a la mitad (23 nov 2026)
Andrés: «una persona no se va a parar a la mitad a anotar cada vuelta» y «necesitan ver los videos antes de hacer las secuencias». Eligió «Espera Empezar» y «Quitarlo».
- **Antes de empezar** (`RelojDelBloque`): al llegar ya no arranca a los 3 s (cambia la regla del 9 oct). Enseña «Antes de empezar» con el video de cada ejercicio en grande, sin sonido, en bucle; pasan solos cada 8 s (`SEG_POR_VIDEO`) y los puntitos eligen uno. «Empezar»: en un workout normal cuenta 3, 2, 1 (regla 16); si va por una marca (`formato.anota === 'tiempo'`, «Por tiempo»; regla 14) arranca al tocar. La pantalla no se apaga mientras espera.
- **Durante:** sin «+ Ronda». Arriba, el video del que toca; si se hacen todos juntos (AMRAP), se turnan solos cada 8 s.
- **Al final:** `ResultadoDelBloque` pregunta las rondas una sola vez (ya existía).
- Fotos: `pw/reales-hib.cjs` (`rv-amrap-*`, `rv-pt-*`).
- **¿En todos los modos? (revisado el 23 nov 2026).** El reloj de Set se abre desde DOS lugares: el entreno guiado (`EntrenoDelDia`) y el botón «Iniciar reloj» de la página del día (`SetGroup` en `TrainingApp.jsx`, cuando la sesión ya está hecha). El segundo arrancaba al instante, sin videos y en azul; ahora pasa por «Antes de empezar», con videos (`videoDe`, `miniaturaDe`) y el color de la sesión (`aspecto`). `empezarYa` solo reanuda un reloj en pausa. Lo cubre todo lo que usa Sets con formato: Gym, Clase «ejercicio por ejercicio» y, al construirse, el Híbrido. Lista y Deporte no tienen relojes de Set; el entreno libre tampoco tiene AMRAP. Foto: `pw/reales-dia.cjs`.

## Lecciones de la primera vuelta: la lista para la segunda (23 nov 2026)
Andrés: «quiero que seas consciente de todos los errores que cometimos en la primera vuelta para no volverlos a repetir». No es foco de esta fase: el repertorio real (Skip A, etc.) ni lo que ve el coach por tramo (otra fase).
Antes de enseñar o construir CUALQUIER pantalla de la segunda vuelta, se revisa esta lista:
1. **Partir de fotos reales**, nunca de memoria (el dibujo del Híbrido salió incongruente por eso).
2. **Negra solo con números que cambian en vivo** (cuenta, GPS, transición). Lo demás, clara.
3. **El teléfono está en el piso**, no en la mano: video que arranca solo, cifra enorme, «Listo» grande.
4. **Nunca pedir un toque antes de un esfuerzo** («Salgo»); sí al volver o al terminar.
5. **Nada que anotar a la mitad** («+ Ronda»): lo que solo sabe el atleta se pregunta al final, una vez.
6. **Ver el video en grande ANTES** de hacer algo nuevo; durante, el video del que toca.
7. **Uno por uno**: la app lleva la cuenta («Serie 1 de 3»), no «3 × 10».
8. **Cada opción del editor llega al atleta**: inventario opción por opción + `revisa-opciones.mjs` antes de dar algo por hecho.
9. **No perder botones**: tabla botón por botón contra la pantalla anterior (anotar, técnica, anterior, saltar, sonido, terminar; opciones sin pausar).
10. **Un solo estilo**: los mismos componentes y el color de la sesión.
11. **Arreglar en TODOS los caminos** que abren la misma pantalla (el reloj se abría desde dos lugares).
12. **Cada paso dice su pantalla** (`paso.cara`); nunca adivinar por la sesión.
13. **Antes de preguntar, buscar lo que Andrés ya decidió** y sus palabras exactas.
14. **Si una regla aprobada choca, decirlo y preguntar**, no cambiarla en silencio.
15. **Explicar corto**, una idea, con dibujo; sin lo obvio.
16. **Doble revisión antes de decir «terminado»**.

### Decisión de Andrés (23 nov 2026): Deporte, los dos videos
«Mejor que el usuario tenga visible ambos y escoge cuál ver y ya». En la pantalla del ejercicio (la «de lejos») se ven los dos: «Ejemplo» y «Explicación». Arranca el Ejemplo, sin sonido y repitiéndose (el teléfono está en el piso); al tocar «Explicación» se oye con voz. No hay pantalla extra antes del ejercicio.

### Decisión de Andrés (23 nov 2026): Clase de un solo video
Foto real: la clase no tiene «Iniciar entreno» como los demás tipos; «Empezar» del Home cae en la página del día y hay que «Marcar como hecha» a mano. Andrés: «ni siquiera hay un botón como para iniciar el entrenamiento como en el resto… la aplicación le está dejando toda la responsabilidad de la experiencia al video… cuidar ese tipo de cosas». Queda: la clase tiene «Iniciar entreno» igual que todos, abre el entreno guiado con la pantalla del video (cara `guiado`) y al acabar queda hecha sola (regla 17: si hay más, «✓ Video terminado · Sigue»). «Empezar» del Home abre el entreno, igual que en Gym.

### Decisión de Andrés (23 nov 2026): límite de tiempo sin GPS («20 reps en menos de 60 seg»)
«que la app cuente sola obviamente para que [el atleta] pueda ir viendo cuánto tiempo le queda». El 3, 2, 1 NO: un límite es ir por una marca, y eso ya lo había decidido (reglas 14 y 16): «el 3,2,1 solamente puede ser que le perjudique». Queda: la cifra «1:00 límite» se vuelve una cuenta que baja («0:43 quedan»); arranca en el instante en que el atleta toca «Empezar», sin cuenta antes (igual que «Por tiempo»); al tocar ✓ dice «✓ 47 seg · lo lograste» o cuánto se pasó. Error mío: volví a proponer el 3, 2, 1 sin revisar la regla 16 (lección 13).

### Regla 19 (aprobada por Andrés, 23 nov 2026): cuándo arranca un reloj o un límite
Andrés: «qué tal que… no hay descansos y el atleta simplemente tiene el teléfono en un tripié y no se quiere acercar a picar un botón… tienes que tomar todos los factores… si necesita picar un botón de empezar o si no es necesario, si es necesario el 3, 2, 1 o solo lo perjudica». Tabla aprobada («Sí, aplícala»):
1. Después de un descanso con tiempo: arranca solo al acabar el descanso; los videos de lo que sigue se ven durante el descanso. Sin botón, sin 3, 2, 1 (el descanso ya cuenta hacia atrás en grande).
2. Después de un ejercicio que acabó solo (Tabata → EMOM): arranca solo. Sin botón, sin 3, 2, 1.
3. Después de un ejercicio que acabó con ✓, sin descanso: el ✓ del anterior arranca el siguiente. Ningún toque extra, sin 3, 2, 1.
4. Nada antes (lo primero, o un descanso «cuando estés listo»): hace falta un toque, «Empezar». Por marca, arranca al tocar; normal, 3, 2, 1.
Dato: por reps con tripié, la app no sabe que terminó sin un toque; solo lo resuelve el reloj de pulsera (paso 6).
Lección 17 (para la lista): antes de poner un botón o una cuenta, ver qué pasó justo antes y dónde está el teléfono; arrancar con algo que ya pasó.

### Propuesta en prueba (23 nov 2026, falta el sí de Andrés): el repaso antes de cada reloj
Andrés: «si no tiene descanso, va a comenzar el [AMRAP]… y no va a haber podido ver los videos… si tiene un descanso de 2 minutos, pero no quiere tomar todo el descanso… puede saltarse el descanso… tenemos que brindar una opción o una estructura que funcione». Construido en la maqueta para que lo vea («Tendría que verlo»):
- Hay descanso con tiempo: el descanso es el repaso (videos del reloj, uno cada 8 s) y dice «Empezar ya · el reloj arranca al tocar». Al acabar, corre solo.
- No hay descanso (✓ o acabó solo): «Prepárate» de 8 s por ejercicio (máx. 30) con los videos; «Empezar ya» o arranca solo; los últimos 3 s suenan. Cambia la fila 3 de la regla 19.
- Límite con un ejercicio nuevo y sin descanso: 8 s de repaso. Serie 2 del mismo ejercicio: sin repaso.
- Lo primero de la sesión: «Antes de empezar» y «Empezar», como antes.
- ¿Y si no le alcanza? (Andrés: «¿y si los segundos… no le parecen suficientes para ver los videos?»). En el «Prepárate» hay «Necesito más tiempo»; tocar un video o un ejercicio hace lo mismo. Quien toca está junto al teléfono: la cuenta se para y queda «Antes de empezar», que espera su «Empezar». En el límite, igual: queda «Empezar · el límite arranca al tocar». Sin tocar nada (tripié), arranca solo.

### DECISIÓN FINAL de Andrés (23 nov 2026): sin descanso, el atleta toca «Empezar»
«olvídalo. Cuando no hay descanso, simplemente que el atleta oprima el botón. Lo digo por experiencia, creo que es mejor. Mi decisión es esa.»
Reemplaza la fila 2 y la fila 3 de la regla 19 y descarta el «Prepárate», «Necesito más tiempo» y la pregunta de una vez (se quitaron del código). Queda:
- Tras un descanso con tiempo: el descanso enseña los videos de lo que sigue y dice «Empezar ya»; al acabar, el reloj o el límite corre solo, sin 3, 2, 1.
- Cualquier otra cosa (lo primero, un ✓ sin descanso, un reloj que acabó, un descanso «cuando estés listo»): «Antes de empezar» con los videos y espera «Empezar». Normal: 3, 2, 1. Por marca: al tocar.
Lección 18: cuando Andrés ya describió las necesidades, proponer UNA solución que las cubra; no volver a plantearle el problema ni darle esquemas con muchas filas.

## Híbrido construido (23 nov 2026)
`lib/hibridoAlAtleta.js`: la cadena (`day.hibrido.sets`) se traduce a ejercicios de Gym (`conHibrido(day)`), así usa las mismas pantallas, relojes, descansos, kilos y lo anotado. Lo aplican `pasosDeLaSesion`, `EntrenoDelDia` y la página del día (`TrainingApp`).
- Se repite → Set de Gym con sus vueltas; descanso del ejercicio, entre vueltas (al final de cada vuelta) y entre Sets.
- Fuerza → pantalla de Gym. Carrera de 200 m o más → la negra con GPS. Sprint corto → «de lejos» (uno por fila: «Sprint con trineo · 1 de 4»). Máquina o caminadora → sin GPS.
- Progresiva e intervalos → un tramo por fila con su intensidad («Repetir hasta completar» hasta el total, máx. 30).
- AMRAP (min) · EMOM (cada minuto un ejercicio, se turnan) · Por tiempo (un tramo abierto: «Terminé», sin «Ronda 1 de 1»). Regla 19 y decisión final: tras descanso con tiempo arranca solo; si no, «Empezar».
- Por lado, límite (`enMenosDe`), nota, RPE/RIR, % 1RM, cambia en cada vuelta (`porVuelta`), carga extra, material, cadencia, resistencia, caminadora.
- Revisión automática: 11 casos en `revisa-opciones.mjs`. Prueba en navegador: `pw/hib-real.cjs` (6 de 6).
- Para el constructor: sin la ficha, «es máquina» se adivina por el nombre o por vatios/ritmo /500 m; conviene que el editor guarde `tipo` en cada renglón (ya lo calcula `tipoDe`).
- Observación: un Set con 4 sprints enseña 5 renglones en la tarjeta del circuito (sentadilla + 4 sprints).

## Un solo estilo donde no hay razón para la diferencia (23 nov 2026)
Andrés: «hay lugares en donde no tiene sentido que usemos componentes diferentes». Regla: la pieza cambia solo cuando la situación lo pide (negra = números en vivo para leer corriendo; de lejos = cifra enorme y «Listo» ancho; reloj = el reloj grande; Gym = cifras con kilos). Arreglado:
1. **En qué vas** = UNA pieza (`EnQueVas.jsx` + `lib/enQueVas.js`): «Serie / Sprint / Tramo **1** de 4» con rayitas, la letra de la tarjeta de Gym. En la de lejos (grande), en la negra (por tiempo y con GPS; antes la negra por tiempo no lo decía) y en la pastilla del descanso y de «Workout» (del color de la sesión; antes azul).
2. **«Serie» es siempre la vuelta; el bloque es «Set»** (como en el editor): «Set 2 · AMRAP» en el reloj, «Set 1 · Circuito» en la página del día, «Set 1» en «Workout».
3. **El número del sprint ya no va pegado al nombre**: «Sprint con trineo» + «Sprint 1 de 4 · serie 1 de 3». En la tarjeta del circuito, los sprints son un renglón: «Sprint con trineo × 4».
4. **Color de la negra: NO se cambió.** Andrés pidió buscar por qué: la negra usa los colores de la pantalla de carrera aprobada el 2 nov 2026 (opción A, como Strava: azul de acción, rojo del tiempo; `docs/entreno-y-reloj.md` §11.1). Las rayitas de la negra siguen en rojo.
5. **El reloj de Set en el entreno guiado lleva la barra «Workout»** (avance y tiempo), sin la X. Abierto desde la página del día conserva su X.
Pruebas: `npm run pruebas`, botones2 25/25, botones3 11/11, unoxuno 5/5, regla19 9/9, hib-real 6/6 (botones2 y unoxuno ajustadas: la cifra «Serie 2 de 2» ahora va en tres pedazos).

## Deporte construido (23 nov 2026)
`pasosDeDeporte` en `lib/entreno.js`: cada ejercicio de `day.deporte.items`, uno por uno («Serie 1 de 3», la misma palabra que en todo el entreno), en la pantalla «de lejos». La cifra grande es reps, distancia o tiempo; debajo «en 4 seg · por lado · 5 kg». El descanso va después de cada vez y antes del ejercicio siguiente (decisión de Claude: el editor solo dice «Descanso»). Calentamiento y enfriamiento como en la lista. «Lo que necesita» y la nota de la sesión van en «Antes de empezar».
- **Decisión de Andrés, aplicada:** Ejemplo y Explicación a la vista, como dos botones arriba del video (`TarjetaDeVideo`, solo con el teléfono en el piso, `solo`); arranca el Ejemplo sin sonido y repitiéndose; «🔊 Explicación» suena al tocarla. Sin los puntitos ni la etiqueta encima (sobraban con los botones). También en el video del descanso.
- **Página del día:** `ListaDeLaSesion` enseña los ejercicios de Deporte («3 veces · 10 m · en 4 seg · por lado · descanso 30 seg»).
- **«Empezar» de «Antes de empezar»** ahora es del color de la sesión. El «Iniciar entreno» de la página del día se queda azul: decisión del 29 oct (el botón principal de la app).
- **Sesión de prueba de Ana:** «Releases del receptor», segunda sesión del viernes 27 (el jueves queda libre para las pruebas del editor). Los videos de explicación de prueba ahora dicen quién los subió (`created_by`): sin eso la app no los enseñaba.
- Revisión automática: 7 casos de Deporte en `revisa-opciones.mjs`. Navegador: `pw/dep-real.cjs` 8/8.
- Sin teléfono real no se puede ver la Explicación: en la maqueta es una liga de YouTube y el contenedor no tiene internet.

## Clase construida (23 nov 2026)
Decisión de Andrés: la clase de un video tiene «Iniciar entreno» como todas. `pasoDeLaClase` (en `lib/entreno.js`): la clase es un paso con la pantalla del video guiado (`cara: 'guiado'`, `deClase`). Orden: calentamiento aparte (`claseExtra.cal`) → la clase → los Sets que traiga debajo → enfriamiento (`claseExtra.calma`).
- Al acabar el video: «✓ Video terminado · Sigue: …» y pasa solo (regla 17); si era lo último, la sesión queda hecha sola («Mantén para terminar» en el último paso).
- «Antes de empezar»: lo que necesita, la nota y la portada (si el coach eligió una). Ya no repite la tarjeta del video: la clase es un paso.
- «Empezar» del Home abre el entreno (antes caía en la página del día). En la página del día sale «Iniciar entreno»; la tarjeta de la clase sigue arriba como vista previa.
- Ejercicio por ejercicio: los Sets de siempre (sin cambios).
- Sesión de prueba de Ana: «Yoga para corredores», segunda sesión del domingo 29 (video de 6 s para ver el final; enfriamiento con un estiramiento por lado).
- Revisión automática: 6 casos de Clase en `revisa-opciones.mjs`. Navegador: `pw/clase-final.cjs` 5/5.

## Revisión de estilo (paso 5, 23 nov 2026)
26 pantallas reales de las 8 sesiones de Ana (`pw/revision.cjs`, tabla en `scratchpad/hallazgos.png`). Triatlón no se fotografió: Ana no tiene esa sesión. Arreglado (Andrés: «Sí, todo» y «Color de la sesión»):
1. **Error real:** la página del final decía «Lo marcaste como hecho, sin el entreno guiado» en todo lo que no es Gym ni Híbrido (lista, Deporte, Clase), con «0/2 series» y el sticker «0 sets». `filasPorSerie` (`lib/metricas/porSerie.js`) solo contaba claves «idx.vuelta.lapso»: ahora cuenta todo paso hecho; «Lo que hiciste» (`ejerciciosDeLaSesion`) agrupa por pieza y nombre los pasos sin índice. Ahora: «2 de 2 · Todas las series que programó Andrés».
2. **Las hojas de abajo dentro del entreno** («Lo que hiciste», «Tu resultado») van del color de la sesión: CSS `--acento` en la raíz de `EntrenoDelDia`; fuera del entreno, el azul de la app.
3. **«Terminar» verde** en la de lejos (como la bandera de Gym), ancho por el teléfono en el piso. La negra conserva su azul (colores de carrera).
4. **«Sigue» en tarjeta** en la de lejos, como en el video guiado y el descanso.
5. **Bocina dibujada** (Volume2) en «Explicación», no emoji.
Se quedan a propósito: la negra (azul y rojo de carrera), «Iniciar entreno» y «Compartir» azules (fuera de la sesión, 29 oct), cifra enorme y «Listo» ancho de lejos, «Pausa/Parar» del reloj, la tarjeta del circuito de Gym, solo «Saltar» en el video guiado.
Pendiente menor visto: en la página del final, el ícono del tipo «Yoga» (sin ícono propio) sale como pesa.
