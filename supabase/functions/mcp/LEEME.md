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
- `misplanes.ts` — «Mis planes»: el catálogo del profesional (ver la sección de abajo). Lo reciben coach y administrador.
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

## Cuándo pregunta la IA (7 oct 2026)

Andrés quiere que ChatGPT y Claude pregunten cuando hay duda, pero solo lo que tendrían que adivinar: lo que
la persona ya dijo no se vuelve a preguntar, y lo que se puede deducir se deduce y se enseña. Son dos piezas:

- **La nota** (`instrucciones` en `servidor.ts`, arriba de todo: OpenAI pide lo importante en los primeros
  512 caracteres). Es un consejo: cada IA puede o no seguirlo. Cubre lo que el conector no ve (biserie o
  separados, «por lado», reps que faltan).
- **Los topes** (`preguntas.ts`). Lo que el conector SÍ revisa solo. Si falta algo se detiene ANTES de
  guardar y contesta una `Pregunta` (no un error: `guardado: false` + la pregunta y las opciones reales).
  Cada tope trae su salida, para no preguntar lo que la persona ya dijo:
  - `crear_ejercicio` solo con el nombre → una sola pregunta con categoría, grupo muscular, equipo y nota.
    Con cualquier dato, o con `sin_datos: true` («así»), se guarda.
  - `crear_plan` y `editar_dia` revisan, ANTES de guardar, cuatro cosas, y si falta algo NO guardan y
    contestan TODAS las preguntas juntas (para que la IA las haga en un solo mensaje):
    1. un ejercicio que no está en el catálogo con su nombre (sin importar mayúsculas, acentos, espacios,
       guiones ni plural) → trae los parecidos y cómo preguntar; `sin_ficha_ok: [nombres]` lo deja pasar;
    2. un ejercicio sin cantidad (ni reps, ni tiempo, ni reloj de formato, ni vueltas) → `sin_cantidad_ok`
       («así lo mando»);
    3. un ejercicio a una pierna o un brazo (por su nombre: pistol, step ups, búlgara, zancadas…) sin decir
       `por_lado` true o false;
    4. biseries, triseries o circuitos NUEVOS (`grupo`): se devuelve la rutina armada con BI SERIE / TRI SERIE
       para que la persona la confirme; `estructura_ok: true` la deja pasar.
    Lo que el plan ya tenía (nombres y agrupaciones) no cuenta: leer un día y reescribirlo no se frena.

Los parecidos son por letras (el catálogo está casi todo en inglés: «jalón» no encuentra «pull down»); esa
traducción la hace la IA con `buscar_ejercicios`. Prueba: `scripts/prueba-mcp-preguntas.ts`.

## La ciencia de un plan (7 oct 2026)

Antes la pestaña «Ciencia» era texto fijo del programa de Andrés. Ahora es DATO de cada plan: recuadros con título y
texto (`lib/ciencia.js`, copiado a `app/ciencia.js`) que el atleta lee en la tarjeta «Ciencia» de Home.

- Viven en dos sitios: `plans.data.ciencia` (todo el plan) y `fase.ciencia` (una fase, viaja con ella). La foto del plan
  (`plans.data.foto`) y la de cada fase (`fase.image`) son cosas parecidas: las pone el coach en la app, la IA no las toca.
- `crear_plan` acepta `ciencia` (del plan) y `ciencia` dentro de cada fase. `ver_ciencia_del_plan` lee los textos
  completos y `editar_ciencia` agrega, cambia por título, quita o reemplaza (modo `reemplazar` + `reemplazo_ok`).
  `ver_plan_de_atleta` solo nombra los recuadros (sin texto) para no inflar la respuesta.
- NO se inventa: la nota de `instrucciones` y las descripciones dicen que solo se escribe si la persona la pidió o la dio.
- Reglas de preguntar de siempre: `reemplazar` que se lleva recuadros que ya estaban NO guarda y dice qué preguntar;
  reemplazar un plan entero (`crear_plan` con `reemplazar`) conserva la foto del plan y NO pasa la ciencia vieja al plan
  nuevo (explicaba otro plan): se avisa y queda en el historial. Un título que no existe al quitar, o un texto de más de
  8000 caracteres, es un aviso (no se acorta en silencio).
