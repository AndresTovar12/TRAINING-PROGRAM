import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Plus, SlidersHorizontal } from 'lucide-react';
import { useAviso } from '@/components/AvisoPasajero';
import { aspectoDelTipo } from '@/lib/aspectoDelTipo';
import { cargaCatalogo } from '@/lib/iconosDeTipo';
import { FONT, T, tipoDeSesion } from '@/lib/theme';
import HojaTipoNuevo from '@/features/admin/HojaTipoNuevo';
import HojaTiposDeSesion from '@/features/admin/HojaTiposDeSesion';
import MosaicoDeTipo from '@/features/admin/MosaicoDeTipo';
import { useTiposDeSesion } from '@/features/admin/useTiposDeSesion';

/**
 * El tipo de sesión, con la lista de la app en vez de la del sistema.
 *
 * POR QUÉ NO ES UN <select>. Andrés, 17 sep 2026: "no me gustan esas listas de
 * formato de Safari, me gustaría nuestro propio formato". En el iPhone el
 * desplegable nativo es una rueda gris a media pantalla que no enseña colores
 * ni deja crear nada. Aquí se ven el color y el ÍCONO de cada tipo, que es lo
 * que el coach reconoce de un vistazo en el calendario (y su atleta, en «Hoy te toca»).
 *
 * LO PROPIO DE CADA COACH. Los de base están en el código y los ve todo el
 * mundo (menos los que el coach haya quitado). Además cada coach guarda los
 * suyos ("Vinyasa", "Boxeo") con su color y su ícono. Lo que se elige viaja
 * DENTRO del día del plan:
 *
 *   base   → { cat: 'yoga' }
 *   propio → { cat: 'otro', catNombre: 'Vinyasa', catColor: '#C084FC', catIcono: 'flor' }
 *
 * Por eso el atleta lee el nombre, el color y el ícono sin consultar nada, y
 * quitar un tipo no deja ninguna sesión sin tipo.
 *
 * ELEGIR ES UN MENÚ CHICO; CREAR Y ADMINISTRAR TIENEN SU HOJA. Andrés, 9 oct 2026:
 * «cada coach debe poder agregar tipos de sesión pero también eliminar los que
 * no les gusten, entonces ahorita no hay espacio para eso». El menú se queda
 * rápido (elegir es lo que se hace cien veces) y al pie lleva dos botones:
 * «Crear tipo» (nombre, color e ícono, con vista previa) y «Administrar»
 * (quitar los suyos y los de la app, y volver a ponerlos). Ver `HojaTipoNuevo`
 * y `HojaTiposDeSesion`.
 */
