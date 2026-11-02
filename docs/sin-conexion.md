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
| `tl:cola:<id>` | La cola: las cosas sueltas por subir (entrenos libres y, desde la parte 3, lo que llegó del Apple Watch) | `lib/colaDelTelefono.js` |
| `tl:perfil:<id>` | El perfil | `AuthContext` |
| `tl:plan:<id>:<pieza>` | Cada pieza del plan: `programas`, `compras`, `ejercicios`, `versiones`, `medios`, `master` | `PlanContext` |
| `tl:entrenos:<id>` | La última lista de «Tus entrenos» | `useEntrenosRecientes` |
| `tl:reloj:llegados` | Los UUID de los entrenos que ya llegaron del reloj (para no traerlos otra vez de Salud). De todo el teléfono, como Salud | `lib/relojSinTelefonoApi.js` |

Cada llave es de UNA cuenta (`<id>` = el id de la persona), salvo `tl:reloj:llegados`.

Fuera de Preferences, en disco del lado nativo (parte 3): lo que el reloj mandó y todavía no pasa a la cola (`Application Support/TrainingLab/del-reloj/<id>.json`, lo escribe `ReceptorDelReloj` en `EntrenoWatchPlugin.swift`).

**Nada espera al teléfono más de 3 s (2 nov 2026).** Preferences contesta en milisegundos. Si un día no contestara, quien espera sigue sin el teléfono: una lectura da «no hay copia», un guardado o un borrado «no se pudo», las llaves ninguna. Es una salida de emergencia, no un avance por tiempo. Una llave que no se pudo leer **no se pisa ni se borra** hasta que se vuelva a abrir la app: puede guardar lo que falta subir y quien escribiría encima no lo vio. Lo mismo con el reloj (`lib/relojApple.js`): ninguna llamada a su plugin se espera más de 3 s.

**Trampa que ya mordió dos veces (Salud el 29 oct, Preferences el 2 nov 2026):** un plugin de Capacitor NO se devuelve desnudo de una promesa (`import(…).then((m) => m.Plugin)`, o `return Plugin` en una función `async`). Al resolverla, JavaScript le pregunta por `.then`, el «proxy» de Capacitor lo toma por un método nativo que no existe («"Preferences.then()" is not implemented on ios») y la promesa no contesta nunca. Se pasa dentro de un objeto: `{ Preferences: m.Preferences }`. Builds 72-74: la primera lectura del teléfono (la copia del perfil) se quedaba esperando y la app no pasaba de «Cargando tu perfil…». En la web no pasaba: ahí no se usa Preferences.

## 2. Abrir sin señal

1. **La sesión.** Supabase deja la sesión guardada, pero su llave dura una hora. Sin señal no la puede renovar y contesta «sin sesión». Antes eso mandaba a la pantalla de entrar. Ahora, solo en la app y solo si el fallo fue de señal, se usa la sesión guardada (`AuthContext`). En cuanto vuelve la señal, Supabase la renueva sola. Si ya no sirve (se cerró desde otro aparato), Supabase avisa `SIGNED_OUT` y se sale.
   - **No se espera a Supabase.** Para renovar la llave, Supabase reintenta hasta 30 s antes de contestar (la prueba de WebKit se quedaba en «Cargando…» todo ese rato). Si la llave guardada ya venció y el teléfono dice que no tiene red, se abre de una vez con la sesión guardada; si no se sabe, se le dan 4 s.
   - Por lo mismo, **sin red ni se intenta** subir ni releer (`sinRedEnElTelefono` en `lib/senal.js`): cada intento le costaría a Supabase esos 30 s y las demás peticiones esperarían. Se espera al evento `online`. Con red pero sin internet (un wifi que no conecta) sí se intenta, con las esperas de siempre.
