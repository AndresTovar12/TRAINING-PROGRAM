import { createContext, useContext } from 'react';

/* LA BARRA DE ABAJO DE LA APP DENTRO DE «LISTO PARA EMPEZAR» (pantalla de carrera, 2 nov 2026: «la barra de abajo de la app se queda»).
   La carrera es una pantalla completa encima de todo y, con el mapa de Apple, la app de abajo se esconde; por eso la barra se vuelve a pintar DENTRO de la
   pantalla. La da quien la tiene (`TrainingApp`): una función que recibe cómo cerrar la carrera y devuelve la barra (tocar otra sección la cierra). Sin ella
   (la computadora, una página de prueba) no hay barra. */
export const BarraDeLaApp = createContext(null);
export const useBarraDeLaApp = () => useContext(BarraDeLaApp);
