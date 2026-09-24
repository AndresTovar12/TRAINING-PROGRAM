import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Trash2 } from 'lucide-react';
import { useCoarsePointer } from '@/lib/useViewport';
import { T, FONT } from '@/lib/theme';

/**
 * Una lista desplegable de la app, no la del sistema.
 *
 * POR QUÉ EXISTE. Andrés lo pidió dos veces: el 17 sep 2026 ("no me gustan
 * esas listas de Safari, la gris") y otra vez el 19 ("aún me topo con listas
 * desplegables de Safari"). La primera vez solo se cambió la de tipos de
 * sesión; quedaban siete `<select>` repartidos por la app. Este componente
 * existe para que el arreglo se haga UNA vez y no siete, y para que el
 * siguiente detalle —un color, un contador, un botón de borrar— no haya que
 * repetirlo en cada sitio.
 *
 * QUÉ TIENE QUE CUMPLIR PARA REEMPLAZAR A UN `<select>`. Un select nativo se
 * usa con el teclado y lo anuncia un lector de pantalla. Cambiarlo por divs
 * bonitos es un retroceso, así que aquí hay `role="listbox"`, `aria-selected`,
 * flechas, Inicio/Fin, Enter y Escape.
 */
/* EL CLIC FANTASMA, Y POR QUE HACE FALTA QUE TODAS LAS LISTAS SE ENTEREN.
 *
 * Andrés, 24 sep 2026: "si en categoría escojo hipertrofia, automáticamente me
 * abre la siguiente lista de grupo muscular... una lista desplegable no tiene
 * por qué abrirme otra cuando selecciono".
 *
 * Es consecuencia de elegir con el dedo (`pointerup`) en vez de con el `click`,
 * que es lo que hubo que hacer para que cerraran en iOS. La cadena:
 *
 *   1. El dedo se levanta sobre la opción -> se elige y la lista se cierra YA.
 *   2. Safari manda su `click` de cortesía unos milisegundos después.
 *   3. Para entonces el panel ya no está, así que ese clic aterriza sobre lo
 *      que quedó debajo: el botón del siguiente desplegable. Y lo abre.
 *
 * Una bandera dentro del componente no alcanza: quien recibe el clic fantasma
 * es OTRA lista, con su propio estado. Por eso vive aquí, compartida: durante
 * un rato corto después de elegir con el dedo, ninguna lista se abre por un
 * clic. Los toques de verdad llegan mucho después de esos 700 ms.
 */
let reciénElegidoConDedo = false;
let avisoTemporizador;
function marcaDedo() {
  reciénElegidoConDedo = true;
  window.clearTimeout(avisoTemporizador);
  avisoTemporizador = window.setTimeout(() => { reciénElegidoConDedo = false; }, 700);
}

