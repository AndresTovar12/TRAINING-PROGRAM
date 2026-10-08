import { useState } from 'react';
import { Check, ChevronRight, Heart, MessageSquareText, Play, Video } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { modoDePalabras, traduce } from '@/lib/palabras';
import { FONT, KP } from '@/lib/theme';
import { botonPrimario, enlace, subtitulo, titulo } from '@/features/inicio/estilos';

/**
 * El recorrido: qué hace la app, en cuatro pantallas para el coach (cinco si trabaja en equipo) y tres para el atleta.
 *
 * Andrés, 8 oct 2026 (PDF «Experiencia de inicio»): quería lo que hace Everfit al entrar —un paseo por lo que la app hace—
 * sin copiar sus pantallas. Son DIBUJOS de la app, no fotos de banco: cada pantalla enseña la parte de la app de la que
 * habla. Se puede saltar en cualquier momento y se vuelve a ver desde Mi perfil.
 *
 * `onTerminar` se llama al final o al saltar. `conEquipo` agrega la pantalla del equipo (solo si el coach dijo que trabaja
 * con más profesionales: si no, no se le enseña algo que no le aplica).
 */

const fila = {
  display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: `1px solid ${KP.line}`, borderRadius: 14,
  padding: '10px 12px', fontSize: 14, fontWeight: 700, color: KP.ink, boxShadow: '0 6px 16px rgba(17,19,24,0.06)',
  fontFamily: FONT,
};
const avatar = (fondo = KP.blueSoft, color = KP.blue) => ({
  width: 34, height: 34, borderRadius: 11, background: fondo, color, display: 'grid', placeItems: 'center',
  fontWeight: 800, fontSize: 13, flexShrink: 0,
});
const chico = { display: 'block', fontSize: 12, color: KP.ink2, fontWeight: 600, marginTop: 1 };
const pastilla = {
  display: 'inline-flex', alignItems: 'center', gap: 6, background: '#fff', border: `1px solid ${KP.line}`,
  borderRadius: 999, padding: '6px 12px', fontSize: 12.5, fontWeight: 800, color: KP.blue, fontFamily: FONT,
};
const punto = (color) => ({ width: 9, height: 9, borderRadius: 99, background: color, flexShrink: 0 });
const burbuja = (mia) => ({
  background: mia ? KP.blue : '#fff', color: mia ? '#fff' : KP.ink, border: mia ? 'none' : `1px solid ${KP.line}`,
  borderRadius: mia ? '16px 16px 4px 16px' : '16px 16px 16px 4px', padding: '10px 12px', fontSize: 13, fontWeight: 600,
  maxWidth: '88%', alignSelf: mia ? 'flex-end' : 'flex-start', lineHeight: 1.4,
});

const Atletas = ({ tr }) => (
  <>
    <div style={fila}><span style={avatar()}>MR</span><div>Mariana Ruiz<small style={chico}>{tr('Plan de fuerza')} · 2 de 3 esta semana</small></div></div>
    <div style={fila}><span style={avatar()}>JE</span><div>Juan Escutia<small style={chico}>Rutina semanal · hoy: Empuje</small></div></div>
    <div style={{ ...fila, opacity: 0.65 }}><span style={avatar()}>+</span><div>{tr('Agregar atleta')}<small style={chico}>Código · QR · link</small></div></div>
  </>
);
const Equipo = () => (
  <>
    <div style={fila}><span style={avatar()}>AT</span><div>Andrés · Entrenador<small style={chico}>Fuerza · lunes, miércoles, viernes</small></div></div>
    <div style={fila}><span style={avatar('#FDECF4', '#EC7FB0')}>LG</span><div>Laura · Fisioterapeuta<small style={chico}>Movilidad de cadera · martes</small></div></div>
    <div style={{ textAlign: 'center' }}><span style={pastilla}>Ver: Todo ▾</span></div>
  </>
);
const Planes = () => (
  <>
    <div style={fila}><span style={punto('#A480FF')} /><div>Una rutina que se repite<small style={chico}>Lunes, miércoles y viernes, igual cada semana</small></div></div>
    <div style={fila}><span style={punto('#FFA047')} /><div>Varias semanas que avanzan<small style={chico}>La carga sube semana a semana</small></div></div>
    <div style={fila}><span style={punto('#3DD9A0')} /><div>Programa por fases<small style={chico}>Meses en bloques con objetivo propio</small></div></div>
  </>
);
const Grabar = () => (
  <>
    <div style={{
      width: 140, height: 200, borderRadius: 26, border: '6px solid #141720', background: '#0E1015', margin: '0 auto',
      display: 'grid', placeItems: 'center', color: '#fff', position: 'relative',
    }}>
      <span style={{ position: 'absolute', top: 10, left: 12, display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 800 }}>
        <i style={{ width: 8, height: 8, borderRadius: 99, background: '#F2555A' }} /> REC 0:08
      </span>
      <Play size={34} fill="#fff" />
    </div>
    <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
      <span style={pastilla}><Video size={13} /> Ejemplo</span>
      <span style={pastilla}><MessageSquareText size={13} /> Explicación</span>
    </div>
  </>
);
const IA = () => (
  <>
    <div style={burbuja(true)}>Ármale a Mariana 4 semanas de fuerza, 3 días.</div>
    <div style={burbuja(false)}>¿Con qué peso arranca el squat: % de su 1RM o RPE?</div>
    <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
      {['Claude', 'ChatGPT'].map((n) => (
        <span key={n} style={{ ...fila, padding: '12px 14px', fontWeight: 800 }}>{n}</span>
      ))}
    </div>
  </>
);
const Hoy = () => (
  <>
    <div style={fila}><span style={punto('#A480FF')} /><div>Hoy te toca<small style={chico}>Pierna · fuerza · 5 ejercicios</small></div></div>
    <div style={fila}><span style={avatar()}><Play size={14} fill={KP.blue} /></span><div>Back Squat<small style={chico}>4 × 8-10 · 75% · ≈ 105 kg</small></div></div>
    <div style={fila}><span style={avatar()}><Play size={14} fill={KP.blue} /></span><div>Hip Thrust<small style={chico}>3 × 12 · RPE 8</small></div></div>
  </>
);
const Entrenar = () => (
  <>
    {[['Vuelta 1', '8 reps · 105 kg', true], ['Vuelta 2', '8 reps · 110 kg', true], ['Vuelta 3', '— reps · — kg', false]].map(([t, s, ok]) => (
      <div key={t} style={{ ...fila, opacity: ok ? 1 : 0.7 }}>
        <div>{t}<small style={chico}>{s}</small></div>
        <span style={{ ...pastilla, marginLeft: 'auto' }}>{ok ? <><Check size={12} strokeWidth={3} /> Listo</> : 'Siguiente'}</span>
      </div>
    ))}
  </>
);
const Salud = () => (
  <>
    <div style={fila}><span style={avatar('#FDECEC', '#F2555A')}><Heart size={16} /></span><div>Hoy<small style={chico}>Sueño 7 h · Energía 4/5 · Sin dolor</small></div></div>
    <div style={burbuja(false)}>Buen trabajo ayer. Hoy baja el peso 5 % en el squat.</div>
  </>
);

