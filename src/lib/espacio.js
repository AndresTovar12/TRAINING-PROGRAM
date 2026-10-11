/* EL ESPACIO DE VIDEOS DE UN COACH, en palabras. Sin red ni React: solo números y textos (se prueban en `scripts/prueba-espacio.mjs`).

   La REGLA (cuánto le toca a cada coach) vive en la base —`espacio_del_coach`, docs/sql/2026-10-11-espacio-de-videos.sql— y llega ya calculada:
   `{ usado, limite, clientes, ilimitado, base, por_cliente }`, todo en bytes. `limite` es null cuando no hay tope (el dueño). Aquí solo se muestra.

   POR QUÉ HORAS. Un coach de pilates no piensa en gigabytes: piensa en clases de una hora. Una hora de video en 1080p pesa ≈ 3.5 GB (la medida de este proyecto: ≈ 58 MB por
   minuto), así que «10 GB» se dice también «≈ 3 horas». Es una equivalencia para entender, no una cuenta: el límite real son los bytes. */

export const GB = 1e9;
export const GB_POR_HORA = 3.5;

/** Lo más que cabe en UN archivo: R2 acepta ~5 GB en una sola subida. Debe coincidir con `TOPE_POR_ARCHIVO_BYTES` de la función `r2-upload`. */
export const TOPE_POR_ARCHIVO_MB = 4800;

const redondea = (n) => Math.round(n * 10) / 10;

/** «2.1 GB», «350 MB»: lo que se le muestra a una persona. */
export function pesoDeVideo(bytes) {
  const b = Number(bytes) || 0;
  if (b >= GB) return `${redondea(b / GB).toLocaleString('es-MX')} GB`;
  return `${Math.round(b / 1e6).toLocaleString('es-MX')} MB`;
}

/** Cuántas horas de clase en 1080p caben en `bytes`, en palabras: «≈ 3 h», «≈ 45 min». */
export function horasEquivalentes(bytes) {
  const horas = (Number(bytes) || 0) / (GB_POR_HORA * GB);
  if (horas < 1) return `≈ ${Math.max(1, Math.round(horas * 60 / 5) * 5)} min`;
  return `≈ ${redondea(horas).toLocaleString('es-MX')} h`;
}

/** `espacio` tal como lo da la base → lo que la pantalla necesita. null si no hay tope que mostrar (el dueño, o aún sin datos). */
export function estadoDelEspacio(espacio) {
  if (!espacio || espacio.ilimitado || espacio.limite === null || espacio.limite === undefined) return null;
  const limite = Number(espacio.limite);
  const usado = Math.max(0, Number(espacio.usado) || 0);
  const pct = limite > 0 ? Math.min(100, Math.round((usado / limite) * 100)) : 100;
  return {
    usado, limite, pct,
    queda: Math.max(0, limite - usado),
    casiLleno: pct >= 80 && pct < 100,
    lleno: usado >= limite,
    texto: `${pesoDeVideo(usado)} de ${pesoDeVideo(limite)}`,
    horas: horasEquivalentes(limite),
  };
}

/**
 * ¿Cabe un archivo de `bytes` en lo que le queda? Devuelve `null` si cabe (o si no hay tope) y, si no, el aviso para mostrar ANTES de abrir el editor o subir nada:
 * nadie debería editar y esperar una subida de 3 GB para enterarse al final de que no cabía.
 */
export function avisoSiNoCabe(espacio, bytes) {
  const e = estadoDelEspacio(espacio);
  if (!e) return null;
  if (e.usado + (Number(bytes) || 0) <= e.limite) return null;
  const sumaPorCliente = espacio.por_cliente ? ` Cada cliente que te pague te suma ${pesoDeVideo(espacio.por_cliente)}.` : '';
  return `No te alcanza el espacio para este video: usaste ${pesoDeVideo(e.usado)} de ${pesoDeVideo(e.limite)} y este pesa ${pesoDeVideo(bytes)}. Borra videos que ya no uses.${sumaPorCliente}`;
}

/** Aviso de un archivo que supera el tope de UNA subida; `null` si cabe. */
export function avisoSiEsMuyGrande(bytes) {
  const tope = TOPE_POR_ARCHIVO_MB * 1048576;
  if ((Number(bytes) || 0) <= tope) return null;
  return `Este archivo pesa ${pesoDeVideo(bytes)} y el máximo por archivo es ${pesoDeVideo(tope)} (una clase de ~80 minutos en 1080p). Grábala en 1080p o divídela en dos partes.`;
}
