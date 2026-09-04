/**
 * 棋盤生成器：依照規則的 ContentType 產出預填字 BoardState。
 *
 * 演算法（打散重組 / Scramble）：
 *   1. 先準備候選詞/句子清單（依 content type）
 *   2. 把每個目標詞以「隨機方向（含兩條斜線）+ 隨機位置」埋成隱藏解線，允許共字交叉
 *   3. 其餘空格用「答案字加倍重複 + 高頻噪音字」的權重池填滿，
 *      讓答案字散佈全盤、出現多次，使單一乾淨的成語行不再一眼可辨
 *   4. 棋盤太小無法打散時，退回舊式連續鋪以確保可玩（free 模式整盤高頻字）
 */

import type { BoardState, ContentType } from "../../../shared/zizizhujiTypes.js";
import { emptyBoard, inBounds } from "./boardEngine.js";
import { BUILTIN_IDIOMS } from "./content/idioms.js";
import { POEMS_5, POEMS_7 } from "./content/poems.js";
import { SENTENCES } from "./content/sentences.js";
import { HIGH_FREQ_CHARS } from "./content/highFreq.js";

interface GenInput {
  size: number;
  contentType: ContentType;
  /** 老師自選的內容清單（可覆蓋預設） */
  customTexts?: string[];
  /** 命中所需的連線長度；用於打散模式的解線驗證。 */
  lineLength?: number;
  rng: () => number;
}

interface PlacedWord {
  text: string;
  r: number;
  c: number;
  dir: "h" | "v" | "d1" | "d2";
}

/** 四個連線方向，與 boardEngine 的 DIRS 對齊。 */
const DIRS: { name: PlacedWord["dir"]; dr: number; dc: number }[] = [
  { name: "h", dr: 0, dc: 1 },
  { name: "v", dr: 1, dc: 0 },
  { name: "d1", dr: 1, dc: 1 },
  { name: "d2", dr: 1, dc: -1 },
];

const MAX_PLACE_ATTEMPTS = 120;
const MAX_BOARD_ATTEMPTS = 12;

export function generateBoard(input: GenInput): { board: BoardState; placed: PlacedWord[]; texts: string[] } {
  const { size, contentType, rng } = input;
  if (contentType === "free") {
    return { board: fillRandom(size, rng), placed: [], texts: [] };
  }

  const candidates = pickCandidates(contentType, input.customTexts);
  const targetLen = input.lineLength ?? defaultLineLength(contentType);

  if (candidates.length === 0) {
    return { board: fillRandom(size, rng), placed: [], texts: [] };
  }

  let best: { board: BoardState; placed: PlacedWord[] } | null = null;
  for (let attempt = 0; attempt < MAX_BOARD_ATTEMPTS; attempt++) {
    const result = buildScrambledBoard(size, candidates, rng);
    if (!best || result.placed.length > best.placed.length) best = result;
    if (result.placed.length >= minSeeds(size, candidates.length)) break;
  }

  if (!best || best.placed.length === 0) {
    return fallbackContiguous(size, candidates, rng, targetLen);
  }

  return { board: best.board, placed: best.placed, texts: candidates };
}

/** 目標要埋進的解線數量：依棋盤面積與候選數縮放。 */
function minSeeds(size: number, candidateCount: number): number {
  const byArea = Math.floor((size * size) / 45);
  return Math.max(3, Math.min(candidateCount, byArea));
}

function buildScrambledBoard(
  size: number,
  candidates: string[],
  rng: () => number
): { board: BoardState; placed: PlacedWord[] } {
  const board = emptyBoard(size);
  const placed: PlacedWord[] = [];
  const want = minSeeds(size, candidates.length);

  const order = shuffle(candidates);
  for (const text of order) {
    if (placed.length >= Math.min(candidates.length, want + 2)) break;
    const slot = embedSeed(board, text, rng);
    if (slot) placed.push(slot);
  }

  const pool = buildFillPool(candidates);
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (board.cells[r][c].type === "empty") {
        const ch = pool[Math.floor(rng() * pool.length)];
        board.cells[r][c] = { type: "char", ch };
      }
    }
  }

  return { board, placed };
}

/** 在隨機方向、隨機位置嘗試埋入一個詞（允許與既有字共用相同字）。 */
function embedSeed(b: BoardState, text: string, rng: () => number): PlacedWord | null {
  for (let attempt = 0; attempt < MAX_PLACE_ATTEMPTS; attempt++) {
    const dir = DIRS[Math.floor(rng() * DIRS.length)];
    const r = Math.floor(rng() * b.size);
    const c = Math.floor(rng() * b.size);
    if (writeWordDir(b, text, r, c, dir.dr, dir.dc)) {
      return { text, r, c, dir: dir.name };
    }
  }
  return null;
}

