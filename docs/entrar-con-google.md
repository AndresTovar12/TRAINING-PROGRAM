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

## Qué pasa cuando alguien entra con Google

Google solo entrega **correo y nombre**. Con eso no alcanza para abrir una
cuenta aquí: falta el nombre de usuario (es con lo que un atleta encuentra a su
entrenador) y falta saber si viene a seguir un plan o a crearlos. Así que:

1. Supabase crea la cuenta con el correo de Google.
2. El disparador `handle_new_user` arma un perfil **incompleto**
   (`perfil_completo = false`) y le pone un usuario provisional sacado del
   correo, limpio y sin chocar con uno que exista: si `andres` está tomado,
   queda `andres2`.
3. La app NO lo deja entrar todavía: le enseña la pantalla **"Hola, …"**, que
   pregunta lo que falta —qué va a hacer aquí, su oficio si crea planes, su
   usuario, quién lo entrena y los videos de técnica— y no se puede saltar.
   Tiene una salida, "Entré con la cuenta equivocada", por si se equivocó de
   cuenta de Google.
4. Al terminar, la base guarda todo de una sola vez con `completar_mi_perfil`.
   Esa función valida el usuario, comprueba que no esté tomado, resuelve al
   coach por su nombre de usuario y marca el perfil como completo.

**`completar_mi_perfil` solo corre UNA vez por cuenta.** Después, quien cambia
un rol es el master y nadie más: no es una puerta de atrás para volverse coach.

Quien se registra por el formulario de siempre nunca ve esa pantalla — ese
formulario ya pregunta todo, así que la función `signup` marca el perfil como
completo desde el principio.

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
