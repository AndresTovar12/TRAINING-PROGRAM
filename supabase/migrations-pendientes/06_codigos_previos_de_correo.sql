-- APLICADA el 31 oct 2026 (solo aditiva: una tabla nueva, nada que borrar ni cambiar).
-- INICIO NUEVO: LA CUENTA NACE DESPUÉS DEL CÓDIGO (31 oct 2026).
--
-- QUÉ HACE
--   Guarda los códigos de 6 números que se mandan ANTES de que exista la cuenta. La función `correo-previo` manda el código y lo comprueba; con el código
--   bueno entrega una «ficha» de un solo uso, y `signup` (o `activar-invitacion`) la pide para crear la cuenta con ese correo YA confirmado.
--   Una fila por correo. Solo guarda la HUELLA del código y de la ficha (HMAC-SHA256 con la llave de servicio), nunca el valor.
-- QUIÉN LA VE
--   Nadie desde la app: RLS encendido y SIN políticas. Solo las funciones, con la llave de servicio.
-- QUÉ PODRÍA ROMPER: nada. Es una tabla nueva que ninguna otra parte lee.

create table if not exists public.codigos_previos (
  correo       text primary key,
  codigo_hash  text not null,
  expira_en    timestamptz not null,
  intentos     integer not null default 0,
  creado_en    timestamptz not null default now(),
  verificado_en timestamptz,
  ficha_hash   text,
  usado_en     timestamptz
);

alter table public.codigos_previos enable row level security;

revoke all on public.codigos_previos from anon, authenticated;

comment on table public.codigos_previos is 'Códigos de correo mandados antes de crear la cuenta (inicio nuevo, 31 oct 2026). Solo la llave de servicio los toca.';
