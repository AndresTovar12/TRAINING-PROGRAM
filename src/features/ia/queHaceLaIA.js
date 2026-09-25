/**
 * Qué puede hacer la IA de cada quien, en palabras de la app.
 *
 * Lo decidió Andrés el 25 sep 2026, rol por rol:
 *   atleta — ver su plan y su día, ver su progreso, anotar lo que entrenó y
 *            su bienestar; y además "que su IA les dé opciones de ejercicios
 *            si no tienen un aparato".
 *   coach  — "consultar, cambiar, revisar, todo lo que normalmente podría
 *            hacer él". Borrar, sí, pero pidiendo confirmación.
 *   admin  — "todo lo de la app".
 *
 * Se enseña en dos sitios: la pantalla de permiso (lo que se autoriza) y la
 * de "Conectar con IA" (lo que se gana). Un solo texto para los dos, para que
 * no digan cosas distintas.
 */
export function queHaceLaIA(profile) {
  if (profile?.role !== 'admin') {
    return {
      puede: [
        'Ver tu plan y la sesión que te toca',
        'Ver tu progreso: pesos, récords y sesiones hechas',
        'Anotar lo que entrenaste y tu bienestar',
        'Proponerte otros ejercicios si te falta un aparato',
      ],
      noPuede: 'No cambia tu plan: eso lo hace tu coach.',
    };
  }
  const coach = [
    'Ver a tus atletas, sus planes y lo que anotan',
    'Crear y cambiar planes (siempre se puede deshacer)',
    'Crear ejercicios, plantillas y tipos de sesión',
    'Agregar atletas y darte su link de invitación',
    'Borrar, preguntándote siempre antes',
  ];
  return {
    puede: profile?.is_owner ? [...coach, 'Administrar coaches y cuentas'] : coach,
    noPuede: null,
  };
}

/**
 * La liga que la gente pega en su IA. Fija, y no la del sitio donde se abre la
 * app: el servidor se presenta con esta dirección, y una IA conectada por
 * otra (una vista previa de Vercel, localhost) no le cuadraría.
 */
export const LIGA_MCP = import.meta.env.VITE_MCP_URL || 'https://training-program-kappa.vercel.app/mcp';
