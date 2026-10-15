# Correos de la app (15 oct 2026)

## Cómo salen
- **Los de Supabase** (recuperar contraseña…): Authentication → Emails → SMTP Settings. Host `smtp.resend.com`, puerto `465`, usuario `resend`, contraseña = la clave de Resend, remitente de `@traininglabapp.com`. Lo puso ÉL en el panel; la clave no pasa por Claude.
- **Los de nuestras funciones** (acceso para quien compra sin cuenta, bienvenida…): irán por el MISMO SMTP con secretos `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `CORREO_REMITENTE`. Cambiar de proveedor = cambiar esos valores (y los de Supabase); las pantallas no se tocan.
- Dominio verificado en Resend con 3 registros en Cloudflare (`send`, `rsend`, `resend._domainkey`; lo hizo el botón de Cloudflare ↔ Resend).

## Etapas (decidido por Andrés: gratis hoy, sin techo después)
1. **Lanzamiento:** Resend gratis (3,000 al mes, 100 al día).
2. **Creciendo:** el mismo Resend, subiendo de plan en su página (sin tocar nada de la app).
3. **Hit:** Amazon SES (≈ US$0.10 por cada 1,000). Se cambian los valores SMTP.
Recibir: Cloudflare Email Routing (gratis) reenvía `contacto@…` a un Gmail; una bandeja real = Google Workspace cuando haga falta.

## Correos inventados (IMPORTANTE)
Quien se registra sin correo, o llega por la liga de un coach, recibe uno inventado: `usuario@sin-correo.traininglabapp.com` (subdominio NUESTRO, sin buzón). Antes era `@traininglab.app`, que **es de otra persona** (registrado desde 2023): con «recuperar contraseña», los enlaces de 16 cuentas —incluida la del dueño— le habrían llegado a ella. El 15 oct 2026 se pasaron las 16 cuentas (auth.users, auth.identities y profiles) y las 3 funciones que los inventan (`signup`, `invitar-atleta`, `activar-invitacion`). `lib/correos.js` los reconoce (los dos dominios) y «¿Olvidaste tu contraseña?» **nunca** les manda nada.

## Hecho
- «¿Olvidaste tu contraseña?» en Entrar → correo con enlace → «Pon una contraseña nueva» (`features/auth/NuevaContrasena.jsx`); enlace vencido avisa. Mismo mensaje exista o no el correo (nadie averigua quién está registrado).

- **Mi perfil → Correo** (`features/profile/CorreoDeLaCuenta.jsx` + función `correo-de-la-cuenta` + tabla `codigos_de_correo`): «Sin correo» en vez del inventado; «Agregar»/«Cambiar» pide el correo y la contraseña actual, manda un código de 6 dígitos (15 min, 5 intentos, 1 por minuto; se guarda su huella SHA-256, no el número) y al confirmarlo pone el correo. No usa `updateUser({email})` de Supabase porque pediría confirmar también en el correo VIEJO (el inventado no lo recibe nadie). Quien entró solo con Google no lo cambia aquí. El correo sale por la API de Resend (`enviarCorreo`, único lugar a cambiar si se pasa a SES) con el secreto `RESEND_API_KEY` o `SMTP_PASSWORD`; sin secreto contesta «todavía no está configurado».

## Falta
- **Acceso por correo para quien compra sin cuenta** (día de Stripe): `stripe-webhook` manda un enlace de contraseña con `generateLink({type:'recovery'})`.
- Bienvenida y recibo (el recibo lo puede mandar Stripe solo).
- Cloudflare Email Routing (lo configura ÉL; el token de wrangler no alcanza).
