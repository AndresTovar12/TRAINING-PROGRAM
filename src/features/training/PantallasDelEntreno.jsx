import { useState } from 'react';
import { Bell, BellOff, Check, ChevronLeft, ChevronRight, List, Minus, Pencil, Play, Plus, Timer, Video, X } from 'lucide-react';
import { LT, KP, FONT, NUM_STYLE } from '@/lib/theme';
import { textoDeResultado } from '@/lib/formatos';
import { relojDe } from '@/lib/entrenoDatos';

/**
 * Las pantallas del modo entreno: lo que se DIBUJA. Qué paso toca, cuándo avisar y qué se guarda lo decide `EntrenoDelDia`; aquí no
 * hay lógica del entreno, solo piezas que reciben lo que van a decir.
 *
 * Todo sigue la maqueta «Modo entreno» que Andrés aprobó (9 oct 2026), y el estilo de las otras pantallas completas (la ficha del
 * ejercicio, el reloj del bloque): una columna de 520 px que se desplaza, el botón principal fijo abajo y números enormes.
 *
 * LA REGLA DE ORO: se dibuja SOLO lo que el coach escribió. Sin video no hay hueco de video; sin cifras no hay tarjetas; sin
 * notas no hay párrafo. Una pantalla de un ejercicio que solo trae su nombre es el nombre, «Sigue: …» y un botón.
 *
 * SIN LETRAS GRISES (Andrés, 9 oct 2026: «nadie se va a detener mid workout a leer las letritas grises»): ni «Serie 2 de 4 · Vuelta 2 de 3»
 * en un renglón chiquito, ni «Toca Seguir cuando estés listo». Pero lo que se dice tiene que SE LEER: esa misma noche, ya probándolo, los
 * puntitos de las vueltas «no se entienden» y los botones de abajo «estaban muy escondidos». Entonces: la serie va con su palabra, en una
 * pastilla («Serie 2 de 5»), y todo lo que se puede tocar es un botón de verdad, con borde y con lo que hace escrito. Y el tiempo que
 * llevas SÍ se ve, arriba, en una pastilla («En ningún momento puedo ver cuánto tiempo llevo entrenando»).
 */

/* ------------------------------------------------------------------ */
/* Piezas chicas                                                       */
/* ------------------------------------------------------------------ */

const redondo = {
  width: 38, height: 38, borderRadius: '50%', border: `1px solid ${LT.border}`, cursor: 'pointer', background: LT.surface,
  color: LT.text, display: 'grid', placeItems: 'center', flexShrink: 0, touchAction: 'manipulation',
};

const COLUMNA = { maxWidth: 520, margin: '0 auto', width: '100%', boxSizing: 'border-box' };

/** El botón grande de abajo. `variante`: 'azul' (lo principal), 'borde' (lo de al lado) o 'verde' (terminar). */
function BotonGrande({ children, onClick, variante = 'azul', disabled = false }) {
  const base = {
    width: '100%', minHeight: 60, borderRadius: 18, cursor: disabled ? 'default' : 'pointer', display: 'flex', alignItems: 'center',
    justifyContent: 'center', gap: 10, fontFamily: FONT, fontSize: 18, fontWeight: 800, touchAction: 'manipulation',
  };
  const estilos = {
    azul: { border: 'none', color: '#fff', background: `linear-gradient(140deg, ${KP.blue}, ${KP.blueDk})`, boxShadow: KP.shBtn },
    verde: { border: 'none', color: '#fff', background: LT.mint, boxShadow: '0 8px 22px rgba(0,163,114,0.24)' },
    borde: { border: `2px solid ${LT.blue}`, color: LT.blue, background: LT.surface, minHeight: 54, fontSize: 16.5 },
  };
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="kp-press" style={{ ...base, ...estilos[variante] }}>
      {children}
    </button>
  );
}

/**
 * Un botón de los que NO son lo principal pero tienen que verse («Anterior», «Saltar», «Cambiar reps o kilos»): borde y letra firmes, con lo que
 * hace escrito. Andrés (9 oct 2026): los de texto suelto de abajo «están muy escondidos, ni me había percatado de que estaban».
 * `ancho`: ocupa toda la línea; si no, comparte la fila con su vecino a partes iguales.
 */
function BotonSecundario({ children, onClick, disabled = false, ancho = false }) {
  return (
    <button
      type="button" onClick={onClick} disabled={disabled} className="kp-press"
      style={{
        flex: ancho ? undefined : 1, width: ancho ? '100%' : undefined, minWidth: 0, minHeight: 50, borderRadius: 16, cursor: disabled ? 'default' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '0 10px', fontFamily: FONT, fontSize: 15.5, fontWeight: 800,
        touchAction: 'manipulation', border: `1.5px solid ${disabled ? LT.border : LT.borderHi}`, background: LT.surface,
        color: disabled ? LT.text3 : LT.text, opacity: disabled ? 0.65 : 1,
      }}
    >
      {children}
    </button>
  );
}

// Un botón de texto (para las hojas: «Cancelar», «Seguir»…).
function BotonDeTexto({ children, onClick, disabled = false, color = LT.text2 }) {
  return (
    <button
      type="button" onClick={onClick} disabled={disabled}
      style={{
        border: 'none', background: 'transparent', cursor: disabled ? 'default' : 'pointer', fontFamily: FONT, fontSize: 15, fontWeight: 800,
        color: disabled ? LT.borderHi : color, padding: '10px 6px', display: 'inline-flex', alignItems: 'center', gap: 4, touchAction: 'manipulation',
      }}
    >
      {children}
    </button>
  );
}

