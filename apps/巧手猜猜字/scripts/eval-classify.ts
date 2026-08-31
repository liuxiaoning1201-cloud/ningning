/**
 * 對照已核對字，看自動分類準不準。只在開發時跑。
 * 用法：npx vite-node scripts/eval-classify.ts
 */
import bundled from '../src/data/chars.json';
import { classifyMedian, describeMedian } from '../src/lib/classifyStroke';
import type { CharData } from '../src/types';

const chars = bundled as unknown as Record<string, CharData>;

let total = 0;
let ok = 0;
const misses: string[] = [];

for (const data of Object.values(chars)) {
  if (!data.verified) continue;
  data.medians.forEach((median, i) => {
    const human = data.strokeTypes[i];
    if (!human) return;
    total += 1;
    const got = classifyMedian(median);
    if (got === human) {
      ok += 1;
    } else {
      const shape = describeMedian(median);
      misses.push(
        `${data.char} 第${i + 1}筆 人工=${human} 自動=${got} tokens=${shape.tokens} coll=${shape.collapsed} span=${shape.span}`
      );
    }
  });
}

process.stdout.write(`已核對 ${total} 筆，命中 ${ok}（${((ok / total) * 100).toFixed(1)}%）\n`);
for (const line of misses) process.stdout.write(`  ${line}\n`);
