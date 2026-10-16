import { FONT, KP, NUM_STYLE, UI } from '@/lib/theme';
import { textoDeContenido, ETIQUETA_DE_CONTENIDO } from '@/lib/vitrinaDatos';
import { Avatar, Boton } from '@/components/ui';

/* LA TARJETA DE UN PLAN A LA VENTA (reestructura visual, 15 oct 2026), como las de «Explorar» y la página del coach en las capturas de Andrés: la foto arriba con qué es
   («Programa», «Rutina», «Clase»…), quién lo vende, el nombre, de qué se trata y abajo el precio con «Ver plan». La usan Explorar y la página pública del coach.
   `p`: { titulo, foto, precio, tipo, contenido, semanas…, coach? }. Con `href` es una liga (Explorar sale de la app); con `onClick`, un botón (dentro de la tienda). */
const pesos = (n) => `$${Number(n).toLocaleString('es-MX')}`;

export default function TarjetaDePlan({ p, href, onClick, conCoach = true }) {
  const meta = [p.tipo === 'membresia' ? 'membresía' : 'pago único', textoDeContenido(p)].filter(Boolean).join(' · ');
  const insignia = ETIQUETA_DE_CONTENIDO[p.contenido ?? 'programa'];
  const Caja = href ? 'a' : 'button';
  return (
    <Caja
      href={href} type={href ? undefined : 'button'} onClick={onClick} className="kp-press"
      style={{
        display: 'flex', flexDirection: 'column', background: UI.tarjeta, borderRadius: 22, overflow: 'hidden', textDecoration: 'none', color: KP.ink,
        boxShadow: '0 2px 10px rgba(17,19,24,0.06)', fontFamily: FONT, minWidth: 0, border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', width: '100%',
      }}
    >
      <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', background: 'linear-gradient(135deg, #E8EEFF, #EFEBFF)' }}>
        {p.foto && <img src={p.foto} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
        {insignia && <span style={{ position: 'absolute', top: 12, left: 12, padding: '4px 10px', borderRadius: 9, background: '#fff', fontSize: 13, fontWeight: 700, color: KP.ink }}>{insignia}</span>}
      </div>
      <div style={{ padding: '14px 16px 16px', display: 'flex', flexDirection: 'column', gap: 6, flex: 1, width: '100%', boxSizing: 'border-box' }}>
        {conCoach && p.coach && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600, color: KP.ink2 }}>
            <Avatar nombre={p.coach.nombre} foto={p.coach.foto} tamano={24} /> {p.coach.nombre}
          </span>
        )}
        <span style={{ fontSize: 19, fontWeight: 800, lineHeight: 1.22, overflowWrap: 'break-word' }}>{p.titulo}</span>
        {meta && <span style={{ fontSize: 14, fontWeight: 500, color: KP.ink2 }}>{meta}</span>}
        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 'auto', paddingTop: 8 }}>
          <span style={{ fontSize: 22, fontWeight: 800, ...NUM_STYLE }}>
            {pesos(p.precio)}<span style={{ fontSize: 13.5, fontWeight: 600, color: KP.ink2 }}>{p.tipo === 'membresia' ? ' / mes' : ''}</span>
          </span>
          <Boton chico tabIndex={-1} estilo={{ pointerEvents: 'none' }}>Ver plan</Boton>
        </span>
      </div>
    </Caja>
  );
}
