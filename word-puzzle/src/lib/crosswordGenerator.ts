/**
 * 填字生成器：輸入詞句陣列，產出 CrosswordPuzzle（橫豎交叉、難度分級）
 */

import { generateId } from "@/stores/puzzleSets";
import type { WordBankItem } from "@/lib/types";
import type { CrosswordPuzzle, CrosswordCell, CrosswordWord, DifficultyTier } from "@/lib/types";

export interface GeneratorInput {
  items: WordBankItem[];
  tier: DifficultyTier;
  wordCount?: number;
}

const TIER_GIVEN_RATIO: Record<DifficultyTier, number> = {
  1: 0.7,
  2: 0.55,
  3: 0.4,
  4: 0.28,
  5: 0.15,
};

const TIER_GRID_SIZE: Record<DifficultyTier, { min: number; max: number }> = {
  1: { min: 4, max: 6 },
  2: { min: 6, max: 8 },
  3: { min: 8, max: 11 },
  4: { min: 11, max: 14 },
  5: { min: 14, max: 20 },
};

const TIER_TITLE: Record<DifficultyTier, string> = {
  1: "★ 入門",
  2: "★★ 初學",
  3: "★★★ 中等",
  4: "★★★★ 挑戰",
  5: "★★★★★ 大師",
};

/** 找兩條詞的共同字位置 (word1[i] === word2[j]) */
function findOverlaps(word1: string, word2: string): { i: number; j: number }[] {
  const out: { i: number; j: number }[] = [];
  for (let i = 0; i < word1.length; i++) {
    for (let j = 0; j < word2.length; j++) {
      if (word1[i] === word2[j]) out.push({ i, j });
    }
  }
  return out;
}

