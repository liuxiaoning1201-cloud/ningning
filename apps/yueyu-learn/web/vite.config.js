var _a;
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';
export default defineConfig({
    plugins: [vue(), tailwindcss()],
    base: (_a = process.env.VITE_BASE_PATH) !== null && _a !== void 0 ? _a : './',
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url)),
            '@yueyu/shared': fileURLToPath(new URL('../shared', import.meta.url)),
        },
    },
    server: {
        port: 5173,
        proxy: {
            // 本地開發時把 /api/* 反向代理到 wrangler pages dev (預設 8788)
            '/api': {
                target: 'http://localhost:8788',
                changeOrigin: true,
            },
        },
    },
});
