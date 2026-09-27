import {
  Dumbbell, Video, Repeat, ArrowRight, Check, Activity, Sparkles, Play,
} from 'lucide-react';
import { KP, FONT } from '@/lib/theme';
import { MarcaIA } from '@/features/ia/Maquetas';
import fotoPista from '@/assets/landing/pista.webp';
import fotoYoga from '@/assets/landing/yoga.webp';
import fotoFuerza from '@/assets/landing/fuerza.webp';
import fotoAgilidad from '@/assets/landing/agilidad.webp';
import fotoBosu from '@/assets/landing/bosu.webp';

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
 * Dice exactamente cuatro cosas, que son las que distinguen a Training Lab:
 *   1. Sirve para cualquier forma de entrenar, no solo gimnasio.
 *   2. Crear un ejercicio nuevo es fácil: lo grabas y ya es tuyo.
 *   3. Se pueden armar distintos tipos de entrenamiento (repetido, por fases…).
 *   4. Se conecta con la IA de cada quien (Claude, ChatGPT…).
 *
 * Los textos de la portada y del bloque 1 son de Andrés (26 sep 2026).
 *
 * FOTOS (las eligió Andrés, 26 sep 2026, con la paleta de la página):
 *   - Portada: cuatro disciplinas del mismo tamaño (fuerza, deporte, yoga y
 *     running). Ninguna manda: con una sola foto grande de running, Andrés
 *     dijo que "va a parecer que es una app de running".
 *   - Bloque 2: el coach que graba con el celular ("si lo puedes grabar…").
 * El bloque 1 no repite fotos: muestra cómo se mide cada disciplina.
 * Van recortadas y en WebP en src/assets/landing (unos 200 KB las cinco);
 * los originales pesan 12 MB y no entran al repo.
 */

const ANCHO = 1080;
// Sombra teñida del azul de la marca, no negra: sobre fondo claro se ve limpia.
const SOMBRA_FOTO = '0 24px 60px rgba(20, 40, 120, 0.14)';

// Portada: en el orden del texto de Andrés (fuerza, deporte, yoga) y running al final.
const FOTOS_PORTADA = [
  { src: fotoFuerza, alt: 'Atleta haciendo remo sentado en una máquina de gimnasio' },
  { src: fotoAgilidad, alt: 'Atleta haciendo escalera de agilidad mientras un celular lo graba' },
  { src: fotoYoga, alt: 'Instructora corrigiendo una postura de yoga frente al mar' },
  { src: fotoPista, alt: 'Dos corredores entrenando en una pista al amanecer' },
];

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
            letterSpacing: -0.8, margin: '0 0 14px', textWrap: 'balance',
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

/** 1. Cada disciplina tiene su propia lógica: se mide como se entrena. */
function VisualDisciplinas() {
  const filas = [
    { dia: 'Lun', ejercicio: 'Sentadilla', disciplina: 'Fuerza', medida: '4 × 8 · 60 kg', tono: 'blue' },
    { dia: 'Mar', ejercicio: 'Series en pista', disciplina: 'Resistencia', medida: '6 × 800 m', tono: 'mint' },
    { dia: 'Jue', ejercicio: 'Saludo al sol', disciplina: 'Movilidad y yoga', medida: '3 × 45 s', tono: 'violet' },
    { dia: 'Sáb', ejercicio: 'Isométrico de rodilla', disciplina: 'Rehabilitación', medida: '5 × 30 s', tono: 'amber' },
  ];
  return (
    <div style={{
      background: KP.surface, border: `1px solid ${KP.line}`, borderRadius: 20,
      padding: 16, boxShadow: KP.shCard,
    }}>
      <div style={{
        fontSize: 10.5, fontWeight: 800, color: KP.ink3, letterSpacing: 0.7,
        textTransform: 'uppercase', padding: '2px 4px 10px',
      }}>
        Tu semana
      </div>
      {filas.map((f) => (
        <div key={f.dia} style={{
          display: 'grid', gridTemplateColumns: '36px 1fr auto', alignItems: 'center', gap: 12,
          padding: '12px 4px', borderTop: `1px solid ${KP.line}`,
        }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: KP.ink3 }}>{f.dia}</span>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700, color: KP.ink }}>{f.ejercicio}</span>
            <span style={{
              display: 'inline-block', marginTop: 5, fontSize: 11.5, fontWeight: 800,
              color: KP[f.tono], background: KP[`${f.tono}Soft`], borderRadius: 999, padding: '2px 9px',
            }}>
              {f.disciplina}
            </span>
          </span>
          <span style={{
            fontSize: 14, fontWeight: 800, color: KP.ink, fontVariantNumeric: 'tabular-nums',
            background: KP.bg, borderRadius: 10, padding: '7px 11px', whiteSpace: 'nowrap',
          }}>
            {f.medida}
          </span>
        </div>
      ))}
    </div>
  );
}

