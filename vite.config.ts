import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The screenshot pass runs its own API on another port so it can sit beside a dev session.
const API_PORT = process.env.CORTEX_API_PORT ?? '3001';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: `http://localhost:${API_PORT}`,
        changeOrigin: true,
      },
    },
  },
});
