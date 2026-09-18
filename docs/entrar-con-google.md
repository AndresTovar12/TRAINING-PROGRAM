# Encender "Continuar con Google"

El botón ya está programado. Sale en la pantalla de entrada **solo cuando
existen las llaves**; mientras tanto no se dibuja, a propósito: un botón que
falla asusta más que uno que no está.

Son cinco pasos. Los tres primeros son en Google, los dos últimos en Supabase y
en Vercel. **Nada de esto lo puedo hacer yo: hay que entrar con tu contraseña.**

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
   - Nombre de la aplicación: `Training Lab`
   - Correo de asistencia: el tuyo
   - Datos de contacto del desarrollador: el tuyo
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

- Supabase crea la cuenta con el correo de Google.
- El disparador `handle_new_user` le arma el perfil y le pone un **usuario**
  sacado de su correo, limpio (solo letras, números y guión bajo) y sin chocar
  con uno que ya exista: si `andres` está tomado, queda `andres2`.
- Entra como **atleta**. Para volverlo coach hay que cambiarle el rol desde la
  cuenta master, igual que hoy.
- Puede cambiarse el usuario y el nombre desde **Mi perfil**.

## Si algo falla

| Lo que sale | Qué pasó |
|---|---|
| `redirect_uri_mismatch` | La URI del paso 3.4 no coincide. Revísala carácter por carácter. |
| `access_blocked` / "no verificada" | Tu correo no está en **Usuarios de prueba** (paso 2.5), o falta publicar la app. |
| El botón no aparece | Falta `VITE_GOOGLE_LOGIN=1`, o falta volver a desplegar. |
| Entra pero se queda cargando | Google está encendido en Supabase pero sin llaves, o con el secreto mal pegado. |

## Para apagarlo

Quita `VITE_GOOGLE_LOGIN` en Vercel y vuelve a desplegar. El botón desaparece y
nadie más puede entrar por ahí; las cuentas ya creadas siguen funcionando con
su correo y contraseña (pueden pedir "olvidé mi contraseña" para ponerse una).
