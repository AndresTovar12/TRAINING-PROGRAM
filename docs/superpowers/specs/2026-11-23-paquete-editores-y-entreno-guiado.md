# Paquete de la maqueta: editores nuevos de sesión y el entreno guiado del atleta

**Origen:** Andrés (23 nov 2026). Parche construido y probado en la maqueta, aplicado TAL CUAL.

- Fuente: artifact privado `dd81cb1a-fc79-4e73-b508-f4af0e3d3dc2`, archivo `cambios.patch.txt`
  (`git diff --full-index --binary`), sha256 `2219ca1244563c2bbde0c0d050ad96315f79b7e815af9d1b57693e77083896e2`.
- Base: `4d982f5`. 79 archivos, +10 816 / −631. Se aplicó con `git apply -3` sin conflictos; los 79 archivos
  quedaron con el mismo hash de blob que trae el parche (idénticos a la maqueta).
- Reglas y decisiones: `docs/atleta-piezas.md`.

## Pasos fuera del código
1. Migraciones (solo agregan columnas a `exercises`):
   `supabase/migrations-pendientes/07_ficha_del_ejercicio.sql` (medida, carga_tipo) y
   `08_ficha_guiado_y_disciplinas.sql` (guiado, duracion_s, disciplinas). Sin ellas, guardar un ejercicio falla.
2. Desplegar la función `mcp` (cambian `app/clases.js`, `lapsos.js`, `medidas.js`, `misPlanesDatos.js` y `plan.ts`).

## Qué trae
- Editores del coach: Running/Cycling/Swimming/Triatlón en lista de piezas (`EditorDeCorrer`, `day.tramos`);
  Híbrido en cadena de Sets (`EditorHibrido`, `day.hibrido.sets`); Deporte (`EditorDeDeporte`, `day.deporte`);
  Clase (`EditorDeClase`, `day.clase` y `day.claseExtra`); calentamiento en Gym (`day.calentamiento`); la ficha del
  ejercicio con Disciplinas, Unidad y Peso o intensidad; buscador por Disciplina.
- Atleta en el entreno guiado (`lib/entreno.js`, `lib/pasosDeLaLista.js`, `lib/hibridoAlAtleta.js`): cada paso dice
  su pantalla (`lib/caraDelPaso.js`: negra, «de lejos», video guiado, Gym, reloj de Set); «Serie 1 de 3»; una sola
  pieza de «en qué vas» (`EnQueVas.jsx`); regla 19 (tras descanso con tiempo arranca solo; si no, «Empezar»);
  límite sin GPS en vivo; Híbrido traducido a Sets de Gym; Deporte con Ejemplo y Explicación; Clase con
  «Iniciar entreno»; el color de la sesión en todo el entreno; la página del final cuenta los pasos que no son de Gym.

## Solo en teléfono real
YouTube dentro de la app en iPhone (error 153); sonidos con la pantalla bloqueada; ritmo y metros con GPS real;
«Llegué» con la mano mojada; video «de lejos» que arranca solo y sin sonido en iPhone.

## Pendiente conocido (NO arreglar todavía)
- Página del final: un tipo sin ícono propio (p. ej. «Yoga») sale con el ícono de una pesa.
- El Apple Watch no sabe lo nuevo (Empezar desde la muñeca, «Sprint 1 de 4», el límite en vivo, Deporte y Clase): paquete aparte.
