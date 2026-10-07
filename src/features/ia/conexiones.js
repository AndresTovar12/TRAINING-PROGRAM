/**
 * «Tus IAs conectadas»: qué cuenta como una conexión de verdad.
 *
 * Andrés, 6 oct 2026, viendo la lista de su cuenta: «claramente no están conectadas todas esas». `listGrants()` de
 * Supabase devuelve los PERMISOS que la persona dio alguna vez, no las conexiones vivas: cada intento de conectar
 * una IA registra un cliente nuevo y su permiso, y el permiso se queda aunque la conexión haya muerto (le pasó con
 * el cierre de sesión que borraba las sesiones de sus IAs, o con un intento que no terminó). A él le salían 9 y
 * eran 3.
 *
 * Una conexión es de verdad cuando el cliente tiene al menos UNA sesión viva (la función `mis_conexiones_ia`), y una
 * IA se cuenta UNA sola vez aunque tenga varios clientes: ChatGPT, Codex y Hermes registran uno nuevo en cada
 * intento. Quitarla desconecta a todos los clientes de esa IA, vivos o muertos, así los permisos viejos también se
 * van.
 */

export const NOMBRES = { chatgpt: 'ChatGPT', claude: 'Claude', 'claude-code': 'Claude Code', codex: 'Codex', hermes: 'Hermes' };

/** De qué IA es un cliente, por su nombre. «Codex» lleva «code» pero NO es Claude Code. */
export function familiaDe(nombre = '') {
  const n = String(nombre).toLowerCase();
  if (n.includes('claude') && n.includes('code')) return 'claude-code';
  if (n.includes('claude')) return 'claude';
  if (n.includes('codex')) return 'codex';
  if (n.includes('hermes')) return 'hermes';
  if (n.includes('chatgpt') || n.includes('openai')) return 'chatgpt';
  return `otra:${n}`;
}

const masReciente = (a, b) => (!a || (b && new Date(b) > new Date(a)) ? b : a);

/**
 * Las IAs que se muestran, una por IA, de la más reciente a la más vieja.
 * - `concedidos`: lo de `listGrants()` → `[{ client: { id, name }, granted_at }]`.
 * - `vivas`: lo de `mis_conexiones_ia()` → `[{ cliente_id, nombre, desde }]`; `null` si no se pudo preguntar (entonces
 *   se muestran los permisos, ya sin repetir cada IA).
 * Cada renglón trae `clientes` (todos los de esa IA, para desconectarla) y `vivos` (los que tienen sesión viva).
 */
export function agrupaConexiones(concedidos = [], vivas = null) {
  const grupos = new Map();
  const de = (nombre) => {
    const familia = familiaDe(nombre);
    if (!grupos.has(familia)) {
      grupos.set(familia, { familia, nombre: NOMBRES[familia] ?? nombre ?? 'IA sin nombre', desde: null, clientes: new Set(), vivos: new Set() });
    }
    return grupos.get(familia);
  };
  for (const c of concedidos ?? []) {
    if (!c?.client?.id) continue;
    const g = de(c.client.name);
    g.clientes.add(c.client.id);
    if (vivas === null) g.desde = masReciente(g.desde, c.granted_at);
  }
  for (const v of vivas ?? []) {
    if (!v?.cliente_id) continue;
    const g = de(v.nombre);
    g.clientes.add(v.cliente_id);
    g.vivos.add(v.cliente_id);
    g.desde = masReciente(g.desde, v.desde);
  }
  return [...grupos.values()]
    .filter((g) => vivas === null || g.vivos.size > 0)
    .map((g) => ({ ...g, clientes: [...g.clientes], vivos: [...g.vivos] }))
    .sort((a, b) => new Date(b.desde ?? 0) - new Date(a.desde ?? 0));
}
