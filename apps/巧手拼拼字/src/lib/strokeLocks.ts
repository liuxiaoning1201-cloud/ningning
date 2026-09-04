import { isStrokeId } from '@/data/strokes';
import type { StrokeId } from '@/types';

/**
 * 老師在軟體裡改過的筆畫名稱。只記「這個字第 n 筆用哪一件物品」，
 * 不改動畫路徑。自動分類不會蓋掉這些鎖定。
 */
export const STROKE_LOCKS_KEY = 'caicaizi_stroke_locks_v1';

export type StrokeLockMap = Record<string, Record<string, StrokeId>>;

let memory: StrokeLockMap | null = null;
const listeners = new Set<() => void>();

function canUseStorage(): boolean {
  return typeof localStorage !== 'undefined';
}

function readRaw(): StrokeLockMap {
  if (memory) return memory;
  if (!canUseStorage()) {
    memory = {};
    return memory;
  }
  try {
    const raw = localStorage.getItem(STROKE_LOCKS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StrokeLockMap;
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

function sanitizeMap(input: StrokeLockMap): StrokeLockMap {
  const out: StrokeLockMap = {};
  for (const [ch, locks] of Object.entries(input)) {
    if (typeof ch !== 'string' || ch.length !== 1 || !locks || typeof locks !== 'object') continue;
    const row: Record<string, StrokeId> = {};
    for (const [idx, id] of Object.entries(locks)) {
      if (isStrokeId(id) && /^\d+$/.test(idx)) row[idx] = id;
    }
    if (Object.keys(row).length) out[ch] = row;
  }
  return out;
}

function persist() {
  if (!memory) return;
  if (canUseStorage()) localStorage.setItem(STROKE_LOCKS_KEY, JSON.stringify(memory));
  for (const fn of listeners) fn();
}

export function subscribeStrokeLocks(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getStrokeLockMap(): StrokeLockMap {
  return readRaw();
}

export function getStrokeLocks(ch: string): Record<number, StrokeId> {
  const row = readRaw()[ch];
  if (!row) return {};
  const out: Record<number, StrokeId> = {};
  for (const [idx, id] of Object.entries(row)) out[Number(idx)] = id;
  return out;
}

export function hasStrokeLocks(ch: string): boolean {
  return Object.keys(getStrokeLocks(ch)).length > 0;
}

export function applyStrokeLocks(
  ch: string,
  existing: (StrokeId | null)[],
  count: number
): (StrokeId | null)[] {
  const next = existing.slice(0, count);
  while (next.length < count) next.push(null);
  const locks = getStrokeLocks(ch);
  for (const [idx, id] of Object.entries(locks)) {
    const i = Number(idx);
    if (i >= 0 && i < count) next[i] = id;
  }
  return next;
}

export function setStrokeLock(ch: string, index: number, id: StrokeId): void {
  const map = { ...readRaw() };
  const row = { ...(map[ch] ?? {}) };
  row[String(index)] = id;
  map[ch] = row;
  memory = map;
  persist();
}

export function clearStrokeLock(ch: string, index: number): void {
  const map = { ...readRaw() };
  const row = { ...(map[ch] ?? {}) };
  delete row[String(index)];
  if (Object.keys(row).length) map[ch] = row;
  else delete map[ch];
  memory = map;
  persist();
}

export function clearCharStrokeLocks(ch: string): void {
  const map = { ...readRaw() };
  delete map[ch];
  memory = map;
  persist();
}

export function replaceStrokeLockMap(next: StrokeLockMap): void {
  memory = sanitizeMap(next);
  persist();
}

export function mergeStrokeLockMap(incoming: StrokeLockMap): number {
  const map = { ...readRaw() };
  let added = 0;
  for (const [ch, locks] of Object.entries(sanitizeMap(incoming))) {
    map[ch] = { ...(map[ch] ?? {}), ...locks };
    added += 1;
  }
  memory = map;
  persist();
  return added;
}

/** 測試用：清掉記憶體裡的鎖定，不碰 localStorage。 */
export function resetStrokeLocksForTests(): void {
  memory = {};
}
