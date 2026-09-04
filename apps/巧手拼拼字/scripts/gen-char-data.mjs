#!/usr/bin/env node
/**
 * 抓取字形筆順資料，產生 src/data/chars.json。
 *
 * 筆順資料三層優先序：
 *   1. overrides/<字>.json    人工修正檔，最高優先
 *   2. animCJK ZhHant         繁體筆順，animCJK 明列香港《小學學習字詞表》為參考來源
 *   3. makemeahanzi           內地筆順與 Arphic 字形，覆蓋率高但標為待核
 *
 * 筆畫種類（24 件物品對哪一筆）不靠猜：只有 verified-strokes.mjs 裡人工覈核、
 * 且筆數與抓回來的資料吻合的字，才寫入 strokeTypes。其餘留 null 並標 verified: false。
 * 分類器只產生建議，寫進 stroke-report.json 供人工覈核，絕不直接當成答案。
 *
 * 用法：node scripts/gen-char-data.mjs
 */
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PENDING_CHARS, PRIMARY_BUNDLE, VERIFIED_STROKES } from './verified-strokes.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const OVERRIDES = resolve(HERE, 'overrides');
const OUT = resolve(HERE, '../src/data/chars.json');
const METRICS = resolve(HERE, '../src/data/strokeMetrics.json');
const REPORT = resolve(HERE, 'stroke-report.json');

const ZHHANT = (ch) =>
  `https://cdn.jsdelivr.net/npm/hanzi-writer-data-acjk@1.0.0/animCJK/ZhHant/${encodeURIComponent(ch)}.json`;
const MMAH = (ch) =>
  `https://cdn.jsdelivr.net/npm/hanzi-writer-data@latest/${encodeURIComponent(ch)}.json`;

// ── 抓取 ──

