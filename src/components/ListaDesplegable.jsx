import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
  const panel = useRef(null);
  const [sitio, setSitio] = useState(null);
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
    /* El panel ya no vive dentro de la caja —se dibuja aparte, ver abajo—,
       así que hay que preguntar por los dos. Sin esto, tocar una opción
       contaría como "clic fuera" y la lista se cerraría antes de elegir. */
    const fuera = (e) => {
      const dentro = (caja.current && caja.current.contains(e.target))
        || (panel.current && panel.current.contains(e.target));
      if (!dentro) cerrar();
    };
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

  /* DÓNDE SE DIBUJA EL PANEL.
     Andrés, 24 sep 2026, con captura: "mira como la lista desplegable está
     como escondida detrás de algo, un recuadro, tiene que sobresalir de ese
     recuadro".

     La tabla de los ejercicios vive dentro de un contenedor con `overflow-x`
     para poder desplazarla a lo ancho. Ese overflow recorta TODO lo que se
     salga, y el panel de la lista se salía por abajo: se veía media lista y el
     resto cortado. No es cosa de `z-index` —por mucho que suba, un recorte no
     se salta—, así que el panel se dibuja fuera de la tabla, colgado del
     documento, y se coloca a mano sobre el botón.

     Se recalcula al desplazar y al cambiar el tamaño de la ventana, porque
     entonces el botón se mueve y el panel tiene que ir con él. El scroll se
     escucha en fase de captura para enterarse también del de los contenedores
     de dentro, que no burbujea. */
  useLayoutEffect(() => {
    if (!abierto) { setSitio(null); return undefined; }

    const coloca = () => {
      const b = caja.current?.getBoundingClientRect();
      if (!b) return;
      const altoPanel = alto + (pie ? 72 : 16);
      const debajo = window.innerHeight - b.bottom - 10;
      // Si abajo no cabe y arriba sí, se abre hacia arriba.
      const haciaArriba = debajo < Math.min(altoPanel, 180) && b.top > debajo;
      setSitio({
        left: b.left,
        ancho: b.width,
        top: haciaArriba ? undefined : b.bottom + 6,
        bottom: haciaArriba ? window.innerHeight - b.top + 6 : undefined,
        // Lo que de verdad cabe, para que nunca se salga de la pantalla.
        cabe: Math.max(120, (haciaArriba ? b.top - 16 : debajo) - (pie ? 56 : 0)),
      });
    };

    coloca();
    window.addEventListener('scroll', coloca, true);
    window.addEventListener('resize', coloca);
    return () => {
      window.removeEventListener('scroll', coloca, true);
      window.removeEventListener('resize', coloca);
    };
  }, [abierto, alto, pie]);

  /* ELEGIR OCURRE EN EL `click`, Y EN NINGÚN EVENTO ANTERIOR.

     Andrés, 24 sep 2026, sobre el intento anterior: "diste un paso atrás,
     volvió a actuar como antes".

     Tenía razón, y esta vez el fallo se pudo reproducir aquí, sin iPhone.

     Aquel intento elegía en `pointerup` y después cancelaba el `touchend`
     para que el navegador no emitiera su clic de cortesía. Chromium respeta
     esa cancelación; WebKit no. El estándar de eventos táctiles solo obliga a
     suprimir ese clic cuando se cancela el `touchstart` o el primer
     `touchmove`; el `touchend` no entra. De ahí que la prueba pasara en este
     navegador y fallara en el teléfono.

     Lo que pasaba en el iPhone: `pointerup` elegía y cerraba la lista, y el
     clic de cortesía llegaba después, cuando la opción ya no estaba en
     pantalla. Aterrizaba en lo que hubiera quedado en ese punto — la lista
     siguiente, una tarjeta de ejercicio, lo que fuera.

     Así que la raíz no era el clic de cortesía, sino adelantarse a él.
     Eligiendo en el `click` no queda ningún evento suelto detrás, y no hay
     nada que pueda caer en el sitio equivocado. El umbral de arrastre
     tampoco hace falta: después de un desplazamiento el navegador ya no
     emite clic.

     Cancelar el `touchstart` sí habría funcionado en WebKit, pero se lleva
     por delante el scroll de la propia lista, que empieza justo encima de
     estos botones.

     Lo que sí es imprescindible es que el botón no se redibuje entre que el
     dedo baja y sube: eso sí hace que iOS se salte el `click`. De eso se
     encarga el `onMouseEnter` de abajo, apagado en pantalla táctil. */
  const elige = (o) => { onCambio(o.valor); cerrar(); };

  const teclas = (e) => {
    if (deshabilitado) return;
    if (!abierto) {
      if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(e.key)) { e.preventDefault(); abre(); }
      return;
    }
    if (e.key === 'Escape') { e.preventDefault(); cerrar(); return; }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (planas[activo]) elige(planas[activo]);
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
          /* EL `preventDefault` ES LO QUE DESACTIVA EL SEGUNDO CLIC.
             Si esta lista queda dentro de un `<label>` —así estaba en los
             filtros del repertorio—, el navegador hace lo que hace cualquier
             label: reenvía el clic a su primer control, que aquí es el botón
             que ABRE la lista. Resultado: el toque la cerraba y el reenvío la
             volvía a abrir en el mismo instante. Eso era el parpadeo y la
             lista que se quedaba abierta.

             Ese reenvío es la acción por defecto del clic, así que cancelarlo
             lo detiene. Un `<button type="button">` no tiene ninguna otra
             acción por defecto, así que no se pierde nada.

             Va aquí dentro y no solo en quien la usa, para que el próximo
             `<label>` que aparezca no vuelva a traer el mismo fallo. */
          onClick={(e) => { e.preventDefault(); elige(o); }}
          style={{
            flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 9,
            minHeight: 42, padding: '0 11px', borderRadius: 10, border: 'none', cursor: 'pointer',
            /* Le quita a iOS la espera por un posible doble toque. El `click`
               llega enseguida, y cuanto más corta es esa espera, menos hueco
               hay para que algo cambie a media pulsación. */
            touchAction: 'manipulation',
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
            /* Mismo motivo que arriba: sin cancelar, borrar dentro de un
               `<label>` reabriría la lista de rebote. */
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); o.alBorrar(); }}
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
        onClick={() => { if (!deshabilitado) { if (abierto) cerrar(); else abre(); } }}
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
          touchAction: 'manipulation',
          fontFamily: FONT, fontSize: 14, fontWeight: 600, color: elegida ? T.text : T.text3,
          textAlign: 'left', ...estilo,
        }}
      >
        {elegida?.color && (
          <span style={{ width: 11, height: 11, borderRadius: 6, background: elegida.color, flexShrink: 0 }} />
        )}
        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {/* `corta` es para cuando el botón vive en un hueco estrecho —una
              celda de tabla— y el nombre entero no cabe: ahí se lee "reps" y
              la lista sigue diciendo "Repeticiones", que es donde importa
              entender. Sin esto, el botón se salía de su celda y se encimaba
              con el nombre del ejercicio. */}
          {elegida ? (elegida.corta ?? elegida.etiqueta) : marcador}
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

      {abierto && sitio && createPortal(
        <div
          ref={panel}
          className="animate-fade-in"
          role="listbox"
          aria-label={etiqueta}
          onKeyDown={teclas}
          style={{
            position: 'fixed', zIndex: 3000,
            left: sitio.left, width: Math.max(sitio.ancho, 200),
            top: sitio.top, bottom: sitio.bottom,
            background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 14,
            boxShadow: '0 16px 44px rgba(17,19,24,0.16)',
            /* El scroll lo hace la lista, no esta caja: así el pie —"crear
               uno nuevo"— se queda pegado abajo y no al final del scroll,
               donde nadie lo encuentra. */
            maxHeight: Math.min(alto + 72, sitio.cabe), display: 'flex', flexDirection: 'column', overflow: 'hidden',
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
        </div>,
        document.body,
      )}
    </div>
  );
}
