/**
 * 填字生成器 v3：緊湊佈局、動態網格、所有詞句都放入、真正縱橫交叉
 */

import { generateId } from "@/stores/puzzleSets";
import type { WordBankItem } from "@/lib/types";
import type {
  CrosswordPuzzle,
  CrosswordCell,
  CrosswordWord,
  DifficultyTier,
} from "@/lib/types";

export interface GeneratorInput {
  items: WordBankItem[];
  tier: DifficultyTier;
  wordCount?: number;
}

/** 每句最少需要的空格比例（保證每句都有空格讓學生填） */
const TIER_BLANK_RATIO: Record<DifficultyTier, number> = {
  1: 0.3,
  2: 0.45,
  3: 0.6,
  4: 0.72,
  5: 0.85,
};

const TIER_TITLE: Record<DifficultyTier, string> = {
  1: "★ 入門",
  2: "★★ 初學",
  3: "★★★ 中等",
  4: "★★★★ 挑戰",
  5: "★★★★★ 大師",
};

interface PlacedWord {
  word: string;
  dir: "h" | "v";
  r: number;
  c: number;
  item: WordBankItem | undefined;
}

class VirtualGrid {
  private cells = new Map<string, string>();

  private k(r: number, c: number): string {
    return `${r},${c}`;
  }

  get(r: number, c: number): string | null {
    return this.cells.get(this.k(r, c)) ?? null;
  }

  set(r: number, c: number, ch: string): boolean {
    const existing = this.get(r, c);
    if (existing !== null && existing !== ch) return false;
    this.cells.set(this.k(r, c), ch);
    return true;
  }

  canPlace(word: string, r: number, c: number, dir: "h" | "v"): boolean {
    let hasOverlap = false;
    for (let k = 0; k < word.length; k++) {
      const cr = dir === "h" ? r : r + k;
      const cc = dir === "h" ? c + k : c;
      const existing = this.get(cr, cc);
      if (existing !== null) {
        if (existing !== word[k]) return false;
        hasOverlap = true;
      } else {
        // 非交叉位置：檢查兩側是否有不相關的字元
        if (dir === "h") {
          if (this.get(cr - 1, cc) !== null || this.get(cr + 1, cc) !== null) return false;
        } else {
          if (this.get(cr, cc - 1) !== null || this.get(cr, cc + 1) !== null) return false;
        }
      }
    }
    // 詞尾前後不能有字元
    if (dir === "h") {
      if (this.get(r, c - 1) !== null) return false;
      if (this.get(r, c + word.length) !== null) return false;
    } else {
      if (this.get(r - 1, c) !== null) return false;
      if (this.get(r + word.length, c) !== null) return false;
    }
    return hasOverlap;
  }

  place(word: string, r: number, c: number, dir: "h" | "v") {
    for (let k = 0; k < word.length; k++) {
      const cr = dir === "h" ? r : r + k;
      const cc = dir === "h" ? c + k : c;
      this.set(cr, cc, word[k]);
    }
  }

  forcePlace(word: string, r: number, c: number, dir: "h" | "v") {
    for (let k = 0; k < word.length; k++) {
      const cr = dir === "h" ? r : r + k;
      const cc = dir === "h" ? c + k : c;
      this.cells.set(this.k(cr, cc), word[k]);
    }
  }

  getBounds(): { minR: number; maxR: number; minC: number; maxC: number } {
    let minR = Infinity,
      maxR = -Infinity,
      minC = Infinity,
      maxC = -Infinity;
    for (const key of this.cells.keys()) {
      const [r, c] = key.split(",").map(Number);
      minR = Math.min(minR, r);
      maxR = Math.max(maxR, r);
      minC = Math.min(minC, c);
      maxC = Math.max(maxC, c);
    }
    if (minR === Infinity) return { minR: 0, maxR: 0, minC: 0, maxC: 0 };
    return { minR, maxR, minC, maxC };
  }
}

