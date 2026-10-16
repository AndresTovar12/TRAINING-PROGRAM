import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronRight, Layers, Loader2, Plus, Trash2, Video } from 'lucide-react';
import { T, KP, FONT, UI } from '@/lib/theme';
import { Fila, FilaElegir, Interruptor as Switch, Segmentado } from '@/components/ui';
import HojaFlotante from '@/components/HojaFlotante';
import Ventana from '@/features/misplanes/Ventana';
import SelectorDeMisPlanes from '@/features/misplanes/SelectorDeMisPlanes';
import CampoDeFoto from '@/features/admin/CampoDeFoto';
import { HojaDeClase } from '@/features/admin/ClaseDeLaSesion';
import { ligaExterna } from '@/lib/videos';
import { botonBlanco, botonPrincipal } from '@/features/misplanes/estilos';
import {
  ETIQUETA_DE_CONTENIDO, TIPOS_DE_VENTA, VENTANAS, VENTANA_MAXIMA, cuentaMisClases, esBiblioteca, esSuelto, fuenteParaVender, guardaPlanEnVenta, precioMinimoDe, publicaPlan, slugUnico, tipoDeCobroDe,
} from '@/lib/vitrinaApi';
import { DEPORTES, EQUIPOS, NIVELES, SEXOS, edadesValidas, marcadosValidos, textoDeEdades } from '@/lib/paraQuien';
import EdadesDelPlan from './EdadesDelPlan';

/* LA FICHA DE UN PLAN EN VENTA: lo que el coach llena para venderlo.

   Andrés, 12 oct 2026 (rediseño aprobado): el nombre, la descripción y la foto salen del plan de «Mis planes» y se pueden cambiar; «Para quién es» ya no es un texto libre sino
   opciones (deporte o disciplina, edades, sexo, equipo que necesita, nivel) más el objetivo; precio y cómo se cobra (mínimo $500); qué incluye (chat y técnica por video) y cuánto ve
   el comprador hacia adelante (por defecto un mes completo; se puede bajar, nunca subir). Se fueron «por dónde se puede entrar» —ahora el comprador elige la semana en la hoja del programa— y
   «tu liga», que se arma sola con el nombre del plan y no cambia después (ya anda en Instagram).

   El plan sale de uno de «Mis planes»; al publicar se guarda una COPIA: lo que siga editando allá no toca lo vendido hasta que vuelva a publicar.

   `plan`: la fila existente (o null si es nuevo). `slugsOcupados`: las ligas que ya usan los otros planes de este coach. `alCerrar(guardado?)`: se cerró; si trae el plan, se guardó o publicó. */

const Titulo = ({ children }) => <div style={{ fontSize: 17, fontWeight: 800, color: T.text, margin: '8px 2px -4px' }}>{children}</div>;

/* Reestructura visual (16 oct 2026), como «Poner a la venta» de las capturas de Andrés: cada dato en su tarjeta blanca (la etiqueta chica arriba,
   lo escrito grande), «Para quién es» en renglones con su lista (Disciplina ...... Football ›), «Membresía | Pago único», el precio grande y
   «Qué incluye» con interruptores. Los datos y cómo se guardan no cambian. */
const tarjeta = { background: UI.tarjeta, borderRadius: UI.rGrupo, boxShadow: UI.sombraGrupo };
const Escrito = ({ etiqueta, children }) => (
  <label style={{ ...tarjeta, display: 'block', padding: '12px 16px' }}>
    <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: KP.ink2 }}>{etiqueta}</span>
    {children}
  </label>
);
const sinCaja = { width: '100%', boxSizing: 'border-box', border: 'none', outline: 'none', background: 'transparent', padding: '4px 0 0', fontFamily: FONT, color: KP.ink };
const Grupo = ({ children }) => <div style={{ ...tarjeta, overflow: 'hidden' }}>{children}</div>;
// Un renglón que abre algo propio (las edades, que llevan su rango a mano).
const Renglon = ({ texto, valor, onClick }) => <Fila texto={texto} valor={valor} onClick={onClick} />;
const aOpciones = (lista) => lista.map((o) => ({ valor: o.id, texto: o.nombre }));

