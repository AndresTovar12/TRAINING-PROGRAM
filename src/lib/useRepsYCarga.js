import { useState } from 'react';
import { useConfirmacion } from '@/components/Confirmacion';
import { CARGAS, leeCantidad, componeCarga, cantidadDeCarga, tipoDeCargaAlEscribir, esCluster, repsDeCluster } from '@/lib/medidas';
import { vueltasDe, varian, filasParaEditar, parcheDeVueltas } from '@/lib/porVuelta';
import { esDistancia, esConteo, esTiempo } from '@/lib/medidas';
import { admite, arranqueDeLinea, cargasParaLinea, campoDe, llevaPesoDeFicha, topaCarga } from '@/lib/fichaDelEjercicio';
import { useAviso } from '@/components/AvisoPasajero';

const NADA_CAMBIA = { reps: false, intensity: false, alguno: false };
// Lo único que cabe en una cajita de número: cifras, coma o punto, y la raya de un rango.
const soloNumero = (texto) => texto.replace(/[^\d.,\-–]/g, '');
/* Lo que cabe en la casilla de cada tipo: un ritmo («4:34-5:00») admite los dos puntos; una zona es de una cifra
   o un rango de dos («2-3»), y nunca pasa del 5 que se puede escribir de un golpe. */
const cabeEnLaCasilla = (tipo, texto) => {
  if (tipo === 'ritmo' || tipo === 'nado') return texto.replace(/[^\d:\-–]/g, '');
  if (tipo === 'zona') return texto.replace(/[^\d\-–]/g, '').slice(0, 3);
  return soloNumero(texto);
};
const sinRayaSuelta = (texto) => texto.replace(/^[-–.,]+|[-–.,]+$/g, '');

/**
 * La cabeza de las casillas de reps y de carga de UN ejercicio en el editor: qué se ve y qué se guarda.
 * Las piezas que lo dibujan están en `components/RepsYCarga.jsx`; aquí no hay nada de pantalla.
 *
 * TRES ESTADOS, y por qué:
 *   · NORMAL. Una casilla de reps y una de carga, que valen para todas las vueltas del Set.
 *   · CERRADO CON VUELTAS DISTINTAS. Lo que cambia de una vuelta a otra dice «Varía»; lo que no cambia
 *     sigue siendo una casilla normal, y editarla vale para todas las vueltas.
 *   · DESPLEGADO («Por vuelta ▾»). Una fila por vuelta. Solo de ESTE ejercicio.
 *
 * Andrés, 5 oct 2026, sobre la primera maqueta (todo el Set desplegado a la vez): «imagínate una tri-serie
 * que se repite 4 veces, van a ser 12 filas. Sería mejor que se puedan desplegar». Por eso desplegar es un
 * estado de pantalla de cada ejercicio (no se guarda en el plan) y arranca cerrado.
 *
 * `tipoInicial`: con qué tipo de carga arranca la casilla mientras esté vacía (un lapso nuevo hereda el del anterior).
 *
 * `rondas`: cuántas veces se repite el Set, o `null` si este ejercicio no puede variar por vuelta (un Set
 * de una sola vuelta, un formato de reloj, un día de dos turnos). `abiertoDeEntrada`: en solo lectura no
 * se puede tocar nada, así que lo que varía se enseña ya desplegado.
 */
