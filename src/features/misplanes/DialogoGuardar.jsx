import { useState } from 'react';
import { Check, FolderOpen, Loader2 } from 'lucide-react';
import { T, FONT } from '@/lib/theme';
import { ETIQUETA_DE_TIPO, textoDeRuta } from '@/lib/misPlanesDatos';
import { crearCarpeta } from '@/lib/misPlanes';
import { useMisPlanes } from '@/lib/useMisPlanes';
import Ventana from '@/features/misplanes/Ventana';
import SelectorDeCarpeta from '@/features/misplanes/SelectorDeCarpeta';
import {
  botonBlanco, botonPrincipal, campo, COLOR_DE_TIPO, etiquetaChica, FONDO_DE_TIPO,
} from '@/features/misplanes/estilos';

/**
 * «Guardar en Mis planes»: nombre, descripción (opcional) y carpeta, y las preguntas que haga falta
 * en cada caso como casillas (`interruptores`): «¿incluir mis notas?» (se pregunta cada vez, Andrés,
 * 2 oct 2026) o «guardar también las otras sesiones de este día».
 *
 * `onGuardar({ nombre, descripcion, carpetaId, interruptores })` guarda de verdad; si falla, el error
 * sale aquí y la ventana se queda. Al terminar bien, se cierra sola.
 *
 * `interruptores`: [{ clave, etiqueta, ayuda, inicial }].
 *
 * `recordarCarpeta`: al guardar desde el plan de un atleta, la carpeta que se propone es la ÚLTIMA donde se guardó
 * algo (si todavía existe) en vez de «Sin carpeta» (Andrés, 2 oct 2026: que no haya que mover después lo que ya
 * se sabe dónde va). Si se cambia a mano, manda lo que se elija.
 */

const claveUltimaCarpeta = (userId) => `tl:mis-planes:ultima-carpeta:${userId}`;
const leerUltimaCarpeta = (userId) => {
  try { return localStorage.getItem(claveUltimaCarpeta(userId)) || null; } catch { return null; }
};
const recordarUltimaCarpeta = (userId, carpetaId) => {
  try { localStorage.setItem(claveUltimaCarpeta(userId), carpetaId ?? ''); } catch { /* sin almacenamiento: no pasa nada */ }
};

