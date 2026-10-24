import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronLeft, Loader2, MapPin, Plus, Search } from 'lucide-react';
import { FONT } from '@/lib/theme';
import {
  COLORES_PARA_CREAR, GRUPOS_DE_ACTIVIDADES, ICONO_PROPIO, MAX_NOMBRE, buscaActividades, creaActividad, hayConNombre, tusActividades,
} from '@/lib/actividades';
import { buscaIconos, sugiereIcono } from '@/lib/iconosDeTipo';
import { useCatalogoDeIconos } from '@/lib/useCatalogoDeIconos';
import { IconoSvg } from '@/components/IconoDeTipo';
import IconoDeActividad from './IconoDeActividad';

/* ELIGE TU ACTIVIDAD (23 oct 2026, Activity Tracker; maqueta v4 aprobada: `docs/maquetas/2026-10-21-experiencia-tracker.html`, pantallas «Cambiar actividad» y «Crear la tuya»).
   Se abre desde el botón de la izquierda de «listo para empezar» (el punto ● de la barra). Oscura, como esa pantalla.
     · Arriba «Tus actividades»: lo que hizo últimamente y las que creó (un toque si repite lo de siempre).
     · Abajo todas, por grupos; las que llevan mapa dicen «mapa».
     · Buscador sin acentos. Si lo que escribe no existe: «Crear "Waterpolo"».
     · Crear la suya: nombre, COLOR e ÍCONO (del catálogo de la app, el de los tipos de sesión; mientras escribe el nombre se le sugiere uno) y UNA pregunta,
       «¿Te mueves de un lugar a otro?» (si sí, lleva mapa y distancia). Queda guardada en su configuración. Sin emojis: Andrés, «no tienen personalidad».
   `filas`: sus entrenos recientes (para «Tus actividades»). `propias`: las que creó. `alElegir(actividad)`. `alCrear(actividad)`: la guarda y la elige. */

const C = { fondo: '#0F1220', tarjeta: '#1A1E2E', tarjeta2: '#232838', texto: '#FFFFFF', texto2: 'rgba(255,255,255,0.62)', texto3: 'rgba(255,255,255,0.42)', azul: '#2F6BFF', verde: '#22C38E' };

const rotulo = { margin: '18px 4px 8px', fontSize: 13, fontWeight: 700, color: C.texto3 };
const fila = {
  width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', border: 'none', borderRadius: 16, background: C.tarjeta, color: C.texto,
  fontFamily: FONT, fontSize: 16.5, fontWeight: 700, cursor: 'pointer', textAlign: 'left', touchAction: 'manipulation',
};
const redondo = { width: 44, height: 44, borderRadius: 14, border: 'none', background: 'rgba(255,255,255,0.12)', color: '#fff', display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0 };
const masDe = { width: 38, height: 38, borderRadius: 12, background: 'rgba(47,107,255,0.2)', color: C.azul, display: 'grid', placeItems: 'center', flexShrink: 0 };

function Fila({ actividad, onClick }) {
  return (
    <button type="button" onClick={onClick} style={fila}>
      <IconoDeActividad actividad={actividad} oscuro />
      <span style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{actividad.nombre}</span>
      {actividad.gps && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12.5, fontWeight: 700, color: C.verde }}><MapPin size={13} /> mapa</span>}
    </button>
  );
}

