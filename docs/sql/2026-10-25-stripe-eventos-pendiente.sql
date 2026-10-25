-- Lote 1 de seguridad (25 oct 2026), aplicada como migración `stripe_eventos_pendiente`.
-- El webhook de Stripe marca un aviso como "pendiente" mientras lo atiende. Si la función se cae a medias,
-- el aviso queda pendiente y, cuando Stripe lo repite, se atiende completo. Los ya anotados quedan en false (= atendidos).
alter table public.stripe_eventos add column if not exists pendiente boolean not null default false;
