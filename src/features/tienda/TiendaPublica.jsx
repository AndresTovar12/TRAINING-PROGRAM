import { useEffect, useState } from 'react';
import { ArrowLeft, Check, Dumbbell, Loader2, MessageCircle, ShieldCheck, Video } from 'lucide-react';
import { LT, FONT, DAY_FULL, NUM_STYLE } from '@/lib/theme';
import { useAuth } from '@/contexts/AuthContext';
import AuthScreen from '@/features/auth/AuthScreen';
import { iniciaCompra, leePerfilPublico, leePlanPublico } from '@/lib/tiendaApi';
import { oficioCorto } from '@/lib/theme';
import { chipsDeParaQuien } from '@/lib/paraQuien';

/* LA TIENDA PÚBLICA: la página de un coach y la de cada plan que vende (monetización, 11 oct 2026).

   Se abre con un link (`/@usuario` y `/@usuario/plan`), sin cuenta: lo que sale es lo que el coach quiso enseñar (la ficha, los nombres de las fases y UNA semana de muestra; el plan,
   jamás). Comprar pide cuenta de atleta y manda a la página de pago de Stripe; al volver, el plan ya está en su app. La compra vive en la web a propósito: dentro de la app de iPhone,
   Apple obligaría a cobrar con su sistema y a repartir el dinero a mano. Mismo diseño claro de la app; en el teléfono primero, que es de donde llega el link de Instagram. */

const pesos = (n) => `$${Number(n).toLocaleString('es-MX')}`;
const TIPO = { membresia: 'al mes', pago_unico: 'pago único' };

function Marco({ children, alVolver }) {
  return (
    <div style={{ minHeight: '100svh', background: LT.bg, fontFamily: FONT, color: LT.text }}>
      <div style={{ maxWidth: 640, margin: '0 auto', padding: 'calc(14px + env(safe-area-inset-top)) 16px calc(28px + env(safe-area-inset-bottom))' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 40, marginBottom: 14 }}>
          {alVolver && (
            <button
              type="button" onClick={alVolver} aria-label="Volver"
              style={{ width: 40, height: 40, borderRadius: 13, border: 'none', background: LT.surface, color: LT.text, display: 'grid', placeItems: 'center', cursor: 'pointer', boxShadow: '0 1px 3px rgba(17,19,24,0.08)' }}
            >
              <ArrowLeft size={20} />
            </button>
          )}
          <a href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none', color: LT.text, fontWeight: 800, fontSize: 15 }}>
            <span style={{ width: 28, height: 28, borderRadius: 9, background: LT.blue, color: '#fff', display: 'grid', placeItems: 'center' }}><Dumbbell size={16} /></span>
            Training Lab
          </a>
        </div>
        {children}
      </div>
    </div>
  );
}

const Aviso = ({ titulo, texto, boton, alTocar }) => (
  <Marco>
    <div style={{ background: LT.surface, borderRadius: 20, padding: '36px 22px', textAlign: 'center', boxShadow: '0 1px 4px rgba(17,19,24,0.06)' }}>
      <div style={{ fontSize: 20, fontWeight: 800 }}>{titulo}</div>
      {texto && <div style={{ fontSize: 15, fontWeight: 600, color: LT.text2, lineHeight: 1.5, margin: '8px auto 0', maxWidth: 360 }}>{texto}</div>}
      {boton && (
        <button type="button" onClick={alTocar} style={{ ...botonAzul(false), marginTop: 20, width: 'auto', padding: '0 24px' }}>{boton}</button>
      )}
    </div>
  </Marco>
);

const botonAzul = (apagado) => ({
  width: '100%', minHeight: 54, borderRadius: 16, border: 'none', cursor: apagado ? 'default' : 'pointer', fontFamily: FONT, fontSize: 16.5, fontWeight: 800, color: '#fff',
  background: `linear-gradient(135deg, ${LT.blue}, ${LT.blueDk})`, boxShadow: '0 6px 16px rgba(30,64,224,0.28)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 9,
  opacity: apagado ? 0.6 : 1, touchAction: 'manipulation',
});

const Avatar = ({ foto, nombre, tam = 56 }) => (
  <span style={{ width: tam, height: tam, borderRadius: tam * 0.34, overflow: 'hidden', background: LT.blueSoft, color: LT.blue, display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: tam * 0.38, flexShrink: 0 }}>
    {foto ? <img src={foto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : String(nombre ?? '?').trim().slice(0, 1).toUpperCase()}
  </span>
);

function CabezaDelCoach({ coach }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <Avatar foto={coach.foto} nombre={coach.nombre} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 19, fontWeight: 800, lineHeight: 1.2, overflowWrap: 'anywhere' }}>{coach.nombre}</div>
        {oficioCorto(coach.profesion) && <div style={{ fontSize: 14, fontWeight: 700, color: LT.blue, marginTop: 2 }}>{oficioCorto(coach.profesion)}</div>}
      </div>
    </div>
  );
}

