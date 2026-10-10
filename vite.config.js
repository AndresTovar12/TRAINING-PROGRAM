import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Los Workers (la lectura de archivos de entrenos) se arman como módulos: así pueden cargar por partes el lector de FIT.
  worker: { format: 'es' },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
