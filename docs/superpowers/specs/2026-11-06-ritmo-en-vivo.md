# Ritmo en vivo: con los puntos del GPS, no con la velocidad del iPhone

**Modelo:** Sonnet 5.5, esfuerzo alto.

El bug (Andrés, 6 nov 2026, corriendo con Training Lab y Aura a la vez, capturas de la pantalla bloqueada): la distancia coincidió con Aura (1.32 km contra 1.29 km en el mismo tramo), pero el ritmo de Training Lab marcaba 5:58, 6:17 y hasta 6:25 /km cuando iba a 5:00 /km (tiempo ÷ distancia del tramo). Aura marcaba 4:45 a 5:07. Al final, el promedio sí salió bien, porque se calcula con tiempo ÷ distancia.

La causa, en src/lib/ubicacion.js, enVivo(): `ritmoSKm` sale de la mediana de `vel` (la velocidad que da CoreLocation) de los últimos 10 s (SEGUNDOS_RITMO). Esa velocidad va aparte de los puntos y en esta carrera salió baja casi siempre. La distancia, en cambio, se suma con los puntos (`dist`), y esa estuvo bien.

Qué hacer:
1. En enVivo(), el ritmo de ahora sale de los puntos, como ya hace el camino sin velocidad (la web): la distancia de la ruta en los últimos 20 s entre esos segundos. Toma el punto más viejo que esté a 20 s o más de la última muestra (hasta 30 s); si avanzó menos de 15 m, `null` (parado). Usa `dist` de las muestras, que ya excluye los puntos parados.
2. Suavízalo: el ritmo que se muestra es la mediana de los últimos 3 cálculos (uno por punto). Así no brinca con un punto malo y tampoco se queda pegado.
3. La velocidad del iPhone (`vel`) deja de usarse para el ritmo. Se queda para lo que ya hace en la pausa automática y en la ruta.
4. SEGUNDOS_RITMO se va; en su lugar, VENTANA_RITMO_S = 20 y MINIMO_RITMO_M = 15, exportadas, en un solo lugar.
5. Lo mismo llega a la pantalla, a la tarjeta de la pantalla bloqueada (EntrenoLiveActivity) y al reloj, porque todos leen `vivo.ritmoSKm`. Comprueba que no haya otro cálculo de ritmo por su lado.
6. Pruebas, en scripts/prueba-ruta.mjs:
   - La traza sintética de correr parejo (3.3 m/s): el ritmo en vivo da entre 4:58 y 5:08 /km en todos los puntos después del segundo 25.
   - Una traza con `vel` un 15 % más baja que el avance real (como pasó hoy): el ritmo sigue dando 5:03, no 5:58.
   - Al parar (detenerse-de-golpe): el ritmo pasa a `null` en menos de 25 s y vuelve al reanudar.
   - Si Andrés manda la traza real de hoy, agrégala a scripts/trazas y comprueba que el ritmo quede entre 4:50 y 5:15 en los tramos corriendo.
7. npm run check en verde. Actualiza docs/entreno-y-reloj.md: el ritmo en vivo sale de los puntos, igual que la distancia.

Commit: «Carrera: el ritmo en vivo sale de los puntos del GPS, como la distancia».
Dime el hash y el número de build de TestFlight.
