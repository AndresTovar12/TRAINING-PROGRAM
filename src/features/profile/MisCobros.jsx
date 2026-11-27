import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowUp, Check, ChevronLeft, ChevronRight, Clock, FileText, Globe, Landmark, Loader2, Percent, ShoppingBag, Smartphone } from 'lucide-react';
import { conectaCobros, guardaClabe, leeGanancias, retiraDinero } from '@/lib/miDineroApi';
import {
  MINIMO_RETIRO, asignaRetiro, clabeValida, estaListo, ganadoEnMes, listoApple, listoDeUnaVenta, listoWeb, lugarDe, mesDe, pesos, saldos,
} from '@/lib/dinero';
import { useAuth } from '@/contexts/AuthContext';
import { useLugares } from '@/features/admin/useLugares';
import { etiquetaDeLugares } from '@/lib/limiteDeAtletas';
import SinLugares from '@/features/admin/SinLugares';
import { Boton, Campo, Fila, Grupo, IconoDeFila, Pastilla, Segmentado, TarjetaHeroe } from '@/components/ui';
import { Aviso } from '@/features/profile/piezas';
import { FONT, KP, NUM_STYLE, UI } from '@/lib/theme';

/* «MIS GANANCIAS» (encargo «Compra y dinero», 26 nov 2026; dibujos gan-m1 … gan-m11, gan-v1 … gan-v6 y gan-d*). Reemplaza «Cobros».
   Cuánto ganó, dónde está su dinero (retirado, listo para retirar y en camino; nunca mezclado con «Ganaste en noviembre») y por qué tarda. Retira cuando quiere,
   mínimo $200: un solo «Retirar»; por dentro pueden salir dos envíos (lo de la web por Stripe y lo de iPhone por SPEI).
   Fechas: solo lo que se sabe de verdad. Web: cuando Stripe libera el dinero. iPhone: aproximado («a mediados de dic»), según el calendario de pagos de Apple.
   Nunca se escriben «una vez al mes», las comisiones de Apple ni el IVA. */

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const dia = (f) => new Date(`${String(f).slice(0, 10)}T12:00:00Z`);
const fechaLarga = (f) => `${DIAS[dia(f).getUTCDay()]} ${dia(f).getUTCDate()} de ${MES_CORTO[dia(f).getUTCMonth()]}`;
const cuando = (iso, hoy) => { const f = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date(iso)); if (f === hoy) return 'hoy'; const ayer = new Date(`${hoy}T12:00:00Z`); ayer.setUTCDate(ayer.getUTCDate() - 1); return f === ayer.toISOString().slice(0, 10) ? 'ayer' : `${dia(f).getUTCDate()} ${MES_CORTO[dia(f).getUTCMonth()]}`; };
const monto = (r) => pesos(r.monto, { aproximado: r.aproximado });
const iniciales = (n = '') => n.trim().split(/\s+/).slice(0, 2).map((x) => x[0]).join('').toUpperCase() || '·';

function Cabeza({ titulo, detalle, alVolver }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '2px 0 4px' }}>
      <button type="button" onClick={alVolver} aria-label="Volver" style={{ width: 44, height: 44, borderRadius: 14, border: 'none', background: UI.relleno, display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0 }}><ChevronLeft size={21} /></button>
      <div style={{ minWidth: 0 }}><div style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.5, lineHeight: 1.15 }}>{titulo}</div>{detalle && <div style={{ fontSize: 15, fontWeight: 500, color: KP.ink2 }}>{detalle}</div>}</div>
    </div>
  );
}

/** Los pasos de una venta o un retiro (✓ hecho · número azul «Aquí va» · número gris). */
function Pasos({ pasos }) {
  return (
    <div style={{ background: UI.tarjeta, borderRadius: UI.rTarjeta, padding: '18px 18px 6px' }}>
      {pasos.map((p, i) => (
        <div key={i} style={{ display: 'flex', gap: 14, position: 'relative', paddingBottom: 18 }}>
          {i < pasos.length - 1 && <span style={{ position: 'absolute', left: 17, top: 38, bottom: 0, width: 2, background: p.hecho ? KP.mint : KP.lineHi }} />}
          <span style={{ width: 36, height: 36, borderRadius: 99, flexShrink: 0, display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 16, background: p.hecho ? KP.mint : p.ahora ? KP.blue : UI.relleno, color: p.hecho || p.ahora ? '#fff' : KP.ink2, boxShadow: p.ahora ? `0 0 0 5px ${KP.blueSoft}` : 'none' }}>
            {p.hecho ? <Check size={18} strokeWidth={3} /> : i + 1}
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><b style={{ fontSize: 17, fontWeight: p.ahora ? 800 : 600 }}>{p.titulo}</b>{p.ahora && <Pastilla tono="azul">Aquí va</Pastilla>}</span>
            {p.detalle && <span style={{ display: 'block', fontSize: 15, fontWeight: 500, color: KP.ink2, marginTop: 2 }}>{p.detalle}</span>}
          </span>
        </div>
      ))}
    </div>
  );
}

