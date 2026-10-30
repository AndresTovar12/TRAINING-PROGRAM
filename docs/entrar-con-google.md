# Encender "Continuar con Google"

El botón ya está programado. Sale en la pantalla de entrada **solo cuando
existen las llaves**; mientras tanto no se dibuja, a propósito: un botón que
falla asusta más que uno que no está.

Son seis pasos. Los tres primeros son en Google, dos en Supabase y el último en
Vercel. **Nada de esto lo puedo hacer yo: hay que entrar con tu contraseña.**

---

## 1. Crear el proyecto en Google Cloud

1. Abre **https://console.cloud.google.com/**
2. Arriba a la izquierda, junto al logo, hay un selector de proyecto. Tócalo →
   **Proyecto nuevo**.
3. Nombre: `Training Lab`. → **Crear**.
4. Espera unos segundos y asegúrate de que el selector de arriba ya diga
   "Training Lab".

## 2. La pantalla de consentimiento

Es lo que la gente ve cuando Google le pregunta si deja entrar a tu app.

1. Menú (☰) → **APIs y servicios** → **Pantalla de consentimiento de OAuth**.
2. Tipo de usuario: **Externo** → **Crear**.
3. Llena solo lo obligatorio:
   - **Nombre de la aplicación: `Training Lab`** ← IMPORTANTE, ver abajo
   - Correo de asistencia: el tuyo
   - Datos de contacto del desarrollador: el tuyo

   > **Esto es lo que sale en las pantallas de Google.** Si lo dejas vacío,
   > Google enseña la dirección cruda del servidor —
   > "Ir a ozwqqzrkgunrgxxwxmop.supabase.co", "Google permitirá que
   > ozwqqzrkgunrgxxwxmop.supabase.co acceda a…" — y eso se lee como una
   > estafa. Con el nombre puesto dice "Training Lab".
   >
   > En el SELECTOR de cuenta ("Elige una cuenta · Ir a…") Google a veces sigue
   > enseñando el dominio aunque el nombre esté puesto, porque el dominio es de
   > Supabase y no tuyo. Quitarlo del todo necesita un **dominio propio**
   > conectado a Supabase (es de paga, y es el mismo dominio que hace falta para
   > los videos). Es cosmético: el acceso funciona igual.
4. **Guardar y continuar** en las tres pantallas siguientes, sin tocar nada más.
5. Al final, en **Usuarios de prueba**, agrega tu propio correo. (Mientras la
   app esté "en pruebas", solo entran los correos de esa lista. Cuando quieras
   abrirla a todos, en esa misma pantalla hay un botón **Publicar aplicación**.)

## 3. Crear el cliente de OAuth y COPIAR LAS DOS LLAVES

1. **APIs y servicios** → **Credenciales** → **Crear credenciales** →
   **ID de cliente de OAuth**.
2. Tipo de aplicación: **Aplicación web**.
3. Nombre: `Training Lab web`.
4. En **URI de redireccionamiento autorizados** → **Agregar URI**, y pega
   exactamente esto:

   ```
   https://ozwqqzrkgunrgxxwxmop.supabase.co/auth/v1/callback
   ```

   > Esa dirección es de Supabase, no de la app. Google le devuelve la persona a
   > Supabase, y Supabase a Training Lab. Si la escribes mal, el error sale
   > hasta el final y dice "redirect_uri_mismatch".

5. **Crear**. Sale un cuadro con dos textos largos:
   - **ID de cliente** (termina en `.apps.googleusercontent.com`)
   - **Secreto del cliente**

   Cópialos. El secreto **no se vuelve a mostrar completo**: si lo pierdes, se
   genera otro y hay que repetir el paso 4.

## 4. Pegarlas en Supabase

1. Abre **https://supabase.com/dashboard** → proyecto **training-lab**.
2. Menú izquierdo: **Authentication** → **Providers** (o "Sign In / Providers").
3. Busca **Google** en la lista y ábrelo.
4. Enciende el interruptor **Enable Sign in with Google**.
5. Pega el **ID de cliente** en `Client ID` y el **Secreto** en `Client Secret`.
6. **Save**.

