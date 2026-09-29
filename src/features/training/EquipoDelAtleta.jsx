import { Activity, Check, ChevronRight } from 'lucide-react';
import { FONT, KP, LT, eyebrow } from '@/lib/theme';
import { plural } from '@/lib/plural';
import { colorDePrograma, etiquetaDePrograma, nombreCorto, rolDelPrograma, semanaDeTodos } from '@/lib/programas';

/* Lo que ve un atleta que tiene EQUIPO: su coach principal y, además, alguien
   más (un fisio…) con su propio programa. Sin equipo nada de esto sale y la app
   es la de siempre. Cada cosa dice de quién viene. */

/** Lo que le toca hoy con OTRO profesional: una tarjeta compacta, debajo de la principal. */
export function TarjetaDeEquipo({ programa, sesion, color, onAbrir }) {
  const datos = [
    sesion.ejercicios ? plural(sesion.ejercicios, 'ejercicio', 'ejercicios') : null,
    sesion.minutos,
  ].filter(Boolean).join(' · ');
  return (
    <div style={{ padding: '0 18px 12px' }}>
      <button
        type="button"
        onClick={onAbrir}
        className="kp-press"
        style={{
          width: '100%', textAlign: 'left', cursor: 'pointer', fontFamily: FONT,
          background: LT.surface, borderRadius: 22, padding: 16,
          border: `1.5px solid ${color}33`, display: 'flex', alignItems: 'center', gap: 14,
        }}
      >
        <span style={{
          width: 48, height: 48, borderRadius: '50%', background: `${color}1A`, color,
          display: 'grid', placeItems: 'center', flexShrink: 0,
        }}>
          <Activity size={21} />
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 12.5, fontWeight: 800, color }}>
            {sesion.hecha ? 'Terminada' : 'Hoy'} · {etiquetaDePrograma(programa)}
          </span>
          <span style={{ display: 'block', fontSize: 17, fontWeight: 700, color: LT.text, marginTop: 2, overflowWrap: 'anywhere' }}>
            {sesion.titulo}
          </span>
          {datos && <span style={{ display: 'block', fontSize: 12, color: LT.text2, marginTop: 2 }}>{datos}</span>}
        </span>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 3, flexShrink: 0,
          background: `${color}1A`, color, borderRadius: 999, padding: '8px 11px 8px 13px', fontSize: 13, fontWeight: 800,
        }}>
          {sesion.hecha ? <Check size={15} strokeWidth={3} /> : null}
          {sesion.hecha ? 'Ver' : 'Empezar'} <ChevronRight size={15} />
        </span>
      </button>
    </div>
  );
}

/** Las pastillas de «Plan»: «Todo · Beto · Juan». Solo con dos o más programas. */
export function SelectorDePrograma({ programas, activoId, verTodo, onTodo, onPrograma }) {
  const pastilla = (activa, color) => ({
    padding: '9px 15px', borderRadius: 999, cursor: 'pointer', fontFamily: FONT, fontSize: 14, fontWeight: 800,
    border: `1.5px solid ${activa ? color : LT.border}`,
    background: activa ? color : LT.surface, color: activa ? '#fff' : LT.text,
    whiteSpace: 'nowrap', touchAction: 'manipulation',
  });
  return (
    <div style={{ padding: '18px 18px 0' }}>
      <div role="tablist" aria-label="Programa" style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
        <button type="button" role="tab" aria-selected={verTodo} onClick={onTodo} style={pastilla(verTodo, LT.text)}>
          Todo
        </button>
        {programas.map((p, i) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={!verTodo && p.id === activoId}
            onClick={() => onPrograma(p)}
            style={pastilla(!verTodo && p.id === activoId, colorDePrograma(i))}
          >
            {nombreCorto(p.profesional?.full_name) || rolDelPrograma(p)}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * «Todo»: la semana de calendario (lunes a domingo) con lo de cada profesional,
 * cada uno según SU puntero. Tocar una sesión abre ese día en el programa de
 * quien lo mandó; tocar un nombre abre el programa completo de esa persona.
 */
export function SemanaDeTodos({ programas, store, onAbrirDia, onVerPrograma }) {
  // Lo que ya te dieron de alta no cuenta en la semana: solo se consulta en su pastilla.
  const dias = semanaDeTodos(programas.filter((p) => !p.altaEn), store);
  const indiceDe = (programaId) => Math.max(0, programas.findIndex((p) => p.id === programaId));
  return (
    <div style={{ padding: '18px 18px 110px' }}>
      <div style={eyebrow(KP.blue)}>Esta semana</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: LT.text, letterSpacing: -0.5, marginTop: 6 }}>Todo junto</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
        {programas.map((p, i) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onVerPrograma(p)}
            className="kp-press"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontFamily: FONT,
              background: LT.surface, border: `1px solid ${LT.border}`, borderRadius: 999,
              padding: '7px 12px 7px 10px', fontSize: 13, fontWeight: 700, color: LT.text,
            }}
          >
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: colorDePrograma(i) }} />
            {etiquetaDePrograma(p)}
            <ChevronRight size={14} color={LT.text3} />
          </button>
        ))}
      </div>

      <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {dias.map((d) => (
          <div
            key={d.clave}
            style={{
              background: LT.surface, borderRadius: 18, padding: '12px 14px', display: 'flex', gap: 12,
              border: d.esHoy ? `1.5px solid ${LT.blue}` : `1px solid ${LT.border}`,
            }}
          >
            <div style={{ width: 44, textAlign: 'center', flexShrink: 0, paddingTop: 2 }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.6, color: d.esHoy ? LT.blue : LT.text3 }}>
                {d.clave.toUpperCase()}
              </div>
              <div style={{ fontSize: 21, fontWeight: 800, color: d.esHoy ? LT.blue : LT.text }}>{d.numero}</div>
            </div>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6, justifyContent: 'center' }}>
              {d.entradas.length === 0 ? (
                <span style={{ fontSize: 14, fontWeight: 600, color: LT.text3 }}>Sin sesión</span>
              ) : d.entradas.map((e) => {
                const programa = programas[indiceDe(e.programaId)];
                const color = colorDePrograma(indiceDe(e.programaId));
                return (
                  <button
                    key={`${e.programaId}-${e.dayIdx}`}
                    type="button"
                    onClick={() => onAbrirDia(e)}
                    className="kp-press"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', cursor: 'pointer',
                      fontFamily: FONT, background: `${color}12`, border: 'none', borderRadius: 12, padding: '9px 11px',
                    }}
                  >
                    <span style={{ width: 4, alignSelf: 'stretch', borderRadius: 4, background: color, flexShrink: 0 }} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 11.5, fontWeight: 800, color }}>{etiquetaDePrograma(programa)}</span>
                      <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700, color: LT.text, overflowWrap: 'anywhere' }}>{e.titulo}</span>
                    </span>
                    {e.hecha
                      ? <Check size={17} color={color} strokeWidth={3} style={{ flexShrink: 0 }} />
                      : <ChevronRight size={16} color={LT.text3} style={{ flexShrink: 0 }} />}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
