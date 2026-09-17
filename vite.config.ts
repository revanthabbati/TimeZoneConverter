import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

// Served from https://revanthabbati.github.io/TimeZoneConverter/ — a project page, not a
// domain root — so every asset URL needs the repo name prefixed. Applied unconditionally
// (not just for `build`): `vite preview` resolves this config in "serve" mode too, so a
// command-based ternary here left preview serving at "/" while the built index.html expected
// "/TimeZoneConverter/", and every asset request silently fell back to index.html.
export default defineConfig({
  base: '/TimeZoneConverter/',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
  },
});
