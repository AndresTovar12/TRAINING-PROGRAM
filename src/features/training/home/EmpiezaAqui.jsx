import { useEffect, useRef } from 'react';
import { Check, ChevronRight, Heart, Play, User, Users, Watch } from 'lucide-react';
import { FONT, KP, UI } from '@/lib/theme';
import { useReloj } from '@/lib/relojConectado';
import { saludDisponible } from '@/lib/saludDelTelefono';
import { abrePerfil } from '@/lib/abrePerfil';
import { abreConectaReloj } from '@/lib/abreConectaReloj';
import { useEntrenosRecientes } from '@/features/libre/useEntrenoLibre';

/* «EMPIEZA AQUÍ» (inicio nuevo, 30 oct 2026; prototipo HUZVXJGnGrGaZeBq4e3wrv). Lo que recibe al atleta sin plan en su Home, en vez del recorrido de antes:
   lo que le falta para dejar su app lista, cada renglón con su acción de verdad.
     · «Registra tu primer entreno»: abre el punto de «Registrar» (siempre sale; se tacha al registrar uno).
     · «¿Tienes entrenador?»: solo sin entrenador; abre su código en Mi perfil → Mi equipo.
     · «Conecta tu Apple Watch» o «Conecta Apple Salud»: solo en la app del iPhone (en la web no se puede) y sin conectar; abre la pantalla de conectar.
     · «Completa «Sobre ti»»: solo si no dijo ni su sexo ni su fecha de nacimiento; abre Mi perfil.
   Lo que se hace mientras la tarjeta está a la vista se TACHA (se ve que contó); lo que ya estaba hecho ni sale. Sin nada pendiente, la tarjeta se va.
   `perfil`, `conCoach`. `onRegistrar`: abre el punto. `recarga`: cambia al cerrar el punto, para volver a contar los entrenos. */

function Renglon({ Icono, titulo, detalle, hecho, onClick, primero }) {
  return (
    <button
      type="button" onClick={hecho ? undefined : onClick} disabled={hecho} className={hecho ? undefined : 'kp-press'}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, width: '100%', border: 'none', background: 'transparent', textAlign: 'left', padding: '11px 0',
        color: KP.ink, fontFamily: FONT, fontSize: 15, fontWeight: 700, cursor: hecho ? 'default' : 'pointer',
        // estilo-ok: la raya fina entre renglones de la misma tarjeta
        borderTop: primero ? 'none' : `1px solid ${KP.line}`, touchAction: 'manipulation',
      }}
    >
      <span style={{ width: 36, height: 36, borderRadius: 11, flex: 'none', display: 'grid', placeItems: 'center', background: hecho ? KP.mintSoft : UI.relleno, color: hecho ? KP.mint : KP.blue }}>
        {hecho ? <Check size={18} strokeWidth={3} /> : <Icono size={18} />}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <b style={{ display: 'block', textDecoration: hecho ? 'line-through' : 'none', color: hecho ? KP.ink3 : KP.ink }}>{titulo}</b>
        <small style={{ display: 'block', fontSize: 13, fontWeight: 500, color: KP.ink2, marginTop: 1 }}>{detalle}</small>
      </span>
      {!hecho && <ChevronRight size={18} color={KP.ink3} />}
    </button>
  );
}

export default function EmpiezaAqui({ perfil, userId, conCoach, onRegistrar, recarga = 0 }) {
  const { listo: relojListo, reloj, conexion } = useReloj();
  const { entrenos: filas, recarga: vuelveALeer } = useEntrenosRecientes(userId, 1);
  useEffect(() => { if (recarga) vuelveALeer(); }, [recarga, vuelveALeer]);
  const enLaApp = saludDisponible();
  // Lo que estaba pendiente la primera vez que se vio: eso, al hacerse, se queda tachado.
  const vistos = useRef(null);

  if (filas === null || (enLaApp && !relojListo)) return null; // hasta saber qué falta, nada (si no, un renglón saldría y se iría)
  const conReloj = !!reloj.emparejado;
  const filasTodas = [
    { id: 'entreno', Icono: Play, titulo: 'Registra tu primer entreno', detalle: 'Con el punto de abajo: corre, camina o lo que hagas.', hecho: filas.length > 0, accion: onRegistrar },
    !conCoach && { id: 'entrenador', Icono: Users, titulo: '¿Tienes entrenador?', detalle: 'Pon su código y te arma tu plan.', hecho: false, accion: () => abrePerfil('equipo') },
    enLaApp && {
      id: 'reloj', Icono: conReloj ? Watch : Heart, hecho: !!conexion, accion: () => abreConectaReloj('home'),
      titulo: conexion ? (conReloj ? 'Apple Watch conectado' : 'Apple Salud conectada') : conReloj ? 'Conecta tu Apple Watch' : 'Conecta Apple Salud',
      detalle: conexion ? 'Tus entrenos entran solos.' : 'Tus entrenos entran solos, con tu pulso.',
    },
    { id: 'sobre', Icono: User, titulo: 'Completa «Sobre ti»', detalle: 'Para tus zonas de pulso.', hecho: !!(perfil?.genero || perfil?.fecha_nacimiento), accion: () => abrePerfil('perfil') },
  ].filter(Boolean);
  if (!vistos.current) vistos.current = new Set(filasTodas.filter((f) => !f.hecho).map((f) => f.id));
  // Siempre sale el primer entreno; lo demás, solo si faltaba al verla.
  const renglones = filasTodas.filter((f) => f.id === 'entreno' || vistos.current.has(f.id));
  const faltan = renglones.filter((f) => !f.hecho).length;
  if (faltan === 0) return null;

  return (
    <section aria-label="Empieza aquí" style={{ background: '#fff', borderRadius: 22, padding: 16, boxShadow: '0 1px 2px rgba(17,19,24,0.04)', fontFamily: FONT }}>
      <h2 style={{ margin: '0 0 2px', fontSize: 19, fontWeight: 800, lineHeight: 1.2, letterSpacing: -0.3, color: KP.ink }}>Empieza aquí</h2>
      <p style={{ margin: '0 0 6px', fontSize: 13.5, color: KP.ink2, fontWeight: 500 }}>{faltan} {faltan === 1 ? 'cosa' : 'cosas'} para dejar tu app lista.</p>
      {renglones.map((f, k) => (
        <Renglon key={f.id} Icono={f.Icono} titulo={f.titulo} detalle={f.detalle} hecho={f.hecho} onClick={f.accion} primero={k === 0} />
      ))}
    </section>
  );
}

/** Con entrenador y sin plan todavía: la tarjeta azul de arriba. */
export function TeEstaArmando({ coach }) {
  const nombre = (coach?.full_name || coach?.username || '').trim();
  const corto = nombre.split(/\s+/)[0];
  const ini = nombre.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', borderRadius: 22, padding: 16, color: '#fff', background: UI.azul, fontFamily: FONT }}>
      <span style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,0.18)', display: 'grid', placeItems: 'center', fontSize: 15, fontWeight: 800, flex: 'none', overflow: 'hidden' }}>
        {coach?.avatar_url ? <img src={coach.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : ini || <Users size={20} />}
      </span>
      <span style={{ minWidth: 0 }}>
        <b style={{ display: 'block', fontSize: 16 }}>{corto ? `${corto} te está armando tu plan` : 'Tu plan está en camino'}</b>
        <span style={{ display: 'block', fontSize: 13.5, opacity: 0.85, lineHeight: 1.35 }}>Te avisamos cuando esté listo.</span>
      </span>
    </div>
  );
}
