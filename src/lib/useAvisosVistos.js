import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Los avisos que esta persona ya aceptó con su «Entendido»: { clave: fecha }.
 *
 * Andrés, 2 oct 2026: los avisos de cambios del plan y de la IA «deben tener un check, de
 * que acepto y que ya no me aparezca; si no, se me acumulan». Cada aviso tiene una clave
 * propia (`plan:<versión>`): un cambio nuevo es otro aviso y vuelve a salir.
 *
 * VIVEN EN EL BLOQUE DE ESTADO DE QUIEN ACEPTA (`user_app_state.data`, llave
 * `ui:avisos-vistos`) y se guardan con `mezclar_mi_estado`, la misma puerta que usa el
 * atleta: así siguen aceptados en el teléfono, en la compu y donde entre, sin tocar la
 * base. Se mezcla llave por llave, así que no pisa nada de lo que haya ahí.
 *
 * Es para pantallas que NO están dentro de `AppStateProvider` (los paneles de los
 * profesionales). La app del atleta ya tiene su `useStorage` y lo usa directo.
 */
const LLAVE = 'ui:avisos-vistos';

// Lo ya leído por persona: otra pantalla del mismo panel no lo vuelve a pedir ni parpadea.
const leidos = new Map();

export function useAvisosVistos() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  // `null` = todavía no se sabe. Mientras tanto no se enseña ningún aviso: uno ya aceptado
  // aparecería un instante y se iría.
  const [vistos, setVistos] = useState(() => leidos.get(userId) ?? null);

  useEffect(() => {
    if (!userId) return undefined;
    let vivo = true;
    supabase.from('user_app_state').select('data').eq('user_id', userId).maybeSingle()
      .then(({ data }) => {
        if (!vivo) return;
        const guardados = data?.data?.[LLAVE];
        const lista = guardados && typeof guardados === 'object' && !Array.isArray(guardados) ? guardados : {};
        leidos.set(userId, lista);
        setVistos(lista);
      });
    return () => { vivo = false; };
  }, [userId]);

  const marcar = useCallback(async (clave) => {
    if (!userId) return;
    const ahora = new Date().toISOString();
    const pone = (lista) => { leidos.set(userId, lista); setVistos(lista); };
    pone({ ...(leidos.get(userId) ?? {}), [clave]: ahora });
    const { error } = await supabase.rpc('mezclar_mi_estado', { p_usuario: userId, p_cambios: { [LLAVE]: { [clave]: ahora } } });
    if (error) {
      // No se pudo guardar: el aviso vuelve a salir en vez de parecer aceptado y reaparecer mañana.
      const resto = { ...(leidos.get(userId) ?? {}) };
      delete resto[clave];
      pone(resto);
    }
  }, [userId]);

  return { listo: vistos !== null, visto: (clave) => !!vistos?.[clave], marcar };
}