/**
 * «Grabar técnica para el coach»: la cámara de cada paso. Mientras la función esté apagada (`lib/funciones.js`) lleva su «Pronto», igual que
 * «Mensajes»; en un teléfono muy angosto la palabra se esconde (`.pronto-texto`) y queda el ícono, para que quepa la fila.
 */
function BotonDeTecnica({ activa, etiqueta, onClick }) {
  return (
    <button
      type="button" onClick={onClick} aria-label={etiqueta}
      style={{
        border: 'none', background: 'transparent', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 4px',
        color: LT.text2, touchAction: 'manipulation',
      }}
    >
      <Video size={19} />
      {!activa && (
        <span
          className="pronto-texto"
          style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 0.3, padding: '3px 7px', borderRadius: 7, background: LT.surface2, color: LT.text2 }}
        >
          Pronto
        </span>
      )}
    </button>
  );
}

function Pastilla({ children, fuerte = false }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 999, fontSize: 12.5, fontWeight: 800,
      background: fuerte ? LT.blueSoft : LT.surface2, color: fuerte ? LT.blue : LT.text2, ...NUM_STYLE,
    }}>
      {children}
    </span>
  );
}

// La etiqueta de lo que es un Set («BI-SERIE», «CON RELOJ»): azul suave; gris (`suave`) si es un aviso («OPCIONAL»).
function Etiqueta({ children, suave = false }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 9px', borderRadius: 7, fontSize: 11.5, fontWeight: 800, letterSpacing: 0.5,
      textTransform: 'uppercase', whiteSpace: 'nowrap', background: suave ? LT.surface2 : LT.blueSoft, color: suave ? LT.text2 : LT.blue,
    }}>
      {children}
    </span>
  );
}

/**
 * En qué serie va, con su palabra: «Serie 2 de 5». Antes eran puntos junto al nombre (llena = hecha, anillo = la que va) y Andrés los probó con su
 * iPhone: «los puntitos de los sets no se les entiende ni representan lo suficiente… al menos no en las primeras experiencias del usuario». Una
 * pastilla azul con la palabra se lee a la primera. `puntos` viene de `puntosDeVueltas`: cada vuelta del Set es una serie del ejercicio (o del par,
 * en una bi-serie). Con una sola vuelta no sale.
 */
export function SerieDelSet({ puntos }) {
  if (!puntos || puntos.length < 2) return null;
  const queVa = puntos.findIndex((p) => p.estado === 'actual');
  const numero = queVa >= 0 ? queVa + 1 : Math.min(puntos.length, puntos.filter((p) => p.estado === 'hecha').length + 1);
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', flexShrink: 0, whiteSpace: 'nowrap', padding: '6px 12px', borderRadius: 999, fontSize: 14, fontWeight: 800,
      background: LT.blueSoft, color: LT.blue, ...NUM_STYLE,
    }}>
      Serie {numero} de {puntos.length}
    </span>
  );
}

/**
 * La serie a la vista, solo en un Set de dos ejercicios o más: el tipo («BI-SERIE») y el par A/B. El que toca va en azul con su nombre; lo hecho,
 * con su palomita; lo que falta, con su letra. Con dos ejercicios se dicen los dos nombres; con más, solo el del que toca (el nombre ya está en
 * grande debajo). `serie` viene de `serieALaVista`.
 */
function SerieALaVista({ serie, simple = false }) {
  // La versión básica (la web) solo dice qué es («BI-SERIE»); el par A/B es de la guía completa.
  if (simple) return <div style={{ marginTop: 12 }}><Etiqueta>{serie.nombre}</Etiqueta></div>;
  const nombres = serie.letras.length === 2;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 12 }}>
      <Etiqueta>{serie.nombre}</Etiqueta>
      <span style={{
        display: 'inline-flex', flexWrap: 'wrap', gap: 2, padding: 3, minWidth: 0, maxWidth: '100%', boxSizing: 'border-box',
        border: `1.5px solid ${LT.border}`, borderRadius: serie.letras.length > 4 ? 18 : 999, background: LT.surface,
      }}>
        {serie.letras.map((l) => {
          const toca = l.estado === 'actual';
          return (
            <span
              key={l.letra} aria-current={toca ? 'step' : undefined}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 30, padding: nombres || toca ? '0 12px 0 10px' : '0 10px', borderRadius: 999,
                fontSize: 13.5, fontWeight: 700, minWidth: 0, boxSizing: 'border-box', background: toca ? LT.blue : 'transparent', color: toca ? '#fff' : LT.text2,
              }}
            >
              {l.estado === 'hecho'
                ? <Check size={14} strokeWidth={3} color={LT.mint} style={{ flexShrink: 0 }} aria-label="Hecho" />
                : <b style={{ fontWeight: 800, color: toca ? '#fff' : LT.blue, opacity: toca ? 0.9 : 0.85 }}>{l.letra}</b>}
              {(nombres || toca) && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{l.nombre}</span>}
            </span>
          );
        })}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* La barra de arriba                                                  */
/* ------------------------------------------------------------------ */

/**
 * Cerrar, el avance por Sets, el tiempo que llevas y «Ver todo». Sin `onLista` (la versión básica de la web) no sale «Ver todo»; sin `tiempo`
 * (todavía no inicia, o pasaron muchas horas) no sale el tiempo. Cerrar sale directo: el avance ya está guardado y «Continuar entreno» lo retoma.
 */
