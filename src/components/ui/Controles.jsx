import { Minus, Plus, Search } from 'lucide-react';
import { FONT, KP, NUM_STYLE, UI } from '@/lib/theme';

/* Los controles chicos de la reestructura visual (15 oct 2026). Cada uno contesta UNA clase de pregunta,
   y esa es la regla para escoger (Andrés: «donde tenías que usar una lista desplegable usabas puros stickers»):
     ¿sí o no?                       → Interruptor
     ¿cuál de 2 o 3 opciones?        → Segmentado
     ¿cuántas veces / cuántos?       → Pasos (− 3 +)
     ¿en qué estado está?            → Pastilla (solo se lee, no se toca)
     ¿cuál de una lista larga?       → FilaElegir (ver ese archivo)
     ¿qué escribes?                  → Campo / Buscador */

/** Encendido o apagado. Se guarda al tocarlo: no lleva botón de «Guardar» al lado. */
export function Interruptor({ activo, onCambio, etiqueta, deshabilitado = false }) {
  return (
    <button
      type="button" role="switch" aria-checked={!!activo} aria-label={etiqueta} disabled={deshabilitado}
      onClick={(e) => { e.stopPropagation(); onCambio?.(!activo); }}
      style={{
        width: 51, height: 31, borderRadius: 999, border: 'none', padding: 2, flexShrink: 0, position: 'relative',
        background: activo ? KP.blue : '#E1E3E8', cursor: deshabilitado ? 'default' : 'pointer', opacity: deshabilitado ? 0.5 : 1,
        transition: 'background .18s ease', touchAction: 'manipulation',
      }}
    >
      <span style={{
        position: 'absolute', top: 2, left: 2, width: 27, height: 27, borderRadius: '50%', background: '#fff',
        boxShadow: '0 2px 5px rgba(0,0,0,0.22)', transform: activo ? 'translateX(20px)' : 'none', transition: 'transform .18s cubic-bezier(.22,1,.36,1)',
      }} />
    </button>
  );
}

/**
 * Escoger UNA de 2 o 3 opciones que se ven todas a la vez («Membresía | Pago único», «Lista | Tarjetas»).
 * `opciones`: [{ valor, texto }]. En fondo azul (`enAzul`) el elegido va blanco y el resto translúcido.
 */
export function Segmentado({ opciones, valor, onCambio, etiqueta, ancho = true, enAzul = false, chico = false }) {
  return (
    <div
      role="radiogroup" aria-label={etiqueta}
      style={{
        display: ancho ? 'flex' : 'inline-flex', gap: 2, padding: 3, borderRadius: chico ? 11 : 14,
        background: enAzul ? 'rgba(255,255,255,0.14)' : UI.relleno, fontFamily: FONT,
      }}
    >
      {opciones.map((o) => {
        const puesto = o.valor === valor;
        return (
          <button
            key={String(o.valor)} type="button" role="radio" aria-checked={puesto} onClick={() => onCambio?.(o.valor)}
            style={{
              flex: ancho ? 1 : undefined, minHeight: chico ? 34 : 42, padding: chico ? '0 12px' : '0 16px', borderRadius: chico ? 9 : 11, border: 'none',
              fontFamily: FONT, fontSize: chico ? 13.5 : 15, fontWeight: puesto ? 700 : 600, cursor: 'pointer', whiteSpace: 'nowrap',
              background: puesto ? '#fff' : 'transparent',
              color: puesto ? KP.blue : enAzul ? 'rgba(255,255,255,0.85)' : KP.ink2,
              boxShadow: puesto ? '0 1px 4px rgba(17,19,24,0.12)' : 'none', transition: 'background .15s, color .15s', touchAction: 'manipulation',
            }}
          >
            {o.texto}
          </button>
        );
      })}
    </div>
  );
}

