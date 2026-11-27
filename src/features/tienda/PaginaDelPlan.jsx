import { useEffect, useState } from 'react';
import { ChevronDown, ChevronLeft, Dumbbell, Loader2, ShieldCheck, Video } from 'lucide-react';
import { FONT, KP, NUM_STYLE, UI } from '@/lib/theme';
import { leePlanPublico } from '@/lib/tiendaApi';
import { leeAjuste } from '@/lib/compraApi';
import { useIsDesktop } from '@/lib/useViewport';
import { duracionTexto } from '@/lib/clases';
import { tieneEntrada, totalDeSemanas } from '@/lib/entradaAlPlan';
import { Avatar, Boton } from '@/components/ui';
import { Aviso, Marco } from './PiezasDeTienda';
import {
  BotonCompartir, EmpiezaAqui, chipsDelPlan, loQueIncluye, oficioConDisciplinas, pesosMXN, primerNombre, textoDeCobro,
} from './piezasDelPlan';

/* LA PÁGINA DEL PLAN (encargo «Compra y dinero», 26 nov 2026; dibujos app-s4, web-2-plan-telefono y web-2-plan-compu). La misma en la app y en la web.
   Foto, promesa, «Para ti si…», chips, qué incluye, «El programa» con las fases cerradas y una línea de qué se trabaja, y el precio una sola vez.
   La semana de entrada YA NO se elige aquí: se elige después de pagar («¿Cuándo empiezas?»). Nunca «unos $X por semana».
   WEB: «Comprar · $500 MXN» o «Suscribirme · $500 MXN al mes», azul.
   APP (regla de Apple): nada lleva a pagar fuera. Con `compra_apple` apagado no hay botón; prendido, «Comprar con Apple» o «Suscribirme con Apple», con borde. */

const semanasTexto = (n) => `${n} ${n === 1 ? 'semana' : 'semanas'}`;

