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

## Falta (la lista de Andrés)
- Encender Stripe (cuenta de pruebas) y probar Compras/Cobros de verdad; redesplegar `comprar`, `stripe-webhook`, `reembolsar`.
- Conexiones reales de dispositivos y notificaciones del teléfono (con la app de la tienda).
- **Privacidad**: páginas `/privacidad` y `/terminos` (Apple y Google las piden; deben mencionar que los datos se comparten con la IA que la persona conecta) y consentimiento explícito al conectar la IA.
- Mensajes: «Reportar» y «Bloquear» (Apple, contenido de usuarios).
- «Continuar con Apple» (obligatorio si se ofrece Google en la app de tienda).