function FilaDeVenta({ r, hoy, onClick, sinPastilla = false }) {
  const lugar = lugarDe(r, hoy);
  return (
    <Fila
      izquierda={<span style={{ width: 48, height: 48, borderRadius: 14, background: r.canal === 'apple' ? '#FFF1E6' : KP.blueSoft, color: r.canal === 'apple' ? KP.amber : KP.blue, display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 16 }}>{iniciales(r.atleta?.nombre || r.plan || '')}</span>}
      texto={r.tipo === 'reembolso' ? 'Reembolso' : (r.atleta?.nombre ?? 'Atleta')} detalle={<>{r.plan}<br />{cuando(r.creado_en, hoy)}</>}
      derecha={(
        <span style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <b style={{ fontSize: 17, ...NUM_STYLE, color: r.estado === 'anulado' ? KP.ink3 : KP.ink, textDecoration: r.estado === 'anulado' ? 'line-through' : 'none' }}>{monto(r)}</b>
          {!sinPastilla && lugar === 'en_camino' && r.listo_estimado && <Pastilla>{listoDeUnaVenta(r)}</Pastilla>}
          {!sinPastilla && lugar === 'listo' && <Pastilla tono="ok">Listo</Pastilla>}
        </span>
      )}
      onClick={onClick}
    />
  );
}

