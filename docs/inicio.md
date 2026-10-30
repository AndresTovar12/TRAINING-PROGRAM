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
| Atleta con usuario | tipo → cuenta → correo → nombre → entrenador → sobre → reloj → bienvenida |
| Coach con Apple o Google | tipo → oficio → entrena → equipo → repertorio → bienvenida |
| Coach con usuario | tipo → cuenta → correo → nombre → oficio → entrena → equipo → repertorio → bienvenida |
| Invitación con Apple o Google | sobre → reloj → bienvenida |
| Invitación con usuario | cuenta → correo → sobre → reloj → bienvenida |
| Ya tiene cuenta | «Usar usuario y contraseña» → «Entrar» (dos toques) |

Si Apple no da el nombre, sale también «¿Cómo te llamas?» después del tipo.

## Cada pantalla

- **tipo** («¿Qué vas a hacer?»): dos fotos grandes, «Entreno» y «Creo planes». Un toque y sigue. Después de Apple o Google dice «Hola, Mariana.» y arriba lleva **«Salir»** en vez de la flecha (cierra la sesión y vuelve a la puerta).
- **cuenta**: usuario y contraseña, con lo que falta dicho en vivo.
- **correo**, una pantalla en dos momentos:
  1. «¿Tu correo?» con «Mandar código» y «Crear cuenta sin correo». **La cuenta nace aquí** (`signup`, o `activar-invitacion` modo `activar` con invitación). El correo no queda como correo de la cuenta hasta confirmar el código (lote 1 de seguridad).
  2. «Escribe el código»: seis cajas; con los seis se confirma solo. Si no sirve, error en rojo y cajas vacías. «Lo confirmo después» sigue y lo recuerda en Mi perfil.
  «Crear cuenta sin correo» pregunta antes en una hoja («Si olvidas tu contraseña, te la da tu entrenador» / al coach: «nos la pides por mensaje»).
- **nombre** («¿Cómo te llamas?»).
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

- **Con usuario:** el inicio en modo `invitacion` crea la cuenta con `activar-invitacion` (modo `activar`): la cuenta de relleno que dejó el coach recibe el usuario y la contraseña, y queda con `inicio_paso = 'sobre'`. El correo escrito llega como `correo_pendiente` y se confirma con el código.
- **Con Apple o Google:** esa entrada crea una cuenta NUEVA. El link se guarda antes de salir (`marcas.js`) y, con la sesión de vuelta, `App.jsx` llama a `activar-invitacion` en modo `reclamar`: la de relleno sale de la lista del coach (antes, para no chocar con su tope de atletas), la nueva queda con el coach, su nombre si Apple no lo dio, `perfil_completo` e `inicio_paso = 'sobre'`, y pasan a ella los planes, rutinas, equipo, notas, mensajes, umbrales y videos que el coach ya le había hecho. Si falla a la mitad, se puede repetir.

## Cómo probarlo

- `npm run check` (la prueba de humo entra por la puerta: «Usar usuario y contraseña»).
- En el navegador, con la App real y una sesión falsa (página local, no se sube): `qa-reloj.html?vista=puerta&reloj=si` (`reloj=no` sin Apple Watch, `web=1` como la web, `invitacion=tok` con invitación, `coachGoogle=1` para el coach). Contraseña que entra: `Entrena2026`; código que sirve: `482913`; código de entrenador: `CV2026`.
- En el iPhone (no se puede en el navegador): la puerta sin Google, Apple de verdad, la hoja de Salud sin reloj, el código ofrecido arriba del teclado, y la bienvenida con la barra del iPhone en blanco.
