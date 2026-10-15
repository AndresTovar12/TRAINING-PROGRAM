import { tokenDeAhora } from '@/lib/api';

/* LO QUE UNA PERSONA PUEDE HACER CON SU CUENTA (15 oct 2026): ver qué se llevaría borrarla, descargar sus datos y eliminarla. Ver `supabase/functions/mi-cuenta`. */

async function llama(cuerpo) {
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mi-cuenta`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: import.meta.env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${await tokenDeAhora()}` },
    body: JSON.stringify(cuerpo),
  }).catch(() => null);
  if (!res) throw new Error('No se pudo conectar. Revisa tu internet e inténtalo de nuevo.');
  const datos = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(datos?.error || 'No se pudo completar. Inténtalo de nuevo.'), { codigo: datos?.codigo });
  return datos;
}

/** Qué pasaría al borrarla: `{ es_coach, es_dueno, tiene_contrasena, atletas, membresias_activas, compradores_activos }`. */
export const resumenDeMiCuenta = () => llama({ accion: 'resumen' });

/** Todos los datos de la cuenta, como un objeto (para guardarlo en un archivo). */
export const misDatos = () => llama({ accion: 'exportar' });

/** Borra la cuenta DEFINITIVAMENTE. `confirmacion` debe ser «ELIMINAR»; `contrasena` si la cuenta tiene una. */
export const eliminaMiCuenta = ({ confirmacion, contrasena }) => llama({ accion: 'eliminar', confirmacion, contrasena });

/** Baja un objeto como archivo `.json` (sin pasar por ningún servidor). */
export function descargaComoArchivo(objeto, nombre) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(objeto, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
