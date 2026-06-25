import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// Caminhos relativos para o build funcionar tanto na raiz quanto em
// subpastas (ex.: GitHub Pages em user.github.io/tiny-gta/).
export default defineConfig({
  base: './',
  // Pretty dev URLs for the tooling pages: /studio -> /studio.html (dev only).
  plugins: [{
    name: 'pretty-dev-pages',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (req.url === '/studio' || req.url === '/studio/') req.url = '/studio.html';
        next();
      });
    },
  }],
  // `@/` -> js/  (so imports are stable regardless of a file's folder depth)
  resolve: { alias: { '@': fileURLToPath(new URL('./js', import.meta.url)) } },
  server: {
    port: 5173,
    host: true   // expõe na LAN para testar no celular (projeto tem suporte mobile)
  },
  build: {
    rollupOptions: {
      output: {
        // three muda pouco; em chunk próprio melhora o cache entre builds.
        manualChunks: { three: ['three'] }
      }
    }
  }
});
