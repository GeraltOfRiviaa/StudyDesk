import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import path from 'path' 
import { fileURLToPath } from 'url'
import { normalizeApiBase } from './src/api/baseUrl.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
export default defineConfig(({ command, mode }) => {
  const apiBase = normalizeApiBase(loadEnv(mode, __dirname, 'VITE_').VITE_API_URL)
  // The production image has no local env file. Supply the public URL at build time.
  if (command === 'build' && !apiBase) {
    throw new Error('Set VITE_API_URL before building the production frontend.')
  }

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { "@": path.resolve(__dirname, "./src") },
    },
  }
})
