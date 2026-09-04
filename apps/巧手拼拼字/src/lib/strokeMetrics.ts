import generated from '@/data/strokeMetrics.json';
import { STROKE_BY_ID } from '@/data/strokes';
import type { StrokeId, StrokeSlot } from '@/types';

/**
 * 每種筆畫的「基準角度」與典型大小。
 *
 * 24 件物品圖各自已經畫成該筆畫的樣子：曲尺本來就是 ┐、羽毛本來就從右上撇到左下、
 * 湯匙本來就躺平。所以畫面上實際要轉的角度是「這一筆的角度 − 基準角度」，
 * 典型的字轉出來接近 0 度，物件維持它被畫出來的樣子。
 * 若直接照筆畫角度去轉，折角類的物件會整個轉歪。
 *
 * 數字由 scripts/gen-char-data.mjs 從已核對的字算出來（首末點連線角度的中位數），
 * 所以永遠跟字庫同步。下面的 FALLBACK 只補「字庫裡還沒有已核對樣本」的那幾筆。
 */

interface Metric {
  baseAngle: number;
  extent: number;
}

const GENERATED = generated as Record<string, { baseAngle: number; extent: number; samples: number }>;

/** 字庫還沒有已核對樣本的筆畫，先按筆形估一個，等字補進來就會被實測值取代。 */
const FALLBACK: Partial<Record<StrokeId, Metric>> = {
  henggou: { baseAngle: 30, extent: 0.34 },
  hengpiewangou: { baseAngle: 75, extent: 0.5 },
  hengwangou: { baseAngle: 25, extent: 0.6 },
  hengzhewangou: { baseAngle: 25, extent: 0.62 },
  zhizhengzhi: { baseAngle: 35, extent: 0.5 },
  zhizhengzhigou: { baseAngle: 75, extent: 0.6 },
  wangou: { baseAngle: 95, extent: 0.6 },
};

export function metricFor(id: StrokeId): Metric {
  const gen = GENERATED[id];
  if (gen) return { baseAngle: gen.baseAngle, extent: gen.extent };
  return FALLBACK[id] ?? { baseAngle: 0, extent: 0.45 };
}

function clampScale(n: number): number {
  return Math.min(1.08, Math.max(0.06, n));
}

/**
 * 物品圖裡真正有像素的比例（相對 512 正方形）。
 * 用這個把圖拉到墨跡外框，才不會讓曲尺、水滴對不準字影。
 */
const CONTENT: Record<string, { w: number; h: number }> = {
  heng: { w: 0.984, h: 0.098 },
  zhi: { w: 0.193, h: 0.984 },
  pie: { w: 0.914, h: 0.984 },
  na: { w: 0.984, h: 0.916 },
  ti: { w: 0.98, h: 0.938 },
  'dian:up': { w: 0.641, h: 0.98 },
  hengzhi: { w: 0.984, h: 0.703 },
  hengzhigou: { w: 0.684, h: 0.984 },
  hengpie: { w: 0.773, h: 0.984 },
  hengpiewangou: { w: 0.635, h: 0.852 },
  hengwangou: { w: 0.855, h: 0.98 },
  hengzhewangou: { w: 0.988, h: 0.928 },
  henggou: { w: 0.98, h: 0.328 },
  zhizheng: { w: 0.98, h: 0.922 },
  zhizhengzhi: { w: 0.602, h: 0.984 },
  zhizhengzhigou: { w: 0.41, h: 0.984 },
  zhigou: { w: 0.219, h: 0.984 },
  zhiwangou: { w: 0.705, h: 0.984 },
  zhiti: { w: 0.473, h: 0.984 },
  piedian: { w: 0.777, h: 0.984 },
  pieti: { w: 0.504, h: 0.984 },
  wangou: { w: 0.535, h: 0.984 },
  wogou: { w: 0.984, h: 0.41 },
  xiegou: { w: 0.984, h: 0.918 },
};

