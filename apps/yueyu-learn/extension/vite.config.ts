import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { copyFileSync, mkdirSync, existsSync } from 'node:fs'

const __dirname = dirname(fileURLToPath(import.meta.url))

/**
 * Chrome MV3 擴展的多入口建置：
 *   - background.ts → background.js (service worker)
 *   - content.ts    → content.js    (注入 YouTube)
 *   - popup.html    → popup.html
 *   - sidepanel.html→ sidepanel.html
 */
export default defineConfig(({ command }) => ({
  plugins: [
    vue(),
    {
      name: 'copy-manifest-and-icons',
      closeBundle() {
        const dist = resolve(__dirname, 'dist')
        if (!existsSync(dist)) mkdirSync(dist, { recursive: true })
        copyFileSync(resolve(__dirname, 'manifest.json'), resolve(dist, 'manifest.json'))
        // 圖示檔案複製（如有）
        const iconsDir = resolve(dist, 'icons')
        if (!existsSync(iconsDir)) mkdirSync(iconsDir, { recursive: true })
        for (const size of [16, 48, 128]) {
          const src = resolve(__dirname, `icons/icon-${size}.png`)
          if (existsSync(src)) copyFileSync(src, resolve(iconsDir, `icon-${size}.png`))
        }
      },
    },
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@yueyu/shared': resolve(__dirname, '../shared'),
    },
  },
  build: {
    emptyOutDir: command === 'build',
    rollupOptions: {
      input: {
        background: resolve(__dirname, 'src/background/index.ts'),
        content: resolve(__dirname, 'src/content/index.ts'),
        popup: resolve(__dirname, 'popup.html'),
        sidepanel: resolve(__dirname, 'sidepanel.html'),
      },
      output: {
        entryFileNames: (chunk) => {
          if (chunk.name === 'background' || chunk.name === 'content') return '[name].js'
          return 'assets/[name]-[hash].js'
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: (info) => {
          // 把 overlay.css 從 chunk 提到根目錄方便 web_accessible
          if (info.names?.includes('overlay.css')) return 'overlay.css'
          return 'assets/[name]-[hash][extname]'
        },
      },
    },
  },
}))
