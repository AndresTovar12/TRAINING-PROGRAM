import { supabase } from '@/lib/supabase';

/** Los coaches de Explorar (ver `lib/explorar.js` y `docs/sql/2026-10-12-explorar-publico.sql`): vacío mientras las ventas estén cerradas. */
export async function leeExplorar() {
  const { data, error } = await supabase.rpc('explorar_publico');
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}
