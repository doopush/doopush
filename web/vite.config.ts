import path from 'path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(__dirname, '..'), '')

  return {
    build: {
      chunkSizeWarningLimit: 1000,
    },
    plugins: [
      tanstackRouter({
        target: 'react',
        autoCodeSplitting: true,
      }),
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: Number(env.WEB_PORT),
      host: '0.0.0.0',
      allowedHosts: ['localhost', '127.0.0.1', '0.0.0.0', '.coss.im'],
      proxy: {
        '/api': {
          target: `http://localhost:${env.API_PORT}`,
          changeOrigin: true,
        },
        '/uploads': {
          target: `http://localhost:${env.API_PORT}`,
          changeOrigin: true,
        },
      },
    },
  }
})
