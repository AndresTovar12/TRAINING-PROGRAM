import { useEffect, useState } from 'react';
import { ArrowUpRight, ChevronLeft, ChevronRight, Dumbbell, Loader2, Users } from 'lucide-react';

/** El glifo de Instagram (lucide ya no trae marcas). */
const Instagram = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" /></svg>
);
import { FONT, KP, NUM_STYLE, UI } from '@/lib/theme';
import { leePerfilPublico } from '@/lib/tiendaApi';
import { useIsDesktop } from '@/lib/useViewport';
import { Avatar, Boton } from '@/components/ui';
import { Aviso, Marco } from './PiezasDeTienda';
import {
  BotonCompartir, EmpiezaAqui, IncluyeEnLinea, especialidad, oficioConDisciplinas, pesosMXN, primerNombre, textoDeCobro,
} from './piezasDelPlan';

/* LA PÁGINA DEL COACH (encargo «Compra y dinero», 26 nov 2026; dibujos app-s3, web-1-coach-telefono y web-1-coach-compu). La misma en la app y en la web.
   Foto grande a todo lo ancho (teléfono); en la compu, dos columnas. «Qué logran tus atletas contigo», años | certificación, «Con quién trabajo» (especialidad y cuántos atletas
   han entrenado con él: salen solos), «Sobre mí» con «Leer más», Instagram a color, sus planes y al final los resultados de sus atletas.
   En la WEB cada plan trae «Comprar» o «Suscribirme» (el recomendado en azul lleno). En la APP la tarjeta no tiene botón: abre la página del plan (regla de Apple). */

const instagramDe = (redes) => {
  const x = String(redes?.instagram ?? '').trim();
  if (!x) return null;
  const usuario = x.replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/^@/, '').replace(/\/.*$/, '');
  return usuario ? { usuario, url: `https://instagram.com/${usuario}` } : null;
};

function SobreMi({ texto }) {
  const [abierto, setAbierto] = useState(false);
  const largo = texto.length > 140;
  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 600, color: KP.ink2, marginBottom: 6 }}>Sobre mí</div>
      <div style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.5, color: KP.ink, whiteSpace: 'pre-wrap', ...(largo && !abierto ? { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } : null) }}>
        {texto}
      </div>
      {largo && !abierto && <button type="button" onClick={() => setAbierto(true)} style={{ border: 'none', background: 'none', padding: 0, marginTop: 2, color: KP.blue, fontFamily: FONT, fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>Leer más</button>}
    </div>
  );
}

