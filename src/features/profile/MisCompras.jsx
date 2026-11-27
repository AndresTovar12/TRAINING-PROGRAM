import { useCallback, useEffect, useMemo, useState } from 'react';
import { FileText, Info, Loader2, ShoppingBag, Smartphone } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { cancelaMembresia } from '@/lib/miDineroApi';
import { enLaApp } from '@/lib/nativo';
import { avanceDelPlan, diaLargo, hoyLocal } from '@/lib/entradaAlPlan';
import { usePlanOpcional } from '@/contexts/PlanContext';
import { useConfirmacion } from '@/components/Confirmacion';
import { useAviso } from '@/components/AvisoPasajero';
import HojaFlotante from '@/components/HojaFlotante';
import { Avatar, Boton, Fila, Grupo, TarjetaHeroe, BotonEnAzul } from '@/components/ui';
import { Aviso } from '@/features/profile/piezas';
import CuandoEmpiezas from '@/features/tienda/CuandoEmpiezas';
import { FONT, KP } from '@/lib/theme';

/* «MIS PLANES» del atleta (encargo «Compra y dinero», 26 nov 2026; dibujos atl-1 a atl-5 y atl-3-variantes). Antes «Compras».
   Ahora · Tuyos para siempre (pago único: es suyo en la versión que compró; «Volver a empezar») · Mientras pagues (membresías) · Con tu coach · Pagos.
   En la APP no se dice «web», «tarjeta» ni «Visa»: solo «con Apple» si se compró con Apple. Una membresía comprada en la web se cancela aquí («Cancelar membresía»);
   una de Apple, en Ajustes del iPhone (se dice en texto, sin liga). «Volver a empezar» usa la misma pantalla de «¿Cuándo empiezas?»; si hay otro programa en curso,
   los dos siguen activos. */

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const diaMes = (iso) => { const d = new Date(iso); return `${d.getDate()} ${MESES_CORTOS[d.getMonth()]}`; };
const pesos = (n) => `$${Number(n ?? 0).toLocaleString('es-MX')}`;
const conApple = <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Smartphone size={14} /> con Apple</span>;

function Foto({ src }) {
  return <span style={{ width: 52, height: 52, borderRadius: 15, overflow: 'hidden', background: KP.blueSoft, flexShrink: 0, display: 'block' }}>{src && <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}</span>;
}

