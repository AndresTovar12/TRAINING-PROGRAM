/* LA COLA DEL TELÉFONO, ARMADA (1 nov 2026, encargo «sin conexión», parte 2.2). La pieza pura es `lib/colaDeSubida.js`; aquí se le ponen el almacén del
   teléfono (`lib/almacenDelTelefono.js`), la sesión de Supabase y los momentos en que se vacía:
     · al abrir la app (al entrar la cuenta: `usaCuenta`),
     · al volver a la app (la pantalla vuelve a verse, o el «resume» de iOS),
     · en cuanto regresa la señal (`alVolverLaSenal`) o Supabase renueva la sesión,
     · y si falla por señal, a los 4, 10, 30 y luego cada 60 s.

   UNA SOLA COLA, DOS COMPARTIMENTOS. Lo que pasa por aquí son las cosas sueltas, cada una con su id (un entreno libre con su ruta; en la parte 3, lo que
   llegue del reloj). Los cambios del ESTADO del atleta (sus series, su bienestar, en qué semana va) son el otro compartimento: no van como una fila de
   parches, sino como UN parche que se recalcula siempre contra lo último que se sabe de la base (ver `lib/copiaDelEstado.js` y `AppStateContext`). Así
   un cambio y su corrección viajan juntos y nunca se manda un parche viejo encima de uno nuevo. Los dos compartimentos se guardan en el teléfono, se
   suben con las mismas esperas y se cuentan juntos en «N cosas por subir» (Mi perfil).

   PARA LA PARTE 3 (el Apple Watch):
     · Una cosa suelta que va al servidor: `registraTipoDeCola('mi-tipo', { sube })` en `lib/tiposDeLaCola.js` y `agregaALaCola({ id, tipo, usuario, datos })`.
       `sube(cosa)` usa `cosa.id` como id en la base (upsert por id) y lanza el error tal cual: la cola decide si es señal (reintenta) o rechazo (avisa).
     · Algo que cambia el estado del atleta (marcar las series de una sesión del plan): `aplicaAlEstado(usuario, (store) => storeNuevo)` dentro del
       `sube` de su tipo. Devuelve `true` cuando el cambio YA quedó en la copia del teléfono (y se sube con el resto del estado); `false` si la app del
       atleta no está abierta: lanza `new TodaviaNo()` (de `lib/senal.js`) y la cola lo reintenta después, sin perderlo.

   SOLO EN LA APP: en la web `agregaALaCola` devuelve `false` y quien llama sube directo, como antes (ver `lib/almacenDelTelefono.js`). */
import { useSyncExternalStore } from 'react';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/lib/supabase';
import { creaCola } from '@/lib/colaDeSubida';
import {
  abreCuenta, borraDelTelefono, cierraCuenta, clavesDelTelefono, conCopiaEnElTelefono, guardaEnElTelefono, leeDelTelefono,
} from '@/lib/almacenDelTelefono';
import { claveDelEstado, soloLoPendiente } from '@/lib/copiaDelEstado';
import { alVolverLaSenal, marcaConSenal, marcaSinSenal, sinRedEnElTelefono } from '@/lib/senal';

/** La sesión que sirve para subir: la de ahora, sin vencer. `null` si no hay o si no se pudo renovar (sin señal). */
async function sesionValida() {
  if (sinRedEnElTelefono()) return null; // sin red ni se pregunta (ver `sinRedEnElTelefono`): se espera al `online`
  const { data, error } = await supabase.auth.getSession();
  const s = data?.session;
  if (error || !s?.user?.id) return null;
  if (s.expires_at && s.expires_at * 1000 < Date.now()) return null;
  return { usuario: s.user.id };
}

const escuchas = new Set();
let foto = Object.freeze({ usuario: null, cosas: Object.freeze([]), enVuelo: null, delEstado: 0, porSubir: 0, rechazadas: Object.freeze([]) });
let fotoDeLaCola = { usuario: null, cosas: [], enVuelo: null };
let delEstado = { usuario: null, cosas: 0 };

