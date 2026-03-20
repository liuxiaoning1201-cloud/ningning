#!/usr/bin/env node
/**
 * 建置字遊空間：編譯 Vue 應用、複製靜態應用到 dist/，供 Cloudflare Pages 部署。
 */
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

const ROOT = process.cwd();
const APPS = join(ROOT, 'apps');
const OUT = join(ROOT, 'dist');

// ── Vue 應用建置 ──

function buildVueApp(name, { outDir, env = {} } = {}) {
  const appDir = join(APPS, name);
  if (!existsSync(join(appDir, 'package.json'))) {
    console.warn(`⏭ ${name}: package.json not found, skipped`);
    return false;
  }
  try {
    console.log(`Building ${name}...`);
    execSync('npm run build', {
      cwd: appDir,
      env: { ...process.env, ...env },
      stdio: 'inherit',
    });
    const dist = join(appDir, 'dist');
    const dest = join(OUT, outDir || name);
    cpSync(dist, dest, { recursive: true });
    console.log(`  + ${outDir || name} (${name}, built)`);
    return true;
  } catch (e) {
    console.warn(`⏭ ${name} build skipped:`, e.message);
    return false;
  }
}

// ── 清空輸出 ──

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

// ── 根目錄靜態檔案 ──

const ROOT_FILES = ['index.html', '404.html', 'auth-widget.js', '_headers'];
for (const file of ROOT_FILES) {
  const src = join(ROOT, file);
  if (existsSync(src)) {
    cpSync(src, join(OUT, file));
    console.log(`  + ${file}`);
  }
}

// ── 靜態應用（直接複製） ──

const STATIC_APPS = [
  '字詞地鼠戰',
  '手勢點名',
  '春江花月夜',
  'poetpal',
];

for (const name of STATIC_APPS) {
  const src = join(APPS, name);
  if (existsSync(src)) {
    cpSync(src, join(OUT, name), { recursive: true });
    console.log(`  + ${name}`);
  }
}

// ── Vue 應用建置 ──

const crosswordBuilt = buildVueApp('中文填字接龍', {
  outDir: 'crossword',
  env: { VITE_BASE_PATH: './' },
});

if (crosswordBuilt) {
  const legacyDir = join(OUT, '中文填字接龍');
  mkdirSync(legacyDir, { recursive: true });
  writeFileSync(
    join(legacyDir, 'index.html'),
    '<!DOCTYPE html><html lang="zh-Hant"><head><meta charset="UTF-8"/><meta http-equiv="refresh" content="0;url=../crossword/index.html"/><title>轉址中…</title></head><body><p><a href="../crossword/index.html">前往中文填字接龍</a></p></body></html>'
  );
  console.log('  + 中文填字接龍 (轉址 → crossword)');
}

buildVueApp('班級守護隊', {
  env: { VITE_BASE_PATH: '/班級守護隊/' },
});

console.log('Done. Output:', OUT);
