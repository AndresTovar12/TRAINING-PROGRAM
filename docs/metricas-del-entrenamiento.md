# Las métricas del entrenamiento (reloj → coach)

**Para quién es:** quien siga con la app descargable (HealthKit, atajos) o quiera tocar las pantallas de métricas. Dice qué se guarda, cómo se calcula cada número y cómo se prueba sin datos de nadie.

> Decisión de Andrés (10 oct 2026): para quitarle usuarios a TrainingPeaks y Strava, **el coach tiene que ver todas las métricas del entrenamiento, sobre todo las del Apple Watch** (pulso, ritmo, calorías, carga, recuperación). Entrada: **importar archivos** (sin pedir permisos a Strava ni Garmin). El coach ve las cuatro cosas: **detalle de cada entreno, resumen y tendencias, carga tipo TrainingPeaks y recuperación**, y tiene que **entenderse fácil**. Privacidad: **se comparte todo** (no hay interruptores por categoría).

## 1. Qué hay

| Pieza | Dónde | Qué hace |
|---|---|---|
| Lectores | `src/lib/metricas/leeFit.js`, `leeXml.js` (GPX y TCX), `leeAppleSalud.js`, `importa.js` | De un archivo del reloj a «entrenos crudos» con muestras (pulso, ruta, altura, cadencia, potencia). Todo en trozos, en un Worker. |
| Cuentas | `calculos.js`, `forma.js`, `derivados.js`, `construye.js` | Zonas, carga, vueltas por kilómetro, condición/fatiga/forma, recuperación. Puro: se prueba con Node. |
| Base | `src/lib/metricasApi.js` | Leer y guardar en Supabase (entrenos, series, recuperación diaria, umbrales). |
| Pantallas | `src/features/metricas/` | La hoja de métricas (Resumen · Entrenos · Carga · Recuperación), el detalle, la importación y los umbrales. |
| Entradas | `AthletesPanel.jsx` (coach: «Métricas del reloj» en la ficha) y `ProfileScreen.jsx` (atleta: «Mis métricas del reloj») | Las dos abren `MetricasDelAtleta` (carga perezosa: no pesa en el paquete principal). |

Pruebas: `node scripts/prueba-metricas-calculos.mjs`, `-forma.mjs`, `-lectura.mjs`, `-importa.mjs` (todas con archivos inventados).

## 1b. Salud diaria, «Por serie» y Fuerza (10 oct 2026, segunda vuelta)

Pedido de Andrés: lo que el atleta teclea «no es muy válido», así que **la salud diaria se llena con el reloj y el atleta solo anota el dolor**; y el coach quiere ver **cada serie y cada lapso** de un entreno.

| Pieza | Dónde | Qué hace |
|---|---|---|
| Salud diaria | `useRecuperacionReciente` (`src/lib/`), `recuperacionApi.js`, `TarjetaDeSalud` (`TarjetasDeHome.jsx`), `WellnessView` (`TrainingApp.jsx`) | Pulso en reposo, variabilidad cardiaca y sueño se leen de `recuperacion_diaria` (solo lectura, en voz del atleta: `lecturaParaElAtleta` en `forma.js`). Sin reloj la app **no los pide**: ofrece «Importar entrenos». Lo único que se anota es **«Dolor muscular»** (con pacientes de un fisio, «Dolor o molestia»); se guarda en la llave de siempre, `wr:wellness[día].soreness`. Quitados: motivación, fatiga y sueño anotado (lo viejo se queda en la cuenta, sin usarse). El conector de IA `anotar_bienestar` **sigue aceptando los cuatro campos** (se ajusta después). |
| Por serie y por lapso | `src/lib/metricas/porSerie.js` (puro), `PorSerie.jsx`, `useMetricas` | Junta el entreno guiado (`user_app_state`), los resultados de los Sets con reloj (`ventanas`, `lapsos`) y, si hay, el pulso del reloj de pulsera cortado en cada ventana (`pulsoEnVentana`). Une cada entreno del reloj con la sesión guiada que se hizo a la vez (`uneConActividades`: traslape de al menos la mitad de lo más corto). Una sesión guiada **sin** reloj sale en la lista como un entreno de origen `app` («Sin reloj»), con su «Por serie». |
| Fuerza | `src/lib/metricas/fuerza.js` (puro), `Fuerza.jsx` | Quinta pestaña (solo si hay series con peso): kilos de la semana contra la pasada **a la misma altura**, series cumplidas (hechas de hechas + saltadas), kilos por semana, **máximo estimado** por levantamiento (Epley, hasta 12 reps) y récords de los últimos 30 días. |

