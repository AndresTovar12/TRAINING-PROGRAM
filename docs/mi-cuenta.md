# Mi cuenta (15 oct 2026)

Andrés: «hay temas de administración que no tenemos resueltos: que alguien elimine su cuenta, administre sus suscripciones, sus contraseñas, sus dispositivos…». Mi perfil ahora tiene una pestaña **Cuenta** (`features/profile/ConfiguracionDeCuenta.jsx`).

## Hecho
- **Correo** (agregar/cambiar con código), **Contraseña**, **Sesiones** (`signOut({ scope: 'others' })`: cierra los demás aparatos), **Descargar mis datos** (JSON) y **Eliminar mi cuenta**.
- Función `mi-cuenta` (`resumen` / `exportar` / `eliminar`). Eliminar pide la contraseña (si tiene) Y escribir ELIMINAR; NO deja si es el dueño, si tiene una membresía comprada activa o —siendo profesional— compradores con membresía activa (`compras.estado` en `activa`/`gracia`). Un profesional deja a sus atletas sin coach (cuentas y planes siguen) y se lleva sus ejercicios y plantillas. Borra los PLANES antes que la cuenta (trampa conocida del historial de versiones). Probada REAL con dos cuentas desechables (atleta con plan y coach con un atleta): 0 restos en `auth.users`, `profiles` y `plans`.
- Apple lo exige para publicar: quien puede crear cuenta debe poder iniciar su eliminación desde la app.

## Falta (la lista de Andrés)
- **Compras** (atleta) y **Cobros** (coach): ver qué compró / cuándo se renueva / cancelar / reembolso; ver Stripe, ventas y depósitos. Va con el día de Stripe (#51). Mientras, quien tiene membresía activa no puede borrar su cuenta y el mensaje manda a contacto@traininglabapp.com.
- **Dispositivos**: no hay conexión real con Apple Watch/Garmin/Whoop (solo se importan archivos); la pantalla llega con la conexión.
- **Avisos** (qué notificaciones recibir): llega con las notificaciones push.
- **Privacidad**: páginas `/privacidad` y `/terminos` (Apple y Google las piden; deben mencionar que los datos se comparten con la IA que la persona conecta) y consentimiento explícito al conectar la IA.
- Mensajes: «Reportar» y «Bloquear» (Apple, contenido de usuarios).
- «Continuar con Apple» (obligatorio si se ofrece Google en la app de tienda).