/** 貪心放置：在網格上放置橫向與豎向詞，盡量交叉 */
export function generateCrosswordPuzzle(input: GeneratorInput): CrosswordPuzzle | null {
  const { items, tier } = input;
  let allWords = items.map((it) => it.text.trim()).filter((s) => s.length > 0);
  if (allWords.length === 0) return null;

  if (input.wordCount && input.wordCount > 0 && input.wordCount < allWords.length) {
    const shuffled = [...allWords].sort(() => Math.random() - 0.5);
    allWords = shuffled.slice(0, input.wordCount);
  }
  const words = allWords;

  // 按長度排序，長詞先放
  const sorted = [...words].sort((a, b) => b.length - a.length);
  const gridRows: (string | null)[][] = [];
  const wordInfos: { word: string; dir: "h" | "v"; r: number; c: number; source: string; definition: string }[] = [];

  function ensureSize(maxR: number, maxC: number) {
    while (gridRows.length <= maxR) {
      gridRows.push([]);
    }
    gridRows.forEach((row, r) => {
      while (row.length <= maxC) row.push(null);
    });
  }

  function setCell(r: number, c: number, ch: string) {
    if (r < 0 || c < 0) return true; // will be normalized later
    ensureSize(r, c);
    const row = gridRows[r];
    if (row[c] !== null && row[c] !== ch) return false;
    row[c] = ch;
    return true;
  }

  function getCell(r: number, c: number): string | null {
    if (r < 0 || c < 0) return null;
    if (r >= gridRows.length) return null;
    const row = gridRows[r];
    if (!row || c >= row.length) return null;
    return row[c];
  }

  // 第一條放橫向
  const w0 = sorted[0];
  const item0 = items.find((it) => it.text.trim() === w0);
  for (let c = 0; c < w0.length; c++) {
    setCell(0, c, w0[c]);
  }
  wordInfos.push({
    word: w0,
    dir: "h",
    r: 0,
    c: 0,
    source: item0?.source ?? "",
    definition: item0?.definition ?? "",
  });

  // 其餘盡量與已放詞交叉
  const used = new Set<string>([w0]);
  for (let wi = 1; wi < sorted.length; wi++) {
    const word = sorted[wi];
    if (used.has(word)) continue;
    const item = items.find((it) => it.text.trim() === word);
    let placed = false;
    for (const placedInfo of wordInfos) {
      const overlaps = findOverlaps(word, placedInfo.word);
      for (const { i, j } of overlaps) {
        let r0: number, c0: number;
        if (placedInfo.dir === "h") {
          r0 = placedInfo.r - i;
          c0 = placedInfo.c + j;
          // 豎向放置 word 於 (r0, c0)
          let ok = true;
          for (let k = 0; k < word.length; k++) {
            const r = r0 + k;
            const c = c0;
            const cur = getCell(r, c);
            if (cur !== null && cur !== word[k]) {
              ok = false;
              break;
            }
          }
          if (!ok) continue;
          for (let k = 0; k < word.length; k++) {
            setCell(r0 + k, c0, word[k]);
          }
          wordInfos.push({
            word,
            dir: "v",
            r: r0,
            c: c0,
            source: item?.source ?? "",
            definition: item?.definition ?? "",
          });
          placed = true;
          break;
        } else {
          r0 = placedInfo.r + j;
          c0 = placedInfo.c - i;
          let ok = true;
          for (let k = 0; k < word.length; k++) {
            const r = r0;
            const c = c0 + k;
            const cur = getCell(r, c);
            if (cur !== null && cur !== word[k]) {
              ok = false;
              break;
            }
          }
          if (!ok) continue;
          for (let k = 0; k < word.length; k++) {
            setCell(r0, c0 + k, word[k]);
          }
          wordInfos.push({
            word,
            dir: "h",
            r: r0,
            c: c0,
            source: item?.source ?? "",
            definition: item?.definition ?? "",
          });
          placed = true;
          break;
        }
      }
      if (placed) {
        used.add(word);
        break;
      }
    }
    if (!placed) {
      // 無法交叉則放在下方
      const maxR = gridRows.length - 1;
      const startR = maxR + 1;
      const startC = 0;
      ensureSize(startR + word.length - 1, word.length - 1);
      for (let k = 0; k < word.length; k++) {
        setCell(startR + k, startC, word[k]);
      }
      wordInfos.push({
        word,
        dir: "v",
        r: startR,
        c: startC,
        source: item?.source ?? "",
        definition: item?.definition ?? "",
      });
      used.add(word);
    }
  }

  // Normalize negative coordinates: find min row/col offset among all words
  let minR = 0;
  let minC = 0;
  for (const info of wordInfos) {
    if (info.r < minR) minR = info.r;
    if (info.c < minC) minC = info.c;
  }

  // If any coordinate is negative, rebuild the grid with offset
  if (minR < 0 || minC < 0) {
    const offsetR = -minR;
    const offsetC = -minC;
    const newGrid: (string | null)[][] = [];

    // Shift all word positions
    for (const info of wordInfos) {
      info.r += offsetR;
      info.c += offsetC;
    }

    // Rebuild grid from word data
    for (const info of wordInfos) {
      for (let k = 0; k < info.word.length; k++) {
        const r = info.dir === "h" ? info.r : info.r + k;
        const c = info.dir === "h" ? info.c + k : info.c;
        while (newGrid.length <= r) newGrid.push([]);
        while (newGrid[r].length <= c) newGrid[r].push(null);
        newGrid[r][c] = info.word[k];
      }
    }

    // Replace gridRows content
    gridRows.length = 0;
    for (const row of newGrid) gridRows.push(row);
  }

  const rawRows = gridRows.length;
  const rawCols = Math.max(0, ...gridRows.map((row) => row.length));
  if (rawRows === 0 || rawCols === 0) return null;

  // Normalize all rows to same width (don't force square — let grid expand naturally)
  for (const row of gridRows) {
    while (row.length < rawCols) row.push(null);
  }

  const rows = gridRows.length;
  const cols = Math.max(0, ...gridRows.map((row) => row.length));

  // 建立 cell 的 key： "r,c"
  const blankCells = new Map<string, { r: number; c: number }>();
  const wordIdToClueId = new Map<string, string>();
  let clueIndex = 0;
  const horizontalClues: { id: string; label: string; clue: string; source: string }[] = [];
  const verticalClues: { id: string; label: string; clue: string; source: string }[] = [];
  const labelH = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  const labelV: string[] = [];
  for (let i = 1; i <= 50; i++) labelV.push(String(i));

  for (const info of wordInfos) {
    const clueId = `c${clueIndex++}`;
    wordIdToClueId.set(`${info.r},${info.c},${info.dir}`, clueId);
    const clueText = info.definition || info.word.replace(/./g, "_");
    const source = info.source ? ` ${info.source}` : "";
    if (info.dir === "h") {
      const label = labelH[horizontalClues.length] ?? String(horizontalClues.length + 1);
      horizontalClues.push({
        id: clueId,
        label,
        clue: `${clueText}${source}`,
        source: info.source,
      });
    } else {
      const label = labelV[verticalClues.length] ?? String(verticalClues.length + 1);
      verticalClues.push({
        id: clueId,
        label,
        clue: `${clueText}${source}`,
        source: info.source,
      });
    }
  }

  const givenRatio = TIER_GIVEN_RATIO[tier];

  function findClueIdForCell(
    infos: typeof wordInfos,
    r: number,
    c: number
  ): string | null {
    for (const info of infos) {
      if (info.dir === "h") {
        if (r === info.r && c >= info.c && c < info.c + info.word.length) {
          return wordIdToClueId.get(`${info.r},${info.c},${info.dir}`) ?? null;
        }
      } else {
        if (c === info.c && r >= info.r && r < info.r + info.word.length) {
          return wordIdToClueId.get(`${info.r},${info.c},${info.dir}`) ?? null;
        }
      }
    }
    return null;
  }

  const grid: CrosswordCell[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: CrosswordCell[] = [];
    for (let c = 0; c < cols; c++) {
      const ch = getCell(r, c);
      if (ch === null) {
        row.push({ type: "block" });
      } else {
        const shouldShow = Math.random() < givenRatio;
        if (shouldShow) {
          row.push({ type: "given", value: ch });
        } else {
          blankCells.set(`${r},${c}`, { r, c });
          const clueId = findClueIdForCell(wordInfos, r, c);
          row.push({ type: "blank", clueId: clueId ?? `c${r}-${c}` });
        }
      }
    }
    grid.push(row);
  }

  const crosswordWords: CrosswordWord[] = wordInfos.map((info, idx) => ({
    id: wordIdToClueId.get(`${info.r},${info.c},${info.dir}`) ?? `w${idx}`,
    text: info.word,
    direction: info.dir === "h" ? "horizontal" : "vertical",
    startRow: info.r,
    startCol: info.c,
    clue: info.definition || info.word,
    source: info.source,
  }));

  const difficulty = tier;
  const levelTitle = TIER_TITLE[tier];

  return {
    id: generateId(),
    grid,
    words: crosswordWords,
    horizontalClues,
    verticalClues,
    difficulty,
    levelTitle,
  };
}
