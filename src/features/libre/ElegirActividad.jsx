import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronLeft, ChevronRight, Loader2, MapPin, Pencil, Plus, Search, X } from 'lucide-react';
import { FONT, KP, UI } from '@/lib/theme';
import {
  COLORES_PARA_CREAR, GRUPOS_DE_ACTIVIDADES, ICONO_PROPIO, MAX_NOMBRE, buscaActividades, creaActividad, editaActividad, hayConNombre, propiasDe, tusActividades,
} from '@/lib/actividades';
import { buscaIconos, sugiereIcono } from '@/lib/iconosDeTipo';
import { useCatalogoDeIconos } from '@/lib/useCatalogoDeIconos';
import { IconoSvg } from '@/components/IconoDeTipo';
import IconoDeActividad from './IconoDeActividad';
import { useHojaDeslizable } from '@/lib/useHojaDeslizable';

/* ELIGE TU ACTIVIDAD (23 oct 2026, Activity Tracker; rehecha el 6 nov 2026, «Registrar: hoja clara», maquetas aprobadas: la propuesta 2 «Lista agrupada» en su versión B «Todo azul»).
   Se abre desde el botón de la izquierda de «listo para empezar» (el punto ● de la barra). Ya no es una pantalla negra con una lista larga: es una HOJA CLARA que sube
   sobre la app (la app se ve oscurecida arriba), como el resto de Training Lab.
   Desde el 6 nov 2026 se abre ENCIMA de «listo para empezar» sin quitar el mapa (arriba se ve el mapa oscurecido; ver `EntrenoLibre.jsx`, `eligiendo`), se cierra
   deslizando hacia abajo y baja con animación al cerrarse (`lib/useHojaDeslizable.js`; quien la pinta le pasa `abierta` y la deja montada con `useSigueMontado`).
     · Cabecera «¿Qué vas a hacer?» con una equis, y un buscador blanco sin acentos. Si lo que escribe no existe: «Crear "Waterpolo"».
     · La lista agrupada, como «Mi perfil»: «Tus actividades» primero (lo que hizo últimamente y las que creó), luego los grupos del catálogo, cada uno en su tarjeta blanca con
       renglones (símbolo azul, nombre y, si lleva mapa, «mapa» en verde), y al final «¿No está?» con «Crear mi actividad».
     · Crear la suya: nombre, COLOR e ÍCONO (del catálogo de la app, el de los tipos de sesión; mientras escribe el nombre se le sugiere uno) y UNA pregunta,
       «¿Te mueves de un lugar a otro?» (si sí, lleva mapa y distancia). Queda guardada en su configuración. Sin emojis: Andrés, «no tienen personalidad».
     · Si se mueve de un lugar a otro, otra pregunta (3 nov 2026, para la pausa automática): «¿Cómo te mueves?», «A pie» o «Sobre ruedas o en el agua».
     · «Creadas por ti» (con `alEditar`): las suyas, con un lápiz para cambiarlas (nombre, color, ícono y las dos preguntas).
   La pantalla de crear y la de «¿Cómo te mueves?» son las mismas de antes, solo pasaron a claras con estos colores.
   `filas`: sus entrenos recientes (para «Tus actividades»). `propias`: las que creó. `alElegir(actividad)`. `alCrear(actividad)`: la guarda y la elige.
   `alEditar(actividad)`: guarda los cambios de una suya (sin él, no se ofrece editar). */

const C = { fondo: '#F4F5F8', tarjeta: UI.tarjeta, relleno: '#EDEFF3', texto: KP.ink, texto2: KP.ink2, texto3: '#9CA3AF', azul: KP.blue, azulSuave: KP.blueSoft, verde: KP.mint, hilo: UI.hilo, flecha: '#C2C6CF', cerrar: '#E8EAEF', asa: '#D5D8DF', velo: 'rgba(17,19,24,0.32)' };

