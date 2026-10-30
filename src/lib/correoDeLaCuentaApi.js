import { tokenDeAhora } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { olvidaCorreoPorConfirmar } from '@/lib/correos';

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

/** Confirmar con el código y dejar la app al día: lo usan Mi perfil → Correo y el inicio («Escribe el código»). La sesión guarda el correo viejo, así que se
    renueva para que toda la app vea el nuevo, y se olvida el correo que faltaba confirmar. Devuelve `{ correo }`; si falla lanza el error de `confirmaCodigoDeCorreo`. */
export async function confirmaCorreoConCodigo(codigo, { refreshProfile } = {}) {
  const r = await confirmaCodigoDeCorreo(codigo);
  await supabase.auth.refreshSession().catch(() => {});
  await refreshProfile?.();
  olvidaCorreoPorConfirmar();
  return r;
}
