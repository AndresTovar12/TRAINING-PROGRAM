import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Check, ChevronLeft, Flag, Loader2 } from 'lucide-react';
import { T, KP, FONT } from '@/lib/theme';
import { useConfirmacion } from '@/components/Confirmacion';
import { useMensajes } from '@/contexts/MensajesContext';
import { eliminaMensaje, leeMensajes, leeTecnicas, mandaArchivo, mandaTexto, marcaVistos, POR_PAGINA, respondeTecnica, urlsFirmadas } from '@/lib/mensajesApi';
import { Avatar } from '@/features/mensajes/piezas';
import Adjunto from '@/features/mensajes/Adjunto';
import Redactor from '@/features/mensajes/Redactor';
import { preparaArchivo } from '@/features/mensajes/adjuntos';
import TarjetaDeTecnica from '@/features/mensajes/TarjetaDeTecnica';
import { diaTexto, horaTexto, reloj } from '@/features/mensajes/formato';

const GrabaTecnica = lazy(() => import('@/features/mensajes/GrabaTecnica'));
const CorregirTecnica = lazy(() => import('@/features/mensajes/CorregirTecnica'));

/* UNA CONVERSACIÓN: lo que se han dicho un atleta y un profesional, y donde escribir.

   · Los mensajes llegan en vivo (ver `MensajesContext`): cada cambio vuelve a leer lo que ya se tenía. Al abrirla, y cada vez que llega algo estando abierta, se marcan como
     vistos los del otro lado: así a él le sale «Visto».
   · Cada quien borra lo SUYO, para los dos: se toca la burbuja propia y sale «Eliminar». Queda «Mensaje eliminado».
   · Si la cuenta de alguien está desactivada o ya no hay vínculo (`fila.activa` falso), la conversación queda solo para leer; se reabre sola al reactivarla.
   · Ocupa toda la altura de su contenedor: quien la pone decide si es una pantalla completa o un panel.

   `fila`: de la bandeja. `uid`: quien mira. `etiqueta`: «Tu coach», «Fisioterapeuta»… `onVolver`: si hay flecha para regresar a la lista. */

const mismoDia = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();

const CON_ARCHIVO = new Set(['foto', 'video', 'voz']);
const esVeredicto = (m) => m.tipo === 'correccion' && m.texto === 'Técnica correcta' && !m.adjunto && m.marca_s == null;

/** El archivo de una corrección es una nota de voz o un video: se dibuja con el mismo `Adjunto` de los mensajes sueltos, según su tipo de archivo. */
const comoAdjunto = (m) => ({ ...m, tipo: String(m.adjunto?.mime ?? '').startsWith('audio') ? 'voz' : 'video' });

