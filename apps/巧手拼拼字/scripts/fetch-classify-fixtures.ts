/**
 * 下載分類迴歸用的中線。開發時用：npx vite-node scripts/fetch-classify-fixtures.ts
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, 'fixtures');

const ZHHANT = (ch: string) =>
  `https://cdn.jsdelivr.net/npm/hanzi-writer-data-acjk@1.0.0/animCJK/ZhHant/${encodeURIComponent(ch)}.json`;
const MMAH = (ch: string) =>
  `https://cdn.jsdelivr.net/npm/hanzi-writer-data@latest/${encodeURIComponent(ch)}.json`;

const CHARS = ['豆', '陰', '陽', '乃', '那', '又', '了', '山', '去', '口', '進', '這', '之'];

await mkdir(OUT, { recursive: true });

for (const ch of CHARS) {
  let raw: { strokes?: string[]; medians?: unknown } | null = null;
  let source = '';
  for (const [name, url] of [
    ['ZhHant', ZHHANT(ch)],
    ['makemeahanzi', MMAH(ch)],
  ] as const) {
    const res = await fetch(url);
    if (!res.ok) continue;
    raw = (await res.json()) as { strokes?: string[]; medians?: unknown };
    source = name;
    break;
  }
  if (!raw?.medians || !raw.strokes) {
    process.stdout.write(`skip ${ch}\n`);
    continue;
  }
  const file = resolve(OUT, `${ch}.json`);
  await writeFile(file, `${JSON.stringify({ char: ch, source, strokes: raw.strokes, medians: raw.medians })}\n`);
  process.stdout.write(`wrote ${ch} [${source}] ${raw.medians.length} 筆\n`);
}
