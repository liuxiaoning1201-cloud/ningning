import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  // 從字遊空間子路徑進入時需用絕對 base，否則資源載入會 404
  base: process.env.VITE_BASE_PATH ?? './',
})
