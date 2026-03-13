#!/usr/bin/env node
/**
 * 準備 Pages 部署用目錄：只複製首頁與連結到的子專案，加快上傳。
 */
import { cpSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';

const ROOT = join(process.cwd());
const OUT = join(ROOT, '.pages-deploy');

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

console.log('Done. Output:', OUT);
