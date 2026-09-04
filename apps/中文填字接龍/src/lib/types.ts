/** 詞句庫單一詞條（教師維護，可來自 Excel/CSV） */
export interface WordBankItem {
  id: string;
  text: string;
  definition: string;
  source: string;
  difficulty: number; // 1–5 星
}

/** 詞句庫 */
export interface WordBank {
  id: string;
  name: string;
  items: WordBankItem[];
  createdAt?: string;
}

/** 填字網格單格：block 不可填，given 提示字，blank 待填 */
export type CrosswordCell =
  | { type: "block" }
  | { type: "given"; value: string }
  | { type: "blank"; clueId: string };

/** 填字詞條（橫向或豎向一條） */
export interface CrosswordWord {
  id: string;
  text: string;
  direction: "horizontal" | "vertical";
  startRow: number;
  startCol: number;
  clue: string;
  source: string;
}

/** 填字題品質統計：用於 UI 顯示「縱橫交錯有多少」「孤立詞有多少」等真實數據 */
export interface CrosswordStats {
  /** 總詞數（含所有放入題組的詞） */
  totalWords: number;
  /** 至少有一個交叉字的詞數 */
  crossedWords: number;
  /** 零交叉的孤立詞數（= totalWords - crossedWords） */
  isolatedWords: number;
  /** 交叉格數（同時被橫向詞與豎向詞覆蓋的格子） */
  crossingCells: number;
  /** 所有非 block 的格子數 */
  totalCells: number;
  /** 交叉率 = crossingCells / totalCells（0–1） */
  crossRate: number;
  /** 平均每詞交叉數 = 2 × crossingCells / totalWords */
  avgCrossPerWord: number;
  /** 填入密度 = totalCells / (rows × cols)（0–1） */
  density: number;
}

/** 填字題型（對齊論語填字接龍卡格式） */
export interface CrosswordPuzzle {
  id: string;
  grid: CrosswordCell[][];
  words: CrosswordWord[];
  horizontalClues: { id: string; label: string; clue: string; source: string }[];
  verticalClues: { id: string; label: string; clue: string; source: string }[];
  difficulty: number; // 1–5
  levelTitle: string;
  /** 佈局品質統計（舊資料可能沒有，UI 會按需重算） */
  stats?: CrosswordStats;
}

/** 題組來源：練習模式隨機出題 | 設定頁手動出題 */
export type PuzzleSetSource = "practice" | "manual";

/** 題組（可含多題填字或數獨） */
export interface PuzzleSet {
  id: string;
  title: string;
  type: "crossword" | "sudoku";
  createdAt: string;
  /** 練習模式出題 vs 手動出題，用於區分顯示位置 */
  source?: PuzzleSetSource;
  crossword?: CrosswordPuzzle;
  /** 數獨沿用舊格式，可選保留 */
  sudoku?: {
    solution: number[][];
    given: boolean[][];
    wordIds: string[];
  };
}

/** 難度檔位（1-5 星） */
export type DifficultyTier = 1 | 2 | 3 | 4 | 5;

/** 遊戲模式 */
export type GameMode = "practice" | "local" | "remote";

export const STORAGE_KEYS = {
  WORD_BANKS: "word-puzzle:wordBanks",
  PUZZLE_SETS: "word-puzzle:puzzleSets",
  GAME_SETTINGS: "word-puzzle:gameSettings",
} as const;