export function generateCrosswordPuzzle(
  input: GeneratorInput
): CrosswordPuzzle | null {
  const { items, tier } = input;
  let allItems = items.filter((it) => it.text.trim().length > 0);
  if (allItems.length === 0) return null;

  if (input.wordCount && input.wordCount > 0 && input.wordCount < allItems.length) {
    const shuffled = [...allItems].sort(() => Math.random() - 0.5);
    allItems = shuffled.slice(0, input.wordCount);
  }

  let bestResult: { placed: PlacedWord[]; grid: VirtualGrid; score: number } | null = null;

  for (let attempt = 0; attempt < 20; attempt++) {
    const order =
      attempt === 0
        ? [...allItems].sort((a, b) => b.text.trim().length - a.text.trim().length)
        : [...allItems].sort(() => Math.random() - 0.5);

    const result = tryPlace(order);

    const bounds = result.grid.getBounds();
    const area =
      (bounds.maxR - bounds.minR + 1) * (bounds.maxC - bounds.minC + 1);
    const w = bounds.maxC - bounds.minC + 1;
    const h = bounds.maxR - bounds.minR + 1;
    const aspectPenalty = Math.abs(w - h) * 5;
    // 評分：放置數量 × 200 + 交叉數 × 50 − 面積 − 寬高差
    const score = result.placed.length * 200 + result.totalCrossings * 50 - area - aspectPenalty;

    if (!bestResult || score > bestResult.score) {
      bestResult = { ...result, score };
      if (result.placed.length === allItems.length) break;
    }
  }

  if (!bestResult || bestResult.placed.length === 0) return null;

  // 補放未能交叉的詞句（橫向排列，盡量緊湊）
  const placedIds = new Set(bestResult.placed.map((p) => p.item?.id));
  const unplaced = allItems.filter((it) => !placedIds.has(it.id));
  if (unplaced.length > 0) {
    addUnplacedWords(bestResult.grid, bestResult.placed, unplaced);
  }

  return buildPuzzle(bestResult.placed, bestResult.grid, tier);
}

