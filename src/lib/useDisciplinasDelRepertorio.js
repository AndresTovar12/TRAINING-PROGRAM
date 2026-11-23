import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { disciplinasPorUso } from '@/lib/disciplinas';
import { disciplinasDe } from '@/lib/hibrido';

/**
 * EL BUSCADOR POR DISCIPLINA (Andrés, 21 nov 2026, al ver el buscador de Gym con calentamientos, Bici y Correr revueltos entre Back squat y
 * Dominadas). Las Disciplinas de cada ejercicio son las de su FICHA (el cuadro «Disciplinas»); si la ficha no dice, las que se marcan solas por
 * dónde se ha usado (el mismo cálculo que la ficha y el Híbrido). Devuelve `primero(ejercicio)`: verdadero si es de la Disciplina de la sesión.
 * En una sesión «Libre» (o sin Disciplina) no hay nada que poner arriba: `null`, y el buscador queda como siempre (A-Z).
 */
export function useDisciplinasDelRepertorio(repertoire = []) {
  const [porUso, setPorUso] = useState({});
  useEffect(() => {
    let vivo = true;
    Promise.resolve(supabase.from('plans').select('data'))
      .then(({ data }) => { if (vivo) setPorUso(Object.fromEntries((repertoire ?? []).map((e) => [e.id, disciplinasPorUso(data ?? [], e)]))); })
      .catch(() => {});
    return () => { vivo = false; };
  }, [repertoire]);
  return porUso;
}

export function usePrimeroDeLaDisciplina(repertoire, familia) {
  const porUso = useDisciplinasDelRepertorio(repertoire);
  return useMemo(() => {
    if (!familia || familia === 'libre') return null;
    return (e) => disciplinasDe(e, porUso[e?.id] ?? []).includes(familia);
  }, [porUso, familia]);
}
