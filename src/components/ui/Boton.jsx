import { Loader2 } from 'lucide-react';
import { FONT, KP, UI } from '@/lib/theme';

/**
 * El botón de la app (reestructura visual, 15 oct 2026).
 *
 * Cinco tipos, y cada uno dice algo distinto. Antes cada pantalla armaba el suyo y salían quince
 * botones parecidos que no eran iguales:
 *   principal   azul lleno: LA acción de la pantalla («Publicar», «Empezar», «Listo»). Una por pantalla.
 *   secundario  gris claro: la otra opción («Guardar», «Descartar», «Editar»).
 *   blanco      blanco: va encima de una tarjeta azul («Empezar» en «Hoy te toca»).
 *   peligro     rojo suave: quitar o retirar algo.
 *   texto       solo letras azules: acciones chicas dentro de una fila o al pie.
 *
 * `cargando` pone el giro y lo apaga: así nadie lo toca dos veces mientras espera.
 * `ancho` lo estira a todo el ancho; `chico` lo deja de 40 px para filas y tarjetas.
 */
const TIPOS = {
  principal: { background: KP.blue, color: '#fff', boxShadow: '0 8px 20px rgba(30,64,224,0.22)' },
  secundario: { background: UI.relleno, color: KP.ink },
  blanco: { background: '#fff', color: KP.blue, boxShadow: '0 6px 16px rgba(10,20,80,0.18)' },
  peligro: { background: KP.dangerSoft, color: KP.danger },
  texto: { background: 'transparent', color: KP.blue, padding: '0 4px' },
};

export default function Boton({
  tipo = 'principal', children, onClick, cargando = false, deshabilitado = false, ancho = false, chico = false,
  icono: Icono, type = 'button', estilo, ...resto
}) {
  const apagado = deshabilitado || cargando;
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={apagado}
      aria-busy={cargando || undefined}
      className="kp-press"
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        minHeight: chico ? 40 : UI.altoBoton, padding: chico ? '0 14px' : '0 22px', width: ancho ? '100%' : undefined,
        borderRadius: chico ? 12 : UI.rBoton, border: 'none', fontFamily: FONT, fontSize: chico ? 14.5 : 16, fontWeight: 700,
        cursor: apagado ? 'default' : 'pointer', opacity: deshabilitado ? 0.45 : 1, touchAction: 'manipulation', whiteSpace: 'nowrap',
        ...TIPOS[tipo], ...estilo,
      }}
      {...resto}
    >
      {cargando ? <Loader2 size={chico ? 16 : 18} className="spin" /> : Icono ? <Icono size={chico ? 16 : 18} strokeWidth={2.2} /> : null}
      {children}
    </button>
  );
}
