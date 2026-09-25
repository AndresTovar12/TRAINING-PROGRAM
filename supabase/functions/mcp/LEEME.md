# Servidor MCP de Training Lab

Conecta Training Lab con la IA de cada persona: Claude y ChatGPT (conectores) y
Claude Code, Codex y Hermes (MCP). Los cinco usan la misma liga:

    https://training-program-kappa.vercel.app/mcp

Vercel pasa esa dirección a esta función (ver `rewrites` en `vercel.json`).

## Cómo entra la IA

1. La IA llama sin permiso → 401 con la pista de dónde pedirlo
   (`WWW-Authenticate` → `/.well-known/oauth-protected-resource/mcp`).
2. El servidor de permisos es Supabase Auth (OAuth 2.1 Server, con registro
   dinámico de clientes). Se enciende en el panel de Supabase:
   Authentication → OAuth Server, ruta de autorización `/oauth/consent`.
3. La persona entra a Training Lab y ve `/oauth/consent`
   (`src/features/ia/PermisoIA.jsx`): "Claude quiere usar tu cuenta" → Permitir.
4. La IA recibe un token de Supabase de ESA persona. Cada consulta de esta
   función viaja con ese token: las reglas de la base (RLS) aplican solas.

## Archivos

- `index.ts` — solo conecta `servidor.ts` a la red.
- `servidor.ts` — recibe la petición, revisa el permiso y arma las herramientas
  según el rol (atleta / coach / administrador).
- `atleta.ts`, `coach.ts`, `admin.ts`, `comunes.ts` — las herramientas.
- `plan.ts` — leer y escribir planes con la forma exacta de la app.
- `app/` — COPIAS de `src/lib` (misma cuenta de "qué me toca hoy" que la app).
  No se editan aquí: `node scripts/compartir-con-mcp.mjs` las copia y
  `npm run check` falla si se desfasan.

## Publicar

Con la CLI de Supabase:

    supabase functions deploy mcp --no-verify-jwt

`--no-verify-jwt` porque la función revisa el permiso ella misma: tiene que
contestar 401 con la pista de dónde pedirlo, y dejar leer sus metadatos sin
sesión.

Sin la CLI (como se hizo el 25 sep 2026): el repositorio es público, así que se
despliega un `index.ts` de tres líneas que importa `servidor.ts` desde GitHub,
fijado a un commit:

    import { manejar } from 'https://raw.githubusercontent.com/AndresTovar12/TRAINING-PROGRAM/<commit>/supabase/functions/mcp/servidor.ts'
    Deno.serve(manejar)

Supabase baja ese código al desplegar, así que un commit nuevo no cambia nada
hasta volver a desplegar con su número.
