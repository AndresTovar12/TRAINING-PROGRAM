/* LA COLA QUE NO SE PIERDE (1 nov 2026, encargo «sin conexión», parte 2.2).

   QUÉ ES. Lo que la persona hace en el teléfono y tiene que llegar al servidor (un entreno libre con su ruta y, en la parte 3, lo que llegue del Apple Watch)
   se guarda PRIMERO en el teléfono, aquí, y luego se sube. Si no hay señal se queda guardado (sobrevive a cerrar la app) y se sube solo:
   al abrir la app, al volver a ella y en cuanto regresa la señal, con las mismas esperas de siempre (4, 10, 30 y luego cada 60 s).

   LAS REGLAS (cada una tiene su prueba en `scripts/prueba-cola-de-subida.mjs`):
     · EN ORDEN. Se sube de la más vieja a la más nueva. Si una no sube por falta de señal, las de atrás esperan su turno.
     · CADA COSA TRAE SU ID DESDE EL TELÉFONO. Agregar dos veces la misma no la duplica, y subirla dos veces tampoco (quien la sube usa ese id:
       «upsert» por id en la base). Así, si el servidor la guardó pero la respuesta se perdió, reintentarla no hace otra.
     · UN RECHAZO NO TAPA LA FILA. Si el servidor contesta que no (no es falta de señal, ver `esFaltaDeSenal`), esa se marca «rechazada», se avisa y se
       sigue con las demás. No se reintenta sola para siempre: una vez cada vez que se abre la app y cuando la persona toca «Reintentar». Tampoco se
       tira: se queda guardada hasta que suba o la persona la descarte.
     · CADA CUENTA LA SUYA. Lo de una cuenta se guarda en su propia llave (`tl:cola:<id>`) y solo se sube con la sesión de esa misma cuenta. Si en el
       teléfono entra otra persona, lo de la anterior espera a que vuelva; nunca se sube con la sesión de otro ni se le enseña.

   CÓMO SE USA. Esta es la pieza pura (se le pasan el almacén, la sesión y el reloj); la de la app, con Supabase y Capacitor, es `lib/colaDelTelefono.js`.
     const cola = creaCola({ almacen, sesion });
     cola.registraTipo('entreno-libre', { sube: async (cosa) => fila });   // `sube` lanza el error tal cual: la cola decide si es señal o rechazo
     await cola.usa(usuarioId);                                              // la cuenta que entró (null al salir)
     await cola.agrega({ id, tipo: 'entreno-libre', usuario, datos });      // true = ya quedó guardada en el teléfono
     const r = await cola.resultadoDe(id, 6000);                             // { estado: 'subida' | 'sin-senal' | 'rechazada' | 'en-cola', resultado?, error? } */
import { esFaltaDeSenal, textoDelError } from './senal.js';

/** Las esperas antes de reintentar (las mismas que el guardado del estado desde el 25 oct 2026): la última se repite. */
export const ESPERAS_DE_REINTENTO_MS = Object.freeze([4000, 10000, 30000, 60000]);

/** Cuánto esperar después de `fallos` fallos seguidos por falta de señal (1 → 4 s, 2 → 10 s, 3 → 30 s, 4 o más → 60 s). */
export const esperaDeReintento = (fallos) => ESPERAS_DE_REINTENTO_MS[Math.min(Math.max(1, fallos), ESPERAS_DE_REINTENTO_MS.length) - 1];

/** La llave del almacén del teléfono donde vive la cola de una cuenta. */
export const claveDeLaCola = (usuario) => `tl:cola:${usuario}`;

const VERSION = 1;

const esCosa = (c) => !!c && typeof c === 'object' && typeof c.id === 'string' && c.id.length > 0
  && typeof c.tipo === 'string' && c.tipo.length > 0 && typeof c.usuario === 'string' && c.usuario.length > 0;

/**
 * Las cosas guardadas de una cuenta, revisadas. `respaldo` trae lo guardado si NO se entiende (otra versión, algo dañado): quien llama lo guarda aparte
 * antes de escribir encima, para que nada se pierda en silencio.
 */
