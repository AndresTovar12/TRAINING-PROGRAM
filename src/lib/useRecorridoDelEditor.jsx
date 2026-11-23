import { useEffect, useRef, useState } from 'react';
import RecorridoGuiado from '@/components/RecorridoGuiado';
import { useAvisosVistos } from '@/lib/useAvisosVistos';
import { CLAVE_EJERCICIOS, alPedirElRecorrido, claveDe, pasosDe } from '@/lib/recorridoDelEditor';

/**
 * CUÁNDO SALE CADA RECORRIDO DEL EDITOR (10 nov 2026; los pasos viven en `lib/recorridoDelEditor.js`).
 *   · La primera vez que se abre una pantalla (`pantalla` + `variante`: «plan» de fases, «workout» de clase…), su recorrido. Si esa pantalla ya
 *     tiene Sets y el de los ejercicios no se ha visto, van juntos; antes se PREPARA la pantalla (`prepara`: abrir un día con ejercicios y desplegarlo).
 *   · Si la pantalla ya se vio y aparece el primer Set (`hayEjercicios`), solo el de los ejercicios, en cuanto el Set está a la vista.
 *   · `pide()` lo abre a mano («Ver el recorrido»), desde el paso 1; también lo pide el «Opciones» de la sesión en el teléfono.
 * Cerrar al final o con «Saltar» cuenta como visto; si al abrir no había ninguna pieza, no.
 * Devuelve `{ elemento, pide }`: `elemento` va en la pantalla (es una capa fija encima del editor, `nivel`).
 */
export function useRecorridoDelEditor({ pantalla, variante, activo, hayEjercicios = false, prepara, contexto, franja, nivel = 2600 }) {
  const { listo, visto, marcar } = useAvisosVistos();
  const [abierto, setAbierto] = useState(null); // { n, pasos, claves }
  const pedidos = useRef(new Set());
  const clave = pantalla ? claveDe(pantalla, variante) : null;
  // Lo de cada pintada, a mano de los temporizadores y del aviso del teléfono.
  const vivo = useRef({ pantalla, clave, prepara, hayEjercicios });
  useEffect(() => { vivo.current = { pantalla, clave, prepara, hayEjercicios }; });

  const abre = ({ conPantalla, conEjercicios, preparar }) => {
    const { pantalla: p, clave: c, prepara: prep } = vivo.current;
    if (!p) return;
    const claves = [...(conPantalla ? [c] : []), ...(conEjercicios ? [CLAVE_EJERCICIOS] : [])];
    claves.forEach((k) => pedidos.current.add(k));
    if (preparar) prep?.();
    // Lo que se acaba de abrir se pinta y luego empieza (el recorrido busca sus piezas al abrir).
    setTimeout(() => setAbierto((a) => ({ n: (a?.n ?? 0) + 1, pasos: pasosDe(p, { conPantalla, conEjercicios }), claves })), preparar ? 450 : 50);
  };
  const abreRef = useRef(abre);
  useEffect(() => { abreRef.current = abre; });
  const pide = () => abreRef.current({ conPantalla: true, conEjercicios: vivo.current.hayEjercicios, preparar: vivo.current.hayEjercicios });

  // Solo: en cada pintada se revisa si toca alguno (y se espera a que la pantalla se quede quieta un momento).
  useEffect(() => {
    if (!listo || !activo || !clave || abierto) return undefined;
    const faltaPantalla = !visto(clave) && !pedidos.current.has(clave);
    const faltaEjercicios = hayEjercicios && !visto(CLAVE_EJERCICIOS) && !pedidos.current.has(CLAVE_EJERCICIOS);
    if (!faltaPantalla && !faltaEjercicios) return undefined;
    const t = setTimeout(() => {
      if (faltaPantalla) abreRef.current({ conPantalla: true, conEjercicios: faltaEjercicios, preparar: faltaEjercicios });
      else if (document.querySelector('[aria-label^="Formato del set"]')) abreRef.current({ conPantalla: false, conEjercicios: true, preparar: false });
    }, 700);
    return () => clearTimeout(t);
  });

  // «Ver el recorrido» desde el «Opciones» de la sesión (teléfono): lo escucha el editor que está abierto.
  useEffect(() => (activo ? alPedirElRecorrido(() => pide()) : undefined), [activo]);

  const cierra = (completo) => {
    const claves = abierto?.claves ?? [];
    setAbierto(null);
    if (completo) claves.forEach((k) => marcar(k));
  };
  const elemento = abierto ? (
    <RecorridoGuiado
      key={abierto.n} pasos={abierto.pasos} contexto={{ ...contexto, conEjercicios: abierto.claves.includes(CLAVE_EJERCICIOS) }}
      franja={franja} mueve="pieza" nivel={nivel} alCerrar={cierra}
    />
  ) : null;
  return { elemento, pide };
}
