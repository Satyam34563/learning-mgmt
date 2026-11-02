import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// In dev, the API runs on :4000 and is proxied so cookies stay same-origin (like Nginx in prod).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:4000',
      '/uploads': 'http://localhost:4000',
      '/favicon.ico': { target: 'http://localhost:4000', rewrite: () => '/api/school/icon' },
    },
  },
});
