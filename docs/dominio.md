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

### 1. Dominio y Cloudflare — **Tú**
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
8. **Funciones que aún solo aceptan `*.vercel.app` y `localhost`** (hay que agregarles `SITIO_URL`/`ORIGENES_EXTRA`, igual que ya tienen `r2-upload`, `comprar` y `reembolsar`, y redesplegarlas): `signup`, `login`, `activar-invitacion`, `invitar-atleta`, `admin-delete-user`, `programa-comprado`. Sin esto la app abre en el dominio pero no deja entrar ni registrarse.

### 3. Pasar lo guardado — **Yo**
9. Comprobar que `https://videos.<dominio>/videos/<un-id>.mp4` responde 200 y que `r2-upload` ya da direcciones nuevas.
10. Correr `docs/sql/dominio-de-videos.sql` con `__VIEJO__` y `__NUEVO__` reemplazados. Verificar con las 4 consultas del final del archivo (todas en 0).
11. Probar en el dominio: abrir un ejercicio con video, subir un video nuevo, ver que la barra de espacio se mueve.

### 4. Lo demás que cambia de casa — **Yo + Tú**
12. Supabase → Authentication → **URL Configuration**: *Site URL* y *Redirect URLs* con el dominio nuevo. Google (si se usa): orígenes autorizados. Los correos (confirmación, invitación) salen con esa dirección.
13. Stripe: `SITIO_URL` ya sirve para las páginas de pago. El webhook no cambia (apunta a Supabase).
14. Una semana después, con todo en orden: Cloudflare → R2 → **Public Development URL → Disable** (apaga `r2.dev`).

## Si algo sale mal

- Los videos no cargan en el dominio nuevo → casi siempre falta el **CORS del bucket** (paso 3) o el `connect-src` (paso 7).
- Un coach no puede subir → revisar `ORIGENES_EXTRA`/`SITIO_URL` (CORS de `r2-upload`).
- Volver atrás: el script es simétrico. Se corre con `__VIEJO__` y `__NUEVO__` intercambiados, y `r2.dev` mientras no se apague sigue sirviendo los mismos archivos.
