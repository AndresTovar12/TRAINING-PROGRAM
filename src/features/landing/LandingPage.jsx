import {
  Dumbbell, Video, Repeat, ArrowRight, Check, Activity,
} from 'lucide-react';
import { KP, FONT } from '@/lib/theme';

/**
 * Página de presentación (landing), SOLO en computadora.
 *
 * En el teléfono entran los atletas, que ya tienen cuenta y solo quieren su
 * rutina del día: ahí la pantalla de entrada es lo correcto y esta página
 * estorbaría. En la computadora entra gente que todavía no conoce la app, y
 * una pantalla de contraseña sin contexto no le dice nada.
 *
 * Quien ya tiene sesión abierta nunca la ve: App.jsx la muestra solo cuando
 * no hay usuario.
 *
 * Dice exactamente tres cosas, que son las que distinguen a Training Lab:
 *   1. Sirve para cualquier actividad física, no solo gimnasio.
 *   2. Crear un ejercicio nuevo es fácil: lo grabas y ya es tuyo.
 *   3. Se pueden armar distintos tipos de entrenamiento (repetido, por fases…).
 */

const ANCHO = 1080;

function Boton({ children, onClick, primario, icon: Icon }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="lp-boton"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 9,
        padding: primario ? '15px 26px' : '15px 22px',
        borderRadius: 999, border: primario ? 'none' : `1.5px solid ${KP.line}`,
        background: primario ? KP.blue : KP.surface,
        color: primario ? '#fff' : KP.ink,
        cursor: 'pointer', fontFamily: FONT, fontSize: 15.5, fontWeight: 700,
        boxShadow: primario ? KP.shBtn : 'none',
      }}
    >
      {children}
      {Icon && <Icon size={17} />}
    </button>
  );
}