## 4b. Decirle a Supabase A DÓNDE devolver a la gente

**Sin este paso, entrar con Google termina en una pantalla de `localhost` que
no abre.** Pasó de verdad el 18 sep 2026. Supabase solo devuelve a direcciones
que estén en su lista; si la que manda la app no está, usa la "Site URL", que de
fábrica es localhost.

1. En Supabase: **Authentication** → **URL Configuration**.
2. **Site URL**: `https://training-program-kappa.vercel.app`
3. **Redirect URLs** → **Add URL**, una por una:

   ```
   https://training-program-kappa.vercel.app
   https://training-program-kappa.vercel.app/**
   http://localhost:5173
   http://localhost:5173/**
   ```

   Las dos de localhost son para probar en tu Mac. Las de `/**` dejan volver a
   cualquier pantalla dentro de la app, no solo a la portada.
4. **Save**.

## 5. Encender el botón en la app

El botón se dibuja con una variable de entorno. En Vercel:

1. **https://vercel.com/** → proyecto de Training Lab → **Settings** →
   **Environment Variables**.
2. **Add New**:
   - Key: `VITE_GOOGLE_LOGIN`
   - Value: `1`
   - Environments: marca **Production**, **Preview** y **Development**.
3. **Save**.
4. Pestaña **Deployments** → en el último, menú (···) → **Redeploy**.
   (Las variables se leen al compilar: sin volver a desplegar, el botón no sale.)

Para probarlo en tu Mac, en la carpeta del proyecto, en el archivo `.env.local`:

```
VITE_GOOGLE_LOGIN=1
```

y reinicia `npm run dev`.

---

## Google en la app de iPhone (30 oct 2026)

En la app del iPhone NO se usa la página de Google: Google bloquea su entrada dentro de una app (`disallowed_useragent`) y no regresa a
`capacitor://localhost`. Se usa la hoja de Google del propio iPhone (complemento `@capgo/capacitor-social-login`, igual que Apple), que da una
identidad (`idToken`) y Supabase la cambia por una sesión (`signInWithIdToken`), con un *nonce* (Google guarda su huella SHA-256 y Supabase la compara).

Lo que se configuró (proyecto de Google Cloud `training-lab-web`, ya **En producción**):
1. Un cliente OAuth tipo **iOS** («Training Lab iPhone», paquete `com.traininglabapp.app`). Su ID va en `src/contexts/AuthContext.jsx`
   (`GOOGLE_IOS_CLIENT_ID`) y, al revés (`com.googleusercontent.apps.…`), en `ios/App/App/Info.plist` (`CFBundleURLSchemes`).
2. El ID del cliente **web** va como `iOSServerClientId`: es a quién va dirigida la identidad, y es el que Supabase ya acepta.
3. `capacitor.config.json` → `SocialLogin.providers.google: true` (con `false` el complemento no trae Google Sign-In).
4. En la app del iPhone el botón sale siempre (`googleDisponible`); en la web sigue dependiendo de `VITE_GOOGLE_LOGIN`.

Si Supabase rechaza la identidad («Unacceptable audience»): en Authentication → Providers → Google, en **Client IDs**, agregar también el ID del
cliente iOS, separado por coma.

## La puerta (inicio nuevo, 30 oct 2026)

En el teléfono, la primera pantalla de quien no tiene sesión es **la puerta**
(`src/features/auth/Puerta.jsx`): un mosaico de fotos que se mueve despacio, la
marca, «Entrena con propósito.» y tres salidas, en este orden:

1. **Continuar con Apple** (negro). Sale siempre.
2. **Continuar con Google** (blanco, con su orilla fina). Solo si
   `VITE_GOOGLE_LOGIN` vale `1` (`googleDisponible`). En el iPhone, Google es
   una fase aparte: hasta entonces la puerta solo enseña Apple.