function contentBox(id: StrokeId, _variantKey?: string): { w: number; h: number } {
  if (id === 'dian') return CONTENT['dian:up'];
  return CONTENT[id] ?? { w: 0.92, h: 0.92 };
}

/** 格子上實際要畫的寬高（物品圖外框，佔格寬比例）。 */
export function objectSize(
  slot: Pick<StrokeSlot, 'length' | 'extent' | 'width' | 'height'>,
  id: StrokeId,
  variantKey?: string
): { sx: number; sy: number } {
  const box = contentBox(id, variantKey);
  const w = slot.width ?? slot.extent;
  const h = slot.height ?? slot.extent;
  if (id === 'dian') {
    // 水滴保持正方形、尖上圓下；點的墨跡外框很小，太小會看成斜圓點。
    const shrink = STROKE_BY_ID[id].drawScale ?? 1;
    const raw = Math.max(w / box.w, h / box.h, slot.extent ?? 0);
    const s = clampScale(Math.max(raw * shrink, 0.12));
    return { sx: s, sy: s };
  }
  return { sx: clampScale(w / box.w), sy: clampScale(h / box.h) };
}

/** 單一尺度，給舊呼叫與預設大小用。 */
export function objectScale(slot: Pick<StrokeSlot, 'length' | 'extent' | 'width' | 'height'>, id: StrokeId): number {
  const { sx, sy } = objectSize(slot, id);
  return Math.max(sx, sy);
}

function charSpanOf(slots: StrokeSlot[], fallback = 0.2): number {
  const extents = slots.map((s) => Math.max(s.width || 0, s.height || 0, s.extent || 0)).filter((n) => n > 0);
  if (!extents.length) return fallback;
  extents.sort((a, b) => a - b);
  return extents[Math.floor(extents.length / 2)];
}

/** 十筆以上才壓最長邊，短字（口、一）維持跟墨跡一樣大。 */
function packBusyCharSize(size: { sx: number; sy: number }, slots: StrokeSlot[]): { sx: number; sy: number } {
  if (slots.length < 10) return size;
  const cap = Math.min(0.26, Math.max(0.14, charSpanOf(slots) * 1.3));
  const longest = Math.max(size.sx, size.sy, 0.01);
  if (longest <= cap) return size;
  const factor = cap / longest;
  return { sx: size.sx * factor, sy: size.sy * factor };
}

/**
 * 尚未吸附時的預設大小。
 * 有同種類空槽：先跟該筆墨跡外框相符（口的直仍是那一豎）。
 * 十多筆的字再把過大的物件壓低，避免長靴一放就佔格子三分之一；
 * 練習吸附請走 fitToSlot，仍跟該筆墨跡走。
 * 沒有同種類：用這個字槽位的中位大小當上限。
 */
export function sizeForCharStroke(
  id: StrokeId,
  slots: StrokeSlot[],
  x: number,
  y: number,
  taken: Set<number> = new Set(),
  variantKey?: string
): { sx: number; sy: number } {
  const same = slots.filter((s) => !taken.has(s.index) && s.strokeId === id);
  if (same.length) {
    let best = same[0];
    let bestDist = Infinity;
    for (const slot of same) {
      const d = Math.hypot(slot.cx - x, slot.cy - y);
      if (d < bestDist) {
        bestDist = d;
        best = slot;
      }
    }
    return packBusyCharSize(objectSize(best, id, variantKey), slots);
  }

  const typical = metricFor(id);
  const charSpan = charSpanOf(slots, typical.extent);
  const extent = Math.min(typical.extent, Math.max(0.1, charSpan * 1.15));
  const size = objectSize({ length: extent, extent, width: extent, height: extent }, id, variantKey);
  const cap = Math.min(0.34, Math.max(0.12, charSpan * 1.25));
  const longest = Math.max(size.sx, size.sy, 0.01);
  const fitted =
    longest <= cap ? size : { sx: size.sx * (cap / longest), sy: size.sy * (cap / longest) };
  return packBusyCharSize(fitted, slots);
}