async function fetchJson(url) {
  const res = await fetch(url);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

async function loadOverride(ch) {
  try {
    const raw = await readFile(join(OVERRIDES, `${ch}.json`), 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function loadChar(ch) {
  const override = await loadOverride(ch);
  if (override) return { data: override, source: 'override' };

  const zh = await fetchJson(ZHHANT(ch));
  if (zh) return { data: zh, source: 'ZhHant' };

  const mm = await fetchJson(MMAH(ch));
  if (mm) return { data: mm, source: 'makemeahanzi' };

  return null;
}

// ── 幾何：把 median 折線化簡成方向序列，只用來產生「建議」 ──

/** makemeahanzi 座標系邊長 1024、左上為 (0,900)、y 軸向下遞減，轉成一般螢幕座標。 */
const GRID = 1024;
const toScreen = ([x, y]) => [x, 900 - y];

const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);

/** Ramer–Douglas–Peucker：找出折線的轉角。 */
function simplify(points, tolerance) {
  if (points.length < 3) return points.slice();
  const [first] = points;
  const last = points[points.length - 1];

  let worst = 0;
  let worstIndex = 0;
  const dx = last[0] - first[0];
  const dy = last[1] - first[1];
  const norm = Math.hypot(dx, dy) || 1;

  for (let i = 1; i < points.length - 1; i += 1) {
    const p = points[i];
    const d = Math.abs(dy * (p[0] - first[0]) - dx * (p[1] - first[1])) / norm;
    if (d > worst) {
      worst = d;
      worstIndex = i;
    }
  }

  if (worst <= tolerance) return [first, last];
  return [
    ...simplify(points.slice(0, worstIndex + 1), tolerance).slice(0, -1),
    ...simplify(points.slice(worstIndex), tolerance),
  ];
}

/** 方向代號：h 橫 n 右下 v 下 p 左下 l 向左 q 左上 u 上 t 右上 */
function direction([a, b]) {
  const deg = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
  if (deg >= -20 && deg <= 20) return 'h';
  if (deg > 20 && deg <= 70) return 'n';
  if (deg > 70 && deg <= 110) return 'v';
  if (deg > 110 && deg <= 165) return 'p';
  if (deg > 165 || deg <= -165) return 'l';
  if (deg > -165 && deg <= -110) return 'q';
  if (deg > -110 && deg <= -70) return 'u';
  return 't';
}

/** 把一筆的 median 轉成 { tokens, total, tailRatio }，供人工看。 */
function describe(median) {
  const pts = median.map(toScreen);
  const corners = simplify(pts, 42);
  const segments = [];
  for (let i = 0; i < corners.length - 1; i += 1) {
    const seg = [corners[i], corners[i + 1]];
    segments.push({ dir: direction(seg), len: dist(seg[0], seg[1]) });
  }
  const total = segments.reduce((sum, s) => sum + s.len, 0) || 1;
  const tail = segments[segments.length - 1];
  return {
    tokens: segments.map((s) => s.dir).join(''),
    lengths: segments.map((s) => Math.round((s.len / total) * 100)),
    tailRatio: Math.round((tail.len / total) * 100),
    span: Math.round(dist(pts[0], pts[pts.length - 1])),
  };
}

/**
 * 方向序列 → 筆畫建議。刻意保守，看不準就回 null 讓人來判。
 * 起筆常有一小段入筆動作（多半是 n），所以樣式容許開頭多一個 n。
 */
const SUGGESTIONS = [
  [/^h$/, 'heng'],
  [/^v$/, 'zhi'],
  [/^n?[vp]?p+$/, 'pie'],
  [/^n+h?$/, 'na'],
  [/^t$/, 'ti'],
  [/^n?hv$/, 'hengzhi'],
  [/^n?hv[lq]+$/, 'hengzhigou'],
  [/^n?h[np]p*$/, 'hengpie'],
  [/^n?hp+[nv]*[ut]$/, 'hengpiewangou'],
  [/^n?hv+[nhtu]*[ut]$/, 'hengzhewangou'],
  [/^n?h[nv]+[ut]$/, 'hengwangou'],
  [/^n?h[pv]$/, 'henggou'],
  [/^n?vh$/, 'zhizheng'],
  [/^n?vhv$/, 'zhizhengzhi'],
  [/^n?vhv[lq]+$/, 'zhizhengzhigou'],
  [/^n?v[pq]*[lq]$/, 'zhigou'],
  [/^n?v[nh]+[ut]$/, 'zhiwangou'],
  [/^n?vt$/, 'zhiti'],
  [/^n?p+n$/, 'piedian'],
  [/^n?p+[ht]$/, 'pieti'],
  [/^n?[nn]*[hn]+[hq]?[ut]$/, 'wogou'],
  [/^n+[ut]$/, 'xiegou'],
];

/** 點在各字裡都很短，先按長度攔下來，不要落到「捺」去。 */
const DIAN_MAX_SPAN = 260;

function suggest(shape) {
  if (shape.tokens.length <= 1 && shape.span < DIAN_MAX_SPAN) return 'dian';
  for (const [pattern, id] of SUGGESTIONS) {
    if (pattern.test(shape.tokens)) return id;
  }
  return null;
}

// ── 每種筆畫的基準角度 ──

/**
 * 算出每種筆畫的「基準角度」：該筆畫在已核對字裡首末點連線角度的中位數。
 *
 * 這個數字是給前端拿來抵銷旋轉用的。24 件物品圖各自已經畫成該筆畫的樣子
 * （曲尺本來就是 ┐、羽毛本來就從右上撇到左下），所以畫面上實際要轉的角度是
 * 「這一筆的角度 − 基準角度」。典型的字轉出來接近 0 度，物件維持它被畫出來的樣子；
 * 偏一點的字才會得到一點修正。若直接照筆畫角度轉，折角類的物件會整個轉歪。
 *
 * 同時記錄外框最大邊的中位數，前端拿它當物件的預設大小下限。
 */
function strokeMetrics(chars) {
  const buckets = {};

  for (const data of Object.values(chars)) {
    if (!data.verified) continue;
    data.medians.forEach((median, i) => {
      const id = data.strokeTypes[i];
      if (!id) return;
      const pts = median.map(toScreen);
      const first = pts[0];
      const last = pts[pts.length - 1];
      const xs = pts.map((p) => p[0]);
      const ys = pts.map((p) => p[1]);
      (buckets[id] = buckets[id] ?? []).push({
        angle: (Math.atan2(last[1] - first[1], last[0] - first[0]) * 180) / Math.PI,
        extent: Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) / GRID,
      });
    });
  }

  const median = (values) => {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  };

  const out = {};
  for (const [id, list] of Object.entries(buckets)) {
    out[id] = {
      samples: list.length,
      baseAngle: Math.round(median(list.map((s) => s.angle))),
      extent: Number(median(list.map((s) => s.extent)).toFixed(3)),
    };
  }
  return out;
}

// ── 主流程 ──

async function main() {
  const wanted = [...new Set([...Object.keys(VERIFIED_STROKES), ...PENDING_CHARS, ...PRIMARY_BUNDLE])];
  process.stdout.write(`處理 ${wanted.length} 字\n`);

  try {
    await readdir(OVERRIDES);
  } catch {
    await mkdir(OVERRIDES, { recursive: true });
  }

  const chars = {};
  const report = [];
  const problems = [];

  for (const ch of wanted) {
    const loaded = await loadChar(ch);
    if (!loaded) {
      problems.push(`${ch}：三個來源都沒有筆順資料`);
      continue;
    }
    const { data, source } = loaded;
    const strokes = data.strokes ?? [];
    const medians = data.medians ?? [];
    if (!strokes.length || strokes.length !== medians.length) {
      problems.push(`${ch}：strokes 與 medians 長度不符（${strokes.length}/${medians.length}）`);
      continue;
    }

    const hand = VERIFIED_STROKES[ch];
    let strokeTypes = medians.map(() => null);
    let verified = false;

    if (hand) {
      if (hand.length === strokes.length) {
        strokeTypes = hand.slice();
        verified = true;
      } else {
        problems.push(
          `${ch}：人工標了 ${hand.length} 筆，但 ${source} 資料是 ${strokes.length} 筆，先當待核`
        );
      }
    }

    const shapes = medians.map((m) => describe(m));
    report.push({
      char: ch,
      source,
      verified,
      strokes: shapes.map((shape, i) => ({
        index: i + 1,
        tokens: shape.tokens,
        lengths: shape.lengths,
        tailRatio: shape.tailRatio,
        span: shape.span,
        human: strokeTypes[i],
        suggested: suggest(shape),
      })),
    });

    chars[ch] = { char: ch, strokes, medians, strokeTypes, source, verified };
  }

  const verifiedCount = Object.values(chars).filter((c) => c.verified).length;

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(chars), 'utf8');
  await writeFile(METRICS, JSON.stringify(strokeMetrics(chars), null, 2) + '\n', 'utf8');
  await writeFile(REPORT, JSON.stringify(report, null, 2) + '\n', 'utf8');

  process.stdout.write(`寫入 ${OUT}\n`);
  process.stdout.write(`寫入 ${METRICS}\n`);
  process.stdout.write(`  已核對 ${verifiedCount} 字，待核 ${Object.keys(chars).length - verifiedCount} 字\n`);
  process.stdout.write(`報告 ${REPORT}\n`);

  if (problems.length) {
    process.stdout.write(`\n需要注意（${problems.length}）：\n`);
    for (const p of problems) process.stdout.write(`  - ${p}\n`);
  }

  // 建議與人工標註不一致的地方，列出來讓人再看一眼
  const disagreements = [];
  for (const entry of report) {
    for (const s of entry.strokes) {
      if (s.human && s.suggested && s.human !== s.suggested) {
        disagreements.push(`${entry.char} 第${s.index}筆：人工 ${s.human} / 建議 ${s.suggested} (${s.tokens})`);
      }
    }
  }
  if (disagreements.length) {
    process.stdout.write(`\n分類器與人工標註不一致（${disagreements.length}），僅供覈核：\n`);
    for (const d of disagreements) process.stdout.write(`  - ${d}\n`);
  }
}

main().catch((err) => {
  process.stderr.write(`${err.message}\n`);
  process.exit(1);
});
