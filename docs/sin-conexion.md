# Sin conexión: la copia en el teléfono y la cola que no se pierde

> Parte 2 del encargo del 1 nov 2026 (`docs/superpowers/specs/2026-11-01-inicio-sin-conexion-reloj.md`). La parte 3 (el Apple Watch sin el iPhone) agrega aquí lo del reloj.

**En una frase:** en la app de iPhone, lo que la persona hace sin señal se guarda primero en el teléfono y se sube solo cuando vuelve la señal. Nada se pierde, nada se duplica y una copia vieja nunca se guarda encima de lo bueno.

Solo en la app de iPhone. En la web todo funciona como antes (ver «La web»).

---

## 1. Qué se guarda en el teléfono

Todo vive en Capacitor Preferences (`UserDefaults` de iOS), no en `localStorage`: sobrevive a cerrar la app y iOS no lo borra para hacer espacio. Cada llave se escribe entera o no se escribe. Archivo: `src/lib/almacenDelTelefono.js`.

| Llave | Qué es | Quién la escribe |
|---|---|---|
| `tl:estado:<id>` | El estado del atleta: lo último que se sabe de la base (`enLaBase`) y lo pendiente encima (`pendiente`), **juntos** | `AppStateContext` |
| `tl:cola:<id>` | La cola: las cosas sueltas por subir (entrenos libres; en la parte 3, lo del reloj) | `lib/colaDelTelefono.js` |
| `tl:perfil:<id>` | El perfil | `AuthContext` |
| `tl:plan:<id>:<pieza>` | Cada pieza del plan: `programas`, `compras`, `ejercicios`, `versiones`, `medios`, `master` | `PlanContext` |
| `tl:entrenos:<id>` | La última lista de «Tus entrenos» | `useEntrenosRecientes` |

Cada llave es de UNA cuenta (`<id>` = el id de la persona).

## 2. Abrir sin señal

1. **La sesión.** Supabase deja la sesión guardada, pero su llave dura una hora. Sin señal no la puede renovar y contesta «sin sesión». Antes eso mandaba a la pantalla de entrar. Ahora, solo en la app y solo si el fallo fue de señal, se usa la sesión guardada (`AuthContext`). En cuanto vuelve la señal, Supabase la renueva sola. Si ya no sirve (se cerró desde otro aparato), Supabase avisa `SIGNED_OUT` y se sale.
   - **No se espera a Supabase.** Para renovar la llave, Supabase reintenta hasta 30 s antes de contestar (la prueba de WebKit se quedaba en «Cargando…» todo ese rato). Si la llave guardada ya venció y el teléfono dice que no tiene red, se abre de una vez con la sesión guardada; si no se sabe, se le dan 4 s.
   - Por lo mismo, **sin red ni se intenta** subir ni releer (`sinRedEnElTelefono` en `lib/senal.js`): cada intento le costaría a Supabase esos 30 s y las demás peticiones esperarían. Se espera al evento `online`. Con red pero sin internet (un wifi que no conecta) sí se intenta, con las esperas de siempre.
2. **El perfil**, de su copia.
3. **El estado**, de su copia. La app funciona normal (`confirmado` es falso, ver abajo).
4. **El plan**, de sus copias. Con señal el plan SIEMPRE se pide al servidor; la copia solo se usa sin señal.
5. **El aviso fijo de arriba:** «Sin conexión. Lo que hagas se guarda en tu teléfono y se sube solo.» (`components/SinConexion.jsx`). Sale mientras no hay señal: el teléfono dice que no tiene red, o la última petición no llegó. Es una franja oscura justo debajo de la hora del iPhone que empuja la app hacia abajo su misma altura (como el aviso de «Ver como»: un hueco arriba y `--aviso-vista`), así no tapa el saludo ni el botón de la cuenta. Las hojas (Mi perfil, el entreno) van encima de ella mientras están abiertas.

