import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft, X, Plus, Lock, Check, Loader2, Trash2, SkipForward, Undo2, Repeat, CalendarDays, ChevronRight,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useConfirmacion } from '@/components/Confirmacion';
import { useIsDesktop } from '@/lib/useViewport';
import {
  listExercises, getMasterId, tagRepertoire, listCategories, listExerciseOverrides, aplicarOverrides,
  guardarSesionesPegadas,
} from '@/lib/api';
import { conLasMiasPrimero } from '@/lib/categorias';
import { SessionEditor, Field } from '@/features/admin/PlanBuilder';
import NavegadorDelPlan from '@/components/NavegadorDelPlan';
import { T, FONT, KP } from '@/lib/theme';
import { estructuraDelPlan, isoWeekKey, semanaGlobal, semanasDelPlan, semanasEntre } from '@/lib/training-utils';
import {
  DIAS_SEMANA, esHuerfana, fasesConPegadas, nombreLargoDeDia, nuevaRegla, reglasDe, semanasDelPrograma,
  textoDeCuantoOcupa,
} from '@/lib/pegadas';
import { colorDePrograma, nombreCorto, rolDeProfesion } from '@/lib/programas';

/* AGREGAR SESIONES AL PROGRAMA DEL COACH (la cuenta del fisio).

   Andrés, 1 oct 2026 (el fisio lo probó): «creaste un editor específico bastante feo solo
   para el fisioterapeuta… lo que tenías que poner era el MISMO editor que tienen los
   coaches, el mismo donde aparecen todas las sesiones que ya tiene el coach, y que el
   fisio lo pueda navegar perfectamente de la misma manera que lo hace el coach, pero con
   una diferencia: el fisio o los otros coaches no pueden modificar lo del otro».

   Así que esto ES el editor de los coaches, con las mismas piezas y el mismo molde: la hoja
   del programa a la izquierda (fases, semanas y los siete días, `NavegadorDelPlan` en modo
   editor) y el día a la derecha (`SessionEditor`). Lo del coach se ve y se navega igual,
   pero va en solo lectura (candado). Lo del fisio es editable, sale con su nombre y lleva
   «Repetir»: en qué días de la semana cae y hasta dónde (ver `lib/pegadas.js`: una regla,
   no una fila por día). Se guarda con «Guardar», como el editor de siempre. */

const ABREV = { Lun: 'L', Mar: 'M', 'Mié': 'X', Jue: 'J', Vie: 'V', 'Sáb': 'S', Dom: 'D' };
const NOMBRE_DIA = {
  Lun: 'Lunes', Mar: 'Martes', 'Mié': 'Miércoles', Jue: 'Jueves', Vie: 'Viernes', 'Sáb': 'Sábado', Dom: 'Domingo',
};
const capital = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const normDia = (d) => ({ Mie: 'Mié', Sab: 'Sáb' }[d] ?? d);

// Lo mismo que el constructor: «Semana 3», con su título si lo trae.
const weekSubtitle = (w) => {
  const l = (w?.label || '').trim();
  return !l || l === `Semana ${w?.num}` ? '' : l;
};
const weekName = (w, fallbackNum) => `Semana ${w?.num ?? fallbackNum}${weekSubtitle(w) ? ` · ${weekSubtitle(w)}` : ''}`;

// Qué día enseñar al cambiar de semana: el mismo si ahí también hay algo; si no, el primero que sí.
const diaParaSemana = (wk, actual) => {
  const dias = (wk?.days ?? []).map((d) => normDia(d.day));
  if (dias.includes(actual)) return actual;
  return DIAS_SEMANA.find((k) => dias.includes(k)) ?? actual;
};

const reglaVacia = (r) => !(r.sesion?.exercises ?? []).some((e) => !e.isNote || (e.text || '').trim());

const botonBlanco = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, minHeight: 40, padding: '0 14px',
  borderRadius: 12, cursor: 'pointer', fontFamily: FONT, fontSize: 13.5, fontWeight: 800, touchAction: 'manipulation',
  background: T.bg2, border: `1.5px solid ${T.accent}`, color: T.accent,
};

const chip = (activo) => ({
  padding: '8px 14px', borderRadius: 999, cursor: 'pointer', fontFamily: FONT, fontSize: 13.5, fontWeight: 800,
  border: `1.5px solid ${activo ? T.accent : T.border}`, background: activo ? T.accent : T.bg2,
  color: activo ? '#fff' : T.text, whiteSpace: 'nowrap', touchAction: 'manipulation',
});

