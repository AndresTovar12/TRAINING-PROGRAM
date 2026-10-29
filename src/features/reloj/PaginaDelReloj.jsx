import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronLeft, Loader2, RefreshCw, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useAviso } from '@/components/AvisoPasajero';
import { useConfirmacion } from '@/components/Confirmacion';
import { Fila, Grupo } from '@/components/ui';
import { FONT, KP, LT } from '@/lib/theme';
import { revisaPermiso, saludDisponible } from '@/lib/saludDelTelefono';
import { cuandoDicho, cuentaDelReloj, desconectaDelReloj, diaDicho, useReloj } from '@/lib/relojConectado';
import { traeLoUltimo } from '@/lib/sincronizaSalud';
import { HojaDeAyuda, PASOS_DE_LA_APP_WATCH, PASOS_DE_SALUD } from './piezas';

/* LA PÁGINA DEL RELOJ (fase 5, 29 oct 2026; Mi perfil → Dispositivos → «Apple Salud y Apple Watch», ya conectado). Del prototipo: desde cuándo cuenta,
   «Traer lo último ahora», lo que está llegando (palomita si llegó en los últimos 7 días; si no, «Todavía nada»: de la LECTURA iOS no dice si está apagada,
   así que nunca se dice «Apagado en Salud» de una lectura), si el reloj puede guardar sus entrenos (eso sí se sabe), el reloj emparejado y su app, cómo
   cambiar los permisos y «Desconectar». */

const SIETE_DIAS = 7 * 86400000;

const Estado = ({ si }) => (
  <span style={{ display: 'grid', placeItems: 'center', width: 26, height: 26, borderRadius: '50%', flex: 'none', background: si ? KP.mintSoft : '#F1F2F5', color: si ? KP.mint : '#9AA0AB' }}>
    {si ? <Check size={15} strokeWidth={2.6} /> : <X size={15} strokeWidth={2.6} />}
  </span>
);

