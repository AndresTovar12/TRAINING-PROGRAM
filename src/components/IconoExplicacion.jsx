/**
 * El icono de «explicación»: una persona que habla y una cámara que la graba.
 *
 * Andrés, 7 oct 2026: un micrófono parece «grabar audio» y un bocadillo de texto «no me encantó»; pidió «un símbolo de una
 * cámara grabando a una personita hablando». No existe en lucide: se dibuja aquí con el mismo trazo (rejilla de 24, línea de 2,
 * extremos redondeados) y se usa igual que uno de lucide: `<IconoExplicacion size={16} />`. Toma el color del texto.
 */
export default function IconoExplicacion({ size = 16, strokeWidth = 2, style, ...resto }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, ...style }} {...resto}
    >
      {/* la persona */}
      <circle cx="7.5" cy="9.5" r="3" />
      <path d="M1.5 21v-1a6 6 0 0 1 12 0v1" />
      {/* la cámara, a la altura de su cara */}
      <rect x="14.5" y="8" width="7" height="6" rx="1.3" />
      <path d="M14.5 9.6 11.5 8v6l3-1.6" />
      {/* las ondas de hablar */}
      <path d="M11 4.2a2.2 2.2 0 0 1 0 3" />
      <path d="M12.6 3.2a3.4 3.4 0 0 1 0 4.6" />
    </svg>
  );
}