Si se sabe que no hay señal, la app abre de una vez con las copias. Si hay señal pero la base no contesta a la primera, también: no se hace esperar a nadie.

## 3. La cola: qué entra, cuándo se vacía, qué pasa con un rechazo

**Una sola cola por cuenta, con dos compartimentos:**

- **Los cambios del estado** (series marcadas, bienestar, 1RM, en qué semana va). No van como una fila de parches: son UN parche que siempre se recalcula contra lo último que se sabe de la base. Así un cambio y su corrección viajan juntos y nunca se manda un parche viejo encima de uno nuevo. Se suben con `mezclar_mi_estado`, como siempre.
- **Las cosas sueltas**, cada una con su id nacido en el teléfono: el entreno libre con su ruta (tipo `entreno-libre`) y, en la parte 3, lo que llegue del reloj. Archivos: `lib/colaDeSubida.js` (lo puro) y `lib/colaDelTelefono.js` (la de la app).

**Se vacía:**

- al abrir la app (al entrar la cuenta),
- al volver a la app (`visibilitychange` y el «resume» de iOS),
- en cuanto regresa la señal (evento `online`, o una petición que llega, o Supabase que renueva la sesión),
- y si falla por señal, a los 4, 10, 30 y luego cada 60 s (las mismas esperas de antes).

**Reglas:**

- **En orden.** De la más vieja a la más nueva. Si una no sube por falta de señal, las de atrás esperan su turno.
- **Sin duplicados.** Cada cosa trae su id desde el teléfono y se sube con *upsert* por ese id (`on conflict (id) do nothing`). Si el servidor la guardó pero la respuesta se perdió, el reintento no hace otra. Agregar dos veces el mismo id tampoco.
- **Falta de señal o rechazo** (`esFaltaDeSenal` en `lib/senal.js`). Falta de señal = la petición no salió, el servidor no pudo en ese momento (5xx, 408, 429) o la sesión no se pudo renovar (401, «JWT expired», «Sin sesión»). Todo lo demás es un rechazo.
- **Un rechazo no tapa la fila.** Esa cosa se marca, sale «No se guardó. Reintentar» y se sigue con las demás. No se reintenta sola para siempre: una vez cada vez que se abre la app, y cuando la persona toca «Reintentar». Nunca se tira en silencio: queda guardada hasta que suba o la persona la descarte (Mi perfil → «N cosas por subir»).
- **Mi perfil** dice «N cosas por subir» mientras haya pendientes (cada sesión anotada cuenta una, cada día de bienestar uno, cada entreno uno). Al tocarlo: la lista, «Reintentar ahora» y «Descartar» en lo rechazado.

**El entreno libre en la app:** «Guardar» lo mete primero a la cola (ya no depende del cronómetro) y espera hasta 8 s a que suba. Si sube, la pantalla sigue con la fila del servidor. Si no, con la fila armada en el teléfono (`pendiente: true`): la celebración y la página del entreno se ven igual, con su ruta. Sale en «Tus entrenos» junto con los demás. Si la persona le cambia el nombre o lo borra antes de que suba, se cambia o se quita en la cola.

## 4. Las reglas de seguridad (para no pisar datos buenos)

