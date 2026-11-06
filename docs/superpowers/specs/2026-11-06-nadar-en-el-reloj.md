# Nadar en el Apple Watch: alberca (con su largo) o aguas abiertas

**Modelo:** Opus 5.5, esfuerzo alto.

Hoy (MedidorDelReloj.swift, ~línea 299): toda natación en el reloj es alberca de 25 m fijos (`swimmingLocationType = .pool`, `lapLength` 25). En una alberca de 50 m la distancia sale a la mitad, y aguas abiertas no existe. «Nadar» ahora lleva mapa (ver el ajuste anterior), pero en alberca el GPS mide mal: el reloj tiene que contar largos.

Qué hacer:
1. Al empezar «Nadar» en el reloj: «¿Dónde nadas?», con «Alberca» y «Aguas abiertas».
   - Alberca: elegir el largo: 25 m, 50 m u «Otro» (con la corona, de 10 a 100 m). Se recuerda el último. `swimmingLocationType = .pool` y `lapLength` el elegido. El reloj cuenta los largos. Sin GPS y sin mapa.
   - Aguas abiertas: `swimmingLocationType = .openWater`, con GPS y ruta (`HKWorkoutRouteBuilder`, como correr en el reloj). Con mapa en el resumen y en los stickers.
2. Al terminar, lo que llega al iPhone dice cuál fue: alberca (con su largo y los largos que hizo) o aguas abiertas (con la ruta).
3. En el iPhone no se pregunta nada: nadar va con mapa, como Strava.
4. Pruebas: los tres casos en un reloj de verdad si se puede (25 m, 50 m, aguas abiertas). Si no, dime qué no pudiste probar.

Commit: «Nadar en el reloj: alberca con su largo, o aguas abiertas con ruta».
Dime el hash y el número de build de TestFlight.

## Nota al construir (6 nov 2026)

El «ajuste anterior» no está en main: en `src/lib/actividades.js`, `natacion` sigue con `gps: false`. Para cumplir el punto 3, este commit también le pone mapa a Nadar en el iPhone.
