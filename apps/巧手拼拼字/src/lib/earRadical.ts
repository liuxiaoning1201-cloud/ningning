import { isStrokeId } from '@/data/strokes';
import { describeMedian, type StrokeShape } from '@/lib/classifyStroke';
import type { CharData, Median } from '@/types';

/**
 * 港標耳朵旁是兩筆：橫撇彎鈎 + 直。
 * animCJK 常把第一筆ㄋ拆成兩條短路徑，畫面就多出三角旗或豆芽。
 * 這裡只在「短橫撇 + 短鈎 + 旁邊一條超長直」這種穩定形狀時，把被拆的第一筆黏回去。
 * 不掃部首表，也不改筆順；「又」「了」沒有後面那條長直，不會被合併。
 */

function isShortHengPieLike(s: StrokeShape): boolean {
  if (s.span >= 230) return false;
  if (!s.collapsed.startsWith('h')) return false;
  return /p/.test(s.collapsed);
}

function isShortHookLike(s: StrokeShape): boolean {
  if (s.span >= 300) return false;
  return /[ql]$/.test(s.collapsed);
}

function isLongZhi(s: StrokeShape): boolean {
  const c = s.collapsed;
  if (c !== 'v' && c !== 'vv' && c !== 'u') return false;
  return s.span > 500 && s.boxH > s.boxW * 5;
}

function concatPaths(a: string, b: string): string {
  return `${a.trim()} ${b.trim()}`;
}

function concatMedians(a: Median, b: Median): Median {
  return [...a, ...b];
}

function mergeAt(data: CharData, first: number): CharData {
  const second = first + 1;
  const strokes = data.strokes.slice();
  const medians = data.medians.slice();
  const strokeTypes = data.strokeTypes.slice();
  strokes[first] = concatPaths(strokes[first], strokes[second]);
  medians[first] = concatMedians(medians[first], medians[second]);
  strokes.splice(second, 1);
  medians.splice(second, 1);
  if (strokeTypes.length === data.strokes.length) {
    // 黏路徑，名稱仍交給分類器；老師鎖定稍後再套
    strokeTypes[first] = isStrokeId(strokeTypes[first]) ? strokeTypes[first] : null;
    strokeTypes.splice(second, 1);
  }
  return { ...data, strokes, medians, strokeTypes };
}

/** 若偵測到被拆開的耳朵旁，回傳黏好第一筆後的字；否則原樣。 */
export function mergeSplitEarRadical(data: CharData): CharData {
  const { medians } = data;
  if (medians.length < 3) return data;
  const shapes = medians.map((m) => describeMedian(m));
  const n = shapes.length;

  if (isShortHengPieLike(shapes[0]) && isShortHookLike(shapes[1]) && isLongZhi(shapes[2])) {
    return mergeAt(data, 0);
  }
  if (
    isShortHengPieLike(shapes[n - 3]) &&
    isShortHookLike(shapes[n - 2]) &&
    isLongZhi(shapes[n - 1])
  ) {
    return mergeAt(data, n - 3);
  }
  return data;
}
