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
- `plan.ts` — leer y escribir planes con la forma exacta de la app, y de quién
  es cada programa (ver «Equipo por atleta»).
- `app/` — COPIAS de `src/lib` (misma cuenta de "qué me toca hoy" que la app, y
  las palabras de cada oficio). No se editan aquí:
  `node scripts/compartir-con-mcp.mjs` las copia y `npm run check` falla si se
  desfasan.

## Equipo por atleta (Etapa 2)

Un atleta puede tener, además de su coach principal, un equipo de profesionales
(un fisio, por ejemplo) que ÉL acepta. Cada profesional arma SU programa:
`plans.profesional_id` (null = el del coach principal). Los registros del atleta
van aparte, por programa: `wr:sessions` y `wr:cursor` para el principal (como
siempre) y `wr:sessions@<id>` y `wr:cursor@<id>` para cada profesional del equipo
(`claveDeRegistro`, en `plan.ts`). `wr:wellness` y `wr:onerm` son de la persona.

- `planActivo(quien, id)` es el del coach principal. `planesActivos` trae TODOS
  con de quién es cada uno («Beto (coach)», «Juan (fisio)»); un programa se ve
  mientras su profesional siga en el equipo. `planQueEdito` es el que esta persona
  cambia: el suyo (su coach principal, el principal; un fisio del equipo, el
  suyo); solo el master elige con `de`.
- Atleta: `ver_mi_plan`, `ver_mi_dia`, `ver_mi_semana` y `ver_mi_progreso` lo dan
  todo junto y cada cosa dice «de» quién es; con el argumento `de` (un nombre,
  «coach» o «fisio») se pide uno solo. Quien ya dio de alta no manda sesiones
  (su programa solo se consulta). `anotar_entrenamiento` guarda en la clave del
  programa correcto y, si hay dos posibles, pregunta de cuál.
- Coach y fisio: `listar_atletas` incluye a los del equipo, con su plan y
  «va también con…»; `ver_atleta`, `ver_plan_de_atleta`, `ver_dia_de_atleta` y
  `ver_registros_de_atleta` juntan los programas (con `de` se filtra). Las
  herramientas que escriben solo cambian el programa de quien llama.
- Sin equipo, las respuestas son EXACTAMENTE las de antes (no aparece ningún
  `de`).
- Palabras: a un fisio (y al paciente de un fisio) los títulos y las
  descripciones de las herramientas le hablan con sus palabras («pacientes»,
  «programa»), igual que la app (`app/palabras.js`, `conPalabras` en
  `servidor.ts`). Solo textos fijos: los nombres y lo que escribió cada quien no
  se traducen.
- Las notas de consulta de un fisio NO entran al conector: no hay ninguna
  herramienta que las lea ni las escriba.

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
