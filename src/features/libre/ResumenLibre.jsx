import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, MoreHorizontal, Share2, Trophy } from 'lucide-react';
import { LT, FONT, NUM_STYLE, KP } from '@/lib/theme';
import { datosDelResumen } from '@/lib/resumenLibre';
import { DEPORTES, nombreDelDeporte } from '@/lib/metricas/deportes';
import { fechaLarga, horaTexto } from '@/lib/metricas/formato';
import { borraActividad, cambiaActividad, getSeries } from '@/lib/metricasApi';
import { muestrasDeRuta } from '@/lib/recorrido';
import { textoDeRitmo } from '@/lib/ubicacion';
import { actividadDeEntreno } from '@/lib/actividades';
import { entrenoDeActividad } from '@/lib/stickers/ficha';
import { useConfirmacion } from '@/components/Confirmacion';
import AvisoDeStickers from '@/features/stickers/AvisoDeStickers';
import CambiarNombre from '@/features/stickers/CambiarNombre';
import { tituloDeLaHoja } from '@/lib/stickers/catalogo';
import MapaDeCarrera from './MapaDeCarrera';
import IconoDeActividad from './IconoDeActividad';
import ElegirActividad from './ElegirActividad';
import { botonGrande, tarjetaBlanca } from './estilosLibre';

const HojaDeStickers = lazy(() => import('@/features/stickers/HojaDeStickers'));

/* LA PÁGINA DE LA ACTIVIDAD (23 oct 2026, Activity Tracker; maqueta v4, pantalla «Tu actividad»). Al terminar un entreno, después de la celebración, se cae AQUÍ, en la
   página de esa actividad, no de regreso a Home. Desde «Tus entrenos» se abre igual.
   Lleva: el mapa con la ruta (si llevó GPS), la fecha y el nombre con su ícono, el récord si lo rompió (con su valor, la diferencia y la fecha del mejor anterior),
   los números, «Por kilómetro» (el más rápido en azul) y «Compartir» fijo abajo. Antes era una hoja con el resumen (12 oct 2026; reestructura visual el 15 oct).
   Stickers (28 oct 2026, docs/stickers.md): la hoja de stickers NUNCA se abre sola al terminar; si viene de terminar (`recien`), sale el aviso «Tus stickers están
   listos». «···» arriba: Cambiar el nombre, Cambiar la actividad y Borrar.
   `fila`: la fila de `actividades`. `muestras`: la ruta recién medida (si no, se lee la guardada). `record`: lo de `recordDe`. `conStickers`: abre ya con la hoja de
   stickers encima (el ⇪ de «Tus entrenos»). `alCambiar(fila)`: se cambió el nombre o la actividad (`alCrearPropia`: creó una actividad suya al cambiarla). `alBorrado()`: se borró. `alCerrarStickers`: al cerrar la hoja. */

const Dato = ({ valor, etiqueta }) => (
  <div style={{ minWidth: 0 }}>
    <div style={{ fontSize: 26, fontWeight: 800, color: LT.text, letterSpacing: -0.5, lineHeight: 1.1, ...NUM_STYLE }}>{valor}</div>
    <div style={{ fontSize: 12.5, fontWeight: 600, color: LT.text2, marginTop: 3 }}>{etiqueta}</div>
  </div>
);

