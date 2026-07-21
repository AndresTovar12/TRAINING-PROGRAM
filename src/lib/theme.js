// Tokens de tema en JS (estilos inline migrados verbatim del original).
// Los design tokens equivalentes en CSS estan en src/index.css (@theme).
const T = {
  bg: '#F4F5F8', bg2: '#FFFFFF', bg3: '#EDEFF3', bgInteract: '#E2E6EE',
  border: '#E5E7EB', borderHi: '#D1D5DB',
  text: '#111318', text2: '#6B7280', text3: '#9CA3AF', text4: '#C2C7D0',
  accent: '#1E40E0', accentDk: '#1733B8', accentBg: 'rgba(30, 64, 224, 0.10)',
  warning: '#E07B00', danger: '#DC2626', info: '#1E40E0', violet: '#7C5CFF',
};
const FONT = `"Inter", -apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif`;
const NUM_STYLE = { fontFeatureSettings: '"tnum" 1', fontVariantNumeric: 'tabular-nums' };

// Light theme (Home y pantallas migradas)
const LT = {
  bg: '#F4F5F8', surface: '#FFFFFF', surface2: '#EDEFF3', surfaceBlue: '#1E40E0',
  text: '#111318', text2: '#6B7280', text3: '#9CA3AF',
  blue: '#1E40E0', blueDk: '#1733B8', blueSoft: '#E8ECFD',
  border: '#E5E7EB', borderHi: '#D1D5DB',
  mint: '#00A372', warning: '#E07B00', danger: '#DC2626', info: '#1E40E0',
};

const PHASE_COLORS = {
  f1: '#3DD9A0', f2: '#A0E055', f3: '#A480FF', f4: '#5DA0FF',
  f5: '#FFA047', deload: '#7A7A88', f6: '#FF7A52', f7: '#6C7A8A', f8: '#FF80B8',
};
const DAY_FULL = { Lun: 'Lunes', Mar: 'Martes', 'Mié': 'Miércoles', Mie: 'Miércoles', Jue: 'Jueves', Vie: 'Viernes', 'Sáb': 'Sábado', Sab: 'Sábado', Dom: 'Domingo' };

const CAT_COLORS = {
  gym: { c: '#A480FF', label: 'Gym' }, speed: { c: '#FFA047', label: 'Neural' },
  recovery: { c: '#3DD9A0', label: 'Recovery' }, football: { c: '#FF7A52', label: 'Cancha' },
  tests: { c: '#5DA0FF', label: 'Tests' }, team: { c: '#9090A0', label: 'Equipo' },
  off: { c: '#555562', label: 'OFF' },
};

/* ============================================================
   KINETIC PRECISION — sistema visual (dirección elegida en Stitch)
   Misma paleta de siempre, lenguaje visual elevado: sombras planas
   y suaves, tarjetas de 22px, etiquetas "eyebrow" en mayúsculas,
   acentos con fondo suave y una escala de espaciado de 8pt.
   ============================================================ */
const KP = {
  // Superficies
  bg: '#F4F5F8',
  surface: '#FFFFFF',
  surfaceMuted: '#F7F8FB',
  // Tinta (contraste AA sobre blanco)
  ink: '#111318',
  ink2: '#5B616E',
  ink3: '#9CA3AF',
  // Hairlines
  line: '#ECEEF2',
  lineHi: '#E1E4EA',
  // Marca + acentos (con su fondo suave)
  blue: '#1E40E0', blueDk: '#1733B8', blueSoft: '#EEF1FE',
  mint: '#00A372', mintSoft: '#E3F6EF',
  violet: '#7C5CFF', violetSoft: '#EFEBFF',
  amber: '#E07B00', amberSoft: '#FCF1E1',
  danger: '#DC2626', dangerSoft: '#FCEBEB',
  // Radii
  rChip: 10, rBtn: 14, rField: 16, rCard: 22, rPill: 999,
  // Sombras: muy suaves y planas (el sello Kinetic)
  shCard: '0 4px 20px rgba(17,19,24,0.04)',
  shRaise: '0 10px 30px rgba(17,19,24,0.07)',
  shBtn: '0 8px 22px rgba(30,64,224,0.24)',
  shPop: '0 16px 44px rgba(17,19,24,0.13)',
};

// Escala de espaciado base 8pt
const SPACE = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, x2: 32, x3: 48 };

// Mapa de acentos para tarjetas de métrica / chips de estado
const ACCENTS = {
  blue: { c: KP.blue, soft: KP.blueSoft },
  mint: { c: KP.mint, soft: KP.mintSoft },
  violet: { c: KP.violet, soft: KP.violetSoft },
  amber: { c: KP.amber, soft: KP.amberSoft },
  danger: { c: KP.danger, soft: KP.dangerSoft },
};

// Etiqueta superior (kicker): mayúsculas, tracking, gris
const eyebrow = (color = KP.ink3) => ({
  fontSize: 11, fontWeight: 700, letterSpacing: 1.4,
  textTransform: 'uppercase', color, lineHeight: 1,
});

// Tarjeta base Kinetic
const kpCard = (extra = {}) => ({
  background: KP.surface, borderRadius: KP.rCard,
  border: `1px solid ${KP.line}`, boxShadow: KP.shCard,
  ...extra,
});

export {
  T, FONT, NUM_STYLE, LT, PHASE_COLORS, DAY_FULL, CAT_COLORS,
  KP, SPACE, ACCENTS, eyebrow, kpCard,
};
