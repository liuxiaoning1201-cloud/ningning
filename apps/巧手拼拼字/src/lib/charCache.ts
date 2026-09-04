import type { CharSource, Median } from '@/types';

/** 下載過的筆順路徑，下次不用再等 CDN。分類仍每次現場跑。 */
export const CHAR_CACHE_DB = 'caicaizi_char_cache_v1';
const STORE = 'raw';

export interface RawCharRecord {
  char: string;
  strokes: string[];
  medians: Median[];
  source: CharSource;
}

const memory = new Map<string, RawCharRecord>();
let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      try {
        const req = indexedDB.open(CHAR_CACHE_DB, 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'char' });
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }
  return dbPromise;
}

export function rememberRawChar(record: RawCharRecord): void {
  memory.set(record.char, record);
}

export async function writeRawChar(record: RawCharRecord): Promise<void> {
  rememberRawChar(record);
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function readRawChar(ch: string): Promise<RawCharRecord | null> {
  const hit = memory.get(ch);
  if (hit) return hit;
  const db = await openDb();
  if (!db) return null;
  const row = await new Promise<RawCharRecord | null>((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(ch);
      req.onsuccess = () => resolve((req.result as RawCharRecord | undefined) ?? null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  if (row?.strokes?.length && row.strokes.length === row.medians?.length) {
    rememberRawChar(row);
    return row;
  }
  return null;
}

export function resetCharCacheForTests(): void {
  memory.clear();
}

export async function mapPool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(Math.max(1, limit), items.length || 1) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      await fn(items[index]);
    }
  });
  await Promise.all(workers);
}
