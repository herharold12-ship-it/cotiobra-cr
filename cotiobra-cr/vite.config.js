import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// En GitHub Pages el sitio se sirve bajo /cotiobra-cr/; en Firebase Hosting
// (y en desarrollo) va en la raíz. El workflow de Pages define GITHUB_PAGES=true.
const base = process.env.GITHUB_PAGES === 'true' ? '/cotiobra-cr/' : '/';

// https://vite.dev/config/
export default defineConfig({
  base,
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
