/**
 * Las piezas para AGREGAR fotos y videos a un ejercicio, iguales en «Nuevo ejercicio» y en «Grabar o subir».
 *
 * POR QUÉ ESTÁN AQUÍ Y NO EN CADA PANTALLA. Las dos pantallas (`MediaAlCrear` y `MediaDelEjercicio`) ya habían tenido copias
 * distintas de los mismos botones y los arreglos llegaban a una sola. Esto es lo que tienen en común:
 *
 *   · DOS BOTONES IGUALES para grabar: «Grabar ejemplo» y «Grabar explicación». Andrés, 7 oct 2026: «no me gusta que "grabar el
 *     ejercicio" sea significativamente más notorio que la explicación porque puede haber varios coaches que prefieran grabar de
 *     una sola vez el ejercicio con la explicación y esta configuración visual solo va a hacer que le den clic al incorrecto».
 *     El botón que se toca ES la respuesta a «¿qué es este video?»: no se pregunta nada después.
 *   · La fila de tres chicos: tomar foto, del carrete y pegar liga. Esos dos últimos sí traen videos que nadie ha clasificado, así
 *     que ahí SÍ se pregunta (dos botones iguales). Una foto nunca pregunta.
 *   · La pastilla «Ejemplo ▾ / Explicación ▾» de cada video, para corregirlo si se tocó el botón equivocado.
 */
import { useState } from 'react';
import { Camera, Images, Link as LinkIcon, Video, ChevronDown, Check } from 'lucide-react';
import MediaUpload from '@/features/admin/MediaUpload';
import IconoExplicacion from '@/components/IconoExplicacion';
import { EJEMPLO, EXPLICACION, nombreDeProposito } from '@/lib/proposito';
import { T, FONT } from '@/lib/theme';

const chico = {
  flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center',
  justifyContent: 'center', gap: 6, minHeight: 66, padding: '0 6px', borderRadius: 15,
  border: `1px solid ${T.border}`, background: T.bg2, cursor: 'pointer', fontFamily: FONT,
};
const textoChico = { fontSize: 12, fontWeight: 700, color: T.text, whiteSpace: 'nowrap' };

/* En el teléfono cada botón mide la mitad de la pantalla: «Grabar explicación» no cabe en una línea y «Grabar ejemplo» sí, y el
   ícono de uno quedaba más arriba que el del otro. Las dos etiquetas van en dos líneas —el verbo y lo que se graba—, así los dos
   botones son idénticos por dentro. */
const enDosLineas = (texto) => {
  const [verbo, ...resto] = texto.split(' ');
  return <>{verbo}<br />{resto.join(' ')}</>;
};

/** Los dos botones de grabar, del mismo tamaño y el mismo color. `compacto` cuando ya hay archivos y solo es «agregar otro». */
export function DosBotonesDeGrabar({ onAjustes, compacto = false }) {
  const [arrastrando, setArrastrando] = useState(null);

  const boton = (proposito, Icono, enTelefonoTexto, enCompuTexto) => (
    <MediaUpload
      key={proposito}
      accept="video/*" kind="videos" value="" onChange={() => {}}
      proposito={proposito} onAjustes={onAjustes}
      botones={({ camara, carrete, suelta, busy, enTelefono }) => (
        <button
          type="button"
          onClick={enTelefono ? camara : carrete}
          disabled={busy}
          className="kp-press"
          /* Soltar el archivo encima. En la compu es el gesto natural. `onDragOver` con `preventDefault` es obligatorio: sin
             él el navegador se queda el archivo y abre el video en una pestaña, tirando el formulario a medias. */
          onDragOver={(e) => { e.preventDefault(); setArrastrando(proposito); }}
          onDragLeave={() => setArrastrando(null)}
          onDrop={(e) => { e.preventDefault(); setArrastrando(null); suelta(e.dataTransfer?.files?.[0]); }}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: compacto ? 6 : 9,
            minHeight: compacto ? 84 : 122, padding: compacto ? '10px 6px' : '14px 8px', border: 'none', borderRadius: compacto ? 16 : 20,
            cursor: busy ? 'default' : 'pointer', fontFamily: FONT, opacity: busy ? 0.75 : 1, textAlign: 'center',
            background: `linear-gradient(150deg, ${T.accent}, ${T.accentDk})`, color: '#fff',
            boxShadow: arrastrando === proposito ? '0 0 0 4px rgba(30,64,224,0.35), 0 10px 22px rgba(30,64,224,0.26)' : '0 10px 22px rgba(30,64,224,0.26)',
            transform: arrastrando === proposito ? 'scale(1.02)' : 'none', transition: 'box-shadow .15s, transform .15s',
            touchAction: 'manipulation',
          }}
        >
          <span style={{
            width: compacto ? 38 : 50, height: compacto ? 38 : 50, borderRadius: compacto ? 13 : 16, background: 'rgba(255,255,255,0.16)',
            display: 'grid', placeItems: 'center',
          }}>
            <Icono size={compacto ? 20 : 25} color="#fff" />
          </span>
          <span style={{ fontSize: compacto ? 13.5 : 15, fontWeight: 800, lineHeight: 1.15, textWrap: 'balance' }}>
            {busy ? 'Subiendo…' : arrastrando === proposito ? 'Suéltalo aquí' : enTelefono ? enDosLineas(enTelefonoTexto) : enCompuTexto}
          </span>
        </button>
      )}
    />
  );

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
      {boton(EJEMPLO, Video, 'Grabar ejemplo', 'Elegir ejemplo')}
      {boton(EXPLICACION, IconoExplicacion, 'Grabar explicación', 'Elegir explicación')}
    </div>
  );
}

