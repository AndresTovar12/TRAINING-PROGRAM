import { Component, useCallback, useEffect, useMemo, useState } from 'react';
import { Play } from 'lucide-react';
import { LT, KP, FONT, NUM_STYLE } from '@/lib/theme';
import { usePlan } from '@/contexts/PlanContext';
import { usePerfilDeLaVista } from '@/contexts/VistaContext';
import { usePalabras } from '@/contexts/PalabrasContext';
import { portadaParaAtleta, videosParaAtleta } from '@/lib/videos';
import { pasosDeLaSesion, vistaDelEntreno } from '@/lib/entreno';
import { tiempoTotal } from '@/lib/entrenoDatos';
import { recogeEntrenoPendiente } from '@/lib/entrenoPendiente';
import { palabrasDelEntreno } from '@/lib/entrenoPalabras';
import { preparaAudio } from '@/lib/pitidos';
import EntrenoDelDia from '@/features/training/EntrenoDelDia';

/**
 * Si el entreno falla por un dato que nadie previó, NO se lleva la pantalla del día: se cierra y la lista de ejercicios de siempre sigue ahí.
 * El entreno es una ayuda nueva encima de una lista que ya funciona; no puede ser lo que la rompa.
 */
class LimiteDelEntreno extends Component {
  constructor(props) {
    super(props);
    this.state = { fallo: false };
  }

  static getDerivedStateFromError() {
    return { fallo: true };
  }

  componentDidCatch(error) {
    console.error('[entreno] no se pudo dibujar:', error);
    this.props.alFallar();
  }

  render() {
    return this.state.fallo ? null : this.props.children;
  }
}

// Al aparecer, abre el entreno (una vez): lo usa «Empezar» de Home.
function AbreAlAparecer({ alAparecer }) {
  useEffect(() => { alAparecer(); }, []); // eslint-disable-line react-hooks/exhaustive-deps -- solo al aparecer
  return null;
}

/**
 * El botón de la sesión que abre el MODO ENTRENO, según el ESTADO de ESA sesión (cada sesión del día tiene el suyo): «Iniciar entreno» (sin empezar), «Seguir · 14:32 · 3 de 12»
 * (en curso: tiempo vivo y pasos hechos) o nada (terminada).
 *
 * Va arriba de la lista de ejercicios del día, dentro de su tarjeta. No sale si no hay nada que entrenar (un descanso), si la sesión ya
 * está terminada (ya dice «Terminada»), ni cuando alguien mira el plan de otra persona en solo lectura.
 *
 * Ya NO hay ✕ (23 oct 2026, PDF «Botones de interacción en el entreno»: quitaba el botón para siempre y nada lo explicaba). Quien no quiere la guía termina la sesión desde
 * la lista. Una sesión que ya traía `oculto` de antes vuelve a ofrecer «Seguir». «En curso» empieza con el primer «Listo», no al abrir: abrir y cerrar sin hacer nada no cuenta.
 *
 * Es el único sitio que habla con los contextos de la app (el plan, el perfil de quien se mira, las palabras): `EntrenoDelDia` recibe todo
 * por propiedades, para poder probarse solo.
 */
