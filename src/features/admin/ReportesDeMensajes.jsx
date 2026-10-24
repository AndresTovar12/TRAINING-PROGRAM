import { useEffect, useState } from 'react';
import { Flag, Loader2 } from 'lucide-react';
import { T, KP, FONT, UI } from '@/lib/theme';
import { leeReportes } from '@/lib/mensajesApi';
import { supabase } from '@/lib/supabase';
import { useEnBanda } from '@/components/ui';

/* REPORTES DE MENSAJES (24 oct 2026), solo para el dueño. Apple pide que quien recibe contenido de otra persona pueda reportarlo y que alguien lo revise.
   Cada reporte guarda una copia del texto (por si el mensaje se borra), quién reportó y en qué conversación. Solo se lee: no hay botón de «atendido» a propósito
   (la base no permite actualizar filas; el estado se lleva por fuera). Si hay reportes nuevos, el dueño los atiende escribiendo a las personas. */

const fecha = (f) => new Date(f).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

export default function ReportesDeMensajes() {
  const enBanda = useEnBanda();
  const [filas, setFilas] = useState(null);
  const [nombres, setNombres] = useState({});
  const [error, setError] = useState(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const lista = await leeReportes();
        const ids = [...new Set(lista.flatMap((r) => [r.reportado_por, r.atleta_id, r.profesional_id]))];
        const { data } = ids.length ? await supabase.from('profiles').select('id, full_name, username').in('id', ids) : { data: [] };
        if (!vivo) return;
        setNombres(Object.fromEntries((data ?? []).map((p) => [p.id, p.full_name || p.username])));
        setFilas(lista);
      } catch (e) {
        if (vivo) { setError(e?.message ?? 'No se pudieron leer los reportes'); setFilas([]); }
      }
    })();
    return () => { vivo = false; };
  }, []);

  const nombre = (id) => nombres[id] ?? 'alguien';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontFamily: FONT, maxWidth: 720, margin: '0 auto' }}>
      {!enBanda && <div style={{ fontSize: 22, fontWeight: 800, color: T.text }}>Reportes de mensajes</div>}
      <div style={{ fontSize: 14.5, fontWeight: 600, color: T.text2 }}>Lo que las personas reportaron en Mensajes. Lo más nuevo, primero.</div>
      {error && <div role="alert" style={{ padding: '10px 14px', borderRadius: 12, background: KP.dangerSoft, color: KP.danger, fontSize: 14, fontWeight: 700 }}>{error}</div>}
      {!filas && <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.text2, fontWeight: 600 }}><Loader2 size={16} className="spin" /> Cargando…</div>}
      {filas && filas.length === 0 && !error && (
        <div style={{ padding: '28px 16px', textAlign: 'center', borderRadius: 18, background: UI.relleno, color: T.text2, fontWeight: 700, fontSize: 15 }}>Nadie ha reportado nada.</div>
      )}
      {(filas ?? []).map((r) => (
        <div key={r.id} style={{ background: KP.surface, borderRadius: 18, padding: '14px 16px', boxShadow: KP.shCard, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, fontWeight: 800, color: T.text }}>
            <Flag size={15} color={KP.danger} /> {nombre(r.reportado_por)} reportó un mensaje
            <span style={{ marginLeft: 'auto', fontWeight: 600, color: T.text3 }}>{fecha(r.creado_en)}</span>
          </div>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: T.text3 }}>Conversación: {nombre(r.atleta_id)} · {nombre(r.profesional_id)}</div>
          <div style={{ fontSize: 15, fontWeight: 500, color: T.text, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', background: UI.relleno, borderRadius: 12, padding: '10px 12px' }}>{r.copia_del_mensaje}</div>
          {r.motivo && <div style={{ fontSize: 13.5, fontWeight: 600, color: T.text2 }}>Motivo: {r.motivo}</div>}
        </div>
      ))}
    </div>
  );
}
