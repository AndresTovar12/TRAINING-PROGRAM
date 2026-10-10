# Mensajes y técnica por video

**Pedido de Andrés, 10 oct 2026** (tras contestar 5 rondas de preguntas): chat completo entre el atleta y su coach, una conversación con cada profesional de su equipo, y que el video de técnica de una serie le llegue al coach como una tarjeta con dos botones («Técnica correcta» y «Corregir»). Todas sus respuestas están en la memoria del proyecto («Sello tipo Strava + Mensajes»); este archivo es lo que quedó construido.

## Cómo funciona

- **Una conversación es el PAR (atleta, profesional).** El coach principal del atleta es `profiles.coach_id`; el resto del equipo, las filas de `equipo` en estado `activo`. El mismo atleta tiene una conversación con su coach y otra, aparte, con su fisio: cada quien ve solo la suya.
- **Quién lee:** solo las dos personas del par (también el historial de un vínculo que ya se quitó). Ni el master lee los mensajes de otros.
- **Quién escribe:** las dos, mientras haya vínculo y las dos cuentas estén activas (`puede_escribir`). Un atleta desactivado deja la conversación **solo para leer**; se reabre sola al reactivarlo (la lista dice «Esta conversación está cerrada. Solo puedes leerla.»).
- **«Visto»:** al abrir la conversación (y cada vez que llega algo estando abierta) se marcan como vistos los mensajes del otro lado (`marcar_vistos`); al autor le sale «Visto» o «Enviado» bajo su último mensaje.
- **Borrar:** cada quien borra lo SUYO, para los dos (`eliminar_mensaje`): queda «Mensaje eliminado» y se quita el archivo del bucket si lo tenía.
- **Número rojo:** los mensajes del otro lado sin ver, en «Mensajes» de la barra de abajo del atleta y en la pestaña del coach. Hasta que salga la app descargable no hay notificación del teléfono (decisión suya).
- **En vivo:** Supabase Realtime (`postgres_changes` de `mensajes` y `tecnicas`, filtrado por la cuenta; la base solo manda lo que esa cuenta puede leer). Además se vuelve a preguntar al volver a la pestaña y cada minuto.

## La base (`docs/sql/2026-10-10-mensajes.sql`)

| Pieza | Para qué |
|---|---|
| `mensajes` | el chat. `tipo`: `texto`, `foto`, `video`, `voz`, `tecnica`, `correccion`. `adjunto`: `{ ruta, mime, bytes, segundos }` en el bucket privado `mensajes`. `visto_en`, `eliminado_en`. |
| `tecnicas` | el video de técnica de una serie: ejercicio, a quién, estado (`por_revisar`, `correcta`, `corregida`), `intento_de` (el intento anterior). |
| `hay_vinculo`, `puede_escribir`, `parte_de_ruta` | los permisos (security definer). |
| `bandeja()` | una fila por conversación posible, con lo último dicho, lo sin leer y lo por revisar. |
| `marcar_vistos`, `eliminar_mensaje`, `mandar_tecnica`, `responder_tecnica` | todo lo que no es «mandar un mensaje»: la tabla no se actualiza ni se borra a mano (solo `select` e `insert` de texto, foto, video y voz). |
| bucket `mensajes` | privado, 50 MB; las rutas son `<atleta>/<profesional>/<archivo>` y se ven con direcciones firmadas. |

La migración se aplicó con `execute_sql` en cuatro pasos: `apply_migration` la rechaza («declined») por traer `drop policy` y funciones con `update`. Está probada con simulación de cuentas (`set_config('request.jwt.claims', …)` + `set local role authenticated`): sin vínculo no se escribe, no se falsifica el autor, la tarjeta de técnica no se inserta a mano, el fisio no ve la conversación del coach, el coach no responde la técnica del fisio, un atleta desactivado no escribe pero lee.

## Piezas del código

- `src/lib/mensajesApi.js`: las llamadas. `src/contexts/MensajesContext.jsx`: la bandeja, el número rojo y la conexión en vivo (con `key` por cuenta; no usa la cuenta de «Ver como»).
- `src/features/mensajes/`: `Bandeja` (la lista, con «Sin leer» y «Por revisar» para el profesional), `Conversacion`, `MensajesDelAtleta` (la pestaña de abajo), `MensajesDelCoach` (pestaña del panel: lista + conversación en la computadora, pantalla completa en el teléfono), `PantallaDeChat` (sigue a `visualViewport` para que la caja de escribir quede sobre el teclado), `piezas.jsx`, `formato.js`.

## Fotos, videos y notas de voz (segunda entrega)

- **Redactor:** el clip abre la galería o la cámara (el teléfono ofrece las dos); el micrófono (cuando no hay texto) graba una nota de voz con ✕ para tirarla y ✓ para mandarla (`useGrabadoraDeVoz`: `audio/mp4` en Safari, `audio/webm` en Chrome; la duración se mide con el reloj; se corta a los 3 minutos).
- **Preparar** (`adjuntos.js`): la foto se pasa a JPG/WebP y se achica (`optimizaImagen`, también HEIC); el video se revisa (≤ 60 s y ≤ 50 MB, con una frase que dice qué hacer si no cabe) y se le pone índice sin recodificar (`conIndice`).
- **Bucket privado `mensajes`**, 50 MB por archivo, rutas `<atleta>/<profesional>/<uuid>.<ext>`. Se ve con direcciones firmadas de una hora (`urlsFirmadas`: se piden en lote, se guardan 55 minutos y se renuevan una vez si dejan de servir). Probado con cuentas simuladas: un tercero ve 0 archivos.
- **Borrar** un mensaje con archivo también quita el archivo del bucket.
- **Vencimiento:** función `limpia-mensajes` (Edge Function, sin JWT: solo quita lo que ya venció, así que llamarla de más no daña nada) + trabajo `limpia-mensajes` de pg_cron todos los días a las 04:20 UTC por pg_net. Borra los archivos de fotos, videos, notas de voz y correcciones de más de **90 días** y los videos de técnica de más de **30**; la fila se queda con `adjunto_borrado` / `video_borrado` y el mensaje dice «La foto ya venció.». También quita las carpetas de cuentas que ya no existen. Lotes de 200 por llamada. Probada: con una foto envejecida a 91 días el archivo desapareció y la burbuja pasó a «venció».
- La voz no se pudo grabar de verdad en el panel de pruebas (no hay micrófono): se probó subiendo un `.m4a` por la misma función y escuchándolo.

## Pendiente (en este orden)

1. **Técnica:** grabarla en el entreno (también en la web), tarjeta con los dos botones, «Corregir» (texto, nota de voz, video propio, marcar el segundo), «Mandar otro intento»; vence a los 30 días; a quien puso el ejercicio en el plan.
2. Aviso a varios atletas (después), notificación del teléfono (con la app descargable).
3. Los mensajes QA entre `zz_qa_pac` y `zz_qa_fisio` quedaron en la base (el `delete` por SQL sale «declined»); borrarlos cuando se pueda.