3. **Usar usuario y contraseña**: abre «Entra con tu usuario» (el formulario de
   siempre, con el estilo nuevo). Desde ahí, «¿Nueva aquí? Crea tu cuenta» abre
   el inicio con usuario y contraseña.

Con Apple o Google se **entra o se crea la cuenta con el mismo botón**. En la
compu, la página de presentación sigue igual; sus «Iniciar sesión» y «Crear
cuenta» abren la puerta en una tarjeta centrada.

El link de invitación de un entrenador abre la misma puerta, con quién invitó
arriba («Carlos Vega te invitó · ya te tiene en su lista») y un tercer botón
«Crear cuenta con usuario y contraseña». Ver `docs/inicio.md`.

## Qué pasa cuando alguien entra con Google (o Apple)

Google y Apple solo entregan **correo y nombre** (Apple, a veces ni el nombre).
Con eso no alcanza: falta saber si viene a seguir un plan o a crearlos. Así que:

1. Supabase crea la cuenta con ese correo.
2. El disparador `handle_new_user` arma un perfil **incompleto**
   (`perfil_completo = false`) y le pone un usuario provisional sacado del
   correo, limpio y sin chocar con uno que exista: si `andres` está tomado,
   queda `andres2`.
3. La app abre el inicio en modo `google`: «Hola, Mariana.» y **«¿Qué vas a
   hacer?»** (Entreno / Creo planes). Arriba, en vez de la flecha, **«Salir»**:
   cierra la sesión y regresa a la puerta («Cerraste sesión. Puedes entrar con
   otra cuenta.»), por si entró con la cuenta equivocada.
4. Al contestar, `completar_mi_perfil` guarda el tipo de cuenta (solo corre UNA
   vez por cuenta) y el inicio sigue con lo que le toca: el atleta, su
   entrenador, «Sobre ti» y Salud; el coach, su oficio, qué entrena, su equipo
   y sus ejercicios. Nada se teclea.
5. En la bienvenida dice «Entras con Google como @usuario · Cambiar»: el
   usuario provisional se cambia ahí mismo (la hoja de Mi perfil).

**`completar_mi_perfil` solo corre UNA vez por cuenta.** Después, quien cambia
un rol es el master y nadie más: no es una puerta de atrás para volverse coach.

**Con invitación**, la cuenta que crean Apple o Google es NUEVA (no la que el
coach dejó lista). Al volver, la app llama a `activar-invitacion` en modo
`reclamar`: la cuenta nueva se queda con su coach, con lo que él ya le preparó
(planes, mensajes, equipo…) y con el nombre que puso el coach si Apple no dio
uno; la de relleno sale de su lista. Detalle en la función.

Quien se registra con usuario y contraseña nunca pasa por «¿Qué vas a hacer?»
con sesión: lo contesta antes de crear la cuenta, y la función `signup` marca
el perfil como completo desde el principio.

## Si algo falla

| Lo que sale | Qué pasó |
|---|---|
| `redirect_uri_mismatch` | La URI del paso 3.4 no coincide. Revísala carácter por carácter. |
| `access_blocked` / "no verificada" | Tu correo no está en **Usuarios de prueba** (paso 2.5), o falta publicar la app. |
| El botón no aparece | Falta `VITE_GOOGLE_LOGIN=1`, o falta volver a desplegar. |
| Entra pero se queda cargando | Google está encendido en Supabase pero sin llaves, o con el secreto mal pegado. |
| **Termina en `localhost` y Safari dice que no pudo conectarse** | Falta el paso 4b: la dirección de la app no está en las Redirect URLs de Supabase, así que te devuelve a la Site URL de fábrica. |
| Sale el dominio `…supabase.co` en vez de "Training Lab" | Falta el **Nombre de la aplicación** del paso 2.3. |

## Para apagarlo

Quita `VITE_GOOGLE_LOGIN` en Vercel y vuelve a desplegar. El botón desaparece y
nadie más puede entrar por ahí; las cuentas ya creadas siguen funcionando con
su correo y contraseña (pueden pedir "olvidé mi contraseña" para ponerse una).