export default function DialogoGuardar({
  titulo = 'Guardar en Mis planes', tipo, nombreInicial = '', descripcionInicial = '', carpetaInicial = null,
  interruptores = [], textoBoton = 'Guardar', soloNombre = false, sinCarpeta = false, placeholder = 'Ej. Pretemporada football, 8 semanas',
  recordarCarpeta = false, onGuardar, onCerrar,
}) {
  const { cargando, carpetas, recargar, userId } = useMisPlanes();
  const [nombre, setNombre] = useState(nombreInicial);
  const [descripcion, setDescripcion] = useState(descripcionInicial);
  const [carpetaId, setCarpetaId] = useState(carpetaInicial);
  const [tocada, setTocada] = useState(false); // ya la cambió a mano: manda lo que eligió
  const [eligiendo, setEligiendo] = useState(false);
  const [valores, setValores] = useState(() => Object.fromEntries(interruptores.map((i) => [i.clave, i.inicial !== false])));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const puede = nombre.trim().length > 0 && !guardando;

  // La carpeta que vale: la que se eligió a mano, o —si se pidió recordar— la última que se usó, si aún existe.
  const recordada = recordarCarpeta && carpetaInicial == null && !cargando ? leerUltimaCarpeta(userId) : null;
  const recordadaValida = recordada && carpetas.some((c) => c.id === recordada) ? recordada : null;
  const carpetaElegida = tocada ? carpetaId : (recordadaValida ?? carpetaId);

  async function guardar() {
    if (!puede) return;
    setGuardando(true);
    setError('');
    try {
      await onGuardar({ nombre: nombre.trim(), descripcion: descripcion.trim(), carpetaId: carpetaElegida, interruptores: valores });
      if (recordarCarpeta && !sinCarpeta && !soloNombre) recordarUltimaCarpeta(userId, carpetaElegida);
      onCerrar();
    } catch (e) {
      setError(e.message || 'No se pudo guardar');
      setGuardando(false);
    }
  }

  // Una carpeta nueva desde aquí: se crea, se vuelve a leer la lista y el selector entra a ella.
  const crear = async (nombreNuevo, padreId) => {
    const fila = await crearCarpeta({ nombre: nombreNuevo, parentId: padreId, userId });
    await recargar();
    return fila;
  };

  return (
    <Ventana
      titulo={titulo}
      onCerrar={onCerrar}
      pie={(
        <>
          <button type="button" onClick={onCerrar} style={botonBlanco()}>Cancelar</button>
          <button type="button" onClick={guardar} disabled={!puede} style={botonPrincipal(!puede)}>
            {guardando ? <Loader2 size={16} className="spin" /> : <Check size={16} />} {textoBoton}
          </button>
        </>
      )}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {tipo && (
          <span style={{
            alignSelf: 'flex-start', fontSize: 11, fontWeight: 800, letterSpacing: 0.4, borderRadius: 7, padding: '4px 9px',
            color: COLOR_DE_TIPO[tipo], background: FONDO_DE_TIPO[tipo],
          }}>
            {ETIQUETA_DE_TIPO[tipo]}
          </span>
        )}

        <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span style={etiquetaChica}>Nombre</span>
          <input
            autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder={placeholder}
            onKeyDown={(e) => { if (e.key === 'Enter') guardar(); }}
            style={campo}
          />
        </label>

        {!soloNombre && (
          <>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <span style={etiquetaChica}>Descripción (opcional)</span>
              <textarea
                value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={2}
                placeholder="Para ti: a quién va, cuántos días, en qué momento del año…"
                style={{ ...campo, resize: 'vertical', lineHeight: 1.45 }}
              />
            </label>

            {!sinCarpeta && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={etiquetaChica}>Carpeta</span>
              {eligiendo ? (
                <SelectorDeCarpeta carpetas={carpetas} valor={carpetaElegida} onCambio={(v) => { setCarpetaId(v); setTocada(true); }} crearCarpeta={crear} />
              ) : (
                // Las carpetas se leen al abrir la ventana: hasta que llegan no se enseña un nombre que podría ser falso.
                <button
                  type="button" onClick={() => setEligiendo(true)} disabled={cargando}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', cursor: cargando ? 'default' : 'pointer', padding: '10px 12px',
                    background: T.bg2, border: `1.5px solid ${T.border}`, borderRadius: 11, fontFamily: FONT,
                  }}
                >
                  <FolderOpen size={17} color={T.text2} />
                  <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, color: cargando ? T.text3 : T.text, overflowWrap: 'anywhere' }}>
                    {cargando ? 'Cargando carpetas…' : textoDeRuta(carpetas, carpetaElegida)}
                  </span>
                  {!cargando && <span style={{ fontSize: 13, fontWeight: 800, color: T.accent }}>Cambiar</span>}
                </button>
              )}
            </div>
            )}
          </>
        )}

        {interruptores.map((i) => (
          <label key={i.clave} style={{ display: 'flex', alignItems: 'flex-start', gap: 11, cursor: 'pointer' }}>
            <input
              type="checkbox" checked={!!valores[i.clave]}
              onChange={(e) => setValores((prev) => ({ ...prev, [i.clave]: e.target.checked }))}
              style={{ width: 20, height: 20, marginTop: 1, accentColor: T.accent, flexShrink: 0 }}
            />
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: T.text }}>{i.etiqueta}</span>
              {i.ayuda && <span style={{ display: 'block', fontSize: 12.5, fontWeight: 500, color: T.text2, marginTop: 2, lineHeight: 1.4 }}>{i.ayuda}</span>}
            </span>
          </label>
        ))}

        {error && <div style={{ fontSize: 13, fontWeight: 700, color: T.danger }}>{error}</div>}
      </div>
    </Ventana>
  );
}