- `guardarFases` conserva todo lo demás de `plans.data` (`...plan.data`): cualquier herramienta que reescriba las fases deja
  la foto y la ciencia como estaban. Lo único que arma `data` desde cero es `crear_plan`.

## Mis planes (13 oct 2026)

Andrés vio a ChatGPT decir «el conector no puede guardar un plan progresivo en Mis planes»: la IA tiene que poder lo que hace la app. «Mis planes» es el catálogo de
cada profesional: **programas** (por fases), **rutinas** semanales, **workouts** (un día) y **clases** (un workout con video), en carpetas. Lo guardado es una COPIA.
Mismas tablas que la app (`src/lib/misPlanes.js`, `misPlanesDatos.js` → copiado a `app/`): programa → `programas_guardados`; rutina (kind `week`) y workout/clase
(kind `day`) → `routine_templates`; carpetas → `carpetas_planes`. La base (RLS) hace que cada quien toque solo lo suyo.

| Herramienta | Qué hace |
|---|---|
| `ver_mis_planes` | La lista, con tipo, carpeta y resumen; filtra por tipo, carpeta (con subcarpetas) o texto. |
| `abrir_de_mis_planes` | Lo de dentro, de a poco: programa → fases → semanas → días → ejercicios (`fase`, `semana`, `dia`). |
| `guardar_en_mis_planes` | (1) Del plan de un atleta: programa entero, `fases_elegidas`, una `semana` (rutina) o un `dia` (workout/clase), con `solo_tipos`/`sin_tipos`. (2) Armado desde cero (`tipo` + `fases`/`sesiones`), con las mismas preguntas que `crear_plan` (no guarda hasta que se contestan). |
| `cambiar_en_mis_planes` | Nombre, descripción, carpeta (mover no toca la fecha de «cambiado», igual que la app). |
| `duplicar_en_mis_planes`, `borrar_de_mis_planes` | Copia con «(copia)»; borrar (no se recupera). |
| `crear_carpeta`, `cambiar_carpeta`, `borrar_carpeta` | Hasta 5 niveles; no repite una carpeta; al borrar, lo de adentro SUBE un nivel (nada se pierde). |

Cosas a saber: una cosa guardada se pide por nombre o por id (`id` si hay dos con el mismo nombre; la herramienta lo pide); una carpeta, por nombre o ruta
(«Fútbol › Fuerza»), y `"sin carpeta"` es arriba de todo. La IA no puede crear una CLASE (no sube videos): solo guarda la que ya viene en el día de un atleta.
`armarFasesDeLaIA` (en `coach.ts`) arma las fases para `crear_plan` y para guardar sin atleta. **Falta (siguientes tandas):** dar lo guardado a uno o varios atletas, crear un
plan copiando fases de otro, la vitrina, los mensajes y las métricas del reloj.

Prueba: `scripts/prueba-mcp-misplanes.ts` (desde esta carpeta: `deno run -A --config deno.json ../../../scripts/prueba-mcp-misplanes.ts`), con una base en memoria que guarda y borra.

## Clases en video (13 oct 2026)

Una sesión puede traer una clase en video arriba de sus ejercicios: `sesion.clase = { url, duracion?, inicio?, fin? }` (`src/lib/clases.js`, copiado a `app/clases.js`).
La IA no sube videos, así que la clase nunca viaja en lo que manda; el conector la cuida:

- **Al leer** (`ver_plan_de_atleta`, `ver_dia_de_atleta`): el día dice `clase_en_video` (la duración, si se sabe).
- **`editar_dia`**: cada sesión nueva hereda la clase de la que ya estaba (la del mismo nombre, o la que ocupaba ese lugar). Solo se va con `quitar_clase: true`.
- **`guardar_plantilla`** (día): la plantilla lleva la clase y su `resumen` la marca como «Clase», igual que cuando la guarda la app; así sale en Mis planes y en la biblioteca de clases.
- **`aplicar_plantilla`** (día): el día recibe la clase de la plantilla.

Prueba: el grupo «clases en video» de `scripts/prueba-mcp-preguntas.ts`.

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
