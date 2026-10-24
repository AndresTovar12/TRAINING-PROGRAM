import { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw, Upload, Watch } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { guardaImportacion } from '@/lib/metricasApi';
import { conectaSalud, leeSalud, marcaSincronizada, olvidaSalud, saludDisponible, ultimaSincronizacion } from '@/lib/saludDelTelefono';
import { PROVEEDORES, conectaDispositivo, desconectaDispositivo, leeMisDispositivos } from '@/lib/dispositivos';
import { useConfirmacion } from '@/components/Confirmacion';
import { useAviso } from '@/components/AvisoPasajero';
import { Fila, Grupo, IconoDeFila, Interruptor } from '@/components/ui';
import { KP } from '@/lib/theme';

/* «DISPOSITIVOS» en Mi perfil (15 oct 2026). Andrés: «dónde administra los dispositivos que tiene conectados: Apple Watch, Garmin, Whoop…». La pantalla ya existe; cada conexión se enciende
   cuando esté hecha (`lib/dispositivos.js`). Desconectar funciona hoy: borra la conexión. Mientras tanto se puede importar un archivo de entreno en «Mis métricas».
   Reestructura visual (15 oct 2026), como «Dispositivos» de las capturas: un renglón por servicio con su interruptor. Prenderlo empieza a conectar; apagarlo pregunta y desconecta. */

const LETRA = { apple_salud: null, garmin: ['G', '#1E40E0', '#E8EEFF'], whoop: ['W', '#C5305C', '#FDE8EE'], strava: ['S', '#C2620A', '#FFF0E1'] };

export default function MisDispositivos({ onIrAMetricas }) {
  const pregunta = useConfirmacion();
  const { avisa } = useAviso();
  const { user } = useAuth();
  const [conectados, setConectados] = useState(undefined);
  const [aviso, setAviso] = useState(''); // lo que va leyendo Apple Salud mientras trabaja
  const [salud, setSalud] = useState(() => ultimaSincronizacion()); // cuándo se leyó Apple Salud por última vez (solo en este teléfono)
  const [busy, setBusy] = useState('');

  const lee = useCallback(async () => {
    try { setConectados(await leeMisDispositivos()); } catch { setConectados([]); }
  }, []);
  useEffect(() => { lee(); }, [lee]);

  /* Apple Salud (24 oct 2026): se pide el permiso, se leen los últimos 30 días y se guardan con el mismo camino que un archivo importado. Corre en el teléfono: no hay servidor de por medio. */
  async function sincronizaSalud(primera = false) {
    setBusy('apple_salud');
    try {
      if (primera) await conectaSalud();
      const resultado = await leeSalud({ dias: primera ? 60 : 14, alAvance: setAviso });
      setAviso('Guardando…');
      const r = await guardaImportacion({ atletaId: user.id, subidoPor: user.id, resultado, desfaseMin: -new Date().getTimezoneOffset() });
      marcaSincronizada();
      setSalud(ultimaSincronizacion());
      avisa(r.nuevos ? `Apple Salud: ${r.nuevos} entrenos nuevos` : 'Apple Salud al día');
    } catch (e) {
      avisa(e?.message || 'No se pudo leer Apple Salud');
    } finally {
      setAviso('');
      setBusy('');
    }
  }

  async function conecta(p) {
    if (p.id === 'apple_salud' && saludDisponible()) { await sincronizaSalud(true); return; }
    setBusy(p.id);
    try {
      const { url } = (await conectaDispositivo(p.id)) ?? {};
      if (url) window.location.assign(url);
    } catch (e) {
      avisa(e.codigo === 'NO_DISPONIBLE' ? (p.donde === 'telefono' ? `${p.nombre}: se conecta desde la app del iPhone, que llega pronto` : `${p.nombre}: pronto`) : e.message);
    } finally {
      setBusy('');
    }
  }

  async function desconecta(p) {
    if (p.id === 'apple_salud') {
      const va = await pregunta({ titulo: '¿Dejar de leer Apple Salud?', detalle: 'Lo que ya guardamos se queda. Para quitar el permiso por completo: Ajustes del iPhone → Salud → Acceso a datos y dispositivos → Training Lab.', confirmar: 'Sí, dejar de leer', peligro: true });
      if (!va) return;
      olvidaSalud(); setSalud(null); avisa('Apple Salud desconectado'); return;
    }
    const va = await pregunta({ titulo: `¿Desconectar ${p.nombre}?`, detalle: 'Deja de traer tus datos. Lo que ya guardamos se queda; puedes volver a conectarlo cuando quieras.', confirmar: 'Sí, desconectar', peligro: true });
    if (!va) return;
    setBusy(p.id);
    try { await desconectaDispositivo(p.id); await lee(); avisa(`${p.nombre} desconectado`); } catch (e) { avisa(e.message); } finally { setBusy(''); }
  }

  if (conectados === undefined) return <div style={{ display: 'grid', placeItems: 'center', padding: 30 }}><Loader2 size={22} className="spin" color={KP.ink2} /></div>;
  const estaConectado = (id) => (id === 'apple_salud' && salud ? { proveedor: id, estado: 'ok', ultima_sincronizacion: new Date(salud).toISOString() } : conectados.find((c) => c.proveedor === id));

  return (
    <>
      <Grupo pie="Lo que mida tu reloj entra a Salud y a tus métricas.">
        {PROVEEDORES.map((p) => {
          const c = estaConectado(p.id);
          const [letra, color, fondo] = LETRA[p.id] ?? [];
          const ultima = c?.ultima_sincronizacion ? ` · ${new Date(c.ultima_sincronizacion).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : '';
          return (
            <Fila
              key={p.id}
              izquierda={letra ? <IconoDeFila color={color} fondo={fondo}>{letra}</IconoDeFila> : <IconoDeFila color={KP.ink} fondo="#EBEDF1"><Watch size={18} /></IconoDeFila>}
              texto={p.nombre}
              detalle={c ? (c.estado === 'error' ? 'Con error: vuelve a conectarlo' : `Conectado${ultima}`) : p.detalle}
              derecha={busy === p.id
                ? <Loader2 size={20} className="spin" color={KP.ink2} />
                : (c || p.disponible
                  ? <Interruptor activo={!!c} etiqueta={p.nombre} onCambio={(v) => (v ? conecta(p) : desconecta(p))} />
                  // Un interruptor que se prende y se apaga solo diciendo «pronto» parecía roto (auditoría p112): mientras no exista la conexión, se dice «Pronto» y nada más.
                  : <span style={{ padding: '5px 12px', borderRadius: 99, background: '#EBEDF1', color: KP.ink2, fontSize: 13, fontWeight: 800 }}>Pronto</span>)}
            />
          );
        })}
      </Grupo>
      {salud && saludDisponible() && (
        <Grupo>
          <Fila
            izquierda={<IconoDeFila><RefreshCw size={18} /></IconoDeFila>} texto={busy === 'apple_salud' && aviso ? aviso : 'Sincronizar Apple Salud ahora'}
            detalle="Trae lo último de tu reloj" onClick={busy === 'apple_salud' ? undefined : () => sincronizaSalud(false)}
          />
        </Grupo>
      )}
      {onIrAMetricas && (
        <Grupo titulo="Mientras tanto">
          <Fila izquierda={<IconoDeFila><Upload size={18} /></IconoDeFila>} texto="Importar un archivo de entreno" detalle="El que te baja tu reloj o tu app" onClick={onIrAMetricas} />
        </Grupo>
      )}
    </>
  );
}
