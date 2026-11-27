import { useCallback, useEffect, useState } from 'react';
import { Check, ChevronRight, Loader2, Plus, Star, Store } from 'lucide-react';
import { T, KP, FONT, UI } from '@/lib/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useConfirmacion } from '@/components/Confirmacion';
import { botonPrincipal } from '@/features/misplanes/estilos';
import FichaDelPlanEnVenta from '@/features/vitrina/FichaDelPlanEnVenta';
import { cobrosDeMiCuenta } from '@/lib/miDineroApi';
import { ETIQUETA_DE_CONTENIDO, leeVentasAbiertas, ligaPublica, listaMiVitrina, retiraPlan, borraBorrador } from '@/lib/vitrinaApi';
import { chipsDeParaQuien } from '@/lib/paraQuien';
import { Avatar, useCabeceraDeSeccion, useEnBanda } from '@/components/ui';
import { enLaApp } from '@/lib/nativo';
import PaginaDelPlan from '@/features/tienda/PaginaDelPlan';
import TuPagina from '@/features/vitrina/TuPagina';

/* MI VITRINA: los planes que un coach pone a la venta (nombre que decidió Andrés, 10 oct 2026; antes se llamaba «menú»).

   Cada plan es una tarjeta con su estado (Borrador, Publicado o Retirado), su precio, cuántos suscriptores tiene y su liga para compartir en Instagram o WhatsApp.
   La tiene CUALQUIER profesional (Andrés, 12 oct 2026; antes era solo del dueño). Mientras Stripe no esté conectado, publicar funciona y el botón de comprar dice «Pronto»: una franja lo avisa. */

const ESTADOS = {
  borrador: { texto: 'Borrador', fondo: KP.amberSoft, tinta: KP.amber },
  publicado: { texto: 'Publicado', fondo: KP.mintSoft, tinta: KP.mint },
  retirado: { texto: 'Fuera de la venta', fondo: T.bg3, tinta: T.text2 },
};
const pesos = (n) => `$${Number(n).toLocaleString('es-MX')}`;

/* Reestructura visual (16 oct 2026), como «Mi vitrina» de las capturas de Andrés: la foto del plan arriba con su estado encima; abajo el
   nombre, qué es, el precio grande y las ventas; la liga con «Copiar» (solo publicado) y tres botones iguales: Editar · Ver página · Retirar. */
