import { CalendarDays, Check, Clock, ListChecks, Play } from 'lucide-react';
import { FONT, LT } from '@/lib/theme';
import { plural } from '@/lib/plural';
import { etiquetaDePrograma } from '@/lib/programas';
import { aspectoDelTipo } from '@/lib/aspectoDelTipo';
import ListaDesplegable from '@/components/ListaDesplegable';
import { CartelDeHoy } from '@/features/training/TarjetaDeHoy';

/* Lo que ve un atleta que tiene EQUIPO: su coach principal y, además, alguien
   más (un fisio…) que le puso sesiones. Sin equipo nada de esto sale y la app es
   la de siempre.

   Para el atleta el programa es UNO SOLO, con varias personas que le ponen
   cosas. Andrés, 1 oct 2026: nada de pestañas por profesional —«no por lo
   visual, sino por lo que representa»—; las sesiones de todos van juntas, cada
   una dice de quién viene, y un filtro deja ver solo lo de uno si se quiere. */

/** «● Beto · coach»: de quién viene algo, con su color. */
export function EtiquetaDeAutor({ programa, tamano = 12, style }) {
  const color = programa?.color ?? LT.blue;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: FONT,
      fontSize: tamano, fontWeight: 800, color, ...style,
    }}>
      <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
      {etiquetaDePrograma(programa)}
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
      <span style={{ fontFamily: FONT, fontSize: 12.5, fontWeight: 700, color: LT.text3 }}>Ver</span>
      <ListaDesplegable
        valor={activo ? activo.id : 'todo'}
        onCambio={(v) => onFiltro(v === 'todo' ? null : v)}
        opciones={opciones}
        etiqueta="Ver lo de"
        estilo={{
          width: 'auto', minHeight: 34, padding: '5px 10px 5px 12px', borderRadius: 999, gap: 7,
          fontSize: 13, fontWeight: 800, color: LT.text,
          background: activo ? `${activo.color}14` : LT.surface,
          border: `1.5px solid ${activo ? `${activo.color}66` : LT.border}`,
        }}
      />
    </div>
  );
}

/**
 * «Hoy te toca», con TODAS las sesiones de hoy en una sola tarjeta. Una fila por
 * SESIÓN, no por persona: el doble del coach (AM y PM) y la del fisio van en la misma
 * lista, y cada fila dice de quién es con una etiqueta chica (Andrés, 2 oct 2026:
 * «el programa es un todo… no que la app se la pase separándolo»).
 * Tocar una lleva a «Plan», a ese día.
 *
 * Desde el 9 oct 2026 tiene el mismo cartel que la tarjeta de un solo programa (ver `TarjetaDeHoy`): el color de cada
 * tipo de sesión tiñe el resplandor y cada fila es de vidrio, con el ícono de su tipo y un play redondo. `style`: el lugar
 * que ocupa en la fila de Home (junto a la foto, o sola).
 */
export function TarjetaDeHoyDeTodos({ entradas, onAbrir, onCambiarDia, conAutor = true, style }) {
  const filas = entradas.flatMap((e) => e.partes.map((p) => ({ e, p })));
  const todas = filas.length > 0 && filas.every(({ p }) => p.hecha);
  return (
    <CartelDeHoy
      colores={filas.map(({ e }) => aspectoDelTipo(e.day).color)} etiqueta={todas ? 'Completadas' : 'Hoy te toca'} style={style}
    >
      <h3 className="tl-hoy-tit" style={{ marginTop: 14 }}>
        {filas.length === 1 ? '1 sesión' : `${filas.length} sesiones`}
      </h3>

      <div style={{ marginTop: 14 }}>
        {filas.map(({ e, p }) => {
          const { Icono } = aspectoDelTipo(e.day);
          const datos = [
            p.ejercicios ? { Icono: ListChecks, texto: plural(p.ejercicios, 'ejercicio', 'ejercicios') } : null,
            p.minutos ? { Icono: Clock, texto: p.minutos } : null,
          ].filter(Boolean);
          return (
            <button
              key={`${e.programa.id}-${e.dayIdx}-${p.bloque ?? 'dia'}`}
              type="button"
              onClick={() => onAbrir(e)}
              className="tl-hoy-fila"
            >
              <span className="tl-hoy-fila-ic" aria-hidden="true"><Icono /></span>
              <span className="tl-hoy-fila-tx">
                {conAutor && (
                  <span className="tl-hoy-fila-au" style={{ '--au': e.programa.color ?? LT.blue }}>
                    <i aria-hidden="true" />{etiquetaDePrograma(e.programa)}
                  </span>
                )}
                <span className="tl-hoy-fila-nm">{p.nombre}</span>
                {datos.length > 0 && (
                  <span className="tl-hoy-fila-dt">
                    {datos.map(({ Icono, texto }) => <span key={texto}><Icono aria-hidden="true" />{texto}</span>)}
                  </span>
                )}
              </span>
              {p.hecha ? (
                <span className="tl-hoy-fila-go ok" role="img" aria-label="Terminada"><Check /></span>
              ) : (
                <span className="tl-hoy-fila-go" aria-hidden="true"><Play /></span>
              )}
            </button>
          );
        })}
      </div>

      {onCambiarDia && (
        <button type="button" onClick={onCambiarDia} className="tl-hoy-aparte">
          <CalendarDays aria-hidden="true" />Cambiar día
        </button>
      )}
    </CartelDeHoy>
  );
}
