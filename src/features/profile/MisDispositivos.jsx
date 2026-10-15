import { useCallback, useEffect, useState } from 'react';
import { Loader2, Watch } from 'lucide-react';
import { PROVEEDORES, conectaDispositivo, desconectaDispositivo, leeMisDispositivos } from '@/lib/dispositivos';
import { useConfirmacion } from '@/components/Confirmacion';
import { Aviso, Chip, boton, tarjeta, titulo } from '@/features/profile/piezas';
import { T } from '@/lib/theme';

/* «DISPOSITIVOS» en Mi perfil (15 oct 2026). Andrés: «dónde administra los dispositivos que tiene conectados: Apple Watch, Garmin, Whoop…». La pantalla ya existe; cada conexión se enciende
   cuando esté hecha (`lib/dispositivos.js`). Desconectar funciona hoy: borra la conexión. Mientras tanto se puede importar un archivo de entreno en «Mis métricas». */

export default function MisDispositivos({ onIrAMetricas }) {
  const pregunta = useConfirmacion();
  const [conectados, setConectados] = useState(undefined);
  const [busy, setBusy] = useState('');
  const [mensajes, setMensajes] = useState({});

  const lee = useCallback(async () => {
    try { setConectados(await leeMisDispositivos()); } catch { setConectados([]); }
  }, []);
  useEffect(() => { lee(); }, [lee]);

  const di = (id, texto) => setMensajes((m) => ({ ...m, [id]: texto }));

  async function conecta(p) {
    setBusy(p.id); di(p.id, '');
    try {
      const { url } = (await conectaDispositivo(p.id)) ?? {};
      if (url) window.location.assign(url);
    } catch (e) {
      di(p.id, e.codigo === 'NO_DISPONIBLE' ? (p.donde === 'telefono' ? 'Se conecta desde la app del iPhone, que llega pronto.' : 'Todavía no está disponible. Pronto.') : e.message);
    } finally {
      setBusy('');
    }
  }

  async function desconecta(p) {
    const va = await pregunta({ titulo: `¿Desconectar ${p.nombre}?`, detalle: 'Deja de traer tus datos. Lo que ya guardamos se queda; puedes volver a conectarlo cuando quieras.', confirmar: 'Sí, desconectar', peligro: true });
    if (!va) return;
    setBusy(p.id);
    try { await desconectaDispositivo(p.id); await lee(); } catch (e) { di(p.id, e.message); } finally { setBusy(''); }
  }

  if (conectados === undefined) return <div style={{ display: 'grid', placeItems: 'center', padding: 30 }}><Loader2 size={22} className="spin" color={T.text2} /></div>;
  const estaConectado = (id) => conectados.find((c) => c.proveedor === id);

  return (
    <>
      <div>
        <div style={titulo}>Tus dispositivos</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {PROVEEDORES.map((p) => {
            const c = estaConectado(p.id);
            return (
              <div key={p.id} style={tarjeta}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ display: 'flex', gap: 11, minWidth: 0 }}>
                    <Watch size={20} color={T.text2} style={{ flexShrink: 0, marginTop: 1 }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: T.text }}>{p.nombre}</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: T.text2, marginTop: 2, lineHeight: 1.4 }}>{p.detalle}</div>
                    </div>
                  </div>
                  <Chip tono={c ? (c.estado === 'error' ? 'malo' : 'ok') : 'neutro'}>{c ? (c.estado === 'error' ? 'Con error' : 'Conectado') : 'Sin conectar'}</Chip>
                </div>
                {c?.ultima_sincronizacion && <div style={{ fontSize: 12.5, fontWeight: 600, color: T.text3, marginTop: 8 }}>Última lectura: {new Date(c.ultima_sincronizacion).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>}
                <div style={{ marginTop: 12 }}>
                  {c
                    ? <button type="button" style={boton(false, busy === p.id)} disabled={busy === p.id} onClick={() => desconecta(p)}>{busy === p.id ? <Loader2 size={15} className="spin" /> : null} Desconectar</button>
                    : <button type="button" style={boton(true, busy === p.id)} disabled={busy === p.id} onClick={() => conecta(p)}>{busy === p.id ? <Loader2 size={15} className="spin" /> : null} Conectar</button>}
                </div>
                {mensajes[p.id] && <div style={{ marginTop: 10 }}><Aviso tono="azul" role="status">{mensajes[p.id]}</Aviso></div>}
              </div>
            );
          })}
        </div>
      </div>
      {onIrAMetricas && (
        <div>
          <div style={titulo}>Mientras tanto</div>
          <button type="button" style={{ ...boton(false), width: '100%', justifyContent: 'flex-start' }} onClick={onIrAMetricas}>Importar un archivo de entreno</button>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: T.text3, marginTop: 7, lineHeight: 1.45 }}>Sube el archivo que te baja tu reloj o tu app y Training Lab lee tus métricas.</div>
        </div>
      )}
    </>
  );
}
