import { useEffect, useRef, useState } from 'react';
import { Check, Loader2, AlertTriangle } from 'lucide-react';
import HojaFlotante from '@/components/HojaFlotante';
import { buscaVideos, revisaUno, arreglaUno } from '@/lib/arreglaVideos';
import { LT, FONT, NUM_STYLE } from '@/lib/theme';

/**
 * «Arreglar videos lentos»: le pone el índice a los videos que ya están
 * guardados. Por qué tardaban tanto y qué es el índice, en `indiceDeVideo`; el
 * paso a paso de cada video, en `arreglaVideos`.
 *
 * QUÉ VE QUIEN LO USA. Primero se revisan los videos (unos segundos: solo se
 * pide un pedacito de cada uno). Si todos están bien, lo dice y ya. Si no,
 * enseña la lista y UN botón. Al darle, trabaja de uno en uno con su avance a
 * la vista, y al final dice cuántos quedaron y cuáles no.
 *
 * NO HAY QUE VIGILARLO, pero sí dejarlo abierto: baja y vuelve a subir cada
 * video, así que con wifi son minutos y con datos móviles sería gastar
 * gigas. Mientras trabaja la pantalla no se apaga y el navegador avisa si se
 * intenta cerrar la pestaña. «Detener» termina el video que va y para ahí:
 * lo que ya se arregló se queda arreglado, y se puede volver a empezar.
 */

const FASES = {
  bajando: 'Bajando',
  reempaquetando: 'Poniéndole índice',
  subiendo: 'Subiendo',
  comprobando: 'Comprobando',
  guardando: 'Guardando',
};

// Cuánto de UN video llevan hecho sus fases: bajar y subir son lo que pesa.
const PESO_DE_FASE = {
  bajando: [0, 0.4], reempaquetando: [0.4, 0.5], subiendo: [0.5, 0.95], comprobando: [0.95, 0.97], guardando: [0.97, 1],
};
const fraccionDe = (e) => {
  if (!e) return 0;
  if (e.fase === 'listo' || e.fase === 'error') return 1;
  const tramo = PESO_DE_FASE[e.fase];
  return tramo ? tramo[0] + (tramo[1] - tramo[0]) * ((e.pct ?? 0) / 100) : 0;
};

const mb = (bytes) => Math.round((bytes / 1048576) * 10) / 10;
const pesoLegible = (bytes) => (bytes >= 1073741824 ? `${(bytes / 1073741824).toFixed(1)} GB` : `${Math.round(bytes / 1048576)} MB`);

const botonAzul = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  padding: '13px 20px', borderRadius: 12, border: 'none', cursor: 'pointer',
  background: LT.blue, color: '#fff', fontFamily: FONT, fontSize: 15, fontWeight: 800,
};
const botonBlanco = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  padding: '12px 18px', borderRadius: 12, cursor: 'pointer',
  border: `1.5px solid ${LT.blue}`, background: LT.surface, color: LT.blue,
  fontFamily: FONT, fontSize: 14.5, fontWeight: 800,
};

