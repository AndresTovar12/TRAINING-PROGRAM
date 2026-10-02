import { ChevronRight } from 'lucide-react';
import Ventana from '@/features/misplanes/Ventana';
import { COLOR_DE_TIPO, FONDO_DE_TIPO, ICONO_DE_TIPO } from '@/features/misplanes/estilos';
import { T, FONT, KP } from '@/lib/theme';

/* Lo que se puede crear, con las mismas palabras que ya ve el coach cuando arma el plan de un atleta
   («Una rutina que se repite», «Varias semanas que avanzan», «Programa por fases») y un workout más. */
const OPCIONES = [
  { forma: 'workout', tipo: 'workout', titulo: 'Workout', desc: 'Un día de entrenamiento: una o más sesiones con sus ejercicios.' },
  { forma: 'rutina', tipo: 'rutina', titulo: 'Rutina semanal', desc: 'Una semana de siete días que se repite todas las semanas.' },
  { forma: 'semanas', tipo: 'programa', titulo: 'Varias semanas que avanzan', desc: 'Arrancas con la misma base y vas subiendo cargas semana a semana.' },
  { forma: 'fases', tipo: 'programa', titulo: 'Programa por fases', desc: 'Bloques con objetivos distintos, como un plan de temporada.' },
];

/**
 * El Centro de creación: lo que se abre con «+ Crear» en Mis planes. Cuatro tarjetas grandes; la que se elige
 * abre el MISMO editor de siempre, sin atleta (Andrés, 2 oct 2026).
 */
export default function CentroDeCreacion({ carpetaTexto, onElegir, onCerrar }) {
  return (
    <Ventana
      titulo="Centro de creación"
      subtitulo={carpetaTexto ? `Lo que crees se guarda en ${carpetaTexto}.` : '¿Qué quieres crear?'}
      onCerrar={onCerrar}
      ancho={520}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 4 }}>
        {OPCIONES.map((o) => {
          const Icono = ICONO_DE_TIPO[o.tipo];
          return (
            <button
              key={o.forma} type="button" onClick={() => onElegir(o.forma)}
              style={{
                display: 'flex', gap: 14, alignItems: 'center', textAlign: 'left', cursor: 'pointer', background: T.bg2,
                border: `1.5px solid ${T.border}`, borderRadius: 18, padding: 16, fontFamily: FONT, boxShadow: KP.shCard,
              }}
            >
              <span style={{ width: 46, height: 46, borderRadius: 14, background: FONDO_DE_TIPO[o.tipo], color: COLOR_DE_TIPO[o.tipo], display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <Icono size={22} />
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 15.5, fontWeight: 800, color: T.text }}>{o.titulo}</span>
                <span style={{ display: 'block', fontSize: 13, color: T.text2, marginTop: 3, lineHeight: 1.45 }}>{o.desc}</span>
              </span>
              <ChevronRight size={18} color={T.text3} style={{ flexShrink: 0 }} />
            </button>
          );
        })}
      </div>
    </Ventana>
  );
}
