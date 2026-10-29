import { useMemo } from 'react';
import { nombreDelDeporte } from '@/lib/metricas/deportes';
import { duracionTexto } from '@/lib/metricas/formato';
import { actividadDeEntreno } from '@/lib/actividades';
import { aspectoDelTipo, tipoParaStickers } from '@/lib/aspectoDelTipo';
import { sinDuracion } from '@/lib/sesiones';
import { guiadoDe } from '@/lib/stickers/ficha';
import { cuandoCorto, lineaDeActividad, miles, segundosDe } from '@/lib/paginaDelEntreno';
import { desdeKilos, etiquetaUnidad } from '@/lib/unidades';
import { Upload } from 'lucide-react';
import { FONT, KP, LT } from '@/lib/theme';
import IconoDeActividad from './IconoDeActividad';
import { Grupo, Fila } from '@/components/ui';

// «hoy», «ayer», «hace 3 días» cuando es de esta semana; si no, «19 oct».
const cuando = (f) => cuandoCorto(f.inicio, f.desfase_min);

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

/** La pastilla «Plan», a la derecha del nombre: azul clarito con la letra azul (fase 7). */
export const PastillaPlan = () => (
  <span style={{ display: 'inline-block', marginLeft: 7, padding: '1px 7px', borderRadius: 99, background: KP.blueSoft, color: KP.blue, fontSize: 11.5, fontWeight: 700, lineHeight: '18px', verticalAlign: 2 }}>Plan</span>
);

/**
 * UN ENTRENO DE LA LISTA (`e`: lo de `mezclaEntrenos`). Uno libre o del reloj: el ícono de su actividad y «cuándo · 5.00 km · 5:27 /km» (fase 7: el número
 * protagonista y su secundario, `lineaDeActividad`). Un workout del plan
 * (fase 6): el ícono del tipo de la sesión, su nombre con la pastilla «Plan» y «cuándo · tiempo · kilos» («ayer · 42 min · 3,880 kg», fase 7); si el reloj
 * también lo trajo, el tiempo es el del reloj. Una sesión marcada a mano: solo cuándo. `alCompartir`: el ⇪ de la derecha (sin él, la flecha ›).
 */
export function FilaDeTusEntrenos({ e, alAbrir, alCompartir, propias = [], unidadPeso = 'kg' }) {
  const a = e.actividad ?? null;
  const plan = e.plan ?? null;
  const volumen = useMemo(() => (plan ? guiadoDe(plan.s.registro)?.volumen ?? 0 : 0), [plan]);
  let nombre;
  let izquierda;
  let detalle;
  if (plan) {
    const cara = caraDeLaSesion(plan);
    nombre = cara.nombre;
    izquierda = <IconoDeActividad actividad={cara.actividad} size={38} />;
    const segundos = segundosDe(e);
    const kilos = volumen > 0 ? `${miles(desdeKilos(volumen, unidadPeso))} ${etiquetaUnidad(unidadPeso)}` : null;
    detalle = [cuando(a ?? comoFila(plan.s.inicio)), segundos >= 60 ? duracionTexto(segundos) : null, kilos].filter((x) => x && x !== '—').join(' · ');
  } else {
    nombre = a.titulo || nombreDelDeporte(a.deporte);
    izquierda = <IconoDeActividad actividad={actividadDeEntreno(a, propias)} size={38} />;
    detalle = `${cuando(a)} · ${lineaDeActividad(a)}`;
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
        <Upload size={21} />
      </button>
    </div>
  );
}

/* «TUS ENTRENOS»: lo que ha hecho, lo más nuevo primero. Tocar uno abre su página.
   Reestructura visual (15 oct 2026): una lista agrupada. Cada uno con el ícono de su actividad (Activity Tracker, 23 oct 2026); `propias`: las que creó.
   Stickers (28 oct 2026): el ⇪ de cada fila (44 × 44, sin círculo de fondo) abre directo sus stickers (`alCompartir`).
   Fase 6 (29 oct 2026): también los workouts del plan, con la pastilla «Plan» (`entrenos`: lo de `mezclaEntrenos`).
   Fase 7 (29 oct 2026): «Ver todos» es un enlace azul a la derecha del título (`alVerTodos`). Sin ningún entreno, una tarjeta que dice qué va a vivir aquí.
   Mientras carga (`entrenos` = `null`), nada. */
export default function TusEntrenos({ entrenos, alAbrir, alCompartir, alVerTodos = null, propias = [], unidadPeso = 'kg' }) {
  if (!entrenos) return null;
  if (!entrenos.length) {
    return (
      <Grupo titulo="Tus entrenos">
        <div style={{ padding: '16px 16px 17px', fontFamily: FONT }}>
          <b style={{ display: 'block', fontSize: 15.5, color: LT.text }}>Aquí van a vivir tus entrenos.</b>
          <p style={{ margin: '3px 0 0', fontSize: 13.5, color: LT.text2, lineHeight: 1.45 }}>Cada uno trae sus stickers para compartir cuando quieras.</p>
        </div>
      </Grupo>
    );
  }
  const verTodos = alVerTodos && (
    <button type="button" onClick={alVerTodos} className="kp-press" style={{ border: 'none', background: 'none', padding: '4px 2px', cursor: 'pointer', fontFamily: FONT, fontSize: 14.5, fontWeight: 700, color: KP.blue, touchAction: 'manipulation' }}>
      Ver todos
    </button>
  );
  return (
    <Grupo titulo="Tus entrenos" accion={verTodos}>
      {entrenos.map((e) => <FilaDeTusEntrenos key={e.clave} e={e} alAbrir={alAbrir} alCompartir={alCompartir} propias={propias} unidadPeso={unidadPeso} />)}
    </Grupo>
  );
}
