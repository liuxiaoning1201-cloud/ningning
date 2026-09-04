import type { BoardState, CellState, ConnectedLine, Player } from "@/lib/types";

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

const DIRS: { name: "h" | "v" | "d1" | "d2"; dr: number; dc: number }[] = [
  { name: "h", dr: 0, dc: 1 },
  { name: "v", dr: 1, dc: 0 },
  { name: "d1", dr: 1, dc: 1 },
  { name: "d2", dr: 1, dc: -1 },
];

function isClaimedBy(cell: CellState, p: Player): boolean {
  return cell.type === "claimed" && cell.by === p;
}

function maxLineFrom(
  b: BoardState,
  r: number,
  c: number,
  dr: number,
  dc: number,
  by: Player
): { r: number; c: number }[] {
  const cells: { r: number; c: number }[] = [];
  let sr = r;
  let sc = c;
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
        let sr = r;
        let sc = c;
        while (inBounds(b, sr, sc) && isClaimedBy(b.cells[sr][sc], by)) {
          cells.push({ r: sr, c: sc });
          sr += d.dr;
          sc += d.dc;
        }
        if (cells.length < lineLength) continue;
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
