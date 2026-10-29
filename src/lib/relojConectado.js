import { useEffect, useState, useSyncExternalStore } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { AVISO_RELOJ_CAMBIO, estadoDelReloj, fijaUsuarioDelReloj } from '@/lib/relojApple';
import { saludDisponible } from '@/lib/saludDelTelefono';

/* EL APPLE WATCH DE ESTA PERSONA, para toda la app (fase 5, 29 oct 2026). Una sola fuente para Home, Dispositivos, la página del reloj, la página del entreno,
   Mis métricas y el inicio de cuenta, para que todas digan lo mismo.

   · LA CONEXIÓN VIVE EN LA CUENTA (`conexion`): la fila de `dispositivos_conectados` con `proveedor = 'apple_salud'`. `conectado_en` la pone el servidor al
     conectar y no cambia al volver a conectar (otro iPhone, reinstalar). Todo cuenta desde esa hora.
   · EL PERMISO ES DEL TELÉFONO (`aqui`): una marca local «permiso dado en este iPhone». Con la fila y sin la marca: «Vuelve a conectar tu Apple Watch».
   · EL RELOJ (`reloj`): `{ emparejado, instalada }` de `estadoDelReloj` (con el modo de prueba de los administradores). Solo a quien tiene uno emparejado se le
     ofrece conectar.
   · `trayendo`: se está trayendo lo último del reloj (al terminar un entreno con él, o con «Traer lo último ahora»).

   Nunca pide el permiso de Salud: eso solo pasa al tocar «Conectar» (`features/reloj/ConectaReloj.jsx`). */

const LLAVE_AQUI = 'salud:permiso-aqui';
const LLAVE_SIN_RELOJ = 'reloj:sin-antes'; // esta app ya se abrió alguna vez sin reloj emparejado
const LLAVE_ESTRENO = 'reloj:estreno-visto'; // ya se dijo «Vemos que ya tienes Apple Watch»

const lee = (k) => { try { return window.localStorage.getItem(k); } catch { return null; } };
const pon = (k, v) => { try { if (v === null) window.localStorage.removeItem(k); else window.localStorage.setItem(k, v); } catch { /* sin memoria */ } };

const VACIO = { de: null, listo: false, conexion: null, reloj: { emparejado: false, instalada: false }, aqui: false, estreno: false, cerrada: false, trayendo: false, soyDePrueba: false };
let estado = VACIO;
const oyentes = new Set();
const cambia = (parche) => { estado = { ...estado, ...parche }; oyentes.forEach((f) => f()); };
const suscribe = (f) => { oyentes.add(f); return () => oyentes.delete(f); };
const foto = () => estado;

let pidiendo = null;
/** Vuelve a leer la conexión de la cuenta, el reloj emparejado y la marca de este iPhone. */
export async function recargaDelReloj(userId = estado.de) {
  if (!userId) { estado = VACIO; oyentes.forEach((f) => f()); return; }
  fijaUsuarioDelReloj(userId);
  if (estado.de !== userId) cambia({ ...VACIO, de: userId });
  const vuelta = (async () => {
    const [fila, reloj, soyDePrueba] = await Promise.all([
      supabase.from('dispositivos_conectados').select('*').eq('user_id', userId).eq('proveedor', 'apple_salud').maybeSingle().then(({ data }) => data ?? null, () => null),
      estadoDelReloj(),
      supabase.rpc('soy_cuenta_de_prueba').then(({ data }) => !!data, () => false),
    ]);
    // «Vemos que ya tienes Apple Watch»: la app ya se había abierto sin reloj, y ahora hay uno (solo con un reloj de verdad, no con el de prueba).
    if (saludDisponible() && !reloj.emparejado) pon(LLAVE_SIN_RELOJ, '1');
    // Se dice UNA vez: se apunta en cuanto se nota y se queda puesto mientras la app siga abierta (hasta que lo cierre o conecte).
    const estrenoNuevo = saludDisponible() && reloj.emparejado && !reloj.prueba && lee(LLAVE_SIN_RELOJ) === '1' && lee(LLAVE_ESTRENO) !== '1';
    if (estrenoNuevo) pon(LLAVE_ESTRENO, '1');
    if (estado.de === userId) cambia({ listo: true, conexion: fila, reloj, aqui: lee(LLAVE_AQUI) === '1', estreno: estado.estreno || estrenoNuevo, cerrada: invitaCerrada(), soyDePrueba });
  })();
  pidiendo = vuelta;
  await vuelta.catch(() => {});
  if (pidiendo === vuelta) pidiendo = null;
}

/** El estado del reloj de quien tiene la sesión; lo lee al entrar, al volver a la app y cuando algo lo cambia. */
export function useReloj() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const s = useSyncExternalStore(suscribe, foto, foto);
  useEffect(() => {
    if (estado.de !== userId || (!estado.listo && !pidiendo)) recargaDelReloj(userId);
  }, [userId]);
  return s.de === userId ? s : { ...VACIO, de: userId };
}

/** Lo monta la app una vez (`SincronizaReloj`): vuelve a leer cuando algo avisa un cambio (el modo de prueba). Al volver a la app lee `SincronizaReloj`. */
export function useVigilaElReloj(userId) {
  useEffect(() => {
    if (!userId) return undefined;
    const otraVez = () => recargaDelReloj(userId);
    window.addEventListener(AVISO_RELOJ_CAMBIO, otraVez);
    return () => window.removeEventListener(AVISO_RELOJ_CAMBIO, otraVez);
  }, [userId]);
}

/** Lo dio en este iPhone: se guarda la conexión en la cuenta (sin cambiar su fecha si ya estaba) y la marca local. Devuelve la fila. */
export async function conectaEnLaCuenta() {
  const { data, error } = await supabase.rpc('conecta_apple_salud');
  if (error) throw error;
  pon(LLAVE_AQUI, '1');
  cambia({ conexion: data, aqui: true, estreno: false });
  return data;
}

