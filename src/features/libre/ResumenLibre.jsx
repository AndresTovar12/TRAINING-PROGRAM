import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { LT, KP } from '@/lib/theme';
import { DEPORTES, nombreDelDeporte } from '@/lib/metricas/deportes';
import { borraActividad, cambiaActividad, getActividad, getSeries } from '@/lib/metricasApi';
import { entrenosAnteriores } from '@/lib/entrenoLibreApi';
import { recordDe } from '@/lib/resumenLibre';
import { muestrasDeRuta } from '@/lib/recorrido';
import { actividadDeEntreno } from '@/lib/actividades';
import { entrenoDeActividad, rutaDe } from '@/lib/stickers/ficha';
import { cargaHistorial } from '@/lib/stickers/carga';
import { cuandoFue, filaDelRecord, fraseDeActividad, heroeDeActividad, secundariosDeActividad, tiempoCorto, zonasSimples } from '@/lib/paginaDelEntreno';
import { useTipoDeSesion } from '@/features/stickers/useTipoDeSesion';
import { useConfirmacion } from '@/components/Confirmacion';
import AvisoDeStickers from '@/features/stickers/AvisoDeStickers';
import CambiarNombre from '@/features/stickers/CambiarNombre';
import { tituloDeLaHoja } from '@/lib/stickers/catalogo';
import ElegirActividad from './ElegirActividad';
import PaginaDelEntreno, { PorKilometro, TuPulso } from './PaginaDelEntreno';
import { RelojEnEntreno } from '@/features/reloj/TarjetasDelReloj';
import { AVISO_RELOJ_TRAJO } from '@/lib/relojApple';
import { useReloj } from '@/lib/relojConectado';

const HojaDeStickers = lazy(() => import('@/features/stickers/HojaDeStickers'));

/* LA PÁGINA DE LA ACTIVIDAD (23 oct 2026, Activity Tracker; maqueta v4, pantalla «Tu actividad»). Al terminar un entreno, después de la celebración, se cae AQUÍ, en la
   página de esa actividad, no de regreso a Home. Desde «Tus entrenos» se abre igual.
   Fase 7 de los stickers (29 oct 2026, prototipo de caminos): la forma es la de `PaginaDelEntreno`, la misma que la de un workout del plan. Arriba el mapa (o la franja
   del color de la actividad), la tarjeta con UN número protagonista (la distancia; sin distancia, el tiempo), la frase que dice qué significa («Tu tercera carrera
   de la semana, y la más rápida») y dos o tres secundarios; el récord en su fila; «Por kilómetro» y «Tu pulso». Los números y las frases: `lib/paginaDelEntreno.js`.
   Stickers (28 oct 2026, docs/stickers.md): la hoja de stickers NUNCA se abre sola al terminar; si viene de terminar (`recien`), sale el aviso «Tus stickers están
   listos». «···» arriba: Cambiar el nombre, Cambiar la actividad y Borrar.
   `fila`: la fila de `actividades`. `muestras`: la ruta recién medida (si no, se lee la guardada). `record`: lo de `recordDe`. `conStickers`: abre ya con la hoja de
   stickers encima (el ⇪ de «Tus entrenos»). `filas`: sus entrenos (para la frase); `desde`: la hora del más viejo de esa lista si no llega más atrás (ver `fraseDeActividad`).
   `conRecord`: al abrir uno viejo, se busca si fue récord contra sus entrenos de antes del mismo deporte (solo sin plan: con plan manda lo programado).
   `alCambiar(fila)`: se cambió el nombre o la actividad (`alCrearPropia`: creó una actividad suya al cambiarla). `alBorrado()`: se borró. `alCerrarStickers`: al cerrar la hoja. */