const rotulo = { margin: '16px 4px 8px', fontSize: 13, fontWeight: 700, color: C.texto2 };
const grupo = { background: C.tarjeta, borderRadius: UI.rTarjeta, boxShadow: UI.sombraGrupo, overflow: 'hidden' };
// Un renglón de la lista: el símbolo, el nombre y lo que lleve a la derecha. El hilo de arriba (`hiloDe`) empieza después del símbolo.
const renglon = {
  flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', border: 'none', background: 'transparent', color: C.texto,
  fontFamily: FONT, fontSize: 16, fontWeight: 600, cursor: 'pointer', textAlign: 'left', touchAction: 'manipulation',
};
const hiloDe = { position: 'absolute', left: 56, right: 0, top: 0, height: 1, background: C.hilo, pointerEvents: 'none' };
const redondo = { width: 34, height: 34, borderRadius: 17, border: 'none', background: C.cerrar, color: C.texto2, display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0, touchAction: 'manipulation' };
const campo = { background: C.tarjeta, borderRadius: UI.rCampo, boxShadow: UI.sombraGrupo };
const botonAzul = { width: '100%', minHeight: 56, borderRadius: 20, border: 'none', cursor: 'pointer', fontFamily: FONT, fontSize: 18, fontWeight: 800, color: '#fff', background: C.azul, touchAction: 'manipulation' };

/** La hoja: un velo sobre la app, y abajo la hoja clara con su asita (sube con el mismo movimiento que las otras hojas). `alTocarFuera`: tocar el velo, y
    también deslizar la hoja hacia abajo (6 nov 2026, `lib/useHojaDeslizable.js`); sin él (creando o editando) no se cierra de ninguna de las dos formas.
    `abierta` en falso: baja con animación y ya no recibe toques (quien la pinta la deja montada ese rato con `useSigueMontado`).
    El velo es HERMANO de la hoja (no su padre) para aclararse solo él mientras se jala. Sobre el mapa de Apple, el velo (opaco al 32 %) es lo que se queda con
    los toques de toda la pantalla: el plugin del mapa le da a la página lo que tiene fondo, así que ni «INICIAR» ni los botones del mapa reciben nada. */
function Hoja({ etiqueta, alTocarFuera = null, completa = true, abierta = true, children }) {
  const { hoja, velo } = useHojaDeslizable({ abierta, alCerrar: alTocarFuera });
  return createPortal(
    <div
      role="dialog" aria-modal="true" aria-label={etiqueta}
      style={{ position: 'fixed', inset: 0, zIndex: 3300, fontFamily: FONT, color: C.texto, display: 'flex', alignItems: 'flex-end', ...(abierta ? {} : { pointerEvents: 'none' }) }}
    >
      <div ref={velo} aria-hidden="true" onClick={alTocarFuera ?? undefined} style={{ position: 'absolute', inset: 0, background: C.velo }} />
      <div
        ref={hoja} className="animate-sheet"
        style={{
          position: 'relative', width: '100%', boxSizing: 'border-box', background: C.fondo, borderRadius: '28px 28px 0 0', display: 'flex', flexDirection: 'column', overflow: 'hidden',
          ...(completa ? { height: 'calc(100% - max(46px, env(safe-area-inset-top) + 12px))' } : { maxHeight: 'calc(100% - max(46px, env(safe-area-inset-top) + 12px))' }),
        }}
      >
        <div aria-hidden="true" style={{ width: 38, height: 5, borderRadius: 3, background: C.asa, margin: '8px auto 4px', flexShrink: 0 }} />
        {children}
      </div>
    </div>,
    document.body,
  );
}

/** La cabecera de la hoja: lo de la izquierda (una flecha para volver o nada), el título y la equis. */
function Cabecera({ chico = null, titulo, alVolver = null, alCerrar = null }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 18px 10px', flexShrink: 0 }}>
      {alVolver && <button type="button" onClick={alVolver} aria-label="Volver" style={redondo}><ChevronLeft size={20} /></button>}
      <div style={{ flex: 1, minWidth: 0 }}>
        {chico && <div style={{ fontSize: 13, fontWeight: 700, color: C.texto2 }}>{chico}</div>}
        <div style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-0.01em', overflowWrap: 'anywhere' }}>{titulo}</div>
      </div>
      {alCerrar && <button type="button" onClick={alCerrar} aria-label="Cerrar" style={redondo}><X size={16} strokeWidth={2.4} /></button>}
    </div>
  );
}

