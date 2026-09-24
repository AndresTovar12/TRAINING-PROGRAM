import { useEffect, useState } from 'react';
import { AtSign, Dumbbell, Loader2, Lock, Mail, User as UserIcon } from 'lucide-react';
import { Field } from '@/features/auth/AuthScreen';
import { useAuth } from '@/contexts/AuthContext';
import { activarInvitacion, verInvitacion } from '@/lib/api';
import { FONT, KP } from '@/lib/theme';

/**
 * Lo que ve el atleta cuando abre el link que le mandó su entrenador.
 *
 * Andrés, 24 sep 2026: "cuando lo abra ya no tiene que llenar ni su nombre ni
 * su apellido ni su coach, porque es información que ya tiene, solo tiene que
 * llenar el resto de la información para su cuenta".
 *
 * De ahí el saludo por su nombre antes de pedirle nada: un link que abre un
 * formulario en blanco no se distingue de uno falso. Ver su nombre y el de su
 * entrenador es lo que hace que se fíe y siga.
 */
export default function ActivarInvitacion({ token, onSalir }) {
  const { signIn } = useAuth();
  const [cargando, setCargando] = useState(true);
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');

  /* El usuario nace VACÍO, a propósito. Andrés, 24 sep 2026: "eliges por el
     cliente su usuario, justo eso es lo que le tienes que dejar a él que
     elija". Lo que sí viene puesto es su nombre, que el coach ya sabe — y
     también se puede corregir, por si lo escribió mal o prefiere otro. */
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [genero, setGenero] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    let vivo = true;
    verInvitacion(token)
      .then((d) => {
        if (!vivo) return;
        setDatos(d);
        setNombre(d.nombre || '');
        setApellido(d.apellido || '');
      })
      .catch((e) => { if (vivo) setError(e.message); })
      .finally(() => { if (vivo) setCargando(false); });
    return () => { vivo = false; };
  }, [token]);

  async function enviar(e) {
    e.preventDefault();
    setError('');
    setEnviando(true);
    try {
      const r = await activarInvitacion({ token, username, password, email, genero, nombre, apellido });
      // Ya con la cuenta lista, se entra solo. Pedirle que escriba otra vez lo
      // que acaba de teclear sería un paso de más sin ningún motivo.
      const { error: errEntrar } = await signIn(r.username, password);
      if (errEntrar) throw new Error(errEntrar.message);
      // Se limpia la dirección para que el link no quede en el historial ni se
      // reabra esta pantalla al recargar.
      onSalir?.();
    } catch (err) {
      setError(err.message);
      setEnviando(false);
    }
  }

  const marco = (hijos) => (
    <div
      style={{
        minHeight: '100svh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20, fontFamily: FONT,
        background:
          'radial-gradient(1100px 620px at 50% -8%, #e7ecfe 0%, rgba(244,245,248,0) 60%), #f4f5f8',
      }}
    >
      <div style={{ width: '100%', maxWidth: 412 }}>
        <div
          className="animate-fade-in"
          style={{
            width: '100%', background: KP.surface, borderRadius: 28, padding: '36px 30px 30px',
            border: `1px solid ${KP.line}`,
            boxShadow: '0 24px 60px rgba(17,19,24,0.10), 0 4px 14px rgba(17,19,24,0.05)',
          }}
        >
          {hijos}
        </div>
      </div>
    </div>
  );

  const logo = (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 22 }}>
      <div
        style={{
          width: 54, height: 54, borderRadius: 17, display: 'grid', placeItems: 'center',
          background: `linear-gradient(140deg, ${KP.blue}, ${KP.blueDk})`, boxShadow: KP.shBtn,
        }}
      >
        <Dumbbell size={26} color="#fff" strokeWidth={2.4} />
      </div>
    </div>
  );

  if (cargando) {
    return marco(
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, color: KP.ink2 }}>
        {logo}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 14 }}>
          <Loader2 size={16} className="spin" /> Abriendo tu invitación…
        </div>
        <style>{'.spin{animation:spin .8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}'}</style>
      </div>,
    );
  }

  if (!datos) {
    return marco(
      <div style={{ textAlign: 'center' }}>
        {logo}
        <h1 style={{ fontSize: 20, fontWeight: 800, color: KP.ink, margin: '0 0 10px', letterSpacing: -0.3 }}>
          Este link ya no sirve
        </h1>
        {/* El servidor manda la frase entera, porque la necesita completa quien
            no tenga esta pantalla. Aquí el título ya la dice, así que se quita
            esa parte en vez de repetirla dos veces seguidas. */}
        <p style={{ fontSize: 15, color: KP.ink2, lineHeight: 1.55, margin: '0 0 22px', fontWeight: 500 }}>
          {(error || '').replace(/^\s*Este link ya no sirve\.?\s*/i, '')
            || 'Pídele uno nuevo a tu entrenador.'}
        </p>
        <button
          type="button"
          onClick={onSalir}
          style={{
            width: '100%', padding: '14px 20px', borderRadius: 999, border: `1.5px solid ${KP.line}`,
            background: KP.surface, color: KP.ink, cursor: 'pointer',
            fontFamily: FONT, fontSize: 15, fontWeight: 700,
          }}
        >
          Ir a la app
        </button>
      </div>,
    );
  }

  const bGenero = (v, etq) => (
    <button
      type="button"
      onClick={(e) => { e.preventDefault(); setGenero(genero === v ? '' : v); }}
      style={{
        flex: 1, minHeight: 42, borderRadius: 12, cursor: 'pointer', touchAction: 'manipulation',
        border: `1.5px solid ${genero === v ? KP.blue : KP.line}`,
        background: genero === v ? 'rgba(30,64,224,0.06)' : KP.surface,
        color: genero === v ? KP.blue : KP.ink2,
        fontFamily: FONT, fontSize: 14, fontWeight: 700,
      }}
    >
      {etq}
    </button>
  );

  return marco(
    <>
      {logo}
      {/* Andrés, 24 sep 2026, sobre la primera versión: "ese vocabulario no
          está muy bueno para una app". Lo de "ya te tiene en su lista" sonaba
          a fichero de oficina. Ahora: quién te invita, y qué vas a hacer. */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: KP.ink, margin: '0 0 8px', letterSpacing: -0.4 }}>
          Hola, {datos.nombre}
        </h1>
        <p style={{ fontSize: 15, color: KP.ink2, lineHeight: 1.5, margin: 0, fontWeight: 500 }}>
          Tu coach <strong style={{ color: KP.ink }}>{datos.coach}</strong> te da la bienvenida.
          Configura tu cuenta y empieza a entrenar.
        </p>
      </div>

      <form onSubmit={enviar} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Ya vienen puestos, pero se pueden cambiar: el coach pudo escribirlos
            mal, o el atleta prefiere otro nombre. */}
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Field
              icon={UserIcon}
              label="Tu nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre"
              required
            />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Field
              icon={UserIcon}
              label="Tu apellido"
              value={apellido}
              onChange={(e) => setApellido(e.target.value)}
              placeholder="Apellido"
            />
          </div>
        </div>
        <Field
          icon={AtSign}
          label="Elige tu usuario"
          hint="con esto entras"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="como quieras que te llamen"
          autoCapitalize="none"
          autoCorrect="off"
          required
        />
        <Field
          icon={Lock}
          label="Tu contraseña"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="mínimo 6 caracteres"
          required
        />
        <Field
          icon={Mail}
          label="Tu correo"
          hint="opcional"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tucorreo@ejemplo.com"
          autoCapitalize="none"
          autoCorrect="off"
        />
        {/* Se dice para qué sirve en vez de solo marcarlo "opcional": es la
            diferencia entre poder recuperar la contraseña uno mismo o tener
            que pedírselo al entrenador. */}
        <p style={{ fontSize: 12.5, color: KP.ink3, lineHeight: 1.5, margin: '-6px 0 0', fontWeight: 500 }}>
          Sirve para recuperar tu contraseña si se te olvida. Sin él, se la tendrás que pedir a {datos.coach}.
        </p>

        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: KP.ink3, marginBottom: 7 }}>
            Género <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 600 }}>· opcional</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {bGenero('h', 'Hombre')}
            {bGenero('m', 'Mujer')}
          </div>
          <p style={{ fontSize: 12.5, color: KP.ink3, lineHeight: 1.5, margin: '7px 0 0', fontWeight: 500 }}>
            Si lo dices, verás los videos grabados para ti cuando los haya.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            style={{
              background: KP.dangerSoft, color: KP.danger, borderRadius: 12,
              padding: '11px 14px', fontSize: 13.5, fontWeight: 600, lineHeight: 1.45,
            }}
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={enviando}
          className="kp-press"
          style={{
            marginTop: 4, width: '100%', padding: '15px 20px', borderRadius: 999, border: 'none',
            background: `linear-gradient(140deg, ${KP.blue}, ${KP.blueDk})`, color: '#fff',
            cursor: enviando ? 'default' : 'pointer', opacity: enviando ? 0.7 : 1,
            fontFamily: FONT, fontSize: 15.5, fontWeight: 800, boxShadow: KP.shBtn,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
            touchAction: 'manipulation',
          }}
        >
          {enviando && <Loader2 size={17} className="spin" />}
          {enviando ? 'Creando tu cuenta…' : 'Entrar a entrenar'}
        </button>
        <style>{'.spin{animation:spin .8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}'}</style>
      </form>
    </>,
  );
}