function Burbuja({ m, mio, ultimoMio, elegido, url, tecnica, alElegir, alEliminar, alFallar, alSaltar, acciones }) {
  const borrado = !!m.eliminado_en;
  const esTecnica = m.tipo === 'tecnica' && !borrado;
  const correccion = m.tipo === 'correccion' && !borrado;
  const veredicto = correccion && esVeredicto(m);
  const archivo = (CON_ARCHIVO.has(m.tipo) || esTecnica || (correccion && !!m.adjunto)) && !borrado;
  const color = mio ? '#fff' : T.text;
  return (
    <div style={{ alignSelf: mio ? 'flex-end' : 'flex-start', maxWidth: esTecnica ? undefined : 'min(82%, 520px)', width: esTecnica ? 'min(320px, 92%)' : undefined, display: 'flex', flexDirection: 'column', alignItems: mio ? 'flex-end' : 'flex-start' }}>
      <div
        role={mio && !borrado ? 'button' : undefined} tabIndex={mio && !borrado ? 0 : undefined}
        onClick={mio && !borrado ? (e) => { if (!e.target.closest('video, audio, button, img')) alElegir(m.id); } : undefined}
        onKeyDown={mio && !borrado ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); alElegir(m.id); } } : undefined}
        aria-label={mio && !borrado ? 'Tu mensaje: toca para ver opciones' : undefined}
        style={{
          display: 'block', textAlign: 'left', fontFamily: FONT, fontSize: 15.5, lineHeight: 1.4, padding: esTecnica ? 0 : (archivo ? '4px 4px 6px' : '9px 13px 7px'), cursor: mio && !borrado ? 'pointer' : 'default', touchAction: 'manipulation',
          border: borrado ? `1px solid ${T.border}` : 'none', borderRadius: 18, borderBottomRightRadius: mio ? 6 : 18, borderBottomLeftRadius: mio ? 18 : 6,
          background: borrado ? 'transparent' : (mio && !esTecnica ? T.accent : KP.surface), color: borrado ? T.text3 : (esTecnica ? T.text : color),
          boxShadow: !borrado && (!mio || esTecnica) ? KP.shCard : 'none', maxWidth: '100%', width: esTecnica ? '100%' : undefined, boxSizing: 'border-box', outline: 'none',
        }}
      >
        {borrado && <span style={{ fontStyle: 'italic', fontSize: 14.5 }}>Mensaje eliminado</span>}
        {esTecnica && (
          <TarjetaDeTecnica
            m={m} t={tecnica} soyAtleta={mio} url={url} alFallar={alFallar}
            alCorrecta={acciones.alCorrecta} alCorregir={acciones.alCorregir} alOtroIntento={acciones.alOtroIntento}
          />
        )}
        {correccion && tecnica && (
          <span style={{ display: 'block', fontSize: 12.5, fontWeight: 800, opacity: 0.8, padding: m.adjunto ? '2px 8px 6px' : '0 0 5px' }}>
            {[tecnica.ejercicio, tecnica.detalle].filter(Boolean).join(' · ')}
          </span>
        )}
        {veredicto && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontWeight: 800, padding: '2px 4px' }}>
            <span style={{ width: 24, height: 24, borderRadius: '50%', background: mio ? 'rgba(255,255,255,0.22)' : KP.mintSoft, color: mio ? '#fff' : KP.mint, display: 'grid', placeItems: 'center' }}><Check size={15} strokeWidth={3.2} /></span>
            Técnica correcta
          </span>
        )}
        {correccion && !veredicto && (
          <span style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
            {m.marca_s != null && (
              <button
                type="button" onClick={() => alSaltar(m.tecnica_id, m.marca_s)} className="kp-press"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 34, padding: '0 12px', borderRadius: 999, border: 'none', cursor: 'pointer', fontFamily: FONT, fontSize: 13.5, fontWeight: 800, fontVariantNumeric: 'tabular-nums', touchAction: 'manipulation', background: mio ? 'rgba(255,255,255,0.22)' : T.accentBg, color: mio ? '#fff' : T.accent }}
              >
                <Flag size={14} /> En el segundo {reloj(m.marca_s)}
              </button>
            )}
            {m.adjunto && <Adjunto m={comoAdjunto(m)} mio={mio} url={url} alFallar={alFallar} />}
            {m.texto && <span style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', padding: m.adjunto ? '0 8px' : 0 }}>{m.texto}</span>}
          </span>
        )}
        {!borrado && CON_ARCHIVO.has(m.tipo) && <Adjunto m={m} mio={mio} url={url} alFallar={alFallar} />}
        {!borrado && !archivo && !veredicto && m.tipo !== 'correccion' && <span style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{m.texto}</span>}
        {!borrado && !esTecnica && (
          <span style={{ display: 'block', textAlign: 'right', fontSize: 11, fontWeight: 600, marginTop: 2, padding: archivo ? '0 8px 0 0' : 0, opacity: 0.7, fontVariantNumeric: 'tabular-nums' }}>{horaTexto(m.creado_en)}</span>
        )}
      </div>
      {elegido && (
        <button
          type="button" onClick={() => alEliminar(m)} className="kp-press"
          style={{ marginTop: 6, minHeight: 36, padding: '0 14px', borderRadius: 12, border: `1.5px solid ${KP.danger}`, background: KP.surface, color: KP.danger, cursor: 'pointer', fontFamily: FONT, fontSize: 13.5, fontWeight: 800, touchAction: 'manipulation' }}
        >
          Eliminar
        </button>
      )}
      {mio && ultimoMio && !borrado && (
        <span style={{ marginTop: 3, fontSize: 11.5, fontWeight: 700, color: m.visto_en ? T.accent : T.text3 }}>{m.visto_en ? 'Visto' : 'Enviado'}</span>
      )}
    </div>
  );
}