/** Un renglón de una tarjeta de la lista. `alEditar`: con él, un lápiz a la derecha (las que creó la persona). */
function Linea({ actividad, primera, onClick, alEditar = null }) {
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      {!primera && <span aria-hidden="true" style={hiloDe} />}
      <button type="button" onClick={onClick} style={renglon}>
        <IconoDeActividad actividad={actividad} size={30} glifo={0.92} />
        <span style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{actividad.nombre}</span>
        {actividad.gps && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 12, fontWeight: 700, color: C.verde }}><MapPin size={11} strokeWidth={2.4} /> mapa</span>}
        {!alEditar && <ChevronRight size={16} strokeWidth={2.2} color={C.flecha} style={{ flexShrink: 0 }} />}
      </button>
      {alEditar && (
        <button type="button" onClick={alEditar} aria-label={`Editar ${actividad.nombre}`} style={{ ...renglon, flex: 'none', padding: '10px 14px 10px 6px', color: C.texto2 }}><Pencil size={17} /></button>
      )}
    </div>
  );
}

/** Una tarjeta blanca con sus renglones (`actividades`) y, si hace falta, un renglón más al final (`children`). */
function Tarjeta({ actividades, alElegir, alEditar = null, children }) {
  return (
    <div style={grupo}>
      {actividades.map((x, i) => <Linea key={x.id} actividad={x} primera={i === 0} onClick={() => alElegir(x)} alEditar={alEditar ? () => alEditar(x) : null} />)}
      {children}
    </div>
  );
}

/** Un renglón azul con un «+» («Crear mi actividad», «Crear "Waterpolo"»). */
function RenglonCrear({ texto, onClick, primera = true }) {
  return (
    <div style={{ position: 'relative' }}>
      {!primera && <span aria-hidden="true" style={hiloDe} />}
      <button type="button" onClick={onClick} style={{ ...renglon, flex: 'none', width: '100%', boxSizing: 'border-box', color: C.azul }}>
        <span aria-hidden="true" style={{ width: 30, height: 30, display: 'grid', placeItems: 'center', flexShrink: 0 }}><Plus size={22} strokeWidth={2.2} /></span>
        <span style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{texto}</span>
      </button>
    </div>
  );
}

/** «¿Cómo te mueves?» (3 nov 2026): a pie o sobre ruedas o en el agua. Así la pausa automática sabe qué mirar (el rebote del cuerpo o el GPS). */
export function ComoTeMueves({ valor, alCambiar }) {
  const opcion = (v, texto) => (
    <button
      type="button" onClick={() => alCambiar(v)} aria-pressed={valor === v}
      style={{ flex: 1, minHeight: 48, borderRadius: 14, border: 'none', cursor: 'pointer', fontFamily: FONT, fontSize: 15, fontWeight: 700, padding: '8px 10px', color: valor === v ? '#fff' : C.texto, background: valor === v ? C.azul : C.relleno, touchAction: 'manipulation' }}
    >{texto}</button>
  );
  return (
    <div style={{ ...grupo, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10, fontSize: 16, fontWeight: 600 }}>
      <span>¿Cómo te mueves?</span>
      <div role="group" aria-label="¿Cómo te mueves?" style={{ display: 'flex', gap: 8 }}>{opcion('pie', 'A pie')}{opcion('ruedas', 'Sobre ruedas o en el agua')}</div>
      <span style={{ fontSize: 13.5, fontWeight: 500, color: C.texto2 }}>Así sabemos cuándo pausar solo.</span>
    </div>
  );
}