/* ------------------------------ La página de un coach ------------------------------ */

function PaginaDelCoach({ usuario, alElegir }) {
  const [datos, setDatos] = useState(undefined); // undefined = cargando · null = no existe
  useEffect(() => {
    let vivo = true;
    leePerfilPublico(usuario).then((d) => { if (vivo) setDatos(d); }).catch(() => { if (vivo) setDatos(null); });
    return () => { vivo = false; };
  }, [usuario]);

  if (datos === undefined) return <Marco><div role="status" style={{ display: 'flex', justifyContent: 'center', padding: 48, color: LT.text2 }}><Loader2 size={22} className="spin" /></div></Marco>;
  if (datos === null) return <Aviso titulo="Esta página no existe" texto="Revisa la liga que te mandaron." boton="Ir a Training Lab" alTocar={() => { window.location.assign('/'); }} />;
  return (
    <Marco>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <CabezaDelCoach coach={datos} />
        {datos.bio && <div style={{ fontSize: 15.5, fontWeight: 500, lineHeight: 1.5, color: LT.text, whiteSpace: 'pre-wrap' }}>{datos.bio}</div>}
        <div style={{ fontSize: 13, fontWeight: 800, color: LT.text3, textTransform: 'uppercase', letterSpacing: 0.7, marginTop: 6 }}>Planes</div>
        {datos.planes.map((p) => (
          <button
            key={p.slug} type="button" onClick={() => alElegir(p.slug)}
            style={{ display: 'flex', flexDirection: 'column', gap: 10, textAlign: 'left', width: '100%', padding: 0, border: 'none', borderRadius: 20, background: LT.surface, cursor: 'pointer', overflow: 'hidden', fontFamily: FONT, boxShadow: '0 1px 4px rgba(17,19,24,0.06)' }}
          >
            {p.foto && <img src={p.foto} alt="" style={{ width: '100%', height: 150, objectFit: 'cover' }} />}
            <div style={{ padding: p.foto ? '0 16px 16px' : 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.25 }}>{p.titulo}</div>
              {p.descripcion && <div style={{ fontSize: 14, fontWeight: 500, color: LT.text2, lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.descripcion}</div>}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4, ...NUM_STYLE }}>
                <span style={{ fontSize: 20, fontWeight: 800, color: LT.blue }}>{pesos(p.precio)}</span>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: LT.text2 }}>{TIPO[p.tipo] ?? ''}{p.semanas ? ` · ${p.semanas} ${p.semanas === 1 ? 'semana' : 'semanas'}` : ''}</span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </Marco>
  );
}

/* ------------------------------ La página de un plan ------------------------------ */

const Chip = ({ children }) => <span style={{ padding: '5px 11px', borderRadius: 999, background: LT.blueSoft, color: LT.blue, fontSize: 13, fontWeight: 800 }}>{children}</span>;
const Bloque = ({ titulo, children }) => (
  <div style={{ background: LT.surface, borderRadius: 20, padding: 16, boxShadow: '0 1px 4px rgba(17,19,24,0.06)', display: 'flex', flexDirection: 'column', gap: 10 }}>
    <div style={{ fontSize: 12.5, fontWeight: 800, color: LT.text3, textTransform: 'uppercase', letterSpacing: 0.7 }}>{titulo}</div>
    {children}
  </div>
);

