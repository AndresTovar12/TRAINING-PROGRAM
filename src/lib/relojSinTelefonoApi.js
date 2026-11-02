/* EL APPLE WATCH SIN EL IPHONE, contra el teléfono y la base (1 nov 2026, encargo «inicio, sin conexión y reloj», parte 3). Lo puro está en
   `lib/relojSinTelefono.js`; el puente nativo, en `lib/relojApple.js` (`EntrenoWatchPlugin.swift`).

   EL CAMINO DE UN ENTRENO HECHO EN EL RELOJ:
     1. El reloj lo manda con `transferUserInfo`. El plugin del iPhone lo guarda en disco AL RECIBIRLO, aunque la app web no esté corriendo.
     2. Al abrir la app (o en cuanto llega, si ya está abierta), `recibeLoDelReloj` lo pasa a la cola del teléfono (`agregaALaCola`, con su id) y solo
        entonces le dice al plugin que ya lo puede borrar (`confirmaDelReloj`). Si algo falla en medio, se queda en el plugin y se intenta la próxima vez.
     3. La cola lo sube cuando hay señal (las mismas esperas de la parte 2), con upsert por su id: repetirlo no lo duplica.
     4. Al subir, se le avisa al reloj (si está cerca) para que diga «{quien} ya lo ve».
   Lo que llegó del reloj queda anotado (`tl:reloj:llegados`): al traer de Salud se salta (parte 3.5, ver `saltaLosDelReloj`). */
import { supabase } from '@/lib/supabase';
import { preparaEntreno } from '@/lib/metricas/construye';
import { guardaImportacion } from '@/lib/metricasApi';
import { agregaALaCola, aplicaAlEstado, cuentaDeLaCola } from '@/lib/colaDelTelefono';
import { guardaEnElTelefono, leeDelTelefono } from '@/lib/almacenDelTelefono';
import { TodaviaNo, marcaConSenal } from '@/lib/senal';
import { AVISO_RELOJ_TRAJO, confirmaDelReloj, pendientesDelReloj } from '@/lib/relojApple';
import {
  aplicaSesionDelReloj, conLlegado, cosaDelReloj, crudoDelReloj, leeResultado, traeMedidas,
} from '@/lib/relojSinTelefono';
import { TIPO_ENTRENO_LIBRE } from '@/lib/entrenoLibreApi';

/** Donde se anotan los UUID de lo que ya llegó del reloj (de todo el teléfono, como Salud). */
const LLAVE_LLEGADOS = 'tl:reloj:llegados';

let llegados = null; // la lista en memoria (se lee una vez)
let cadena = Promise.resolve();

/** Los UUID de los entrenos que ya llegaron del reloj (para saltarlos al traer de Salud). */
export async function llegadosDelReloj() {
  if (!llegados) {
    const guardado = await leeDelTelefono(LLAVE_LLEGADOS);
    llegados = Array.isArray(guardado) ? guardado.filter((x) => typeof x === 'string') : [];
  }
  return new Set(llegados);
}

/** Anota un UUID que llegó del reloj, antes de subir nada: si Salud lo trae mientras tanto, ya se sabe que no es nuevo. */
async function anotaLlegado(uuid) {
  await llegadosDelReloj();
  llegados = conLlegado(llegados, uuid);
  await guardaEnElTelefono(LLAVE_LLEGADOS, llegados);
}

// Un error de Supabase con su código HTTP pegado: la cola lo necesita para saber si fue falta de señal o un rechazo (igual que en `entrenoLibreApi`).
const conStatus = (error) => Object.assign(error instanceof Error ? error : new Error(String(error?.message ?? error)), {
  code: error?.code, details: error?.details, status: error?.status,
});

/** Lo de una cuenta solo se sube con SU sesión: si en este teléfono entró otra persona, espera a que vuelva. */
async function esLaMismaCuenta(usuario) {
  const { data: s } = await supabase.auth.getSession();
  const quien = s?.session?.user?.id;
  if (quien && quien !== usuario) throw new TodaviaNo('La sesión es de otra cuenta');
}

/**
 * EL PULSO Y LA RUTA DEL RELOJ, como el entreno que Salud habría traído (`crudoDelReloj` → `guardaImportacion`): una fila de `actividades` con el id del reloj
 * y `origen = 'healthkit'`. Si el iPhone ya tenía ese entreno (lo guió con el reloj puesto), `guardaImportacion` no hace otro: le pone el pulso. Repetirlo no
 * hace nada (ya está: «repetido»). Al terminar avisa como `SincronizaReloj` (la página del entreno vuelve a leer y enseña el pulso).
 */
export async function subePulsoDelReloj(cosa, { deporte = null } = {}) {
  const r = cosa.datos;
  await esLaMismaCuenta(cosa.usuario);
  const prep = preparaEntreno(crudoDelReloj(r, { deporte, llego: r.modo === 'sesion' }));
  let res;
  try {
    res = await guardaImportacion({ atletaId: cosa.usuario, subidoPor: cosa.usuario, resultado: { entrenos: [prep], recuperacion: [], perfil: null }, desfaseMin: prep.desfase_min });
  } catch (e) {
    throw conStatus(e);
  }
  marcaConSenal();
  window.dispatchEvent(new CustomEvent(AVISO_RELOJ_TRAJO, { detail: res }));
  return res;
}

/**
 * UNA SESIÓN DEL PLAN HECHA EN EL RELOJ (lo llama la cola). Primero sus series: entran al estado del atleta como si las hubiera marcado en el iPhone
 * (`aplicaAlEstado` → `aplicaSesionDelReloj`; se suben con el resto del estado, con todas las reglas de la parte 2). Si la app del atleta aún no está abierta,
 * `TodaviaNo`: la cola lo reintenta después sin avisar. Luego su pulso y su ruta (`subePulsoDelReloj`). Las dos partes se pueden repetir sin duplicar nada.
 */
export async function subeSesionDelReloj(cosa) {
  const r = cosa.datos;
  const puesto = await aplicaAlEstado(cosa.usuario, (store) => aplicaSesionDelReloj(store, r));
  if (!puesto) throw new TodaviaNo('La app de esta cuenta todavía no está abierta');
  if (traeMedidas(r)) await subePulsoDelReloj(cosa, { deporte: r.deporte });
  return true;
}

/**
 * LO QUE LLEGÓ DEL RELOJ, A LA COLA. Le pide al plugin lo que tiene guardado y, uno por uno: lo revisa, lo anota como llegado, lo mete a la cola de su
 * cuenta y le dice al plugin que ya lo puede borrar. Nada se borra del plugin antes de quedar guardado en la cola. Lo que no se entiende, o lo de nadie
 * (no ha entrado ninguna cuenta), se queda en el plugin. Una vuelta a la vez.
 */
export function recibeLoDelReloj() {
  cadena = cadena.then(async () => {
    const pendientes = await pendientesDelReloj();
    for (const { id, resultado } of pendientes) {
      const r = leeResultado(resultado);
      if (!r) { console.error('reloj: no se entiende lo que llegó', id); continue; }
      const cosa = cosaDelReloj(r, cuentaDeLaCola(), { tipoLibre: TIPO_ENTRENO_LIBRE });
      if (!cosa) continue; // nadie ha entrado en este iPhone: espera en el plugin
      if (cosa.descarta) { await confirmaDelReloj(id); continue; }
      if (r.hk) await anotaLlegado(r.hk);
      await anotaLlegado(r.id);
      if (await agregaALaCola(cosa)) await confirmaDelReloj(id);
    }
  }).catch((e) => { console.error('reloj: no se pudo recibir', e?.message ?? e); });
  return cadena;
}