export default function FichaDelPlanEnVenta({ plan, slugsOcupados = [], alCerrar }) {
  const nuevo = !plan;
  const [f, setF] = useState(() => ({
    programa_guardado_id: plan?.programa_guardado_id ?? null,
    contenido: plan?.contenido ?? 'programa',
    plantilla_id: plan?.plantilla_id ?? null,
    titulo: plan?.titulo ?? '',
    descripcion: plan?.descripcion ?? '',
    foto_url: plan?.foto_url ?? '',
    video_url: plan?.video_url ?? '',
    objetivo: plan?.objetivo ?? '',
    nivel: plan?.nivel ?? 'todos',
    deportes: Array.isArray(plan?.deportes) ? plan.deportes : [],
    edades: Array.isArray(plan?.edades) ? plan.edades : [],
    sexo: plan?.sexo ?? 'todos',
    equipo: Array.isArray(plan?.equipo) ? plan.equipo : [],
    tipo: plan?.tipo === 'pago_unico' ? 'pago_unico' : 'membresia',
    precio_mxn: plan?.precio_mxn ?? '',
    ventana_semanas: Math.min(VENTANA_MAXIMA, plan?.ventana_semanas ?? VENTANA_MAXIMA),
    chat: !!plan?.chat,
    tecnica: !!plan?.tecnica,
  }));
  const [programa, setPrograma] = useState(null);
  const fuenteId = plan?.plantilla_id ?? plan?.programa_guardado_id ?? null; // de dónde sale lo que se vende (un programa o una plantilla de Mis planes)
  const [cargandoPrograma, setCargandoPrograma] = useState(!!fuenteId);
  const [eligiendo, setEligiendo] = useState(false);
  const [nClases, setNClases] = useState(null); // cuántas clases hay en Mis planes (para la biblioteca); null = todavía no se sabe
  const [eligiendoVideo, setEligiendoVideo] = useState(false);
  const [guardando, setGuardando] = useState(null); // 'borrador' | 'publicar'
  const [viendoEdades, setViendoEdades] = useState(false);
  const [error, setError] = useState(null);
  const pon = (campos) => setF((prev) => ({ ...prev, ...campos }));

  useEffect(() => {
    if (!fuenteId) return undefined;
    let vivo = true;
    fuenteParaVender({ id: fuenteId, tipo: plan?.contenido ?? 'programa' })
      .then((p) => { if (vivo) setPrograma(p); })
      .catch(() => {})
      .finally(() => { if (vivo) setCargandoPrograma(false); });
    return () => { vivo = false; };
  }, [fuenteId, plan?.contenido]);

  const biblioteca = esBiblioteca(f.contenido);
  useEffect(() => {
    if (!biblioteca) return undefined;
    let vivo = true;
    cuentaMisClases().then((n) => { if (vivo) setNClases(n); }).catch(() => {});
    return () => { vivo = false; };
  }, [biblioteca]);
  // «Todas mis clases»: no se escoge nada de Mis planes; entran todas las clases que tengas (también las que agregues después).
  const aBiblioteca = () => {
    setPrograma(null);
    setError(null);
    setF((prev) => ({ ...prev, contenido: 'biblioteca', programa_guardado_id: null, plantilla_id: null, tipo: 'membresia', chat: false, tecnica: false, titulo: prev.titulo || 'Biblioteca de clases' }));
  };

  // Al escoger el plan, la ficha se llena con lo suyo: nombre, descripción y foto (solo lo que todavía está vacío: no se pisa lo que el coach ya escribió).
  const eligeUnPlan = async (item) => {
    setEligiendo(false);
    setError(null);
    setCargandoPrograma(true);
    try {
      const p = await fuenteParaVender(item);
      setPrograma(p);
      const contenido = item.tipo ?? 'programa';
      setF((prev) => ({
        ...prev,
        contenido,
        programa_guardado_id: contenido === 'programa' ? item.id : null,
        plantilla_id: contenido === 'programa' ? null : item.id,
        // Un workout o una clase se compra una vez y no lleva chat: se acomoda solo.
        ...(esSuelto(contenido) ? { tipo: 'pago_unico', chat: false, tecnica: false } : null),
        titulo: prev.titulo || p?.nombre || item.nombre,
        descripcion: prev.descripcion || p?.descripcion || '',
        foto_url: prev.foto_url || p?.foto || '',
      }));
    } catch (e) {
      setError(e?.message ?? 'No se pudo abrir ese plan.');
    } finally {
      setCargandoPrograma(false);
    }
  };

  const precio = Number.parseInt(String(f.precio_mxn).replace(/\D/g, ''), 10);
  const problemas = useMemo(() => {
    const lista = [];
    if (!f.programa_guardado_id && !f.plantilla_id && !biblioteca) lista.push('Escoge lo que vendes.');
    if (biblioteca && nClases === 0) lista.push('Todavía no tienes clases en Mis planes. Guarda al menos una.');
    if (!f.titulo.trim()) lista.push('Ponle un nombre.');
    if (!Number.isFinite(precio) || precio < precioMinimoDe(f.contenido)) lista.push(`El precio mínimo es $${precioMinimoDe(f.contenido)}.`);
    return lista;
  }, [f, precio, biblioteca, nClases]);

  const guarda = async (publicar) => {
    if (problemas.length) { setError(problemas[0]); return; }
    setGuardando(publicar ? 'publicar' : 'borrador');
    setError(null);
    try {
      let guardado = await guardaPlanEnVenta({
        id: plan?.id ?? null,
        ...f,
        // La liga se decide una sola vez, al crear el plan.
        slug: plan?.slug ?? slugUnico(f.titulo, slugsOcupados),
        titulo: f.titulo.trim(),
        descripcion: f.descripcion.trim() || null,
        objetivo: f.objetivo.trim() || null,
        foto_url: f.foto_url || null,
        video_url: f.video_url || null,
        nivel: f.nivel || null,
        deportes: marcadosValidos(DEPORTES, f.deportes),
        edades: edadesValidas(f.edades),
        equipo: marcadosValidos(EQUIPOS, f.equipo),
        precio_mxn: precio,
        tipo: tipoDeCobroDe(f.contenido, f.tipo),
        ...(esSuelto(f.contenido) || biblioteca ? { chat: false, tecnica: false } : null),
        ventana_semanas: Math.min(VENTANA_MAXIMA, Math.max(1, Number(f.ventana_semanas) || VENTANA_MAXIMA)),
      });
      if (publicar) {
        const version = await publicaPlan(guardado.id);
        guardado = { ...guardado, estado: 'publicado', version_n: version };
      }
      alCerrar(guardado);
    } catch (e) {
      setError(e?.message ?? 'No se pudo guardar.');
      setGuardando(null);
    }
  };

  const publicado = plan?.estado === 'publicado';
  return (
    <>
      <Ventana
        titulo={nuevo ? 'Poner a la venta' : 'Lo que vendes'} onCerrar={() => alCerrar()} ancho={560}
        pie={(
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {error && <div role="alert" style={{ padding: '9px 12px', borderRadius: 11, background: KP.dangerSoft, color: KP.danger, fontSize: 13.5, fontWeight: 700 }}>{error}</div>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={() => guarda(false)} disabled={!!guardando} style={{ ...botonBlanco(false, !!guardando), flex: 1, minHeight: 52, whiteSpace: 'nowrap', border: 'none', background: UI.relleno, boxShadow: 'none', fontSize: 16 }}>
                {guardando === 'borrador' ? <Loader2 size={16} className="spin" /> : null} Guardar
              </button>
              <button type="button" onClick={() => guarda(true)} disabled={!!guardando} style={{ ...botonPrincipal(!!guardando), flex: 1.6, minHeight: 52, whiteSpace: 'nowrap', fontSize: 16 }}>
                {guardando === 'publicar' ? <Loader2 size={16} className="spin" /> : <Check size={17} strokeWidth={3} />} {publicado ? 'Publicar cambios' : 'Publicar'}
              </button>
            </div>
          </div>
        )}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button
            type="button" onClick={() => setEligiendo(true)}
            style={{ ...tarjeta, display: 'flex', alignItems: 'center', gap: 10, minHeight: 58, padding: '10px 16px', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: FONT }}
          >
            <span style={{ fontSize: 15.5, fontWeight: 600, color: KP.ink, flexShrink: 0 }}>Lo que vendes</span>
            <span style={{ flex: 1, minWidth: 0, textAlign: 'right', fontSize: 15.5, fontWeight: 600, color: KP.blue, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {biblioteca
                ? `Todas mis clases${nClases != null ? ` · ${nClases} ${nClases === 1 ? 'clase' : 'clases'}` : ''}`
                : cargandoPrograma ? 'Cargando…'
                  : programa?.nombre ? `${programa.nombre} · ${ETIQUETA_DE_CONTENIDO[f.contenido] ?? ''}`
                    : (fuenteId || f.programa_guardado_id || f.plantilla_id ? 'Plan de Mis planes' : 'Escoger de Mis planes')}
            </span>
            <ChevronRight size={17} color="#C3C8D2" style={{ flexShrink: 0 }} />
          </button>
          {!biblioteca && (
            <button type="button" onClick={aBiblioteca} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: FONT, fontSize: 14, fontWeight: 700, color: KP.blue, padding: '0 4px', textAlign: 'left', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Layers size={15} /> O vende todas tus clases, como una biblioteca
            </button>
          )}
          {biblioteca && (
            <div style={{ fontSize: 14, fontWeight: 500, color: KP.ink2, lineHeight: 1.45, padding: '0 4px' }}>
              Quien se suscribe ve todas las clases que tengas en Mis planes. Las que agregues después se suman solas.
            </div>
          )}

          <Escrito etiqueta="Nombre del plan">
            <input value={f.titulo} maxLength={120} placeholder="Velocidad para receptores" aria-label="Nombre del plan" style={{ ...sinCaja, fontSize: 21, fontWeight: 800 }} onChange={(e) => pon({ titulo: e.target.value })} />
          </Escrito>
          <Escrito etiqueta="Descripción">
            <textarea value={f.descripcion} maxLength={4000} rows={3} placeholder="Qué incluye y cómo se entrena" aria-label="Descripción" style={{ ...sinCaja, fontSize: 16, fontWeight: 500, lineHeight: 1.45, resize: 'vertical' }} onChange={(e) => pon({ descripcion: e.target.value })} />
          </Escrito>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ ...tarjeta, padding: 8, minWidth: 0 }}>
              <CampoDeFoto valor={f.foto_url} onCambia={(url) => pon({ foto_url: url })} />
              <div style={{ fontSize: 13, fontWeight: 600, color: KP.ink2, padding: '6px 4px 2px' }}>Foto del plan</div>
            </div>
            {f.video_url ? (
              <div style={{ ...tarjeta, padding: 12, display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14.5, fontWeight: 700, color: KP.ink }}><Video size={17} color={KP.blue} /> {ligaExterna(f.video_url)?.de ?? 'Video subido'}</span>
                <div style={{ display: 'flex', gap: 6, marginTop: 'auto' }}>
                  <button type="button" onClick={() => setEligiendoVideo(true)} style={{ ...botonBlanco(), flex: 1, minHeight: 38, padding: '0 10px', fontSize: 13 }}>Cambiar</button>
                  <button type="button" onClick={() => pon({ video_url: '' })} aria-label="Quitar el video" style={{ width: 38, height: 38, borderRadius: 11, border: 'none', cursor: 'pointer', background: KP.dangerSoft, color: KP.danger, display: 'grid', placeItems: 'center' }}><Trash2 size={16} /></button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => setEligiendoVideo(true)} style={{ ...tarjeta, border: 'none', cursor: 'pointer', fontFamily: FONT, padding: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, minWidth: 0 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 15, fontWeight: 700, color: KP.blue }}><Plus size={16} /> Agregar video</span>
                <span style={{ fontSize: 12.5, fontWeight: 500, color: KP.ink2, textAlign: 'center' }}>Presentando el plan · opcional</span>
              </button>
            )}
          </div>

          <Titulo>Para quién es</Titulo>
          <Grupo>
            <FilaElegir texto="Disciplina" titulo="Deporte o disciplina" opciones={aOpciones(DEPORTES)} valor={f.deportes} multiple marcador="Todas" onCambio={(v) => pon({ deportes: v })} />
            <Renglon texto="Edades" valor={textoDeEdades(f.edades) || 'Todas las edades'} onClick={() => setViendoEdades(true)} />
            <FilaElegir texto="Sexo" opciones={aOpciones(SEXOS)} valor={f.sexo} onCambio={(v) => pon({ sexo: v })} />
            <FilaElegir texto="Equipo" titulo="Equipo que necesita" opciones={aOpciones(EQUIPOS)} valor={f.equipo} multiple marcador="Cualquiera" onCambio={(v) => pon({ equipo: v })} />
            <FilaElegir texto="Nivel" opciones={aOpciones(NIVELES)} valor={f.nivel} onCambio={(v) => pon({ nivel: v })} />
          </Grupo>
          <Escrito etiqueta="Objetivo">
            <input value={f.objetivo} maxLength={500} placeholder="Llegar fuerte a la temporada" aria-label="Objetivo" style={{ ...sinCaja, fontSize: 16, fontWeight: 600 }} onChange={(e) => pon({ objetivo: e.target.value })} />
          </Escrito>

          <Titulo>Cuánto cuesta</Titulo>
          <div style={{ ...tarjeta, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {!esSuelto(f.contenido) && !biblioteca && (
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: KP.ink2, marginBottom: 8 }}>Cómo se cobra</div>
                <Segmentado etiqueta="Cómo se cobra" valor={f.tipo} onCambio={(v) => pon({ tipo: v })} opciones={TIPOS_DE_VENTA.map((o) => ({ valor: o.id, texto: o.nombre }))} />
              </div>
            )}
            <label style={{ display: 'block' }}>
              <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: KP.ink2 }}>{tipoDeCobroDe(f.contenido, f.tipo) === 'pago_unico' ? 'Precio' : 'Precio al mes'}</span>
              <span style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontSize: 32, fontWeight: 800, color: KP.blue }}>$</span>
                <input
                  value={f.precio_mxn} inputMode="numeric" placeholder={String(precioMinimoDe(f.contenido))} aria-label="Precio en pesos"
                  style={{ ...sinCaja, flex: 1, minWidth: 0, fontSize: 34, fontWeight: 800, fontVariantNumeric: 'tabular-nums', padding: 0 }}
                  onChange={(e) => pon({ precio_mxn: e.target.value.replace(/\D/g, '') })}
                />
                <span style={{ fontSize: 14, fontWeight: 600, color: KP.ink2 }}>MXN</span>
              </span>
              <span style={{ display: 'block', fontSize: 13, fontWeight: 500, color: KP.ink2, marginTop: 2 }}>Mínimo ${precioMinimoDe(f.contenido)}</span>
            </label>
          </div>

          {!esSuelto(f.contenido) && !biblioteca && (
            <>
              <Titulo>Qué incluye</Titulo>
              <Grupo>
                {[['chat', 'Chat con el coach'], ['tecnica', 'Técnica por video']].map(([clave, texto]) => (
                  <div key={clave} className="ui-fila" style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 56, padding: '8px 16px' }}>
                    <span style={{ flex: 1, fontSize: 15.5, fontWeight: 600, color: KP.ink }}>{texto}</span>
                    <Switch activo={f[clave]} onCambio={(v) => pon({ [clave]: v })} etiqueta={texto} />
                  </div>
                ))}
              </Grupo>
            </>
          )}

          {f.contenido === 'programa' && programa?.kind !== 'weekly' && (
            <Grupo>
              <FilaElegir
                texto="Ve hacia adelante" titulo="Cuánto ve el comprador hacia adelante"
                opciones={VENTANAS.map((v) => ({ valor: v.valor, texto: v.nombre }))} valor={f.ventana_semanas} onCambio={(v) => pon({ ventana_semanas: v })}
              />
            </Grupo>
          )}
        </div>
      </Ventana>
      {viendoEdades && (
        <HojaFlotante titulo="Edades" onCerrar={() => setViendoEdades(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <EdadesDelPlan valor={f.edades} alCambiar={(v) => pon({ edades: v })} sinTitulo />
            <button type="button" onClick={() => setViendoEdades(false)} style={{ ...botonPrincipal(false), width: '100%', minHeight: 50 }}>Listo</button>
          </div>
        </HojaFlotante>
      )}
      {eligiendoVideo && <HojaDeClase titulo="Video del plan" conMias={false} onCerrar={() => setEligiendoVideo(false)} onElige={(c) => { setEligiendoVideo(false); pon({ video_url: c.url }); }} />}
      {eligiendo && <SelectorDeMisPlanes tipos={['programa', 'rutina', 'workout', 'clase']} titulo="Lo que vendes" onElegir={eligeUnPlan} onCerrar={() => setEligiendo(false)} />}
    </>
  );
}
