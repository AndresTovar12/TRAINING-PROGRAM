import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft, X, Plus, Lock, Pencil, Repeat, Check, Loader2, Trash2, SkipForward, Undo2,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useConfirmacion } from '@/components/Confirmacion';
import {
  listExercises, getMasterId, tagRepertoire, listCategories, listExerciseOverrides, aplicarOverrides,
  guardarSesionesPegadas,
} from '@/lib/api';
import { conLasMiasPrimero } from '@/lib/categorias';
import { SessionEditor } from '@/features/admin/PlanBuilder';
import { T, FONT, KP, tipoDeSesion } from '@/lib/theme';
import { esDescanso, estructuraDelPlan, isoWeekKey, semanasEntre } from '@/lib/training-utils';
import { sesionesDelTitulo, sinDuracion, textoDeSesiones } from '@/lib/sesiones';
import {
  DIAS_SEMANA, esHuerfana, fasesConPegadas, indicesDeLaRegla, nombreLargoDeDia, nuevaRegla, reglasDe,
  semanasDelPrograma, textoDeCuantoOcupa,
} from '@/lib/pegadas';
import { colorDePrograma, nombreCorto, rolDeProfesion } from '@/lib/programas';

/* AGREGAR SESIONES AL PROGRAMA DEL COACH (la cuenta del fisio).

   Andrés, 1 oct 2026: el fisio ve una fase del programa del coach, escoge un día
   —«el miércoles»— y le crea ahí una sesión («fortalecimiento de tobillo») que le
   aparece al atleta dentro del programa en que ya trabaja. El programa del coach
   se ve SOLO PARA LEER (candado): ni el fisio mueve lo del coach ni el coach lo
   del fisio. Lo que el fisio agrega sale con su nombre.

   Y para no armar «estiramientos lunes, miércoles y viernes por un año» a mano,
   la sesión lleva un bloque «Repetir»: en qué días de la semana cae y hasta
   dónde. Se guarda UNA regla, no una fila por día (ver `lib/pegadas.js`).

   Dos vistas en la misma pantalla: el programa del coach con las sesiones de
   cada día, y el editor de UNA sesión (el mismo constructor que usa el coach, más
   «Repetir»). */

const ABREV = { Lun: 'L', Mar: 'M', 'Mié': 'X', Jue: 'J', Vie: 'V', 'Sáb': 'S', Dom: 'D' };
const capital = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const copia = (o) => structuredClone(o);
const normDia = (d) => ({ Mie: 'Mié', Sab: 'Sáb' }[d] ?? d);
const nombreDelDia = (day) => sinDuracion(day?.name || '')
  || textoDeSesiones(sesionesDelTitulo(day))
  || (esDescanso(day) ? 'Descanso' : tipoDeSesion(day).label);

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
  if (a.tipo === 'dia') return 'Solo un día';
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
    <div style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 18, padding: 16, marginTop: 16, boxShadow: KP.shCard }}>
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
            {opcion('dia', 'Solo este día', 'Una vez, en esta semana.')}
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

/* ----------------------------------------------------------------------- */
/* El editor de UNA sesión                                                  */
/* ----------------------------------------------------------------------- */

