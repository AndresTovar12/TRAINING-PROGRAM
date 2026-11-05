# Mi cuenta (15 oct 2026)

Andrés: «hay temas de administración que no tenemos resueltos: que alguien elimine su cuenta, administre sus suscripciones, sus contraseñas, sus dispositivos…». Mi perfil ahora tiene una pestaña **Cuenta** (`features/profile/ConfiguracionDeCuenta.jsx`).

## Hecho
- **Correo** (agregar/cambiar con código), **Contraseña**, **Sesiones** (`signOut({ scope: 'others' })`: cierra los demás aparatos), **Descargar mis datos** (JSON) y **Eliminar mi cuenta**.
- Función `mi-cuenta` (`resumen` / `exportar` / `eliminar`). Eliminar pide la contraseña (si tiene) Y escribir ELIMINAR; NO deja si es el dueño, si tiene una membresía comprada activa o —siendo profesional— compradores con membresía activa (`compras.estado` en `activa`/`gracia`). Un profesional deja a sus atletas sin coach (cuentas y planes siguen) y se lleva sus ejercicios y plantillas. Borra los PLANES antes que la cuenta (trampa conocida del historial de versiones). Probada REAL con dos cuentas desechables (atleta con plan y coach con un atleta): 0 restos en `auth.users`, `profiles` y `plans`.
- Apple lo exige para publicar: quien puede crear cuenta debe poder iniciar su eliminación desde la app.

## Compras, Cobros, Dispositivos y Avisos (15 oct 2026): pantallas listas «como si ya existiera la conexión»
Andrés: «dejala lista como si ya existiera la conexion». Las cuatro pestañas existen y leen/guardan de verdad; lo que depende de un servicio externo dice «Pronto» (nunca falla en silencio).
- **Compras** (atleta; `MisCompras.jsx`, `lib/compras.js`): planes vigentes e historial, cuándo se renueva, **Cancelar membresía** (la deja correr hasta el final del periodo; si hay `stripe_subscription_id` le avisa a Stripe) y **Pedir reembolso** dentro de los 7 días de garantía (`reembolsar`). Datos: RPC `mis_compras_resumen`.
- **Cobros** (profesional, no el dueño; `MisCobros.jsx`): estado de su cuenta de Stripe (Conectar / Terminar / Ver mis depósitos), ventas del mes y total (lo que se queda), compradores activos, comisión actual, últimos cobros, lugares a mano. Función `mi-dinero` (`estado` / `conectar` / `panel`) + RPC `mis_cobros_resumen`. SIN probar contra Stripe real (no hay cuenta de pruebas): al encender, probar con una cuenta Express de prueba.
- **Dispositivos** (`MisDispositivos.jsx`, `lib/dispositivos.js`, tabla `dispositivos_conectados`): lista de Apple Salud / Garmin / Whoop / Strava. **Desconectar funciona**; **Conectar** dice «Pronto» (`PROVEEDORES[].disponible = false`). Para encender uno: `disponible: true` + su función de conexión.
- **Avisos** (`MisAvisos.jsx`, `lib/avisos.js`, tabla `preferencias_de_avisos`): interruptores por categoría y por canal, se guardan al instante. Quien mande avisos debe leer esa fila antes de mandar. Los correos de la cuenta (recuperar contraseña) siempre salen.
- Probado en navegador (escritorio y 375 px) con respuestas simuladas, atleta y coach.

## Dispositivos: Apple Salud y Apple Watch por separado (5 nov 2026)
Andrés: «¿por qué si no tengo Apple Watch dice que lo tengo conectado?». Antes había un solo renglón, «Apple Salud y Apple Watch», que decía «Conectado» con solo tener la fila `apple_salud`. Spec: `docs/superpowers/specs/2026-11-05-integraciones-y-estado.md`, punto 1.
- **Dos renglones** en `MisDispositivos.jsx`:
  - **Apple Salud**: la conexión de la cuenta y el permiso de este iPhone (lo de la fase 5): «Conectado desde… · N entrenos · último…», «Conectado en tu otro iPhone · Conectar aquí» o «Conectar». Tocarlo abre la página de Salud/reloj (`PaginaDelReloj`, que se titula «Apple Watch» solo con reloj emparejado).
  - **Apple Watch**, con `estadoDelReloj()` leído cada vez que se abre la pantalla (`recargaDelReloj`): sin reloj, «No hay un Apple Watch con este iPhone» en gris y sin botón; emparejado sin la app, «Instala Training Lab en tu reloj» con «Cómo» (hoja: «Abre la app Watch de tu iPhone, baja a Apps disponibles y toca Instalar junto a Training Lab.»); con la app, «Listo» y, si ya llegó un entreno con pulso del reloj, «último [cuándo]» (`ultimoDelReloj`: `metricas.pulso_de = 'apple_watch'`).
  - En la web, los dos con «En la app del iPhone».
- **No hay camino para conectar el reloj**: se empareja en la app Watch de Apple, el iPhone cambia solo al reloj que se trae puesto, y la app del reloj se instala con la del iPhone. La app solo dice la verdad.
- **Lo que vio el teléfono, para el coach**: columna `dispositivos_conectados.reloj` (jsonb `{ emparejado, instalada, visto_en }`, `docs/sql/2026-11-05-dispositivos-reloj.sql`). La app la escribe al leer el reloj, solo si cambió (`relojPorApuntar` en `lib/relojConectado.js`). No la escribe con el modo de prueba ni si el plugin no contestó (`sinRespuesta` de `estadoDelReloj`). Permiso: `grant update (reloj)` + política `dispositivos_reloj_propio` (solo esa columna, solo la fila propia).
- **La regla, en toda la app: «Apple Watch» solo con `emparejado`** (en el iPhone, el de `estadoDelReloj`; para el coach y en la web, el de `reloj` de la fila, `queConecto`). Sin el dato (cuentas viejas): solo «Apple Salud». Se aplicó en: la ficha del atleta del coach («Apple Salud conectado desde… · con Apple Watch · …», la tarjeta «X conectó Apple Salud / su Apple Watch»), Home («Vuelve a conectar Apple Salud»), Recuperación y el Resumen de Mis métricas («Llegan solos de Apple Salud», «los mide un reloj», «Los datos vienen de Apple Salud»), la tarjeta del coach en Mensajes («Apple Salud conectado», «Conectar Apple Salud»), la página del entreno («Lo midió tu Apple Watch» de una fila de Salud solo con reloj) y la página de Salud/reloj (título, desconectar, «Llegó 1 entreno de…»). Lo que ya decía bien (Mis métricas, `RelojEnEntreno`, las invitaciones de Home, el inicio) no cambió.
- «Probar como si tuviera Apple Watch» (administradores) sigue igual: cuenta como reloj emparejado y con la app, y no se apunta en la cuenta.

## Falta (la lista de Andrés)
- Encender Stripe (cuenta de pruebas) y probar Compras/Cobros de verdad; redesplegar `comprar`, `stripe-webhook`, `reembolsar`.
- Conexiones reales de dispositivos y notificaciones del teléfono (con la app de la tienda).
- **Privacidad**: páginas `/privacidad` y `/terminos` (Apple y Google las piden; deben mencionar que los datos se comparten con la IA que la persona conecta) y consentimiento explícito al conectar la IA.
- Mensajes: «Reportar» y «Bloquear» (Apple, contenido de usuarios).
- «Continuar con Apple» (obligatorio si se ofrece Google en la app de tienda).
