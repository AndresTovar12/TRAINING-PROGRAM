import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

/* Los workouts de DEMOSTRACIÓN (los que el dueño marcó en Mis planes): para quien quiere ver cómo se inicia un workout. Los lee `workouts_demo` (una función de la base abierta a toda persona
   con sesión). `null` mientras carga; lista vacía si no hay o si falla (entonces la opción «Demo workout» no sale). Cada uno: { id, name, descripcion, data, resumen, autor_id }. */
export function useDemos(userId) {
  const [demos, setDemos] = useState(null);
  useEffect(() => {
    if (!userId) return undefined;
    let vivo = true;
    supabase.rpc('workouts_demo').then(({ data, error }) => { if (vivo) setDemos(error || !Array.isArray(data) ? [] : data); });
    return () => { vivo = false; };
  }, [userId]);
  return demos;
}