function Fase({ f, desde, color }) {
  const [abierta, setAbierta] = useState(false);
  const semanas = f.weekData ?? [];
  const hasta = desde + semanas.length - 1;
  return (
    <div style={{ borderTop: `1px solid ${UI.hilo}` }} className="fase-del-programa">
      <button
        type="button" onClick={() => setAbierta((a) => !a)} aria-expanded={abierta}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer', fontFamily: FONT, color: KP.ink }}
      >
        <span style={{ width: 10, height: 10, borderRadius: 99, background: f.color || color, flexShrink: 0 }} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 17, fontWeight: 700 }}>{f.name}</span>
          <span style={{ fontSize: 15, fontWeight: 500, color: KP.ink2 }}> · {semanas.length === 1 ? `semana ${desde}` : `semanas ${desde} a ${hasta}`}</span>
          {f.desc && <span style={{ display: 'block', fontSize: 15, fontWeight: 500, color: KP.ink2, marginTop: 2, lineHeight: 1.4 }}>{f.desc}</span>}
        </span>
        <ChevronDown size={20} color={KP.ink3} style={{ transform: abierta ? 'rotate(180deg)' : 'none', transition: 'transform 160ms ease-out', flexShrink: 0 }} />
      </button>
      {abierta && (
        <div style={{ padding: '0 16px 14px 40px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {semanas.map((w, i) => (
            <div key={i} style={{ fontSize: 14.5, lineHeight: 1.45 }}>
              <span style={{ fontWeight: 700 }}>Semana {desde + i}</span>
              <span style={{ color: KP.ink2, fontWeight: 500 }}> · {(w.days ?? []).filter((d) => d.cat !== 'off').map((d) => d.name).filter(Boolean).join(' · ') || 'Descanso'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * `enLaApp`: dentro del iPhone. `alComprar()` (web: abre el pago). `alComprarConApple()` (app con `compra_apple`). `alVerCoach()`, `alVolver()`. `comprando`: el botón gira.
 */
export default function PaginaDelPlan({ usuario, slug, enLaApp = false, alComprar, alComprarConApple, alVerCoach, alVolver, comprando = false, error = null }) {
  const esCompu = useIsDesktop();
  const [plan, setPlan] = useState(undefined);
  const [conApple, setConApple] = useState(false);
  useEffect(() => {
    let vivo = true;
    leePlanPublico(usuario, slug).then((p) => { if (vivo) setPlan(p); }).catch(() => { if (vivo) setPlan(null); });
    if (enLaApp) leeAjuste('compra_apple').then((v) => { if (vivo) setConApple(v); }).catch(() => {});
    return () => { vivo = false; };
  }, [usuario, slug, enLaApp]);

  if (plan === undefined) return <Marco alVolver={alVolver}><div role="status" style={{ display: 'flex', justifyContent: 'center', padding: 48, color: KP.ink2 }}><Loader2 size={22} className="spin" /></div></Marco>;
  if (plan === null) return <Aviso titulo="Este plan ya no está disponible" texto="Puede que su coach lo haya quitado de la venta." boton="Ver al coach" alTocar={alVerCoach ?? alVolver} />;

  const hoja = plan.hoja ?? [];
  const total = totalDeSemanas(hoja);
  const suelto = plan.contenido === 'clase' || plan.contenido === 'workout';
  const membresia = plan.tipo === 'membresia';
  const chips = chipsDelPlan(plan, total);
  const conEntrada = tieneEntrada({ contenido: plan.contenido, kind: plan.kind, fases: hoja });
  const nombre = primerNombre(plan.coach?.nombre);
  const puedeVender = plan.ventas !== false;
  const desdes = hoja.reduce((xs, f, i) => [...xs, i === 0 ? 1 : xs[i - 1] + (hoja[i - 1].weekData ?? []).length], []);

  const botonWeb = (
    <Boton ancho cargando={comprando} deshabilitado={!puedeVender} onClick={alComprar}>
      {!puedeVender ? 'Pronto podrás comprarlo' : membresia ? `Suscribirme · ${pesosMXN(plan.precio)} al mes` : `Comprar · ${pesosMXN(plan.precio)}`}
    </Boton>
  );
  const botonApple = conApple && puedeVender ? ( // estilo-ok: botón con borde (dibujo app-s4: nada de azul lleno para comprar con Apple)
    <Boton tipo="secundario" cargando={comprando} onClick={alComprarConApple} estilo={{ background: UI.tarjeta, border: `1.5px solid ${KP.lineHi}`, boxShadow: 'none', padding: '0 18px' }}>
      {membresia ? 'Suscribirme con Apple' : 'Comprar con Apple'}
    </Boton>
  ) : null;

  const cuerpo = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, paddingBottom: esCompu ? 20 : 120 }}>
      {plan.foto && <img src={plan.foto} alt="" style={{ width: '100%', aspectRatio: esCompu ? '21 / 9' : '16 / 10', objectFit: 'cover', borderRadius: 24, display: 'block' }} />}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Avatar foto={plan.coach?.foto} nombre={plan.coach?.nombre} tamano={52} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 800 }}>{plan.coach?.nombre}</div>
          <div style={{ fontSize: 14.5, fontWeight: 500, color: KP.ink2 }}>{oficioConDisciplinas(plan.coach)}</div>
        </div>
        {alVerCoach && <Boton tipo="texto" chico onClick={alVerCoach}>Ver perfil</Boton>}
      </div>
      <div>
        {plan.recomendado && <div style={{ marginBottom: 8 }}><EmpiezaAqui /></div>}
        <h1 style={{ margin: 0, fontSize: esCompu ? 36 : 30, fontWeight: 800, lineHeight: 1.12, letterSpacing: -0.6, overflowWrap: 'anywhere' }}>{plan.titulo}</h1>
        {plan.objetivo && <div style={{ fontSize: 18, fontWeight: 600, lineHeight: 1.4, marginTop: 10 }}>{plan.objetivo}</div>}
        {plan.para_ti_si && <div style={{ fontSize: 15.5, fontWeight: 500, color: KP.ink2, marginTop: 4 }}>Para ti si {plan.para_ti_si}</div>}
        {!enLaApp && !esCompu && (
          <div style={{ marginTop: 14, display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontSize: 24, fontWeight: 800, ...NUM_STYLE }}>{pesosMXN(plan.precio)}</span>
            <span style={{ fontSize: 16, fontWeight: 500, color: KP.ink2 }}>{membresia ? 'al mes' : `· ${textoDeCobro(plan.tipo)}`}</span>
          </div>
        )}
      </div>
      {chips.length > 0 && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{chips.map((c) => <span key={c} style={{ padding: '8px 14px', borderRadius: 12, background: UI.tarjeta, fontSize: 15, fontWeight: 600 }}>{c}</span>)}</div>}
      {plan.descripcion && <div style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.55, color: KP.ink2, whiteSpace: 'pre-wrap' }}>{plan.descripcion}</div>}

      <section>
        <h2 style={{ margin: '0 4px 10px', fontSize: 21, fontWeight: 800 }}>Incluye</h2>
        <div style={{ background: UI.tarjeta, borderRadius: UI.rGrupo, boxShadow: UI.sombraGrupo, overflow: 'hidden' }}>
          {suelto && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px' }}>
              <span style={{ width: 44, height: 44, borderRadius: 13, background: KP.blueSoft, color: KP.blue, display: 'grid', placeItems: 'center' }}>{plan.contenido === 'clase' ? <Video size={20} /> : <Dumbbell size={20} />}</span>
              <span style={{ fontSize: 17, fontWeight: 600 }}>{plan.contenido === 'clase' ? `Una clase en video${plan.duracion_clase ? ` de ${duracionTexto(plan.duracion_clase)}` : ''}` : 'Un workout completo'}</span>
            </div>
          )}
          {loQueIncluye(plan, plan.coach?.nombre).map(({ id, Icono, texto, detalle, gris }, i) => (
            <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderTop: i || suelto ? `1px solid ${UI.hilo}` : 'none' }}>
              <span style={{ width: 44, height: 44, borderRadius: 13, background: gris ? UI.relleno : KP.blueSoft, color: gris ? KP.ink2 : KP.blue, display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icono size={20} /></span>
              <span><span style={{ display: 'block', fontSize: 17, fontWeight: 600 }}>{texto}</span><span style={{ display: 'block', fontSize: 14.5, fontWeight: 500, color: KP.ink2 }}>{detalle}</span></span>
            </div>
          ))}
        </div>
      </section>

      {hoja.length > 0 && !suelto && (
        <section>
          <h2 style={{ margin: '0 4px 10px', fontSize: 21, fontWeight: 800 }}>{plan.kind === 'weekly' ? 'La rutina' : 'El programa'} {total > 0 && plan.kind !== 'weekly' && <span style={{ color: KP.ink2 }}>· {semanasTexto(total)}</span>}</h2>
          <div style={{ background: UI.tarjeta, borderRadius: UI.rGrupo, boxShadow: UI.sombraGrupo, overflow: 'hidden' }}>
            {hoja.map((f, i) => <Fase key={f.id ?? i} f={f} desde={desdes[i]} color={['#34D399', '#A3E635', '#A78BFA', '#60A5FA', '#F59E0B'][i % 5]} />)}
          </div>
          {conEntrada && <p style={{ margin: '10px 6px 0', fontSize: 14.5, fontWeight: 500, color: KP.ink2, lineHeight: 1.45 }}>¿Tu competencia es antes? Después de comprar pones tu fecha y entras en la semana que te toca.</p>}
        </section>
      )}

      <div style={{ display: 'flex', gap: 10, fontSize: 15, fontWeight: 500, color: KP.ink2, lineHeight: 1.5 }}>
        <ShieldCheck size={20} color={KP.mint} style={{ flexShrink: 0, marginTop: 2 }} />
        {membresia
          ? 'Cancelas cuando quieras: sigues con tu plan hasta el fin del mes que pagaste.'
          : `Es tuyo para siempre. Si ${nombre} cambia el plan, tu versión no cambia. Lo puedes volver a empezar cuando quieras.`}
      </div>
      {error && <div role="alert" style={{ padding: '10px 12px', borderRadius: 12, background: KP.dangerSoft, color: KP.danger, fontSize: 14.5, fontWeight: 700 }}>{error}</div>}
    </div>
  );

  const cabecera = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
      {alVolver && <button type="button" onClick={alVolver} aria-label="Volver" style={{ width: 44, height: 44, borderRadius: 14, border: 'none', background: UI.relleno, display: 'grid', placeItems: 'center', cursor: 'pointer' }}><ChevronLeft size={21} /></button>}
      {!enLaApp && <a href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none', color: KP.ink, fontWeight: 800, fontSize: 17 }}><span style={{ width: 32, height: 32, borderRadius: 10, background: UI.azul, color: '#fff', display: 'grid', placeItems: 'center' }}><Dumbbell size={16} /></span>Training Lab</a>}
      <span style={{ flex: 1 }} />
      <BotonCompartir titulo={plan.titulo} usuario={usuario} slug={slug} />
    </div>
  );

  return (
    <div style={{ minHeight: '100svh', background: UI.fondo, fontFamily: FONT, color: KP.ink }}>
      <div style={{ maxWidth: esCompu ? 1080 : 640, margin: '0 auto', padding: 'calc(14px + env(safe-area-inset-top)) 16px 28px' }}>
        {cabecera}
        {esCompu ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: 28, alignItems: 'start' }}>
            {cuerpo}
            <aside style={{ position: 'sticky', top: 20, background: UI.tarjeta, borderRadius: 24, padding: 22, boxShadow: '0 2px 12px rgba(17,19,24,0.07)', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: -0.8, ...NUM_STYLE }}>{pesosMXN(plan.precio)}</div>
                <div style={{ fontSize: 15, fontWeight: 500, color: KP.ink2 }}>{membresia ? 'al mes · cancelas cuando quieras' : 'pago único · es tuyo para siempre'}</div>
              </div>
              {enLaApp ? botonApple : botonWeb}
            </aside>
          </div>
        ) : cuerpo}
      </div>
      {!esCompu && (
        <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 20, background: 'rgba(242,243,247,0.94)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', borderTop: `1px solid ${UI.hilo}`, padding: '12px 16px calc(12px + env(safe-area-inset-bottom))' }}>
          <div style={{ maxWidth: 640, margin: '0 auto' }}>
            {enLaApp ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 22, fontWeight: 800, ...NUM_STYLE }}>{pesosMXN(plan.precio)}</div>
                  <div style={{ fontSize: 14.5, fontWeight: 500, color: KP.ink2 }}>{textoDeCobro(plan.tipo)}</div>
                </div>
                {botonApple}
              </div>
            ) : botonWeb}
          </div>
        </div>
      )}
    </div>
  );
}
