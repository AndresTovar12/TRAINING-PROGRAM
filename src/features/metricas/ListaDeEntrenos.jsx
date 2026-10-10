import { useMemo, useState } from 'react';
import { Activity, ChevronRight, Flame, HeartPulse, Route, Timer } from 'lucide-react';
import { LT, KP, FONT, NUM_STYLE } from '@/lib/theme';
import { nombreDelDeporte } from '@/lib/metricas/deportes';
import { diaLocal, lunesDe, sumaDias } from '@/lib/metricas/forma';
import { distanciaTexto, duracionTexto, fechaCorta, horaTexto, rangoDeSemana } from '@/lib/metricas/formato';
import { EstadoVacio, MosaicoDeDeporte } from './Piezas';

/* La lista de entrenos, de la semana más nueva a la más vieja, con los totales de cada semana arriba. Un toque abre el detalle. */

/** Un entreno en una fila: ícono del deporte, título, cuándo, y lo principal (tiempo, distancia, pulso o calorías) con su carga. */
export function FilaDeEntreno({ a, alAbrir, conFecha = true }) {
  const kcal = a.kcal_activas ?? a.kcal_totales;
  const stats = [
    a.duracion_s > 0 && { Icono: Timer, texto: duracionTexto(a.duracion_s) },
    a.distancia_m >= 100 && { Icono: Route, texto: distanciaTexto(a.distancia_m) },
    a.fc_media > 0 && { Icono: HeartPulse, texto: `${a.fc_media} lpm` },
    !(a.fc_media > 0) && kcal > 0 && { Icono: Flame, texto: `${Math.round(kcal)} kcal` },
  ].filter(Boolean);
  const titulo = a.titulo || nombreDelDeporte(a.deporte);
  return (
    <button
      type="button" onClick={() => alAbrir(a)} className="kp-press"
      aria-label={`${titulo}, ${fechaCorta(a.inicio, a.desfase_min)}, ${stats.map((s) => s.texto).join(', ')}`}
      style={{
        width: '100%', display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr) auto auto', columnGap: 12, rowGap: 8, alignItems: 'center', padding: '12px 14px',
        border: `1px solid ${KP.line}`, borderRadius: 16, background: KP.surface, cursor: 'pointer', textAlign: 'left', fontFamily: FONT, touchAction: 'manipulation',
      }}
    >
      <MosaicoDeDeporte deporte={a.deporte} size={44} />
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 15.5, fontWeight: 800, color: LT.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{titulo}</span>
        <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: LT.text2, marginTop: 2, ...NUM_STYLE }}>
          {conFecha ? `${fechaCorta(a.inicio, a.desfase_min)} · ${horaTexto(a.inicio, a.desfase_min)}` : horaTexto(a.inicio, a.desfase_min)}
          {a.dispositivo && <span className="hidden sm:inline">{` · ${a.dispositivo}`}</span>}
        </span>
      </span>
      {a.carga > 0 ? (
        <span
          title={a.carga_metodo === 'estimada' ? 'Carga estimada (sin pulso)' : 'Carga calculada del pulso'}
          style={{ textAlign: 'center', padding: '6px 10px', borderRadius: 12, background: KP.blueSoft, color: LT.blue, fontWeight: 800, lineHeight: 1.1, ...NUM_STYLE }}
        >
          <span style={{ display: 'block', fontSize: 16 }}>{a.carga_metodo === 'estimada' ? '≈' : ''}{Math.round(a.carga)}</span>
          <span style={{ display: 'block', fontSize: 10.5, fontWeight: 700, letterSpacing: 0.3 }}>CARGA</span>
        </span>
      ) : <span />}
      <ChevronRight size={18} color={LT.text3} />
      {stats.length > 0 && (
        // Las cifras van en su propio renglón, de ancho completo: en un teléfono no caben junto al nombre y la carga.
        <span style={{ gridColumn: '2 / -1', display: 'flex', flexWrap: 'wrap', gap: '4px 14px' }}>
          {stats.map(({ Icono, texto }, i) => (
            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 700, color: LT.text, ...NUM_STYLE }}>
              <Icono size={14} color={LT.text3} />{texto}
            </span>
          ))}
        </span>
      )}
    </button>
  );
}

const RANGOS = [
  { id: 30, titulo: '30 días' }, { id: 90, titulo: '3 meses' }, { id: 365, titulo: '12 meses' },
];

