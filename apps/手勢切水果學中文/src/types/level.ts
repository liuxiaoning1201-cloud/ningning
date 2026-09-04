import type { LangRead } from './word';

export type GameMode = 'timed' | 'count' | 'survival' | 'free';
export type DisplayMode = 'hanzi_pinyin' | 'hanzi_only' | 'pinyin_only';
export type VoicePolicy = LangRead | 'per_entry';
/** 互動方式：捏爆（攝影機手勢）／點擊（滑鼠或觸控） */
export type InputMode = 'pinch' | 'click';

export const STORAGE_KEY_INPUT_MODE = 'fruit-cn-input-mode-v1';

export function readInputMode(): InputMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY_INPUT_MODE);
    return v === 'click' ? 'click' : 'pinch';
  } catch {
    return 'pinch';
  }
}

export function writeInputMode(mode: InputMode) {
  try {
    localStorage.setItem(STORAGE_KEY_INPUT_MODE, mode);
  } catch {
    /* ignore */
  }
}

export interface Level {
  id: string;
  name: string;
  /** 主題標籤過濾；為空陣列代表不過濾（全部詞） */
  topics: string[];
  mode: GameMode;
  /** timed：關卡總秒數 */
  duration?: number;
  /** count：命中目標詞的顆數 */
  targetCount?: number;
  /** survival：最多可漏掉的目標數 */
  missAllowance?: number;
  /** 干擾詞比例（0~1），0 = 只生成目標詞，0.3 = 30% 來自非目標池 */
  distractorRatio: number;
  /** 顯示方式 */
  display: DisplayMode;
  /** 語音策略：普／粵，或依詞條自身設定 */
  voice: VoicePolicy;
  /** 速度倍率（0.6~1.6） */
  speedScale: number;
  /** 生成間隔（ms），可覆寫既定節奏 */
  spawnEveryMs?: number;
  /** 三星目標 [1星, 2星, 3星] */
  starTargets?: [number, number, number];
  /** 錯誤捏（捏到干擾詞）是否扣分 */
  wrongPenalty: boolean;
  /** 漏接目標是否扣分 */
  missPenalty: boolean;
  /** 是否同詞可重複抽樣 */
  allowRepeat: boolean;
  /** 內建模板標記，避免誤刪 */
  builtin?: boolean;
}

export const STORAGE_KEY_LEVELS = 'fruit-cn-learning-levels-v1';
export const STORAGE_KEY_SELECTED_LEVEL = 'fruit-cn-learning-selected-level-v1';

export function defaultLevel(partial: Partial<Level> = {}): Level {
  return {
    id: partial.id ?? `lv_${Math.random().toString(36).slice(2, 10)}`,
    name: partial.name ?? '新關卡',
    topics: partial.topics ?? [],
    mode: partial.mode ?? 'timed',
    duration: partial.duration ?? 60,
    targetCount: partial.targetCount ?? 15,
    missAllowance: partial.missAllowance ?? 3,
    distractorRatio: partial.distractorRatio ?? 0,
    display: partial.display ?? 'hanzi_pinyin',
    voice: partial.voice ?? 'per_entry',
    speedScale: partial.speedScale ?? 1,
    spawnEveryMs: partial.spawnEveryMs,
    starTargets: partial.starTargets,
    wrongPenalty: partial.wrongPenalty ?? true,
    missPenalty: partial.missPenalty ?? false,
    allowRepeat: partial.allowRepeat ?? true,
    builtin: partial.builtin,
  };
}