2. **El perfil**, de su copia. Si en 15 s no hay perfil (de la copia o del servidor), «Cargando tu perfil…» ofrece «Reintentar» y «Salir»; si llega después, entra igual (`lib/cargaDelPerfil.js`).
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
5. **Lo que la app hace sola, no con la copia.** Mientras se dibuja con la copia (`confirmado` falso), el marcador que el calendario adelanta solo NO se guarda (`useMarcadorAlDia`). Saldría de una copia que puede tener días y pisaría el plan que su coach movió mientras tanto. Lo que se ve sí está al día. Lo que la persona hace a mano (moverse de semana, marcar series) sí se guarda.
6. **La copia del plan nunca se escribe en la base.** Solo `PlanContext` la lee, para dibujar. La app del atleta no guarda planes; el editor del coach lee el plan del servidor.
7. **El marcador no se calcula antes de tener el estado (2 nov 2026).** Al atleta Andrés la app de iPhone (build 75/76) le guardó «Fase 1 · Semana 1» con motivo `'nuevo'` encima de «Fase 4 · Semana 6», en cada apertura. La carrera: el plan llega antes que el estado; React dibuja con el plan listo y el estado sin cargar (`useStorage('wr:cursor')` da null); `confirmado` era verdadero (solo decía «no es la copia»), así que el efecto del marcador sacó «no hay marcador → el primero del plan». Ese efecto corre después de dibujar: si en medio llega la base, escribía su `'nuevo'` encima del estado recién leído, y se subía. Medido en WebKit con la app de verdad y un Supabase falso (1 de cada 3 aperturas con la copia); también puede pasar en la web. Arreglo, en tres capas:
   - `confirmado` exige el estado cargado, y `loaded` es de la cuenta que se cargó (`AppStateContext`).
   - El efecto del marcador (`useMarcadorAlDia`) solo escribe si el marcador de ahora sigue siendo el que vio al dibujar.
   - **La misma regla que la base:** un marcador `'nuevo'` (o borrado) nunca se sube encima de uno con fase (`noPisaElMarcador`); la pantalla vuelve al de la base. En la base lo frena el disparador `marcador_nuevo_no_pisa` (`docs/sql/2026-11-02-marcador-nuevo-no-pisa.sql`). Ojo: si la base lo frena, `mezclar_mi_estado` contesta igual y la app no se entera hasta releer.
8. **Lo que la app movió sola no se impone sobre una base que cambió (2 nov 2026).** El marcador que la app adelanta (`'calendario'`, `'reparado'`, `'plan-nuevo'`, `'nuevo'`) se puede volver a sacar de la base en cualquier momento. Al juntar lo pendiente con una base recién leída (`rebasa`, y al abrir con la copia), si el marcador de la base ya no es el que se conocía, gana la base (`pendienteQueManda`). Y antes de SUBIR un marcador movido solo se relee la base (una lectura; pasa al abrir y una vez por semana). Lo que la persona movió a mano (`'atleta'`) sigue la regla de siempre: gana el último que llega. Así, un teléfono con la copia mala (cree que la base tiene `'nuevo'`) sana solo al abrir con la app nueva.

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
- `npm run pruebas` corre `scripts/prueba-marcador-al-abrir.mjs` (reglas 7 y 8): el `AppStateContext` y el `useMarcadorAlDia` de verdad, cargados con Vite en Node, con React de verdad sobre un DOM mínimo y una base falsa que contesta cuando la prueba dice. Fuerza la carrera del arranque (la base contesta en el dibujo del plan, antes de sus efectos), en iPhone y en web; con el código del 2 nov sube `f1/1 nuevo`. Además: cuenta nueva sí recibe su primer marcador; lo adelantado solo en el teléfono no pisa al de su coach (al abrir y al volver a la app); lo movido a mano sí sube; un `'nuevo'` nunca sube encima de uno con fase; y un teléfono con la copia mala sana solo.
- `npm run pruebas` también corre `scripts/prueba-arranque.mjs`: el `@capacitor/core` y el `@capacitor/preferences` de verdad sobre un puente de iOS falso, con reloj falso. La copia del perfil llega del teléfono sin mover el reloj (la prueba que fallaba con el build 74), Preferences mudo → a los 3 s se sigue sin copia, una llave que no se leyó no se pisa, y la carga del perfil: a los 3 s pide al servidor, a los 15 s «Reintentar» y «Salir», y si el perfil llega tarde entra igual.
- `node scripts/prueba-arranque-iphone.mjs`: la app entera en WebKit con perfil de iPhone 13, un puente nativo falso (SIN `__tlPruebaSinConexion`: la copia pasa por Preferences, como en el teléfono) y un Supabase falso. Preferences contesta → entra sin esperar ningún tope y deja la copia escrita; Preferences mudo → entra a los 3 s; nada contesta → a los 15 s «Reintentar» y «Salir», y «Salir» saca de la cuenta. No está en `npm run check` (pesado).
- **Solo en un iPhone de verdad:** modo avión real, cerrar la app de verdad (deslizarla), el Preferences nativo de verdad (las pruebas usan un puente falso con los mismos métodos), y el «resume» de iOS.