export default function MisCobros() {
  const { profile } = useAuth();
  const lugares = useLugares();
  const [g, setG] = useState(undefined);
  const [error, setError] = useState('');
  const [pila, setPila] = useState([{ v: 'inicio' }]);
  const [aviso, setAviso] = useState(null); // tras retirar: { monto, llega }
  const [mes, setMes] = useState(() => mesDe(new Date().toISOString()));
  const [verLugares, setVerLugares] = useState(false);
  const vista = pila[pila.length - 1];
  const ve = (v, x = {}) => { setPila((p) => [...p, { v, ...x }]); window.scrollTo?.(0, 0); };
  const atras = () => setPila((p) => (p.length > 1 ? p.slice(0, -1) : p));

  const lee = useCallback(async () => {
    try { setG(await leeGanancias()); setError(''); } catch (e) { setError(e.codigo === 'NO_DISPONIBLE' ? 'Los cobros se activan muy pronto.' : e.message); setG({ libro: [], retiros: [], hoy: new Date().toISOString().slice(0, 10) }); }
  }, []);
  useEffect(() => { lee(); }, [lee]);
  const hoy = g?.hoy ?? new Date().toISOString().slice(0, 10);
  const libro = useMemo(() => g?.libro ?? [], [g]);
  const s = useMemo(() => saldos(libro, hoy), [libro, hoy]);

  async function abre(accion) {
    try { const { url } = await conectaCobros(accion); if (url) window.location.assign(url); } catch (e) { setError(e.codigo === 'NO_DISPONIBLE' ? 'Los cobros se activan muy pronto.' : e.message); }
  }
  if (g === undefined) return <div style={{ display: 'grid', placeItems: 'center', padding: 30 }}><Loader2 size={22} className="spin" color={KP.ink2} /></div>;

  const banco = g.banco?.destino ?? null;
  const hayApple = libro.some((r) => r.canal === 'apple');
  const listos = libro.filter((r) => estaListo(r, hoy));
  const retirable = asignaRetiro(listos.filter((r) => (r.canal === 'web' && banco) || (r.canal === 'apple' && g.envios_spei && g.spei)), null).total;
  const ultimo = (g.retiros ?? [])[0];
  const enviado = ultimo?.estado === 'enviado' ? ultimo : null;
  const fallo = ultimo?.estado === 'no_llego' || ultimo?.estado === 'en_parte' ? ultimo : null;
  const ventasDelMes = libro.filter((r) => mesDe(r.creado_en) === mes && r.tipo !== 'ajuste');
  const nombreMes = MESES[Number(mes.slice(5, 7)) - 1];
  const sinVentas = libro.length === 0;

  /* ---------- Las pantallas ---------- */
  if (vista.v === 'como') {
    const paso = (titulo, detalle) => ({ titulo, detalle });
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: FONT }}>
        <Cabeza titulo="Cómo te llega tu dinero" alVolver={atras} />
        <Grupo titulo="Venta en la web"><Pasos pasos={[paso('Tu atleta paga con tarjeta'), paso('El banco de tu atleta libera el pago', 'Tarda unos 3 días.'), paso('Tu 80 % queda listo para retirar', 'El otro 20 % es la comisión de Training Lab.')]} /></Grupo>
        <Grupo titulo="Venta en iPhone"><Pasos pasos={[paso('Tu atleta paga con Apple'), paso('Apple le paga a Training Lab', 'Entre 1½ y 2½ meses después de la venta.'), paso('Tu 80 % queda listo para retirar', 'El otro 20 % es la comisión de Training Lab.')]} /></Grupo>
      </div>
    );
  }
  if (vista.v === 'venta') {
    const r = vista.r;
    const web = r.canal === 'web';
    const lugar = lugarDe(r, hoy);
    const vendida = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date(r.creado_en));
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: FONT }}>
        <Cabeza titulo={r.atleta?.nombre ?? 'Venta'} detalle={`${r.plan ?? ''} · ${cuando(r.creado_en, hoy)}`} alVolver={atras} />
        <Pasos pasos={[
          { titulo: 'Se vendió', detalle: `${vendida === hoy ? 'Hoy, ' : ''}${fechaLarga(vendida)}`, hecho: true },
          web
            ? { titulo: 'El banco de tu atleta libera el pago', detalle: r.listo_estimado ? `El ${fechaLarga(r.listo_estimado)}.` : 'Unos 3 días después de la venta.', hecho: lugar !== 'en_camino', ahora: lugar === 'en_camino' }
            : { titulo: 'Apple le paga a Training Lab', detalle: r.listo_estimado ? `${listoApple([r.listo_estimado]).replace('Listo ', 'Más o menos ')}.` : 'Entre 1½ y 2½ meses después de la venta.', hecho: lugar !== 'en_camino', ahora: lugar === 'en_camino' },
          { titulo: lugar === 'retirado' ? 'Lo retiraste' : 'Lo puedes retirar', detalle: lugar === 'en_camino' && web && r.listo_estimado ? `Desde el ${fechaLarga(r.listo_estimado)}` : undefined, hecho: lugar === 'retirado', ahora: lugar === 'listo' },
        ]} />
        {g.primer_retiro && web && lugar === 'en_camino' && <p style={{ margin: '0 6px', fontSize: 14.5, color: KP.ink2 }}>Tu primer retiro tarda de 7 a 14 días porque el banco revisa tu cuenta una sola vez.</p>}
        <Grupo>
          <Fila texto="Pagó tu atleta" valor={pesos(r.bruto)} valorTono="neutro" />
          {web && <Fila texto="Training Lab (20 %)" valor={pesos(Math.round((r.bruto - r.monto) * 100) / 100)} valorTono="neutro" />}
          <Fila texto={<b>{web ? 'Tú (80 %)' : 'Tú'}</b>} valor={monto(r)} valorTono="neutro" />
        </Grupo>
        {!web && r.aproximado && <p style={{ margin: '0 6px', fontSize: 14.5, color: KP.ink2 }}>Es aproximado: cuando Apple pague, verás lo exacto.</p>}
      </div>
    );
  }
  if (vista.v === 'retiro') {
    const r = vista.r;
    const ok = r.estado === 'llego';
    const no = r.estado === 'no_llego';
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: FONT }}>
        <Cabeza titulo={`Retiro del ${dia(r.creado_en).getUTCDate()} ${MES_CORTO[dia(r.creado_en).getUTCMonth()]}`} alVolver={atras} />
        <div style={{ background: UI.tarjeta, borderRadius: UI.rTarjeta, padding: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div><div style={{ fontSize: 16, fontWeight: 600 }}>Mandaste a tu banco</div><div style={{ fontSize: 40, fontWeight: 800, ...NUM_STYLE }}>{pesos(r.monto)}</div></div>
          <Pastilla tono={ok ? 'ok' : no ? 'malo' : 'neutro'}>{ok ? 'Llegó' : no ? 'No llegó' : r.estado === 'en_parte' ? 'Llegó una parte' : 'En camino'}</Pastilla>
        </div>
        <Pasos pasos={[
          { titulo: 'Lo pediste', detalle: fechaLarga(String(r.creado_en).slice(0, 10)), hecho: true },
          no ? { titulo: 'No llegó', detalle: 'Tu banco rechazó el retiro. El dinero regresó a Listo para retirar.' }
            : { titulo: ok ? 'Llegó a tu banco' : 'Llega a tu banco', detalle: ok && r.llego_en ? fechaLarga(String(r.llego_en).slice(0, 10)) : r.llega_estimado ? `${fechaLarga(r.llega_estimado)} (aprox.)` : undefined, hecho: ok, ahora: !ok },
        ]} />
        {r.destino && <Grupo><Fila texto="Cuenta" valor={r.destino} valorTono="neutro" /></Grupo>}
        {r.listo_antes != null && (
          <Grupo titulo="Ese día">
            <Fila texto="Tenías listo para retirar" valor={pesos(r.listo_antes)} valorTono="neutro" />
            <Fila texto={<b>Retiraste</b>} valor={pesos(r.monto)} valorTono="neutro" />
            <Fila texto="Dejaste sin retirar" valor={pesos(Math.max(0, r.listo_antes - r.monto))} valorTono="neutro" />
          </Grupo>
        )}
        {no && <Boton tipo="secundario" ancho onClick={() => ve('cuenta')}>Revisar mi cuenta</Boton>}
      </div>
    );
  }
  if (vista.v === 'retirado') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: FONT }}>
        <Cabeza titulo="Retirado" detalle={pesos(s.retirado)} alVolver={atras} />
        {(g.retiros ?? []).length ? (
          <Grupo>{g.retiros.map((r) => <Fila key={r.id} izquierda={<IconoDeFila><Landmark size={18} /></IconoDeFila>} texto={pesos(r.monto)} detalle={`${fechaLarga(String(r.creado_en).slice(0, 10))}${r.destino ? ` · ${r.destino}` : ''}`} derecha={<Pastilla tono={r.estado === 'llego' ? 'ok' : r.estado === 'no_llego' ? 'malo' : 'neutro'}>{r.estado === 'llego' ? 'Llegó' : r.estado === 'no_llego' ? 'No llegó' : 'En camino'}</Pastilla>} onClick={() => ve('retiro', { r })} />)}</Grupo>
        ) : <p style={{ margin: 6, color: KP.ink2 }}>Todavía no retiras nada.</p>}
      </div>
    );
  }
  if (vista.v === 'listo' || vista.v === 'camino') {
    const lista = libro.filter((r) => lugarDe(r, hoy) === (vista.v === 'listo' ? 'listo' : 'en_camino'));
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: FONT }}>
        <Cabeza titulo={vista.v === 'listo' ? 'Listo para retirar' : 'En camino'} detalle={vista.v === 'listo' ? pesos(s.listo) : pesos(s.enCamino, { aproximado: s.aproximado })} alVolver={atras} />
        {vista.v === 'camino' && <Grupo>
          {s.web.monto > 0 && <Fila izquierda={<IconoDeFila><Globe size={18} /></IconoDeFila>} texto="Ventas en la web" detalle={listoWeb(s.web.fechas)} valor={pesos(s.web.monto)} valorTono="neutro" />}
          {s.apple.monto > 0 && <Fila izquierda={<IconoDeFila><Smartphone size={18} /></IconoDeFila>} texto="Ventas en iPhone" detalle={listoApple(s.apple.fechas)} valor={pesos(s.apple.monto, { aproximado: true })} valorTono="neutro" />}
        </Grupo>}
        {lista.length ? <Grupo>{lista.map((r) => <FilaDeVenta key={r.id} r={r} hoy={hoy} onClick={() => ve('venta', { r })} />)}</Grupo> : <p style={{ margin: 6, color: KP.ink2 }}>Nada por ahora.</p>}
        {vista.v === 'camino' && g.primer_retiro && s.web.monto > 0 && <p style={{ margin: '0 6px', fontSize: 14.5, color: KP.ink2 }}>Tu primer retiro tarda de 7 a 14 días porque el banco revisa tu cuenta una sola vez.</p>}
      </div>
    );
  }
  if (vista.v === 'ventas') {
    const [a, m] = mes.split('-').map(Number);
    const mueve = (n) => { const d = new Date(Date.UTC(a, m - 1 + n, 1)); setMes(d.toISOString().slice(0, 7)); };
    const esteMes = mesDe(new Date().toISOString());
    const todas = vista.todas;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: FONT }}>
        <Cabeza titulo="Ventas" alVolver={atras} />
        <Grupo titulo="Dónde está tu dinero">
          <Fila izquierda={<IconoDeFila><Landmark size={18} /></IconoDeFila>} texto="Retirado" valor={pesos(s.retirado)} valorTono="neutro" onClick={() => ve('retirado')} />
          <Fila izquierda={<IconoDeFila color={KP.mint} fondo={KP.mintSoft}><Check size={18} /></IconoDeFila>} texto="Listo para retirar" valor={pesos(s.listo)} valorTono="neutro" onClick={() => ve('listo')} />
          <Fila izquierda={<IconoDeFila color={KP.ink2} fondo={UI.relleno}><Clock size={18} /></IconoDeFila>} texto="En camino" valor={pesos(s.enCamino, { aproximado: s.aproximado })} valorTono="neutro" onClick={() => ve('camino')} />
          <Fila texto={<b>Desde que empezaste a vender</b>} valor={pesos(s.desdeSiempre)} valorTono="neutro" />
        </Grupo>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button type="button" aria-label="Mes anterior" onClick={() => mueve(-1)} style={{ width: 48, height: 48, borderRadius: 14, border: 'none', background: UI.relleno, cursor: 'pointer', display: 'grid', placeItems: 'center' }}><ChevronLeft size={21} /></button>
          <b style={{ fontSize: 19 }}>{nombreMes[0].toUpperCase() + nombreMes.slice(1)} {a}</b>
          <button type="button" aria-label="Mes siguiente" disabled={mes >= esteMes} onClick={() => mueve(1)} style={{ width: 48, height: 48, borderRadius: 14, border: 'none', background: UI.relleno, cursor: mes >= esteMes ? 'default' : 'pointer', opacity: mes >= esteMes ? 0.4 : 1, display: 'grid', placeItems: 'center' }}><ChevronRight size={21} /></button>
        </div>
        <Grupo titulo={`Ganaste en ${nombreMes}`} accion={<b style={{ fontSize: 17 }}>{pesos(ganadoEnMes(libro, mes))}</b>}>
          {ventasDelMes.length === 0 && <div style={{ padding: '18px 16px', color: KP.ink2 }}>Sin ventas este mes.</div>}
          {(todas ? ventasDelMes : ventasDelMes.slice(0, 3)).map((r) => <FilaDeVenta key={r.id} r={r} hoy={hoy} onClick={() => ve('venta', { r })} />)}
          {!todas && ventasDelMes.length > 3 && <Fila texto={`Ver las ${ventasDelMes.length} ventas de ${nombreMes}`} tono="enlace" onClick={() => setPila((p) => [...p.slice(0, -1), { v: 'ventas', todas: true }])} />}
        </Grupo>
      </div>
    );
  }
  if (vista.v === 'planes' || vista.v === 'plan') {
    const porPlan = new Map();
    libro.filter((r) => r.estado !== 'anulado').forEach((r) => { const k = r.plan_id ?? r.plan; if (!porPlan.has(k)) porPlan.set(k, { id: k, titulo: r.plan ?? 'Plan', n: 0, total: 0, aprox: false, filas: [] }); const x = porPlan.get(k); if (r.tipo !== 'reembolso') x.n += 1; x.total += Number(r.monto); x.aprox ||= r.aproximado; x.filas.push(r); });
    const planes = [...porPlan.values()].sort((x, y) => y.total - x.total);
    if (vista.v === 'plan') {
      const p = planes.find((x) => x.id === vista.id);
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: FONT }}>
          <Cabeza titulo={p?.titulo ?? 'Plan'} detalle={p ? `${p.n} ${p.n === 1 ? 'venta' : 'ventas'} · ${pesos(p.total, { aproximado: p.aprox })}` : undefined} alVolver={atras} />
          {p && <Grupo>{p.filas.map((r) => <FilaDeVenta key={r.id} r={r} hoy={hoy} onClick={() => ve('venta', { r })} />)}</Grupo>}
        </div>
      );
    }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: FONT }}>
        <Cabeza titulo="Planes" alVolver={atras} />
        {planes.length ? <Grupo>{planes.map((p) => <Fila key={p.id} texto={p.titulo} detalle={`${p.n} ${p.n === 1 ? 'venta' : 'ventas'}`} valor={pesos(p.total, { aproximado: p.aprox })} valorTono="neutro" onClick={() => ve('plan', { id: p.id })} />)}</Grupo> : <p style={{ margin: 6, color: KP.ink2 }}>Aún no tienes ventas.</p>}
      </div>
    );
  }
  if (vista.v === 'cuenta') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: FONT }}>
        <Cabeza titulo="Cuenta y retiros" alVolver={atras} />
        <Grupo>
          <Fila izquierda={<IconoDeFila><Landmark size={18} /></IconoDeFila>} texto="Cuenta para retiros" detalle={banco ?? (g.cuenta_stripe ? 'Le faltan datos' : 'Sin conectar')}
            derecha={banco ? <Pastilla tono="ok">Activa</Pastilla> : undefined} onClick={banco ? () => abre('panel') : () => abre('conectar')} />
          {(hayApple || g.spei) && <Fila izquierda={<IconoDeFila><Smartphone size={18} /></IconoDeFila>} texto="CLABE para lo de iPhone" detalle={g.spei?.destino ?? 'Te la pedimos una vez'} onClick={() => ve('clabe')} />}
          <Fila izquierda={<IconoDeFila><ArrowUp size={18} /></IconoDeFila>} texto="Retiros" onClick={() => ve('retirado')} />
          <Fila izquierda={<IconoDeFila><FileText size={18} /></IconoDeFila>} texto="Datos fiscales" onClick={() => abre('panel')} deshabilitada={!g.cuenta_stripe} />
          <Fila izquierda={<IconoDeFila><Percent size={18} /></IconoDeFila>} texto="Lo que tú pagas" onClick={() => ve('pagas')} />
        </Grupo>
      </div>
    );
  }
  if (vista.v === 'pagas') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: FONT }}>
        <Cabeza titulo="Lo que tú pagas" alVolver={atras} />
        <Grupo>
          <Fila texto="Venta en la web" detalle="Training Lab se queda el 20 % del precio." />
          <Fila texto="Venta en iPhone" detalle="Training Lab se queda el 20 % de lo que Apple le paga." />
          <Fila texto="Retirar" valor="Sin costo" valorTono="neutro" />
          {lugares && !lugares.ilimitado && <Fila texto="Tus atletas a mano" detalle="Quien compra un plan tuyo no cuenta" valor={etiquetaDeLugares(lugares)} onClick={() => setVerLugares(true)} />}
        </Grupo>
        {verLugares && <SinLugares lugares={lugares} onCerrar={() => setVerLugares(false)} />}
      </div>
    );
  }
  if (vista.v === 'clabe') return <PideClabe actual={g.spei?.destino} alVolver={atras} alListo={async () => { await lee(); atras(); }} />;
  if (vista.v === 'retirar') return <Retirar g={g} listos={listos} banco={banco} alVolver={atras} alListo={async (x) => { setAviso(x); await lee(); setPila([{ v: 'inicio' }]); }} />;

  /* ---------- La principal ---------- */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: FONT }}>
      {profile?.vitrina_suspendida && <Aviso tono="aviso">Tu vitrina está suspendida: tus planes no se ven ni se venden por ahora. Escríbenos a contacto@traininglabapp.com.</Aviso>}
      {error && <Aviso tono="malo" role="alert">{error}</Aviso>}
      <TarjetaHeroe etiqueta={`Ganaste en ${MESES[new Date().getMonth()]}`} titulo={pesos(ganadoEnMes(libro, mesDe(new Date().toISOString())))} onClick={() => ve('ventas')} />
      {aviso && <div role="status" style={{ display: 'flex', gap: 10, background: KP.mintSoft, color: KP.mint, borderRadius: 16, padding: '14px 16px', fontSize: 16, fontWeight: 700 }}><Check size={20} />Listo. Tus {pesos(aviso.monto)} llegan a tu banco{aviso.llega_estimado ? ` el ${fechaLarga(aviso.llega_estimado).replace(/ de \w+$/, '')} (aprox.)` : ' en unos días'}.</div>}
      {sinVentas ? (
        <Grupo>
          <div style={{ textAlign: 'center', padding: '34px 20px' }}>
            <ShoppingBag size={30} color={KP.ink3} />
            <div style={{ fontSize: 20, fontWeight: 800, marginTop: 10 }}>Aún no tienes ventas</div>
            <div style={{ fontSize: 15.5, color: KP.ink2, marginTop: 6, lineHeight: 1.45 }}>Cuando alguien compre un plan tuyo, aquí verás cuánto ganaste.</div>
          </div>
        </Grupo>
      ) : (
        <>
          <div style={{ background: UI.tarjeta, borderRadius: UI.rTarjeta, boxShadow: UI.sombraGrupo, padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <button type="button" onClick={() => ve('listo')} style={{ display: 'flex', alignItems: 'center', border: 'none', background: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', fontFamily: FONT, color: KP.ink }}>
              <span style={{ flex: 1 }}><span style={{ display: 'block', fontSize: 17, fontWeight: 600 }}>Puedes retirar hoy</span><span style={{ display: 'block', fontSize: 42, fontWeight: 800, letterSpacing: -1, ...NUM_STYLE }}>{pesos(s.listo)}</span></span>
              <ChevronRight size={20} color={KP.ink3} />
            </button>
            {enviado ? (
              <div style={{ display: 'flex', gap: 10, background: KP.blueSoft, color: KP.blue, borderRadius: 14, padding: '12px 14px', fontSize: 15.5, fontWeight: 600, lineHeight: 1.4 }}><Clock size={18} style={{ flexShrink: 0, marginTop: 2 }} />{pesos(enviado.monto)} en camino{enviado.destino ? ` a ${enviado.destino}` : ''}{enviado.llega_estimado ? ` · llega el ${fechaLarga(enviado.llega_estimado).replace(/ de \w+$/, '')} (aprox.)` : ''}</div>
            ) : s.listo > 0 && !banco && listos.some((r) => r.canal === 'web') ? (
              <Boton ancho onClick={() => abre('conectar')}>Conectar mi cuenta de banco</Boton>
            ) : (
              <>
                <Boton ancho deshabilitado={retirable < MINIMO_RETIRO} onClick={() => ve('retirar')}>Retirar</Boton>
                {s.listo > 0 && retirable < MINIMO_RETIRO && <div style={{ textAlign: 'center', fontSize: 15, fontWeight: 600 }}>Te faltan {pesos(MINIMO_RETIRO - retirable)} para el mínimo de {pesos(MINIMO_RETIRO)}.</div>}
              </>
            )}
          </div>
          {fallo && (
            <div role="alert" style={{ background: KP.dangerSoft, color: KP.danger, borderRadius: 16, padding: '14px 16px', fontSize: 15.5, fontWeight: 600, lineHeight: 1.45 }}>
              <div style={{ display: 'flex', gap: 10 }}><AlertCircle size={19} style={{ flexShrink: 0, marginTop: 2 }} />Tu banco rechazó el retiro. El dinero regresó a Listo para retirar.</div>
              <Boton tipo="texto" onClick={() => ve('cuenta')} estilo={{ marginTop: 6 }}>Revisar mi cuenta</Boton>
            </div>
          )}
          {s.enCamino !== 0 && (
            <Grupo titulo="En camino" accion={<b style={{ fontSize: 18, ...NUM_STYLE }}>{pesos(s.enCamino, { aproximado: s.aproximado })}</b>}>
              {s.web.monto > 0 && <Fila izquierda={<IconoDeFila color={KP.ink2} fondo={UI.relleno}><Globe size={18} /></IconoDeFila>} texto="Ventas en la web" detalle={listoWeb(s.web.fechas) || undefined} valor={pesos(s.web.monto)} valorTono="neutro" onClick={() => ve('camino')} />}
              {s.apple.monto > 0 && <Fila izquierda={<IconoDeFila color={KP.ink2} fondo={UI.relleno}><Smartphone size={18} /></IconoDeFila>} texto="Ventas en iPhone" detalle={listoApple(s.apple.fechas) || undefined} valor={pesos(s.apple.monto, { aproximado: true })} valorTono="neutro" onClick={() => ve('camino')} />}
              <Fila texto="¿Por qué tarda?" tono="enlace" onClick={() => ve('como')} />
            </Grupo>
          )}
        </>
      )}
      <Grupo>
        {!sinVentas && <Fila texto="Ventas" onClick={() => ve('ventas')} />}
        {!sinVentas && <Fila texto="Planes" onClick={() => ve('planes')} />}
        <Fila texto="Cuenta y retiros" onClick={() => ve('cuenta')} />
      </Grupo>
    </div>
  );
}

/** «Retirar» (gan-m10): Todo u Otra cantidad, a dónde va y sin costo. Se toman ventas completas, las más viejas primero. */
function Retirar({ g, listos, banco, alVolver, alListo }) {
  const [modo, setModo] = useState('todo');
  const [otra, setOtra] = useState('');
  const [error, setError] = useState(null);
  const [mandando, setMandando] = useState(false);
  const usables = listos.filter((r) => (r.canal === 'web' && banco) || (r.canal === 'apple' && g.envios_spei && g.spei));
  const todo = asignaRetiro(usables, null);
  const pide = modo === 'todo' ? null : Number(otra || 0);
  const sale = asignaRetiro(usables, pide);
  const destinos = [sale.stripe > 0 ? banco : null, sale.spei > 0 ? g.spei?.destino : null].filter(Boolean);
  async function manda() {
    setError(null);
    if (pide !== null && pide < MINIMO_RETIRO) { setError(`El mínimo es ${pesos(MINIMO_RETIRO)}.`); return; }
    setMandando(true);
    try { const r = await retiraDinero(pide); alListo({ monto: r.monto, llega_estimado: r.llega_estimado }); } catch (e) { setError(e.message); setMandando(false); }
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: FONT }}>
      <Cabeza titulo="Retirar" alVolver={alVolver} />
      <Segmentado etiqueta="Cuánto" valor={modo} onCambio={setModo} opciones={[{ valor: 'todo', texto: 'Todo' }, { valor: 'otra', texto: 'Otra cantidad' }]} />
      {modo === 'todo'
        ? <div style={{ background: UI.tarjeta, borderRadius: UI.rGrupo, padding: '12px 16px' }}><div style={{ fontSize: 13.5, fontWeight: 600, color: KP.ink2 }}>Cuánto retiras</div><div style={{ fontSize: 28, fontWeight: 800, ...NUM_STYLE }}>{pesos(todo.total)} <span style={{ fontSize: 15, color: KP.ink3 }}>MXN</span></div></div>
        : <Campo etiqueta="Cuánto retiras" valor={otra} onCambio={(v) => { setOtra(v.replace(/\D/g, '')); setError(null); }} inputMode="numeric" marcador={String(todo.total)} />}
      {modo === 'otra' && pide >= MINIMO_RETIRO && sale.total !== pide && <p style={{ margin: '-6px 6px 0', fontSize: 14.5, color: KP.ink2 }}>Retiras {pesos(sale.total)}: tus ventas más viejas, completas.</p>}
      <Grupo titulo="A dónde va">
        {destinos.map((d) => <Fila key={d} izquierda={<IconoDeFila><Landmark size={18} /></IconoDeFila>} texto={d} />)}
        <Fila izquierda={<IconoDeFila color={KP.ink2} fondo={UI.relleno}><Clock size={18} /></IconoDeFila>} texto="Llega a tu banco en unos días" detalle="Sin costo" />
      </Grupo>
      {error && <div role="alert" style={{ background: KP.dangerSoft, color: KP.danger, borderRadius: 14, padding: '12px 14px', fontSize: 15, fontWeight: 700 }}>{error}</div>}
      <Boton ancho cargando={mandando} deshabilitado={sale.total < MINIMO_RETIRO && modo === 'todo'} onClick={manda}>Retirar {pesos(modo === 'todo' ? todo.total : sale.total)}</Boton>
    </div>
  );
}

