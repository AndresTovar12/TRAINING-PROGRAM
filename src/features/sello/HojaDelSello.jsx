import { useEffect, useRef, useState } from 'react';
import { Activity } from 'lucide-react';
import HojaFlotante from '@/components/HojaFlotante';
import { cargaSellosDeSesion } from '@/lib/sello/carga';
import { Cargando, EstadoVacio } from '@/features/metricas/Piezas';
import EditorDelSello from '@/features/sello/EditorDelSello';

/* LA HOJA DEL SELLO de una sesión guiada: la que se abre desde el final del entreno y desde el día en el plan. Busca los datos (con reloj o sin él, ver
   `lib/sello/carga.js`) y enseña el editor. Desde «Mis métricas» no se usa: ahí el detalle del entreno ya tiene sus datos y pone el editor adentro.

   `registro` se lee UNA vez al abrir: mientras la hoja está abierta, el registro del entreno puede seguir cambiando y no hay que volver a buscar el reloj cada vez. */
export default function HojaDelSello({ atletaId, registro, sesionId, nombre, Icono, unidadPeso = 'kg', onCerrar }) {
  const [estado, setEstado] = useState({ cargando: true, sellos: [] });
  const inicial = useRef({ atletaId, registro, sesionId, nombre, unidadPeso });

  useEffect(() => {
    let vivo = true;
    cargaSellosDeSesion(inicial.current)
      .then((r) => { if (vivo) setEstado({ cargando: false, sellos: r.sellos }); })
      .catch(() => { if (vivo) setEstado({ cargando: false, sellos: [] }); });
    return () => { vivo = false; };
  }, []);

  return (
    <HojaFlotante titulo="Sello" onCerrar={onCerrar} ancho={560}>
      {estado.cargando && <Cargando texto="Armando tu sello…" />}
      {!estado.cargando && estado.sellos.length === 0 && (
        <EstadoVacio icono={Activity} titulo="Todavía no hay nada que contar" texto="Haz algún ejercicio con el entreno guiado y aquí aparecerá el sello de tu sesión." />
      )}
      {!estado.cargando && estado.sellos.length > 0 && <EditorDelSello sellos={estado.sellos} Icono={Icono} />}
    </HojaFlotante>
  );
}
