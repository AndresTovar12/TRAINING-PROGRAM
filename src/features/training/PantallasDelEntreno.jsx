import { useState } from 'react';
import { Bell, BellOff, Check, ChevronLeft, List, Minus, Play, Plus, Timer, X } from 'lucide-react';
import { LT, KP, FONT, NUM_STYLE } from '@/lib/theme';
import { textoDeResultado } from '@/lib/formatos';
import { gruposDeLaLista, relojDe, subtituloDeLaLista } from '@/lib/entrenoDatos';

/**
 * Las pantallas del modo entreno: lo que se DIBUJA. Qué paso toca, cuándo avisar y qué se guarda lo decide `EntrenoDelDia`; aquí no
 * hay lógica del entreno, solo piezas que reciben lo que van a decir.
 *
 * Todo sigue la maqueta «Modo entreno» que Andrés aprobó (9 oct 2026), y el estilo de las otras pantallas completas (la ficha del
 * ejercicio, el reloj del bloque): una columna de 520 px que se desplaza, el botón principal fijo abajo y números enormes.
 *
 * LA REGLA DE ORO: se dibuja SOLO lo que el coach escribió. Sin video no hay hueco de video; sin cifras no hay tarjetas; sin
 * notas no hay párrafo. Una pantalla de un ejercicio que solo trae su nombre es el nombre, «Sigue: …» y un botón.
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

// Un botón de texto, de los de la fila de abajo («Anterior», «Cambiar», «Saltar»).
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

/* ------------------------------------------------------------------ */
/* La barra de arriba                                                  */
/* ------------------------------------------------------------------ */

/**
 * Cerrar, el avance por Sets, la lista de pasos, dónde va y el tiempo total. El tiempo va chico y gris a propósito: «el reloj sirve y
 * nunca manda» (Andrés), así que no compite con lo que hay que hacer.
 */
export function BarraDelEntreno({ segmentos, linea, tiempo, fondo, palabras, onCerrar, onLista }) {
  return (
    <div style={{ position: 'sticky', top: 0, zIndex: 5, background: fondo, padding: 'calc(10px + env(safe-area-inset-top)) 0 6px' }}>
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
          <button type="button" onClick={onLista} aria-label="Ver todos los pasos" style={redondo}><List size={19} /></button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 9, fontSize: 12.5, fontWeight: 700, color: LT.text2, ...NUM_STYLE }}>
          <span>{linea}</span>
          <span style={{ color: LT.text3 }}>{tiempo}</span>
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
 * La pantalla de un ejercicio: nombre, video (si el coach lo tiene), las cifras, la nota en texto grande y «Listo». Si no trae nada
 * más que el nombre, el nombre se queda solo en el centro con «Sigue: …» (el hueco de un video o de unas cifras vacías se lee como un
 * fallo de la app).
 */