export function BarraDelEntreno({ segmentos, fondo, palabras, tiempo, onCerrar, onLista }) {
  return (
    <div style={{ position: 'sticky', top: 0, zIndex: 5, background: fondo, padding: 'calc(10px + env(safe-area-inset-top)) 0 8px' }}>
      <div style={{ ...COLUMNA, padding: '0 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button type="button" onClick={onCerrar} aria-label={palabras.salirAria} style={redondo}><X size={20} /></button>
          <div style={{ flex: 1, display: 'flex', gap: 5 }} aria-hidden="true">
            {segmentos.map((f, i) => (
              <span key={i} style={{ flex: 1, height: 5, borderRadius: 3, background: 'rgba(17,19,24,0.1)', overflow: 'hidden' }}>
                <span style={{ display: 'block', height: '100%', width: `${Math.round(f * 100)}%`, background: LT.text, borderRadius: 3, transition: 'width 0.25s' }} />
              </span>
            ))}
          </div>
          {tiempo && (
            <span
              role="timer" aria-label={`Llevas ${tiempo}`}
              style={{
                height: 38, padding: '0 13px 0 11px', borderRadius: 999, border: `1px solid ${LT.border}`, background: LT.surface, color: LT.text, flexShrink: 0,
                display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: FONT, fontSize: 15, fontWeight: 800, ...NUM_STYLE,
              }}
            >
              <Timer size={17} color={LT.blue} /> {tiempo}
            </span>
          )}
          {onLista && (
            <button
              type="button" onClick={onLista} className="kp-press"
              style={{
                height: 38, padding: '0 14px 0 11px', borderRadius: 999, border: `1px solid ${LT.border}`, background: LT.surface, color: LT.blue, cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0, fontFamily: FONT, fontSize: 13.5, fontWeight: 800, touchAction: 'manipulation',
              }}
            >
              <List size={17} /> Ver todo
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Un ejercicio (o una nota)                                           */
/* ------------------------------------------------------------------ */

// Una cifra grande con su rótulo debajo: «5 reps», «78% carga», «≈105 kg». El número se achica solo para caber en UNA línea en un teléfono
// angosto (ver `.cifra-valor` en index.css): «78» arriba y «%» abajo se leería como dos cosas distintas.
function Cifra({ valor, etiqueta, destacado = false, texto = false }) {
  return (
    <div className="cifra" style={{
      flex: 1, minWidth: 0, background: LT.surface, border: `1px solid ${LT.border}`, borderRadius: 16, padding: '14px 8px 12px', textAlign: 'center',
    }}>
      <div
        className={texto ? 'cifra-texto' : 'cifra-valor'}
        style={{ '--n': String(valor).length, fontWeight: 800, color: destacado ? LT.blue : LT.text, ...NUM_STYLE }}
      >
        {valor}
      </div>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: LT.text2, marginTop: 5 }}>{etiqueta}</div>
    </div>
  );
}

/**
 * El cronómetro OPCIONAL de un paso con tiempo (la plancha de 30 seg, el «2 min» de un lapso). Es una ayuda, nunca una orden: al llegar
 * a cero avisa y sigue contando hacia arriba, pero no marca nada ni avanza.
 */
function CronometroDelPaso({ segundos, cuenta, onEmpezar, onQuitar }) {
  if (!cuenta) {
    return (
      <button
        type="button" onClick={onEmpezar} className="kp-press"
        style={{
          width: '100%', minHeight: 50, borderRadius: 16, border: `1.5px solid ${LT.borderHi}`, background: LT.surface, color: LT.text, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: FONT, fontSize: 15.5, fontWeight: 800, touchAction: 'manipulation',
        }}
      >
        <Timer size={19} /> Empezar cronómetro · {relojDe(segundos)}
      </button>
    );
  }
  return (
    <div style={{ background: LT.surface, border: `1px solid ${LT.border}`, borderRadius: 18, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: cuenta.vencido ? LT.mint : LT.text2 }}>{cuenta.vencido ? 'Tiempo cumplido' : 'Cronómetro'}</div>
        <div role="timer" style={{ fontSize: 46, fontWeight: 800, lineHeight: 1.05, letterSpacing: -1, color: cuenta.vencido ? LT.mint : LT.text, ...NUM_STYLE }}>
          {cuenta.vencido ? `+${relojDe(cuenta.pasado)}` : relojDe(cuenta.restan)}
        </div>
      </div>
      <BotonDeTexto onClick={onQuitar}>Detener</BotonDeTexto>
    </div>
  );
}

/**
 * La pantalla de un ejercicio: nombre (con las vueltas en puntos si el Set se repite), video (si el coach lo tiene), las cifras, la nota en
 * texto grande y «Listo». En una bi-serie, arriba, el tipo y el par A/B. Si no trae nada más que el nombre, el nombre se queda solo en el
 * centro con «Sigue: …» (el hueco de un video o de unas cifras vacías se lee como un fallo de la app).
 */
export function PantallaDePaso({
  paso, video, cifras, anotado, sigue, serie, serieSimple = false, puntos, cronometro, etiquetaDeCambiar, puedeAnterior, tecnica,
  onListo, onCambiar, onSaltar, onAnterior,
}) {
  const nota = [paso.nota, paso.cue].filter(Boolean);
  const hayCronometro = paso.tipo === 'ejercicio' && paso.termina?.por === 'tiempo' && cronometro;
  const conVueltas = puntos.length > 1;
  const solo = !video && !cifras.length && !nota.length && !hayCronometro && !anotado && !serie && !conVueltas && !paso.opcional;
  return (
    <>
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        <div style={{ ...COLUMNA, padding: '0 18px 18px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: solo ? 'center' : 'flex-start' }}>
          {paso.encabezado && (
            <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', color: LT.text3, marginTop: 14, textAlign: solo ? 'center' : 'left' }}>
              {paso.encabezado}
            </div>
          )}
          {serie && <SerieALaVista serie={serie} simple={serieSimple} />}
          {paso.opcional && <div style={{ marginTop: 8 }}><Etiqueta suave>Opcional</Etiqueta></div>}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, margin: solo ? '0 0 10px' : '10px 0 14px' }}>
            <h1 style={{
              margin: 0, flex: 1, minWidth: 0, fontSize: solo ? 38 : 30, fontWeight: 800, letterSpacing: -0.7, lineHeight: 1.1, color: LT.text,
              textAlign: solo ? 'center' : 'left', overflowWrap: 'anywhere', textWrap: 'balance',
            }}>
              {paso.nombre}
            </h1>
            {conVueltas && <span style={{ marginTop: 6, flexShrink: 0 }}><SerieDelSet puntos={puntos} /></span>}
          </div>
          {solo && sigue && (
            <div style={{ textAlign: 'center', fontSize: 15, fontWeight: 700, color: LT.text3 }}>
              Sigue: <b style={{ color: LT.text2 }}>{sigue}</b>
            </div>
          )}
          {video && <div style={{ marginBottom: 14 }}>{video}</div>}
          {cifras.length > 0 && (
            <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
              {cifras.map((c, i) => <Cifra key={i} {...c} />)}
            </div>
          )}
          {hayCronometro && <div style={{ marginBottom: 14 }}>{cronometro}</div>}
          {anotado && (
            <div style={{ marginBottom: 14 }}>
              <Pastilla fuerte><Check size={14} strokeWidth={3} /> Hoy: {anotado}</Pastilla>
            </div>
          )}
          {nota.map((t, i) => (
            <p key={i} style={{ margin: '0 0 12px', fontSize: 18, lineHeight: 1.5, fontWeight: 500, color: LT.text }}>{t}</p>
          ))}
        </div>
      </div>
      <div style={{ flexShrink: 0, padding: '10px 0 calc(10px + env(safe-area-inset-bottom))' }}>
        <div style={{ ...COLUMNA, padding: '0 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <BotonGrande onClick={onListo}><Check size={22} strokeWidth={3} /> Listo</BotonGrande>
          {/* «Cambiar» a secas no decía QUÉ: ahora dice qué se puede cambiar («Cambiar reps o kilos»). */}
          {etiquetaDeCambiar && <BotonSecundario ancho onClick={onCambiar}><Pencil size={17} /> {etiquetaDeCambiar}</BotonSecundario>}
          <div style={{ display: 'flex', gap: 10 }}>
            <BotonSecundario onClick={onAnterior} disabled={!puedeAnterior}><ChevronLeft size={18} /> Anterior</BotonSecundario>
            <BotonSecundario onClick={onSaltar}>Saltar <ChevronRight size={18} /></BotonSecundario>
            {tecnica && paso.tipo === 'ejercicio' && <BotonDeTecnica {...tecnica} />}
          </div>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Un Set con reloj                                                    */
/* ------------------------------------------------------------------ */

/**
 * Un Set con reloj (un formato como AMRAP, EMOM o Tabata, o varios lapsos seguidos) es UN paso: lo corre el reloj de siempre
 * (`RelojDelBloque`), que es la pantalla protagonista mientras dura. Aquí solo se dice qué es, con qué ejercicios (y, en lapsos, qué lapsos),
 * y se abre el reloj o se anota el resultado a mano.
 */
export function PantallaDeReloj({ paso, detalle, resultado, puedeAnterior, tecnica, onIniciar, onAnotar, onListo, onSaltar, onAnterior }) {
  const conLapsos = !!paso.deLapsos;
  return (
    <>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ ...COLUMNA, padding: '0 18px 18px' }}>
          {paso.encabezado && (
            <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', color: LT.text3, marginTop: 14 }}>{paso.encabezado}</div>
          )}
          <div style={{ marginTop: 12 }}><Etiqueta>Con reloj</Etiqueta></div>
          <h1 style={{ margin: '12px 0 8px', fontSize: 30, fontWeight: 800, letterSpacing: -0.7, lineHeight: 1.1, color: LT.text, overflowWrap: 'anywhere' }}>{paso.resumen}</h1>
          {detalle && <p style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 500, color: LT.text2, lineHeight: 1.45 }}>{detalle}</p>}
          <div style={{ background: LT.surface, border: `1px solid ${LT.border}`, borderRadius: 18, padding: '4px 16px', marginTop: detalle ? 0 : 12 }}>
            {paso.miembros.map((m, i) => (
              <div key={m.idx} style={{ padding: '13px 0', borderTop: i > 0 ? `1px solid ${LT.border}` : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
                  <span style={{ fontSize: 16.5, fontWeight: 800, color: LT.text, overflowWrap: 'anywhere' }}>{m.nombre}</span>
                  {!m.lapsos && (
                    <span style={{ fontSize: 14, fontWeight: 700, color: LT.text2, flexShrink: 0, textAlign: 'right', ...NUM_STYLE }}>
                      {[m.texto, m.carga].filter(Boolean).join(' · ')}
                    </span>
                  )}
                </div>
                {m.lapsos && (
                  <div style={{ marginTop: 5 }}>
                    {m.lapsos.map((l, j) => (
                      <div key={j} style={{ display: 'flex', alignItems: 'baseline', gap: 9, padding: '3px 0', fontSize: 14, fontWeight: 600, color: LT.text2, lineHeight: 1.35, ...NUM_STYLE }}>
                        <span style={{ width: 12, flexShrink: 0, textAlign: 'center', fontSize: 12, fontWeight: 800, color: LT.text3 }}>{j + 1}</span>
                        <span>{[l.texto, l.carga, l.descanso ? `descanso ${l.descanso}` : null].filter(Boolean).join(' · ') || '—'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          {resultado && (
            <div style={{ marginTop: 14 }}><Pastilla fuerte><Check size={14} strokeWidth={3} /> Resultado: {textoDeResultado(resultado, conLapsos ? 'lapso' : undefined)}</Pastilla></div>
          )}
          {paso.nota && <p style={{ margin: '14px 0 0', fontSize: 18, lineHeight: 1.5, fontWeight: 500, color: LT.text }}>{paso.nota}</p>}
        </div>
      </div>
      <div style={{ flexShrink: 0, padding: '10px 0 calc(10px + env(safe-area-inset-bottom))' }}>
        <div style={{ ...COLUMNA, padding: '0 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* «Iniciar entreno» → «Iniciar reloj» → «Iniciar»: tres «iniciar» seguidos (Andrés: «qué raro, redundante»). Aquí el botón dice lo que
              hace, «Empezar», y el reloj arranca ya, sin otro «Iniciar» adentro. */}
          {resultado ? (
            <>
              <BotonGrande onClick={onListo}><Check size={22} strokeWidth={3} /> Listo</BotonGrande>
              <BotonSecundario ancho onClick={onAnotar}><Pencil size={17} /> Cambiar el resultado</BotonSecundario>
            </>
          ) : (
            <>
              <BotonGrande onClick={onIniciar}><Play size={20} fill="#fff" /> Empezar</BotonGrande>
              <BotonSecundario ancho onClick={onAnotar}><Pencil size={17} /> Anotar sin reloj</BotonSecundario>
            </>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <BotonSecundario onClick={onAnterior} disabled={!puedeAnterior}><ChevronLeft size={18} /> Anterior</BotonSecundario>
            <BotonSecundario onClick={onSaltar}>Saltar <ChevronRight size={18} /></BotonSecundario>
            {tecnica && <BotonDeTecnica {...tecnica} />}
          </div>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* El descanso                                                         */
/* ------------------------------------------------------------------ */

/**
 * El descanso: solo existe porque el coach lo escribió. Cuenta hacia abajo, avisa al llegar a cero y SIGUE contando hacia arriba, sin
 * reproche: nunca avanza solo. Un descanso escrito con palabras («Recuperación total») no tiene cuenta: se lee tal cual y espera «Seguir».
 * `siguiente` es lo que viene (para ir acomodándose): su nombre, lo planeado, sus vueltas en puntos y su miniatura si tiene foto o video.
 * Sin frases que expliquen el botón: el botón ya dice «Seguir».
 */
export function PantallaDeDescanso({ descanso, siguiente, miniatura, sonido, puedeAnterior, onSeguir, onMas, onAnterior, onSonido }) {
  const { paso } = descanso;
  const conCuenta = descanso.restan !== null;
  const grande = !conCuenta ? '' : (descanso.vencido ? `+${relojDe(descanso.pasado)}` : relojDe(descanso.restan));
  const avance = !conCuenta || descanso.seg <= 0 ? 0 : Math.min(1, Math.max(0, (descanso.seg - descanso.restan) / descanso.seg));
  return (
    <>
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        <div style={{ ...COLUMNA, padding: '0 18px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: -0.2, color: LT.text }}>Descanso</div>
          {conCuenta ? (
            <>
              <div role="timer" style={{ fontSize: grande.length > 5 ? 76 : 108, fontWeight: 800, lineHeight: 1.05, letterSpacing: -3, color: descanso.vencido ? LT.text2 : LT.text, margin: '8px 0 14px', ...NUM_STYLE }}>
                {grande}
              </div>
              <div style={{ height: 6, borderRadius: 3, background: 'rgba(17,19,24,0.12)', margin: '0 28px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.round((descanso.vencido ? 1 : avance) * 100)}%`, background: LT.blue, borderRadius: 3, transition: 'width 0.25s linear' }} />
              </div>
              {paso.segMax && <div style={{ marginTop: 14, fontSize: 13.5, fontWeight: 700, color: LT.text3, ...NUM_STYLE }}>Puedes llegar hasta {relojDe(paso.segMax + descanso.extra)}</div>}
            </>
          ) : (
            <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: -0.6, lineHeight: 1.15, color: LT.text, margin: '14px 0 0', overflowWrap: 'anywhere' }}>{paso.texto}</div>
          )}
        </div>
      </div>
      <div style={{ flexShrink: 0, padding: '10px 0 calc(10px + env(safe-area-inset-bottom))' }}>
        <div style={{ ...COLUMNA, padding: '0 18px' }}>
          {siguiente && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12, background: LT.surface, border: `1.5px solid ${LT.border}`, borderRadius: 18, padding: '12px 14px', marginBottom: 12,
            }}>
              {miniatura}
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase', color: LT.text3 }}>Sigue</div>
                <div style={{ fontSize: 17, fontWeight: 800, color: LT.text, overflowWrap: 'anywhere', lineHeight: 1.2, marginTop: 2 }}>{siguiente.nombre}</div>
                {siguiente.detalle && <div style={{ fontSize: 13, fontWeight: 600, color: LT.text2, marginTop: 3, ...NUM_STYLE }}>{siguiente.detalle}</div>}
              </div>
              <SerieDelSet puntos={siguiente.puntos} />
            </div>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}><BotonGrande onClick={onSeguir}>Seguir</BotonGrande></div>
            {conCuenta && (
              <button
                type="button" onClick={onMas} className="kp-press"
                style={{
                  minWidth: 84, borderRadius: 18, border: `1.5px solid ${LT.borderHi}`, background: LT.surface, color: LT.text, cursor: 'pointer',
                  fontFamily: FONT, fontSize: 16, fontWeight: 800, touchAction: 'manipulation',
                }}
              >
                +30 s
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
            <BotonSecundario onClick={onAnterior} disabled={!puedeAnterior}><ChevronLeft size={18} /> Anterior</BotonSecundario>
            {conCuenta && (
              <BotonSecundario onClick={onSonido}>
                {sonido ? <Bell size={17} /> : <BellOff size={17} />} {sonido ? 'Con aviso' : 'Sin aviso'}
              </BotonSecundario>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* El final                                                            */
/* ------------------------------------------------------------------ */

/** «Entrenamiento terminado»: lo que se hizo, una nota para el coach y «Terminar sesión». El avance ya estaba guardado. */
export function PantallaDeFin({ resumen, notas, palabras, onNotas, onTerminar, onVolver, yaTerminada }) {
  return (
    <>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ ...COLUMNA, padding: '36px 18px 18px', textAlign: 'center' }}>
          <div style={{ width: 84, height: 84, borderRadius: '50%', background: LT.mint, color: '#fff', display: 'grid', placeItems: 'center', margin: '0 auto 16px' }}>
            <Check size={44} strokeWidth={3.2} />
          </div>
          <h1 style={{ margin: '0 0 20px', fontSize: 30, fontWeight: 800, letterSpacing: -0.7, color: LT.text }}>{palabras.finTitulo}</h1>
          <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
            {resumen.map((c) => <Cifra key={c.etiqueta} {...c} />)}
          </div>
          <label htmlFor="entreno-notas" style={{ display: 'block', textAlign: 'left', fontSize: 15, fontWeight: 800, color: LT.text, margin: '0 2px 8px' }}>
            {palabras.finNotas}
          </label>
          <textarea
            id="entreno-notas" value={notas} onChange={(e) => onNotas(e.target.value)} rows={4}
            style={{
              width: '100%', boxSizing: 'border-box', border: `1.5px solid ${LT.border}`, borderRadius: 16, background: LT.surface, padding: '14px 16px',
              fontFamily: FONT, fontSize: 16, color: LT.text, resize: 'none', outline: 'none', textAlign: 'left',
            }}
          />
        </div>
      </div>
      <div style={{ flexShrink: 0, padding: '10px 0 calc(10px + env(safe-area-inset-bottom))' }}>
        <div style={{ ...COLUMNA, padding: '0 18px', textAlign: 'center' }}>
          <BotonGrande variante="verde" onClick={onTerminar}><Check size={21} strokeWidth={3} /> {yaTerminada ? 'Listo' : 'Terminar sesión'}</BotonGrande>
          <div style={{ marginTop: 10 }}><BotonSecundario ancho onClick={onVolver}><ChevronLeft size={18} /> {palabras.finVolver}</BotonSecundario></div>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Las hojas                                                           */
/* ------------------------------------------------------------------ */

// La hoja que sube desde abajo, como la de «Tu resultado» del reloj.
function Hoja({ etiqueta, titulo, subtitulo, icono, conCierre = false, onCerrar, children }) {
  return (
    <div
      onMouseDown={onCerrar}
      style={{ position: 'fixed', inset: 0, zIndex: 3100, background: 'rgba(17,19,24,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-label={etiqueta} className="animate-sheet"
        style={{
          width: '100%', maxWidth: 520, background: LT.bg, borderRadius: '22px 22px 0 0', fontFamily: FONT, boxSizing: 'border-box',
          padding: '10px 18px calc(16px + env(safe-area-inset-bottom))', maxHeight: '92svh', overflowY: 'auto',
        }}
      >
        <div aria-hidden="true" style={{ width: 38, height: 4, borderRadius: 2, background: LT.borderHi, margin: '0 auto 14px' }} />
        {icono && (
          <div aria-hidden="true" style={{ width: 52, height: 52, borderRadius: 16, background: LT.blueSoft, color: LT.blue, display: 'grid', placeItems: 'center', marginBottom: 12 }}>
            {icono}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: LT.text, letterSpacing: -0.4 }}>{titulo}</div>
          {conCierre && <button type="button" onClick={onCerrar} aria-label="Cerrar" style={redondo}><X size={19} /></button>}
        </div>
        {subtitulo && <div style={{ fontSize: 14.5, fontWeight: 500, color: LT.text2, margin: '5px 0 0', lineHeight: 1.45 }}>{subtitulo}</div>}
        <div style={{ marginTop: 16 }}>{children}</div>
      </div>
    </div>
  );
}

const circulo = (relleno) => ({
  width: 46, height: 46, borderRadius: '50%', flexShrink: 0, cursor: 'pointer', display: 'grid', placeItems: 'center', fontFamily: FONT,
  touchAction: 'manipulation', border: relleno ? 'none' : `1.5px solid ${LT.borderHi}`, background: relleno ? LT.blue : 'transparent',
  color: relleno ? '#fff' : LT.text2,
});

// Una pastillita de las filas de «Ver todo» («5 reps», «≈105 kg»): gris, o azul si es el peso.
function Pastillita({ children, fuerte = false }) {
  return (
    <span style={{
      fontSize: 11.5, fontWeight: 700, padding: '3px 8px', borderRadius: 7, whiteSpace: 'nowrap', background: fuerte ? LT.blueSoft : LT.surface2,
      color: fuerte ? LT.blue : LT.text2, ...NUM_STYLE,
    }}>
      {children}
    </span>
  );
}

// Un ejercicio en «Ver todo»: su foto (o su número, o la palomita si ya se hizo), su nombre y lo planeado. El que toca va en azul suave.
function FilaDeLaLista({ fila, n, miniatura, conLinea, onElegir }) {
  const hecho = fila.estado === 'hecho';
  const toca = fila.estado === 'actual';
  return (
    <button
      type="button" disabled={hecho} onClick={() => onElegir(fila.clave)} aria-current={toca ? 'step' : undefined}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 11, padding: '9px 12px', border: 'none', borderTop: conLinea ? `1px solid ${LT.border}` : 'none',
        background: toca ? LT.blueSoft : 'transparent', textAlign: 'left', fontFamily: FONT, cursor: hecho ? 'default' : 'pointer', touchAction: 'manipulation',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: 'relative', width: 44, height: 44, borderRadius: 11, flexShrink: 0, overflow: 'hidden', display: 'grid', placeItems: 'center',
          fontSize: 14, fontWeight: 800, color: hecho ? '#fff' : LT.text3, background: hecho ? LT.mint : (miniatura ? '#0E1015' : LT.blueSoft),
        }}
      >
        {hecho && <Check size={18} strokeWidth={3} />}
        {!hecho && miniatura && (
          <>
            {miniatura.nodo}
            {miniatura.conVideo && (
              <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'rgba(0,0,0,0.25)', color: '#fff' }}>
                <Play size={15} fill="#fff" />
              </span>
            )}
          </>
        )}
        {!hecho && !miniatura && n}
      </span>
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700, color: toca ? LT.blue : LT.text, lineHeight: 1.25, overflowWrap: 'anywhere' }}>{fila.nombre}</span>
        {(fila.pastillas.length > 0 || fila.estado === 'saltado') && (
          <span style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 5 }}>
            {fila.pastillas.map((x, i) => <Pastillita key={i} fuerte={x.fuerte}>{x.texto}</Pastillita>)}
            {fila.estado === 'saltado' && <Pastillita>Saltado</Pastillita>}
          </span>
        )}
      </span>
      {!hecho && <ChevronRight size={18} color={LT.text3} style={{ flexShrink: 0 }} />}
    </button>
  );
}

/**
 * «Ver todo»: el entreno como lo escribió el coach, UNA TARJETA POR SET. La del Set que toca lleva borde azul; el ejercicio que toca, azul suave.
 * Las vueltas de un Set van como «Serie 2 de 5» en su encabezado (no una fila por vuelta). Tocar un ejercicio que falta lleva a él (lo saltado sigue ahí);
 * lo hecho no se toca. «Seguir» cierra la hoja y el atleta sigue donde iba; «Terminar entreno» da por cerrado lo que falte.
 *
 * `tarjetas` viene de `tarjetasDeLaLista`; `miniaturaDe(fila)` dice la foto o el video de ese ejercicio (`{ nodo, conVideo }`) o `null`.
 */
export function HojaDeLista({ tarjetas, miniaturaDe, palabras, onElegir, onTerminar, onCerrar }) {
  return (
    <Hoja etiqueta={palabras.listaTitulo} titulo={palabras.listaTitulo} conCierre onCerrar={onCerrar}>
      {tarjetas.map((t, ti) => {
        const hechoElReloj = t.reloj && t.filas[0]?.estado === 'hecho';
        const derecha = t.reloj
          ? (t.resultado || hechoElReloj
            ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 700, padding: '3px 8px', borderRadius: 7, background: KP.mintSoft, color: LT.mint, ...NUM_STYLE }}>
                <Check size={11} strokeWidth={3.5} /> {t.resultado || 'Hecho'}
              </span>
            ) : null)
          : (t.puntos.length > 1 ? <SerieDelSet puntos={t.puntos} /> : null);
        const conEncabezado = !!(t.titulo || t.etiqueta || derecha);
        return (
          <section
            key={ti}
            style={{
              border: `1.5px solid ${t.esActual ? LT.blue : LT.border}`, borderRadius: 18, background: LT.surface, marginBottom: 10, overflow: 'hidden',
              boxShadow: t.esActual ? '0 0 0 3px rgba(30,64,224,0.12)' : 'none',
            }}
          >
            {conEncabezado && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '11px 13px 9px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  {t.titulo && <b style={{ fontSize: 15, fontWeight: 800, color: LT.text, whiteSpace: 'nowrap' }}>{t.titulo}</b>}
                  {t.etiqueta && <Pastillita fuerte>{t.etiqueta}</Pastillita>}
                </span>
                {derecha}
              </div>
            )}
            {t.filas.map((f, fi) => (
              <FilaDeLaLista key={`${f.idx}.${fi}`} fila={f} n={fi + 1} miniatura={miniaturaDe(f)} conLinea={conEncabezado || fi > 0} onElegir={onElegir} />
            ))}
          </section>
        );
      })}
      <div style={{ marginTop: 14 }}><BotonGrande onClick={onCerrar}>Seguir</BotonGrande></div>
      <div style={{ textAlign: 'center', marginTop: 2 }}><BotonDeTexto onClick={onTerminar}>{palabras.listaTerminar}</BotonDeTexto></div>
    </Hoja>
  );
}

// Un campo de «Cambiar»: el número con su − y su +, igual que los de la ficha del ejercicio.
function CampoDeCambiar({ rotulo, planeado, valor, paso, decimal, onCambio }) {
  const mueve = (d) => {
    const base = parseFloat(String(valor).replace(',', '.'));
    // Bajar desde vacío (o desde cero) no anota nada: el mismo gesto que lo creó lo deshace (ver la ficha del ejercicio).
    if (d < 0 && (!Number.isFinite(base) || base <= 0)) { onCambio(''); return; }
    const sigue = Number.isFinite(base) ? base : (parseFloat(String(planeado).replace(',', '.')) || 0);
    onCambio(String(Math.max(0, Math.round((sigue + d * paso) * 100) / 100)));
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px 12px', background: LT.surface, border: `1.5px solid ${LT.border}`, borderRadius: 18, padding: '12px 14px' }}>
      <div style={{ minWidth: 0, flex: '1 1 110px' }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: LT.text }}>{rotulo}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginLeft: 'auto' }}>
        <button type="button" onClick={() => mueve(-1)} aria-label={`Bajar ${rotulo}`} style={circulo(false)}><Minus size={20} strokeWidth={3} /></button>
        <input
          type="number" inputMode={decimal ? 'decimal' : 'numeric'} value={valor} placeholder="—" aria-label={rotulo} className="sin-flechas"
          onChange={(e) => onCambio(e.target.value)}
          style={{
            width: 70, border: 'none', background: 'transparent', textAlign: 'center', fontSize: 27, fontWeight: 800, outline: 'none', fontFamily: FONT, padding: 0,
            color: valor === '' ? LT.text3 : LT.text, ...NUM_STYLE,
          }}
        />
        <button type="button" onClick={() => mueve(1)} aria-label={`Subir ${rotulo}`} style={circulo(true)}><Plus size={20} strokeWidth={3} /></button>
      </div>
    </div>
  );
}

/**
 * «Lo que hiciste»: solo lo que salió distinto de lo planeado. Los campos arrancan en lo planeado; al guardar viaja SOLO lo que se
 * tocó (si no se cambió nada, es lo mismo que «Listo»). `campos`: de `camposDeCambiar`; `planeadoDe[clave]` y `inicialDe[clave]`
 * dicen de dónde arranca cada uno (reps: la cantidad; kg: los kilos del plan, en su unidad); `unidadDePeso` rotula los kilos.
 */
export function HojaDeCambiar({ campos, planeado, inicial, unidadDePeso, resumen, onGuardar, onCerrar }) {
  const [valores, setValores] = useState(() => Object.fromEntries(campos.map((c) => [c.clave, String(inicial[c.clave] ?? planeado[c.clave] ?? '')])));
  const cambio = (clave, v) => setValores((x) => ({ ...x, [clave]: v }));
  const tocados = campos.filter((c) => valores[c.clave] !== String(inicial[c.clave] ?? planeado[c.clave] ?? ''));
  const guarda = () => onGuardar(Object.fromEntries(tocados.map((c) => [c.clave, valores[c.clave]])));
  return (
    <Hoja
      etiqueta="Lo que hiciste" titulo="Lo que hiciste" onCerrar={onCerrar}
      subtitulo={resumen ? `Planeado: ${resumen}` : undefined}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {campos.map((c) => (
          <CampoDeCambiar
            key={c.clave}
            rotulo={c.clave === 'kg' ? `Peso (${unidadDePeso})` : c.rotulo}
            planeado={planeado[c.clave] ? `${planeado[c.clave]}${c.clave === 'kg' ? ` ${unidadDePeso}` : ''}` : ''}
            valor={valores[c.clave]} paso={c.clave === 'kg' ? (unidadDePeso === 'lb' ? 5 : 2.5) : c.paso} decimal={c.clave === 'kg' || c.paso < 1}
            onCambio={(v) => cambio(c.clave, v)}
          />
        ))}
      </div>
      <div style={{ marginTop: 18 }}><BotonGrande onClick={guarda}>Guardar y seguir</BotonGrande></div>
      <div style={{ textAlign: 'center', marginTop: 2 }}><BotonDeTexto onClick={onCerrar}>Cancelar</BotonDeTexto></div>
    </Hoja>
  );
}

/** «Grabar técnica para tu coach»: mientras no se prenda (`lib/funciones.js`), dice que viene y por dónde llegará. */
export function HojaDeTecnica({ palabras, onCerrar }) {
  return (
    <Hoja etiqueta={palabras.tecnicaTitulo} titulo={palabras.tecnicaTitulo} subtitulo={palabras.tecnicaTexto} icono={<Video size={25} />} onCerrar={onCerrar}>
      <BotonGrande onClick={onCerrar}>Entendido</BotonGrande>
    </Hoja>
  );
}

export { CronometroDelPaso };
