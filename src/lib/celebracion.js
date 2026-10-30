/* LA ENTRADA DE LAS CELEBRACIONES (30 oct 2026): el punto azul que llena la pantalla, el trazo que se dibuja, lo que salta y lo que sube. La usan la celebración
   al terminar un entreno (`CelebracionLibre`) y la bienvenida del inicio (`features/inicio/Bienvenida`): las dos entran igual, así que es una sola lista de
   movimientos. `.cele` es la clase de la capa: con «reducir movimiento» todo aparece ya puesto. */
export const MOVIMIENTOS_DE_CELEBRACION = `
  @keyframes cele-llena { from { transform: translate(-50%, -50%) scale(0.06); } to { transform: translate(-50%, -50%) scale(1); } }
  @keyframes cele-trazo { to { stroke-dashoffset: 0; } }
  @keyframes cele-salta { 0% { transform: scale(0.4); opacity: 0; } 60% { transform: scale(1.12); opacity: 1; } 100% { transform: scale(1); } }
  @keyframes cele-sube { from { transform: translateY(14px); opacity: 0; } to { transform: none; opacity: 1; } }
  @media (prefers-reduced-motion: reduce) { .cele, .cele * { animation-duration: 1ms !important; animation-delay: 0ms !important; animation-iteration-count: 1 !important; } }
`;