export default function BotonDelEntreno({ dia, ejercicios, aspecto, registro, onRegistro, onFormato, sesionId, oneRMs, autor = null }) {
  const { resolveExercise, medias, programaActivo } = usePlan();
  const { perfil, soloLectura, userId } = usePerfilDeLaVista();
  const { salud, coach } = usePalabras();
  /* A quién le llega la técnica que grabe el atleta: a quien puso ESTE ejercicio en el plan. `autor` es el programa de quien puso esta sesión (su coach, o un
     profesional de su equipo con su programa o sus sesiones pegadas); si la pantalla no lo trae, el programa que se está viendo. Sin dueño (un atleta sin coach)
     no hay a quién y la cámara no sale. */
  const destinoDeTecnica = useMemo(() => {
    const programa = autor ?? programaActivo;
    const id = programa?.profesionalId;
    if (!id) return null;
    // Un plan comprado sin «técnica por video» (lo apaga el coach por plan): la cámara no sale.
    if (programa.comprado && !programa.compra?.tecnica) return null;
    const pro = programa.profesional;
    const nombre = pro?.full_name || pro?.username || (id === perfil?.coach_id ? (coach?.full_name || coach?.username) : null) || 'tu coach';
    return { id, nombre };
  }, [autor, programaActivo, perfil?.coach_id, coach]);
  const [abierto, setAbierto] = useState(false);
  // Home pidió abrir el entreno de esta sesión («Empezar»): se lee una sola vez, al montar.
  const [abrirYa] = useState(() => recogeEntrenoPendiente(sesionId));
  const [intento, setIntento] = useState(0);
  const [fallo, setFallo] = useState(false);
  // Una sesión que dice «repite el martes» se entrena con los ejercicios del martes (`ejercicios`); lo que se anota queda en SU lugar.
  const diaDeEntreno = useMemo(() => (ejercicios ? { ...dia, exercises: ejercicios } : dia), [dia, ejercicios]);
  const plan = useMemo(() => {
    try { return pasosDeLaSesion(diaDeEntreno); } catch (error) { console.error('[entreno] no se pudo armar la sesión:', error); return null; }
  }, [diaDeEntreno]);

  // El tiempo del entreno en curso se ve vivo en el botón: un tic por segundo, solo mientras hay entreno empezado y sin terminar.
  const [ahora, setAhora] = useState(() => Date.now());
  const enCursoSinFin = !!registro?.entreno?.inicio && registro.entreno.fin == null && !registro?.completed;
  useEffect(() => {
    if (!enCursoSinFin) return undefined;
    const id = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(id);
  }, [enCursoSinFin]);

  // La foto y los videos que le tocan a ESTA persona (uno solo para ella, de su género, o el general): ver `FichaEjercicio`.
  const medios = useCallback((ex) => {
    const repertorio = resolveExercise(ex) || { name: ex.name };
    return { portada: portadaParaAtleta(repertorio, medias, perfil), videos: videosParaAtleta(repertorio, medias, perfil) };
  }, [resolveExercise, medias, perfil]);

  if (soloLectura || !plan || plan.pasos.length === 0 || registro?.completed) return null;

  const palabras = palabrasDelEntreno(salud);

  // Aquí la hora no importa: solo se mira si ya empezó y cuántos pasos van.
  const vista = vistaDelEntreno(plan, registro?.entreno, ahora);
  // Ya se dio por terminado: no hay nada que iniciar ni que continuar (si lo está mirando abierto, sigue abierto).
  if (!abierto && vista.estado === 'fin') return null;
  const empezado = vista.estado !== 'sin';
  // «Continuar» solo cuando ya hay algo hecho: abrir el entreno y cerrarlo sin tocar un paso no es «Continuar entreno 0 de 7», es empezar.
  const continuando = empezado && vista.hechos + vista.saltados > 0;
  const abre = () => {
    // El audio solo se despierta con un toque de la persona; con el reloj arrancando solo, este es el toque.
    preparaAudio();
    setFallo(false);
    setIntento((n) => n + 1);
    setAbierto(true);
  };
  return (
    <>
      {abrirYa && !abierto && !fallo && <AbreAlAparecer alAparecer={abre} />}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        <button
          type="button" onClick={abre} className="kp-press"
          style={{
            // Reestructura visual (15 oct 2026): el botón principal de `components/ui` (azul lleno); «Continuar» en gris claro con letras azules.
            flex: 1, minWidth: 0, minHeight: 56, borderRadius: 16, cursor: 'pointer', fontFamily: FONT, fontSize: 17, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, touchAction: 'manipulation', border: 'none',
            ...(continuando
              ? { background: '#EBEDF1', color: LT.blue }
              : { background: KP.blue, color: '#fff', boxShadow: '0 8px 20px rgba(30,64,224,0.22)' }),
          }}
        >
          <Play size={continuando ? 17 : 18} fill={continuando ? 'none' : '#fff'} />
          {continuando ? palabras.continuar : palabras.iniciar}
          {continuando && (
            <span style={{ fontSize: 13.5, fontWeight: 800, opacity: 0.85, ...NUM_STYLE }}>
              {[tiempoTotal(vista.transcurrido), plan.total > 0 ? `${Math.min(vista.hechos, plan.total)} de ${plan.total}` : null].filter(Boolean).join(' · ')}
            </span>
          )}
        </button>
      </div>
      {fallo && (
        <div role="status" style={{ margin: '-6px 3px 14px', fontSize: 13.5, fontWeight: 600, color: LT.text2, lineHeight: 1.4 }}>
          No se pudo abrir el entreno. Puedes seguir con la lista de ejercicios.
        </div>
      )}
      {abierto && (
        <LimiteDelEntreno key={intento} alFallar={() => { setAbierto(false); setFallo(true); }}>
          <EntrenoDelDia
            dia={diaDeEntreno} aspecto={aspecto} registro={registro} onRegistro={onRegistro} onFormato={onFormato} sesionId={sesionId} userId={userId}
            unidadDePeso={perfil?.unidad_peso || 'kg'} oneRMs={oneRMs} salud={salud} medios={medios} alCerrar={() => setAbierto(false)} destinoDeTecnica={destinoDeTecnica}
          />
        </LimiteDelEntreno>
      )}
    </>
  );
}
