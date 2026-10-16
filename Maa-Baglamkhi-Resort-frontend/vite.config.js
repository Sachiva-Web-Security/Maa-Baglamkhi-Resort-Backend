import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')

  return {
    plugins: [react(), tailwindcss()],
    server: {
      host: env.VITE_DEV_HOST || 'localhost',
      port: Number(env.VITE_DEV_PORT || 5173),
      strictPort: true,
      proxy: {
        '/api': {
          target: env.VITE_BACKEND_URL || env.VITE_BACKEND_ORIGIN || 'http://localhost:5002',
          changeOrigin: true,
        },
        '/socket.io': {
          target: env.VITE_BACKEND_URL || env.VITE_BACKEND_ORIGIN || 'http://localhost:5002',
          ws: true,
          changeOrigin: true,
        },
      },
    },
  }
})
