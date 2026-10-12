import { useEffect, useMemo, useState } from 'react';
import { Compass, Search } from 'lucide-react';
import { LT, FONT, NUM_STYLE } from '@/lib/theme';
import { oficioCorto } from '@/lib/theme';
import { leeExplorar } from '@/lib/explorarApi';
import { entrenosRecientes } from '@/lib/entrenoLibreApi';
import { coachesParaMostrar, deporteFavorito, deportesDelCoach, deportesQueSalen, desdeTexto, nombreDeDeporte, planesDeLosCoaches, planesTexto } from '@/lib/explorar';
import { textoDeContenido } from '@/lib/vitrinaDatos';

/* EXPLORAR (12 oct 2026): para quien no tiene plan (o quiere otro): coaches con planes a la venta. Un buscador, fichas de deporte (con el que más ha entrenado primero), una tira de planes y
   las tarjetas de los coaches. Tocar algo abre su página pública (`/@usuario` o `/@usuario/plan`), la misma que se comparte en Instagram. Mientras las ventas estén cerradas no hay a quién
   enseñar (la base devuelve una lista vacía) y dice que viene pronto. */

const pesos = (n) => `$${Number(n).toLocaleString('es-MX')}`;

const Avatar = ({ foto, nombre, tam = 56 }) => (
  <span style={{ width: tam, height: tam, borderRadius: tam * 0.34, overflow: 'hidden', background: LT.blueSoft, color: LT.blue, display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: tam * 0.38, flexShrink: 0 }}>
    {foto ? <img src={foto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : String(nombre ?? '?').trim().slice(0, 1).toUpperCase()}
  </span>
);

const Chip = ({ activa, children, alTocar }) => (
  <button
    type="button" onClick={alTocar} aria-pressed={activa}
    style={{ flexShrink: 0, minHeight: 40, padding: '0 16px', borderRadius: 999, cursor: 'pointer', fontFamily: FONT, fontSize: 14, fontWeight: 800, border: `1.5px solid ${activa ? LT.blue : LT.border}`, background: activa ? LT.blue : LT.surface, color: activa ? '#fff' : LT.text, touchAction: 'manipulation' }}
  >{children}</button>
);

export default function Explorar({ userId }) {
  const [coaches, setCoaches] = useState(undefined); // undefined = cargando
  const [favorito, setFavorito] = useState(null);
  const [texto, setTexto] = useState('');
  const [deporte, setDeporte] = useState(null);

  useEffect(() => {
    let vivo = true;
    leeExplorar().then((c) => { if (vivo) setCoaches(c); }).catch(() => { if (vivo) setCoaches([]); });
    if (userId) entrenosRecientes(userId, 80).then((e) => { if (vivo) setFavorito(deporteFavorito(e)); }).catch(() => {});
    return () => { vivo = false; };
  }, [userId]);

  const fichas = useMemo(() => deportesQueSalen(coaches ?? [], favorito), [coaches, favorito]);
  const vistos = useMemo(() => coachesParaMostrar(coaches ?? [], { texto, deporte, favorito }), [coaches, texto, deporte, favorito]);
  const tira = useMemo(() => planesDeLosCoaches(vistos), [vistos]);

  return (
    <div style={{ padding: '84px 20px 120px', maxWidth: 640, margin: '0 auto', fontFamily: FONT, display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ fontSize: 24, fontWeight: 800, color: LT.text, letterSpacing: -0.4 }}>Explorar</div>

      {coaches === undefined && <div role="status" aria-label="Cargando" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{[0, 1, 2].map((i) => <div key={i} className="kp-skeleton" style={{ height: 92, borderRadius: 20 }} />)}</div>}

      {coaches?.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 20px', background: LT.surface, borderRadius: 20, boxShadow: '0 1px 4px rgba(17,19,24,0.06)' }}>
          <span style={{ width: 56, height: 56, borderRadius: 18, background: LT.blueSoft, color: LT.blue, display: 'inline-grid', placeItems: 'center' }}><Compass size={26} /></span>
          <div style={{ fontSize: 18, fontWeight: 800, color: LT.text, marginTop: 14 }}>Pronto, coaches con planes para ti</div>
        </div>
      )}

      {coaches?.length > 0 && (
        <>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, background: LT.surface, border: `1.5px solid ${LT.border}`, borderRadius: 16, padding: '0 14px' }}>
            <Search size={18} color={LT.text3} />
            <input
              value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar un coach o un plan" aria-label="Buscar un coach o un plan"
              style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontFamily: FONT, fontSize: 16, fontWeight: 600, color: LT.text, padding: '13px 0' }}
            />
          </label>

          {fichas.length > 0 && (
            <div role="group" aria-label="Deporte" style={{ display: 'flex', gap: 8, overflowX: 'auto', margin: '0 -20px', padding: '2px 20px' }}>
              <Chip activa={!deporte} alTocar={() => setDeporte(null)}>Todos</Chip>
              {fichas.map((d) => <Chip key={d} activa={deporte === d} alTocar={() => setDeporte(deporte === d ? null : d)}>{nombreDeDeporte(d)}</Chip>)}
            </div>
          )}

          {vistos.length === 0 && <div style={{ textAlign: 'center', padding: '28px 12px', fontSize: 15.5, fontWeight: 700, color: LT.text2 }}>Nadie coincide con eso. Prueba con otra palabra u otro deporte.</div>}

          {tira.length > 0 && (
            <section aria-label="Planes" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: LT.text3, textTransform: 'uppercase', letterSpacing: 0.7 }}>Planes</div>
              <div style={{ display: 'flex', gap: 12, overflowX: 'auto', margin: '0 -20px', padding: '2px 20px 6px' }}>
                {tira.map((p) => (
                  <a
                    key={`${p.coach.usuario}/${p.slug}`} href={`/@${p.coach.usuario}/${p.slug}`}
                    style={{ flexShrink: 0, width: 208, background: LT.surface, borderRadius: 18, overflow: 'hidden', textDecoration: 'none', color: LT.text, boxShadow: '0 1px 4px rgba(17,19,24,0.06)' }}
                  >
                    <div style={{ height: 108, background: LT.blueSoft }}>{p.foto && <img src={p.foto} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}</div>
                    <div style={{ padding: '10px 12px 12px' }}>
                      <div style={{ fontSize: 15, fontWeight: 800, lineHeight: 1.25, overflowWrap: 'anywhere', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.titulo}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: LT.text2, marginTop: 4 }}>{p.coach.nombre}</div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 6, ...NUM_STYLE }}>
                        <span style={{ fontSize: 17, fontWeight: 800, color: LT.blue }}>{pesos(p.precio)}</span>
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: LT.text2 }}>{[p.tipo === 'membresia' ? 'al mes' : 'pago único', textoDeContenido(p)].filter(Boolean).join(' · ')}</span>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </section>
          )}

          {vistos.length > 0 && (
            <section aria-label="Coaches" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: LT.text3, textTransform: 'uppercase', letterSpacing: 0.7 }}>Coaches</div>
              {vistos.map((c) => (
                <a
                  key={c.usuario} href={`/@${c.usuario}`}
                  style={{ display: 'flex', alignItems: 'center', gap: 14, background: LT.surface, borderRadius: 20, padding: 14, textDecoration: 'none', color: LT.text, boxShadow: '0 1px 4px rgba(17,19,24,0.06)' }}
                >
                  <Avatar foto={c.foto} nombre={c.nombre} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 17, fontWeight: 800, overflowWrap: 'anywhere' }}>{c.nombre}</span>
                    {oficioCorto(c.profesion) && <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: LT.blue, marginTop: 1 }}>{oficioCorto(c.profesion)}</span>}
                    {deportesDelCoach(c).length > 0 && <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: LT.text2, marginTop: 3 }}>{deportesDelCoach(c).slice(0, 3).map(nombreDeDeporte).join(' · ')}</span>}
                    <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: LT.text, marginTop: 4, ...NUM_STYLE }}>{planesTexto(c.n_planes)} · {desdeTexto(c)}</span>
                  </span>
                </a>
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}
