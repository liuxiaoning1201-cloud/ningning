/**
 * SuperMemo-2 (SM-2) 間隔重複算法
 * 參考 https://en.wikipedia.org/wiki/SuperMemo#Description_of_SM-2_algorithm
 *
 * 用戶對複習結果評分 0-5：
 *   5 完美  4 好  3 勉強  2 有點難  1 錯  0 完全忘
 * 評分 < 3 視為失敗，重新從 1 天間隔開始；≥ 3 視為通過，按公式延長間隔。
 */
import type { SrsState } from './types';

export type ReviewQuality = 0 | 1 | 2 | 3 | 4 | 5;

export const DEFAULT_SRS: SrsState = {
  repetitions: 0,
  easiness: 2.5,
  intervalDays: 0,
  dueAt: new Date().toISOString(),
};

export function reviewSrs(prev: SrsState | undefined, quality: ReviewQuality, now: Date = new Date()): SrsState {
  const state = prev ?? { ...DEFAULT_SRS };

  let repetitions = state.repetitions;
  let easiness = state.easiness;
  let intervalDays = state.intervalDays;

  if (quality < 3) {
    repetitions = 0;
    intervalDays = 1;
  } else {
    repetitions += 1;
    if (repetitions === 1) intervalDays = 1;
    else if (repetitions === 2) intervalDays = 6;
    else intervalDays = Math.round(intervalDays * easiness);
  }

  easiness = Math.max(
    1.3,
    easiness + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)),
  );

  const due = new Date(now.getTime() + intervalDays * 86400_000);

  return {
    repetitions,
    easiness: Number(easiness.toFixed(2)),
    intervalDays,
    dueAt: due.toISOString(),
  };
}

/** 是否到期需要複習 */
export function isDue(state: SrsState | undefined, now: Date = new Date()): boolean {
  if (!state) return true;
  return new Date(state.dueAt).getTime() <= now.getTime();
}
