import { supabase } from '@/lib/supabase';

/* LOS DISPOSITIVOS DE UNA PERSONA (15 oct 2026): pestaña «Dispositivos» de Mi perfil. La tabla `dispositivos_conectados` guarda cuáles tiene conectados; cada quien ve y DESCONECTA los suyos.
   CONECTAR (con las claves de cada servicio) lo hará el servidor cuando exista cada conexión: hasta entonces `conectaDispositivo` contesta `NO_DISPONIBLE` y la pantalla dice «Pronto».
   Para encender uno: poner `disponible: true` aquí y escribir su función de conexión (ver `lib/wearables.js`, el contrato común de cada proveedor).
   GARMIN (fase 4 de los stickers, 28 oct 2026): lo hace la función del servidor `garmin` (ver `supabase/functions/garmin/servidor.ts`). Está disponible cuando el
   servidor ya tiene las llaves de Garmin (`garminDisponible`); mientras, el renglón dice «Pronto». */

export const PROVEEDORES = [
  { id: 'apple_salud', nombre: 'Apple Salud y Apple Watch', detalle: 'Pulso, sueño y los entrenos de tu reloj.', donde: 'telefono', disponible: typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.() },
  { id: 'garmin', nombre: 'Garmin', detalle: 'Tus actividades y tu recuperación de Garmin Connect.', donde: 'aqui', disponible: false },
  { id: 'whoop', nombre: 'Whoop', detalle: 'Tu recuperación, esfuerzo y sueño.', donde: 'aqui', disponible: false },
  { id: 'strava', nombre: 'Strava', detalle: 'Tus carreras, rodadas y nados.', donde: 'aqui', disponible: false },
];

export async function leeMisDispositivos() {
  const { data, error } = await supabase.from('dispositivos_conectados').select('*').order('conectado_en', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** ¿Ya se puede conectar Garmin? (el servidor tiene las llaves del Garmin Connect Developer Program). Si no se sabe (sin red), no. */
export async function garminDisponible() {
  try {
    const { data } = await supabase.functions.invoke('garmin', { body: { accion: 'estado' } });
    return !!data?.disponible;
  } catch {
    return false;
  }
}

/** Quita la conexión: se borra la fila (y con ella lo que el servidor guardó para hablar con ese servicio). Garmin, además, le avisa a Garmin que ya no mande nada. */
export async function desconectaDispositivo(proveedor) {
  if (proveedor === 'garmin') {
    const { error } = await supabase.functions.invoke('garmin', { body: { accion: 'desconectar' } });
    if (error) throw new Error('No se pudo desconectar Garmin. Inténtalo otra vez.');
    return;
  }
  const { error } = await supabase.from('dispositivos_conectados').delete().eq('proveedor', proveedor);
  if (error) throw error;
}

/** Empieza a conectar uno. Devuelve la dirección donde la persona da permiso, o lanza `NO_DISPONIBLE` si esa conexión todavía no existe. */
export async function conectaDispositivo(proveedor) {
  // Garmin: el servidor arma la liga a la página de permiso de Garmin (OAuth con PKCE); al terminar, Garmin regresa a la app (`?garmin=conectado`).
  if (proveedor === 'garmin') {
    const { data, error } = await supabase.functions.invoke('garmin', { body: { accion: 'conectar' } });
    if (data?.url) return { url: data.url };
    const cuerpo = await error?.context?.json?.().catch(() => null);
    if (cuerpo?.codigo === 'NO_DISPONIBLE') throw Object.assign(new Error('Todavía no está disponible. Pronto.'), { codigo: 'NO_DISPONIBLE' });
    throw new Error(cuerpo?.error || 'No se pudo conectar Garmin. Inténtalo otra vez.');
  }
  const p = PROVEEDORES.find((x) => x.id === proveedor);
  if (!p || !p.disponible) throw Object.assign(new Error('Todavía no está disponible. Pronto.'), { codigo: 'NO_DISPONIBLE' });
  throw Object.assign(new Error('Todavía no está disponible. Pronto.'), { codigo: 'NO_DISPONIBLE' });
}
