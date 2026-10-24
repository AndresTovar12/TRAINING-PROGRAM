import { useEffect, useMemo, useState } from 'react';
import { Check, Loader2, Lock, Mail } from 'lucide-react';
import { LT, FONT } from '@/lib/theme';
import { useAuth } from '@/contexts/AuthContext';
import { Field } from '@/features/auth/AuthScreen';
import { leeCompraLista, ponContrasenaDeCompra } from '@/lib/tiendaApi';
import { SEGUNDOS_ENTRE_INTENTOS, etapaDeCompra, hayQueSeguirEsperando, llaveDeLaLiga } from '@/lib/compraLista';
import { problemaDeContrasena } from '@/lib/contrasena';
import { Aviso, Marco } from './PiezasDeTienda';
import { botonAzul } from './estilosDeTienda';
import InstalarApp from './InstalarApp';

/* LA PÁGINA «LISTO» (`/compra/lista?c=<llave del pago>`): a donde Stripe regresa a quien acaba de pagar. Andrés, 12 oct 2026: «que llegue y quiera comprar y punto».

   Quien compró SIN cuenta ya la tiene (la creó el servidor al confirmarse el pago); aquí solo pone su contraseña, queda con la sesión abierta y ve cómo abrir o instalar la app.
   Quien compró con su cuenta o con un correo que ya tenía cuenta solo ve que está listo: aquí nunca se le toca la contraseña ni se le abre sesión sin que la ponga. Ver `compra-lista`. */

const abre = () => { window.location.assign('/'); };

function PonerContrasena({ datos, llave, alGuardar }) {
  const { signIn } = useAuth();
  const [clave, setClave] = useState('');
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const envia = async (e) => {
    e.preventDefault();
    const problema = problemaDeContrasena(clave, { correo: datos.correo });
    if (problema) { setError(problema); return; }
    setGuardando(true);
    setError(null);
    try {
      const correo = await ponContrasenaDeCompra(llave, clave);
      const { error: errEntrada } = await signIn(correo, clave);
      if (errEntrada) throw new Error('Tu contraseña quedó guardada, pero no se abrió tu sesión. Entra desde Training Lab con tu correo y tu contraseña.');
      alGuardar();
    } catch (err) {
      setError(err?.message ?? 'No se pudo guardar tu contraseña.');
      setGuardando(false);
    }
  };

  return (
    <form onSubmit={envia} style={{ background: LT.surface, borderRadius: 20, padding: 16, boxShadow: '0 1px 4px rgba(17,19,24,0.06)', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontSize: 17, fontWeight: 800 }}>Crea tu contraseña</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15, fontWeight: 600, overflowWrap: 'anywhere' }}><Mail size={18} color={LT.blue} style={{ flexShrink: 0 }} /> {datos.correo}</div>
      <Field icon={Lock} label="Contraseña" type="password" value={clave} onChange={(e) => { setClave(e.target.value); setError(null); }} autoComplete="new-password" autoFocus placeholder="Mínimo 8 caracteres" />
      {error && <div role="alert" style={{ padding: '9px 12px', borderRadius: 12, background: '#FDECEC', color: LT.danger, fontSize: 14, fontWeight: 700 }}>{error}</div>}
      <button type="submit" disabled={guardando || !clave} style={botonAzul(guardando || !clave)}>
        {guardando ? <Loader2 size={20} className="spin" /> : <Check size={20} strokeWidth={3} />} Guardar y entrar
      </button>
    </form>
  );
}

