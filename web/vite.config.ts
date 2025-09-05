import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Enable LAN access and relative assets so it works on GitHub Pages.
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { host: true },
  preview: { host: true },
});
