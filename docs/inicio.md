# El inicio: entrar y crear la cuenta

**Desde el 30 oct 2026** (prototipo `HUZVXJGnGrGaZeBq4e3wrv`, estilo «C · Al pulgar» y «Listo» azul). El prototipo manda en los textos, el orden y lo que sale en cada pantalla; el código, en colores, letras y piezas (`components/ui`, `lib/theme`).

## Las piezas

| Pieza | Archivo | Qué hace |
|---|---|---|
| La puerta | `src/features/auth/Puerta.jsx` | Primera pantalla sin sesión: mosaico de fotos, la marca, Apple, Google (si `googleDisponible`) y «Usar usuario y contraseña». |
| Entrar | `src/features/auth/AuthScreen.jsx` | Abre la puerta; «Usar usuario y contraseña» → «Entra con tu usuario» (con «¿Olvidaste tu contraseña?» y «¿Nueva aquí? Crea tu cuenta»). |
| Invitación | `src/features/auth/ActivarInvitacion.jsx` | La misma puerta, con quién te invitó. |
| Las preguntas | `src/features/inicio/Inicio.jsx` | Una pregunta por pantalla. Modos `nuevo`, `invitacion`, `google` y `retomar`. |
| El código del correo | `src/features/inicio/CajasDelCodigo.jsx` | Seis cajas sobre un campo de verdad (`autocomplete="one-time-code"`). Confirma con `confirmaCorreoConCodigo` (`lib/correoDeLaCuentaApi.js`), lo mismo que Mi perfil → Correo. |
| Los dibujos | `src/features/inicio/Dibujos.jsx` | El código con QR, el punto de «Registrar», las caras de un equipo, los videos de ejercicios. |
| La bienvenida | `src/features/inicio/Bienvenida.jsx` | La pantalla azul del final. |
| Lo que cruza pantallas | `src/features/inicio/marcas.js` | El correo al que se mandó el código, si entró por invitación, y el link de la invitación mientras va a Apple o Google. |
| Después | `src/features/training/home/EmpiezaAqui.jsx` y «Primeros pasos» (`AthletesPanel.jsx`) | Lo primero que ven el atleta sin plan y el coach. |

## El camino de cada persona

La barra de arriba cuenta solo los pasos de esa persona; la bienvenida no cuenta.

| Quién | Pasos |
|---|---|
| Atleta con Apple o Google | tipo → entrenador → sobre → reloj → bienvenida |
| Atleta con usuario | tipo → nombre → cuenta → correo → entrenador → sobre → reloj → bienvenida |
| Coach con Apple o Google | tipo → oficio → entrena → equipo → repertorio → bienvenida |
| Coach con usuario | tipo → nombre → cuenta → correo → oficio → entrena → equipo → repertorio → bienvenida |
| Invitación con Apple o Google | sobre → reloj → bienvenida |
| Invitación con usuario | cuenta → correo → sobre → reloj → bienvenida |
| Ya tiene cuenta | «Usar usuario y contraseña» → «Entrar» (dos toques) |

Si Apple no da el nombre, sale también «¿Cómo te llamas?» después del tipo.

## Cada pantalla

