import { useEffect, useSyncExternalStore } from 'react';
import { supabase } from '@/lib/supabase';

/* EL ESPACIO DE VIDEOS DE QUIEN ENTRÓ, contra la base (`mi_espacio()`).

   Hay UNA sola copia en memoria y todo lo que la muestra la comparte: la barra de la pantalla de ejercicios y el chequeo previo al subir un video leen lo mismo. Cada subida
   la deja al día (la función `r2-upload` contesta con el espacio ya sumado), así que la barra se mueve sola sin volver a preguntar.

   Si la base no contesta, la copia queda como estaba: esto es información, nunca debe impedir trabajar. */
let espacio = null;
const oyentes = new Set();
const avisa = () => oyentes.forEach((f) => f());

/* Si alguien cierra sesión, su espacio no se le enseña a la siguiente persona que entre en el mismo navegador. Se engancha la primera vez que se pregunta. */
let vigilando = false;
function vigilaLaSesion() {
  if (vigilando) return;
  vigilando = true;
  supabase.auth.onAuthStateChange((evento) => {
    if (evento === 'SIGNED_OUT') { espacio = null; avisa(); }
  });
}

/** Deja al día la copia (lo llama quien subió un archivo, con lo que contestó `r2-upload`). */
export function anotaEspacio(nuevo) {
  if (!nuevo || typeof nuevo !== 'object') return;
  espacio = nuevo;
  avisa();
}

/** Pregunta a la base y deja la copia al día. Devuelve el espacio, o null si no se pudo saber. */
export async function leeMiEspacio() {
  vigilaLaSesion();
  try {
    const { data, error } = await supabase.rpc('mi_espacio');
    if (error) throw error;
    anotaEspacio(data);
    return espacio;
  } catch {
    return espacio;
  }
}

/** Para pantallas: el espacio (o null mientras se sabe) y se pregunta una vez al montar. Con `activo` en false no pregunta (por ejemplo, quien no es coach). */
export function useMiEspacio(activo = true) {
  const valor = useSyncExternalStore(
    (f) => { oyentes.add(f); return () => oyentes.delete(f); },
    () => espacio,
    () => null,
  );
  useEffect(() => {
    if (activo) leeMiEspacio();
  }, [activo]);
  return valor;
}
