import { useRef, useState } from 'react';
import { Activity, ChevronLeft, Settings2, Upload } from 'lucide-react';
import { LT, KP, FONT } from '@/lib/theme';
import HojaFlotante from '@/components/HojaFlotante';
import { duracionTexto } from '@/lib/metricas/formato';
import CargaYForma from './CargaYForma';
import DetalleDeEntreno from './DetalleDeEntreno';
import ImportarEntrenos from './ImportarEntrenos';
import ListaDeEntrenos from './ListaDeEntrenos';
import { Boton, Cargando, EstadoVacio, Pestanas } from './Piezas';
import Recuperacion from './Recuperacion';
import Resumen from './Resumen';
import UmbralesDelAtleta from './UmbralesDelAtleta';
import { useMetricas } from './useMetricas';

/* LAS MÉTRICAS DE UN ATLETA: la pantalla que el coach abre desde su ficha (y el atleta desde su perfil) para ver cómo entrena de verdad, según su reloj.
   Cuatro pestañas (Resumen, Entrenos, Carga, Recuperación), el detalle de cada entreno, la importación de archivos y los umbrales de pulso.

   Andrés (10 oct 2026): «es muy importante (especialmente con el Apple Watch y app instalable) que el coach pueda ver todas las métricas del entrenamiento…
   ritmo cardiaco, etc.»; «se comparte todo»; y que el tablero «sea fácil de entender». Los datos son del atleta: los ve y los puede importar, y los ve quien
   lo atiende (su coach o su equipo). Ver `docs/metricas-del-entrenamiento.md`. */

const PESTANAS = [
  { id: 'resumen', titulo: 'Resumen' }, { id: 'entrenos', titulo: 'Entrenos' }, { id: 'carga', titulo: 'Carga' }, { id: 'recuperacion', titulo: 'Recuperación' },
];

