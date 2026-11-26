/* EL DINERO DEL COACH, lo puro (encargo «Compra y dinero», 26 nov 2026). Sin red ni React: lo usan «Mis ganancias», las funciones del servidor (copia idéntica,
   la vigila `scripts/compartir-con-mcp.mjs`) y `scripts/prueba-dinero.mjs`.

   EL REPARTO
     · Web: el coach se queda el 80 % del precio; Training Lab el 20 % (como en `stripe-webhook`).
     · iPhone: el coach se queda el 80 % de lo que Apple le paga a Training Lab. Mientras Apple no paga se enseña con «≈»: precio ÷ 1.16 (IVA) × 0.85 (Apple) × 0.80.
       De $500 ≈ $293. Al pagar Apple el mes, el «≈» se cambia por lo real (repartido entre las ventas de ese mes).
   DÓNDE ESTÁ EL DINERO (nunca se mezcla con «Ganaste en noviembre»): en camino · listo para retirar · retirado. Un renglón «anulado» (reembolso antes de retirar) no cuenta.
   RETIRAR: mínimo $200. Se toman ventas COMPLETAS, las más viejas primero; lo de la web sale por Stripe y lo de iPhone por SPEI. */

export const PARTE_COACH = 0.8;
export const IVA = 1.16;
export const PARTE_APPLE = 0.85; // lo que Apple le deja a Training Lab (15 %, programa de negocios pequeños)
export const MINIMO_RETIRO = 200;

const centavos = (x) => Math.round(Number(x) * 100);
const pesosDe = (c) => c / 100;

/** Lo del coach en UNA venta. `tasa`: la comisión de la web (0.2 normal, 0 el dueño, o la especial). En iPhone siempre es aproximado hasta que Apple paga. */
export function parteDelCoach({ canal = 'web', bruto, tasa = 1 - PARTE_COACH }) {
  if (canal === 'apple') return { monto: pesosDe(Math.round((centavos(bruto) / IVA) * PARTE_APPLE * PARTE_COACH)), aproximado: true };
  const c = centavos(bruto);
  return { monto: pesosDe(c - Math.round(c * Number(tasa))), aproximado: false };
}

/**
 * Apple pagó un mes: `recibido` es lo que pagó por TODAS las ventas de ese mes. Se reparte entre ellas según su precio y a cada coach le toca su 80 %.
 * Al centavo: lo que sobra del redondeo va a las ventas más grandes, para que la suma sea exacta. Devuelve `[{ id, monto }]`.
 */
export function repartePagoDeApple(ventas, recibido, parte = PARTE_COACH) {
  const lista = (ventas ?? []).filter((v) => Number(v.bruto) > 0);
  const totalBruto = lista.reduce((s, v) => s + centavos(v.bruto), 0);
  if (!lista.length || !totalBruto) return [];
  const aRepartir = Math.round(centavos(recibido) * parte);
  const crudos = lista.map((v) => ({ id: v.id, exacto: (aRepartir * centavos(v.bruto)) / totalBruto }));
  const piso = crudos.map((x) => ({ ...x, c: Math.floor(x.exacto) }));
  let falta = aRepartir - piso.reduce((s, x) => s + x.c, 0);
  [...piso].sort((a, b) => (b.exacto - b.c) - (a.exacto - a.c)).forEach((x) => { if (falta > 0) { x.c += 1; falta -= 1; } });
  return piso.map((x) => ({ id: x.id, monto: pesosDe(x.c) }));
}

/** ¿Este renglón ya se puede retirar hoy? Lo de la web, en cuanto Stripe lo libera (su fecha ya pasó); lo de iPhone, cuando Apple pagó (el servidor lo pasa a «listo»). */
export const estaListo = (r, hoy) => r.estado === 'listo' || (r.estado === 'en_camino' && r.canal === 'web' && !!r.listo_estimado && String(r.listo_estimado).slice(0, 10) <= hoy);

/** Dónde está cada renglón hoy: 'en_camino' | 'listo' | 'retirado' | 'anulado'. */
export const lugarDe = (r, hoy) => (r.estado === 'retirado' || r.estado === 'anulado' ? r.estado : estaListo(r, hoy) ? 'listo' : 'en_camino');

/**
 * Los tres lugares del dinero. `hoy`: «AAAA-MM-DD». Devuelve los totales (en pesos) y, de lo que viene en camino, cuánto es de la web y cuánto de iPhone, con sus fechas.
 */