function EditorDeSesion({
  athlete, fases, kind, aqui, regla, ancla, guardando, err, onGuardar, onEliminar, onSaltarEstaSemana, onCancelar,
}) {
  const { user, profile } = useAuth();
  const semanal = kind === 'weekly';
  const isMaster = !!profile?.is_owner;
  const lista = useMemo(() => semanasDelPrograma(fases), [fases]);

  // El repertorio de este profesional (la base del master + lo suyo), igual que en el constructor de planes.
  const [repertoire, setRepertoire] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [masterId, setMasterId] = useState(null);
  useEffect(() => {
    Promise.all([listExercises(), getMasterId(), listCategories(), listExerciseOverrides(user?.id)])
      .then(([exs, mId, cats, mias]) => {
        const tagged = tagRepertoire(aplicarOverrides(exs, mias, cats), mId, user?.id);
        setRepertoire(isMaster ? tagged : tagged.filter((e) => e.isBase || e.isMine));
        setCategorias(cats);
        setMasterId(mId);
      })
      .catch(() => {});
  }, [user?.id, isMaster]);
  const categoriasVisibles = useMemo(() => conLasMiasPrimero(
    categorias.filter((c) => !c.created_by || c.created_by === masterId || c.created_by === user?.id), user?.id,
  ), [categorias, masterId, user?.id]);

  const [dia, setDia] = useState(() => (regla
    ? { ...copia(regla.sesion), day: ancla.dia }
    : { day: ancla.dia, name: '', cat: 'gym', exercises: [] }));
  const [dias, setDias] = useState(() => (regla?.dias?.length ? regla.dias : [ancla.dia]));
  const [tipo, setTipo] = useState(() => regla?.alcance?.tipo ?? 'todo');
  const [fasesSel, setFasesSel] = useState(() => regla?.alcance?.fases ?? [ancla.faseId]);
  const [fecha, setFecha] = useState('');
  const [omitir, setOmitir] = useState(() => regla?.omitir ?? []);
  const [aviso, setAviso] = useState('');

  // De dónde cuenta la regla: la semana donde se abrió (o la que ya tenía).
  const desde = useMemo(
    () => regla?.alcance?.desde ?? { faseId: ancla.faseId, semana: ancla.semana, n: ancla.n },
    [regla, ancla],
  );

  /* «Hasta una fecha»: el programa no tiene fechas, solo semanas. Se cuenta
     cuántas semanas faltan para esa fecha desde donde va el atleta (o, si aún no
     empieza, desde la semana donde se abrió) y se guarda la semana a la que llega. */
  const hastaDeFecha = useMemo(() => {
    if (tipo !== 'hasta' || !fecha || !lista.length) return null;
    const base = aqui ?? ancla;
    const i0 = Math.max(0, lista.findIndex((s) => s.faseId === base.faseId && s.semana === base.semana));
    const k = Math.max(0, semanasEntre(isoWeekKey(new Date()), isoWeekKey(new Date(`${fecha}T12:00:00`))));
    const iFin = Math.min(lista.length - 1, i0 + k);
    return { ...lista[iFin], termina: i0 + k > lista.length - 1 };
  }, [tipo, fecha, lista, aqui, ancla]);

  const alcance = useMemo(() => {
    if (tipo === 'fases') return { tipo, fases: fasesSel };
    if (tipo === 'dia') return { tipo, desde };
    if (tipo === 'hasta') {
      const hasta = hastaDeFecha
        ? { faseId: hastaDeFecha.faseId, semana: hastaDeFecha.semana, n: hastaDeFecha.n }
        : (regla?.alcance?.hasta ?? null);
      return { tipo, desde, hasta };
    }
    return { tipo: 'todo', desde };
  }, [tipo, fasesSel, desde, hastaDeFecha, regla]);

  const previa = useMemo(() => ({ id: regla?.id ?? 'previa', dias, alcance, omitir }), [regla, dias, alcance, omitir]);
  const resumen = textoDeCuantoOcupa(previa, fases, { semanal });

  function guardar() {
    const nombre = (dia.name || '').trim() || 'Sesión';
    // Una sesión de solo notas («Caminata 20 min») también vale: el atleta la lee como instrucciones.
    const hayContenido = (dia.exercises ?? []).some((e) => !e.isNote || (e.text || '').trim()) || (dia.blocks ?? []).length > 0;
    if (!hayContenido) { setAviso('Agrega al menos un ejercicio o una nota.'); return; }
    if (!dias.length) { setAviso('Elige al menos un día de la semana.'); return; }
    if (tipo === 'fases' && !fasesSel.length) { setAviso('Elige al menos una fase.'); return; }
    if (tipo === 'hasta' && !alcance.hasta) { setAviso('Elige hasta qué fecha.'); return; }
    setAviso('');
    const sesion = { ...copia(dia), name: nombre };
    delete sesion.day;
    onGuardar(regla
      ? { ...regla, nombre, sesion, dias, alcance, omitir }
      : nuevaRegla({ sesion: { ...sesion }, dias, alcance }));
  }

  const aplicaEstaSemana = !!regla && ancla.deLaSemana
    && indicesDeLaRegla(regla, lista).includes(lista.findIndex((s) => s.faseId === ancla.faseId && s.semana === ancla.semana));
  const nombresDeSemana = (o) => {
    const f = fases.find((x) => x.id === o.faseId);
    return `${f?.name ?? 'Fase'} · semana ${o.semana}`;
  };

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11.5, fontWeight: 800, color: T.accent, letterSpacing: 0.6 }}>
          {regla ? 'TU SESIÓN' : 'NUEVA SESIÓN'}
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, color: T.text, letterSpacing: -0.3 }}>
          {capital(nombreLargoDeDia(ancla.dia))}
          {!semanal && <span style={{ color: T.text2, fontWeight: 700 }}> · {ancla.donde}</span>}
        </div>
      </div>

      <SessionEditor
        day={dia}
        repertoire={repertoire}
        categorias={categoriasVisibles}
        atleta={athlete}
        duenoId={user?.id}
        masterId={masterId}
        onCategoriaCreada={(fila) => setCategorias((prev) => [...prev, fila])}
        onCategoriaBorrada={(id) => setCategorias((prev) => prev.filter((c) => c.id !== id))}
        onEjercicioCreado={(fila) => setRepertoire((prev) => [...prev, { ...fila, isMine: true, isBase: false }])}
        onPatch={(patch) => setDia((d) => ({ ...d, ...patch }))}
      />

      <BloqueRepetir
        semanal={semanal}
        fases={fases}
        sinFases={fases.length < 2}
        dias={dias} onDias={setDias}
        tipo={tipo} onTipo={setTipo}
        fasesSel={fasesSel} onFasesSel={setFasesSel}
        fecha={fecha} onFecha={setFecha}
        hastaDeFecha={hastaDeFecha}
        hastaGuardado={regla?.alcance?.hasta}
        resumen={resumen}
      />

      {omitir.length > 0 && (
        <div style={{ marginTop: 12, background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 14, padding: '12px 14px' }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: T.text, marginBottom: 8 }}>Semanas que saltaste</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {omitir.map((o) => (
              <div key={`${o.faseId}-${o.semana}`} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: T.text2 }}>{nombresDeSemana(o)}</span>
                <button
                  type="button"
                  onClick={() => setOmitir((prev) => prev.filter((x) => !(x.faseId === o.faseId && x.semana === o.semana)))}
                  style={{ ...botonBlanco, minHeight: 34, padding: '0 11px', fontSize: 12.5 }}
                >
                  <Undo2 size={14} /> Volver a ponerla
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {(aviso || err) && (
        <div style={{ marginTop: 12, background: 'rgba(220,38,38,0.08)', color: T.danger, borderRadius: 12, padding: '11px 15px', fontWeight: 700, fontSize: 13.5 }}>
          {aviso || err}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 18, alignItems: 'center' }}>
        <button
          type="button"
          onClick={guardar}
          disabled={guardando}
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 50, padding: '0 24px',
            borderRadius: 14, border: 'none', cursor: guardando ? 'default' : 'pointer', fontFamily: FONT, fontSize: 15.5, fontWeight: 800,
            color: '#fff', background: `linear-gradient(135deg, ${T.accent}, ${T.accentDk})`, boxShadow: KP.shBtn,
            opacity: guardando ? 0.75 : 1, flex: '1 1 200px',
          }}
        >
          {guardando ? <Loader2 size={17} className="spin" /> : <Check size={17} />} Guardar sesión
        </button>
        <button type="button" onClick={onCancelar} style={{ ...botonBlanco, minHeight: 50, borderColor: T.border, color: T.text2 }}>
          Cancelar
        </button>
      </div>

      {regla && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
          {aplicaEstaSemana && (
            <button type="button" onClick={() => onSaltarEstaSemana(regla, ancla)} style={botonBlanco}>
              <SkipForward size={15} /> No poner esta semana
            </button>
          )}
          <button
            type="button"
            onClick={() => onEliminar(regla)}
            style={{ ...botonBlanco, borderColor: T.danger, color: T.danger }}
          >
            <Trash2 size={15} /> Quitarla de todo el programa
          </button>
        </div>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------------- */
/* La pantalla                                                              */
/* ----------------------------------------------------------------------- */

export default function SesionesSobreElPrograma({
  athlete, planDelCoach, filas = [], miFila = null, aqui = null, equipoDe = [], onGuardado, onClose,
}) {
  const { user } = useAuth();
  const pregunta = useConfirmacion();
  const autorId = user?.id ?? null;
  const [fila, setFila] = useState(miFila);
  const [editor, setEditor] = useState(null);       // { regla, ancla } mientras se edita una sesión
  const [guardando, setGuardando] = useState(false);
  const [err, setErr] = useState('');
  // Al pasar del programa al editor (y de vuelta) se empieza arriba: la pantalla es la misma y conservaría la altura.
  const principal = useRef(null);
  useEffect(() => { if (principal.current) principal.current.scrollTop = 0; }, [editor]);

  const fases = useMemo(() => planDelCoach?.data?.phases ?? [], [planDelCoach]);
  const kind = planDelCoach?.data?.kind === 'weekly' ? 'weekly' : 'periodized';
  const semanal = kind === 'weekly';
  const estructura = estructuraDelPlan(planDelCoach?.data);
  const reglas = useMemo(() => reglasDe(fila), [fila]);
  const lista = useMemo(() => semanasDelPrograma(fases), [fases]);

  const semanasPlanas = useMemo(
    () => fases.flatMap((f, fi) => (f.weekData ?? []).map((w, wi) => ({ fi, wi, f, w }))),
    [fases],
  );
  const [sel, setSel] = useState(() => {
    const i = lista.findIndex((s) => s.faseId === aqui?.faseId && s.semana === aqui?.semana);
    return Math.max(0, i);
  });
  const actual = semanasPlanas[Math.min(sel, semanasPlanas.length - 1)] ?? null;

  // Lo mío y lo de otros profesionales, repartido en los días del programa del coach.
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

  async function guardarReglas(siguientes) {
    setGuardando(true);
    setErr('');
    try {
      const row = await guardarSesionesPegadas({ fila, atletaId: athlete.id, autorId, sesiones: siguientes });
      setFila(row);
      onGuardado?.(row);
      setEditor(null);
    } catch (e) {
      setErr(e.message || 'No se pudo guardar');
    } finally {
      setGuardando(false);
    }
  }

  const guardarRegla = (regla) => guardarReglas(
    reglas.some((r) => r.id === regla.id) ? reglas.map((r) => (r.id === regla.id ? regla : r)) : [...reglas, regla],
  );
  const saltarSemana = (regla, ancla) => guardarReglas(reglas.map((r) => (r.id === regla.id
    ? { ...r, omitir: [...(r.omitir ?? []), { faseId: ancla.faseId, semana: ancla.semana }] }
    : r)));
  const eliminarRegla = async (regla) => {
    const va = await pregunta({
      titulo: `¿Quitar «${regla.nombre}» de todo el programa?`,
      detalle: 'Se va de todos los días en que cae. Lo que el atleta ya anotó se queda guardado.',
      confirmar: 'Sí, quitarla',
      peligro: true,
    });
    if (va) guardarReglas(reglas.filter((r) => r.id !== regla.id));
  };

  const dondeDe = (s) => (estructura === 'fases' && fases.length > 1 ? `${s.f.name} · semana ${s.w.num}` : `Semana ${s.w.num}`);
  const abrirNueva = (dia) => setEditor({
    regla: null,
    ancla: {
      faseId: actual?.f.id, semana: actual?.w.num, n: sel, dia, deLaSemana: true, donde: actual ? dondeDe(actual) : '',
    },
  });
  const abrirRegla = (regla, deLaSemana = false) => {
    const d = regla.alcance?.desde;
    const s = (deLaSemana && actual) ? actual
      : (semanasPlanas.find((x) => x.f.id === d?.faseId && x.w.num === d?.semana) ?? semanasPlanas[0]);
    setEditor({
      regla,
      ancla: {
        faseId: s?.f.id, semana: s?.w.num, n: semanasPlanas.indexOf(s), dia: regla.dias?.[0] ?? 'Lun',
        deLaSemana, donde: s ? dondeDe(s) : '',
      },
    });
  };

  const nombreAtleta = athlete.full_name || athlete.username;
  const coach = equipoDe.find((m) => m.es_principal);
  const tituloDelPrograma = coach ? `Programa de ${nombreCorto(coach.full_name) || coach.username}` : 'Programa del coach';
  const volver = () => { if (editor) { setEditor(null); setErr(''); } else onClose(); };

  const cuerpoPrograma = !actual ? (
    <div style={{ textAlign: 'center', padding: 40, color: T.text2, fontWeight: 700 }}>
      Este programa todavía no tiene semanas.
    </div>
  ) : (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      {/* Las fases (si hay varias) y las semanas. El puntito es donde va el atleta. */}
      {estructura === 'fases' && fases.length > 1 && (
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, marginBottom: 10 }}>
          {fases.map((f, fi) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={actual.fi === fi}
              onClick={() => setSel(semanasPlanas.findIndex((x) => x.fi === fi && (aqui?.faseId === f.id ? x.w.num === aqui.semana : x.wi === 0)))}
              style={chip(actual.fi === fi)}
            >
              {f.name}
            </button>
          ))}
        </div>
      )}
      {!semanal && semanasPlanas.length > 1 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
          {semanasPlanas.map((s, i) => {
            if (estructura === 'fases' && s.fi !== actual.fi) return null;
            const elegida = i === sel;
            const suya = aqui?.faseId === s.f.id && aqui?.semana === s.w.num;
            return (
              <button
                key={`${s.f.id}-${s.w.num}`}
                type="button"
                aria-label={`Semana ${estructura === 'semanas' ? i + 1 : s.w.num}${suya ? ', donde va' : ''}`}
                onClick={() => setSel(i)}
                style={{
                  position: 'relative', minWidth: 40, padding: '8px 0', borderRadius: 10, cursor: 'pointer',
                  border: `${suya && !elegida ? 2 : 1}px solid ${elegida || suya ? T.accent : T.border}`,
                  background: elegida ? T.accent : T.bg2, color: elegida ? '#fff' : (suya ? T.accent : T.text2),
                  fontFamily: FONT, fontSize: 13, fontWeight: 800,
                }}
              >
                {estructura === 'semanas' ? i + 1 : s.w.num}
                {suya && <span style={{ position: 'absolute', left: '50%', bottom: 3, width: 4, height: 4, marginLeft: -2, borderRadius: 2, background: elegida ? '#fff' : T.accent }} />}
              </button>
            );
          })}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {DIAS_SEMANA.map((d) => {
          const delCoach = (actual.w.days ?? []).filter((x) => normDia(x.day) === d);
          const misDelDia = (mias[actual.fi]?.weekData?.[actual.wi]?.days ?? []).filter((x) => x.day === d);
          const deOtrosDia = deOtros.flatMap((o) => (o.fases[actual.fi]?.weekData?.[actual.wi]?.days ?? [])
            .filter((x) => x.day === d).map((x) => ({ x, o })));
          const vacio = !delCoach.length && !misDelDia.length && !deOtrosDia.length;
          return (
            <div
              key={d}
              style={{
                display: 'flex', gap: 12, background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 14, padding: '11px 12px',
              }}
            >
              <div style={{ width: 36, flexShrink: 0, paddingTop: 3, fontSize: 12, fontWeight: 800, color: T.text2, letterSpacing: 0.4 }}>
                {d.toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
                {delCoach.map((x, k) => (
                  <div
                    key={`c${k}`}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, background: T.bg, borderRadius: 10, padding: '8px 10px',
                      color: esDescanso(x) ? T.text3 : T.text2, fontSize: 13.5, fontWeight: 700,
                    }}
                  >
                    <Lock size={13} style={{ flexShrink: 0 }} />
                    <span style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{nombreDelDia(x)}</span>
                  </div>
                ))}
                {deOtrosDia.map(({ x, o }, k) => (
                  <div
                    key={`o${k}`}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, background: `${o.color}12`, border: `1px solid ${o.color}44`,
                      borderRadius: 10, padding: '8px 10px', fontSize: 13.5, fontWeight: 700, color: T.text2,
                    }}
                  >
                    <Lock size={13} style={{ flexShrink: 0 }} />
                    <span style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{nombreDelDia(x)}</span>
                    <span style={{ fontSize: 10.5, fontWeight: 800, color: o.color, flexShrink: 0 }}>{o.etiqueta}</span>
                  </div>
                ))}
                {misDelDia.map((x, k) => (
                  <button
                    key={`m${k}`}
                    type="button"
                    onClick={() => abrirRegla(reglas.find((r) => r.id === x.reglaId), true)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left', cursor: 'pointer', fontFamily: FONT,
                      background: T.accentBg, border: `1.5px solid ${T.accent}`, borderRadius: 10, padding: '8px 10px',
                      fontSize: 13.5, fontWeight: 800, color: T.text,
                    }}
                  >
                    <span style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{nombreDelDia(x)}</span>
                    <span style={{ fontSize: 10.5, fontWeight: 800, color: T.accent, flexShrink: 0 }}>TUYA</span>
                    <Pencil size={14} color={T.accent} style={{ flexShrink: 0 }} />
                  </button>
                ))}
                {vacio && <span style={{ fontSize: 13.5, fontWeight: 600, color: T.text3, padding: '6px 2px' }}>Sin sesión</span>}
                <button type="button" onClick={() => abrirNueva(d)} style={{ ...botonBlanco, alignSelf: 'flex-start' }}>
                  <Plus size={15} /> Agregar sesión mía
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {reglas.length > 0 && (
        <div style={{ marginTop: 26 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: T.text, marginBottom: 10 }}>
            Mis sesiones en este programa ({reglas.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {reglas.map((r) => {
              const huerfana = esHuerfana(r, fases);
              const ocupa = textoDeCuantoOcupa(r, fases, { semanal });
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => abrirRegla(r)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', cursor: 'pointer', fontFamily: FONT,
                    background: T.bg2, border: `1.5px solid ${huerfana ? T.danger : T.border}`, borderRadius: 14, padding: '12px 14px',
                  }}
                >
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 15, fontWeight: 800, color: T.text, overflowWrap: 'anywhere' }}>{r.nombre}</span>
                    <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: T.text2, marginTop: 2 }}>
                      {r.dias.map((x) => ABREV[x]).join(' · ')} · {textoDeAlcance(r, fases)}
                    </span>
                    <span style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: huerfana ? T.danger : T.text3, marginTop: 2 }}>
                      {huerfana ? 'Sin lugar en el programa: el coach lo cambió. Ábrela para moverla o quitarla.' : ocupa}
                    </span>
                  </span>
                  <Pencil size={16} color={T.text3} style={{ flexShrink: 0 }} />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 2400, background: T.bg, fontFamily: FONT, display: 'flex', flexDirection: 'column' }}>
      <header
        style={{
          background: 'rgba(255,255,255,0.86)', backdropFilter: 'saturate(180%) blur(16px)',
          borderBottom: `1px solid ${T.border}`, padding: '13px 18px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
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
            {editor ? (editor.regla ? 'Tu sesión' : 'Nueva sesión') : tituloDelPrograma}
          </div>
          <div style={{ fontSize: 12, color: T.text2, fontWeight: 600 }}>
            {nombreAtleta} · {planDelCoach?.title}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          style={{ width: 36, height: 36, borderRadius: 11, border: `1px solid ${T.border}`, cursor: 'pointer', background: T.bg2, color: T.text2, display: 'grid', placeItems: 'center', flexShrink: 0 }}
        >
          <X size={17} />
        </button>
      </header>

      <main ref={principal} style={{ flex: 1, overflowY: 'auto', padding: '20px 18px 70px' }}>
        {editor ? (
          <EditorDeSesion
            key={`${editor.regla?.id ?? 'nueva'}-${editor.ancla.dia}-${editor.ancla.n}`}
            athlete={athlete}
            fases={fases}
            kind={kind}
            aqui={aqui}
            regla={editor.regla}
            ancla={editor.ancla}
            guardando={guardando}
            err={err}
            onGuardar={guardarRegla}
            onEliminar={eliminarRegla}
            onSaltarEstaSemana={saltarSemana}
            onCancelar={volver}
          />
        ) : cuerpoPrograma}
      </main>

      <style>{`
        .spin{animation:spin .8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}
        .kp-pill,.kp-ico{transition:background .12s}
        .kp-pill:hover:not(:disabled),.kp-ico:hover:not(:disabled){background:${T.bg3} !important}
      `}</style>
    </div>,
    document.body,
  );
}
