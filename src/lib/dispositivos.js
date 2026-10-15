import { supabase } from '@/lib/supabase';

/* LOS DISPOSITIVOS DE UNA PERSONA (15 oct 2026): pestaña «Dispositivos» de Mi perfil. La tabla `dispositivos_conectados` guarda cuáles tiene conectados; cada quien ve y DESCONECTA los suyos.
   CONECTAR (con las claves de cada servicio) lo hará el servidor cuando exista cada conexión: hasta entonces `conectaDispositivo` contesta `NO_DISPONIBLE` y la pantalla dice «Pronto».
   Para encender uno: poner `disponible: true` aquí y escribir su función de conexión (ver `lib/wearables.js`, el contrato común de cada proveedor). */

export const PROVEEDORES = [
  { id: 'apple_salud', nombre: 'Apple Salud y Apple Watch', detalle: 'Pulso, sueño y los entrenos de tu reloj.', donde: 'telefono', disponible: false },
  { id: 'garmin', nombre: 'Garmin', detalle: 'Tus actividades y tu recuperación de Garmin Connect.', donde: 'aqui', disponible: false },
  { id: 'whoop', nombre: 'Whoop', detalle: 'Tu recuperación, esfuerzo y sueño.', donde: 'aqui', disponible: false },
  { id: 'strava', nombre: 'Strava', detalle: 'Tus carreras, rodadas y nados.', donde: 'aqui', disponible: false },
];

export async function leeMisDispositivos() {
  const { data, error } = await supabase.from('dispositivos_conectados').select('*').order('conectado_en', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Quita la conexión: se borra la fila (y con ella lo que el servidor guardó para hablar con ese servicio). */
export async function desconectaDispositivo(proveedor) {
  const { error } = await supabase.from('dispositivos_conectados').delete().eq('proveedor', proveedor);
  if (error) throw error;
}

/** Empieza a conectar uno. Devuelve la dirección donde la persona da permiso, o lanza `NO_DISPONIBLE` si esa conexión todavía no existe. */
export async function conectaDispositivo(proveedor) {
  const p = PROVEEDORES.find((x) => x.id === proveedor);
  if (!p || !p.disponible) throw Object.assign(new Error('Todavía no está disponible. Pronto.'), { codigo: 'NO_DISPONIBLE' });
  throw Object.assign(new Error('Todavía no está disponible. Pronto.'), { codigo: 'NO_DISPONIBLE' });
}
