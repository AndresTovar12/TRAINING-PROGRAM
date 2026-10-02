import { useEffect, useMemo, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { usePalabras } from '@/contexts/PalabrasContext';
import { planDe, getAthleteState } from '@/lib/api';
import { dondeVa, estructuraDelPlan } from '@/lib/training-utils';
import { esProgramaFantasma } from '@/lib/programas';
import { diaTieneSesion, ponerWorkoutEnPlan, semanaActual } from '@/lib/asignar';
import NavegadorDelPlan from '@/components/NavegadorDelPlan';
import { T, FONT } from '@/lib/theme';
import { botonBlanco, botonPrincipal } from '@/features/misplanes/estilos';

const NOMBRE_DIA = { Lun: 'lunes', Mar: 'martes', Mié: 'miércoles', Jue: 'jueves', Vie: 'viernes', Sáb: 'sábado', Dom: 'domingo' };

/**
 * Elegir DÓNDE va un workout en el plan de UN atleta: la misma hoja del programa de siempre (fases,
 * semanas y los siete días), solo para escoger. Es la salida de «Atleta por atleta» y de «Asignar de
 * Mis planes» desde la ficha de un atleta.
 *
 * `clave`: de quién es el programa que se toca (`null` = el del coach principal; con id = el de un
 * profesional del equipo). `data`/`nombre`: el workout. `onListo(filaDelPlan)` avisa que ya se puso; `onSaltar`
 * (si viene) deja pasar a este atleta sin ponerle nada.
 */
export default function ElegirDiaDelAtleta({ atleta, clave = null, data, nombre, onListo, onSaltar }) {
  const { t } = usePalabras();
  const [carga, setCarga] = useState({ listo: false, plan: null, estado: null });
  const [fi, setFi] = useState(null);
  const [semanaNum, setSemanaNum] = useState(null);
  const [dia, setDia] = useState(null);
  const [modo, setModo] = useState('agregar');
  const [poniendo, setPoniendo] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let vivo = true;
    Promise.all([planDe(atleta.id, clave), getAthleteState(atleta.id).catch(() => null)])
      .then(([plan, estado]) => { if (vivo) setCarga({ listo: true, plan, estado }); })
      .catch(() => { if (vivo) setCarga({ listo: true, plan: null, estado: null }); });
    return () => { vivo = false; };
  }, [atleta.id, clave]);

  const { plan, estado } = carga;
  const fases = useMemo(() => plan?.data?.phases ?? [], [plan]);
  const sufijo = clave ? `@${clave}` : '';
  const aqui = useMemo(
    () => (plan ? dondeVa(fases, plan.data?.kind, estado?.data?.[`wr:cursor${sufijo}`]) : null),
    [plan, fases, estado, sufijo],
  );
  const inicio = useMemo(() => (plan ? semanaActual(plan, estado?.data) : { faseIdx: 0, semanaIdx: 0 }), [plan, estado]);

  // Mientras no se toque nada, la hoja abre en la semana donde va el atleta.
  const faseIdx = fi ?? inicio.faseIdx;
  const semanas = fases[faseIdx]?.weekData ?? [];
  const semanaIdx = semanaNum != null
    ? Math.max(0, semanas.findIndex((w) => w.num === semanaNum))
    : (fi == null ? inicio.semanaIdx : 0);
  const semana = semanas[semanaIdx];
  const ocupado = !!dia && diaTieneSesion(plan, faseIdx, semanaIdx, dia);

  async function poner() {
    if (!dia || poniendo) return;
    setPoniendo(true);
    setError('');
    try {
      const fila = await ponerWorkoutEnPlan({ plan, faseIdx, semanaIdx, dia, data, nombre, modo });
      onListo?.(fila);
    } catch (e) {
      setError(e.message || 'No se pudo poner');
      setPoniendo(false);
    }
  }

  if (!carga.listo) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.text2, fontWeight: 600, padding: 16 }}>
        <Loader2 size={16} className="spin" /> {t('Cargando su plan…')}
      </div>
    );
  }

  if (!plan || esProgramaFantasma(plan.data) || fases.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: T.text2, lineHeight: 1.5 }}>
          {atleta.full_name || atleta.username} {t('todavía no tiene un plan donde poner el workout. Dale primero un programa o una rutina de Mis planes.')}
        </div>
        {onSaltar && <button type="button" onClick={onSaltar} style={{ ...botonBlanco(), alignSelf: 'flex-start' }}>Seguir con el siguiente</button>}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <NavegadorDelPlan
        fases={fases}
        kind={plan.data?.kind}
        estructura={estructuraDelPlan(plan.data)}
        quien="atleta"
        aqui={aqui}
        editor={{
          soloLectura: true,
          faseAbierta: faseIdx,
          semanaAbierta: semana?.num,
          onAbrirFase: (i, num) => { setFi(i); setSemanaNum(num); setDia(null); },
          onElegirSemana: (num) => { setSemanaNum(num); setDia(null); },
          diaElegido: dia,
          onElegirDia: (f, i, sem, clavDia) => setDia(clavDia),
        }}
      />

      {dia && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 14, padding: '12px 14px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.text, lineHeight: 1.45 }}>
            Se pone el {NOMBRE_DIA[dia] ?? dia}, en la semana {semana?.num} de {fases[faseIdx]?.name || t('su plan')}.
          </div>
          {ocupado && (
            <div role="radiogroup" aria-label="Ese día ya tiene sesión" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                ['agregar', 'Agregarlo como otra sesión del día'],
                ['reemplazar', 'Reemplazar la primera sesión del día'],
              ].map(([valor, texto]) => (
                <label key={valor} style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer', fontSize: 13.5, fontWeight: 600, color: T.text }}>
                  <input type="radio" name="modo-dia" checked={modo === valor} onChange={() => setModo(valor)} style={{ accentColor: T.accent }} />
                  {texto}
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {error && <div style={{ fontSize: 13, fontWeight: 700, color: T.danger }}>{error}</div>}

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap', fontFamily: FONT }}>
        {onSaltar && <button type="button" onClick={onSaltar} disabled={poniendo} style={botonBlanco(false, poniendo)}>{t('Saltar este atleta')}</button>}
        <button type="button" onClick={poner} disabled={!dia || poniendo} style={botonPrincipal(!dia || poniendo)}>
          {poniendo ? <Loader2 size={16} className="spin" /> : <Check size={16} />} Poner aquí
        </button>
      </div>
      {!dia && (
        <div style={{ fontSize: 12.5, fontWeight: 600, color: T.text3, textAlign: 'right' }}>
          Toca el día de la semana donde va.
        </div>
      )}
    </div>
  );
}