/** Tomar foto · Del carrete · Pegar liga. «Del carrete» pregunta qué es solo si lo que se elige es un video. */
export function FilaDeTres({ onAjustes, onLiga }) {
  // En rejilla y no en fila: cada MediaUpload trae su propia caja alrededor del botón y, en una fila, cada caja mide lo que mide su
  // texto («Foto» angosto, «Pegar liga» ancho). Tres columnas iguales: las tres opciones pesan lo mismo.
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
      <MediaUpload
        accept="image/*" kind="covers" value="" onChange={() => {}}
        onAjustes={onAjustes}
        botones={({ camara, carrete, busy, preparando, enTelefono }) => (
          <button type="button" onClick={enTelefono ? camara : carrete} disabled={busy} style={chico}>
            <Camera size={20} color={T.text} />
            <span style={textoChico}>{busy ? (preparando ? 'Preparando…' : 'Subiendo…') : enTelefono ? 'Tomar foto' : 'Foto'}</span>
          </button>
        )}
      />
      <MediaUpload
        accept="image/*,video/*" kind="videos" value="" onChange={() => {}}
        preguntaProposito onAjustes={onAjustes}
        botones={({ carrete, busy, preparando }) => (
          <button type="button" onClick={carrete} disabled={busy} style={chico}>
            <Images size={20} color={T.text2} />
            <span style={textoChico}>{busy ? (preparando ? 'Preparando…' : 'Subiendo…') : 'Del carrete'}</span>
          </button>
        )}
      />
      <button type="button" onClick={onLiga} style={chico}>
        <LinkIcon size={20} color={T.text2} />
        <span style={textoChico}>Pegar liga</span>
      </button>
    </div>
  );
}

/**
 * Pegar una liga (TikTok, YouTube, un reel). Una liga es un video que nadie ha clasificado: en vez de un «Guardar», salen los
 * dos botones iguales («Ejemplo» / «Explicación»), y tocar uno guarda. `onGuarda(texto, proposito)` valida y dice `error`.
 */
export function PanelDeLiga({ onGuarda, onCancela, error }) {
  const [texto, setTexto] = useState('');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9, background: T.bg2, border: `1.5px solid ${T.accent}`, borderRadius: 16, padding: 12 }}>
      <input
        autoFocus
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Pega aquí la dirección del TikTok, YouTube o reel"
        aria-label="Liga del video"
        // 16 px: por debajo, el iPhone acerca la pantalla al escribir.
        style={{
          minHeight: 44, boxSizing: 'border-box', padding: '0 13px', borderRadius: 12, border: `1.5px solid ${T.border}`,
          background: T.bg, fontFamily: FONT, fontSize: 16, fontWeight: 600, color: T.text, outline: 'none',
        }}
      />
      <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>¿Qué es este video?</div>
      <SelectorDeProposito valor={null} onCambia={(p) => onGuarda(texto.trim(), p)} />
      {error && <div style={{ fontSize: 12.5, fontWeight: 700, color: T.danger, lineHeight: 1.4 }}>{error}</div>}
      <button
        type="button" onClick={onCancela}
        style={{ alignSelf: 'center', border: 'none', background: 'none', cursor: 'pointer', fontFamily: FONT, fontSize: 13.5, fontWeight: 700, color: T.text2, padding: '4px 10px' }}
      >
        Cancelar
      </button>
    </div>
  );
}

/** Los dos botones iguales «Ejemplo» / «Explicación». `valor` marca el que ya está puesto (null = ninguno: es una pregunta). */
export function SelectorDeProposito({ valor, onCambia }) {
  return (
    <div role="group" aria-label="Qué es este video" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
      {[[EJEMPLO, Video], [EXPLICACION, IconoExplicacion]].map(([id, Icono]) => {
        const puesto = valor === id;
        return (
          <button
            key={id} type="button" onClick={() => onCambia(id)} aria-pressed={valor == null ? undefined : puesto}
            className="kp-press"
            style={{
              minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, cursor: 'pointer',
              fontFamily: FONT, fontSize: 14, fontWeight: 800, touchAction: 'manipulation',
              border: `1.5px solid ${puesto ? T.accent : T.border}`, background: puesto ? T.accentBg : T.bg2, color: puesto ? T.accent : T.text,
            }}
          >
            {puesto ? <Check size={16} strokeWidth={3} /> : <Icono size={17} />} {nombreDeProposito(id)}
          </button>
        );
      })}
    </div>
  );
}

/** La pastilla de «Ejemplo ▾» / «Explicación ▾»: ES el control (se toca y salen las dos opciones), como la de «Todos». */
export function PastillaDeProposito({ valor, abierta, onToggle }) {
  const explicacion = valor === EXPLICACION;
  const Icono = explicacion ? IconoExplicacion : Video;
  return (
    <button
      type="button" onClick={onToggle} aria-expanded={abierta} aria-label="Cambiar qué es este video"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5, minHeight: 26, padding: '0 9px 0 10px', borderRadius: 999, cursor: 'pointer',
        fontFamily: FONT, fontSize: 11.5, fontWeight: 700,
        border: `1px solid ${explicacion ? T.accent : T.borderHi}`, background: explicacion ? T.accentBg : T.bg2,
        color: explicacion ? T.accent : T.text2,
      }}
    >
      <Icono size={13} /> {nombreDeProposito(valor)} <ChevronDown size={11} />
    </button>
  );
}
