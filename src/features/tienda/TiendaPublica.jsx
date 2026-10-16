import { useEffect, useState } from 'react';
import { CalendarDays, Check, Dumbbell, Loader2, Mail, MessageCircle, ShieldCheck, Video } from 'lucide-react';
import { LT, FONT, NUM_STYLE, UI } from '@/lib/theme';
import { Avatar, Boton, BotonElegir, BotonEnAzul, Pastilla, Segmentado } from '@/components/ui';
import TarjetaDePlan from '@/features/explorar/TarjetaDePlan';
import { useAuth } from '@/contexts/AuthContext';
import AuthScreen, { Field } from '@/features/auth/AuthScreen';
import HojaFlotante from '@/components/HojaFlotante';
import { iniciaCompra, leePerfilPublico, leePlanPublico } from '@/lib/tiendaApi';
import { rutaDeTienda } from '@/lib/rutas';
import { useIsDesktop } from '@/lib/useViewport';
import { oficioCorto } from '@/lib/theme';
import { chipsDeParaQuien } from '@/lib/paraQuien';
import { ETIQUETA_DE_CONTENIDO, esBiblioteca, esSuelto } from '@/lib/vitrinaDatos';
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

const CabezaDelCoach = ({ coach, alVerPerfil }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
    <Avatar foto={coach.foto} nombre={coach.nombre} tamano={48} />
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 17, fontWeight: 800, lineHeight: 1.2, overflowWrap: 'anywhere' }}>{coach.nombre}</div>
      {oficioCorto(coach.profesion) && <div style={{ fontSize: 14, fontWeight: 600, color: LT.text2, marginTop: 2 }}>{oficioCorto(coach.profesion)}</div>}
    </div>
    {alVerPerfil && <Boton tipo="texto" chico onClick={alVerPerfil}>Ver perfil</Boton>}
  </div>
);

/* Compartir la página: el menú de compartir del teléfono; si no hay, se copia la liga. */
async function compartir(titulo) {
  const url = window.location.href;
  try {
    if (navigator.share) await navigator.share({ title: titulo, url });
    else { await navigator.clipboard.writeText(url); return 'copiada'; }
  } catch { /* lo canceló */ }
  return null;
}

/* ------------------------------ La página de un coach ------------------------------ */

/* Reestructura visual (15 oct 2026), como la página del coach en las capturas de Andrés: su tarjeta azul (foto, nombre, oficio, lo que escribió, cuántos planes y
   «Compartir») y sus planes en tarjetas con foto y precio. Si vende de varias clases (programas, rutinas, clases…), se filtran con «Ver». */
function PaginaDelCoach({ usuario, alElegir }) {
  const esCompu = useIsDesktop();
  const [datos, setDatos] = useState(undefined); // undefined = cargando · null = no existe
  const [tipo, setTipo] = useState('todo');
  const [copiada, setCopiada] = useState(false);
  useEffect(() => {
    let vivo = true;
    leePerfilPublico(usuario).then((d) => { if (vivo) setDatos(d); }).catch(() => { if (vivo) setDatos(null); });
    return () => { vivo = false; };
  }, [usuario]);

  if (datos === undefined) return <Marco><div role="status" style={{ display: 'flex', justifyContent: 'center', padding: 48, color: LT.text2 }}><Loader2 size={22} className="spin" /></div></Marco>;
  if (datos === null) return <Aviso titulo="Esta página no existe" texto="Revisa la liga que te mandaron." boton="Ir a Training Lab" alTocar={() => { window.location.assign('/'); }} />;
  const planes = datos.planes ?? [];
  const tipos = [...new Set(planes.map((p) => p.contenido ?? 'programa'))];
  const vistos = tipo === 'todo' ? planes : planes.filter((p) => (p.contenido ?? 'programa') === tipo);
  const opciones = [{ valor: 'todo', texto: `Todo (${planes.length})` }, ...tipos.map((t) => ({ valor: t, texto: `${ETIQUETA_DE_CONTENIDO[t] ?? t} (${planes.filter((p) => (p.contenido ?? 'programa') === t).length})` }))];
  return (
    <Marco ancho={1080}>
      <div style={esCompu ? { display: 'grid', gridTemplateColumns: '340px minmax(0, 1fr)', gap: 24, alignItems: 'start' } : { display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ position: esCompu ? 'sticky' : 'static', top: 20, background: UI.azul, color: '#fff', borderRadius: 26, padding: 22, boxShadow: UI.azulSombra, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <Avatar foto={datos.foto} nombre={datos.nombre} tamano={76} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.15, letterSpacing: -0.4, overflowWrap: 'anywhere' }}>{datos.nombre}</div>
              {oficioCorto(datos.profesion) && <div style={{ fontSize: 15, fontWeight: 600, opacity: 0.85, marginTop: 3 }}>{oficioCorto(datos.profesion)}</div>}
            </div>
          </div>
          {datos.bio && <div style={{ fontSize: 15.5, fontWeight: 500, lineHeight: 1.5, opacity: 0.92, whiteSpace: 'pre-wrap' }}>{datos.bio}</div>}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ padding: '10px 14px', borderRadius: 14, background: 'rgba(255,255,255,0.14)', ...NUM_STYLE }}>
              <span style={{ fontSize: 22, fontWeight: 800 }}>{planes.length}</span>
              <span style={{ fontSize: 13.5, fontWeight: 600, opacity: 0.85 }}> {planes.length === 1 ? 'plan' : 'planes'}</span>
            </span>
            <span style={{ flex: 1 }} />
            <BotonEnAzul onClick={async () => { if (await compartir(datos.nombre) === 'copiada') { setCopiada(true); setTimeout(() => setCopiada(false), 1800); } }}>
              {copiada ? 'Liga copiada' : 'Compartir'}
            </BotonEnAzul>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
          {tipos.length > 1 && <div style={{ alignSelf: 'flex-start' }}><BotonElegir etiqueta="Ver" titulo="Ver" valor={tipo} opciones={opciones} onCambio={setTipo} /></div>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))', gap: 16 }}>
            {vistos.map((p) => <TarjetaDePlan key={p.slug} p={p} conCoach={false} onClick={() => alElegir(p.slug)} />)}
          </div>
        </div>
      </div>
    </Marco>
  );
}

