import { isStrokeId } from '@/data/strokes';
import { officialFitsGeometry, officialFitsReordered, officialStrokeTypes } from '@/lib/officialStrokes';
import type { Median, StrokeId } from '@/types';

/**
 * 由一筆的中線自動判出是 24 種筆畫的哪一種。
 *
 * 老師加生字時不必人工複核：有人工標註就沿用；否則先依動畫中線做幾何分類
 * （與字卡動畫同一筆序），再開源名稱在「同一條路徑」上訂正，筆序對不上才
 * 改配到外形相符的另一筆。漢字起筆常有一小段「入筆」斜勢，會先削掉再比對。
 */

type Dir = 'h' | 'n' | 'v' | 'p' | 'l' | 'q' | 'u' | 't';

interface Seg {
  dir: Dir;
  len: number;
  heading: number;
  dx: number;
  dy: number;
}

export interface StrokeShape {
  tokens: string;
  collapsed: string;
  lengths: number[];
  tailRatio: number;
  span: number;
  pathLen: number;
  startDeg: number;
  endDeg: number;
  /** 外框高／寬。用來把「難」裡短而高的直，跟「心」裡向下的點分開。 */
  boxW: number;
  boxH: number;
  firstDeg: number;
  firstDx: number;
  firstLen: number;
  lastDx: number;
  lastDy: number;
  lastLen: number;
  /** 轉角最大的那一折（左折為負）。用來分撇趯與直橫。 */
  turnDeg: number;
}

function toScreen([x, y]: [number, number]): [number, number] {
  return [x, 900 - y];
}

function dist(a: [number, number], b: [number, number]): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

