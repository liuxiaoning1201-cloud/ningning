import { isStrokeId } from '@/data/strokes';
import type { CharData, Median, StrokeId } from '@/types';

/**
 * 老師增刪過筆數的字。只記「練習要用哪幾筆、各是哪一件物品」。
 * from 對應分類（含走之底／耳朵旁黏合）後的原始路徑索引；
 * from 為 null 代表老師插入、沒有墨跡的合成筆。
 */
export const STROKE_LAYOUTS_KEY = 'caicaizi_stroke_layouts_v1';

export interface StrokeLayoutItem {
  type: StrokeId;
  from: number | null;
  /** 快照當下的自動／鎖定種類，用來「還原這一筆」。 */
  auto?: StrokeId;
}

export interface StrokeLayout {
  items: StrokeLayoutItem[];
}

export type StrokeLayoutMap = Record<string, StrokeLayout>;

let memory: StrokeLayoutMap | null = null;
const listeners = new Set<() => void>();

function canUseStorage(): boolean {
  return typeof localStorage !== 'undefined';
}

function sanitizeItem(raw: unknown): StrokeLayoutItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as { type?: unknown; from?: unknown; auto?: unknown };
  if (!isStrokeId(row.type)) return null;
  const from =
    row.from === null || row.from === undefined
      ? null
      : typeof row.from === 'number' && Number.isInteger(row.from) && row.from >= 0
        ? row.from
        : null;
  const auto = isStrokeId(row.auto) ? row.auto : undefined;
  return { type: row.type, from, auto };
}

function sanitizeLayout(raw: unknown): StrokeLayout | null {
  if (!raw || typeof raw !== 'object') return null;
  const items = (raw as { items?: unknown }).items;
  if (!Array.isArray(items) || !items.length) return null;
  const next: StrokeLayoutItem[] = [];
  for (const item of items) {
    const clean = sanitizeItem(item);
    if (clean) next.push(clean);
  }
  return next.length ? { items: next } : null;
}

function sanitizeMap(input: StrokeLayoutMap): StrokeLayoutMap {
  const out: StrokeLayoutMap = {};
  for (const [ch, layout] of Object.entries(input)) {
    if (typeof ch !== 'string' || ch.length !== 1) continue;
    const clean = sanitizeLayout(layout);
    if (clean) out[ch] = clean;
  }
  return out;
}

function readRaw(): StrokeLayoutMap {
  if (memory) return memory;
  if (!canUseStorage()) {
    memory = {};
    return memory;
  }
  try {
    const raw = localStorage.getItem(STROKE_LAYOUTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StrokeLayoutMap;
      if (parsed && typeof parsed === 'object') {
        memory = sanitizeMap(parsed);
        return memory;
      }
    }
  } catch {
    // 壞掉就當沒改過
  }
  memory = {};
  return memory;
}

function persist() {
  if (!memory) return;
  if (canUseStorage()) localStorage.setItem(STROKE_LAYOUTS_KEY, JSON.stringify(memory));
  for (const fn of listeners) fn();
}

function writeChar(ch: string, layout: StrokeLayout | null): void {
  const map = { ...readRaw() };
  if (!layout?.items.length) delete map[ch];
  else map[ch] = { items: layout.items.map((item) => ({ ...item })) };
  memory = map;
  persist();
}

