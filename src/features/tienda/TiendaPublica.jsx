import { useEffect, useState } from 'react';
import { CalendarDays, Check, Dumbbell, Loader2, Mail, MessageCircle, ShieldCheck, Video } from 'lucide-react';
import { LT, FONT, NUM_STYLE } from '@/lib/theme';
import { useAuth } from '@/contexts/AuthContext';
import AuthScreen, { Field } from '@/features/auth/AuthScreen';
import HojaFlotante from '@/components/HojaFlotante';
import { iniciaCompra, leePerfilPublico, leePlanPublico } from '@/lib/tiendaApi';
import { oficioCorto } from '@/lib/theme';
import { chipsDeParaQuien } from '@/lib/paraQuien';
import { esBiblioteca, esSuelto, textoDeContenido } from '@/lib/vitrinaDatos';
import { duracionTexto } from '@/lib/clases';
import { ligaExterna } from '@/lib/videos';
import NavegadorDelPlan from '@/components/NavegadorDelPlan';
import { Aviso, Marco } from './PiezasDeTienda';
import { botonAzul } from './estilosDeTienda';
import CompraLista from './CompraLista';
import { correoValido } from '@/lib/compraLista';
import {
  entradaDeCorrido, primeraEntrada, resumenDeEntrada, semanaSugerida, semanasDeMeses, semanasHastaFecha, totalDeSemanas,
} from '@/lib/entradaAlPlan';

/* LA TIENDA PÚBLICA: la página de un coach y la de cada plan que vende (monetización, 11 oct 2026).

   Se abre con un link (`/@usuario` y `/@usuario/plan`), sin cuenta: lo que sale es lo que el coach quiso enseñar (la ficha y la hoja del programa con los nombres de cada día; el plan,
   jamás). Comprar NO pide cuenta: con sesión de atleta la compra es de su cuenta; sin sesión solo escribe su correo y paga, y la cuenta se le crea al confirmarse el pago (página «Listo»,
   `CompraLista.jsx`). Al volver, el plan ya está en su app. La compra vive en la web a propósito: dentro de la app de iPhone,
   Apple obligaría a cobrar con su sistema y a repartir el dinero a mano. Mismo diseño claro de la app; en el teléfono primero, que es de donde llega el link de Instagram. */

const pesos = (n) => `$${Number(n).toLocaleString('es-MX')}`;
const TIPO = { membresia: 'al mes', pago_unico: 'pago único' };

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
                <span style={{ fontSize: 13.5, fontWeight: 700, color: LT.text2 }}>{[TIPO[p.tipo], textoDeContenido(p)].filter(Boolean).join(' · ')}</span>
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

const semanasTexto = (n) => `${n} ${n === 1 ? 'semana' : 'semanas'}`;

/* El video con que el coach presenta su plan: una liga de YouTube o Vimeo se incrusta; un archivo nuestro se reproduce con los controles de siempre. */
function VideoDelCoach({ url }) {
  const externa = ligaExterna(url);
  const caja = { width: '100%', aspectRatio: '16 / 9', borderRadius: 20, overflow: 'hidden', background: '#0E1015', border: 'none', display: 'block' };
  if (externa?.embed) return <iframe title="Video del plan" src={externa.embed} allow="fullscreen; picture-in-picture" allowFullScreen style={caja} />;
  if (externa) return <a href={externa.abrir} target="_blank" rel="noreferrer" style={{ ...botonAzul(false), textDecoration: 'none' }}>Ver el video</a>;
  return <video src={url} controls playsInline preload="metadata" style={caja} />;
}

/* Cuántos días de entrenamiento trae una semana típica: lo más común entre las semanas de la hoja. */
function diasPorSemana(hoja) {
  const cuentas = new Map();
  (hoja ?? []).forEach((f) => (f.weekData ?? []).forEach((w) => {
    const n = (w.days ?? []).filter((d) => d.cat !== 'off').length;
    cuentas.set(n, (cuentas.get(n) ?? 0) + 1);
  }));
  let mejor = 0;
  let veces = 0;
  cuentas.forEach((v, n) => { if (v > veces && n > 0) { mejor = n; veces = v; } });
  return mejor;
}

const opcionDeTiempo = (activa) => ({
  minHeight: 40, padding: '0 13px', borderRadius: 999, cursor: 'pointer', fontFamily: FONT, fontSize: 13.5, fontWeight: 700,
  border: `1.5px solid ${activa ? LT.blue : LT.border}`, background: activa ? LT.blueSoft : LT.surface, color: activa ? LT.blue : LT.text2, touchAction: 'manipulation',
});

/* «¿Cuánto tiempo tienes?»: ayuda para quien no tiene tiempo de todo el plan. Dice cuántos meses o la fecha de su competencia y le marca en qué semana le conviene entrar para que el programa
   termine cuando se le acaba el tiempo. Puede ignorarla y escoger a mano en la hoja. */
