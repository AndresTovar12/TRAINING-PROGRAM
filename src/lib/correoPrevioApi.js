/* Comprobar un correo ANTES de que exista la cuenta (inicio nuevo, 31 oct 2026). Ver `supabase/functions/correo-previo`.
   Sin sesión: quien llega aquí todavía no tiene cuenta. La cuenta nace después, con la `ficha` que entrega `confirmaCodigoPrevio`. */

async function llama(cuerpo) {
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/correo-previo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: import.meta.env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
    body: JSON.stringify(cuerpo),
  }).catch(() => null);
  if (!res) throw new Error('No se pudo conectar. Revisa tu internet e inténtalo de nuevo.');
  const datos = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(datos?.error || 'No se pudo completar. Inténtalo de nuevo.'), { codigo: datos?.codigo });
  return datos;
}

/** Comprueba que el usuario (si viene) y el correo estén libres y manda el código al correo. Falla con `codigo`: USUARIO_OCUPADO, CORREO_OCUPADO, ESPERA, MUCHOS_INTENTOS. */
export const pideCodigoPrevio = (correo, usuario) => llama({ accion: 'pedir', correo, ...(usuario ? { usuario } : {}) });

/** Con el código bueno devuelve `{ ficha }`: la prueba de un solo uso de que ese correo es de quien lo escribió. Falla con `codigo` VENCIDO si el código ya no sirve. */
export const confirmaCodigoPrevio = (correo, codigo) => llama({ accion: 'confirmar', correo, codigo });