export function leeCosas(guardado) {
  if (guardado == null) return { cosas: [], respaldo: null };
  if (typeof guardado !== 'object' || guardado.v !== VERSION || !Array.isArray(guardado.cosas)) return { cosas: [], respaldo: guardado };
  const cosas = guardado.cosas.filter(esCosa);
  return { cosas, respaldo: cosas.length === guardado.cosas.length ? null : guardado };
}

/**
 * Arma una cola. `almacen`: `{ lee(clave), guarda(clave, valor) → true|false }` (asíncronos). `sesion()`: la sesión válida de ahora, `{ usuario }` o
 * `null` (sin sesión o sin señal para renovarla). `temporizador`: `{ pon(fn, ms), quita(t) }` (las pruebas ponen uno falso).
 * Avisos: `alCambiar(foto)` cada vez que cambia algo, `alSubir(cosa, resultado)`, `alRechazo(cosa, error)`, `alFaltaDeSenal(error)` y `alLlegar()`
 * (una subida llegó: hay señal).
 */
export function creaCola({
  almacen, sesion, ahora = () => Date.now(), temporizador = { pon: (f, ms) => setTimeout(f, ms), quita: (t) => clearTimeout(t) },
  alCambiar = () => {}, alSubir = () => {}, alRechazo = () => {}, alFaltaDeSenal = () => {}, alLlegar = () => {},
} = {}) {
  const tipos = new Map();
  let usuario = null;        // la cuenta que entró
  let cosas = [];            // las suyas, en orden (siempre se reemplaza la lista entera: cada guardado lleva una foto que ya no cambia)
  let cargando = Promise.resolve();
  let enVuelo = null;        // el id de la que se está subiendo
  let vaciando = null;       // la vuelta que está corriendo
  let otraVez = false;       // alguien pidió vaciar mientras corría una vuelta
  let forzarOtraVez = false;
  let fallos = 0;            // fallos seguidos por falta de señal (para la espera)
  let reintento = null;
  const reintentarAlAbrir = new Set(); // las rechazadas se reintentan UNA vez por cada vez que se abre la cuenta
  const esperando = new Map();         // id → quienes esperan saber cómo le fue (`resultadoDe`)
  const escuchas = new Set();
  let foto = Object.freeze({ usuario: null, cosas: Object.freeze([]), enVuelo: null });
  let cadenaDeOtras = Promise.resolve(); // lo que se escribe en la cola de OTRA cuenta va en fila (leer, cambiar, guardar)

  const notifica = () => {
    foto = Object.freeze({ usuario, cosas: Object.freeze(cosas.slice()), enVuelo });
    for (const f of [...escuchas]) { try { f(foto); } catch { /* una pantalla que falla no apaga a las demás */ } }
    try { alCambiar(foto); } catch { /* igual */ }
  };

  const guarda = async (clave, valor) => {
    try { return (await almacen.guarda(clave, valor)) !== false; } catch { return false; }
  };
  const lee = async (clave) => {
    try { return await almacen.lee(clave); } catch { return null; }
  };
  // Guarda la lista de la cuenta activa. Se le pasa la foto: si mientras tanto la lista cambia, el guardado siguiente lleva la nueva.
  const persiste = (u, lista) => guarda(claveDeLaCola(u), { v: VERSION, cosas: lista });

  const quitaReintento = () => { if (reintento != null) { temporizador.quita(reintento); reintento = null; } };
  function programa(ms) {
    quitaReintento();
    if (!usuario) return;
    reintento = temporizador.pon(() => { reintento = null; return vacia(); }, ms);
  }

  const resuelve = (id, r) => {
    const quienes = esperando.get(id);
    if (!quienes) return;
    esperando.delete(id);
    for (const f of [...quienes]) f(r);
  };

  /** Registra cómo se sube un tipo de cosa. `sube(cosa)` devuelve lo que quiera (la fila guardada) o lanza el error tal cual. */
  function registraTipo(tipo, { sube }) {
    tipos.set(tipo, { sube });
    return () => { if (tipos.get(tipo)?.sube === sube) tipos.delete(tipo); };
  }

  /** La cuenta que entró (`null` al salir). Lee su cola del teléfono y la empieza a subir. */
  async function usa(nuevo) {
    const u = nuevo ?? null;
    if (u === usuario) return cargando;
    quitaReintento();
    fallos = 0;
    usuario = u;
    cosas = [];
    reintentarAlAbrir.clear();
    notifica();
    if (!u) { cargando = Promise.resolve(); return cargando; }
    cargando = (async () => {
      const guardado = await lee(claveDeLaCola(u));
      if (usuario !== u) return;
      const { cosas: leidas, respaldo } = leeCosas(guardado);
      // Algo que no se entiende no se pisa sin más: se guarda aparte con la hora, por si hay que recuperarlo a mano.
      if (respaldo != null) await guarda(`${claveDeLaCola(u)}:respaldo:${ahora()}`, respaldo);
      if (usuario !== u) return;
      cosas = leidas;
      for (const c of cosas) if (c.rechazo) reintentarAlAbrir.add(c.id);
      notifica();
    })();
    await cargando;
    if (usuario === u) vacia();
    return undefined;
  }

  async function agregaAOtraCuenta(nueva) {
    const hecho = cadenaDeOtras.then(async () => {
      const clave = claveDeLaCola(nueva.usuario);
      const { cosas: suyas, respaldo } = leeCosas(await lee(clave));
      if (respaldo != null) await guarda(`${clave}:respaldo:${ahora()}`, respaldo);
      if (suyas.some((c) => c.id === nueva.id)) return true;
      return guarda(clave, { v: VERSION, cosas: [...suyas, nueva] });
    });
    cadenaDeOtras = hecho.then(() => {}, () => {});
    return hecho;
  }

  /**
   * Agrega una cosa al final de la cola de SU cuenta y la guarda en el teléfono. Devuelve `true` cuando ya quedó guardada (o si ya estaba: mismo id),
   * `false` si no se pudo guardar (quien llama decide, p. ej. subirla directo). Luego intenta subir.
   */
  async function agrega({ id, tipo, usuario: deQuien, datos = null, creadoEn = null }) {
    const nueva = { id, tipo, usuario: deQuien, creadoEn: creadoEn ?? ahora(), datos, intentos: 0, rechazo: null };
    if (!esCosa(nueva)) return false;
    await cargando;
    if (nueva.usuario !== usuario) return agregaAOtraCuenta(nueva);
    if (cosas.some((c) => c.id === nueva.id)) return true;
    const u = usuario;
    cosas = [...cosas, nueva];
    notifica();
    const ok = await persiste(u, cosas);
    if (!ok) {
      if (usuario === u) { cosas = cosas.filter((c) => c.id !== nueva.id); notifica(); }
      return false;
    }
    if (usuario === u) programa(0);
    return true;
  }

  /** Cómo le fue a una cosa en su siguiente intento de subir. Si en `ms` no se sabe, `{ estado: 'en-cola' }` (sigue guardada y se sube después). */
  function resultadoDe(id, ms = 8000) {
    return new Promise((listo) => {
      const quienes = esperando.get(id) ?? new Set();
      esperando.set(id, quienes);
      let t = null;
      const fin = (r) => { quienes.delete(fin); if (t != null) temporizador.quita(t); listo(r); };
      quienes.add(fin);
      t = temporizador.pon(() => { quienes.delete(fin); if (!quienes.size) esperando.delete(id); listo({ estado: 'en-cola' }); }, ms);
    });
  }

  async function unaVuelta(forzar) {
    await cargando;
    const u = usuario;
    if (!u) return;
    quitaReintento();
    const porSubir = cosas.filter((c) => c.usuario === u && tipos.has(c.tipo) && (!c.rechazo || forzar || reintentarAlAbrir.has(c.id)));
    if (!porSubir.length) return;
    let s;
    try { s = await sesion(); } catch { s = null; }
    if (usuario !== u) return;
    if (!s || s.usuario !== u) {
      // Sin sesión válida de ESTA cuenta no se sube nada. Casi siempre es que no hubo señal para renovarla: se reintenta con las mismas esperas.
      if (!s) { fallos += 1; programa(esperaDeReintento(fallos)); try { alFaltaDeSenal(null); } catch { /* sin aviso */ } }
      for (const c of porSubir) resuelve(c.id, { estado: 'sin-senal' });
      return;
    }
    for (let i = 0; i < porSubir.length; i += 1) {
      if (usuario !== u) return;
      const c = cosas.find((x) => x.id === porSubir[i].id);
      if (!c) continue; // ya no está: la persona la borró mientras tanto
      const tipo = tipos.get(c.tipo);
      if (!tipo) continue;
      enVuelo = c.id;
      notifica();
      try {
        const resultado = await tipo.sube(c);
        enVuelo = null;
        fallos = 0;
        reintentarAlAbrir.delete(c.id);
        if (usuario === u) {
          cosas = cosas.filter((x) => x.id !== c.id);
          await persiste(u, cosas);
        }
        notifica();
        try { alLlegar(); alSubir(c, resultado); } catch { /* el aviso no detiene la cola */ }
        resuelve(c.id, { estado: 'subida', resultado });
      } catch (e) {
        enVuelo = null;
        if (esFaltaDeSenal(e)) {
          fallos += 1;
          programa(esperaDeReintento(fallos));
          notifica();
          if (!e?.todaviaNo) { try { alFaltaDeSenal(e); } catch { /* sin aviso */ } }
          // Esta y las que siguen esperan su turno: la cola se vacía en orden.
          for (let j = i; j < porSubir.length; j += 1) resuelve(porSubir[j].id, { estado: 'sin-senal' });
          return;
        }
        reintentarAlAbrir.delete(c.id);
        const rechazo = { mensaje: textoDelError(e), codigo: String(e?.code ?? e?.status ?? ''), en: ahora() };
        if (usuario === u) {
          cosas = cosas.map((x) => (x.id === c.id ? { ...x, intentos: (x.intentos ?? 0) + 1, rechazo } : x));
          await persiste(u, cosas);
        }
        notifica();
        try { alRechazo(c, e); } catch { /* sin aviso */ }
        resuelve(c.id, { estado: 'rechazada', error: e });
      }
    }
  }

  /** Sube lo pendiente, en orden. Si ya hay una vuelta corriendo, al terminar se da otra (nada se pierde por pedirlo dos veces). */
  function vacia({ forzar = false } = {}) {
    if (vaciando) {
      otraVez = true;
      if (forzar) forzarOtraVez = true;
      return vaciando;
    }
    vaciando = (async () => {
      try {
        let f = forzar;
        do {
          otraVez = false;
          await unaVuelta(f);
          f = forzarOtraVez;
          forzarOtraVez = false;
        } while (otraVez);
      } finally {
        vaciando = null;
      }
    })();
    return vaciando;
  }

  /** «Reintentar»: vuelve a intentar TODO, también lo rechazado. */
  function reintenta() {
    return vacia({ forzar: true });
  }

  /** Espera a que termine de subir la que está en vuelo (si es esta), para que quien la cambia lo haga ya contra el servidor. */
  async function noEnVuelo(id) {
    if (enVuelo !== id) return;
    await resultadoDe(id, 20000);
  }

  /** Quita una cosa que todavía no subía (la persona borró ese entreno, o descartó una rechazada). `false` si ya no estaba aquí (ya subió: bórrala en el servidor). */
  async function quita(id) {
    await cargando;
    if (enVuelo === id) { await noEnVuelo(id); return false; }
    const u = usuario;
    if (!u || !cosas.some((c) => c.id === id)) return false;
    cosas = cosas.filter((c) => c.id !== id);
    notifica();
    resuelve(id, { estado: 'quitada' });
    return persiste(u, cosas);
  }

  /** Cambia los datos de una que todavía no subía (`cambio(datos) → datos`). `false` si ya no estaba aquí (ya subió: cámbiala en el servidor). */
  async function cambia(id, cambio) {
    await cargando;
    if (enVuelo === id) { await noEnVuelo(id); return false; }
    const u = usuario;
    const c = cosas.find((x) => x.id === id);
    if (!u || !c) return false;
    const datos = cambio(c.datos);
    cosas = cosas.map((x) => (x.id === id ? { ...x, datos } : x));
    notifica();
    return persiste(u, cosas);
  }

  /** Para las pruebas: apaga el temporizador. */
  function detiene() {
    quitaReintento();
  }

  return {
    registraTipo, usa, agrega, vacia, reintenta, quita, cambia, resultadoDe, detiene,
    foto: () => foto,
    escucha: (f) => { escuchas.add(f); return () => escuchas.delete(f); },
    usuario: () => usuario,
  };
}
