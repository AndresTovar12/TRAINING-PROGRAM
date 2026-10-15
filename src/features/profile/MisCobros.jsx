import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { cobrosDeMiCuenta, conectaCobros } from '@/lib/miDineroApi';
import { useLugares } from '@/features/admin/useLugares';
import { etiquetaDeLugares } from '@/lib/limiteDeAtletas';
import { useAuth } from '@/contexts/AuthContext';
import { Aviso, pesos } from '@/features/profile/piezas';
import { Fila, Grupo, IconoDeFila, Pastilla, TarjetaHeroe } from '@/components/ui';
import SinLugares from '@/features/admin/SinLugares';
import { T } from '@/lib/theme';

/* «COBROS» (profesional) en Mi perfil (15 oct 2026). Andrés: lo mismo que el atleta, y además su cuenta de cobro: si Stripe está conectado, cuánto ha vendido, cuándo le depositan.
   El profesional conecta su cuenta con Stripe (sus datos y su banco los pide Stripe, nunca la app) y aquí ve cómo va. Todo lo de Stripe se enciende con sus llaves: antes dice «Pronto». */

/* Reestructura visual (15 oct 2026), como «Cobros» de las capturas de Andrés: tarjeta azul con lo vendido este mes, la cuenta de cobro como lista
   (Stripe, depósitos, datos fiscales), lo que él paga (sus lugares de atletas y la comisión) y los últimos cobros. Todo lo de Stripe se enciende con sus llaves. */
export default function MisCobros() {
  const { profile } = useAuth();
  const lugares = useLugares();
  const [r, setR] = useState(undefined);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [verLugares, setVerLugares] = useState(false);

  const lee = useCallback(async () => {
    try { setR(await cobrosDeMiCuenta()); setError(''); } catch (e) { setError(e.message || 'No se pudieron leer tus cobros.'); setR({}); }
  }, []);
  useEffect(() => { lee(); }, [lee]);

  async function abre(accion) {
    setBusy(accion); setError('');
    try {
      const { url } = await conectaCobros(accion);
      if (url) window.location.assign(url);
    } catch (e) {
      setError(e.codigo === 'NO_DISPONIBLE' ? 'Los cobros se activan muy pronto. Te avisamos cuando puedas conectar tu cuenta.' : e.message);
    } finally {
      setBusy('');
    }
  }

  if (r === undefined) return <div style={{ display: 'grid', placeItems: 'center', padding: 30 }}><Loader2 size={22} className="spin" color={T.text2} /></div>;
  const cuenta = r.cuenta ?? null;
  const lista = !!(cuenta?.onboarding_completo && cuenta?.cobros_ok && cuenta?.depositos_ok);
  const pendientes = Array.isArray(cuenta?.requisitos_pendientes) ? cuenta.requisitos_pendientes.length : 0;
  const comision = Math.round(Number(r.comision_actual ?? 0.2) * 1000) / 10;
  const girando = (que) => (busy === que ? <Loader2 size={17} className="spin" color={T.text2} /> : undefined);

  return (
    <>
      {profile?.vitrina_suspendida && <Aviso tono="aviso">Tu vitrina está suspendida: tus planes no se ven ni se venden por ahora. Escríbenos a contacto@traininglabapp.com.</Aviso>}
      {error && <Aviso tono="malo" role="alert">{error}</Aviso>}

      <TarjetaHeroe
        etiqueta="Vendido este mes" titulo={pesos(r.ventas_mes_bruto)}
        detalle={`Te quedas ${pesos(r.ventas_mes_neto)} · ${r.compradores_activos ?? 0} compradores activos`}
      />

      <Grupo titulo="Cuenta de cobro">
        <Fila
          izquierda={<IconoDeFila color="#635BFF" fondo="#EEEDFF">S</IconoDeFila>} texto="Stripe"
          detalle={lista ? `Conectada${cuenta.depositos ? ` · ${cuenta.depositos}` : ''}` : cuenta ? `Le faltan datos${pendientes ? ` (${pendientes})` : ''}` : 'Sin conectar'}
          derecha={girando('conectar') ?? <Pastilla tono={lista ? 'ok' : cuenta ? 'aviso' : 'neutro'}>{lista ? 'Activa' : cuenta ? 'Falta terminar' : 'Sin conectar'}</Pastilla>}
          onClick={lista ? undefined : () => abre('conectar')}
        />
        {!lista && <Fila texto={cuenta ? 'Terminar de conectar' : 'Conectar mis cobros'} tono="enlace" onClick={() => abre('conectar')} />}
        <Fila texto="Depósitos" detalle="Cuándo y cuánto te depositan" derecha={girando('panel')} onClick={() => abre('panel')} deshabilitada={!cuenta} />
        <Fila texto="Datos fiscales" detalle="Tu RFC y facturas, en Stripe" onClick={() => abre('panel')} deshabilitada={!cuenta} />
      </Grupo>

      <Grupo titulo="Lo que tú pagas">
        {lugares && !lugares.ilimitado && (
          <Fila texto="Tus atletas a mano" detalle="Quien compra un plan tuyo no cuenta" valor={etiquetaDeLugares(lugares)} onClick={() => setVerLugares(true)} />
        )}
        <Fila texto="Comisión de Training Lab" valor={`${comision} %`} valorTono="neutro" />
      </Grupo>

      {(r.ultimos ?? []).length > 0 ? (
        <Grupo titulo="Últimos cobros">
          {r.ultimos.map((u, i) => (
            <Fila
              key={i} texto={u.titulo}
              detalle={`${new Date(u.fecha).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}${u.estado !== 'cobrado' ? ` · ${u.estado}` : ''} · de ${pesos(u.bruto)}`}
              valor={pesos(u.parte_coach)} valorTono={u.estado === 'cobrado' ? 'ok' : 'neutro'}
            />
          ))}
        </Grupo>
      ) : (
        <Grupo titulo="Últimos cobros" pie="Cuando vendas un plan, aquí ves cada cobro y lo que te quedas."><Fila texto="Todavía sin ventas" valor="—" valorTono="neutro" /></Grupo>
      )}

      {verLugares && lugares && <SinLugares lugares={lugares} onCerrar={() => setVerLugares(false)} />}
    </>
  );
}
