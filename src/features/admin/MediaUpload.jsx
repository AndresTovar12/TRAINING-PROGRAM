/**
 * Botón de "Subir archivo" para foto o video de un ejercicio.
 *
 * Vive aparte porque lo usan dos pantallas: el repertorio (crear/editar un
 * ejercicio) y el editor de sesión (crear un ejercicio al vuelo). Tenerlo
 * duplicado significaba que un arreglo —el aviso de foto chica, la barra de
 * avance— solo llegaba a una de las dos.
 */
import { useRef, useState } from 'react';
import { Upload, Loader2, X } from 'lucide-react';
import { uploadExerciseMedia } from '@/lib/api';
import { optimizaImagen, pesoTexto as pesoLegible } from '@/lib/imagen';
import { T, FONT } from '@/lib/theme';

export default function MediaUpload({ label, icon: Icon, value, onChange, accept, kind, hint }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [avance, setAvance] = useState(0);
  const [archivo, setArchivo] = useState(null); // { nombre, mb }
  const [aviso, setAviso] = useState(null);     // { texto, detalle }
  const [ahorro, setAhorro] = useState(null);   // { antes, despues }
  const inputRef = useRef(null);

  async function onPick(e) {
    const elegido = e.target.files?.[0];
    if (!elegido) return;
    setErr('');
    setAviso(null);
    setAhorro(null);
    setAvance(0);
    setBusy(true);
    try {
      // Las fotos se encogen y se reencodan ANTES de salir del teléfono. Los
      // videos no: recomprimirlos aquí sería lento y les quitaría la calidad,
      // que es justo lo que hay que cuidar.
      const { archivo: file, aviso: texto, detalle } = await optimizaImagen(elegido);
      if (texto) setAviso({ texto, detalle });
      if (file !== elegido) setAhorro({ antes: elegido.size, despues: file.size });
      setArchivo({ nombre: file.name, mb: Math.round((file.size / 1048576) * 10) / 10 });

      const url = await uploadExerciseMedia(file, kind, setAvance);
      onChange(url);
      setArchivo(null);
    } catch (e2) {
      setErr(e2.message || 'Error al subir');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={{ fontSize: 12.5, fontWeight: 700, color: T.text2 }}>{label}</span>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 14px',
            borderRadius: 11, border: `1.5px solid ${T.border}`, background: T.bg2, cursor: 'pointer',
            fontFamily: FONT, fontSize: 13.5, fontWeight: 700, color: T.text, whiteSpace: 'nowrap',
          }}
        >
          {busy ? <Loader2 size={15} className="spin" /> : <Upload size={15} />}
          {busy ? 'Subiendo…' : 'Subir archivo'}
        </button>
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5, padding: '10px 12px',
              borderRadius: 11, border: 'none', background: 'rgba(220,38,38,0.08)', cursor: 'pointer',
              fontFamily: FONT, fontSize: 13, fontWeight: 700, color: T.danger,
            }}
          >
            <X size={14} /> Quitar
          </button>
        )}
      </div>
      <input ref={inputRef} type="file" accept={accept} onChange={onPick} style={{ display: 'none' }} />
      {hint && <div style={{ fontSize: 11.5, color: T.text3 }}>{hint}</div>}

      {/* Mientras sube: nombre, peso y avance real. Antes solo giraba una
          ruedita de 15px dentro del boton, y un video de 80 MB por datos
          moviles se veia igual que si la app no hubiera hecho nada. */}
      {busy && archivo && (
        <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 11, padding: '10px 12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12.5, fontWeight: 700, color: T.text }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{archivo.nombre}</span>
            <span style={{ flexShrink: 0, color: T.accent }}>{avance}%</span>
          </div>
          <div style={{ height: 6, borderRadius: 999, background: T.bg3, marginTop: 8, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${avance}%`, background: T.accent, borderRadius: 999, transition: 'width .2s' }} />
          </div>
          <div style={{ fontSize: 11.5, color: T.text3, marginTop: 6, fontWeight: 600 }}>
            {archivo.mb} MB · no cierres esta pantalla
          </div>
        </div>
      )}

      {/* Foto demasiado chica. No es un error —se sube igual— pero hay que
          decirlo ANTES de que la vea borrosa en el telefono y no sepa por que. */}
      {aviso && !busy && (
        <div style={{
          background: 'rgba(224,123,0,0.10)', color: '#8A4B00', borderRadius: 11,
          padding: '10px 12px', fontSize: 12.5, fontWeight: 600, lineHeight: 1.45,
        }}>
          <div style={{ fontWeight: 800 }}>{aviso.texto}</div>
          {aviso.detalle && <div style={{ marginTop: 3 }}>{aviso.detalle}</div>}
        </div>
      )}

      {ahorro && !busy && !err && (
        <div style={{ fontSize: 11.5, color: T.text3, fontWeight: 600 }}>
          Optimizada: {pesoLegible(ahorro.antes)} → {pesoLegible(ahorro.despues)}
        </div>
      )}

      {/* El error va en caja roja, no en una linea de 12px que se pierde. */}
      {err && (
        <div style={{
          background: 'rgba(220,38,38,0.08)', color: T.danger, borderRadius: 11,
          padding: '10px 12px', fontSize: 12.5, fontWeight: 600, lineHeight: 1.45,
        }}>
          {err}
        </div>
      )}
      {value && (
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: T.text2,
            background: T.bg, borderRadius: 9, padding: '8px 10px', wordBreak: 'break-all',
          }}
        >
          <Icon size={14} style={{ flexShrink: 0 }} /> {value}
        </div>
      )}
    </div>
  );
}