/** 2. Crear un ejercicio es fácil: lo grabas y queda en tu repertorio. */
function VisualGrabar() {
  // Las miniaturas salen de las mismas fotos de la página: no se descarga nada extra.
  const ejercicios = [
    { nombre: 'Equilibrio en BOSU a una pierna', tipo: 'Rehabilitación · BOSU', foto: fotoBosu, enfoque: '64% 42%', nuevo: true },
    { nombre: 'Escalera de agilidad', tipo: 'Deporte · Escalera', foto: fotoAgilidad, enfoque: '30% 38%' },
    { nombre: 'Remo sentado', tipo: 'Fuerza · Máquina', foto: fotoFuerza, enfoque: '50% 40%' },
  ];
  return (
    <div>
      <img
        src={fotoBosu} width={984} height={827} loading="lazy" decoding="async"
        alt="Entrenador guiando a un atleta en equilibrio sobre un BOSU mientras un celular graba el ejercicio"
        style={{ display: 'block', width: '100%', height: 'auto', borderRadius: 20, boxShadow: SOMBRA_FOTO }}
      />
      {/* Se monta solo sobre el piso de la foto: el atleta y el BOSU quedan a la vista. */}
      <div style={{
        position: 'relative', width: 300, margin: '-72px -20px 0 auto',
        background: KP.surface, border: `1px solid ${KP.line}`, borderRadius: 18,
        padding: 14, boxShadow: '0 18px 44px rgba(20, 40, 120, 0.2)',
      }}>
        <div style={{
          fontSize: 10.5, fontWeight: 800, color: KP.ink3, letterSpacing: 0.7,
          textTransform: 'uppercase', padding: '2px 4px 10px',
        }}>
          Tu repertorio
        </div>
        {ejercicios.map((e) => (
          <div key={e.nombre} style={{
            display: 'flex', alignItems: 'center', gap: 11, padding: '9px 4px',
            borderTop: `1px solid ${KP.line}`,
          }}>
            <span style={{
              position: 'relative', width: 44, height: 44, borderRadius: 11, flexShrink: 0, overflow: 'hidden',
            }}>
              <img
                src={e.foto} alt="" width={44} height={44}
                style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: e.enfoque, display: 'block' }}
              />
              <span style={{
                position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
                background: 'rgba(10, 16, 40, 0.28)',
              }}>
                <Play size={13} color="#fff" fill="#fff" />
              </span>
            </span>
            <span style={{ minWidth: 0, flex: 1 }}>
              <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: KP.ink, lineHeight: 1.3 }}>
                {e.nombre}
              </span>
              <span style={{ display: 'block', fontSize: 12, color: KP.ink3, marginTop: 2, fontWeight: 600 }}>
                {e.tipo}
              </span>
            </span>
            {e.nuevo && (
              <span style={{
                flexShrink: 0, fontSize: 10.5, fontWeight: 800, color: KP.blue, background: KP.blueSoft,
                borderRadius: 999, padding: '4px 8px',
              }}>
                Nuevo
              </span>
            )}
          </div>
        ))}
      </div>
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