function tryPlace(itemsInOrder: WordBankItem[]): {
  placed: PlacedWord[];
  grid: VirtualGrid;
  totalCrossings: number;
} {
  const grid = new VirtualGrid();
  const placed: PlacedWord[] = [];
  let totalCrossings = 0;

  // 建立字元索引，加速查找
  const charIndex = new Map<string, { pw: PlacedWord; pi: number }[]>();
  function addToIndex(pw: PlacedWord) {
    for (let pi = 0; pi < pw.word.length; pi++) {
      const ch = pw.word[pi];
      if (!charIndex.has(ch)) charIndex.set(ch, []);
      charIndex.get(ch)!.push({ pw, pi });
    }
  }

  const first = itemsInOrder[0];
  const firstWord = first.text.trim();
  const firstPw = { word: firstWord, dir: "h" as const, r: 0, c: 0, item: first };
  grid.place(firstWord, 0, 0, "h");
  placed.push(firstPw);
  addToIndex(firstPw);

  // 多輪嘗試：未放置的詞每輪再試
  const remaining = itemsInOrder.slice(1).map((it) => it);
  for (let round = 0; round < 3; round++) {
    const stillRemaining: WordBankItem[] = [];
    for (const item of remaining) {
      const word = item.text.trim();
      if (word.length === 0) continue;

      const curBounds = grid.getBounds();
      let bestCandidate: {
        r: number;
        c: number;
        dir: "h" | "v";
        crossings: number;
        area: number;
        aspectPenalty: number;
      } | null = null;

      for (let wi = 0; wi < word.length; wi++) {
        const ch = word[wi];
        const entries = charIndex.get(ch);
        if (!entries) continue;

        for (const { pw, pi } of entries) {
          // 嘗試兩個方向
          const dirs: ("h" | "v")[] = pw.dir === "h" ? ["v"] : ["h"];
          // 也嘗試同方向（如果透過其他已放置詞交叉）
          dirs.push(pw.dir);

          for (const newDir of dirs) {
            let newR: number, newC: number;
            if (newDir === "v") {
              newR = pw.dir === "h" ? pw.r - wi : pw.r + pi - wi;
              newC = pw.dir === "h" ? pw.c + pi : pw.c;
            } else {
              newR = pw.dir === "v" ? pw.r + pi : pw.r;
              newC = pw.dir === "v" ? pw.c - wi : pw.c + pi - wi;
            }

            if (!grid.canPlace(word, newR, newC, newDir)) continue;

            let crossings = 0;
            for (let k = 0; k < word.length; k++) {
              const cr = newDir === "h" ? newR : newR + k;
              const cc = newDir === "h" ? newC + k : newC;
              if (grid.get(cr, cc) === word[k]) crossings++;
            }

            const endR = newDir === "v" ? newR + word.length - 1 : newR;
            const endC = newDir === "h" ? newC + word.length - 1 : newC;
            const newMinR = Math.min(curBounds.minR, newR);
            const newMaxR = Math.max(curBounds.maxR, endR);
            const newMinC = Math.min(curBounds.minC, newC);
            const newMaxC = Math.max(curBounds.maxC, endC);
            const w = newMaxC - newMinC + 1;
            const h = newMaxR - newMinR + 1;
            const area = w * h;
            // 寬高比越接近 1 越好
            const aspectPenalty = Math.abs(w - h);

            const isBetter = !bestCandidate
              || crossings > bestCandidate.crossings
              || (crossings === bestCandidate.crossings && area < bestCandidate.area)
              || (crossings === bestCandidate.crossings && area === bestCandidate.area && aspectPenalty < bestCandidate.aspectPenalty);

            if (isBetter) {
              bestCandidate = { r: newR, c: newC, dir: newDir, crossings, area, aspectPenalty };
            }
          }
        }
      }

      if (bestCandidate) {
        grid.place(word, bestCandidate.r, bestCandidate.c, bestCandidate.dir);
        const pw = {
          word,
          dir: bestCandidate.dir,
          r: bestCandidate.r,
          c: bestCandidate.c,
          item,
        };
        placed.push(pw);
        addToIndex(pw);
        totalCrossings += bestCandidate.crossings;
      } else if (round < 2) {
        stillRemaining.push(item);
      }
    }
    remaining.length = 0;
    remaining.push(...stillRemaining);
    if (remaining.length === 0) break;
  }

  return { placed, grid, totalCrossings };
}

/** 未能交叉的詞句：橫向排列在底部，每行盡量排多個 */
function addUnplacedWords(
  grid: VirtualGrid,
  placed: PlacedWord[],
  unplaced: WordBankItem[]
) {
  const bounds = grid.getBounds();
  const gridWidth = bounds.maxC - bounds.minC + 1;
  const targetWidth = Math.max(gridWidth, 15);

  let curR = bounds.maxR + 2;
  let curC = bounds.minC;

  for (const item of unplaced) {
    const word = item.text.trim();
    if (word.length === 0) continue;

    // 超過行寬就換行
    if (curC - bounds.minC + word.length > targetWidth) {
      curR += 2;
      curC = bounds.minC;
    }

    grid.forcePlace(word, curR, curC, "h");
    placed.push({ word, dir: "h", r: curR, c: curC, item });
    curC += word.length + 1;
  }
}

