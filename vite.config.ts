import { defineConfig } from 'vite';

export default defineConfig({
  // relative base so the build works on GitHub Pages sub-paths as well as root hosting
  base: './',
  build: { target: 'es2020' },
  test: { include: ['tests/**/*.test.ts'] },
});
