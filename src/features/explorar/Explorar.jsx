import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, Compass } from 'lucide-react';
import { FONT, KP, UI, oficioCorto } from '@/lib/theme';
import { leeExplorar } from '@/lib/explorarApi';
import { entrenosRecientes } from '@/lib/entrenoLibreApi';
import { coachesParaMostrar, deporteFavorito, deportesDelCoach, deportesQueSalen, desdeTexto, nombreDeDeporte, planesDeLosCoaches, planesTexto } from '@/lib/explorar';
import { Avatar, BotonElegir, Buscador, Fila, Grupo, Segmentado } from '@/components/ui';
import { enLaApp } from '@/lib/nativo';
import { compraConApple } from '@/lib/compraApi';
import PaginaDelCoach from '@/features/tienda/PaginaDelCoach';
import PaginaDelPlan from '@/features/tienda/PaginaDelPlan';
import CuandoEmpiezas from '@/features/tienda/CuandoEmpiezas';
import { pesosMXN, textoDeCobro } from '@/features/tienda/piezasDelPlan';

/* EXPLORAR (12 oct 2026): para quien no tiene plan (o quiere otro): coaches con planes a la venta. Tocar algo abre su página pública (`/@usuario` o `/@usuario/plan`), la misma
   que se comparte en Instagram. Mientras las ventas estén cerradas no hay a quién enseñar (la base devuelve una lista vacía) y dice que viene pronto.
   Reestructura visual (15 oct 2026), como «Explorar» de las capturas de Andrés: buscador, «Disciplina ▾» (una lista, ya no fichas que se deslizan de lado), «Planes | Coaches»
   y los planes en tarjetas con foto, precio y «Ver plan». Con el deporte que más ha entrenado primero, como antes. */

/* «Compra y dinero» (26 nov 2026; dibujos app-s1 y app-s2): los planes en filas (foto, coach, nombre, promesa, precio) y los coaches con «desde $500».
   DENTRO DE LA APP la página del coach y la del plan se abren aquí mismo, sin ir a la web (regla de Apple: nada lleva a pagar fuera); con `compra_apple` prendido el plan trae
   «Comprar con Apple» y al pagar sale «¿Cuándo empiezas?». En la web, tocar algo abre la página pública (`/@usuario/plan`), donde se paga con tarjeta. */
function FilaDePlan({ p, onClick }) {
  return (
    <button type="button" onClick={onClick} className="kp-press" style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', background: UI.tarjeta, borderRadius: 22, border: 'none', padding: 14, textAlign: 'left', cursor: 'pointer', fontFamily: FONT, color: KP.ink, boxShadow: UI.sombraGrupo }}>
      <span style={{ width: 84, height: 84, borderRadius: 18, overflow: 'hidden', background: KP.blueSoft, flexShrink: 0 }}>{p.foto && <img src={p.foto} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}</span>
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 14.5, fontWeight: 600, color: KP.ink2 }}><Avatar nombre={p.coach?.nombre} foto={p.coach?.foto} tamano={22} />{p.coach?.nombre}</span>
        <span style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.2, overflowWrap: 'anywhere' }}>{p.titulo}</span>
        {p.objetivo && <span style={{ fontSize: 15, fontWeight: 500, color: KP.ink2, lineHeight: 1.35 }}>{p.objetivo}</span>}
        <span style={{ marginTop: 2 }}><b style={{ fontSize: 17, fontWeight: 800 }}>{pesosMXN(p.precio)}</b><span style={{ fontSize: 14.5, fontWeight: 500, color: KP.ink2 }}>{p.tipo === 'membresia' ? ' al mes' : ` · ${textoDeCobro(p.tipo)}`}</span></span>
      </span>
      <ChevronRight size={20} color={KP.ink3} style={{ flexShrink: 0 }} />
    </button>
  );
}

