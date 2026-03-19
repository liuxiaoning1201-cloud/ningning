/**
 * 產生一組 9x9 數獨解（每行、每列、每宮 0-8 各出現一次）
 */
function createSolvedGrid(): number[][] {
  const grid: number[][] = Array.from({ length: 9 }, () => Array(9).fill(-1));

  function canPlace(r: number, c: number, val: number): boolean {
    for (let i = 0; i < 9; i++) if (grid[r][i] === val) return false;
    for (let i = 0; i < 9; i++) if (grid[i][c] === val) return false;
    const br = Math.floor(r / 3) * 3;
    const bc = Math.floor(c / 3) * 3;
    for (let i = br; i < br + 3; i++)
      for (let j = bc; j < bc + 3; j++) if (grid[i][j] === val) return false;
    return true;
  }

  function solve(r: number, c: number): boolean {
    if (r === 9) return true;
    if (c === 9) return solve(r + 1, 0);
    if (grid[r][c] >= 0) return solve(r, c + 1);
    const order = [0, 1, 2, 3, 4, 5, 6, 7, 8].sort(() => Math.random() - 0.5);
    for (const v of order) {
      if (!canPlace(r, c, v)) continue;
      grid[r][c] = v;
      if (solve(r, c + 1)) return true;
      grid[r][c] = -1;
    }
    return false;
  }

  solve(0, 0);
  return grid;
}

/**
 * 依給定數量預填格數，產生 given 遮罩（其餘為空格）
 * filledCount: 要保留的格數（約 25–40 較適合）
 */
export function createSudokuPuzzle(filledCount: number): { solution: number[][]; given: boolean[][] } {
  const solution = createSolvedGrid();
  const indices: [number, number][] = [];
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) indices.push([r, c]);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  const given = Array.from({ length: 9 }, () => Array(9).fill(false));
  const toFill = Math.min(81, Math.max(20, filledCount));
  for (let k = 0; k < toFill; k++) {
    const [r, c] = indices[k];
    given[r][c] = true;
  }
  return { solution, given };
}

/**
 * 檢查 9x9 盤面是否合法（每行/列/宮 0-8 各一）
 */
export function validateSudoku(grid: number[][]): boolean {
  for (let i = 0; i < 9; i++) {
    const row = new Set<number>();
    const col = new Set<number>();
    for (let j = 0; j < 9; j++) {
      const v = grid[i][j];
      if (v < 0 || v > 8 || row.has(v)) return false;
      row.add(v);
      const w = grid[j][i];
      if (w < 0 || w > 8 || col.has(w)) return false;
      col.add(w);
    }
  }
  for (let br = 0; br < 3; br++)
    for (let bc = 0; bc < 3; bc++) {
      const box = new Set<number>();
      for (let i = 0; i < 3; i++)
        for (let j = 0; j < 3; j++) {
          const v = grid[br * 3 + i][bc * 3 + j];
          if (v < 0 || v > 8 || box.has(v)) return false;
          box.add(v);
        }
    }
  return true;
}
