/* EL DIAGNÓSTICO DE CADA INTENTO DE CONECTAR APPLE SALUD (26 nov 2026). Una fila en `diagnosticos_salud` (docs/sql/2026-11-26-diagnosticos-salud.sql) con lo
   de `revisaPermiso` (`lib/saludPermiso.js`), la versión de iOS y si hay reloj emparejado. El administrador lo ve con `ver_atleta` en el conector.
   Nunca detiene ni demora la conexión: se manda y se olvida; si falla, no pasa nada. */

import { supabase } from './supabase.js';
import { estadoDelReloj } from './relojApple.js';
import { filaDeDiagnostico, versionDeIos } from './saludPermiso.js';

/** Anota el intento. `r`: lo de `revisaPermiso`. `donde`: 'inicio' | 'conectar' | 'otra_vez'. */
export function anotaDiagnosticoSalud(r, donde) {
  (async () => {
    const { data } = await supabase.auth.getSession();
    const usuarioId = data?.session?.user?.id;
    if (!usuarioId) return;
    const reloj = await estadoDelReloj().catch(() => null);
    const ios = typeof navigator !== 'undefined' ? versionDeIos(navigator.userAgent) : null;
    await supabase.from('diagnosticos_salud').insert(filaDeDiagnostico(r, { usuarioId, donde, ios, reloj }));
  })().catch(() => {});
}
