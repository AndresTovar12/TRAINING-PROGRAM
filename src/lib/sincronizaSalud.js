import { supabase } from '@/lib/supabase';
import { guardaImportacion, guardaPrevias } from '@/lib/metricasApi';
import { leeLoDeAntes, leeSalud, marcaSincronizada } from '@/lib/saludDelTelefono';
import { ponConexion, ponTrayendo, relojAhora } from '@/lib/relojConectado';
import { llegadosDelReloj } from '@/lib/relojSinTelefonoApi';

/* TRAER LO DEL RELOJ (fase 5, 29 oct 2026): lee Apple Salud y lo guarda en la cuenta. Lo usan `SincronizaReloj` (al abrir, al volver y al terminar un entreno
   con el reloj) y «Traer lo último ahora» de la página del reloj.

   TODO CUENTA DESDE QUE CONECTA: nunca se lee antes de `conectado_en`. Lo de antes (12 meses, solo resúmenes) se trae UNA vez, en segundo plano, a tablas
   aparte que solo usan las cuentas (`traeLoDeAntes`). */

const DIA_MS = 86400000;
const desfase = () => -new Date().getTimezoneOffset();

// La hora más nueva de cada cosa que llegó, con lo que ya se sabía: «Lo que está llegando» de la página del reloj.
function mezclaLlego(antes = {}, ahora = {}) {
  const m = { ...antes };
  Object.entries(ahora).forEach(([k, v]) => { if (v && (!m[k] || Date.parse(v) > Date.parse(m[k]))) m[k] = v; });
  return m;
}

let enCurso = null;
/**
 * Trae lo de las últimas `horas` (o de los últimos 7 días), nunca antes de conectar. Devuelve lo de `guardaImportacion` (`nuevos`, `enriquecidos`…) o `null`
 * si no hay conexión en este iPhone. Si ya hay una lectura en curso, espera esa.
 */
export async function traeDelReloj({ horas = null } = {}) {
  const { de: userId, conexion, aqui } = relojAhora();
  if (!userId || !conexion || !aqui) return null;
  if (enCurso) return enCurso;
  enCurso = (async () => {
    const conectado = Date.parse(conexion.conectado_en);
    const desde = Math.max(conectado, Date.now() - (horas ? horas * 3600000 : 7 * DIA_MS));
    // Lo que ya llegó del reloj de Training Lab no se trae otra vez de Salud (parte 3.5, ver `saltaLosDelReloj`).
    const resultado = await leeSalud({ desde, saltar: await llegadosDelReloj() });
    const r = await guardaImportacion({ atletaId: userId, subidoPor: userId, resultado, desfaseMin: desfase() });
    if (!horas) marcaSincronizada(); // solo la de 7 días cuenta para «cada 30 minutos»; la de 3 horas no la retrasa
    const llego = mezclaLlego(conexion.detalle?.llego, resultado.llego);
    await supabase.rpc('marca_sincronizacion_apple', { p_detalle: { llego } }).then(() => {}, () => {});
    ponConexion({ ...relojAhora().conexion, ultima_sincronizacion: new Date().toISOString(), detalle: { ...relojAhora().conexion?.detalle, llego } });
    return r;
  })();
  try { return await enCurso; } finally { enCurso = null; }
}

/** «Traer lo último ahora»: lo mismo, avisando que se está trayendo. */
export async function traeLoUltimo() {
  ponTrayendo(true);
  try { return await traeDelReloj(); } finally { ponTrayendo(false); }
}

/* LO DE ANTES DE CONECTAR, una sola vez por cuenta (queda `detalle.previas`).

   Hasta el 31 oct 2026 corría callado en segundo plano. Desde el 1 nov 2026, en el inicio de cuenta se corre a la vista (el «Conectando Apple Salud…» de
   `ConectaReloj`): `alAvance({ fase, hechos, total })` repite lo que avisa `leeLoDeAntes` (por cada entreno leído) y la promesa devuelve los conteos. Fuera del
   inicio (`SincronizaReloj`) se llama sin `alAvance` y sigue siendo callado.

   Solo hay una lectura a la vez: si ya hay una en curso (por ejemplo `SincronizaReloj` la arrancó al volver a la app, justo cuando se cerró la hoja de permisos
   de Salud), quien llegue después se cuelga de ESA, recibe el último aviso y espera su resultado, en vez de irse con las manos vacías.

   Nunca rechaza: devuelve `{ estado, entrenos, dias }`.
     · estado 'ya'      ya se había traído antes (`detalle.previas`): no se lee nada.
     · estado 'nada'    no hay conexión en este iPhone: no se lee nada.
     · estado 'listo'   se leyó y se guardó. `entrenos`: cuántos; `dias`: cuántos días con sueño o pulso en reposo.
     · estado 'fallo'   algo falló: se intenta la próxima vez que abra la app. `entrenos` es el conteo si ya se habían leído (si no, `null`); `dias` es `null`. */
let antes = null; // { promesa, oyentes: Set, ultimo }

export function traeLoDeAntes({ alAvance } = {}) {
  if (antes) {
    if (alAvance) { antes.oyentes.add(alAvance); if (antes.ultimo) alAvance(antes.ultimo); }
    return antes.promesa;
  }
  const { de: userId, conexion, aqui } = relojAhora();
  if (!userId || !conexion || !aqui) return Promise.resolve({ estado: 'nada', entrenos: null, dias: null });
  if (conexion.detalle?.previas) return Promise.resolve({ estado: 'ya', entrenos: null, dias: null });
  const marco = { oyentes: new Set(alAvance ? [alAvance] : []), ultimo: null, promesa: null };
  const avisa = (v) => { marco.ultimo = v; marco.oyentes.forEach((f) => { try { f(v); } catch { /* una pantalla que ya se fue */ } }); };
  marco.promesa = (async () => {
    let entrenosLeidos = null;
    try {
      const { entrenos, recuperacion } = await leeLoDeAntes({
        hasta: Date.parse(conexion.conectado_en),
        alAvance: (v) => { if (v.fase === 'recuperacion') entrenosLeidos = v.hechos; avisa(v); },
        saltar: await llegadosDelReloj(),
      });
      await guardaPrevias({ atletaId: userId, entrenos, recuperacion, desfaseMin: desfase() });
      const { error } = await supabase.rpc('marca_sincronizacion_apple', { p_detalle: { previas: true } });
      if (error) throw error;
      ponConexion({ ...relojAhora().conexion, detalle: { ...relojAhora().conexion?.detalle, previas: true } });
      // «N días»: los días en que hubo sueño o pulso en reposo (no los que solo traen pasos o variabilidad).
      return { estado: 'listo', entrenos: entrenos.length, dias: recuperacion.filter((f) => f.sueno_s || f.fc_reposo).length };
    } catch {
      return { estado: 'fallo', entrenos: entrenosLeidos, dias: null }; // la próxima vez
    } finally {
      antes = null;
    }
  })();
  antes = marco;
  return marco.promesa;
}