function heading(a: [number, number], b: [number, number]): number {
  return (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
}

function turnDelta(from: number, to: number): number {
  let t = to - from;
  while (t > 180) t -= 360;
  while (t < -180) t += 360;
  return t;
}

/** Ramer–Douglas–Peucker：找出折線的轉角。 */
function simplify(points: [number, number][], tolerance: number): [number, number][] {
  if (points.length < 3) return points.slice();
  const first = points[0];
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

function direction(deg: number): Dir {
  if (deg >= -22 && deg <= 22) return 'h';
  if (deg > 22 && deg <= 68) return 'n';
  if (deg > 68 && deg <= 112) return 'v';
  if (deg > 112 && deg <= 158) return 'p';
  if (deg > 158 || deg <= -158) return 'l';
  if (deg > -158 && deg <= -112) return 'q';
  if (deg > -112 && deg <= -68) return 'u';
  return 't';
}

function collapseDirs(tokens: string): string {
  return tokens.replace(/(.)\1+/g, '$1');
}

/**
 * 起筆常有一小段入筆斜勢。佔整筆不到三成就削掉，
 * 否則「十」的直會變成 nv，被誤判成捺。
 */
function stripLeadIn(segs: Seg[]): Seg[] {
  if (segs.length < 2) return segs;
  const total = segs.reduce((s, x) => s + x.len, 0) || 1;
  const first = segs[0];
  const ratio = first.len / total;
  if (first.dir === 'n' && ratio < 0.32) return segs.slice(1);
  if (first.dir === 't' && segs.length >= 3) return segs.slice(1);
  if (first.dir === 't' && ratio < 0.28) return segs.slice(1);
  return segs;
}

export function describeMedian(median: Median): StrokeShape {
  const pts = median.map(toScreen);
  const corners = simplify(pts, 42);
  const raw: Seg[] = [];
  for (let i = 0; i < corners.length - 1; i += 1) {
    const a = corners[i];
    const b = corners[i + 1];
    const deg = heading(a, b);
    raw.push({
      dir: direction(deg),
      len: dist(a, b),
      heading: deg,
      dx: b[0] - a[0],
      dy: b[1] - a[1],
    });
  }
  const segs = stripLeadIn(raw);
  const total = segs.reduce((s, x) => s + x.len, 0) || 1;
  const tokens = segs.map((s) => s.dir).join('');
  const first = pts[0];
  const last = pts[pts.length - 1];
  const tail = segs[segs.length - 1];
  const head = segs[0];
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);

  let turnDeg = 0;
  for (let i = 1; i < segs.length; i += 1) {
    const t = turnDelta(segs[i - 1].heading, segs[i].heading);
    if (Math.abs(t) > Math.abs(turnDeg)) turnDeg = t;
  }

  return {
    tokens,
    collapsed: collapseDirs(tokens),
    lengths: segs.map((s) => Math.round((s.len / total) * 100)),
    tailRatio: tail ? Math.round((tail.len / total) * 100) : 0,
    span: Math.round(dist(first, last)),
    pathLen: Math.round(total),
    boxW: Math.max(...xs) - Math.min(...xs),
    boxH: Math.max(...ys) - Math.min(...ys),
    startDeg: heading(first, last),
    endDeg: tail?.heading ?? 0,
    firstDeg: head?.heading ?? 0,
    firstDx: head?.dx ?? 0,
    firstLen: head?.len ?? 0,
    lastDx: tail?.dx ?? 0,
    lastDy: tail?.dy ?? 0,
    lastLen: tail?.len ?? 0,
    turnDeg,
  };
}

/** 橫直（曲尺）vs 橫撇（三角旗）：看折後那一段，不要只看方向字母。 */
function pickHengzhiOrHengpie(s: StrokeShape): StrokeId {
  const lastH = s.endDeg;
  const firstLen = Math.max(s.firstLen, 1);
  const aspect = s.boxH / Math.max(s.boxW, 1);
  const absDx = Math.abs(s.lastDx);
  const absDy = Math.abs(s.lastDy) || 1;
  const fallRatio = s.lastLen / firstLen;

  // 口、日：折後接近垂直
  if (lastH >= 70 && lastH <= 112 && absDx < absDy * 0.55) return 'hengzhi';
  // 了、又：折後明顯長撇
  if (lastH >= 132) return 'hengpie';
  // 灰區：子旁（孔、好）尾段比口的右上折長；豆的口折又短又扁
  if (fallRatio >= 0.5 || aspect >= 0.5) return 'hengpie';
  return 'hengzhi';
}

/** 撇趯（畚箕）vs 直橫（沙發）：第一段有沒有明顯往左，轉角是銳角還是直角。 */
function pickPietiOrZhizheng(s: StrokeShape): StrokeId {
  if (s.firstDeg >= 105 || s.firstDx < -40 || s.turnDeg <= -115) return 'pieti';
  return 'zhizheng';
}

/** 橫撇彎鈎（ㄋ／耳機）不是橫直鈎（7／衣帽鈎），也不是臥鈎（心／湯匙）。 */
function isHengpiewangou(c: string): boolean {
  if (!c.startsWith('h') || !/[qlut]$/.test(c) || c.length < 3) return false;
  if (/^hv[p]?[ql]+$/.test(c) || /^hn?v[ql]+$/.test(c)) return false;
  return /p/.test(c);
}

function scoreShape(s: StrokeShape): StrokeId {
  const c = s.collapsed;
  const span = s.span;

  if (c === 'v' && span < 270) {
    const aspect = s.boxH / Math.max(s.boxW, 1);
    if (s.startDeg >= 105 && aspect < 3) return 'pie';
    return 'dian';
  }
  if (c === 'h') return 'heng';
  if (c === 'v' || c === 'u') return 'zhi';
  if (c === 't' || c === 'ht') return 'ti';

  if (c === 'p' || c === 'l') return span < 170 ? 'dian' : 'pie';
  if (c === 'vp') return span < 330 ? 'dian' : 'pie';

  if (c === 'n' || c === 'np') {
    const aspect = s.boxH / Math.max(s.boxW, 1);
    if (aspect >= 1.65 && s.startDeg >= 55 && s.startDeg <= 115 && span < 320) return 'zhi';
    return span < 340 ? 'dian' : 'na';
  }

  // 有鈎的複合筆先於「橫直／橫撇」，避免把ㄋ看成三角旗或衣帽鈎
  if (/^hv[p]?[ql]+$/.test(c) || /^nvl$/.test(c) || /^hn?v[ql]+$/.test(c)) return 'hengzhigou';
  if (isHengpiewangou(c) || /^hp+[nv]*[ut]$/.test(c)) return 'hengpiewangou';
  if (/^hv+[nhtu]*[ut]$/.test(c) || c === 'hvnhu') return 'hengzhewangou';
  if (/^h[nv]+[ut]$/.test(c)) return 'hengwangou';

  if (/^hn?v$/.test(c) || c === 'hv' || c === 'hp' || c === 'hnp' || /^hvp+$/.test(c) || /^hn?p+$/.test(c)) {
    return pickHengzhiOrHengpie(s);
  }
  if ((c === 'hp' || c === 'hv') && s.tailRatio < 35) return 'henggou';
  if (c === 'hq' || (c === 'hp' && s.tailRatio < 40)) return 'henggou';

  if (c === 'vh') return pickPietiOrZhizheng(s);
  if (c === 'vhv') return 'zhizhengzhi';
  if (/^vhv[lqp]+$/.test(c)) return 'zhizhengzhigou';

  if (c === 'vq' || c === 'vl' || /^v[p]?[ql]$/.test(c)) return 'zhigou';
  if (c === 'vt' || c === 'vht') return 'zhiti';

  if (c === 'vn' || c === 'pn' || /^p+n$/.test(c)) return 'piedian';

  if (/^vh[ut]$/.test(c) || c === 'vnhtu') return 'zhiwangou';
  if (c === 'vnu' || c === 'nu' || c === 'ntu' || /^vn+u$/.test(c)) return 'xiegou';
  if (/^vn+[ht]?u$/.test(c)) return span > 700 ? 'xiegou' : 'zhiwangou';

  if (/^p+[ht]$/.test(c) || c === 'ph') return 'pieti';
  if (c === 'nu' || c === 'nt') return span > 480 ? 'xiegou' : 'ti';

  if (c === 'nnhq' || c === 'nhq' || /^n+h?q$/.test(c)) return 'wogou';
  if (s.pathLen > span * 1.35 && /q$/.test(c) && !c.startsWith('v') && !c.startsWith('h')) return 'wogou';

  if (c === 'nvq' || /^n?v?[nq]+[ql]$/.test(c)) return 'wangou';

  if (c.startsWith('h') && /[ql]/.test(c)) return isHengpiewangou(c) ? 'hengpiewangou' : 'hengzhigou';
  if (c.startsWith('h') && /p/.test(c)) return pickHengzhiOrHengpie(s);
  if (c.startsWith('v') && /[ql]/.test(c)) return 'zhigou';
  if (c.startsWith('v') && c.includes('h')) {
    if (/v.*h.*v/.test(c)) return 'zhizhengzhi';
    return pickPietiOrZhizheng(s);
  }
  if (c.startsWith('p') && /[ht]/.test(c)) return 'pieti';
  if (c.startsWith('n') && /[ut]/.test(c) && span > 500) return 'xiegou';

  if (span < 300) return 'dian';
  if (Math.abs(s.startDeg) <= 25) return 'heng';
  if (s.startDeg > 70 && s.startDeg < 110) return 'zhi';
  if (s.startDeg > 110) return 'pie';
  if (s.startDeg < -20) return 'ti';
  return 'na';
}

export function classifyMedian(median: Median): StrokeId {
  return scoreShape(describeMedian(median));
}

/**
 * 填滿每一筆的種類。已有的人工標註原樣保留。
 *
 * 老師加生字時：每一件物品對應動畫的第 n 筆路徑，不能拿另一套筆序的名稱
 * 按索引硬套。開源名稱用來訂正／改配，幾何對不上的就維持中線判斷。
 */
export function fillStrokeTypes(
  medians: Median[],
  existing: (StrokeId | null | string)[] | null | undefined,
  char?: string
): StrokeId[] {
  const locked = medians.map((_, i) => isStrokeId(existing?.[i]));
  const types = medians.map((median, i) => {
    const prev = existing?.[i];
    if (isStrokeId(prev)) return prev;
    return classifyMedian(median);
  });

  /**
   * 「難」「花」的卝／廿是兩條並排短直，單獨看很像「心」的點。
   * 連在一起出現就改回直；「心」「必」只有一條，不會被誤傷。
   */
  for (let i = 0; i < types.length - 1; i += 1) {
    if (locked[i] || locked[i + 1]) continue;
    if (types[i] !== 'dian' || types[i + 1] !== 'dian') continue;
    const a = describeMedian(medians[i]);
    const b = describeMedian(medians[i + 1]);
    const tall = (s: StrokeShape) => s.boxH > s.boxW * 1.6 && Math.abs(s.startDeg - 90) < 28;
    if (tall(a) && tall(b)) {
      types[i] = 'zhi';
      types[i + 1] = 'zhi';
    }
  }

  /**
   * 「口」形左邊那豎：前一筆橫、後一筆橫直，中間短斜畫是直不是點。
   * 「難」第五畫就是這個結構。
   */
  for (let i = 1; i < types.length - 1; i += 1) {
    if (locked[i]) continue;
    if (types[i] !== 'dian') continue;
    if (types[i - 1] !== 'heng' || types[i + 1] !== 'hengzhi') continue;
    const s = describeMedian(medians[i]);
    if (s.boxH > s.boxW * 1.35 && s.startDeg > 40) types[i] = 'zhi';
  }

  /**
   * 口框：直 + 折 + 橫，中間那折是橫直（曲尺），不是橫撇（三角旗）。
   * 「豆」「頭」「員」的口都是這個鄰居關係；「了」「又」後面不是橫，不會被改。
   */
  for (let i = 1; i < types.length - 1; i += 1) {
    if (locked[i]) continue;
    if (types[i - 1] !== 'zhi' || types[i + 1] !== 'heng') continue;
    if (types[i] === 'hengpie' || types[i] === 'henggou') types[i] = 'hengzhi';
  }

  applyOfficialNames(types, locked, char);
  return types;
}

/**
 * 用開源名稱訂正幾何，但物品仍按動畫筆序出現。
 *
 *   1. 筆數相同：同一索引若外形相容，用名稱訂正（複合筆常被幾何看成開頭那一段）
 *   2. 名稱表的未知碼（`.`）維持幾何，例如「必」第二筆臥鈎
 *   3. 對不上的名稱改配到尚未標定、外形相符的另一筆（「必」的撇與點順序不同）
 *
 * 絕不按另一套筆序整列覆蓋，否則水滴會出現在撇的路徑上。
 */
function applyOfficialNames(types: StrokeId[], locked: boolean[], char?: string) {
  if (!char) return;
  const official = officialStrokeTypes(char);
  if (!official?.length) return;

  const n = types.length;
  const taken = types.map((_, i) => locked[i]);
  const used = official.map(() => false);

  if (official.length === n) {
    for (let i = 0; i < n; i += 1) {
      if (taken[i]) continue;
      const want = official[i];
      if (!want) {
        taken[i] = true;
        used[i] = true;
        continue;
      }
      if (officialFitsGeometry(types[i], want)) {
        types[i] = want;
        taken[i] = true;
        used[i] = true;
      }
    }
  }

  const freeMedians: number[] = [];
  for (let i = 0; i < n; i += 1) {
    if (!taken[i]) freeMedians.push(i);
  }
  const freeNames: { index: number; want: StrokeId }[] = [];
  for (let j = 0; j < official.length; j += 1) {
    const want = official[j];
    if (used[j] || !want) continue;
    freeNames.push({ index: j, want });
  }

  while (freeMedians.length && freeNames.length) {
    let bestI = -1;
    let bestJ = -1;
    let bestCost = Infinity;
    for (let a = 0; a < freeMedians.length; a += 1) {
      const i = freeMedians[a];
      for (let b = 0; b < freeNames.length; b += 1) {
        const { index: j, want } = freeNames[b];
        if (!officialFitsReordered(types[i], want)) continue;
        const cost = (types[i] === want ? 0 : 10) + Math.abs(i - j);
        if (cost < bestCost) {
          bestCost = cost;
          bestI = a;
          bestJ = b;
        }
      }
    }
    if (bestI < 0) break;
    const i = freeMedians.splice(bestI, 1)[0];
    const picked = freeNames.splice(bestJ, 1)[0];
    types[i] = picked.want;
  }
}
