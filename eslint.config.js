import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

/**
 * Criterio de severidad (lo usa `npm run check`):
 *
 *   error → el codigo SE VA A ROMPER al correr. Detiene la subida.
 *           Ej: no-undef. `vite build` NO lo detecta: compila feliz
 *           y truena en la cara del usuario. Esta es la red real.
 *
 *   warn  → deuda de limpieza. Visible, pero no detiene nada.
 *           Codigo muerto y patrones no idiomaticos de React.
 *
 * La regla: si el lint sale rojo, es alarma de verdad.
 */
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // Deuda de limpieza: no rompen en runtime.
      'no-unused-vars': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-refresh/only-export-components': 'warn',
    },
  },
  {
    // Los scripts del loop corren en Node, no en el navegador.
    files: ['scripts/**/*.{js,mjs}', 'vite.config.js', 'eslint.config.js'],
    languageOptions: { globals: globals.node },
  },
])