/** La hoja de un plan: su versión, y según el caso, volver a empezar o la membresía. */
function HojaDePlan({ c, otroEnCurso, onCerrar, onCambio }) {
  const pregunta = useConfirmacion();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [empezar, setEmpezar] = useState(!!c.empezar);
  const membresia = c.tipo === 'membresia';
  const hasta = c.periodo_hasta ? diaLargo(c.periodo_hasta.slice(0, 10)).replace(/^[a-záéíóúñ]+ /, '') : null;
  const fechaHasta = c.periodo_hasta ? `${new Date(c.periodo_hasta).getDate()} de ${MESES_CORTOS[new Date(c.periodo_hasta).getMonth()]}` : null;

  async function cancela() {
    const va = await pregunta({ titulo: '¿Cancelar tu membresía?', detalle: `No se vuelve a cobrar. La tienes hasta el ${fechaHasta ?? 'fin de lo que pagaste'}.`, confirmar: 'Sí, cancelar', peligro: true });
    if (!va) return;
    setBusy(true); setError('');
    try { await cancelaMembresia(c.compra_id); await onCambio(); onCerrar(); } catch (e) { setError(e.message); setBusy(false); }
  }

  if (empezar) {
    return (
      <HojaFlotante titulo="Volver a empezar" subtitulo={`${c.titulo}, tu versión del ${diaMes(c.version_fecha)}.`} onCerrar={onCerrar} ancho={480}>
        <CuandoEmpiezas compraId={c.compra_id} alListo={async () => { await onCambio(); onCerrar(); }} />
        <p style={{ margin: '12px 6px 0', fontSize: 14.5, fontWeight: 500, color: KP.ink2, textAlign: 'center' }}>
          {otroEnCurso ? `${otroEnCurso} sigue igual en «Ahora». ` : ''}Lo que hiciste la vez pasada se queda.
        </p>
      </HojaFlotante>
    );
  }
  return (
    <HojaFlotante titulo={c.titulo} subtitulo={`de ${c.coach?.nombre ?? 'tu coach'} · ${membresia ? 'membresía' : 'pago único'}`} onCerrar={onCerrar} ancho={480}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontFamily: FONT }}>
        <Grupo>
          <Fila texto={`Tu versión: la que compraste el ${diaMes(c.version_fecha)}`} detalle={`Si ${String(c.coach?.nombre ?? 'tu coach').split(' ')[0]} cambia o quita el plan, la tuya se queda igual.`} />
        </Grupo>
        {membresia && (
          <>
            <Grupo>
              <div style={{ padding: '14px 16px' }}>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{pesos(c.precio)} al mes</div>
                <div style={{ fontSize: 15, fontWeight: 500, color: KP.ink2, marginTop: 2 }}>
                  {c.cancelada_en ? <><b style={{ color: KP.amber }}>Cancelada</b> · la tienes hasta el {fechaHasta}</> : <><b style={{ color: KP.mint }}>Activa</b>{hasta ? ` · Se renueva el ${diaLargo(c.periodo_hasta.slice(0, 10))}.` : ''}</>}
                </div>
                {c.canal === 'apple' && <div style={{ fontSize: 15, fontWeight: 500, color: KP.ink2, marginTop: 2 }}>{conApple}</div>}
              </div>
            </Grupo>
            {c.canal === 'apple' ? (
              <>
                {!c.cancelada_en && <div style={{ display: 'flex', gap: 10, background: KP.blueSoft, color: KP.blue, borderRadius: 16, padding: '14px 16px', fontSize: 15.5, fontWeight: 600, lineHeight: 1.45 }}><Info size={19} style={{ flexShrink: 0, marginTop: 2 }} />La pagaste con Apple, así que se cancela en tu iPhone: Ajustes, toca tu nombre y luego Suscripciones.</div>}
                {fechaHasta && <p style={{ margin: 0, textAlign: 'center', fontSize: 14.5, color: KP.ink2 }}>Igual la tienes hasta el {fechaHasta}.</p>}
              </>
            ) : !c.cancelada_en && ['activa', 'gracia'].includes(c.estado) && (
              <>
                <Boton tipo="secundario" ancho cargando={busy} onClick={cancela}>Cancelar membresía</Boton>
                {fechaHasta && <p style={{ margin: 0, textAlign: 'center', fontSize: 14.5, color: KP.ink2 }}>La tienes hasta el {fechaHasta} y ya no se cobra.</p>}
              </>
            )}
          </>
        )}
        {!membresia && ['activa', 'gracia'].includes(c.estado) && <Boton ancho onClick={() => setEmpezar(true)}>Volver a empezar</Boton>}
        {error && <Aviso tono="malo" role="alert">{error}</Aviso>}
      </div>
    </HojaFlotante>
  );
}

function HojaDeHistorial({ pagos, app, onCerrar }) {
  const porMes = useMemo(() => {
    const m = new Map();
    pagos.forEach((p) => { const d = new Date(p.fecha); const k = `${d.getFullYear()}-${d.getMonth()}`; if (!m.has(k)) m.set(k, { mes: MESES[d.getMonth()], lista: [] }); m.get(k).lista.push(p); });
    return [...m.values()];
  }, [pagos]);
  const hayApple = pagos.some((p) => p.canal === 'apple');
  const que = { pago_unico: 'pago único', primer_pago: 'primer pago', renovacion: 'renovación' };
  return (
    <HojaFlotante titulo="Historial y recibos" subtitulo={pagos.length ? `${pagos.length} ${pagos.length === 1 ? 'pago' : 'pagos'} desde ${MESES[new Date(pagos[pagos.length - 1].fecha).getMonth()].toLowerCase()}` : undefined} onCerrar={onCerrar} ancho={500}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: FONT }}>
        {!pagos.length && <p style={{ margin: 6, fontSize: 15, color: KP.ink2 }}>Aquí salen tus pagos.</p>}
        {porMes.map((g, i) => (
          <Grupo key={i} titulo={g.mes} accion={<b style={{ fontSize: 16 }}>{pesos(g.lista.reduce((s, p) => s + Number(p.monto), 0))}</b>} pie={i === 0 && app && hayApple ? 'Los recibos de Apple te llegan de Apple a tu correo.' : undefined}>
            {g.lista.map((p, j) => (
              <Fila key={j} izquierda={<Foto src={p.foto} />} texto={p.titulo}
                detalle={<>{diaMes(p.fecha)} · {que[p.que] ?? ''}{p.canal === 'apple' ? <> · {conApple}</> : null}</>}
                valor={pesos(p.monto)} valorTono="neutro" />
            ))}
          </Grupo>
        ))}
      </div>
    </HojaFlotante>
  );
}

