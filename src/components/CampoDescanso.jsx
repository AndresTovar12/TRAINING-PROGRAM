import { useState } from 'react';
import ListaDesplegable from '@/components/ListaDesplegable';
import { useConfirmacion } from '@/components/Confirmacion';
import { estiloDeRotulo } from '@/components/estiloDeRotulo';
import { DESCANSOS, unidadDeDescansoAlEscribir, componeDescanso, cantidadDeDescanso } from '@/lib/medidas';

/**
 * El descanso de un ejercicio: un número, y si son segundos o minutos.
 *
 * Andrés, 5 oct 2026: «la casilla de descanso también quiero que la hagas como lista desplegable de minutos
 * o segundos». Igual que las reps y la carga, la lista está en el rótulo («DESCANSO · SEG ▾») y la casilla
 * lleva solo el número.
 *
 * NO HAY UN CAMPO NUEVO. Se sigue guardando un texto (`ex.descanso`: «90 seg», «2 min»), que es justo lo
 * que lee el atleta («Descansa 90 seg entre cada serie»), y la unidad se deduce de él. Lo que no encaja
 * —«Recuperación total», «3-4 min (completa)»— se queda como «Texto libre» y se enseña tal cual.
 *
 * CON LA CASILLA VACÍA no hay texto del que deducir la unidad: vale la última que eligió este coach
 * (se recuerda en este dispositivo), porque quien programa fuerza piensa en minutos y quien programa
 * circuitos, en segundos.
 *
 * AL CAMBIAR DE UNIDAD EL NÚMERO SE QUEDA («2 seg» → «2 min»): quien cambia la lista casi siempre está
 * corrigiendo la unidad de un número que ya escribió, no pidiendo que se le convierta.
 */
const LLAVE = 'tl:descanso:unidad';
// Se lee del dispositivo una vez y se guarda aquí: así todos los descansos vacíos de la pantalla siguen a la
// última unidad elegida en cuanto se vuelven a dibujar, no solo el que se tocó.
let ultima = null;
const recordada = () => {
  if (ultima === null) {
    try { ultima = window.localStorage.getItem(LLAVE) === 'min' ? 'min' : 'seg'; } catch { ultima = 'seg'; }
  }
  return ultima;
};
const recuerda = (unidad) => {
  ultima = unidad;
  try { window.localStorage.setItem(LLAVE, unidad); } catch { /* sin almacenamiento: vale mientras dure la visita */ }
};

const soloNumero = (texto) => texto.replace(/[^\d.,\-–]/g, '');
const sinRayaSuelta = (texto) => texto.replace(/^[-–.,]+|[-–.,]+$/g, '');

export default function CampoDescanso({ ex, onPatch, estiloInput, compacto = false, ancho }) {
  const pregunta = useConfirmacion();
  // Lo elegido en la lista durante esta visita: `null` mientras no se toque.
  const [elegida, setElegida] = useState(null);

  const crudo = String(ex?.descanso ?? '').trim();
  const delTexto = unidadDeDescansoAlEscribir(crudo);
  const esLibre = !!crudo && delTexto === null;
  const unidad = elegida === 'libre' || esLibre ? null : (delTexto ?? elegida ?? recordada());

  const alElegir = async (nueva) => {
    if (nueva === 'libre') { setElegida('libre'); return; }
    recuerda(nueva);
    if (nueva === unidad) { setElegida(nueva); return; }
    if (esLibre) {
      const ok = await pregunta({
        titulo: '¿Cambiar el descanso?',
        detalle: `Lo que dice ahora, «${crudo}», se borra: ya no sería un solo número.`,
        confirmar: 'Sí, cambiarlo',
        peligro: true,
      });
      if (!ok) return;
      onPatch({ descanso: '' });
    } else if (crudo) {
      // Venía de «Texto libre» con algo como «90 seg», o de la otra unidad: el número se queda.
      onPatch({ descanso: componeDescanso(nueva, cantidadDeDescanso(delTexto, crudo)) });
    }
    setElegida(nueva);
  };

  const valor = unidad ? cantidadDeDescanso(unidad, crudo) : (ex?.descanso ?? '');
  const escribe = (texto) => onPatch({ descanso: unidad ? componeDescanso(unidad, soloNumero(texto)) : texto });
  // Un rango a medias («60-») tiene que poder existir mientras se teclea; al salir del campo se limpia.
  const alSalir = () => {
    if (unidad && sinRayaSuelta(valor) !== valor) escribe(sinRayaSuelta(valor));
  };

  const opciones = [
    ...DESCANSOS.map((d) => ({ valor: d.id, etiqueta: d.etiqueta, corta: `Descanso · ${d.corta}` })),
    { valor: 'libre', etiqueta: 'Texto libre', corta: 'Descanso', detalle: 'Escribe lo que quieras: «Recuperación total»' },
  ];

  // Mismo reparto que las demás casillas: el borde en la caja, el espaciado en el input de dentro.
  const {
    padding, width: _ancho,
    paddingLeft: _pl, paddingRight: _pr, paddingTop: _pt, paddingBottom: _pb,
    ...caja
  } = estiloInput ?? {};

  return (
    <div style={{ minWidth: 0, width: ancho }}>
      <ListaDesplegable
        etiqueta="El descanso, en segundos o minutos"
        valor={unidad ?? 'libre'}
        onCambio={alElegir}
        opciones={opciones}
        alto={200}
        anchoMinimo={230}
        estilo={estiloDeRotulo(compacto)}
      />
      <div style={{ display: 'flex', alignItems: 'center', width: '100%', boxSizing: 'border-box', ...caja }}>
        <input
          value={valor}
          onChange={(e) => escribe(e.target.value)}
          onBlur={alSalir}
          inputMode={unidad ? 'decimal' : 'text'}
          aria-label={unidad ? `Descanso en ${unidad === 'min' ? 'minutos' : 'segundos'}` : 'Descanso'}
          size={1}
          style={{
            flex: 1, width: 0, minWidth: 0, border: 'none', background: 'transparent',
            outline: 'none', padding: padding ?? '7px 9px', font: 'inherit', color: 'inherit',
          }}
        />
      </div>
    </div>
  );
}
