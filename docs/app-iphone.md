# App de iPhone (TestFlight) — cómo se arma

La misma app web va dentro de un envoltorio (Capacitor). Esta Mac no tiene Xcode: la compila GitHub en la nube y la sube a TestFlight.

- Bundle ID: `com.traininglabapp.app` · Team ID: `UQ99Q69ULQ` · Solo iPhone, vertical.
- Proyecto de iPhone: `ios/` · Configuración: `capacitor.config.json` · Receta de la nube: `.github/workflows/ios-testflight.yml`.
- Para compilar: GitHub → Actions → «iOS a TestFlight» → Run workflow. Cada corrida sube un número de versión nuevo (`CURRENT_PROJECT_VERSION` = número de corrida).

## Lo que hace falta de Andrés (una sola vez)
1. App Store Connect → Apps → «+» → Nueva app: iOS, nombre «Training Lab», idioma Español (México), Bundle ID `com.traininglabapp.app` (si no sale en la lista: developer.apple.com → Identifiers → «+» → App IDs → App, mismo Bundle ID), SKU `traininglab`.
2. App Store Connect → Users and Access → Integrations → App Store Connect API → «+»: nombre `GitHub`, rol **App Manager**. Anotar **Issuer ID** y **Key ID**, y descargar el `.p8` (solo se baja UNA vez).
3. GitHub → repositorio → Settings → Secrets and variables → Actions → New repository secret: `ASC_KEY_P8` (todo el texto del archivo `.p8`). El Key ID (`ANLLBDRPU8`) y el Issuer ID ya están en el workflow: no son secretos.

## Pendiente antes de que la app funcione de verdad dentro del teléfono
- ✅ CORS (hecho, 24-25 oct 2026): las funciones de Supabase aceptan `capacitor://localhost` y el bucket de videos de Cloudflare R2 también.
- Icono: ahora es el de la web ampliado a 1024 px; conviene uno definitivo.
- Apple (guía 4.2): una app que es solo una página es rechazada para la tienda; TestFlight interno no la revisa, pero para publicar hay que añadir cosas propias del teléfono (GPS, avisos, Salud).

## Mapa y GPS (27 oct 2026, auditoría del mapa)
- Parches de plugins en `patches/` (se aplican solos con `postinstall`): `@capgo/capacitor-native-map` (toques, brújula, y la CÁMARA QUE SIGUE AL CORREDOR: `followCamera` / `stopFollowCamera` en `Permissions.swift`, una sola cámara movida cuadro por cuadro; la brújula solo cambia su giro) y `@capgo/background-geolocation` (`activityType = .fitness`).
- El GPS se apaga 60 s después de que ninguna pantalla lo usa (`GRACIA_MS` en `lib/nativo.js`); el entreno guiado con pasos de 200 m o más lo mantiene vivo todo el entreno.
- Si el mapa de Apple no está listo en 8 s se usa el mapa de la web; se vuelve a intentar al minuto.
- Cómo probarlo en el teléfono: correr 2 min con «Ver mapa»: el punto azul nunca sale de la pantalla, se desliza sin saltos y el ritmo varía ±10 s/km a paso constante.