/** Desconectar: se borra la fila de la cuenta y la marca de este iPhone. El permiso de Salud se queda (eso se quita en la app Salud). */
export async function desconectaDelReloj() {
  const { error } = await supabase.from('dispositivos_conectados').delete().eq('proveedor', 'apple_salud');
  if (error) throw error;
  pon(LLAVE_AQUI, null);
  cambia({ conexion: null, aqui: false });
}

/* La tarjeta de Home: su ✕ la cierra para siempre en este teléfono (también la de «Vemos que ya tienes Apple Watch»). El modo de prueba la vuelve a enseñar. */
const LLAVE_INVITA_CERRADA = 'reloj:invita-cerrada';
export const invitaCerrada = () => lee(LLAVE_INVITA_CERRADA) === '1';
export function cierraInvitacion() {
  pon(LLAVE_INVITA_CERRADA, '1');
  cambia({ estreno: false, cerrada: true });
}


export const ponTrayendo = (trayendo) => { if (estado.trayendo !== trayendo) cambia({ trayendo }); };
export const ponConexion = (conexion) => cambia({ conexion });
/** Para quien no es un componente (la sincronización): lo de ahora. */
export const relojAhora = () => estado;

/**
 * Cuántos entrenos llegaron del reloj desde que conectó y cuándo fue el último: los que entraron de Salud (`origen = 'healthkit'`) y los de la app a los que
 * el reloj les puso el pulso (`metricas.pulso_de`). `{ n, ultimo }` (`ultimo`: ISO o `null`). Sirve para el atleta y para su coach.
 */
export async function cuentaDelReloj(atletaId, desdeIso) {
  if (!atletaId || !desdeIso) return { n: 0, ultimo: null };
  const { data, count, error } = await supabase.from('actividades').select('inicio', { count: 'exact' })
    .eq('atleta_id', atletaId).gte('inicio', desdeIso).or('origen.eq.healthkit,metricas->>pulso_de.eq.apple_watch')
    .order('inicio', { ascending: false }).limit(1);
  if (error) return { n: 0, ultimo: null };
  return { n: count ?? 0, ultimo: data?.[0]?.inicio ?? null };
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const diaDe = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
/** «hoy», «ayer» o «el 26 de oct», en la hora de quien mira. */
export function diaDicho(iso, ahora = new Date()) {
  const d = new Date(iso);
  if (diaDe(d) === diaDe(ahora)) return 'hoy';
  const ayer = new Date(ahora); ayer.setDate(ayer.getDate() - 1);
  if (diaDe(d) === diaDe(ayer)) return 'ayer';
  return `el ${d.getDate()} de ${MESES[d.getMonth()]}`;
}
/** «hoy, 9:41 a. m.», «ayer, 7:40 a. m.» o «26 oct, 7:40 a. m.». */
export function cuandoDicho(iso, ahora = new Date()) {
  const d = new Date(iso);
  const hora = d.toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' });
  const dia = diaDicho(iso, ahora);
  return `${dia.startsWith('el ') ? `${d.getDate()} ${MESES[d.getMonth()]}` : dia}, ${hora}`;
}

/**
 * EL RELOJ DE UN ATLETA, VISTO POR SU COACH (fase 5): si conectó su Apple Watch y desde cuándo, cuántos entrenos llegaron y el último, y si hoy ya se le pidió
 * que lo conectara. `{ listo, conexion, n, ultimo, pidioHoy, recarga }`. El coach ve los datos del reloj desde que el atleta conecta; no hay interruptor.
 */
export function useRelojDelAtleta(atletaId, profesionalId) {
  const [s, setS] = useState({ de: null, conexion: null, n: 0, ultimo: null, pidioHoy: false });
  const [vez, setVez] = useState(0);
  useEffect(() => {
    if (!atletaId) return undefined;
    let vivo = true;
    (async () => {
      const [{ data: conexion }, pidio] = await Promise.all([
        supabase.from('dispositivos_conectados').select('conectado_en,ultima_sincronizacion').eq('user_id', atletaId).eq('proveedor', 'apple_salud').maybeSingle().then((r) => r, () => ({ data: null })),
        profesionalId
          ? supabase.from('mensajes').select('id', { count: 'exact', head: true }).eq('atleta_id', atletaId).eq('profesional_id', profesionalId).eq('tipo', 'reloj')
            .gt('creado_en', new Date(Date.now() - 20 * 3600000).toISOString()).then(({ count }) => (count ?? 0) > 0, () => false)
          : false,
      ]);
      const c = conexion ? await cuentaDelReloj(atletaId, conexion.conectado_en) : { n: 0, ultimo: null };
      if (vivo) setS({ de: atletaId, conexion: conexion ?? null, n: c.n, ultimo: c.ultimo, pidioHoy: pidio });
    })();
    return () => { vivo = false; };
  }, [atletaId, profesionalId, vez]);
  return { ...s, listo: s.de === atletaId, recarga: () => setVez((v) => v + 1) };
}

/** El coach le pide al atleta que conecte su reloj: un mensaje con la tarjeta «Conecta tu Apple Watch». Una vez al día (la base lo cuida: `YA_HOY`). */
export async function pideConectarReloj(atletaId) {
  const { error } = await supabase.rpc('pide_conectar_reloj', { p_atleta: atletaId });
  if (error) throw Object.assign(new Error(/YA_HOY/.test(error.message) ? 'Ya se lo pediste hoy.' : 'No se pudo mandar. Inténtalo otra vez.'), { codigo: /YA_HOY/.test(error.message) ? 'YA_HOY' : null });
}