function Contenido({ atleta, esAtleta, abrirEn, onCerrar }) {
  const m = useMetricas(atleta.id);
  const contenido = useRef(null);
  const [vista, setVistaTal] = useState('resumen');
  const [detalle, setDetalleTal] = useState(null);
  // Al cambiar de pestaña o abrir un entreno se empieza desde arriba (la hoja ya venía desplazada de la pantalla anterior).
  const arriba = () => contenido.current?.closest('[data-hoja-cuerpo]')?.scrollTo({ top: 0 });
  const setVista = (v) => { setVistaTal(v); arriba(); };
  const setDetalle = (d) => { setDetalleTal(d); arriba(); };
  const [panel, setPanel] = useState(abrirEn === 'importar' ? 'importar' : null); // null | 'importar' | 'umbrales'
  const nombre = atleta.full_name || atleta.username || 'Atleta';
  const hayDatos = m.actividades.length > 0 || m.recuperacion.length > 0;

  const subtitulo = m.cargando && !hayDatos ? '' : `${m.actividades.length} ${m.actividades.length === 1 ? 'entreno' : 'entrenos'}${m.d.estaSemana?.duracion_s ? ` · esta semana ${duracionTexto(m.d.estaSemana.duracion_s)}` : ''}`;
  const botonDeImportar = (
    <Boton principal icono={Upload} onClick={() => setPanel('importar')}>Importar entrenos</Boton>
  );

  const acciones = (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
      <Boton pequeno icono={Upload} onClick={() => setPanel('importar')}>Importar</Boton>
      <Boton pequeno icono={Settings2} onClick={() => setPanel('umbrales')}>Umbrales de pulso</Boton>
    </div>
  );

  let cuerpo;
  if (panel) {
    cuerpo = (
      <div>
        <button
          type="button" onClick={() => setPanel(null)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 2, padding: '6px 10px 6px 4px', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: FONT, fontSize: 14.5, fontWeight: 800, color: LT.blue, touchAction: 'manipulation' }}
        >
          <ChevronLeft size={18} /> Métricas
        </button>
        {panel === 'importar' && (
          <ImportarEntrenos
            atletaId={atleta.id} actividades={m.actividades} esAtleta={esAtleta}
            alTerminar={() => { m.recarga(); setPanel(null); setVista('entrenos'); }} alCancelar={() => setPanel(null)}
          />
        )}
        {panel === 'umbrales' && m.umbrales && (
          <UmbralesDelAtleta atletaId={atleta.id} umbrales={m.umbrales} escritos={m.escritos} alGuardar={() => { m.recarga(); setPanel(null); }} alCancelar={() => setPanel(null)} />
        )}
      </div>
    );
  } else if (m.error && !hayDatos) {
    cuerpo = (
      <EstadoVacio icono={Activity} titulo="No se pudieron cargar las métricas" texto={m.error}>
        <Boton principal onClick={m.recarga}>Reintentar</Boton>
      </EstadoVacio>
    );
  } else if (m.cargando && !hayDatos) {
    cuerpo = <Cargando texto="Cargando las métricas…" />;
  } else if (detalle) {
    cuerpo = <DetalleDeEntreno key={detalle.id} actividad={detalle} alVolver={() => setDetalle(null)} puedeBorrar alBorrado={() => { setDetalle(null); m.recarga(); }} />;
  } else if (!hayDatos) {
    cuerpo = (
      <>
        <EstadoVacio
          icono={Activity} titulo={esAtleta ? 'Aquí verás cómo entrenas' : `Todavía no hay métricas de ${nombre}`}
          texto={esAtleta
            ? 'Trae tus entrenos del Apple Watch u otro reloj y verás tu pulso, tu ritmo, tu carga y cómo recuperas. Tu coach también los ve.'
            : 'Cuando se importen sus entrenos del reloj (Apple Watch, Garmin, Strava…) verás su pulso, su ritmo, su carga y cómo recupera. Se pueden importar desde su perfil o desde aquí.'}
        >
          {botonDeImportar}
        </EstadoVacio>
      </>
    );
  } else {
    cuerpo = (
      <>
        {/* Las pestañas se quedan arriba al desplazarse: el coach salta de una a otra sin volver a subir. */}
        <div style={{ position: 'sticky', top: 'calc(var(--hoja-pt, 0px) * -1)', zIndex: 5, background: LT.bg, margin: 'calc(var(--hoja-pt, 0px) * -1) calc(var(--hoja-px, 18px) * -1) 0', padding: 'calc(var(--hoja-pt, 0px) + 2px) var(--hoja-px, 18px) 8px' }}>
          <Pestanas items={PESTANAS} valor={vista} onChange={setVista} etiqueta="Métricas" />
        </div>
        {acciones}
        <div style={{ marginTop: 16 }}>
          {vista === 'resumen' && <Resumen d={m.d} umbrales={m.umbrales} alAbrir={setDetalle} alIrA={setVista} />}
          {vista === 'entrenos' && <ListaDeEntrenos d={m.d} hoy={m.hoy} alAbrir={setDetalle} puedeImportar alImportar={botonDeImportar} />}
          {vista === 'carga' && <CargaYForma d={m.d} />}
          {vista === 'recuperacion' && <Recuperacion d={m.d} recuperacion={m.recuperacion} hoy={m.hoy} />}
        </div>
      </>
    );
  }

  return (
    <HojaFlotante titulo={esAtleta ? 'Mis métricas' : `Métricas · ${nombre}`} subtitulo={subtitulo} onCerrar={onCerrar} ancho={1080}>
      <div ref={contenido} style={{ color: LT.text, background: 'transparent' }}>
        {m.cargando && hayDatos && <div role="status" style={{ position: 'sticky', top: 0, height: 3, background: `linear-gradient(90deg, ${KP.blue}, transparent)`, borderRadius: 2, marginBottom: 6 }} />}
        {cuerpo}
      </div>
    </HojaFlotante>
  );
}

/** `atleta`: `{ id, full_name, username }`. `esAtleta`: lo abre el propio atleta (cambia los textos). `abrirEn`: `'importar'` para llegar directo a traer archivos. */
export default function MetricasDelAtleta({ atleta, esAtleta = false, abrirEn = null, onCerrar }) {
  // Con `key` por atleta: al cambiar de persona, todo empieza de cero.
  return <Contenido key={atleta.id} atleta={atleta} esAtleta={esAtleta} abrirEn={abrirEn} onCerrar={onCerrar} />;
}
