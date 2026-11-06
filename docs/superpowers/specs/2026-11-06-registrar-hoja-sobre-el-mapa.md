# Registrar: la hoja se abre sobre el mapa y se cierra deslizando

**Modelo:** Opus 5.5, esfuerzo alto. Un commit sobre main.

Andrés grabó la hoja «¿Qué vas a hacer?» en su iPhone (build 92, 6 nov 2026) y vio tres fallas. Las tres se comprobaron cuadro por cuadro.

## Lo que pasa hoy

1. **Al abrir, dos destellos.** Antes de que la hoja suba: el mapa se pone negro (~0.03 s), la pantalla se pone blanca con los botones flotando (~0.05 s) y luego aparece Home detrás de la hoja.
2. **Al cerrar, el mapa se vuelve a crear.** La hoja desaparece de golpe, se ve la pantalla oscura vacía 0.25 a 0.4 s, y el mapa regresa sin edificios y girado; tarda ~0.6 s en acomodarse.
3. **No se cierra deslizando.** La asita es solo un dibujo. Solo cierra la X o tocar la franja de arriba.

La causa de 1 y 2, en `src/features/libre/EntrenoLibre.jsx`: la hoja y la pantalla del mapa comparten el estado `hoja` (`'elegir'` o `'cronometro'`), así que al abrir la hoja se desmonta `PantallaDeCarrera` y el mapa nativo se destruye; al cerrar se crea otro.

## Qué hacer

1. **La hoja se abre encima del mapa, sin quitarlo.** Cuando se abre desde la pantalla «listo para empezar» (el botón de la actividad), `PantallaDeCarrera` sigue montada debajo y el mapa nativo no se destruye ni se crea. Arriba de la hoja se ve el mapa oscurecido por el velo. Al cerrar o al elegir otra actividad, el mapa sigue ahí: sin negro, sin blanco, sin giro.
   - Al elegir otra actividad con mapa, el mismo mapa sigue vivo. Al elegir una sin mapa, pasa lo de hoy.
   - Abierta desde otros lados (Entrenar → «Todas las actividades», el resumen → «Cambiar la actividad»), detrás se ve esa pantalla, como hoy.
2. **Se cierra deslizando hacia abajo.**
   - Desde la asita y la cabecera, siempre. Desde la lista, solo cuando ya está hasta arriba y el dedo va hacia abajo; si no, la lista se desliza normal.
   - La hoja sigue al dedo. Al soltar: se cierra si bajó más de una cuarta parte de su alto o si el gesto fue rápido; si no, regresa a su lugar.
   - El velo se aclara conforme baja.
   - Mientras se crea o se edita una actividad, deslizar NO cierra (misma regla que tocar fuera hoy): no se pierde lo escrito.
   - Vale también para «¿Cómo te mueves?».
3. **Al cerrar, baja con animación** (~0.2 s) con la X, tocando fuera, deslizando y al elegir. Respeta `prefers-reduced-motion`.

## Qué no tocar
- El GPS, la pausa automática, la cámara del mapa y sus botones.
- El contenido de la hoja (lista, buscador, símbolos).

## Pruebas
1. Con el puente falso del mapa nativo: abrir y cerrar la hoja 3 veces desde «listo para empezar» → 0 mapas creados y 0 destruidos de más.
2. Cuadro por cuadro al abrir y al cerrar: ningún cuadro negro ni blanco; detrás de la hoja se ve el mapa.
3. Deslizar: desde la asita cierra; un jalón corto regresa; con la lista a media altura, desliza la lista y no cierra; creando una actividad no cierra.
4. `npm run check` en verde (salvo el smoke del atleta por `zz_qa_pac`).
5. Lo que no se pueda probar sin iPhone, dilo.

Commit: «Registrar: la hoja se abre sobre el mapa y se cierra deslizando».
Dime el hash y el número de build de TestFlight.
