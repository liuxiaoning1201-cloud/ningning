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

// 建置中文填字接龍（Vite SPA，base 用英文路徑 /crossword/ 避免 Cloudflare Pages 中文路徑問題）
const WORD_PUZZLE_DIR = join(ROOT, '中文填字接龍');
const PUZZLE_BASE_PATH = '/crossword/';
let wordPuzzleBuilt = false;
try {
  console.log('Building 中文填字接龍...');
  execSync('npm run build', {
    cwd: WORD_PUZZLE_DIR,
    env: { ...process.env, VITE_BASE_PATH: PUZZLE_BASE_PATH },
    stdio: 'inherit',
  });
  wordPuzzleBuilt = true;
} catch (e) {
  console.warn('中文填字接龍 build skipped:', e.message);
}

// 建置班級守護隊
const CLASS_GUARDIAN_DIR = join(ROOT, '班級守護隊');
let classGuardianBuilt = false;
try {
  console.log('Building 班級守護隊...');
  execSync('npm run build', {
    cwd: CLASS_GUARDIAN_DIR,
    env: { ...process.env, VITE_BASE_PATH: '/班級守護隊/' },
    stdio: 'inherit',
  });
  classGuardianBuilt = true;
} catch (e) {
  console.warn('班級守護隊 build skipped:', e.message);
}

// 要部署的項目（與 index.html 連結一致）
// 若需包含詩友記（poetpal，約 336MB），請設環境變數 INCLUDE_POETPAL=1
const COPY = [
  'index.html',
  '404.html',
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

// 複製中文填字接龍建置結果（dist → crossword）
if (wordPuzzleBuilt) {
  const puzzleDist = join(WORD_PUZZLE_DIR, 'dist');
  const puzzleOut = join(OUT, 'crossword');
  cpSync(puzzleDist, puzzleOut, { recursive: true });
  console.log('  + crossword (中文填字接龍, built)');
}

// 複製班級守護隊建置結果（dist → 班級守護隊）
if (classGuardianBuilt) {
  const guardianDist = join(CLASS_GUARDIAN_DIR, 'dist');
  const guardianOut = join(OUT, '班級守護隊');
  cpSync(guardianDist, guardianOut, { recursive: true });
  console.log('  + 班級守護隊 (built)');
}

console.log('Done. Output:', OUT);
