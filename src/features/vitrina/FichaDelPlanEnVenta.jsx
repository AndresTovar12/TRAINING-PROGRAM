import { useEffect, useMemo, useState } from 'react';
import { Check, Layers, Loader2, Trash2, Video } from 'lucide-react';
import { T, KP, FONT } from '@/lib/theme';
import Ventana from '@/features/misplanes/Ventana';
import SelectorDeMisPlanes from '@/features/misplanes/SelectorDeMisPlanes';
import CampoDeFoto from '@/features/admin/CampoDeFoto';
import { HojaDeClase } from '@/features/admin/ClaseDeLaSesion';
import { ligaExterna } from '@/lib/videos';
import { botonBlanco, botonPrincipal, campo, etiquetaChica } from '@/features/misplanes/estilos';
import { PRECIO_MINIMO, TIPOS_DE_VENTA, VENTANAS, VENTANA_MAXIMA, guardaPlanEnVenta, programaParaVender, publicaPlan, slugUnico } from '@/lib/vitrinaApi';
import { DEPORTES, EDADES, EQUIPOS, NIVELES, SEXOS, marcadosValidos } from '@/lib/paraQuien';

/* LA FICHA DE UN PLAN EN VENTA: lo que el coach llena para venderlo.

   Andrés, 12 oct 2026 (rediseño aprobado): el nombre, la descripción y la foto salen del plan de «Mis planes» y se pueden cambiar; «Para quién es» ya no es un texto libre sino
   opciones (deporte o disciplina, edades, sexo, equipo que necesita, nivel) más el objetivo; precio y cómo se cobra (mínimo $500); qué incluye (chat y técnica por video) y cuánto ve
   el comprador hacia adelante (por defecto un mes completo; se puede bajar, nunca subir). Se fueron «por dónde se puede entrar» —ahora el comprador elige la semana en la hoja del programa— y
   «tu liga», que se arma sola con el nombre del plan y no cambia después (ya anda en Instagram).

   El plan sale de uno de «Mis planes»; al publicar se guarda una COPIA: lo que siga editando allá no toca lo vendido hasta que vuelva a publicar.

   `plan`: la fila existente (o null si es nuevo). `slugsOcupados`: las ligas que ya usan los otros planes de este coach. `alCerrar(guardado?)`: se cerró; si trae el plan, se guardó o publicó. */

const Campo = ({ etiqueta, children }) => (
  <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
    <span style={etiquetaChica}>{etiqueta}</span>
    {children}
  </label>
);

// Las opciones de una pregunta: una (`multiple` false) o varias. Cada una es un botón del tamaño de un dedo.
function Opciones({ etiqueta, opciones, valor, alCambiar, multiple = false, nota }) {
  const marcada = (id) => (multiple ? valor.includes(id) : valor === id);
  const toca = (id) => {
    if (!multiple) { alCambiar(id); return; }
    alCambiar(valor.includes(id) ? valor.filter((x) => x !== id) : [...valor, id]);
  };
  return (
    <div role={multiple ? 'group' : 'radiogroup'} aria-label={etiqueta} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={etiquetaChica}>{etiqueta}</span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
        {opciones.map((o) => {
          const on = marcada(o.id);
          return (
            <button
              key={o.id} type="button" role={multiple ? 'checkbox' : 'radio'} aria-checked={on} onClick={() => toca(o.id)}
              style={{
                minHeight: 40, padding: '0 13px', borderRadius: 999, cursor: 'pointer', fontFamily: FONT, fontSize: 13.5, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6,
                border: `1.5px solid ${on ? T.accent : T.border}`, background: on ? T.accentBg : T.bg2, color: on ? T.accent : T.text2,
              }}
            >
              {on && <Check size={14} strokeWidth={3.2} />}{o.nombre}
            </button>
          );
        })}
      </div>
      {nota && <span style={{ fontSize: 12.5, fontWeight: 600, color: T.text3 }}>{nota}</span>}
    </div>
  );
}

const Interruptor = ({ activo, alCambiar, etiqueta }) => (
  <button
    type="button" role="switch" aria-checked={activo} onClick={() => alCambiar(!activo)}
    style={{
      display: 'flex', alignItems: 'center', gap: 10, width: '100%', minHeight: 46, padding: '0 12px', borderRadius: 11, cursor: 'pointer', textAlign: 'left',
      border: `1.5px solid ${activo ? T.accent : T.border}`, background: activo ? T.accentBg : T.bg2, fontFamily: FONT, fontSize: 14, fontWeight: 700, color: T.text,
    }}
  >
    <span style={{ flex: 1 }}>{etiqueta}</span>
    <span
      aria-hidden="true"
      style={{ width: 40, height: 24, borderRadius: 12, background: activo ? T.accent : T.border, position: 'relative', flexShrink: 0, transition: 'background .15s' }}
    >
      <span style={{ position: 'absolute', top: 3, left: activo ? 19 : 3, width: 18, height: 18, borderRadius: 9, background: '#fff', transition: 'left .15s' }} />
    </span>
  </button>
);

