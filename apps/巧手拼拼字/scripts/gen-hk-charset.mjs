#!/usr/bin/env node
/**
 * 產生香港《常用字字形表》白名單。
 *
 * 來源：kitty-panics/cn-tables 的「常用字字形表.txt」，即教育局 2000 年修訂本，
 * 一行一字、Tab 分隔（例：U+4E00\t一）。這份表決定「哪些字是港標收錄字」，
 * 老師加字時用它擋掉異體與非港標字。它不含筆順，筆順走 gen-char-data.mjs。
 *
 * 用法：node scripts/gen-hk-charset.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '../src/data/hkCharset.json');

const SOURCE =
  'https://raw.githubusercontent.com/kitty-panics/cn-tables/master/' +
  encodeURIComponent('常用字字形表.txt');

async function main() {
  process.stdout.write(`抓取 ${SOURCE}\n`);
  const res = await fetch(SOURCE);
  if (!res.ok) {
    throw new Error(`下載失敗 ${res.status}`);
  }
  const text = await res.text();

  const chars = [];
  const seen = new Set();
  for (const line of text.split('\n')) {
    const parts = line.split('\t');
    if (parts.length < 2) continue;
    const ch = parts[1].trim();
    if (!ch || seen.has(ch)) continue;
    seen.add(ch);
    chars.push(ch);
  }

  if (chars.length < 4000) {
    throw new Error(`只解析到 ${chars.length} 字，來源格式可能變了`);
  }

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(
    OUT,
    JSON.stringify(
      {
        source: '香港教育局《常用字字形表》（2000 年修訂本），經 kitty-panics/cn-tables 整理',
        count: chars.length,
        // 併成一個字串，比 JSON 陣列小很多
        chars: chars.join(''),
      },
      null,
      2
    ) + '\n',
    'utf8'
  );

  process.stdout.write(`寫入 ${OUT}：${chars.length} 字\n`);
}

main().catch((err) => {
  process.stderr.write(`${err.message}\n`);
  process.exit(1);
});
