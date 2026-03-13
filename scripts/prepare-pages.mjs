#!/usr/bin/env node
/**
 * 準備 Pages 部署用目錄：只複製首頁與連結到的子專案，加快上傳。
 * 會先建置「中文填字接龍」Vue 專案再複製其 dist。
 */
import { cpSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

const ROOT = join(process.cwd());
const OUT = join(ROOT, '.pages-deploy');

// 建置中文填字接龍（Vite SPA，base 為 /中文填字接龍/）
const WORD_PUZZLE_DIR = join(ROOT, '中文填字接龍');
try {
  console.log('Building 中文填字接龍...');
  execSync('npm run build', {
    cwd: WORD_PUZZLE_DIR,
    env: { ...process.env, VITE_BASE_PATH: '/中文填字接龍/' },
    stdio: 'inherit',
  });
} catch (e) {
  console.error('中文填字接龍 build failed:', e.message);
  process.exit(1);
}

// 要部署的項目（與 index.html 連結一致）
// 若需包含詩友記（poetpal，約 336MB），請設環境變數 INCLUDE_POETPAL=1
const COPY = [
  'index.html',
  '字詞地鼠戰',
  '手勢點名',
  '春江花月夜',
  ...(process.env.INCLUDE_POETPAL === '1' ? ['poetpal'] : []),
];

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

for (const name of COPY) {
  const src = join(ROOT, name);
  const dest = join(OUT, name);
  cpSync(src, dest, { recursive: true });
  console.log('  +', name);
}

// 複製中文填字接龍建置結果（dist → 中文填字接龍）
const puzzleDist = join(WORD_PUZZLE_DIR, 'dist');
const puzzleOut = join(OUT, '中文填字接龍');
cpSync(puzzleDist, puzzleOut, { recursive: true });
console.log('  + 中文填字接龍 (built)');

console.log('Done. Output:', OUT);
