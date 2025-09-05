// vite.main.config.ts
import { defineConfig } from 'vite';
import { builtinModules } from 'node:module';

export default defineConfig({
  // Let Forge's Vite plugin inject entry / formats; just configure externals and filename.
  build: {
    sourcemap: true,
    rollupOptions: {
      external: [
        'electron',
        ...builtinModules,
        ...builtinModules.map((m) => `node:${m}`),
      ],
      output: {
        // Make the emitted main entry CommonJS with a .cjs extension
        entryFileNames: 'index.cjs',
      },
    },
  },
});
