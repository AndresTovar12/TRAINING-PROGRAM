import { useMemo } from 'react';
import RecorridoGuiado from '@/components/RecorridoGuiado';
import { PASOS, ponRecorridoAbierto } from '@/lib/recorridoDelHome';

/* EL RECORRIDO DE LA PRIMERA VEZ (2 nov 2026; spec `docs/superpowers/specs/2026-11-02-home-sin-plan-recorrido.md`, maqueta https://claude.ai/artifact/6uAsYxiGLPzfVdWNw5SSxC).
   Seis pasos sobre el Home sin plan. La pantalla del recorrido es `components/RecorridoGuiado.jsx` (la misma del editor); los textos y las medidas viven en `lib/recorridoDelHome.js`.
   El botón de la cuenta mide 52 px + 6 de margen + 16 de aire: la franja libre empieza debajo (84). La barra de abajo ocupa 76. */
const FRANJA = { arriba: 84, abajo: 76 };
const marcaAbierto = () => { ponRecorridoAbierto(true); return () => ponRecorridoAbierto(false); };

export default function RecorridoDelHome({ conCoach = false, nombreCoach = '', alCerrar }) {
  const contexto = useMemo(() => ({ conCoach, nombreCoach }), [conCoach, nombreCoach]);
  return <RecorridoGuiado pasos={PASOS} contexto={contexto} franja={FRANJA} mueve="pagina" alAbrir={marcaAbierto} alCerrar={alCerrar} />;
}
