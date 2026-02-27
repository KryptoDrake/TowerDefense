import { defineConfig } from 'vite';

export default defineConfig({
  base: '/TowerDefense/',
  server: {
    open: true,
    port: 3000,
  },
  build: {
    target: 'ES2020',
  },
});
