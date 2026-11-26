import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Configuración de Vite con proxy hacia FastAPI (mismo origen para cookie httpOnly y Origin WebSocket)
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'http://localhost:8000',
        ws: true,
        rewriteWsOrigin: false,
      },
    },
  },
});
