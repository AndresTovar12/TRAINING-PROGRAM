import { useRef, useState } from 'react';
import HojaFlotante from '@/components/HojaFlotante';
import { LT, FONT } from '@/lib/theme';
import { conFoco, separaFoto } from '@/lib/fotoConFoco';

/**
 * Elegir qué parte de la foto NO debe cortarse (Andrés, 7 oct 2026: «encuadrar la foto»).
 *
 * La foto se enseña completa. Se toca (o se arrastra) el punto que debe verse siempre, y abajo se ven las dos formas en
 * que la tarjeta de Home la recorta: la del celular (angosta y alta) y la de la compu (ancha y baja), cada una alrededor
 * de ese punto. El punto se guarda al soltar (un solo paso en el historial), pegado a la dirección de la foto
 * (`lib/fotoConFoco.js`).
 *
 * `valor`: la foto, con su punto si ya lo tiene. `onCambia(nuevo)`: llega la misma foto con el punto elegido.
 */
const VISTAS = [
  { etiqueta: 'Celular', relacion: 165 / 232, ancho: 92 },
  { etiqueta: 'Compu', relacion: 380 / 232, ancho: 152 },
];

const boton = {
  flex: 1, minHeight: 46, borderRadius: 13, cursor: 'pointer', fontFamily: FONT, fontSize: 14.5, fontWeight: 800, touchAction: 'manipulation',
};

export default function EncuadreDeFoto({ valor, onCambia, onCerrar }) {
  const { url, x: x0, y: y0 } = separaFoto(valor);
  const [punto, setPunto] = useState({ x: x0, y: y0 });
  // Lo último elegido, para guardarlo al soltar sin esperar a que React pinte.
  const ultimo = useRef(punto);
  const escenario = useRef(null);
  const arrastrando = useRef(false);
  // Una foto alta no debe ocupar toda la pantalla: se limita al 40% de su alto (que quepan también las vistas y los botones).
  const [relacion, setRelacion] = useState(null);

  const poner = (x, y) => {
    const nuevo = { x: Math.min(100, Math.max(0, Math.round(x))), y: Math.min(100, Math.max(0, Math.round(y))) };
    ultimo.current = nuevo;
    setPunto(nuevo);
  };
  const desdeElDedo = (e) => {
    const r = escenario.current.getBoundingClientRect();
    poner(((e.clientX - r.left) / r.width) * 100, ((e.clientY - r.top) / r.height) * 100);
  };
  const guarda = () => onCambia(conFoco(valor, ultimo.current.x, ultimo.current.y));

  const alSoltar = () => {
    if (!arrastrando.current) return;
    arrastrando.current = false;
    guarda();
  };
  const conTeclado = (e) => {
    const paso = e.shiftKey ? 10 : 2;
    const mueve = { ArrowLeft: [-paso, 0], ArrowRight: [paso, 0], ArrowUp: [0, -paso], ArrowDown: [0, paso] }[e.key];
    if (!mueve) return;
    e.preventDefault();
    poner(ultimo.current.x + mueve[0], ultimo.current.y + mueve[1]);
    guarda();
  };
  const centrar = () => { poner(50, 50); guarda(); };

  return (
    <HojaFlotante titulo="Encuadrar la foto" subtitulo="Toca lo que no debe cortarse." onCerrar={onCerrar}>
      <div style={{ fontFamily: FONT }}>
        <div
          ref={escenario} tabIndex={0} role="group"
          aria-label={`Punto que debe verse siempre: ${punto.x}% desde la izquierda, ${punto.y}% desde arriba. Las flechas lo mueven.`}
          onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); arrastrando.current = true; desdeElDedo(e); }}
          onPointerMove={(e) => { if (arrastrando.current) desdeElDedo(e); }}
          onPointerUp={alSoltar} onPointerCancel={alSoltar} onKeyDown={conTeclado}
          style={{
            position: 'relative', margin: '0 auto', lineHeight: 0, borderRadius: 14, overflow: 'hidden', cursor: 'crosshair', touchAction: 'none',
            userSelect: 'none', outline: 'none', width: relacion ? `min(100%, ${(40 * relacion).toFixed(1)}vh)` : '100%', background: LT.surface2,
          }}
        >
          <img
            src={url} alt="Foto" draggable={false}
            onLoad={(e) => setRelacion(e.currentTarget.naturalWidth / e.currentTarget.naturalHeight)}
            style={{ width: '100%', display: 'block', pointerEvents: 'none' }}
          />
          <span
            aria-hidden="true"
            style={{
              position: 'absolute', left: `${punto.x}%`, top: `${punto.y}%`, width: 34, height: 34, marginLeft: -17, marginTop: -17,
              borderRadius: '50%', border: '3px solid #fff', boxShadow: '0 0 0 1.5px rgba(0,0,0,0.35), 0 2px 10px rgba(0,0,0,0.45)',
              pointerEvents: 'none', display: 'grid', placeItems: 'center',
            }}
          >
            <i style={{ width: 6, height: 6, borderRadius: 3, background: '#fff', boxShadow: '0 0 0 1px rgba(0,0,0,0.4)' }} />
          </span>
        </div>

        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', justifyContent: 'center', marginTop: 16, flexWrap: 'wrap' }}>
          {VISTAS.map((v) => (
            <div key={v.etiqueta} style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
              <div style={{ width: v.ancho, aspectRatio: String(v.relacion), borderRadius: 14, overflow: 'hidden', background: LT.surface2 }}>
                <img
                  src={url} alt="" draggable={false}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: `${punto.x}% ${punto.y}%`, display: 'block' }}
                />
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: LT.text2 }}>{v.etiqueta}</span>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button type="button" onClick={centrar} style={{ ...boton, border: `1.5px solid ${LT.border}`, background: LT.surface, color: LT.text }}>
            Centrar
          </button>
          <button type="button" onClick={onCerrar} style={{ ...boton, border: 'none', background: LT.blue, color: '#fff' }}>
            Listo
          </button>
        </div>
      </div>
    </HojaFlotante>
  );
}
