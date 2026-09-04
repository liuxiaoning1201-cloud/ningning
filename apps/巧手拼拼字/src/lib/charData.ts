import bundled from '@/data/chars.json';
import hkCharset from '@/data/hkCharset.json';
import { isStrokeId } from '@/data/strokes';
import { mapPool, readRawChar, writeRawChar, type RawCharRecord } from '@/lib/charCache';
import { fillStrokeTypes } from '@/lib/classifyStroke';
import { mergeSplitEarRadical } from '@/lib/earRadical';
import { applyStrokeLayout } from '@/lib/strokeLayouts';
import { applyStrokeLocks } from '@/lib/strokeLocks';
import { mergeSplitWalkingNa } from '@/lib/walkingRadical';
import type { CharData, CharSource, Median, StrokeId } from '@/types';

/**
 * 字形筆順資料的取用層。
 *
 * 隨 app 一起打包的 chars.json 是製作期跑 scripts/gen-char-data.mjs 產生的，
 * 已核對的筆畫標註離線可用。老師臨時加的字若不在包裡，即時打 CDN，
 * 再依動畫中線分類、用開源名稱訂正——不必人工複核才能練。
 *
 * 來源順序：人工 override（對齊《小學學習字詞表》）→ animCJK ZhHant → makemeahanzi。
 * 筆畫名稱：物品跟字卡動畫同一筆序；開源名稱只在同一條路徑上訂正，
 * 或改配到外形相符的另一筆。人工核對過的字不會被覆蓋。
 */

const BUNDLED = bundled as unknown as Record<string, CharData>;

const HK_CHARS = new Set((hkCharset as { chars: string }).chars);

const ZHHANT = (ch: string) =>
  `https://cdn.jsdelivr.net/npm/hanzi-writer-data-acjk@1.0.0/animCJK/ZhHant/${encodeURIComponent(ch)}.json`;
const MMAH = (ch: string) =>
  `https://cdn.jsdelivr.net/npm/hanzi-writer-data@latest/${encodeURIComponent(ch)}.json`;

const cache = new Map<string, CharData | null>();

/** 是否為香港《常用字字形表》收錄字。老師加字時用它擋掉非港標字。 */
export function isHkChar(ch: string): boolean {
  return HK_CHARS.has(ch);
}

export function hkCharsetSize(): number {
  return HK_CHARS.size;
}

/** 已隨 app 打包、可離線玩的字。 */
export function bundledChars(): string[] {
  return Object.keys(BUNDLED);
}

export function verifiedChars(): string[] {
  return Object.values(BUNDLED)
    .filter((c) => c.verified)
    .map((c) => c.char);
}

function sanitizeTypes(input: unknown, count: number): (StrokeId | null)[] {
  if (!Array.isArray(input) || input.length !== count) {
    return Array.from({ length: count }, () => null);
  }
  return input.map((v) => (isStrokeId(v) ? v : null));
}

/** 人工標註保留，缺的用幾何自動補齊，練習模式才能立刻鎖筆順。 */
function finish(data: CharData): CharData {
  const merged = mergeSplitWalkingNa(
    mergeSplitEarRadical({
      ...data,
      strokeTypes: sanitizeTypes(data.strokeTypes, data.strokes.length),
    })
  );
  const existing = applyStrokeLocks(merged.char, merged.strokeTypes, merged.medians.length);
  const classified: CharData = {
    ...merged,
    strokeTypes: fillStrokeTypes(merged.medians, existing, merged.char),
  };
  return applyStrokeLayout(classified);
}

/** 老師改過筆畫後，下次 loadChar 要重新跑分類。 */
export function forgetChar(ch: string): void {
  cache.delete(ch);
}

export function forgetAllChars(): void {
  cache.clear();
}

async function fetchRemote(ch: string): Promise<CharData | null> {
  for (const [source, url] of [
    ['ZhHant', ZHHANT(ch)],
    ['makemeahanzi', MMAH(ch)],
  ] as const) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const raw = (await res.json()) as { strokes?: string[]; medians?: Median[] };
      if (!raw.strokes?.length || raw.strokes.length !== raw.medians?.length) continue;
      const record: RawCharRecord = {
        char: ch,
        strokes: raw.strokes,
        medians: raw.medians,
        source: source as CharSource,
      };
      await writeRawChar(record);
      return finish({
        ...record,
        strokeTypes: sanitizeTypes(null, raw.strokes.length),
        verified: false,
      });
    } catch {
      // 換下一個來源
    }
  }
  return null;
}

function finishRecord(record: { char: string; strokes: string[]; medians: Median[]; source: CharSource; strokeTypes?: unknown; verified?: boolean }): CharData {
  return finish({
    char: record.char,
    strokes: record.strokes,
    medians: record.medians,
    strokeTypes: sanitizeTypes(record.strokeTypes, record.strokes.length),
    source: record.source,
    verified: Boolean(record.verified),
  });
}

export async function loadChar(ch: string): Promise<CharData | null> {
  if (cache.has(ch)) return cache.get(ch) ?? null;

  const local = BUNDLED[ch];
  if (local) {
    const data = finishRecord(local);
    cache.set(ch, data);
    return data;
  }

  const stored = await readRawChar(ch);
  if (stored) {
    const data = finishRecord(stored);
    cache.set(ch, data);
    return data;
  }

  const remote = await fetchRemote(ch);
  cache.set(ch, remote);
  return remote;
}

/**
 * 建字簿或進練習前，把整本字認完。已打包或已快取的幾乎不等待。
 */
export async function prefetchChars(
  chars: string[],
  onProgress?: (done: number, total: number) => void
): Promise<void> {
  const unique = [...new Set(chars.filter((c) => [...c].length === 1).map((c) => [...c][0]))];
  let done = 0;
  const total = unique.length;
  if (!total) {
    onProgress?.(0, 0);
    return;
  }
  await mapPool(unique, 5, async (ch) => {
    await loadChar(ch);
    done += 1;
    onProgress?.(done, total);
  });
}

export type CharReadiness = 'ready' | 'pending' | 'missing' | 'unknown';

/**
 * 一個字能不能拿來練：
 *   ready    本地已有筆順（含自動補上的筆畫種類）
 *   unknown  港標字，進入遊戲時再下載
 *   missing  不在港標、也沒有本地資料
 */
export function readiness(ch: string): CharReadiness {
  if (BUNDLED[ch]) return 'ready';
  if (isHkChar(ch)) return 'unknown';
  return 'missing';
}

/** 字簿裡的字只要不是明確缺失，就可以進練習／挑戰。 */
export function canPlay(ch: string): boolean {
  return readiness(ch) !== 'missing';
}

export function readinessLabel(state: CharReadiness): string {
  switch (state) {
    case 'ready':
    case 'pending':
    case 'unknown':
      return '可練習';
    default:
      return '沒有筆順資料';
  }
}
