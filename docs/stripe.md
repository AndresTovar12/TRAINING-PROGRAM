# Stripe: cómo se conecta y se prueba

Lo que ya está escrito y lo que falta para cobrar de verdad. Diseño: `docs/superpowers/specs/2026-10-10-monetizacion-design.md` (local, no se sube).

## Estado

| Pieza | Estado |
|---|---|
| `comprar` (crea la compra y la página de pago) | **Desplegada.** Sin llave de Stripe contesta «La compra todavía no está disponible» |
| `stripe-webhook` (activa la compra, anota el cobro, reparte) | Escrita y revisada con `deno check`; **NO desplegada** hasta tener la cuenta de pruebas |
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
5. Desplegar `stripe-webhook` y `reembolsar` (misma carpeta de cada función; ver `scripts/compartir-con-mcp.mjs --revisar` para que `stripe.js` sea idéntico en las tres).

## Prueba de punta a punta (modo de pruebas)

Tarjeta que siempre pasa: `4242 4242 4242 4242`, cualquier fecha futura, cualquier CVC. Que falla: `4000 0000 0000 0341` (al cobrar la renovación).

1. Como dueño: «Mi vitrina» → publicar un plan.
2. Como atleta: abrir `/@usuario/plan` → Comprar → pagar con la tarjeta de pruebas.
3. Debe pasar: la compra queda `activa` con `inicio` de hoy; aparece el plan en la app del atleta con su ventana; aparece una fila en `pagos` con comisión 0 % (el dueño); aparece el atleta como suscriptor del coach.
4. Reembolso (dentro de 7 días): `reembolsar` devuelve el cobro, la compra pasa a `reembolsada` y el vínculo se cierra.
5. Renovación fallida: con la tarjeta que falla, `invoice.payment_failed` → `gracia` por 3 días.

## Lo que Stripe no deja (investigado el 11 oct 2026)

- `application_fee` (comisión de plataforma) en cuentas conectadas de México no está documentado y hay reportes de que no se permite; por eso el reparto usa **transferencias** (`transfers.create` con `source_transaction`), documentadas para México.
- Un coach nuevo recibe su primer depósito a los 7-14 días; después, unos 3 días (México).
- Stripe México exige persona física con actividad empresarial y la Constancia de Situación Fiscal para activar la cuenta real.