/** Los deportes que hay en la lista, con cuántos entrenos de cada uno (para los filtros). */
function deportesDe(lista) {
  const cuenta = new Map();
  lista.forEach((a) => cuenta.set(a.deporte, (cuenta.get(a.deporte) ?? 0) + 1));
  return [...cuenta.entries()].sort((a, b) => b[1] - a[1]);
}

export default function ListaDeEntrenos({ d, hoy, alAbrir, alImportar, puedeImportar }) {
  const [rango, setRango] = useState(90);
  const [deporte, setDeporte] = useState(null);
  const limite = useMemo(() => {
    const t = Date.parse(`${hoy}T00:00:00Z`) - rango * 86400000;
    return new Date(t).toISOString().slice(0, 10);
  }, [hoy, rango]);
  const delRango = useMemo(() => d.lista.filter((a) => (diaLocal(a.inicio, a.desfase_min) ?? '') >= limite), [d.lista, limite]);
  const deportes = useMemo(() => deportesDe(delRango), [delRango]);
  const filtrados = deporte ? delRango.filter((a) => a.deporte === deporte) : delRango;

  const semanas = useMemo(() => {
    const grupos = new Map();
    filtrados.forEach((a) => {
      const lunes = lunesDe(diaLocal(a.inicio, a.desfase_min));
      if (!grupos.has(lunes)) grupos.set(lunes, []);
      grupos.get(lunes).push(a);
    });
    return [...grupos.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [filtrados]);

  if (!d.lista.length) {
    return (
      <EstadoVacio icono={Activity} titulo="Todavía no hay entrenos" texto="Cuando se importen entrenos del reloj o de archivos, aparecen aquí con su pulso, su ritmo y su carga.">
        {puedeImportar && alImportar}
      </EstadoVacio>
    );
  }
  const lunesDeHoy = lunesDe(hoy);
  const nombreDeSemana = (lunes) => (lunes === lunesDeHoy ? 'Esta semana' : (lunes === sumaDias(lunesDeHoy, -7) ? 'Semana pasada' : rangoDeSemana(lunes)));

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10, alignItems: 'center' }}>
        <div role="group" aria-label="Periodo" style={{ display: 'flex', gap: 6 }}>
          {RANGOS.map((r) => (
            <button
              key={r.id} type="button" aria-pressed={rango === r.id} onClick={() => setRango(r.id)}
              style={{
                minHeight: 36, padding: '0 13px', borderRadius: 999, cursor: 'pointer', fontFamily: FONT, fontSize: 13.5, fontWeight: 800, touchAction: 'manipulation',
                border: `1.5px solid ${rango === r.id ? LT.blue : LT.borderHi}`, background: rango === r.id ? LT.blue : LT.surface, color: rango === r.id ? '#fff' : LT.text,
              }}
            >
              {r.titulo}
            </button>
          ))}
        </div>
      </div>
      {deportes.length > 1 && (
        <div role="group" aria-label="Deporte" style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 6, marginBottom: 6, scrollbarWidth: 'none' }}>
          {[[null, delRango.length], ...deportes].map(([id, n]) => (
            <button
              key={id ?? 'todos'} type="button" aria-pressed={deporte === id} onClick={() => setDeporte(id)}
              style={{
                flexShrink: 0, minHeight: 34, padding: '0 12px', borderRadius: 10, cursor: 'pointer', fontFamily: FONT, fontSize: 13, fontWeight: 700, touchAction: 'manipulation',
                border: 'none', background: deporte === id ? LT.text : LT.surface2, color: deporte === id ? '#fff' : LT.text2,
              }}
            >
              {id ? nombreDelDeporte(id) : 'Todos'} · {n}
            </button>
          ))}
        </div>
      )}
      {!filtrados.length && <div style={{ padding: '24px 4px', color: LT.text2, fontWeight: 600, fontSize: 14.5 }}>No hay entrenos en este periodo.</div>}
      {semanas.map(([lunes, lista]) => {
        const tiempo = lista.reduce((s, a) => s + (a.duracion_s ?? 0), 0);
        const carga = Math.round(lista.reduce((s, a) => s + (a.carga ?? 0), 0));
        return (
          <section key={lunes} style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 8, padding: '0 2px' }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: LT.text }}>{nombreDeSemana(lunes)}</h3>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: LT.text2, ...NUM_STYLE }}>
                {lista.length} {lista.length === 1 ? 'entreno' : 'entrenos'} · {duracionTexto(tiempo)}{carga > 0 ? ` · carga ${carga}` : ''}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {lista.map((a) => <FilaDeEntreno key={a.id} a={a} alAbrir={alAbrir} />)}
            </div>
          </section>
        );
      })}
    </div>
  );
}
