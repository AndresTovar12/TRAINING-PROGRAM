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
  "inicio": 1791560000000,
  "fin": 1791563600000,
  "oculto": true,
  "hechos":   { "0.1.0": { "t": 1791560060000, "n": "Back Squat", "reps": "6", "kg": "107.5" } },
  "saltados": { "3.1.0": { "t": 1791560500000, "n": "Hip Thrust" } },
  "extra":    { "d.0.1.0": 30 },
  "empezados":{ "1.2.0": 1791560900000 }
}
```

- **Horas en milisegundos de época** (`Date.now()`). Todo lo que se ve (cuánto queda de un descanso, el tiempo total) se calcula con la hora de ahora: nunca con un contador. Así aguanta una llamada, la pantalla bloqueada o que el sistema mate la app.
- **`hechos[clave]`**: el paso se hizo en `t`. `n` es el nombre del ejercicio en ese momento: si el coach cambió ese lugar por otro ejercicio, la marca vieja ya no cuenta. `reps`/`kg`/`seg` solo viajan si el atleta **cambió** lo planeado (`kg` siempre en kilos). `tecnica` queda reservada: el id del video que el atleta grabó de esa vuelta (ver `src/lib/funciones.js`).
- **`oculto`**: el atleta quitó el entreno guiado de esa sesión (la ✕ junto a «Continuar entreno»): la app ya no ofrece «Iniciar/Continuar». Solo existe cuando es `true`; no borra nada de lo hecho. Un reloj puede ignorarlo.
- **Deshacer una sesión terminada** (el botón «Deshacer» junto a «Sesión terminada»): si el entreno también tenía `fin`, la app borra el avance (`reiniciaSiTerminado` en `lib/entreno.js`) y vuelve a ofrecer «Iniciar entreno» desde cero. Lo anotado en la lista no se toca; un entreno a medias (sin `fin`) se queda como está, y `oculto` se conserva.
- **`saltados`**: igual, pero el paso se saltó. Sigue pendiente en la lista.
- **`extra[clave]`**: segundos que se le sumaron a un descanso («+30 s»). **`empezados[clave]`**: cuándo se arrancó el cronómetro *opcional* de un paso con tiempo.
- **El paso actual = el primer paso de la lista sin marca.** No se guarda. Un descanso empieza cuando se marcó el paso anterior. Nada avanza solo.
- **Son objetos por llave, nunca listas**, a propósito: la base mezcla los objetos llave por llave a cualquier profundidad y *reemplaza* las listas enteras (ver `src/lib/estadoPorPartes.js`).

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
- Un reloj que ya tiene resultado no arranca solo. Y ningún paso *termina* solo: el reloj sirve, nunca manda.

## 7. Lo que NO está (a propósito)

- Ninguna app nativa, ni la del reloj. Este documento y `entrenoCanonico.js` son la base, no el adaptador.
- **GPS y cardio con la pantalla en la mano en la web**: descartado por Andrés. El seguimiento con pantalla bloqueada pide ubicación en segundo plano, que solo existe en la app nativa (y en un reloj, lo lleva el reloj).
- Lo que el sensor mide de vuelta (pulso, ruta, ritmo por vuelta) no tiene dónde guardarse todavía. Cuando haya app nativa: probablemente `entreno.sensor` por paso, con la misma regla de objetos por llave.
- «Grabar técnica para el coach» está apagado (`src/lib/funciones.js`); hoy solo existe su botón con «Pronto» y el campo `tecnica`.

## 8. Cómo probarlo

```
node scripts/prueba-entreno.mjs            # los pasos y el avance, con horas inventadas
node scripts/prueba-entreno-datos.mjs      # lo que se dice de un paso y el registro de siempre
node scripts/prueba-entreno-canonico.mjs   # el idioma de los relojes
```
