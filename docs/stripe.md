# Stripe: cómo se conecta y se prueba

Lo que ya está escrito y lo que falta para cobrar de verdad. Diseño: `docs/superpowers/specs/2026-10-10-monetizacion-design.md` (local, no se sube).

## Estado

| Pieza | Estado |
|---|---|
| `comprar` (crea la compra y la página de pago; con sesión o solo con un correo) | **Desplegada (v2, 12 oct).** Sin llave de Stripe contesta «La compra todavía no está disponible» |
| `compra-lista` (la página «Listo»: estado de la compra y contraseña de quien compró sin cuenta) | **Desplegada, probada en vivo** (no necesita Stripe: solo lee la base) |
| `stripe-webhook` (activa la compra, anota el cobro, reparte, crea la cuenta de quien compró sin tenerla) | Escrita y revisada con `deno check`; **NO desplegada** hasta tener la cuenta de pruebas |
| `reembolsar` (garantía de 7 días) | Escrita; **NO desplegada** |
| Ayudas (`stripe.js`: reparto en centavos, firma del webhook, dónde vive cada dato) | Probadas sin llaves: `node scripts/prueba-stripe.mjs` |

## Lo que hace falta de Stripe (modo de pruebas, sin trámites)

1. Crear la cuenta en dashboard.stripe.com y quedarse en **modo de pruebas** (no hace falta activar la cuenta ni el SAT para esto).
2. Llave secreta de pruebas (`sk_test_…`): Developers → API keys.
3. Secretos de las funciones (Supabase → Edge Functions → Secrets, o con la herramienta de secretos):
   - `STRIPE_SECRET_KEY` = la llave de pruebas
   - `STRIPE_WEBHOOK_SECRET` = el secreto del webhook (paso 4)
   - `SITIO_URL` = `https://training-program-kappa.vercel.app` (después, el dominio propio)
4. Webhook: Developers → Webhooks → agregar endpoint
   - URL: `https://ozwqqzrkgunrgxxwxmop.supabase.co/functions/v1/stripe-webhook`
   - **Versión de la API: `2024-06-20`** (la misma que fija `stripe.js`; con otra versión algunos campos cambian de lugar)
   - Eventos: `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`, `charge.refunded`, `charge.dispute.created`
5. Desplegar `stripe-webhook` (`verify_jwt: false`: Stripe no manda sesión; lo protege la firma) y `reembolsar` (misma carpeta de cada función; ver `scripts/compartir-con-mcp.mjs --revisar` para que `stripe.js` sea idéntico en las tres).

## Comprar sin cuenta (12 oct 2026)

Quien llega desde Instagram no tiene cuenta y no se le pide antes de pagar. Camino completo:

1. Toca «Comprar» en `/@usuario/plan` → una hoja le pide **solo su correo** → `comprar` revisa el correo:
   si ya tiene cuenta de atleta, que entre primero (la compra queda en SU cuenta); si es de un coach, que use otro; si no existe, sigue.
2. `comprar` crea la compra `pendiente` **sin atleta** (con `correo_comprador`) y manda a Stripe con ese correo ya puesto.
3. Con el pago confirmado, **`stripe-webhook` crea la cuenta** (`activa()` → `aseguraCuenta()`: confirmada, contraseña al azar que nadie conoce, perfil armado, inicio pendiente en «sexo») y deja la compra a su nombre; la base crea el vínculo con el coach. Nunca se crea una cuenta antes del pago.
4. Stripe regresa a `/compra/lista?c=<id de la sesión>`. La página pregunta a `compra-lista` cada 3 s (hasta 2 min) mientras llega el aviso, luego pide **crear su contraseña** (una sola vez; solo si la cuenta la creó esta compra, nunca ha entrado y pasaron < 48 h), abre su sesión y muestra «Abrir Training Lab» y cómo instalar la app.
5. Con una cuenta que ya existía, esta página **nunca** toca su contraseña ni le abre sesión: solo dice que está listo.

Instalar: Android con el botón de Chrome; iPhone con los pasos de Compartir → Agregar a pantalla de inicio; **dentro de Instagram/TikTok no se puede instalar** (se le dice que abra la página en Safari o Chrome). La app instalada en iPhone guarda su sesión aparte: por eso la página siempre dice con qué correo entrar.

Límites conocidos (a propósito):
- Dos compras del **mismo plan** pagadas por el mismo correo sin cuenta (dos pestañas antes de que exista la cuenta) quedarían activas las dos. Raro; se arregla con un reembolso a mano.
- Si entre escribir el correo y pagar ese correo se vuelve cuenta de **coach**, el webhook falla a propósito (500, queda en los registros de Stripe) en vez de activar una compra ajena: se resuelve a mano.
- El freno de `comprar` para invitados: 5 compras abiertas por correo y 300 en total por hora.
- Aún no se puede probar de punta a punta: falta la llave de Stripe. Probado sin ella: `compra-lista` en vivo (11 comprobaciones), la base (candado «activa ⇒ con atleta», permisos de `usuario_por_correo`) y la pantalla en iPhone y Android simulados con el servidor imitado.

## Prueba de punta a punta (modo de pruebas)

Tarjeta que siempre pasa: `4242 4242 4242 4242`, cualquier fecha futura, cualquier CVC. Que falla: `4000 0000 0000 0341` (al cobrar la renovación).

1. Como dueño: «Mi vitrina» → publicar un plan.
2. Como atleta **o sin cuenta**: abrir `/@usuario/plan` → Comprar (sin cuenta: escribir un correo) → pagar con la tarjeta de pruebas.
3. Debe pasar: la compra queda `activa` con `inicio` de hoy; aparece el plan en la app del atleta con su ventana; aparece una fila en `pagos` con comisión 0 % (el dueño); aparece el atleta como suscriptor del coach.
4. Reembolso (dentro de 7 días): `reembolsar` devuelve el cobro, la compra pasa a `reembolsada` y el vínculo se cierra.
5. Renovación fallida: con la tarjeta que falla, `invoice.payment_failed` → `gracia` por 3 días.

## Lo que Stripe no deja (investigado el 11 oct 2026)

- `application_fee` (comisión de plataforma) en cuentas conectadas de México no está documentado y hay reportes de que no se permite; por eso el reparto usa **transferencias** (`transfers.create` con `source_transaction`), documentadas para México.
- Un coach nuevo recibe su primer depósito a los 7-14 días; después, unos 3 días (México).
- Stripe México exige persona física con actividad empresarial y la Constancia de Situación Fiscal para activar la cuenta real.
