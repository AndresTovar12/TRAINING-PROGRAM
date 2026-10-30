import { Component, useCallback, useEffect, useMemo, useState } from 'react';
import { Check, ChevronRight, MoreHorizontal, Play } from 'lucide-react';
import { LT, KP, FONT, NUM_STYLE, UI } from '@/lib/theme';
import { usePlan } from '@/contexts/PlanContext';
import { usePerfilDeLaVista } from '@/contexts/VistaContext';
import { usePalabras } from '@/contexts/PalabrasContext';
import { portadaParaAtleta, videosParaAtleta } from '@/lib/videos';
import { pasosDeLaSesion, sesionEnBlanco, terminaSesion, vistaDelEntreno } from '@/lib/entreno';
import { tiempoTotal } from '@/lib/entrenoDatos';
import { recogeEntrenoPendiente } from '@/lib/entrenoPendiente';
import { palabrasDelEntreno } from '@/lib/entrenoPalabras';
import { horaDelDia, lineaDeLaSesionHecha } from '@/lib/paginaDelEntreno';
import { preparaAudio } from '@/lib/pitidos';
import { abreSesionHecha } from '@/lib/abreSesionHecha';
import { useConfirmacion } from '@/components/Confirmacion';
import { useAviso } from '@/components/AvisoPasajero';
import HojaDeAcciones from '@/components/HojaDeAcciones';
import HojaFlotante from '@/components/HojaFlotante';
import Boton from '@/components/ui/Boton';
import EntrenoDelDia from '@/features/training/EntrenoDelDia';
import { borraRecorrido } from '@/features/training/useRecorrido';

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

/* ------------------------------------------------------------------ */
/* Las piezas que se ven                                               */
/* ------------------------------------------------------------------ */

// La pastilla de estado: «Hecha · 8:55 a. m.» (verde, y abre el «···») o «A medias» (azul).
const estiloPastilla = { display: 'inline-flex', alignItems: 'center', gap: 5, border: 'none', borderRadius: 99, padding: '6px 11px', fontFamily: FONT, fontSize: 13, fontWeight: 800, whiteSpace: 'nowrap', ...NUM_STYLE };

function Pastilla({ estado, hora, alTocar }) {
  if (estado === 'curso') return <span style={{ ...estiloPastilla, background: KP.blueSoft, color: KP.blue }}>A medias</span>;
  const texto = <><Check size={13} strokeWidth={3} /> {hora ? `Hecha · ${hora}` : 'Hecha'}</>;
  const verde = { ...estiloPastilla, background: KP.mintSoft, color: '#047857' };
  return alTocar
    ? <button type="button" onClick={alTocar} className="kp-press" style={{ ...verde, cursor: 'pointer', touchAction: 'manipulation' }}>{texto}</button>
    : <span style={verde}>{texto}</span>;
}

/** El «···» chico, cuadrado, de la sesión: en el encabezado de su tarjeta (`TarjetaDeSesion`) o, sin tarjeta, a la derecha de la pastilla. */
export function BotonMasDeLaSesion({ alTocar, tamano = 38 }) {
  return (
    <button
      type="button" onClick={alTocar} aria-label="Más opciones de la sesión" aria-haspopup="dialog" className="kp-press"
      style={{ width: tamano, height: tamano, borderRadius: 12, border: 'none', background: UI.relleno, color: LT.text, display: 'grid', placeItems: 'center', flexShrink: 0, cursor: 'pointer', touchAction: 'manipulation' }}
    >
      <MoreHorizontal size={20} />
    </button>
  );
}

/**
 * «Marcar como hecha»: para quien entrenó sin el entreno guiado. Va debajo de la lista de ejercicios, gris (no es lo principal), y solo con la sesión sin empezar. Es UNA pieza para la
 * sesión de siempre y para las tarjetas de un día doble o de un equipo: antes el botón de terminar estaba copiado en las dos.
 */
