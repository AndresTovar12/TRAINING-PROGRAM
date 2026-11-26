/* EL DIAGNÓSTICO DE CADA INTENTO DE CONECTAR APPLE SALUD (26 nov 2026). Una fila en `diagnosticos_salud` (docs/sql/2026-11-26-diagnosticos-salud.sql) con lo
   de `revisaPermiso` (`lib/saludPermiso.js`), la versión de iOS, la de la app y si hay reloj emparejado. El administrador lo ve con `ver_atleta` en el conector.
   Nunca detiene ni demora la conexión: se manda y se olvida; si falla, no pasa nada.

   La versión de iOS sale del lado nativo (`UIDevice.current.systemVersion`, que contesta el plugin EntrenoWatch en `estado`): desde iOS 26 el navegador la deja
   fija en 18.x. El `userAgent` queda solo de respaldo (builds viejos o si el plugin no contesta). La de la app, de `App.getInfo()` («1.0 (115)»). */

import { supabase } from './supabase.js';
import { estadoDelReloj } from './relojApple.js';
import { filaDeDiagnostico, versionDeIos } from './saludPermiso.js';

async function versionDeLaApp() {
  try {
    const { App } = await import('@capacitor/app');
    const i = await App.getInfo();
    return i?.version ? `${i.version}${i.build ? ` (${i.build})` : ''}` : null;
  } catch { return null; }
}

/** Anota el intento. `r`: lo de `revisaPermiso` (o de `conFallo`). `donde`: 'inicio' | 'conectar' | 'otra_vez'. */
export function anotaDiagnosticoSalud(r, donde) {
  (async () => {
    const { data } = await supabase.auth.getSession();
    const usuarioId = data?.session?.user?.id;
    if (!usuarioId) return;
    const [reloj, app] = await Promise.all([estadoDelReloj().catch(() => null), versionDeLaApp()]);
    const delNavegador = typeof navigator !== 'undefined' ? versionDeIos(navigator.userAgent) : null;
    const ios = (typeof reloj?.ios === 'string' && reloj.ios) || delNavegador;
    await supabase.from('diagnosticos_salud').insert(filaDeDiagnostico(r, { usuarioId, donde, ios, app, reloj }));
  })().catch(() => {});
}
