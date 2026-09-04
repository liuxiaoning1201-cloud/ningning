import { describeMedian, type StrokeShape } from '@/lib/classifyStroke';
import type { CharData, Median } from '@/types';

/**
 * 港標走之底是三筆：點、橫撇、捺。
 * animCJK ZhHant 常把平捺拆成「短頓 + 長橫」，字就多出一點或一豎。
 * 只在字末出現「點 + 短折 + 短頓 + 超長橫」時黏回最後兩條路徑。
 * 「豆」末三筆是點、撇、橫，「口」的橫直又長又高，都不會被黏。
 */

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
