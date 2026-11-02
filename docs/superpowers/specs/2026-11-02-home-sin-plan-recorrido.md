# Home sin plan: el mismo esqueleto que con plan, y el recorrido de la primera vez

**Modelo:** Sonnet 5.5, esfuerzo alto. Es trabajo de pantallas sobre piezas que ya existen.
**Un commit sobre main.** Maqueta aprobada: artifact 6uAsYxiGLPzfVdWNw5SSxC (la versión «Propuesta, sin plan», con el recorrido).

## Parte 1. El Home de quien no tiene plan (`NoPlanState` en `src/features/training/TrainingApp.jsx`)

**La idea:** el Home sin plan usa las mismas piezas que el Home con plan, en el mismo orden. Solo cambia lo que dice cada una. Cuando la persona recibe un plan, su Home no cambia de forma.

**El orden, de arriba a abajo:**

1. **Saludo** (`Saludo`), igual que hoy.
2. **Tira de la semana** (`TiraDeSemana`), la misma del Home con plan.
   - Cada día lleva su palomita si ese día hizo un entreno libre (de `lib/semanaLibre.js`).
   - Hoy va marcado como con plan. Los días no se tocan: sin plan no hay nada que abrir.
3. **La tarjeta azul «Tu plan»**, con la misma forma que «Hoy te toca» (el `Marco` de `HoyTeToca.jsx`), etiqueta «Tu plan».
   - **Sin coach:**
     - Título: «Todavía no tienes plan».
     - Debajo: «Encuentra uno hecho por un coach.»
     - Botón blanco «Buscar un plan»: abre Explorar.
     - Enlace abajo, en blanco: «¿Ya tienes coach? Pon su código ›». Abre Mi perfil → Mi equipo, donde se pone el código (lo mismo que hoy hace el renglón de `EmpiezaAqui`).
   - **Con coach y sin plan todavía:** solo lo de `TeEstaArmando` dentro de la tarjeta: su foto o iniciales, «Carlos te está armando tu plan» y «Te avisamos cuando esté listo.» Sin botón.
   - Esta tarjeta no tiene botón para entrenar. Entrenar es el punto de «Registrar» y el cuadrito «Libre».
4. **Los atajos, los mismos del Home con plan:**
   - La franja de Salud (`FranjaDeSalud`).
   - Debajo, los cuadritos (`Cuadrito`), en este orden: «Libre», «1RM», «Demos» y «Stickers». «Demos» sale solo si hay demos (como hoy «Demo workout»). «1RM» no sale a un paciente de fisio, como con plan.
5. **«Tus entrenos»** (`EntrenoLibre variante="historial"`), solo cuando ya hay alguno.
6. **Lo que ya existe y se queda abajo:** las bibliotecas de clases compradas (`TarjetaDeBiblioteca`) y los avisos de compra (`AvisosDeCompra`).

**Se quitan del Home sin plan:**
- La tarjeta «Empieza aquí» (`EmpiezaAqui`). Sus renglones ya están cubiertos: registrar es el punto de abajo, el código del coach está en la tarjeta azul, y Salud y «Sobre ti» ya se piden en el inicio.
- La tarjeta azul «Entrena hoy, aunque no tengas plan» (`HeroDeEntrenar` en `variante="completa"`).
- La tarjeta de Explorar (`TarjetaDeExplorar`) en el Home. Ahora es el botón «Buscar un plan».
- El cuadro grande de Salud (`CuadroDeSalud`) y los cuadros blancos (`CuadroBlanco`) de Demo workout y 1RM.

**Qué no tocar:** el Home con plan; lo que ve un coach al mirar la app de su atleta (`soloLectura`); la pestaña «Entrenar» sin plan (`EntrenarSinPlan`).

## Parte 2. El recorrido de la primera vez

**Qué es:** un recorrido de 6 pasos sobre el Home sin plan.
- El fondo se pone oscuro y borroso: `rgba(9,12,28,.58)` con `backdrop-filter: blur(3px)`.
- Queda un hueco con esquinas redondas sobre la pieza que se explica, con un borde blanco que late.
- Un globo blanco señala la pieza con su flechita. Dice «N de 6», el título, el texto, puntitos de avance, «Saltar» y «Siguiente».
- El último paso solo tiene «Listo».

