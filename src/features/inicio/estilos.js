import { FONT, KP } from '@/lib/theme';

/* Las piezas visuales del inicio, en un solo sitio: las usan el flujo (`Inicio`) y el recorrido (`Recorrido`). */

export const titulo = (compu) => ({
  fontSize: compu ? 30 : 27, fontWeight: 800, letterSpacing: -0.6, lineHeight: 1.12, color: KP.ink,
  margin: '16px 0 8px', textWrap: 'balance', fontFamily: FONT,
});

export const subtitulo = {
  fontSize: 15, color: KP.ink2, lineHeight: 1.45, margin: '0 0 20px', fontWeight: 500, fontFamily: FONT,
};

export const botonPrimario = (ocupado = false, apagado = false) => ({
  width: '100%', minHeight: 54, borderRadius: 17, border: 'none', cursor: ocupado || apagado ? 'default' : 'pointer',
  background: `linear-gradient(140deg, ${KP.blue}, ${KP.blueDk})`, color: '#fff', fontFamily: FONT,
  fontSize: 16, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  boxShadow: apagado ? 'none' : KP.shBtn, opacity: apagado ? 0.45 : ocupado ? 0.75 : 1, touchAction: 'manipulation',
});

export const botonSecundario = {
  width: '100%', minHeight: 52, borderRadius: 16, border: `1.5px solid ${KP.lineHi}`, background: KP.surface,
  color: KP.ink, fontFamily: FONT, fontSize: 15.5, fontWeight: 700, cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10, touchAction: 'manipulation',
};

export const enlace = {
  width: '100%', background: 'none', border: 'none', color: KP.ink2, fontWeight: 700, fontSize: 14.5,
  padding: 8, cursor: 'pointer', fontFamily: FONT, touchAction: 'manipulation',
};

/** Una opción de lista (una por renglón). `puesta` = elegida. */
export const opcion = (puesta) => ({
  display: 'flex', alignItems: 'center', gap: 13, width: '100%', minHeight: 64, padding: '10px 14px 10px 12px',
  borderRadius: 18, border: `1.5px solid ${puesta ? KP.blue : KP.lineHi}`, background: puesta ? KP.blueSoft : KP.surface,
  boxShadow: puesta ? '0 0 0 4px rgba(30,64,224,0.08)' : 'none', textAlign: 'left', cursor: 'pointer',
  fontFamily: FONT, fontSize: 16, fontWeight: 700, color: KP.ink, transition: 'border-color .12s, background .12s',
  touchAction: 'manipulation',
});

/** La tarjeta grande (una pregunta de dos respuestas). */
export const tarjeta = (puesta) => ({
  display: 'flex', flexDirection: 'column', gap: 6, width: '100%', padding: '18px 18px 16px', borderRadius: 22,
  border: `1.5px solid ${puesta ? KP.blue : KP.lineHi}`, background: puesta ? KP.blueSoft : KP.surface,
  boxShadow: puesta ? '0 0 0 4px rgba(30,64,224,0.08)' : 'none', textAlign: 'left', cursor: 'pointer',
  fontFamily: FONT, color: KP.ink, touchAction: 'manipulation',
});

export const cuadroDeIcono = (fondo = KP.blueSoft, color = KP.blue, lado = 46) => ({
  width: lado, height: lado, borderRadius: Math.round(lado * 0.28), display: 'grid', placeItems: 'center',
  flexShrink: 0, overflow: 'hidden', background: fondo, color,
});

export const rotulo = {
  fontSize: 11, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', color: KP.ink2, fontFamily: FONT,
};

export const cajaDeCampo = (enfocado) => ({
  display: 'flex', alignItems: 'center', gap: 10, minHeight: 54, padding: '0 14px', borderRadius: 15,
  border: `1.5px solid ${enfocado ? KP.blue : KP.lineHi}`, background: KP.surface,
  boxShadow: enfocado ? '0 0 0 4px rgba(30,64,224,0.10)' : 'none', transition: 'border-color .12s, box-shadow .12s',
});

export const entrada = {
  flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontFamily: FONT,
  // 16 px: por debajo, el iPhone acerca la pantalla al escribir.
  fontSize: 16, fontWeight: 600, color: KP.ink, padding: '12px 0',
};

/** El aviso azul de «nada se bloquea» y la tarjeta de «siempre puedes». */
export const garantia = {
  display: 'flex', gap: 11, alignItems: 'flex-start', background: KP.blueSoft, borderRadius: 16, padding: '12px 14px',
  marginTop: 16, fontSize: 14, fontWeight: 600, lineHeight: 1.45, color: KP.ink, fontFamily: FONT,
};

export const error = {
  color: KP.danger, fontSize: 13.5, fontWeight: 700, margin: '0 0 12px', fontFamily: FONT, lineHeight: 1.4,
};
