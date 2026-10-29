import { useMemo } from 'react';
import { nombreDelDeporte } from '@/lib/metricas/deportes';
import { duracionTexto, fechaLarga } from '@/lib/metricas/formato';
import { filasPorSerie } from '@/lib/metricas/porSerie';
import { lineaDeEntreno } from '@/lib/resumenLibre';
import { diasEntre, hoyLocal, diaLocal } from '@/lib/metricas/forma';
import { haceCuanto } from '@/lib/semanaLibre';
import { actividadDeEntreno } from '@/lib/actividades';
import { aspectoDelTipo, tipoParaStickers } from '@/lib/aspectoDelTipo';
import { seriesHechas } from '@/lib/entrenosDelPlan';
import { sinDuracion } from '@/lib/sesiones';
import { Share } from 'lucide-react';
import { KP } from '@/lib/theme';
import IconoDeActividad from './IconoDeActividad';
import { Grupo, Fila } from '@/components/ui';

// «hoy», «ayer», «hace 3 días» cuando es de esta semana; si no, la fecha entera (para que entre en una línea).
const cuando = (f) => { const dia = diaLocal(f.inicio, f.desfase_min); return dia && diasEntre(dia, hoyLocal()) < 7 ? haceCuanto(f) : fechaLarga(f.inicio, f.desfase_min); };

/** Una hora (milisegundos) como la trae una fila de `actividades`: `{ inicio, desfase_min }`, en la hora de este teléfono. */
const comoFila = (ms) => { const d = new Date(ms); return { inicio: d.toISOString(), desfase_min: -d.getTimezoneOffset() }; };

/** Lo que dice una fila del plan: el nombre de la sesión, el ícono y el color del tipo que eligió el coach. */
export function caraDeLaSesion(plan) {
  const dia = plan?.lugar?.dia ?? null;
  const tipo = dia ? tipoParaStickers(dia) : null;
  const color = dia ? aspectoDelTipo(dia).color : null;
  const nombre = (dia ? sinDuracion(dia.name || '') : '') || plan?.s?.nombre || 'Workout del plan';
  return { nombre, actividad: { nombre: tipo?.nombre ?? nombre, icono: tipo?.icono ?? 'pesa', color: color ?? KP.blue } };
}

/** La pastilla gris «Plan», a la derecha del nombre. */
export const PastillaPlan = () => (
  <span style={{ display: 'inline-block', marginLeft: 7, padding: '1px 7px', borderRadius: 99, background: '#ECEEF2', color: KP.ink2, fontSize: 11.5, fontWeight: 700, lineHeight: '18px', verticalAlign: 2 }}>Plan</span>
);

/**
 * UN ENTRENO DE LA LISTA (`e`: lo de `mezclaEntrenos`). Uno libre o del reloj: el ícono de su actividad y «cuándo · tiempo · distancia». Un workout del plan
 * (fase 6): el ícono del tipo de la sesión, su nombre con la pastilla «Plan» y «cuándo · N series · tiempo»; si el reloj también lo trajo, el tiempo es el del reloj.
 * `alCompartir`: el ⇪ de la derecha (sin él, la flecha ›).
 */
export function FilaDeTusEntrenos({ e, alAbrir, alCompartir, propias = [] }) {
  const a = e.actividad ?? null;
  const plan = e.plan ?? null;
  const series = useMemo(() => (plan ? seriesHechas(filasPorSerie({ registro: plan.s.registro }).resumen) : 0), [plan]);
  let nombre;
  let izquierda;
  let detalle;
  if (plan) {
    const cara = caraDeLaSesion(plan);
    nombre = cara.nombre;
    izquierda = <IconoDeActividad actividad={cara.actividad} size={38} />;
    const segundos = a ? a.duracion_s : Math.round((plan.s.fin - plan.s.inicio) / 1000);
    detalle = [cuando(a ?? comoFila(plan.s.inicio)), series > 0 ? `${series} ${series === 1 ? 'serie' : 'series'}` : null, segundos > 0 ? duracionTexto(segundos) : null].filter((x) => x && x !== '—').join(' · ');
  } else {
    nombre = a.titulo || nombreDelDeporte(a.deporte);
    izquierda = <IconoDeActividad actividad={actividadDeEntreno(a, propias)} size={38} />;
    detalle = `${cuando(a)}${lineaDeEntreno(a) ? ` · ${lineaDeEntreno(a)}` : ''}`;
  }
  const datos = {
    izquierda, texto: plan ? <>{nombre}<PastillaPlan /></> : nombre, detalle, onClick: () => alAbrir(e),
    etiquetaAccesible: `${nombre}${plan ? ', del plan' : ''}, ${detalle}`,
  };
  if (!alCompartir) return <Fila {...datos} />;
  // Sin la flecha ›: a la derecha va el ⇪ (fuera de la fila: un botón no puede ir dentro de otro).
  return (
    <div className="ui-fila" style={{ display: 'flex', alignItems: 'center' }}>
      <div style={{ flex: 1, minWidth: 0 }}><Fila {...datos} derecha={<span aria-hidden="true" />} /></div>
      <button
        type="button" onClick={() => alCompartir(e)} aria-label={`Compartir los stickers de ${nombre}`} className="kp-press"
        style={{ width: 44, height: 44, marginRight: 8, flexShrink: 0, border: 'none', background: 'transparent', color: KP.blue, display: 'grid', placeItems: 'center', cursor: 'pointer', touchAction: 'manipulation' }}
      >
        <Share size={21} />
      </button>
    </div>
  );
}

/* «TUS ENTRENOS»: lo que ha hecho, lo más nuevo primero. Tocar uno abre su página.
   Reestructura visual (15 oct 2026): una lista agrupada. Cada uno con el ícono de su actividad (Activity Tracker, 23 oct 2026); `propias`: las que creó.
   Stickers (28 oct 2026): el ⇪ de cada fila (44 × 44, sin círculo de fondo) abre directo sus stickers (`alCompartir`).
   Fase 6 (29 oct 2026): también los workouts del plan, con la pastilla «Plan» (`entrenos`: lo de `mezclaEntrenos`), y abajo «Ver todos» (`alVerTodos`). */
export default function TusEntrenos({ entrenos, alAbrir, alCompartir, alVerTodos = null, propias = [] }) {
  if (!entrenos?.length) return null;
  return (
    <Grupo titulo="Tus entrenos">
      {entrenos.map((e) => <FilaDeTusEntrenos key={e.clave} e={e} alAbrir={alAbrir} alCompartir={alCompartir} propias={propias} />)}
      {alVerTodos && <Fila texto="Ver todos" tono="enlace" onClick={alVerTodos} />}
    </Grupo>
  );
}
