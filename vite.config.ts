import { defineConfig, type Plugin } from 'vite';
import { fileURLToPath } from 'node:url';

// The loading bar (src/js/core/boot.ts) counts the bytes of the game's script files as they
// download: the production build writes their names and sizes into index.html as
// window.__GAME_FILES (every JS chunk but the tiny entry that is already running).
function gameFiles(): Plugin {
  return {
    name: 'game-files',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const files = Object.values(ctx.bundle ?? {})
          .filter(c => c.type === 'chunk' && !c.isEntry)
          .map(c => [c.fileName, Buffer.byteLength(c.type === 'chunk' ? c.code : '')] as [string, number]);
        return [{ tag: 'script', children: `window.__GAME_FILES=${JSON.stringify(files)}`, injectTo: 'head-prepend' }];
      },
    },
  };
}

// Caminhos relativos para o build funcionar tanto na raiz quanto em
// subpastas (ex.: GitHub Pages em user.github.io/<repo>/).
export default defineConfig({
  base: './',
  plugins: [gameFiles()],
  // `@/` -> js/  (so imports are stable regardless of a file's folder depth)
  resolve: { alias: { '@': fileURLToPath(new URL('./src/js', import.meta.url)) } },
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