function SemanaDeMuestra({ semana }) {
  const dias = Array.isArray(semana?.days) ? semana.days : [];
  if (!dias.length) return null;
  return (
    <Bloque titulo="Una semana de muestra">
      {dias.map((d, i) => {
        const ejercicios = (Array.isArray(d.exercises) ? d.exercises : []).filter((e) => !e?.isNote && e?.name);
        const descanso = d.cat === 'off' || ejercicios.length === 0;
        return (
          <div key={`${d.day}-${i}`} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <span style={{ width: 78, flexShrink: 0, fontSize: 13.5, fontWeight: 800, color: LT.text2 }}>{DAY_FULL[d.day] ?? d.day}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              {descanso ? (
                <span style={{ fontSize: 14.5, fontWeight: 600, color: LT.text3 }}>Descanso</span>
              ) : (
                <>
                  {d.name && <div style={{ fontSize: 14.5, fontWeight: 800 }}>{d.name}</div>}
                  <div style={{ fontSize: 13.5, fontWeight: 500, color: LT.text2, lineHeight: 1.45 }}>
                    {ejercicios.slice(0, 5).map((e) => e.name).join(' · ')}{ejercicios.length > 5 ? ` · y ${ejercicios.length - 5} más` : ''}
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })}
    </Bloque>
  );
}

function PaginaDelPlan({ usuario, slug, alVolver }) {
  const { loading, user, profile } = useAuth();
  const [plan, setPlan] = useState(undefined);
  const [fase, setFase] = useState(null);
  const [entrando, setEntrando] = useState(false);
  const [comprando, setComprando] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let vivo = true;
    leePlanPublico(usuario, slug)
      .then((p) => { if (vivo) { setPlan(p); setFase(p?.fases?.find((f) => f.entrada)?.id ?? null); } })
      .catch(() => { if (vivo) setPlan(null); });
    return () => { vivo = false; };
  }, [usuario, slug]);

  // Se entra a la cuenta en esta misma página y, al volver, la compra sigue donde iba.
  if (entrando && !user) return <AuthScreen aviso="Entra o crea tu cuenta de atleta para comprar este plan." />;
  if (plan === undefined) return <Marco alVolver={alVolver}><div role="status" style={{ display: 'flex', justifyContent: 'center', padding: 48, color: LT.text2 }}><Loader2 size={22} className="spin" /></div></Marco>;
  if (plan === null) return <Aviso titulo="Este plan ya no está disponible" texto="Puede que su coach lo haya retirado." boton="Ver al coach" alTocar={alVolver} />;

  const entradas = plan.fases.filter((f) => f.entrada);
  const esCoach = profile?.role === 'admin';
  const compra = async () => {
    if (!user) { setEntrando(true); return; }
    if (esCoach) { setError('Para comprar necesitas una cuenta de atleta.'); return; }
    setComprando(true);
    setError(null);
    try {
      window.location.assign(await iniciaCompra({ usuario, slug, faseDeEntrada: fase }));
    } catch (e) {
      setError(e?.message ?? 'No se pudo empezar la compra.');
      setComprando(false);
    }
  };

  return (
    <Marco alVolver={alVolver}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 96 }}>
        {plan.foto && <img src={plan.foto} alt="" style={{ width: '100%', maxHeight: 260, objectFit: 'cover', borderRadius: 20 }} />}
        <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.15, letterSpacing: -0.4, overflowWrap: 'anywhere' }}>{plan.titulo}</div>
        <CabezaDelCoach coach={plan.coach} />
        {(plan.nivel || chipsDeParaQuien(plan).length > 0) && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {plan.nivel && <Chip>{{ principiante: 'Principiante', intermedio: 'Intermedio', avanzado: 'Avanzado', todos: 'Todos los niveles' }[plan.nivel] ?? plan.nivel}</Chip>}
            {chipsDeParaQuien(plan).map((c) => <Chip key={c}>{c}</Chip>)}
          </div>
        )}
        {plan.descripcion && <div style={{ fontSize: 15.5, fontWeight: 500, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{plan.descripcion}</div>}
        {(plan.para_quien || plan.objetivo) && (
          <Bloque titulo="Para quién es">
            {plan.para_quien && <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.45 }}>{plan.para_quien}</div>}
            {plan.objetivo && <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.45 }}><span style={{ color: LT.text2 }}>Objetivo: </span>{plan.objetivo}</div>}
          </Bloque>
        )}

        {plan.kind !== 'weekly' && plan.fases.length > 0 && (
          <Bloque titulo={`El plan · ${plan.fases.reduce((s, f) => s + f.semanas, 0)} semanas`}>
            {plan.fases.map((f) => (
              <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 700 }}>{f.nombre}</span>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: LT.text2, ...NUM_STYLE }}>{f.semanas} sem</span>
              </div>
            ))}
          </Bloque>
        )}

        <SemanaDeMuestra semana={plan.muestra} />

        {(plan.chat || plan.tecnica) && (
          <Bloque titulo="Incluye">
            {plan.chat && <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15, fontWeight: 700 }}><MessageCircle size={18} color={LT.blue} /> Chat con tu coach</div>}
            {plan.tecnica && <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15, fontWeight: 700 }}><Video size={18} color={LT.blue} /> Revisión de tu técnica por video</div>}
          </Bloque>
        )}

        {plan.kind !== 'weekly' && entradas.length > 1 && (
          <Bloque titulo="¿Por dónde empiezas?">
            {entradas.map((f) => {
              const marcada = fase === f.id;
              return (
                <button
                  key={f.id} type="button" role="radio" aria-checked={marcada} onClick={() => setFase(f.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 48, padding: '0 14px', borderRadius: 14, cursor: 'pointer', textAlign: 'left', fontFamily: FONT, fontSize: 15, fontWeight: 700, color: LT.text, border: `2px solid ${marcada ? LT.blue : LT.border}`, background: marcada ? LT.blueSoft : LT.surface }}
                >
                  <span style={{ width: 20, height: 20, borderRadius: 10, border: `2px solid ${marcada ? LT.blue : LT.borderHi}`, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                    {marcada && <span style={{ width: 10, height: 10, borderRadius: 5, background: LT.blue }} />}
                  </span>
                  {f.nombre}
                </button>
              );
            })}
          </Bloque>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, fontWeight: 600, color: LT.text2, lineHeight: 1.4 }}>
          <ShieldCheck size={20} color={LT.mint} style={{ flexShrink: 0 }} /> Si no es para ti, en los primeros 7 días te devolvemos tu dinero.
        </div>
      </div>

      <div
        style={{
          position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 20, background: 'rgba(244,245,248,0.94)', backdropFilter: 'blur(10px)', borderTop: `1px solid ${LT.border}`,
          padding: '12px 16px calc(12px + env(safe-area-inset-bottom))',
        }}
      >
        <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {error && <div role="alert" style={{ padding: '9px 12px', borderRadius: 12, background: '#FDECEC', color: LT.danger, fontSize: 14, fontWeight: 700 }}>{error}</div>}
          {plan.ventas === false ? (
            // Mientras Stripe no esté conectado (o este coach no tenga su cuenta de cobro lista) se puede ver y compartir, pero no comprar.
            <button type="button" disabled style={botonAzul(true)}>Pronto podrás comprarlo · {pesos(plan.precio)} {TIPO[plan.tipo] ?? ''}</button>
          ) : (
            <button type="button" onClick={compra} disabled={comprando || loading} style={botonAzul(comprando || loading)}>
              {comprando ? <Loader2 size={20} className="spin" /> : <Check size={20} strokeWidth={3} />}
              Comprar · {pesos(plan.precio)} {TIPO[plan.tipo] ?? ''}
            </button>
          )}
        </div>
      </div>
    </Marco>
  );
}

