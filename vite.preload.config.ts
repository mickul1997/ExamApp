// vite.preload.config.ts
import { defineConfig } from 'vite';
import { builtinModules } from 'node:module';

export default defineConfig({
  build: {
    sourcemap: true,
    rollupOptions: {
      external: [
        'electron',
        ...builtinModules,
        ...builtinModules.map((m) => `node:${m}`),
      ],
      output: {
        // Emit preload as CommonJS with .cjs extension
        entryFileNames: 'index.cjs',
      },
    },
  },
});
