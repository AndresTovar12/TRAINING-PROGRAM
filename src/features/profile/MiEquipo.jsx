import { useCallback, useEffect, useState } from 'react';
import { Check, Loader2, UserMinus, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePalabras } from '@/contexts/PalabrasContext';
import { useConfirmacion } from '@/components/Confirmacion';
import {
  nombresDelEquipo, profesionalPorReferencia, agregarAMiEquipo, quitarDeMiEquipo,
  aceptarInvitacionDeEquipo, rechazarInvitacionDeEquipo,
} from '@/lib/api';
import { FONT, KP, oficioCorto } from '@/lib/theme';
import { useAviso } from '@/components/AvisoPasajero';
import HojaFlotante from '@/components/HojaFlotante';
import { Avatar, Boton, Campo, Fila, Grupo, TarjetaHeroe } from '@/components/ui';
import { Aviso } from '@/features/profile/piezas';

/* «Mi equipo»: quién atiende a este atleta. Su coach principal (no se quita desde
   aquí) y los profesionales de su equipo, que ÉL decide: acepta o rechaza las
   invitaciones, quita a quien ya no quiere y agrega a alguien con su código o
   @usuario. Quitar no borra nada: esa persona deja de verlo al instante y, si
   la vuelve a agregar, todo regresa. */

