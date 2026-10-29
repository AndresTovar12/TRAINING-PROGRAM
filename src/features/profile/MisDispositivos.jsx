import { useCallback, useEffect, useState } from 'react';
import { Loader2, Upload, Watch } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { saludDisponible } from '@/lib/saludDelTelefono';
import { PROVEEDORES, conectaDispositivo, desconectaDispositivo, garminDisponible, leeMisDispositivos } from '@/lib/dispositivos';
import { useConfirmacion } from '@/components/Confirmacion';
import { useAviso } from '@/components/AvisoPasajero';
import { Fila, Grupo, IconoDeFila, Interruptor } from '@/components/ui';
import { KP } from '@/lib/theme';
import { useStorageOpcional } from '@/contexts/AppStateContext';
import { LLAVE_PAUSA_AUTOMATICA } from '@/features/libre/useEntrenoLibre';
import { abreConectaReloj } from '@/lib/abreConectaReloj';
import { cuandoDicho, cuentaDelReloj, diaDicho, useReloj } from '@/lib/relojConectado';
import { ponPruebaDelReloj, pruebaDelReloj } from '@/lib/relojApple';
import PaginaDelReloj, { pastillaAzul, pastillaGris } from '@/features/reloj/PaginaDelReloj';
import { HojaDeAyuda } from '@/features/reloj/piezas';

/* «DISPOSITIVOS» en Mi perfil (15 oct 2026). Andrés: «dónde administra los dispositivos que tiene conectados: Apple Watch, Garmin, Whoop…». La pantalla ya existe; cada conexión se enciende
   cuando esté hecha (`lib/dispositivos.js`). Desconectar funciona hoy: borra la conexión. Mientras tanto se puede importar un archivo de entreno en «Mis métricas».
   Reestructura visual (15 oct 2026), como «Dispositivos» de las capturas: un renglón por servicio con su interruptor. Prenderlo empieza a conectar; apagarlo pregunta y desconecta.
   APPLE (fase 5, 29 oct 2026, del prototipo): el interruptor pasa a un botón «Conectar» que abre «Conecta tu Apple Watch»; ya conectado, el renglón dice desde
   cuándo, cuántos entrenos y el último, y abre la página del reloj. Con la conexión en la cuenta pero sin el permiso de este iPhone: «Conectar aquí». En la
   web: «En la app del iPhone» (el navegador no puede leer Salud). Solo administradores: «Probar como si tuviera Apple Watch». */

const LETRA = { apple_salud: null, garmin: ['G', '#1E40E0', '#E8EEFF'], whoop: ['W', '#C5305C', '#FDE8EE'], strava: ['S', '#C2620A', '#FFF0E1'] };

