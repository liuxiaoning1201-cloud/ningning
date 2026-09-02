/**
 * 把 makemeahanzi / animCJK 的 SVG path 抽成折線，用來量墨跡外框。
 * 物品要貼在學生看見的字影上，不能只靠中線。
 */

export interface PathBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  cx: number;
  cy: number;
  width: number;
  height: number;
}

const GRID = 1024;
const TOP = 900;

function toUnit(x: number, y: number): [number, number] {
  return [x / GRID, (TOP - y) / GRID];
}

function tokenize(d: string): (string | number)[] {
  const tokens: (string | number)[] = [];
  const re = /([MLCQZmlcqz])|(-?\d*\.?\d+(?:e[-+]?\d+)?)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(d))) {
    if (m[1]) tokens.push(m[1]);
    else tokens.push(Number(m[2]));
  }
  return tokens;
}

function cubic(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
  n = 10
): [number, number][] {
  const pts: [number, number][] = [];
  for (let k = 1; k <= n; k += 1) {
    const t = k / n;
    const u = 1 - t;
    pts.push([
      u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3,
      u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3,
    ]);
  }
  return pts;
}

function quad(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  n = 8
): [number, number][] {
  const pts: [number, number][] = [];
  for (let k = 1; k <= n; k += 1) {
    const t = k / n;
    const u = 1 - t;
    pts.push([u * u * x0 + 2 * u * t * x1 + t * t * x2, u * u * y0 + 2 * u * t * y1 + t * t * y2]);
  }
  return pts;
}

/** 抽出 path 上的取樣點（原始 1024 座標）。 */
export function sampleStrokePath(d: string): [number, number][] {
  const t = tokenize(d);
  const pts: [number, number][] = [];
  let i = 0;
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;
  let prev = '';

  const read = () => t[i++] as number;

  while (i < t.length) {
    const tok = t[i];
    let cmd: string;
    if (typeof tok === 'string') {
      cmd = tok;
      i += 1;
      prev = cmd;
    } else {
      cmd = prev === 'M' ? 'L' : prev === 'm' ? 'l' : prev;
    }

    if (cmd === 'M' || cmd === 'm') {
      const rel = cmd === 'm';
      cx = rel ? cx + read() : read();
      cy = rel ? cy + read() : read();
      sx = cx;
      sy = cy;
      pts.push([cx, cy]);
      prev = cmd === 'm' ? 'l' : 'L';
    } else if (cmd === 'L' || cmd === 'l') {
      const rel = cmd === 'l';
      cx = rel ? cx + read() : read();
      cy = rel ? cy + read() : read();
      pts.push([cx, cy]);
    } else if (cmd === 'C' || cmd === 'c') {
      const rel = cmd === 'c';
      const x1 = rel ? cx + read() : read();
      const y1 = rel ? cy + read() : read();
      const x2 = rel ? cx + read() : read();
      const y2 = rel ? cy + read() : read();
      const x3 = rel ? cx + read() : read();
      const y3 = rel ? cy + read() : read();
      pts.push(...cubic(cx, cy, x1, y1, x2, y2, x3, y3));
      cx = x3;
      cy = y3;
    } else if (cmd === 'Q' || cmd === 'q') {
      const rel = cmd === 'q';
      const x1 = rel ? cx + read() : read();
      const y1 = rel ? cy + read() : read();
      const x2 = rel ? cx + read() : read();
      const y2 = rel ? cy + read() : read();
      pts.push(...quad(cx, cy, x1, y1, x2, y2));
      cx = x2;
      cy = y2;
    } else if (cmd === 'Z' || cmd === 'z') {
      cx = sx;
      cy = sy;
      pts.push([cx, cy]);
    } else {
      break;
    }
  }
  return pts;
}

export function pathBox(d: string): PathBox | null {
  const raw = sampleStrokePath(d);
  if (raw.length < 2) return null;
  const pts = raw.map(([x, y]) => toUnit(x, y));
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return {
    minX,
    minY,
    maxX,
    maxY,
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
    width: Math.max(maxX - minX, 0.04),
    height: Math.max(maxY - minY, 0.04),
  };
}