/** La CLABE para lo de iPhone: se pide una vez (Stripe no deja leer la cuenta del coach). */
function PideClabe({ actual, alVolver, alListo }) {
  const [clabe, setClabe] = useState('');
  const [titular, setTitular] = useState('');
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const buena = clabeValida(clabe);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontFamily: FONT }}>
      <Cabeza titulo="CLABE para lo de iPhone" detalle={actual ? `Ahora: ${actual}` : undefined} alVolver={alVolver} />
      <p style={{ margin: '0 6px', fontSize: 15, color: KP.ink2, lineHeight: 1.45 }}>Lo que vendes en iPhone te llega por transferencia a esta cuenta.</p>
      <Campo etiqueta="CLABE (18 números)" valor={clabe} onCambio={(v) => { setClabe(v.replace(/\D/g, '').slice(0, 18)); setError(null); }} inputMode="numeric" marcador="002010077777777771" />
      <Campo etiqueta="A nombre de" valor={titular} onCambio={setTitular} marcador="Tu nombre como en el banco" grande={false} />
      {clabe.length === 18 && !buena && <div role="alert" style={{ color: KP.danger, fontWeight: 700, margin: '0 6px' }}>Esa CLABE no es válida. Revísala.</div>}
      {error && <div role="alert" style={{ background: KP.dangerSoft, color: KP.danger, borderRadius: 14, padding: '12px 14px', fontSize: 15, fontWeight: 700 }}>{error}</div>}
      <Boton ancho cargando={guardando} deshabilitado={!buena} onClick={async () => { setGuardando(true); try { await guardaClabe(clabe, titular); await alListo(); } catch (e) { setError(e.message); setGuardando(false); } }}>Guardar</Boton>
    </div>
  );
}
