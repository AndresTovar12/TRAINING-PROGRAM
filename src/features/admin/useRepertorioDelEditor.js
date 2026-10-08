import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePalabras } from '@/contexts/PalabrasContext';
import { conLasMiasPrimero } from '@/lib/categorias';
import {
  listExercises, getMasterId, tagRepertoire, listCategories, listExerciseOverrides, aplicarOverrides,
} from '@/lib/api';

/**
 * Lo que necesita cualquier editor de sesiones para trabajar: el repertorio de ejercicios y las
 * categorías que ve esta persona. Estaba dentro del editor de planes; ahora lo comparte con el de
 * workouts de «Mis planes».
 *
 * REPERTORIO: cada coach ve la base del master + los suyos (no los de otros coaches); el master ve
 * todo. Encima se aplican SUS versiones de los ejercicios base: si personalizó el video de la
 * sentadilla, al armar un plan tiene que ver el suyo, no el del master.
 *
 * CATEGORÍAS: se ofrecen las de la app y las propias, no las de otros coaches (que el master sí
 * puede leer). Ver SelectorCategoria. Un profesional de salud ve primero las suyas.
 *
 * REPERTORIO APAGADO: si el coach apagó «Ejercicios de Training Lab» (Mi perfil, `repertorio_base`), aquí no salen ni
 * los ejercicios ni las categorías de la app: solo lo suyo. Los planes que ya los usan no cambian (se resuelven por id).
 */
export function useRepertorioDelEditor() {
  const { user, profile } = useAuth();
  const isMaster = !!profile?.is_owner;
  const { salud: ofrecerPrimeroLasMias } = usePalabras();
  const [repertoire, setRepertoire] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [masterIdCat, setMasterIdCat] = useState(null);

  const sinBase = !isMaster && profile?.repertorio_base === false;
  const categoriasVisibles = useMemo(() => {
    const lista = categorias.filter((c) => (sinBase ? c.created_by === user?.id : (!c.created_by || c.created_by === masterIdCat || c.created_by === user?.id)));
    return ofrecerPrimeroLasMias ? conLasMiasPrimero(lista, user?.id) : lista;
  }, [categorias, masterIdCat, user?.id, ofrecerPrimeroLasMias, sinBase]);

  useEffect(() => {
    Promise.all([listExercises(), getMasterId(), listCategories(), listExerciseOverrides(user?.id)])
      .then(([exs, mId, cats, mias]) => {
        const tagged = tagRepertoire(aplicarOverrides(exs, mias, cats), mId, user?.id);
        setRepertoire(isMaster ? tagged : tagged.filter((e) => (e.isBase && !sinBase) || e.isMine));
        setCategorias(cats);
        setMasterIdCat(mId);
      })
      .catch(() => {});
  }, [user?.id, isMaster, sinBase]);

  return { repertoire, setRepertoire, categorias, setCategorias, masterIdCat, categoriasVisibles };
}