function TarjetaDelCoach({ d }) {
  const ig = instagramDe(d.redes);
  const esp = especialidad(d);
  const hilo = { borderTop: `1px solid ${UI.hilo}`, padding: '16px 18px' };
  return (
    <div style={{ background: UI.tarjeta, borderRadius: UI.rTarjeta, boxShadow: UI.sombraGrupo, overflow: 'hidden' }}>
      {(d.anos_coach || d.certificaciones) && (
        <div style={{ display: 'grid', gridTemplateColumns: d.anos_coach && d.certificaciones ? '1fr 1fr' : '1fr' }}>
          {d.anos_coach ? (
            <div style={{ padding: '14px 18px' }}>
              <div style={{ fontSize: 24, fontWeight: 800, ...NUM_STYLE }}>{d.anos_coach} {d.anos_coach === 1 ? 'año' : 'años'}</div>
              <div style={{ fontSize: 14, fontWeight: 500, color: KP.ink2 }}>de experiencia</div>
            </div>
          ) : null}
          {d.certificaciones && (
            <div style={{ padding: '14px 18px', borderLeft: d.anos_coach ? `1px solid ${UI.hilo}` : 'none' }}>
              <div style={{ fontSize: 24, fontWeight: 800, overflowWrap: 'anywhere' }}>{d.certificaciones}</div>
              <div style={{ fontSize: 14, fontWeight: 500, color: KP.ink2 }}>Certificaciones</div>
            </div>
          )}
        </div>
      )}
      {(esp || d.atletas > 0) && (
        <div style={{ ...(d.anos_coach || d.certificaciones ? hilo : { padding: '16px 18px' }), display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: KP.ink2 }}>Con quién trabajo</div>
          {esp && <Renglon icono={<Dumbbell size={17} />} texto={`Mi especialidad: ${esp}`} />}
          {d.atletas > 0 && <Renglon icono={<Users size={17} />} texto={`${d.atletas} ${d.atletas === 1 ? 'atleta ha' : 'atletas han'} entrenado conmigo`} />}
        </div>
      )}
      {(d.bio || ig) && (
        <div style={{ ...hilo, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {d.bio && <SobreMi texto={d.bio} />}
          {ig && ( // estilo-ok: colores y orilla de la marca de Instagram
            <a href={ig.url} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 16, textDecoration: 'none', color: KP.ink, background: 'linear-gradient(90deg, #FFF1F5, #F3EEFF)', border: '1px solid #F2DCEB' }}>
              <span style={{ width: 40, height: 40, borderRadius: 12, display: 'grid', placeItems: 'center', color: '#fff', background: 'radial-gradient(circle at 30% 110%, #FDCB52 0%, #FD5949 40%, #D6249F 65%, #285AEB 100%)' }}><Instagram size={20} /></span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 16, fontWeight: 700 }}>@{ig.usuario}</span>
                <span style={{ display: 'block', fontSize: 13.5, fontWeight: 500, color: KP.ink2 }}>Instagram</span>
              </span>
              <ArrowUpRight size={17} color={KP.ink2} />
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function Renglon({ icono, texto }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 16, fontWeight: 600 }}>
      <span style={{ width: 34, height: 34, borderRadius: 11, background: KP.blueSoft, color: KP.blue, display: 'grid', placeItems: 'center', flexShrink: 0 }}>{icono}</span>
      {texto}
    </div>
  );
}

/** Un plan del coach. `enLaApp`: sin botón (toda la tarjeta abre la página del plan). */
function TarjetaDePlanDelCoach({ p, nombreCoach, enLaApp, alAbrir, alComprar }) {
  return (
    <div style={{ background: UI.tarjeta, borderRadius: UI.rTarjeta, boxShadow: UI.sombraGrupo, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <button type="button" onClick={alAbrir} style={{ display: 'flex', alignItems: 'center', gap: 14, border: 'none', background: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', fontFamily: FONT, color: KP.ink }}>
        <span style={{ width: 64, height: 64, borderRadius: 16, overflow: 'hidden', background: KP.blueSoft, flexShrink: 0 }}>{p.foto && <img src={p.foto} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}</span>
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
          {p.recomendado && <EmpiezaAqui />}
          <span style={{ fontSize: 19, fontWeight: 800, lineHeight: 1.2, overflowWrap: 'anywhere' }}>{p.titulo}</span>
        </span>
        <ChevronRight size={20} color={KP.ink3} />
      </button>
      {(p.objetivo || p.para_ti_si) && (
        <div>
          {p.objetivo && <div style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.4 }}>{p.objetivo}</div>}
          {p.para_ti_si && <div style={{ fontSize: 14.5, fontWeight: 500, color: KP.ink2, marginTop: 2 }}>Para ti si {p.para_ti_si}</div>}
        </div>
      )}
      <IncluyeEnLinea plan={p} nombreCoach={nombreCoach} />
      <div style={{ borderTop: `1px solid ${UI.hilo}`, paddingTop: 12, display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontSize: 19, fontWeight: 800, ...NUM_STYLE }}>{pesosMXN(p.precio)}</span>
        <span style={{ fontSize: 14.5, fontWeight: 500, color: KP.ink2 }}>{p.tipo === 'membresia' ? 'al mes' : `· ${textoDeCobro(p.tipo)}`}</span>
      </div>
      {!enLaApp && (
        <Boton tipo={p.recomendado ? 'principal' : 'secundario'} ancho onClick={alComprar}>{p.tipo === 'membresia' ? 'Suscribirme' : 'Comprar'}</Boton>
      )}
    </div>
  );
}

/**
 * `usuario`: el del coach. `alAbrirPlan(slug)`; `alComprar(slug)` (web: va directo al pago); `alVolver` (en la app, regresa a Explorar). `enLaApp`: sin botones de compra.
 */
export default function PaginaDelCoach({ usuario, enLaApp = false, alAbrirPlan, alComprar, alVolver }) {
  const esCompu = useIsDesktop();
  const [d, setD] = useState(undefined); // undefined = cargando · null = no existe
  useEffect(() => {
    let vivo = true;
    leePerfilPublico(usuario).then((x) => { if (vivo) setD(x); }).catch(() => { if (vivo) setD(null); });
    return () => { vivo = false; };
  }, [usuario]);

  if (d === undefined) return <Marco alVolver={alVolver}><div role="status" style={{ display: 'flex', justifyContent: 'center', padding: 48, color: KP.ink2 }}><Loader2 size={22} className="spin" /></div></Marco>;
  if (d === null) return <Aviso titulo="Esta página no existe" texto="Revisa la liga que te mandaron." boton="Ir a Training Lab" alTocar={() => { if (alVolver) alVolver(); else window.location.assign('/'); }} />;
  const planes = d.planes ?? [];
  const resultados = d.resultados ?? [];

  const portada = (
    <div style={{ position: 'relative', minHeight: esCompu ? 340 : 420, borderRadius: esCompu ? 24 : 0, overflow: 'hidden', background: UI.azul, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      {(d.portada || d.foto) && <img src={d.portada || d.foto} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
      {/* estilo-ok: oscurece la foto de abajo para que se lea el nombre */}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.08) 30%, rgba(0,0,0,0.62) 100%)' }} />
      <div style={{ position: 'absolute', top: 'calc(12px + env(safe-area-inset-top))', left: 14, right: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {alVolver
          ? <button type="button" onClick={alVolver} aria-label="Volver" style={{ width: 44, height: 44, borderRadius: 14, border: 'none', background: 'rgba(255,255,255,0.88)', display: 'grid', placeItems: 'center', cursor: 'pointer' }}><ChevronLeft size={21} /></button>
          : <a href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 12px 7px 7px', borderRadius: 14, background: 'rgba(255,255,255,0.88)', color: KP.ink, textDecoration: 'none', fontWeight: 800, fontSize: 15 }}><span style={{ width: 30, height: 30, borderRadius: 9, background: UI.azul, color: '#fff', display: 'grid', placeItems: 'center' }}><Dumbbell size={16} /></span>Training Lab</a>}
        <BotonCompartir titulo={d.nombre} usuario={d.usuario} claro />
      </div>
      <div style={{ position: 'relative', padding: '0 20px 20px', color: '#fff' }}>
        <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: -0.6, lineHeight: 1.1, overflowWrap: 'anywhere' }}>{d.nombre}</div>
        <div style={{ fontSize: 16, fontWeight: 600, opacity: 0.92, marginTop: 4 }}>{oficioConDisciplinas(d)}</div>
      </div>
    </div>
  );
  const info = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {d.logros && <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.25, letterSpacing: -0.3 }}>{d.logros}</div>}
      <TarjetaDelCoach d={d} />
    </div>
  );
  const lista = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <h2 style={{ margin: '6px 2px 0', fontSize: 21, fontWeight: 800 }}>Planes de {primerNombre(d.nombre)} <span style={{ color: KP.ink3 }}>· {planes.length}</span></h2>
      {planes.map((p) => (
        <TarjetaDePlanDelCoach key={p.slug} p={p} nombreCoach={d.nombre} enLaApp={enLaApp || d.ventas === false} alAbrir={() => alAbrirPlan(p.slug)} alComprar={() => alComprar?.(p.slug)} />
      ))}
      {resultados.length > 0 && (
        <>
          <h2 style={{ margin: '14px 2px 0', fontSize: 21, fontWeight: 800 }}>Resultados de sus atletas</h2>
          {resultados.map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, background: UI.tarjeta, borderRadius: UI.rTarjeta, boxShadow: UI.sombraGrupo, padding: '12px 16px' }}>
              <Avatar nombre={r.atleta || '·'} foto={r.foto} tamano={48} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.3 }}>{r.titulo}</div>
                {(r.atleta || r.plan) && <div style={{ fontSize: 14, fontWeight: 500, color: KP.ink2 }}><b style={{ color: KP.ink }}>{r.atleta}</b>{r.plan ? `${r.atleta ? ' · ' : ''}compró ${r.plan}` : ''}</div>}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );

  if (esCompu) {
    return (
      <Marco ancho={1120} alVolver={alVolver}>
        <div style={{ display: 'grid', gridTemplateColumns: '400px minmax(0, 1fr)', gap: 28, alignItems: 'start' }}>
          <div style={{ position: 'sticky', top: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>{portada}{info}</div>
          {lista}
        </div>
      </Marco>
    );
  }
  return (
    <div style={{ minHeight: '100svh', background: UI.fondo, fontFamily: FONT, color: KP.ink, paddingBottom: 'calc(32px + env(safe-area-inset-bottom))' }}>
      {portada}
      <div style={{ padding: '18px 16px 0', display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 640, margin: '0 auto' }}>{info}{lista}</div>
    </div>
  );
}