/** «Todo el programa», «Solo en Fuerza», «Hasta la semana 12»… */
function textoDeAlcance(regla, fases) {
  const a = regla?.alcance ?? {};
  const nombreDe = (id) => fases.find((f) => f.id === id)?.name ?? '';
  if (a.tipo === 'fases') return `Solo en ${(a.fases ?? []).map(nombreDe).filter(Boolean).join(', ') || 'esas fases'}`;
  if (a.tipo === 'hasta') return `Hasta la semana ${a.hasta?.semana ?? ''}${nombreDe(a.hasta?.faseId) ? ` de ${nombreDe(a.hasta?.faseId)}` : ''}`;
  if (a.tipo === 'dia') return 'Solo una semana';
  return 'Todo el programa, hasta que termine';
}

/* ----------------------------------------------------------------------- */
/* El bloque «Repetir»                                                      */
/* ----------------------------------------------------------------------- */

function BloqueRepetir({
  semanal, fases, dias, onDias, tipo, onTipo, fasesSel, onFasesSel, fecha, onFecha, hastaDeFecha, resumen,
  hastaGuardado, sinFases,
}) {
  const alternaDia = (d) => onDias(dias.includes(d) ? dias.filter((x) => x !== d) : [...dias, d]);
  const alternaFase = (id) => onFasesSel(fasesSel.includes(id) ? fasesSel.filter((x) => x !== id) : [...fasesSel, id]);
  const opcion = (valor, titulo, detalle, extra) => {
    const activa = tipo === valor;
    return (
      <div
        key={valor}
        style={{
          border: `1.5px solid ${activa ? T.accent : T.border}`, background: activa ? T.accentBg : T.bg2,
          borderRadius: 13, overflow: 'hidden',
        }}
      >
        <button
          type="button"
          role="radio"
          aria-checked={activa}
          onClick={() => onTipo(valor)}
          style={{
            width: '100%', display: 'flex', alignItems: 'flex-start', gap: 10, textAlign: 'left', cursor: 'pointer',
            padding: '11px 13px', border: 'none', background: 'transparent', fontFamily: FONT,
          }}
        >
          <span style={{
            width: 18, height: 18, borderRadius: 9, flexShrink: 0, marginTop: 1,
            border: `2px solid ${activa ? T.accent : T.borderHi}`, display: 'grid', placeItems: 'center',
          }}>
            {activa && <span style={{ width: 8, height: 8, borderRadius: 4, background: T.accent }} />}
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 14.5, fontWeight: 800, color: T.text }}>{titulo}</span>
            {detalle && <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: T.text2, marginTop: 2 }}>{detalle}</span>}
          </span>
        </button>
        {activa && extra && <div style={{ padding: '0 13px 13px 41px' }}>{extra}</div>}
      </div>
    );
  };
  return (
    <div style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 18, padding: 16, marginTop: 12, boxShadow: KP.shCard }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 800, color: T.text }}>
        <Repeat size={17} color={T.accent} /> Repetir
      </div>

      <div style={{ fontSize: 12.5, fontWeight: 800, color: T.text2, margin: '14px 0 8px' }}>¿Qué días de la semana?</div>
      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
        {DIAS_SEMANA.map((d) => {
          const activo = dias.includes(d);
          return (
            <button
              key={d}
              type="button"
              aria-pressed={activo}
              aria-label={capital(nombreLargoDeDia(d))}
              onClick={() => alternaDia(d)}
              style={{
                width: 42, height: 42, borderRadius: 12, cursor: 'pointer', fontFamily: FONT, fontSize: 14.5, fontWeight: 800,
                border: `1.5px solid ${activo ? T.accent : T.border}`, background: activo ? T.accent : T.bg2,
                color: activo ? '#fff' : T.text, touchAction: 'manipulation',
              }}
            >
              {ABREV[d]}
            </button>
          );
        })}
      </div>

      {!semanal && (
        <>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: T.text2, margin: '16px 0 8px' }}>¿Hasta cuándo?</div>
          <div role="radiogroup" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {opcion('todo', 'Todo el programa, hasta que termine', 'Si el coach lo alarga, se alarga contigo.')}
            {!sinFases && opcion('fases', 'Solo en estas fases…', null, (
              <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                {fases.map((f) => (
                  <button key={f.id} type="button" aria-pressed={fasesSel.includes(f.id)} onClick={() => alternaFase(f.id)} style={chip(fasesSel.includes(f.id))}>
                    {f.name}
                  </button>
                ))}
              </div>
            ))}
            {opcion('hasta', 'Hasta una fecha…', null, (
              <div>
                <input
                  type="date"
                  value={fecha}
                  onChange={(e) => onFecha(e.target.value)}
                  style={{
                    padding: '9px 11px', borderRadius: 10, border: `1.5px solid ${T.border}`, background: T.bg,
                    fontFamily: FONT, fontSize: 16, color: T.text,
                  }}
                />
                <div style={{ fontSize: 12.5, fontWeight: 600, color: T.text2, marginTop: 7 }}>
                  {hastaDeFecha
                    ? (hastaDeFecha.termina
                      ? 'El programa termina antes de esa fecha: llega hasta su última semana.'
                      : `Llega hasta la semana ${hastaDeFecha.semana}.`)
                    : (hastaGuardado ? `Ahora llega hasta la semana ${hastaGuardado.semana}. Elige otra fecha para cambiarlo.` : 'Elige la fecha.')}
                </div>
              </div>
            ))}
            {opcion('dia', dias.length > 1 ? 'Solo esta semana' : 'Solo este día', 'Una vez, en esta semana.')}
          </div>
        </>
      )}

      <div style={{
        marginTop: 16, padding: '11px 13px', borderRadius: 12, background: T.bg, border: `1px solid ${T.border}`,
        fontSize: 14, fontWeight: 800, color: T.text,
      }}>
        {resumen}
      </div>
    </div>
  );
}