function Bloque({ numero, eyebrow, titulo, children, icon: Icon, visual, invertido }) {
  return (
    <section style={{ padding: '72px 0', borderTop: `1px solid ${KP.line}` }}>
      <div style={{
        maxWidth: ANCHO, margin: '0 auto', padding: '0 32px',
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 56, alignItems: 'center',
      }}>
        <div style={{ order: invertido ? 2 : 1 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 7, marginBottom: 14,
            background: KP.blueSoft, color: KP.blue, borderRadius: 999, padding: '6px 13px',
            fontSize: 11.5, fontWeight: 800, letterSpacing: 0.7, textTransform: 'uppercase',
          }}>
            <Icon size={14} /> {numero} · {eyebrow}
          </div>
          <h2 style={{
            fontSize: 34, fontWeight: 800, color: KP.ink, lineHeight: 1.15,
            letterSpacing: -0.8, margin: '0 0 14px',
          }}>
            {titulo}
          </h2>
          <div style={{ fontSize: 16.5, color: KP.ink2, lineHeight: 1.6, fontWeight: 500 }}>
            {children}
          </div>
        </div>
        <div style={{ order: invertido ? 1 : 2, minWidth: 0 }}>{visual}</div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------------------
 * Los "visuales" de abajo no son capturas de pantalla: son la interfaz real
 * de la app, con sus mismos colores y medidas. Así nunca se ven distintos a
 * lo que el usuario se va a encontrar adentro, ni hay que rehacer imágenes
 * cada vez que cambiemos algo.
 * ------------------------------------------------------------------------ */

/** 1. Cualquier actividad física. */
function VisualActividades() {
  const actividades = [
    { nombre: 'Gimnasio', ejemplo: 'Sentadilla, press, peso muerto', color: KP.blue },
    { nombre: 'Campo', ejemplo: 'Drills, salidas, cambios de dirección', color: KP.mint },
    { nombre: 'Movilidad', ejemplo: '90/90 de cadera, movilidad torácica', color: KP.violet },
    { nombre: 'Estiramiento', ejemplo: 'Isquiotibiales, psoas, gemelos', color: KP.amber },
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      {actividades.map((a) => (
        <div key={a.nombre} style={{
          background: KP.surface, border: `1px solid ${KP.line}`, borderRadius: 16,
          padding: '15px 16px', boxShadow: KP.shCard,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: a.color, flexShrink: 0 }} />
            <span style={{ fontSize: 14.5, fontWeight: 800, color: KP.ink }}>{a.nombre}</span>
          </div>
          <div style={{ fontSize: 12.5, color: KP.ink3, lineHeight: 1.4, fontWeight: 600 }}>
            {a.ejemplo}
          </div>
        </div>
      ))}
    </div>
  );
}

/** 2. Crear un ejercicio es fácil. */
function VisualRepertorio() {
  const ejercicios = [
    { nombre: 'Back Squat con pausa', tipo: 'Gimnasio · Barra', color: KP.blue },
    { nombre: 'Salida en 3 puntos', tipo: 'Campo · Sin equipo', color: KP.mint },
    { nombre: 'Estiramiento de psoas', tipo: 'Estiramiento · Colchoneta', color: KP.amber },
  ];
  return (
    <div style={{
      background: KP.surface, border: `1px solid ${KP.line}`, borderRadius: 20,
      padding: 16, boxShadow: KP.shCard,
    }}>
      <div style={{
        fontSize: 10.5, fontWeight: 800, color: KP.ink3, letterSpacing: 0.7,
        textTransform: 'uppercase', padding: '2px 4px 12px',
      }}>
        Tu repertorio
      </div>
      {ejercicios.map((e) => (
        <div key={e.nombre} style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '10px 6px',
          borderTop: `1px solid ${KP.line}`,
        }}>
          <span style={{
            width: 42, height: 42, borderRadius: 11, flexShrink: 0,
            background: '#0E1015', display: 'grid', placeItems: 'center',
          }}>
            <Video size={16} color="#4A5060" />
          </span>
          <span style={{ minWidth: 0 }}>
            <span style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 14, fontWeight: 700, color: KP.ink,
            }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: e.color }} />
              {e.nombre}
            </span>
            <span style={{ display: 'block', fontSize: 12.5, color: KP.ink3, marginTop: 2, fontWeight: 600 }}>
              {e.tipo}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}

/** 3. Distintos tipos de entrenamiento. */
function VisualFormatos() {
  const opciones = [
    { titulo: 'Una rutina que se repite', detalle: 'Lunes, miércoles y viernes, cada semana igual', activa: true },
    { titulo: 'Varias semanas que avanzan', detalle: 'La carga sube semana a semana', activa: false },
    { titulo: 'Programa por fases', detalle: 'Meses divididos en bloques con objetivo propio', activa: false },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {opciones.map((o) => (
        <div key={o.titulo} style={{
          background: o.activa ? KP.blueSoft : KP.surface,
          border: `1.5px solid ${o.activa ? KP.blue : KP.line}`,
          borderRadius: 16, padding: '15px 17px', display: 'flex', alignItems: 'center', gap: 13,
          boxShadow: o.activa ? 'none' : KP.shCard,
        }}>
          <span style={{
            width: 22, height: 22, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center',
            background: o.activa ? KP.blue : 'transparent',
            border: o.activa ? 'none' : `1.5px solid ${KP.lineHi}`,
          }}>
            {o.activa && <Check size={13} color="#fff" strokeWidth={3} />}
          </span>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700, color: o.activa ? KP.blue : KP.ink }}>
              {o.titulo}
            </span>
            <span style={{ display: 'block', fontSize: 13, color: KP.ink2, marginTop: 2, fontWeight: 500 }}>
              {o.detalle}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}

export default function LandingPage({ onRegistrarse, onEntrar }) {
  return (
    <div style={{ minHeight: '100svh', background: KP.bg, fontFamily: FONT }}>
      {/* Barra superior */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 10, background: KP.surface,
        borderBottom: `1px solid ${KP.line}`,
      }}>
        <div style={{
          maxWidth: ANCHO, margin: '0 auto', padding: '14px 32px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <span style={{
              width: 38, height: 38, borderRadius: 12, display: 'grid', placeItems: 'center',
              background: `linear-gradient(140deg, ${KP.blue}, ${KP.blueDk})`, boxShadow: KP.shBtn,
            }}>
              <Dumbbell size={20} color="#fff" strokeWidth={2.4} />
            </span>
            <span style={{ fontSize: 17.5, fontWeight: 800, color: KP.ink, letterSpacing: -0.3 }}>
              Training&nbsp;<span style={{ color: KP.blue }}>Lab</span>
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              type="button" onClick={onEntrar} className="lp-boton"
              style={{
                padding: '11px 18px', borderRadius: 999, border: 'none', background: 'transparent',
                color: KP.ink2, cursor: 'pointer', fontFamily: FONT, fontSize: 14.5, fontWeight: 700,
              }}
            >
              Iniciar sesión
            </button>
            <button
              type="button" onClick={onRegistrarse} className="lp-boton"
              style={{
                padding: '11px 20px', borderRadius: 999, border: 'none', background: KP.blue,
                color: '#fff', cursor: 'pointer', fontFamily: FONT, fontSize: 14.5, fontWeight: 700,
                boxShadow: KP.shBtn,
              }}
            >
              Crear cuenta
            </button>
          </div>
        </div>
      </header>

      {/* Portada */}
      <section style={{
        background: `radial-gradient(900px 500px at 50% -10%, ${KP.blueSoft} 0%, rgba(255,255,255,0) 65%)`,
        padding: '84px 32px 76px',
      }}>
        <div style={{ maxWidth: 840, margin: '0 auto', textAlign: 'center' }}>
          <h1 style={{
            fontSize: 54, fontWeight: 800, color: KP.ink, lineHeight: 1.08,
            letterSpacing: -1.8, margin: '0 0 20px',
          }}>
            Entrena con propósito.<br />Enseña a tu manera.
          </h1>
          <p style={{
            fontSize: 19, color: KP.ink2, lineHeight: 1.55, fontWeight: 500,
            margin: '0 auto 32px', maxWidth: 680,
          }}>
            El atleta sabe qué le toca hoy y por qué. El entrenador arma el programa
            con sus propios ejercicios —grabados con el teléfono, para cualquier
            actividad física— en el formato que haga falta.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Boton primario onClick={onRegistrarse} icon={ArrowRight}>Crear cuenta</Boton>
            <Boton onClick={onEntrar}>Ya tengo cuenta</Boton>
          </div>
        </div>
      </section>

      <Bloque
        numero="1"
        eyebrow="Cualquier actividad"
        icon={Activity}
        titulo="No es una app de gimnasio"
        visual={<VisualActividades />}
      >
        Sirve igual para el gimnasio, para la cancha, para movilidad o para
        estiramiento. Nada está amarrado a pesas ni a máquinas.
        <br /><br />
        Si es actividad física y la puedes explicar, la puedes programar aquí.
      </Bloque>

      <Bloque
        numero="2"
        eyebrow="Tus ejercicios"
        icon={Video}
        titulo="Si lo puedes grabar, lo puedes enseñar"
        invertido
        visual={<VisualRepertorio />}
      >
        Inventaste una variante en el gimnasio. Armaste un drill nuevo en la cancha.
        Sacas el teléfono, lo grabas ahí mismo, y queda guardado en tu repertorio
        con su foto, su video y los músculos que trabaja.
        <br /><br />
        Desde ese momento lo puedes meter en la rutina de cualquiera de tus atletas.
        No dependes de un catálogo cerrado que alguien más decidió.
      </Bloque>

      <Bloque
        numero="3"
        eyebrow="Cualquier formato"
        icon={Repeat}
        titulo="Rutinas que se repiten, o programas que avanzan"
        visual={<VisualFormatos />}
      >
        Una rutina semanal fija para quien apenas empieza y necesita constancia.
        Semanas que van subiendo la carga. O un programa por fases de varios meses
        para quien está preparando una temporada.
        <br /><br />
        Los tres se arman en el mismo lugar, y el atleta los ve igual de claros
        en su teléfono.
      </Bloque>

      {/* Cierre */}
      <section style={{ borderTop: `1px solid ${KP.line}`, padding: '76px 32px 84px', textAlign: 'center' }}>
        <div style={{ maxWidth: 620, margin: '0 auto' }}>
          <Dumbbell size={30} color={KP.blue} />
          <h2 style={{
            fontSize: 32, fontWeight: 800, color: KP.ink, lineHeight: 1.15,
            letterSpacing: -0.8, margin: '16px 0 12px',
          }}>
            Empieza con tu primer atleta
          </h2>
          <p style={{ fontSize: 16.5, color: KP.ink2, lineHeight: 1.6, fontWeight: 500, margin: '0 0 28px' }}>
            Crea tu cuenta, arma tu repertorio y asigna el primer programa.
          </p>
          <Boton primario onClick={onRegistrarse} icon={ArrowRight}>Crear cuenta</Boton>
        </div>
      </section>

      <footer style={{
        borderTop: `1px solid ${KP.line}`, padding: '26px 32px',
        fontSize: 13, color: KP.ink3, fontWeight: 600, textAlign: 'center',
      }}>
        Training Lab
      </footer>

      <style>{`
        .lp-boton{transition:filter .12s, background .12s}
        .lp-boton:hover{filter:brightness(0.96)}
      `}</style>
    </div>
  );
}
