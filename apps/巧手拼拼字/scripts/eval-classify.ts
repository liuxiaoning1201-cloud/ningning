/**
 * 對照已核對字，看自動分類準不準。只在開發時跑。
 * 用法：npx vite-node scripts/eval-classify.ts
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import bundled from '../src/data/chars.json';
import { classifyMedian, describeMedian, fillStrokeTypes } from '../src/lib/classifyStroke';
import { hitsSlot, slotsForChar } from '../src/lib/geometry';
import { renderRotation } from '../src/lib/strokeMetrics';
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
  const expect = 'pie,hengzhewangou,dian';
  process.stdout.write(`丸 fillStrokeTypes ${got === expect ? 'OK' : 'FAIL'} ${got}\n`);
  if (got !== expect) process.exitCode = 1;
  if (wan.source !== 'override' || wan.strokeTypes.join(',') !== expect) {
    process.stdout.write('丸 應為港標 override：撇、橫折彎鈎、點\n');
    process.exitCode = 1;
  }
}

for (const [ch, expect] of [
  ['口', 'zhi,hengzhi,heng'],
  ['日', 'zhi,hengzhi,heng,heng'],
  ['主', 'dian,heng,heng,zhi,heng'],
] as const) {
  const data = chars[ch];
  if (!data) continue;
  const got = fillStrokeTypes(data.medians, null, ch).join(',');
  process.stdout.write(`${ch} 開源筆序 ${got === expect ? 'OK' : 'FAIL'} ${got}\n`);
  if (got !== expect) process.exitCode = 1;
}

const bi = chars['必'];
if (bi) {
  const locked = fillStrokeTypes(bi.medians, bi.strokeTypes, '必').join(',');
  const unlocked = fillStrokeTypes(bi.medians, null, '必').join(',');
  const expect = 'dian,wogou,pie,dian,dian';
  process.stdout.write(`必 人工鎖定 ${locked === expect ? 'OK' : 'FAIL'} ${locked}\n`);
  process.stdout.write(`必 老師加生字 ${unlocked === expect ? 'OK' : 'FAIL'} ${unlocked}\n`);
  if (locked !== expect || unlocked !== expect) process.exitCode = 1;
  if (bi.source !== 'override') {
    process.stdout.write('必 應為港標 override：點、臥鈎、撇、點、點\n');
    process.exitCode = 1;
  }
}

const yong = chars['永'];
if (yong) {
  const got = fillStrokeTypes(yong.medians, null, '永');
  process.stdout.write(`永 自動 ${got.join(',')}\n`);
  if (got[0] !== 'dian' || got[1] !== 'hengzhigou' || got[3] !== 'pie' || got[4] !== 'na') {
    process.stdout.write('永 應為點、橫直鈎、…、撇、捺\n');
    process.exitCode = 1;
  }
}

let teacherMiss = 0;
for (const data of Object.values(chars)) {
  if (!data.verified) continue;
  const expect = data.strokeTypes.filter(Boolean).join(',');
  const got = fillStrokeTypes(data.medians, null, data.char).join(',');
  if (got !== expect) {
    teacherMiss += 1;
    process.stdout.write(`生字 ${data.char} 自動=${got} 人工=${expect}\n`);
  }
}
process.stdout.write(`已核對字當生字重跑，不符 ${teacherMiss} 個\n`);
if (teacherMiss) process.exitCode = 1;

if (renderRotation('dian', 49) !== 0 || renderRotation('dian', -90) !== 0 || renderRotation('dian', 180) !== 0) {
  process.stdout.write('點的畫面旋轉應永遠是 0\n');
  process.exitCode = 1;
} else {
  process.stdout.write('點直立 OK\n');
}

const zhu = chars['主'];
if (zhu) {
  const slots = slotsForChar({ ...zhu, strokeTypes: fillStrokeTypes(zhu.medians, zhu.strokeTypes, '主') });
  const dot = slots[0];
  const onDot = hitsSlot(dot, dot.cx, dot.cy);
  const onCenter = hitsSlot(dot, 0.5, 0.5);
  process.stdout.write(`主 點槽位命中 ${onDot ? 'OK' : 'FAIL'} 中心不誤黏 ${onCenter ? 'FAIL' : 'OK'}\n`);
  if (!onDot || onCenter) process.exitCode = 1;
}
