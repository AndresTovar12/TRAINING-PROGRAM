import { FONT, KP, UI } from '@/lib/theme';

/* Las piezas visuales del inicio, en un solo sitio: las usan el flujo (`Inicio`), la puerta (`features/auth/Puerta`) y la pantalla de conectar el reloj.

   El inicio nuevo (30 oct 2026, prototipo HUZVXJGnGrGaZeBq4e3wrv) va con el estilo de `components/ui`: botones planos como `Boton` (sin degradado), campos y
   opciones grises SIN borde, y lo elegido en azul suave con su anillo. Antes eran tarjetas blancas con borde de 1.5 px. */

export const titulo = (compu) => ({
  fontSize: compu ? 30 : 27, fontWeight: 800, letterSpacing: -0.6, lineHeight: 1.12, color: KP.ink,
  margin: '16px 0 8px', textWrap: 'balance', fontFamily: FONT,
});

export const subtitulo = {
  fontSize: 15, color: KP.ink2, lineHeight: 1.45, margin: '0 0 20px', fontWeight: 500, fontFamily: FONT, textWrap: 'pretty',
};

/** El botón azul de cada pantalla: el `principal` de `Boton`, a todo el ancho y de 54 px. */
export const botonPrimario = (ocupado = false, apagado = false) => ({
  width: '100%', minHeight: 54, borderRadius: 17, border: 'none', cursor: ocupado || apagado ? 'default' : 'pointer',
  background: KP.blue, color: '#fff', fontFamily: FONT,
  fontSize: 16, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  boxShadow: apagado ? 'none' : '0 8px 20px -6px rgba(30,64,224,0.45)', opacity: apagado ? 0.4 : ocupado ? 0.75 : 1, touchAction: 'manipulation',
});

/** La otra opción: gris claro, como el `secundario` de `Boton`. */
export const botonSecundario = {
  width: '100%', minHeight: 52, borderRadius: 16, border: 'none', background: UI.relleno,
  color: KP.ink, fontFamily: FONT, fontSize: 15.5, fontWeight: 700, cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10, touchAction: 'manipulation',
};

export const enlace = {
  width: '100%', minHeight: 44, background: 'none', border: 'none', color: KP.ink2, fontWeight: 700, fontSize: 14.5,
  padding: '10px 8px', cursor: 'pointer', fontFamily: FONT, touchAction: 'manipulation',
};

/** Gris de los campos y de las opciones sin elegir. */
export const GRIS = '#F4F5F8';

/** Una opción de lista (una por renglón). `puesta` = elegida: azul suave con su anillo. */
export const opcion = (puesta) => ({
  display: 'flex', alignItems: 'center', gap: 13, width: '100%', minHeight: 62, padding: '10px 14px 10px 12px',
  borderRadius: 18, border: 'none', background: puesta ? KP.blueSoft : GRIS,
  // estilo-ok: el anillo azul marca la opción elegida
  boxShadow: puesta ? `inset 0 0 0 2px ${KP.blue}` : 'none', textAlign: 'left', cursor: 'pointer',
  fontFamily: FONT, fontSize: 16, fontWeight: 700, color: KP.ink, transition: 'background .15s, box-shadow .15s',
  touchAction: 'manipulation',
});

/** El botón de respuesta del estilo C («Sí, tengo su código»): gris, ancho, con su ícono azul. Un toque guarda y sigue. */
export const elige = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, width: '100%', minHeight: 58, border: 'none',
  borderRadius: 18, background: GRIS, color: KP.ink, fontFamily: FONT, fontSize: 16.5, fontWeight: 700, cursor: 'pointer',
  touchAction: 'manipulation',
};

export const cuadroDeIcono = (fondo = '#fff', color = KP.blue, lado = 42) => ({
  width: lado, height: lado, borderRadius: Math.round(lado * 0.31), display: 'grid', placeItems: 'center',
  flexShrink: 0, overflow: 'hidden', background: fondo, color,
});

export const rotulo = {
  fontSize: 13, fontWeight: 700, color: KP.ink2, fontFamily: FONT,
};

/** La caja de un campo: gris y sin borde; al escribir, blanca con el anillo azul. */
export const cajaDeCampo = (enfocado) => ({
  display: 'flex', alignItems: 'center', gap: 10, minHeight: 54, padding: '0 14px', borderRadius: 15,
  background: enfocado ? '#fff' : GRIS,
  // estilo-ok: el anillo azul dice en qué campo se está escribiendo
  boxShadow: enfocado ? `inset 0 0 0 2px ${KP.blue}` : 'none', transition: 'box-shadow .12s, background .12s',
});

export const entrada = {
  flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontFamily: FONT,
  // 16 px: por debajo, el iPhone acerca la pantalla al escribir.
  fontSize: 16, fontWeight: 600, color: KP.ink, padding: '12px 0',
};

/** La letra chica gris, centrada (debajo de los botones de la puerta, arriba de las respuestas del estilo C). */
export const letraChica = {
  margin: '2px 0 0', textAlign: 'center', fontSize: 12.5, color: KP.ink3, lineHeight: 1.4, fontFamily: FONT, fontWeight: 500,
};

export const error = {
  color: KP.danger, fontSize: 13.5, fontWeight: 700, margin: '0 0 12px', fontFamily: FONT, lineHeight: 1.4,
};
