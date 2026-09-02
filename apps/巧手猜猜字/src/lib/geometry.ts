import { objectScale } from '@/lib/strokeMetrics';
import type { CharData, JudgeResult, Median, Piece, StrokeJudgement, StrokeSlot } from '@/types';

/**
 * makemeahanzi 與 animCJK 共用同一個座標系：
 * 邊長 1024，左上角是 (0, 900)、右下角是 (1024, -124)，y 軸向下遞減。
 * 這裡一律先轉成 0–1 的正規化座標（y 向下遞增），米字格與物件都用它。
 */
const GRID = 1024;
const TOP = 900;

export function toUnit([x, y]: [number, number]): [number, number] {
  return [x / GRID, (TOP - y) / GRID];
}

/** 折線總長，正規化單位。 */
function pathLength(points: [number, number][]): number {
  let sum = 0;
  for (let i = 1; i < points.length; i += 1) {
    sum += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  }
  return sum;
}

/**
 * 由一筆的中線推導出目標槽位。
 *
 * 這是整個遊戲省下大量人工的地方：物件該擺在格子哪裡、轉幾度、多長，
 * 全部從筆順資料的 median 算出來，不必逐字手排座標。
 */
export function slotFromMedian(median: Median, index: number, strokeId: StrokeSlot['strokeId']): StrokeSlot {
  const pts = median.map(toUnit);
  const first = pts[0];
  const last = pts[pts.length - 1];

  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  // 中心取外框中心，帶鈎、帶彎的筆才不會被鈎那一小段把重心拉偏
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  /**
   * 點的中線常先平後陡：首末連線約 45°，收筆那一段才是字影看起來的方向。
   * 用收筆方向對齊水滴，才會跟米字格裡的墨跡一致。
   */
  let angle: number;
  if (strokeId === 'dian' && pts.length >= 3) {
    const a = pts[pts.length - 2];
    const b = last;
    angle = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
  } else {
    angle = (Math.atan2(last[1] - first[1], last[0] - first[0]) * 180) / Math.PI;
  }
  const span = Math.hypot(last[0] - first[0], last[1] - first[1]);

  return {
    index,
    strokeId,
    cx,
    cy,
    angle,
    length: Math.max(span, 0.06),
    // 物品圖是按外框裁成正方形的，所以物品該有的大小是外框最大邊，不是首末點距離
    extent: Math.max(maxX - minX, maxY - minY, pathLength(pts) * 0.2, 0.09),
  };
}

export function slotsForChar(data: CharData): StrokeSlot[] {
  return data.medians.map((m, i) => slotFromMedian(m, i, data.strokeTypes[i] ?? null));
}

/** 角度差，收斂到 0–180。 */
export function angleDelta(a: number, b: number): number {
  let d = Math.abs(a - b) % 360;
  if (d > 180) d = 360 - d;
  return d;
}

// ── 判定容差 ──

export const TOLERANCE = {
  /** 中心距離，正規化單位。0.16 約等於米字格的六分之一 */
  distance: 0.16,
  /** 角度，度 */
  angle: 30,
  /** 長度比例的容許倍數區間 */
  scaleLow: 0.55,
  scaleHigh: 1.9,
  /** 練習模式：拖進格子且種類對就黏到槽位 */
  snap: 0.22,
};

/** 練習模式：找出離某個座標最近、且尚未填滿的槽位。 */
export function nearestSlot(
  slots: StrokeSlot[],
  x: number,
  y: number,
  taken: Set<number>,
  radius = TOLERANCE.snap
): StrokeSlot | null {
  let best: StrokeSlot | null = null;
  let bestDist = radius;
  for (const slot of slots) {
    if (taken.has(slot.index)) continue;
    const d = Math.hypot(slot.cx - x, slot.cy - y);
    if (d <= bestDist) {
      bestDist = d;
      best = slot;
    }
  }
  return best;
}

/**
 * 「拼好了」的三層判定，完全靠幾何比對，不用影像辨識。
 *
 *   kind      有沒有用對物件種類
 *   order     放置次序是否合筆順
 *   placement 位置、角度、長度是否落在容差內
 *
 * 配對方式：每個槽位挑一件「同種類、尚未配對、且中心最近」的物件。
 * 同種類的筆在一個字裡常出現多次（三、目），所以要一對一配掉，不能重複用。
 */
export function judge(slots: StrokeSlot[], pieces: Piece[]): JudgeResult {
  const used = new Set<string>();
  const perStroke: StrokeJudgement[] = [];

  // 先照筆順逐槽配對，讓「先放的物件配到先寫的筆」這件事有意義
  for (const slot of slots) {
    let match: Piece | null = null;
    let matchDist = Infinity;

    for (const piece of pieces) {
      if (used.has(piece.id)) continue;
      if (slot.strokeId && piece.strokeId !== slot.strokeId) continue;
      const d = Math.hypot(piece.x - slot.cx, piece.y - slot.cy);
      if (d < matchDist) {
        matchDist = d;
        match = piece;
      }
    }

    if (!match) {
      perStroke.push({
        slotIndex: slot.index,
        strokeId: slot.strokeId,
        kindOk: false,
        orderOk: false,
        placementOk: false,
      });
      continue;
    }

    used.add(match.id);
    const expected = slot.strokeId ? objectScale(slot, slot.strokeId) : slot.extent;
    const placementOk =
      matchDist <= TOLERANCE.distance &&
      angleDelta(match.rot, slot.angle) <= TOLERANCE.angle &&
      match.scale >= expected * TOLERANCE.scaleLow &&
      match.scale <= expected * TOLERANCE.scaleHigh;

    perStroke.push({
      slotIndex: slot.index,
      strokeId: slot.strokeId,
      pieceId: match.id,
      kindOk: true,
      // 放置次序等於筆順：第 n 個放下的物件應該配到第 n 筆
      orderOk: match.seq === slot.index,
      placementOk,
    });
  }

  const total = slots.length;
  const kind = perStroke.filter((s) => s.kindOk).length;
  const order = perStroke.filter((s) => s.kindOk && s.orderOk).length;
  const placement = perStroke.filter((s) => s.kindOk && s.placementOk).length;

  return {
    total,
    matched: kind,
    kindScore: total ? kind / total : 0,
    orderScore: total ? order / total : 0,
    placementScore: total ? placement / total : 0,
    perStroke,
    extraPieceIds: pieces.filter((p) => !used.has(p.id)).map((p) => p.id),
    // 種類與位置都對、且沒有多放，才算拼好；筆順單獨顯示，不擋過關
    passed: kind === total && placement === total && pieces.length === total,
  };
}

/** 這個字用得到哪些物件，工具欄只發這些。 */
export function requiredStrokeIds(data: CharData): string[] {
  const seen = new Set<string>();
  for (const id of data.strokeTypes) {
    if (id) seen.add(id);
  }
  return [...seen];
}
