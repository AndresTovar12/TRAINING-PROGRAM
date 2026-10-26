import { useEffect, useState } from 'react';
import { Download, LifeBuoy, Loader2, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import CorreoDeLaCuenta from '@/features/profile/CorreoDeLaCuenta';
import CambiarContrasena from '@/features/profile/CambiarContrasena';
import { descargaComoArchivo, eliminaMiCuenta, misDatos, resumenDeMiCuenta } from '@/lib/miCuentaApi';
import { FONT, KP } from '@/lib/theme';
import HojaFlotante from '@/components/HojaFlotante';
import { useConfirmacion } from '@/components/Confirmacion';
import { useAviso } from '@/components/AvisoPasajero';
import { Boton, Campo, Fila, Grupo, IconoDeFila } from '@/components/ui';
import { Aviso } from '@/features/profile/piezas';

/* LA PESTAÑA «CUENTA» de Mi perfil (15 oct 2026). Andrés: «hay temas de administración que no tenemos resueltos: que alguien elimine su cuenta, dónde administra
   sus contraseñas…». Aquí vive lo de la cuenta en sí (no lo del perfil): correo, contraseña, sesiones abiertas, descargar sus datos y eliminarla.
   Eliminarla es obligatorio para publicar en la App Store: quien puede crear una cuenta debe poder iniciar su eliminación desde la app. */

/* Reestructura visual (15 oct 2026), como «Cuenta» de las capturas de Andrés: renglones en grupos. Correo y contraseña abren su hoja;
   cerrar las demás sesiones pregunta antes; eliminar la cuenta abre su hoja con todo lo que pide. */

function Sesiones() {
  const pregunta = useConfirmacion();
  const { trabajando, avisa } = useAviso();
  async function cierraLasDemas() {
    const va = await pregunta({ titulo: '¿Cerrar sesión en los demás aparatos?', detalle: 'Aquí sigues dentro. En cualquier otro teléfono o compu tendrás que volver a entrar.', confirmar: 'Sí, cerrarlas' });
    if (!va) return;
    try {
      await trabajando('Cerrando…', async () => {
        const { error } = await supabase.auth.signOut({ scope: 'others' });
        if (error) throw error;
      }, 'Listo: se cerró en los demás aparatos');
    } catch {
      avisa('No se pudo. Inténtalo de nuevo.');
    }
  }
  return <Fila texto="Cerrar sesión en los demás aparatos" detalle="Si dejaste tu cuenta abierta en otro lado" onClick={cierraLasDemas} />;
}

/* El contacto de soporte tiene que estar a la vista (Apple lo exige): un toque abre el correo. */
export const CORREO_DE_SOPORTE = 'soporte@traininglabapp.com';
function Soporte() {
  return (
    <Fila
      izquierda={<IconoDeFila><LifeBuoy size={18} /></IconoDeFila>} texto="Contactar a soporte" detalle={CORREO_DE_SOPORTE}
      onClick={() => { window.location.href = `mailto:${CORREO_DE_SOPORTE}?subject=${encodeURIComponent('Training Lab: ayuda')}`; }}
    />
  );
}

function MisDatos() {
  const { trabajando, avisa } = useAviso();
  async function descarga() {
    try {
      await trabajando('Preparando tus datos…', async () => {
        const datos = await misDatos();
        await descargaComoArchivo(datos, `mis-datos-training-lab-${new Date().toISOString().slice(0, 10)}.json`);
      }, 'Listo: tus datos están en el archivo');
    } catch (e) {
      avisa(e.message || 'No se pudo descargar.');
    }
  }
  return <Fila izquierda={<IconoDeFila><Download size={18} /></IconoDeFila>} texto="Descargar mis datos" detalle="Perfil, planes, entrenos, mensajes y compras" onClick={descarga} />;
}

function EliminarCuenta() {
  const [abierto, setAbierto] = useState(false);
  const [r, setR] = useState(null); // el resumen de lo que se llevaría
  const [contrasena, setContrasena] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!abierto || r) return;
    let vivo = true;
    resumenDeMiCuenta().then((x) => { if (vivo) setR(x); }).catch((e) => { if (vivo) setError(e.message); });
    return () => { vivo = false; };
  }, [abierto, r]);

  // A nadie se le niega borrar su cuenta (26 oct 2026): solo el dueño no puede. Con compras activas el servidor cierra los cobros por su cuenta.
  const bloqueada = r && r.es_dueno;
  const puede = r && !bloqueada && confirmacion.trim().toUpperCase() === 'ELIMINAR' && (!r.tiene_contrasena || contrasena) && !busy;

  async function elimina(e) {
    e.preventDefault();
    if (!puede) return;
    setBusy(true); setError('');
    try {
      await eliminaMiCuenta({ confirmacion: confirmacion.trim(), contrasena });
      await supabase.auth.signOut().catch(() => {});
      window.location.assign('/');
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  const cierra = () => { setAbierto(false); setR(null); setError(''); setContrasena(''); setConfirmacion(''); };
  return (
    <>
      <Fila texto="Eliminar mi cuenta" tono="peligro" detalle="Se borran tus datos. No se puede deshacer." onClick={() => setAbierto(true)} />
      {abierto && (
        <HojaFlotante titulo="Eliminar mi cuenta" onCerrar={cierra} ancho={480}>
          <form onSubmit={elimina} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 12, fontFamily: FONT }}>
            <Aviso tono="malo">Se borran para siempre tu perfil, tus planes, tus entrenos, tus mensajes y tus compras. No se puede deshacer.</Aviso>
            {!r && !error && <div style={{ fontSize: 14, color: KP.ink2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}><Loader2 size={15} className="spin" /> Revisando tu cuenta…</div>}
            {r?.es_coach && !bloqueada && (
              <Aviso tono="azul">
                {r.atletas > 0 ? `Tus ${r.atletas} atleta${r.atletas === 1 ? '' : 's'} se quedan sin coach (sus cuentas y sus planes siguen). ` : ''}
                También se borran tus ejercicios y plantillas.
              </Aviso>
            )}
            {r?.es_dueno && <Aviso tono="malo">La cuenta del administrador no se elimina desde aquí.</Aviso>}
            {r?.membresias_activas > 0 && !bloqueada && (
              <Aviso tono="azul">
                {r.membresias_activas === 1 ? 'Tu membresía activa se cancela' : `Tus ${r.membresias_activas} membresías activas se cancelan`} al eliminar tu cuenta. No se reembolsa lo que ya pagaste.
              </Aviso>
            )}
            {r?.compradores_activos > 0 && !bloqueada && (
              <Aviso tono="azul">
                {r.compradores_activos === 1 ? 'Tu comprador activo conserva su plan' : `Tus ${r.compradores_activos} compradores activos conservan su plan`} hasta que termine, y no se les cobra más después de su última semana. Tú dejas de recibir esos pagos.
              </Aviso>
            )}
            {r && !bloqueada && (
              <>
                {r.tiene_contrasena && <Campo etiqueta="Tu contraseña" tipo="password" grande={false} valor={contrasena} onCambio={setContrasena} autoComplete="current-password" />}
                {/* estilo-ok: ELIMINAR es la palabra que se teclea para confirmar */}
                <Campo etiqueta="Para confirmar, escribe ELIMINAR" grande={false} valor={confirmacion} onCambio={setConfirmacion} marcador="ELIMINAR" autoCapitalize="characters" autoCorrect="off" spellCheck={false} />
              </>
            )}
            {error && <Aviso tono="malo" role="alert">{error}</Aviso>}
            {r && !bloqueada && (
              <Boton type="submit" ancho deshabilitado={!puede} cargando={busy} icono={Trash2} estilo={{ background: KP.danger, color: '#fff', boxShadow: 'none' }}>Eliminar para siempre</Boton>
            )}
            <Boton tipo="secundario" ancho onClick={cierra}>Mejor no</Boton>
          </form>
        </HojaFlotante>
      )}
    </>
  );
}

export default function ConfiguracionDeCuenta() {
  return (
    <>
      <Grupo>
        <CorreoDeLaCuenta />
        <CambiarContrasena />
      </Grupo>
      <Grupo titulo="Seguridad">
        <Sesiones />
      </Grupo>
      <Grupo titulo="Ayuda">
        <Soporte />
      </Grupo>
      <Grupo titulo="Tus datos">
        <MisDatos />
      </Grupo>
      <Grupo titulo="Zona de cuidado">
        <EliminarCuenta />
      </Grupo>
    </>
  );
}
