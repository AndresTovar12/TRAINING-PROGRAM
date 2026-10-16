import { useEffect, useMemo, useState } from 'react';
import { Compass } from 'lucide-react';
import { FONT, KP, UI, oficioCorto } from '@/lib/theme';
import { leeExplorar } from '@/lib/explorarApi';
import { entrenosRecientes } from '@/lib/entrenoLibreApi';
import { coachesParaMostrar, deporteFavorito, deportesDelCoach, deportesQueSalen, desdeTexto, nombreDeDeporte, planesDeLosCoaches, planesTexto } from '@/lib/explorar';
import TarjetaDePlan from '@/features/explorar/TarjetaDePlan';
import { Avatar, BotonElegir, Buscador, Fila, Grupo, Segmentado } from '@/components/ui';

/* EXPLORAR (12 oct 2026): para quien no tiene plan (o quiere otro): coaches con planes a la venta. Tocar algo abre su página pública (`/@usuario` o `/@usuario/plan`), la misma
   que se comparte en Instagram. Mientras las ventas estén cerradas no hay a quién enseñar (la base devuelve una lista vacía) y dice que viene pronto.
   Reestructura visual (15 oct 2026), como «Explorar» de las capturas de Andrés: buscador, «Disciplina ▾» (una lista, ya no fichas que se deslizan de lado), «Planes | Coaches»
   y los planes en tarjetas con foto, precio y «Ver plan». Con el deporte que más ha entrenado primero, como antes. */

export default function Explorar({ userId }) {
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
              <div style={{ minWidth: 220, flex: '0 1 280px', marginLeft: 'auto' }}>
                <Segmentado etiqueta="Ver" valor={vista} onCambio={setVista} opciones={[{ valor: 'planes', texto: 'Planes' }, { valor: 'coaches', texto: 'Coaches' }]} />
              </div>
            </div>

            {vistos.length === 0 && <div style={{ textAlign: 'center', padding: '28px 12px', fontSize: 15.5, fontWeight: 600, color: KP.ink2 }}>Nadie coincide con eso. Prueba con otra palabra u otra disciplina.</div>}

            {vista === 'planes' && planes.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 290px), 1fr))', gap: 16 }}>
                {planes.map((p) => <TarjetaDePlan key={`${p.coach.usuario}/${p.slug}`} p={p} href={`/@${p.coach.usuario}/${p.slug}`} />)}
              </div>
            )}

            {vista === 'coaches' && vistos.length > 0 && (
              <Grupo>
                {vistos.map((c) => (
                  <Fila
                    key={c.usuario} izquierda={<Avatar nombre={c.nombre} foto={c.foto} tamano={48} />} texto={c.nombre}
                    detalle={[oficioCorto(c.profesion), deportesDelCoach(c).slice(0, 3).map(nombreDeDeporte).join(' · ') || null, planesTexto(c.n_planes)].filter(Boolean).join(' · ')}
                    valor={desdeTexto(c) || null} valorTono="neutro"
                    onClick={() => { window.location.href = `/@${c.usuario}`; }}
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
