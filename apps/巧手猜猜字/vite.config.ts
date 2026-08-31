import vue from '@vitejs/plugin-vue';
import path from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [vue()],
  base: process.env.VITE_BASE_PATH ?? '/',
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    },
  },
});