export default function ResumenLibre({ fila: filaInicial, unidadPeso = 'kg', alCerrar, alCerrarStickers, conStickers = false, recien = false, muestras = null, record = null, actividad = null, propias = [], filas = [], desde = null, conRecord = false, alCrearPropia, alCambiar, alBorrado }) {
  const [fila, setFila] = useState(filaInicial);
  /* ¿Fue récord? Al terminar ya viene (`record`). Al abrir uno viejo, contra sus entrenos de ANTES del mismo deporte (de la base, no de la lista corta). */
  const [recordViejo, setRecordViejo] = useState(null);
  useEffect(() => {
    if (record || !conRecord || !filaInicial?.id || !filaInicial.atleta_id) return undefined;
    let vivo = true;
    entrenosAnteriores(filaInicial.atleta_id, filaInicial.deporte, filaInicial.inicio)
      .then((antes) => { if (vivo) setRecordViejo(recordDe(filaInicial, antes)); })
      .catch(() => {});
    return () => { vivo = false; };
  }, [record, conRecord, filaInicial]);
  const elRecord = record ?? recordViejo;
  const [cambiada, setCambiada] = useState(false); // ¿cambió la actividad a mano en esta página?
  const [historial, setHistorial] = useState(null);
  const tipoDeSesion = useTipoDeSesion();
  const paraCargar = useRef({ filaInicial, propias, tipoDeSesion });
  /* Al abrir: el entreno COMPLETO (la lista de «Tus entrenos» no trae las vueltas: sin ellas no hay «Por kilómetro», Parciales, Regla ni Tu mejor kilómetro)
     y el historial del año (Semana, Mes y Racha de los stickers). Si algo falla, la página sigue con lo que tiene. */
  useEffect(() => {
    const { filaInicial: f0, propias: p0, tipoDeSesion: t0 } = paraCargar.current;
    if (!f0?.id) return undefined;
    let vivo = true;
    getActividad(f0.id).then((completa) => {
      if (vivo && completa) setFila((antes) => ({ ...completa, titulo: antes.titulo, deporte: antes.deporte }));
    }).catch(() => {});
    cargaHistorial({ atletaId: f0.atleta_id, inicioMs: Date.parse(f0.inicio), propias: p0, tipoDeSesion: t0 }).then((h) => { if (vivo) setHistorial(h); });
    return () => { vivo = false; };
  }, []);
  /* EL PULSO DEL RELOJ (fase 5, 29 oct 2026). Al terminar un entreno con el Apple Watch, `SincronizaReloj` va por él a Salud (a los 8, 20 y 60 s): mientras,
     «Trayendo tu pulso del reloj…»; al llegar, este entreno se vuelve a leer y salen su pulso medio, máximo y calorías con «Lo midió tu Apple Watch». */
  const { conexion: relojConexion, aqui: relojAqui, trayendo } = useReloj();
  useEffect(() => {
    if (!fila?.id) return undefined;
    const alTraer = (e) => {
      if (!e.detail?.enriquecidos?.includes(fila.id)) return;
      getActividad(fila.id).then((completa) => { if (completa) setFila((antes) => ({ ...completa, titulo: antes.titulo, deporte: antes.deporte })); }).catch(() => {});
    };
    window.addEventListener(AVISO_RELOJ_TRAJO, alTraer);
    return () => window.removeEventListener(AVISO_RELOJ_TRAJO, alTraer);
  }, [fila?.id]);
  const pulsoDelReloj = fila.fc_media > 0 && (fila.metricas?.pulso_de === 'apple_watch' || fila.origen === 'healthkit');
  const trayendoPulso = recien && trayendo && !!relojConexion && relojAqui && !(fila.fc_media > 0);
  const [verStickers, setVerStickers] = useState(conStickers);
  const [menu, setMenu] = useState(null); // null | 'nombre' | 'actividad'
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
  const act = (cambiada ? null : actividad) ?? actividadDeEntreno(fila, propias);
  // La ficha de sus stickers: la misma para el aviso y para la hoja (`lib/stickers/ficha.js`).
  const entreno = useMemo(
    () => entrenoDeActividad({ fila, series, muestras: ruta, nombre, tipo: act ? { nombre: act.nombre, icono: act.icono } : null, record: elRecord, unidadPeso, historial }),
    [fila, series, ruta, nombre, act, elRecord, unidadPeso, historial],
  );
  // Se comparan por RITMO (segundos por km), no por lo que duró cada tramo: el último casi nunca es un kilómetro entero y por ser corto parecería el más rápido.
  const kms = (fila.vueltas ?? []).filter((v) => v.tipo === 'km' && v.dur > 0 && v.dist > 0).map((v) => ({ ...v, paso: v.ritmo ?? Math.round((v.dur / v.dist) * 1000) }));
  const enBici = fila.deporte === 'bici';
  const cierraStickers = () => { setVerStickers(false); alCerrarStickers?.(); };

  const cambia = async (cambios) => {
    setError(null);
    const nueva = await cambiaActividad(fila.id, cambios);
    if (nueva) {
      setFila(nueva);
      if (cambios.deporte) setCambiada(true);
      alCambiar?.(nueva);
    }
  };
  const renombra = async (titulo) => { await cambia({ titulo }); };
  const eligeActividad = async (a) => {
    setMenu(null);
    try { await cambia({ titulo: a.nombre, deporte: DEPORTES[a.deporte] ? a.deporte : 'otro' }); } catch { setError('No se pudo cambiar la actividad. Inténtalo otra vez.'); }
  };
  const borra = async () => {
    const si = await pregunta({ titulo: `¿Borrar «${nombre}»?`, detalle: 'Se borra el entreno y sus stickers. No se puede deshacer.', confirmar: 'Borrar', peligro: true });
    if (!si) return;
    try { await borraActividad(fila.id); alBorrado?.(fila); alCerrar(); } catch { setError('No se pudo borrar. Inténtalo otra vez.'); }
  };

  const frase = useMemo(() => fraseDeActividad(fila, { otras: filas, propias, desde }), [fila, filas, propias, desde]);
  const recordDeLaFila = filaDelRecord(elRecord);
  const kmsDeLaFila = kms.map((k) => ({ n: k.n, dist: k.dist, paso: enBici ? -3600 / k.paso : k.paso }));

  return (
    <PaginaDelEntreno
      nombre={nombre} meta={cuandoFue(fila.inicio, fila.desfase_min)}
      // El mapa, solo si de verdad hubo recorrido (el mismo umbral de los stickers: un pádel en su cancha no dibuja un garabato).
      ruta={ruta && rutaDe(ruta) ? ruta : null} actividad={act}
      heroe={heroeDeActividad(fila)} frase={frase} secundarios={secundariosDeActividad(fila)} delReloj={pulsoDelReloj}
      record={recordDeLaFila} error={error} alCerrar={alCerrar} alCompartir={() => setVerStickers(true)}
      opciones={fila.id ? [
        { texto: 'Cambiar el nombre', onClick: () => setMenu('nombre') },
        { texto: 'Cambiar la actividad', onClick: () => setMenu('actividad') },
        { texto: 'Borrar entreno', onClick: borra, peligro: true },
      ] : []}
      debajo={recien ? (
        <>
          <AvisoDeStickers entreno={entreno} numero={heroeDeActividad(fila)} alAbrir={() => setVerStickers(true)} />
          {trayendoPulso ? (
            <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#fff', borderRadius: 18, padding: '14px 16px', fontSize: 14.5, fontWeight: 600, color: LT.text2 }}>
              <Loader2 size={20} className="spin" color={KP.blue} />Trayendo tu pulso del reloj…
            </div>
          ) : <RelojEnEntreno conPulso={fila.fc_media > 0} />}
        </>
      ) : null}
      encima={(
        <>
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
        </>
      )}
    >
      {/* En bici, el más rápido es el de más km/h (se ordena con el paso en negativo). */}
      <PorKilometro kms={kmsDeLaFila} enBici={enBici} texto={(p) => (enBici ? (-p).toFixed(1) : tiempoCorto(p))} />
      <TuPulso media={fila.fc_media} maximo={fila.fc_max} zonas={zonasSimples(fila.zonas_s)} deReloj={pulsoDelReloj} />
    </PaginaDelEntreno>
  );
}
