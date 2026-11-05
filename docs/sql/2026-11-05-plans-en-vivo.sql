-- LOS CAMBIOS DEL PLAN LLEGAN SOLOS (5 nov 2026, punto 3 de docs/superpowers/specs/2026-11-05-integraciones-y-estado.md).
-- Andrés: «hay que salir y cerrar sesión para ver los cambios, eso está horrible». La app del atleta y el editor del coach escuchan `plans` con
-- Supabase Realtime, como ya se hace con `mensajes` (docs/sql/2026-10-10-mensajes.sql).
--
-- Quién recibe qué: Realtime revisa la política de lectura de cada quien antes de mandarle un cambio. La de `plans` (`plans_ver`, revisada el 5 nov 2026):
--   (user_id = auth.uid() AND cuenta_activa()) OR is_master() OR (is_admin() AND cuenta_activa() AND atiendo_a(user_id))
-- = los planes propios, los de los atletas que atiende un coach o un profesional del equipo, y el administrador. Nadie más.
-- (`plans_escribir`, de tipo ALL, también deja leer, pero solo a profesionales sobre atletas suyos: no abre nada nuevo.)

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'plans') then
    alter publication supabase_realtime add table public.plans;
  end if;
end $$;
