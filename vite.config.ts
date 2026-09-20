import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' garante que assets funcionem no GitHub Pages
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
