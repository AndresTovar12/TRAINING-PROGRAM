import { useState } from 'react';
import { Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { esCorreoInventado, correoValido, correoPorConfirmar, olvidaCorreoPorConfirmar } from '@/lib/correos';
import { confirmaCodigoDeCorreo, pideCodigoDeCorreo } from '@/lib/correoDeLaCuentaApi';
import { FONT, KP } from '@/lib/theme';
import HojaFlotante from '@/components/HojaFlotante';
import { Boton, Campo, Fila } from '@/components/ui';
import { Aviso } from '@/features/profile/piezas';

/* EL CORREO DE LA CUENTA en Mi perfil (15 oct 2026). Andrés: que cada quien pueda poner o cambiar su correo.

   Quien se creó sin correo tiene uno inventado que nadie recibe: aquí se ve «Sin correo». Se escribe el correo y la contraseña actual, llega un código de
   6 números a ese correo, se escribe aquí, y queda puesto. Desde ahí sirve «¿Olvidaste tu contraseña?». Quien entró solo con Google ve su correo de Google
   y no lo cambia aquí.
   Reestructura visual (15 oct 2026): un renglón «Correo ..... andres@correo.com ›» que abre una hoja con los dos pasos. */

export default function CorreoDeLaCuenta() {
  const { user, refreshProfile } = useAuth();
  const proveedores = user?.app_metadata?.providers ?? ['email'];
  const soloGoogle = !proveedores.includes('email');
  const actual = user?.email ?? '';
  const sinCorreo = !actual || esCorreoInventado(actual);
  // El correo con el que se registró y que aún no confirma con el código (ver `supabase/functions/signup`). Solo cuenta mientras la cuenta siga sin correo.
  const porConfirmar = sinCorreo ? correoPorConfirmar() : '';

  const [paso, setPaso] = useState(null); // null | 'pedir' | 'codigo'
  const [correo, setCorreo] = useState(porConfirmar);
  const [contrasena, setContrasena] = useState('');
  const [codigo, setCodigo] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [listo, setListo] = useState('');

  const cierra = () => { setPaso(null); setError(''); setCodigo(''); setContrasena(''); };

  async function pide(e) {
    e?.preventDefault();
    if (busy) return;
    setError('');
    if (!correoValido(correo)) { setError('Escribe tu correo completo, por ejemplo nombre@gmail.com.'); return; }
    if (!contrasena) { setError('Escribe tu contraseña actual.'); return; }
    setBusy(true);
    try {
      await pideCodigoDeCorreo(correo.trim(), contrasena);
      setPaso('codigo');
      setCodigo('');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function confirma(e) {
    e.preventDefault();
    if (busy) return;
    setError('');
    if (!/^\d{6}$/.test(codigo)) { setError('El código tiene 6 números.'); return; }
    setBusy(true);
    try {
      const r = await confirmaCodigoDeCorreo(codigo);
      // La sesión guarda el correo viejo: se renueva para que toda la app vea el nuevo.
      await supabase.auth.refreshSession().catch(() => {});
      await refreshProfile?.();
      setListo(r.correo);
      olvidaCorreoPorConfirmar();
      cierra();
    } catch (err) {
      setError(err.message);
      if (err.codigo === 'VENCIDO') setPaso('pedir');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Fila
        texto="Correo" valor={listo || (sinCorreo ? 'Sin correo' : actual)} valorTono={sinCorreo && !listo ? 'neutro' : 'azul'}
        detalle={soloGoogle ? 'Es el de tu cuenta de Google.' : sinCorreo && !listo && porConfirmar ? `Falta confirmar ${porConfirmar}: toca y escribe el código que te mandamos.` : sinCorreo && !listo ? 'Agrégalo para recuperar tu contraseña si la olvidas.' : null}
        onClick={soloGoogle ? undefined : () => { setPaso(porConfirmar ? 'codigo' : 'pedir'); if (porConfirmar) setCorreo(porConfirmar); setListo(''); setError(''); setCodigo(''); }}
      />

      {paso && (
        <HojaFlotante titulo={sinCorreo ? 'Agregar correo' : 'Cambiar correo'} onCerrar={cierra} ancho={460}>
          {paso === 'pedir' && (
            <form onSubmit={pide} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 12, fontFamily: FONT }}>
              <Campo
                etiqueta={sinCorreo ? 'Tu correo' : 'Correo nuevo'} tipo="email" grande={false} valor={correo} onCambio={setCorreo} marcador="nombre@gmail.com"
                inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} autoFocus
              />
              <Campo etiqueta="Tu contraseña actual" tipo="password" grande={false} valor={contrasena} onCambio={setContrasena} autoComplete="current-password" />
              {error && <Aviso tono="malo" role="alert">{error}</Aviso>}
              <Boton ancho type="submit" cargando={busy}>Mandarme el código</Boton>
            </form>
          )}
          {paso === 'codigo' && (
            <form onSubmit={confirma} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 12, fontFamily: FONT }}>
              <p style={{ margin: '0 4px', fontSize: 15, fontWeight: 500, color: KP.ink, lineHeight: 1.5 }}>
                Te mandamos un código de 6 números a <b>{correo.trim()}</b>. Revisa también spam.
              </p>
              <Campo
                etiqueta="Código" valor={codigo} onCambio={(v) => setCodigo(v.replace(/\D/g, '').slice(0, 6))} marcador="000000"
                inputMode="numeric" autoComplete="one-time-code" maxLength={6} autoFocus
                style={{ display: 'block', width: '100%', border: 'none', outline: 'none', background: 'transparent', padding: 0, marginTop: 3, fontFamily: FONT, fontSize: 28, fontWeight: 800, letterSpacing: 10, color: KP.ink, fontVariantNumeric: 'tabular-nums' }}
              />
              {error && <Aviso tono="malo" role="alert">{error}</Aviso>}
              <Boton ancho type="submit" cargando={busy} deshabilitado={codigo.length !== 6}>Confirmar</Boton>
              <Boton tipo="secundario" ancho onClick={() => { setPaso('pedir'); setError(''); }}>Mandar otro</Boton>
            </form>
          )}
        </HojaFlotante>
      )}
      {listo && (
        <div role="status" className="ui-fila" style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '0 16px 12px', fontSize: 13.5, fontWeight: 700, color: KP.mint }}>
          <Check size={16} strokeWidth={3} /> Listo: ya quedó tu correo
        </div>
      )}
    </>
  );
}
