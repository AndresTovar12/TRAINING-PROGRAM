import { ChevronDown, Timer } from 'lucide-react';
import CampoDescanso from '@/components/CampoDescanso';
import { T, FONT, KP } from '@/lib/theme';

/**
 * LOS DESCANSOS DE UN SET, con nombre (23 oct 2026, PDF «Editor descansos»: «los coaches no van a entender cómo está el tema con el descanso entre vueltas, entre Sets y entre
 * ejercicios»). Un Set tiene hasta tres momentos de descanso y antes el editor solo enseñaba una casilla «Descanso» por ejercicio, con tres significados escondidos:
 *   · ENTRE EJERCICIOS: después de cada ejercicio menos el último (`descanso` de esos ejercicios).
 *   · ENTRE VUELTAS: después del último ejercicio de cada vuelta (`descanso` del último). En un Set de UN ejercicio es «Entre series».
 *   · DESPUÉS DEL SET: antes del siguiente Set (`descansoSet` del último; la misma raya de siempre, que sigue ahí).
 * NO HAY DATOS NUEVOS: los tres renglones escriben en los mismos campos de siempre, así que ningún plan guardado cambia. Nacen vacíos (la app no inventa descansos).
 * «Distinto por ejercicio» despliega la casilla de cada ejercicio para quien quiere 30 s tras el A y 60 s tras el B; se abre solo si el plan ya trae descansos distintos.
 * Con un reloj de formato (AMRAP, EMOM, Tabata…) no se usa: el reloj marca los descansos. Con lapsos cada lapso trae el suyo.
 */

const texto = (x) => String(x ?? '').trim();

/** Lo que dicen los ejercicios (menos el último) de su descanso: el texto común, o `null` si no todos dicen lo mismo. */
export const descansoComun = (miembros) => {
  const dice = miembros.map((m) => texto(m.descanso));
  return dice.every((d) => d === dice[0]) ? (dice[0] ?? '') : null;
};

/** ¿Este Set se repite? «3», «4-6»… Más de una vuelta es lo que da sentido al descanso entre vueltas. */
export const seRepite = (rondas) => {
  const n = texto(rondas).match(/\d+/g);
  return !!n && Math.max(...n.map(Number)) > 1;
};

const estiloCaja = { background: T.bg, border: 'none', borderRadius: 10, fontFamily: FONT, fontSize: 13, color: T.text, padding: 0 };

function Renglon({ color, titulo, ayuda, valor, onPatch, soloLectura }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '8px 0' }}>
      <div style={{ flex: '1 1 150px', minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 800, color }}>{titulo}</div>
        <div style={{ fontSize: 12, fontWeight: 500, color: T.text3, lineHeight: 1.3 }}>{ayuda}</div>
      </div>
      <div style={{ flex: '0 0 124px', pointerEvents: soloLectura ? 'none' : 'auto' }}>
        <CampoDescanso ex={{ descanso: valor }} onPatch={(p) => onPatch(String(p.descanso ?? ''))} compacto estiloInput={estiloCaja} />
      </div>
    </div>
  );
}

export default function DescansosDelSet({ miembros, rondas, hayOtroSet, soloLectura, distintoAbierto, onDistinto, onEntreEjercicios, onEntreVueltas, despues }) {
  const n = miembros.length;
  const repite = seRepite(rondas);
  const ultimo = miembros[n - 1];
  const intermedios = miembros.slice(0, n - 1);
  const comun = n > 1 ? descansoComun(intermedios) : '';
  const varia = comun === null;
  // Un Set de un ejercicio que no se repite y sin otro Set después no tiene ningún descanso que decir.
  if (n === 1 && !repite && !hayOtroSet) return null;

  return (
    <div style={{ marginTop: 10, background: T.bg2, borderRadius: 14, padding: '6px 12px 8px', boxShadow: '0 1px 2px rgba(17,19,24,0.04)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13.5, fontWeight: 800, color: T.text2, padding: '6px 0 0' }}>
        <Timer size={13} /> Descansos
      </div>
      {n > 1 && (
        distintoAbierto ? (
          <div style={{ padding: '8px 0', fontSize: 12.5, color: T.text3, lineHeight: 1.35 }}>
            <b style={{ color: KP.blue, fontSize: 13.5 }}>Entre ejercicios</b> · Cada ejercicio trae el suyo, abajo.
          </div>
        ) : varia ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '8px 0' }}>
            <div style={{ flex: '1 1 150px' }}>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: KP.blue }}>Entre ejercicios</div>
              <div style={{ fontSize: 12, color: T.text3 }}>Varía: cada ejercicio trae el suyo.</div>
            </div>
            <button type="button" onClick={() => onDistinto(true)} style={botonTexto}>Ver cada uno</button>
          </div>
        ) : (
          <Renglon color={KP.blue} titulo="Entre ejercicios" ayuda="Al terminar cada ejercicio, antes del siguiente." valor={comun ?? ''} onPatch={onEntreEjercicios} soloLectura={soloLectura} />
        )
      )}
      {repite && (
        <Renglon
          color="#B8730A" titulo={n > 1 ? 'Entre vueltas' : 'Entre series'}
          ayuda={n > 1 ? 'Al terminar el último ejercicio, antes de repetir el Set.' : 'Al terminar cada serie, antes de la siguiente.'}
          valor={texto(ultimo?.descanso)} onPatch={onEntreVueltas} soloLectura={soloLectura}
        />
      )}
      {hayOtroSet && (
        // Un solo lugar para cada dato: el descanso después del Set se pone en la raya de abajo, donde pasa; aquí solo se dice dónde está.
        <div style={{ padding: '8px 0', fontSize: 12.5, color: T.text3, lineHeight: 1.35 }}>
          <b style={{ color: '#D8343A', fontSize: 13.5 }}>Después del Set</b>{' '}
          {texto(despues) ? `· ${texto(despues)}. ` : '· '}Se pone en la raya de abajo ↓
        </div>
      )}
      {n > 1 && !soloLectura && (
        <button type="button" onClick={() => onDistinto(!distintoAbierto)} aria-expanded={!!distintoAbierto} style={{ ...botonTexto, marginTop: 2 }}>
          Distinto por ejercicio <ChevronDown size={14} style={{ transform: distintoAbierto ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
        </button>
      )}
    </div>
  );
}

const botonTexto = {
  display: 'inline-flex', alignItems: 'center', gap: 4, border: 'none', background: 'transparent', cursor: 'pointer', padding: '6px 0', fontFamily: FONT,
  fontSize: 12.5, fontWeight: 800, color: KP.blue, touchAction: 'manipulation',
};
