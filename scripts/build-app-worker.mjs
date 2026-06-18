#!/usr/bin/env node
/**
 * 把「單一 app」打包成巢狀於 <prefix>/ 的 Workers 靜態資產，供獨立 Worker 部署。
 * 共用、不需逐 app 複製。於 app 目錄下執行（cwd = apps/<APP>）。
 *
 *   node ../../scripts/build-app-worker.mjs --prefix zizi --mode vue
 *   node ../../scripts/build-app-worker.mjs --prefix luoyang-trip --mode static
 *
 * 產物：apps/<APP>/.worker-dist/
 *   <prefix>/index.html, <prefix>/assets/...   ← 對齊前端 base=/<prefix>/
 *   index.html                                  ← SPA 深連結回退（Workers Assets 根）
 *
 * Workers Assets 依「請求路徑」找檔。Worker Route 為 qingyiu.com/<prefix>/*，
 * 故資產必須巢狀在 <prefix>/ 底下，且根再放一份 index.html 供 not_found 回退。
 */
import { cpSync, existsSync, mkdirSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const args = process.argv.slice(2);
const arg = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};

const prefix = arg('prefix');
const mode = arg('mode', 'vue'); // vue | static
if (!prefix) {
  console.error('✗ 缺少 --prefix <路徑前綴>');
  process.exit(1);
}

const APP = process.cwd();
const OUT = join(APP, '.worker-dist');
const NEST = join(OUT, prefix);

rmSync(OUT, { recursive: true, force: true });
mkdirSync(NEST, { recursive: true });

if (mode === 'vue') {
  process.env.VITE_BASE_PATH = process.env.VITE_BASE_PATH || `/${prefix}/`;
  console.log(`▶ 建構 ${prefix}（VITE_BASE_PATH=${process.env.VITE_BASE_PATH}）`);
  execSync('npm run build', { cwd: APP, stdio: 'inherit', env: process.env });
  const dist = join(APP, 'dist');
  if (!existsSync(dist)) {
    console.error('✗ 找不到 dist/，build 可能失敗');
    process.exit(1);
  }
  cpSync(dist, NEST, { recursive: true });
  if (existsSync(join(dist, 'index.html'))) {
    cpSync(join(dist, 'index.html'), join(OUT, 'index.html'));
  }
} else {
  // static：複製除建構/設定產物外的所有檔案到 <prefix>/
  const SKIP = new Set([
    'node_modules', 'dist', '.worker-dist', '.wrangler',
    'wrangler.jsonc', 'wrangler.toml', 'package.json', 'package-lock.json',
    '.npmrc', '.gitignore', '.DS_Store',
  ]);
  for (const entry of readdirSync(APP)) {
    if (SKIP.has(entry)) continue;
    cpSync(join(APP, entry), join(NEST, entry), { recursive: true });
  }
  if (existsSync(join(NEST, 'index.html'))) {
    cpSync(join(NEST, 'index.html'), join(OUT, 'index.html'));
  }
}

console.log(`✓ ${prefix} → ${OUT}`);
