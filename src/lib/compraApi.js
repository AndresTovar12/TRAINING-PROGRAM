import { supabase } from '@/lib/supabase';

/* LA COMPRA, lado de la app (encargo «Compra y dinero», 26 nov 2026). Habla con las funciones del servidor: `comprar` (pago en la web), `compra-lista` (después de pagar:
   reclamar, otra liga, «¿Cuándo empiezas?») y `apple` (comprar con Apple en el iPhone). */

/** Llama a una función y devuelve `{ status, datos }` también con error (status 0 = sin conexión). */
async function llama(nombre, body) {
  const { data, error } = await supabase.functions.invoke(nombre, { body });
  if (!error) return { status: 200, datos: data };
  const r = error.context;
  let datos = null;
  if (typeof r?.json === 'function') { try { datos = await r.json(); } catch { /* sin cuerpo */ } }
  return { status: typeof r?.status === 'number' ? r.status : 0, datos };
}
const falla = (status, datos, porDefecto) => {
  const e = new Error(datos?.error || (status === 0 ? 'No hay conexión. Revisa tu internet e inténtalo otra vez.' : porDefecto));
  e.codigo = datos?.codigo ?? null;
  e.status = status;
  return e;
};

/** Un interruptor del dueño (`ventas_abiertas`, `compra_apple`, `envios_spei`): true solo si está encendido. */
export async function leeAjuste(clave) {
  const { data } = await supabase.from('ajustes_publicos').select('valor').eq('clave', clave).maybeSingle();
  return data?.valor === true;
}

/** Empieza el pago dentro de la página (Stripe Elements). Devuelve `{ client_secret, compra_id }`. */
export async function iniciaPagoIncrustado({ usuario, slug }) {
  const { status, datos } = await llama('comprar', { usuario, slug, modo: 'incrustado' });
  if (status !== 200 || !datos?.client_secret) throw falla(status, datos, 'No se pudo empezar el pago. Inténtalo otra vez.');
  return datos;
}

/** Cómo va una compra con su llave: `{ sesion }` (cs_… del pago) o `{ llave }` (la del correo). */
export async function leeCompra(llaves) {
  const { status, datos } = await llama('compra-lista', llaves);
  if (status === 200) return datos;
  return status === 404 ? { estado: 'desconocida' } : { estado: 'sin_conexion' };
}

/** La cuenta con sesión se queda la compra. Devuelve el id de la compra; si no se puede, lanza el error con su `codigo` (ya_usada, vencida, no_pagada, no_atleta). */
export async function reclamaCompra(llaves) {
  const { status, datos } = await llama('compra-lista', { ...llaves, reclamar: true });
  if (status !== 200 || !datos?.ok) throw falla(status, datos, 'No se pudo guardar tu compra. Inténtalo otra vez.');
  return datos.compra_id;
}

/** «Mandarme otra liga»: va solo al correo del pago. Devuelve el correo tapado («di•••@gmail.com»). */
export async function reenviaLiga(llaves) {
  const { status, datos } = await llama('compra-lista', { ...llaves, reenviar: true });
  if (status !== 200 || !datos?.ok) throw falla(status, datos, 'No se pudo mandar la liga. Inténtalo otra vez.');
  return datos.correo;
}

/** Lo que necesita «¿Cuándo empiezas?» de una compra propia. */
export async function datosDeEntrada(compraId) {
  const { status, datos } = await llama('compra-lista', { compra_id: compraId, datos_entrada: true });
  if (status !== 200) throw falla(status, datos, 'No se pudo leer tu plan.');
  return datos;
}

/** Guarda cuándo empieza y desde qué semana (también «Volver a empezar»). */
export async function guardaEntrada(compraId, { inicio, semana = 1, fechaMeta = null }) {
  const { status, datos } = await llama('compra-lista', { compra_id: compraId, entrada: { inicio, semana, fecha_meta: fechaMeta } });
  if (status !== 200 || !datos?.ok) throw falla(status, datos, 'No se pudo guardar. Inténtalo otra vez.');
}

/** Comprar con Apple (solo en el iPhone): pide la firma al servidor, abre la hoja de Apple y confirma. Devuelve el id de la compra, o null si la persona la cerró. */
export async function compraConApple({ usuario, slug }) {
  const { status, datos } = await llama('apple', { accion: 'firmar', usuario, slug });
  if (status !== 200 || !datos?.datos) throw falla(status, datos, 'La compra con Apple no está disponible.');
  const { CompraApple } = await import('@/lib/compraAppleNativa');
  const r = await CompraApple.comprar({ producto: datos.producto, datos: datos.datos, cuenta: datos.cuenta });
  if (r?.cancelada) return null;
  if (r?.pendiente) throw Object.assign(new Error('Tu compra está esperando aprobación. Te avisamos cuando esté lista.'), { codigo: 'pendiente' });
  const c = await llama('apple', { accion: 'confirmar', compra_id: datos.compra_id, transaccion: r.transaccion });
  if (c.status !== 200 || !c.datos?.ok) throw falla(c.status, c.datos, 'Apple no confirmó la compra. Si se te cobró, escríbenos.');
  return datos.compra_id;
}

/** «Crear usuario y contraseña» después de pagar: la cuenta nace con el correo del pago y ya con la compra. Devuelve el usuario con el que entra. */
export async function creaCuentaDeCompra(llaves, { usuario, contrasena }) {
  const { status, datos } = await llama('compra-lista', { ...llaves, crear_cuenta: { usuario, contrasena } });
  if (status !== 200 || !datos?.ok) throw falla(status, datos, 'No se pudo crear tu cuenta. Inténtalo otra vez.');
  return datos.usuario;
}

/* LA LLAVE SOBREVIVE A APPLE Y GOOGLE. Al entrar con Apple o Google la página se va y vuelve a la raíz del sitio; la llave del pago se guarda aquí antes de salir y,
   al volver con sesión, la app regresa a «Compra confirmada» para reclamar la compra. Dura lo mismo que la llave (48 h). */
const LLAVE_PENDIENTE = 'tl:compra-pendiente';
export function guardaCompraPendiente(llaves) {
  try { localStorage.setItem(LLAVE_PENDIENTE, JSON.stringify({ ...llaves, t: Date.now() })); } catch { /* sin almacenamiento */ }
}
export function compraPendiente() {
  try {
    const x = JSON.parse(localStorage.getItem(LLAVE_PENDIENTE) ?? 'null');
    if (!x || Date.now() - Number(x.t) > 48 * 3600 * 1000) return null;
    return x.sesion ? { sesion: x.sesion } : x.llave ? { llave: x.llave } : null;
  } catch { return null; }
}
export function olvidaCompraPendiente() {
  try { localStorage.removeItem(LLAVE_PENDIENTE); } catch { /* nada */ }
}
/** La dirección de «Compra confirmada» para esas llaves. */
export const ligaDeCompra = (llaves) => (llaves.sesion ? `/compra/lista?c=${encodeURIComponent(llaves.sesion)}` : `/compra/lista?l=${encodeURIComponent(llaves.llave)}`);

/** «Restaurar compras» (solo iPhone): las membresías vigentes de este Apple ID se ponen al día en la cuenta. Devuelve cuántas. */
export async function restauraComprasDeApple() {
  const { CompraApple } = await import('@/lib/compraAppleNativa');
  const r = await CompraApple.restaurar();
  const { status, datos } = await llama('apple', { accion: 'restaurar', transacciones: r?.transacciones ?? [] });
  if (status !== 200 || !datos?.ok) throw falla(status, datos, 'No se pudieron restaurar tus compras. Inténtalo otra vez.');
  return datos.restauradas ?? 0;
}
