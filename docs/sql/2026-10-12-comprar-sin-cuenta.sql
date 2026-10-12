-- COMPRAR SIN CUENTA (12 oct 2026, parte 3 del rediseño de la vitrina).
--
-- POR QUÉ. Andrés: «que llegue y quiera comprar y punto». Quien llega desde Instagram no tiene cuenta y no se la vamos a pedir ANTES de pagar: escribe su correo, paga, y la cuenta
-- se crea sola cuando el pago de verdad se hizo (la crea el webhook de Stripe, nunca el navegador). Una compra que aún no se paga no tiene dueño: por eso `atleta_id` puede ir vacío
-- mientras la compra está «pendiente» (o «cancelada»), y SOLO mientras. Una compra viva siempre tiene atleta (candado `compras_activa_con_atleta`).
--
-- QUÉ SE AGREGA A `compras`:
--   correo_comprador  el correo que escribió quien compra sin cuenta (con él se crea o se encuentra su cuenta al pagar)
--   cuenta_nueva      true si LA CREÓ esta compra: esa persona aún no tiene contraseña y la pone en la página «Listo» (una sola vez)
--   acceso_listo_en   cuándo puso esa contraseña (después de eso la liga ya no sirve para nada)
--
-- `usuario_por_correo`: la usan SOLO las funciones del servidor (service_role). Dice si un correo ya tiene cuenta y de qué tipo, para no crear una segunda ni dejar que una cuenta de
-- coach compre como atleta. Nadie con sesión (ni el público) la puede llamar: así nadie puede preguntar «¿este correo existe?» desde las herramientas del navegador.

alter table public.compras alter column atleta_id drop not null;
alter table public.compras add column if not exists correo_comprador text;
alter table public.compras add column if not exists cuenta_nueva boolean not null default false;
alter table public.compras add column if not exists acceso_listo_en timestamptz;

alter table public.compras drop constraint if exists compras_activa_con_atleta;
alter table public.compras add constraint compras_activa_con_atleta check (atleta_id is not null or estado in ('pendiente', 'cancelada'));

-- Para contar cuántas compras sin cuenta se abrieron hace poco (el freno contra quien quisiera llenar la tabla).
create index if not exists compras_sin_cuenta_recientes on public.compras (creada_en) where atleta_id is null;

comment on column public.compras.correo_comprador is 'Compra sin cuenta: el correo con el que se crea (o se encuentra) la cuenta del comprador cuando el pago se confirma.';
comment on column public.compras.cuenta_nueva is 'true si esta compra creó la cuenta del comprador: falta que ponga su contraseña en la página «Listo».';
comment on column public.compras.acceso_listo_en is 'Cuándo puso su contraseña quien compró sin cuenta. Desde entonces la liga de «Listo» ya no deja cambiarla.';

create or replace function public.usuario_por_correo(p_correo text)
returns table (id uuid, role text, is_active boolean)
language sql stable security definer set search_path = public, auth as $$
  select u.id, p.role, coalesce(p.is_active, true)
    from auth.users u left join public.profiles p on p.id = u.id
   where lower(u.email) = lower(trim(p_correo))
   limit 1;
$$;
revoke execute on function public.usuario_por_correo(text) from public, anon, authenticated;
grant execute on function public.usuario_por_correo(text) to service_role;
comment on function public.usuario_por_correo(text) is 'Solo servidor: la cuenta que tiene un correo ({id, role, is_active}) o nada. La usan comprar, stripe-webhook y compra-lista.';
