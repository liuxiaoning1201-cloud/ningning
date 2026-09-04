import official from '@/data/officialStrokeCodes.json';
import type { StrokeId } from '@/types';

/**
 * 開源繁體筆畫名稱（cnchar-order + cnchar-trad）的解碼。
 *
 * 字卡動畫用 animCJK ZhHant 的 strokes／medians；名稱表用來幫每一條路徑取名。
 * 兩套資料的筆序不一定相同（例如「必」），所以不能按索引整列覆蓋，
 * 只能：同一條路徑上用名稱訂正幾何，或把對得上外形的名稱改配到另一筆。
 */

const FROM_CODE: Record<string, StrokeId> = {
  d: 'dian',
  h: 'heng',
  s: 'zhi',
  p: 'pie',
  n: 'na',
  t: 'ti',
  A: 'hengzhi',
  B: 'hengzhigou',
  C: 'hengpie',
  D: 'hengpiewangou',
  E: 'hengwangou',
  R: 'hengzhewangou',
  F: 'henggou',
  G: 'zhizheng',
  H: 'zhizhengzhi',
  I: 'zhizhengzhigou',
  J: 'zhigou',
  K: 'zhiwangou',
  L: 'zhiti',
  M: 'piedian',
  N: 'pieti',
  O: 'wangou',
  P: 'wogou',
  Q: 'xiegou',
};

const DICT = official as Record<string, string>;

/** 這一字的開源筆畫名稱；對不上的位置是 null。 */
export function officialStrokeTypes(ch: string): (StrokeId | null)[] | null {
  const code = DICT[ch];
  if (!code) return null;
  return [...code].map((c) => FROM_CODE[c] ?? null);
}

/** 幾何把複合筆看成了開頭那一段（橫當橫彎鈎），允許用開源名稱升級。 */
export function isNameUpgrade(geo: StrokeId, want: StrokeId): boolean {
  if (geo === want) return true;
  const upgrades: Partial<Record<StrokeId, StrokeId[]>> = {
    heng: ['hengzhi', 'hengzhigou', 'hengwangou', 'hengzhewangou', 'henggou', 'hengpie', 'hengpiewangou', 'ti'],
    hengwangou: ['hengzhewangou'],
    hengpie: ['hengpiewangou'],
    wogou: ['hengpiewangou'],
    wangou: ['hengpiewangou'],
    zhi: ['zhigou', 'zhiwangou', 'zhizheng', 'zhiti', 'zhizhengzhi', 'zhizhengzhigou'],
    pie: ['hengpie', 'piedian', 'pieti'],
    na: ['xiegou'],
  };
  return upgrades[geo]?.includes(want) ?? false;
}

/** 同一條路徑上，楷書斜勢容易看成另一件物品的成對名稱。 */
export function isConfusionPair(a: StrokeId, b: StrokeId): boolean {
  const pair = new Set([a, b]);
  return (pair.has('hengpie') && pair.has('hengzhi')) || (pair.has('pieti') && pair.has('zhizheng'));
}

/** 只有點／直、點／捺這種楷書斜勢容易混的，才允許改配到另一筆。 */
export function isSoftStrokeSwap(a: StrokeId, b: StrokeId): boolean {
  const pair = new Set([a, b]);
  return (pair.has('dian') && pair.has('zhi')) || (pair.has('dian') && pair.has('na'));
}

/**
 * 同一條動畫路徑上，開源名稱能不能用來訂正幾何。
 * 「橫斜鈎」兼指乙（橫彎鈎）與九（橫折彎鈎）：幾何已判成橫折彎鈎時不要降級。
 */
export function officialFitsGeometry(geo: StrokeId, want: StrokeId | null): boolean {
  if (!want) return false;
  if (geo === want) return true;
  if (want === 'hengwangou' && geo === 'hengzhewangou') return false;
  if (isConfusionPair(geo, want)) return true;
  return isNameUpgrade(geo, want);
}

/**
 * 筆序對不上、要把名稱改配到另一筆時，只允許「看起來就是那件物品」的配對。
 * 不能把橫折鈎硬套到一筆單純的橫上。
 */
export function officialFitsReordered(geo: StrokeId, want: StrokeId | null): boolean {
  if (!want) return false;
  if (geo === want) return true;
  return isSoftStrokeSwap(geo, want);
}
