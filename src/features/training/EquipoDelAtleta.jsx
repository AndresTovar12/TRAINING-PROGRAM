import { FONT, LT } from '@/lib/theme';
import { etiquetaDePrograma } from '@/lib/programas';
import ListaDesplegable from '@/components/ListaDesplegable';

/* Lo que ve un atleta que tiene EQUIPO: su coach principal y, además, alguien
   más (un fisio…) que le puso sesiones. Sin equipo nada de esto sale y la app es
   la de siempre.

   Para el atleta el programa es UNO SOLO, con varias personas que le ponen
   cosas. Andrés, 1 oct 2026: nada de pestañas por profesional —«no por lo
   visual, sino por lo que representa»—; las sesiones de todos van juntas, cada
   una dice de quién viene, y un filtro deja ver solo lo de uno si se quiere. */

/** «● Beto · coach»: de quién viene algo, con su color. Con `programa.mostrarTitulo` (dos programas de la MISMA persona en el mismo día) dice también cuál: «● Beto · coach · Plan 10K». */
export function EtiquetaDeAutor({ programa, tamano = 12, style }) {
  const color = programa?.color ?? LT.blue;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: FONT,
      fontSize: tamano, fontWeight: 800, color, ...style,
    }}>
      <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
      {etiquetaDePrograma(programa)}{programa?.mostrarTitulo && programa?.title ? ` · ${programa.title}` : ''}
    </span>
  );
}

/**
 * «Ver  Todo ▾»: el filtro por persona. SOLO filtra: esconde lo de los demás, no abre otro
 * programa. Sin al menos dos personas no sale.
 *
 * Es una lista desplegable chiquita y no una fila de pastillas. Andrés, 2 oct 2026:
 * «imagínate que tengo 4 coaches, de velocidad, de fuerza, de deporte y fisio… puede ser
 * muy invasivo». Con pastillas cada profesional más era otra pastilla grande arriba de
 * todo; así ocupa lo mismo con dos que con diez. Con un filtro puesto se nota: el botón
 * lleva el color y el nombre de la persona.
 */
export function FiltroDeAutor({ autores, filtro, onFiltro, style }) {
  if ((autores?.length ?? 0) < 2) return null;
  const activo = autores.find((a) => a.id === filtro) ?? null;
  const opciones = [
    { valor: 'todo', etiqueta: 'Todo' },
    // En la lista: «Andrés · coach». En el botón, solo el nombre, para que no crezca.
    ...autores.map((a) => ({ valor: a.id, etiqueta: a.etiqueta, corta: a.nombre, color: a.color })),
  ];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, ...style }}>
      {/* Reestructura visual (15 oct 2026): el botón del filtro en gris claro, como el resto de los controles; sigue siendo una lista
          (Andrés, 2 oct: con 4 profesionales un control de tamaño fijo, no una fila que crece). */}
      <span style={{ fontFamily: FONT, fontSize: 14, fontWeight: 600, color: LT.text2 }}>Ver</span>
      <ListaDesplegable
        valor={activo ? activo.id : 'todo'}
        onCambio={(v) => onFiltro(v === 'todo' ? null : v)}
        opciones={opciones}
        etiqueta="Ver lo de"
        estilo={{
          width: 'auto', minHeight: 44, padding: '6px 12px 6px 14px', borderRadius: 12, gap: 7,
          fontSize: 14.5, fontWeight: 700, color: LT.text,
          background: activo ? `${activo.color}1F` : '#EBEDF1',
          border: 'none',
        }}
      />
    </div>
  );
}

