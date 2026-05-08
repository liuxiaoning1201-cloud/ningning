import vue from "@vitejs/plugin-vue";
import path from "node:path";
import { defineConfig } from "vite";
export default defineConfig({
    base: process.env.VITE_BASE_PATH || "./",
    plugins: [vue()],
    resolve: {
        alias: {
            "@": path.resolve(import.meta.dirname, "src"),
            "@shared": path.resolve(import.meta.dirname, "../../shared"),
        },
    },
    server: { port: 5176, host: true },
});
