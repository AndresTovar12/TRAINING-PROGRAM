/* UNA LÍNEA LIGADA A UNA FICHA NO TIENE NOMBRE PROPIO: SE LLAMA COMO SU FICHA.

   Andrés, 6 oct 2026: «en mi lógica, si los ejercicios son de mi repertorio, tendrían que salir con el nombre del
   repertorio». Hasta entonces una línea del plan guardaba SU nombre («Trap bar deadlift») aunque apuntara a la ficha
   «Hexbar deadlift» con `exercise_id`: en 448 de 703 líneas ligadas de su plan el nombre era distinto al de la ficha, y
   el atleta veía uno y el repertorio decía otro.

   La línea sigue guardando `name` (lo leen cosas que no tienen el repertorio a mano), pero cada pantalla que enseña un
   plan lo pone al día con el nombre actual de la ficha: si renombran la ficha, el plan la sigue sin tocar el plan. Una
   línea sin ficha (un ejercicio suelto, una nota) o con una ficha que ya no existe se queda con el nombre que trae. */

// Cambia el nombre de una línea ligada a su ficha. Si ya se llama igual, devuelve la MISMA línea (sin objetos nuevos).
const conSuNombre = (ex, fichaDe) => {
  if (!ex || ex.isNote || !ex.exercise_id) return ex;
  const nombre = fichaDe(ex)?.name;
  return nombre && nombre !== ex.name ? { ...ex, name: nombre } : ex;
};

// `lista.map(cambia)`, pero devuelve la misma lista si nada cambió: así lo que no se renombra no genera objetos nuevos.
const mapeaSiCambia = (lista, cambia) => {
  if (!Array.isArray(lista)) return lista;
  let hubo = false;
  const nueva = lista.map((x) => {
    const y = cambia(x);
    if (y !== x) hubo = true;
    return y;
  });
  return hubo ? nueva : lista;
};

/**
 * Las fases de un plan con cada línea ligada a una ficha llamándose como ella.
 * `fichaDe(ex)`: la ficha de esa línea por su `exercise_id` (o null). No toca el plan que recibe.
 */
export function conNombreDeSuFicha(phases, fichaDe) {
  if (!Array.isArray(phases) || typeof fichaDe !== 'function') return phases;
  return mapeaSiCambia(phases, (fase) => {
    const weekData = mapeaSiCambia(fase?.weekData, (semana) => {
      const days = mapeaSiCambia(semana?.days, (dia) => {
        const exercises = mapeaSiCambia(dia?.exercises, (ex) => conSuNombre(ex, fichaDe));
        return exercises === dia?.exercises ? dia : { ...dia, exercises };
      });
      return days === semana?.days ? semana : { ...semana, days };
    });
    return weekData === fase?.weekData ? fase : { ...fase, weekData };
  });
}

/** `fichaDe` para una lista de fichas del repertorio (`[{ id, name, … }]`): por `exercise_id`, nunca por nombre. */
export const fichaDeLista = (fichas) => {
  const porId = new Map((fichas ?? []).map((f) => [f.id, f]));
  return (ex) => (ex?.exercise_id ? porId.get(ex.exercise_id) ?? null : null);
};