export default function SelectorTipoSesion({ day, onPatch, coachId, puedeCrear = true }) {
  const [abierto, setAbierto] = useState(false);
  const [escena, setEscena] = useState(null); // null | 'admin' | 'nuevo'
  const [desde, setDesde] = useState('menu'); // desde dónde se abrió «Tipo nuevo»: 'menu' (se usa en la sesión) o 'admin'
  const [nuevoId, setNuevoId] = useState(null);
  const caja = useRef(null);
  const { avisa } = useAviso();
  const { propios, base, baseQuitada, quitaBase, ponBase, crea, quitaPropio, refresca } = useTiposDeSesion(coachId);
  // Crear y administrar necesitan saber de quién son los tipos.
  const puedeAdministrar = puedeCrear && !!coachId;

  /* Si la lista tiene más de lo que cabe. Se mide de verdad en vez de suponer
     por cuántos tipos hay: el alto depende también de cuántos propios creó el
     coach y de la letra del teléfono. */
  const lista = useRef(null);
  const [hayMas, setHayMas] = useState(false);
  const miraSiHayMas = useCallback(() => {
    const el = lista.current;
    if (!el) return;
    // 4 px de margen: al final del scroll la cuenta no siempre da exacta.
    setHayMas(el.scrollHeight - el.scrollTop - el.clientHeight > 4);
  }, []);

  /* Al abrir todavía no hay nada medido, y sin esto el aviso solo aparecería
     después de que el coach escroleara, que es justo cuando ya no hace falta.
     Se vuelve a medir cuando cambian los tipos: llegan por red después de
     abrir, y cada uno que entra hace la lista más larga. */
  useEffect(() => {
    if (abierto) miraSiHayMas();
  }, [abierto, propios.length, base.length, miraSiHayMas]);

  const abre = () => {
    // Los íconos de la hoja de «Tipo nuevo» empiezan a bajar al abrir el menú, para que estén cuando se necesiten.
    if (!abierto) cargaCatalogo().catch(() => { /* sin red: la hoja avisa que no cargaron */ });
    setAbierto((v) => !v);
  };
  const cierra = useCallback(() => setAbierto(false), []);

  useEffect(() => {
    if (!abierto) return undefined;
    const fuera = (e) => { if (caja.current && !caja.current.contains(e.target)) cierra(); };
    const tecla = (e) => { if (e.key === 'Escape') cierra(); };
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', tecla);
    return () => { document.removeEventListener('mousedown', fuera); document.removeEventListener('keydown', tecla); };
  }, [abierto, cierra]);

  const actual = tipoDeSesion(day);
  const aspectoActual = aspectoDelTipo(day);

  const eligeBase = (slug) => {
    // Se limpian el nombre, el color y el ícono propios: si se quedan, vuelven a salir
    // en cuanto alguien toque `cat` sin pasar por aquí.
    onPatch({ cat: slug, catNombre: null, catColor: null, catIcono: null });
    cierra();
  };
  const eligeMio = (t) => {
    onPatch({ cat: 'otro', catNombre: t.nombre, catColor: t.color, catIcono: t.icono ?? null });
    cierra();
  };

  const abreNuevo = (de) => { setDesde(de); setAbierto(false); setEscena('nuevo'); };
  const abreAdmin = () => { setAbierto(false); setEscena('admin'); refresca(); };
  const cierraNuevo = () => setEscena(desde === 'admin' ? 'admin' : null);

  const guardaNuevo = async (datos) => {
    const fila = await crea(datos);
    avisa(`«${fila.nombre}» guardado`);
    if (desde === 'admin') {
      setNuevoId(fila.id);
      setEscena('admin');
    } else {
      eligeMio(fila);
      setEscena(null);
    }
  };

  const fila = (activo) => ({
    display: 'flex', alignItems: 'center', gap: 11, width: '100%', minHeight: 46,
    padding: '6px 10px', borderRadius: 12, border: 'none', cursor: 'pointer',
    background: activo ? T.accentBg : 'transparent', textAlign: 'left',
    fontFamily: FONT, fontSize: 14.5, fontWeight: 600, color: T.text,
  });
  const encabezado = { fontSize: 10.5, fontWeight: 800, letterSpacing: 0.8, color: T.text3, padding: '8px 10px 4px' };

  return (
    <div ref={caja} style={{ position: 'relative' }}>
      <button
        type="button" onClick={abre} aria-haspopup="true" aria-expanded={abierto}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          padding: '8px 12px 8px 8px', borderRadius: 12, border: `1.5px solid ${T.border}`,
          background: T.bg2, cursor: 'pointer', fontFamily: FONT, fontSize: 14,
          fontWeight: 700, color: T.text, textAlign: 'left',
        }}
      >
        <MosaicoDeTipo aspecto={aspectoActual} tam={28} />
        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {actual.label}
        </span>
        <ChevronDown size={16} color={T.text3} style={{ flexShrink: 0 }} />
      </button>

      {abierto && (
        <div
          className="animate-fade-in"
          style={{
            position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 60,
            background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 16,
            boxShadow: '0 16px 44px rgba(17,19,24,0.16)',
            /* Ya no hace scroll este, sino la lista de adentro: así los botones de
               crear y administrar se quedan pegados abajo, siempre a la vista. */
            maxHeight: 420, minWidth: 262, display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* LA LISTA, CON SU PROPIO SCROLL Y UN AVISO DE QUE SIGUE.
              Andrés, 18 sep 2026: "cuando se despliega esta lista no te das
              cuenta que hay más para abajo si la escroleas, eso hay que
              arreglarlo". El degradado del borde no es adorno: aparece SOLO
              cuando queda algo por ver, y se apaga al llegar al final. Uno
              fijo mentiría en las listas cortas. */}
          <div style={{ position: 'relative', flex: '1 1 auto', minHeight: 0 }}>
            <div ref={lista} onScroll={miraSiHayMas} style={{ maxHeight: 330, overflowY: 'auto', padding: 7 }}>
              {propios.length > 0 && (
                <>
                  <div style={encabezado}>LOS TUYOS</div>
                  {propios.map((m) => {
                    const activo = day?.cat === 'otro' && day?.catNombre === m.nombre;
                    return (
                      <button key={m.id} type="button" onClick={() => eligeMio(m)} style={fila(activo)}>
                        <MosaicoDeTipo aspecto={aspectoDelTipo({ cat: 'otro', catNombre: m.nombre, catColor: m.color, catIcono: m.icono })} tam={30} />
                        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.nombre}</span>
                        {activo && <Check size={16} color={T.accent} />}
                      </button>
                    );
                  })}
                </>
              )}

              <div style={encabezado}>DE LA APP</div>
              {base.map((b) => {
                const activo = day?.cat === b.slug;
                return (
                  <button key={b.slug} type="button" onClick={() => eligeBase(b.slug)} style={fila(activo)}>
                    <MosaicoDeTipo aspecto={aspectoDelTipo({ cat: b.slug })} tam={30} />
                    <span style={{ flex: 1, minWidth: 0 }}>{b.label}</span>
                    {activo && <Check size={16} color={T.accent} />}
                  </button>
                );
              })}
            </div>

            {hayMas && (
              <span
                aria-hidden="true"
                style={{
                  position: 'absolute', left: 1, right: 1, bottom: 0, height: 30,
                  background: `linear-gradient(to top, ${T.bg2}, ${T.bg2}00)`,
                  pointerEvents: 'none',
                }}
              />
            )}
          </div>

          {/* EL PIE, FUERA DEL SCROLL. Antes era la última fila de la lista:
              "lo de crear tipo nunca lo voy a poder ver porque está hasta
              abajo, y si no sé que la puedo escrolear, pues menos". */}
          <div style={{ flexShrink: 0, borderTop: `1px solid ${T.border}`, padding: 7 }}>
            {puedeAdministrar ? (
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  type="button" onClick={() => abreNuevo('menu')}
                  style={{ ...pieDelMenu, background: T.accentBg, color: T.accent }}
                >
                  <Plus size={16} strokeWidth={2.6} /> Crear tipo
                </button>
                <button type="button" onClick={abreAdmin} style={{ ...pieDelMenu, background: 'transparent', color: T.text2 }}>
                  <SlidersHorizontal size={16} /> Administrar
                </button>
              </div>
            ) : (
              <div style={{ fontSize: 11.5, color: T.text3, fontWeight: 600, padding: '9px 11px', lineHeight: 1.4 }}>
                Para crear tipos, sal de «Ver como».
              </div>
            )}
          </div>
        </div>
      )}

      {escena === 'admin' && (
        <HojaTiposDeSesion
          propios={propios} base={base} baseQuitada={baseQuitada} nuevoId={nuevoId}
          onNuevo={() => abreNuevo('admin')} onQuitaPropio={quitaPropio} onQuitaBase={quitaBase} onPonBase={ponBase}
          onCerrar={() => { setEscena(null); setNuevoId(null); }}
        />
      )}
      {escena === 'nuevo' && (
        <HojaTipoNuevo propios={propios} conUso={desde === 'menu'} onGuardar={guardaNuevo} onCerrar={cierraNuevo} />
      )}
    </div>
  );
}

const pieDelMenu = {
  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 44, padding: '0 10px', border: 'none', borderRadius: 12,
  cursor: 'pointer', fontFamily: FONT, fontSize: 14, fontWeight: 800, touchAction: 'manipulation',
};
