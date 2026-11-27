import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { KP } from '@/lib/theme';
import { leePlanPublico, rutaDeTienda } from '@/lib/tiendaApi';
import { Aviso, Marco } from './PiezasDeTienda';
import CompraLista from './CompraLista';
import PaginaDelCoach from './PaginaDelCoach';
import PaginaDelPlan from './PaginaDelPlan';
import Pago from './Pago';

/* LA TIENDA EN LA WEB (`/@usuario`, `/@usuario/plan`, `/compra/lista`). Reescrita para «Compra y dinero» (26 nov 2026): la página del coach, la del plan, el pago dentro de la
   página y «Compra confirmada». En el pago solo se paga: la cuenta, «¿Cuándo empiezas?» y la app van después (`CompraLista`).
   Dentro de la app del iPhone esta tienda NO se usa: las páginas del coach y del plan se abren desde Explorar, sin pagar fuera (regla de Apple). Las ligas `/@…` y `/compra…`
   abren en Safari aunque la app esté instalada (`public/.well-known/apple-app-site-association`). */

function PagoDelPlan({ usuario, slug, alVolver }) {
  const [plan, setPlan] = useState(undefined);
  useEffect(() => {
    let vivo = true;
    leePlanPublico(usuario, slug).then((p) => { if (vivo) setPlan(p); }).catch(() => { if (vivo) setPlan(null); });
    return () => { vivo = false; };
  }, [usuario, slug]);
  if (plan === undefined) return <Marco><div role="status" style={{ display: 'flex', justifyContent: 'center', padding: 48, color: KP.ink2 }}><Loader2 size={22} className="spin" /></div></Marco>;
  if (plan === null) return <Aviso titulo="Este plan ya no está disponible" texto="Puede que su coach lo haya quitado de la venta." boton="Ir a Training Lab" alTocar={() => window.location.assign('/')} />;
  return <Pago plan={plan} usuario={usuario} slug={slug} alVolver={alVolver} />;
}

/** `ruta`: lo que devuelve `rutaDeTienda`. */
export default function TiendaPublica({ ruta }) {
  const leeLugar = () => {
    const r = rutaDeTienda(window.location.pathname);
    return { slug: r?.tipo === 'plan' ? r.slug : null, pago: new URLSearchParams(window.location.search).get('pagar') === '1' };
  };
  const [lugar, setLugar] = useState(() => ({ slug: ruta.slug, pago: leeLugar().pago }));
  const ve = (slug, pago = false) => {
    window.history.pushState({}, '', slug ? `/@${ruta.usuario}/${slug}${pago ? '?pagar=1' : ''}` : `/@${ruta.usuario}`);
    setLugar({ slug, pago });
    window.scrollTo(0, 0);
  };
  useEffect(() => {
    const alRetroceder = () => setLugar(leeLugar());
    window.addEventListener('popstate', alRetroceder);
    return () => window.removeEventListener('popstate', alRetroceder);
  }, []);

  if (ruta.tipo === 'invalida') return <Aviso titulo="No encontramos esa liga" texto="Parece que le falta o le sobra algo. Pídele a quien te la mandó que te la comparta otra vez." boton="Ir a Training Lab" alTocar={() => window.location.assign('/')} />;
  if (ruta.tipo === 'lista') return <CompraLista />;
  // `/compra/cancelada`: ligas viejas de la página de Stripe.
  if (ruta.tipo === 'cancelada') return <Aviso titulo="No se hizo ningún cobro" texto="Cuando quieras, vuelve a intentarlo desde la página del plan." boton="Ir a Training Lab" alTocar={() => window.location.assign('/')} />;
  if (lugar.slug && lugar.pago) return <PagoDelPlan usuario={ruta.usuario} slug={lugar.slug} alVolver={() => ve(lugar.slug)} />;
  if (lugar.slug) {
    return <PaginaDelPlan usuario={ruta.usuario} slug={lugar.slug} alComprar={() => ve(lugar.slug, true)} alVerCoach={() => ve(null)} alVolver={() => ve(null)} />;
  }
  return <PaginaDelCoach usuario={ruta.usuario} alAbrirPlan={(s) => ve(s)} alComprar={(s) => ve(s, true)} />;
}
