#!/usr/bin/env node
/**
 * 把小學高頻字的筆順路徑併進 chars.json。已有的字不動。
 * 用法：node scripts/bundle-primary.mjs
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PENDING_CHARS, PRIMARY_BUNDLE, VERIFIED_STROKES } from './verified-strokes.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '../src/data/chars.json');
const OVERRIDES = resolve(HERE, 'overrides');

const ZHHANT = (ch) =>
  `https://cdn.jsdelivr.net/npm/hanzi-writer-data-acjk@1.0.0/animCJK/ZhHant/${encodeURIComponent(ch)}.json`;
const MMAH = (ch) =>
  `https://cdn.jsdelivr.net/npm/hanzi-writer-data@latest/${encodeURIComponent(ch)}.json`;

async function fetchJson(url) {
  const res = await fetch(url);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

async function loadChar(ch) {
  try {
    const override = JSON.parse(await readFile(resolve(OVERRIDES, `${ch}.json`), 'utf8'));
    return { data: override, source: 'override' };
  } catch {
    // 沒有人工檔
  }
  const zh = await fetchJson(ZHHANT(ch));
  if (zh) return { data: zh, source: 'ZhHant' };
  const mm = await fetchJson(MMAH(ch));
  if (mm) return { data: mm, source: 'makemeahanzi' };
  return null;
}

async function pool(items, limit, fn) {
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const ch = items[i];
        i += 1;
        await fn(ch);
      }
    })
  );
}

async function main() {
  const existing = JSON.parse(await readFile(OUT, 'utf8'));
  const wanted = [...new Set([...Object.keys(VERIFIED_STROKES), ...PENDING_CHARS, ...PRIMARY_BUNDLE])];
  const missing = wanted.filter((ch) => !existing[ch]);
  process.stdout.write(`已有 ${Object.keys(existing).length} 字，再抓 ${missing.length} 字\n`);

  let added = 0;
  let failed = 0;
  await pool(missing, 6, async (ch) => {
    try {
      const loaded = await loadChar(ch);
      if (!loaded?.data?.strokes?.length || loaded.data.strokes.length !== loaded.data.medians?.length) {
        failed += 1;
        process.stdout.write(`  跳過 ${ch}\n`);
        return;
      }
      existing[ch] = {
        char: ch,
        strokes: loaded.data.strokes,
        medians: loaded.data.medians,
        strokeTypes: loaded.data.medians.map(() => null),
        source: loaded.source,
        verified: false,
      };
      added += 1;
      process.stdout.write(`  + ${ch} ${loaded.source} ${loaded.data.strokes.length} 筆\n`);
    } catch (err) {
      failed += 1;
      process.stdout.write(`  失敗 ${ch} ${err.message}\n`);
    }
  });

  await writeFile(OUT, JSON.stringify(existing), 'utf8');
  process.stdout.write(`寫入 ${OUT}，現在 ${Object.keys(existing).length} 字（新增 ${added}，失敗 ${failed}）\n`);
}

main().catch((err) => {
  process.stderr.write(`${err.message}\n`);
  process.exit(1);
});