- **tipo** («¿Qué vas a hacer?»): dos fotos grandes, «Entreno» y «Creo planes». Un toque y sigue. Después de Apple o Google dice «Hola, Mariana.» y arriba lleva **«Salir»** en vez de la flecha (cierra la sesión y vuelve a la puerta).
- **nombre** («¿Cómo te llamas?»): nombre y apellido. Con usuario va ANTES de la cuenta (31 oct 2026): solo se recuerda y viaja a `signup` como `full_name`.
- **cuenta**: usuario y contraseña, con lo que falta dicho en vivo, y «Confirma tu contraseña» (si no coinciden, no deja seguir).
- **correo** y **verifica** («Escribe el código»), LA CUENTA NACE DESPUÉS DEL CÓDIGO (31 oct 2026, maqueta https://claude.ai/artifact/RcFd9dYXoYxzYAinD5eQDB). **Nadie entra sin confirmar su correo**: ya no existen «Crear cuenta sin correo» ni «Lo confirmo después». Hasta el código bueno **no existe ninguna cuenta**: la flecha de atrás regresa libre (código → correo → usuario y contraseña → nombre) y lo escrito se conserva, menos la contraseña, que vive solo en la memoria de la pantalla.
  1. «¿Tu correo?» con «Mandar código»: SOLO manda el correo (`correo-previo`, acción `pedir`). Antes comprueba que el usuario y el correo estén libres («Ese usuario ya existe» regresa al paso del usuario con el error; «Ese correo ya lo usa otra cuenta» se queda aquí). El botón gira con «Mandando el código…» y pasa directo a «Escribe el código». Si regresa y vuelve con el mismo correo, el código anterior sigue valiendo (14 min) y no se manda otro.
  2. «Escribe el código» (`verifica`): seis cajas; con los seis se comprueba solo (`correo-previo`, `confirmar`: 5 intentos). Recuadro azul «¿No lo ves? Revisa tu carpeta de Correo no deseado o Spam». «Mandar otro» (espera 60 s) · «Cambiar correo» (= la flecha). Abajo, «¿Problemas con el código?» con Apple y Google: no hay cuenta que borrar, simplemente se va por ahí (el tipo de cuenta o la invitación se recuerdan).
  3. Con el código bueno `correo-previo` entrega una **ficha** de un solo uso (atada a ese correo; solo se guarda su huella) y AHÍ nace la cuenta: `signup`, o `activar-invitacion` modo `activar`, piden la ficha (vale 20 min) y crean la cuenta con el correo REAL y ya confirmado, sin `correo_pendiente`. Mientras llega el perfil se ve «Creando tu cuenta…» (`CuentaEnCamino`), no la carga con el logo. Si algo falla al crearla (usuario ocupado, red), la persona corrige y sigue con la misma ficha sin otro código («Intentar otra vez»). La primera pantalla después del código (entrenador, u oficio para el coach) NO tiene flecha de atrás: no se cruza la pared hacia atrás.
  - **Servidor** (migración `supabase/migrations-pendientes/06_codigos_previos_de_correo.sql`, ya aplicada): tabla `codigos_previos` (una fila por correo; RLS sin políticas; solo huellas HMAC con la llave de servicio) y función `correo-previo` (sin sesión, con frenos: 1 envío por correo cada 60 s, 8 por correo al día, 20 envíos y 60 intentos por IP a la hora, la IP solo hecha huella; si el libro de frenos falla, NO deja pasar).
  - **Camino de antes, RETIRADO en el servidor** (31 oct 2026, tarde): `signup` y `activar-invitacion` ya NO crean ni activan nada sin la ficha de un código bueno (426 `APP_VIEJA`); solo el dueño con su sesión crea cuentas sin ficha (pruebas y coaches). Lo que queda en la app de ese camino (`modo === 'retomar'` con el paso `correo`, `correo-de-la-cuenta` pedir sin contraseña, `correoPorConfirmarDe`) ya no se usa: no quedan cuentas con `correo_pendiente`. Se puede quitar sin prisa.
  - **«Salir» después del código:** solo lo ve quien entró con Apple o Google (volver es un toque). Con usuario y contraseña no hay «Salir» en los pasos de después del código: la cuenta acaba de nacer y nadie recuerda la contraseña que puso hace dos minutos; los pasos que quedan se saltan («Entreno por mi cuenta», «Saltar», «Ahora no») y, si cierra la app, la sesión sigue y retoma en el mismo paso.
- **entrenador** («¿Entrenas con un entrenador?»): estilo C. «Sí, tengo su código» abre el campo del código, la tarjeta verde del entrenador encontrado y «Quedar con Carlos»; «No tengo código» regresa. «Entreno por mi cuenta» sigue.
- **sobre** («Sobre ti»): sexo (Mujer / Hombre / Prefiero no decir) y fecha de nacimiento. «Continuar» se enciende al elegir el sexo; «Saltar» no guarda nada. Guarda `genero` y `fecha_nacimiento`.
- **reloj**: Apple Watch, Apple Salud o (en la web) solo el aviso. Ver `docs/entreno-y-reloj.md`, sección 9.
- **oficio**, **entrena** (rejilla de dos columnas que cabe sin bajar), **equipo** y **repertorio** (estilo C): las del coach.
- **bienvenida**: azul, entra como la celebración de un entreno. El título lleva el género solo si lo dijo en «Sobre ti». Con entrenador enseña a su entrenador; por su cuenta, su primer entreno; al coach, nada (lo esperan sus «Primeros pasos»). Pastillas de lo que ya quedó. «Ir a mi app», y «Entras con Google como @usuario · Cambiar» (la hoja del usuario de Mi perfil).

`inicio_paso` apunta siempre a la pantalla que sigue: quien cierra a la mitad vuelve ahí. Quien se quedó a la mitad del inicio de antes sigue en la que la reemplazó (`codigo` → entrenador; `sexo`, `nacimiento`, `unidad` → sobre; `tour` → bienvenida).

## Después del inicio

- **Atleta sin plan:** «Empieza aquí» en su Home: «Registra tu primer entreno» (abre el punto), «¿Tienes entrenador?» (sin entrenador; abre Mi perfil → Mi equipo), «Conecta tu Apple Watch / Apple Salud» (en la app, sin conectar), «Completa «Sobre ti»» (sin sexo ni fecha). Lo que se hace con la tarjeta a la vista se tacha; sin nada pendiente, la tarjeta se va. Con entrenador y sin plan, arriba la tarjeta azul «Carlos te está armando tu plan».
- **Coach:** «Primeros pasos» es lo primero de su panel.
- **Ya no hay recorrido** (se quitaron `Recorrido.jsx`, `RecorridoOtraVez.jsx` y «Ver el recorrido otra vez» en Mi perfil).

## La invitación por dentro

- **Con usuario:** el inicio en modo `invitacion` (cuenta → correo → código) crea la cuenta con `activar-invitacion` (modo `activar`) DESPUÉS del código, con la ficha: la cuenta de relleno que dejó el coach recibe el usuario, la contraseña y el correo ya confirmado, y queda con `inicio_paso = 'sobre'`.
- **Con Apple o Google:** esa entrada crea una cuenta NUEVA. El link se guarda antes de salir (`marcas.js`) y, con la sesión de vuelta, `App.jsx` llama a `activar-invitacion` en modo `reclamar`: la de relleno sale de la lista del coach (antes, para no chocar con su tope de atletas), la nueva queda con el coach, su nombre si Apple no lo dio, `perfil_completo` e `inicio_paso = 'sobre'`, y pasan a ella los planes, rutinas, equipo, notas, mensajes, umbrales y videos que el coach ya le había hecho. Si falla a la mitad, se puede repetir.

## Cómo probarlo

- `npm run check` (la prueba de humo entra por la puerta: «Usar usuario y contraseña»).
- En el navegador, con la App real y una sesión falsa (página local, no se sube): `qa-reloj.html?vista=puerta&reloj=si` (`reloj=no` sin Apple Watch, `web=1` como la web, `invitacion=tok` con invitación, `coachGoogle=1` para el coach). Contraseña que entra: `Entrena2026`; código que sirve: `482913`; código de entrenador: `CV2026`.
- En el iPhone (no se puede en el navegador): la puerta sin Google, Apple de verdad, la hoja de Salud sin reloj, el código ofrecido arriba del teclado, y la bienvenida con la barra del iPhone en blanco.