export function saldos(libro, hoy) {
  const r = { retirado: 0, listo: 0, enCamino: 0, aproximado: false, web: { monto: 0, fechas: [] }, apple: { monto: 0, fechas: [] }, desdeSiempre: 0 };
  const c = { retirado: 0, listo: 0, enCamino: 0, web: 0, apple: 0 };
  for (const x of libro ?? []) {
    const lugar = lugarDe(x, hoy);
    if (lugar === 'anulado') continue;
    const m = centavos(x.monto);
    if (lugar === 'retirado') c.retirado += m;
    else if (lugar === 'listo') c.listo += m;
    else {
      c.enCamino += m;
      c[x.canal === 'apple' ? 'apple' : 'web'] += m;
      if (x.aproximado) r.aproximado = true;
      const lado = x.canal === 'apple' ? r.apple : r.web;
      if (x.listo_estimado && !lado.fechas.includes(String(x.listo_estimado).slice(0, 10))) lado.fechas.push(String(x.listo_estimado).slice(0, 10));
    }
  }
  r.retirado = pesosDe(c.retirado);
  r.listo = pesosDe(c.listo);
  r.enCamino = pesosDe(c.enCamino);
  r.web.monto = pesosDe(c.web);
  r.apple.monto = pesosDe(c.apple);
  r.web.fechas.sort();
  r.apple.fechas.sort();
  r.desdeSiempre = pesosDe(c.retirado + c.listo + c.enCamino);
  return r;
}

/** El mes de una fecha en la Ciudad de México: «2026-11». */
export function mesDe(iso, zona = 'America/Mexico_City') {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: zona, year: 'numeric', month: '2-digit' }).formatToParts(new Date(iso));
  return `${p.find((x) => x.type === 'year').value}-${p.find((x) => x.type === 'month').value}`;
}

/** «Ganaste en noviembre»: lo del coach de las ventas y renovaciones de ese mes (sin las anuladas; un reembolso de algo ya retirado resta). */
export function ganadoEnMes(libro, mes) {
  const c = (libro ?? []).filter((x) => x.estado !== 'anulado' && mesDe(x.creado_en) === mes).reduce((s, x) => s + centavos(x.monto), 0);
  return pesosDe(c);
}

/**
 * Qué se lleva un retiro. `listos`: los renglones que hoy están listos. `monto`: lo que pidió (null = todo).
 * Los reembolsos (negativos) se descuentan primero; luego ventas COMPLETAS de la más vieja a la más nueva mientras quepan. Lo de la web sale por Stripe y lo de iPhone
 * por SPEI; si un lado queda en cero o menos, ese lado no se manda (sus renglones se quedan listos). Devuelve `{ ids, stripe, spei, total }` en pesos.
 * @param {any[]} listos
 * @param {number | null} [monto]
 * @returns {{ ids: any[], stripe: number, spei: number, total: number }}
 */
export function asignaRetiro(listos, monto = null) {
  const lista = [...(listos ?? [])].sort((a, b) => String(a.creado_en).localeCompare(String(b.creado_en)));
  const negativos = lista.filter((x) => Number(x.monto) < 0);
  const positivos = lista.filter((x) => Number(x.monto) >= 0);
  const tope = monto === null || monto === undefined ? Infinity : centavos(monto);
  let suma = negativos.reduce((s, x) => s + centavos(x.monto), 0);
  const tomados = [...negativos];
  for (const x of positivos) {
    if (suma + centavos(x.monto) > tope) break;
    suma += centavos(x.monto);
    tomados.push(x);
  }
  const porLado = (canal) => tomados.filter((x) => (x.canal === 'apple') === (canal === 'apple'));
  const neto = (xs) => xs.reduce((s, x) => s + centavos(x.monto), 0);
  const web = porLado('web');
  const apple = porLado('apple');
  const stripe = Math.max(0, neto(web));
  const spei = Math.max(0, neto(apple));
  const ids = [...(stripe > 0 ? web : []), ...(spei > 0 ? apple : [])].map((x) => x.id);
  return { ids, stripe: pesosDe(stripe), spei: pesosDe(spei), total: pesosDe(stripe + spei) };
}

/** Cómo va un retiro según sus envíos (uno o dos): «Llegó» solo cuando llegaron todos; si uno falla y otro llega, «en parte». */
export function estadoDeRetiro(envios) {
  const xs = envios ?? [];
  if (!xs.length) return 'enviado';
  if (xs.every((e) => e.estado === 'llego')) return 'llego';
  if (xs.every((e) => e.estado === 'fallo')) return 'no_llego';
  if (xs.some((e) => e.estado === 'enviado')) return 'enviado';
  return 'en_parte';
}

