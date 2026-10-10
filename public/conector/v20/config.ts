/**
 * Dónde vive cada cosa.
 *
 * La IA NO habla con la dirección de Supabase: habla con la de la app,
 * `…vercel.app/mcp`, y Vercel le pasa la llamada a esta función (ver
 * `vercel.json`). Así la liga que la gente pega es corta y es de Training Lab,
 * y si algún día se cambia de sitio el servidor, la liga no cambia.
 */

export const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
export const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
export const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

/** La app. De aquí salen los links de invitación y la liga del conector. */
export const APP_URL = (Deno.env.get('APP_URL') ?? 'https://training-program-kappa.vercel.app').replace(/\/$/, '')

/** La dirección del servidor MCP tal como la pega la gente en su IA. */
export const MCP_URL = `${APP_URL}/mcp`

/** Quien emite los permisos: el servidor OAuth 2.1 de Supabase Auth. */
export const EMISOR = `${SUPABASE_URL}/auth/v1`

/**
 * La zona horaria de los atletas, para saber qué día es "hoy".
 *
 * El servidor corre en hora de Greenwich; el atleta, en la suya. A las 8 de la
 * noche en México ya es "mañana" en Greenwich, y la IA le contestaría con la
 * sesión del día siguiente. Todos los del piloto están en México; si algún
 * día hay atletas en otro huso, cada herramienta acepta `fecha` explícita.
 */
export const ZONA = Deno.env.get('ZONA_HORARIA') ?? 'America/Mexico_City'

/**
 * Metadatos del recurso protegido (RFC 9728): le dicen a Claude, ChatGPT o
 * Codex quién da los permisos para entrar aquí. Con esto se configuran solos:
 * la persona solo pega la liga.
 */
export function metadatosDelRecurso() {
  return {
    resource: MCP_URL,
    authorization_servers: [EMISOR],
    bearer_methods_supported: ['header'],
    resource_name: 'Training Lab',
    resource_documentation: APP_URL,
  }
}
