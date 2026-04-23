/**
 * 用 Canvas 路徑畫出多種卡通水果，避免依賴系統 emoji。
 * 每個水果在 r=半徑的本地座標下繪製（中心 0,0）。
 */

export type FruitKind = 'apple' | 'pear' | 'orange' | 'grape' | 'watermelon' | 'strawberry';

export const FRUIT_KINDS: FruitKind[] = ['apple', 'pear', 'orange', 'grape', 'watermelon', 'strawberry'];

const ACCENT: Record<FruitKind, { main: string; soft: string }> = {
  apple: { main: '#e6354b', soft: '#ff8b96' },
  pear: { main: '#9bc94c', soft: '#dff39a' },
  orange: { main: '#ff8a1f', soft: '#ffd28a' },
  grape: { main: '#7b3fb6', soft: '#c89bf0' },
  watermelon: { main: '#21b25c', soft: '#ff5e7d' },
  strawberry: { main: '#e8254e', soft: '#ffb3c0' },
};

/** 詞語 → 水果，種類確定（同詞同果） */
export function fruitForWord(word: string): FruitKind {
  let h = 0;
  for (let i = 0; i < word.length; i++) h = (h * 31 + word.charCodeAt(i)) >>> 0;
  return FRUIT_KINDS[h % FRUIT_KINDS.length]!;
}

export function accentFor(kind: FruitKind) {
  return ACCENT[kind];
}

function leaf(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, angle = -0.4) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = '#3aa55b';
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.45, r * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#1f6f3b';
  ctx.lineWidth = Math.max(1, r * 0.04);
  ctx.beginPath();
  ctx.moveTo(-r * 0.4, 0);
  ctx.lineTo(r * 0.4, 0);
  ctx.stroke();
  ctx.restore();
}

function stem(ctx: CanvasRenderingContext2D, r: number, w = 0.12, h = 0.32) {
  ctx.fillStyle = '#7a4a25';
  ctx.beginPath();
  ctx.roundRect(-r * w * 0.5, -r * (1 + h), r * w, r * h, r * 0.05);
  ctx.fill();
}

function highlight(ctx: CanvasRenderingContext2D, r: number) {
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath();
  ctx.ellipse(-r * 0.32, -r * 0.32, r * 0.22, r * 0.12, -0.6, 0, Math.PI * 2);
  ctx.fill();
}

function drawApple(ctx: CanvasRenderingContext2D, r: number) {
  const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
  grad.addColorStop(0, '#ff8190');
  grad.addColorStop(0.55, '#e6354b');
  grad.addColorStop(1, '#9c1730');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.85);
  ctx.bezierCurveTo(r, -r * 0.95, r * 1.05, r * 0.45, 0, r * 0.95);
  ctx.bezierCurveTo(-r * 1.05, r * 0.45, -r, -r * 0.95, 0, -r * 0.85);
  ctx.fill();
  stem(ctx, r);
  leaf(ctx, r * 0.18, -r * 1.0, r);
  highlight(ctx, r);
}

function drawPear(ctx: CanvasRenderingContext2D, r: number) {
  const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
  grad.addColorStop(0, '#dff39a');
  grad.addColorStop(0.6, '#9bc94c');
  grad.addColorStop(1, '#5d8a23');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.95);
  ctx.bezierCurveTo(r * 0.6, -r * 0.85, r * 0.95, r * 0.1, r * 0.55, r * 0.7);
  ctx.bezierCurveTo(r * 0.2, r * 1.05, -r * 0.2, r * 1.05, -r * 0.55, r * 0.7);
  ctx.bezierCurveTo(-r * 0.95, r * 0.1, -r * 0.6, -r * 0.85, 0, -r * 0.95);
  ctx.fill();
  stem(ctx, r, 0.1, 0.28);
  leaf(ctx, r * 0.2, -r * 0.95, r, -0.6);
  highlight(ctx, r);
}

