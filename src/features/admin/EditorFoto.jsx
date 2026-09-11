/**
 * La pantalla que sale entre elegir una foto y subirla.
 *
 * POR QUE EXISTE, Y POR QUE ES IGUAL QUE LA DE VIDEO:
 * Las fotos se subían de golpe. Se elegía el archivo y ya estaba arriba, sin
 * preguntar nada. Los videos, en cambio, sí abrían un editor donde se decidía
 * para quién era. Resultado: la mitad de "hombre / mujer" existía y la otra
 * mitad no, y Andrés no la encontraba por ningún lado — con razón, porque
 * para fotos NUNCA se preguntaba.
 *
 * Ahora las dos siguen el mismo camino: eliges, ves lo que elegiste, decides
 * para quién es, y entonces se sube. Es el orden de WhatsApp, y es el que ya
 * tenían los videos.
 *
 * QUE NO HACE: recortar ni encuadrar. Una foto de portada se ve en un recuadro
 * que ya la recorta al centro, y Andrés dijo que lo que le importa es la
 * calidad y no el encuadre. Meter aquí un editor de imagen sería trabajo para
 * un problema que nadie tiene.
 */
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Check, Loader2, Users } from 'lucide-react';
import { MOMENTOS_SUGERIDOS } from '@/lib/videos';
import { FONT } from '@/lib/theme';

export default function EditorFoto({
  // `archivo` = recién elegida del teléfono, todavía sin subir.
  // `url` = ya está arriba y solo se está cambiando para quién es.
  archivo, url, tamaño, subiendo, avance,
  generoInicial = '', etiquetaInicial = '',
  onCancelar, onListo,
}) {
  const [genero, setGenero] = useState(generoInicial);
  const [etiqueta, setEtiqueta] = useState(etiquetaInicial);

  /* La dirección temporal del archivo del teléfono. Se calcula al vuelo y no
     con estado, por lo mismo que en el editor de video: guardarla en estado
     obliga a escribir dentro de un efecto y eso cuesta un render de más. El
     efecto de abajo solo la libera; si no, el navegador se queda con la foto
     entera en memoria hasta recargar la página. */
  const local = useMemo(
    () => (archivo ? URL.createObjectURL(archivo) : (url ?? null)),
    [archivo, url],
  );
  // Solo se libera lo que se creó aquí. Soltar una dirección de Cloudflare
  // rompería la foto en el resto de la pantalla.
  useEffect(() => () => { if (archivo && local) URL.revokeObjectURL(local); }, [archivo, local]);

  const píldora = (activo) => ({
    minHeight: 40, padding: '0 15px', borderRadius: 999, cursor: 'pointer', flexShrink: 0,
    border: `1.5px solid ${activo ? '#fff' : 'rgba(255,255,255,.25)'}`,
    background: activo ? '#fff' : 'transparent',
    color: activo ? '#111318' : 'rgba(255,255,255,.85)',
    fontFamily: FONT, fontSize: 13.5, fontWeight: 700, whiteSpace: 'nowrap',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
  });

  const mb = tamaño ? Math.round((tamaño / 1048576) * 10) / 10 : null;

  return createPortal((
    <div style={{
      position: 'fixed', inset: 0, zIndex: 6000, background: '#000',
      display: 'flex', flexDirection: 'column', fontFamily: FONT,
    }}>
      {/* ---------- Salir ---------- */}
      <div style={{
        padding: 'calc(12px + env(safe-area-inset-top)) 16px 12px', flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <button
          type="button" onClick={onCancelar} disabled={subiendo} aria-label="Cancelar"
          style={{
            width: 42, height: 42, borderRadius: '50%', border: 'none',
            background: 'rgba(255,255,255,.14)', color: '#fff',
            cursor: subiendo ? 'default' : 'pointer',
            display: 'grid', placeItems: 'center', flexShrink: 0,
          }}
        >
          <X size={20} />
        </button>
        <span style={{ color: 'rgba(255,255,255,.62)', fontSize: 12.5, fontWeight: 700 }}>
          <Users size={13} style={{ verticalAlign: -2, marginRight: 6 }} />
          Para quién es esta foto
        </span>
      </div>

      {/* ---------- La foto ---------- */}
      <div style={{
        flex: 1, minHeight: 0, display: 'grid', placeItems: 'center',
        padding: '4px 18px 14px',
      }}>
        {local && (
          <img
            src={local}
            alt=""
            style={{
              maxWidth: '100%', maxHeight: '100%', objectFit: 'contain',
              display: 'block', borderRadius: 12,
            }}
          />
        )}
      </div>

      {/* ---------- Las dos preguntas ---------- */}
      <div style={{ flexShrink: 0, padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,.62)', marginBottom: 8 }}>
            ¿Quién debe ver esta foto?
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[['', 'Para todos'], ['h', 'Hombres'], ['m', 'Mujeres']].map(([v, t]) => (
              <button key={v || 'todos'} type="button" onClick={() => setGenero(v)}
                style={{ ...píldora(genero === v), flex: 1 }}>
                {t}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,.62)', marginBottom: 8 }}>
            ¿Qué muestra? <span style={{ fontWeight: 600 }}>(opcional)</span>
          </div>
          <input
            value={etiqueta}
            onChange={(e) => setEtiqueta(e.target.value)}
            placeholder="Posición inicial, Final, Detalle…"
            list="momentos-editor"
            style={{
              width: '100%', boxSizing: 'border-box', borderRadius: 11,
              border: '1.5px solid rgba(255,255,255,.25)', background: 'transparent',
              padding: '11px 13px', color: '#fff', fontFamily: FONT,
              // 16px o menos hace que iPhone acerque la pantalla al escribir.
              fontSize: 16, fontWeight: 600, outline: 'none',
            }}
          />
          <datalist id="momentos-editor">
            {MOMENTOS_SUGERIDOS.map((m) => <option key={m} value={m} />)}
          </datalist>
        </div>
      </div>

      {/* ---------- Confirmar ---------- */}
      <div style={{
        flexShrink: 0, padding: '14px 16px calc(16px + env(safe-area-inset-bottom))',
        display: 'flex', alignItems: 'center', gap: 14,
      }}>
        <div style={{ flex: 1, minWidth: 0, color: 'rgba(255,255,255,.62)', fontSize: 12.5, fontWeight: 600 }}>
          {subiendo
            ? `Subiendo… ${avance ?? 0}%`
            : genero
              ? `Solo la verán ${genero === 'h' ? 'los hombres' : 'las mujeres'}`
              : (mb ? `${mb} MB` : '')}
        </div>
        <button
          type="button"
          disabled={subiendo}
          onClick={() => onListo({ genero, etiqueta })}
          aria-label="Usar esta foto"
          style={{
            width: 58, height: 58, borderRadius: '50%', border: 'none', flexShrink: 0,
            background: subiendo ? 'rgba(255,255,255,.2)' : '#1E40E0',
            color: '#fff', cursor: subiendo ? 'default' : 'pointer',
            display: 'grid', placeItems: 'center',
          }}
        >
          {subiendo ? <Loader2 size={26} className="spin" /> : <Check size={28} strokeWidth={2.6} />}
        </button>
      </div>
    </div>
  ), document.body);
}
