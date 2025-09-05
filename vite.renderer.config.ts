// vite.renderer.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  root: 'src/renderer',
  build: {
    outDir: '../../out/renderer',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src/renderer', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    strictPort: true, // if 5173 is taken, Vite won't pick a new one
    host: '127.0.0.1',
  },
});
