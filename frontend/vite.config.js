import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5174,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    css: false,
    testTimeout: 15000, // yavaş maşında (paralel işləyən fayllar) kütləvi render testləri 5 san-ni aşa bilir
    exclude: ['e2e/**', 'node_modules/**'],
  },
})
