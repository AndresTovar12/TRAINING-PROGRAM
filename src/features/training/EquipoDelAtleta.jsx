import { Check, ChevronRight } from 'lucide-react';
import { FONT, KP, LT } from '@/lib/theme';
import { plural } from '@/lib/plural';
import { etiquetaDePrograma } from '@/lib/programas';
import { sesionesDelTitulo } from '@/lib/sesiones';
import EtiquetasDeSesion from '@/components/EtiquetasDeSesion';

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
 * Las pastillas «Todo · Andrés · Ana». SOLO filtran: esconden lo de los demás,
 * no abren otro programa. Sin al menos dos personas no salen.
 */
export function ChipsDeAutor({ autores, filtro, onFiltro, style }) {
  if ((autores?.length ?? 0) < 2) return null;
  const pastilla = (activa, color) => ({
    padding: '9px 15px', borderRadius: 999, cursor: 'pointer', fontFamily: FONT, fontSize: 14, fontWeight: 800,
    border: `1.5px solid ${activa ? color : LT.border}`,
    background: activa ? color : LT.surface, color: activa ? '#fff' : LT.text,
    whiteSpace: 'nowrap', touchAction: 'manipulation',
  });
  return (
    <div style={{ padding: '0 18px', ...style }}>
      <div role="tablist" aria-label="Ver lo de" style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
        <button type="button" role="tab" aria-selected={!filtro} onClick={() => onFiltro(null)} style={pastilla(!filtro, LT.text)}>
          Todo
        </button>
        {autores.map((a) => (
          <button
            key={a.id}
            type="button"
            role="tab"
            aria-selected={filtro === a.id}
            onClick={() => onFiltro(a.id)}
            style={pastilla(filtro === a.id, a.color)}
          >
            {a.nombre}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * «Hoy te toca», con TODAS las sesiones de hoy de todos en una sola tarjeta,
 * cada una con el nombre de quien la puso. Tocar una lleva a «Plan», a ese día.
 */
export function TarjetaDeHoyDeTodos({ entradas, onAbrir, onCambiarDia, esCompu, conAutor = true }) {
  const todas = entradas.length > 0 && entradas.every((e) => e.hecha);
  return (
    <div style={{ padding: '0 18px 12px' }}>
      <div style={{
        background: `linear-gradient(150deg, ${LT.blue}, ${LT.blueDk})`, borderRadius: KP.rCard,
        padding: '20px 18px 18px', boxShadow: KP.shBtn, ...(esCompu ? { maxWidth: 560 } : null),
      }}>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>
          {todas ? 'Completadas' : 'Hoy te toca'}
        </div>
        <div style={{ fontSize: 24, fontWeight: 700, color: '#fff', lineHeight: 1.05, marginTop: 3, letterSpacing: -0.5 }}>
          {entradas.length === 1 ? '1 sesión' : `${entradas.length} sesiones`}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 14 }}>
          {entradas.map((e) => {
            const color = e.programa.color ?? LT.blue;
            const sesiones = sesionesDelTitulo(e.day);
            const datos = [e.ejercicios ? plural(e.ejercicios, 'ejercicio', 'ejercicios') : null, e.minutos].filter(Boolean).join(' · ');
            return (
              <button
                key={`${e.programa.id}-${e.dayIdx}`}
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
                  {sesiones.length > 1 ? (
                    <EtiquetasDeSesion sesiones={sesiones} envolver tamano={13.5} style={{ marginTop: 5 }} />
                  ) : (
                    <span style={{ display: 'block', fontSize: 16.5, fontWeight: 800, color: LT.text, marginTop: 2, overflowWrap: 'anywhere', lineHeight: 1.2 }}>
                      {e.titulo}
                    </span>
                  )}
                  {datos && <span style={{ display: 'block', fontSize: 12, color: LT.text2, marginTop: 3 }}>{datos}</span>}
                </span>
                {e.hecha ? (
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