function rehaceFoto() {
  const deEsta = delEstado.usuario && delEstado.usuario === fotoDeLaCola.usuario ? delEstado.cosas : 0;
  foto = Object.freeze({
    usuario: fotoDeLaCola.usuario,
    cosas: fotoDeLaCola.cosas,
    enVuelo: fotoDeLaCola.enVuelo,
    delEstado: deEsta,
    porSubir: fotoDeLaCola.cosas.length + deEsta,
    rechazadas: Object.freeze(fotoDeLaCola.cosas.filter((c) => c.rechazo)),
  });
  for (const f of [...escuchas]) { try { f(); } catch { /* una pantalla que falla no apaga a las demás */ } }
}

// Quienes quieren saber cuándo subió una cosa (parte 3: el reloj dice «{quien} ya lo ve» solo cuando de verdad subió).
const alSubir = new Set();

const cola = creaCola({
  almacen: { lee: leeDelTelefono, guarda: (clave, valor) => guardaEnElTelefono(clave, valor) },
  sesion: sesionValida,
  alCambiar: (f) => { fotoDeLaCola = f; rehaceFoto(); },
  alLlegar: marcaConSenal,
  alFaltaDeSenal: (e) => { if (e) marcaSinSenal(); },
  alSubir: (cosa) => { for (const f of [...alSubir]) { try { f(cosa); } catch { /* un aviso que falla no detiene la cola */ } } },
});

/** `fn(cosa)` corre cada vez que una cosa de la cola ya subió al servidor. Devuelve cómo quitarla. */
export function alSubirDeLaCola(fn) {
  alSubir.add(fn);
  return () => alSubir.delete(fn);
}

const activa = () => conCopiaEnElTelefono();

/** La cuenta que entró (o `null` al salir): su cola se lee del teléfono y se empieza a subir. Lo llama `AuthContext`. */
export function usaCuenta(usuario) {
  if (!activa()) return;
  if (usuario) abreCuenta(usuario);
  cola.usa(usuario ?? null);
}

/** Registra cómo se sube un tipo de cosa (ver arriba y `lib/tiposDeLaCola.js`). */
export function registraTipoDeCola(tipo, { sube }) {
  const quita = cola.registraTipo(tipo, { sube });
  // Lo que ya esperaba en la cola de ese tipo puede subir desde ya.
  if (activa()) cola.vacia();
  return quita;
}

/** Agrega una cosa a la cola de su cuenta. `true` cuando ya quedó guardada en el teléfono; `false` en la web o si no se pudo guardar (súbela directo). */
export function agregaALaCola(cosa) {
  if (!activa()) return Promise.resolve(false);
  return cola.agrega(cosa);
}

/** De quién es la cola que está activa (la cuenta que entró en este teléfono), o `null` (en la web, o sin cuenta). */
export const cuentaDeLaCola = () => (activa() ? cola.usuario() : null);

/** Cómo le fue a una cosa en su siguiente intento (`{ estado: 'subida' | 'sin-senal' | 'rechazada' | 'en-cola', resultado?, error? }`). */
export const resultadoDe = (id, ms) => cola.resultadoDe(id, ms);
/** Sube lo pendiente ya (sin esperar el siguiente reintento). */
export const vaciaLaCola = () => (activa() ? cola.vacia() : Promise.resolve());
/** «Reintentar»: todo, también lo rechazado. */
export const reintentaLaCola = () => (activa() ? cola.reintenta() : Promise.resolve());
/** Quita una cosa que aún no subía (`false` si ya subió: hazlo en el servidor). */
export const quitaDeLaCola = (id) => (activa() ? cola.quita(id) : Promise.resolve(false));
/** Cambia los datos de una cosa que aún no subía (`false` si ya subió: hazlo en el servidor). */
export const cambiaEnLaCola = (id, cambio) => (activa() ? cola.cambia(id, cambio) : Promise.resolve(false));

/** Cuántas cosas del ESTADO faltan por subir (lo pone `AppStateContext` cada vez que guarda su copia). */
export function ponCosasDelEstado(usuario, n) {
  if (delEstado.usuario === usuario && delEstado.cosas === n) return;
  delEstado = { usuario, cosas: n };
  rehaceFoto();
}

const suscribe = (f) => { escuchas.add(f); return () => escuchas.delete(f); };
const laFoto = () => foto;

/**
 * Lo pendiente de la cuenta que entró: `{ cosas, rechazadas, porSubir, delEstado, enVuelo }`. `porSubir` = cosas sueltas + cambios del estado (el
 * «N cosas por subir» de Mi perfil). En la web siempre vacío.
 */
