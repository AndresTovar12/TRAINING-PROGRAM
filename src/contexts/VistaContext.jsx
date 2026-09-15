import { createContext, useContext, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';

/**
 * De quién es la app de entrenamiento que se está dibujando.
 *
 * Casi siempre, de quien entró. Pero un coach puede abrir la app de uno de sus
 * atletas —y el master la de cualquiera— para ver exactamente lo que ese atleta
 * ve. Andrés lo pidió para revisar sin tener que cerrar sesión y entrar con la
 * cuenta del atleta.
 *
 * NO es entrar con su cuenta. La sesión sigue siendo la del coach, así que los
 * datos se leen con SUS permisos: la base solo le deja leer a sus atletas.
 *
 * Y NO se guarda nada. Lo que se toque se queda en pantalla y se pierde al
 * salir. Revisar no puede estropear el registro del atleta: ni sus pesos, ni
 * sus sesiones, ni el punto del plan en que va (que la app adelanta sola al
 * abrirse, y eso también es una escritura).
 */
const VistaContext = createContext(null);

export function VistaDeAtletaProvider({ atleta, children }) {
  const value = useMemo(() => ({ perfil: atleta }), [atleta]);
  return <VistaContext.Provider value={value}>{children}</VistaContext.Provider>;
}

/** `{ perfil, userId, soloLectura }` de la persona cuya app se dibuja. */
export function usePerfilDeLaVista() {
  const vista = useContext(VistaContext);
  const { user, profile } = useAuth();
  if (vista) return { perfil: vista.perfil, userId: vista.perfil?.id ?? null, soloLectura: true };
  return { perfil: profile, userId: user?.id ?? null, soloLectura: false };
}
