import generated from '@/data/strokeMetrics.json';
import { STROKE_BY_ID } from '@/data/strokes';
import type { StrokeId, StrokeSlot } from '@/types';

/**
 * 每種筆畫的「基準角度」與典型大小。
 *
 * 23 件物品圖各自已經畫成該筆畫的樣子：曲尺本來就是 ┐、羽毛本來就從右上撇到左下、
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
  zhizhengzhi: { baseAngle: 35, extent: 0.5 },
  zhizhengzhigou: { baseAngle: 75, extent: 0.6 },
  wangou: { baseAngle: 95, extent: 0.6 },
};

export function metricFor(id: StrokeId): Metric {
  const gen = GENERATED[id];
  if (gen) return { baseAngle: gen.baseAngle, extent: gen.extent };
  return FALLBACK[id] ?? { baseAngle: 0, extent: 0.45 };
}

/** 羽毛、滑梯這類圖很胖，用外框當大小會蓋住後面的橫。複合筆仍用外框。 */
const LENGTH_STROKES = new Set<StrokeId>(['heng', 'zhi', 'pie', 'na', 'ti', 'dian']);

function clampScale(n: number): number {
  return Math.min(0.82, Math.max(0.07, n));
}

/**
 * 格子上實際要畫的大小。
 * 單向筆（橫直撇捺點趯）跟首末距走：長撇羽毛就長、短直蠟燭就短。
 * 折角類物品是正方形外框，仍用 extent。
 */
export function objectScale(slot: Pick<StrokeSlot, 'length' | 'extent'>, id: StrokeId): number {
  const draw = STROKE_BY_ID[id].drawScale ?? 1;
  if (LENGTH_STROKES.has(id)) {
    return clampScale(Math.max(slot.length, 0.06) * draw);
  }
  return clampScale(slot.extent * draw * 0.92);
}

/** 挑戰模式尚未對上槽位時的預設大小。 */
export function defaultObjectScale(id: StrokeId): number {
  const m = metricFor(id);
  return Math.min(0.34, objectScale({ length: m.extent, extent: m.extent }, id));
}

/** 拖入正確槽位時的位置、大小、角度。點一律依格子方向選朝向，不沿用工具欄那一顆。 */
export function fitToSlot(id: StrokeId, slot: StrokeSlot, variantKey?: string) {
  const chosen = id === 'dian' ? pickVariant(id, slot.angle) : (variantKey ?? pickVariant(id, slot.angle));
  return {
    x: slot.cx,
    y: slot.cy,
    scale: objectScale(slot, id),
    rot: slot.angle,
    variantKey: chosen,
  };
}

/** 後寫的筆疊在上面；橫直再高一層，避免被羽毛擋住。 */
export function pieceLayer(id: StrokeId, order: number): number {
  const boost = id === 'heng' || id === 'zhi' || id === 'ti' ? 3 : id === 'pie' || id === 'na' ? 0 : 1;
  return (order + 1) * 4 + boost;
}

/** 這個筆畫的實測樣本數，0 表示大小與角度還是估的。 */
export function sampleCount(id: StrokeId): number {
  return GENERATED[id]?.samples ?? 0;
}

/**
 * 物品被畫出來的角度。點有三個朝向，各自有自己的基準角，
 * 學生拼三點水時就不必一直按旋轉。
 */
export function baseAngleFor(id: StrokeId, variantKey?: string): number {
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

  // 點：直立圖尖朝上，近乎向下的點用它轉 180° 讓尖朝下，才跟字影同向。
  if (id === 'dian') {
    if (angle >= 70 && angle <= 110) return 'up';
    if (angle > 110 || angle < -20) return 'left';
    return 'right';
  }

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
 * 折角類物品的外形已經帶著方向，轉太多就認不出來了，所以修正量夾在 ±32 度內。
 * 單向筆畫（點橫直撇捺趯）不夾，它們本來就要跟著字轉。
 */
const COMPOUND_ROTATION_LIMIT = 32;

/** 畫面上真正要套的旋轉角度。 */
export function renderRotation(id: StrokeId, rot: number, variantKey?: string): number {
  let delta = rot - baseAngleFor(id, variantKey);
  while (delta > 180) delta -= 360;
  while (delta < -180) delta += 360;

  if (STROKE_BY_ID[id].category === 'compound') {
    return Math.max(-COMPOUND_ROTATION_LIMIT, Math.min(COMPOUND_ROTATION_LIMIT, delta));
  }
  return delta;
}