export function MarcarComoHecha({ alMarcar }) {
  return (
    <div style={{ marginTop: 14 }}>
      <Boton tipo="secundario" ancho icono={Check} onClick={alMarcar}>Marcar como hecha</Boton>
      <p style={{ margin: '8px 6px 0', textAlign: 'center', fontSize: 13, fontWeight: 500, color: LT.text2, lineHeight: 1.45 }}>Si entrenaste sin el entreno guiado.</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* El control de la sesión                                             */
/* ------------------------------------------------------------------ */

/**
 * LOS BOTONES DE LA SESIÓN DEL DÍA (29 oct 2026, prototipo de caminos, grupo «La sesión del día»). Un solo botón grande por ESTADO de ESA sesión (cada sesión del día tiene el suyo):
 *   · sin empezar  «Iniciar entreno» (azul), abre el MODO ENTRENO. Debajo de la lista, «Marcar como hecha» (`MarcarComoHecha`) para quien entrena sin la app.
 *   · en curso     «Continuar · 14:32 · 3 de 12» (azul igual: tiempo vivo y pasos hechos). «En curso» empieza con el primer «Listo», no al abrir: abrir y cerrar sin hacer nada no cuenta.
 *   · hecha        la pastilla «✓ Hecha · 8:55 a. m.» y «Ver tu entreno» (blanco, dos renglones), que abre la página del entreno. Ya no hay bloque verde, «Stickers» ni «Deshacer» a la vista:
 *                  compartir vive en la página.
 * Lo que BORRA o reinicia no se toca por error: vive en el «···» (solo en curso o hecha) y pregunta solo lo que borra. En curso: «Terminar ahora» y «Empezar de nuevo». Hecha: «Ver tu entreno»,
 * «Hacerla otra vez» y «Marcar como no hecha». Lo hecho nunca se pierde: pasa a `anteriores` y se queda en «Tus entrenos» (ver `sesionEnBlanco`); solo «Empezar de nuevo» lo borra, porque nunca se terminó.
 *
 * Es un gancho y no un componente porque el «···» vive en el encabezado de la tarjeta (`TarjetaDeSesion`), lejos del botón: quien arma el día (`CuerpoDelDia`) llama a este gancho una vez y
 * reparte las piezas: `boton` (arriba de la lista de ejercicios), `abreMenu` (el «···» de la tarjeta) y `hojas` (el menú, las preguntas y el entreno a pantalla completa).
 *
 * Ya NO hay ✕ (23 oct 2026, PDF «Botones de interacción en el entreno»: quitaba el botón para siempre y nada lo explicaba). Los botones no salen si no hay nada que entrenar (un descanso), ni cuando alguien
 * mira el plan de otra persona en solo lectura (ahí, si está hecha, solo la pastilla). `menuEnLaFila`: sin tarjeta, el «···» va junto a la pastilla. `activo`: `CuerpoDelDia` se dibuja varias veces en
 * un día con equipo, pero solo la pieza de las sesiones lleva los botones (y recoge el «Empezar» de Home).
 *
 * Es el único sitio que habla con los contextos de la app (el plan, el perfil de quien se mira, las palabras): `EntrenoDelDia` recibe todo por propiedades, para poder probarse solo.
 */
export function useBotonesDeLaSesion({ dia, ejercicios, aspecto = null, registro, onRegistro, onFormato, sesionId, oneRMs, autor = null, activo = true, menuEnLaFila = false }) {
  const { resolveExercise, medias, programaActivo, claveDe } = usePlan();
  const { perfil, soloLectura, userId } = usePerfilDeLaVista();
  const { salud, coach } = usePalabras();
  const pregunta = useConfirmacion();
  const { avisa } = useAviso();
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
  const [menu, setMenu] = useState(false);
  // Home pidió abrir el entreno de esta sesión («Empezar»): se lee una sola vez, al montar.
  // Se apaga en cuanto se usa: si no, al cerrar el entreno se volvería a abrir solo.
  const [abrirYa, setAbrirYa] = useState(() => (activo ? recogeEntrenoPendiente(sesionId) : false));
  const [intento, setIntento] = useState(0);
  const [fallo, setFallo] = useState(false);
  // Una sesión que dice «repite el martes» se entrena con los ejercicios del martes (`ejercicios`); lo que se anota queda en SU lugar.
  const diaDeEntreno = useMemo(() => (ejercicios ? { ...dia, exercises: ejercicios } : dia), [dia, ejercicios]);
  const plan = useMemo(() => {
    try { return pasosDeLaSesion(diaDeEntreno); } catch (error) { console.error('[entreno] no se pudo armar la sesión:', error); return null; }
  }, [diaDeEntreno]);
  const hayQueEntrenar = !!plan && plan.pasos.length > 0;

  // El tiempo del entreno en curso se ve vivo en el botón: un tic por segundo, solo mientras hay entreno empezado y sin terminar.
  const [ahora, setAhora] = useState(() => Date.now());
  const enCursoSinFin = activo && !!registro?.entreno?.inicio && registro.entreno.fin == null && !registro?.completed;
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

  // El estado de la sesión. «Continuar» solo cuando ya hay algo hecho: abrir el entreno y cerrarlo sin tocar un paso no es «Continuar entreno 0 de 7», es empezar.
  const hecha = !!registro?.completed;
  const vista = hayQueEntrenar ? vistaDelEntreno(plan, registro?.entreno, ahora) : null;
  const continuando = !!vista && vista.estado !== 'sin' && vista.hechos + vista.saltados > 0;
  const estado = !activo ? null : hecha ? 'hecha' : continuando ? 'curso' : 'sin';
  const conBotones = !!estado && !soloLectura;

  // Si el botón no se va a mostrar (sesión terminada, solo lectura), el aviso de «Empezar» no se queda esperando: si no, al «Marcar como no hecha» el entreno se abriría solo.
  const sinBoton = soloLectura || !hayQueEntrenar || hecha;
  useEffect(() => { if (abrirYa && sinBoton) setAbrirYa(false); }, [abrirYa, sinBoton]);

  const abre = () => {
    // El audio solo se despierta con un toque de la persona; con el reloj arrancando solo, este es el toque.
    preparaAudio();
    setFallo(false);
    setIntento((n) => n + 1);
    setAbierto(true);
  };
  const verTuEntreno = () => abreSesionHecha({ almacen: claveDe ? claveDe('wr:sessions') : 'wr:sessions', id: sesionId });

  /* LA NOTA ES DE CADA WORKOUT (Andrés, 30 oct 2026): el cuadro «Tus notas» del día no decía de qué sesión era, estorbaba y casi nadie lo usaba. Ahora se
     escribe al terminar (la página del workout) o desde el «···» de su tarjeta, y si hay una se ve en una línea gris dentro de esa tarjeta. Es el mismo
     `notes` de la sesión que usaba el cuadro: lo ya escrito no se pierde. */
  const nota = String(registro?.notes ?? '').trim();
  const [notaAbierta, setNotaAbierta] = useState(false);
  const guardaNota = (texto) => onRegistro((prev) => ({ ...prev, notes: texto.trim() }));

  /* Las acciones del «···». Cada una escribe en la sesión al instante. La copia del recorrido de este teléfono se borra al terminar o dejar en blanco: si no, al volver a hacer la sesión
     (misma llave) la línea de la vez anterior reaparecería y se mezclaría con la nueva. */
  const terminarAhora = () => {
    borraRecorrido(sesionId);
    onRegistro((prev) => terminaSesion(prev, Date.now()));
    // Igual que el final del entreno guiado: la página del workout, con su celebración.
    abreSesionHecha({ almacen: claveDe ? claveDe('wr:sessions') : 'wr:sessions', id: sesionId, recien: true });
  };
  const empezarDeNuevo = async () => {
    const llevas = vista && vista.total > 0 ? `: ${vista.hechos} de ${vista.total} series` : '';
    const si = await pregunta({ titulo: '¿Empezar de nuevo?', detalle: `Se borra lo que llevas de esta sesión${llevas}.`, confirmar: 'Empezar de nuevo', peligro: true });
    if (!si) return;
    borraRecorrido(sesionId);
    // No se guarda en `anteriores`: nunca se terminó.
    onRegistro((prev) => sesionEnBlanco(prev, { archiva: false }));
  };
  const hacerlaOtraVez = () => {
    borraRecorrido(sesionId);
    onRegistro((prev) => sesionEnBlanco(prev));
    avisa('Tu entreno anterior se quedó en «Tus entrenos».');
    if (hayQueEntrenar) abre();
  };
  const marcarComoNoHecha = async () => {
    const si = await pregunta({
      titulo: '¿Marcar como no hecha?', detalle: 'Lo que hiciste no se pierde: se queda en «Tus entrenos». La sesión vuelve a «Iniciar entreno».', confirmar: 'Marcar como no hecha', peligro: true,
    });
    if (!si) return;
    borraRecorrido(sesionId);
    onRegistro((prev) => sesionEnBlanco(prev));
    avisa('Listo. La sesión quedó sin hacer.');
  };
  // «Marcar como hecha» (a mano): no abre la página ni celebra; la tarjeta pasa a «Hecha».
  const marcarComoHecha = () => {
    borraRecorrido(sesionId);
    onRegistro((prev) => terminaSesion(prev, Date.now()));
  };

  const accionDeNota = { texto: nota ? 'Editar tu nota' : 'Agregar una nota', onClick: () => setNotaAbierta(true) };
  const acciones = estado === 'curso'
    ? [{ texto: 'Terminar ahora', onClick: terminarAhora }, accionDeNota, { texto: 'Empezar de nuevo', onClick: empezarDeNuevo, peligro: true }]
    : [{ texto: 'Ver tu entreno', onClick: verTuEntreno }, accionDeNota, { texto: 'Hacerla otra vez', onClick: hacerlaOtraVez }, { texto: 'Marcar como no hecha', onClick: marcarComoNoHecha, peligro: true }];
  const conMenu = conBotones && (estado === 'curso' || estado === 'hecha');
  const abreMenu = () => setMenu(true);

  const palabras = palabrasDelEntreno(salud);
  let boton = null;
  if (estado === 'hecha') {
    const iso = registro?.completedAt;
    const hora = iso && Number.isFinite(Date.parse(iso)) ? horaDelDia(Date.parse(iso), -new Date(iso).getTimezoneOffset()) : '';
    boton = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <Pastilla estado="hecha" hora={hora} alTocar={conMenu ? abreMenu : null} />
          {conMenu && menuEnLaFila && <BotonMasDeLaSesion alTocar={abreMenu} />}
        </div>
        {conBotones && (
          <button
            type="button" onClick={verTuEntreno} className="kp-press"
            style={{
              display: 'flex', alignItems: 'center', gap: 12, width: '100%', border: 'none', borderRadius: 16, padding: '13px 14px', textAlign: 'left', background: LT.surface, color: LT.text,
              boxShadow: '0 1px 2px rgba(17,19,24,0.06), 0 2px 10px rgba(17,19,24,0.07)', cursor: 'pointer', fontFamily: FONT, touchAction: 'manipulation',
            }}
          >
            <span style={{ flex: 1, minWidth: 0 }}>
              <b style={{ display: 'block', fontSize: 15.5, fontWeight: 800 }}>Ver tu entreno</b>
              <span style={{ display: 'block', marginTop: 2, fontSize: 13, fontWeight: 500, color: LT.text2, ...NUM_STYLE }}>{lineaDeLaSesionHecha(registro)}</span>
            </span>
            <ChevronRight size={18} color={LT.text3} style={{ flexShrink: 0 }} />
          </button>
        )}
      </div>
    );
  } else if (conBotones && hayQueEntrenar) {
    boton = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
        {estado === 'curso' && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <Pastilla estado="curso" />
            {menuEnLaFila && <BotonMasDeLaSesion alTocar={abreMenu} />}
          </div>
        )}
        <button
          type="button" onClick={abre} className="kp-press"
          style={{
            // El botón principal de `components/ui` (azul lleno): el mismo en «Iniciar entreno» y en «Continuar» (Andrés, 29 oct 2026: antes «Seguir» era gris con letras azules).
            width: '100%', minHeight: 56, borderRadius: 16, cursor: 'pointer', fontFamily: FONT, fontSize: 17, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, touchAction: 'manipulation', border: 'none', background: KP.blue, color: '#fff', boxShadow: '0 8px 20px rgba(30,64,224,0.22)',
          }}
        >
          <Play size={18} fill="#fff" />
          {estado === 'curso' ? palabras.continuar : palabras.iniciar}
          {estado === 'curso' && (
            <span style={{ fontSize: 13.5, fontWeight: 800, opacity: 0.85, ...NUM_STYLE }}>
              {`· ${[tiempoTotal(vista.transcurrido), plan.total > 0 ? `${Math.min(vista.hechos, plan.total)} de ${plan.total}` : null].filter(Boolean).join(' · ')}`}
            </span>
          )}
        </button>
      </div>
    );
  }

  // La nota, en una línea gris dentro de la tarjeta (dos renglones como mucho). Con botones se toca para editarla.
  if (nota) {
    const linea = (
      <button
        type="button" onClick={conBotones ? () => setNotaAbierta(true) : undefined} disabled={!conBotones} aria-label={`Tu nota: ${nota}`}
        style={{
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', width: '100%', textAlign: 'left', border: 'none', background: 'transparent',
          padding: '0 3px', margin: '0 0 14px', fontFamily: FONT, fontSize: 14, lineHeight: 1.45, color: LT.text2, cursor: conBotones ? 'pointer' : 'default', touchAction: 'manipulation',
        }}
      >
        <b style={{ fontWeight: 700, color: LT.text }}>Tu nota: </b>{nota}
      </button>
    );
    boton = boton ? <>{boton}{linea}</> : linea;
  }

  const hojas = (
    <>
      {notaAbierta && <HojaDeLaNota nota={nota} alGuardar={guardaNota} alCerrar={() => setNotaAbierta(false)} />}
      {abrirYa && !sinBoton && <AbreAlAparecer alAparecer={() => { setAbrirYa(false); abre(); }} />}
      {fallo && (
        <div role="status" style={{ margin: '0 3px 14px', fontSize: 13.5, fontWeight: 600, color: LT.text2, lineHeight: 1.4 }}>
          No se pudo abrir el entreno. Puedes seguir con la lista de ejercicios.
        </div>
      )}
      {menu && conMenu && <HojaDeAcciones acciones={acciones} alCerrar={() => setMenu(false)} etiqueta="Opciones de la sesión" />}
      {abierto && conBotones && hayQueEntrenar && (
        <LimiteDelEntreno key={intento} alFallar={() => { setAbierto(false); setFallo(true); }}>
          <EntrenoDelDia
            dia={diaDeEntreno} aspecto={aspecto} registro={registro} onRegistro={onRegistro} onFormato={onFormato} sesionId={sesionId} userId={userId}
            unidadDePeso={perfil?.unidad_peso || 'kg'} oneRMs={oneRMs} salud={salud} medios={medios} alCerrar={() => setAbierto(false)} destinoDeTecnica={destinoDeTecnica}
            // Al terminar, la página del workout (fase 6): la sesión vive en el almacén del programa que se está viendo.
            alTerminado={() => abreSesionHecha({ almacen: claveDe ? claveDe('wr:sessions') : 'wr:sessions', id: sesionId, recien: true })}
          />
        </LimiteDelEntreno>
      )}
    </>
  );

  return { estado, boton, conMenu, abreMenu, hojas, puedeMarcarHecha: !!activo && !soloLectura && estado === 'sin', marcarComoHecha };
}

/** La hoja para escribir la nota de ESTE workout (desde el «···» de su tarjeta o tocando su línea). Se guarda con «Guardar»; vacía, la nota se quita. */
function HojaDeLaNota({ nota, alGuardar, alCerrar }) {
  const [texto, setTexto] = useState(nota);
  return (
    <HojaFlotante
      titulo="Tu nota" subtitulo="Cómo te sentiste, qué ajustarías. La ve quien te entrena." onCerrar={alCerrar}
      pie={<Boton ancho onClick={() => { alGuardar(texto); alCerrar(); }}>Guardar</Boton>}
    >
      <textarea
        aria-label="Tu nota" value={texto} onChange={(e) => setTexto(e.target.value)} rows={4} autoFocus
        placeholder="Cómo te sentiste, qué ajustarías…"
        style={{ display: 'block', width: '100%', boxSizing: 'border-box', border: 'none', borderRadius: 14, background: UI.relleno, padding: '12px 14px', fontFamily: FONT, fontSize: 16, lineHeight: 1.45, color: LT.text, resize: 'none', outline: 'none' }}
      />
    </HojaFlotante>
  );
}
