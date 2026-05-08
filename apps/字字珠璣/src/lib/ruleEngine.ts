import type {
  BoardState,
  ConnectedLine,
  ContentType,
  GameRule,
  Player,
} from "@/lib/types";
import { countExactLines, linesThrough } from "./boardEngine";
import { getContentDictionary } from "./content";

export function resolveLineLength(rule: GameRule): number {
  if (typeof rule.lineLength === "number") return rule.lineLength;
  switch (rule.content) {
    case "idiom":   return 4;
    case "poem-5":  return 5;
    case "poem-7":  return 7;
    case "sentence": return 5;
    case "char":    return 4;
    case "word":    return 2;
    default:        return 5;
  }
}

export interface FirstResult {
  kind: "first";
  winner: Player | null;
  line: ConnectedLine | null;
}

export function evaluateFirst(
  b: BoardState,
  lastMove: { r: number; c: number; player: Player },
  lineLen: number
): FirstResult {
  const lines = linesThrough(b, lastMove.r, lastMove.c, lastMove.player, lineLen);
  if (lines.length > 0) {
    let best = lines[0];
    for (const l of lines) if (l.cells.length > best.cells.length) best = l;
    return { kind: "first", winner: lastMove.player, line: best };
  }
  return { kind: "first", winner: null, line: null };
}

export interface CountResult {
  kind: "count";
  scores: Record<Player, number>;
}

export function evaluateCount(b: BoardState, lineLen: number): CountResult {
  const black = countExactLines(b, "black", lineLen).total;
  const white = countExactLines(b, "white", lineLen).total;
  return { kind: "count", scores: { black, white } };
}

export interface CompleteHit {
  line: ConnectedLine;
  substring: string;
  startIdx: number;
}

export function evaluateComplete(
  b: BoardState,
  lastMove: { r: number; c: number; player: Player },
  rule: GameRule,
  customTexts?: string[]
): { kind: "complete"; hits: CompleteHit[] } {
  const lineLen = resolveLineLength(rule);
  const lines = linesThrough(b, lastMove.r, lastMove.c, lastMove.player, lineLen);
  const dict = getContentDictionary(
    rule.win.kind === "complete" ? rule.win.targetType : rule.content,
    customTexts
  );
  const targetType = rule.win.kind === "complete" ? rule.win.targetType : rule.content;
  const targetLen = expectedLen(targetType);

  const hits: CompleteHit[] = [];
  for (const line of lines) {
    const text = line.cells.map((c) => c.ch || "").join("");
    if (targetLen > 0) {
      for (let i = 0; i + targetLen <= text.length; i++) {
        const sub = text.slice(i, i + targetLen);
        if (dict.has(sub)) {
          hits.push({ line, substring: sub, startIdx: i });
          break;
        }
      }
    } else {
      for (let len = 5; len <= Math.min(12, text.length); len++) {
        let found = false;
        for (let i = 0; i + len <= text.length && !found; i++) {
          const sub = text.slice(i, i + len);
          if (dict.has(sub)) {
            hits.push({ line, substring: sub, startIdx: i });
            found = true;
          }
        }
        if (found) break;
      }
    }
  }
  return { kind: "complete", hits };
}

function expectedLen(t: ContentType): number {
  switch (t) {
    case "idiom":   return 4;
    case "poem-5":  return 5;
    case "poem-7":  return 7;
    case "word":    return 2;
    case "char":    return 0;
    case "sentence": return 0;
    default:        return 0;
  }
}

/** 客戶端「即時提示」：找出本玩家所有連線中最有潛力的拼出 hint。 */
export interface LineHint {
  cells: { r: number; c: number; ch?: string }[];
  text: string;
  candidates: string[]; // 接近命中（編輯距離 / 子串差 1）的字典條目
  perfectHit?: string;
}

