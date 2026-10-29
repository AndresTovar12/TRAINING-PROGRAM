import { supabase } from '@/lib/supabase';
import { guardaImportacion, guardaPrevias } from '@/lib/metricasApi';
import { leeLoDeAntes, leeSalud, marcaSincronizada } from '@/lib/saludDelTelefono';
import { ponConexion, ponTrayendo, relojAhora } from '@/lib/relojConectado';

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
    const resultado = await leeSalud({ desde });
    const r = await guardaImportacion({ atletaId: userId, subidoPor: userId, resultado, desfaseMin: desfase() });
    marcaSincronizada();
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

let antesEnCurso = false;
/** LO DE ANTES DE CONECTAR, una sola vez por cuenta (queda `detalle.previas`), en segundo plano. Callado: si falla, se intenta la próxima vez que abra. */
export async function traeLoDeAntes() {
  const { de: userId, conexion, aqui } = relojAhora();
  if (!userId || !conexion || !aqui || conexion.detalle?.previas || antesEnCurso) return;
  antesEnCurso = true;
  try {
    const { entrenos, recuperacion } = await leeLoDeAntes({ hasta: Date.parse(conexion.conectado_en) });
    await guardaPrevias({ atletaId: userId, entrenos, recuperacion, desfaseMin: desfase() });
    const { error } = await supabase.rpc('marca_sincronizacion_apple', { p_detalle: { previas: true } });
    if (!error) ponConexion({ ...relojAhora().conexion, detalle: { ...relojAhora().conexion?.detalle, previas: true } });
  } catch { /* la próxima vez */ } finally {
    antesEnCurso = false;
  }
}
