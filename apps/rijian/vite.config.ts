import vue from "@vitejs/plugin-vue";
import path from "node:path";
import { defineConfig } from "vite";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  base: "./",
  plugins: [vue()],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  clearScreen: false,
  server: {
    port: 5175,
    strictPort: true,
    host: host || true,
    hmr: host ? { protocol: "ws", host, port: 5176 } : undefined,
  },
});