function Tarjeta({ plan, usuario, alEditar, alRetirar, alBorrar, alVer }) {
  const [copiado, setCopiado] = useState(false);
  const e = ESTADOS[plan.estado] ?? ESTADOS.borrador;
  const liga = ligaPublica(usuario, plan.slug);
  const copia = async () => {
    try { await navigator.clipboard.writeText(liga); setCopiado(true); setTimeout(() => setCopiado(false), 1800); } catch { /* sin permiso: se puede seleccionar a mano */ }
  };
  const ventas = plan.suscriptores ?? 0;
  const publicado = plan.estado === 'publicado';
  const boton = { flex: 1, minHeight: 46, borderRadius: 14, border: 'none', cursor: 'pointer', fontFamily: FONT, fontSize: 15, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', whiteSpace: 'nowrap' };
  return (
    <div style={{ background: UI.tarjeta, borderRadius: 22, boxShadow: UI.sombraGrupo, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ position: 'relative', aspectRatio: '16 / 9', background: plan.foto_url ? '#1B1D24' : '#ECEFFC' }}>
        {plan.foto_url && <img src={plan.foto_url} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
        <span style={{ position: 'absolute', top: 12, left: 12, display: 'flex', gap: 6 }}>
          <span style={{ padding: '4px 10px', borderRadius: 8, background: e.fondo, color: e.tinta, fontSize: 13, fontWeight: 700 }}>{e.texto}</span>
          {plan.recomendado && <span style={{ padding: '4px 10px', borderRadius: 8, background: '#fff', color: KP.blue, fontSize: 13, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Star size={11} fill="currentColor" />Empieza aquí</span>}
        </span>
      </div>
      <div style={{ padding: '14px 16px 16px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: KP.ink, lineHeight: 1.25, overflowWrap: 'anywhere' }}>{plan.titulo}</div>
          <div style={{ fontSize: 14, fontWeight: 500, color: KP.ink2, marginTop: 3 }}>
            {[ETIQUETA_DE_CONTENIDO[plan.contenido ?? 'programa'], ...chipsDeParaQuien(plan).slice(0, 2)].filter(Boolean).join(' · ')}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
          <span style={{ fontSize: 24, fontWeight: 800, color: KP.ink, fontVariantNumeric: 'tabular-nums' }}>
            {pesos(plan.precio_mxn)}{plan.tipo === 'pago_unico' ? '' : <span style={{ fontSize: 15, fontWeight: 600, color: KP.ink2 }}> / mes</span>}
          </span>
          <span style={{ fontSize: 14, fontWeight: 500, color: KP.ink2 }}>
            {ventas === 0 ? 'Sin ventas' : `${ventas} ${plan.tipo === 'pago_unico' ? (ventas === 1 ? 'venta' : 'ventas') : (ventas === 1 ? 'suscrito' : 'suscritos')}`}
          </span>
        </div>
        {publicado && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0, padding: '10px 12px', borderRadius: 12, background: UI.relleno, fontSize: 13, fontWeight: 500, color: KP.ink2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', userSelect: 'all' }}>{liga.replace(/^https?:\/\//, '')}</div>
            <button type="button" onClick={copia} style={{ minHeight: 40, padding: '0 14px', borderRadius: 12, border: 'none', cursor: 'pointer', background: KP.blueSoft, color: KP.blue, fontFamily: FONT, fontSize: 14, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }} aria-label="Copiar la liga">
              {copiado ? <Check size={15} /> : null}{copiado ? 'Copiada' : 'Copiar'}
            </button>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
          <button type="button" onClick={() => alEditar(plan)} style={{ ...boton, background: UI.relleno, color: KP.ink }}>Editar</button>
          {/* En la app la página se ve aquí mismo, sin salir a la web (donde se compra): regla de Apple. */}
          {publicado && (enLaApp()
            ? <button type="button" onClick={() => alVer(plan)} style={{ ...boton, background: UI.relleno, color: KP.ink }}>Ver página</button>
            : <a href={liga} target="_blank" rel="noreferrer" style={{ ...boton, background: UI.relleno, color: KP.ink }}>Ver página</a>)}
          {plan.estado === 'borrador' && !plan.version_n && <button type="button" onClick={() => alBorrar(plan)} style={{ ...boton, background: KP.dangerSoft, color: KP.danger }}>Borrar</button>}
        </div>
        {publicado && <button type="button" onClick={() => alRetirar(plan)} style={{ ...boton, flex: 'none', background: KP.dangerSoft, color: KP.danger }}>Quitar de la venta</button>}
      </div>
    </div>
  );
}

export default function MiVitrina() {
  const enBanda = useEnBanda();
  const { profile } = useAuth();
  const pregunta = useConfirmacion();
  const usuario = profile?.username ?? '';
  const [planes, setPlanes] = useState(null);
  const [error, setError] = useState(null);
  const [editando, setEditando] = useState(undefined); // undefined = cerrada · null = plan nuevo · fila = editar
  const [tuPagina, setTuPagina] = useState(false);
  const [viendo, setViendo] = useState(null); // en la app: el plan cuya página se ve aquí mismo
  const [ventas, setVentas] = useState(true); // ¿ya se puede cobrar? (hasta saberlo, no se asusta a nadie con el aviso)
  useEffect(() => { leeVentasAbiertas().then(setVentas).catch(() => {}); }, []);
  // ¿Su cuenta de cobro (Stripe) está lista? Sin ella el plan sale «Publicado» pero nadie lo puede comprar ni aparece en Explorar, y nadie se lo decía (auditoría p50).
  // `null` = todavía no se sabe (o no se pudo leer): en ese caso no se asusta a nadie.
  const [cuentaLista, setCuentaLista] = useState(null);
  useEffect(() => {
    cobrosDeMiCuenta().then((r) => setCuentaLista(!!(r?.cuenta?.onboarding_completo && r?.cuenta?.cobros_ok && r?.cuenta?.depositos_ok))).catch(() => {});
  }, []);

  const carga = useCallback(async () => {
    try { setPlanes(await listaMiVitrina()); setError(null); } catch (e) { setError(e?.message ?? 'No se pudo cargar tu vitrina.'); setPlanes((p) => p ?? []); }
  }, []);
  useEffect(() => { carga(); }, [carga]);

  /* La cabecera: «3 planes · 41 ventas» y «Copiar la liga» de tu página, como en la captura. */
  const [paginaCopiada, setPaginaCopiada] = useState(false);
  useCabeceraDeSeccion(() => {
    if (!planes) return { detalle: null, accion: null };
    const n = planes.length;
    const vendidos = planes.reduce((t, p) => t + (p.suscriptores ?? 0), 0);
    const ligaDeTuPagina = ligaPublica(usuario);
    return {
      detalle: `${n} ${n === 1 ? 'plan' : 'planes'} · ${vendidos} ${vendidos === 1 ? 'venta' : 'ventas'}`,
      accion: usuario ? (
        <button
          type="button"
          onClick={async () => { try { await navigator.clipboard.writeText(ligaDeTuPagina); setPaginaCopiada(true); setTimeout(() => setPaginaCopiada(false), 1800); } catch { /* sin permiso */ } }}
          style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: FONT, fontSize: 15, fontWeight: 700, color: KP.blue, padding: '8px 4px', flexShrink: 0, whiteSpace: 'nowrap' }}
        >
          {paginaCopiada ? 'Liga copiada' : 'Copiar la liga'}
        </button>
      ) : null,
    };
  }, [planes, usuario, paginaCopiada]);

  const retira = async (plan) => {
    const va = await pregunta({
      titulo: '¿Quitar este plan de la venta?', detalle: 'Deja de mostrarse en tu página. Quien ya lo compró lo conserva.', confirmar: 'Sí, quitarlo', peligro: true,
    });
    if (!va) return;
    try { await retiraPlan(plan.id); await carga(); } catch (e) { setError(e?.message ?? 'No se pudo quitar de la venta.'); }
  };

  // Un borrador (nunca se publicó) se puede borrar: no tiene suscriptores que lo conserven (auditoría p69).
  const borra = async (plan) => {
    const va = await pregunta({
      titulo: '¿Borrar este borrador?', detalle: 'Nunca se publicó, así que nadie lo ve ni lo paga. No se puede deshacer.', confirmar: 'Sí, borrarlo', peligro: true,
    });
    if (!va) return;
    try { await borraBorrador(plan.id); await carga(); } catch (e) { setError(e?.message ?? 'No se pudo borrar.'); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontFamily: FONT }}>
      {!enBanda && <div style={{ fontSize: 22, fontWeight: 800, color: T.text, letterSpacing: -0.4 }}>Mi vitrina</div>}
      <button type="button" onClick={() => setEditando(null)} style={{ ...botonPrincipal(false), width: '100%', minHeight: 52, fontSize: 16 }}><Plus size={18} /> Poner algo en venta</button>
      <button type="button" onClick={() => setTuPagina(true)} className="kp-press" style={{ display: 'flex', alignItems: 'center', gap: 14, background: UI.tarjeta, borderRadius: 20, boxShadow: UI.sombraGrupo, border: 'none', padding: '12px 16px', textAlign: 'left', cursor: 'pointer', fontFamily: FONT }}>
        <Avatar nombre={profile?.full_name} foto={profile?.portada_url || profile?.avatar_url} tamano={52} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 17, fontWeight: 700, color: KP.ink }}>Tu página</span>
          <span style={{ display: 'block', fontSize: 14, fontWeight: 500, color: KP.ink2, lineHeight: 1.35 }}>Foto, frase, Sobre mí, Instagram y resultados de tus atletas</span>
        </span>
        <ChevronRight size={19} color={KP.ink3} />
      </button>
      {error && <div role="alert" style={{ padding: '10px 14px', borderRadius: 12, background: KP.dangerSoft, color: KP.danger, fontSize: 14, fontWeight: 700 }}>{error}</div>}
      {!ventas && (
        <div role="status" style={{ padding: '10px 14px', borderRadius: 12, background: KP.amberSoft, color: KP.amber, fontSize: 14, fontWeight: 700, lineHeight: 1.4 }}>
          Los cobros se abren pronto. Publica tus planes desde ya: el botón de comprar dirá «Pronto» hasta entonces.
        </div>
      )}
      {ventas && cuentaLista === false && planes?.some((p) => p.estado === 'publicado') && (
        <div role="status" style={{ padding: '10px 14px', borderRadius: 12, background: KP.amberSoft, color: KP.amber, fontSize: 14, fontWeight: 700, lineHeight: 1.4 }}>
          Tus planes están publicados, pero todavía nadie puede comprarlos ni aparecen en Explorar: falta conectar tu cuenta de cobro. Búscala en Mi perfil → Mis ganancias.
        </div>
      )}
      {planes === null ? (
        <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.text2, fontWeight: 600, padding: 16 }}><Loader2 size={17} className="spin" /> Cargando…</div>
      ) : planes.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '44px 20px', background: KP.surface, borderRadius: 18, boxShadow: KP.shCard }}>
          <span style={{ width: 56, height: 56, borderRadius: 18, background: T.accentBg, color: T.accent, display: 'inline-grid', placeItems: 'center' }}><Store size={26} /></span>
          <div style={{ fontSize: 17, fontWeight: 800, color: T.text, marginTop: 14 }}>Aquí vendes lo tuyo</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: T.text2, lineHeight: 1.5, margin: '6px auto 0', maxWidth: 340 }}>Escoge un programa, una rutina, un workout o una clase de Mis planes, ponle precio y comparte tu liga.</div>
          <button type="button" onClick={() => setEditando(null)} style={{ ...botonPrincipal(false), marginTop: 18 }}><Plus size={17} /> Poner algo en venta</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))', gap: 16 }}>
          {planes.map((p) => <Tarjeta key={p.id} plan={p} usuario={usuario} alEditar={setEditando} alRetirar={retira} alBorrar={borra} alVer={setViendo} />)}
        </div>
      )}
      {tuPagina && <TuPagina alCerrar={() => setTuPagina(false)} />}
      {viendo && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 70, overflowY: 'auto', background: UI.fondo }}>
          <PaginaDelPlan usuario={usuario} slug={viendo.slug} enLaApp alVolver={() => setViendo(null)} />
        </div>
      )}
      {editando !== undefined && (
        <FichaDelPlanEnVenta
          key={editando?.id ?? 'nuevo'} plan={editando} slugsOcupados={planes?.filter((p) => p.id !== editando?.id).map((p) => p.slug) ?? []}
          alCerrar={(guardado) => { setEditando(undefined); if (guardado) carga(); }}
        />
      )}
    </div>
  );
}
