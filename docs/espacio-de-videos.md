# Espacio de videos de cada coach

Para las maestras de pilates que suben clases de una hora, y para cualquier coach con muchos videos. Decidido el 11 oct 2026: **no se comprime** (la calidad no se toca); lo que se limita es **cuánto espacio ocupa cada coach**.

## La regla (en la base, `espacio_del_coach`)

| | |
|---|---|
| Todo coach empieza con | **10 GB** (≈ 3 horas de clase en 1080p) |
| Cada cliente que le paga (compra `activa` o en `gracia`) suma | **7 GB** (≈ 2 horas) |
| El dueño (`profiles.is_owner`) | sin límite |
| Un cliente propio del coach (los que él trae) | no suma: no le deja nada a la app |
| Por archivo | **≈ 5 GB** (4,800 MiB; R2 acepta ≈ 5.3 GB en una sola subida) |

Una hora de video en 1080p pesa ≈ 3.5 GB; en 4K ≈ 11 GB (esa no cabe en un archivo: se recomienda 1080p o dos partes).
Costo para el dueño: ≈ MXN 1 al mes por hora de video guardada. Ver `Costos y margen Training Lab.xlsx`.

Para cambiar los números: `create or replace function public.espacio_del_coach` con otras dos constantes (`c_base`, `c_por_cliente`). La app y los avisos leen los números de la respuesta de la base, no los repiten. El tope por archivo vive en `lib/espacio.js` (`TOPE_POR_ARCHIVO_MB`) **y** en `r2-upload` (`TOPE_POR_ARCHIVO_BYTES`): deben coincidir.

## Qué cuenta como «usado»

Lo que sigue en uso (aparece en un ejercicio o video extra del coach) **más** lo subido hace menos de un día (puede ser un borrador abierto en el editor). Borrar un ejercicio devuelve el espacio al instante, aunque el archivo siga unos días en Cloudflare esperando a `limpia-r2`.

## Cómo funciona

1. La app (`MediaUpload`) revisa **antes de abrir el editor**: si el video pesa más de ≈ 5 GB o no cabe en lo que queda, avisa ahí mismo. Nadie edita ni espera una subida de media hora para enterarse al final.
2. `uploadExerciseMedia` pide permiso a `r2-upload` diciendo cuántos bytes pesa. La función vuelve a revisar (la regla manda ella), anota el archivo en `medios_peso` y contesta con el espacio ya sumado.
3. La barra «Espacio de videos» (arriba de la lista de ejercicios, `EspacioDeVideos.jsx`) se mueve sola. Naranja desde 80 %, roja al llenarse. No sale para el dueño.
4. `limpia-r2` quita la fila de `medios_peso` cuando borra un archivo.

Solo se frena un **video**; una foto o una portada automática nunca se queda sin subir por esto.

## Una clase completa

**«Clase» es un tipo más de lo que se guarda en Mis planes** (workout, rutina, programa, clase). Una clase es un video largo que la instructora sube **una sola vez** y usa en todas las sesiones que quiera. No hay tabla nueva: es una sesión con un campo más, `clase: { url, duracion }` (ver `src/lib/clases.js`), así que se guarda, se copia y se asigna como cualquier workout.

- **Crearla:** Mis planes → «+ Crear» → «Clase» (para quien da clases sale primero). El editor trae «Subir video», «Pegar liga» (YouTube/Vimeo) y, debajo, los Sets opcionales. Sin video no se guarda.
- **Ponerla en una sesión:** pastilla «Clase» en la sesión (a la vista para instructoras; para los demás, en el menú «Mis planes ▾» de la sesión) con «Subir video», «Pegar liga» y «De mis clases»; o «Usar workout», que ahora también lista las clases.
- **El alumno:** abre la sesión y arriba ve «Clase · 45 min» con el reproductor; al terminar, «Marcar sesión como terminada» de siempre.
- **Espacio:** el video cuenta contra el espacio del coach mientras viva en un ejercicio, un video extra o una clase (en Mis planes o en el plan de un alumno).

## Límites conocidos (a propósito)

- `bytes` lo declara la app: esto cuida el costo, no es una puerta de seguridad. Una app vieja que no lo manda se anota con 0 y pasa.
- No hay subida por partes (*multipart*): por eso el tope de ≈ 5 GB. Si hiciera falta 4K, es la siguiente pieza.
- Una clase de 3.5 GB por **datos móviles** gasta 3.5 GB del atleta. La app no lo avisa todavía; se recomienda wifi.
- Los videos subidos antes de esta regla (los del dueño y los de prueba) no están en `medios_peso`: no cuentan. Para un coach con videos viejos, habría que medirlos con una pasada (`HEAD` a cada uno).
- Los videos que ya existen **no se tocan** si un coach queda sobre su límite (por ejemplo, si pierde clientes): solo se le impide subir más.