export function PantallaDePaso({
  paso, video, cifras, anotado, sigue, cronometro, etiquetaDeCambiar, puedeAnterior,
  onListo, onCambiar, onSaltar, onAnterior,
}) {
  const nota = [paso.nota, paso.cue].filter(Boolean);
  const hayCronometro = paso.tipo === 'ejercicio' && paso.termina?.por === 'tiempo' && cronometro;
  const solo = !video && !cifras.length && !nota.length && !hayCronometro && !anotado;
  return (
    <>
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        <div style={{ ...COLUMNA, padding: '0 18px 18px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: solo ? 'center' : 'flex-start' }}>
          {paso.encabezado && (
            <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', color: LT.text3, marginTop: 14, textAlign: solo ? 'center' : 'left' }}>
              {paso.encabezado}
            </div>
          )}
          <h1 style={{
            margin: solo ? '0 0 10px' : '10px 0 12px', fontSize: solo ? 38 : 30, fontWeight: 800, letterSpacing: -0.7, lineHeight: 1.1, color: LT.text,
            textAlign: solo ? 'center' : 'left', overflowWrap: 'anywhere', textWrap: 'balance',
          }}>
            {paso.nombre}
          </h1>
          {solo && sigue && (
            <div style={{ textAlign: 'center', fontSize: 15, fontWeight: 700, color: LT.text3 }}>
              Sigue: <b style={{ color: LT.text2 }}>{sigue}</b>
            </div>
          )}
          {!solo && (paso.opcional || (paso.serieTag && paso.ejerciciosEnSerie > 1)) && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
              {paso.serieTag && paso.ejerciciosEnSerie > 1 && <Pastilla fuerte>{paso.serieTag} · {paso.ejercicioEnSerie} de {paso.ejerciciosEnSerie}</Pastilla>}
              {paso.opcional && <Pastilla>Opcional</Pastilla>}
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
        <div style={{ ...COLUMNA, padding: '0 18px' }}>
          <BotonGrande onClick={onListo}><Check size={22} strokeWidth={3} /> Listo</BotonGrande>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
            <BotonDeTexto onClick={onAnterior} disabled={!puedeAnterior}><ChevronLeft size={17} /> Anterior</BotonDeTexto>
            {etiquetaDeCambiar && <BotonDeTexto onClick={onCambiar} color={LT.text}>{etiquetaDeCambiar}</BotonDeTexto>}
            <BotonDeTexto onClick={onSaltar} color={LT.text}>Saltar</BotonDeTexto>
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
 * Un Set con formato (AMRAP, EMOM, Tabata…) es UN paso: lo corre el reloj de siempre (`RelojDelBloque`), que es la pantalla
 * protagonista mientras dura. Aquí solo se dice qué es, con qué ejercicios, y se abre el reloj o se anota el resultado a mano.
 */
export function PantallaDeReloj({ paso, detalle, resultado, puedeAnterior, onIniciar, onAnotar, onListo, onSaltar, onAnterior }) {
  return (
    <>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ ...COLUMNA, padding: '0 18px 18px' }}>
          {paso.encabezado && (
            <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', color: LT.text3, marginTop: 14 }}>{paso.encabezado}</div>
          )}
          <div style={{ marginTop: 12 }}><Pastilla fuerte>CON RELOJ</Pastilla></div>
          <h1 style={{ margin: '12px 0 8px', fontSize: 30, fontWeight: 800, letterSpacing: -0.7, lineHeight: 1.1, color: LT.text, overflowWrap: 'anywhere' }}>{paso.resumen}</h1>
          {detalle && <p style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 500, color: LT.text2, lineHeight: 1.45 }}>{detalle}</p>}
          <div style={{ background: LT.surface, border: `1px solid ${LT.border}`, borderRadius: 18, padding: '4px 16px' }}>
            {paso.miembros.map((m, i) => (
              <div
                key={m.idx}
                style={{
                  display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, padding: '13px 0',
                  borderTop: i > 0 ? `1px solid ${LT.border}` : 'none',
                }}
              >
                <span style={{ fontSize: 16.5, fontWeight: 800, color: LT.text, overflowWrap: 'anywhere' }}>{m.nombre}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: LT.text2, flexShrink: 0, textAlign: 'right', ...NUM_STYLE }}>
                  {[m.texto, m.carga].filter(Boolean).join(' · ')}
                </span>
              </div>
            ))}
          </div>
          {resultado && (
            <div style={{ marginTop: 14 }}><Pastilla fuerte><Check size={14} strokeWidth={3} /> Resultado: {textoDeResultado(resultado)}</Pastilla></div>
          )}
          {paso.nota && <p style={{ margin: '14px 0 0', fontSize: 18, lineHeight: 1.5, fontWeight: 500, color: LT.text }}>{paso.nota}</p>}
        </div>
      </div>
      <div style={{ flexShrink: 0, padding: '10px 0 calc(10px + env(safe-area-inset-bottom))' }}>
        <div style={{ ...COLUMNA, padding: '0 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {resultado ? (
            <BotonGrande onClick={onListo}><Check size={22} strokeWidth={3} /> Listo</BotonGrande>
          ) : (
            <>
              <BotonGrande onClick={onIniciar}><Play size={20} fill="#fff" /> Iniciar reloj</BotonGrande>
              <BotonGrande variante="borde" onClick={onAnotar}>Anotar resultado sin reloj</BotonGrande>
            </>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <BotonDeTexto onClick={onAnterior} disabled={!puedeAnterior}><ChevronLeft size={17} /> Anterior</BotonDeTexto>
            {resultado && <BotonDeTexto onClick={onAnotar} color={LT.text}>Cambiar resultado</BotonDeTexto>}
            <BotonDeTexto onClick={onSaltar} color={LT.text}>Saltar</BotonDeTexto>
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
 * reproche («Sin prisa»): nunca avanza solo. Un descanso escrito con palabras («Recuperación total») no tiene cuenta: se lee tal cual
 * y espera «Seguir». `siguiente` es lo que viene (para ir acomodándose), con su miniatura si el ejercicio tiene foto o video.
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
          <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: 1.4, color: LT.text2 }}>DESCANSO</div>
          {conCuenta ? (
            <>
              <div role="timer" style={{ fontSize: grande.length > 5 ? 76 : 108, fontWeight: 800, lineHeight: 1.05, letterSpacing: -3, color: descanso.vencido ? LT.text2 : LT.text, margin: '6px 0 12px', ...NUM_STYLE }}>
                {grande}
              </div>
              <div style={{ height: 6, borderRadius: 3, background: 'rgba(17,19,24,0.12)', margin: '0 28px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.round((descanso.vencido ? 1 : avance) * 100)}%`, background: LT.blue, borderRadius: 3, transition: 'width 0.25s linear' }} />
              </div>
              <div style={{ marginTop: 16, fontSize: 15, fontWeight: 600, color: LT.text2 }}>
                {descanso.vencido ? 'Sin prisa. Sigue cuando estés listo.' : 'Toca «Seguir» cuando estés listo.'}
              </div>
              {paso.segMax && <div style={{ marginTop: 6, fontSize: 13.5, fontWeight: 700, color: LT.text3, ...NUM_STYLE }}>Puedes llegar hasta {relojDe(paso.segMax + descanso.extra)}</div>}
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
              display: 'flex', alignItems: 'center', gap: 12, background: LT.surface, borderRadius: 18, padding: 12, marginBottom: 12,
              boxShadow: '0 4px 20px rgba(17,19,24,0.05)',
            }}>
              {miniatura}
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: LT.text3 }}>SIGUE</div>
                <div style={{ fontSize: 17, fontWeight: 800, color: LT.text, overflowWrap: 'anywhere', lineHeight: 1.2 }}>{siguiente.nombre}</div>
                {siguiente.detalle && <div style={{ fontSize: 13, fontWeight: 600, color: LT.text2, marginTop: 2, ...NUM_STYLE }}>{siguiente.detalle}</div>}
              </div>
            </div>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}><BotonGrande onClick={onSeguir}>Seguir</BotonGrande></div>
            {conCuenta && (
              <button
                type="button" onClick={onMas} className="kp-press"
                style={{
                  minWidth: 84, borderRadius: 18, border: `1px solid ${LT.border}`, background: LT.surface, color: LT.text, cursor: 'pointer',
                  fontFamily: FONT, fontSize: 16, fontWeight: 800, touchAction: 'manipulation',
                }}
              >
                +30 s
              </button>
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
            <BotonDeTexto onClick={onAnterior} disabled={!puedeAnterior} color={LT.text}><ChevronLeft size={17} /> Anterior</BotonDeTexto>
            {conCuenta && (
              <BotonDeTexto onClick={onSonido}>
                {sonido ? <Bell size={16} /> : <BellOff size={16} />}
                <span style={{ fontWeight: 700, fontSize: 14 }}>{sonido ? 'Avisa al llegar a 0' : 'Sin aviso'}</span>
              </BotonDeTexto>
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
          <div style={{ width: 84, height: 84, borderRadius: '50%', background: LT.mint, color: '#fff', display: 'grid', placeItems: 'center', margin: '0 auto 18px' }}>
            <Check size={44} strokeWidth={3.2} />
          </div>
          <h1 style={{ margin: '0 0 8px', fontSize: 30, fontWeight: 800, letterSpacing: -0.7, color: LT.text }}>{palabras.finTitulo}</h1>
          <p style={{ margin: '0 auto 22px', maxWidth: 320, fontSize: 15.5, fontWeight: 500, lineHeight: 1.45, color: LT.text2 }}>
            {palabras.finTexto}
          </p>
          <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
            {resumen.map((c) => <Cifra key={c.etiqueta} {...c} />)}
          </div>
          <textarea
            value={notas} onChange={(e) => onNotas(e.target.value)} rows={4} aria-label={palabras.finNotasAria}
            placeholder="Cómo te sentiste, ajustes, observaciones…"
            style={{
              width: '100%', boxSizing: 'border-box', border: `1px solid ${LT.border}`, borderRadius: 16, background: LT.surface, padding: '14px 16px',
              fontFamily: FONT, fontSize: 16, color: LT.text, resize: 'none', outline: 'none', textAlign: 'left',
            }}
          />
        </div>
      </div>
      <div style={{ flexShrink: 0, padding: '10px 0 calc(10px + env(safe-area-inset-bottom))' }}>
        <div style={{ ...COLUMNA, padding: '0 18px', textAlign: 'center' }}>
          <BotonGrande variante="verde" onClick={onTerminar}><Check size={21} strokeWidth={3} /> {yaTerminada ? 'Listo' : 'Terminar sesión'}</BotonGrande>
          <BotonDeTexto onClick={onVolver}>{palabras.finVolver}</BotonDeTexto>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Las hojas                                                           */
/* ------------------------------------------------------------------ */

// La hoja que sube desde abajo, como la de «Tu resultado» del reloj.
function Hoja({ etiqueta, titulo, subtitulo, onCerrar, children }) {
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
        <div style={{ fontSize: 22, fontWeight: 800, color: LT.text, letterSpacing: -0.4 }}>{titulo}</div>
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

/**
 * «Tu entreno»: todos los pasos, por Set. Tocar uno pendiente o saltado va a él (lo que se salta se queda pendiente aquí); lo hecho
 * ya no se toca. `kilosDe(paso)` dice los kilos de ese paso (de su 1RM) o `null`. Abajo, «Terminar entreno» da por cerrado lo que falte.
 */
export function HojaDeLista({ plan, estados, actualClave, kilosDe, palabras, onElegir, onTerminar, onCerrar }) {
  return (
    <Hoja
      etiqueta={palabras.listaTitulo} titulo={palabras.listaTitulo} onCerrar={onCerrar}
      subtitulo="Toca un paso para ir a él. Lo que saltes se queda pendiente aquí."
    >
      {gruposDeLaLista(plan).map((g, gi) => (
        <div key={gi} style={{ marginBottom: 12 }}>
          {g.titulo && <div style={{ fontSize: 13.5, fontWeight: 800, color: LT.text2, margin: '6px 0 2px' }}>{g.titulo}</div>}
          {g.pasos.map(({ paso, i }) => {
            const estado = estados[i];
            const esActual = paso.clave === actualClave;
            const hecho = estado === 'hecho';
            return (
              <button
                key={paso.clave} type="button" disabled={hecho} onClick={() => onElegir(paso.clave)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', border: 'none', borderBottom: `1px solid ${LT.border}`,
                  background: 'transparent', textAlign: 'left', fontFamily: FONT, cursor: hecho ? 'default' : 'pointer', touchAction: 'manipulation',
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 26, height: 26, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center', boxSizing: 'border-box',
                    background: hecho ? LT.mint : 'transparent', color: '#fff',
                    border: hecho ? 'none' : `2px solid ${esActual ? LT.blue : LT.borderHi}`,
                  }}
                >
                  {hecho && <Check size={15} strokeWidth={3.2} />}
                </span>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ display: 'block', fontSize: 16, fontWeight: 800, color: esActual ? LT.blue : LT.text, overflowWrap: 'anywhere' }}>{paso.nombre}</span>
                  <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: LT.text2, marginTop: 1, ...NUM_STYLE }}>
                    {[subtituloDeLaLista(paso, kilosDe(paso)), estado === 'saltado' ? 'Saltado' : null].filter(Boolean).join(' · ')}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      ))}
      <button
        type="button" onClick={onTerminar}
        style={{
          width: '100%', minHeight: 50, borderRadius: 15, border: `1.5px solid ${LT.borderHi}`, background: LT.surface, color: LT.text, cursor: 'pointer',
          fontFamily: FONT, fontSize: 15.5, fontWeight: 800, marginTop: 4, touchAction: 'manipulation',
        }}
      >
        {palabras.listaTerminar}
      </button>
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
        {planeado && <div style={{ fontSize: 12.5, fontWeight: 600, color: LT.text3, marginTop: 2 }}>Planeadas: {planeado}</div>}
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
      subtitulo={resumen ? `Planeado: ${resumen}. Cambia solo lo que salió distinto.` : 'Anota lo que hiciste.'}
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

/** «¿Salir del entreno?»: el avance se guarda solo, así que salir no pierde nada. */
export function HojaDeSalir({ palabras, onSalir, onSeguir }) {
  return (
    <Hoja
      etiqueta={palabras.salirAria} titulo={palabras.salirTitulo} onCerrar={onSeguir}
      subtitulo="Tu avance queda guardado. Puedes continuar cuando quieras, aunque pase un rato o te llamen."
    >
      <BotonGrande onClick={onSalir}>Salir y guardar</BotonGrande>
      <div style={{ textAlign: 'center', marginTop: 2 }}><BotonDeTexto onClick={onSeguir}>Seguir entrenando</BotonDeTexto></div>
    </Hoja>
  );
}

export { CronometroDelPaso };
