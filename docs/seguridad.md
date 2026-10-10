# Seguridad de Training Lab: qué se revisó, qué se arregló y qué falta

**Auditoría del 10 oct 2026** (pedido de Andrés: «arregla los temas de ciberseguridad»). Se revisó la base (Supabase), las funciones del servidor, el repositorio público, las dependencias y las cabeceras de la web.

## Lo que ya estaba bien (no tocar)

- **RLS prendido en las 20 tablas**, con políticas por dueño / coach que lo atiende / master. El conector de IA habla con la sesión de quien lo usa (no con la llave de servicio).
- **Todas las funciones `SECURITY DEFINER` fijan `search_path`** y revisan `auth.uid()` por dentro (`resumen_datos_atleta` solo deja pasar al master o al coach de esa persona).
- **Entrar con usuario** pasa por la función `login`: el correo no sale nunca y el texto de error es el mismo exista o no el usuario. `email_for_login` no se puede llamar desde fuera.
- **Cabeceras** en `vercel.json`: CSP estricta (`script-src 'self'`), HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`.
- **Almacenamiento**: `avatars` y `exercise-media` con tipos y tamaño limitados y políticas por carpeta/coach. `r2-upload` valida la sesión Y que sea coach antes de firmar.
- **Tokens de invitación**: 24 bytes de `crypto.getRandomValues`.
- **Historial de git**: revisado completo (340 commits): ninguna llave de servicio ni token; solo las contraseñas de `scripts/smoke.mjs` (commit `19bc668`, ya quitadas del archivo en `f53b4d2`).

## Lo que se arregló el 10 oct 2026

| Qué | Por qué importaba | Cómo quedó |
|---|---|---|
| Función `r2-check` **pública** (sin sesión) con las claves de Cloudflare R2 | Cualquiera podía leer y reescribir la política CORS del bucket; era una utilidad de configuración que «se desarma al terminar» y nunca se desarmó (no estaba ni en el repo) | Redesplegada como un `410` y con `verify_jwt: true` (sin sesión da `401`). Para quitarla del todo: panel de Supabase → Edge Functions → `r2-check` → borrar |
| 12 funciones `SECURITY DEFINER` ejecutables **sin sesión** (aviso del linter de Supabase) | Superficie innecesaria: `/rest/v1/rpc/...` las dejaba llamar a cualquiera | Migración `quitar_ejecucion_anonima_de_funciones_definer`: `anon` ya no puede ejecutarlas; las que usa la app siguen para `authenticated` y `service_role`; los disparadores (`guardar_campos_de_poder`, `pon_codigo_coach`) y `codigo_coach_libre` quedaron cerrados. Probado con sesión (RLS, RPC, disparador) y sin sesión (`401`) |
| Dependencia **sin usar** `react-router-dom` con 2 vulnerabilidades altas | Estaba en `package.json` pero no se importaba en ningún lado | Quitada; `npm audit fix` en las herramientas de compilación: `0 vulnerabilities` |
| Contraseñas de **6 caracteres** | Demasiado cortas | Mínimo **8**, sin las más usadas, sin solo números, sin el usuario adentro (`src/lib/contrasena.js`, con `scripts/prueba-contrasena.mjs`). Se exige también en las funciones `signup` y `activar-invitacion` (v11 y v5), no solo en el navegador |
| La app **no permitía cambiar la contraseña** (solo por SQL) | Sin eso no se podían rotar las claves expuestas | «Cambiar contraseña» en **Mi perfil › Perfil** (`CambiarContrasena.jsx`): pide la actual (se comprueba con la función `login`, sin abrir otra sesión), la nueva dos veces y la guarda con Supabase Auth. Una cuenta que solo entra con Google ve «Crear contraseña» |

## Lo que falta y NO puedo hacer yo

1. **Cambiar las 3 contraseñas que estuvieron en el repositorio público** (las de `andrestovar_admin`, `andrestovar` y `coach_prueba`, commit `19bc668`). Ahora se hace desde Mi perfil › Cambiar contraseña. Quitarlas del archivo no basta: siguen en el historial público.
2. **Interruptor «Leaked password protection»** (Authentication › Sign In / Providers › Email › Password security): rechaza contraseñas que ya aparecieron en filtraciones. Es un ajuste del panel de Supabase; en algunos planes no está disponible. El linter lo marca como aviso.
3. **Limpiar el historial de git** (`git filter-repo` + `push --force`): Andrés lo pidió el 30 sep. Cambia TODOS los SHA, y el conector de IA baja su código por SHA: hay que redesplegar su `index.ts` con el SHA nuevo y probarlo, y Vercel redespliega. Aun así GitHub puede conservar los commits viejos por SHA y los forks pueden tenerlos: por eso la rotación del punto 1 es obligatoria. Sin hacer todavía (hay que confirmarlo).

## Pendientes menores (decididos a no tocar ahora)

- **CORS de las funciones**: aceptan cualquier `*.vercel.app` además de localhost. No es un hueco real (ninguna lleva cookies; `r2-upload` pide el token de un coach), pero conviene dejar solo el dominio de producción cuando haya dominio propio.
- **Registro abierto**: `signup` deja crear una cuenta de coach a cualquiera y marca el correo como confirmado sin verificarlo; no hay límite de altas. Decisión de producto (multi-coach); si hay abuso, ponerle límite por IP o verificación de correo.
- **`r2-upload`**: la URL firmada no limita el tamaño del archivo (solo un coach puede pedirla).
- **Archivo local `DATOS-R2.txt`** (en la raíz, ignorado por git, sin claves llenas): era una plantilla para la instalación de R2; se puede borrar.

## Cómo volver a revisar

- Base: `mcp get_advisors security` (esperado hoy: solo «auth_leaked_password_protection» y las funciones que la app usa con sesión).
- Funciones: `list_edge_functions` → toda función con `verify_jwt: false` debe ser a propósito (`mcp` por OAuth, `r2-upload` valida por dentro).
- Dependencias: `npm audit` (hoy 0).
- Repositorio: nada de contraseñas ni llaves en archivos; `.env` fuera de git.