export default function MisDispositivos({ onIrAMetricas }) {
  // «Pausa automática» de la carrera libre (27 oct 2026). Se guarda con lo de la persona; en una cuenta de coach no hay dónde, y no sale.
  const [pausaAutomatica, setPausaAutomatica, conAjustes] = useStorageOpcional(LLAVE_PAUSA_AUTOMATICA, true);
  const pregunta = useConfirmacion();
  const { avisa } = useAviso();
  const { user, profile } = useAuth();
  const [conectados, setConectados] = useState(undefined);
  const [busy, setBusy] = useState('');
  const apple = useReloj();
  const [verReloj, setVerReloj] = useState(false);
  const [hojaWeb, setHojaWeb] = useState(false);
  const [cuenta, setCuenta] = useState({ n: 0, ultimo: null });
  const [prueba, setPrueba] = useState(() => pruebaDelReloj());
  const enLaApp = saludDisponible();
  const desdeApple = apple.conexion?.conectado_en ?? null;
  const syncApple = apple.conexion?.ultima_sincronizacion ?? null;
  useEffect(() => {
    let vivo = true;
    cuentaDelReloj(user?.id, desdeApple).then((c) => { if (vivo) setCuenta(c); });
    return () => { vivo = false; };
  }, [user?.id, desdeApple, syncApple]);

  // Garmin se prende cuando el servidor ya tiene sus llaves (fase 4); mientras, «Pronto».
  const [conGarmin, setConGarmin] = useState(false);
  const lee = useCallback(async () => {
    garminDisponible().then(setConGarmin);
    try { setConectados(await leeMisDispositivos()); } catch { setConectados([]); }
  }, []);
  useEffect(() => { lee(); }, [lee]);
  // Recién regresó de Garmin: cómo salió (lo deja el menú de la cuenta al leer `?garmin=` de la dirección).
  useEffect(() => {
    let g = null;
    try { g = sessionStorage.getItem('tl:garmin'); sessionStorage.removeItem('tl:garmin'); } catch { /* sin almacenamiento */ }
    if (g) avisa(g === 'conectado' ? 'Garmin conectado: tus entrenos nuevos llegan solos' : 'No se pudo conectar Garmin. Inténtalo otra vez.');
  }, [avisa]);

  async function conecta(p) {
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
    const va = await pregunta({ titulo: `¿Desconectar ${p.nombre}?`, detalle: 'Deja de traer tus datos. Lo que ya guardamos se queda; puedes volver a conectarlo cuando quieras.', confirmar: 'Sí, desconectar', peligro: true });
    if (!va) return;
    setBusy(p.id);
    try { await desconectaDispositivo(p.id); await lee(); avisa(`${p.nombre} desconectado`); } catch (e) { avisa(e.message); } finally { setBusy(''); }
  }

  // El renglón de Apple (fase 5): sus cuatro casos, con los textos del prototipo.
  function filaApple(p) {
    const izq = <IconoDeFila color={KP.ink} fondo="#EBEDF1"><Watch size={18} /></IconoDeFila>;
    const c = apple.conexion;
    if (!enLaApp) {
      return <Fila key={p.id} izquierda={izq} texto={p.nombre} detalle={c ? `Conectado desde ${diaDicho(c.conectado_en)} en tu iPhone` : p.detalle} derecha={<button type="button" onClick={() => setHojaWeb(true)} className="kp-press" style={pastillaGris}>En la app del iPhone</button>} />;
    }
    if (!apple.listo) return <Fila key={p.id} izquierda={izq} texto={p.nombre} detalle={p.detalle} derecha={<Loader2 size={20} className="spin" color={KP.ink2} />} />;
    if (c && !apple.aqui) {
      return <Fila key={p.id} izquierda={izq} texto={p.nombre} detalle="Conectado en tu otro iPhone" derecha={<button type="button" onClick={() => abreConectaReloj('dispositivos', { reconectar: true })} className="kp-press" style={pastillaAzul}>Conectar aquí</button>} />;
    }
    if (c) {
      const detalle = (
        <>
          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: KP.mint, marginRight: 6, verticalAlign: 1 }} />
          {`Conectado desde ${diaDicho(c.conectado_en)} · ${cuenta.n > 0 ? `${cuenta.n} entreno${cuenta.n === 1 ? '' : 's'} · último ${cuandoDicho(cuenta.ultimo)}` : 'esperando tu primer entreno'}`}
        </>
      );
      return <Fila key={p.id} izquierda={izq} texto={p.nombre} detalle={detalle} onClick={() => setVerReloj(true)} />;
    }
    return <Fila key={p.id} izquierda={izq} texto={p.nombre} detalle={p.detalle} derecha={<button type="button" onClick={() => abreConectaReloj('dispositivos')} className="kp-press" style={pastillaAzul}>Conectar</button>} />;
  }

  const verPrueba = enLaApp && (!!profile?.is_owner || apple.soyDePrueba);
  if (conectados === undefined) return <div style={{ display: 'grid', placeItems: 'center', padding: 30 }}><Loader2 size={22} className="spin" color={KP.ink2} /></div>;
  const estaConectado = (id) => conectados.find((c) => c.proveedor === id);

  return (
    <>
      {conAjustes && (
        <Grupo titulo="Al entrenar" pie="Correr, caminar o andar en bici con GPS: el cronómetro se pausa solo cuando te detienes y sigue solo al volver a moverte.">
          <Fila texto="Pausa automática" derecha={<Interruptor activo={pausaAutomatica !== false} etiqueta="Pausa automática" onCambio={(v) => setPausaAutomatica(v)} />} />
        </Grupo>
      )}
      <Grupo pie="Lo que mida tu reloj entra a Salud y a tus métricas.">
        {PROVEEDORES.map((x) => {
          if (x.id === 'apple_salud') return filaApple(x);
          const p = x.id === 'garmin' ? { ...x, disponible: conGarmin } : x;
          const c = estaConectado(p.id);
          const [letra, color, fondo] = LETRA[p.id] ?? [];
          const ultima = c?.ultima_sincronizacion ? ` · ${new Date(c.ultima_sincronizacion).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : '';
          return (
            <Fila
              key={p.id}
              izquierda={<IconoDeFila color={color} fondo={fondo}>{letra}</IconoDeFila>}
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
      {verPrueba && (
        <Grupo titulo="Solo para ti" pie="Lo ves porque eres administrador. Nadie más.">
          <Fila
            texto="Probar como si tuviera Apple Watch" detalle="Ves todas las invitaciones y pantallas del reloj, aunque no tengas uno."
            derecha={<Interruptor activo={prueba} etiqueta="Probar como si tuviera Apple Watch" onCambio={(v) => { ponPruebaDelReloj(v); setPrueba(v); avisa(v ? 'Modo de prueba: la app hace como si tuvieras Apple Watch.' : 'Modo de prueba apagado.'); }} />}
          />
        </Grupo>
      )}
      {onIrAMetricas && (
        <Grupo titulo="Mientras tanto">
          <Fila izquierda={<IconoDeFila><Upload size={18} /></IconoDeFila>} texto="Importar un archivo de entreno" detalle="El que te baja tu reloj o tu app" onClick={onIrAMetricas} />
        </Grupo>
      )}
      {verReloj && <PaginaDelReloj alCerrar={() => setVerReloj(false)} />}
      {hojaWeb && (
        <HojaDeAyuda
          titulo="Se conecta en la app del iPhone" onCerrar={() => setHojaWeb(false)}
          texto="El navegador no puede leer Apple Salud. Abre Training Lab en tu iPhone y conéctalo en Mi perfil, Dispositivos. Lo que llegue también lo ves aquí."
        />
      )}
    </>
  );
}