export default function ResumenLibre({ fila: filaInicial, unidadPeso = 'kg', alCerrar, alCerrarStickers, conStickers = false, recien = false, muestras = null, record = null, actividad = null, propias = [], filas = [], alCrearPropia, alCambiar, alBorrado }) {
  const [fila, setFila] = useState(filaInicial);
  const [verStickers, setVerStickers] = useState(conStickers);
  const [menu, setMenu] = useState(null); // null | 'opciones' | 'nombre' | 'actividad'
  const [error, setError] = useState(null);
  const pregunta = useConfirmacion();
  // La ruta guardada (de un entreno con GPS): se lee una vez. La recién medida ya viene en `muestras`.
  const [series, setSeries] = useState(null);
  useEffect(() => {
    if (!fila?.id || (Array.isArray(muestras) && muestras.length >= 2)) return undefined;
    let vivo = true;
    getSeries(fila.id).then((s) => { if (vivo) setSeries(s); }).catch(() => {});
    return () => { vivo = false; };
  }, [fila?.id, muestras]);
  const ruta = useMemo(() => {
    if (Array.isArray(muestras) && muestras.length >= 2) return muestras;
    const m = muestrasDeRuta(series?.ruta);
    return m.length >= 2 ? m : null;
  }, [muestras, series]);
  const nombre = fila.titulo || nombreDelDeporte(fila.deporte);
  // La actividad elegida a mano en esta página manda sobre la que trajo al guardarse.
  const act = (fila !== filaInicial ? null : actividad) ?? actividadDeEntreno(fila, propias);
  // La ficha de sus stickers: la misma para el aviso y para la hoja (`lib/stickers/ficha.js`).
  const entreno = useMemo(
    () => entrenoDeActividad({ fila, muestras: ruta, nombre, tipo: act ? { nombre: act.nombre, icono: act.icono } : null, record, unidadPeso }),
    [fila, ruta, nombre, act, record, unidadPeso],
  );
  // Se comparan por RITMO (segundos por km), no por lo que duró cada tramo: el último casi nunca es un kilómetro entero y por ser corto parecería el más rápido.
  const kms = (fila.vueltas ?? []).filter((v) => v.tipo === 'km' && v.dur > 0 && v.dist > 0).map((v) => ({ ...v, paso: v.ritmo ?? Math.round((v.dur / v.dist) * 1000) }));
  const rapido = kms.length ? Math.min(...kms.map((k) => k.paso)) : 0;
  const lento = kms.length ? Math.max(...kms.map((k) => k.paso)) : 0;
  const enBici = fila.deporte === 'bici';
  const cierraStickers = () => { setVerStickers(false); alCerrarStickers?.(); };

  const cambia = async (cambios) => {
    setError(null);
    const nueva = await cambiaActividad(fila.id, cambios);
    if (nueva) { setFila(nueva); alCambiar?.(nueva); }
  };
  const renombra = async (titulo) => { await cambia({ titulo }); };
  const eligeActividad = async (a) => {
    setMenu(null);
    try { await cambia({ titulo: a.nombre, deporte: DEPORTES[a.deporte] ? a.deporte : 'otro' }); } catch { setError('No se pudo cambiar la actividad. Inténtalo otra vez.'); }
  };
  const borra = async () => {
    setMenu(null);
    const si = await pregunta({ titulo: `¿Borrar «${nombre}»?`, detalle: 'Se borra el entreno y sus stickers. No se puede deshacer.', confirmar: 'Borrar', peligro: true });
    if (!si) return;
    try { await borraActividad(fila.id); alBorrado?.(fila); alCerrar(); } catch { setError('No se pudo borrar. Inténtalo otra vez.'); }
  };
  const opcion = { display: 'block', width: '100%', minHeight: 56, border: 'none', background: 'transparent', fontFamily: FONT, fontSize: 17, fontWeight: 600, color: LT.text, cursor: 'pointer' };

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={nombre} style={{ position: 'fixed', inset: 0, zIndex: 3200, background: LT.bg, fontFamily: FONT, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: 'calc(10px + env(safe-area-inset-top)) 12px 8px', maxWidth: 560, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        <button type="button" onClick={alCerrar} className="kp-press" style={{ display: 'inline-flex', alignItems: 'center', gap: 2, padding: '8px 12px 8px 6px', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: FONT, fontSize: 15.5, fontWeight: 800, color: LT.blue }}>
          <ChevronLeft size={20} /> Listo
        </button>
        {fila.id && (
          <button type="button" onClick={() => setMenu('opciones')} aria-label="Más opciones" className="kp-press" style={{ width: 44, height: 44, borderRadius: 14, border: 'none', background: LT.surface, color: LT.text, display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
            <MoreHorizontal size={22} />
          </button>
        )}
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ maxWidth: 560, margin: '0 auto', padding: '0 16px calc(96px + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {ruta && (
            <div style={{ height: 220, borderRadius: 22, overflow: 'hidden', background: '#1A1F33' }}>
              <MapaDeCarrera muestras={ruta} sigue={false} alto="100%" redondo={false} />
            </div>
          )}
          <div style={{ ...tarjetaBlanca, padding: '18px 18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <IconoDeActividad actividad={act} size={46} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: KP.blue, ...NUM_STYLE }}>{fechaLarga(fila.inicio, fila.desfase_min)} · {horaTexto(fila.inicio, fila.desfase_min)}</div>
                <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.5, color: LT.text, marginTop: 2, overflowWrap: 'break-word' }}>{nombre}</div>
              </div>
            </div>
            {record && (
              <>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginTop: 14, padding: '7px 12px', borderRadius: 99, background: '#FFF4D6', color: '#8A5A00', fontSize: 14, fontWeight: 800 }}>
                  <Trophy size={16} /> {record.texto}
                </div>
                {record.detalle && <div style={{ fontSize: 13.5, fontWeight: 600, color: LT.text2, marginTop: 6, ...NUM_STYLE }}>{record.detalle}</div>}
              </>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: 14, marginTop: 18 }}>
              {datosDelResumen(fila).map((d) => <Dato key={d.etiqueta} {...d} />)}
            </div>
          </div>
          {error && <div role="alert" style={{ fontSize: 14, fontWeight: 600, color: '#B42318', padding: '0 4px' }}>{error}</div>}
          {recien && <AvisoDeStickers entreno={entreno} alAbrir={() => setVerStickers(true)} />}
          {kms.length > 0 && (
            <div>
              <div style={{ fontSize: 17, fontWeight: 800, color: LT.text, margin: '4px 2px 8px' }}>Por kilómetro</div>
              <div style={{ ...tarjetaBlanca, padding: '4px 16px' }}>
                {kms.map((k, i) => {
                  const ancho = lento === rapido ? 70 : 35 + ((lento - k.paso) / (lento - rapido)) * 55;
                  return (
                    <div key={k.n} style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 46, borderTop: i > 0 ? '1px solid #ECEEF2' : 'none' }}>
                      <span style={{ minWidth: 20, fontSize: 14, fontWeight: 600, color: LT.text2, ...NUM_STYLE }}>{k.n}{k.dist < 990 ? <span style={{ fontSize: 11.5 }}> · {(k.dist / 1000).toFixed(2)} km</span> : null}</span>
                      <span style={{ flex: 1, height: 7, borderRadius: 4, background: '#EEF0F4', overflow: 'hidden' }}>
                        <span style={{ display: 'block', height: '100%', width: `${ancho}%`, borderRadius: 4, background: k.paso === rapido ? KP.blue : '#FF8A8E' }} />
                      </span>
                      <span style={{ width: 52, textAlign: 'right', fontSize: 15, fontWeight: 800, color: LT.text, ...NUM_STYLE }}>{enBici ? `${(3600 / k.paso).toFixed(1)}` : textoDeRitmo(k.paso)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
      {/* «Compartir» fijo abajo: siempre a la mano, por largo que sea el entreno. */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '12px 16px calc(10px + env(safe-area-inset-bottom))', background: LT.bg }}>
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          <button type="button" onClick={() => setVerStickers(true)} className="kp-press" style={botonGrande()}><Share2 size={20} /> Compartir</button>
        </div>
      </div>

      {menu === 'opciones' && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 3260, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div onClick={() => setMenu(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.42)' }} />
          <div role="dialog" aria-label="Opciones del entreno" style={{ position: 'relative', display: 'grid', gap: 8, padding: '0 10px calc(10px + env(safe-area-inset-bottom))', maxWidth: 560, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
            <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden' }}>
              <button type="button" autoFocus onClick={() => setMenu('nombre')} style={opcion}>Cambiar el nombre</button>
              <button type="button" onClick={() => setMenu('actividad')} style={{ ...opcion, borderTop: '1px solid #ECEEF2' }}>Cambiar la actividad</button>
              <button type="button" onClick={borra} style={{ ...opcion, borderTop: '1px solid #ECEEF2', color: '#D92D20' }}>Borrar entreno</button>
            </div>
            <button type="button" onClick={() => setMenu(null)} style={{ ...opcion, background: '#fff', borderRadius: 16, fontWeight: 700 }}>Cancelar</button>
          </div>
        </div>
      )}
      {menu === 'nombre' && (
        <CambiarNombre
          nombre={nombre} capa={3260} alCancelar={() => setMenu(null)}
          alGuardar={async (t) => { try { await renombra(t); setMenu(null); } catch { setError('No se pudo guardar el nombre. Inténtalo otra vez.'); setMenu(null); } }}
        />
      )}
      {menu === 'actividad' && (
        <ElegirActividad filas={filas} propias={propias} alElegir={eligeActividad} alCrear={(a) => { alCrearPropia?.(a); eligeActividad(a); }} alCerrar={() => setMenu(null)} />
      )}
      {verStickers && (
        <Suspense fallback={null}>
          <HojaDeStickers
            entreno={entreno} titulo={tituloDeLaHoja({ deporte: fila.deporte })} nombre={nombre} capa={3300}
            alRenombrar={fila.id ? renombra : null} onCerrar={cierraStickers}
          />
        </Suspense>
      )}
    </div>,
    document.body,
  );
}
