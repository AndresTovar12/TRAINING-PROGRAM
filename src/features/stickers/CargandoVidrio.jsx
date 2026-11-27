/* «PREPARANDO TU FOTO» / «ARMANDO TU VIDEO» (27 nov 2026). Andrés: el aviso de antes «se ve feo»: era la tarjeta de abajo de «Copiado», con palomita verde,
   aunque nada había terminado. Ahora lo de abajo se vela y en medio va un vidrio con el indicador que gira (lo que hace el iPhone mientras abre algo); se va
   solo en cuanto termina. Lo usan la hoja de stickers y el editor de Carrete. */
const SF = '-apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, system-ui, sans-serif';

export default function CargandoVidrio({ texto, detalle = null, capa = 20 }) {
  return (
    <div role="status" aria-live="polite" style={{ position: 'absolute', inset: 0, zIndex: capa, borderRadius: 'inherit', display: 'grid', placeItems: 'center', background: 'rgba(5,7,14,.5)' }}>
      <div style={{ /* estilo-ok: diseño A · Marca aprobado por Andrés (24 nov 2026, maqueta editor-de-stickers) */ display: 'grid', justifyItems: 'center', gap: 12, maxWidth: 260, padding: '22px 28px 18px', borderRadius: 24, background: 'rgba(30,34,48,.72)', WebkitBackdropFilter: 'blur(24px)', backdropFilter: 'blur(24px)', boxShadow: 'inset 0 0 0 .5px rgba(255,255,255,.12), 0 20px 50px rgba(0,0,0,.35)', animation: 'stk-sube .22s cubic-bezier(.23,1,.32,1) both', textAlign: 'center' }}>
        <svg className="spin" width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
          <circle cx="15" cy="15" r="12" fill="none" stroke="rgba(255,255,255,.18)" strokeWidth="3" />
          <circle cx="15" cy="15" r="12" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeDasharray="22 100" />
        </svg>
        <span style={{ fontFamily: SF, fontSize: 15, fontWeight: 500, letterSpacing: -0.2, color: 'rgba(255,255,255,.9)' }}>{texto}</span>
        {detalle && <span style={{ fontFamily: SF, fontSize: 12.5, lineHeight: 1.35, color: 'rgba(255,255,255,.55)', marginTop: -6 }}>{detalle}</span>}
      </div>
    </div>
  );
}