function buildPuzzle(
  placedWords: PlacedWord[],
  _grid: VirtualGrid,
  tier: DifficultyTier
): CrosswordPuzzle {
  const bounds = _grid.getBounds();
  const offsetR = -bounds.minR;
  const offsetC = -bounds.minC;

  for (const pw of placedWords) {
    pw.r += offsetR;
    pw.c += offsetC;
  }

  const contentRows = bounds.maxR - bounds.minR + 1;
  const contentCols = bounds.maxC - bounds.minC + 1;
  const rows = contentRows;
  const cols = contentCols;

  const sortedPlaced = [...placedWords].sort((a, b) =>
    a.r !== b.r ? a.r - b.r : a.c - b.c
  );

  const horizontalClues: { id: string; label: string; clue: string; source: string }[] = [];
  const verticalClues: { id: string; label: string; clue: string; source: string }[] = [];
  const crosswordWords: CrosswordWord[] = [];

  const CN_NUMS = "一二三四五六七八九十";
  function getHLabel(idx: number): string {
    if (idx < 10) return CN_NUMS[idx];
    if (idx < 20) return "十" + (idx === 10 ? "" : CN_NUMS[idx - 10]);
    const tens = Math.floor(idx / 10);
    const ones = idx % 10;
    return (tens > 1 ? CN_NUMS[tens - 1] : "") + "十" + (ones > 0 ? CN_NUMS[ones - 1] : "");
  }

  for (let i = 0; i < sortedPlaced.length; i++) {
    const pw = sortedPlaced[i];
    const clueId = `c${i}`;
    const clueText = pw.item?.definition || pw.word.replace(/./g, "_");
    const source = pw.item?.source ? ` ${pw.item.source}` : "";

    if (pw.dir === "h") {
      horizontalClues.push({
        id: clueId,
        label: getHLabel(horizontalClues.length),
        clue: `${clueText}${source}`,
        source: pw.item?.source ?? "",
      });
    } else {
      verticalClues.push({
        id: clueId,
        label: String(verticalClues.length + 1),
        clue: `${clueText}${source}`,
        source: pw.item?.source ?? "",
      });
    }

    crosswordWords.push({
      id: clueId,
      text: pw.word,
      direction: pw.dir === "h" ? "horizontal" : "vertical",
      startRow: pw.r,
      startCol: pw.c,
      clue: pw.item?.definition || pw.word,
      source: pw.item?.source ?? "",
    });
  }

  const charMap = new Map<string, string>();
  const cellClueMap = new Map<string, string>();
  for (let wi = 0; wi < sortedPlaced.length; wi++) {
    const pw = sortedPlaced[wi];
    const clueId = `c${wi}`;
    for (let k = 0; k < pw.word.length; k++) {
      const r = pw.dir === "h" ? pw.r : pw.r + k;
      const c = pw.dir === "h" ? pw.c + k : pw.c;
      const key = `${r},${c}`;
      charMap.set(key, pw.word[k]);
      if (!cellClueMap.has(key)) cellClueMap.set(key, clueId);
    }
  }

  // 按詞句決定哪些格子是 blank：保證每句至少有 blankRatio 比例的空格
  const blankRatio = TIER_BLANK_RATIO[tier];
  const blankKeys = new Set<string>();

  for (const pw of sortedPlaced) {
    const positions: string[] = [];
    for (let k = 0; k < pw.word.length; k++) {
      const r = pw.dir === "h" ? pw.r : pw.r + k;
      const c = pw.dir === "h" ? pw.c + k : pw.c;
      positions.push(`${r},${c}`);
    }
    // 每句至少 blankCount 個空格，且至少 1 個
    const blankCount = Math.max(1, Math.round(positions.length * blankRatio));
    // 隨機選 blankCount 個位置
    const shuffled = [...positions].sort(() => Math.random() - 0.5);
    for (let j = 0; j < blankCount && j < shuffled.length; j++) {
      blankKeys.add(shuffled[j]);
    }
  }

  const puzzleGrid: CrosswordCell[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: CrosswordCell[] = [];
    for (let c = 0; c < cols; c++) {
      const key = `${r},${c}`;
      const ch = charMap.get(key);
      if (!ch) {
        row.push({ type: "block" });
      } else if (blankKeys.has(key)) {
        row.push({ type: "blank", clueId: cellClueMap.get(key) ?? `c${r}-${c}` });
      } else {
        row.push({ type: "given", value: ch });
      }
    }
    puzzleGrid.push(row);
  }

  return {
    id: generateId(),
    grid: puzzleGrid,
    words: crosswordWords,
    horizontalClues,
    verticalClues,
    difficulty: tier,
    levelTitle: TIER_TITLE[tier],
  };
}
