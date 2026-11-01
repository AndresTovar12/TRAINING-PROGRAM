import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CloudOff, CloudUpload } from 'lucide-react';
import { FONT, KP } from '@/lib/theme';
import { useSinSenal } from '@/lib/senal';
import { conCopiaEnElTelefono } from '@/lib/almacenDelTelefono';
import { quitaDeLaCola, reintentaLaCola, useCola } from '@/lib/colaDelTelefono';
import { plural } from '@/lib/plural';
import { useAviso } from '@/components/AvisoPasajero';
import { useConfirmacion } from '@/components/Confirmacion';
import HojaFlotante from '@/components/HojaFlotante';
import { Boton, Fila, Grupo, IconoDeFila } from '@/components/ui';

/* LO QUE SE VE DE «SIN CONEXIÓN» (1 nov 2026, encargo «sin conexión», parte 2; ver `docs/sin-conexion.md`). Solo en la app de iPhone: en la web no hay copia ni cola. */

export const TEXTO_SIN_CONEXION = 'Sin conexión. Lo que hagas se guarda en tu teléfono y se sube solo.';

/**
 * El aviso fijo y chico de arriba mientras no hay señal: una franja oscura justo debajo de la hora del iPhone. No tapa nada de la app: la empuja hacia abajo su
 * misma altura (el hueco de abajo y `--aviso-vista`, como el aviso de «Ver como»). Va debajo de las hojas (Mi perfil, el entreno): esas lo tapan mientras están
 * abiertas. Se monta ANTES de `TrainingApp` para que el hueco quede arriba.
 */
export function AvisoSinConexion() {
  const sinSenal = useSinSenal();
  const visible = sinSenal && conCopiaEnElTelefono();
  const franja = useRef(null);
  const [alto, setAlto] = useState(0);
  useLayoutEffect(() => {
    if (!visible || !franja.current) return undefined;
    const raiz = document.documentElement;
    // Se mide (el texto ocupa dos renglones en un iPhone y uno en una pantalla ancha): lo que se corre es exactamente lo que mide.
    const mide = () => {
      const h = Math.ceil(franja.current?.getBoundingClientRect().height ?? 0);
      setAlto(h);
      raiz.style.setProperty('--aviso-vista', `${h}px`);
    };
    mide();
    const observa = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(mide) : null;
    observa?.observe(franja.current);
    return () => { observa?.disconnect(); raiz.style.removeProperty('--aviso-vista'); };
  }, [visible]);
  if (!visible) return null;
  return (
    <>
      <div
        ref={franja} role="status" aria-live="polite"
        style={{
          position: 'fixed', top: 'env(safe-area-inset-top)', left: 0, right: 0, zIndex: 1100,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '7px 16px',
          background: KP.ink, color: '#fff', fontFamily: FONT, fontSize: 12.5, fontWeight: 700, lineHeight: 1.3, textAlign: 'center',
        }}
      >
        <CloudOff size={15} style={{ flexShrink: 0 }} />
        <span>{TEXTO_SIN_CONEXION}</span>
      </div>
      <div aria-hidden="true" style={{ height: alto }} />
    </>
  );
}

/**
 * «No se guardó. Reintentar» cuando el servidor RECHAZA algo de la cola (no por falta de señal: eso solo enseña el aviso de arriba). Sale cada vez que hay un rechazo
 * nuevo (también al abrir la app si quedó alguno) y se va cuando ya no queda ninguno.
 */
export function AvisoDeLaCola() {
  const { rechazadas } = useCola();
  const { falla, quitaFalla } = useAviso();
  const ultimo = rechazadas.reduce((m, c) => Math.max(m, c.rechazo?.en ?? 0), 0);
  const visto = useRef(0);
  useEffect(() => {
    if (!rechazadas.length) { quitaFalla('cola'); visto.current = 0; return; }
    if (ultimo > visto.current) {
      visto.current = ultimo;
      falla('No se guardó. Reintentar', { clave: 'cola', accion: { texto: 'Reintentar', alTocar: () => { quitaFalla('cola'); reintentaLaCola(); } } });
    }
  }, [rechazadas.length, ultimo, falla, quitaFalla]);
  return null;
}

// Cómo se llama una cosa de la cola en la lista («Correr · 1 nov»). Lo del reloj (parte 3) trae su `datos.titulo`.
function nombreDe(cosa) {
  const d = cosa.datos ?? {};
  const titulo = d.titulo ?? d.prep?.titulo ?? (cosa.tipo === 'entreno-libre' ? 'Entreno libre' : 'Algo por subir');
  const inicio = d.inicio ?? d.prep?.inicio ?? cosa.creadoEn;
  const fecha = inicio ? new Date(inicio).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) : '';
  return fecha ? `${titulo} · ${fecha}` : titulo;
}

/** En Mi perfil, mientras haya pendientes: «N cosas por subir». Al tocarlo, la lista (y «Reintentar»; lo rechazado se puede descartar). */
export function FilaPorSubir() {
  const { porSubir, delEstado, cosas, rechazadas, enVuelo } = useCola();
  const [abierta, setAbierta] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const pregunta = useConfirmacion();
  if (!porSubir) return null;
  const otraVez = async () => {
    setSubiendo(true);
    try { await reintentaLaCola(); } finally { setSubiendo(false); }
  };
  const descarta = async (cosa) => {
    const si = await pregunta({ titulo: `¿Descartar «${nombreDe(cosa)}»?`, detalle: 'No se subirá y no se puede recuperar.', confirmar: 'Descartar', peligro: true });
    if (si) await quitaDeLaCola(cosa.id);
  };
  return (
    <>
      <Grupo>
        <Fila
          izquierda={<IconoDeFila color={rechazadas.length ? KP.danger : KP.blue} fondo={rechazadas.length ? '#FDECEC' : KP.blueSoft}><CloudUpload size={18} /></IconoDeFila>}
          texto={`${plural(porSubir, 'cosa', 'cosas')} por subir`}
          detalle={rechazadas.length ? `${plural(rechazadas.length, 'no se pudo', 'no se pudieron')} guardar. Toca para reintentar.` : 'Se suben solas cuando haya internet.'}
          onClick={() => setAbierta(true)}
        />
      </Grupo>
      {abierta && (
        <HojaFlotante titulo="Por subir" subtitulo="Están guardadas en tu teléfono." onCerrar={() => setAbierta(false)} capa={3300}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontFamily: FONT }}>
            <Grupo>
              {delEstado > 0 && <Fila texto="Lo que anotaste en tu plan" detalle={plural(delEstado, 'cambio', 'cambios')} />}
              {cosas.map((c) => (
                <Fila
                  key={c.id} texto={nombreDe(c)}
                  detalle={c.id === enVuelo ? 'Subiendo…' : c.rechazo ? `No se guardó: ${c.rechazo.mensaje}` : 'Esperando internet'}
                  derecha={c.rechazo && c.id !== enVuelo ? <Boton tipo="texto" chico estilo={{ color: KP.danger }} onClick={() => descarta(c)}>Descartar</Boton> : undefined}
                />
              ))}
            </Grupo>
            <Boton onClick={otraVez} cargando={subiendo} ancho>Reintentar ahora</Boton>
          </div>
        </HojaFlotante>
      )}
    </>
  );
}