function Fila({ nombre, derecha, abajo }) {
  return (
    <div style={{
      background: LT.surface, border: `1px solid ${LT.border}`, borderRadius: 12, padding: '10px 12px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between' }}>
        <span style={{
          fontSize: 14, fontWeight: 700, color: LT.text, minWidth: 0,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {nombre}
        </span>
        <span style={{
          fontSize: 12.5, fontWeight: 700, color: LT.text2, flexShrink: 0,
          display: 'inline-flex', alignItems: 'center', gap: 6, ...NUM_STYLE,
        }}>
          {derecha}
        </span>
      </div>
      {abajo}
    </div>
  );
}

function Barra({ fraccion, color = LT.blue }) {
  return (
    <div style={{ height: 6, borderRadius: 999, background: LT.surface2, overflow: 'hidden' }}>
      <div style={{
        height: '100%', width: `${Math.round(Math.min(1, Math.max(0, fraccion)) * 100)}%`,
        background: color, borderRadius: 999, transition: 'width .2s',
      }} />
    </div>
  );
}

export default function ArreglarVideos({ usuario, esMaster, onCerrar, onArreglados, onTodoBien }) {
  // revisando → lista → trabajando → fin   (o error)
  const [paso, setPaso] = useState('revisando');
  const [total, setTotal] = useState(0);
  const [revisados, setRevisados] = useState(0);
  const [pendientes, setPendientes] = useState([]);
  const [aparte, setAparte] = useState([]);     // los que no se pueden arreglar desde aquí
  const [bien, setBien] = useState(0);
  const [estados, setEstados] = useState({});   // por dirección: { fase, pct } | { fase: 'listo' } | { fase: 'error', mensaje }
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState('');
  const control = useRef(null);

  // Los avisos al de fuera viven en una ref: llegan como funciones escritas al
  // vuelo y, en las dependencias del efecto, reiniciarían la revisión.
  const avisos = useRef({ onArreglados, onTodoBien });
  useEffect(() => { avisos.current = { onArreglados, onTodoBien }; });

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const todos = await buscaVideos({ usuario, esMaster });
        if (!vivo) return;
        setTotal(todos.length);
        const malos = [];
        const otros = [];
        let buenos = 0;
        // De cuatro en cuatro: son pedidos chicos y así la revisión dura segundos.
        for (let i = 0; i < todos.length; i += 4) {
          const grupo = todos.slice(i, i + 4);
          const vistos = await Promise.all(grupo.map(
            (v) => revisaUno(v.url).then((r) => ({ v, r })).catch((e) => ({ v, e })),
          ));
          if (!vivo) return;
          vistos.forEach(({ v, r, e }) => {
            if (e) otros.push({ ...v, motivo: e.message });
            else if (r.tipo === 'bueno') buenos += 1;
            else if (r.grande) otros.push({ ...v, motivo: `pesa ${pesoLegible(r.total)}, demasiado para hacerlo desde aquí` });
            else if (r.listo) malos.push({ ...v, peso: r.total });
            else otros.push({ ...v, motivo: 'no es un video que se pueda arreglar' });
          });
          setRevisados(Math.min(todos.length, i + grupo.length));
        }
        setPendientes(malos);
        setAparte(otros);
        setBien(buenos);
        if (malos.length) {
          setPaso('lista');
        } else {
          setResultado({ arreglados: 0, errores: [], detenido: false });
          setPaso('fin');
          if (!otros.length) avisos.current.onTodoBien?.();
        }
      } catch (e) {
        if (vivo) { setError(e.message || 'No se pudo revisar los videos.'); setPaso('error'); }
      }
    })();
    return () => { vivo = false; };
  }, [usuario, esMaster]);

  // Mientras trabaja, el navegador avisa antes de cerrar la pestaña.
  useEffect(() => {
    if (paso !== 'trabajando') return undefined;
    const avisa = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', avisa);
    return () => window.removeEventListener('beforeunload', avisa);
  }, [paso]);

  async function arregla() {
    const parar = new AbortController();
    control.current = parar;
    setPaso('trabajando');
    const errores = [];
    let arreglados = 0;
    // Que la pantalla no se apague a la mitad. Es un extra: si el navegador no
    // lo ofrece, se sigue sin él.
    let luz = null;
    try { luz = await navigator.wakeLock?.request('screen'); } catch { /* opcional */ }

    for (const v of pendientes) {
      if (parar.signal.aborted) break;
      try {
        await arreglaUno(v, {
          senal: parar.signal,
          alAvanzar: (fase, f) => setEstados((e) => ({ ...e, [v.url]: { fase, pct: Math.round(f * 100) } })),
        });
        setEstados((e) => ({ ...e, [v.url]: { fase: 'listo' } }));
        arreglados += 1;
      } catch (e) {
        if (parar.signal.aborted) break;
        setEstados((s) => ({ ...s, [v.url]: { fase: 'error', mensaje: e.message || 'falló' } }));
        errores.push({ nombre: v.nombre, mensaje: e.message || 'falló' });
      }
    }
    try { await luz?.release(); } catch { /* ya se soltó */ }
    setResultado({ arreglados, errores, detenido: parar.signal.aborted });
    setPaso('fin');
    if (arreglados) avisos.current.onArreglados?.();
    if (!errores.length && !parar.signal.aborted && !aparte.length) avisos.current.onTodoBien?.();
  }

  // Cerrar mientras trabaja = detener: termina el video que va y para.
  const cerrar = () => {
    if (paso === 'trabajando') control.current?.abort();
    else onCerrar();
  };

  const hechos = pendientes.filter((v) => estados[v.url]?.fase === 'listo').length;
  const avanceGeneral = pendientes.length
    ? pendientes.reduce((suma, v) => suma + fraccionDe(estados[v.url]), 0) / pendientes.length
    : 0;

  return (
    <HojaFlotante titulo="Arreglar videos lentos" onCerrar={cerrar}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontFamily: FONT }}>

        {paso === 'revisando' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '18px 4px', color: LT.text2, fontWeight: 700 }}>
            <Loader2 size={18} className="spin" />
            Revisando tus videos{total ? ` (${revisados} de ${total})` : ''}…
          </div>
        )}

        {paso === 'error' && (
          <>
            <div style={{
              background: 'rgba(220,38,38,0.08)', color: LT.danger, borderRadius: 12,
              padding: '12px 14px', fontWeight: 600, lineHeight: 1.45,
            }}>
              {error}
            </div>
            <button type="button" onClick={onCerrar} style={botonBlanco}>Cerrar</button>
          </>
        )}

        {paso === 'lista' && (
          <>
            <div style={{ fontSize: 17, fontWeight: 800, color: LT.text, letterSpacing: -0.2 }}>
              {pendientes.length === 1 ? '1 video tarda' : `${pendientes.length} videos tardan`} en cargar
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {pendientes.map((v) => (
                <Fila key={v.url} nombre={v.nombre} derecha={`${mb(v.peso)} MB`} />
              ))}
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: LT.text2, lineHeight: 1.5 }}>
              Se bajan y se vuelven a subir: unos {pesoLegible(pendientes.reduce((s, v) => s + v.peso, 0) * 2)} en total.
              Mejor con wifi y sin cerrar esta pantalla. La imagen no cambia.
            </div>
            <button type="button" onClick={arregla} style={botonAzul}>
              {pendientes.length === 1 ? 'Arreglar el video' : `Arreglar los ${pendientes.length} videos`}
            </button>
          </>
        )}

        {paso === 'trabajando' && (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
              <span style={{ fontSize: 17, fontWeight: 800, color: LT.text }}>
                {hechos} de {pendientes.length}
              </span>
              <button type="button" onClick={cerrar} style={{ ...botonBlanco, padding: '8px 14px', fontSize: 13 }}>
                Detener
              </button>
            </div>
            <Barra fraccion={avanceGeneral} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {pendientes.map((v) => {
                const e = estados[v.url];
                const activo = e && e.fase !== 'listo' && e.fase !== 'error';
                return (
                  <Fila
                    key={v.url}
                    nombre={v.nombre}
                    derecha={(() => {
                      if (!e) return 'En espera';
                      if (e.fase === 'listo') return <><Check size={15} color={LT.mint} /> Listo</>;
                      if (e.fase === 'error') return <><AlertTriangle size={15} color={LT.danger} /> No se pudo</>;
                      return <><Loader2 size={14} className="spin" /> {FASES[e.fase]}{e.fase === 'bajando' || e.fase === 'subiendo' ? ` ${e.pct}%` : ''}</>;
                    })()}
                    abajo={activo && (e.fase === 'bajando' || e.fase === 'subiendo') ? (
                      <div style={{ marginTop: 8 }}><Barra fraccion={(e.pct ?? 0) / 100} /></div>
                    ) : e?.fase === 'error' ? (
                      <div style={{ marginTop: 6, fontSize: 12.5, fontWeight: 600, color: LT.danger, lineHeight: 1.4 }}>{e.mensaje}</div>
                    ) : null}
                  />
                );
              })}
            </div>
          </>
        )}

        {paso === 'fin' && resultado && (
          <>
            {resultado.arreglados > 0 && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(0,163,114,0.10)',
                color: '#00714F', borderRadius: 12, padding: '12px 14px', fontWeight: 800, fontSize: 15,
              }}>
                <Check size={18} />
                {resultado.arreglados === 1 ? '1 video arreglado' : `${resultado.arreglados} videos arreglados`}
              </div>
            )}
            {resultado.arreglados === 0 && resultado.errores.length === 0 && !resultado.detenido && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(0,163,114,0.10)',
                color: '#00714F', borderRadius: 12, padding: '12px 14px', fontWeight: 800, fontSize: 15,
              }}>
                <Check size={18} />
                {bien === 1 ? 'Tu video ya carga rápido' : 'Todos tus videos ya cargan rápido'}
              </div>
            )}
            {resultado.detenido && (
              <div style={{ fontSize: 14, fontWeight: 700, color: LT.text2 }}>
                Se detuvo. Lo que ya estaba arreglado se queda así; puedes volver a empezar cuando quieras.
              </div>
            )}
            {resultado.errores.length > 0 && (
              <>
                <div style={{ fontSize: 14, fontWeight: 800, color: LT.danger }}>
                  {resultado.errores.length === 1 ? '1 no se pudo arreglar' : `${resultado.errores.length} no se pudieron arreglar`}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {resultado.errores.map((x) => (
                    <Fila key={x.nombre} nombre={x.nombre}
                      abajo={<div style={{ marginTop: 6, fontSize: 12.5, fontWeight: 600, color: LT.danger, lineHeight: 1.4 }}>{x.mensaje}</div>} />
                  ))}
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: LT.text2 }}>
                  Esos videos siguen funcionando como antes. Puedes intentarlo otra vez.
                </div>
              </>
            )}
            {aparte.length > 0 && (
              <>
                <div style={{ fontSize: 14, fontWeight: 800, color: LT.text }}>
                  {aparte.length === 1 ? '1 video se dejó como estaba' : `${aparte.length} videos se dejaron como estaban`}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {aparte.map((x) => (
                    <Fila key={x.url} nombre={x.nombre}
                      abajo={<div style={{ marginTop: 6, fontSize: 12.5, fontWeight: 600, color: LT.text2, lineHeight: 1.4 }}>{x.motivo}</div>} />
                  ))}
                </div>
              </>
            )}
            <button type="button" onClick={onCerrar} style={botonAzul}>Listo</button>
          </>
        )}
      </div>
    </HojaFlotante>
  );
}