/** Dentro de la app: la página del coach o del plan encima de Explorar, y después de pagar con Apple, «¿Cuándo empiezas?». */
function PaginaEnLaApp({ abierto, setAbierto }) {
  const [comprando, setComprando] = useState(false);
  const [error, setError] = useState(null);
  const [comprada, setComprada] = useState(null); // { id, titulo, coach, precio }
  const capa = { position: 'fixed', inset: 0, zIndex: 60, overflowY: 'auto', background: UI.fondo };
  if (comprada) {
    return (
      <div style={capa}>
        <div style={{ maxWidth: 560, margin: '0 auto', padding: 'calc(24px + env(safe-area-inset-top)) 16px calc(28px + env(safe-area-inset-bottom))' }}>
          <CuandoEmpiezas
            compraId={comprada.id}
            cabeza={(
              <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <h1 style={{ margin: '8px 0 0', fontSize: 32, fontWeight: 800, letterSpacing: -0.7 }}>Compra confirmada</h1>
                <div style={{ fontSize: 17, fontWeight: 600, color: KP.ink2 }}>{[comprada.titulo, comprada.coach].filter(Boolean).join(' · ')}</div>
                <div style={{ fontSize: 15.5, fontWeight: 500, color: KP.ink2 }}>Pagaste {pesosMXN(comprada.precio)} con Apple. Apple te manda el recibo.</div>
              </div>
            )}
            alListo={() => window.location.assign('/')}
          />
        </div>
      </div>
    );
  }
  if (abierto.tipo === 'coach') {
    return <div style={capa}><PaginaDelCoach usuario={abierto.usuario} enLaApp alVolver={() => setAbierto(null)} alAbrirPlan={(slug) => setAbierto({ tipo: 'plan', usuario: abierto.usuario, slug, desdeCoach: true })} /></div>;
  }
  const compra = async () => {
    setComprando(true);
    setError(null);
    try {
      const id = await compraConApple({ usuario: abierto.usuario, slug: abierto.slug });
      if (id) setComprada({ id, titulo: abierto.plan?.titulo, coach: abierto.plan?.coach?.nombre, precio: abierto.plan?.precio });
    } catch (e) { setError(e.message); }
    setComprando(false);
  };
  return (
    <div style={capa}>
      <PaginaDelPlan
        usuario={abierto.usuario} slug={abierto.slug} enLaApp comprando={comprando} error={error} alComprarConApple={compra}
        alVerCoach={() => setAbierto({ tipo: 'coach', usuario: abierto.usuario })} alVolver={() => setAbierto(abierto.desdeCoach ? { tipo: 'coach', usuario: abierto.usuario } : null)}
      />
    </div>
  );
}

