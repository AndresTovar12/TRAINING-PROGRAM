import { Component, useCallback, useMemo, useState } from 'react';
import { Play, X } from 'lucide-react';
import { LT, KP, FONT, NUM_STYLE } from '@/lib/theme';
import { usePlan } from '@/contexts/PlanContext';
import { usePerfilDeLaVista } from '@/contexts/VistaContext';
import { usePalabras } from '@/contexts/PalabrasContext';
import { portadaParaAtleta, videosParaAtleta } from '@/lib/videos';
import { iniciaEntreno, ocultaEntreno, pasosDeLaSesion, vistaDelEntreno } from '@/lib/entreno';
import { useConfirmacion } from '@/components/Confirmacion';
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

/**
 * El botón de la sesión que abre el MODO ENTRENO: «Iniciar entreno» (azul), «Continuar entreno 3 de 12» (con borde, y una ✕ para quitarlo) o nada.
 *
 * Va arriba de la lista de ejercicios del día, dentro de su tarjeta. No sale si no hay nada que entrenar (un descanso), si la sesión ya
 * está terminada (ya dice «Terminada»), ni cuando alguien mira el plan de otra persona en solo lectura.
 *
 * Tampoco vuelve: (1) si el entreno ya se dio por terminado, ni siquiera después de «Deshacer» la sesión (Andrés, 9 oct 2026: «si le pico
 * deshacer me vuelve a activar el botón de continuar entreno»); (2) si el atleta lo quitó con la ✕ («tampoco puedo hacer que desaparezca»).
 * Quitarlo no borra nada: lo anotado se queda en la lista de ejercicios.
 *
 * Es el único sitio que habla con los contextos de la app (el plan, el perfil de quien se mira, las palabras): `EntrenoDelDia` recibe todo
 * por propiedades, para poder probarse solo.
 */
export default function BotonDelEntreno({ dia, ejercicios, aspecto, registro, onRegistro, onFormato, sesionId, oneRMs }) {
  const { resolveExercise, medias } = usePlan();
  const { perfil, soloLectura, userId } = usePerfilDeLaVista();
  const { salud } = usePalabras();
  const pregunta = useConfirmacion();
  const [abierto, setAbierto] = useState(false);
  // Se abrió con «Iniciar entreno» (no con «Continuar»): si lo primero es un reloj, arranca solo (ver `EntrenoDelDia`).
  const [inicioNuevo, setInicioNuevo] = useState(false);
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
  // Ya se dio por terminado, o el atleta lo quitó: no hay nada que iniciar ni que continuar (si lo está mirando abierto, sigue abierto).
  if (!abierto && (vista.estado === 'fin' || vista.oculto)) return null;
  const empezado = vista.estado !== 'sin';
  const abre = () => {
    // El audio solo se despierta con un toque de la persona; con el reloj arrancando solo, este es el toque.
    preparaAudio();
    // La hora de inicio se guarda una sola vez.
    onRegistro((prev) => ({ ...prev, entreno: iniciaEntreno(prev?.entreno, Date.now()) }));
    setInicioNuevo(!empezado);
    setFallo(false);
    setIntento((n) => n + 1);
    setAbierto(true);
  };
  const quita = async () => {
    const va = await pregunta({
      titulo: palabras.quitarTitulo,
      detalle: 'Lo que ya anotaste se queda en la lista. Terminas la sesión desde ahí.',
      confirmar: 'Sí, quitarlo',
      peligro: true,
    });
    if (va) onRegistro((prev) => ({ ...prev, entreno: ocultaEntreno(prev?.entreno) }));
  };

  return (
    <>
      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        <button
          type="button" onClick={abre} className="kp-press"
          style={{
            flex: 1, minWidth: 0, minHeight: 54, borderRadius: 18, cursor: 'pointer', fontFamily: FONT, fontSize: 17, fontWeight: 800,
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
        {/* Quitar el entreno guiado: solo cuando ya empezó (ahí «Continuar» estorba si el atleta prefirió terminar con la lista). */}
        {empezado && (
          <button
            type="button" onClick={quita} className="kp-press" aria-label={palabras.quitarAria}
            style={{
              width: 54, minHeight: 54, flexShrink: 0, borderRadius: 18, border: `1.5px solid ${LT.borderHi}`, background: LT.surface, color: LT.text2, cursor: 'pointer',
              display: 'grid', placeItems: 'center', touchAction: 'manipulation',
            }}
          >
            <X size={20} />
          </button>
        )}
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
            unidadDePeso={perfil?.unidad_peso || 'kg'} oneRMs={oneRMs} salud={salud} medios={medios} inicioNuevo={inicioNuevo} alCerrar={() => setAbierto(false)}
          />
        </LimiteDelEntreno>
      )}
    </>
  );
}
