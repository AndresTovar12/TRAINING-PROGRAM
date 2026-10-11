import { useEffect, useMemo, useState } from 'react';
import { Check, Layers, Loader2 } from 'lucide-react';
import { T, KP, FONT } from '@/lib/theme';
import Ventana from '@/features/misplanes/Ventana';
import SelectorDeMisPlanes from '@/features/misplanes/SelectorDeMisPlanes';
import { botonBlanco, botonPrincipal, campo, etiquetaChica } from '@/features/misplanes/estilos';
import {
  PRECIO_MINIMO, TIPOS_DE_VENTA, VENTANAS, guardaPlanEnVenta, ligaPublica, programaParaVender, publicaPlan, slugDe,
} from '@/lib/vitrinaApi';

/* LA FICHA DE UN PLAN EN VENTA: lo que el coach llena para venderlo.

   Andrés, 10-11 oct 2026: la ficha dice qué es el plan, para quién, qué objetivo tiene y cuánto cuesta; el coach decide por dónde puede entrar quien lo compra, cuántas semanas
   ve hacia adelante (el resto, borroso) y si lleva chat y técnica por video. El plan sale de uno de «Mis planes»; al publicar se guarda una COPIA: lo que siga editando en «Mis planes»
   no toca lo vendido hasta que vuelva a publicar. Precio mínimo $500.

   `plan`: la fila existente (o null si es nuevo). `usuario`: el nombre que va en la liga. `alCerrar(guardado?)`: se cerró; si trae el plan, se guardó o publicó. */

const NIVELES = [
  { id: '', nombre: 'Sin nivel' }, { id: 'principiante', nombre: 'Principiante' }, { id: 'intermedio', nombre: 'Intermedio' },
  { id: 'avanzado', nombre: 'Avanzado' }, { id: 'todos', nombre: 'Todos los niveles' },
];

const Campo = ({ etiqueta, children }) => (
  <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
    <span style={etiquetaChica}>{etiqueta}</span>
    {children}
  </label>
);

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