export function useRepsYCarga({ ex, onPatch, rondas = null, abiertoDeEntrada = false, tipoInicial = null, ficha = null, familia = 'libre', soloCardio = false, deLapso = false }) {
  const pregunta = useConfirmacion();
  const { avisa } = useAviso();
  const guardadas = vueltasDe(ex, rondas);
  const [abierto, setAbierto] = useState(() => abiertoDeEntrada && !!guardadas);
  // El tipo de carga elegido en la lista mientras la casilla está vacía: sin texto no hay de dónde deducirlo.
  // `tipoInicial`: el de la fila de arriba, para un lapso nuevo (mismo tipo de carga que el anterior, casilla vacía).
  const [elegido, setElegido] = useState(tipoInicial);
  // «+ Más» en la línea: muestra las casillas que la Disciplina guardó (Por lado, Por vuelta, Límite de tiempo). Solo de esta línea.
  const [masCampos, setMasCampos] = useState(false);

  const desplegado = abierto && !!rondas;
  const cambia = guardadas ? varian(guardadas) : NADA_CAMBIA;
  const filas = desplegado ? filasParaEditar(ex, rondas) : null;

  /* ---- Reps ---- */
  // La unidad y el «por lado» son del ejercicio entero, no de cada vuelta.
  const leida = leeCantidad(ex);
  // «10/lado» escrito a la antigua: al tocar el campo se guarda ya como casilla marcada, o el «/lado» se perdería.
  const fijaElLado = leida.porLado && ex?.porLado !== true ? { porLado: true } : null;
  const lee = (texto) => leeCantidad({ reps: texto, unidad: ex?.unidad, porLado: ex?.porLado });

  /** Lo que va en la casilla de reps de la vuelta `j` (`null` = la casilla única): `{ valor, libre }`. */
  const repsDe = (j) => {
    const texto = String((j === null ? ex?.reps : filas[j].reps) ?? '');
    const l = lee(texto);
    // Un «2+» a medias (se está tecleando un cluster) se enseña tal cual: `leeCantidad` se quedaba con el «2» y el «+» desaparecía, así que «2+2+2» quedaba «222» (auditoría p6).
    return { valor: l.libre || texto.includes('+') ? texto : l.cantidad, libre: l.libre };
  };

  // Guarda `cambios` en la vuelta `j`, o en todas a la vez si es la casilla única.
  const guarda = (j, cambios, extra = null) => {
    if (j !== null) {
      onPatch({ ...extra, ...parcheDeVueltas(filas.map((f, k) => (k === j ? { ...f, ...cambios } : f))) });
    } else if (guardadas) {
      onPatch({ ...extra, ...parcheDeVueltas(guardadas.map((f) => ({ ...f, ...cambios }))) });
    } else {
      onPatch({ ...cambios, ...extra });
    }
  };

  /* Escribir «2+2+2» en las reps vuelve cluster al ejercicio: así no hay que ir primero a la lista (Andrés, 8 oct 2026). */
  const escribeReps = (j, texto) => {
    const unidad = leida.unidad === 'reps' && esCluster(texto) ? 'cluster' : leida.unidad;
    guarda(j, { reps: texto }, { unidad, ...fijaElLado });
  };

  /* Al cambiar de unidad se guarda la cantidad LIMPIA: si venía «30 yd» y se pasa a metros, queda «30» con
     unidad metros. Un valor que no se entiende se respeta tal cual. */
  const cambiaUnidad = async (nueva) => {
    /* Salir de «Cluster» deja las reps de todo el cluster («2+2+2» → 6) y se lleva la pausa entre bloques: sin bloques no hay pausa. */
    const dejaElCluster = leida.unidad === 'cluster' && nueva !== 'cluster';
    const limpia = (texto) => {
      const crudo = String(texto ?? '');
      if (dejaElCluster && repsDeCluster(crudo) !== null) return String(repsDeCluster(crudo));
      const l = lee(crudo);
      return l.libre ? crudo : l.cantidad;
    };
    const extra = { unidad: nueva, ...(dejaElCluster ? { entreBloques: undefined } : null), ...fijaElLado };
    /* LA CADENA, AL CAMBIAR LA UNIDAD (9 nov 2026): con la casilla de carga VACÍA se recorre otra vez (ficha, unidad, Disciplina) y el tipo
       nuevo se guarda en la línea. Lo ESCRITO no se borra: se queda y, si ya no va con la unidad, se señala (ver `noVa`). */
    if (!escritos.length) {
      setElegido(null);
      extra.cargaTipo = nueva === 'nada' ? 'nada' : (arranqueDeLinea(ficha, familia, nueva).tipo ?? undefined);
    }
    // «Nada, solo hacerlo»: un estiramiento no se cuenta ni lleva carga. Si ya había algo escrito, se pregunta antes de quitarlo.
    if (nueva === 'nada') {
      const hayAlgo = !!String(ex?.reps ?? '').trim() || escritos.length > 0 || !!guardadas;
      if (hayAlgo) {
        const ok = await pregunta({
          titulo: '¿Dejarlo en «solo hacerlo»?',
          detalle: 'Se quitan la cantidad y la carga que ya tiene esta línea. Lo puedes deshacer con la flecha de arriba.',
          confirmar: 'Sí, dejarlo así',
        });
        if (!ok) return;
      }
      onPatch({ ...extra, cargaTipo: 'nada', reps: '', intensity: '', porVuelta: undefined, porLado: undefined, enMenosDe: undefined });
      return;
    }
    if (guardadas) onPatch({ ...extra, ...parcheDeVueltas(guardadas.map((f) => ({ ...f, reps: limpia(f.reps) }))) });
    else onPatch({ reps: limpia(ex?.reps), ...extra });
  };

  /* La casilla «Por lado». Al tocarla, el «/lado» que viniera escrito en el texto se quita: desde ese
     momento manda la casilla, y un texto que la contradiga sería un dato doble. */
  const ponLado = (marcado) => {
    const reps = guardadas || leida.libre ? null : { reps: leida.cantidad };
    onPatch({ ...reps, porLado: marcado ? true : undefined });
  };

  /* ---- Carga ---- */
  const textos = (filas ?? guardadas ?? [{ intensity: ex?.intensity }]).map((f) => String(f.intensity ?? '').trim());
  const escritos = textos.filter(Boolean);
  const tipos = new Set(escritos.map(tipoDeCargaAlEscribir));
  // El tipo que dicen los textos: uno solo y conocido. Con vueltas de tipos mezclados, o texto libre, ninguno.
  const delTexto = escritos.length > 0 && tipos.size === 1 ? [...tipos][0] : null;
  const hayLibre = escritos.length > 0 && delTexto === null;
  /* QUIÉN MANDA (8 nov 2026, ver `lib/fichaDelEjercicio.js`): con la casilla vacía, el tipo con que arranca sale de la ficha del ejercicio
     y, si la ficha no dice, del Enfoque de la sesión. Lo escrito siempre manda sobre eso. ¿Anota kilos? Lo que diga la línea (planes de
     antes), si no, su ficha. */
  const llevaPeso = ex?.carga === true || ex?.carga === 'si' ? true : ex?.carga === false || ex?.carga === 'no' ? false : llevaPesoDeFicha(ficha);
  const cargas = cargasParaLinea({ unidad: leida.unidad, ficha, familia, llevaPeso });
  // En «Intervalos de cardio» solo van las de cardio (y Kilos si el ejercicio lleva peso: el sled, el farmer).
  if (soloCardio) {
    const deCardio = ['ritmo', 'zona', 'w', 'nado', 'rpe', ...(llevaPeso !== false ? ['kg'] : [])];
    cargas.vis = cargas.vis.filter((c) => deCardio.includes(c));
    cargas.mas = [];
  }
  /* CADA COSA NACE UNA VEZ (9 nov 2026): el tipo de la casilla vacía se GUARDA en la línea (`cargaTipo`) cuando nace o cuando el coach lo
     elige. Así cambiar la Disciplina, o editar la ficha después, no mueve lo que ya está puesto. Una línea de antes, sin ese dato, queda
     como siempre («Carga», texto libre). Solo los lapsos (que no guardan ese dato por fila) lo calculan al vuelo. */
  const alVuelo = () => {
    if (leida.unidad === 'nada') return 'nada';
    const a = arranqueDeLinea(ficha, familia, leida.unidad);
    if (!a.tipo) return null;
    if (cargas.vis.includes(a.tipo) || a.tipo === 'nada') return a.tipo;
    return cargas.vis[0] ?? null;
  };
  const guardado = leida.unidad === 'nada' ? 'nada' : (!deLapso && typeof ex?.cargaTipo === 'string' ? ex.cargaTipo : null);
  const porDefecto = guardado === 'libre' ? null : (guardado ?? (deLapso ? alVuelo() : null));
  const tipo = elegido === 'libre' || hayLibre ? null : (delTexto ?? elegido ?? porDefecto);
  // «Nada» en la carga solo se ofrece cuando ya lo es (lo dijo la ficha al nacer la línea); en la línea, una casilla vacía ya es «sin carga».
  const conNada = porDefecto === 'nada';
  // Lo escrito ya no va con la unidad («5 km» con «80 %»): no se borra, se señala.
  const noVa = escritos.length > 0 && !!tipo && tipo !== 'nada' && leida.unidad !== 'nada' && !admite(leida.unidad, tipo);
  const info = CARGAS.find((c) => c.id === tipo) ?? null;

  const textoDeCarga = (j) => String((j === null ? ex?.intensity : filas[j].intensity) ?? '');
  /** Lo que va en la casilla de carga de la vuelta `j` (`null` = la casilla única). */
  const cargaDe = (j) => (tipo ? cantidadDeCarga(tipo, textoDeCarga(j).trim()) : textoDeCarga(j));
  const escribeCarga = (j, texto) => guarda(j, { intensity: tipo ? componeCarga(tipo, cabeEnLaCasilla(tipo, texto)) : texto });
  // Al salir del campo se limpia un rango que se quedó a medias («7-»): mientras se teclea tiene que poder existir.
  const alSalirDeCarga = (j) => {
    if (!tipo) return;
    const valor = cargaDe(j);
    let limpio = sinRayaSuelta(valor);
    // Los topes (RPE 1 a 10, RIR 0 a 5, Zona 1 a 5, % del 1RM hasta 120): no es esconder, es no dejar pasar lo imposible.
    const { texto: topado, aviso } = topaCarga(tipo, limpio);
    if (aviso) { limpio = topado; avisa(aviso); }
    if (limpio !== valor) escribeCarga(j, limpio);
  };

  /* Un 75 de porcentaje no es un 75 de RPE: al cambiar de tipo el número no se traspasa. Con números se
     borran sin más (se vuelven a teclear en dos segundos); con TEXTO LIBRE se pregunta antes, porque
     puede ser lo más elaborado que escribió el coach. */
  // Lo que el coach elige se guarda en la línea, aunque la casilla esté vacía (pregunta 4 de la cadena).
  const recuerda = (nuevo) => { setElegido(nuevo); if (ex?.cargaTipo !== nuevo) onPatch({ cargaTipo: nuevo }); };
  const elegirTipo = async (nuevo) => {
    if (nuevo === 'libre') { recuerda('libre'); return; }
    if (nuevo === tipo) { recuerda(nuevo); return; }
    // Lo escrito ya es de ese tipo (venía de «Texto libre»): solo cambia cómo se ve, no hay nada que borrar.
    if (nuevo === delTexto) { recuerda(nuevo); return; }
    if (hayLibre) {
      const ok = await pregunta({
        titulo: '¿Cambiar la carga?',
        detalle: escritos.length === 1
          ? `Lo que dice ahora, «${escritos[0]}», se borra: ya no sería un solo número.`
          : 'Lo escrito en las vueltas se borra: ya no sería un solo número.',
        confirmar: 'Sí, cambiarla',
        peligro: true,
      });
      if (!ok) return;
    }
    if (escritos.length) {
      if (guardadas) onPatch({ cargaTipo: nuevo, ...parcheDeVueltas(guardadas.map((f) => ({ ...f, intensity: '' }))) });
      else onPatch({ cargaTipo: nuevo, intensity: '' });
      setElegido(nuevo);
      return;
    }
    recuerda(nuevo);
  };

  /* ---- Por vuelta ---- */
  const alternar = () => setAbierto(!desplegado);
  const dejarIguales = async () => {
    const ok = await pregunta({
      titulo: '¿Dejar todas las vueltas iguales?',
      detalle: 'Se quedan las reps y la carga de la vuelta 1.',
      confirmar: 'Sí, dejarlas iguales',
    });
    if (!ok) return;
    // `reps` e `intensity` ya llevan lo de la primera vuelta: basta con quitar la lista.
    onPatch({ porVuelta: undefined });
    setAbierto(false);
  };

  return {
    puedeVariar: !!rondas, desplegado, filas, hayVueltas: !!guardadas, cambia, alternar, dejarIguales,
    unidad: leida.unidad, porLado: leida.porLado, repsDe, escribeReps, cambiaUnidad, ponLado,
    // La pausa entre los bloques de un cluster, en segundos («15» o un rango «15-30»).
    cluster: leida.unidad === 'cluster', entreBloques: String(ex?.entreBloques ?? ''),
    ponEntreBloques: (texto) => onPatch({ entreBloques: soloNumero(texto) || undefined }),
    tipo, info, cargaDe, escribeCarga, alSalirDeCarga, elegirTipo,
    // Qué cargas van a la vista y cuáles en «Más opciones» (ver `cargasParaLinea`).
    cargas, conNada, noVa,
    // «Por lado» solo con reps, segundos o minutos (regla 7) y si la Disciplina lo deja a la vista; si ya venía marcado, se queda para poder quitarlo.
    conLado: leida.porLado || ((esConteo(leida.unidad) || esTiempo(leida.unidad)) && leida.unidad !== 'nada' && (campoDe(familia, 'lado') === 'ver' || masCampos)),
    // «Por vuelta», igual: la Disciplina lo puede guardar detrás de «+ Más» (si ya hay vueltas distintas, se queda).
    conVuelta: !!rondas && (!!guardadas || campoDe(familia, 'vuelta') === 'ver' || masCampos),
    /* «En menos de» (8 nov 2026): un tope de tiempo aparte de la carga, para distancia o reps. El farmer carry queda «100 m · 20 kg · en
       menos de 40 s». En kilómetros va en minutos; en lo demás, en segundos. */
    conEnMenosDe: (esDistancia(leida.unidad) || esConteo(leida.unidad)) && leida.unidad !== 'nada',
    // ¿Se ve «Límite de tiempo»? Si aplica y la Disciplina lo deja a la vista, o ya trae algo, o se abrió «+ Más».
    verLimite: (esDistancia(leida.unidad) || esConteo(leida.unidad)) && leida.unidad !== 'nada'
      && (campoDe(familia, 'limite') === 'ver' || !!String(ex?.enMenosDe ?? '').trim() || masCampos),
    // En «Intervalos de cardio» solo se mide distancia o tiempo.
    medidas: soloCardio ? ['m', 'km', 'yd', 'seg', 'min'] : null,
    enMenosDe: String(ex?.enMenosDe ?? ''),
    unidadEnMenosDe: leida.unidad === 'km' ? 'min' : 's',
    ponEnMenosDe: (texto) => onPatch({ enMenosDe: soloNumero(texto) || undefined }),
    // Lo que la Disciplina guardó en esta línea y se puede sacar con «+ Más».
    hayGuardados: !masCampos && (
      (campoDe(familia, 'lado') === 'mas' && !leida.porLado && (esConteo(leida.unidad) || esTiempo(leida.unidad)) && leida.unidad !== 'nada')
      || (campoDe(familia, 'vuelta') === 'mas' && !!rondas && !guardadas)
      || (campoDe(familia, 'limite') === 'mas' && (esDistancia(leida.unidad) || esConteo(leida.unidad)) && leida.unidad !== 'nada' && !String(ex?.enMenosDe ?? '').trim())
    ),
    abreMas: () => setMasCampos(true),
  };
}