const DEL_COACH = (conEquipo) => [
  { titulo: 'Tus atletas', texto: 'Dales tu código o tu QR y aparecen aquí. A cada uno le armas su plan.', Dibujo: Atletas },
  ...(conEquipo ? [{ titulo: 'Tu equipo', texto: 'Un fisio y un coach sobre la misma persona. Cada quien pega lo suyo y el atleta lo ve como un solo programa.', Dibujo: Equipo }] : []),
  { titulo: 'Tus planes', texto: 'Una rutina que se repite, semanas que avanzan o un programa por fases. Guarda los tuyos en Mis planes.', Dibujo: Planes },
  { titulo: 'Graba tus ejercicios', texto: 'Si lo puedes grabar, lo puedes enseñar. Un ejemplo y una explicación, con tu celular.', Dibujo: Grabar },
  { titulo: 'Tu IA', texto: 'Conecta Claude o ChatGPT y arma planes conversando. Ella pregunta lo que le falte.', Dibujo: IA },
];
const DEL_ATLETA = [
  { titulo: 'Hoy', texto: 'Lo que te toca hoy, con sus videos. Tu semana completa, un toque abajo.', Dibujo: Hoy },
  { titulo: 'Entrenar', texto: 'Anota reps y kilos vuelta por vuelta. Tu entrenador lo ve al momento.', Dibujo: Entrenar },
  { titulo: 'Salud', texto: 'Cómo dormiste y cómo te sientes, en 10 segundos. Y aquí llegan los mensajes de tu entrenador.', Dibujo: Salud },
];

export default function Recorrido({ rol = 'coach', conEquipo = false, onTerminar, compu = false }) {
  const { profile } = useAuth();
  // Con las palabras de su oficio: al fisio «Tus pacientes», al instructor «Tus alumnos». Se traduce aquí directo (sin
  // `PalabrasProvider`) porque el inicio se dibuja antes de que la app esté armada.
  const modo = modoDePalabras(profile?.profesion);
  const tr = (x) => traduce(x, modo);
  const pantallas = rol === 'coach' ? DEL_COACH(conEquipo) : DEL_ATLETA;
  const [n, setN] = useState(0);
  const p = pantallas[n];
  const ultima = n === pantallas.length - 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', fontFamily: FONT }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 36 }}>
        <div style={{ display: 'flex', gap: 6, flex: 1, justifyContent: 'center' }} aria-label={`Pantalla ${n + 1} de ${pantallas.length}`}>
          {pantallas.map((x, k) => (
            <i key={x.titulo} style={{ width: k === n ? 20 : 7, height: 7, borderRadius: 99, background: k === n ? KP.ink : KP.lineHi, transition: 'width .2s' }} />
          ))}
        </div>
        {!ultima && (
          <button type="button" onClick={onTerminar} style={{ ...enlace, width: 'auto', padding: '6px 2px', position: 'absolute', right: 20 }}>
            Saltar
          </button>
        )}
      </div>

      <div
        key={p.titulo}
        className="animate-fade-in"
        style={{
          borderRadius: 22, background: 'linear-gradient(160deg, #E8ECFD, #F4F5F8)', border: `1px solid ${KP.line}`,
          padding: 18, minHeight: 250, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 10,
          margin: '14px 0 18px',
        }}
      >
        <p.Dibujo tr={tr} />
      </div>
      <h2 style={{ ...titulo(compu), marginTop: 0 }}>{tr(p.titulo)}</h2>
      <p style={subtitulo}>{tr(p.texto)}</p>

      <div style={{ marginTop: 'auto' }}>
        <button
          type="button"
          className="kp-press"
          onClick={() => (ultima ? onTerminar() : setN(n + 1))}
          style={botonPrimario()}
        >
          {ultima ? 'Empezar' : 'Siguiente'} <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}
