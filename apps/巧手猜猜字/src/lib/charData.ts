import bundled from '@/data/chars.json';
import hkCharset from '@/data/hkCharset.json';
import { isStrokeId } from '@/data/strokes';
import type { CharData, Median, StrokeId } from '@/types';

/**
 * 字形筆順資料的取用層。
 *
 * 隨 app 一起打包的 chars.json 是製作期跑 scripts/gen-char-data.mjs 產生的，
 * 涵蓋已核對的字，離線可用。老師臨時加的字若不在包裡，才即時打 CDN，
 * 順序仍是 animCJK ZhHant（繁體、貼近港標）優先，makemeahanzi 備援。
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
      return {
        char: ch,
        strokes: raw.strokes,
        medians: raw.medians,
        strokeTypes: sanitizeTypes(null, raw.strokes.length),
        source,
        verified: false,
      };
    } catch {
      // 換下一個來源
    }
  }
  return null;
}

export async function loadChar(ch: string): Promise<CharData | null> {
  if (cache.has(ch)) return cache.get(ch) ?? null;

  const local = BUNDLED[ch];
  if (local) {
    const data: CharData = {
      ...local,
      strokeTypes: sanitizeTypes(local.strokeTypes, local.strokes.length),
    };
    cache.set(ch, data);
    return data;
  }

  const remote = await fetchRemote(ch);
  cache.set(ch, remote);
  return remote;
}

export type CharReadiness = 'ready' | 'pending' | 'missing' | 'unknown';

/**
 * 一個字能玩到什麼程度：
 *   ready    筆畫標註已覈核，練習模式可以鎖筆順
 *   pending  有筆順動畫，但筆畫種類待核，只能玩挑戰模式的位置比對
 *   missing  沒有筆順資料
 */
export function readiness(ch: string): CharReadiness {
  const local = BUNDLED[ch];
  if (local) return local.verified ? 'ready' : 'pending';
  if (!isHkChar(ch)) return 'missing';
  return 'unknown';
}

export function readinessLabel(state: CharReadiness): string {
  switch (state) {
    case 'ready':
      return '已核對';
    case 'pending':
      return '筆順待核';
    case 'unknown':
      return '未收錄，需即時下載';
    default:
      return '沒有筆順資料';
  }
}
