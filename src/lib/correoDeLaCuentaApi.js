import { tokenDeAhora } from '@/lib/api';

/* Poner o cambiar el correo de la propia cuenta con un código de 6 dígitos (15 oct 2026). Ver `supabase/functions/correo-de-la-cuenta`. */

async function llama(cuerpo) {
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/correo-de-la-cuenta`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: import.meta.env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${await tokenDeAhora()}` },
    body: JSON.stringify(cuerpo),
  }).catch(() => null);
  if (!res) throw new Error('No se pudo conectar. Revisa tu internet e inténtalo de nuevo.');
  const datos = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(datos?.error || 'No se pudo completar. Inténtalo de nuevo.'), { codigo: datos?.codigo });
  return datos;
}

/** Manda un código al correo nuevo. Pide la contraseña actual. */
export const pideCodigoDeCorreo = (correo, contrasena) => llama({ accion: 'pedir', correo, contrasena });

/** Con el código correcto, el correo queda puesto. Devuelve `{ correo }`. */
export const confirmaCodigoDeCorreo = (codigo) => llama({ accion: 'confirmar', codigo });
