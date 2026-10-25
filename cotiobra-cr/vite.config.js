import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // 0.0.0.0 permite abrir la app desde el navegador del host o desde un
    // contenedor/preview; allowedHosts evita el error "Blocked request".
    host: true,
    port: 5173,
    strictPort: true,
    allowedHosts: true,
  },
  preview: {
    host: true,
    port: 4173,
    strictPort: true,
    allowedHosts: true,
  },
});
