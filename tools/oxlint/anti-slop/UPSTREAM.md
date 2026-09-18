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

- Configuración en `.oxlintrc.json`, con las 19 reglas genéricas en `error` más
  `oxc/no-accumulating-spread`. El plugin de Effect NO está registrado: el
  proyecto no depende de Effect.
- Se corre con `npm run anti-slop`. A propósito NO está dentro de `npm run
  check`: hoy la regla `require-readable-spacing` marca ~840 avisos de líneas
  en blanco en código que ya existía, y esa limpieza está sin decidir.
- Dependencias: `oxlint` y `@oxlint/plugins`, ambas fijadas a la MISMA versión
  exacta (1.83.0). Al subir una, subir la otra.

## Desviaciones

Ninguna en las reglas. Solo se añadió `dist/`, `scripts/` y `.claude/` a
`ignorePatterns`, que son salida de compilación y herramientas, no código de la
app.