/* «Repetir» de UNA sesión: lo cambia en la regla. La fecha es solo de pantalla: el programa no
   tiene fechas, así que se cuenta cuántas semanas faltan desde donde va el atleta y se guarda
   la semana a la que llega. */
function RepetirDeLaRegla({ regla, fases, lista, aqui, ancla, semanal, onCambio }) {
  const [fecha, setFecha] = useState('');
  const a = regla.alcance ?? { tipo: 'todo' };
  const desde = a.desde ?? ancla;
  const tipo = a.tipo ?? 'todo';

  const calculaHasta = (f) => {
    if (!f || !lista.length) return null;
    const base = aqui ?? ancla;
    const i0 = Math.max(0, lista.findIndex((s) => s.faseId === base.faseId && s.semana === base.semana));
    const k = Math.max(0, semanasEntre(isoWeekKey(new Date()), isoWeekKey(new Date(`${f}T12:00:00`))));
    const iFin = Math.min(lista.length - 1, i0 + k);
    return { ...lista[iFin], termina: i0 + k > lista.length - 1 };
  };
  const hastaDeFecha = tipo === 'hasta' ? calculaHasta(fecha) : null;

  const cambiaTipo = (nuevo) => {
    if (nuevo === 'fases') onCambio({ alcance: { tipo: nuevo, desde, fases: a.fases?.length ? a.fases : [desde.faseId] } });
    else if (nuevo === 'dia') onCambio({ alcance: { tipo: nuevo, desde } });
    else if (nuevo === 'hasta') onCambio({ alcance: { tipo: nuevo, desde, hasta: a.hasta ?? null } });
    else onCambio({ alcance: { tipo: 'todo', desde } });
  };
  const cambiaFecha = (f) => {
    setFecha(f);
    const h = calculaHasta(f);
    onCambio({ alcance: { tipo: 'hasta', desde, hasta: h ? { faseId: h.faseId, semana: h.semana, n: h.n } : null } });
  };

  return (
    <BloqueRepetir
      semanal={semanal}
      fases={fases}
      sinFases={fases.length < 2}
      dias={regla.dias ?? []} onDias={(dias) => onCambio({ dias })}
      tipo={tipo} onTipo={cambiaTipo}
      fasesSel={a.fases ?? [desde.faseId]} onFasesSel={(ids) => onCambio({ alcance: { tipo: 'fases', desde, fases: ids } })}
      fecha={fecha} onFecha={cambiaFecha}
      hastaDeFecha={hastaDeFecha}
      hastaGuardado={a.hasta}
      resumen={textoDeCuantoOcupa(regla, fases, { semanal })}
    />
  );
}

/* ----------------------------------------------------------------------- */
/* Lo mío en un día: la sesión (editable), su «Repetir» y sus salidas        */
/* ----------------------------------------------------------------------- */