export default function PaginaDelReloj({ alCerrar }) {
  const { user, profile } = useAuth();
  const { conexion, reloj, trayendo } = useReloj();
  const { avisa } = useAviso();
  const pregunta = useConfirmacion();
  const [cuenta, setCuenta] = useState({ n: 0, ultimo: null });
  const [escribe, setEscribe] = useState(null); // ¿el reloj puede guardar sus entrenos en Salud? (null: todavía no se sabe)
  const [ayuda, setAyuda] = useState(null); // 'permisos' | 'instalar'
  const [ahora] = useState(() => Date.now());
  const desde = conexion?.conectado_en ?? null;
  const ultimaSync = conexion?.ultima_sincronizacion ?? null;

  useEffect(() => {
    let vivo = true;
    cuentaDelReloj(user?.id, desde).then((c) => { if (vivo) setCuenta(c); });
    return () => { vivo = false; };
  }, [user?.id, desde, ultimaSync]);
  useEffect(() => {
    if (!saludDisponible()) return undefined;
    let vivo = true;
    revisaPermiso().then((r) => { if (vivo) setEscribe(r.escribe); }, () => {});
    return () => { vivo = false; };
  }, []);

  if (!conexion) return null;
  const llego = conexion.detalle?.llego ?? {};
  const reciente = (k) => !!llego[k] && ahora - Date.parse(llego[k]) < SIETE_DIAS;
  const nombre = (profile?.full_name || '').trim().split(/\s+/)[0];

  const trae = async () => {
    try {
      const r = await traeLoUltimo();
      const n = (r?.nuevos ?? 0) + (r?.enriquecidos?.length ?? 0);
      avisa(n ? (n === 1 ? 'Llegó 1 entreno de tu Apple Watch' : `Llegaron ${n} entrenos de tu Apple Watch`) : 'Al día. No hay entrenos nuevos.');
    } catch {
      avisa('No se pudo leer Apple Salud. Inténtalo otra vez.');
    }
  };
  const desconecta = async () => {
    const si = await pregunta({
      titulo: '¿Dejar de traer tu Apple Watch?', detalle: 'Lo que ya llegó se queda. Para quitar el permiso por completo: Salud, tu foto, Apps, Training Lab.',
      confirmar: 'Desconectar', peligro: true,
    });
    if (!si) return;
    try { await desconectaDelReloj(); alCerrar(); avisa('Apple Watch desconectado'); } catch { avisa('No se pudo desconectar. Inténtalo otra vez.'); }
  };

  const fila = (si, texto, dSi, dNo) => <Fila izquierda={<Estado si={si} />} texto={texto} detalle={si ? dSi : dNo} />;
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Apple Watch" style={{ position: 'fixed', inset: 0, zIndex: 3300, background: LT.bg, fontFamily: FONT, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 'calc(10px + env(safe-area-inset-top)) 16px 8px', maxWidth: 560, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        <button type="button" onClick={alCerrar} aria-label="Atrás" className="kp-press" style={{ width: 42, height: 42, borderRadius: 13, border: 'none', background: '#EBEDF1', color: KP.ink, display: 'grid', placeItems: 'center', cursor: 'pointer', flex: 'none' }}><ChevronLeft size={20} /></button>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: -0.5, color: KP.ink }}>Apple Watch</h1>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ maxWidth: 560, margin: '0 auto', padding: '8px 16px calc(32px + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: 22 }}>
          <section style={{ background: '#fff', borderRadius: 22, padding: 16, display: 'grid', gap: 14, boxShadow: '0 1px 2px rgba(17,19,24,.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ width: 46, height: 46, borderRadius: 14, background: KP.mintSoft, color: KP.mint, display: 'grid', placeItems: 'center', flex: 'none' }}><Check size={22} strokeWidth={2.6} /></span>
              <span style={{ minWidth: 0 }}>
                <b style={{ display: 'block', fontSize: 17, fontWeight: 800, color: KP.ink }}>Conectado desde {diaDicho(desde)}</b>
                <span style={{ display: 'block', fontSize: 13.5, color: KP.ink2, lineHeight: 1.4 }}>Cuenta desde ese día. Lo nuevo llega solo al abrir la app y al terminar un entreno.</span>
              </span>
            </div>
            <button type="button" onClick={trae} disabled={trayendo || !saludDisponible()} className="kp-press" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', minHeight: 52, border: 'none', borderRadius: 16, background: '#EBEDF1', color: KP.ink, font: `700 15.5px ${FONT}`, cursor: 'pointer', opacity: !saludDisponible() ? 0.5 : 1 }}>
              {trayendo ? <><Loader2 size={19} className="spin" />Trayendo lo último…</> : <><RefreshCw size={19} />Traer lo último ahora</>}
            </button>
          </section>

          <Grupo titulo="Lo que está llegando" pie="Tu coach ve tus entrenos, tu pulso y tu recuperación.">
            <Fila
              izquierda={<Estado si={!!cuenta.ultimo && ahora - Date.parse(cuenta.ultimo) < SIETE_DIAS} />} texto="Entrenos"
              detalle={cuenta.n > 0 ? `${cuenta.n} desde que conectaste · el último ${cuandoDicho(cuenta.ultimo)}` : 'Todavía nada'}
            />
            {fila(reciente('pulso'), 'Pulso', 'En cada entreno', 'Todavía nada')}
            {fila(reciente('ruta'), 'Ruta', 'En los entrenos al aire libre', 'Todavía nada')}
            {fila(reciente('recuperacion'), 'Recuperación', 'Pulso en reposo y variabilidad, cada día', 'Todavía nada')}
            {fila(reciente('sueno'), 'Sueño', 'Cada noche que duermas con él', 'Todavía nada')}
            {escribe !== null && fila(escribe, 'Tu reloj guarda tus entrenos', 'Así mide tu pulso cuando entrenas aquí', 'Apagado en Salud: el reloj no podrá medir')}
          </Grupo>

          <Grupo titulo="Tu reloj">
            {reloj.emparejado ? (
              <>
                {fila(true, 'Apple Watch emparejado', reloj.prueba ? 'Modo de prueba' : `Apple Watch${nombre ? ` de ${nombre}` : ''}`)}
                {reloj.instalada || reloj.prueba
                  ? fila(true, 'Training Lab en el reloj', 'Se abre sola cuando empiezas un entreno')
                  : (
                    <Fila
                      izquierda={<Estado si={false} />} texto="Training Lab en el reloj" detalle="Falta instalarla"
                      derecha={<button type="button" onClick={() => setAyuda('instalar')} className="kp-press" style={pastillaAzul}>Cómo</button>}
                    />
                  )}
              </>
            ) : fila(false, 'Sin Apple Watch emparejado', '', 'Traemos lo que otras apps guardan en Salud')}
          </Grupo>

          <Grupo>
            <Fila texto="Cómo cambiar los permisos" onClick={() => setAyuda('permisos')} />
            <Fila texto="Desconectar" tono="peligro" onClick={desconecta} />
          </Grupo>
        </div>
      </div>
      {ayuda === 'permisos' && <HojaDeAyuda titulo="Cómo cambiar los permisos" texto="Se cambian en la app Salud de tu iPhone:" pasos={PASOS_DE_SALUD('Enciende o apaga lo que quieras')} onCerrar={() => setAyuda(null)} />}
      {ayuda === 'instalar' && <HojaDeAyuda titulo="Instala Training Lab en tu reloj" texto="Se instala desde la app Watch de tu iPhone:" pasos={PASOS_DE_LA_APP_WATCH} onCerrar={() => setAyuda(null)} />}
      <style>{'.spin{animation:spin .8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}'}</style>
    </div>,
    document.body,
  );
}

export const pastillaAzul = { border: 'none', borderRadius: 999, background: KP.blue, color: '#fff', font: `800 14px ${FONT}`, padding: '8px 15px', minHeight: 36, whiteSpace: 'nowrap', cursor: 'pointer' };
export const pastillaGris = { border: 'none', borderRadius: 999, background: '#EBEDF1', color: KP.ink, font: `700 13px ${FONT}`, padding: '7px 12px', minHeight: 34, whiteSpace: 'nowrap', cursor: 'pointer' };