/** Un número que se sube o se baja de uno en uno (Se repite − 3 + veces). */
export function Pasos({ valor, onCambio, min = 0, max = 99, etiqueta, enAzul = false }) {
  const boton = (Icono, delta, apagado, nombre) => (
    <button
      type="button" aria-label={nombre} disabled={apagado} onClick={() => onCambio?.(valor + delta)}
      style={{
        width: 34, height: 34, borderRadius: 10, border: 'none', display: 'grid', placeItems: 'center', cursor: apagado ? 'default' : 'pointer',
        background: enAzul ? 'rgba(255,255,255,0.16)' : '#fff', color: enAzul ? '#fff' : KP.blue, opacity: apagado ? 0.4 : 1,
        boxShadow: enAzul ? 'none' : '0 1px 3px rgba(17,19,24,0.1)', touchAction: 'manipulation',
      }}
    >
      <Icono size={16} strokeWidth={2.6} />
    </button>
  );
  return (
    <div role="group" aria-label={etiqueta} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: 4, borderRadius: 13, background: enAzul ? 'rgba(0,0,0,0.18)' : UI.relleno }}>
      {boton(Minus, -1, valor <= min, `Menos ${etiqueta ?? ''}`.trim())}
      <span aria-live="polite" style={{ minWidth: 30, textAlign: 'center', fontFamily: FONT, fontSize: 18, fontWeight: 800, color: enAzul ? '#fff' : KP.ink, ...NUM_STYLE }}>{valor}</span>
      {boton(Plus, 1, valor >= max, `Más ${etiqueta ?? ''}`.trim())}
    </div>
  );
}

const TONOS = {
  ok: { fondo: KP.mintSoft, color: '#00875F' },
  aviso: { fondo: KP.amberSoft, color: '#B86400' },
  malo: { fondo: KP.dangerSoft, color: KP.danger },
  neutro: { fondo: UI.relleno, color: KP.ink2 },
  azul: { fondo: KP.blueSoft, color: KP.blue },
  lleno: { fondo: KP.blue, color: '#fff' },
};

/** El estado de algo, para leerse (Publicado, Borrador, Bajando, Sin plan, AHORA). No se toca. */
export function Pastilla({ tono = 'neutro', children }) {
  const t = TONOS[tono] ?? TONOS.neutro;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', padding: '3px 8px', borderRadius: UI.rPastilla, fontFamily: FONT,
      fontSize: 12, fontWeight: 700, background: t.fondo, color: t.color, whiteSpace: 'nowrap', lineHeight: 1.35,
    }}
    >
      {children}
    </span>
  );
}

/**
 * Un dato que se escribe, en su propia tarjeta blanca: la etiqueta chica arriba y lo escrito grande
 * («Nombre del plan / Velocidad para receptores»). `multilinea` para descripciones y notas.
 */
export function Campo({ etiqueta, valor, onCambio, marcador, multilinea = false, tipo = 'text', grande = true, ...resto }) {
  const Entrada = multilinea ? 'textarea' : 'input';
  return (
    <label style={{ display: 'block', background: UI.tarjeta, borderRadius: UI.rGrupo, boxShadow: UI.sombraGrupo, padding: '12px 16px 13px', fontFamily: FONT, cursor: 'text' }}>
      <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: KP.ink2 }}>{etiqueta}</span>
      <Entrada
        type={multilinea ? undefined : tipo}
        value={valor ?? ''}
        onChange={(e) => onCambio?.(e.target.value)}
        placeholder={marcador}
        rows={multilinea ? 3 : undefined}
        style={{
          display: 'block', width: '100%', border: 'none', outline: 'none', background: 'transparent', padding: 0, marginTop: 3,
          fontFamily: FONT, fontSize: grande && !multilinea ? 19 : 16, fontWeight: grande && !multilinea ? 700 : 500, color: KP.ink,
          lineHeight: 1.4, resize: multilinea ? 'vertical' : undefined,
        }}
        {...resto}
      />
    </label>
  );
}

/** La caja gris para buscar («Buscar atleta», «Nombre, categoría o músculo…»). */
export function Buscador({ valor, onCambio, marcador = 'Buscar…', etiqueta, estilo }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 9, minHeight: 48, padding: '0 14px', borderRadius: UI.rCampo, background: UI.relleno, fontFamily: FONT, ...estilo }}>
      <Search size={18} color={KP.ink3} style={{ flexShrink: 0 }} />
      <input
        type="search" value={valor ?? ''} onChange={(e) => onCambio?.(e.target.value)} placeholder={marcador} aria-label={etiqueta ?? marcador}
        style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontFamily: FONT, fontSize: 16, fontWeight: 500, color: KP.ink }}
      />
    </label>
  );
}