function TarjetaDeMiSesion({
  regla, dia, fases, lista, aqui, ancla, semanal, editorProps, onSesion, onRegla, onSaltar, onQuitar,
}) {
  const vacia = reglaVacia(regla);
  const nombreDeSemana = (o) => `${fases.find((x) => x.id === o.faseId)?.name ?? 'Fase'} · semana ${o.semana}`;
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 2px 8px' }}>
        <span style={{
          fontSize: 10.5, fontWeight: 800, letterSpacing: 0.5, color: T.accent, background: T.accentBg,
          borderRadius: 6, padding: '3px 8px',
        }}>
          TUYA
        </span>
        {vacia && (
          <span style={{ fontSize: 12.5, fontWeight: 700, color: T.text2 }}>
            Todavía vacía: agrégale un ejercicio o una nota; si la dejas así, no se guarda.
          </span>
        )}
      </div>

      <SessionEditor
        day={{ ...regla.sesion, day: dia }}
        onPatch={onSesion}
        {...editorProps}
      />

      <RepetirDeLaRegla
        regla={regla} fases={fases} lista={lista} aqui={aqui} ancla={ancla} semanal={semanal} onCambio={onRegla}
      />

      {(regla.omitir ?? []).length > 0 && (
        <div style={{ marginTop: 12, background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 14, padding: '12px 14px' }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: T.text, marginBottom: 8 }}>Semanas que saltaste</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {regla.omitir.map((o) => (
              <div key={`${o.faseId}-${o.semana}`} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: T.text2 }}>{nombreDeSemana(o)}</span>
                <button
                  type="button"
                  onClick={() => onRegla({ omitir: regla.omitir.filter((x) => !(x.faseId === o.faseId && x.semana === o.semana)) })}
                  style={{ ...botonBlanco, minHeight: 34, padding: '0 11px', fontSize: 12.5 }}
                >
                  <Undo2 size={14} /> Volver a ponerla
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
        {!semanal && (
          <button type="button" onClick={onSaltar} style={botonBlanco}>
            <SkipForward size={15} /> No poner esta semana
          </button>
        )}
        <button type="button" onClick={onQuitar} style={{ ...botonBlanco, borderColor: T.danger, color: T.danger }}>
          <Trash2 size={15} /> Quitarla de todo el programa
        </button>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------- */
/* La pantalla                                                              */
/* ----------------------------------------------------------------------- */

export default function SesionesSobreElPrograma({
  athlete, planDelCoach, filas = [], miFila = null, aqui = null, equipoDe = [], onGuardado, onClose,
}) {
  const esCompu = useIsDesktop();
  const { user, profile } = useAuth();
  const pregunta = useConfirmacion();
  const autorId = user?.id ?? null;
  const isMaster = !!profile?.is_owner;

  const [fila, setFila] = useState(miFila);
  const [reglas, setReglas] = useState(() => reglasDe(miFila));
  const [dirty, setDirty] = useState(false);
  const [haGuardado, setHaGuardado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [err, setErr] = useState('');

  const fases = useMemo(() => planDelCoach?.data?.phases ?? [], [planDelCoach]);
  const kind = planDelCoach?.data?.kind === 'weekly' ? 'weekly' : 'periodized';
  const semanal = kind === 'weekly';
  const estructura = estructuraDelPlan(planDelCoach?.data);
  const lista = useMemo(() => semanasDelPrograma(fases), [fases]);

  /* Lo mío y lo de otros profesionales, repartido en los días del programa del coach. Los días
     de la hoja salen del coach y, además, de ellos: un renglón dice lo de todos. */
  const mias = useMemo(() => fasesConPegadas(reglas, fases, { autorId, semanal }), [reglas, fases, autorId, semanal]);
  const deOtros = useMemo(() => filas
    .filter((f) => f.profesional_id !== autorId)
    .map((f, i) => {
      const m = equipoDe.find((x) => x.profesional_id === f.profesional_id);
      return {
        etiqueta: m ? `${nombreCorto(m.full_name) || m.username} · ${rolDeProfesion(m.profesion)}` : 'Equipo',
        color: colorDePrograma(2 + i),
        fases: fasesConPegadas(reglasDe(f), fases, { autorId: f.profesional_id, semanal }),
      };
    }), [filas, autorId, equipoDe, fases, semanal]);
  const fasesVista = useMemo(() => fases.map((f, fi) => ({
    ...f,
    weekData: (f.weekData ?? []).map((w, wi) => ({
      ...w,
      days: [
        ...(w.days ?? []),
        ...(mias[fi]?.weekData?.[wi]?.days ?? []),
        ...deOtros.flatMap((o) => o.fases[fi]?.weekData?.[wi]?.days ?? []),
      ],
    })),
  })), [fases, mias, deOtros]);

  // Dónde se abre: donde va el atleta, en su día de hoy si lo hay.
  const [pi, setPi] = useState(() => Math.max(0, fases.findIndex((f) => f.id === aqui?.faseId)));
  const [weekIdx, setWeekIdx] = useState(() => {
    const f = fases[Math.max(0, fases.findIndex((x) => x.id === aqui?.faseId))];
    return Math.max(0, (f?.weekData ?? []).findIndex((w) => w.num === aqui?.semana));
  });
  const [dia, setDia] = useState(() => {
    const f = fases[Math.max(0, fases.findIndex((x) => x.id === aqui?.faseId))];
    const semana = f?.weekData?.[Math.max(0, (f?.weekData ?? []).findIndex((w) => w.num === aqui?.semana))];
    return aqui?.dia != null && semana?.days?.[aqui.dia] ? normDia(semana.days[aqui.dia].day) : diaParaSemana(semana, 'Lun');
  });
  const [editandoDiaTel, setEditandoDiaTel] = useState(false);

  const p = fasesVista[pi];
  const wIdx = p ? Math.max(0, Math.min(weekIdx, p.weekData.length - 1)) : 0;
  const w = p?.weekData?.[wIdx];
  const nSemana = lista.findIndex((s) => s.faseId === p?.id && s.semana === w?.num);
  const ancla = { faseId: p?.id, semana: w?.num, n: Math.max(0, nSemana) };

  // El repertorio de este profesional (la base del master + lo suyo), igual que en el constructor de planes.
  const [repertoire, setRepertoire] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [masterId, setMasterId] = useState(null);
  useEffect(() => {
    Promise.all([listExercises(), getMasterId(), listCategories(), listExerciseOverrides(user?.id)])
      .then(([exs, mId, cats, mios]) => {
        const tagged = tagRepertoire(aplicarOverrides(exs, mios, cats), mId, user?.id);
        setRepertoire(isMaster ? tagged : tagged.filter((e) => e.isBase || e.isMine));
        setCategorias(cats);
        setMasterId(mId);
      })
      .catch(() => {});
  }, [user?.id, isMaster]);
  const categoriasVisibles = useMemo(() => conLasMiasPrimero(
    categorias.filter((c) => !c.created_by || c.created_by === masterId || c.created_by === user?.id), user?.id,
  ), [categorias, masterId, user?.id]);
  const editorProps = {
    repertoire,
    categorias: categoriasVisibles,
    atleta: athlete,
    duenoId: user?.id,
    masterId,
    onCategoriaCreada: (f) => setCategorias((prev) => [...prev, f]),
    onCategoriaBorrada: (id) => setCategorias((prev) => prev.filter((c) => c.id !== id)),
    onEjercicioCreado: (f) => setRepertoire((prev) => [...prev, { ...f, isMine: true, isBase: false }]),
  };

  // Al pasar de la hoja al día (en el teléfono) se empieza arriba: la pantalla es la misma.
  const principal = useRef(null);
  useEffect(() => { if (principal.current) principal.current.scrollTop = 0; }, [editandoDiaTel]);

  const toca = () => { setDirty(true); setHaGuardado(false); setErr(''); };
  const cambiaRegla = (id, parche) => { setReglas((prev) => prev.map((r) => (r.id === id ? { ...r, ...parche } : r))); toca(); };
  const cambiaSesion = (id, parche) => {
    setReglas((prev) => prev.map((r) => (r.id === id
      ? { ...r, sesion: { ...r.sesion, ...parche }, nombre: (parche.name ?? r.sesion?.name ?? r.nombre) || 'Sesión' }
      : r)));
    toca();
  };
  const añadeMia = () => {
    setReglas((prev) => [...prev, nuevaRegla({
      sesion: { name: '', cat: 'gym', exercises: [] },
      dias: [dia],
      alcance: { tipo: 'todo', desde: ancla },
    })]);
    toca();
  };
  const saltaSemana = (r) => cambiaRegla(r.id, { omitir: [...(r.omitir ?? []), { faseId: ancla.faseId, semana: ancla.semana }] });
  const quitaRegla = async (r) => {
    const va = await pregunta({
      titulo: `¿Quitar «${r.nombre}» de todo el programa?`,
      detalle: 'Se va de todos los días en que cae. Lo que el atleta ya anotó se queda guardado.',
      confirmar: 'Sí, quitarla',
      peligro: true,
    });
    if (!va) return;
    setReglas((prev) => prev.filter((x) => x.id !== r.id));
    toca();
  };

  async function guardar() {
    const utiles = reglas.filter((r) => !reglaVacia(r));
    const mal = utiles.find((r) => (r.alcance?.tipo === 'fases' && !(r.alcance.fases ?? []).length)
      || (r.alcance?.tipo === 'hasta' && !r.alcance.hasta) || !(r.dias ?? []).length);
    if (mal) {
      const falta = !(mal.dias ?? []).length
        ? 'elige al menos un día de la semana.'
        : (mal.alcance?.tipo === 'fases' ? 'elige al menos una fase.' : 'elige hasta qué fecha.');
      setErr(`«${mal.nombre}»: ${falta}`);
      return;
    }
    const sinContenido = reglas.filter(reglaVacia);
    if (sinContenido.some((r) => reglasDe(fila).some((g) => g.id === r.id))) {
      const va = await pregunta({
        titulo: 'Una sesión tuya quedó vacía',
        detalle: 'Si guardas, se quita del programa.',
        confirmar: 'Guardar y quitarla',
        peligro: true,
      });
      if (!va) return;
    }
    setGuardando(true);
    setErr('');
    try {
      const row = await guardarSesionesPegadas({ fila, atletaId: athlete.id, autorId, sesiones: utiles });
      setFila(row);
      setReglas(utiles);
      setDirty(false);
      setHaGuardado(true);
      onGuardado?.(row);
    } catch (e) {
      setErr(e.message || 'No se pudo guardar');
    } finally {
      setGuardando(false);
    }
  }

  async function cierra() {
    if (dirty) {
      const va = await pregunta({
        titulo: 'Tienes cambios sin guardar',
        detalle: 'Si sales ahora se pierden.',
        confirmar: 'Salir sin guardar',
        cancelar: 'Seguir aquí',
        peligro: true,
      });
      if (!va) return;
    }
    onClose();
  }
  const volver = () => { if (!esCompu && editandoDiaTel) setEditandoDiaTel(false); else cierra(); };

  /* El lugar de una sesión mía en la hoja: su primera semana, en su primer día. */
  const irARegla = (r) => {
    const d = r.alcance?.desde;
    const fi = Math.max(0, fases.findIndex((f) => f.id === d?.faseId));
    const wi = Math.max(0, (fases[fi]?.weekData ?? []).findIndex((x) => x.num === d?.semana));
    setPi(fi);
    setWeekIdx(wi);
    setDia(r.dias?.[0] ?? 'Lun');
    if (!esCompu) setEditandoDiaTel(true);
  };

  const coach = equipoDe.find((m) => m.es_principal);
  const etiquetaCoach = `${nombreCorto(coach?.full_name) || 'Coach'} · ${rolDeProfesion(coach?.profesion)}`;
  const nombreAtleta = athlete.full_name || athlete.username;

  // La marca de cada renglón de la hoja: candado = lo del coach; «tuya» = lo mío.
  const marcas = (sesiones) => {
    const mios = sesiones.some((d) => d.sid && d.autorId === autorId);
    const deOtro = sesiones.some((d) => d.sid && d.autorId !== autorId);
    const delCoach = sesiones.some((d) => !d.sid);
    return (
      <>
        {delCoach && <Lock size={12} color={T.text3} style={{ flexShrink: 0 }} />}
        {deOtro && (
          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.3, color: T.text2, background: T.bg3, borderRadius: 6, padding: '3px 7px', flexShrink: 0 }}>
            OTRO
          </span>
        )}
        {mios && (
          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.3, color: T.accent, background: T.accentBg, borderRadius: 6, padding: '3px 7px', flexShrink: 0 }}>
            TUYA
          </span>
        )}
      </>
    );
  };

  let crumb = `${p?.name || 'Fase'} · ${weekName(w, wIdx + 1)}`;
  if (semanal) crumb = 'Rutina semanal';
  else if (estructura === 'semanas') crumb = `Semana ${semanaGlobal(fases, p?.id, w?.num) ?? wIdx + 1} de ${semanasDelPlan(fases)}`;

  /* ---------- la hoja (izquierda; en el teléfono, la primera pantalla) ---------- */
  const hoja = (
    <div>
      <div style={{ marginBottom: 14 }}>
        <Field label={semanal ? 'Rutina del coach' : 'Programa del coach'}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 9, border: `1.5px solid ${T.border}`, borderRadius: 11,
            padding: '10px 12px', background: T.bg3, fontFamily: FONT, fontSize: 14, fontWeight: 600, color: T.text2,
          }}>
            <Lock size={14} style={{ flexShrink: 0 }} />
            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {planDelCoach?.title}
            </span>
          </div>
        </Field>
      </div>

      <NavegadorDelPlan
        fases={fasesVista}
        kind={kind}
        estructura={estructura}
        quien="atleta"
        aqui={aqui}
        editor={{
          soloLectura: true,
          faseAbierta: pi,
          semanaAbierta: w?.num,
          onAbrirFase: (i, semanaNum) => {
            const wi = Math.max(0, (fasesVista[i]?.weekData ?? []).findIndex((x) => x.num === semanaNum));
            const semana = fasesVista[i]?.weekData?.[wi];
            const suDia = aqui && aqui.faseId === fasesVista[i]?.id && aqui.semana === semana?.num && aqui.dia != null
              ? normDia(semana.days[aqui.dia]?.day) : null;
            setPi(i);
            setWeekIdx(wi);
            setDia((d) => suDia || diaParaSemana(semana, d));
          },
          onElegirSemana: (num) => {
            const wi = Math.max(0, (p?.weekData ?? []).findIndex((x) => x.num === num));
            setWeekIdx(wi);
            setDia((d) => diaParaSemana(p?.weekData?.[wi], d));
          },
          diaElegido: dia,
          onElegirDia: (f, i, semana, clave) => { setDia(clave); if (!esCompu) setEditandoDiaTel(true); },
          marcas,
        }}
      />

      {reglas.length > 0 && (
        <div style={{ marginTop: 22 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: T.text3, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>
            Mis sesiones ({reglas.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {reglas.map((r) => {
              const huerfana = esHuerfana(r, fases);
              return (
                <div
                  key={r.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, background: T.bg2, borderRadius: 13,
                    border: `1.5px solid ${huerfana ? T.danger : T.border}`, padding: '4px 6px 4px 4px',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => !huerfana && irARegla(r)}
                    style={{
                      flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left',
                      border: 'none', background: 'transparent', cursor: huerfana ? 'default' : 'pointer', fontFamily: FONT, padding: '8px 9px',
                    }}
                  >
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 14, fontWeight: 800, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.nombre}
                      </span>
                      <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: huerfana ? T.danger : T.text2, marginTop: 2 }}>
                        {huerfana
                          ? 'Sin lugar en el programa: el coach lo cambió.'
                          : `${(r.dias ?? []).map((x) => ABREV[x]).join(' · ')} · ${textoDeAlcance(r, fases)}`}
                      </span>
                    </span>
                    {!huerfana && <ChevronRight size={15} color={T.text3} style={{ flexShrink: 0 }} />}
                  </button>
                  {huerfana && (
                    <button
                      type="button"
                      onClick={() => quitaRegla(r)}
                      aria-label={`Quitar ${r.nombre}`}
                      style={{ ...botonBlanco, minHeight: 34, padding: '0 10px', borderColor: T.danger, color: T.danger }}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  /* ---------- el día (derecha; en el teléfono, la segunda pantalla) ---------- */
  const delCoachDia = (w?.days ?? []).filter((d) => !d.sid && normDia(d.day) === dia);
  const otrosDia = deOtros.flatMap((o) => (o.fases[pi]?.weekData?.[wIdx]?.days ?? [])
    .filter((d) => d.day === dia).map((d) => ({ d, o })));
  const misReglasDia = (mias[pi]?.weekData?.[wIdx]?.days ?? []).filter((d) => d.day === dia)
    .map((d) => reglas.find((r) => r.id === d.reglaId)).filter(Boolean);
  const hayAlgo = delCoachDia.length + otrosDia.length + misReglasDia.length > 0;

  const editorDelDia = p && (
    <div>
      <div style={{ marginBottom: 14, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.text3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {semanal ? 'Rutina que se repite' : crumb}
        </div>
        <div style={{ fontSize: 19, fontWeight: 800, color: T.text, letterSpacing: -0.3 }}>
          {NOMBRE_DIA[dia] || dia}
        </div>
      </div>

      {!w ? (
        <div style={{ background: T.bg2, border: `1.5px solid ${T.border}`, borderRadius: 20, padding: '40px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: T.text }}>Esta fase todavía no tiene semanas</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {!hayAlgo && (
            <div style={{ background: T.bg2, border: `1.5px solid ${T.border}`, borderRadius: 20, padding: '52px 24px', textAlign: 'center' }}>
              <div style={{ width: 70, height: 70, borderRadius: 22, background: T.accentBg, color: T.accent, display: 'grid', placeItems: 'center', margin: '0 auto 16px' }}>
                <CalendarDays size={30} />
              </div>
              <div style={{ fontSize: 17, fontWeight: 800, color: T.text }}>No hay sesión para el {nombreLargoDeDia(dia)}</div>
              <div style={{ fontSize: 13.5, color: T.text2, marginTop: 8, lineHeight: 1.5 }}>
                Agrega la tuya: sale con tu nombre y se puede repetir.
              </div>
            </div>
          )}

          {/* LO DEL COACH: el mismo editor, en solo lectura. Se ve y se navega; no se toca. */}
          {delCoachDia.map((d, k) => (
            <div key={`c${k}`}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, margin: '0 2px 8px', fontSize: 12.5, fontWeight: 800, color: T.text2 }}>
                <Lock size={13} /> {etiquetaCoach} · solo lectura
              </div>
              <SessionEditor soloLectura day={d} {...editorProps} />
            </div>
          ))}

          {otrosDia.map(({ d, o }, k) => (
            <div key={`o${k}`}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, margin: '0 2px 8px', fontSize: 12.5, fontWeight: 800, color: T.text2 }}>
                <Lock size={13} /> {o.etiqueta} · solo lectura
              </div>
              <SessionEditor soloLectura day={d} {...editorProps} />
            </div>
          ))}

          {/* LO MÍO: editable, con su «Repetir». */}
          {misReglasDia.map((r) => (
            <TarjetaDeMiSesion
              key={r.id}
              regla={r}
              dia={dia}
              fases={fases}
              lista={lista}
              aqui={aqui}
              ancla={ancla}
              semanal={semanal}
              editorProps={editorProps}
              onSesion={(parche) => cambiaSesion(r.id, parche)}
              onRegla={(parche) => cambiaRegla(r.id, parche)}
              onSaltar={() => saltaSemana(r)}
              onQuitar={() => quitaRegla(r)}
            />
          ))}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={añadeMia}
              className="kp-press"
              style={{
                flex: '1 1 220px', minHeight: 46, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                borderRadius: 14, border: `1.5px solid ${T.accent}`, background: T.bg2, cursor: 'pointer',
                boxShadow: KP.shCard, fontFamily: FONT, fontSize: 14, fontWeight: 800, color: T.accent,
              }}
            >
              <Plus size={16} /> Agregar sesión mía el {nombreLargoDeDia(dia)}
            </button>
          </div>
        </div>
      )}
    </div>
  );

  let cuerpo;
  if (!p) {
    cuerpo = (
      <div style={{ textAlign: 'center', padding: 40, color: T.text2, fontWeight: 700 }}>
        Este programa todavía no tiene semanas.
      </div>
    );
  } else if (esCompu) {
    cuerpo = (
      <div style={{
        display: 'grid', gridTemplateColumns: 'minmax(300px, 380px) minmax(0, 1fr)', gap: 24,
        maxWidth: 1240, margin: '0 auto', alignItems: 'start',
      }}>
        <aside style={{ position: 'sticky', top: 0, maxHeight: 'calc(100svh - 110px)', overflowY: 'auto', padding: '2px 4px 8px 2px' }}>
          {hoja}
        </aside>
        <section style={{ minWidth: 0 }}>{editorDelDia}</section>
      </div>
    );
  } else {
    cuerpo = (
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        {editandoDiaTel && editorDelDia ? editorDelDia : hoja}
      </div>
    );
  }

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 2400, background: T.bg, fontFamily: FONT, display: 'flex', flexDirection: 'column' }}>
      <header
        style={{
          background: 'rgba(255,255,255,0.86)', backdropFilter: 'saturate(180%) blur(16px)',
          borderBottom: `1px solid ${T.border}`, padding: '13px 18px',
          display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
        }}
      >
        <button
          type="button"
          onClick={volver}
          aria-label="Volver"
          style={{ width: 36, height: 36, borderRadius: 11, border: `1px solid ${T.border}`, cursor: 'pointer', background: T.bg2, color: T.text, display: 'grid', placeItems: 'center', flexShrink: 0 }}
        >
          <ArrowLeft size={17} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {crumb}
          </div>
          <div style={{ fontSize: 12, color: T.text2, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {nombreAtleta} · tus sesiones{dirty ? ' · sin guardar' : (haGuardado ? ' · guardado' : '')}
          </div>
        </div>
        <button
          type="button"
          onClick={guardar}
          disabled={guardando || !dirty}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 18px', borderRadius: 12,
            border: 'none', cursor: guardando || !dirty ? 'default' : 'pointer',
            background: dirty ? `linear-gradient(135deg, ${T.accent}, ${T.accentDk})` : T.bg3,
            // Recién guardado, en verde: se lee como «listo», no como botón apagado.
            color: dirty ? '#fff' : (haGuardado ? KP.mint : T.text3), fontFamily: FONT, fontSize: 14, fontWeight: 800,
            boxShadow: dirty ? KP.shBtn : 'none', opacity: guardando ? 0.75 : 1, flexShrink: 0,
          }}
        >
          {guardando ? <Loader2 size={15} className="spin" /> : <Check size={15} />}
          {!dirty && haGuardado ? 'Guardado' : 'Guardar'}
        </button>
        <button
          type="button"
          onClick={cierra}
          aria-label="Cerrar"
          style={{ width: 36, height: 36, borderRadius: 11, border: `1px solid ${T.border}`, cursor: 'pointer', background: T.bg2, color: T.text2, display: 'grid', placeItems: 'center', flexShrink: 0 }}
        >
          <X size={17} />
        </button>
      </header>

      {err && (
        <div style={{ maxWidth: 980, margin: '14px auto 0', width: 'calc(100% - 36px)', background: 'rgba(220,38,38,0.08)', color: T.danger, borderRadius: 12, padding: '11px 15px', fontWeight: 700, fontSize: 13.5 }}>
          {err}
        </div>
      )}

      <main ref={principal} style={{ flex: 1, overflowY: 'auto', padding: '20px 18px 60px' }}>{cuerpo}</main>

      <style>{`
        .spin{animation:spin .8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}
        .kp-pill,.kp-ico{transition:background .12s}
        .kp-pill:hover:not(:disabled),.kp-ico:hover:not(:disabled){background:${T.bg3} !important}
      `}</style>
    </div>,
    document.body,
  );
}
