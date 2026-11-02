import { Marco, botonBlanco } from '@/features/training/home/HoyTeToca';
import TeEstaArmando from '@/features/training/home/TeEstaArmando';
import { FONT } from '@/lib/theme';

/* LA TARJETA AZUL «TU PLAN» (Home sin plan, 2 nov 2026; maqueta https://claude.ai/artifact/6uAsYxiGLPzfVdWNw5SSxC): la misma forma que «Hoy te toca» (`Marco`), en el mismo
   lugar, y dice lo que hay de plan.
     · Sin entrenador: «Todavía no tienes plan», «Buscar un plan» (abre Explorar) y, abajo, «¿Ya tienes coach? Pon su código ›» (abre Mi perfil → Mi equipo).
     · Con entrenador y sin plan todavía: solo lo de `TeEstaArmando`, dentro de la tarjeta. Sin botón.
   No hay botón para entrenar: entrenar es el punto ● de la barra y el cuadrito «Libre». */
export default function TarjetaTuPlan({ conCoach, coach, alBuscar, alPonerCodigo }) {
  return (
    <Marco etiqueta="Tu plan" punto={conCoach ? '#7CF0C5' : '#FFB547'} conFecha={false}>
      {conCoach ? <TeEstaArmando coach={coach} dentro /> : (
        <>
          <h2 className="texto-largo" style={{ margin: '16px 0 0', fontSize: 28, fontWeight: 800, letterSpacing: -0.5, lineHeight: 1.12 }}>Todavía no tienes plan</h2>
          <p className="texto-largo" style={{ margin: '6px 0 0', fontSize: 14.5, fontWeight: 600, opacity: 0.85, lineHeight: 1.4 }}>Encuentra uno hecho por un coach.</p>
          <button type="button" className="kp-press" onClick={alBuscar} style={{ ...botonBlanco, width: '100%', marginTop: 18 }}>Buscar un plan</button>
          <button
            type="button" className="kp-press" onClick={alPonerCodigo}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', minHeight: 44, marginTop: 4, padding: '0 8px', border: 'none', background: 'transparent',
              color: '#fff', fontFamily: FONT, fontSize: 14.5, fontWeight: 700, cursor: 'pointer', touchAction: 'manipulation',
            }}
          >
            ¿Ya tienes coach? Pon su código ›
          </button>
        </>
      )}
    </Marco>
  );
}