/** Al iniciar una propia con mapa que todavía no dice cómo se mueve (se creó antes del 3 nov 2026): la misma pregunta, una sola vez. `alElegir('pie' | 'ruedas')`. */
export function HojaComoTeMueves({ actividad, alElegir, alCerrar, abierta = true }) {
  const [valor, setValor] = useState('pie');
  return (
    <Hoja etiqueta="¿Cómo te mueves?" alTocarFuera={alCerrar} completa={false} abierta={abierta}>
      <div style={{ padding: '6px 16px calc(16px + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <IconoDeActividad actividad={actividad} size={44} />
          <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 700, color: C.texto2 }}>Antes de empezar</div><div style={{ fontSize: 20, fontWeight: 800, overflowWrap: 'anywhere' }}>{actividad?.nombre}</div></div>
          <button type="button" onClick={alCerrar} aria-label="Volver" style={redondo}><ChevronLeft size={20} /></button>
        </div>
        <ComoTeMueves valor={valor} alCambiar={setValor} />
        <button type="button" onClick={() => alElegir(valor)} style={botonAzul}>Listo</button>
      </div>
    </Hoja>
  );
}

function Crear({ inicial, editando = null, propias, alGuardar, alVolver }) {
  const catalogo = useCatalogoDeIconos();
  const [nombre, setNombre] = useState(editando?.nombre ?? inicial);
  const [color, setColor] = useState(editando?.color ?? COLORES_PARA_CREAR[0]);
  const [elegido, setElegido] = useState(editando?.icono ?? null); // el ícono que tocó; sin tocar ninguno, el que sugiere el nombre
  const [busca, setBusca] = useState('');
  const [gps, setGps] = useState(!!editando?.gps);
  const [desplazamiento, setDesplazamiento] = useState(editando?.desplazamiento ?? 'pie');
  const [aviso, setAviso] = useState(null);
  const sugerido = useMemo(() => (catalogo ? sugiereIcono(catalogo, nombre) : null), [catalogo, nombre]);
  const icono = elegido ?? sugerido ?? ICONO_PROPIO;
  // El que va (el sugerido por el nombre o el que tocó) sale primero en la rejilla: así se ve marcado sin tener que buscarlo.
  const iconos = useMemo(() => {
    const todos = buscaIconos(catalogo, busca);
    if (busca.trim()) return todos;
    const actual = todos.find((ic) => ic.id === icono);
    return actual ? [actual, ...todos.filter((ic) => ic !== actual)] : todos;
  }, [catalogo, busca, icono]);
  const guardar = () => {
    // «¿Cómo te mueves?» solo cuenta si se mueve de un lugar a otro.
    const datos = { nombre, icono, color, gps, ...(gps ? { desplazamiento } : {}) };
    if (editando) {
      const r = editaActividad(editando, datos, propias);
      if (r.error) { setAviso(r.error); return; }
      alGuardar(r.actividad, false);
      return;
    }
    const r = creaActividad(datos, propias);
    if (!r) { setAviso('Escribe cómo se llama.'); return; }
    alGuardar(r.actividad, r.yaExistia);
  };
  return (
    <>
      <Cabecera chico={editando ? 'Tu actividad' : 'Nueva actividad'} titulo={editando ? 'Cámbiala' : 'Hazla tuya'} alVolver={alVolver} />
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '8px 16px 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', margin: '4px 0 16px' }}>
          <IconoDeActividad actividad={{ icono, color, nombre }} size={92} />
        </div>
        <input
          value={nombre} onChange={(e) => { setNombre(e.target.value); setAviso(null); }} maxLength={MAX_NOMBRE} placeholder="Nombre" aria-label="Nombre de la actividad" autoFocus={!inicial}
          style={{ ...campo, width: '100%', boxSizing: 'border-box', border: 'none', color: C.texto, fontFamily: FONT, fontSize: 20, fontWeight: 700, padding: '14px 16px', outline: 'none', textAlign: 'center' }}
        />
        {aviso && <div role="alert" style={{ marginTop: 8, textAlign: 'center', color: KP.amber, fontSize: 14, fontWeight: 600 }}>{aviso}</div>}

        <div style={rotulo}>Color</div>
        <div role="group" aria-label="Color" style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {COLORES_PARA_CREAR.map((c) => (
            <button
              key={c} type="button" onClick={() => setColor(c)} aria-pressed={c === color} aria-label={`Color ${c}`}
              style={{ width: 38, height: 38, borderRadius: 19, border: 'none', cursor: 'pointer', background: c, display: 'grid', placeItems: 'center', boxShadow: c === color ? `0 0 0 3px ${C.fondo}, 0 0 0 5px ${C.texto}` : 'none', touchAction: 'manipulation' }}
            >{c === color && <Check size={16} color="#fff" strokeWidth={3.4} />}</button>
          ))}
        </div>

        <div style={rotulo}>Ícono</div>
        <label style={{ ...campo, display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px' }}>
          <Search size={17} color={C.texto2} aria-hidden="true" />
          <input
            type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Busca: pelota, agua, montaña…" aria-label="Buscar ícono" autoComplete="off"
            style={{ flex: 1, minWidth: 0, border: 'none', background: 'transparent', color: C.texto, fontFamily: FONT, fontSize: 15.5, fontWeight: 600, padding: '12px 0', outline: 'none' }}
          />
        </label>
        <div role="group" aria-label="Ícono" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(52px, 1fr))', gap: 8, marginTop: 10, maxHeight: 236, overflowY: 'auto' }}>
          {!catalogo && <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 8, color: C.texto2, fontSize: 14, padding: 12 }}><Loader2 size={16} className="spin" /> Cargando íconos…</div>}
          {catalogo && iconos.length === 0 && <div style={{ gridColumn: '1 / -1', color: C.texto2, fontSize: 14, padding: 12 }}>Ningún ícono con esa palabra.</div>}
          {iconos.map((ic) => {
            const puesto = ic.id === icono;
            return (
              <button
                key={ic.id} type="button" onClick={() => setElegido(ic.id)} aria-pressed={puesto} aria-label={ic.nombre} title={ic.nombre}
                style={{ height: 52, borderRadius: 14, border: 'none', cursor: 'pointer', display: 'grid', placeItems: 'center', background: puesto ? C.azulSuave : C.tarjeta, color: puesto ? C.azul : C.texto, touchAction: 'manipulation' }}
              ><IconoSvg svg={ic.svg} caja={ic.caja} relleno={ic.relleno} size={24} strokeWidth={1.6} /></button>
            );
          })}
        </div>

        <button
          type="button" onClick={() => setGps((g) => !g)} aria-pressed={gps}
          style={{ ...grupo, ...renglon, flex: 'none', width: '100%', boxSizing: 'border-box', marginTop: 16, justifyContent: 'space-between', padding: '14px 16px' }}
        >
          <span><span style={{ display: 'block' }}>¿Te mueves de un lugar a otro?</span><span style={{ display: 'block', fontSize: 13.5, fontWeight: 500, color: C.texto2, marginTop: 2 }}>Si sí, llevará mapa y distancia.</span></span>
          <span aria-hidden="true" style={{ width: 50, height: 30, borderRadius: 15, background: gps ? C.verde : C.asa, position: 'relative', flexShrink: 0, transition: 'background .15s' }}>
            <span style={{ position: 'absolute', top: 3, left: gps ? 23 : 3, width: 24, height: 24, borderRadius: 12, background: '#fff', transition: 'left .15s' }} />
          </span>
        </button>
        {gps && <div style={{ marginTop: 8 }}><ComoTeMueves valor={desplazamiento} alCambiar={setDesplazamiento} /></div>}
      </div>
      <div style={{ padding: '10px 16px calc(14px + env(safe-area-inset-bottom))', flexShrink: 0 }}>
        <button type="button" onClick={guardar} style={{ ...botonAzul, minHeight: 58 }}>
          {editando ? 'Guardar' : 'Guardar y empezar'}
        </button>
      </div>
    </>
  );
}

