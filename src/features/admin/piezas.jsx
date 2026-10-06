import { useState } from 'react';
import { T, FONT } from '@/lib/theme';

/* Las piezas chicas del editor de planes: botón de icono, pastilla de acción y contador con − y +.
   Viven aquí y no dentro de `PlanBuilder` para que las usen también las piezas que se le añaden
   (los formatos de un Set) sin que un archivo importe al otro en círculo. */

/**
 * Boton de icono. Por defecto va SIN caja: ni borde ni fondo.
 *
 * Antes cada icono venia en su cuadrito gris. Con cinco juntos, la fila se
 * convierte en cinco cajas identicas y ninguna dice "yo soy la importante".
 * Sin caja, lo que se ve es el icono; el fondo aparece al pasar el mouse,
 * que es cuando hace falta saber que si se puede tocar.
 *
 * `sobreFoto` recupera la caja clara: encima de la imagen oscura de un
 * ejercicio, un icono transparente no se veria.
 */
export function IconBtn({ icon: Icon, onClick, danger, disabled, title, sobreFoto }) {
  return (
    <button
      type="button" onClick={onClick} disabled={disabled} title={title}
      className={sobreFoto ? 'kp-accion' : 'kp-ico kp-accion'}
      style={{
        width: 30, height: 30, borderRadius: 999, cursor: disabled ? 'default' : 'pointer',
        border: sobreFoto ? `1px solid ${T.border}` : 'none',
        background: sobreFoto ? T.bg2 : 'transparent',
        color: danger ? T.danger : T.text3, display: 'grid', placeItems: 'center',
        opacity: disabled ? 0.3 : 1, flexShrink: 0,
      }}
    >
      <Icon size={15} />
    </button>
  );
}

/**
 * Pastilla de accion, con TRES pesos. El peso es la jerarquia: dice de un
 * vistazo cual es la accion principal y cuales son de apoyo.
 *
 *   solido   → la accion principal de la pantalla. Azul lleno. Una sola.
 *   primary  → accion destacada de apoyo. Azul suave, sin borde.
 *   (nada)   → fantasma: sin fondo ni borde. Todo lo demas.
 *   danger   → fantasma en rojo, para lo que borra.
 *
 * Antes todo lo que no era `primary` era la misma caja blanca con borde
 * gris. Cinco de esas en fila pesan igual, asi que el ojo tiene que leerlas
 * una por una en vez de saltar directo a la que importa.
 */
export function Pill({ icon: Icon, children, onClick, primary, solido, danger, disabled }) {
  const fondo = solido ? T.accent : primary ? T.accentBg : 'transparent';
  const tinta = solido ? '#fff' : danger ? T.danger : primary ? T.accent : T.text2;
  return (
    <button
      type="button" onClick={onClick} disabled={disabled}
      className={solido || primary ? 'kp-accion' : 'kp-pill kp-accion'}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 15px', borderRadius: 999,
        border: 'none', cursor: disabled ? 'default' : 'pointer',
        background: fondo, color: tinta,
        fontFamily: FONT, fontSize: 13, fontWeight: 700, opacity: disabled ? 0.4 : 1, flexShrink: 0,
      }}
    >
      {Icon && <Icon size={14} />} {children}
    </button>
  );
}

/**
 * Un número con su − y su +, para tiempos («20 s», «1:30») y conteos. El texto lo pone quien lo usa y el paso también.
 *
 * Con `editable` el número es un campo donde se puede teclear (las vueltas de un formato: llegar
 * a 20 de uno en uno son 20 toques). Mientras se teclea el campo guarda lo que se ve en un
 * borrador —si no, al borrar el «8» para escribir un «12» el campo se llenaría solo con el valor
 * de antes—, y `onEscribe` recibe el texto tal cual; quien lo usa decide qué hacer con lo que no
 * es un número. Al salir del campo vuelve a mostrarse el valor real.
 *
 * Con `alConfirmar` lo tecleado NO se avisa letra por letra (`onEscribe`): se entrega una sola vez, al salir del campo o con
 * Enter, y solo si cambió y no quedó vacío. Para valores que arrastran otros datos —las series de un Set—, donde el «1» que se
 * pasa por el camino al escribir «12» no debe tocar nada.
 */
export function Contador({
  texto, onMenos, onMas, menosApagado = false, masApagado = false, etiqueta = '', ancho = 52, editable = false, onEscribe,
  alConfirmar, teclado = 'numeric',
}) {
  const [borrador, setBorrador] = useState(null);
  const btn = (apagado) => ({
    width: 28, height: 28, borderRadius: 8, border: `1px solid ${T.border}`, cursor: apagado ? 'default' : 'pointer',
    background: T.bg2, color: T.text, display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 15,
    fontFamily: FONT, opacity: apagado ? 0.4 : 1, flexShrink: 0,
  });
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <button
        type="button" className="kp-accion" style={btn(menosApagado)} onClick={menosApagado ? undefined : onMenos}
        aria-label={`Menos${etiqueta ? ` ${etiqueta}` : ''}`}
      >−</button>
      {editable ? (
        <input
          value={borrador ?? texto} inputMode={teclado} size={2} aria-label={etiqueta || undefined}
          onChange={(e) => { setBorrador(e.target.value); onEscribe?.(e.target.value); }}
          onKeyDown={alConfirmar ? (e) => { if (e.key === 'Enter') e.currentTarget.blur(); } : undefined}
          onBlur={() => {
            if (alConfirmar && borrador !== null && borrador !== texto && borrador.trim() !== '') alConfirmar(borrador.trim());
            setBorrador(null);
          }}
          style={{
            width: ancho - 14, textAlign: 'center', fontWeight: 800, fontSize: 15, color: T.text, fontFamily: FONT,
            border: 'none', background: 'transparent', outline: 'none', padding: 0,
          }}
        />
      ) : (
        <span style={{ minWidth: ancho, textAlign: 'center', fontWeight: 800, fontSize: 15, color: T.text }}>{texto}</span>
      )}
      <button
        type="button" className="kp-accion" style={btn(masApagado)} onClick={masApagado ? undefined : onMas}
        aria-label={`Más${etiqueta ? ` ${etiqueta}` : ''}`}
      >+</button>
    </span>
  );
}
