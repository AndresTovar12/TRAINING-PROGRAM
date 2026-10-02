import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, CircleCheck, Loader2, Search } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePalabras } from '@/contexts/PalabrasContext';
import { listAthletesOverview } from '@/lib/api';
import { abrirItem } from '@/lib/misPlanes';
import {
  asignarPlanAVarios, asignarWorkoutAVarios, programaDe,
} from '@/lib/asignar';
import { planDePrograma, planDeRutina, textoDeResumen } from '@/lib/misPlanesDatos';
import Ventana from '@/features/misplanes/Ventana';
import ElegirDiaDelAtleta from '@/features/misplanes/ElegirDiaDelAtleta';
import { botonBlanco, botonPrincipal, campo } from '@/features/misplanes/estilos';
import { T, FONT } from '@/lib/theme';

const DIAS = [['Lun', 'Lunes'], ['Mar', 'Martes'], ['Mié', 'Miércoles'], ['Jue', 'Jueves'], ['Vie', 'Viernes'], ['Sáb', 'Sábado'], ['Dom', 'Domingo']];

/**
 * «Asignar a…» desde Mis planes: se eligen UNO O VARIOS atletas y se les da una copia (Andrés, 2 oct 2026).
 *
 *   programa o rutina — reemplaza el plan que ya tengan (la base guarda el anterior: se recupera en
 *                       «Cambios del plan») y empieza en la semana 1 hoy; antes se ve quién ya tiene plan.
 *   workout           — se pregunta cómo: «el mismo día de la semana, en la semana en que va hoy cada uno»
 *                       o «atleta por atleta» (se elige su fase, semana y día a mano). Si ese día ya tiene
 *                       sesión, se elige agregar o reemplazar.
 */