function Crear({ inicial, propias, alGuardar, alVolver }) {
  const catalogo = useCatalogoDeIconos();
  const [nombre, setNombre] = useState(inicial);
  const [color, setColor] = useState(COLORES_PARA_CREAR[0]);
  const [elegido, setElegido] = useState(null); // el ícono que tocó; sin tocar ninguno, el que sugiere el nombre
  const [busca, setBusca] = useState('');
  const [gps, setGps] = useState(false);
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
    const r = creaActividad({ nombre, icono, color, gps }, propias);
    if (!r) { setAviso('Escribe cómo se llama.'); return; }
    alGuardar(r.actividad, r.yaExistia);
  };
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 'calc(14px + env(safe-area-inset-top)) 16px 4px' }}>
        <button type="button" onClick={alVolver} aria-label="Volver" style={redondo}><ChevronLeft size={22} /></button>
        <div><div style={{ fontSize: 13, fontWeight: 700, color: C.texto3 }}>Nueva actividad</div><div style={{ fontSize: 22, fontWeight: 800 }}>Hazla tuya</div></div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', margin: '4px 0 16px' }}>
          <IconoDeActividad actividad={{ icono, color, nombre }} size={92} oscuro />
        </div>
        <input
          value={nombre} onChange={(e) => { setNombre(e.target.value); setAviso(null); }} maxLength={MAX_NOMBRE} placeholder="Nombre" aria-label="Nombre de la actividad" autoFocus={!inicial}
          style={{ width: '100%', boxSizing: 'border-box', border: 'none', borderRadius: 16, background: C.tarjeta, color: C.texto, fontFamily: FONT, fontSize: 20, fontWeight: 700, padding: '14px 16px', outline: 'none', textAlign: 'center' }}
        />
        {aviso && <div role="alert" style={{ marginTop: 8, textAlign: 'center', color: '#FFB547', fontSize: 14, fontWeight: 600 }}>{aviso}</div>}

        <div style={rotulo}>Color</div>
        <div role="group" aria-label="Color" style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {COLORES_PARA_CREAR.map((c) => (
            <button
              key={c} type="button" onClick={() => setColor(c)} aria-pressed={c === color} aria-label={`Color ${c}`}
              style={{ width: 38, height: 38, borderRadius: 19, border: 'none', cursor: 'pointer', background: c, display: 'grid', placeItems: 'center', boxShadow: c === color ? '0 0 0 3px #0F1220, 0 0 0 5px #fff' : 'none', touchAction: 'manipulation' }}
            >{c === color && <Check size={16} color="#fff" strokeWidth={3.4} />}</button>
          ))}
        </div>

        <div style={rotulo}>Ícono</div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px', borderRadius: 14, background: C.tarjeta }}>
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
                style={{ height: 52, borderRadius: 14, border: 'none', cursor: 'pointer', display: 'grid', placeItems: 'center', background: puesto ? `${color}33` : C.tarjeta, color: puesto ? color : C.texto, touchAction: 'manipulation' }}
              ><IconoSvg svg={ic.svg} size={24} /></button>
            );
          })}
        </div>

        <button
          type="button" onClick={() => setGps((g) => !g)} aria-pressed={gps}
          style={{ ...fila, marginTop: 16, justifyContent: 'space-between', padding: '14px 16px' }}
        >
          <span><span style={{ display: 'block' }}>¿Te mueves de un lugar a otro?</span><span style={{ display: 'block', fontSize: 13.5, fontWeight: 500, color: C.texto2, marginTop: 2 }}>Si sí, llevará mapa y distancia.</span></span>
          <span aria-hidden="true" style={{ width: 50, height: 30, borderRadius: 15, background: gps ? C.verde : 'rgba(255,255,255,0.18)', position: 'relative', flexShrink: 0, transition: 'background .15s' }}>
            <span style={{ position: 'absolute', top: 3, left: gps ? 23 : 3, width: 24, height: 24, borderRadius: 12, background: '#fff', transition: 'left .15s' }} />
          </span>
        </button>
      </div>
      <div style={{ padding: '10px 16px calc(14px + env(safe-area-inset-bottom))' }}>
        <button type="button" onClick={guardar} style={{ width: '100%', minHeight: 58, borderRadius: 20, border: 'none', cursor: 'pointer', fontFamily: FONT, fontSize: 18, fontWeight: 800, color: '#fff', background: C.azul, touchAction: 'manipulation' }}>
          Guardar y empezar
        </button>
      </div>
    </>
  );
}

