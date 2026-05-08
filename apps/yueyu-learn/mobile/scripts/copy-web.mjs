/**
 * 把 web/ 構建產物複製到 mobile/www/，給 Capacitor 打包到 APP。
 *
 * 在 mobile 目錄下執行：
 *   1. cd ../web && npm install && VITE_BASE_PATH=/ npm run build
 *   2. node ./scripts/copy-web.mjs
 *
 * 注意：手機 APP 不掛在 /yueyu/ 子路徑，所以要用 VITE_BASE_PATH=/ 重新構建一份。
 */
import { cp, mkdir, rm, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const webDist = resolve(__dirname, '../../web/dist')
const target = resolve(__dirname, '../www')

if (!existsSync(webDist)) {
  console.error(`[mobile] web/dist not found at ${webDist}`)
  console.error('請先在 web/ 下執行：VITE_BASE_PATH=/ npm run build')
  process.exit(1)
}

await rm(target, { recursive: true, force: true })
await mkdir(target, { recursive: true })
await cp(webDist, target, { recursive: true })

const stats = await stat(target)
console.log(`[mobile] copied web → ${target} (modified ${stats.mtime.toISOString()})`)