/* ------------------------------ La página de un plan ------------------------------ */

const Chip = ({ children }) => <Pastilla tono="azul">{children}</Pastilla>;
const Bloque = ({ titulo, children }) => (
  <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
    <h3 style={{ margin: '0 4px', fontSize: 16, fontWeight: 700, color: LT.text }}>{titulo}</h3>
    <div style={{ background: UI.tarjeta, borderRadius: UI.rGrupo, padding: 16, boxShadow: UI.sombraGrupo, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {children}
    </div>
  </section>
);

/* Un dato del plan en su cuadrito («48 semanas / duración»), como en las capturas. */
const DatoChico = ({ valor, etiqueta }) => (
  <div style={{ background: UI.tarjeta, borderRadius: 16, padding: '12px 14px', boxShadow: UI.sombraGrupo }}>
    <div style={{ fontSize: 18, fontWeight: 800, color: LT.text, ...NUM_STYLE }}>{valor}</div>
    <div style={{ fontSize: 13, fontWeight: 600, color: LT.text2, marginTop: 1 }}>{etiqueta}</div>
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
      <div style={{ fontSize: 15.5, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}><CalendarDays size={18} color={LT.blue} /> ¿Cuánto tiempo tienes?</div>
      {/* Una de tres, a la vista (reestructura visual, 15 oct 2026: el segmentado de `components/ui`). */}
      <Segmentado
        etiqueta="Cuánto tiempo tienes" chico valor={modo} onCambio={(v) => cambia(v)}
        opciones={[{ valor: 'todo', texto: 'Todo' }, { valor: 'meses', texto: 'Unos meses' }, { valor: 'fecha', texto: 'Competencia' }]}
      />
      {modo === 'meses' && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14.5, fontWeight: 700 }}>
          Tengo
          <input
            type="number" inputMode="numeric" min={1} max={36} value={meses} aria-label="Meses que tienes"
            onChange={(e) => { const m = Math.max(1, Math.min(36, Number(e.target.value) || 1)); setMeses(m); cambia('meses', m); }}
            style={{ width: 72, minHeight: 44, borderRadius: 12, border: 'none', padding: '0 10px', fontFamily: FONT, fontSize: 16, fontWeight: 800, textAlign: 'center', background: UI.relleno }}
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
            style={{ minHeight: 44, borderRadius: 12, border: 'none', padding: '0 10px', fontFamily: FONT, fontSize: 16, fontWeight: 700, background: UI.relleno }}
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
  const esCompu = useIsDesktop();
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
  // En la compu el precio va grande arriba del botón: el botón ya no lo repite.
  const precioEnBoton = esCompu ? '' : ` · ${pesos(plan.precio)} ${TIPO[plan.tipo] ?? ''}`;
  const botonDeCompra = (
    <>
      {error && !pideCorreo && <div role="alert" style={{ padding: '10px 12px', borderRadius: 12, background: '#FDECEC', color: LT.danger, fontSize: 14, fontWeight: 700 }}>{error}</div>}
      {plan.ventas === false ? (
        // Mientras Stripe no esté conectado (o este coach no tenga su cuenta de cobro lista) se puede ver y compartir, pero no comprar.
        <button type="button" disabled style={botonAzul(true)}>Pronto podrás comprarlo{precioEnBoton}</button>
      ) : (
        <button type="button" onClick={compra} disabled={comprando || loading} style={botonAzul(comprando || loading)}>
          {comprando ? <Loader2 size={20} className="spin" /> : <Check size={20} strokeWidth={3} />}
          {esCompu ? 'Comprar el plan' : `Comprar${precioEnBoton}`}
        </button>
      )}
    </>
  );
  const enviaCorreo = (e) => {
    e.preventDefault();
    if (!correoValido(correo)) { setError('Escribe un correo válido.'); return; }
    empieza(correo.trim());
  };

  return (
    /* Reestructura visual (15 oct 2026), como la página del plan en las capturas de Andrés: la foto grande, quién lo vende con «Ver perfil», el nombre, los datos en
       cuadritos (duración, nivel), lo que incluye y el programa. En la compu el precio y «Comprar» van en una tarjeta a la derecha; en el teléfono, abajo fijos. */
    <Marco alVolver={alVolver} ancho={esCompu ? 1080 : 640}>
      <div style={esCompu ? { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: 28, alignItems: 'start' } : undefined}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: esCompu ? 20 : 96 }}>
        {plan.foto && <img src={plan.foto} alt="" style={{ width: '100%', aspectRatio: esCompu ? '21 / 9' : '16 / 10', objectFit: 'cover', borderRadius: 24, display: 'block' }} />}
        <CabezaDelCoach coach={plan.coach} alVerPerfil={alVolver} />
        <div style={{ fontSize: esCompu ? 36 : 28, fontWeight: 800, lineHeight: 1.12, letterSpacing: -0.6, overflowWrap: 'anywhere' }}>{plan.titulo}</div>
        {plan.descripcion && <div style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.55, color: LT.text2, whiteSpace: 'pre-wrap' }}>{plan.descripcion}</div>}
        {(total > 0 && !semanal) || plan.nivel ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
            {total > 0 && !semanal && <DatoChico valor={semanasTexto(total)} etiqueta="duración" />}
            {semanal && dias > 0 && <DatoChico valor={`${dias} ${dias === 1 ? 'día' : 'días'}`} etiqueta="por semana" />}
            {plan.nivel && <DatoChico valor={{ principiante: 'Principiante', intermedio: 'Intermedio', avanzado: 'Avanzado', todos: 'Todos' }[plan.nivel] ?? plan.nivel} etiqueta="nivel" />}
          </div>
        ) : null}
        {chipsDeParaQuien(plan, { siempreEdad: true }).length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {chipsDeParaQuien(plan, { siempreEdad: true }).map((c) => <Chip key={c}>{c}</Chip>)}
          </div>
        )}
        {plan.video && <VideoDelCoach url={plan.video} />}
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

      {esCompu ? (
        <aside style={{ position: 'sticky', top: 20, background: UI.tarjeta, borderRadius: 24, padding: 22, boxShadow: '0 2px 12px rgba(17,19,24,0.07)', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: -0.8, ...NUM_STYLE }}>{pesos(plan.precio)}</div>
            <div style={{ fontSize: 15, fontWeight: 500, color: LT.text2, marginTop: 2 }}>{plan.tipo === 'membresia' ? 'al mes · cancelas cuando quieras' : 'pago único · acceso para siempre'}</div>
          </div>
          {botonDeCompra}
        </aside>
      ) : null}
      </div>

      {!esCompu && (
      <div
        style={{
          position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 20, background: 'rgba(242,243,247,0.94)', backdropFilter: 'blur(10px)', borderTop: `1px solid ${UI.hilo}`,
          padding: '12px 16px calc(12px + env(safe-area-inset-bottom))',
        }}
      >
        <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {botonDeCompra}
        </div>
      </div>
      )}

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
      const r = rutaDeTienda(window.location.pathname);
      setSlug(r?.tipo === 'plan' ? r.slug : null);
    };
    window.addEventListener('popstate', alRetroceder);
    return () => window.removeEventListener('popstate', alRetroceder);
  }, []);

  if (ruta.tipo === 'lista') return <CompraLista />;
  if (ruta.tipo === 'cancelada') return <Cancelada />;
  return slug ? <PaginaDelPlan usuario={ruta.usuario} slug={slug} alVolver={vuelve} /> : <PaginaDelCoach usuario={ruta.usuario} alElegir={abrePlan} />;
}