const Titulo = ({ children }) => <div style={{ fontSize: 15, fontWeight: 800, color: T.text, marginTop: 4 }}>{children}</div>;

export default function FichaDelPlanEnVenta({ plan, slugsOcupados = [], alCerrar }) {
  const nuevo = !plan;
  const [f, setF] = useState(() => ({
    programa_guardado_id: plan?.programa_guardado_id ?? null,
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
  const [cargandoPrograma, setCargandoPrograma] = useState(!!plan?.programa_guardado_id);
  const [eligiendo, setEligiendo] = useState(false);
  const [eligiendoVideo, setEligiendoVideo] = useState(false);
  const [guardando, setGuardando] = useState(null); // 'borrador' | 'publicar'
  const [error, setError] = useState(null);
  const pon = (campos) => setF((prev) => ({ ...prev, ...campos }));

  useEffect(() => {
    if (!plan?.programa_guardado_id) return undefined;
    let vivo = true;
    programaParaVender(plan.programa_guardado_id)
      .then((p) => { if (vivo) setPrograma(p); })
      .catch(() => {})
      .finally(() => { if (vivo) setCargandoPrograma(false); });
    return () => { vivo = false; };
  }, [plan?.programa_guardado_id]);

  // Al escoger el plan, la ficha se llena con lo suyo: nombre, descripción y foto (solo lo que todavía está vacío: no se pisa lo que el coach ya escribió).
  const eligeUnPlan = async (item) => {
    setEligiendo(false);
    setError(null);
    setCargandoPrograma(true);
    try {
      const p = await programaParaVender(item.id);
      setPrograma(p);
      setF((prev) => ({
        ...prev,
        programa_guardado_id: item.id,
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
    if (!f.programa_guardado_id) lista.push('Escoge el plan que vendes.');
    if (!f.titulo.trim()) lista.push('Ponle un nombre.');
    if (!Number.isFinite(precio) || precio < PRECIO_MINIMO) lista.push(`El precio mínimo es $${PRECIO_MINIMO}.`);
    return lista;
  }, [f, precio]);

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
        edades: marcadosValidos(EDADES, f.edades),
        equipo: marcadosValidos(EQUIPOS, f.equipo),
        precio_mxn: precio,
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
        titulo={nuevo ? 'Poner un plan en venta' : 'Tu plan en venta'} onCerrar={() => alCerrar()} ancho={560}
        pie={(
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {error && <div role="alert" style={{ padding: '9px 12px', borderRadius: 11, background: KP.dangerSoft, color: KP.danger, fontSize: 13.5, fontWeight: 700 }}>{error}</div>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={() => guarda(false)} disabled={!!guardando} style={{ ...botonBlanco(false, !!guardando), flex: 1, whiteSpace: 'nowrap' }}>
                {guardando === 'borrador' ? <Loader2 size={16} className="spin" /> : null} Guardar
              </button>
              <button type="button" onClick={() => guarda(true)} disabled={!!guardando} style={{ ...botonPrincipal(!!guardando), flex: 1.6, whiteSpace: 'nowrap' }}>
                {guardando === 'publicar' ? <Loader2 size={16} className="spin" /> : <Check size={17} strokeWidth={3} />} {publicado ? 'Publicar cambios' : 'Publicar'}
              </button>
            </div>
          </div>
        )}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <Campo etiqueta="El plan">
            <button
              type="button" onClick={() => setEligiendo(true)}
              style={{ ...campo, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', textAlign: 'left', fontWeight: 700, minHeight: 46 }}
            >
              <Layers size={17} color={T.accent} />
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {cargandoPrograma ? 'Cargando…' : (programa?.nombre ?? (f.programa_guardado_id ? 'Plan de Mis planes' : 'Escoger de Mis planes'))}
              </span>
              <span style={{ color: T.accent, fontSize: 13, fontWeight: 800 }}>{f.programa_guardado_id ? 'Cambiar' : 'Escoger'}</span>
            </button>
          </Campo>

          <Campo etiqueta="Nombre">
            <input value={f.titulo} maxLength={120} placeholder="Por ejemplo: Velocidad para receptores" style={campo} onChange={(e) => pon({ titulo: e.target.value })} />
          </Campo>
          <Campo etiqueta="Descripción">
            <textarea value={f.descripcion} maxLength={4000} rows={4} placeholder="Qué incluye y cómo se entrena" style={{ ...campo, resize: 'vertical' }} onChange={(e) => pon({ descripcion: e.target.value })} />
          </Campo>
          <Campo etiqueta="Foto del plan">
            <CampoDeFoto valor={f.foto_url} onCambia={(url) => pon({ foto_url: url })} />
          </Campo>
          <Campo etiqueta="Video presentando el plan (opcional)">
            {f.video_url ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 11, border: `1.5px solid ${T.border}`, background: T.bg2 }}>
                <Video size={18} color={T.accent} />
                <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 700, color: T.text }}>{ligaExterna(f.video_url)?.de ?? 'Video subido'}</span>
                <button type="button" onClick={() => setEligiendoVideo(true)} style={{ ...botonBlanco(), minHeight: 36, padding: '0 12px', fontSize: 13 }}>Cambiar</button>
                <button
                  type="button" onClick={() => pon({ video_url: '' })} aria-label="Quitar el video"
                  style={{ width: 36, height: 36, borderRadius: 11, border: 'none', cursor: 'pointer', background: KP.dangerSoft, color: KP.danger, display: 'grid', placeItems: 'center' }}
                ><Trash2 size={16} /></button>
              </div>
            ) : (
              <button type="button" onClick={() => setEligiendoVideo(true)} style={{ ...botonBlanco(true), justifyContent: 'center', minHeight: 46 }}><Video size={16} /> Agregar video</button>
            )}
          </Campo>

          <Titulo>Para quién es</Titulo>
          <Opciones etiqueta="Deporte o disciplina" opciones={DEPORTES} valor={f.deportes} alCambiar={(v) => pon({ deportes: v })} multiple />
          <Opciones etiqueta="Edades" opciones={EDADES} valor={f.edades} alCambiar={(v) => pon({ edades: v })} multiple nota="Sin marcar: todas las edades." />
          <Opciones etiqueta="Sexo" opciones={SEXOS} valor={f.sexo} alCambiar={(v) => pon({ sexo: v })} />
          <Opciones etiqueta="Equipo que necesita" opciones={EQUIPOS} valor={f.equipo} alCambiar={(v) => pon({ equipo: v })} multiple />
          <Opciones etiqueta="Nivel" opciones={NIVELES} valor={f.nivel} alCambiar={(v) => pon({ nivel: v })} />
          <Campo etiqueta="Objetivo">
            <input value={f.objetivo} maxLength={500} placeholder="Llegar fuerte a la temporada" style={campo} onChange={(e) => pon({ objetivo: e.target.value })} />
          </Campo>

          <Titulo>Cuánto cuesta</Titulo>
          <Opciones etiqueta="Cómo se cobra" opciones={TIPOS_DE_VENTA} valor={f.tipo} alCambiar={(v) => pon({ tipo: v })} />
          <Campo etiqueta={f.tipo === 'pago_unico' ? 'Precio (pesos)' : 'Precio al mes (pesos)'}>
            <input
              value={f.precio_mxn} inputMode="numeric" placeholder={`${PRECIO_MINIMO} o más`} style={campo}
              onChange={(e) => pon({ precio_mxn: e.target.value.replace(/\D/g, '') })}
            />
          </Campo>

          <Titulo>Qué incluye</Titulo>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 10 }}>
            <Interruptor activo={f.chat} alCambiar={(v) => pon({ chat: v })} etiqueta="Chat con el coach" />
            <Interruptor activo={f.tecnica} alCambiar={(v) => pon({ tecnica: v })} etiqueta="Técnica por video" />
          </div>

          {programa?.kind !== 'weekly' && (
            <Opciones
              etiqueta="Cuánto ve el comprador hacia adelante"
              opciones={VENTANAS.map((v) => ({ id: v.valor, nombre: v.nombre }))} valor={f.ventana_semanas} alCambiar={(v) => pon({ ventana_semanas: v })}
              nota="Lo demás lo ve borroso, con candado."
            />
          )}
        </div>
      </Ventana>
      {eligiendoVideo && <HojaDeClase titulo="Video del plan" conMias={false} onCerrar={() => setEligiendoVideo(false)} onElige={(c) => { setEligiendoVideo(false); pon({ video_url: c.url }); }} />}
      {eligiendo && <SelectorDeMisPlanes tipos={['programa']} titulo="El plan que vendes" onElegir={eligeUnPlan} onCerrar={() => setEligiendo(false)} />}
    </>
  );
}