**De dónde sale cada número** (las etiquetas que Andrés aprobó, sin género): «Lo midió la app» (tiempo), «Lo midió el reloj» (pulso y lo que baja en el descanso), «Lo escribió a mano» (kilos/reps que el atleta cambió, calorías de una máquina) y «Dejó lo del plan» (tocó «Listo» sin cambiar nada: es lo que decía el plan, **no algo comprobado**). Salen de `hechos[clave].reps/kg` (solo viajan si el atleta cambió) contra `exercises[idx]` (que «Listo» llena con lo planeado).

**Reglas de las filas:** una serie solo trae su **duración** si antes hubo un descanso marcado (si no, el tiempo desde la anterior incluye todo lo que pasó en medio); su pulso, igual. «Bajó N» = el pico de la serie menos el pulso en los últimos 8 s del descanso. El ritmo de un lapso en metros sale del cronómetro de la app y la distancia que pedía el plan, no del GPS. Los puntos de las series reducidas promedian de 3 a 25 s: el máximo por ventana es el de esos promedios (un pico de un instante sale algo más bajo).

Quitado a propósito: **«qué tan duro estuvo, del 1 al 10»** (otro dato que teclear: saturación). La carga de un entreno sin pulso sigue estimada («≈»).

Pruebas: `node scripts/prueba-metricas-porserie.mjs`, `-fuerza.mjs` y las de siempre. Maqueta de lo que **solo se puede con la app instalable** (GPS, banda de pulso, Apple Watch directo, otros aparatos, máquinas Bluetooth, técnica por serie): `docs/maquetas/2026-10-10-lo-que-abre-la-app.html` (Artifact: https://claude.ai/artifact/6ehSqM8Tdhr9YFNudsjfDz).

## 2. La base (migraciones `metricas_del_entrenamiento` y `metricas_perfil_en_umbrales`)

| Tabla | Una fila es… | Lo importante |
|---|---|---|
| `actividades` | un entreno | `origen_clave` único por atleta (`t<inicio en s>-<duración>`): el mismo entreno por dos caminos no se repite. `desfase_min` = hora local de ese entreno respecto a UTC (el día de un entreno es **su** día local). `zonas_s` (5 enteros), `umbrales` (con cuáles se calculó), `carga` + `carga_metodo` (`pulso` o `estimada`), `vueltas` (las del reloj o los kilómetros), `metricas` (lo que no tiene columna), `sesion` (reservado para unir con el entreno guiado de la app). |
| `actividad_series` | las series de un entreno | JSON ≤ 1.5 MB (`check`): `t, fc, vel, alt, cad, pot, dist` con la **misma** lista de tiempos y la ruta aparte (`ruta: { t, lat, lon }`). Reducidas a puntos de ≤ 25 s: de ahí se vuelven a sacar zonas y carga. Solo se guardan las de los últimos 365 días. |
| `recuperacion_diaria` | un día de un atleta (PK `atleta_id + dia`) | `fc_reposo`, `hrv_ms` (+ `hrv_tipo`), sueño por etapas, pasos, kcal, VO₂ máx, SpO₂, respiración, peso. Se reescribe al volver a importar el mismo día (`upsert`). |
| `umbrales_atleta` | un atleta | Lo que escribieron (`fc_max`, `fc_reposo`, `fc_umbral`) y lo que el archivo supo y el perfil no (`fecha_nacimiento`, `genero`). Dos columnas más reservadas: `ritmo_umbral_s_km`, `ftp_w`. |

**Permisos (RLS, una sola política `*_acceso` por tabla):** el atleta ve y guarda lo suyo; lo ve y lo guarda quien lo atiende (`atiendo_a`: su coach **o** su equipo, p. ej. el fisio) y el master. Mismo criterio que `plans`. Los datos son del atleta.

## 3. Cómo se calcula

**Zonas** (`ZONAS`): por % del pulso máximo: Z1 < 60 %, Z2 60–70, Z3 70–80, Z4 80–90, Z5 > 90. Nombres en español (Recuperación, Aeróbica, Tempo, Umbral, Máximo).

**Umbrales** (`estimaUmbrales`; lo escrito siempre manda y se dice de dónde sale cada uno):
- `fc_max`: escrito → el más alto que se le ha visto *si pasa* de lo que dice la edad → `208 − 0.7 × edad` (Tanaka) → 190. «El más alto visto» es el que deja a un 10 % de entrenos por arriba (un sensor loco que marca 240 no arruina las zonas).
- `fc_reposo`: escrito → mediana de su reposo reciente → 60. `fc_umbral`: escrito → 89 % del máximo.
- La edad sale del perfil; si el perfil no la tiene, de lo guardado junto a los umbrales; si no, del archivo que se importa (Apple Salud trae fecha de nacimiento y sexo) y **se guarda** para que las zonas salgan igual al importar que al mirarlas después.

**Carga** (`cargaDePulso`): TRIMP de Banister sobre la reserva de pulso, llevado a escala «TSS»: **una hora justo en el umbral = 100**. Una hora fácil ≈ 35; una hora al máximo ≈ 150. Sin pulso: se **estima** por deporte y duración (`DEPORTES[x].cargaPorHora`) y se marca con «≈». Un hueco entre muestras de más de 30 s no cuenta.

**Condición, fatiga y forma** (`curvaDeForma`): promedios móviles exponenciales de la carga diaria (42 y 7 días); **forma = condición de ayer − fatiga de ayer**. Estados (`estadoDeForma`): > 25 *Mucho descanso* · 5 a 25 *En plena forma* · −10 a 5 *En equilibrio* · −30 a −10 *Entrenando fuerte* · < −30 *Sobrecarga*. Con condición < 8 no hay base: *Poco historial*. Aviso en pantalla si hay menos de 6 semanas de historia (la condición sale baja).

**Recuperación** (`resumenDeRecuperacion`): cada medida se compara con **lo normal de esa persona** (mediana de los 30 días anteriores a la última semana). «Atención»: reposo ≥ 3 lpm arriba · HRV ≥ 10 % abajo · sueño de 7 noches < 6.5 h. Una señal = *Atención*; dos o más = *Cuerpo cargado*. No es un diagnóstico: dice «conviene preguntarle cómo se siente».

**La semana en curso** se compara con la pasada **a la misma altura y sin contar hoy** (de lunes a ayer): comparar una semana a medias con una completa siempre diría «bajó».

**Vueltas por kilómetro** (`vueltasPorKm`): el tiempo sale de la distancia (de la ruta); el pulso de cada kilómetro se promedia con **todas** las muestras que lo traen (el Apple Watch da pulso y ruta en muestras distintas, desfasadas).

## 4. Importar (lo que entra y cómo)

| Entra | Cómo |
|---|---|
| `.fit` (Garmin, Polar, Suunto, COROS, Wahoo, Strava), `.gpx`, `.tcx` (solos, en ZIP o `.gz`) | Un entreno cada uno. FIT: la librería `fit-file-parser` se carga con `import()` solo cuando llega un `.fit`. |
| `export.zip` de Apple Salud | **Se lee en trozos de 4 MB** (el XML, en trozos de ~1 MB) sin descomprimirlo entero (un export grande pesa más de 1 GB y no cabe en la memoria de un teléfono): entrenos del Apple Watch con su pulso medido cada pocos segundos (se cruza el pulso del reloj con la ventana de cada entreno), la ruta (`workout-routes/*.gpx`) y, por día, reposo, HRV, sueño por etapas, pasos, calorías, VO₂, SpO₂, respiración y peso. Para exports enormes se elige el alcance (3 meses, 1 año, todo). |
| ZIP de Strava | Sus `.fit.gz`/`.gpx`/`.tcx.gz` y `activities.csv` (de ahí salen el nombre y el tipo). |

Pasos: elegir → **leer** (en un Worker; barra de avance; se puede cancelar) → **revisar** (cuántos entrenos nuevos, cuántos *ya estaban*, qué deportes, de qué día a qué día, qué archivos no se pudieron leer y por qué) → **guardar** (lotes de 20 entrenos, 4 series por lote, 200 días por lote). **Nada del archivo sube**: solo los resúmenes y las series reducidas. El mismo entreno que llega por dos caminos (reloj y Strava) se reconoce cuando las ventanas se encima en ≥ 70 % de la más corta.

Los errores se dicen con el nombre del archivo y el motivo en español, no con un número.

## 5. El contrato para la app descargable (HealthKit) — todavía no existe

Cuando exista la app nativa no hace falta tocar nada de lo de arriba: se le pasa a `guardaImportacion` lo mismo que devuelve `leeArchivos`:

```js
{ entrenos: [ /* «entrenos preparados»: salida de preparaEntreno(crudo) */ ],
  recuperacion: [ { dia: 'AAAA-MM-DD', fc_reposo, hrv_ms, hrv_tipo: 'sdnn', sueno_s, sueno_profundo_s, sueno_rem_s, sueno_despierto_s, pasos, kcal_activas, vo2max, spo2, frec_respiratoria, peso_kg } ],
  perfil: { fecha_nacimiento: 'AAAA-MM-DD', genero: 'm' | 'f' | null } }
```

Un entreno crudo es `{ formato, deporte, deporte_original, titulo, dispositivo, inicio (ms), fin (ms), desfase_min, duracion_s, movimiento_s, distancia_m, kcal_activas, resumen: { fc_media, fc_max, fc_min }, muestras: [{ t (s desde el inicio), fc, vel, alt, cad, pot, dist, lat, lon }] }`. Lo que el reloj no mide, no se manda. Deportes: `deportes.js` (`deporteDeApple`, `deporteDeFit`, `deporteDeTexto`). Con HealthKit: `HKWorkout` → entreno, `HKQuantityTypeIdentifierHeartRate` dentro de la ventana → `muestras.fc`, `HKWorkoutRoute` → `lat/lon/alt`. Lo del día (reposo, HRV, sueño) → `recuperacion`. La clave de «ya estaba» es `inicio + duración`, así que sincronizar dos veces no duplica.

## 6. Cómo probarlo sin datos de nadie

1. `node scripts/genera-demo-metricas.mjs <carpeta>` inventa 14 semanas de un corredor (`export.zip` de Apple Salud con ~85 entrenos y 97 días de recuperación, más un `.fit`, un `.gpx` repetido y un `.tcx`) con una historia: bloque fuerte al final, una gripe en la semana 7, y los últimos 5 días con el pulso en reposo subiendo. Misma semilla = mismos archivos.
2. Con el servidor de desarrollo corriendo y una **cuenta de pruebas** con sesión abierta: abrir la ficha de su paciente → «Métricas del reloj» → «Importar entrenos» y soltar los archivos. (Subir archivos en pruebas automáticas: `DataTransfer` + `change` sobre el `input[type=file]` oculto.)
3. Para abrir la hoja directo, sin pasar por la lista y la ficha: una página temporal en la raíz (`qa-metricas.html` + `qa-metricas.jsx`) que monta `MetricasDelAtleta` con los mismos proveedores de `main.jsx` (`AuthProvider`, `ConfirmacionProvider`, `AvisoProvider`) y la sesión de pruebas ya abierta: `/qa-metricas.html?atleta=<uuid>&nombre=…[&esAtleta=1][&abrir=importar]`. **No se sube**: se borra antes del commit.
4. Para borrar lo importado y repetir: la app solo borra entrenos de uno en uno (con confirmación); en pruebas se borra con la sesión del QA por la API (`DELETE /rest/v1/actividades?atleta_id=eq.<id>` y lo mismo en `recuperacion_diaria`; las series caen en cascada).

## 7. Trampas ya pagadas

- **El día de un entreno es el día local del entreno**, no el del teléfono de quien mira: `desfase_min` viaja con cada fila y todas las fechas de pantalla salen de ahí.
- **Apple guarda el pulso en registros sueltos**, no dentro del entreno: hay que cruzar la ventana de tiempo. El lector va de una sola pasada y en trozos (un trozo puede cortar una etiqueta a la mitad: lo incompleto espera al siguiente), guarda los latidos en listas numéricas que crecen sin copiarse y, al terminar, a cada entreno le pega los latidos que caen dentro de su ventana.
- **El sueño de la noche cuenta para el día en que despierta** (se corta al mediodía) y las fuentes encimadas (reloj y teléfono) no se suman.
- **Pasos y calorías**: el reloj y el teléfono cuentan lo mismo; gana el que más contó, no se suman.
- **Una muestra de solo pulso no es un punto de la ruta**: no lleva distancia. Cuando se la dábamos «la del último punto», la velocidad salía ~25 % más lenta (gráfica de ritmo a 6:20 con kilómetros a 4:47). Pasa cuando el pulso y la ruta caen a la misma hora.
- **El mismo entreno por dos caminos** (reloj y Strava en la misma tanda): se queda el que trae más datos (pulso, serie, distancia, calorías) y se le agrega lo que el otro sabía (el nombre de Strava, las calorías). Contra lo que ya está en la base solo se salta.
- Las constantes de pantalla van en archivos aparte (`tonos.js`, `graficasUtil.js`): el lint de React Refresh no deja exportar constantes junto a componentes.
- `HojaFlotante` ahora publica `--hoja-px`, `--hoja-pt` y `--hoja-pb` (el relleno del cuerpo) para que una barra pegada (`BarraFija`, las pestañas) llegue de borde a borde con margen negativo.
- Probar con el **árbol real** (los mismos proveedores que `main.jsx`), no con un arnés a medias.

## 8. Lo que quedó fuera a propósito (ideas para después)

- **La lista de atletas con su estado de hoy** (forma + recuperación en la fila, para ver de un golpe a quién hay que escribirle). Pide una consulta de todo el equipo; se propone, con tres dibujos, en la maqueta `docs/maquetas/2026-10-10-metricas-del-reloj.html` (publicada también como Artifact: https://claude.ai/artifact/GZfWNz2Bsu5rxpa61rFDCw), junto con otras cuatro decisiones de diseño por si se quiere cambiar algo.
- **Conector de IA**: una herramienta para que ChatGPT/Claude lean las métricas de un atleta.
- **Plan contra real**: mostrar lo hecho junto a lo planeado (la unión por hora ya existe, ver §1b; falta comparar con el plan y escribir `actividades.sesion`).
- **Técnica por serie**: el campo `hechos[clave].tecnica` existe; falta el botón (apagado, «Pronto») y mensajes con video. Se ve en la maqueta de la app instalable.
- **Cronómetro por distancia** en los lapsos de metros (sigue pendiente de su sí).
- **HealthKit en vivo y relojes** (ver `docs/entreno-y-reloj.md`).
- **Mapa de fondo** en la ruta (hoy se dibuja sola, sin terceros ni permisos).
- Zonas por **potencia** y por **ritmo** (los umbrales `ftp_w` y `ritmo_umbral_s_km` ya tienen columna).
