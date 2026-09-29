import { T, FONT } from '@/lib/theme';

/**
 * "Todas a la vez" o "Cualquiera": cómo se combinan varias opciones marcadas
 * en una lista de filtro.
 *
 * POR QUÉ EXISTE. Andrés, 28 sep 2026: "alguien puede pensar que si selecciono
 * «fuerza» y aparte «pliométricos» me van a aparecer todos los ejercicios de
 * fuerza y también todos los pliométricos; no van a pensar que son los de
 * fuerza con subcategoría pliométricos". Tiene razón: en una lista donde se
 * marcan varias, casi todo el mundo espera "cualquiera de ellas". La app hacía
 * lo contrario —solo los que tienen todas— y nada lo decía.
 *
 * Ahora se dice de dos maneras, en el momento en que se marca la segunda:
 *   · un interruptor con las dos formas, para que cada quien elija la suya;
 *   · una frase en palabras, que dice exactamente qué va a salir.
 * POR DEFECTO ES "CUALQUIERA". Andrés lo decidió así (28 sep 2026: "deja lo
 * que la mayoría espera"): es lo que casi todos suponen de una lista donde se
 * marcan varias. "Todas a la vez" —la búsqueda específica que él pidió, "puros
 * ejercicios con dos categorías y dos grupos musculares"— queda a un toque, y
 * el interruptor sale justo cuando se marca la segunda opción.
 */
export const MODOS = ['cualquiera', 'todas'];
export const MODO_POR_DEFECTO = 'cualquiera';

/**
 * "A y también B" (todas a la vez) o "A o B" (cualquiera). Con tres o más:
 * "A, B y también C" / "A, B o C".
 */
export function unirNombres(nombres, modo) {
  if (nombres.length <= 1) return nombres[0] ?? '';
  const ultimo = nombres[nombres.length - 1];
  const antes = nombres.slice(0, -1).join(', ');
  return `${antes} ${modo === 'todas' ? 'y también' : 'o'} ${ultimo}`;
}

/** Lo mismo que `unirNombres`, con el conector resaltado en azul: es lo que
 *  distingue "Fuerza y también Pliometría" de "Fuerza o Pliometría". */
export function NombresUnidos({ nombres, modo }) {
  if (nombres.length <= 1) return <>{nombres[0]}</>;
  return (
    <>
      {nombres.slice(0, -1).join(', ')}{' '}
      <b style={{ color: T.accent, fontWeight: 800 }}>{modo === 'todas' ? 'y también' : 'o'}</b>{' '}
      {nombres[nombres.length - 1]}
    </>
  );
}

/**
 * La frase completa para una lista: "Solo los que son Fuerza y también
 * Pliometría." `verbo` es "son" para categorías y "trabajan" para grupos.
 */
export function fraseDeFiltro({ modo, nombres, verbo }) {
  const lista = unirNombres(nombres, modo);
  return modo === 'todas'
    ? { antes: `Solo los que ${verbo} `, lista, despues: '.' }
    : { antes: `Los que ${verbo} `, lista, despues: ' (basta con una).' };
}

export default function ModoDeFiltro({ modo, onCambio, nombres, verbo }) {
  const frase = fraseDeFiltro({ modo, nombres, verbo });
  const boton = (valor, texto) => {
    const puesto = modo === valor;
    return (
      <button
        key={valor}
        type="button"
        role="radio"
        aria-checked={puesto}
        /* Igual que en ListaDesplegable: cancelar la acción por defecto evita
           que un `<label>` alrededor reenvíe el clic a otro botón. */
        onClick={(e) => { e.preventDefault(); onCambio(valor); }}
        style={{
          flex: 1, minHeight: 34, border: 'none', borderRadius: 9, cursor: 'pointer', padding: '0 8px',
          background: puesto ? T.bg2 : 'transparent',
          boxShadow: puesto ? '0 1px 3px rgba(17,19,24,0.14)' : 'none',
          color: puesto ? T.accent : T.text2,
          fontFamily: FONT, fontSize: 13, fontWeight: puesto ? 800 : 600,
          touchAction: 'manipulation', transition: 'background .15s, color .15s',
        }}
      >
        {texto}
      </button>
    );
  };

  return (
    /* El panel de la lista escucha el teclado para elegir opciones: un Enter o
       un espacio aquí NO debe elegir la opción resaltada de más abajo. Solo
       esas dos teclas se detienen: el Escape tiene que llegar al panel para
       cerrar la lista, también con el foco en el interruptor. */
    <div
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') e.stopPropagation(); }}
      style={{ padding: '10px 10px 9px', borderBottom: `1px solid ${T.border}` }}
    >
      <div
        role="radiogroup"
        aria-label="Cómo combinar lo marcado"
        style={{
          display: 'flex', gap: 2, padding: 3, borderRadius: 11,
          background: T.bgInteract, border: `1px solid ${T.border}`,
        }}
      >
        {boton('cualquiera', 'Cualquiera')}
        {boton('todas', 'Todas a la vez')}
      </div>
      <div style={{ marginTop: 8, fontSize: 12.5, fontWeight: 600, color: T.text2, lineHeight: 1.45 }}>
        {frase.antes}<b style={{ color: T.text, fontWeight: 800 }}>{frase.lista}</b>{frase.despues}
      </div>
    </div>
  );
}
