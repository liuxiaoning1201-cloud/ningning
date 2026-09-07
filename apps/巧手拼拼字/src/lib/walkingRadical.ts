import { describeMedian, type StrokeShape } from '@/lib/classifyStroke';
import type { CharData, Median, StrokeId } from '@/types';

/**
 * 香港小學《學習字詞表》教走之底（辶）是四筆：點、橫、撇、捺。
 * 中間（橫與捺之間）那一筆是撇，物品用羽毛。
 *
 * 開源動畫常把橫+撇連成一筆橫撇（三角旗），平捺又拆成「短頓 + 長橫」。
 * 這裡只黏回被拆開的平捺，讓字卡動畫跟物品對得上；
 * 老師若要照字表出四件物品，可在設定把橫撇拆成橫＋撇。
 *
 * 「豆」末三筆是點、撇、橫，「口」的橫直又長又高，都不會被黏。
 */

/** 小學常見、底下有走之／之的字，都有「橫與捺之間」那一撇。 */
export const WALKING_RADICAL_EXAMPLES = [
  '之',
  '乏',
  '進',
  '這',
  '道',
  '遠',
  '近',
  '還',
  '過',
  '遊',
  '運',
  '通',
  '送',
  '達',
  '連',
  '退',
  '追',
  '逃',
  '造',
  '選',
  '邊',
  '迷',
  '遇',
  '迎',
  '述',
  '返',
  '速',
  '週',
  '遭',
  '適',
  '遷',
] as const;

/** 字末是不是走之底：三筆（動畫）或已拆成四筆（字表）。 */
export function walkingTailKind(types: (StrokeId | null)[]): 'three' | 'four' | null {
  const n = types.length;
  if (
    n >= 4 &&
    types[n - 4] === 'dian' &&
    types[n - 3] === 'heng' &&
    types[n - 2] === 'pie' &&
    types[n - 1] === 'na'
  ) {
    return 'four';
  }
  if (n >= 3 && types[n - 3] === 'dian' && types[n - 2] === 'hengpie' && types[n - 1] === 'na') {
    return 'three';
  }
  return null;
}

function isWalkingDot(s: StrokeShape): boolean {
  if (s.span >= 280) return false;
  return s.collapsed === 'n' || s.collapsed === 'np' || (s.collapsed === 'v' && s.boxH < 220);
}

function isWalkingFold(s: StrokeShape): boolean {
  if (s.span >= 400 || s.pathLen >= 520) return false;
  if (!s.collapsed.startsWith('h')) return false;
  return /[vp]/.test(s.collapsed);
}

function isSplitNaHead(s: StrokeShape): boolean {
  if (s.span >= 280) return false;
  if (s.startDeg < 55 || s.startDeg > 125) return false;
  return s.boxH >= s.boxW * 0.85;
}

function isLongFlatTail(s: StrokeShape): boolean {
  if (s.span < 600) return false;
  if (Math.abs(s.startDeg) > 22) return false;
  return s.boxW > s.boxH * 4;
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
    strokeTypes[first] = null;
    strokeTypes.splice(second, 1);
  }
  return { ...data, strokes, medians, strokeTypes };
}

/** 若偵測到被拆開的走之底平捺，回傳黏好後的字；否則原樣。 */
export function mergeSplitWalkingNa(data: CharData): CharData {
  const { medians } = data;
  if (medians.length < 4) return data;
  const shapes = medians.map((m) => describeMedian(m));
  const n = shapes.length;
  if (
    isWalkingDot(shapes[n - 4]) &&
    isWalkingFold(shapes[n - 3]) &&
    isSplitNaHead(shapes[n - 2]) &&
    isLongFlatTail(shapes[n - 1])
  ) {
    return mergeAt(data, n - 2);
  }
  return data;
}