export default function CompraLista() {
  const llave = useMemo(() => llaveDeLaLiga(window.location.search), []);
  const { user } = useAuth();
  const [datos, setDatos] = useState(undefined);       // undefined = todavía no contesta
  const [intentos, setIntentos] = useState(0);
  const [vuelta, setVuelta] = useState(0);             // sube al tocar «Revisar otra vez»

  // Mientras Stripe y el servidor terminan de confirmar el pago, se pregunta cada pocos segundos (con tope). No se mueve nada de la pantalla.
  useEffect(() => {
    if (!llave) return undefined;
    let vivo = true;
    let espera;
    const pregunta = async (n) => {
      const r = await leeCompraLista(llave);
      if (!vivo) return;
      setDatos(r);
      setIntentos(n + 1);
      if (hayQueSeguirEsperando(etapaDeCompra(r), n + 1)) espera = setTimeout(() => pregunta(n + 1), SEGUNDOS_ENTRE_INTENTOS * 1000);
    };
    pregunta(0);
    return () => { vivo = false; clearTimeout(espera); };
  }, [llave, vuelta]);

  if (!llave) return <Aviso titulo="No encontramos esta compra" texto="Abre la liga completa que te dio la página de pago, o entra a Training Lab con tu correo." boton="Ir a Training Lab" alTocar={abre} />;
  if (datos === undefined) return <Marco><div role="status" aria-label="Confirmando tu pago" style={{ display: 'flex', justifyContent: 'center', padding: 48, color: LT.text2 }}><Loader2 size={22} className="spin" /></div></Marco>;

  const etapa = etapaDeCompra(datos);
  if (etapa === 'desconocida') return <Aviso titulo="No encontramos esta compra" texto="Revisa que abriste la liga completa. Si ya pagaste, entra a Training Lab con tu correo y ahí estará tu plan." boton="Ir a Training Lab" alTocar={abre} />;
  if (etapa === 'cancelada') return <Aviso titulo="La compra se canceló" texto="No se hizo ningún cobro." boton="Ir a Training Lab" alTocar={abre} />;
  if (etapa === 'cerrada') return <Aviso titulo="Esta compra ya no está activa" texto="Entra a Training Lab con tu cuenta para ver tus planes." boton="Ir a Training Lab" alTocar={abre} />;

  if (etapa === 'esperando') {
    if (hayQueSeguirEsperando(etapa, intentos)) {
      return (
        <Marco>
          <div role="status" style={{ background: LT.surface, borderRadius: 20, padding: '40px 22px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, boxShadow: '0 1px 4px rgba(17,19,24,0.06)' }}>
            <Loader2 size={28} className="spin" color={LT.blue} />
            <div style={{ fontSize: 19, fontWeight: 800 }}>Confirmando tu pago…</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: LT.text2 }}>Son unos segundos. No cierres esta página.</div>
          </div>
        </Marco>
      );
    }
    return (
      <Aviso
        titulo="Tu pago está tardando"
        texto="No pagues otra vez. En unos minutos tu plan aparecerá al entrar a Training Lab con tu correo."
        boton="Revisar otra vez" alTocar={() => { setDatos(undefined); setIntentos(0); setVuelta((v) => v + 1); }}
      />
    );
  }

  const coach = datos.coach?.nombre || datos.coach?.usuario;
  return (
    <Marco>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ background: LT.surface, borderRadius: 20, padding: '28px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, boxShadow: '0 1px 4px rgba(17,19,24,0.06)' }}>
          <span style={{ width: 52, height: 52, borderRadius: 26, background: LT.mint, color: '#fff', display: 'grid', placeItems: 'center' }}><Check size={28} strokeWidth={3} /></span>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.3 }}>Listo, ya es tuyo</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: LT.text, overflowWrap: 'anywhere' }}>{datos.titulo}</div>
          {coach && <div style={{ fontSize: 14.5, fontWeight: 600, color: LT.text2 }}>de {coach}</div>}
        </div>

        {etapa === 'contrasena' && <PonerContrasena datos={datos} llave={llave} alGuardar={() => setDatos({ ...datos, puede_poner_contrasena: false })} />}

        {etapa === 'listo' && (
          <>
            <button type="button" onClick={abre} style={botonAzul(false)}>Abrir Training Lab</button>
            {!user && datos.correo && (
              <div style={{ fontSize: 14.5, fontWeight: 600, color: LT.text2, lineHeight: 1.45, textAlign: 'center', fontFamily: FONT }}>
                Entra con <b style={{ color: LT.text }}>{datos.correo}</b> y tu contraseña para ver tu plan.
                {' '}¿Todavía no pusiste una? En «Entrar» toca «¿Olvidaste tu contraseña?» y te mandamos un enlace a ese correo para crearla.
              </div>
            )}
            <InstalarApp correo={datos.correo} />
          </>
        )}
      </div>
    </Marco>
  );
}