export default function Explorar({ userId }) {
  const [abierto, setAbierto] = useState(null); // dentro de la app: { tipo: 'coach' | 'plan', usuario, slug, plan }
  const app = enLaApp();
  const [coaches, setCoaches] = useState(undefined); // undefined = cargando
  const [favorito, setFavorito] = useState(null);
  const [texto, setTexto] = useState('');
  const [deporte, setDeporte] = useState(null);
  const [vista, setVista] = useState('planes');

  useEffect(() => {
    let vivo = true;
    leeExplorar().then((c) => { if (vivo) setCoaches(c); }).catch(() => { if (vivo) setCoaches([]); });
    if (userId) entrenosRecientes(userId, 80).then((e) => { if (vivo) setFavorito(deporteFavorito(e)); }).catch(() => {});
    return () => { vivo = false; };
  }, [userId]);

  const fichas = useMemo(() => deportesQueSalen(coaches ?? [], favorito), [coaches, favorito]);
  const vistos = useMemo(() => coachesParaMostrar(coaches ?? [], { texto, deporte, favorito }), [coaches, texto, deporte, favorito]);
  const planes = useMemo(() => planesDeLosCoaches(vistos, 60), [vistos]);

  if (abierto) return <PaginaEnLaApp abierto={abierto} setAbierto={setAbierto} />;
  return (
    <div style={{ background: UI.fondo, minHeight: '100svh' }}>
      <div style={{ padding: '24px 18px 120px', maxWidth: 1080, margin: '0 auto', fontFamily: FONT, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h1 style={{ margin: 0, paddingRight: 64, fontSize: 30, fontWeight: 800, color: KP.ink, letterSpacing: -0.6 }}>Explorar</h1>

        {coaches === undefined && <div role="status" aria-label="Cargando" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{[0, 1, 2].map((i) => <div key={i} className="kp-skeleton" style={{ height: 120, borderRadius: 22 }} />)}</div>}

        {coaches?.length === 0 && (
          <Grupo>
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <span style={{ width: 56, height: 56, borderRadius: 18, background: KP.blueSoft, color: KP.blue, display: 'inline-grid', placeItems: 'center' }}><Compass size={26} /></span>
              <div style={{ fontSize: 18, fontWeight: 800, color: KP.ink, marginTop: 14 }}>Pronto, coaches con planes para ti</div>
            </div>
          </Grupo>
        )}

        {coaches?.length > 0 && (
          <>
            <Buscador valor={texto} onCambio={setTexto} marcador="Buscar un coach o un plan" />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'space-between' }}>
              {fichas.length > 0 && (
                <BotonElegir
                  etiqueta="Disciplina" valor={deporte ?? 'todas'} marcador="Todas"
                  opciones={[{ valor: 'todas', texto: 'Todas' }, ...fichas.map((d) => ({ valor: d, texto: nombreDeDeporte(d) }))]}
                  onCambio={(v) => setDeporte(v === 'todas' ? null : v)}
                />
              )}
              <span style={{ fontSize: 15.5, fontWeight: 500, color: KP.ink2 }}>{vista === 'planes' ? `${planes.length} ${planes.length === 1 ? 'plan' : 'planes'}` : `${vistos.length} ${vistos.length === 1 ? 'coach' : 'coaches'}`}</span>
              <div style={{ minWidth: 220, flex: '1 1 100%' }}>
                <Segmentado etiqueta="Ver" valor={vista} onCambio={setVista} opciones={[{ valor: 'planes', texto: 'Planes' }, { valor: 'coaches', texto: 'Coaches' }]} />
              </div>
            </div>

            {vistos.length === 0 && <div style={{ textAlign: 'center', padding: '28px 12px', fontSize: 15.5, fontWeight: 600, color: KP.ink2 }}>Nadie coincide con eso. Prueba con otra palabra u otra disciplina.</div>}

            {vista === 'planes' && planes.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))', gap: 14 }}>
                {planes.map((p) => (
                  <FilaDePlan
                    key={`${p.coach.usuario}/${p.slug}`} p={p}
                    onClick={() => (app ? setAbierto({ tipo: 'plan', usuario: p.coach.usuario, slug: p.slug, plan: p }) : window.location.assign(`/@${p.coach.usuario}/${p.slug}`))}
                  />
                ))}
              </div>
            )}

            {vista === 'coaches' && vistos.length > 0 && (
              <Grupo>
                {vistos.map((c) => (
                  <Fila
                    key={c.usuario} izquierda={<Avatar nombre={c.nombre} foto={c.foto} tamano={48} />} texto={c.nombre}
                    detalle={<>{[oficioCorto(c.profesion), deportesDelCoach(c).slice(0, 3).map(nombreDeDeporte).join(' · ') || null, planesTexto(c.n_planes)].filter(Boolean).map((x) => <span key={x} style={{ display: 'block' }}>{x}</span>)}</>}
                    valor={desdeTexto(c) || null} valorTono="neutro"
                    onClick={() => (app ? setAbierto({ tipo: 'coach', usuario: c.usuario }) : window.location.assign(`/@${c.usuario}`))}
                  />
                ))}
              </Grupo>
            )}
          </>
        )}
      </div>
    </div>
  );
}
