import { useCallback, useEffect, useState } from 'react';
import { Check, Copy, Eye, Loader2, Pencil, Plus, Store, Undo2 } from 'lucide-react';
import { T, KP, FONT } from '@/lib/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useConfirmacion } from '@/components/Confirmacion';
import { botonBlanco, botonPrincipal } from '@/features/misplanes/estilos';
import FichaDelPlanEnVenta from '@/features/vitrina/FichaDelPlanEnVenta';
import { ETIQUETA_DE_CONTENIDO, leeVentasAbiertas, ligaPublica, listaMiVitrina, retiraPlan } from '@/lib/vitrinaApi';
import { chipsDeParaQuien } from '@/lib/paraQuien';

/* MI VITRINA: los planes que un coach pone a la venta (nombre que decidió Andrés, 10 oct 2026; antes se llamaba «menú»).

   Cada plan es una tarjeta con su estado (Borrador, Publicado o Retirado), su precio, cuántos suscriptores tiene y su liga para compartir en Instagram o WhatsApp.
   La tiene CUALQUIER profesional (Andrés, 12 oct 2026; antes era solo del dueño). Mientras Stripe no esté conectado, publicar funciona y el botón de comprar dice «Pronto»: una franja lo avisa. */

const ESTADOS = {
  borrador: { texto: 'Borrador', fondo: KP.amberSoft, tinta: KP.amber },
  publicado: { texto: 'Publicado', fondo: KP.mintSoft, tinta: KP.mint },
  retirado: { texto: 'Retirado', fondo: T.bg3, tinta: T.text2 },
};
const pesos = (n) => `$${Number(n).toLocaleString('es-MX')}`;

function Tarjeta({ plan, usuario, alEditar, alRetirar }) {
  const [copiado, setCopiado] = useState(false);
  const e = ESTADOS[plan.estado] ?? ESTADOS.borrador;
  const liga = ligaPublica(usuario, plan.slug);
  const copia = async () => {
    try { await navigator.clipboard.writeText(liga); setCopiado(true); setTimeout(() => setCopiado(false), 1800); } catch { /* sin permiso: se puede seleccionar a mano */ }
  };
  return (
    <div style={{ background: KP.surface, borderRadius: 16, boxShadow: KP.shCard, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: T.text, lineHeight: 1.25, overflowWrap: 'anywhere' }}>{plan.titulo}</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.text2, marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>
            {plan.contenido && plan.contenido !== 'programa' ? `${ETIQUETA_DE_CONTENIDO[plan.contenido]} · ` : ''}{pesos(plan.precio_mxn)}{plan.tipo === 'pago_unico' ? '' : ' al mes'} · {plan.suscriptores}{' '}
            {plan.tipo === 'pago_unico' ? (plan.suscriptores === 1 ? 'compra' : 'compras') : (plan.suscriptores === 1 ? 'suscriptor' : 'suscriptores')}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            {chipsDeParaQuien(plan, { siempreEdad: true }).map((c) => (
              <span key={c} style={{ padding: '3px 10px', borderRadius: 999, background: T.accentBg, color: T.accent, fontSize: 12.5, fontWeight: 800 }}>{c}</span>
            ))}
          </div>
        </div>
        <span style={{ padding: '3px 10px', borderRadius: 999, background: e.fondo, color: e.tinta, fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap' }}>{e.texto}</span>
      </div>
      {plan.estado === 'publicado' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0, padding: '9px 12px', borderRadius: 11, background: T.bg2, fontSize: 13, fontWeight: 600, color: T.text2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{liga}</div>
          <button type="button" onClick={copia} style={{ ...botonBlanco(true), minHeight: 40 }} aria-label="Copiar la liga">
            {copiado ? <Check size={16} /> : <Copy size={16} />} {copiado ? 'Copiada' : 'Copiar'}
          </button>
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" onClick={() => alEditar(plan)} style={{ ...botonBlanco(false), minHeight: 40 }}><Pencil size={15} /> Editar</button>
        {plan.estado === 'publicado' && (
          <a href={ligaPublica(usuario, plan.slug)} target="_blank" rel="noreferrer" style={{ ...botonBlanco(false), minHeight: 40, textDecoration: 'none' }}><Eye size={15} /> Ver página</a>
        )}
        {plan.estado === 'publicado' && (
          <button type="button" onClick={() => alRetirar(plan)} style={{ ...botonBlanco(false), minHeight: 40 }}><Undo2 size={15} /> Retirar</button>
        )}
      </div>
    </div>
  );
}

export default function MiVitrina() {
  const { profile } = useAuth();
  const pregunta = useConfirmacion();
  const usuario = profile?.username ?? '';
  const [planes, setPlanes] = useState(null);
  const [error, setError] = useState(null);
  const [editando, setEditando] = useState(undefined); // undefined = cerrada · null = plan nuevo · fila = editar
  const [ventas, setVentas] = useState(true); // ¿ya se puede cobrar? (hasta saberlo, no se asusta a nadie con el aviso)
  useEffect(() => { leeVentasAbiertas().then(setVentas).catch(() => {}); }, []);

  const carga = useCallback(async () => {
    try { setPlanes(await listaMiVitrina()); setError(null); } catch (e) { setError(e?.message ?? 'No se pudo cargar tu vitrina.'); setPlanes((p) => p ?? []); }
  }, []);
  useEffect(() => { carga(); }, [carga]);

  const retira = async (plan) => {
    const va = await pregunta({
      titulo: '¿Retirar este plan?', detalle: 'Deja de mostrarse en tu página. Quien ya lo paga lo conserva hasta que deje de pagar.', confirmar: 'Sí, retirarlo', peligro: true,
    });
    if (!va) return;
    try { await retiraPlan(plan.id); await carga(); } catch (e) { setError(e?.message ?? 'No se pudo retirar.'); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 820, margin: '0 auto', fontFamily: FONT }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0, fontSize: 22, fontWeight: 800, color: T.text, letterSpacing: -0.4 }}>Mi vitrina</div>
        <button type="button" onClick={() => setEditando(null)} style={botonPrincipal(false)}><Plus size={17} /> Poner algo en venta</button>
      </div>
      {error && <div role="alert" style={{ padding: '10px 14px', borderRadius: 12, background: KP.dangerSoft, color: KP.danger, fontSize: 14, fontWeight: 700 }}>{error}</div>}
      {!ventas && (
        <div role="status" style={{ padding: '10px 14px', borderRadius: 12, background: KP.amberSoft, color: KP.amber, fontSize: 14, fontWeight: 700, lineHeight: 1.4 }}>
          Los cobros se abren pronto. Publica tus planes desde ya: el botón de comprar dirá «Pronto» hasta entonces.
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
        planes.map((p) => <Tarjeta key={p.id} plan={p} usuario={usuario} alEditar={setEditando} alRetirar={retira} />)
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