export function findLineHints(
  b: BoardState,
  player: Player,
  rule: GameRule,
  customTexts?: string[]
): LineHint[] {
  const targetType = rule.win.kind === "complete" ? rule.win.targetType : rule.content;
  const dict = Array.from(getContentDictionary(targetType, customTexts));
  const dictSet = new Set(dict);
  const targetLen = expectedLen(targetType);
  const out: LineHint[] = [];

  // 找出該玩家所有 ≥ targetLen-1 的連線
  for (let r = 0; r < b.size; r++) {
    for (let c = 0; c < b.size; c++) {
      const cell = b.cells[r][c];
      if (cell.type !== "claimed" || cell.by !== player) continue;
      const lines = linesThrough(b, r, c, player, Math.max(2, targetLen ? targetLen - 1 : 4));
      for (const line of lines) {
        const text = line.cells.map((cc) => cc.ch || "").join("");
        if (text.length < (targetLen || 5) - 1) continue;
        const hint: LineHint = {
          cells: line.cells,
          text,
          candidates: [],
        };
        if (targetLen > 0) {
          for (let i = 0; i + targetLen <= text.length; i++) {
            const sub = text.slice(i, i + targetLen);
            if (dictSet.has(sub)) {
              hint.perfectHit = sub;
              break;
            }
          }
          if (!hint.perfectHit && targetLen > 0) {
            // 找接近命中的（差 1 字）
            for (const item of dict) {
              if (item.length !== targetLen) continue;
              if (substrDiffOne(text, item)) hint.candidates.push(item);
              if (hint.candidates.length >= 3) break;
            }
          }
        }
        if (hint.perfectHit || hint.candidates.length > 0) out.push(hint);
      }
    }
  }
  // 去重
  return dedupeHints(out);
}

function substrDiffOne(longer: string, target: string): boolean {
  for (let i = 0; i + target.length <= longer.length; i++) {
    let diff = 0;
    for (let j = 0; j < target.length; j++) {
      if (longer[i + j] !== target[j]) diff++;
      if (diff > 1) break;
    }
    if (diff <= 1) return true;
  }
  return false;
}

function dedupeHints(hints: LineHint[]): LineHint[] {
  const seen = new Set<string>();
  const out: LineHint[] = [];
  for (const h of hints) {
    const key = h.cells.map((c) => `${c.r},${c.c}`).join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(h);
  }
  return out;
}

/** 驗證玩家宣告的 cells 是否合法 */
export function verifyDeclaration(
  b: BoardState,
  cells: { r: number; c: number }[],
  player: Player,
  declaredText: string,
  rule: GameRule,
  customTexts?: string[]
): { ok: boolean; reason?: string } {
  if (cells.length < 2) return { ok: false, reason: "連線過短" };
  if (!cellsAreAlignedAndContiguous(cells)) return { ok: false, reason: "選取的格子未連成直線" };
  for (const cell of cells) {
    const cellState = b.cells[cell.r]?.[cell.c];
    if (!cellState || cellState.type !== "claimed" || cellState.by !== player) {
      return { ok: false, reason: "選取的格子並非你的棋子" };
    }
  }
  const text = cells
    .map((c) => {
      const cs = b.cells[c.r][c.c];
      return cs.type === "claimed" ? cs.ch || "" : "";
    })
    .join("");
  if (text !== declaredText) return { ok: false, reason: "選取的字不等於宣告內容" };
  const targetType = rule.win.kind === "complete" ? rule.win.targetType : rule.content;
  const dict = getContentDictionary(targetType, customTexts);
  if (!dict.has(declaredText)) return { ok: false, reason: "未收錄此內容" };
  return { ok: true };
}

function cellsAreAlignedAndContiguous(cells: { r: number; c: number }[]): boolean {
  if (cells.length < 2) return false;
  const dr = cells[1].r - cells[0].r;
  const dc = cells[1].c - cells[0].c;
  if (dr === 0 && dc === 0) return false;
  if (Math.abs(dr) > 1 || Math.abs(dc) > 1) return false;
  for (let i = 1; i < cells.length; i++) {
    if (cells[i].r - cells[i - 1].r !== dr) return false;
    if (cells[i].c - cells[i - 1].c !== dc) return false;
  }
  return true;
}
