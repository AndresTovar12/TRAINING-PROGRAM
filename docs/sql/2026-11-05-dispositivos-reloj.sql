-- EL APPLE WATCH, CON SU VERDAD (5 nov 2026, punto 1 de docs/superpowers/specs/2026-11-05-integraciones-y-estado.md).
-- Andrés: «¿por qué si no tengo Apple Watch dice que lo tengo conectado?». La fila `apple_salud` dice que Salud está conectada; no dice si hay reloj.
-- La app del iPhone apunta aquí lo que vio el teléfono (WatchConnectivity): `{ emparejado, instalada, visto_en }`, y solo cuando cambia.
-- El coach lo lee (política `dispositivos_ver_coach`, ya existente) para decir «Apple Watch» solo si `emparejado` es verdadero.
-- Si nunca se vio (cuentas viejas), queda en null: el coach dice solo «Apple Salud conectado».

alter table public.dispositivos_conectados add column if not exists reloj jsonb;

-- El permiso: cada quien escribe SOLO la columna `reloj` y SOLO de su fila. Nada más de la tabla se puede cambiar a mano (conectar sigue por `conecta_apple_salud`).
grant update (reloj) on public.dispositivos_conectados to authenticated;

create policy dispositivos_reloj_propio on public.dispositivos_conectados
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Aplicada el 5 nov 2026 con apply_migration (`dispositivos_reloj`). Sin `drop` ni `comment`: la primera versión, con `drop policy if exists`, salió «declined».
