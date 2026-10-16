// El candado de la reestructura visual (16 oct 2026).
//
// Andrés: «Dentro de la aplicación hay miles y miles de caminos… nunca voy a terminar. Necesito que utilices pensamiento de código».
// En vez de arreglar pantalla por pantalla según sus capturas, este archivo busca en TODO el código las marcas del estilo viejo y falla
// si encuentra alguna. Las tres marcas (`eyebrow`, `kpCard` y las sombras de `KP` se arreglaron de raíz en `lib/theme.js`):
//   1. contorno:   `border: '1px solid …'` alrededor de tarjetas, campos y botones (el estilo nuevo separa con fondo, no con línea).
//   2. mayúsculas: `textTransform: 'uppercase'` en rótulos y pastillas (ahora van en letra normal).
//   3. degradado:  `linear-gradient(` escrito a mano (el único degradado del estilo es el azul de `UI.azul` / `UI.azulVertical`).
//
// Cuando una de estas marcas SÍ tiene función (el día elegido, la caja donde se suelta un video, la banda oscura de un Set), se deja
// con un comentario `estilo-ok: <por qué>` en la misma línea o en la de arriba. Así cada excepción queda escrita y se puede revisar.
//
// Fuera de la revisión: landing, entrar/crear cuenta (Andrés pidió no tocarlas todavía), el catálogo de piezas y las maquetas que
// imitan pantallas de ChatGPT y Claude.
//
// Uso: node scripts/revisa-estilo.mjs          → falla si hay marcas
//      node scripts/revisa-estilo.mjs --lista  → solo cuenta por archivo, sin fallar

import fs from 'node:fs';
import path from 'node:path';

const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const FUERA = [
  /^src\/features\/landing\//,
  /^src\/features\/auth\//,
  /^src\/features\/inicio\/(Inicio\.jsx|estilos\.js)$/, // crear la cuenta
  /^src\/features\/catalogo\//,
  /^src\/features\/ia\/Maquetas\.jsx$/, // dibuja pantallas de ChatGPT y Claude tal como se ven allá
  /^src\/lib\/theme\.js$/,
  /\.test\.jsx?$/,
];
const MARCAS = [
  ['contorno', /\b(border|outline):[^,;]*?(\d+(\.\d+)?|\$\{[^}]+\})px\s*(solid|dashed|dotted|\$\{)|\bborder-?[cC]olor\b/],
  // Un contorno dibujado con sombra interior (`inset 0 0 0 2px`) sigue siendo contorno.
  ['contorno', /inset 0 0 0 [\d.]+px/],
  ['mayúsculas', /textTransform:\s*['"]uppercase['"]/],
  ['degradado', /linear-gradient\(/],
  // Texto que se pasa a mayúsculas al pintarlo: `{tipo.toUpperCase()}`.
  ['mayúsculas', /\{[^{}]*\.toUpperCase\(\)\s*\}/],
  // Texto escrito en mayúsculas a mano («EDITANDO», «POR FASES»). Las siglas (AMRAP, EMOM, RPE, GPS…) no cuentan.
  ['mayúsculas', /(?:texto=|>\s*|[(:,?]\s*|(?<![=!])=\s*)['"`]?(?!(?:AMRAP|EMOM|TABATA|RPE|RIR|GPS|HRV|PDF|CSV|URL|MXN|USD|HIIT|FTP|VO2|ZZ|QA|SAT|RFC|CURP|CLABE|HEIC|JPEG|PNG|MP4|IA|OK|OFF|ID|POST|GET|PUT|PATCH|DELETE|AAAA|HEAD)\b)[A-ZÁÉÍÓÚÑ]{4,}(?:[ ·-][A-ZÁÉÍÓÚÑ]{2,})*['"`<]/],
];

const archivos = [];
(function anda(dir) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) anda(p);
    else if (/\.(jsx?|css)$/.test(f.name)) archivos.push(path.relative(RAIZ, p));
  }
})(path.join(RAIZ, 'src'));

const hallazgos = [];
for (const a of archivos) {
  if (FUERA.some((re) => re.test(a))) continue;
  const lineas = fs.readFileSync(path.join(RAIZ, a), 'utf8').split('\n');
  lineas.forEach((l, i) => {
    if (/estilo-ok:/.test(l) || /estilo-ok:/.test(lineas[i - 1] ?? '')) return;
    if (/^\s*(\*|\/\/|\/\*)/.test(l)) return; // los comentarios no se ven en pantalla
    for (const [nombre, re] of MARCAS) if (re.test(l)) hallazgos.push({ a, n: i + 1, nombre, l: l.trim().slice(0, 140) });
  });
}

if (process.argv.includes('--lista')) {
  const porArchivo = {};
  for (const h of hallazgos) porArchivo[h.a] = (porArchivo[h.a] ?? 0) + 1;
  Object.entries(porArchivo).sort((x, y) => y[1] - x[1]).forEach(([a, n]) => console.log(String(n).padStart(3), a));
  console.log(`\n${hallazgos.length} marcas en ${Object.keys(porArchivo).length} archivos`);
  process.exit(0);
}
if (hallazgos.length) {
  for (const h of hallazgos) console.log(`${h.a}:${h.n}  [${h.nombre}]  ${h.l}`);
  console.log(`\n✗ ${hallazgos.length} marcas del estilo viejo. Arréglalas o, si tienen función, márcalas con «estilo-ok: <por qué>».`);
  process.exit(1);
}
console.log('✓ Sin marcas del estilo viejo.');