export default function ElegirActividad({ filas = [], propias = [], alElegir, alCrear, alCerrar }) {
  const [busca, setBusca] = useState('');
  const [creando, setCreando] = useState(null); // null | el nombre con que arranca
  const tuyas = useMemo(() => tusActividades(filas, propias), [filas, propias]);
  const q = busca.trim();
  const hallazgos = useMemo(() => buscaActividades(q, propias), [q, propias]);
  const ofreceCrear = q && !hayConNombre(q, propias);
  const nombreNuevo = q.replace(/^./, (c) => c.toUpperCase()).slice(0, MAX_NOMBRE);

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Elige tu actividad" style={{ position: 'fixed', inset: 0, zIndex: 3300, background: C.fondo, color: C.texto, fontFamily: FONT, display: 'flex', flexDirection: 'column' }}>
      {creando !== null ? (
        <Crear inicial={creando} propias={propias} alVolver={() => setCreando(null)} alGuardar={(act, yaExistia) => (yaExistia ? alElegir(act) : alCrear(act))} />
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 'calc(14px + env(safe-area-inset-top)) 16px 4px' }}>
            <button type="button" onClick={alCerrar} aria-label="Volver" style={redondo}><ChevronLeft size={22} /></button>
            <div><div style={{ fontSize: 13, fontWeight: 700, color: C.texto3 }}>¿Qué vas a hacer?</div><div style={{ fontSize: 22, fontWeight: 800 }}>Elige tu actividad</div></div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '10px 16px 0', padding: '0 14px', borderRadius: 16, background: C.tarjeta }}>
            <Search size={18} color={C.texto2} aria-hidden="true" />
            <input
              type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Busca: correr, pádel, waterpolo…" aria-label="Buscar actividad" autoComplete="off"
              style={{ flex: 1, minWidth: 0, border: 'none', background: 'transparent', color: C.texto, fontFamily: FONT, fontSize: 16, fontWeight: 600, padding: '14px 0', outline: 'none' }}
            />
          </label>
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px calc(18px + env(safe-area-inset-bottom))' }}>
            {!q ? (
              <>
                <div style={rotulo}>Tus actividades</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {tuyas.map((x) => (
                    <button
                      key={x.id} type="button" onClick={() => alElegir(x)}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px 6px 6px', borderRadius: 99, border: 'none', background: C.tarjeta, color: C.texto, fontFamily: FONT, fontSize: 15, fontWeight: 700, cursor: 'pointer', touchAction: 'manipulation' }}
                    ><IconoDeActividad actividad={x} size={30} oscuro />{x.nombre}</button>
                  ))}
                </div>
                {GRUPOS_DE_ACTIVIDADES.map((g) => (
                  <div key={g.grupo}>
                    <div style={rotulo}>{g.grupo}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{g.actividades.map((x) => <Fila key={x.id} actividad={x} onClick={() => alElegir(x)} />)}</div>
                  </div>
                ))}
                <div style={rotulo}>¿No está?</div>
                <button type="button" onClick={() => setCreando('')} style={{ ...fila, color: C.azul }}><span aria-hidden="true" style={masDe}><Plus size={20} /></span> Crear mi actividad</button>
              </>
            ) : (
              <>
                <div style={rotulo}>{hallazgos.length ? 'Resultados' : 'Sin resultados'}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{hallazgos.map((x) => <Fila key={x.id} actividad={x} onClick={() => alElegir(x)} />)}</div>
                {!hallazgos.length && <p style={{ margin: '4px 4px 12px', color: C.texto2, fontSize: 14.5, lineHeight: 1.4 }}>No la tenemos todavía. Créala con tu ícono y queda guardada.</p>}
                {ofreceCrear && (
                  <button type="button" onClick={() => setCreando(nombreNuevo)} style={{ ...fila, marginTop: 6, color: C.azul }}>
                    <span aria-hidden="true" style={masDe}><Plus size={20} /></span> Crear «{nombreNuevo}»
                  </button>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>,
    document.body,
  );
}
