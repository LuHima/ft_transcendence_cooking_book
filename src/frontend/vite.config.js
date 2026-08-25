import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(),tailwindcss(),],
   server: {
    host: true,
    port: 5173,
	allowedHosts: ['frontend', 'localhost', '127.0.0.1'],
    proxy: {
      '/api': {
        target: 'http://backend-container:3000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})