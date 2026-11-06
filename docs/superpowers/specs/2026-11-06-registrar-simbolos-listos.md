# Registrar: los símbolos ya están listos cuando se abre la hoja

**Modelo:** Sonnet 5.5, esfuerzo alto.

Un commit sobre main. Al abrir «¿Qué vas a hacer?» por primera vez, cada renglón enseña un instante la etiqueta genérica (el `Tag` de lucide) y luego todos los símbolos cambian de golpe: el catálogo de íconos (`lib/iconosDeTipo.datos.js`, ~95 KB) se pide hasta que un `IconoDeTipo` lo necesita.

1. Precarga: en `EntrenoLibre` y en `ResumenLibre`, al montar, llama `cargaCatalogo()` (de `@/lib/iconosDeTipo`) ignorando el error. Así, cuando la persona toca el botón, el catálogo ya está.
2. Sin etiqueta falsa: `IconoDeActividad` pasa a `IconoDeTipo` un `alternativo` que dibuja una caja vacía del mismo tamaño (un `span` sin nada). Mientras el catálogo baja no aparece ningún dibujo equivocado y los renglones no se mueven.
3. Prueba: con el catálogo retrasado, al abrir la hoja no hay ningún `svg.lucide-tag` en la lista, y al llegar el catálogo salen los símbolos sin que cambie la altura de los renglones.

Commit: «Registrar: los símbolos ya están listos al abrir la hoja».