/** 建立填充用字池：答案字重複數次 + 全部高頻字，使答案字密度夠高以偽裝種子。 */
function buildFillPool(candidates: string[]): string[] {
  const answerChars = new Set<string>();
  for (const w of candidates) for (const ch of w) answerChars.add(ch);
  const pool: string[] = [];
  const DUP = 2;
  for (const ch of answerChars) for (let i = 0; i < DUP; i++) pool.push(ch);
  for (const ch of HIGH_FREQ_CHARS) pool.push(ch);
  return pool;
}

function pickCandidates(type: ContentType, custom?: string[]): string[] {
  if (custom && custom.length > 0) return custom.slice(0, 30);
  switch (type) {
    case "idiom":
      return shuffle(BUILTIN_IDIOMS.map((i) => i.text)).slice(0, 16);
    case "poem-5":
      return shuffle(POEMS_5.map((p) => p.text)).slice(0, 12);
    case "poem-7":
      return shuffle(POEMS_7.map((p) => p.text)).slice(0, 8);
    case "sentence":
      return shuffle(SENTENCES.map((s) => s.text)).slice(0, 10);
    case "char":
    case "word":
      return shuffle(BUILTIN_IDIOMS.map((i) => i.text)).slice(0, 12);
    default:
      return [];
  }
}

function defaultLineLength(type: ContentType): number {
  switch (type) {
    case "idiom":
      return 4;
    case "poem-5":
      return 5;
    case "poem-7":
      return 7;
    case "sentence":
      return 5;
    case "char":
      return 4;
    case "word":
      return 2;
    default:
      return 5;
  }
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function canWriteDir(b: BoardState, text: string, r: number, c: number, dr: number, dc: number): boolean {
  for (let i = 0; i < text.length; i++) {
    const rr = r + dr * i;
    const cc = c + dc * i;
    if (!inBounds(b, rr, cc)) return false;
    const cell = b.cells[rr][cc];
    if (cell.type === "char" && cell.ch !== text[i]) return false;
    if (cell.type === "claimed") return false;
  }
  return true;
}

function writeWordDir(b: BoardState, text: string, r: number, c: number, dr: number, dc: number): boolean {
  if (!canWriteDir(b, text, r, c, dr, dc)) return false;
  for (let i = 0; i < text.length; i++) {
    const rr = r + dr * i;
    const cc = c + dc * i;
    b.cells[rr][cc] = { type: "char", ch: text[i] };
  }
  return true;
}

/** 退路：舊式連續鋪（僅在打散失敗時使用，確保棋盤仍可玩）。 */
function fallbackContiguous(
  size: number,
  candidates: string[],
  rng: () => number,
  _targetLen: number
): { board: BoardState; placed: PlacedWord[]; texts: string[] } {
  const board = emptyBoard(size);
  const placed: PlacedWord[] = [];
  for (const text of candidates) {
    const dir = rng() < 0.5 ? { dr: 0, dc: 1, name: "h" as const } : { dr: 1, dc: 0, name: "v" as const };
    let ok = false;
    for (let a = 0; a < MAX_PLACE_ATTEMPTS && !ok; a++) {
      const r = Math.floor(rng() * size);
      const c = Math.floor(rng() * size);
      if (writeWordDir(board, text, r, c, dir.dr, dir.dc)) {
        placed.push({ text, r, c, dir: dir.name });
        ok = true;
      }
    }
  }
  fillRemaining(board, rng);
  return { board, placed, texts: candidates };
}

function fillRandom(size: number, rng: () => number): BoardState {
  const b = emptyBoard(size);
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const ch = HIGH_FREQ_CHARS[Math.floor(rng() * HIGH_FREQ_CHARS.length)];
      b.cells[r][c] = { type: "char", ch };
    }
  }
  return b;
}

function fillRemaining(b: BoardState, rng: () => number): void {
  for (let r = 0; r < b.size; r++) {
    for (let c = 0; c < b.size; c++) {
      if (b.cells[r][c].type === "empty") {
        const ch = HIGH_FREQ_CHARS[Math.floor(rng() * HIGH_FREQ_CHARS.length)];
        b.cells[r][c] = { type: "char", ch };
      }
    }
  }
}

/** 對某內容類型，提取其字典命中集（給 ruleEngine 使用） */
export function getContentDictionary(type: ContentType, custom?: string[]): Set<string> {
  if (custom && custom.length > 0) return new Set(custom);
  switch (type) {
    case "idiom":
      return new Set(BUILTIN_IDIOMS.map((i) => i.text));
    case "poem-5":
      return new Set(POEMS_5.map((p) => p.text));
    case "poem-7":
      return new Set(POEMS_7.map((p) => p.text));
    case "sentence":
      return new Set(SENTENCES.map((s) => s.text));
    default:
      return new Set();
  }
}