export default function AsignarDialog({ item, onCerrar }) {
  const { user, profile } = useAuth();
  const { salud, t } = usePalabras();
  const yo = user?.id;
  const esMaster = !!profile?.is_owner;
  const esWorkout = item.tipo === 'workout';

  const [atletas, setAtletas] = useState(null);
  const [error, setError] = useState('');
  const [buscar, setBuscar] = useState('');
  const [elegidos, setElegidos] = useState(() => new Set());
  const [modo, setModo] = useState('semana'); // workout: 'semana' (el mismo día en la semana de cada uno) | 'uno'
  const [dia, setDia] = useState('Lun');
  const [siHayDia, setSiHayDia] = useState('agregar');
  const [fase, setFase] = useState('elegir'); // elegir → (uno por uno) → trabajando → resultado
  const [avance, setAvance] = useState({ hechos: 0, total: 0 });
  const [resultados, setResultados] = useState([]);
  const [cola, setCola] = useState([]); // «atleta por atleta»: los que faltan
  const [actual, setActual] = useState(null);
  const [contexto, setContexto] = useState(null); // clave del programa del atleta actual

  useEffect(() => {
    let vivo = true;
    listAthletesOverview({ yo, esMaster })
      .then((filas) => {
        if (!vivo) return;
        const lista = filas
          .filter((a) => a.role !== 'admin' && !(salud && a.alta_en))
          .sort((a, b) => String(a.full_name || a.username).localeCompare(String(b.full_name || b.username), 'es', { sensitivity: 'base' }));
        setAtletas(lista);
      })
      .catch((e) => { if (vivo) setError(e.message || 'No se pudo cargar la lista'); });
    return () => { vivo = false; };
  }, [yo, esMaster, salud]);

  const visibles = useMemo(() => {
    const q = buscar.trim().toLowerCase();
    return (atletas ?? []).filter((a) => !q || (a.full_name || '').toLowerCase().includes(q) || (a.username || '').toLowerCase().includes(q));
  }, [atletas, buscar]);
  const lista = (atletas ?? []).filter((a) => elegidos.has(a.id));
  const conPlan = lista.filter((a) => a.plan);

  const alternar = (id) => setElegidos((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const todosVisibles = visibles.length > 0 && visibles.every((a) => elegidos.has(a.id));
  const alternarTodos = () => setElegidos((prev) => {
    const n = new Set(prev);
    visibles.forEach((a) => { if (todosVisibles) n.delete(a.id); else n.add(a.id); });
    return n;
  });

  async function asignar() {
    setError('');
    setFase('trabajando');
    setAvance({ hechos: 0, total: lista.length });
    try {
      const datos = await abrirItem(item);
      const alAvanzar = (hechos, total) => setAvance({ hechos, total });
      let res;
      if (esWorkout) {
        res = await asignarWorkoutAVarios({ atletas: lista, yo, esMaster, salud, dia, data: datos, nombre: item.nombre, modo: siHayDia, alAvanzar });
      } else {
        // Cada atleta recibe su propia copia, con ids de fase nuevos.
        res = await asignarPlanAVarios({
          atletas: lista, yo, esMaster, salud, nombre: item.nombre, alAvanzar,
          hacerPlan: () => (item.tipo === 'programa' ? planDePrograma(datos) : planDeRutina(datos)),
        });
      }
      setResultados(res);
      setFase('resultado');
    } catch (e) {
      setError(e.message || 'No se pudo asignar');
      setFase('elegir');
    }
  }

  // «Atleta por atleta»: se arma la cola y se pasa al primero.
  async function empezarUnoPorUno() {
    setError('');
    try {
      const datos = await abrirItem(item);
      setContexto({ datos });
      setResultados([]);
      const [primero, ...resto] = lista;
      await siguiente(primero, resto, []);
    } catch (e) {
      setError(e.message || 'No se pudo abrir');
    }
  }

  async function siguiente(atleta, resto, previos) {
    if (!atleta) {
      setResultados(previos);
      setActual(null);
      setFase('resultado');
      return;
    }
    const { clave } = await programaDe({ atleta, yo, esMaster, salud });
    setActual({ atleta, clave, previos });
    setCola(resto);
    setFase('uno');
  }

  async function terminoElActual(estado) {
    const previos = [...(actual?.previos ?? []), { atleta: actual.atleta, estado }];
    const [primero, ...resto] = cola;
    await siguiente(primero, resto, previos);
  }

  const titulo = `Asignar «${item.nombre}»`;
  const subtitulo = textoDeResumen(item.tipo, item.resumen);

  /* ---- Atleta por atleta ---- */
  if (fase === 'uno' && actual) {
    const n = actual.previos.length + 1;
    const total = actual.previos.length + 1 + cola.length;
    return (
      <Ventana titulo={`${actual.atleta.full_name || actual.atleta.username}: elige el día`} subtitulo={`${n} de ${total} · ${item.nombre}`} onCerrar={onCerrar} ancho={620}>
        <ElegirDiaDelAtleta
          key={actual.atleta.id}
          atleta={actual.atleta} clave={actual.clave} data={contexto.datos} nombre={item.nombre}
          onListo={() => terminoElActual('ok')}
          onSaltar={() => terminoElActual('saltado')}
        />
      </Ventana>
    );
  }

  /* ---- Resultado ---- */
  if (fase === 'resultado') {
    const ok = resultados.filter((r) => r.estado === 'ok').length;
    const todos = ok === resultados.length && ok > 0;
    return (
      <Ventana
        titulo={todos ? 'Asignado' : 'Esto fue lo que pasó'}
        subtitulo={todos ? undefined : t(`${ok} de ${resultados.length} ${resultados.length === 1 ? 'atleta' : 'atletas'}`)}
        onCerrar={onCerrar}
        pie={<button type="button" onClick={onCerrar} style={botonPrincipal(false)}>Cerrar</button>}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {resultados.map((r) => {
            const bien = r.estado === 'ok';
            // Lo bien hecho se dice con la palomita; las palabras son solo para lo que merece explicación.
            const texto = bien ? (r.reemplazo ? t('Reemplazó su plan anterior (se recupera en «Cambios del plan»).') : null)
              : r.estado === 'sin-plan' ? t('No tiene plan: se saltó. Dale primero un programa o una rutina.')
                : r.estado === 'saltado' ? 'Lo saltaste.'
                  : `No se pudo: ${r.mensaje || 'error'}`;
            return (
              <div key={r.atleta.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 12, padding: '10px 12px' }}>
                {bien ? <CircleCheck size={18} color={T.accent} style={{ flexShrink: 0, marginTop: 1 }} /> : <AlertTriangle size={18} color={T.warning} style={{ flexShrink: 0, marginTop: 1 }} />}
                <span style={{ flex: 1, minWidth: 0, fontFamily: FONT }}>
                  <span style={{ display: 'block', fontSize: 14, fontWeight: 800, color: T.text, overflowWrap: 'anywhere' }}>{r.atleta.full_name || r.atleta.username}</span>
                  {texto && (
                    <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: T.text2, marginTop: 2, lineHeight: 1.4 }}>{texto}</span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </Ventana>
    );
  }

  /* ---- Trabajando ---- */
  if (fase === 'trabajando') {
    return (
      <Ventana titulo={titulo} onCerrar={() => {}}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: T.text2, fontWeight: 700, padding: '18px 4px' }}>
          <Loader2 size={18} className="spin" /> Asignando… {avance.hechos} de {avance.total}
        </div>
      </Ventana>
    );
  }

  /* ---- Elegir atletas (y, en un workout, cómo) ---- */
  const puede = lista.length > 0;
  const textoBoton = esWorkout && modo === 'uno'
    ? 'Continuar'
    : (puede ? t(`Asignar a ${lista.length} ${lista.length === 1 ? 'atleta' : 'atletas'}`) : 'Asignar');
  // Con pocos atletas no hace falta buscar; con uno solo, tampoco «Elegir todos».
  const conBuscador = !!atletas && atletas.length > 6;
  const conTodos = !!atletas && atletas.length > 1;
  return (
    <Ventana
      titulo={titulo} subtitulo={subtitulo} onCerrar={onCerrar} ancho={560}
      pie={(
        <>
          <button type="button" onClick={onCerrar} style={botonBlanco()}>Cancelar</button>
          <button
            type="button" disabled={!puede} style={botonPrincipal(!puede)}
            onClick={esWorkout && modo === 'uno' ? empezarUnoPorUno : asignar}
          >
            <Check size={16} /> {textoBoton}
          </button>
        </>
      )}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: T.text2, lineHeight: 1.5 }}>
          {esWorkout
            ? 'Cada uno recibe una copia: si luego cambias el workout, la suya no cambia.'
            : 'Cada uno recibe una copia, que empieza en la semana 1 hoy.'}
        </div>

        {conBuscador && (
          <div style={{ position: 'relative' }}>
            <Search size={16} color={T.text3} style={{ position: 'absolute', left: 12, top: 13 }} />
            <input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder={t('Buscar atleta')} style={{ ...campo, paddingLeft: 36 }} />
          </div>
        )}

        {atletas === null && !error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.text2, fontWeight: 600, padding: 10 }}>
            <Loader2 size={16} className="spin" /> Cargando…
          </div>
        )}
        {error && <div style={{ color: T.danger, fontWeight: 700, fontSize: 13.5 }}>{error}</div>}

        {atletas && (
          <>
            {conTodos && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13.5, fontWeight: 800, color: T.text }}>
                <input type="checkbox" checked={todosVisibles} onChange={alternarTodos} style={{ width: 19, height: 19, accentColor: T.accent }} />
                Elegir todos ({visibles.length})
              </label>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 280, overflowY: 'auto' }}>
              {visibles.map((a) => (
                <label
                  key={a.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 11, cursor: 'pointer', padding: '10px 12px', background: T.bg2,
                    border: `1.5px solid ${elegidos.has(a.id) ? T.accent : T.border}`, borderRadius: 12,
                  }}
                >
                  <input type="checkbox" checked={elegidos.has(a.id)} onChange={() => alternar(a.id)} style={{ width: 19, height: 19, accentColor: T.accent, flexShrink: 0 }} />
                  <span style={{ flex: 1, minWidth: 0, fontFamily: FONT }}>
                    <span style={{ display: 'block', fontSize: 14, fontWeight: 800, color: T.text, overflowWrap: 'anywhere' }}>{a.full_name || a.username}</span>
                    <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: a.plan ? T.text2 : T.text3, marginTop: 1 }}>
                      {a.plan ? `Tiene «${a.plan.title}»` : t('Sin plan')}
                    </span>
                  </span>
                </label>
              ))}
              {visibles.length === 0 && <div style={{ fontSize: 13.5, fontWeight: 600, color: T.text3, padding: 10 }}>{t('No hay atletas que coincidan.')}</div>}
            </div>
          </>
        )}

        {!esWorkout && conPlan.length > 0 && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: T.accentBg, borderRadius: 12, padding: '10px 12px', fontSize: 13, fontWeight: 600, color: T.text, lineHeight: 1.45 }}>
            <AlertTriangle size={17} color={T.accent} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>
              {t(conPlan.length === 1 ? '1 de los atletas elegidos ya tiene plan' : `${conPlan.length} de los atletas elegidos ya tienen plan`)}
              {t(': se reemplaza con este. El anterior se recupera en «Cambios del plan»; lo que ya anotaron queda como historial.')}
            </span>
          </div>
        )}

        {esWorkout && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 14, padding: '12px 14px' }}>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: T.text }}>¿Cómo se pone?</div>
            {[
              ['semana', 'El mismo día de la semana, en la semana en que va cada uno hoy'],
              ['uno', t('Atleta por atleta: elijo yo la fase, la semana y el día de cada uno')],
            ].map(([valor, texto]) => (
              <label key={valor} style={{ display: 'flex', alignItems: 'flex-start', gap: 9, cursor: 'pointer', fontSize: 13.5, fontWeight: 600, color: T.text, lineHeight: 1.4 }}>
                <input type="radio" name="modo-workout" checked={modo === valor} onChange={() => setModo(valor)} style={{ accentColor: T.accent, marginTop: 2 }} />
                {texto}
              </label>
            ))}
            {modo === 'semana' && (
              <>
                {/* Los siete días en una sola fila, con las mismas siglas del editor (Lun, Mar, Mié…). */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 6 }}>
                  {DIAS.map(([clave, nombre]) => (
                    <button
                      key={clave} type="button" onClick={() => setDia(clave)} aria-label={nombre} aria-pressed={dia === clave}
                      style={{
                        padding: '9px 0', borderRadius: 10, cursor: 'pointer', fontFamily: FONT, fontSize: 13, fontWeight: 800,
                        border: `1.5px solid ${dia === clave ? T.accent : T.border}`, background: dia === clave ? T.accentBg : T.bg2,
                        color: dia === clave ? T.accent : T.text2,
                      }}
                    >
                      {clave}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.text2 }}>Si ese día ya tiene sesión:</div>
                {[
                  ['agregar', 'Agregarlo como otra sesión del día'],
                  ['reemplazar', 'Reemplazar la primera sesión del día'],
                ].map(([valor, texto]) => (
                  <label key={valor} style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer', fontSize: 13.5, fontWeight: 600, color: T.text }}>
                    <input type="radio" name="si-hay-dia" checked={siHayDia === valor} onChange={() => setSiHayDia(valor)} style={{ accentColor: T.accent }} />
                    {texto}
                  </label>
                ))}
                <div style={{ fontSize: 12.5, fontWeight: 600, color: T.text3, lineHeight: 1.4 }}>
                  {t('Quien no tenga plan se salta.')}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </Ventana>
  );
}
