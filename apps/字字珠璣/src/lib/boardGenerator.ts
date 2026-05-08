import type { BoardState, ContentType } from "@/lib/types";
import { emptyBoard, inBounds } from "./boardEngine";
import { BUILTIN_IDIOMS, POEMS_5, POEMS_7, SENTENCES, HIGH_FREQ_CHARS } from "./content";

interface GenInput {
  size: number;
  contentType: ContentType;
  customTexts?: string[];
  rng?: () => number;
}

interface PlacedWord {
  text: string;
  r: number;
  c: number;
  dir: "h" | "v";
}

const MAX_ATTEMPTS = 80;

export function generateBoard(input: GenInput): {
  board: BoardState;
  placed: PlacedWord[];
  texts: string[];
} {
  const rng = input.rng ?? Math.random;
  const { size, contentType } = input;

  if (contentType === "free") {
    return { board: fillRandom(size, rng), placed: [], texts: [] };
  }

  const candidates = pickCandidates(contentType, input.customTexts);
  const board = emptyBoard(size);
  const placed: PlacedWord[] = [];

  if (candidates.length > 0) {
    const first = candidates[0];
    const dir = rng() < 0.5 ? "h" : "v";
    const len = first.length;
    const r = Math.floor((size - (dir === "v" ? len : 1)) / 2);
    const c = Math.floor((size - (dir === "h" ? len : 1)) / 2);
    if (writeWord(board, first, r, c, dir)) placed.push({ text: first, r, c, dir });
  }

  for (let i = 1; i < candidates.length; i++) {
    const text = candidates[i];
    let success = false;
    for (let attempt = 0; attempt < MAX_ATTEMPTS && !success; attempt++) {
      if (placed.length > 0 && attempt < MAX_ATTEMPTS / 2) {
        const target = placed[Math.floor(rng() * placed.length)];
        const slot = tryCross(board, text, target);
        if (slot) {
          placed.push(slot);
          success = true;
        }
      } else {
        const dir: "h" | "v" = rng() < 0.5 ? "h" : "v";
        const len = text.length;
        const maxR = dir === "h" ? size : size - len;
        const maxC = dir === "h" ? size - len : size;
        const r = Math.floor(rng() * Math.max(1, maxR));
        const c = Math.floor(rng() * Math.max(1, maxC));
        if (canWrite(board, text, r, c, dir)) {
          if (writeWord(board, text, r, c, dir)) {
            placed.push({ text, r, c, dir });
            success = true;
          }
        }
      }
    }
  }

  fillRemaining(board, rng);
  return { board, placed, texts: candidates };
}

function pickCandidates(type: ContentType, custom?: string[]): string[] {
  if (custom && custom.length > 0) return custom.slice(0, 30);
  switch (type) {
    case "idiom":   return shuffle(BUILTIN_IDIOMS.map((i) => i.text)).slice(0, 16);
    case "poem-5":  return shuffle(POEMS_5.map((p) => p.text)).slice(0, 12);
    case "poem-7":  return shuffle(POEMS_7.map((p) => p.text)).slice(0, 8);
    case "sentence":return shuffle(SENTENCES.map((s) => s.text)).slice(0, 10);
    case "char":
    case "word":    return shuffle(BUILTIN_IDIOMS.map((i) => i.text)).slice(0, 12);
    default:        return [];
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

function canWrite(b: BoardState, text: string, r: number, c: number, dir: "h" | "v"): boolean {
  for (let i = 0; i < text.length; i++) {
    const rr = dir === "h" ? r : r + i;
    const cc = dir === "h" ? c + i : c;
    if (!inBounds(b, rr, cc)) return false;
    const cell = b.cells[rr][cc];
    if (cell.type === "char" && cell.ch !== text[i]) return false;
    if (cell.type === "claimed") return false;
  }
  return true;
}

function writeWord(b: BoardState, text: string, r: number, c: number, dir: "h" | "v"): boolean {
  if (!canWrite(b, text, r, c, dir)) return false;
  for (let i = 0; i < text.length; i++) {
    const rr = dir === "h" ? r : r + i;
    const cc = dir === "h" ? c + i : c;
    b.cells[rr][cc] = { type: "char", ch: text[i] };
  }
  return true;
}

function tryCross(b: BoardState, text: string, target: PlacedWord): PlacedWord | null {
  const newDir: "h" | "v" = target.dir === "h" ? "v" : "h";
  for (let ti = 0; ti < target.text.length; ti++) {
    const tCh = target.text[ti];
    const targetR = target.dir === "h" ? target.r : target.r + ti;
    const targetC = target.dir === "h" ? target.c + ti : target.c;
    for (let ni = 0; ni < text.length; ni++) {
      if (text[ni] !== tCh) continue;
      const r = newDir === "h" ? targetR : targetR - ni;
      const c = newDir === "h" ? targetC - ni : targetC;
      if (writeWord(b, text, r, c, newDir)) {
        return { text, r, c, dir: newDir };
      }
    }
  }
  return null;
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