export default function ElegirActividad({ filas = [], propias = [], alElegir, alCrear, alEditar = null, alCerrar, abierta = true }) {
  const [busca, setBusca] = useState('');
  const [creando, setCreando] = useState(null); // null | el nombre con que arranca
  const [editando, setEditando] = useState(null); // la propia que está cambiando
  const tuyas = useMemo(() => tusActividades(filas, propias), [filas, propias]);
  const q = busca.trim();
  const hallazgos = useMemo(() => buscaActividades(q, propias), [q, propias]);
  const ofreceCrear = q && !hayConNombre(q, propias);
  const nombreNuevo = q.replace(/^./, (c) => c.toUpperCase()).slice(0, MAX_NOMBRE);
  const hechas = propiasDe(propias);

  return (
    <Hoja etiqueta="Elige tu actividad" alTocarFuera={editando || creando !== null ? null : alCerrar} abierta={abierta}>
      {editando ? (
        <Crear inicial="" editando={editando} propias={propias} alVolver={() => setEditando(null)} alGuardar={(act) => { alEditar(act); setEditando(null); }} />
      ) : creando !== null ? (
        <Crear inicial={creando} propias={propias} alVolver={() => setCreando(null)} alGuardar={(act, yaExistia) => (yaExistia ? alElegir(act) : alCrear(act))} />
      ) : (
        <>
          <Cabecera titulo="¿Qué vas a hacer?" alCerrar={alCerrar} />
          <label style={{ ...campo, display: 'flex', alignItems: 'center', gap: 8, margin: '0 16px 10px', padding: '0 14px', flexShrink: 0 }}>
            <Search size={18} color={C.texto3} aria-hidden="true" />
            <input
              type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Busca: correr, pádel, waterpolo…" aria-label="Buscar actividad" autoComplete="off"
              style={{ flex: 1, minWidth: 0, border: 'none', background: 'transparent', color: C.texto, fontFamily: FONT, fontSize: 15, fontWeight: 500, padding: '11px 0', outline: 'none' }}
            />
          </label>
          {/* `overscrollBehavior`: al llegar a una orilla, la lista no arrastra lo de atrás. Hasta arriba y hacia abajo, el dedo jala la hoja (`useHojaDeslizable`). */}
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain', padding: '0 16px calc(24px + env(safe-area-inset-bottom))' }}>
            {!q ? (
              <>
                <div style={{ ...rotulo, marginTop: 4 }}>Tus actividades</div>
                <Tarjeta actividades={tuyas} alElegir={alElegir} />
                {GRUPOS_DE_ACTIVIDADES.map((g) => (
                  <div key={g.grupo}>
                    <div style={rotulo}>{g.grupo}</div>
                    <Tarjeta actividades={g.actividades} alElegir={alElegir} />
                  </div>
                ))}
                {alEditar && hechas.length > 0 && (
                  <div>
                    <div style={rotulo}>Creadas por ti</div>
                    <Tarjeta actividades={hechas} alElegir={alElegir} alEditar={setEditando} />
                  </div>
                )}
                <div style={rotulo}>¿No está?</div>
                <div style={grupo}><RenglonCrear texto="Crear mi actividad" onClick={() => setCreando('')} /></div>
              </>
            ) : (
              <>
                <div style={{ ...rotulo, marginTop: 4 }}>{hallazgos.length ? 'Resultados' : 'Sin resultados'}</div>
                {hallazgos.length > 0 && <Tarjeta actividades={hallazgos} alElegir={alElegir} />}
                {!hallazgos.length && <p style={{ margin: '4px 4px 12px', color: C.texto2, fontSize: 14.5, lineHeight: 1.4 }}>No la tenemos todavía. Créala con tu ícono y queda guardada.</p>}
                {ofreceCrear && (
                  <div style={{ ...grupo, marginTop: 12 }}><RenglonCrear texto={`Crear «${nombreNuevo}»`} onClick={() => setCreando(nombreNuevo)} /></div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </Hoja>
  );
}
