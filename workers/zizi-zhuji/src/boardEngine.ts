/**
 * 通用棋盤引擎：可變大小、四方向連線檢測、N 連數量統計。
 * 與內容類型解耦：只關心「同色連續格」邏輯。
 */

import type {
  BoardState,
  CellState,
  ConnectedLine,
  Player,
} from "../../../shared/zizizhujiTypes.js";

export function emptyBoard(size: number): BoardState {
  const cells: CellState[][] = [];
  for (let r = 0; r < size; r++) {
    const row: CellState[] = [];
    for (let c = 0; c < size; c++) row.push({ type: "empty" });
    cells.push(row);
  }
  return { size, cells };
}

export function cloneBoard(b: BoardState): BoardState {
  return {
    size: b.size,
    cells: b.cells.map((row) => row.map((cell) => ({ ...cell }))),
  };
}

export function inBounds(b: BoardState, r: number, c: number): boolean {
  return r >= 0 && r < b.size && c >= 0 && c < b.size;
}

/**
 * 嘗試把某玩家落在 (r,c)。
 * 規則：
 *   - empty 格 → 變成 claimed（沒字）
 *   - char 格（B/E 預填）→ 變成 claimed 並保留 ch
 *   - 已 claimed → 拒絕
 * 回傳實際落到的 cell（含 ch 若有）。
 */
export function tryPlace(b: BoardState, r: number, c: number, by: Player): CellState | null {
  if (!inBounds(b, r, c)) return null;
  const cell = b.cells[r][c];
  if (cell.type === "claimed") return null;
  let next: CellState;
  if (cell.type === "char") {
    next = { type: "claimed", ch: cell.ch, by };
  } else {
    next = { type: "claimed", by };
  }
  b.cells[r][c] = next;
  return next;
}

const DIRS: { name: "h"|"v"|"d1"|"d2"; dr: number; dc: number }[] = [
  { name: "h",  dr: 0, dc: 1 },
  { name: "v",  dr: 1, dc: 0 },
  { name: "d1", dr: 1, dc: 1 },
  { name: "d2", dr: 1, dc: -1 },
];

function isClaimedBy(cell: CellState, p: Player): boolean {
  return cell.type === "claimed" && cell.by === p;
}

/** 從 (r,c) 朝 (dr,dc) 方向延伸找最長同色連續段（含起點），回傳 cell 序列。 */
function maxLineFrom(
  b: BoardState,
  r: number,
  c: number,
  dr: number,
  dc: number,
  by: Player
): { r: number; c: number }[] {
  const cells: { r: number; c: number }[] = [];
  // 先回退到頭
  let sr = r, sc = c;
  while (inBounds(b, sr - dr, sc - dc) && isClaimedBy(b.cells[sr - dr][sc - dc], by)) {
    sr -= dr;
    sc -= dc;
  }
  while (inBounds(b, sr, sc) && isClaimedBy(b.cells[sr][sc], by)) {
    cells.push({ r: sr, c: sc });
    sr += dr;
    sc += dc;
  }
  return cells;
}

/**
 * 從最近落子點 (r,c) 找出 4 個方向的連線。
 * 回傳 4 條（可能少於 minLen）。
 */
export function linesThrough(
  b: BoardState,
  r: number,
  c: number,
  by: Player,
  minLen: number
): ConnectedLine[] {
  const out: ConnectedLine[] = [];
  for (const d of DIRS) {
    const cells = maxLineFrom(b, r, c, d.dr, d.dc, by);
    if (cells.length >= minLen) {
      out.push({
        cells: cells.map((p) => {
          const cell = b.cells[p.r][p.c];
          const ch = cell.type === "claimed" ? cell.ch : undefined;
          return { r: p.r, c: p.c, ch };
        }),
        direction: d.name,
        by,
      });
    }
  }
  return out;
}

/**
 * 找出整個棋盤上某玩家所有「正好等於 lineLength」的連線。
 * 用於 count 模式累計計分（避免「6 連」算成兩條 5 連）。
 */
export function countExactLines(
  b: BoardState,
  by: Player,
  lineLength: number
): { lines: ConnectedLine[]; total: number } {
  const lines: ConnectedLine[] = [];
  const seen = new Set<string>();
  for (let r = 0; r < b.size; r++) {
    for (let c = 0; c < b.size; c++) {
      if (!isClaimedBy(b.cells[r][c], by)) continue;
      for (const d of DIRS) {
        const prevR = r - d.dr;
        const prevC = c - d.dc;
        if (inBounds(b, prevR, prevC) && isClaimedBy(b.cells[prevR][prevC], by)) continue;

        const cells: { r: number; c: number }[] = [];
        let sr = r, sc = c;
        while (inBounds(b, sr, sc) && isClaimedBy(b.cells[sr][sc], by)) {
          cells.push({ r: sr, c: sc });
          sr += d.dr;
          sc += d.dc;
        }
        if (cells.length < lineLength) continue;
        // 對每個長度 == lineLength 的子段
        for (let i = 0; i + lineLength <= cells.length; i++) {
          const seg = cells.slice(i, i + lineLength);
          const key = `${d.name}:${seg[0].r},${seg[0].c}-${seg[seg.length - 1].r},${seg[seg.length - 1].c}`;
          if (seen.has(key)) continue;
          seen.add(key);
          lines.push({
            cells: seg.map((p) => {
              const cell = b.cells[p.r][p.c];
              const ch = cell.type === "claimed" ? cell.ch : undefined;
              return { r: p.r, c: p.c, ch };
            }),
            direction: d.name,
            by,
          });
        }
      }
    }
  }
  return { lines, total: lines.length };
}

export function isFull(b: BoardState): boolean {
  for (let r = 0; r < b.size; r++) {
    for (let c = 0; c < b.size; c++) {
      if (b.cells[r][c].type !== "claimed") return false;
    }
  }
  return true;
}