export function subscribeStrokeLayouts(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getStrokeLayoutMap(): StrokeLayoutMap {
  return readRaw();
}

export function getStrokeLayout(ch: string): StrokeLayout | null {
  return readRaw()[ch] ?? null;
}

export function hasStrokeLayout(ch: string): boolean {
  return Boolean(getStrokeLayout(ch)?.items.length);
}

export function ensureStrokeLayout(ch: string, types: (StrokeId | null)[]): StrokeLayout {
  const existing = getStrokeLayout(ch);
  if (existing) return existing;
  const items: StrokeLayoutItem[] = types.map((type, i) => {
    const t = type ?? 'heng';
    return { type: t, from: i, auto: t };
  });
  writeChar(ch, { items });
  return { items };
}

export function setLayoutItemType(ch: string, index: number, type: StrokeId): void {
  const layout = getStrokeLayout(ch);
  if (!layout || index < 0 || index >= layout.items.length) return;
  const items = layout.items.map((item, i) => (i === index ? { ...item, type } : item));
  writeChar(ch, { items });
}

export function insertLayoutItem(ch: string, afterIndex: number, type: StrokeId): void {
  const layout = getStrokeLayout(ch);
  if (!layout) return;
  const items = layout.items.map((item) => ({ ...item }));
  const at = Math.max(0, Math.min(afterIndex + 1, items.length));
  items.splice(at, 0, { type, from: null });
  writeChar(ch, { items });
}

export function removeLayoutItem(ch: string, index: number): boolean {
  const layout = getStrokeLayout(ch);
  if (!layout || layout.items.length <= 1) return false;
  if (index < 0 || index >= layout.items.length) return false;
  const items = layout.items.filter((_, i) => i !== index);
  writeChar(ch, { items });
  return true;
}

export function restoreLayoutItemType(ch: string, index: number): boolean {
  const layout = getStrokeLayout(ch);
  const item = layout?.items[index];
  if (!item?.auto || item.from == null) return false;
  if (item.type === item.auto) return true;
  setLayoutItemType(ch, index, item.auto);
  return true;
}

export function clearCharStrokeLayout(ch: string): void {
  writeChar(ch, null);
}

export function replaceStrokeLayoutMap(next: StrokeLayoutMap): void {
  memory = sanitizeMap(next);
  persist();
}

export function mergeStrokeLayoutMap(incoming: StrokeLayoutMap): number {
  const map = { ...readRaw() };
  const clean = sanitizeMap(incoming);
  let added = 0;
  for (const [ch, layout] of Object.entries(clean)) {
    map[ch] = layout;
    added += 1;
  }
  memory = map;
  persist();
  return added;
}

/** 測試用：清掉記憶體裡的排版，不碰 localStorage。 */
export function resetStrokeLayoutsForTests(): void {
  memory = {};
}

function cloneMedian(median: Median): Median {
  return median.map(([x, y]) => [x, y]);
}

function syntheticMedian(neighbor: Median | undefined, slotIndex: number): Median {
  const pts = neighbor?.length ? neighbor : ([[400, 500], [620, 500]] as Median);
  const mid = pts[Math.floor(pts.length / 2)] ?? [512, 400];
  const y = mid[1] - 28 * ((slotIndex % 6) + 1);
  return [
    [mid[0] - 100, y],
    [mid[0] + 100, y],
  ];
}

/**
 * 把老師的增刪套到分類結果上。沒有排版就原樣返回。
 * 合成筆沒有墨跡路徑，字影不畫；median 仍能算出練習槽位。
 */
export function applyStrokeLayout(data: CharData): CharData {
  const layout = getStrokeLayout(data.char);
  if (!layout?.items.length) return data;

  const strokes: string[] = [];
  const medians: Median[] = [];
  const strokeTypes: (StrokeId | null)[] = [];
  const synthetic: boolean[] = [];

  for (const item of layout.items) {
    const from = item.from;
    if (from != null && from >= 0 && from < data.strokes.length && from < data.medians.length) {
      strokes.push(data.strokes[from]);
      medians.push(cloneMedian(data.medians[from]));
      strokeTypes.push(item.type);
      synthetic.push(false);
    } else {
      const neighbor =
        medians[medians.length - 1] ??
        (from != null ? data.medians[Math.min(from, data.medians.length - 1)] : data.medians[0]);
      medians.push(syntheticMedian(neighbor, strokes.length));
      strokes.push('');
      strokeTypes.push(item.type);
      synthetic.push(true);
    }
  }

  return {
    ...data,
    strokes,
    medians,
    strokeTypes,
    synthetic,
  };
}

/** 字影／動畫只畫有墨跡的筆，老師加的空筆不畫。 */
export function inkStrokePaths(data: CharData): string[] {
  return data.strokes.filter((d, i) => Boolean(d) && !data.synthetic?.[i]);
}
