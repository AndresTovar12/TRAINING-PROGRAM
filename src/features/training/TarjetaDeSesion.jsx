import { Check, ChevronDown } from 'lucide-react';
import { FONT, NUM_STYLE, LT, KP } from '@/lib/theme';
import { EtiquetaDeAutor } from '@/features/training/EquipoDelAtleta';

/**
 * La TARJETA de una sesión: un encabezado que se abre y se cierra (ícono, nombre,
 * cuántos ejercicios y cuánto dura) y, abierta, su contenido.
 *
 * TOMA EL COLOR DEL TIPO DE LA SESIÓN (`aspecto`, de `aspectoDelTipo`): fondo muy clarito,
 * borde y un ícono propio —Gym morado con pesa, Neural naranja con rayo, Correr rojo…—, igual
 * que en el editor del coach. Andrés, 9 oct 2026: «las cards deberían tomar el color del tipo
 * de workout y quitar el AM/PM»; «le estoy dando demasiada importancia al horario». Antes la
 * mañana era naranja con un sol que sale y la tarde azul con uno que se pone: el horario
 * pesaba más que la sesión. Ahora ni sol ni AM ni PM.
 *
 * LA TARJETA DE CADA SESIÓN ES UN BOTÓN Y TIENE QUE PARECERLO.
 * Andrés, 29 sep 2026: «me gustaría que estos 2 botones fueran más bonitos». Eran
 * una fila plana con una rayita de color, y con la primera abierta la segunda ni se
 * veía. Ahora cada una es una tarjeta con su ícono, su nombre, cuántos ejercicios y
 * cuánto dura, y un botón redondo que dice que se abre.
 * Terminada, su encabezado se pinta de verde, igual que el botón de cerrar, y la
 * tarjeta vuelve a ser blanca: el verde ya dice «lista» y el color del tipo sobra.
 *
 * La usan las sesiones de un día doble (dos entradas el mismo día de la semana) y, en
 * «Plan» con equipo, TODAS las sesiones del día: la del fisio es una
 * tarjeta más al lado de las del coach, y `autor` (el programa de quien la puso) le
 * agrega su etiqueta chica.
 */
const TarjetaDeSesion = ({ aspecto, hecha, abierta, onAlternar, nombre, detalle, autor, children }) => {
  const { Icono, color, fondo, borde, mosaico, tinta } = aspecto;
  // Con el color del tipo (el 99 % de los casos). Terminada, o con un color que no se puede aclarar, la tarjeta es blanca.
  const conTinte = !hecha && !!fondo;
  return (
    /* Reestructura visual (15 oct 2026): sin borde, esquinas de 22 px y sombra suave, como las tarjetas de `components/ui`. Conserva el color
       del tipo de sesión (Andrés, 9 oct) en el fondo clarito y en el cuadro del ícono. */
    <div style={{
      marginBottom: 12, borderRadius: 22, overflow: 'hidden', boxShadow: '0 2px 10px rgba(17,19,24,0.06)',
      background: conTinte ? `${fondo}, ${LT.surface}` : LT.surface,
      outline: 'none',
    }}>
      {/* Solo el ENCABEZADO se pinta de verde al terminar: si se pintara toda
          la tarjeta, la lista de ejercicios de adentro quedaría sobre verde. */}
      <button
        type="button"
        aria-expanded={abierta}
        className="kp-press"
        onClick={onAlternar}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 13, padding: '14px 16px',
          background: hecha ? KP.mintSoft : 'transparent', border: 'none', cursor: 'pointer', fontFamily: FONT, textAlign: 'left',
        }}
      >
        <span style={{
          width: 52, height: 52, borderRadius: 16, flexShrink: 0, display: 'grid', placeItems: 'center',
          background: hecha ? LT.mint : (mosaico ?? LT.surface2), color: hecha ? '#fff' : (tinta ?? color ?? LT.text2),
        }}>
          {hecha ? <Check size={22} strokeWidth={3} /> : <Icono size={22} />}
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          {autor && (
            <span style={{ display: 'block', marginBottom: 4 }}>
              <EtiquetaDeAutor programa={autor} tamano={11.5} />
            </span>
          )}
          <span style={{ display: 'block', fontSize: 18, fontWeight: 800, color: LT.text, lineHeight: 1.2, letterSpacing: -0.2, overflowWrap: 'anywhere' }}>
            {nombre}
          </span>
          <span style={{
            display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '3px 8px', marginTop: 5,
            fontSize: 13.5, fontWeight: 600, color: LT.text2, ...NUM_STYLE,
          }}>
            {/* Terminada, «Terminada» ocupa el lugar de los datos: el ícono
                verde ya dice que va hecha y así el encabezado no crece. */}
            {hecha ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: LT.mint, fontWeight: 800 }}>
                <Check size={13} strokeWidth={3} /> Terminada
              </span>
            ) : (detalle && <span>{detalle}</span>)}
          </span>
        </span>
        <span aria-hidden="true" style={{
          width: 36, height: 36, borderRadius: 12, flexShrink: 0, display: 'grid', placeItems: 'center',
          background: hecha ? '#fff' : (conTinte ? 'rgba(255,255,255,0.75)' : '#EBEDF1'), color: LT.text2,
          transform: abierta ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s',
        }}>
          <ChevronDown size={18} />
        </span>
      </button>
      {abierta && (
        <div style={{ padding: '12px 16px 16px', ...(conTinte ? { background: 'rgba(255,255,255,0.55)' } : null) }}>
          {children}
        </div>
      )}
    </div>
  );
};

export default TarjetaDeSesion;
