# El día que se compre el dominio

Lo de los **videos** ya quedó listo. Lo demás se hace ese día, en este orden. Marcado **Tú** = Andrés (cuentas y pagos), **Yo** = Claude (código, secretos, base).

Dirección de videos actual: `https://pub-4a3ae85521d744b5abf16550ea171189.r2.dev` (limitada por Cloudflare, no sirve para producción).
Dirección nueva: `https://videos.<dominio>` (subdominio del dominio comprado).

## Qué ya está listo (no hay que escribir código)

| Pieza | Cómo queda el día del dominio |
|---|---|
| `r2-upload` | Con el secreto `R2_PUBLIC_URL`, los archivos NUEVOS salen con la dirección nueva. Reconoce las dos. |
| App (`lib/medios.js`) | Con `VITE_MEDIOS_URL` reconoce la dirección nueva y la vieja. |
| `limpia-r2` y espacio de videos | Trabajan con la **ruta** (`videos/<id>.mp4`), no con el host: no se enteran del cambio. |
| `docs/sql/dominio-de-videos.sql` | Pasa las direcciones guardadas en la base a la nueva. Probado con una dirección inventada (35 ejercicios, 10 extras, 55 portadas, 2 planes, 7 versiones), una sola transacción. |

## Pasos

### 1. Dominio y Cloudflare — **Tú** (✅ 15 oct 2026: dominio `traininglabapp.com` comprado; `videos.traininglabapp.com` conectado al bucket `training-lab-media` y su CORS ya incluye `https://app.traininglabapp.com`, hecho con `wrangler`)
1. Comprar el dominio. Lo más simple: **Cloudflare Registrar** (precio de costo, y el dominio ya queda en Cloudflare). Si se compra en otro lado, agregarlo a Cloudflare y cambiar los *nameservers*.
2. Cloudflare → **R2** → el bucket → **Settings → Custom Domains → Add** → `videos.<dominio>`. Cloudflare crea el registro solo. Esperar a que diga *Active*.
3. En el mismo bucket, **CORS policy**: agregar el origen de la app (`https://app.<dominio>`, o el que se use) con los mismos métodos y cabeceras que ya tiene el de `*.vercel.app` (`PUT` y `GET`/`HEAD` con `Range`).
4. Vercel → el proyecto → **Domains** → agregar `app.<dominio>`. Cloudflare DNS: el registro que pide Vercel, con la nubecita **gris** (solo DNS).

### 2. Secretos y publicación — **Yo**
5. Secretos de las funciones (Supabase → Edge Functions → Secrets):
   - `R2_PUBLIC_URL` = `https://videos.<dominio>`
   - `SITIO_URL` = `https://app.<dominio>`
   - `ORIGENES_EXTRA` = otros orígenes permitidos, separados por coma (por ejemplo `https://www.<dominio>`)
6. Vercel → Environment Variables: `VITE_MEDIOS_URL` = `https://videos.<dominio>`.
7. `vercel.json`: agregar `https://videos.<dominio>` al `connect-src` de la política de seguridad (el video se reproduce con `media-src https:`, pero la app también lo lee con `fetch`). Publicar.
8. **Funciones que aún solo aceptan `*.vercel.app` y `localhost`** (hay que agregarles `SITIO_URL`/`ORIGENES_EXTRA`, igual que ya tienen `r2-upload`, `comprar` y `reembolsar`, y redesplegarlas): `signup`, `login`, `activar-invitacion`, `invitar-atleta`, `admin-delete-user`, `programa-comprado`. Sin esto la app abre en el dominio pero no deja entrar ni registrarse. ✅ **HECHO 15 oct 2026**: las 7 (y `restablecer-contrasena`, que no estaba en la lista) llevan `https://app.traininglabapp.com` directo en el código y ya están desplegadas; la dirección de Vercel sigue valiendo.

### 3. Pasar lo guardado — **Yo**
9. Comprobar que `https://videos.<dominio>/videos/<un-id>.mp4` responde 200 y que `r2-upload` ya da direcciones nuevas.
10. Correr `docs/sql/dominio-de-videos.sql` con `__VIEJO__` y `__NUEVO__` reemplazados. Verificar con las 4 consultas del final del archivo (todas en 0).
11. Probar en el dominio: abrir un ejercicio con video, subir un video nuevo, ver que la barra de espacio se mueve.