function drawOrange(ctx: CanvasRenderingContext2D, r: number) {
  const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
  grad.addColorStop(0, '#ffd28a');
  grad.addColorStop(0.55, '#ff8a1f');
  grad.addColorStop(1, '#c95900');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.92, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = Math.max(1, r * 0.04);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * r * 0.85, Math.sin(a) * r * 0.85);
    ctx.stroke();
  }
  leaf(ctx, 0, -r * 0.92, r, -0.2);
  highlight(ctx, r);
}

function drawGrape(ctx: CanvasRenderingContext2D, r: number) {
  ctx.fillStyle = '#3aa55b';
  ctx.beginPath();
  ctx.ellipse(r * 0.05, -r * 0.85, r * 0.45, r * 0.16, -0.3, 0, Math.PI * 2);
  ctx.fill();
  const positions: Array<[number, number, number]> = [
    [0, -r * 0.55, r * 0.32],
    [-r * 0.45, -r * 0.3, r * 0.32],
    [r * 0.45, -r * 0.3, r * 0.32],
    [-r * 0.25, r * 0.05, r * 0.32],
    [r * 0.25, r * 0.05, r * 0.32],
    [-r * 0.4, r * 0.4, r * 0.3],
    [r * 0.4, r * 0.4, r * 0.3],
    [0, r * 0.55, r * 0.32],
  ];
  for (const [x, y, gr] of positions) {
    const grad = ctx.createRadialGradient(x - gr * 0.4, y - gr * 0.4, gr * 0.15, x, y, gr);
    grad.addColorStop(0, '#c89bf0');
    grad.addColorStop(0.6, '#7b3fb6');
    grad.addColorStop(1, '#3a1764');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, gr, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawWatermelon(ctx: CanvasRenderingContext2D, r: number) {
  ctx.fillStyle = '#21b25c';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.95, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.86, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  const grad = ctx.createRadialGradient(0, 0, r * 0.1, 0, 0, r * 0.78);
  grad.addColorStop(0, '#ff8aa6');
  grad.addColorStop(1, '#e93b66');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.78, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#321010';
  for (let i = 0; i < 5; i++) {
    const t = (i + 1) / 6;
    const x = -r * 0.6 + t * r * 1.2;
    ctx.beginPath();
    ctx.ellipse(x, -r * 0.25, r * 0.06, r * 0.1, 0.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawStrawberry(ctx: CanvasRenderingContext2D, r: number) {
  const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
  grad.addColorStop(0, '#ffb3c0');
  grad.addColorStop(0.55, '#e8254e');
  grad.addColorStop(1, '#8c0a25');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.78);
  ctx.bezierCurveTo(r * 0.95, -r * 0.6, r * 0.7, r * 0.45, 0, r * 0.95);
  ctx.bezierCurveTo(-r * 0.7, r * 0.45, -r * 0.95, -r * 0.6, 0, -r * 0.78);
  ctx.fill();
  ctx.fillStyle = '#fff7c2';
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 1.4 - Math.PI * 0.7;
    const x = Math.cos(a) * r * 0.45;
    const y = Math.sin(a) * r * 0.5 + r * 0.05;
    ctx.beginPath();
    ctx.ellipse(x, y, r * 0.06, r * 0.1, a, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#3aa55b';
  for (let i = -2; i <= 2; i++) {
    ctx.save();
    ctx.translate(0, -r * 0.7);
    ctx.rotate((i / 4) * Math.PI * 0.7);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(r * 0.18, r * 0.15);
    ctx.lineTo(0, r * 0.32);
    ctx.lineTo(-r * 0.18, r * 0.15);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

const PAINTERS: Record<FruitKind, (ctx: CanvasRenderingContext2D, r: number) => void> = {
  apple: drawApple,
  pear: drawPear,
  orange: drawOrange,
  grape: drawGrape,
  watermelon: drawWatermelon,
  strawberry: drawStrawberry,
};

export function drawFruit(
  ctx: CanvasRenderingContext2D,
  kind: FruitKind,
  cx: number,
  cy: number,
  r: number,
  bobAngle = 0
) {
  ctx.save();
  ctx.translate(cx, cy);
  if (bobAngle) ctx.rotate(bobAngle);
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = r * 0.3;
  ctx.shadowOffsetY = r * 0.15;
  PAINTERS[kind](ctx, r);
  ctx.restore();
}
