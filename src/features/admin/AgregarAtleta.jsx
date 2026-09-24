import { useState } from 'react';
import { Check, Copy, Loader2, Share2, UserPlus, X } from 'lucide-react';
import { invitarAtleta, ligaDeInvitacion } from '@/lib/api';
import { T, FONT, KP } from '@/lib/theme';

/**
 * Dar de alta a un cliente sin esperar a que se registre.
 *
 * Andrés, 24 sep 2026: "que la app le pida al coach Nombre del cliente,
 * Apellido del cliente (QUE NO LE PIDA CORREO), y que ya con el nombre y
 * apellido se le pueda picar un botón de generar link de invitación... desde
 * que el coach genera el link, el cliente se agrega a su lista y puede ir
 * trabajando en el atleta aunque el atleta aún no active su cuenta".
 *
 * Dos campos y un botón. El correo es cosa del cliente, no del coach: él no
 * tiene por qué saberlo ni tener que preguntárselo antes de poder trabajar.
 */
export default function AgregarAtleta({ onCerrar, onCreado }) {
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState('');
  const [listo, setListo] = useState(null); // { token, full_name }
  const [copiado, setCopiado] = useState(false);

  const liga = listo ? ligaDeInvitacion(listo.token) : '';

  async function generar(e) {
    e.preventDefault();
    if (!nombre.trim()) return;
    setError('');
    setCreando(true);
    try {
      const r = await invitarAtleta({ nombre: nombre.trim(), apellido: apellido.trim() });
      setListo(r);
      // Se avisa ya: el atleta existe desde este momento y tiene que aparecer
      // en la lista aunque el coach todavía no cierre esta ventana.
      onCreado?.(r);
    } catch (err) {
      setError(err.message);
    } finally {
      setCreando(false);
    }
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(liga);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Safari niega el portapapeles si la llamada no nace de un toque, y en
      // http a secas directamente no existe. Se deja el texto seleccionable
      // para copiarlo a mano; avisar de un fallo que no puede arreglar no
      // ayuda a nadie.
      setCopiado(false);
    }
  }

  async function compartir() {
    try {
      await navigator.share({
        title: 'Tu invitación a Training Lab',
        text: `${listo.full_name}, aquí está tu acceso a Training Lab:`,
        url: liga,
      });
    } catch {
      // Cancelar la hoja de compartir llega como error. No es un fallo.
    }
  }

  const campo = (etiqueta, valor, set, props = {}) => (
    <label style={{ display: 'block' }}>
      <span style={{
        display: 'block', fontSize: 11, fontWeight: 800, letterSpacing: 0.7,
        textTransform: 'uppercase', color: T.text3, marginBottom: 6,
      }}>
        {etiqueta}
      </span>
      <input
        value={valor}
        onChange={(e) => set(e.target.value)}
        style={{
          width: '100%', boxSizing: 'border-box', border: `1.5px solid ${T.border}`,
          borderRadius: 11, padding: '12px 13px', background: T.bg2, outline: 'none',
          fontFamily: FONT, fontSize: 16, fontWeight: 600, color: T.text,
        }}
        {...props}
      />
    </label>
  );

  return (
    <div
      onMouseDown={onCerrar}
      style={{
        position: 'fixed', inset: 0, zIndex: 2700, background: 'rgba(17,19,24,0.5)',
        backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center',
        justifyContent: 'center', padding: 18,
      }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="animate-fade-in"
        style={{
          width: '100%', maxWidth: 420, background: T.bg, borderRadius: 22,
          border: `1px solid ${T.border}`, boxShadow: KP.shPop, fontFamily: FONT,
          padding: '20px 20px 18px', maxHeight: '88svh', overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 11, flexShrink: 0, display: 'grid', placeItems: 'center',
              background: T.accentBg, color: T.accent,
            }}>
              <UserPlus size={19} />
            </div>
            <div style={{ fontSize: 16.5, fontWeight: 800, color: T.text }}>
              {listo ? 'Listo, ya es tu atleta' : 'Agregar atleta'}
            </div>
          </div>
          <button
            type="button" onClick={onCerrar} aria-label="Cerrar"
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: T.text2, padding: 4 }}
          >
            <X size={20} />
          </button>
        </div>

        {!listo ? (
          <form onSubmit={generar} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {campo('Nombre del cliente', nombre, setNombre, { placeholder: 'Juan', autoFocus: true, required: true })}
            {campo('Apellido del cliente', apellido, setApellido, { placeholder: 'Pérez' })}

            <p style={{ fontSize: 13, color: T.text2, lineHeight: 1.5, margin: 0, fontWeight: 500 }}>
              No hace falta su correo. En cuanto generes el link ya aparece en tu lista
              y puedes armarle el plan, aunque todavía no haya entrado.
            </p>

            {error && (
              <div role="alert" style={{
                background: 'rgba(220,38,38,0.08)', color: T.danger, borderRadius: 11,
                padding: '11px 13px', fontSize: 13.5, fontWeight: 600, lineHeight: 1.45,
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={creando || !nombre.trim()}
              style={{
                marginTop: 2, width: '100%', padding: '14px 18px', borderRadius: 999, border: 'none',
                background: `linear-gradient(140deg, ${KP.blue}, ${KP.blueDk})`, color: '#fff',
                cursor: creando || !nombre.trim() ? 'default' : 'pointer',
                opacity: creando || !nombre.trim() ? 0.55 : 1,
                fontFamily: FONT, fontSize: 15, fontWeight: 800, boxShadow: KP.shBtn,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
                touchAction: 'manipulation',
              }}
            >
              {creando && <Loader2 size={17} className="spin" />}
              {creando ? 'Creando…' : 'Generar link de invitación'}
            </button>
          </form>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={{ fontSize: 14.5, color: T.text2, lineHeight: 1.5, margin: 0, fontWeight: 500 }}>
              <strong style={{ color: T.text }}>{listo.full_name}</strong> ya está en tu lista.
              Mándale este link para que arme su cuenta.
            </p>

            {/* A la vista y seleccionable: si el portapapeles falla —Safari es
                quisquilloso— todavía se puede copiar a mano. */}
            <div style={{
              background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 12,
              padding: '11px 13px', fontSize: 12.5, fontWeight: 600, color: T.text2,
              wordBreak: 'break-all', lineHeight: 1.5, userSelect: 'all',
            }}>
              {liga}
            </div>

            <div style={{ display: 'flex', gap: 9 }}>
              <button
                type="button"
                onClick={copiar}
                style={{
                  flex: 1, minHeight: 46, borderRadius: 999, cursor: 'pointer',
                  border: `1.5px solid ${copiado ? T.accent : T.border}`,
                  background: copiado ? T.accentBg : T.bg2, color: copiado ? T.accent : T.text,
                  fontFamily: FONT, fontSize: 14.5, fontWeight: 800, touchAction: 'manipulation',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                {copiado ? <Check size={17} /> : <Copy size={16} />}
                {copiado ? 'Copiado' : 'Copiar'}
              </button>
              {typeof navigator !== 'undefined' && navigator.share && (
                <button
                  type="button"
                  onClick={compartir}
                  style={{
                    flex: 1, minHeight: 46, borderRadius: 999, border: 'none', cursor: 'pointer',
                    background: `linear-gradient(140deg, ${KP.blue}, ${KP.blueDk})`, color: '#fff',
                    fontFamily: FONT, fontSize: 14.5, fontWeight: 800, boxShadow: KP.shBtn,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    touchAction: 'manipulation',
                  }}
                >
                  <Share2 size={16} /> Compartir
                </button>
              )}
            </div>

            <p style={{ fontSize: 12.5, color: T.text3, lineHeight: 1.5, margin: 0, fontWeight: 500 }}>
              El link no caduca. Deja de servir cuando lo use, o si desactivas o eliminas
              al atleta desde tu lista.
            </p>

            <button
              type="button"
              onClick={onCerrar}
              style={{
                width: '100%', minHeight: 44, borderRadius: 999, cursor: 'pointer',
                border: `1.5px solid ${T.border}`, background: 'transparent', color: T.text,
                fontFamily: FONT, fontSize: 14.5, fontWeight: 700, touchAction: 'manipulation',
              }}
            >
              Terminar
            </button>
          </div>
        )}

        <style>{'.spin{animation:spin .8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}'}</style>
      </div>
    </div>
  );
}