/* ---------- CLABE ---------- */
const BANCOS = {
  '002': 'Banamex', '006': 'Bancomext', '009': 'Banobras', '012': 'BBVA', '014': 'Santander', '019': 'Banjército', '021': 'HSBC', '030': 'Bajío', '036': 'Inbursa', // estilo-ok: nombres propios de bancos
  '042': 'Mifel', '044': 'Scotiabank', '058': 'Banregio', '059': 'Invex', '060': 'Bansi', '062': 'Afirme', '072': 'Banorte', '106': 'Bank of America', '127': 'Azteca', // estilo-ok: nombres propios de bancos
  '130': 'Compartamos', '137': 'BanCoppel', '138': 'ABC Capital', '145': 'Banco Base', '147': 'Bankaool', '166': 'Banco del Bienestar', '638': 'Nu', '646': 'STP', // estilo-ok: nombres propios de bancos
  '706': 'Arcus', '722': 'Mercado Pago', '728': 'Spin by OXXO', '734': 'Finco Pay', // estilo-ok: nombres propios de bancos
};
/** ¿Es una CLABE válida? 18 dígitos y el dígito de control correcto (pesos 3, 7, 1). */
export function clabeValida(texto) {
  const c = String(texto ?? '').replace(/\s+/g, '');
  if (!/^\d{18}$/.test(c)) return false;
  const pesos = [3, 7, 1];
  const suma = [...c.slice(0, 17)].reduce((s, d, i) => s + ((Number(d) * pesos[i % 3]) % 10), 0);
  return (10 - (suma % 10)) % 10 === Number(c[17]);
}
export const bancoDeClabe = (clabe) => BANCOS[String(clabe ?? '').slice(0, 3)] ?? null;
/** «BBVA ··4821». */
export const destinoCorto = (banco, ultimos) => `${banco || 'Tu banco'} ··${String(ultimos ?? '').slice(-4)}`;

/* ---------- En palabras ---------- */
const MES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DIA_CORTO = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const diaDe = (fecha) => new Date(`${String(fecha).slice(0, 10)}T12:00:00Z`);

/** «$8,670» · «$293.47» · aproximado: «≈ $293». */
export function pesos(n, { aproximado = false } = {}) {
  const x = Number(n) || 0;
  const entero = aproximado || Math.round(x * 100) % 100 === 0;
  const t = Math.abs(entero ? Math.round(x) : x).toLocaleString('en-US', { minimumFractionDigits: entero ? 0 : 2, maximumFractionDigits: entero ? 0 : 2 });
  return `${aproximado ? '≈ ' : ''}${x < 0 ? '−' : ''}$${t}`;
}
/** «jue 26». */
export const diaConNombre = (fecha) => `${DIA_CORTO[diaDe(fecha).getUTCDay()]} ${diaDe(fecha).getUTCDate()}`;
/** Lo de la web: «Listo el jue 26» · varias fechas: «Listo el jue 26 y el vie 27». */
export function listoWeb(fechas) {
  const f = [...new Set(fechas ?? [])].sort();
  if (!f.length) return '';
  if (f.length === 1) return `Listo el ${diaConNombre(f[0])}`;
  return `Listo el ${f.slice(0, -1).map(diaConNombre).join(', el ')} y el ${diaConNombre(f[f.length - 1])}`;
}
/** Lo de iPhone, siempre aproximado: «a mediados de dic». */
export function aproxDeMes(fecha) {
  const d = diaDe(fecha);
  const parte = d.getUTCDate() <= 10 ? 'principios' : d.getUTCDate() <= 20 ? 'mediados' : 'finales';
  return `a ${parte} de ${MES_CORTO[d.getUTCMonth()]}`;
}
/** «Listo a mediados de dic y de ene». */
export function listoApple(fechas) {
  const f = [...new Set((fechas ?? []).map(aproxDeMes))];
  if (!f.length) return '';
  if (f.length === 1) return `Listo ${f[0]}`;
  const resto = f.slice(1).map((x) => x.replace(/^a (principios|mediados|finales) de /, (m, p) => (p === f[0].split(' ')[1] ? 'de ' : `a ${p} de `)));
  return `Listo ${f[0]} y ${resto.join(' y ')}`;
}
/** Para el renglón de una venta: «Listo el vie 27» (web) o «Listo en ene» (iPhone). */
export const listoDeUnaVenta = (r) => (r.canal === 'apple' ? `Listo en ${MES_CORTO[diaDe(r.listo_estimado).getUTCMonth()]}` : `Listo el ${diaConNombre(r.listo_estimado)}`);