export default function FichaDelPlanEnVenta({ plan, usuario, alCerrar }) {
  const nuevo = !plan;
  const [f, setF] = useState(() => ({
    programa_guardado_id: plan?.programa_guardado_id ?? null,
    titulo: plan?.titulo ?? '',
    slug: plan?.slug ?? '',
    descripcion: plan?.descripcion ?? '',
    para_quien: plan?.para_quien ?? '',
    objetivo: plan?.objetivo ?? '',
    nivel: plan?.nivel ?? '',
    tipo: plan?.tipo === 'pago_unico' ? 'pago_unico' : 'membresia',
    precio_mxn: plan?.precio_mxn ?? '',
    fases_de_entrada: Array.isArray(plan?.fases_de_entrada) ? plan.fases_de_entrada : [],
    ventana_semanas: plan ? plan.ventana_semanas : 4,
    chat: !!plan?.chat,
    tecnica: !!plan?.tecnica,
  }));
  const [ligaALaMano, setLigaALaMano] = useState(!!plan?.slug);
  const [programa, setPrograma] = useState(null);
  const [cargandoPrograma, setCargandoPrograma] = useState(!!plan?.programa_guardado_id);
  const [eligiendo, setEligiendo] = useState(false);
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

  const eligeUnPlan = async (item) => {
    setEligiendo(false);
    setError(null);
    setCargandoPrograma(true);
    try {
      const p = await programaParaVender(item.id);
      setPrograma(p);
      pon({
        programa_guardado_id: item.id,
        titulo: f.titulo || p?.nombre || item.nombre,
        slug: ligaALaMano ? f.slug : slugDe(f.titulo || p?.nombre || item.nombre),
        // Por defecto se entra por la primera fase.
        fases_de_entrada: p?.fases?.length ? [p.fases[0].id] : [],
      });
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
    if (f.slug.length < 2) lista.push('Falta la liga.');
    if (programa?.fases?.length && programa.kind !== 'weekly' && f.fases_de_entrada.length === 0) lista.push('Marca por dónde se puede entrar.');
    return lista;
  }, [f, precio, programa]);

  const alternaFase = (id) => pon({ fases_de_entrada: f.fases_de_entrada.includes(id) ? f.fases_de_entrada.filter((x) => x !== id) : [...f.fases_de_entrada, id] });

  const guarda = async (publicar) => {
    if (problemas.length) { setError(problemas[0]); return; }
    setGuardando(publicar ? 'publicar' : 'borrador');
    setError(null);
    try {
      let guardado = await guardaPlanEnVenta({
        id: plan?.id ?? null,
        ...f,
        titulo: f.titulo.trim(),
        descripcion: f.descripcion.trim() || null,
        para_quien: f.para_quien.trim() || null,
        objetivo: f.objetivo.trim() || null,
        nivel: f.nivel || null,
        precio_mxn: precio,
        fases_de_entrada: f.fases_de_entrada,
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
            <input
              value={f.titulo} maxLength={120} placeholder="Por ejemplo: Velocidad para receptores" style={campo}
              onChange={(e) => pon({ titulo: e.target.value, ...(ligaALaMano ? null : { slug: slugDe(e.target.value) }) })}
            />
          </Campo>
          <Campo etiqueta="Descripción">
            <textarea value={f.descripcion} maxLength={4000} rows={4} placeholder="Qué incluye y cómo se entrena" style={{ ...campo, resize: 'vertical' }} onChange={(e) => pon({ descripcion: e.target.value })} />
          </Campo>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
            <Campo etiqueta="Para quién"><input value={f.para_quien} maxLength={500} placeholder="Jugadores de fútbol americano" style={campo} onChange={(e) => pon({ para_quien: e.target.value })} /></Campo>
            <Campo etiqueta="Objetivo"><input value={f.objetivo} maxLength={500} placeholder="Llegar fuerte a la temporada" style={campo} onChange={(e) => pon({ objetivo: e.target.value })} /></Campo>
          </div>
          <Campo etiqueta="Nivel">
            <select value={f.nivel} style={campo} onChange={(e) => pon({ nivel: e.target.value })}>
              {NIVELES.map((n) => <option key={n.id} value={n.id}>{n.nombre}</option>)}
            </select>
          </Campo>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
            <Campo etiqueta="Cómo se cobra">
              <select value={f.tipo} style={campo} onChange={(e) => pon({ tipo: e.target.value })}>
                {TIPOS_DE_VENTA.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
              </select>
            </Campo>
            <Campo etiqueta={f.tipo === 'pago_unico' ? 'Precio (pesos)' : 'Precio al mes (pesos)'}>
              <input
                value={f.precio_mxn} inputMode="numeric" placeholder={`${PRECIO_MINIMO} o más`} style={campo}
                onChange={(e) => pon({ precio_mxn: e.target.value.replace(/\D/g, '') })}
              />
            </Campo>
          </div>

          {programa?.fases?.length > 0 && programa.kind !== 'weekly' && (
            <Campo etiqueta="Por dónde se puede entrar">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {programa.fases.map((fase) => {
                  const marcada = f.fases_de_entrada.includes(fase.id);
                  return (
                    <button
                      key={fase.id} type="button" role="checkbox" aria-checked={marcada} onClick={() => alternaFase(fase.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, minHeight: 42, padding: '0 12px', borderRadius: 11, cursor: 'pointer', textAlign: 'left', fontFamily: FONT,
                        border: `1.5px solid ${marcada ? T.accent : T.border}`, background: marcada ? T.accentBg : T.bg2, fontSize: 14, fontWeight: 700, color: T.text,
                      }}
                    >
                      <span style={{ width: 20, height: 20, borderRadius: 6, border: `2px solid ${marcada ? T.accent : T.borderHi}`, background: marcada ? T.accent : 'transparent', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                        {marcada && <Check size={13} color="#fff" strokeWidth={3.5} />}
                      </span>
                      <span style={{ flex: 1, minWidth: 0 }}>{fase.nombre}</span>
                      <span style={{ color: T.text3, fontSize: 12.5, fontWeight: 700 }}>{fase.semanas} sem</span>
                    </button>
                  );
                })}
              </div>
            </Campo>
          )}

          {programa?.kind !== 'weekly' && (
            <Campo etiqueta="Cuánto ve el comprador hacia adelante">
              <select
                value={f.ventana_semanas == null ? 'todo' : String(f.ventana_semanas)} style={campo}
                onChange={(e) => pon({ ventana_semanas: e.target.value === 'todo' ? null : Number(e.target.value) })}
              >
                {VENTANAS.map((v) => <option key={v.nombre} value={v.valor == null ? 'todo' : String(v.valor)}>{v.nombre}</option>)}
              </select>
            </Campo>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 10 }}>
            <Interruptor activo={f.chat} alCambiar={(v) => pon({ chat: v })} etiqueta="Chat con el coach" />
            <Interruptor activo={f.tecnica} alCambiar={(v) => pon({ tecnica: v })} etiqueta="Técnica por video" />
          </div>

          <Campo etiqueta="Tu liga">
            <input
              value={f.slug} maxLength={60} style={campo} placeholder="velocidad-para-receptores"
              onChange={(e) => { setLigaALaMano(true); pon({ slug: slugDe(e.target.value) }); }}
            />
            <span style={{ fontSize: 13, fontWeight: 600, color: T.text2, overflowWrap: 'anywhere' }}>{ligaPublica(usuario || 'tu-usuario', f.slug || '…')}</span>
          </Campo>
        </div>
      </Ventana>
      {eligiendo && <SelectorDeMisPlanes tipos={['programa']} titulo="El plan que vendes" onElegir={eligeUnPlan} onCerrar={() => setEligiendo(false)} />}
    </>
  );
}
