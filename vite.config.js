import {defineConfig} from 'vite';

// Caminhos relativos para o build funcionar tanto na raiz quanto em
// subpastas (ex.: GitHub Pages em user.github.io/tiny-gta/).
export default defineConfig({
  base: './',
  server: {
    port: 5173,
    host: true   // expõe na LAN para testar no celular (projeto tem suporte mobile)
  },
  build: {
    rollupOptions: {
      output: {
        // three muda pouco; em chunk próprio melhora o cache entre builds.
        manualChunks: {three: ['three']}
      }
    }
  }
});