## 10. Lo del Apple Watch (parte 3, 1 nov 2026)

El reloj entrena sin el iPhone y lo que termina llega aquí, a la MISMA cola. El camino completo está en `docs/entreno-y-reloj.md`, sección 10. Lo que toca a esta cola:

1. **El reloj lo manda** con `transferUserInfo` (Apple lo guarda y lo entrega aunque el iPhone esté lejos, apagado o con la app cerrada). Antes de mandarlo lo guarda en su propio disco, y lo borra cuando WatchConnectivity dice que llegó: si la app del reloj se cierra en medio, lo manda otra vez al abrirse.
2. **El iPhone lo guarda en disco al recibirlo**, del lado nativo, aunque la web no esté corriendo: `ReceptorDelReloj` (en `EntrenoWatchPlugin.swift`) se activa en `AppDelegate`, antes que la web.
3. **Al abrir la app** (y al volver a ella, y en cuanto llega si ya está abierta), `recibeLoDelReloj` (`lib/relojSinTelefonoApi.js`) le pide al plugin lo que tiene (`pendientes`), revisa cada uno (`leeResultado`), anota su UUID en `tl:reloj:llegados`, lo mete a la cola con `agregaALaCola` y SOLO si quedó guardado le dice al plugin que lo borre (`confirma`). Lo que el plugin ya confirmó no se vuelve a entregar aunque el reloj lo mande dos veces.
4. **La cola lo sube** con sus reglas de siempre (en orden, esperas 4/10/30/60 s, un rechazo no tapa la fila).

**Cada cosa lleva el UUID de su `HKWorkout`** (el entreno que el reloj guardó en Salud) como id de la cola y como id de la fila en la base: repetirla no la duplica. Si Salud no lo guardó (sin permiso en el reloj), un UUID propio del reloj.

**Tres tipos** (`lib/tiposDeLaCola.js`):

| Tipo | Qué es | Cómo sube |
|---|---|---|
| `entreno-libre` | Un entreno libre hecho en el reloj: es un entreno libre más (el mismo tipo que el del iPhone) | `subeEntrenoLibre`, upsert por id. Mientras está en la cola sale en «Tus entrenos» como los demás (`conPendientes`) |
| `reloj-sesion` | Una sesión del plan hecha en el reloj | Sus series al estado del atleta con `aplicaAlEstado` (se suben con el resto del estado, con las reglas de la sección 4); si la app del atleta aún no está abierta, `TodaviaNo`. Luego su pulso y su ruta a `actividades` (`guardaImportacion`, con su id) |
| `reloj-pulso` | El pulso de un entreno que guio el iPhone (el reloj acompañó) | `guardaImportacion` con su id: le pone el pulso al entreno del iPhone o, en una sesión del plan, guarda la fila del reloj |

**Se aplica una sola vez.** Las series de una sesión llevan `delReloj.id` en el registro: si la cola la reintenta, `aplicaSesionDelReloj` ve que ya está (también en `anteriores`) y no cambia nada. La fila de `actividades` con ese id ya existe: `guardaImportacion` la ve como «repetida» y no hace otra.

**De quién es.** El plan que llega al reloj trae el id de la cuenta (`usuario`), y el reloj lo devuelve con cada entreno: va a la cola de ESA cuenta aunque en el iPhone haya entrado otra (espera a que vuelva, como cualquier cosa de otra cuenta). Si el reloj nunca tuvo plan, es de la cuenta que entró; si no ha entrado nadie, espera en el plugin.

**Sin señal al volver** (paso 6 de la parte 3.7): lo del reloj entra a la cola igual, se ve en «Tus entrenos» y en su sesión del plan, Mi perfil lo cuenta en «N cosas por subir» (con su nombre: `datos.titulo`) y sube solo al volver la señal.

**«{quien} ya lo ve».** Cuando una cosa del reloj sube, la cola avisa (`alSubirDeLaCola`) y la app se lo dice al reloj (`avisaAlRelojQueSubio`): su pantalla final pasa de «Ya está en tu iPhone» a «Carlos ya lo ve». Una sesión del plan espera además a que su estado quede guardado (`delEstado` en 0): sus series viajan con el estado.
