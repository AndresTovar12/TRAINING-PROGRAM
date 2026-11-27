# Compra y dinero (encargo de Andrés, 26 nov 2026)

Rama `compra-y-dinero`. Dibujos aprobados: artifact PZuUehwh5peNxBGPbLJTVf. Stripe sigue en modo de prueba.

## Interruptores (`ajustes_publicos`, Panel → Monetización)
| Clave | Qué prende | Hoy |
|---|---|---|
| `ventas_abiertas` | Que se pueda comprar (web y Apple). `comprar` y `apple` lo revisan | prendido |
| `compra_apple` | «Comprar con Apple» en la página del plan dentro del iPhone | **apagado** |
| `envios_spei` | Retirar lo vendido en iPhone (por SPEI) | **apagado** |

## El camino de una compra
- **Web.** Página del coach (`PaginaDelCoach`) → página del plan (`PaginaDelPlan`) → pago dentro de la página (`Pago`, Checkout Session con `ui_mode: 'elements'`,
  Stripe.js «endive») → `stripe-webhook` → «Compra confirmada» (`CompraLista`): cuenta → «¿Cuándo empiezas?» (`CuandoEmpiezas`) → «Descarga la app».
- **La cuenta después de pagar.** `stripe-webhook` ya no crea cuentas. Sin sesión, la compra queda pagada y apartada (`estado 'pendiente'` + `pagada_en`, sin
  atleta) y sale el correo «Tu compra de X está lista · Crear mi cuenta» (liga de 48 h; en la base solo el sha-256). `compra-lista` la deja reclamar UNA vez con la
  llave del pago (`?c=cs_…`) o la del correo (`?l=…`). La llave se guarda antes de salir a Apple/Google (`compraApi.guardaCompraPendiente`) y `App.jsx` regresa a
  «Compra confirmada» al volver. «Crear usuario y contraseña» crea la cuenta con el correo del pago (`compra-lista`, `crear_cuenta`).
- **iPhone.** Explorar abre la página del coach y del plan DENTRO de la app (nada lleva a pagar fuera). Con `compra_apple` prendido: `apple` (firmar) →
  `CompraApplePlugin.swift` (StoreKit 2, `.custom(key: "advancedCommerceData")`) → `apple` (confirmar: pide la transacción a la App Store Server API) →
  «¿Cuándo empiezas?». Las notificaciones V2 de Apple llegan a la misma función `apple`.
- **Las ligas** `/@…` y `/compra…` abren en Safari aunque la app esté instalada (`apple-app-site-association`). `ligaPublica` siempre da https.

## ¿Cuándo empiezas? (`lib/entradaAlPlan.js`)
Hoy o el lunes que viene (marcado). «Necesito terminar antes» propone la semana con las que permite el coach (`entrada_modo`, `entrada_semanas` en
`vitrina_planes`), contando desde el día de inicio elegido. Se guarda en `compras` (`inicio`, `fase_de_entrada`, `semana_de_entrada`, `fecha_meta`,
`entrada_elegida_en`). Sin elegir, sale al abrir la app (`EntradaPendiente`). «Volver a empezar» (Mis planes) usa la misma pantalla.

## El dinero del coach (`lib/dinero.js`, `libro_coach`)
- Cada cobro deja un renglón: web 80 % (fecha real de Stripe: `available_on`); iPhone ≈ precio ÷ 1.16 × 0.85 × 0.80 con la fecha estimada de su mes fiscal
  (`apple_calendario`). Andrés marca lo que pagó Apple cada mes (Monetización → Pagos de Apple) y se reparte entre las ventas de ese mes.
- Lugares: en camino · listo · retirado (· anulado). Reembolso sin retirar = anulado; ya retirado = renglón negativo que se descuenta del siguiente dinero.
- Retirar (`mi-dinero`, `retirar`): mínimo $200, ventas completas de la más vieja a la más nueva; web por Stripe (la cuenta conectada pasa a depósitos manuales),
  iPhone por SPEI (`lib/spei.js`, modo de prueba: una CLABE que termina en 0000 simula el rechazo). `payout.paid` / `payout.failed` cierran o regresan el retiro.

## Base (docs/sql)
`2026-11-26-compra-y-dinero.sql` (tablas y columnas), `2026-11-26-compra-y-dinero-paginas.sql` (perfil_publico, plan_publico, explorar_publico,
atletas_del_coach), `2026-11-26-mis-planes.sql` (mis_planes_comprados, mis_pagos). Todo aplicado.

## Lo que falta configurar para probarlo
- Web (Vercel): `VITE_STRIPE_PUBLISHABLE_KEY` (pk_test_…). Opcional `VITE_APP_STORE_URL`.
- Stripe (modo de prueba): un segundo endpoint de webhook «de cuentas conectadas» a la misma URL de `stripe-webhook` con `payout.paid` y `payout.failed`;
  su secreto en Supabase como `STRIPE_WEBHOOK_SECRET_CONNECT`.
- Apple (cuando aprueben Advanced Commerce): llave In-App Purchase (`APPLE_IAP_KEY`, `APPLE_IAP_KEY_ID`, `APPLE_ISSUER_ID`), `APPLE_BUNDLE_ID`, productos genéricos
  (`APPLE_PRODUCTO_UNICO`, `APPLE_PRODUCTO_MEMBRESIA`) y la URL de notificaciones V2 apuntando a la función `apple` (sin JWT).
- Desplegar: `comprar`, `stripe-webhook`, `compra-lista`, `mi-dinero`, `apple` (nueva, `verify_jwt: false`). Build de iOS para el plugin.

## Pruebas
`scripts/prueba-entrada.mjs`, `prueba-dinero.mjs` (también SPEI), `prueba-reclamo.mjs`, `prueba-apple.mjs`, dentro de `npm run pruebas`.
