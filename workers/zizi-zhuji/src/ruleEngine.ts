/**
 * 規則執行器：把「落子閘 placement gate」與「勝負判定 win evaluator」
 * 抽象成可組合的純函式。
 *
 * 三種勝負：
 *   1. first    — 先連到 N 子勝
 *   2. count    — 限時內 N 連數量多者勝
 *   3. complete — 連線同時是已收錄詞/句/詩的子串者勝
 */

import type {
  BoardState,
  ConnectedLine,
  ContentType,
  GameRule,
  Player,
} from "../../../shared/zizizhujiTypes.js";
import { countExactLines, linesThrough } from "./boardEngine.js";
import { getContentDictionary } from "./boardGenerator.js";

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
    // 取最長那條（規則只要 ≥ N）
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

export interface CompleteResult {
  kind: "complete";
  /** 連線中能命中字典的子串清單（以 line 為單位） */
  hits: { line: ConnectedLine; substring: string; startIdx: number }[];
}

export function evaluateComplete(
  b: BoardState,
  lastMove: { r: number; c: number; player: Player },
  rule: GameRule,
  customTexts?: string[]
): CompleteResult {
  const lineLen = resolveLineLength(rule);
  // 連線可大於 lineLen，也接受
  const lines = linesThrough(b, lastMove.r, lastMove.c, lastMove.player, lineLen);
  const dict = getContentDictionary(
    rule.win.kind === "complete" ? rule.win.targetType : rule.content,
    customTexts
  );
  const targetType = rule.win.kind === "complete" ? rule.win.targetType : rule.content;
  const targetLen = expectedLen(targetType);

  const hits: CompleteResult["hits"] = [];
  for (const line of lines) {
    const text = line.cells.map((c) => c.ch || "").join("");
    if (targetLen > 0) {
      // 固定長度：取所有 targetLen 子串嘗試
      for (let i = 0; i + targetLen <= text.length; i++) {
        const sub = text.slice(i, i + targetLen);
        if (dict.has(sub)) {
          hits.push({ line, substring: sub, startIdx: i });
          break; // 一條連線只命中一次（避免重複計分）
        }
      }
    } else {
      // 動態長度（句子）：嘗試 5-12 字子串
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
    case "sentence": return 0; // 動態
    default:        return 0;
  }
}

/** 玩家提交「宣告連線拼出某內容」的驗證入口（B/E 模式 client → server） */
export function verifyDeclaration(
  b: BoardState,
  cells: { r: number; c: number }[],
  player: Player,
  declaredText: string,
  rule: GameRule,
  customTexts?: string[]
): { ok: boolean; reason?: string } {
  if (cells.length < 2) return { ok: false, reason: "連線過短" };
  // 確認 cells 連續且同方向
  const sameLine = cellsAreAlignedAndContiguous(cells);
  if (!sameLine) return { ok: false, reason: "選取的格子未連成直線" };

  // 確認所有 cell 都是該玩家 claimed
  for (const cell of cells) {
    const cellState = b.cells[cell.r]?.[cell.c];
    if (!cellState || cellState.type !== "claimed" || cellState.by !== player) {
      return { ok: false, reason: "選取的格子並非你的棋子" };
    }
  }

  // 確認 cells 對應的字串等於 declaredText
  const text = cells
    .map((c) => {
      const cs = b.cells[c.r][c.c];
      return cs.type === "claimed" ? cs.ch || "" : "";
    })
    .join("");
  if (text !== declaredText) return { ok: false, reason: "選取的字不等於宣告內容" };

  // 確認 declaredText 在字典中
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
