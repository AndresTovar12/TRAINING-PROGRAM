# Integraciones y estado: el Apple Watch dice la verdad, el conector ve todos los videos y los cambios llegan sin cerrar sesión

**Modelo:** Opus 5.5, esfuerzo alto. Tres commits sobre main, en este orden.

Notas de Andrés del 2 y 3 nov 2026 («¿por qué si no tengo Apple Watch dice que lo tengo conectado?», «hay que salir y cerrar sesión para ver los cambios, eso está horrible»).

## 1. Apple Salud y Apple Watch, cada uno con su verdad

Hoy (src/lib/dispositivos.js, MisDispositivos.jsx, relojConectado.js): un solo renglón, «Apple Salud y Apple Watch», que dice «Conectado desde…» con solo tener la fila `apple_salud` en `dispositivos_conectados`, aunque no haya reloj. `estadoDelReloj()` ya sabe `{ emparejado, instalada }` (WCSession) y ese renglón no lo usa. En la ficha del atleta del coach (AthletesPanel.jsx, ~línea 1120) pasa lo mismo: «Apple Watch conectado…».

No hay que construir un camino para conectar o cambiar de reloj: el reloj se empareja con el iPhone (app Watch de Apple), el iPhone cambia solo al reloj que se trae puesto, y la app del reloj se instala sola con la del iPhone. La app solo tiene que decir la verdad.

Qué hacer:
- En Dispositivos, dos renglones:
  - «Apple Salud»: conectado si está la fila y el permiso de este iPhone (lo de hoy: «Conectado desde…», «Conectado en tu otro iPhone · Conectar aquí», «Conectar»). Aquí va el conteo de entrenos que llegaron de Salud.
  - «Apple Watch», según `estadoDelReloj()`, leído cada vez que se abre la pantalla:
    · sin reloj emparejado: «No hay un Apple Watch con este iPhone», en gris, sin botón.
    · emparejado sin la app del reloj: «Instala Training Lab en tu reloj», con un botón «Cómo» que abre una hoja corta: «Abre la app Watch de tu iPhone, baja a Apps disponibles y toca Instalar junto a Training Lab.»
    · emparejado y con la app: «Listo», y si ya llegó algún entreno del reloj, «último [cuándo]».
  - En la web: los dos renglones con «En la app del iPhone», como hoy.
- Guarda lo que vio el teléfono, para que el coach diga la verdad: al leer `estadoDelReloj()` en la app, actualiza en la fila `apple_salud` un campo `reloj` (jsonb: `{ emparejado, instalada, visto_en }`), solo si cambió. Agrega la columna con su SQL en docs/sql y su permiso (cada quien solo escribe la suya).
- En la ficha del atleta del coach: «Apple Salud conectado desde…» siempre que haya fila; «Apple Watch» solo si `reloj.emparejado` es verdadero. Si nunca se vio el dato (cuentas viejas), di solo «Apple Salud conectado».
- Busca en toda la app cualquier otro texto que diga que hay Apple Watch solo por tener Salud (Home, Mis métricas, la página del entreno, la invitación de Recuperación) y aplica la misma regla: «Apple Watch» solo con `emparejado`.
- El modo «Probar como si tuviera Apple Watch» de los administradores sigue igual.

Pruebas: un iPhone sin reloj con Salud conectado dice «Apple Salud · Conectado» y «Apple Watch · No hay un Apple Watch con este iPhone». Con reloj y la app instalada, «Listo». El coach ve lo mismo del atleta.

Commit: «Dispositivos: Apple Salud y Apple Watch por separado, y el Watch solo si existe».

## 2. El conector cuenta también los videos de «Explicación»

Hoy (supabase/functions/mcp/comunes.ts): `buscar_ejercicios` devuelve `fichaCorta`, que solo mira `video_link` y `video_url`. Un video puesto como «Ejemplo» sí sale (vive en esas columnas). Uno puesto solo como «Explicación» vive en `exercise_media` y no sale: el conector dice que ese ejercicio no tiene video. `ver_ejercicio` sí lo ve.

