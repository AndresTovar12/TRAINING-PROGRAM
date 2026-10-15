import { FONT, KP, NUM_STYLE, UI } from '@/lib/theme';

/**
 * La tira de los siete días de Home (reestructura visual, 15 oct 2026): «Lun 5 · Mar 6 · …» con un puntito
 * por sesión y hoy en azul. Reemplaza la tarjeta «Tu semana» (L M M J V S D sin fechas): dice lo mismo
 * —qué días entrenas y cuál es hoy— y además en qué fecha cae cada uno.
 *
 * Solo se lee: el día que se entrena lo cambia «Cambiar día» de la tarjeta azul, como siempre.
 * `dias`: los de `weekOverview` (o su versión de equipo): { key, isToday, hasSession, sesiones, descanso, name }.
 */
const CORTOS = { Lun: 'Lun', Mar: 'Mar', 'Mié': 'Mié', Jue: 'Jue', Vie: 'Vie', 'Sáb': 'Sáb', Dom: 'Dom' };
const LARGOS = { Lun: 'Lunes', Mar: 'Martes', 'Mié': 'Miércoles', Jue: 'Jueves', Vie: 'Viernes', 'Sáb': 'Sábado', Dom: 'Domingo' };

/** El número del día del mes de cada día de esta semana (lunes a domingo), según el calendario de quien mira. */
function numerosDeLaSemana(hoy = new Date()) {
  const lunes = new Date(hoy);
  lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => { const d = new Date(lunes); d.setDate(lunes.getDate() + i); return d.getDate(); });
}

export default function TiraDeSemana({ dias = [] }) {
  const numeros = numerosDeLaSemana();
  return (
    <div role="list" aria-label="Tu semana" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 6, fontFamily: FONT }}>
      {dias.map((d, i) => {
        const hoy = d.isToday;
        const puntos = Math.min(d.sesiones || 0, 3);
        const dice = d.hasSession ? `${d.sesiones} ${d.sesiones === 1 ? 'sesión' : 'sesiones'}${d.name ? `: ${d.name}` : ''}` : d.descanso ? 'descanso' : 'sin sesión';
        return (
          <div
            key={d.key} role="listitem" aria-label={`${LARGOS[d.key] ?? d.key} ${numeros[i]}${hoy ? ', hoy' : ''}: ${dice}`} title={d.name || undefined}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '9px 0 8px', borderRadius: 16,
              background: hoy ? UI.azul : 'transparent', color: hoy ? '#fff' : KP.ink, boxShadow: hoy ? UI.azulSombra : 'none',
            }}
          >
            <span style={{ fontSize: 12.5, fontWeight: 600, color: hoy ? 'rgba(255,255,255,0.85)' : KP.ink2 }}>{CORTOS[d.key] ?? d.key}</span>
            <span style={{ fontSize: 21, fontWeight: 800, lineHeight: 1.1, ...NUM_STYLE }}>{numeros[i]}</span>
            <span aria-hidden="true" style={{ display: 'flex', gap: 3, height: 5 }}>
              {Array.from({ length: puntos }, (_, j) => (
                <i key={j} style={{ width: 5, height: 5, borderRadius: '50%', background: hoy ? '#fff' : KP.ink }} />
              ))}
            </span>
          </div>
        );
      })}
    </div>
  );
}
