# App de iPhone (TestFlight) — cómo se arma

La misma app web va dentro de un envoltorio (Capacitor). Esta Mac no tiene Xcode: la compila GitHub en la nube y la sube a TestFlight.

- Bundle ID: `com.traininglabapp.app` · Team ID: `UQ99Q69ULQ` · Solo iPhone, vertical.
- Proyecto de iPhone: `ios/` · Configuración: `capacitor.config.json` · Receta de la nube: `.github/workflows/ios-testflight.yml`.
- Para compilar: GitHub → Actions → «iOS a TestFlight» → Run workflow. Cada corrida sube un número de versión nuevo (`CURRENT_PROJECT_VERSION` = número de corrida).

## Lo que hace falta de Andrés (una sola vez)
1. App Store Connect → Apps → «+» → Nueva app: iOS, nombre «Training Lab», idioma Español (México), Bundle ID `com.traininglabapp.app` (si no sale en la lista: developer.apple.com → Identifiers → «+» → App IDs → App, mismo Bundle ID), SKU `traininglab`.
2. App Store Connect → Users and Access → Integrations → App Store Connect API → «+»: nombre `GitHub`, rol **App Manager**. Anotar **Issuer ID** y **Key ID**, y descargar el `.p8` (solo se baja UNA vez).
3. GitHub → repositorio → Settings → Secrets and variables → Actions → New repository secret, tres veces: `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_P8` (todo el texto del archivo `.p8`).

## Pendiente antes de que la app funcione de verdad dentro del teléfono
- CORS: dentro de la app el origen de la página es `capacitor://localhost`. Hay que añadirlo en las funciones de Supabase (`login`, `signup`, `mi-cuenta`, `r2-upload`, `comprar`…; unas lo leen del secreto `ALLOWED_ORIGINS`, otras tienen su lista en el código) y en el CORS del bucket de videos en Cloudflare R2.
- Icono: ahora es el de la web ampliado a 1024 px; conviene uno definitivo.
- Apple (guía 4.2): una app que es solo una página es rechazada para la tienda; TestFlight interno no la revisa, pero para publicar hay que añadir cosas propias del teléfono (GPS, avisos, Salud).