**Los pasos, en este orden y con estos textos exactos.** Cada pieza se marca con `data-recorrido="…"`:

1. **El punto de «Registrar»** de la barra de abajo (`registrar`).
   - Título: «Entrena y comparte».
   - Texto: «Corre, ve al gym, nada: empieza aquí. Al terminar, tu entreno se vuelve un sticker para tu historia de Instagram.»
2. **La pestaña «Explorar»** de la barra (`explorar`).
   - Título: «Explora planes».
   - Texto: «Programas hechos por coaches: tu primer Hyrox, un maratón, pilates y pesas. Elige uno y empieza.»
3. **La tarjeta azul «Tu plan»** (`plan`).
   - Título: «Tu plan».
   - Texto sin coach: «Cuando tengas un plan, aquí vas a ver lo que te toca cada día. Búscalo, o pon el código de tu coach.»
   - Texto con coach: «Aquí vas a ver lo que te toca cada día. {Nombre} te está armando tu plan; te avisamos cuando esté listo.»
4. **La tira de la semana** (`semana`).
   - Título: «Tu semana».
   - Texto: «Cada entreno que hagas se marca aquí, con su palomita.»
5. **La franja de Salud y los cuadritos, juntos** (`atajos`).
   - Título: «Tus atajos».
   - Texto: «Cómo te sientes, tu 1RM, workouts de prueba y los stickers de cada entreno.»
6. **El botón de la cuenta, arriba a la derecha** (`perfil`, el de `AccountMenu` en `App.jsx`).
   - Título: «Tu perfil».
   - Texto: «Tus datos, tu coach, tu Apple Watch y Apple Salud, y tus ajustes. Aquí también puedes volver a ver este recorrido.»
   - Botón «Listo».

**Cuándo sale:**
- **Una sola vez:** la primera vez que un atleta ve su Home sin plan, después de terminar el inicio (`inicio_paso` vacío).
- **Que ya lo vio** se guarda en su estado (`useStorage`, en `user_app_state`), no en el teléfono. Así no vuelve a salir en otro aparato.
- **No sale** a un coach, a quien mira la app de otra persona (`soloLectura`), ni a quien ya tiene plan.
- **«Saltar» cuenta como visto.**
- **En Mi perfil, un renglón «Ver el recorrido»** lleva al Home y lo vuelve a empezar desde el paso 1.

**Cómo se comporta:**
- **El hueco y el globo se recalculan** al cambiar el tamaño de la pantalla y al moverse la página.
- **Si una pieza está fuera de la pantalla,** la página baja hasta ella. La barra de abajo y el botón de la cuenta son fijos y no necesitan moverse.
- **El globo va debajo de la pieza si cabe;** si no, va arriba. La flechita apunta al centro de la pieza.
- **Si una pieza no existe,** ese paso se salta y el conteo («N de 6») se ajusta.
- **Mientras el recorrido está abierto,** tocar el fondo no hace nada. Solo funcionan los botones del globo. Escape lo cierra en la web.
- **Accesibilidad:**
  - El globo es un `role="dialog"` con el foco en «Siguiente».
  - Cada paso se anuncia (`aria-live`).
  - Con «Reducir movimiento», no hay animación del borde ni de los cambios de paso.

## Cómo probar

1. `npm run check` en verde.
2. En el iPhone, cuenta nueva sin coach: al terminar el inicio sale el recorrido, en orden y con los textos exactos. Al tocar «Listo» no vuelve a salir, ni al cerrar y abrir la app, ni en la web con la misma cuenta.
3. Cuenta nueva con coach (por código): la tarjeta azul dice «{Nombre} te está armando tu plan», sin botón, y el paso 3 usa su texto.
4. «Saltar» en el paso 2: no vuelve a salir. Mi perfil → «Ver el recorrido» lo empieza de nuevo.
5. Atleta sin plan que ya registró entrenos: palomitas en la tira y «Tus entrenos» abajo.
6. En una pantalla chica (iPhone SE) y una grande: el hueco cae exacto sobre cada pieza y el globo nunca se sale de la pantalla.
7. El Home con plan se ve igual que antes.

## Al terminar

- Actualiza `docs/inicio.md` con el recorrido y la nueva forma del Home sin plan.
- Commit: «Home sin plan: el mismo esqueleto que con plan, y el recorrido de la primera vez».
- Dime el hash y el número de build de TestFlight.
