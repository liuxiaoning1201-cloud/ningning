import { describeMedian, type StrokeShape } from '@/lib/classifyStroke';
import type { CharData, Median, StrokeId } from '@/types';

/**
 * 走之底（辶）是四筆：點、橫撇、撇、捺。教育部與香港字表都算四筆，
 * 「進」12 畫、「這」11 畫、「遊」13 畫、「還」17 畫、「之」4 畫。
 * 橫撇與捺中間那一筆是撇，物品用羽毛。它又短又陡、還往下偏右一點，
 * 幾何上很像水滴或直，所以要靠字尾的鄰居關係認出來。
 *
 * animCJK 的中線大多已經是四筆，只有少數字把平捺拆成「短頓 + 長橫」。
 * 真的被拆開時，頓的末點就接在長橫的起點上；辶 的那一撇離捺的起點還有
 * 一大段距離，不能一起黏掉，否則就少了字表要求的那一撇。
 *
 * 「豆」末三筆是點、撇、橫，「口」的橫直又長又高，都不會被黏。
 */

/** 小學常見、底下有走之／之的字，都有「橫撇與捺之間」那一撇。 */
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

/**
 * 字末是不是走之底：四筆（字表：點、橫撇、撇、捺）或動畫只給三筆。
 * 也認舊排版把橫撇降成橫的那種四筆，老師改過的字不會突然變回三筆。
 */
export function walkingTailKind(types: (StrokeId | null)[]): 'three' | 'four' | null {
  const n = types.length;
  if (
    n >= 4 &&
    types[n - 4] === 'dian' &&
    (types[n - 3] === 'hengpie' || types[n - 3] === 'heng') &&
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

/**
 * 平捺真的被拆成兩段時，前一段的末點就是後一段的起點。
 * 走之底那一撇收筆在捺的上方，離捺的起點還有一大段（「進」約 180 單位），
 * 用這一段距離就能把「被拆開的捺」跟「字表要求的撇」分開。
 */
const JOIN_GAP = 60;

function joinsSmoothly(head: Median, tail: Median): boolean {
  const a = head[head.length - 1];
  const b = tail[0];
  if (!a || !b) return false;
  return Math.hypot(b[0] - a[0], b[1] - a[1]) <= JOIN_GAP;
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
    isLongFlatTail(shapes[n - 1]) &&
    joinsSmoothly(medians[n - 2], medians[n - 1])
  ) {
    return mergeAt(data, n - 2);
  }
  return data;
}
