import ListaDesplegable from '@/components/ListaDesplegable';
import { UI, T, FONT } from '@/lib/theme';
import { EQUIPOS, MEDIDAS_DE_FICHA, CARGAS_DE_FICHA, VACIA, DEJAR_VACIA, AYUDA_VACIA, cargasParaFicha, equipoPesa } from '@/lib/fichaDelEjercicio';

const lineaGris = { padding: '0 16px 10px', fontFamily: FONT, fontSize: 12.5, fontWeight: 600, color: T.text3, lineHeight: 1.35 };
const QUITAR = '__vacia';

/** Debajo del equipo: lo que se deduce de él (si el atleta anota kilos). Lo usan las dos fichas: la de aquí y la del repertorio. */
export function LineaDelPeso({ equipo }) {
  if (!String(equipo ?? '').trim()) return null;
  const pesa = equipoPesa(equipo);
  return (
    <div style={{ ...lineaGris, marginTop: -2 }}>
      {pesa === true && `Con ${equipo.toLowerCase()} el atleta anota los kilos que usó.`}
      {pesa === false && 'Sin equipo que pese: el atleta no anota kilos. Para una versión con lastre, crea otro ejercicio.'}
      {pesa === null && 'Con este equipo el atleta anota kilos si la carga es Kilos o % del 1RM.'}
    </div>
  );
}

/**
 * Unidad · Peso o intensidad (8 nov 2026), como renglones de la ficha. Vacías («Selecciona…», como «Equipo» o «Músculo») = se eligen en cada
 * plan; mientras alguna esté vacía, una línea gris lo dice. Las reglas viven en `lib/fichaDelEjercicio.js`:
 *   · la Unidad ordena «Peso o intensidad»; lo raro va en «Más opciones»;
 *   · el equipo decide si se ofrecen kilos;
 *   · «Nada, solo hacerlo» deja el peso en «Nada».
 * `valor`: `{ equipment, medida, carga_tipo }`. `onCambio(parche)`. `conEquipo`: dibuja también el renglón del equipo (el «Ejercicio nuevo» del
 * editor); el formulario del repertorio dibuja el suyo, con «Otro». `sinCaja`: solo los renglones, para ir dentro de otro grupo.
 */
export default function FilasDeLaFicha({ valor, onCambio, conEquipo = false, sinCaja = false, soloEquipo = false }) {
  const { equipment = '', medida = null, carga_tipo: carga = null } = valor;
  const poneEquipo = (v) => onCambio({ equipment: v, carga_tipo: equipoPesa(v) === false && ['kg', 'pct'].includes(carga) ? null : carga });
  const poneMedida = (v) => {
    const m = v === QUITAR ? null : v;
    let c = carga;
    if (m === 'nada') c = 'nada';
    else if (c === 'nada') c = null;
    else if (c && m) { const { vis, mas } = cargasParaFicha({ medida: m, equipo: equipment }); if (!vis.includes(c) && !mas.includes(c)) c = null; }
    onCambio({ medida: m, carga_tipo: c });
  };
  const { vis, mas } = cargasParaFicha({ medida, equipo: equipment });
  const op = (c) => ({ valor: c, etiqueta: CARGAS_DE_FICHA[c] });
  const vaciar = { valor: QUITAR, etiqueta: DEJAR_VACIA, detalle: 'Se elige en cada plan' };
  const filas = (
    <>
      {conEquipo && (
        <ListaDesplegable
          rotulo="Equipo" etiqueta="Equipo" marcador={VACIA} valor={equipment} onCambio={poneEquipo}
          opciones={EQUIPOS.map((e) => ({ valor: e, etiqueta: e }))}
        />
      )}
      {conEquipo && <LineaDelPeso equipo={equipment} />}
      {!soloEquipo && (<>
      <ListaDesplegable
        rotulo="Unidad" etiqueta="Unidad" marcador={VACIA} valor={medida ?? ''} onCambio={poneMedida}
        opciones={[...MEDIDAS_DE_FICHA, ...(medida ? [vaciar] : [])]}
      />
      <ListaDesplegable
        rotulo="Peso o intensidad" etiqueta="Peso o intensidad" marcador={VACIA} valor={carga ?? ''} anchoMinimo={240}
        onCambio={(v) => onCambio({ carga_tipo: v === QUITAR ? null : v })}
        grupos={medida === 'nada'
          ? [{ titulo: 'Sin nada que medir', opciones: [op('nada')] }]
          : [
              { titulo: medida ? 'Primero lo más común para este ejercicio' : 'Elige primero la Unidad y te lo ordeno', opciones: [...vis.map(op), op('nada'), ...(carga ? [vaciar] : [])] },
              ...(mas.length ? [{ titulo: 'Más opciones', opciones: mas.map(op) }] : []),
            ]}
      />
      {(!medida || !carga) && <div style={{ ...lineaGris, paddingTop: 8 }}>{AYUDA_VACIA}</div>}
      </>)}
    </>
  );
  if (sinCaja) return filas;
  return (
    <div className="grupo-renglones" style={{ background: UI.tarjeta, borderRadius: UI.rGrupo, boxShadow: UI.sombraGrupo, overflow: 'hidden' }}>
      {filas}
    </div>
  );
}
