import { createContext, useContext } from 'react';

/* Lo que una línea del editor necesita saber de la sesión donde vive: su familia (Pesas, Correr, Movilidad…). La pone `SessionEditorInterno`
   alrededor de sus Sets; sin ella, «Libre» (Mis planes, la vista del atleta). Ver `lib/fichaDelEjercicio.js`. */
export const SesionDelEditor = createContext({ familia: 'libre' });
export const useSesionDelEditor = () => useContext(SesionDelEditor);
