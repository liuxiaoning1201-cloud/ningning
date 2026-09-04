/**
 * 對照已核對字，看自動分類準不準。只在開發時跑。
 * 用法：npx vite-node scripts/eval-classify.ts
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import bundled from '../src/data/chars.json';
import { classifyMedian, describeMedian, fillStrokeTypes } from '../src/lib/classifyStroke';
import { mergeSplitEarRadical } from '../src/lib/earRadical';
import { mergeSplitWalkingNa } from '../src/lib/walkingRadical';
import { applyStrokeLocks, resetStrokeLocksForTests, setStrokeLock } from '../src/lib/strokeLocks';
import {
  applyStrokeLayout,
  ensureStrokeLayout,
  inkStrokePaths,
  insertLayoutItem,
  removeLayoutItem,
  resetStrokeLayoutsForTests,
} from '../src/lib/strokeLayouts';
import { hitsSlot, slotsForChar } from '../src/lib/geometry';
import { inspectChar, unusedOfficialNames } from '../src/lib/charIssues';
import { defaultObjectScale, fitToSlot, objectSize, renderRotation, sizeForCharStroke } from '../src/lib/strokeMetrics';
import type { CharData, Median, StrokeId } from '../src/types';

const here = dirname(fileURLToPath(import.meta.url));

function loadFixture(name: string): CharData {
  const raw = JSON.parse(readFileSync(resolve(here, `fixtures/${name}.json`), 'utf8')) as {
    char: string;
    source: CharData['source'];
    strokes: string[];
    medians: Median[];
  };
  const blank = Array.from({ length: raw.strokes.length }, () => null);
  return mergeSplitWalkingNa(
    mergeSplitEarRadical({
      char: raw.char,
      strokes: raw.strokes,
      medians: raw.medians,
      strokeTypes: blank,
      source: raw.source,
      verified: false,
    })
  );
}

function autoTypes(data: CharData): StrokeId[] {
  return fillStrokeTypes(data.medians, data.strokeTypes, data.char);
}

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

function expectTypes(label: string, got: string[], expect: string[]) {
  const okNow = got.join(',') === expect.join(',');
  process.stdout.write(`${label} ${okNow ? 'OK' : 'FAIL'} ${got.join(',')}\n`);
  if (!okNow) {
    process.stdout.write(`  期望 ${expect.join(',')}\n`);
    process.exitCode = 1;
  }
}

const dou = loadFixture('豆');
expectTypes('豆', autoTypes(dou), ['heng', 'zhi', 'hengzhi', 'heng', 'dian', 'pie', 'heng']);

const you = loadFixture('又');
expectTypes('又', autoTypes(you), ['hengpie', 'na']);

const liao = loadFixture('了');
expectTypes('了', autoTypes(liao), ['hengpie', 'zhigou']);

const shan = loadFixture('山');
expectTypes('山', autoTypes(shan), ['zhi', 'zhizheng', 'zhi']);

const qu = loadFixture('去');
expectTypes('去', autoTypes(qu), ['heng', 'zhi', 'heng', 'pieti', 'dian']);

const kou = loadFixture('口');
expectTypes('口 生字路徑', autoTypes(kou), ['zhi', 'hengzhi', 'heng']);

const yin = loadFixture('陰');
process.stdout.write(`陰 黏耳後 ${yin.medians.length} 筆\n`);
if (yin.medians.length !== 10) {
  process.stdout.write('陰 耳朵旁應黏成 10 筆\n');
  process.exitCode = 1;
}
const yinTypes = autoTypes(yin);
if (yinTypes[0] !== 'hengpiewangou') {
  process.stdout.write(`陰 第一筆應為橫撇彎鈎，得到 ${yinTypes[0]}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write('陰 第一筆 橫撇彎鈎 OK\n');
}
if (!yinTypes.includes('pieti')) {
  process.stdout.write(`陰 應有撇趯，得到 ${yinTypes.join(',')}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write('陰 撇趯 OK\n');
}

const yang = loadFixture('陽');
if (yang.medians.length !== 11 || autoTypes(yang)[0] !== 'hengpiewangou') {
  process.stdout.write(`陽 黏耳 FAIL ${yang.medians.length} ${autoTypes(yang).join(',')}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write('陽 橫撇彎鈎 OK\n');
}

const nai = loadFixture('乃');
expectTypes('乃', autoTypes(nai), ['hengpiewangou', 'pie']);

const na = loadFixture('那');
const naTypes = autoTypes(na);
process.stdout.write(`那 黏耳後 ${na.medians.length} 筆 ${naTypes.join(',')}\n`);
if (na.medians.length !== 6 || naTypes[4] !== 'hengpiewangou' || naTypes[5] !== 'zhi') {
  process.stdout.write('那 右耳應為橫撇彎鈎、直\n');
  process.exitCode = 1;
} else {
  process.stdout.write('那 右耳 OK\n');
}

const jin = loadFixture('進');
if (jin.medians.length !== 11) {
  process.stdout.write(`進 走之底應黏成 11 筆，得到 ${jin.medians.length}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write('進 黏平捺 OK\n');
}
const jinTypes = autoTypes(jin);
expectTypes('進', jinTypes, [
  'pie',
  'zhi',
  'dian',
  'heng',
  'heng',
  'heng',
  'zhi',
  'heng',
  'dian',
  'hengpie',
  'na',
]);
if (jinTypes[8] !== 'dian' || jinTypes[9] !== 'hengpie' || jinTypes[10] !== 'na') {
  process.stdout.write('進 走之底應為點、橫撇、捺\n');
  process.exitCode = 1;
}

const zhiChar = loadFixture('之');
expectTypes('之', autoTypes(zhiChar), ['dian', 'hengpie', 'na']);

const zhe = loadFixture('這');
if (zhe.medians.length !== 10) {
  process.stdout.write(`這 走之底應黏成 10 筆，得到 ${zhe.medians.length}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write('這 黏平捺 OK\n');
}
const zheTypes = autoTypes(zhe);
if (zheTypes.at(-3) !== 'dian' || zheTypes.at(-2) !== 'hengpie' || zheTypes.at(-1) !== 'na') {
  process.stdout.write(`這 走之底 FAIL ${zheTypes.join(',')}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write('這 走之底 點、橫撇、捺 OK\n');
}

resetStrokeLocksForTests();
setStrokeLock('口', 1, 'hengpie');
const kouLocked = fillStrokeTypes(
  kou.medians,
  applyStrokeLocks('口', kou.strokeTypes, kou.medians.length),
  '口'
);
if (kouLocked[1] !== 'hengpie') {
  process.stdout.write(`老師鎖定 FAIL ${kouLocked.join(',')}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write('老師鎖定 口第二筆 橫撇 OK\n');
}
resetStrokeLocksForTests();

resetStrokeLayoutsForTests();
const kouAuto = autoTypes(kou);
ensureStrokeLayout('口', kouAuto);
insertLayoutItem('口', kouAuto.length - 1, 'dian');
const kouPlus = applyStrokeLayout({ ...kou, strokeTypes: kouAuto });
if (
  kouPlus.strokeTypes.length !== kouAuto.length + 1 ||
  kouPlus.strokeTypes.at(-1) !== 'dian' ||
  kouPlus.synthetic?.at(-1) !== true ||
  kouPlus.strokes.at(-1) !== '' ||
  inkStrokePaths(kouPlus).length !== kou.strokes.length
) {
  process.stdout.write(`老師加筆 FAIL ${kouPlus.strokeTypes.join(',')}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write('老師加筆 口 +點 OK\n');
}
const kouPlusSlots = slotsForChar(kouPlus);
if (kouPlusSlots.length !== kouPlus.medians.length || !Number.isFinite(kouPlusSlots.at(-1)?.cx ?? NaN)) {
  process.stdout.write('老師加筆 槽位 FAIL\n');
  process.exitCode = 1;
}
if (!removeLayoutItem('口', 1) || applyStrokeLayout({ ...kou, strokeTypes: kouAuto }).strokeTypes.length !== 3) {
  process.stdout.write('老師刪筆 FAIL\n');
  process.exitCode = 1;
} else {
  process.stdout.write('老師刪筆 口 剩 3 筆 OK\n');
}
resetStrokeLayoutsForTests();

const kouIssue = inspectChar({ ...kou, strokeTypes: kouAuto, char: '口' });
if (kouIssue) {
  process.stdout.write(`口不該進例外清單 ${kouIssue.kind} ${kouIssue.detail}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write('口 不在例外清單 OK\n');
}
const bundledGui = (bundled as Record<string, CharData>)['龜'];
if (!bundledGui?.strokes || bundledGui.strokes.length < 12) {
  process.stdout.write('小學字包應含龜 FAIL\n');
  process.exitCode = 1;
} else {
  process.stdout.write(`小學字包 龜 ${bundledGui.strokes.length} 筆 OK\n`);
}
const leftover = unusedOfficialNames('口', ['zhi', 'na', 'dian']);
if (!leftover.includes('hengzhi')) {
  process.stdout.write(`衝突偵測 FAIL ${leftover.join(',')}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write('例外清單 口橫直對不上 OK\n');
}

const kouSlots = slotsForChar({ ...kou, strokeTypes: kouAuto });
const freeBoot = sizeForCharStroke('zhiwangou', kouSlots, 0.8, 0.8);
const genericBoot = defaultObjectScale('zhiwangou');
if (!(freeBoot.sx <= genericBoot + 0.001 && freeBoot.sy <= genericBoot + 0.001)) {
  process.stdout.write(`未吸附大小應跟字走 FAIL slot=${freeBoot.sx},${freeBoot.sy} generic=${genericBoot}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(
    `未吸附大小跟口的槽位走 OK ${freeBoot.sx.toFixed(3)}x${freeBoot.sy.toFixed(3)} < ${genericBoot.toFixed(3)}\n`
  );
}
const zhiFit = sizeForCharStroke('zhi', kouSlots, kouSlots[0].cx, kouSlots[0].cy);
const zhiInk = objectSize(kouSlots[0], 'zhi');
if (Math.abs(zhiFit.sx - zhiInk.sx) > 0.001 || Math.abs(zhiFit.sy - zhiInk.sy) > 0.001) {
  process.stdout.write(`同種類應貼墨跡 FAIL ${zhiFit.sx},${zhiFit.sy} vs ${zhiInk.sx},${zhiInk.sy}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write('同種類物品貼該筆墨跡 OK\n');
}

const guiData = (bundled as Record<string, CharData>)['龜'];
if (guiData) {
  const guiTypes = fillStrokeTypes(guiData.medians, guiData.strokeTypes, '龜');
  const guiSlots = slotsForChar({ ...guiData, strokeTypes: guiTypes });
  const bootSlot = guiSlots.find((s) => s.strokeId === 'zhiwangou');
  const bootFree = sizeForCharStroke('zhiwangou', guiSlots, 0.2, 0.2);
  const bootLong = Math.max(bootFree.sx, bootFree.sy);
  if (bootLong >= 0.28) {
    process.stdout.write(`龜未吸附長靴太大 FAIL ${bootFree.sx.toFixed(3)}x${bootFree.sy.toFixed(3)}\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write(`龜未吸附長靴 ${bootFree.sx.toFixed(3)}x${bootFree.sy.toFixed(3)} OK\n`);
  }
  if (bootSlot) {
    const snapped = fitToSlot('zhiwangou', bootSlot);
    const ink = objectSize(bootSlot, 'zhiwangou');
    if (Math.abs(snapped.scale - ink.sx) > 0.001 || Math.abs((snapped.scaleY ?? snapped.scale) - ink.sy) > 0.001) {
      process.stdout.write(`龜吸附長靴應跟墨跡 FAIL snap=${snapped.scale},${snapped.scaleY} ink=${ink.sx},${ink.sy}\n`);
      process.exitCode = 1;
    } else {
      process.stdout.write(`龜吸附長靴跟墨跡 ${ink.sx.toFixed(3)}x${ink.sy.toFixed(3)} OK\n`);
    }
    const aspectFree = bootFree.sx / Math.max(bootFree.sy, 0.001);
    const aspectInk = ink.sx / Math.max(ink.sy, 0.001);
    if (Math.abs(aspectFree - aspectInk) > 0.05) {
      process.stdout.write(`龜長靴長寬比應相符 FAIL free=${aspectFree.toFixed(3)} ink=${aspectInk.toFixed(3)}\n`);
      process.exitCode = 1;
    }
  } else {
    process.stdout.write('龜應有直彎鈎 FAIL\n');
    process.exitCode = 1;
  }
}

