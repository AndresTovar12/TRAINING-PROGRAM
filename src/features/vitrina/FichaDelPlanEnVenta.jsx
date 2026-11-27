import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronRight, Globe, Loader2, MessageCircle, Plus, Smartphone, Star, Trash2, Video } from 'lucide-react';
import { T, KP, FONT, UI } from '@/lib/theme';
import { Fila, FilaElegir, Interruptor as Switch, Pastilla, Segmentado } from '@/components/ui';
import { limpiaSemanasElegidas, modosPosibles, semanasPermitidas, tieneEntrada } from '@/lib/entradaAlPlan';
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

   Compra y dinero (26 nov 2026; dibujos coach-c1, coach-c1-vacia, coach-c1-empezar, coach-c1-empezar-elegir): «Título», «Elegir del repertorio», «Lo que logra» (antes «Objetivo»),
   «Para ti si…», «Chat contigo» y «Revisión de técnica» (si apaga los dos, la página dice «Entrenas por tu cuenta»), «Tu atleta ve las próximas N semanas» (nunca más de las que
   tiene el plan), «Dónde puede empezar tu atleta», «Mi plan recomendado» (uno por coach: sale con «Empieza aquí») y «Mismo precio en todos lados». Se quitó «Todas mis clases».

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
    para_ti_si: plan?.para_ti_si ?? '',
    entrada_modo: plan?.entrada_modo ?? 'semana_1',
    entrada_semanas: Array.isArray(plan?.entrada_semanas) ? plan.entrada_semanas : [1],
    recomendado: !!plan?.recomendado,
  }));
  const [viendoEntrada, setViendoEntrada] = useState(false);
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
  // Las fases del plan elegido, en la forma de `entradaAlPlan.js` (cuántas semanas tiene cada una).
  const fasesDelPlan = useMemo(() => (programa?.fases ?? []).map((x) => ({ id: x.id, weekData: Array.from({ length: x.semanas ?? 0 }, (_, i) => ({ num: i + 1 })) })), [programa]);
  const totalSemanas = fasesDelPlan.reduce((n, x) => n + x.weekData.length, 0);
  const tieneFuente = !!(fuenteId || f.programa_guardado_id || f.plantilla_id || biblioteca);
  const conEntrada = tieneEntrada({ contenido: f.contenido, kind: programa?.kind ?? 'periodized', fases: fasesDelPlan });
  const permitidasAhora = semanasPermitidas(fasesDelPlan, { modo: f.entrada_modo, semanas: f.entrada_semanas });
  const textoDeEntrada = { semana_1: 'Solo en la semana 1', fases: 'Inicio de cada fase', cualquiera: 'En cualquier semana', elegidas: `Semanas ${permitidasAhora.join(', ')}` }[f.entrada_modo] ?? 'Solo en la semana 1';
  const problemas = useMemo(() => {
    const lista = [];
    if (!f.programa_guardado_id && !f.plantilla_id && !biblioteca) lista.push('Escoge lo que vendes.');
    if (biblioteca && nClases === 0) lista.push('Todavía no tienes clases en Mis planes. Guarda al menos una.');
    if (!f.titulo.trim()) lista.push('Ponle un nombre.');
    if (!Number.isFinite(precio) || precio < precioMinimoDe(f.contenido)) lista.push(`El precio mínimo es $${precioMinimoDe(f.contenido)}.`);
    return lista;
  }, [f, precio, biblioteca, nClases]);

  /* Si «Publicar» guarda el borrador y la publicación falla (p. ej. sin cuenta de cobro), el borrador ya existe: el siguiente intento lo actualiza en vez
     de crear otro igual, y al cerrar la lista se pone al día para que se vea (auditoría p69). */
  const borradorCreado = useRef(null);
  const guarda = async (publicar) => {
    if (problemas.length) { setError(problemas[0]); return; }
    setGuardando(publicar ? 'publicar' : 'borrador');
    setError(null);
    let seGuardo = false;
    try {
      let guardado = await guardaPlanEnVenta({
        id: plan?.id ?? borradorCreado.current?.id ?? null,
        ...f,
        // La liga se decide una sola vez, al crear el plan.
        slug: plan?.slug ?? borradorCreado.current?.slug ?? slugUnico(f.titulo, slugsOcupados),
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
        ventana_semanas: Math.min(VENTANA_MAXIMA, Math.max(1, totalSemanas || VENTANA_MAXIMA), Math.max(1, Number(f.ventana_semanas) || VENTANA_MAXIMA)),
        para_ti_si: f.para_ti_si.trim() || null,
        // Si el coach quitó semanas o fases, las elegidas que ya no existen se van solas; «Al inicio de cada fase» con una sola fase es «solo la semana 1».
        entrada_modo: conEntrada ? (f.entrada_modo === 'fases' && !modosPosibles(fasesDelPlan).some((m) => m.valor === 'fases') ? 'semana_1' : f.entrada_modo) : 'semana_1',
        entrada_semanas: conEntrada ? limpiaSemanasElegidas(f.entrada_semanas, totalSemanas) : [1],
      });
      borradorCreado.current = guardado;
      seGuardo = true;
      if (publicar) {
        const version = await publicaPlan(guardado.id);
        guardado = { ...guardado, estado: 'publicado', version_n: version };
      }
      alCerrar(guardado);
    } catch (e) {
      setError(seGuardo ? `Se guardó como borrador, pero no se pudo publicar: ${e?.message ?? 'intenta otra vez'}` : (e?.message ?? 'No se pudo guardar.'));
      setGuardando(null);
    }
  };

  const publicado = plan?.estado === 'publicado';
  return (
    <>
      <Ventana
        titulo={nuevo ? 'Poner a la venta' : 'Lo que vendes'} onCerrar={() => alCerrar(borradorCreado.current ?? undefined)} ancho={560}
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
          <div style={{ fontSize: 14.5, fontWeight: 500, color: KP.ink2, margin: '0 4px' }}>Quien ya lo compró conserva su versión.</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: KP.ink2, margin: '4px 4px -4px' }}>Plan</div>
          {tieneFuente ? (
            <button type="button" onClick={() => setEligiendo(true)} style={{ ...tarjeta, display: 'flex', alignItems: 'center', gap: 14, padding: 14, border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: FONT }}>
              <span style={{ width: 56, height: 56, borderRadius: 14, overflow: 'hidden', background: KP.blueSoft, flexShrink: 0 }}>{(f.foto_url || programa?.foto) && <img src={f.foto_url || programa?.foto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 17, fontWeight: 700, color: KP.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{biblioteca ? 'Todas mis clases' : cargandoPrograma ? 'Cargando…' : programa?.nombre ?? 'Plan del repertorio'}</span>
                <span style={{ display: 'block', fontSize: 14.5, fontWeight: 500, color: KP.ink2 }}>{['Del repertorio', totalSemanas > 1 ? `${totalSemanas} semanas` : ETIQUETA_DE_CONTENIDO[f.contenido]].filter(Boolean).join(' · ')}</span>
              </span>
              <span style={{ fontSize: 16, fontWeight: 700, color: KP.blue }}>Cambiar</span>
            </button>
          ) : (
            <button type="button" onClick={() => setEligiendo(true)} style={{ ...tarjeta, display: 'flex', alignItems: 'center', gap: 14, padding: '18px 16px', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: FONT }}>
              <span style={{ width: 48, height: 48, borderRadius: 14, background: KP.blueSoft, color: KP.blue, display: 'grid', placeItems: 'center' }}><Plus size={22} /></span>
              <span style={{ flex: 1 }}><span style={{ display: 'block', fontSize: 17, fontWeight: 700, color: KP.blue }}>Elegir del repertorio</span><span style={{ display: 'block', fontSize: 14.5, fontWeight: 500, color: KP.ink2 }}>El plan de Mis planes que vas a vender</span></span>
              <ChevronRight size={18} color="#C3C8D2" />
            </button>
          )}

          <Escrito etiqueta="Título">
            <input value={f.titulo} maxLength={120} placeholder="Velocidad para receptores" aria-label="Título" style={{ ...sinCaja, fontSize: 21, fontWeight: 800 }} onChange={(e) => pon({ titulo: e.target.value })} />
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

          <Escrito etiqueta="Lo que logra">
            <input value={f.objetivo} maxLength={160} placeholder="Sube tu sentadilla, banca y peso muerto." aria-label="Lo que logra" style={{ ...sinCaja, fontSize: 17, fontWeight: 600 }} onChange={(e) => pon({ objetivo: e.target.value })} />
          </Escrito>
          <Escrito etiqueta="Para ti si…">
            <input value={f.para_ti_si} maxLength={200} placeholder="ya entrenas con barra" aria-label="Para ti si" style={{ ...sinCaja, fontSize: 17, fontWeight: 500 }} onChange={(e) => pon({ para_ti_si: e.target.value })} />
          </Escrito>

          <Titulo>Para quién es</Titulo>
          <Grupo>
            <FilaElegir texto="Disciplina" titulo="Deporte o disciplina" opciones={aOpciones(DEPORTES)} valor={f.deportes} multiple marcador="Todas" onCambio={(v) => pon({ deportes: v })} />
            <Renglon texto="Edades" valor={textoDeEdades(f.edades) || 'Todas las edades'} onClick={() => setViendoEdades(true)} />
            <FilaElegir texto="Sexo" opciones={aOpciones(SEXOS)} valor={f.sexo} onCambio={(v) => pon({ sexo: v })} />
            <FilaElegir texto="Equipo" titulo="Equipo que necesita" opciones={aOpciones(EQUIPOS)} valor={f.equipo} multiple marcador="Cualquiera" onCambio={(v) => pon({ equipo: v })} />
            <FilaElegir texto="Nivel" opciones={aOpciones(NIVELES)} valor={f.nivel} onCambio={(v) => pon({ nivel: v })} />
          </Grupo>

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
            <div style={{ display: 'flex', gap: 12, borderTop: `1px solid ${UI.hilo}`, paddingTop: 12 }}>
              <span style={{ display: 'flex', gap: 4, color: KP.ink2, paddingTop: 2 }}><Globe size={16} /><Smartphone size={16} /></span>
              <span><span style={{ display: 'block', fontSize: 15.5, fontWeight: 700, color: KP.ink }}>Mismo precio en todos lados</span><span style={{ display: 'block', fontSize: 14, fontWeight: 500, color: KP.ink2, lineHeight: 1.4 }}>Con Apple te llega menos y más tarde. Lo ves en Mis ganancias.</span></span>
            </div>
          </div>

          {!esSuelto(f.contenido) && !biblioteca && (
            <>
              <Titulo>Incluye</Titulo>
              <Grupo>
                {[['chat', 'Chat contigo', MessageCircle], ['tecnica', 'Revisión de técnica', Video]].map(([clave, texto, Icono]) => (
                  <div key={clave} className="ui-fila" style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 56, padding: '8px 16px' }}>
                    <span style={{ width: 36, height: 36, borderRadius: 11, background: KP.blueSoft, color: KP.blue, display: 'grid', placeItems: 'center' }}><Icono size={17} /></span>
                    <span style={{ flex: 1, fontSize: 15.5, fontWeight: 600, color: KP.ink }}>{texto}</span>
                    {/* La técnica por video se contesta por el chat (p103): prender una prende la otra y apagar el chat apaga la técnica; si no, el comprador podía escribir y la base lo rechazaba. */}
                    <Switch activo={f[clave]} onCambio={(v) => pon(clave === 'tecnica' ? { tecnica: v, ...(v ? { chat: true } : {}) } : { chat: v, ...(!v ? { tecnica: false } : {}) })} etiqueta={texto} />
                  </div>
                ))}
              </Grupo>
              <div style={{ fontSize: 13.5, fontWeight: 500, color: KP.ink2, margin: '-4px 6px 0' }}>Si apagas los dos, sale «Entrenas por tu cuenta».</div>
            </>
          )}

          {conEntrada && (
            <>
              <Grupo>
                <FilaElegir
                  texto="Tu atleta ve las próximas" titulo="Cuántas semanas ve hacia adelante"
                  opciones={VENTANAS.filter((v) => v.valor <= Math.max(1, totalSemanas)).map((v) => ({ valor: v.valor, texto: v.valor === 4 ? '4 semanas' : v.nombre }))}
                  valor={Math.min(f.ventana_semanas, Math.max(1, totalSemanas))} onCambio={(v) => pon({ ventana_semanas: v })}
                />
              </Grupo>
              <div style={{ fontSize: 13.5, fontWeight: 500, color: KP.ink2, margin: '-4px 6px 0' }}>Así nadie se lleva tu plan completo el primer día.</div>
              <Grupo>
                <Fila texto="Dónde puede empezar tu atleta" valor={textoDeEntrada} onClick={() => setViendoEntrada(true)} />
              </Grupo>
            </>
          )}
          <Grupo>
            <div className="ui-fila" style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 56, padding: '10px 16px' }}>
              <span style={{ flex: 1 }}>
                <span style={{ display: 'block', fontSize: 15.5, fontWeight: 600, color: KP.ink }}>Mi plan recomendado</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13.5, fontWeight: 500, color: KP.ink2, flexWrap: 'wrap' }}>Sale con <Pastilla tono="azul"><Star size={10} fill="currentColor" style={{ marginRight: 3 }} />Empieza aquí</Pastilla> en tu página.</span>
              </span>
              <Switch activo={f.recomendado} onCambio={(v) => pon({ recomendado: v })} etiqueta="Mi plan recomendado" />
            </div>
          </Grupo>
        </div>
      </Ventana>
      {viendoEntrada && (
        <HojaFlotante titulo="¿Dónde puede empezar tu atleta?" onCerrar={() => setViendoEntrada(false)} ancho={460}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Grupo>
              {modosPosibles(fasesDelPlan).map((m) => (
                <button key={m.valor} type="button" role="radio" aria-checked={f.entrada_modo === m.valor} onClick={() => pon({ entrada_modo: m.valor })} className="ui-fila"
                  style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', minHeight: 58, padding: '10px 16px', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer', fontFamily: FONT }}>
                  <span style={{ flex: 1 }}>
                    <span style={{ display: 'block', fontSize: 16.5, fontWeight: f.entrada_modo === m.valor ? 700 : 500, color: KP.ink }}>{m.texto}</span>
                    {m.valor === 'fases' && <span style={{ display: 'block', fontSize: 14, color: KP.ink2 }}>Semanas {semanasPermitidas(fasesDelPlan, { modo: 'fases' }).join(', ').replace(/, (\d+)$/, ' y $1')}</span>}
                  </span>
                  {/* estilo-ok: el círculo de una opción sin marcar */}
                  <span aria-hidden="true" style={{ width: 28, height: 28, borderRadius: 99, display: 'grid', placeItems: 'center', background: f.entrada_modo === m.valor ? KP.blue : 'transparent', border: f.entrada_modo === m.valor ? 'none' : `2px solid ${KP.lineHi}`, color: '#fff' }}>{f.entrada_modo === m.valor && <Check size={16} strokeWidth={3} />}</span>
                </button>
              ))}
            </Grupo>
            {f.entrada_modo === 'elegidas' && (
              <div style={{ ...tarjeta, padding: 14, display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 }}>
                {Array.from({ length: totalSemanas }, (_, i) => i + 1).map((n) => {
                  const marcada = n === 1 || f.entrada_semanas.includes(n);
                  return (
                    <button key={n} type="button" disabled={n === 1} aria-pressed={marcada} aria-label={`Semana ${n}`}
                      onClick={() => pon({ entrada_semanas: marcada ? f.entrada_semanas.filter((x) => x !== n) : [...f.entrada_semanas, n] })}
                      style={{ height: 44, borderRadius: 12, border: 'none', cursor: n === 1 ? 'default' : 'pointer', fontFamily: FONT, fontSize: 16, fontWeight: 700, background: marcada ? KP.blue : UI.relleno, color: marcada ? '#fff' : KP.ink }}>
                      {n}
                    </button>
                  );
                })}
              </div>
            )}
            {f.entrada_modo === 'elegidas' && <div style={{ fontSize: 13.5, color: KP.ink2, margin: '-4px 6px 0' }}>La semana 1 siempre queda.</div>}
            <button type="button" onClick={() => setViendoEntrada(false)} style={{ ...botonPrincipal(false), width: '100%', minHeight: 50 }}>Listo</button>
          </div>
        </HojaFlotante>
      )}
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