Qué hacer:
- En `buscar_ejercicios`, después de filtrar, pide en UNA consulta los medios de los ejercicios que se van a devolver (`exercise_media` con `.in('exercise_id', ids)`), con la misma regla de visibilidad que `ver_ejercicio` (un video para un atleta en particular solo lo ve ese atleta).
- Si las columnas están vacías y hay medios, `video` es la liga del primero. Es la misma regla que usa la app para decir «Tiene video» (ExercisesPanel.jsx, ~línea 262).
- Despliega la función `mcp` y corre `node scripts/compartir-con-mcp.mjs --revisar`.

Prueba: un ejercicio con solo un video de «Explicación» sale con `video` en `buscar_ejercicios`.

Commit: «Conector: buscar_ejercicios también ve los videos de explicación».

## 3. Los cambios llegan solos, sin cerrar sesión

Hoy: PlanContext.jsx pide los planes del atleta al entrar y cuando vuelve la señal (`vuelta`), nada más. El editor del coach (PlanBuilder) no se entera si el plan cambió en otro lado (el conector, otro aparato). Los mensajes ya llegan en vivo con Supabase Realtime (mensajesApi.js): usa lo mismo.

Qué hacer:
- App del atleta (PlanContext):
  · Al volver a la app (visibilitychange en la web, `appStateChange` activo en el iPhone), si pasaron más de 20 s fuera, vuelve a pedir los planes por el mismo camino de `vuelta`: sin pantalla de «cargando»; lo de antes se queda a la vista hasta que llega lo nuevo.
  · Escucha en vivo `plans` con `user_id=eq.<atleta>`. Al llegar un cambio, espera 1.5 s (por si llegan varios juntos) y vuelve a pedir. Agrega `plans` a la publicación `supabase_realtime` con su SQL en docs/sql, como se hizo con `mensajes`. Revisa que el permiso de lectura de `plans` solo deje pasar lo de esa cuenta.
  · Lo que el atleta ya anotó (series, pesos) no se toca: vive en su estado, no en el plan.
  · Sin conexión, nada de esto corre; al volver la señal sigue como hoy.
- Editor del coach (PlanBuilder):
  · Escucha en vivo el plan abierto (`plans` por su id) y, al volver a la pestaña o a la app, compara `updated_at`.
  · Si cambió en otro lado y el coach NO tiene cambios sin guardar (`dirty` falso): se recarga solo y sale un aviso chico «Se actualizó con los cambios más recientes».
  · Si SÍ tiene cambios sin guardar: no se toca nada y sale una franja fija arriba, «Este plan cambió en otro lado.», con «Ver lo nuevo» (descarta lo suyo y recarga, pidiendo confirmación) y «Seguir con lo mío» (al guardar, gana lo suyo, como hoy).
  · El repertorio (ExercisesPanel): al volver a la pestaña o a la app, si pasaron más de 20 s, vuelve a pedir la lista.
- Que nada se dispare con lo que el propio aparato acaba de guardar: ignora el aviso en vivo si `updated_at` es el que este aparato acaba de escribir.

Pruebas:
1. Con el iPhone del atleta abierto, el coach cambia un ejercicio del día desde la computadora: aparece en el iPhone en menos de 5 s, sin tocar nada.
2. Con la app del atleta en segundo plano, se cambia el plan desde el conector; al abrirla, ya está.
3. El coach tiene el editor abierto sin cambios y el conector cambia el plan: se recarga solo con el aviso.
4. El coach tiene cambios sin guardar y el conector cambia el plan: sale la franja y no se pierde ninguna de sus ediciones.
5. npm run check en verde.

Commit: «Planes: los cambios llegan solos, sin cerrar sesión».

## Al terminar
- Actualiza docs/mi-cuenta.md (o el doc de dispositivos) y docs/sin-conexion.md.
- Dime los tres hashes, el número de build de TestFlight y lo que no pudiste probar (el Apple Watch de verdad, sobre todo).
