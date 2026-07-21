# Training Lab

Aplicación de entrenamiento multi-usuario. Combina el plan anual de periodización
de Andres Tovar (intacto, ver más abajo) con una capa profesional de cuentas,
administración de atletas, repertorio de ejercicios con media y persistencia en la nube.

- **Atleta** — inicia sesión y ve su plan de entrenamiento, bienestar, calculadora
  de 1RM y la sección de ciencia. El progreso se guarda en la nube.
- **Admin** — ve a todos los atletas, les asigna rutinas y administra el repertorio
  de ejercicios (alta/baja por categoría, foto de portada y video por subida o enlace
  de TikTok/Instagram/YouTube).

## Stack

| Capa | Tecnología |
| --- | --- |
| UI | React 19, Vite 8, Tailwind CSS v4 |
| Iconos / gráficos | lucide-react, recharts |
| Backend | Supabase (Postgres, Auth, Storage, Edge Functions) |
| Hosting | Vercel o Netlify (SPA estática) |

La app es una SPA: el enrutado es por renderizado condicional en
[`src/App.jsx`](src/App.jsx) según `loading → user → profile.role`, no por rutas de URL.

## Puesta en marcha local

Requisitos: Node 20+ y un proyecto de Supabase.

```bash
npm install
cp .env.example .env        # completa con tus claves de Supabase
npm run dev                 # http://localhost:5173
```

### Variables de entorno

Solo se usan claves **públicas** (prefijo `VITE_`, expuestas al navegador). Nunca
pongas la `service_role` key aquí — vive únicamente en el entorno del Edge Function.

| Variable | Descripción |
| --- | --- |
| `VITE_SUPABASE_URL` | URL del proyecto, p. ej. `https://xxxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Publishable / anon key (`sb_publishable_…`) |

`.env` y sus variantes están en `.gitignore`; solo se versiona `.env.example`.

## Build

```bash
npm run build      # genera dist/
npm run preview    # sirve dist/ localmente
npm run lint       # eslint
```

## Despliegue

El proyecto trae configuración lista para ambos hostings. Ambos sirven la SPA con
fallback a `index.html` y aplican las cabeceras de seguridad.

- **Vercel** — [`vercel.json`](vercel.json): rewrites de SPA (todo lo que no sea
  `/assets/*` va a `index.html`), cabeceras de seguridad y cache inmutable de assets.
- **Netlify** — [`public/_redirects`](public/_redirects) (fallback SPA `200`) y
  [`public/_headers`](public/_headers) (mismas cabeceras de seguridad y cache).

Configura `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en el panel del hosting.
Comando de build `npm run build`, directorio de salida `dist`.

## Arquitectura

```
src/
  App.jsx                 Shell: splash → auth → admin/atleta + menú de cuenta
  main.jsx                Punto de entrada, envuelve en <AuthProvider>
  contexts/
    AuthContext.jsx       Sesión, perfil, isAdmin, signIn/signUp/signOut
    AppStateContext.jsx   useStorage(key, def) → blob jsonb en user_app_state
  features/
    auth/AuthScreen.jsx   Login/registro por usuario O email
    training/TrainingApp.jsx   App del atleta (plan intacto)
    admin/                AdminApp, AthletesPanel, ExercisesPanel
  data/training-data.js   DATOS DEL PLAN — INTOCABLES (ver abajo)
  lib/
    supabase.js           Cliente (claves desde env, sin secretos)
    api.js                Acceso a datos (ejercicios, atletas, rutinas, media)
    theme.js              Tokens de estilo (T, FONT)
    training-utils.js     Helpers de cálculo del plan
    wearables.js          Punto de extensión para wearables (ver abajo)
supabase/
  functions/signup/       Edge Function de registro (emails sintéticos)
```

### Autenticación

Login por **usuario o email**: el RPC `email_for_login(identifier)` resuelve el
email real y luego se llama a `signInWithPassword`. Los registros por usuario crean
un email sintético `{username}@traininglab.app` mediante el Edge Function `signup`
(con `email_confirm: true`). Funciones `SECURITY DEFINER` con `search_path` fijado:
`is_admin()`, `email_for_login()`, `handle_new_user()` (trigger), `set_updated_at()`.

### Wearables (preparado, no conectado)

[`src/lib/wearables.js`](src/lib/wearables.js) es el seam listo para integrar relojes
inteligentes (Apple Health, Google Fit, Garmin, Whoop). Define un contrato de provider
(`connect`/`disconnect`/`fetchMetrics`), una forma normalizada de métricas
(`WearableMetrics`) y un registro. La implementación concreta está **diferida a
propósito** — todavía no se importa desde la UI. Para activarlo: implementa un provider
y regístralo con `registerWearableProvider(...)`.

## Seguridad

- **RLS** activado en todas las tablas; políticas por rol vía `is_admin()`.
- **Storage**: lectura de media restringida; las URLs públicas sirven por
  `/object/public/` (los atletas renderizan media por URL guardada, sin listar el bucket).
- **CORS** del Edge Function restringido a `*.vercel.app` / `*.netlify.app` con fallback seguro.
- **Cabeceras**: CSP, HSTS, `X-Content-Type-Options`, `X-Frame-Options: DENY`,
  `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`.
- **Secretos**: la app solo usa la anon key (pública). La `service_role` key NO está
  en el repo; vive solo en el entorno del Edge Function en Supabase.

### Advertencias de advisors aceptadas (por diseño)

El security review de Supabase deja 5 avisos esperados:

1. `is_admin()` ejecutable por `anon`/`authenticated` — **requerido**: varias políticas
   RLS declaradas `TO public` lo evalúan durante el acceso a tablas. Revocarlo rompería RLS.
2. `email_for_login()` ejecutable por `anon` — **requerido** para el login por usuario
   antes de autenticarse.
3–4. Lecturas asociadas a lo anterior derivadas de las mismas políticas `TO public`.
5. Protección contra contraseñas filtradas **deshabilitada** — es un toggle de la
   config de Auth (no se cambia por SQL/migración). Recomendado activarlo en producción
   desde el panel de Supabase.

## Restricción del plan de entrenamiento — INTOCABLE

> El plan de entrenamiento de Andres es de larga data y **no se altera**.

No modifiques, renombres ni "optimices" el contenido de los datos del plan:
`F2_LOWER_EX`, `F2_UPPER_EX`, `F3_DAYS`, `F4_DAYS`, `F5_DAYS`, `F6_LIFT_EX`,
`F7_WEEK`, `F8_WEEK`, `DELOAD_WEEKS`, las constantes `*_PROG`, `genF6Weeks` y sus
objetos `*Science`, ni el array `PHASES`. No cambies ejercicios, series, repeticiones,
intensidades, porcentajes, cues, notas, textos de ciencia, trade-offs ni referencias.
**Solo el renderizado visual puede mejorarse**; los datos se quedan exactamente como están.
