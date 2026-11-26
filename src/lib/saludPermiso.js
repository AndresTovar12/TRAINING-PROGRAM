/* ¿QUEDÓ CONECTADA APPLE SALUD? (26 nov 2026; antes vivía en `saludDelTelefono.js`).

   Una atleta (Mariane) tenía TODO encendido en Salud → Training Lab y le salía «No pudimos leer nada». La revisión vieja pedía dos cosas: permiso de escribir
   entrenos (eso iOS sí lo confirma) Y al menos un paso de los últimos 60 días (una suposición: iOS no dice si negó la LECTURA; si está apagada contesta vacío,
   como si no hubiera nada). Sin ni un paso, se bloqueaba con los permisos bien. Y los errores se tragaban: no se sabía cuál de las dos falló.

   AHORA:
   · Se conecta con lo que iOS SÍ confirma: el permiso de ESCRIBIR entrenos (`ok`). Que no haya datos ya no bloquea (`sinDatos`).
   · Para saber si hay algo que leer se prueba, en orden y parando en el primero que traiga algo: pasos, pulso, sueño y entrenos (60 días). `primero` dice cuál.
   · Si `checkAuthorization` FALLA con error (no es que negó), `noSePudoRevisar`: la pantalla dice «No se pudo revisar Salud», no «No pudimos leer nada».
   · Cada error se guarda en `errores` (texto) y lo que contestó `checkAuthorization` en `estado`: van al diagnóstico (`lib/diagnosticoSalud.js`).

   Puro: recibe el plugin (`Health` de `@capgo/capacitor-health`) y se prueba en Node con uno falso (`scripts/prueba-salud-permiso.mjs`). */

export const LEER = ['heartRate', 'restingHeartRate', 'heartRateVariability', 'sleep', 'steps', 'calories', 'distance', 'distanceCycling', 'vo2Max', 'oxygenSaturation', 'respiratoryRate', 'weight', 'workouts'];
// Lo que la app del reloj guarda en Salud al medir un entreno (`ModeloDelEntreno.swift`): el entreno, su pulso y su energía activa.
export const ESCRIBIR = ['workouts', 'heartRate', 'calories'];

/** Lo que se prueba leer, en orden: el primero que traiga algo dice que la lectura funciona. */
export const ORDEN_DE_LECTURA = ['steps', 'heartRate', 'sleep', 'workouts'];
const DIAS = 60;

const textoDe = (e) => String(e?.message ?? e ?? 'error').slice(0, 300);

/**
 * `{ ok, escribe, lee, primero, sinDatos, noSePudoRevisar, errores, estado }`.
 * · `ok` / `escribe`: dio permiso de escribir entrenos (con eso se conecta).
 * · `lee` / `primero`: se leyó algo y qué fue primero ('steps' | 'heartRate' | 'sleep' | 'workouts' | null).
 * · `sinDatos`: escribe pero no se leyó nada (se conecta igual: los datos llegan conforme se registren).
 * · `noSePudoRevisar`: `checkAuthorization` falló con error: no se sabe si dio permiso.
 */
export async function revisaPermisoCon(Health, { ahora = Date.now() } = {}) {
  const errores = [];
  let escribe = null;
  let estado = null;
  try {
    estado = await Health.checkAuthorization({ read: LEER, write: ESCRIBIR });
    if (!estado || typeof estado !== 'object') throw new Error('checkAuthorization no contestó');
    escribe = !(Array.isArray(estado.writeDenied) ? estado.writeDenied : []).includes('workouts');
  } catch (e) {
    errores.push(`checkAuthorization: ${textoDe(e)}`);
  }
  const desde = new Date(ahora - DIAS * 86400000).toISOString();
  const hasta = new Date(ahora).toISOString();
  let primero = null;
  for (const tipo of ORDEN_DE_LECTURA) {
    try {
      const r = tipo === 'workouts'
        ? await Health.queryWorkouts({ startDate: desde, endDate: hasta, limit: 1 })
        : await Health.readSamples({ dataType: tipo, startDate: desde, endDate: hasta, limit: 1 });
      const lista = tipo === 'workouts' ? r?.workouts : r?.samples;
      if (Array.isArray(lista) && lista.length > 0) { primero = tipo; break; }
    } catch (e) {
      errores.push(`${tipo}: ${textoDe(e)}`);
    }
  }
  const lee = primero !== null;
  return {
    ok: escribe === true,
    escribe: escribe === true,
    lee,
    primero,
    sinDatos: escribe === true && !lee,
    noSePudoRevisar: escribe === null,
    errores,
    estado,
  };
}

const NOMBRE_DEL_DATO = { steps: 'pasos', heartRate: 'pulso', sleep: 'sueño', workouts: 'entrenos' };

/** La versión de iOS del navegador del iPhone («18.1»), o null. */
export function versionDeIos(agente = '') {
  const m = /OS (\d+)[_.](\d+)(?:[_.](\d+))? like Mac OS X/.exec(String(agente));
  return m ? [m[1], m[2], m[3]].filter(Boolean).join('.') : null;
}

/**
 * La fila de `diagnosticos_salud` de un intento (docs/sql/2026-11-26-diagnosticos-salud.sql). `r`: lo de `revisaPermisoCon`. `donde`: 'inicio' | 'conectar' |
 * 'otra_vez'. `ios`: la versión. `reloj`: lo de `estadoDelReloj` (null si no se supo).
 */
export function filaDeDiagnostico(r, { usuarioId, donde = null, ios = null, reloj = null } = {}) {
  return {
    usuario_id: usuarioId,
    donde,
    ios,
    reloj_emparejado: reloj && !reloj.sinRespuesta ? !!reloj.emparejado : null,
    escribe: r?.noSePudoRevisar ? 'no_se_pudo_revisar' : r?.escribe ? 'dado' : 'no',
    primero: NOMBRE_DEL_DATO[r?.primero] ?? 'ninguno',
    errores: r?.errores?.length ? r.errores.join('\n').slice(0, 2000) : null,
    detalle: r?.estado ?? null,
  };
}
