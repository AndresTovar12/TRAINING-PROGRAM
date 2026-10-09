import { Check, ChevronRight } from 'lucide-react';
import { FONT, KP, LT } from '@/lib/theme';
import { plural } from '@/lib/plural';
import { etiquetaDePrograma } from '@/lib/programas';
import ListaDesplegable from '@/components/ListaDesplegable';

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
 */
export function TarjetaDeHoyDeTodos({ entradas, onAbrir, onCambiarDia, esCompu, conAutor = true, enFila = false }) {
  const filas = entradas.flatMap((e) => e.partes.map((p) => ({ e, p })));
  const todas = filas.length > 0 && filas.every(({ p }) => p.hecha);
  /* `enFila`: va dentro de una fila con la tarjeta de foto (Home con equipo): ya no pone su propio margen de pantalla,
     parte el ancho con la foto y, si no caben juntas (un celular), se queda con toda la línea. */
  return (
    <div style={enFila ? { flex: '1 1 0', minWidth: 300, display: 'flex' } : { padding: '0 18px 12px' }}>
      <div style={{
        background: `linear-gradient(150deg, ${LT.blue}, ${LT.blueDk})`, borderRadius: KP.rCard,
        padding: '20px 18px 18px', boxShadow: KP.shBtn, ...(enFila ? { flex: 1, minWidth: 0 } : (esCompu ? { maxWidth: 560 } : null)),
      }}>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>
          {todas ? 'Completadas' : 'Hoy te toca'}
        </div>
        <div style={{ fontSize: 24, fontWeight: 700, color: '#fff', lineHeight: 1.05, marginTop: 3, letterSpacing: -0.5 }}>
          {filas.length === 1 ? '1 sesión' : `${filas.length} sesiones`}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 14 }}>
          {filas.map(({ e, p }) => {
            const color = e.programa.color ?? LT.blue;
            const datos = [p.ejercicios ? plural(p.ejercicios, 'ejercicio', 'ejercicios') : null, p.minutos].filter(Boolean).join(' · ');
            return (
              <button
                key={`${e.programa.id}-${e.dayIdx}-${p.bloque ?? 'dia'}`}
                type="button"
                onClick={() => onAbrir(e)}
                className="kp-press"
                style={{
                  width: '100%', textAlign: 'left', cursor: 'pointer', fontFamily: FONT, background: '#fff',
                  border: 'none', borderRadius: 16, padding: '12px 13px 12px 11px',
                  display: 'flex', alignItems: 'center', gap: 11,
                }}
              >
                <span aria-hidden="true" style={{ width: 5, alignSelf: 'stretch', borderRadius: 5, background: color, flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  {conAutor && <span style={{ display: 'block', fontSize: 12, fontWeight: 800, color }}>{etiquetaDePrograma(e.programa)}</span>}
                  <span style={{ display: 'block', fontSize: 16.5, fontWeight: 800, color: LT.text, marginTop: 2, overflowWrap: 'anywhere', lineHeight: 1.2 }}>
                    {p.nombre}
                  </span>
                  {datos && <span style={{ display: 'block', fontSize: 12, color: LT.text2, marginTop: 3 }}>{datos}</span>}
                </span>
                {p.hecha ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0, fontSize: 12.5, fontWeight: 800, color: LT.mint }}>
                    <Check size={16} strokeWidth={3} /> Terminada
                  </span>
                ) : (
                  <ChevronRight size={18} color={LT.text3} style={{ flexShrink: 0 }} />
                )}
              </button>
            );
          })}
        </div>

        {onCambiarDia && (
          <button
            type="button"
            onClick={onCambiarDia}
            style={{
              display: 'block', width: '100%', border: 'none', cursor: 'pointer', fontFamily: FONT,
              background: 'rgba(255,255,255,0.15)', borderRadius: 14, padding: '13px',
              fontSize: 14, fontWeight: 600, color: '#fff', textAlign: 'center', marginTop: 10,
            }}
          >
            Cambiar día
          </button>
        )}
      </div>
    </div>
  );
}
