import { supabase } from '@/lib/supabase';

/* MI VITRINA, contra la base: los planes que un coach pone a la venta (tablas `vitrina_planes` y `vitrina_versiones`, ver docs/sql/2026-10-11-monetizacion.sql).

   Un plan en venta sale de uno de «Mis planes» (`programas_guardados`). Al PUBLICAR se guarda una copia (una versión): lo que el coach siga editando en «Mis planes» no toca
   lo que ya se vende hasta que vuelva a publicar. En la etapa 1 solo el dueño tiene vitrina (lo impone la base). */

/** El precio mínimo de un plan, en pesos (Andrés, 11 oct 2026). La base lo vuelve a exigir. */
export const PRECIO_MINIMO = 500;

export const TIPOS_DE_VENTA = [
  { id: 'membresia', nombre: 'Membresía mensual' },
  { id: 'pago_unico', nombre: 'Pago único' },
];

/** Cuántas semanas hacia adelante ve el comprador (null = todo el plan). */
export const VENTANAS = [
  { valor: 2, nombre: '2 semanas' },
  { valor: 4, nombre: '1 mes' },
  { valor: 8, nombre: '2 meses' },
  { valor: 12, nombre: '3 meses' },
  { valor: null, nombre: 'Todo el plan' },
];

/** «Fuerza y potencia 12 sem.» → «fuerza-y-potencia-12-sem». Es lo que va en la liga. */
export const slugDe = (texto) => String(texto ?? '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

export const ligaPublica = (usuario, slug) => `${window.location.origin}/@${usuario}/${slug}`;

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

/** El programa guardado del que sale un plan: su nombre y sus fases (para escoger por dónde se puede entrar). */
export async function programaParaVender(programaGuardadoId) {
  const { data, error } = await supabase.from('programas_guardados').select('id, name, data').eq('id', programaGuardadoId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const fases = Array.isArray(data.data?.phases) ? data.data.phases : [];
  return {
    id: data.id,
    nombre: data.name,
    kind: data.data?.kind === 'weekly' ? 'weekly' : 'periodized',
    fases: fases.map((f, i) => ({ id: f?.id ?? `p-${i + 1}`, nombre: f?.name || f?.fullName || `Fase ${i + 1}`, semanas: Array.isArray(f?.weekData) ? f.weekData.length : 0 })),
  };
}

const CAMPOS_EDITABLES = [
  'programa_guardado_id', 'slug', 'titulo', 'descripcion', 'para_quien', 'objetivo', 'nivel', 'deportes', 'foto_url', 'tipo', 'precio_mxn',
  'fases_de_entrada', 'ventana_semanas', 'chat', 'tecnica',
];
const solo = (obj) => Object.fromEntries(CAMPOS_EDITABLES.filter((k) => obj[k] !== undefined).map((k) => [k, obj[k]]));

const mensajeDe = (error) => {
  if (error?.code === '23505') return 'Ya tienes otro plan con esa liga. Cámbiala.';
  if (error?.code === '23514') return 'Revisa los datos: el precio mínimo es $500 y la liga solo lleva letras, números y guiones.';
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
