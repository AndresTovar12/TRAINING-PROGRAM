import { Component, useCallback, useMemo, useState } from 'react';
import { Play } from 'lucide-react';
import { LT, KP, FONT, NUM_STYLE } from '@/lib/theme';
import { usePlan } from '@/contexts/PlanContext';
import { usePerfilDeLaVista } from '@/contexts/VistaContext';
import { usePalabras } from '@/contexts/PalabrasContext';
import { portadaParaAtleta, videosParaAtleta } from '@/lib/videos';
import { iniciaEntreno, pasosDeLaSesion, reabreEntreno, vistaDelEntreno } from '@/lib/entreno';
import { palabrasDelEntreno } from '@/lib/entrenoPalabras';
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

/**
 * El botón de la sesión que abre el MODO ENTRENO: «Iniciar entreno» (azul), «Continuar entreno 3 de 12» (con borde) o nada.
 *
 * Va arriba de la lista de ejercicios del día, dentro de su tarjeta. No sale si no hay nada que entrenar (un descanso), si la sesión ya
 * está terminada (ya dice «Terminada»), ni cuando alguien mira el plan de otra persona en solo lectura.
 *
 * Es el único sitio que habla con los contextos de la app (el plan, el perfil de quien se mira, las palabras): `EntrenoDelDia` recibe todo
 * por propiedades, para poder probarse solo.
 */
export default function BotonDelEntreno({ dia, ejercicios, aspecto, registro, onRegistro, onFormato, sesionId, oneRMs }) {
  const { resolveExercise, medias } = usePlan();
  const { perfil, soloLectura, userId } = usePerfilDeLaVista();
  const { salud } = usePalabras();
  const [abierto, setAbierto] = useState(false);
  const [intento, setIntento] = useState(0);
  const [fallo, setFallo] = useState(false);
  // Una sesión que dice «repite el martes» se entrena con los ejercicios del martes (`ejercicios`); lo que se anota queda en SU lugar.
  const diaDeEntreno = useMemo(() => (ejercicios ? { ...dia, exercises: ejercicios } : dia), [dia, ejercicios]);
  const plan = useMemo(() => {
    try { return pasosDeLaSesion(diaDeEntreno); } catch (error) { console.error('[entreno] no se pudo armar la sesión:', error); return null; }
  }, [diaDeEntreno]);

  // La foto y los videos que le tocan a ESTA persona (uno solo para ella, de su género, o el general): ver `FichaEjercicio`.
  const medios = useCallback((ex) => {
    const repertorio = resolveExercise(ex) || { name: ex.name };
    return { portada: portadaParaAtleta(repertorio, medias, perfil), videos: videosParaAtleta(repertorio, medias, perfil) };
  }, [resolveExercise, medias, perfil]);

  if (soloLectura || !plan || plan.pasos.length === 0 || registro?.completed) return null;

  const palabras = palabrasDelEntreno(salud);

  // Aquí la hora no importa: solo se mira si ya empezó y cuántos pasos van.
  const vista = vistaDelEntreno(plan, registro?.entreno, 0);
  const empezado = vista.estado !== 'sin';
  const abre = () => {
    // Un entreno dado por terminado cuya sesión se deshizo vuelve a quedar abierto; uno nuevo guarda su hora de inicio.
    onRegistro((prev) => ({ ...prev, entreno: vista.estado === 'fin' ? reabreEntreno(prev?.entreno) : iniciaEntreno(prev?.entreno, Date.now()) }));
    setFallo(false);
    setIntento((n) => n + 1);
    setAbierto(true);
  };

  return (
    <>
      <button
        type="button" onClick={abre} className="kp-press"
        style={{
          width: '100%', minHeight: 54, marginBottom: 14, borderRadius: 18, cursor: 'pointer', fontFamily: FONT, fontSize: 17, fontWeight: 800,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, touchAction: 'manipulation',
          ...(empezado
            ? { border: `2px solid ${LT.blue}`, background: LT.surface, color: LT.blue }
            : { border: 'none', background: `linear-gradient(140deg, ${KP.blue}, ${KP.blueDk})`, color: '#fff', boxShadow: KP.shBtn }),
        }}
      >
        <Play size={empezado ? 17 : 18} fill={empezado ? 'none' : '#fff'} />
        {empezado ? palabras.continuar : palabras.iniciar}
        {empezado && plan.total > 0 && (
          <span style={{ fontSize: 13.5, fontWeight: 800, opacity: 0.85, ...NUM_STYLE }}>{Math.min(vista.hechos, plan.total)} de {plan.total}</span>
        )}
      </button>
      {fallo && (
        <div role="status" style={{ margin: '-6px 3px 14px', fontSize: 13.5, fontWeight: 600, color: LT.text2, lineHeight: 1.4 }}>
          No se pudo abrir el entreno. Puedes seguir con la lista de ejercicios.
        </div>
      )}
      {abierto && (
        <LimiteDelEntreno key={intento} alFallar={() => { setAbierto(false); setFallo(true); }}>
          <EntrenoDelDia
            dia={diaDeEntreno} aspecto={aspecto} registro={registro} onRegistro={onRegistro} onFormato={onFormato} sesionId={sesionId} userId={userId}
            unidadDePeso={perfil?.unidad_peso || 'kg'} oneRMs={oneRMs} salud={salud} medios={medios} alCerrar={() => setAbierto(false)}
          />
        </LimiteDelEntreno>
      )}
    </>
  );
}
