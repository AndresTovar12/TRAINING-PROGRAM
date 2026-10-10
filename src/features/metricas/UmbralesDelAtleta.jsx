import { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { LT, KP, FONT, NUM_STYLE, eyebrow } from '@/lib/theme';
import { useAuth } from '@/contexts/AuthContext';
import { guardaUmbrales, recalculaTodo } from '@/lib/metricasApi';
import { ZONAS, limitesDeZonas } from '@/lib/metricas/calculos';
import { COLORES_DE_ZONA } from './graficasUtil';
import { Boton, Tarjeta } from './Piezas';

/* LOS UMBRALES: el pulso máximo, de reposo y de umbral con los que se pintan las zonas y se calcula la carga. Si nadie los escribe, se estiman (de la edad, del
   pulso más alto que se le ha visto y de su pulso en reposo) y la pantalla dice de dónde salió cada uno. Al guardar, se vuelven a contar TODOS sus entrenos. */

const ORIGEN = { escrito: 'escrito', visto: 'el más alto que se le ha visto', edad: 'estimado por su edad', medido: 'medido en reposo', estimado: 'estimado del máximo', 'por defecto': 'valor por defecto (falta su edad y sus entrenos)' };

function Campo({ id, titulo, ayuda, valor, onChange, sugerido, origen, minimo, maximo }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label htmlFor={id} style={{ display: 'block', fontSize: 14.5, fontWeight: 800, color: LT.text, marginBottom: 6 }}>{titulo}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <input
          id={id} type="number" inputMode="numeric" min={minimo} max={maximo} value={valor} placeholder={String(sugerido)} onChange={(e) => onChange(e.target.value)}
          style={{ width: 120, height: 48, borderRadius: 14, border: `1.5px solid ${LT.borderHi}`, background: LT.surface, padding: '0 14px', fontFamily: FONT, fontSize: 18, fontWeight: 800, color: LT.text, ...NUM_STYLE }}
        />
        <span style={{ fontSize: 13.5, fontWeight: 600, color: LT.text2 }}>lpm</span>
      </div>
      <div style={{ marginTop: 6, fontSize: 12.5, fontWeight: 500, color: LT.text2, lineHeight: 1.45 }}>
        {valor === '' ? `Ahora usa ${sugerido} (${origen}). ` : ''}{ayuda}
      </div>
    </div>
  );
}

export default function UmbralesDelAtleta({ atletaId, umbrales, escritos, alGuardar, alCancelar }) {
  const { user } = useAuth();
  const [max, setMax] = useState(escritos?.fc_max ? String(escritos.fc_max) : '');
  const [reposo, setReposo] = useState(escritos?.fc_reposo ? String(escritos.fc_reposo) : '');
  const [umbral, setUmbral] = useState(escritos?.fc_umbral ? String(escritos.fc_umbral) : '');
  const [estado, setEstado] = useState({ guardando: false, avance: 0, error: null });

  const num = (t) => (t === '' ? null : Number.parseInt(t, 10));
  const m = num(max);
  const r = num(reposo);
  const u = num(umbral);
  const error = useMemo(() => {
    if (m !== null && (m < 100 || m > 250)) return 'El pulso máximo tiene que estar entre 100 y 250.';
    if (r !== null && (r < 25 || r > 120)) return 'El pulso en reposo tiene que estar entre 25 y 120.';
    if (u !== null && (u < 80 || u > 230)) return 'El pulso de umbral tiene que estar entre 80 y 230.';
    const fm = m ?? umbrales.fc_max;
    if ((u ?? 0) >= fm) return 'El pulso de umbral tiene que ser menor que el máximo.';
    if ((r ?? 0) >= fm - 20) return 'El pulso en reposo tiene que ser mucho menor que el máximo.';
    return null;
  }, [m, r, u, umbrales.fc_max]);
  const limites = limitesDeZonas(m ?? umbrales.fc_max);

  async function guarda() {
    setEstado({ guardando: true, avance: 0, error: null });
    try {
      await guardaUmbrales(atletaId, { fc_max: m, fc_reposo: r, fc_umbral: u }, user?.id);
      const n = await recalculaTodo(atletaId, { alAvance: (a) => setEstado((s) => ({ ...s, avance: a.total ? a.hechos / a.total : 1 })) });
      alGuardar(n);
    } catch (e) {
      setEstado({ guardando: false, avance: 0, error: e?.message ?? 'No se pudo guardar' });
    }
  }

  return (
    <Tarjeta style={{ marginTop: 6 }}>
      <div style={eyebrow(LT.text2)}>Umbrales de pulso</div>
      <div style={{ fontSize: 14.5, lineHeight: 1.5, fontWeight: 500, color: LT.text, margin: '8px 0 18px' }}>
        Con estos tres números se pintan las zonas y se calcula la carga de cada entreno. Déjalos vacíos para que se estimen solos; escríbelos si se los midieron.
      </div>
      <Campo id="fc-max" titulo="Pulso máximo" valor={max} onChange={setMax} sugerido={umbrales.fc_max} origen={ORIGEN[umbrales.metodo.fc_max]} minimo={100} maximo={250} ayuda="El más alto que ha llegado a tener, en una prueba de esfuerzo o en una carrera." />
      <Campo id="fc-reposo" titulo="Pulso en reposo" valor={reposo} onChange={setReposo} sugerido={umbrales.fc_reposo} origen={ORIGEN[umbrales.metodo.fc_reposo]} minimo={25} maximo={120} ayuda="El pulso al despertar, antes de levantarse." />
      <Campo id="fc-umbral" titulo="Pulso de umbral" valor={umbral} onChange={setUmbral} sugerido={umbrales.fc_umbral} origen={ORIGEN[umbrales.metodo.fc_umbral]} minimo={80} maximo={230} ayuda="El pulso más alto que puede sostener casi una hora (se mide con una prueba de 30 min a tope)." />

      <div style={{ ...eyebrow(LT.text2), margin: '4px 0 8px' }}>Así quedan las zonas</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 18 }}>
        {ZONAS.map((z, i) => (
          <div key={z.z} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13.5, fontWeight: 600, color: LT.text, ...NUM_STYLE }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: COLORES_DE_ZONA[i], flexShrink: 0 }} />
            <span style={{ width: 24, fontWeight: 800 }}>Z{z.z}</span>
            <span style={{ flex: 1 }}>{z.nombre}</span>
            <span style={{ fontWeight: 800 }}>{i === 0 ? `menos de ${limites[0]}` : i === 4 ? `más de ${limites[3]}` : `${limites[i - 1]} a ${limites[i]}`} lpm</span>
          </div>
        ))}
      </div>

      {(error || estado.error) && <div role="alert" style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 12, background: KP.dangerSoft, color: KP.danger, fontSize: 13.5, fontWeight: 700 }}>{error ?? estado.error}</div>}
      {estado.guardando ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14.5, fontWeight: 700, color: LT.text }}><Loader2 size={18} className="spin" color={LT.blue} /> Volviendo a contar sus entrenos… {Math.round(estado.avance * 100)} %</div>
      ) : (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Boton principal disabled={!!error} onClick={guarda}>Guardar y recalcular</Boton>
          <Boton onClick={alCancelar}>Cancelar</Boton>
        </div>
      )}
    </Tarjeta>
  );
}
