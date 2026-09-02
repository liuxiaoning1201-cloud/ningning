/**
 * 對照已核對字，看自動分類準不準。只在開發時跑。
 * 用法：npx vite-node scripts/eval-classify.ts
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import bundled from '../src/data/chars.json';
import { classifyMedian, describeMedian, fillStrokeTypes } from '../src/lib/classifyStroke';
import type { CharData, Median } from '../src/types';

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

const here = dirname(fileURLToPath(import.meta.url));
const nan = JSON.parse(readFileSync(resolve(here, 'fixtures/nan.json'), 'utf8')) as {
  medians: Median[];
};
const nanTypes = fillStrokeTypes(nan.medians, null, '難');
const nanExpect = [
  'heng',
  'zhi',
  'zhi',
  'heng',
  'zhi',
  'hengzhi',
  'heng',
  'heng',
  'heng',
  'pie',
  'dian',
  'pie',
  'zhi',
  'dian',
  'heng',
  'heng',
  'heng',
  'zhi',
  'heng',
];
const nanOk = nanTypes.join(',') === nanExpect.join(',');
process.stdout.write(`難 fillStrokeTypes ${nanOk ? 'OK' : 'FAIL'} ${nanTypes.join(',')}\n`);
if (!nanOk) process.exitCode = 1;
if (nanTypes[4] !== 'zhi') {
  process.stdout.write('難第五畫應為直\n');
  process.exitCode = 1;
}

const xin = chars['心'];
if (xin) {
  const got = fillStrokeTypes(xin.medians, null, '心').join(',');
  const expect = 'dian,wogou,dian,dian';
  process.stdout.write(`心 fillStrokeTypes ${got === expect ? 'OK' : 'FAIL'} ${got}\n`);
  if (got !== expect) process.exitCode = 1;
}

const huo = chars['火'];
if (huo) {
  const got = fillStrokeTypes(huo.medians, null, '火');
  process.stdout.write(`火第一筆 ${got[0] === 'dian' ? 'OK' : 'FAIL'} ${got.join(',')}\n`);
  if (got[0] !== 'dian') process.exitCode = 1;
}

const wan = chars['丸'];
if (wan) {
  const got = fillStrokeTypes(wan.medians, null, '丸').join(',');
  const expect = 'pie,hengwangou,dian';
  process.stdout.write(`丸 fillStrokeTypes ${got === expect ? 'OK' : 'FAIL'} ${got}\n`);
  if (got !== expect) process.exitCode = 1;
  if (wan.source !== 'override' || wan.strokeTypes.join(',') !== expect) {
    process.stdout.write('丸 應為港標 override：撇、橫彎鈎、點\n');
    process.exitCode = 1;
  }
}
