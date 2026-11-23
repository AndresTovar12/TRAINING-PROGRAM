import { useMemo } from 'react';
import { LT, FONT, UI } from '@/lib/theme';
import { pasosDeLaLista } from '@/lib/pasosDeLaLista';
import { pasosDeLaSesion } from '@/lib/entreno';

/**
 * LA SESIÓN DE LA LISTA, ANTES DE EMPEZAR (paso 4 del entreno del atleta, 22 nov 2026; dibujo aprobado `pw/p3-correr.html`, pantalla 1).
 * Andrés: el atleta abría «Velocidad en pista» y solo veía «Marcar como hecha». Ahora ve lo que armó el coach, en orden, una tarjeta por
 * pieza (Calentamiento, Intervalos, Sprints…), con lo que se hace en palabras de atleta. Sale de los MISMOS pasos que el entreno guiado
 * (`pasosDeLaLista`), así lo que se lee aquí es exactamente lo que se va a hacer.
 */

const sinRepetir = (xs) => [...new Set(xs.filter(Boolean))];
const conMeta = (p) => [p.texto?.split(' · ')[0], p.meta?.texto].filter(Boolean).join(' a ').replace(' a Zona', ' · Zona').replace(' a Al máximo', ' · al máximo');

/** Lo que se dice de una pieza: renglones de texto y, si son tramos o sprints, sus rayitas. */
function resumenDe(pasos) {
  const trabajo = pasos.filter((p) => p.tipo !== 'descanso');
  const descansos = pasos.filter((p) => p.tipo === 'descanso');
  const p0 = trabajo[0] ?? pasos[0];
  if (!p0) return { lineas: [] };
  if (p0.tipo === 'descanso') return { lineas: [p0.texto] };
  if (p0.tramos > 1) {
    const distintos = sinRepetir(trabajo.map(conMeta));
    // Las rayas: el primer tipo de tramo fuerte, los demás claros (en unos intervalos, el primero es el rápido).
    return { lineas: distintos.slice(0, 3), rayas: trabajo.map((p) => (distintos.indexOf(conMeta(p)) === 0 ? 1 : 0)) };
  }
  if (p0.sprints > 0) {
    const iguales = sinRepetir(trabajo.map(conMeta));
    const desc = sinRepetir(descansos.map((d) => d.texto));
    return {
      lineas: [
        iguales.length === 1 ? `${trabajo.length} × ${iguales[0]}` : iguales.join(' · '),
        [sinRepetir(trabajo.map((p) => p.texto?.split(' · ').slice(1).join(' · '))).join(' · '), desc.length ? `descanso ${desc.join(' o ')}` : null, p0.limiteSeg ? `en menos de ${p0.limiteSeg} seg` : null].filter(Boolean).join(' · '),
      ].filter(Boolean),
      rayas: trabajo.map(() => 1),
    };
  }
  if (p0.guiado) return { lineas: [p0.texto] };
  // Deporte (23 nov 2026): «3 veces por lado · 10 m · en 4 seg · descanso 30 seg».
  if (p0.deDeporte) {
    const desc = sinRepetir(descansos.map((d) => d.texto));
    return { lineas: [[`${trabajo.length} ${trabajo.length === 1 ? 'vez' : 'veces'}`, p0.termina?.texto, p0.texto, desc.length ? `descanso ${desc.join(' o ')}` : null].filter(Boolean).join(' · ')], rayas: trabajo.map(() => 1) };
  }
  if (trabajo.length > 1 || p0.pieza === 'tec') return { lineas: sinRepetir(trabajo.map((p) => `${p.nombre}${p.texto ? ` · ${p.texto}` : ''}`)).slice(0, 5) };
  return { lineas: [conMeta(p0) || p0.texto].filter(Boolean) };
}

export default function ListaDeLaSesion({ dia, color = LT.blue }) {
  const piezas = useMemo(() => {
    // Deporte arma sus pasos en el motor del entreno (`pasosDeLaSesion`); la lista (Running…), en `pasosDeLaLista`. Los mismos pasos que el entreno guiado.
    const { pasos } = dia.deporte?.items?.length && !dia.tramos?.length ? pasosDeLaSesion(dia) : pasosDeLaLista(dia);
    const porPieza = new Map();
    pasos.forEach((p) => { if (!porPieza.has(p.serie)) porPieza.set(p.serie, []); porPieza.get(p.serie).push(p); });
    return [...porPieza.values()].map((ps) => ({ nombre: ps[0].nombreDeLaPieza ?? ps[0].nombre, ...resumenDe(ps) }));
  }, [dia]);
  if (!piezas.length) return null;
  return (
    <div data-lista-de-la-sesion="" style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14, fontFamily: FONT }}>
      {piezas.map((pz, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '30px 1fr', gap: 10, background: LT.surface, borderRadius: 16, padding: '12px 14px', boxShadow: UI.sombraGrupo }}>
          <span aria-hidden="true" style={{ width: 28, height: 28, borderRadius: 14, background: `${color}1F`, color, fontWeight: 800, fontSize: 13.5, display: 'grid', placeItems: 'center' }}>{i + 1}</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: LT.text }}>{pz.nombre}</div>
            {pz.lineas.map((l) => <div key={l} style={{ fontSize: 14, fontWeight: 600, color: LT.text2, lineHeight: 1.4, marginTop: 2 }}>{l}</div>)}
            {pz.rayas?.length > 1 && (
              <div aria-hidden="true" style={{ display: 'flex', gap: 3, marginTop: 8 }}>
                {pz.rayas.slice(0, 30).map((v, k) => <span key={k} style={{ flex: 1, height: 12, borderRadius: 3, background: v ? color : `${color}55` }} />)}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