1. **Lo de la base manda.** Al volver la señal primero se relee la base, y encima va SOLO lo que la persona cambió sin señal (`rebasa` en `lib/copiaDelEstado.js`). Una copia vieja sin cambios no sube nada.
2. **Nunca contra un estado vacío.** Los parches se calculan contra la última copia conocida de la base. Si nunca se pudo leer la base y no hay copia, no se guarda nada (la regla de antes, intacta).
3. **Siempre juntos.** La base conocida y lo pendiente se guardan en el MISMO guardado. Si se guardaran aparte y la app se cerrara entre los dos, una base nueva con un estado viejo daría un parche que borra lo que llegó de otro aparato. Por lo mismo, el estado ahora vive en un almacén que cambia en el acto (`useSyncExternalStore`), no en `useState`: antes, su espejo se ponía al día un instante después de dibujar, y en ese hueco un reintento podía armar justo ese parche.
4. **El marcador va entero también al juntar.** El parche de `wr:cursor` dice «el marcador es este», no «cambia estos pedazos». Al ponerlo sobre una base nueva se reemplaza (`ponEncima`). Antes se mezclaba: el marcador movido sin señal se juntaba con la pausa que su coach puso mientras tanto. Lo encontró la prueba; también pasaba al releer la base al volver a la app.
5. **Lo que la app hace sola, no con la copia.** Mientras se dibuja con la copia (`confirmado` falso), el marcador que el calendario adelanta solo NO se guarda (`TrainingApp`). Saldría de una copia que puede tener días y pisaría el plan que su coach movió mientras tanto. Lo que se ve sí está al día. Lo que la persona hace a mano (moverse de semana, marcar series) sí se guarda.
6. **La copia del plan nunca se escribe en la base.** Solo `PlanContext` la lee, para dibujar. La app del atleta no guarda planes; el editor del coach lee el plan del servidor.

## 5. Dos aparatos (la web en la compu y el iPhone sin señal)

- Lo que la compu, su IA o su coach escribieron mientras tanto **se queda**: el parche del teléfono solo trae las llaves que el teléfono cambió.
- Lo que se borró en la compu **no revive** (el teléfono no lo trae si no lo tocó).
- Si los dos cambiaron **lo mismo** (el mismo peso de la misma serie), gana el último que llega a la base: el teléfono, al volver la señal. No hay forma de saber cuál fue después.
- Una lista se reemplaza entera (así funciona `mezclar_mi_estado`). Hoy casi todo el estado son objetos por llave; si un día dos aparatos cambian la misma lista (p. ej. `actividades:propias`), gana el último.

## 6. Cambiar de cuenta en el mismo teléfono

- Todo es por cuenta (`<id>` en la llave) y lo de una cuenta **solo se sube con su sesión**. La cola revisa la sesión antes de subir, y otra vez justo antes de escribir cada entreno.
- **Al salir con cosas por subir, se avisa:** «Tienes N cosas sin subir. No se pierden: se quedan en este teléfono y se suben solas la próxima vez que entres con esta cuenta. Mientras tanto, tu coach no las ve.» (`lib/useCerrarSesion.js`).
- Al salir se borran sus copias (perfil, plan, la base de su estado) y queda SOLO lo pendiente: el parche (sin la base) y su cola. Otra persona que entre no ve nada de eso.
- **Salir sin señal** ya funciona en la app: antes Supabase dejaba la sesión puesta y el botón parecía no hacer nada (y además tardaba hasta 30 s en rendirse). Ahora, sin red, la sesión se quita del teléfono de una vez, sin preguntarle a Supabase. (En la web sigue como antes: ahí varias pestañas comparten la sesión y Supabase les avisa a todas solo cuando sale bien.)
- Al **borrar la cuenta** se va todo lo suyo del teléfono, también la cola.

## 7. La web

La copia y la cola solo corren en la app (`conCopiaEnElTelefono()`: `Capacitor.isNativePlatform()`). En la web:

- El estado se guarda como antes: si falla por señal, sale «No se guardó. Reintentar» (ahí lo pendiente solo vive en memoria) y se reintenta con las mismas esperas.
- El entreno libre se sube directo; si falla, la pantalla lo dice y el cronómetro se queda para reintentar. Ahora también con su id y *upsert*.
- **Por qué no en la web:** el aviso «se guarda en tu teléfono» no sería cierto en una compu, y con varias pestañas abiertas dos copias se pisarían entre sí.
- **Lo único que cambia en la web:** un rechazo del servidor (no la falta de señal) ya no se reintenta solo cada minuto para siempre; se reintenta con «Reintentar» o con el siguiente cambio. Y el marcador entero al releer la base (regla 4).

## 8. La base

No hizo falta migración. Se revisó en la base:

- `actividades` y `actividad_series` tienen una sola política `ALL` (atleta con cuenta activa, master, o su coach): cubre INSERT, UPDATE y SELECT. El upsert por id funciona.
- Sin disparadores en esas dos tablas. `actividad_series` tiene su llave en `actividad_id`.
- Probado como `zz_qa_pac` (rol `authenticated` con su id), dentro de una transacción deshecha: el mismo entreno dos veces con el mismo id → 1 fila; su ruta dos veces → 1. `mezclar_mi_estado` dos veces con el mismo parche → el mismo estado; sin sesión contesta «Sin sesión».
- Un entreno con otro id pero la misma hora y duración (doble toque) choca con `(atleta_id, origen_clave)` y se toma el que ya estaba (como antes).

## 9. Cómo se prueba

- `npm run pruebas` corre `scripts/prueba-cola-de-subida.mjs` (orden, esperas 4/10/30/60 con reloj falso, sin duplicados, rechazo que no tapa, sobrevive a cerrar la app, cada cuenta la suya) y `scripts/prueba-copia-del-estado.mjs` (la base manda, nunca contra vacío, dos aparatos, borrados que no reviven, marcador entero, siempre juntos).
- `node scripts/prueba-sin-conexion-iphone.mjs`: de punta a punta en WebKit con perfil de iPhone 13 y un Supabase falso (10 pasos): abre con señal y deja la copia; abre sin señal y con la llave vencida (el plan de hoy igual y el aviso); un cambio del plan y un entreno libre con ruta quedan en el teléfono y nada llega a la base; el entreno sale en «Tus entrenos» y su página abre sin señal; «2 cosas por subir»; se cierra y se abre con señal: todo llega una vez (aunque la primera respuesta del entreno se pierda) y lo que escribió «la compu» mientras tanto se queda; sale sin señal con algo pendiente (avisa, quita sesión y copias, deja solo lo pendiente); entra otra cuenta (no ve ni sube nada de la primera); vuelve la primera y lo suyo sube a ella. No está en `npm run check` (levanta Vite y WebKit: pesado). Usa la puerta `window.__tlPruebaSinConexion`, que solo existe con `npm run dev`. «Sin señal» ahí = Supabase no contesta y `navigator.onLine` es falso (no se usa `setOffline` del contexto: cortaría también la app, que en el iPhone viene dentro del paquete).
- **Solo en un iPhone de verdad:** modo avión real, cerrar la app de verdad (deslizarla), Preferences nativo, y el «resume» de iOS.

## 10. Para la parte 3 (el Apple Watch)

- **Algo que va al servidor** (un entreno libre hecho en el reloj): registra un tipo en `src/lib/tiposDeLaCola.js` con `registraTipoDeCola('reloj-…', { sube })` y agrega con `agregaALaCola({ id, tipo, usuario, datos })` (de `lib/colaDelTelefono.js`). `id`: el del reloj (p. ej. el UUID del `HKWorkout`), para que repetirlo no duplique. `sube(cosa)` usa `cosa.id` como id en la base (upsert) y lanza el error tal cual. Pon `datos.titulo` para que Mi perfil lo nombre.
- **Algo que cambia el estado** (las series de una sesión del plan): dentro del `sube` de su tipo, `aplicaAlEstado(usuario, (store) => storeNuevo)`. Devuelve `true` cuando el cambio ya quedó en la copia del teléfono (y se sube con el resto del estado, con todas las reglas de arriba). Si devuelve `false` (la app del atleta aún no está abierta), lanza `new TodaviaNo()` (de `lib/senal.js`): la cola lo reintenta después sin avisar y sin perderlo.
- `agregaALaCola` acepta cosas de otra cuenta (lo que llega del reloj de quien ya salió): van a SU llave y esperan a que esa cuenta vuelva.
- Lo que el plugin reciba con la app cerrada tiene que quedar en disco del lado nativo; al abrir, pásalo a la cola con su id.
