import { supabase } from '@/lib/supabase';

/* MI VITRINA, contra la base: los planes que un coach pone a la venta (tablas `vitrina_planes` y `vitrina_versiones`, ver docs/sql/2026-10-11-monetizacion.sql).

   Un plan en venta sale de uno de «Mis planes» (`programas_guardados`). Al PUBLICAR se guarda una copia (una versión): lo que el coach siga editando en «Mis planes» no toca
   lo que ya se vende hasta que vuelva a publicar. Desde el 12 oct 2026 la tiene CUALQUIER profesional (la base lo permite y le impide saltarse «Publicar»). */

export {
  PRECIO_MINIMO, TIPOS_DE_VENTA, VENTANA_MAXIMA, VENTANAS, CONTENIDOS, ETIQUETA_DE_CONTENIDO, esBiblioteca, esSuelto, precioMinimoDe, tipoDeCobroDe, textoDeContenido, slugDe, slugUnico, ligaPublica,
} from './vitrinaDatos.js';

/** ¿Ya se puede cobrar en Training Lab? Hasta que Stripe esté conectado es que no: se publica y el botón de comprar dice «Pronto». */
export async function leeVentasAbiertas() {
  const { data, error } = await supabase.rpc('ventas_abiertas');
  return !error && data === true;
}

const COLUMNAS = '*';

async function miId() {
  const { data } = await supabase.auth.getUser();
  const id = data?.user?.id;
  if (!id) throw new Error('Tu sesión expiró. Vuelve a entrar.');
  return id;
}

/** Los planes en venta de quien entró, con cuántos suscriptores tiene cada uno. */
export async function listaMiVitrina() {
  const uid = await miId();
  const [planes, compras] = await Promise.all([
    supabase.from('vitrina_planes').select(COLUMNAS).eq('coach_id', uid).order('actualizado_en', { ascending: false }),
    supabase.from('compras').select('vitrina_plan_id, estado').eq('coach_id', uid).in('estado', ['activa', 'gracia', 'por_armar']),
  ]);
  if (planes.error) throw planes.error;
  if (compras.error) throw compras.error;
  const suscriptores = new Map();
  (compras.data ?? []).forEach((c) => suscriptores.set(c.vitrina_plan_id, (suscriptores.get(c.vitrina_plan_id) ?? 0) + 1));
  return (planes.data ?? []).map((p) => ({ ...p, suscriptores: suscriptores.get(p.id) ?? 0 }));
}

/** El programa guardado del que sale un plan: su nombre, descripción y foto (de ahí se llena la ficha) y sus fases. */
export async function programaParaVender(programaGuardadoId) {
  const { data, error } = await supabase.from('programas_guardados').select('id, name, descripcion, data').eq('id', programaGuardadoId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const fases = Array.isArray(data.data?.phases) ? data.data.phases : [];
  return {
    id: data.id,
    nombre: data.name,
    descripcion: data.descripcion ?? '',
    foto: typeof data.data?.foto === 'string' ? data.data.foto : '',
    kind: data.data?.kind === 'weekly' ? 'weekly' : 'periodized',
    fases: fases.map((f, i) => ({ id: f?.id ?? `p-${i + 1}`, nombre: f?.name || f?.fullName || `Fase ${i + 1}`, semanas: Array.isArray(f?.weekData) ? f.weekData.length : 0 })),
  };
}

/**
 * Lo que se va a vender, leído de «Mis planes»: `item` es `{ id, tipo }` con `tipo` programa, rutina, workout o clase. Devuelve lo que llena la ficha (nombre, descripción, foto)
 * y lo que hace falta para armarla (`contenido`, `kind`, y la duración si es una clase). Una rutina, un workout o una clase viven en `routine_templates`; un programa en `programas_guardados`.
 */
export async function fuenteParaVender(item) {
  const tipo = item?.tipo ?? 'programa';
  if (tipo === 'programa') {
    const p = await programaParaVender(item.id);
    return p ? { ...p, contenido: 'programa', duracionClase: null } : null;
  }
  const { data, error } = await supabase.from('routine_templates').select('id, name, descripcion, data, resumen, kind').eq('id', item.id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const duracion = Number(data.data?.clase?.duracion);
  return {
    id: data.id,
    nombre: data.name,
    descripcion: data.descripcion ?? '',
    foto: typeof data.data?.foto === 'string' ? data.data.foto : '',
    kind: 'weekly',
    contenido: tipo,
    duracionClase: tipo === 'clase' && Number.isFinite(duracion) && duracion > 0 ? duracion : null,
    fases: [],
  };
}

/** Cuántas clases tiene quien entró en «Mis planes» (tipo «Clase»): las que entrarían a su biblioteca. */
export async function cuentaMisClases() {
  const uid = await miId();
  const { count, error } = await supabase.from('routine_templates').select('id', { count: 'exact', head: true })
    .eq('created_by', uid).eq('kind', 'day').filter('resumen->>clase', 'eq', 'true');
  if (error) throw error;
  return count ?? 0;
}

const CAMPOS_EDITABLES = [
  'programa_guardado_id', 'contenido', 'plantilla_id', 'slug', 'titulo', 'descripcion', 'objetivo', 'nivel', 'deportes', 'edades', 'sexo', 'equipo', 'foto_url', 'video_url', 'tipo', 'precio_mxn',
  'ventana_semanas', 'chat', 'tecnica',
];
const solo = (obj) => Object.fromEntries(CAMPOS_EDITABLES.filter((k) => obj[k] !== undefined).map((k) => [k, obj[k]]));

const mensajeDe = (error) => {
  if (error?.code === '23505') return 'Ya tienes otro plan con esa liga. Cámbiala.';
  if (error?.code === '23514') return 'Revisa los datos: el precio mínimo es $500 y el comprador ve a lo más un mes hacia adelante.';
  return error?.message ?? 'No se pudo guardar.';
};

/** Crea (sin `id`) o actualiza (con `id`) un plan en venta. Devuelve la fila guardada. */
export async function guardaPlanEnVenta({ id = null, ...campos }) {
  const uid = await miId();
  const fila = solo(campos);
  const q = id
    ? supabase.from('vitrina_planes').update(fila).eq('id', id)
    : supabase.from('vitrina_planes').insert({ ...fila, coach_id: uid });
  const { data, error } = await q.select(COLUMNAS).single();
  if (error) throw new Error(mensajeDe(error));
  return data;
}

/** «Publicar»: guarda una copia del plan de «Mis planes» como nueva versión. Devuelve el número de versión. */
export async function publicaPlan(id) {
  const { data, error } = await supabase.rpc('publicar_plan', { p_plan: id });
  if (error) throw new Error(error.message);
  return data;
}

/** Retirar un plan de la vitrina: deja de mostrarse; quien ya lo paga lo conserva. */
export async function retiraPlan(id) {
  const { error } = await supabase.from('vitrina_planes').update({ estado: 'retirado' }).eq('id', id);
  if (error) throw new Error(mensajeDe(error));
}

/** Borrar un plan que nunca se publicó. */
export async function borraBorrador(id) {
  const { error } = await supabase.from('vitrina_planes').delete().eq('id', id);
  if (error) throw new Error(mensajeDe(error));
}
