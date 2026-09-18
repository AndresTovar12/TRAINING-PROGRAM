# Procedencia de anti-slop

Código **copiado** (vendored): este repositorio es dueño de sus reglas y de su
configuración. Al traer cambios de arriba, conservar lo que se haya ajustado
aquí.

- **Origen:** paquete de la skill `install-anti-slop` de Claude Code,
  `~/.claude/skills/install-anti-slop/assets/anti-slop`, copiado con su
  `scripts/install.mjs`.
- **Fecha de la copia:** 17 de septiembre de 2026.
- **Revisión de origen:** DESCONOCIDA. El paquete de la skill no trae commit ni
  versión. Como referencia recuperable queda la huella del árbol copiado:
  `sha256(lista de sha256 de los 38 archivos) = 2cf66fa1be860828766b671ac50f7cadea0b5bff27359c1b27693586b4cb95aa`.
- **Dónde quedó:** `tools/oxlint/anti-slop/` (entrada: `index.ts`; reglas en
  `rules/`; la parte opcional de Effect, sin usar aquí, en `effect/`).
- **Licencia de terceros:** `vendor/eslint-stylistic/LICENSE` (MIT), que viaja
  con la regla de espaciado.

## Cómo se usa aquí

- Configuración en `.oxlintrc.json`, con las reglas genéricas en `error` más
  `oxc/no-accumulating-spread`. El plugin de Effect NO está registrado: el
  proyecto no depende de Effect.
- Se corre con `npm run anti-slop`. A propósito NO está dentro de `npm run
  check`: quedan hallazgos abiertos que hoy no conviene tocar (ver abajo).
- Dependencias: `oxlint` y `@oxlint/plugins`, ambas fijadas a la MISMA versión
  exacta (1.83.0). Al subir una, subir la otra.

## Desviaciones

**`require-readable-spacing` está en `off`.** Se probó su autoarreglo el 17 sep
2026 sobre las 842 marcas que dejaba en el código existente y el resultado era
peor de leer, no mejor: parte los `if` de una línea y deja el `return` suelto
con la sangría rota. Ejemplo real de `ProfileScreen.jsx`:

```js
// antes
if (!file.type.startsWith('image/')) { setErr('Elige una imagen'); return; }

// después del autoarreglo
if (!file.type.startsWith('image/')) { setErr('Elige una imagen');

 return; }
```

Este proyecto usa mucho la guarda de una línea, así que la regla pelea con su
estilo. Con la regla apagada, `npm run anti-slop` enseña solo hallazgos de
fondo. Si algún día se quiere, se enciende y se arregla a mano, no con `--fix`.

**Hallazgos abiertos, reportados y NO cambiados** (17 sep 2026): 17
`no-runtime-typeof` (leen el plan que llega de la base, donde el formato viejo
convive con el nuevo), 5 `no-array-filter-map` sobre listas de 5-9 elementos, 2
spreads condicionales en estilos, y en las funciones de servidor viejas 5
`no-unknown-parameters`, 3 `no-known-value-widening`, 1
`no-unsafe-dictionary-type` y 1 `require-safety-comment-for-type-assertion`.
La función `login`, escrita ese día, quedó en cero.

También se añadió `dist/`, `scripts/` y `.claude/` a `ignorePatterns`: son
salida de compilación y herramientas, no código de la app.
