# Garmin (API de Garmin Connect)

Fase 4 de los stickers (28 oct 2026). Lo que el reloj Garmin mide llega solo a Training Lab: Garmin le AVISA al servidor cada vez que el reloj sincroniza. Nada de archivos FIT.

## Estado

- El código está listo y desplegado: la función del servidor `garmin`, las tablas `garmin_conexiones` y `garmin_pendientes`, y el renglón de Garmin en Mi perfil → Dispositivos.
- **Falta lo de Garmin:** que aprueben la app y den sus llaves. Mientras no estén puestas, el renglón dice «Pronto» (la app le pregunta al servidor si ya hay llaves).

## Lo que tiene que hacer Andrés

### 1. Pedir acceso (como empresa, nivel «Starter», gratis)

Garmin reabrió su programa de desarrolladores el **21 de octubre de 2026**, después de unos siete meses cerrado. Ahora tiene tres niveles:

| Nivel | Para quién | Cómo llegan los datos | Historial | Precio |
|---|---|---|---|---|
| Personal | Una persona, sus propios datos | Solo pedirlos | — | Gratis (no sirve para una app) |
| **Starter** | Empresas que arman su integración | **Garmin avisa (push)** | **Nada de antes de conectar** | **Gratis, con un tope de usuarios (se dice que ~1,000)** |
| Enterprise | Empresas grandes | Avisos o pedirlos | 1 mes + | US$1,000 de entrada y luego por usuario activo al mes (desde 1 abr 2027) |

**Hay que pedir Starter.** Dónde: el portal de Garmin Connect Developer Program (developer.garmin.com → Garmin Connect Developer Program → formulario de acceso). El formulario es para «empresas, organizaciones y otras entidades comerciales» y lo debe mandar el dueño de la app. Pide:

- La **liga de la política de privacidad** de Training Lab.
- El **modelo de negocio** (cómo cobra la app).
- Cuántos usuarios esperas en 12 meses: 0–100, 100–1,000 o más de 1,000.
- La lista de **servicios de terceros** que tocarán los datos de Garmin («incluidas analítica, aprendizaje automático o IA»). Para Training Lab: **Supabase** (base de datos y servidor) y **Cloudflare** (la app). Si el conector de IA lee métricas del reloj, dilo también (ChatGPT / Claude).
- Las APIs: **Activity API** (entrenos) y **Health API** (pulso en reposo, HRV, sueño).

### 2. Cuando aprueben: dar de alta la app en el portal

En el portal de Garmin, en la app de Training Lab:

- **Dirección de regreso (redirect URI):** `https://ozwqqzrkgunrgxxwxmop.supabase.co/functions/v1/garmin`
- **Avisos (push) — la misma dirección para todos:** `https://ozwqqzrkgunrgxxwxmop.supabase.co/functions/v1/garmin`
  Encender: **Activity Details**, **Activities**, **Dailies**, **Sleeps**, **HRV**, **Deregistrations** (y User Permissions Change si lo ofrece).

### 3. Poner las llaves (las da Garmin; nunca en el repo ni en el chat)

En Supabase → Edge Functions → Secrets, agregar:

- `GARMIN_CLIENT_ID` = el «Consumer Key / Client ID» de la app en Garmin.
- `GARMIN_CLIENT_SECRET` = el «Consumer Secret / Client Secret».

En cuanto estén, el renglón de Garmin deja de decir «Pronto» y se puede conectar.

## Cómo funciona por dentro

- **Conectar:** Mi perfil → Dispositivos → Garmin → la app le pide al servidor la liga (`accion: 'conectar'`), abre la página de permiso de Garmin (OAuth 2.0 con PKCE) y Garmin regresa a la función, que guarda las llaves (solo el servidor las lee) y la conexión en `dispositivos_conectados`, y vuelve a la app (`https://app.traininglabapp.com/?garmin=conectado`; en el iPhone abre la app por su liga universal).
- **Recibir:** cada aviso de `activityDetails` / `activities` entra como fila de `actividades` con `origen = 'garmin'` (`src/lib/metricas/leeGarmin.js` → `preparaEntreno` → `construyeActividad`, el mismo camino que HealthKit): tipo, inicio, fin, duración, distancia, calorías, pulso con zonas, desnivel y ruta. Los que ya estaban (por Garmin otra vez o por Apple Salud) no se repiten. `dailies`, `sleeps` y `hrv` van a `recuperacion_diaria`, al mismo lugar que Apple Salud (la HRV de Garmin es RMSSD: va con `hrv_tipo = 'rmssd'`).
- **Desconectar:** le avisa a Garmin (`DELETE …/wellness-api/rest/user/registration`) y borra la conexión. Si la persona quita el permiso desde Garmin Connect, llega un aviso `deregistrations` y también se borra.
- **Llaves de cada persona:** duran 24 h y se renuevan solas con la de renovación (que dura ~3 meses y cambia con cada renovación).

## Sin verificar (hasta el primer aviso real)

- Los nombres de los campos de los avisos (`summary`, `samples`, `latitudeInDegree`, `heartRate`, `lastNightAvg`…) salen de la documentación de Garmin; `scripts/prueba-garmin.mjs` los prueba con avisos inventados.
- Con Starter no llega nada de antes de conectar: los entrenos empiezan a entrar desde ese día.

## Fuentes

- Guía oficial de OAuth 2.0 PKCE de Garmin: https://developerportal.garmin.com/sites/default/files/OAuth2PKCE.pdf
- Reapertura y niveles (oct 2026): https://sahha.ai/blog/garmin-connect-api-reopened-fees/
