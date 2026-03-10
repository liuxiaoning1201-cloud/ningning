/**
 * 填字生成器：輸入詞句陣列，產出 CrosswordPuzzle（橫豎交叉、難度分級）
 */

import { generateId } from "@/stores/puzzleSets";
import type { WordBankItem } from "@/lib/types";
import type { CrosswordPuzzle, CrosswordCell, CrosswordWord, DifficultyTier } from "@/lib/types";

export interface GeneratorInput {
  items: WordBankItem[];
  tier: DifficultyTier; // 初學 / 小試 / 漸入佳境 → 預填比例
}

const TIER_GIVEN_RATIO: Record<DifficultyTier, number> = {
  beginner: 0.6,
  intermediate: 0.4,
  advanced: 0.25,
};

const TIER_TITLE: Record<DifficultyTier, string> = {
  beginner: "初學入門",
  intermediate: "小試身手",
  advanced: "漸入佳境",
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
  const words = items.map((it) => it.text.trim()).filter((s) => s.length > 0);
  if (words.length === 0) return null;

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
    ensureSize(r, c);
    const row = gridRows[r];
    if (row[c] !== null && row[c] !== ch) return false; // 衝突
    row[c] = ch;
    return true;
  }

  function getCell(r: number, c: number): string | null {
    if (r < 0 || r >= gridRows.length) return null;
    const row = gridRows[r];
    if (c < 0 || c >= row.length) return null;
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

  const rows = gridRows.length;
  const cols = Math.max(0, ...gridRows.map((row) => row.length));
  if (rows === 0 || cols === 0) return null;

  // 建立 cell 的 key： "r,c"
  const blankCells = new Map<string, { r: number; c: number }>();
  const wordIdToClueId = new Map<string, string>();
  let clueIndex = 0;
  const horizontalClues: { id: string; label: string; clue: string; source: string }[] = [];
  const verticalClues: { id: string; label: string; clue: string; source: string }[] = [];
  const labelH = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  const labelV = "一二三四五六七八九十".split("");

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

  const difficulty = tier === "beginner" ? 1 : tier === "intermediate" ? 2 : 3;
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