const COLORES_AVATAR = [
  { fondo: '#E8EEFF', color: '#1E40E0' }, { fondo: '#FFF0E1', color: '#C2620A' }, { fondo: '#E3F6EF', color: '#00875F' },
  { fondo: '#F1EBFF', color: '#6D4AE8' }, { fondo: '#FDE8EE', color: '#C5305C' }, { fondo: '#E3F3F8', color: '#0E7490' },
];

/** Las iniciales en un cuadro redondeado, siempre del mismo color para la misma persona. Con `foto`, la foto. */
export function Avatar({ nombre = '', foto, tamano = 44 }) {
  const iniciales = String(nombre).trim().split(/\s+/).slice(0, 2).map((p) => p[0] ?? '').join('').toUpperCase() || '·';
  let suma = 0;
  for (const c of String(nombre)) suma = (suma + c.charCodeAt(0)) % 997;
  const c = COLORES_AVATAR[suma % COLORES_AVATAR.length];
  const radio = Math.round(tamano * 0.3);
  if (foto) return <img src={foto} alt="" style={{ width: tamano, height: tamano, borderRadius: radio, objectFit: 'cover', flexShrink: 0 }} />;
  return (
    <span aria-hidden="true" style={{ width: tamano, height: tamano, borderRadius: radio, background: c.fondo, color: c.color, display: 'grid', placeItems: 'center', flexShrink: 0, fontFamily: FONT, fontSize: Math.round(tamano * 0.36), fontWeight: 800 }}>
      {iniciales}
    </span>
  );
}

/**
 * Un valor en una escala (dolor 0 a 10). El número va grande a la derecha del nombre y la barra se llena del color
 * que se le dé. Sin valor todavía (`null`), la barra va vacía y el número dice «—».
 */
export function Deslizador({ valor, onCambio, min = 0, max = 10, etiqueta, color = KP.blue, extremos }) {
  const pct = valor == null ? 0 : ((valor - min) / (max - min)) * 100;
  return (
    <div style={{ fontFamily: FONT }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
        <span style={{ fontSize: 15.5, fontWeight: 600, color: KP.ink }}>{etiqueta}</span>
        <span style={{ fontSize: 26, fontWeight: 800, color: valor == null ? KP.ink3 : color, ...NUM_STYLE }}>{valor ?? '—'}<span style={{ fontSize: 14, color: KP.ink3, fontWeight: 700 }}> / {max}</span></span>
      </div>
      <input
        type="range" min={min} max={max} step={1} value={valor ?? min} aria-label={etiqueta} className="ui-deslizador"
        onChange={(e) => onCambio?.(Number(e.target.value))}
        style={{ '--relleno': color, '--pct': `${pct}%`, width: '100%', marginTop: 12 }}
      />
      {extremos && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, fontWeight: 600, color: KP.ink2, marginTop: 4 }}>
          <span>{extremos[0]}</span><span>{extremos[1]}</span>
        </div>
      )}
    </div>
  );
}

/** La casilla de un número que va a la derecha de una Fila («Back Squat ...... [140] kg»). Vacía dice «—». */
export function EntradaNumero({ valor, onCambio, unidad, etiqueta, ancho = 92, marcador = '—', deshabilitada = false }) {
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 40, padding: '0 10px', borderRadius: 11, background: UI.relleno, fontFamily: FONT, flexShrink: 0 }}>
      <input
        type="number" inputMode="decimal" value={valor ?? ''} placeholder={marcador} aria-label={etiqueta} disabled={deshabilitada} className="ui-numero"
        onChange={(e) => onCambio?.(e.target.value)}
        style={{ width: ancho - 40, border: 'none', outline: 'none', background: 'transparent', textAlign: 'right', fontFamily: FONT, fontSize: 16, fontWeight: 700, color: KP.ink, ...NUM_STYLE }}
      />
      {unidad && <span style={{ fontSize: 13, fontWeight: 700, color: KP.ink3 }}>{unidad}</span>}
    </label>
  );
}