export default function MisCompras({ onContinuar }) {
  const { avisa } = useAviso();
  const { programas = [] } = usePlanOpcional() ?? {};
  const app = enLaApp();
  const hoy = hoyLocal();
  const [lista, setLista] = useState(undefined);
  const [pagos, setPagos] = useState([]);
  const [error, setError] = useState('');
  const [abierta, setAbierta] = useState(null);
  const [verHistorial, setVerHistorial] = useState(false);

  const lee = useCallback(async () => {
    try {
      const [{ data: a, error: e1 }, { data: b, error: e2 }] = await Promise.all([supabase.rpc('mis_planes_comprados'), supabase.rpc('mis_pagos')]);
      if (e1 || e2) throw e1 ?? e2;
      setLista(a ?? []); setPagos((b ?? []).filter((p) => p.estado === 'cobrado')); setError('');
    } catch (e) { setError(e.message || 'No se pudieron leer tus planes.'); setLista([]); }
  }, []);
  useEffect(() => { lee(); }, [lee]);

  if (lista === undefined) return <div style={{ display: 'grid', placeItems: 'center', padding: 30 }}><Loader2 size={22} className="spin" color={KP.ink2} /></div>;
  const conAvance = lista.map((c) => ({ ...c, avance: avanceDelPlan({ inicio: c.inicio, total: c.total, semanaEntrada: c.semana_entrada, tipo: c.tipo, kind: c.kind }, hoy) }));
  const vivos = conAvance.filter((c) => ['activa', 'gracia'].includes(c.estado));
  const unicos = conAvance.filter((c) => c.tipo !== 'membresia' && ['activa', 'gracia'].includes(c.estado));
  const membresias = conAvance.filter((c) => c.tipo === 'membresia' && ['activa', 'gracia', 'vencida'].includes(c.estado));
  const ahora = vivos.find((c) => c.avance.estado === 'en_curso' && c.tipo !== 'membresia') ?? vivos.find((c) => c.avance.estado === 'en_curso');
  const delCoach = programas.filter((p) => !p.comprado);
  const otroEnCurso = (c) => (ahora && ahora.compra_id !== c.compra_id ? ahora.titulo : null);
  const lineaDeUnico = (c) => (c.avance.estado === 'terminado' ? `Terminado el ${diaMes(c.avance.fin)}` : c.avance.estado === 'por_empezar' ? `Empieza el ${diaLargo(c.avance.empieza ?? hoy)}` : `En curso · semana ${c.avance.semana} de ${c.avance.total}`);

  return (
    <>
      {error && <Aviso tono="malo" role="alert">{error}</Aviso>}
      {!lista.length && !delCoach.length && !error && (
        <Grupo>
          <div style={{ textAlign: 'center', padding: '30px 18px', fontFamily: FONT }}>
            <ShoppingBag size={28} color={KP.ink3} />
            <div style={{ fontSize: 17, fontWeight: 800, color: KP.ink, marginTop: 10 }}>Todavía no tienes planes</div>
          </div>
        </Grupo>
      )}
      {ahora && (
        <Grupo titulo="Ahora" estilo={{ background: 'none' }}>
          <TarjetaHeroe
            etiqueta={`de ${ahora.coach?.nombre ?? 'tu coach'}`} titulo={ahora.titulo}
            detalle={ahora.avance.total > 1 ? `Semana ${ahora.avance.semana} de ${ahora.avance.total}${ahora.avance.fin ? ` · termina el ${diaMes(ahora.avance.fin)}` : ''}` : undefined}
            progreso={ahora.avance.total > 1 ? ahora.avance.semana / ahora.avance.total : undefined}
            accion={onContinuar ? <BotonEnAzul onClick={onContinuar}>Continuar</BotonEnAzul> : undefined}
          />
        </Grupo>
      )}
      {unicos.length > 0 && (
        <Grupo titulo="Tuyos para siempre" pie="Los compraste una vez. Son tuyos y los puedes repetir cuando quieras.">
          {unicos.map((c) => (
            <Fila key={c.compra_id} izquierda={<Foto src={c.foto} />} texto={c.titulo} detalle={<>{c.coach?.nombre}<br />{lineaDeUnico(c)}{c.canal === 'apple' && app ? <> · {conApple}</> : null}</>}
              derecha={c.avance.estado === 'terminado' ? <Boton tipo="texto" chico onClick={(e) => { e.stopPropagation(); setAbierta({ ...c, empezar: true }); }}>Volver a empezar</Boton> : undefined}
              onClick={() => setAbierta(c)} />
          ))}
        </Grupo>
      )}
      {membresias.length > 0 && (
        <Grupo titulo="Mientras pagues" pie="Si cancelas, la tienes hasta el fin de lo que pagaste.">
          {membresias.map((c) => (
            <Fila key={c.compra_id} izquierda={<Foto src={c.foto} />} texto={c.titulo} onClick={() => setAbierta(c)}
              detalle={<>{c.coach?.nombre} · {pesos(c.precio)} al mes<br />
                {c.estado === 'vencida' ? <b style={{ color: KP.ink2 }}>Vencida</b> : c.cancelada_en ? <><b style={{ color: KP.amber }}>Cancelada</b> · la tienes hasta el {c.periodo_hasta ? diaMes(c.periodo_hasta) : 'fin del periodo'}</> : <><b style={{ color: KP.mint }}>Activa</b>{c.periodo_hasta ? ` · se renueva el ${diaMes(c.periodo_hasta)}` : ''}</>}
                {c.canal === 'apple' ? <><br />{conApple}</> : null}</>} />
          ))}
        </Grupo>
      )}
      {delCoach.length > 0 && (
        <Grupo titulo="Con tu coach" pie="Tu coach lo ajusta cuando hace falta.">
          {delCoach.map((p) => (
            <Fila key={p.id} izquierda={<Avatar nombre={p.profesional?.full_name || p.title} foto={p.profesional?.avatar_url} tamano={52} />} texto={p.title || 'Tu plan'}
              detalle={p.profesional?.full_name ? `${p.profesional.full_name} te lo arma` : undefined} onClick={onContinuar} />
          ))}
        </Grupo>
      )}
      {(lista.length > 0 || pagos.length > 0) && (
        <Grupo titulo="Pagos">
          {!app && <Fila texto="Tarjeta y recibos" detalle="Los guarda Stripe" onClick={() => avisa('Pronto: aquí cambias tu tarjeta y ves tus recibos')} />}
          <Fila izquierda={<span style={{ width: 44, height: 44, borderRadius: 13, background: KP.blueSoft, color: KP.blue, display: 'grid', placeItems: 'center' }}><FileText size={20} /></span>}
            texto="Historial y recibos" detalle={pagos.length ? `${pagos.length} ${pagos.length === 1 ? 'pago' : 'pagos'} desde ${MESES[new Date(pagos[pagos.length - 1].fecha).getMonth()].toLowerCase()}` : 'Sin pagos todavía'}
            onClick={() => setVerHistorial(true)} />
        </Grupo>
      )}

      {abierta && <HojaDePlan c={abierta} otroEnCurso={otroEnCurso(abierta)} onCerrar={() => setAbierta(null)} onCambio={lee} key={abierta.compra_id + (abierta.empezar ? 'e' : '')} />}
      {verHistorial && <HojaDeHistorial pagos={pagos} app={app} onCerrar={() => setVerHistorial(false)} />}
    </>
  );
}
