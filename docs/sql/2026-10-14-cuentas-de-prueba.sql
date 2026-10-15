-- «CUENTAS DE PRUEBA» (14 oct 2026).
--
-- Andrés: «me trae loco que para comprobar varias cosas necesito hacer cuentas de prueba, las borro, me olvido de la contraseña… que en mi panel yo pueda ver las contraseñas de cada cuenta».
-- Las contraseñas REALES nunca se pueden leer (Supabase las guarda con un cifrado de un solo sentido) y no debe cambiar: quien entrara a la cuenta del dueño vería la de todos.
-- Lo que sí se guarda a la vista del dueño son las contraseñas de las cuentas de PRUEBA, que son desechables y no tienen datos de nadie. Solo el dueño las lee (RLS).
-- Una cuenta es «de prueba» por su usuario: empieza con `zz_` (la costumbre de siempre: zz_qa_fisio, zz_prueba_atleta_1…).

create table if not exists public.cuentas_de_prueba (
  user_id uuid primary key references auth.users (id) on delete cascade,
  contrasena text not null check (char_length(contrasena) between 8 and 72),
  tipo text not null check (tipo in ('atleta', 'coach', 'fisio')),
  creada_en timestamptz not null default now()
);

comment on table public.cuentas_de_prueba is 'Contraseñas VISIBLES, solo de cuentas de prueba (usuario zz_*), solo para el dueño. Nunca guardar aquí la contraseña de una persona real.';

alter table public.cuentas_de_prueba enable row level security;
create policy cuentas_de_prueba_dueno on public.cuentas_de_prueba for all to authenticated using (public.is_master()) with check (public.is_master());
revoke all on public.cuentas_de_prueba from anon;
