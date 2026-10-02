import { defineConfig } from 'vite';

export default defineConfig({
  // Use relative base path for GitHub Pages compatibility
  base: './',
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