function CuantoTiempoTienes({ fases, alSugerir }) {
  const [modo, setModo] = useState('todo'); // 'todo' | 'meses' | 'fecha'
  const [meses, setMeses] = useState(6);
  const [fecha, setFecha] = useState('');
  const total = totalDeSemanas(fases);
  const disponibles = modo === 'meses' ? semanasDeMeses(meses) : modo === 'fecha' ? semanasHastaFecha(fecha) : 0;
  const sugerida = semanaSugerida(total, disponibles);
  const cambia = (nuevo, m = meses, f = fecha) => {
    setModo(nuevo);
    const d = nuevo === 'meses' ? semanasDeMeses(m) : nuevo === 'fecha' ? semanasHastaFecha(f) : 0;
    alSugerir(semanaSugerida(total, d));
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 14.5, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}><CalendarDays size={17} color={LT.blue} /> ¿Cuánto tiempo tienes?</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" onClick={() => cambia('todo')} aria-pressed={modo === 'todo'} style={opcionDeTiempo(modo === 'todo')}>Todo el plan</button>
        <button type="button" onClick={() => cambia('meses')} aria-pressed={modo === 'meses'} style={opcionDeTiempo(modo === 'meses')}>Unos meses</button>
        <button type="button" onClick={() => cambia('fecha')} aria-pressed={modo === 'fecha'} style={opcionDeTiempo(modo === 'fecha')}>Mi competencia</button>
      </div>
      {modo === 'meses' && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14.5, fontWeight: 700 }}>
          Tengo
          <input
            type="number" inputMode="numeric" min={1} max={36} value={meses} aria-label="Meses que tienes"
            onChange={(e) => { const m = Math.max(1, Math.min(36, Number(e.target.value) || 1)); setMeses(m); cambia('meses', m); }}
            style={{ width: 72, minHeight: 44, borderRadius: 12, border: `1.5px solid ${LT.border}`, padding: '0 10px', fontFamily: FONT, fontSize: 16, fontWeight: 800, textAlign: 'center', background: LT.surface }}
          />
          {meses === 1 ? 'mes' : 'meses'}
        </label>
      )}
      {modo === 'fecha' && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14.5, fontWeight: 700, flexWrap: 'wrap' }}>
          Es el
          <input
            type="date" value={fecha} aria-label="Fecha de tu competencia"
            onChange={(e) => { setFecha(e.target.value); cambia('fecha', meses, e.target.value); }}
            style={{ minHeight: 44, borderRadius: 12, border: `1.5px solid ${LT.border}`, padding: '0 10px', fontFamily: FONT, fontSize: 16, fontWeight: 700, background: LT.surface }}
          />
        </label>
      )}
      {modo !== 'todo' && disponibles > 0 && (
        <div style={{ fontSize: 14, fontWeight: 600, color: LT.text2, lineHeight: 1.45 }}>
          {sugerida === 1
            ? `Te alcanza para todo el plan (${semanasTexto(total)}). Empiezas en la semana 1.`
            : `Para terminar a tiempo te conviene entrar en la semana ${sugerida} de ${total}. Ya te la marcamos; puedes escoger otra.`}
        </div>
      )}
    </div>
  );
}