export function useCola() {
  return useSyncExternalStore(suscribe, laFoto, laFoto);
}

/** Lo mismo, fuera de React (para preguntar antes de cerrar sesión). */
export const pendientesAhora = () => foto;

/* LA PUERTA DEL ESTADO (para la parte 3). `AppStateContext` la abre mientras está dibujando la app de la persona que entró. */
const puertas = new Map();

/**
 * La abre `AppStateContext`: `aplica(cambio)` pone el cambio en el estado y resuelve `true` cuando ya quedó guardado en el teléfono; `persiste()` deja la
 * copia al día (se usa antes de salir de la cuenta).
 */
export function registraPuertaDelEstado(usuario, puerta) {
  puertas.set(usuario, puerta);
  return () => { if (puertas.get(usuario) === puerta) puertas.delete(usuario); };
}

/** Pone un cambio en el estado de `usuario` (`cambio(store) → store`). `true` cuando ya quedó en la copia del teléfono; `false` si su app no está abierta. */
export async function aplicaAlEstado(usuario, cambio) {
  const puerta = puertas.get(usuario);
  if (!puerta) return false;
  return puerta.aplica(cambio);
}

/** Antes de salir de la cuenta: lo último que se anotó (hace menos de lo que tarda la copia en escribirse) queda en el teléfono. */
export async function guardaLoUltimoDe(usuario) {
  if (!activa() || !usuario) return;
  try { await puertas.get(usuario)?.persiste?.(); } catch { /* lo que ya estaba guardado se queda */ }
}

/**
 * AL SALIR DE LA CUENTA (en el mismo teléfono puede entrar otra persona). Se borran sus copias (perfil, plan, la base de su estado) y se deja SOLO lo que
 * falta subir: el parche pendiente del estado y su cola. Eso nunca se le enseña ni se sube a otra cuenta (cada llave es de una cuenta, y se sube solo
 * con su sesión): espera a que esa persona vuelva a entrar.
 */
export async function cierraCuentaEnElTelefono(usuario) {
  if (!activa() || !usuario) return;
  cierraCuenta(usuario);
  const clave = claveDelEstado(usuario);
  const resto = soloLoPendiente(await leeDelTelefono(clave));
  if (resto) await guardaEnElTelefono(clave, resto, { aunqueEsteCerrada: true });
  else await borraDelTelefono(clave);
  const suyas = (await clavesDelTelefono()).filter((k) => k === `tl:perfil:${usuario}` || k === `tl:entrenos:${usuario}` || k.startsWith(`tl:plan:${usuario}:`));
  for (const k of suyas) await borraDelTelefono(k);
}

/** Al BORRAR la cuenta: ya no hay a dónde subir nada. Se va todo lo suyo del teléfono, también la cola. */
export async function olvidaTodoDe(usuario) {
  if (!activa() || !usuario) return;
  cierraCuenta(usuario);
  if (cola.usuario() === usuario) await cola.usa(null);
  const suyas = (await clavesDelTelefono()).filter((k) => k.includes(`:${usuario}`));
  for (const k of suyas) await borraDelTelefono(k);
}

/* Los momentos de vaciar. */
if (typeof window !== 'undefined') {
  alVolverLaSenal(() => { if (activa()) cola.vacia(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && activa()) cola.vacia(); });
  // Supabase renovó la sesión (eso solo pasa si llegó al servidor: hay señal) o entró alguien. Se vacía fuera del aviso (dentro de él no conviene volver a
  // pedir la sesión). `SIGNED_IN` no prueba que haya señal: también sale al volver a la app con una sesión que aún no vence.
  supabase.auth.onAuthStateChange((evento) => {
    if (!activa()) return;
    if (evento === 'TOKEN_REFRESHED') setTimeout(() => { marcaConSenal(); cola.vacia(); }, 0);
    else if (evento === 'SIGNED_IN') setTimeout(() => cola.vacia(), 0);
  });
  try {
    if (Capacitor.isNativePlatform()) {
      import('@capacitor/app').then(({ App }) => App.addListener('resume', () => cola.vacia())).catch(() => {});
    }
  } catch { /* sin el plugin: basta con `visibilitychange` */ }
}