### 4. Lo demás que cambia de casa — **Yo + Tú**
12. Supabase → Authentication → **URL Configuration**: *Site URL* y *Redirect URLs* con el dominio nuevo. Google (si se usa): orígenes autorizados. Los correos (confirmación, invitación) salen con esa dirección.
13. Stripe: `SITIO_URL` ya sirve para las páginas de pago. El webhook no cambia (apunta a Supabase).
14. Una semana después, con todo en orden: Cloudflare → R2 → **Public Development URL → Disable** (apaga `r2.dev`).

### 5. Mudar la app de Vercel a Cloudflare — **Yo + Tú** (decidido 14 oct 2026)
Andrés: «mañana que compre el dominio hacemos eso de mudarlo a Cloudflare». Vercel Pro cuesta 20 dólares al mes y es obligatorio al vender; en Cloudflare servir la app es gratis (verificar ese día que sus términos permiten uso comercial en el plan gratis). Si se hace, el paso 4 (dominio en Vercel) se reemplaza por esto:

15. Cloudflare → **Workers & Pages** → crear el proyecto desde el repo `AndresTovar12/TRAINING-PROGRAM` (rama `main`): construir con `npm run build`, salida `dist`, y como app de una sola página (lo que no es archivo va a `index.html`; hoy lo hace la última regla de `rewrites` en `vercel.json`).
16. Variables de la construcción: las mismas `VITE_*` que tiene Vercel (Supabase y `VITE_MEDIOS_URL`).
17. Las cabeceras de seguridad de `vercel.json` (CSP con `videos.<dominio>` en `connect-src`, `X-Frame-Options`, `Permissions-Policy`, HSTS, COOP, y el caché largo de `/assets/`) pasan a un `public/_headers`.
18. La liga del conector: `vercel.json` reenvía `/mcp` y `/.well-known/oauth-*` a la función `mcp` de Supabase. En Cloudflare eso lo hace un Worker chico (cabe en el plan gratis). Secreto `APP_URL` = `https://app.<dominio>` en la función `mcp` (de ahí salen `MCP_URL` y los metadatos OAuth) y volver a desplegarla. Las IAs ya conectadas se vuelven a conectar con la liga nueva.
19. Dominio `app.<dominio>` en el proyecto de Cloudflare (en vez de Vercel).
20. Probar en el dominio: entrar (correo y Google), registrarse, abrir un ejercicio con video, subir uno, la página pública de un plan y su botón de comprar, «Listo» tras pagar, y el conector (401 sin permiso, metadatos 200, una herramienta).
21. Vercel se queda una semana como respaldo, en el plan gratis. Con todo en orden, se apaga.

### 6. Cómo se publica la app en Cloudflare (hecho 15 oct 2026; `app.traininglabapp.com`). ✅ Ya conectado a GitHub: cada push a `main` construye y publica solo (~80 s). Variables de construcción: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_MEDIOS_URL`, `VITE_GOOGLE_LOGIN=1` (sin esta el botón de Google no se dibuja). Vercel tiene las mismas (+ `VITE_MEDIOS_URL`).
- **A mano** (hoy): en el worktree limpio, con el `.env` copiado: `npm run build && npx wrangler@latest deploy`. La redirección de `traininglabapp.com` y `www` es otro Worker que casi nunca cambia: `npx wrangler@latest deploy -c cloudflare/wrangler-redirect.jsonc`.
- **Automático con GitHub** (Workers Builds; lo conecta ÉL en el panel, porque autorizar a Cloudflare en GitHub solo lo puede dar el dueño): Workers & Pages → `training-lab-app` → Settings → Builds → Connect → GitHub → repo `AndresTovar12/TRAINING-PROGRAM`, rama `main`. Campos: *Build command* `npm ci && npm run build`; *Deploy command* `npx wrangler deploy`; *Root directory* vacío (`/`); *Variables*: `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` (los valores están en su `.env`). El nombre del Worker en el panel y el `name` de `wrangler.jsonc` (`training-lab-app`) tienen que coincidir.
- `wrangler.jsonc` vive en la RAÍZ (lo espera Workers Builds); el código del reenvío del conector y de la redirección, en `cloudflare/`. Las cabeceras de seguridad están en `public/_headers` y deben ser iguales a las de `vercel.json`.

## Si algo sale mal

- Los videos no cargan en el dominio nuevo → casi siempre falta el **CORS del bucket** (paso 3) o el `connect-src` (paso 7).
- Un coach no puede subir → revisar `ORIGENES_EXTRA`/`SITIO_URL` (CORS de `r2-upload`).
- Volver atrás: el script es simétrico. Se corre con `__VIEJO__` y `__NUEVO__` intercambiados, y `r2.dev` mientras no se apague sigue sirviendo los mismos archivos.
