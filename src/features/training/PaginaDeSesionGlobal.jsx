import { useEffect, useMemo, useState } from 'react';
import { ComoPrograma, usePlan } from '@/contexts/PlanContext';
import { useEstadoOpcional } from '@/contexts/AppStateContext';
import { usePerfilDeLaVista } from '@/contexts/VistaContext';
import { AVISO_ABRE_SESION } from '@/lib/abreSesionHecha';
import { aspectoDelTipo, tipoParaStickers } from '@/lib/aspectoDelTipo';
import { diaDeLaSesion, programaDelAlmacen } from '@/lib/entrenosDelPlan';
import { sinDuracion } from '@/lib/sesiones';
import ResumenDeSesion from './ResumenDeSesion';

/* LA PÁGINA DE UN WORKOUT DEL PLAN, abierta desde cualquier lado (fase 6, 29 oct 2026): escucha `abreSesionHecha` (ver `lib/abreSesionHecha.js`), busca la sesión
   en lo guardado de la cuenta, su programa y su día, y abre `ResumenDeSesion` dentro de ese programa (así el récord se compara con lo que levantó en ESE plan).
   Va montada una vez en la app del atleta (`TrainingApp`). `alVerEnElPlan(programa, lugar)`: lleva al día en Entrenar (`lugar`: lo de `diaDeLaSesion`). */

/** Lo guardado de una sesión: `id` con `#n` es la vez número n de antes (`anteriores`, ver `archivaLoHecho`). */
function registroDe(estado, almacen, id) {
  const [base, vez] = String(id ?? '').split('#');
  const actual = estado?.[almacen]?.[base];
  if (!vez) return actual ?? null;
  return Array.isArray(actual?.anteriores) ? actual.anteriores[Number(vez) - 1] ?? null : null;
}

export default function PaginaDeSesionGlobal({ alVerEnElPlan }) {
  const [pedido, setPedido] = useState(null); // { almacen, id, recien, stickers }
  useEffect(() => {
    const alPedir = (e) => setPedido(e.detail ?? null);
    window.addEventListener(AVISO_ABRE_SESION, alPedir);
    return () => window.removeEventListener(AVISO_ABRE_SESION, alPedir);
  }, []);
  const estado = useEstadoOpcional();
  const { programas } = usePlan();
  const { perfil, userId } = usePerfilDeLaVista();
  const registro = pedido ? registroDe(estado, pedido.almacen, pedido.id) : null;
  const programa = useMemo(() => (pedido ? programaDelAlmacen(programas, pedido.almacen) : null), [pedido, programas]);
  const lugar = useMemo(() => (pedido && programa ? diaDeLaSesion(programa, pedido.id) : null), [pedido, programa]);
  if (!pedido || !registro) return null;

  const dia = lugar?.dia ?? null;
  const delRegistro = typeof registro.entreno?.nombre === 'string' ? sinDuracion(registro.entreno.nombre) : '';
  const nombre = (dia ? sinDuracion(dia.name || '') : '') || delRegistro || 'Tu sesión';
  const cerrar = () => setPedido(null);
  const pagina = (
    <ResumenDeSesion
      // Una página por sesión: abrir otra empieza de cero (lo leído del reloj, el aviso).
      key={`${pedido.almacen}:${pedido.id}:${pedido.recien ? 1 : 0}`}
      atletaId={userId} registro={registro} sesionId={pedido.id} nombre={nombre} dia={dia}
      tipo={dia ? tipoParaStickers(dia) : null} color={dia ? aspectoDelTipo(dia).color : null}
      coachId={programa?.profesionalId ?? null} unidadPeso={perfil?.unidad_peso || 'kg'}
      recien={!!pedido.recien} conStickers={!!pedido.stickers} alCerrar={cerrar}
      alVerEnElPlan={lugar && alVerEnElPlan ? () => { cerrar(); alVerEnElPlan(programa, lugar); } : null}
    />
  );
  return programa ? <ComoPrograma programa={programa}>{pagina}</ComoPrograma> : pagina;
}
