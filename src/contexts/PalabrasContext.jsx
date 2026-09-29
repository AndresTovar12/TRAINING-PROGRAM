import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { esDeSalud, traduce } from '@/lib/palabras';

/* Quién atiende a esta persona, y si es de salud.

   - Un profesional (rol admin): ella misma; se lee su propio oficio.
   - Un atleta / paciente: su coach; se lee el oficio de su coach (la base deja
     leerlo: `profiles_select_scoped` incluye `id = my_coach_id()`).

   La respuesta del coach se recuerda en el teléfono: sin eso, cada vez que un
   paciente abre la app vería «plan» un instante y luego «programa». */
const Ctx = createContext({ salud: false, coach: null, t: (x) => x });

const CLAVE = (id) => `tl:atiende:${id}`;
const leeCache = (id) => {
  try { return JSON.parse(localStorage.getItem(CLAVE(id)) || 'null'); } catch { return null; }
};
const guardaCache = (id, datos) => {
  try { localStorage.setItem(CLAVE(id), JSON.stringify(datos)); } catch { /* sin almacenamiento: no pasa nada */ }
};

export function PalabrasProvider({ perfil, children }) {
  const esPro = perfil?.role === 'admin';
  const idDelCoach = esPro ? null : (perfil?.coach_id ?? null);
  // id de coach -> { profesion, full_name } ya leído en esta sesión
  const [leidos, setLeidos] = useState({});

  useEffect(() => {
    if (!idDelCoach) return undefined;
    let cancelado = false;
    supabase.from('profiles').select('profesion, full_name').eq('id', idDelCoach).maybeSingle()
      .then(({ data }) => {
        if (cancelado || !data) return;
        guardaCache(idDelCoach, data);
        setLeidos((prev) => ({ ...prev, [idDelCoach]: data }));
      });
    return () => { cancelado = true; };
  }, [idDelCoach]);

  const value = useMemo(() => {
    const coach = esPro
      ? { profesion: perfil?.profesion ?? null, full_name: perfil?.full_name ?? null }
      : (idDelCoach ? (leidos[idDelCoach] ?? leeCache(idDelCoach)) : null);
    const salud = esDeSalud(coach?.profesion);
    return { salud, coach, t: (x) => traduce(x, salud) };
  }, [esPro, perfil?.profesion, perfil?.full_name, idDelCoach, leidos]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** `{ t, salud, coach }`: `t('Mis atletas')` → «Mis pacientes» si atiende un fisio. */
// eslint-disable-next-line react-refresh/only-export-components
export const usePalabras = () => useContext(Ctx);