function PaginaDelPlan({ usuario, slug, alVolver }) {
  const { loading, user, profile } = useAuth();
  const [plan, setPlan] = useState(undefined);
  const [entrada, setEntrada] = useState(null); // { faseId, semana }: dónde empieza quien compra
  const [claveDeHoja, setClaveDeHoja] = useState(0); // al sugerir una semana, la hoja se vuelve a abrir en ella
  const [entrando, setEntrando] = useState(false);
  const [avisoDeEntrada, setAvisoDeEntrada] = useState(null); // por qué se le pide entrar (por defecto, para comprar con su cuenta)
  const [pideCorreo, setPideCorreo] = useState(false);        // la hoja donde quien no tiene cuenta escribe su correo
  const [correo, setCorreo] = useState('');
  const [comprando, setComprando] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let vivo = true;
    leePlanPublico(usuario, slug)
      .then((p) => { if (vivo) { setPlan(p); setEntrada(primeraEntrada(p?.hoja)); } })
      .catch(() => { if (vivo) setPlan(null); });
    return () => { vivo = false; };
  }, [usuario, slug]);

  // Se entra a la cuenta en esta misma página y, al volver, la compra sigue donde iba.
  if (entrando && !user) return <AuthScreen onVolver={() => { setEntrando(false); setAvisoDeEntrada(null); }} aviso={avisoDeEntrada ?? 'Entra a tu cuenta de atleta para comprar este plan.'} />;
  if (plan === undefined) return <Marco alVolver={alVolver}><div role="status" style={{ display: 'flex', justifyContent: 'center', padding: 48, color: LT.text2 }}><Loader2 size={22} className="spin" /></div></Marco>;
  if (plan === null) return <Aviso titulo="Este plan ya no está disponible" texto="Puede que su coach lo haya retirado." boton="Ver al coach" alTocar={alVolver} />;

  const hoja = plan.hoja ?? [];
  const semanal = plan.kind === 'weekly';
  const suelto = esSuelto(plan.contenido); // un workout o una clase: no hay semanas ni hoja que enseñar, solo qué trae
  const biblioteca = esBiblioteca(plan.contenido); // «todas mis clases»: se enseña cuántas y cuáles hay hoy (solo nombre y duración)
  const clases = Array.isArray(plan.clases) ? plan.clases : [];
  const total = totalDeSemanas(hoja);
  const resumen = !semanal && entrada ? resumenDeEntrada(hoja, entrada.faseId, entrada.semana) : null;
  const dias = diasPorSemana(hoja);
  const esCoach = profile?.role === 'admin';
  const sugiere = (n) => { setEntrada(entradaDeCorrido(hoja, n)); setClaveDeHoja((c) => c + 1); };
  // Con sesión, la compra es de su cuenta. Sin sesión se le pide solo su correo (`correoDeInvitado`) y la cuenta se le crea al confirmarse el pago.
  const empieza = async (correoDeInvitado = null) => {
    setComprando(true);
    setError(null);
    try {
      window.location.assign(await iniciaCompra({ usuario, slug, faseDeEntrada: entrada?.faseId ?? null, semanaDeEntrada: entrada?.semana ?? null, correo: correoDeInvitado }));
    } catch (e) {
      if (e?.codigo === 'tiene_cuenta') { setPideCorreo(false); setAvisoDeEntrada(e.message); setEntrando(true); } // ese correo ya tiene cuenta: que entre y la compra queda en ella
      else setError(e?.message ?? 'No se pudo empezar la compra.');
      setComprando(false);
    }
  };
  const compra = () => {
    if (esCoach) { setError('Para comprar necesitas una cuenta de atleta.'); return; }
    if (!user) { setError(null); setPideCorreo(true); return; }
    empieza();
  };
  const enviaCorreo = (e) => {
    e.preventDefault();
    if (!correoValido(correo)) { setError('Escribe un correo válido.'); return; }
    empieza(correo.trim());
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
        {plan.video && <VideoDelCoach url={plan.video} />}
        {plan.descripcion && <div style={{ fontSize: 15.5, fontWeight: 500, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{plan.descripcion}</div>}
        {(plan.para_quien || plan.objetivo) && (
          <Bloque titulo="Objetivo">
            {plan.para_quien && <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.45 }}>{plan.para_quien}</div>}
            {plan.objetivo && <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.45 }}>{plan.objetivo}</div>}
          </Bloque>
        )}

        {suelto && (
          <Bloque titulo="Incluye">
            {plan.contenido === 'clase'
              ? <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15, fontWeight: 700 }}><Video size={18} color={LT.blue} /> Una clase en video{plan.duracion_clase ? ` de ${duracionTexto(plan.duracion_clase)}` : ''}</div>
              : <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15, fontWeight: 700 }}><Dumbbell size={18} color={LT.blue} /> {plan.sesiones > 1 ? `${plan.sesiones} sesiones de entrenamiento` : 'Un workout completo'}</div>}
          </Bloque>
        )}

        {biblioteca && (
          <Bloque titulo="Incluye">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15, fontWeight: 700 }}><Video size={18} color={LT.blue} /> {clases.length === 1 ? 'Una clase en video' : `${clases.length} clases en video`}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15, fontWeight: 700 }}><Check size={18} color={LT.blue} /> Las clases nuevas se suman solas</div>
          </Bloque>
        )}
        {biblioteca && clases.length > 0 && (
          <Bloque titulo="Las clases">
            {clases.slice(0, 12).map((c, i) => (
              <div key={`${c.nombre}-${i}`} style={{ display: 'flex', alignItems: 'baseline', gap: 10, fontSize: 15, fontWeight: 600 }}>
                <span style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{c.nombre}</span>
                {c.duracion ? <span style={{ color: LT.text2, fontWeight: 700, whiteSpace: 'nowrap', ...NUM_STYLE }}>{duracionTexto(c.duracion)}</span> : null}
              </div>
            ))}
            {clases.length > 12 && <div style={{ fontSize: 14, fontWeight: 700, color: LT.text2 }}>y {clases.length - 12} más</div>}
          </Bloque>
        )}

        {!suelto && !biblioteca && (plan.chat || plan.tecnica || total > 0) && (
          <Bloque titulo="Incluye">
            {total > 0 && !semanal && <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15, fontWeight: 700 }}><CalendarDays size={18} color={LT.blue} /> {semanasTexto(total)} de entrenamiento{dias ? `, ${dias} ${dias === 1 ? 'día' : 'días'} por semana` : ''}</div>}
            {total > 0 && semanal && dias > 0 && <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15, fontWeight: 700 }}><CalendarDays size={18} color={LT.blue} /> Una rutina de {dias} {dias === 1 ? 'día' : 'días'} por semana que se repite</div>}
            {plan.chat && <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15, fontWeight: 700 }}><MessageCircle size={18} color={LT.blue} /> Chat con tu coach</div>}
            {plan.tecnica && <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15, fontWeight: 700 }}><Video size={18} color={LT.blue} /> Revisión de tu técnica por video</div>}
          </Bloque>
        )}

        {/* La hoja del programa, igual a la que ve el atleta, SIN ejercicios: fases, semanas y el nombre de la sesión de cada día. Quien compra toca la semana donde empieza. */}
        {hoja.length > 0 && !suelto && (
          <Bloque titulo={semanal ? 'La rutina' : `El programa · ${semanasTexto(total)}`}>
            {!semanal && total > 1 && <CuantoTiempoTienes fases={hoja} alSugerir={sugiere} />}
            {resumen && (
              <div style={{ fontSize: 14.5, fontWeight: 800, color: LT.blue, lineHeight: 1.4 }}>
                {resumen.desdeElPrincipio
                  ? `Empiezas en la semana 1 y haces las ${resumen.total}.`
                  : `Empiezas en la semana ${resumen.semana} de ${resumen.total} (mes ${resumen.mes} de ${resumen.meses}) y te quedan ${semanasTexto(resumen.restantes)}.`}
              </div>
            )}
            {!semanal && total > 1 && <div style={{ fontSize: 13.5, fontWeight: 600, color: LT.text2 }}>Toca la semana donde quieres empezar.</div>}
            <NavegadorDelPlan
              key={claveDeHoja} fases={hoja} kind={plan.kind} estructura={plan.estructura} quien="tu"
              {...(!semanal && entrada ? { entrada: { ...entrada, alElegir: (faseId, semana) => setEntrada({ faseId, semana }) }, abrirEn: { faseId: entrada.faseId, semana: entrada.semana } } : null)}
            />
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
          {error && !pideCorreo && <div role="alert" style={{ padding: '9px 12px', borderRadius: 12, background: '#FDECEC', color: LT.danger, fontSize: 14, fontWeight: 700 }}>{error}</div>}
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

      {pideCorreo && !user && (
        <HojaFlotante titulo="Comprar" subtitulo={`${plan.titulo} · ${pesos(plan.precio)} ${TIPO[plan.tipo] ?? ''}`} onCerrar={() => { setPideCorreo(false); setError(null); }} ancho={460}>
          <form onSubmit={enviaCorreo} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 6 }}>
            <Field icon={Mail} label="Tu correo" type="email" inputMode="email" autoComplete="email" autoFocus placeholder="tu@correo.com" value={correo} onChange={(e) => { setCorreo(e.target.value); setError(null); }} />
            <div style={{ fontSize: 14, fontWeight: 600, color: LT.text2, lineHeight: 1.45 }}>Con este correo entras a tu plan. Tu cuenta se crea al pagar.</div>
            {error && <div role="alert" style={{ padding: '9px 12px', borderRadius: 12, background: '#FDECEC', color: LT.danger, fontSize: 14, fontWeight: 700 }}>{error}</div>}
            <button type="submit" disabled={comprando} style={botonAzul(comprando)}>
              {comprando ? <Loader2 size={20} className="spin" /> : null}
              Continuar al pago
            </button>
            <button type="button" onClick={() => { setPideCorreo(false); setEntrando(true); }} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: FONT, fontSize: 15, fontWeight: 700, color: LT.blue, padding: '8px 4px' }}>
              ¿Ya tienes cuenta? Entrar
            </button>
          </form>
        </HojaFlotante>
      )}
    </Marco>
  );
}

/* ------------------------------ Al volver del pago ------------------------------ */

// «Cancelar» en la página de pago regresa a la página del plan; esta pantalla solo la usan las ligas viejas de `/compra/cancelada`.
function Cancelada() {
  return <Aviso titulo="No se hizo ningún cobro" texto="Cancelaste el pago. Cuando quieras, vuelve a intentarlo desde la página del plan." boton="Ir a Training Lab" alTocar={() => { window.location.assign('/'); }} />;
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

  if (ruta.tipo === 'lista') return <CompraLista />;
  if (ruta.tipo === 'cancelada') return <Cancelada />;
  return slug ? <PaginaDelPlan usuario={ruta.usuario} slug={slug} alVolver={vuelve} /> : <PaginaDelCoach usuario={ruta.usuario} alElegir={abrePlan} />;
}
