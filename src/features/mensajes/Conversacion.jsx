import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronLeft, Loader2, Send } from 'lucide-react';
import { T, KP, FONT } from '@/lib/theme';
import { useIsDesktop } from '@/lib/useViewport';
import { useConfirmacion } from '@/components/Confirmacion';
import { useMensajes } from '@/contexts/MensajesContext';
import { eliminaMensaje, leeMensajes, mandaTexto, marcaVistos, POR_PAGINA } from '@/lib/mensajesApi';
import { Avatar } from '@/features/mensajes/piezas';
import { diaTexto, horaTexto } from '@/features/mensajes/formato';

/* UNA CONVERSACIÓN: lo que se han dicho un atleta y un profesional, y donde escribir.

   · Los mensajes llegan en vivo (ver `MensajesContext`): cada cambio vuelve a leer lo que ya se tenía. Al abrirla, y cada vez que llega algo estando abierta, se marcan como
     vistos los del otro lado: así a él le sale «Visto».
   · Cada quien borra lo SUYO, para los dos: se toca la burbuja propia y sale «Eliminar». Queda «Mensaje eliminado».
   · Si la cuenta de alguien está desactivada o ya no hay vínculo (`fila.activa` falso), la conversación queda solo para leer; se reabre sola al reactivarla.
   · Ocupa toda la altura de su contenedor: quien la pone decide si es una pantalla completa o un panel.

   `fila`: de la bandeja. `uid`: quien mira. `etiqueta`: «Tu coach», «Fisioterapeuta»… `onVolver`: si hay flecha para regresar a la lista. */

const mismoDia = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();

function Burbuja({ m, mio, ultimoMio, elegido, alElegir, alEliminar }) {
  const borrado = !!m.eliminado_en;
  const color = mio ? '#fff' : T.text;
  return (
    <div style={{ alignSelf: mio ? 'flex-end' : 'flex-start', maxWidth: 'min(82%, 520px)', display: 'flex', flexDirection: 'column', alignItems: mio ? 'flex-end' : 'flex-start' }}>
      <button
        type="button" onClick={mio && !borrado ? () => alElegir(m.id) : undefined} disabled={!mio || borrado}
        aria-label={mio && !borrado ? 'Tu mensaje: toca para ver opciones' : undefined}
        style={{
          display: 'block', textAlign: 'left', fontFamily: FONT, fontSize: 15.5, lineHeight: 1.4, padding: '9px 13px 7px', cursor: mio && !borrado ? 'pointer' : 'default', touchAction: 'manipulation',
          border: borrado ? `1px solid ${T.border}` : 'none', borderRadius: 18, borderBottomRightRadius: mio ? 6 : 18, borderBottomLeftRadius: mio ? 18 : 6,
          background: borrado ? 'transparent' : (mio ? T.accent : KP.surface), color: borrado ? T.text3 : color,
          boxShadow: !borrado && !mio ? KP.shCard : 'none', maxWidth: '100%',
        }}
      >
        {borrado ? <span style={{ fontStyle: 'italic', fontSize: 14.5 }}>Mensaje eliminado</span> : (
          <span style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{m.texto}</span>
        )}
        {!borrado && (
          <span style={{ display: 'block', textAlign: 'right', fontSize: 11, fontWeight: 600, marginTop: 2, opacity: 0.7, fontVariantNumeric: 'tabular-nums' }}>{horaTexto(m.creado_en)}</span>
        )}
      </button>
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
  const esCompu = useIsDesktop();
  const a = fila.atleta_id;
  const p = fila.profesional_id;
  const [mensajes, setMensajes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [hayMas, setHayMas] = useState(false);
  const [trayendo, setTrayendo] = useState(false);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const [elegido, setElegido] = useState(null);
  const zona = useRef(null);
  const campo = useRef(null);
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
  }, [a, p, uid, version, recarga]);

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

  const ajustaAlto = useCallback(() => {
    const t = campo.current;
    if (!t) return;
    t.style.height = 'auto';
    t.style.height = `${Math.min(t.scrollHeight, 132)}px`;
  }, []);

  async function envia() {
    const limpio = texto.trim();
    if (!limpio || enviando) return;
    setEnviando(true);
    setError(null);
    try {
      const m = await mandaTexto({ atletaId: a, profesionalId: p, autorId: uid, texto: limpio });
      setMensajes((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
      cantidad.current += 1;
      setTexto('');
      requestAnimationFrame(() => { if (campo.current) { campo.current.style.height = 'auto'; campo.current.focus(); } });
    } catch (e) {
      setError(e?.message ?? 'No se pudo mandar el mensaje');
    } finally {
      setEnviando(false);
    }
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
        key={m.id} m={m} mio={m.autor_id === uid} ultimoMio={m.id === ultimoMioId} elegido={elegido === m.id}
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
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'flex-end', gap: 8, padding: '8px 12px calc(10px + env(safe-area-inset-bottom))', background: KP.surface, borderTop: `1px solid ${KP.line}` }}>
          <textarea
            ref={campo} value={texto} rows={1} placeholder="Escribe un mensaje" aria-label="Escribe un mensaje" maxLength={4000}
            onChange={(e) => { setTexto(e.target.value); ajustaAlto(); }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && esCompu) { e.preventDefault(); envia(); } }}
            style={{
              flex: 1, minWidth: 0, resize: 'none', border: `1.5px solid ${T.border}`, borderRadius: 20, background: T.bg, padding: '11px 15px', fontFamily: FONT, fontSize: 16, lineHeight: 1.35,
              color: T.text, outline: 'none', maxHeight: 132,
            }}
          />
          <button
            type="button" onClick={envia} disabled={!texto.trim() || enviando} aria-label="Enviar" className="kp-press"
            style={{
              width: 46, height: 46, borderRadius: '50%', border: 'none', flexShrink: 0, display: 'grid', placeItems: 'center', touchAction: 'manipulation',
              cursor: texto.trim() && !enviando ? 'pointer' : 'default', background: texto.trim() ? T.accent : T.bg3, color: texto.trim() ? '#fff' : T.text3,
            }}
          >
            {enviando ? <Loader2 size={20} className="spin" /> : <Send size={20} />}
          </button>
        </div>
      ) : (
        <div style={{ flexShrink: 0, padding: '14px 16px calc(14px + env(safe-area-inset-bottom))', background: KP.surface, borderTop: `1px solid ${KP.line}`, textAlign: 'center', fontSize: 14, fontWeight: 700, color: T.text2 }}>
          Esta conversación está cerrada. Solo puedes leerla.
        </div>
      )}
    </div>
  );
}