export default function MiEquipo() {
  const { user, refreshProfile } = useAuth();
  const { t } = usePalabras();
  const pregunta = useConfirmacion();
  const [equipo, setEquipo] = useState(null); // null = cargando
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(null); // id de quien se está procesando
  const [ref, setRef] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [encontrado, setEncontrado] = useState(null);
  const [agregando, setAgregando] = useState(false);
  const [abierta, setAbierta] = useState(null); // la persona cuya hoja está abierta
  const { avisa } = useAviso();
  const setAviso = (m) => { if (m) avisa(m); };

  const yo = user?.id;
  const cargar = useCallback(async () => {
    if (!yo) return;
    try {
      setEquipo(await nombresDelEquipo(yo));
    } catch (e) {
      setEquipo([]);
      setError(e.message || 'No se pudo leer tu equipo.');
    }
  }, [yo]);

  useEffect(() => {
    let vivo = true;
    (async () => { if (vivo) await cargar(); })();
    return () => { vivo = false; };
  }, [cargar]);

  const hacer = async (idPersona, accion, mensaje) => {
    setOcupado(idPersona);
    setError('');
    setAviso('');
    try {
      await accion();
      if (mensaje) setAviso(mensaje);
      await cargar();
    } catch (e) {
      setError(e.message || 'No se pudo hacer.');
    } finally {
      setOcupado(null);
    }
  };

  async function quitar(persona) {
    const nombre = persona.full_name || persona.username;
    const va = await pregunta({
      titulo: `¿Quitar a ${nombre} de tu equipo?`,
      detalle: 'Dejará de ver tu plan y cómo vas. No se borra nada: si lo vuelves a agregar, todo regresa.',
      confirmar: 'Sí, quitar',
      peligro: true,
    });
    if (!va) return;
    await hacer(persona.profesional_id, () => quitarDeMiEquipo(persona.profesional_id), `${nombre} ya no está en tu equipo.`);
  }

  async function buscar(e) {
    e.preventDefault();
    const limpio = ref.trim().replace(/^@/, '');
    if (!limpio) return;
    setBuscando(true);
    setError('');
    setAviso('');
    setEncontrado(null);
    try {
      const p = await profesionalPorReferencia(limpio);
      if (!p) setError('No encontramos a nadie con ese código o usuario.');
      else setEncontrado({ ...p, ref: limpio });
    } catch (e2) {
      setError(e2.message || 'No se pudo buscar.');
    } finally {
      setBuscando(false);
    }
  }

  async function agregar() {
    if (!encontrado) return;
    setOcupado('agregando');
    setError('');
    try {
      const r = await agregarAMiEquipo(encontrado.ref);
      const nombre = encontrado.full_name || 'Esa persona';
      setAviso(r?.tipo === 'principal' ? `Listo: ${nombre} ahora es tu coach.` : `Listo: ${nombre} ya está en tu equipo.`);
      setEncontrado(null);
      setRef('');
      setAgregando(false);
      if (r?.tipo === 'principal') await refreshProfile?.();
      await cargar();
    } catch (e) {
      setError(e.message || 'No se pudo agregar.');
    } finally {
      setOcupado(null);
    }
  }

  const principal = (equipo ?? []).find((p) => p.es_principal);
  const activos = (equipo ?? []).filter((p) => !p.es_principal && p.estado === 'activo');
  const pendientes = (equipo ?? []).filter((p) => !p.es_principal && p.estado === 'pendiente');

  const oficioDe = (p) => oficioCorto(p.profesion) || null;
  const cierraAgregar = () => { setAgregando(false); setEncontrado(null); setRef(''); setError(''); };

  /* Reestructura visual (15 oct 2026), como «Mi equipo» de las capturas: su coach en la tarjeta azul, quien más lo atiende en «También te ven»
     (tocar a alguien abre su hoja con «Quitar»), las invitaciones con Aceptar/Rechazar y «Agregar con un código» en su hoja. */
  if (equipo === null) return <div style={{ display: 'grid', placeItems: 'center', padding: 30 }}><Loader2 size={22} className="spin" color={KP.ink2} /></div>;
  return (
    <>
      {error && !agregando && <Aviso tono="malo" role="alert">{error}</Aviso>}
      {principal ? (
        <TarjetaHeroe etiqueta={t('Tu coach principal')} titulo={principal.full_name || principal.username} detalle={[oficioDe(principal), t('te arma el plan')].filter(Boolean).join(' · ')} />
      ) : (
        <Grupo><Fila texto={t('Aún no tienes coach')} detalle="Agrégalo con su código" onClick={() => setAgregando(true)} /></Grupo>
      )}

      {pendientes.length > 0 && (
        <Grupo titulo="Quieren atenderte">
          {pendientes.map((p) => (
            <Fila
              key={p.profesional_id} izquierda={<Avatar nombre={p.full_name || p.username} foto={p.avatar_url} tamano={40} />}
              texto={p.full_name || p.username} detalle={oficioDe(p)}
              derecha={(
                <span style={{ display: 'flex', gap: 6 }}>
                  <Boton tipo="secundario" chico icono={X} aria-label={`Rechazar a ${p.full_name || p.username}`} deshabilitado={ocupado === p.profesional_id}
                    onClick={() => hacer(p.profesional_id, () => rechazarInvitacionDeEquipo(p.profesional_id))} />
                  <Boton chico cargando={ocupado === p.profesional_id}
                    onClick={() => hacer(p.profesional_id, () => aceptarInvitacionDeEquipo(p.profesional_id), `${p.full_name || 'Esa persona'} ya está en tu equipo`)}>Aceptar</Boton>
                </span>
              )}
            />
          ))}
        </Grupo>
      )}

      {activos.length > 0 && (
        <Grupo titulo="También te ven">
          {activos.map((p) => (
            <Fila
              key={p.profesional_id} izquierda={<Avatar nombre={p.full_name || p.username} foto={p.avatar_url} tamano={40} />}
              texto={p.full_name || p.username} detalle={[oficioDe(p), p.alta_en ? 'te dio de alta' : null].filter(Boolean).join(' · ') || null}
              onClick={() => setAbierta(p)}
            />
          ))}
        </Grupo>
      )}

      <Grupo>
        <Fila texto="Agregar con un código" tono="enlace" detalle="El código o @usuario de tu coach o fisio" onClick={() => setAgregando(true)} />
      </Grupo>

      {abierta && (
        <HojaFlotante titulo={abierta.full_name || abierta.username} subtitulo={oficioDe(abierta) ?? undefined} onCerrar={() => setAbierta(null)} ancho={440}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontFamily: FONT }}>
            <p style={{ margin: '0 6px', fontSize: 15, color: KP.ink2, lineHeight: 1.5 }}>Ve tu plan de entrenamiento y cómo vas. Si lo quitas no se borra nada: si lo vuelves a agregar, todo regresa.</p>
            <Boton tipo="peligro" ancho icono={UserMinus} cargando={ocupado === abierta.profesional_id} onClick={async () => { await quitar(abierta); setAbierta(null); }}>Quitar de mi equipo</Boton>
          </div>
        </HojaFlotante>
      )}

      {agregando && (
        <HojaFlotante titulo="Agregar con un código" onCerrar={cierraAgregar} ancho={460}>
          <form onSubmit={buscar} style={{ display: 'flex', flexDirection: 'column', gap: 12, fontFamily: FONT }}>
            <Campo
              etiqueta="Código o @usuario" valor={ref} onCambio={(v) => { setRef(v); setEncontrado(null); setError(''); }} marcador="AT-4821 o @usuario"
              autoCapitalize="none" spellCheck={false} autoFocus
            />
            {!encontrado && <Boton ancho type="submit" cargando={buscando} deshabilitado={!ref.trim()}>Buscar</Boton>}
            {error && <Aviso tono="malo" role="alert">{error}</Aviso>}
            {encontrado && (
              <>
                <Grupo>
                  <Fila izquierda={<Avatar nombre={encontrado.full_name} tamano={40} />} texto={encontrado.full_name} detalle={oficioDe(encontrado)} />
                </Grupo>
                <p style={{ margin: '0 6px', fontSize: 14.5, color: KP.ink2, lineHeight: 1.45 }}>Podrá ver tu plan de entrenamiento y cómo vas. Tú decides: puedes quitarlo cuando quieras.</p>
                <Boton ancho icono={Check} cargando={ocupado === 'agregando'} onClick={async () => { await agregar(); }}>Agregar a mi equipo</Boton>
              </>
            )}
          </form>
        </HojaFlotante>
      )}
    </>
  );
}