export default function ListaDesplegable({
  valor,
  onCambio,
  opciones,
  grupos,
  marcador = 'Selecciona…',
  etiqueta,
  pie,
  deshabilitado = false,
  estilo,
  alto = 268,
}) {
  const dedos = useCoarsePointer();
  const caja = useRef(null);
  const lista = useRef(null);
  const [abierto, setAbierto] = useState(false);
  const [hayMas, setHayMas] = useState(false);
  const [activo, setActivo] = useState(-1);

  // Todas las opciones en una sola tira: es lo que recorren las flechas, que
  // no saben de secciones.
  const planas = useMemo(
    () => (grupos ? grupos.flatMap((g) => g.opciones) : (opciones ?? [])),
    [grupos, opciones],
  );
  const elegida = planas.find((o) => o.valor === valor) ?? null;

  const cerrar = useCallback(() => { setAbierto(false); setActivo(-1); }, []);

  useEffect(() => {
    if (!abierto) return undefined;
    const fuera = (e) => { if (caja.current && !caja.current.contains(e.target)) cerrar(); };
    document.addEventListener('mousedown', fuera);
    return () => document.removeEventListener('mousedown', fuera);
  }, [abierto, cerrar]);

  const miraSiHayMas = useCallback(() => {
    const el = lista.current;
    if (!el) return;
    // 4 px de margen: al final del scroll la cuenta no siempre da exacta.
    setHayMas(el.scrollHeight - el.scrollTop - el.clientHeight > 4);
  }, []);

  /* Se abre con la opción actual marcada, no con la primera: así las flechas
     empiezan desde donde estabas, como en un select de verdad. Se decide AQUÍ
     y no en un efecto: poner el estado nada más entrar al efecto dispara un
     render de más, y el único momento en que hay que calcularlo es al abrir. */
  const abre = () => {
    setActivo(Math.max(0, planas.findIndex((o) => o.valor === valor)));
    setAbierto(true);
  };

  // Medir SÍ va en un efecto: hasta que el navegador no dibuja la lista, no
  // hay alto que medir.
  useEffect(() => {
    if (abierto) miraSiHayMas();
  }, [abierto, planas.length, miraSiHayMas]);

  /* ELEGIR SE DISPARA CON EL DEDO, NO CON EL `click`.
     Andrés, 24 sep 2026, después del primer intento: "probé lo de los botones
     de las listas y no se arregló, sigue igual".

     Quitar el hover falso no bastó. El fondo del asunto es que en iOS el
     `click` de un elemento que se redibuja a media pulsación NO es de fiar: si
     algo cambia entre que el dedo baja y sube, Safari se lo salta. Y esta
     lista se redibuja sola —el conteo de al lado cambia al filtrar.

     `pointerup` sí llega siempre, con dedo y con ratón. El `click` se deja
     puesto para el teclado (Enter sobre un botón enfocado no emite
     `pointerup`), y se ignora si acaba de haber uno para no elegir dos veces. */
  const yaConElDedo = useRef(false);
  const elige = (o, conPuntero = false) => {
    if (conPuntero) {
      // El `click` sintetizado llega justo detrás del dedo; se ignora ese, y
      // se avisa a las demás listas para que tampoco lo tomen por suyo.
      yaConElDedo.current = true;
      marcaDedo();
      window.setTimeout(() => { yaConElDedo.current = false; }, 700);
    } else if (yaConElDedo.current) {
      return;
    }
    onCambio(o.valor);
    cerrar();
  };

  const teclas = (e) => {
    if (deshabilitado) return;
    if (!abierto) {
      if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(e.key)) { e.preventDefault(); abre(); }
      return;
    }
    if (e.key === 'Escape') { e.preventDefault(); cerrar(); return; }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (planas[activo]) { yaConElDedo.current = false; elige(planas[activo]); }
      return;
    }
    const salto = { ArrowDown: 1, ArrowUp: -1 }[e.key];
    if (salto) {
      e.preventDefault();
      setActivo((i) => Math.min(planas.length - 1, Math.max(0, i + salto)));
      return;
    }
    if (e.key === 'Home') { e.preventDefault(); setActivo(0); }
    if (e.key === 'End') { e.preventDefault(); setActivo(planas.length - 1); }
  };

  // La opción resaltada por teclado se trae a la vista sola.
  useEffect(() => {
    if (!abierto || activo < 0) return;
    lista.current?.querySelector(`[data-i="${activo}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [abierto, activo]);

  const fila = (o, i) => {
    const puesta = o.valor === valor;
    const resaltada = i === activo;
    return (
      <div key={o.valor ?? `v-${i}`} data-i={i} style={{ display: 'flex', alignItems: 'center' }}>
        <button
          type="button"
          role="option"
          aria-selected={puesta}
          /* EL RESALTADO POR HOVER, SOLO DONDE HAY PUNTERO.
             Andrés, 24 sep 2026: "en tu navegador sí se cierra pero en mi
             teléfono no". Esta línea era la causa.

             En iOS, tocar un botón dispara PRIMERO un `mouseover`/`mouseenter`
             simulado y solo después `mousedown` y `click`. Ese `mouseenter`
             llamaba a `setActivo`, React volvía a dibujar la lista entera, y si
             el nodo que recibió el `mousedown` se reemplaza antes del `mouseup`,
             el navegador YA NO EMITE el `click`. Sin `click` no corre `elige`,
             y sin `elige` la lista no se cierra.

             En un navegador de escritorio no pasa porque el hover ocurre mucho
             antes del clic, no dentro del mismo gesto. Por eso aquí se veía bien.

             Un teléfono no tiene hover, así que en pantalla táctil esto no
             quita nada: solo deja de provocar el redibujado a media pulsación. */
          onMouseEnter={dedos ? undefined : () => setActivo(i)}
          onPointerUp={() => elige(o, true)}
          onClick={() => elige(o)}
          style={{
            flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 9,
            minHeight: 42, padding: '0 11px', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: resaltada ? T.bgInteract : 'transparent',
            fontFamily: FONT, fontSize: 14, fontWeight: puesta ? 800 : 600,
            color: puesta ? T.accent : T.text, textAlign: 'left',
          }}
        >
          {o.color && (
            <span style={{ width: 11, height: 11, borderRadius: 6, background: o.color, flexShrink: 0 }} />
          )}
          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {o.etiqueta}
          </span>
          {o.nota && (
            <span style={{ fontSize: 12, fontWeight: 700, color: T.text3, flexShrink: 0 }}>{o.nota}</span>
          )}
          {puesta && <Check size={15} color={T.accent} style={{ flexShrink: 0 }} />}
        </button>
        {o.alBorrar && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); o.alBorrar(); }}
            aria-label={`Borrar ${o.etiqueta}`}
            style={{
              border: 'none', background: 'transparent', cursor: 'pointer',
              color: T.text3, padding: '8px 9px', flexShrink: 0,
            }}
          >
            <Trash2 size={15} />
          </button>
        )}
      </div>
    );
  };

  let i = -1;

  return (
    <div ref={caja} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => {
          if (deshabilitado) return;
          // Un clic que llega pisándole los talones a una elección con el dedo
          // no lo hizo nadie: es el fantasma de Safari. Se tira.
          if (reciénElegidoConDedo && !abierto) return;
          if (abierto) cerrar(); else abre();
        }}
        onKeyDown={teclas}
        disabled={deshabilitado}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-label={etiqueta}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 9,
          border: `1.5px solid ${abierto ? T.accent : T.border}`, borderRadius: 11,
          padding: '11px 13px', background: T.bg2, boxSizing: 'border-box',
          cursor: deshabilitado ? 'default' : 'pointer', opacity: deshabilitado ? 0.6 : 1,
          fontFamily: FONT, fontSize: 14, fontWeight: 600, color: elegida ? T.text : T.text3,
          textAlign: 'left', ...estilo,
        }}
      >
        {elegida?.color && (
          <span style={{ width: 11, height: 11, borderRadius: 6, background: elegida.color, flexShrink: 0 }} />
        )}
        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {elegida ? elegida.etiqueta : marcador}
        </span>
        {elegida?.nota && (
          <span style={{ fontSize: 12.5, fontWeight: 700, color: T.text3, flexShrink: 0 }}>{elegida.nota}</span>
        )}
        <ChevronDown
          size={16}
          color={T.text3}
          style={{ flexShrink: 0, transform: abierto ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}
        />
      </button>

      {abierto && (
        <div
          className="animate-fade-in"
          role="listbox"
          aria-label={etiqueta}
          onKeyDown={teclas}
          style={{
            position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 60,
            background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 14,
            boxShadow: '0 16px 44px rgba(17,19,24,0.16)', minWidth: 200,
            /* El scroll lo hace la lista, no esta caja: así el pie —"crear
               uno nuevo"— se queda pegado abajo y no al final del scroll,
               donde nadie lo encuentra. */
            maxHeight: alto + 72, display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}
        >
          <div style={{ position: 'relative', flex: '1 1 auto', minHeight: 0 }}>
            <div ref={lista} onScroll={miraSiHayMas} style={{ maxHeight: alto, overflowY: 'auto', padding: 7 }}>
              {grupos
                ? grupos.map((g) => (
                    g.opciones.length === 0 ? null : (
                      <div key={g.titulo}>
                        <div style={{
                          fontSize: 10.5, fontWeight: 800, letterSpacing: 0.8,
                          color: T.text3, padding: '6px 11px 4px',
                        }}>
                          {g.titulo}
                        </div>
                        {g.opciones.map((o) => { i += 1; return fila(o, i); })}
                      </div>
                    )
                  ))
                : (opciones ?? []).map((o) => { i += 1; return fila(o, i); })}
            </div>

            {/* Avisa que hay más SOLO cuando lo hay. Uno fijo mentiría en las
                listas cortas, que son la mitad de los sitios donde se usa. */}
            {hayMas && (
              <span
                aria-hidden="true"
                style={{
                  position: 'absolute', left: 1, right: 1, bottom: 0, height: 30,
                  background: `linear-gradient(to top, ${T.bg2}, ${T.bg2}00)`,
                  pointerEvents: 'none',
                }}
              />
            )}
          </div>

          {pie && (
            <div style={{ flexShrink: 0, borderTop: `1px solid ${T.border}`, padding: 7 }}>
              {typeof pie === 'function' ? pie({ cerrar }) : pie}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