/** 沒有字槽時才用的後備大小。 */
export function defaultObjectScale(id: StrokeId): number {
  const m = metricFor(id);
  return Math.min(0.34, objectScale({ length: m.extent, extent: m.extent, width: m.extent, height: m.extent }, id));
}

/** 拖入正確槽位時的位置、大小、角度。點永遠尖上圓下，不跟著墨跡斜。 */
export function fitToSlot(id: StrokeId, slot: StrokeSlot, variantKey?: string) {
  const chosen = variantKey ?? pickVariant(id, slot.angle);
  const size = objectSize(slot, id, chosen);
  return {
    x: slot.cx,
    y: slot.cy,
    scale: size.sx,
    scaleY: size.sy,
    rot: id === 'dian' ? baseAngleFor('dian') : slot.angle,
    variantKey: chosen,
  };
}

/** 後寫的筆疊在上面；水滴再高一層，避免被大橫蓋住點不到。 */
export function pieceLayer(id: StrokeId, order: number): number {
  const boost = id === 'dian' ? 8 : id === 'heng' || id === 'zhi' || id === 'ti' ? 3 : id === 'pie' || id === 'na' ? 0 : 1;
  return (order + 1) * 4 + boost;
}

/** 這個筆畫的實測樣本數，0 表示大小與角度還是估的。 */
export function sampleCount(id: StrokeId): number {
  return GENERATED[id]?.samples ?? 0;
}

/**
 * 物品被畫出來的角度。水滴圖本身尖朝上（12 點鐘），畫面上永遠不再轉。
 */
export function baseAngleFor(id: StrokeId, variantKey?: string): number {
  if (id === 'dian') return 0;
  if (variantKey) {
    const variant = STROKE_BY_ID[id].variants?.find((v) => v.key === variantKey);
    if (variant?.baseAngle !== undefined) return variant.baseAngle;
  }
  return metricFor(id).baseAngle;
}

/** 點的三個朝向裡，挑一個最接近這一筆實際角度的。 */
export function pickVariant(id: StrokeId, angle: number): string | undefined {
  const variants = STROKE_BY_ID[id].variants;
  if (!variants?.length) return undefined;

  let best = variants[0];
  let bestDelta = Infinity;
  for (const v of variants) {
    if (v.baseAngle === undefined) continue;
    const delta = angleDelta(v.baseAngle, angle);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = v;
    }
  }
  return best.key;
}

function angleDelta(a: number, b: number): number {
  let d = Math.abs(a - b) % 360;
  if (d > 180) d = 360 - d;
  return d;
}

/**
 * 折角類物品的外形已經帶著方向，轉太多就認不出來了。
 * 曲尺、衣帽鈎這類本來就是軸對齊的 ┐，幾乎不要轉，靠長寬去貼字影。
 */
const AXIS_ALIGNED = new Set<StrokeId>([
  'hengzhi',
  'hengzhigou',
  'zhizheng',
  'zhizhengzhi',
  'zhizhengzhigou',
  'zhigou',
  'henggou',
]);
const COMPOUND_ROTATION_LIMIT = 32;

/** 畫面上真正要套的旋轉角度。 */
export function renderRotation(id: StrokeId, rot: number, variantKey?: string): number {
  // 點＝水滴：永遠尖朝上、圓底朝下，不要跟楷書斜勢一起轉歪。
  if (id === 'dian') return 0;

  let delta = rot - baseAngleFor(id, variantKey);
  while (delta > 180) delta -= 360;
  while (delta < -180) delta += 360;

  if (AXIS_ALIGNED.has(id)) {
    return Math.max(-8, Math.min(8, delta));
  }
  if (STROKE_BY_ID[id].category === 'compound') {
    return Math.max(-COMPOUND_ROTATION_LIMIT, Math.min(COMPOUND_ROTATION_LIMIT, delta));
  }
  return delta;
}