/** 4. Conecta tu IA: lo que se le pregunta y lo que contesta, con tus datos. */
function VisualIA() {
  // Las mismas dos vertientes que la guía de la app: en el chat y en la terminal.
  const grupos = [
    { donde: 'En el chat', ias: [['claude', 'Claude'], ['chatgpt', 'ChatGPT']] },
    { donde: 'En la terminal', ias: [['claude-code', 'Claude Code'], ['codex', 'Codex'], ['hermes', 'Hermes']] },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{
        background: KP.surface, border: `1px solid ${KP.line}`, borderRadius: 20,
        padding: 18, boxShadow: KP.shCard, display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        <div style={{
          alignSelf: 'flex-end', maxWidth: '80%', background: '#EEF0F3', color: KP.ink,
          borderRadius: '16px 16px 4px 16px', padding: '10px 14px', fontSize: 14, fontWeight: 600,
        }}>
          ¿Cómo van mis atletas esta semana?
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 10.5, fontWeight: 800, color: KP.ink3, letterSpacing: 0.6, textTransform: 'uppercase',
        }}>
          <MarcaIA app="claude" size={16} /> Usó Training Lab
        </div>
        <div style={{ maxWidth: '92%', fontSize: 14.5, color: KP.ink, lineHeight: 1.5, fontWeight: 500 }}>
          Ana hizo 4 de 4 sesiones. Juan va 2 de 4 y anotó dolor de rodilla:
          ¿le cambio la sentadilla por una variante sin carga?
        </div>
      </div>
      {grupos.map((g) => (
        <div key={g.donde} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{
            width: 104, flexShrink: 0, fontSize: 10.5, fontWeight: 800, color: KP.ink3,
            letterSpacing: 0.6, textTransform: 'uppercase',
          }}>
            {g.donde}
          </span>
          {g.ias.map(([id, nombre]) => (
            <span key={id} style={{
              display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 12px 6px 6px',
              background: KP.surface, border: `1px solid ${KP.line}`, borderRadius: 999,
              fontSize: 13, fontWeight: 700, color: KP.ink,
            }}>
              <MarcaIA app={id} size={22} /> {nombre}
            </span>
          ))}
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
            Una forma más libre de vivir el entrenamiento: cualquier disciplina,
            cualquier formato y tus propios ejercicios, todo conectado en un sistema
            que se adapta a cómo entrenas y a cómo enseñas, no al revés.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Boton primario onClick={onRegistrarse} icon={ArrowRight}>Crear cuenta</Boton>
            <Boton onClick={onEntrar}>Ya tengo cuenta</Boton>
          </div>
        </div>
        <div style={{
          maxWidth: ANCHO - 64, margin: '52px auto 0', paddingBottom: 28,
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, alignItems: 'start',
        }}>
          {FOTOS_PORTADA.map((f, i) => (
            <img
              key={f.alt} src={f.src} alt={f.alt} width={486} height={600} decoding="async"
              fetchPriority={i === 0 ? 'high' : undefined}
              style={{
                display: 'block', width: '100%', height: 'auto', borderRadius: 20, boxShadow: SOMBRA_FOTO,
                transform: i % 2 ? 'translateY(28px)' : undefined,
              }}
            />
          ))}
        </div>
      </section>

      <Bloque
        numero="1"
        eyebrow="Cualquier actividad"
        icon={Activity}
        titulo="Para cualquier forma de entrenar"
        visual={<VisualDisciplinas />}
      >
        Desde fuerza y trabajo específico para cada deporte, hasta movilidad,
        rehabilitación o yoga. Si forma parte de tu entrenamiento, tiene lugar aquí.
        <br /><br />
        Cada disciplina tiene su propia lógica. Training Lab te permite organizar
        ejercicios, sesiones y progresiones según cómo se entrena realmente en cada una.
      </Bloque>

      <Bloque
        numero="2"
        eyebrow="Tus ejercicios"
        icon={Video}
        titulo="Si lo puedes grabar, lo puedes enseñar"
        invertido
        visual={<VisualGrabar />}
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

      <Bloque
        numero="4"
        eyebrow="Conecta tu IA"
        icon={Sparkles}
        titulo="Tu entrenamiento, dentro de tu IA"
        invertido
        visual={<VisualIA />}
      >
        Conecta Training Lab con Claude o ChatGPT y pregúntale lo que quieras: qué
        toca hoy, cómo va cada atleta o qué hacer si falta un aparato. Te contesta
        con tus datos reales.
        <br /><br />
        Si eres entrenador, también te ayuda a ajustar los programas. Cada cambio
        queda guardado y se puede deshacer.
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