export default function Conversacion({ fila, uid, etiqueta = null, onVolver = null, conMargenSuperior = false }) {
  const { version, recarga } = useMensajes();
  const pregunta = useConfirmacion();
  const a = fila.atleta_id;
  const p = fila.profesional_id;
  const [mensajes, setMensajes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [hayMas, setHayMas] = useState(false);
  const [trayendo, setTrayendo] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [subiendo, setSubiendo] = useState(null);
  const [urls, setUrls] = useState(() => new Map());
  const [error, setError] = useState(null);
  const [elegido, setElegido] = useState(null);
  const [tecnicas, setTecnicas] = useState(() => new Map());
  const [tic, setTic] = useState(0); // sube cuando YO hice un cambio (corregir, otro intento): vuelve a leer sin esperar la conexión en vivo
  const [corrigiendo, setCorrigiendo] = useState(null); // la técnica que el profesional está corrigiendo
  const [otroIntento, setOtroIntento] = useState(null); // la técnica de la que el atleta manda otro intento
  const zona = useRef(null);
  const renovadas = useRef(new Set());
  const cantidad = useRef(POR_PAGINA);
  const pegado = useRef(true); // ¿está viendo lo más nuevo? Si sí, lo que llegue lo baja solo.
  const alturaPrevia = useRef(null);

  // Lee (o vuelve a leer) los mensajes y marca como vistos los del otro lado. Con cada cambio en vivo se vuelve a pedir lo mismo que ya se tenía.
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const limite = Math.max(POR_PAGINA, cantidad.current);
        const lista = await leeMensajes(a, p, { limite });
        if (!vivo) return;
        cantidad.current = lista.length;
        setMensajes(lista);
        setHayMas(lista.length >= limite);
        setCargando(false);
        setError(null);
        if (lista.some((m) => m.autor_id !== uid && !m.visto_en && !m.eliminado_en)) {
          await marcaVistos(a, p);
          recarga();
        }
      } catch (e) {
        if (vivo) { setCargando(false); setError(e?.message ?? 'No se pudieron cargar los mensajes'); }
      }
    })();
    return () => { vivo = false; };
  }, [a, p, uid, version, tic, recarga]);

  // Baja al último mensaje cuando llega uno (si se estaba viendo lo más nuevo, o si lo mandé yo); al traer los anteriores se queda donde estaba.
  useLayoutEffect(() => {
    const el = zona.current;
    if (!el) return;
    if (alturaPrevia.current !== null) {
      el.scrollTop = el.scrollHeight - alturaPrevia.current;
      alturaPrevia.current = null;
      return;
    }
    const ultimo = mensajes[mensajes.length - 1];
    if (pegado.current || ultimo?.autor_id === uid) el.scrollTop = el.scrollHeight;
  }, [mensajes, uid]);

  const alDesplazar = () => {
    const el = zona.current;
    if (el) pegado.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };

  async function traeAnteriores() {
    if (trayendo || !mensajes.length) return;
    setTrayendo(true);
    try {
      const lista = await leeMensajes(a, p, { antes: mensajes[0].creado_en });
      alturaPrevia.current = zona.current?.scrollHeight ?? null;
      cantidad.current += lista.length;
      setMensajes((prev) => [...lista, ...prev]);
      setHayMas(lista.length >= POR_PAGINA);
    } catch (e) {
      setError(e?.message ?? 'No se pudieron traer los anteriores');
    } finally {
      setTrayendo(false);
    }
  }

  // Las técnicas de las tarjetas de lo que hay en pantalla (estado, ejercicio, de qué serie): una sola pregunta, y otra cada vez que algo cambia en vivo.
  const idsDeTecnicas = [...new Set(mensajes.filter((m) => m.tecnica_id).map((m) => m.tecnica_id))].join('|');
  useEffect(() => {
    if (!idsDeTecnicas) return undefined;
    let vivo = true;
    leeTecnicas(idsDeTecnicas.split('|')).then((mapa) => { if (vivo) setTecnicas(mapa); }).catch(() => {});
    return () => { vivo = false; };
  }, [idsDeTecnicas, version, tic]);

  // Pide las direcciones de los archivos de lo que hay en pantalla (una sola vez por lote); las que ya se tenían salen de la memoria.
  const rutas = mensajes.filter((m) => m.adjunto?.ruta && !m.adjunto_borrado && !m.eliminado_en).map((m) => m.adjunto.ruta).join('|');
  useEffect(() => {
    if (!rutas) return undefined;
    let vivo = true;
    urlsFirmadas(rutas.split('|')).then((mapa) => { if (vivo) setUrls(mapa); }).catch(() => {});
    return () => { vivo = false; };
  }, [rutas]);
  // Una dirección que dejó de servir se pide de nuevo (una vez por archivo: si sigue fallando, es otra cosa).
  const alFallar = useCallback((ruta) => {
    if (renovadas.current.has(ruta)) return;
    renovadas.current.add(ruta);
    urlsFirmadas([ruta], { renueva: true }).then((mapa) => setUrls((prev) => new Map([...prev, ...mapa]))).catch(() => {});
  }, []);

  const agrega = (m) => {
    setMensajes((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
    cantidad.current += 1;
  };

  async function envia(texto) {
    setOcupado(true);
    setError(null);
    try {
      agrega(await mandaTexto({ atletaId: a, profesionalId: p, autorId: uid, texto }));
    } catch (e) {
      setError(e?.message ?? 'No se pudo mandar el mensaje');
      throw e;
    } finally {
      setOcupado(false);
    }
  }

  // Una foto o un video de la galería o de la cámara: se prepara (se achica, se le pone índice, se revisa cuánto dura) y se sube.
  async function enviaArchivo(elegido) {
    setOcupado(true);
    setError(null);
    setSubiendo('Preparando…');
    try {
      const listo = await preparaArchivo(elegido);
      setSubiendo(listo.tipo === 'video' ? 'Subiendo el video…' : 'Subiendo la foto…');
      agrega(await mandaArchivo({ atletaId: a, profesionalId: p, autorId: uid, tipo: listo.tipo, archivo: listo.archivo, mime: listo.mime, meta: listo.meta }));
    } catch (e) {
      setError(e?.message ?? 'No se pudo mandar el archivo');
    } finally {
      setOcupado(false);
      setSubiendo(null);
    }
  }

  async function enviaVoz(archivo, segundos) {
    setOcupado(true);
    setError(null);
    setSubiendo('Subiendo la nota de voz…');
    try {
      agrega(await mandaArchivo({ atletaId: a, profesionalId: p, autorId: uid, tipo: 'voz', archivo, meta: { segundos } }));
    } catch (e) {
      setError(e?.message ?? 'No se pudo mandar la nota de voz');
    } finally {
      setOcupado(false);
      setSubiendo(null);
    }
  }

  const refresca = () => { setTic((n) => n + 1); recarga(); };

  // «Técnica correcta»: un toque. Se vuelve a leer en cuanto responde la base, sin esperar la conexión en vivo.
  async function marcaCorrecta(t) {
    setError(null);
    try {
      await respondeTecnica({ tecnicaId: t.id, veredicto: 'correcta' });
      refresca();
    } catch (e) {
      setError(e?.message ?? 'No se pudo marcar la técnica');
    }
  }

  // El chip «En el segundo 0:12» de una corrección: lleva el video de la tarjeta a ese segundo y lo pone a correr.
  function saltaAlSegundo(tecnicaId, segundo) {
    const video = zona.current?.querySelector(`video[data-tecnica="${tecnicaId}"]`);
    if (!video) return;
    video.scrollIntoView({ block: 'center', behavior: 'smooth' });
    video.currentTime = segundo;
    video.play().catch(() => {});
  }

  async function elimina(m) {
    const va = await pregunta({ titulo: '¿Eliminar este mensaje?', detalle: 'Se borra para los dos.', confirmar: 'Sí, eliminarlo', peligro: true });
    if (!va) return;
    setElegido(null);
    try {
      await eliminaMensaje(m.id);
      setMensajes((prev) => prev.map((x) => (x.id === m.id ? { ...x, eliminado_en: new Date().toISOString(), texto: null, adjunto: null } : x)));
    } catch (e) {
      setError(e?.message ?? 'No se pudo eliminar');
    }
  }

  // Lo que se puede hacer con una tarjeta de técnica: el profesional la marca o la corrige; el atleta manda otro intento. Con la conversación cerrada, nada.
  const soyAtleta = uid === a;
  const acciones = {
    alCorrecta: !soyAtleta && fila.activa ? marcaCorrecta : null,
    alCorregir: !soyAtleta && fila.activa ? setCorrigiendo : null,
    alOtroIntento: soyAtleta && fila.activa ? setOtroIntento : null,
  };

  const ultimoMioId = [...mensajes].reverse().find((m) => m.autor_id === uid && !m.eliminado_en)?.id ?? null;
  const filas = [];
  mensajes.forEach((m, i) => {
    if (i === 0 || !mismoDia(mensajes[i - 1].creado_en, m.creado_en)) {
      filas.push(
        <div key={`d${m.id}`} style={{ alignSelf: 'center', margin: '10px 0 4px', padding: '3px 12px', borderRadius: 999, background: T.bg3, fontSize: 12, fontWeight: 700, color: T.text2 }}>
          {diaTexto(m.creado_en)}
        </div>,
      );
    }
    filas.push(
      <Burbuja
        key={m.id} m={m} mio={m.autor_id === uid} ultimoMio={m.id === ultimoMioId} elegido={elegido === m.id} url={m.adjunto?.ruta ? urls.get(m.adjunto.ruta) ?? null : null} alFallar={alFallar}
        tecnica={m.tecnica_id ? tecnicas.get(m.tecnica_id) ?? null : null} alSaltar={saltaAlSegundo} acciones={acciones}
        alElegir={(id) => setElegido((prev) => (prev === id ? null : id))} alEliminar={elimina}
      />,
    );
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, background: T.bg, fontFamily: FONT }}>
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, // En pantalla completa el botón de la cuenta (fijo arriba a la derecha) queda por encima: se le deja su hueco.
          padding: conMargenSuperior ? 'calc(10px + env(safe-area-inset-top)) 68px 10px 12px' : '10px 12px',
          background: KP.surface, borderBottom: `1px solid ${KP.line}`,
        }}
      >
        {onVolver && (
          <button
            type="button" onClick={onVolver} aria-label="Volver a los mensajes" className="kp-press"
            style={{ width: 40, height: 40, borderRadius: 14, border: 'none', background: T.bg3, color: T.text, cursor: 'pointer', display: 'grid', placeItems: 'center', flexShrink: 0, touchAction: 'manipulation' }}
          >
            <ChevronLeft size={22} />
          </button>
        )}
        <Avatar nombre={fila.otro_nombre} url={fila.otro_avatar} tam={40} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fila.otro_nombre}</div>
          {etiqueta && <div style={{ fontSize: 12.5, fontWeight: 700, color: T.accent }}>{etiqueta}</div>}
        </div>
      </div>

      <div
        ref={zona} onScroll={alDesplazar} onClick={(e) => { if (e.target === e.currentTarget) setElegido(null); }}
        style={{ flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain', padding: '12px 14px 8px', display: 'flex', flexDirection: 'column', gap: 6 }}
      >
        {cargando && (
          <div role="status" style={{ margin: 'auto', display: 'flex', alignItems: 'center', gap: 8, color: T.text2, fontWeight: 600, fontSize: 14 }}><Loader2 size={18} className="spin" /> Cargando…</div>
        )}
        {!cargando && hayMas && (
          <button
            type="button" onClick={traeAnteriores} disabled={trayendo} className="kp-press"
            style={{ alignSelf: 'center', minHeight: 38, padding: '0 16px', borderRadius: 12, border: `1.5px solid ${T.borderHi}`, background: KP.surface, color: T.text, cursor: 'pointer', fontFamily: FONT, fontSize: 13.5, fontWeight: 800 }}
          >
            {trayendo ? 'Trayendo…' : 'Ver anteriores'}
          </button>
        )}
        {!cargando && mensajes.length === 0 && !error && (
          <div style={{ margin: 'auto', textAlign: 'center', fontSize: 14.5, fontWeight: 600, color: T.text2, padding: '0 24px' }}>
            {fila.activa ? 'Escribe el primer mensaje.' : 'Todavía no hay mensajes.'}
          </div>
        )}
        {filas}
      </div>

      {error && <div role="alert" style={{ margin: '0 14px 8px', padding: '9px 12px', borderRadius: 12, background: KP.dangerSoft, color: KP.danger, fontSize: 13.5, fontWeight: 700 }}>{error}</div>}

      {fila.activa ? (
        <Redactor alTexto={envia} alArchivo={enviaArchivo} alVoz={enviaVoz} alError={setError} ocupado={ocupado} subiendo={subiendo} />
      ) : (
        <div style={{ flexShrink: 0, padding: '14px 16px calc(14px + env(safe-area-inset-bottom))', background: KP.surface, borderTop: `1px solid ${KP.line}`, textAlign: 'center', fontSize: 14, fontWeight: 700, color: T.text2 }}>
          Esta conversación está cerrada. Solo puedes leerla.
        </div>
      )}
      {corrigiendo && (
        <Suspense fallback={null}>
          <CorregirTecnica
            t={corrigiendo} url={urls.get(corrigiendo.ruta) ?? null}
            alListo={() => { setCorrigiendo(null); refresca(); }} alCerrar={() => setCorrigiendo(null)}
          />
        </Suspense>
      )}
      {otroIntento && (
        <Suspense fallback={null}>
          <GrabaTecnica
            atletaId={a} destino={{ id: p, nombre: fila.otro_nombre }} ejercicio={otroIntento.ejercicio} detalle={otroIntento.detalle}
            sesionId={otroIntento.sesion_id} clave={otroIntento.clave} intentoDe={otroIntento.id}
            alEnviar={refresca} alCerrar={() => setOtroIntento(null)}
          />
        </Suspense>
      )}
    </div>
  );
}
