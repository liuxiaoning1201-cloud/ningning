import official from '@/data/officialStrokeCodes.json';
import type { StrokeId } from '@/types';

/**
 * 開源繁體筆畫名稱（cnchar-order + cnchar-trad）的解碼。
 *
 * 路徑動畫繼續用 animCJK ZhHant；這份表只補「這一筆叫什麼」。
 * 若筆數或順序跟字卡對不上（例如「必」），呼叫端不會套用。
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
    heng: ['hengzhi', 'hengzhigou', 'hengwangou', 'hengzhewangou', 'henggou', 'hengpie', 'hengpiewangou'],
    hengwangou: ['hengzhewangou'],
    zhi: ['zhigou', 'zhiwangou', 'zhizheng', 'zhiti', 'zhizhengzhi', 'zhizhengzhigou'],
    pie: ['hengpie', 'piedian', 'pieti'],
    na: ['xiegou'],
  };
  return upgrades[geo]?.includes(want) ?? false;
}

/** 只有點／直、點／捺這種楷書斜勢容易混的，才允許用開源名稱覆寫幾何結果。 */
export function isSoftStrokeSwap(a: StrokeId, b: StrokeId): boolean {
  const pair = new Set([a, b]);
  return (pair.has('dian') && pair.has('zhi')) || (pair.has('dian') && pair.has('na'));
}