/* ------------------------------ Al volver del pago ------------------------------ */

function AlVolver({ tipo }) {
  const abre = () => { window.location.assign('/'); };
  if (tipo === 'cancelada') return <Aviso titulo="No se hizo ningún cobro" texto="Cancelaste el pago. Cuando quieras, vuelve a intentarlo desde la página del plan." boton="Ir a mi app" alTocar={abre} />;
  return <Aviso titulo="Listo, ya es tuyo" texto="Tu plan ya está en tu app. Si no lo ves de inmediato, espera unos segundos y vuelve a abrirla." boton="Abrir mi app" alTocar={abre} />;
}

/* ------------------------------ La ruta ------------------------------ */

/** `ruta`: lo que devuelve `rutaDeTienda`. */
export default function TiendaPublica({ ruta }) {
  const [slug, setSlug] = useState(ruta.slug);
  // Entre la página del coach y la del plan se camina por dentro (sin recargar), y la barra de direcciones se acomoda.
  const abrePlan = (nuevo) => {
    window.history.pushState({}, '', `/@${ruta.usuario}/${nuevo}`);
    setSlug(nuevo);
    window.scrollTo(0, 0);
  };
  const vuelve = () => {
    window.history.pushState({}, '', `/@${ruta.usuario}`);
    setSlug(null);
    window.scrollTo(0, 0);
  };
  useEffect(() => {
    const alRetroceder = () => {
      const m = window.location.pathname.match(/^\/@[a-z0-9_]+\/([a-z0-9-]+)\/?$/i);
      setSlug(m ? m[1].toLowerCase() : null);
    };
    window.addEventListener('popstate', alRetroceder);
    return () => window.removeEventListener('popstate', alRetroceder);
  }, []);

  if (ruta.tipo === 'lista' || ruta.tipo === 'cancelada') return <AlVolver tipo={ruta.tipo} />;
  return slug ? <PaginaDelPlan usuario={ruta.usuario} slug={slug} alVolver={vuelve} /> : <PaginaDelCoach usuario={ruta.usuario} alElegir={abrePlan} />;
}
