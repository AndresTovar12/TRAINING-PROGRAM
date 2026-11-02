-- UN MARCADOR 'nuevo' NO PISA UNO CON FASE (2 nov 2026; migración `marcador_nuevo_no_pisa`, ya aplicada en la base por el dueño, copiada aquí tal cual
-- de `pg_get_functiondef`). La app de iPhone (build 75/76) guardó «Fase 1 · Semana 1» con motivo 'nuevo' encima de «Fase 4 · Semana 6» del atleta Andrés, al
-- abrir y otra vez al volver a la app (`historial_del_marcador`, 16:28 y 16:29 UTC). 'nuevo' quiere decir «no había marcador»: si la base ya tiene uno con
-- fase (y no es otro 'nuevo'), el que llega salió de un estado a medias y se queda el de la base. Un plan de verdad nuevo no usa 'nuevo' sino 'plan-nuevo'.
-- La app hace lo mismo antes de subir (`noPisaElMarcador` en `src/lib/copiaDelEstado.js`); la causa (un efecto que calculaba el marcador antes de cargar el
-- estado) está arreglada en `useMarcadorAlDia` y `AppStateContext` (prueba: `scripts/prueba-marcador-al-abrir.mjs`). OJO: el que pierde no se entera
-- (`mezclar_mi_estado` contesta igual): la app lo corrige al releer la base. Corre ANTES de `anota_cambio_de_marcador`, así que lo frenado no se anota.

create or replace function public.marcador_nuevo_no_pisa()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
declare
  k text;
  viejo jsonb;
  nuevo jsonb;
begin
  if new.data is null or old.data is null then
    return new;
  end if;
  for k in select jsonb_object_keys(new.data) loop
    if k = 'wr:cursor' or k like 'wr:cursor@%' then
      nuevo := new.data -> k;
      viejo := old.data -> k;
      if jsonb_typeof(nuevo) = 'object' and jsonb_typeof(viejo) = 'object'
         and nuevo ->> 'motivo' = 'nuevo'
         and viejo ? 'phaseId'
         and (viejo ->> 'motivo') is distinct from 'nuevo' then
        new.data := jsonb_set(new.data, array[k], viejo);
      end if;
    end if;
  end loop;
  return new;
end;
$function$;

create trigger marcador_nuevo_no_pisa before update of data on public.user_app_state for each row execute function marcador_nuevo_no_pisa();
